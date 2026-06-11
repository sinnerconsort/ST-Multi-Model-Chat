/**
 * Multi-Model Chat Extension for SillyTavern — v3.0.0
 *
 * Assign different connection profiles (APIs/models) to different characters.
 * When a character is drafted to speak in a group chat, their profile is
 * applied automatically before generation.
 *
 * v3.0 rewrite:
 * - Profile detection reads the canonical store
 *   (extensionSettings.connectionManager.profiles) — the v2 guess-cascade
 *   and the entire manual-add workaround are gone.
 * - Assignments are keyed by character avatar filename (stable across
 *   renames/duplicates). v2 name-keyed assignments migrate automatically.
 * - Auto-switch handles ST's actual GROUP_MEMBER_DRAFTED payload (a string
 *   character index) and verifies the profile actually applied. No longer
 *   experimental — this is now the primary mode.
 * - "Restore original profile" is implemented (it was advertised but dead
 *   code in v2).
 * - Per-group default profile (assignment precedence:
 *   character > group default > global fallback).
 * - Exact character matching only — no fuzzy substring guessing.
 * - Event-driven control injection; the body-wide MutationObserver is gone.
 *
 * Slash commands: /mmc-go, /mmc-assign, /mmc-debug
 */

const MODULE_NAME = 'multi_model_chat';   // unchanged — preserves v2 settings
const VERSION = '3.0.3';
const LOG = `[${MODULE_NAME}]`;

const defaultSettings = {
    enabled: true,
    showToasts: true,
    autoSwitch: true,                 // the headline feature; on for new users
    restoreProfileAfterGroup: false,
    fallbackProfile: '',
    characterProfiles: {},            // v3: { avatarFilename: profileName }
    legacyNameProfiles: {},           // unmigratable v2 leftovers, name-keyed
    groupDefaults: {},                // { groupId: profileName }
    settingsVersion: 3,
};

let settings = { ...defaultSettings };
let originalProfile = null;           // captured before the first group switch
let wasInGroup = false;
let isInitialized = false;

// ─── Context helpers ─────────────────────────────────────────────────────────

function ctx() {
    return SillyTavern.getContext();
}

function isGroupChat() {
    const c = ctx();
    return c.groupId !== null && c.groupId !== undefined;
}

// ─── Profiles (canonical detection) ──────────────────────────────────────────

/**
 * Connection Manager is itself an extension; its profiles live in
 * extensionSettings.connectionManager.profiles as [{ id, name, ... }].
 */
function getProfiles() {
    const c = ctx();
    const cm = c.extensionSettings?.connectionManager;
    if (Array.isArray(cm?.profiles) && cm.profiles.length) {
        return cm.profiles
            .map(p => ({ id: p.id, name: p.name }))
            .filter(p => p.name);
    }
    // Backup: the request service exposes the same list
    try {
        const svc = c.ConnectionManagerRequestService;
        if (svc && typeof svc.getSupportedProfiles === 'function') {
            return svc.getSupportedProfiles()
                .map(p => ({ id: p.id, name: p.name }))
                .filter(p => p.name);
        }
    } catch (_) {}
    return [];
}

function getProfileNames() {
    return getProfiles().map(p => p.name);
}

function getActiveProfileName() {
    const cm = ctx().extensionSettings?.connectionManager;
    if (!cm) return null;
    const found = (cm.profiles || []).find(p => p.id === cm.selectedProfile);
    return found?.name || null;
}

// ─── Profile switching ────────────────────────────────────────────────────────

/**
 * Switch the active connection profile via /profile, then verify it applied.
 * Profile application is asynchronous inside ST (it loads presets/settings),
 * so we poll the canonical store briefly instead of guessing with a delay.
 */
async function switchToProfile(profileName) {
    if (!profileName) return false;
    if (getActiveProfileName() === profileName) return true;   // no-op

    if (!getProfileNames().includes(profileName)) {
        toastr.error(`Profile not found: "${profileName}". Was it deleted?`, 'MMC');
        return false;
    }

    const c = ctx();
    try {
        const escaped = `"${String(profileName).replace(/"/g, '\\"')}"`;
        await c.executeSlashCommandsWithOptions(`/profile ${escaped}`, {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
    } catch (e) {
        console.error(`${LOG} /profile failed:`, e);
        toastr.error(`Failed to switch to ${profileName}`, 'MMC');
        return false;
    }

    // Verify (up to ~2s)
    for (let i = 0; i < 20; i++) {
        if (getActiveProfileName() === profileName) {
            if (settings.showToasts) {
                toastr.info(`→ ${profileName}`, 'MMC', { timeOut: 1500 });
            }
            return true;
        }
        await new Promise(r => setTimeout(r, 100));
    }
    console.warn(`${LOG} Switch to "${profileName}" did not verify in time`);
    return false;
}

// ─── Character resolution & assignment ───────────────────────────────────────

/**
 * Resolve a character from whatever reference we get: a numeric index
 * (ST's GROUP_MEMBER_DRAFTED passes one, usually as a string), an avatar
 * filename, an exact name, or a character object.
 */
function resolveCharacter(ref) {
    const chars = ctx().characters || [];
    if (ref === null || ref === undefined) return null;
    if (typeof ref === 'object') {
        if (ref.avatar || ref.name) return ref;
        return null;
    }
    if (typeof ref === 'number') return chars[ref] || null;
    if (typeof ref === 'string') {
        if (/^\d+$/.test(ref) && chars[Number(ref)]) return chars[Number(ref)];
        return chars.find(ch => ch.avatar === ref)
            || chars.find(ch => ch.name === ref)
            || chars.find(ch => ch.name?.toLowerCase() === ref.toLowerCase())
            || null;
    }
    return null;
}

/**
 * Assignment precedence: character > group default > global fallback.
 * Exact keys only — v2's substring matching silently gave "Anna"
 * Annabelle's profile.
 */
function getAssignedProfile(char) {
    if (char) {
        if (char.avatar && settings.characterProfiles[char.avatar]) {
            return settings.characterProfiles[char.avatar];
        }
        if (char.name && settings.legacyNameProfiles[char.name]) {
            return settings.legacyNameProfiles[char.name];
        }
    }
    const gid = ctx().groupId;
    if (gid !== null && gid !== undefined && settings.groupDefaults[gid]) {
        return settings.groupDefaults[gid];
    }
    return settings.fallbackProfile || null;
}

function assignProfile(char, profileName) {
    if (!char?.avatar) return;
    if (profileName) {
        settings.characterProfiles[char.avatar] = profileName;
    } else {
        delete settings.characterProfiles[char.avatar];
    }
    // Clear any legacy shadow for the same character
    if (char.name) delete settings.legacyNameProfiles[char.name];
    saveSettings();
    console.log(`${LOG} ${char.name} (${char.avatar}) → ${profileName || '(default)'}`);
}

function setGroupDefault(profileName) {
    const gid = ctx().groupId;
    if (gid === null || gid === undefined) return;
    if (profileName) settings.groupDefaults[gid] = profileName;
    else delete settings.groupDefaults[gid];
    saveSettings();
}

// ─── Auto-switch (the headline) ──────────────────────────────────────────────

async function onGroupMemberDrafted(chId) {
    if (!settings.enabled || !settings.autoSwitch) return;

    const char = resolveCharacter(chId);
    if (!char) {
        console.warn(`${LOG} Could not resolve drafted character from:`, chId);
        return;
    }

    captureOriginalProfile();

    const profile = getAssignedProfile(char);
    if (profile) {
        await switchToProfile(profile);   // ST awaits event handlers — this
    }                                     // completes before generation starts
}

function captureOriginalProfile() {
    if (originalProfile === null && isGroupChat()) {
        originalProfile = getActiveProfileName();
    }
}

async function onChatChanged() {
    const nowInGroup = isGroupChat();

    // Leaving a group → optionally restore (this was dead code in v2)
    if (wasInGroup && !nowInGroup
        && settings.restoreProfileAfterGroup && originalProfile) {
        const restore = originalProfile;
        originalProfile = null;
        await switchToProfile(restore);
    }
    if (!nowInGroup) originalProfile = null;
    wasInGroup = nowInGroup;

    // Re-render any group controls for the new chat
    setTimeout(injectGroupControls, 200);
}

// ─── Manual trigger (play buttons / /mmc-go) ─────────────────────────────────

async function triggerCharacter(ref) {
    const char = resolveCharacter(ref);
    if (!char) {
        toastr.warning(`Character not found: ${ref}`, 'MMC');
        return;
    }

    captureOriginalProfile();

    const profile = getAssignedProfile(char);
    if (profile) {
        const ok = await switchToProfile(profile);   // verified switch — no
        if (!ok) return;                              // blind 100ms delay
    }

    try {
        const escaped = `"${String(char.name).replace(/"/g, '\\"')}"`;
        await ctx().executeSlashCommandsWithOptions(`/trigger ${escaped}`, {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
    } catch (e) {
        console.error(`${LOG} /trigger failed:`, e);
        toastr.error(`Failed to trigger ${char.name}`, 'MMC');
    }
}

// ─── Group member controls ───────────────────────────────────────────────────

function buildProfileOptions(selectedName) {
    let html = '<option value="">(default)</option>';
    for (const name of getProfileNames()) {
        const sel = name === selectedName ? 'selected' : '';
        html += `<option value="${escapeAttr(name)}" ${sel}>${escapeHtml(name)}</option>`;
    }
    return html;
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}

// Controls we created (with live listeners). The member-list popout clones
// the list via innerHTML, which strips listeners — anything not in this set
// is a dead clone and gets replaced on the next injection pass.
const liveControls = new WeakSet();

/**
 * Find current-member rows. Since ST's pagination refactor these live in
 * '.rm_group_members' containers (a CLASS — there can be several, including
 * the popout), and rows are identified by 'data-chid', not 'chid'. The
 * add-candidates list (#rm_group_add_members) uses the same template, so
 * exclude it explicitly or every character in the picker gets a dropdown.
 */
function findGroupMemberEls() {
    const els = [...document.querySelectorAll(
        '.rm_group_members .group_member, #rm_group_members .group_member'
    )];
    // NOTE: no visibility (offsetParent) filter — on mobile, focusing the
    // chat input closes the side panel, so the list is often display:none at
    // the moment injection runs. Injecting into a hidden panel is fine; the
    // controls are there when it reopens.
    return els.filter(el =>
        !el.closest('#group_member_template')
        && !el.closest('#rm_group_add_members'));
}

/**
 * Resolve the character for a member row.
 * ST current: data-chid (character index). Legacy: chid.
 * Last resort: the avatar <img title>, which ST sets to the avatar filename.
 */
function memberChar(member) {
    const ref = member.getAttribute('data-chid')
        ?? member.getAttribute('chid')
        ?? member.querySelector('.avatar img')?.getAttribute('title');
    return resolveCharacter(ref);
}

function injectGroupControls() {
    if (!settings.enabled) return { members: 0, injected: 0 };

    const members = findGroupMemberEls();
    let injected = 0;
    if (!members.length) return { members: 0, injected: 0 };

    // Per-group default row — pin it above the first member row
    const listContainer = members[0].parentElement;
    const existingDefault = document.querySelector('.mmc-group-default');
    if (existingDefault && !liveControls.has(existingDefault)) existingDefault.remove();
    if (listContainer && !document.querySelector('.mmc-group-default')) {
        const gid = ctx().groupId;
        const row = document.createElement('div');
        row.className = 'mmc-group-default';
        row.innerHTML = `
            <span class="mmc-group-default-label">MMC group default:</span>
            <select class="mmc-profile-select mmc-group-default-select">
                ${buildProfileOptions(gid != null ? settings.groupDefaults[gid] : '')}
            </select>`;
        listContainer.prepend(row);
        liveControls.add(row);
        row.querySelector('select').addEventListener('change', (e) => {
            e.stopPropagation();
            setGroupDefault(e.target.value);
        });
    }

    members.forEach((member) => {
        const existing = member.querySelector('.mmc-inline-controls');
        if (existing) {
            if (liveControls.has(existing)) return;   // ours, alive
            existing.remove();                         // dead popout clone
        }

        const char = memberChar(member);
        if (!char?.avatar) return;

        const controls = document.createElement('div');
        controls.className = 'mmc-inline-controls';
        controls.innerHTML = `
            <button class="mmc-play-btn" title="Switch to ${escapeAttr(char.name)}'s profile and trigger them">▶</button>
            <select class="mmc-profile-select" title="Profile for ${escapeAttr(char.name)}">
                ${buildProfileOptions(settings.characterProfiles[char.avatar] || settings.legacyNameProfiles[char.name] || '')}
            </select>`;
        member.appendChild(controls);
        liveControls.add(controls);
        injected++;

        controls.querySelector('.mmc-play-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await triggerCharacter(char.avatar);
        });
        controls.querySelector('.mmc-profile-select').addEventListener('change', (e) => {
            e.stopPropagation();
            assignProfile(char, e.target.value);
        });
        // Don't let taps on the select open the character card
        controls.querySelector('.mmc-profile-select').addEventListener('click', e => e.stopPropagation());
    });

    return { members: members.length, injected };
}

// ─── Slash commands ──────────────────────────────────────────────────────────

function registerSlashCommands() {
    const c = ctx();
    if (!c.SlashCommandParser || !c.SlashCommand) {
        console.warn(`${LOG} SlashCommand API not available`);
        return;
    }
    const { SlashCommandParser, SlashCommand, SlashCommandArgument, ARGUMENT_TYPE } = c;

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-go',
        callback: async (_args, value) => {
            const name = String(value || '').trim();
            if (!name) { toastr.warning('Usage: /mmc-go CharacterName', 'MMC'); return ''; }
            await triggerCharacter(name);
            return '';
        },
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'Character name to trigger',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        })],
        helpString: 'Switch to a character\'s assigned profile and trigger them to speak.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-assign',
        callback: async (args, value) => {
            const charRef = String(args?.char || '').trim();
            const profile = String(value || '').trim();
            const char = resolveCharacter(charRef);
            if (!char) { toastr.warning(`Character not found: ${charRef}`, 'MMC'); return ''; }
            if (profile && !getProfileNames().includes(profile)) {
                toastr.warning(`Profile not found: ${profile}`, 'MMC'); return '';
            }
            assignProfile(char, profile);
            toastr.success(`${char.name} → ${profile || '(default)'}`, 'MMC');
            return '';
        },
        namedArgumentList: [SlashCommandArgument.fromProps({
            name: 'char',
            description: 'Character name',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: true,
        })],
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'Profile name (empty to clear)',
            typeList: [ARGUMENT_TYPE.STRING],
            isRequired: false,
        })],
        helpString: 'Assign a connection profile to a character. /mmc-assign char="Name" ProfileName',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-inject',
        callback: async () => {
            const anyMember = document.querySelectorAll('.group_member').length;
            const withDataChid = document.querySelectorAll('.group_member[data-chid]').length;
            const inMembersList = document.querySelectorAll('.rm_group_members .group_member, #rm_group_members .group_member').length;
            const result = injectGroupControls();
            const existing = document.querySelectorAll('.mmc-inline-controls').length;
            const msg = [
                `In group chat: ${isGroupChat() ? 'yes' : 'NO'}`,
                `.group_member total: ${anyMember} (${withDataChid} with data-chid)`,
                `In current-members list: ${inMembersList}`,
                `Members matched: ${result.members}`,
                `Controls injected now: ${result.injected}`,
                `Controls present total: ${existing}`,
                existing > 0 && result.members > 0
                    ? 'Controls exist — if you can\'t see them, it\'s a layout/theme clipping issue.'
                    : (inMembersList === 0 && anyMember > 0
                        ? 'Member rows render outside the known containers — markup changed again; report this!'
                        : (anyMember === 0 ? 'No member rows rendered — open the group\'s Current Members list first.' : '')),
            ].filter(Boolean).join('\n');
            toastr.info(escapeHtml(msg).replace(/\n/g, '<br>'), 'MMC Inject', { timeOut: 12000, escapeHtml: false });
            return '';
        },
        helpString: 'Force-inject group controls and report what was found (mobile-friendly diagnostics).',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-debug',
        callback: async () => {
            const chars = ctx().characters || [];
            const lines = Object.entries(settings.characterProfiles).map(([avatar, prof]) => {
                const ch = chars.find(x => x.avatar === avatar);
                return `${ch?.name || avatar} → ${prof}`;
            });
            for (const [name, prof] of Object.entries(settings.legacyNameProfiles)) {
                lines.push(`${name} → ${prof} (legacy key)`);
            }
            const msg = [
                `MMC v${VERSION}`,
                `Active profile: ${getActiveProfileName() || '(unknown)'}`,
                `Auto-switch: ${settings.autoSwitch ? 'ON' : 'OFF'}`,
                `Profiles: ${getProfileNames().join(', ') || '(none found)'}`,
                `Assignments:`, lines.join('\n') || '(none)',
            ].join('\n');
            toastr.info(escapeHtml(msg).replace(/\n/g, '<br>'), 'MMC Debug', { timeOut: 10000, escapeHtml: false });
            console.log(`${LOG} Debug:`, { settings, profiles: getProfiles() });
            return '';
        },
        helpString: 'Show Multi-Model Chat debug information.',
    }));
}

// ─── Settings UI ─────────────────────────────────────────────────────────────

function createSettingsHTML() {
    return `
    <div class="mmc-settings">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>Multi-Model Chat v${VERSION}</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="mmc-info"><small>
            Assign connection profiles per character in the <b>group member list</b>
            (open the group, each member gets a dropdown + ▶ button).
            With auto-switch on, profiles apply automatically when a character is
            drafted to speak.<br>
            Precedence: <b>character → group default → fallback</b>.<br><br>
            <b>Commands:</b> /mmc-go, /mmc-assign, /mmc-debug, /mmc-inject
          </small></div>

          <div class="mmc-options">
            <div class="mmc-option">
              <input type="checkbox" id="mmc_enabled" ${settings.enabled ? 'checked' : ''}>
              <label for="mmc_enabled">Enable Multi-Model Chat</label>
            </div>
            <div class="mmc-option">
              <input type="checkbox" id="mmc_auto_switch" ${settings.autoSwitch ? 'checked' : ''}>
              <label for="mmc_auto_switch">Auto-switch profiles when characters are drafted</label>
            </div>
            <div class="mmc-option">
              <input type="checkbox" id="mmc_show_toasts" ${settings.showToasts ? 'checked' : ''}>
              <label for="mmc_show_toasts">Show toast on profile switch</label>
            </div>
            <div class="mmc-option">
              <input type="checkbox" id="mmc_restore_profile" ${settings.restoreProfileAfterGroup ? 'checked' : ''}>
              <label for="mmc_restore_profile">Restore original profile when leaving a group chat</label>
            </div>
          </div>

          <div class="mmc-fallback">
            <label for="mmc_fallback_profile">Global fallback profile (unassigned characters):</label>
            <select id="mmc_fallback_profile">
              ${buildProfileOptions(settings.fallbackProfile)}
            </select>
          </div>

          <div class="mmc-buttons">
            <button id="mmc_refresh" class="menu_button">
              <i class="fa-solid fa-refresh"></i><span>Refresh</span>
            </button>
          </div>
          <div class="mmc-profile-count"><small id="mmc_profile_count"></small></div>
        </div>
      </div>
    </div>`;
}

function updateProfileCount() {
    const el = document.getElementById('mmc_profile_count');
    if (el) {
        const n = getProfileNames().length;
        el.textContent = n
            ? `${n} connection profile(s) detected.`
            : 'No connection profiles found — create some under API Connections → Connection Profiles.';
    }
}

function addSettingsUI() {
    const container = document.getElementById('extensions_settings');
    if (!container) return;

    document.getElementById('mmc_settings_container')?.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'mmc_settings_container';
    wrapper.innerHTML = createSettingsHTML();
    container.appendChild(wrapper);

    const bind = (id, fn) => document.getElementById(id)?.addEventListener('change', fn);
    bind('mmc_enabled', e => { settings.enabled = e.target.checked; saveSettings(); });
    bind('mmc_auto_switch', e => { settings.autoSwitch = e.target.checked; saveSettings(); });
    bind('mmc_show_toasts', e => { settings.showToasts = e.target.checked; saveSettings(); });
    bind('mmc_restore_profile', e => { settings.restoreProfileAfterGroup = e.target.checked; saveSettings(); });
    bind('mmc_fallback_profile', e => { settings.fallbackProfile = e.target.value; saveSettings(); });

    document.getElementById('mmc_refresh')?.addEventListener('click', () => {
        const sel = document.getElementById('mmc_fallback_profile');
        if (sel) sel.innerHTML = buildProfileOptions(settings.fallbackProfile);
        updateProfileCount();
        document.querySelectorAll('.mmc-inline-controls, .mmc-group-default').forEach(el => el.remove());
        injectGroupControls();
        toastr.success(`Found ${getProfileNames().length} profile(s)`, 'MMC');
    });

    updateProfileCount();
}

// ─── Persistence & migration ─────────────────────────────────────────────────

function saveSettings() {
    ctx().extensionSettings[MODULE_NAME] = settings;
    ctx().saveSettingsDebounced();
}

function loadSettings() {
    const saved = ctx().extensionSettings?.[MODULE_NAME];
    if (saved) settings = { ...defaultSettings, ...saved };

    if (!settings.characterProfiles || typeof settings.characterProfiles !== 'object') settings.characterProfiles = {};
    if (!settings.legacyNameProfiles || typeof settings.legacyNameProfiles !== 'object') settings.legacyNameProfiles = {};
    if (!settings.groupDefaults || typeof settings.groupDefaults !== 'object') settings.groupDefaults = {};

    if ((settings.settingsVersion || 2) < 3) migrateV2();
}

/**
 * v2 keyed characterProfiles by character NAME — and sometimes, due to a UI
 * bug, by numeric character index. Re-key to avatar filename where a unique
 * match exists; keep the rest as legacy name-keyed fallbacks.
 */
function migrateV2() {
    const chars = ctx().characters || [];
    const old = settings.characterProfiles || {};
    const byAvatar = {};
    const legacy = {};
    let migrated = 0;

    for (const [key, profile] of Object.entries(old)) {
        if (!profile) continue;

        // Already an avatar filename?
        if (chars.some(ch => ch.avatar === key)) {
            byAvatar[key] = profile; migrated++; continue;
        }
        // Numeric index from the v2 chid bug
        if (/^\d+$/.test(key) && chars[Number(key)]?.avatar) {
            byAvatar[chars[Number(key)].avatar] = profile; migrated++; continue;
        }
        // Unique name match
        const matches = chars.filter(ch => ch.name === key);
        if (matches.length === 1 && matches[0].avatar) {
            byAvatar[matches[0].avatar] = profile; migrated++; continue;
        }
        // Ambiguous or unknown — keep as name-keyed fallback
        legacy[key] = profile;
    }

    settings.characterProfiles = byAvatar;
    settings.legacyNameProfiles = { ...legacy, ...settings.legacyNameProfiles };
    delete settings.manualProfiles;   // the band-aid is gone
    settings.settingsVersion = 3;
    saveSettings();
    console.log(`${LOG} Migrated v2 settings: ${migrated} re-keyed by avatar, ${Object.keys(legacy).length} kept as legacy name keys`);
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
    if (isInitialized) return;
    const c = ctx();

    loadSettings();
    addSettingsUI();
    registerSlashCommands();

    const ev = c.eventSource;
    const types = c.event_types || {};
    ev?.on(types.GROUP_MEMBER_DRAFTED || 'GROUP_MEMBER_DRAFTED', onGroupMemberDrafted);
    ev?.on(types.CHAT_CHANGED || 'chat_id_changed', onChatChanged);
    if (types.GROUP_UPDATED) ev.on(types.GROUP_UPDATED, () => setTimeout(injectGroupControls, 100));

    // Debounced observer. Prefer the right nav panel; fall back to body —
    // a 150ms-debounced callback is cheap, and container ids vary too much
    // across ST versions/themes to scope harder than this.
    const target = document.getElementById('right-nav-panel') || document.body;
    let debounce = null;
    new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(injectGroupControls, 150);
    }).observe(target, { childList: true, subtree: true });

    wasInGroup = isGroupChat();
    isInitialized = true;
    console.log(`${LOG} v${VERSION} ready. Profiles: ${getProfileNames().length}`);
}

if (typeof jQuery !== 'undefined') {
    jQuery(async () => { await init(); });
} else {
    window.addEventListener('DOMContentLoaded', init);
}
