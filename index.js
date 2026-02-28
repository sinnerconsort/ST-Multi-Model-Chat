/**
 * Multi-Model Chat Extension for SillyTavern v2.1.0
 *
 * Allows assigning different connection profiles to different characters
 * in group chats, enabling multi-model conversations.
 *
 * Features:
 * - Profile dropdowns in group member list
 * - Play buttons to trigger character with profile switch
 * - Slash commands: /mmc-go, /mmc-debug, /mmc-add-profile, /mmc-assign
 * - Automatic profile switching on character draft (uses correct event API)
 * - Fallback profile for unassigned characters
 * - Profile restore when leaving group chat
 */

const MODULE_NAME = 'multi_model_chat';
const VERSION = '2.1.0';

// Default settings
const defaultSettings = {
    enabled: true,
    showToasts: true,
    restoreProfileAfterGroup: false,
    autoSwitch: false,
    fallbackProfile: '',
    characterProfiles: {}, // { charName: profileName }
    manualProfiles: [], // Manually added profile names that persist
};

let settings = { ...defaultSettings };
let cachedProfiles = [];
let originalProfile = null;
let isInitialized = false;
let injectDebounceTimer = null;
let suppressObserver = false; // Prevents MutationObserver double-injection

// ─── Utility ─────────────────────────────────────────────────────────

/**
 * Escape a string for safe insertion into HTML
 */
function escapeHtml(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
}

/**
 * Safely quote a value for use in a slash command argument.
 * Always wraps in quotes; escapes any internal quotes.
 */
function quoteForCommand(value) {
    if (!value) return '""';
    // Escape backslashes first, then double-quotes
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
}

/**
 * Resolve a character index (chId) to a character name via context.
 * GROUP_MEMBER_DRAFTED emits a numeric character index.
 */
function resolveCharacterName(chId) {
    try {
        const context = SillyTavern.getContext();

        // Numeric index (primary case from GROUP_MEMBER_DRAFTED)
        if (typeof chId === 'number' && context.characters?.[chId]) {
            return context.characters[chId].name;
        }

        // String — could be a numeric string or already a name
        if (typeof chId === 'string') {
            const asNum = parseInt(chId, 10);
            if (!isNaN(asNum) && String(asNum) === chId && context.characters?.[asNum]) {
                return context.characters[asNum].name;
            }
            // Already a name string
            return chId;
        }

        // Object with name property (safety net for future API changes)
        if (chId && typeof chId === 'object') {
            if (chId.name) return chId.name;
            if (chId.character) return chId.character;
        }
    } catch (e) {
        console.error(`[${MODULE_NAME}] resolveCharacterName error:`, e);
    }
    return null;
}

// ─── Profile Detection ───────────────────────────────────────────────

/**
 * Get available connection profiles from SillyTavern.
 *
 * Primary: read from the built-in connection-manager extension settings.
 * Secondary: scrape the #connection_profiles DOM select.
 */
async function getAvailableProfiles() {
    try {
        const context = SillyTavern.getContext();

        // ── Method 1 (best): Connection-manager extension settings ──
        const cmProfiles = context.extensionSettings?.connectionManager?.profiles
            ?? context.extensionSettings?.['connection-manager']?.profiles;

        if (Array.isArray(cmProfiles) && cmProfiles.length > 0) {
            cachedProfiles = cmProfiles
                .map(p => typeof p === 'string' ? p : p.name)
                .filter(Boolean);
            console.log(`[${MODULE_NAME}] Profiles from connection-manager:`, cachedProfiles);
            return cachedProfiles;
        }

        // ── Method 2: DOM #connection_profiles select ──
        const profileSelect = document.getElementById('connection_profiles');
        if (profileSelect) {
            cachedProfiles = Array.from(profileSelect.options)
                .map(opt => opt.textContent?.trim())
                .filter(v => v && v !== '<None>' && v !== '');
            if (cachedProfiles.length > 0) {
                console.log(`[${MODULE_NAME}] Profiles from DOM #connection_profiles:`, cachedProfiles);
                return cachedProfiles;
            }
        }

        // ── Method 3: /profile-list slash command ──
        try {
            const { executeSlashCommandsWithOptions } = context;
            const result = await executeSlashCommandsWithOptions('/profile-list', {
                handleExecutionErrors: false,
                handleParserErrors: false,
            });
            if (result?.pipe) {
                const parsed = JSON.parse(result.pipe);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    cachedProfiles = parsed.filter(Boolean);
                    console.log(`[${MODULE_NAME}] Profiles from /profile-list:`, cachedProfiles);
                    return cachedProfiles;
                }
            }
        } catch (e) {
            console.log(`[${MODULE_NAME}] /profile-list not available`);
        }

        console.warn(`[${MODULE_NAME}] Could not detect connection profiles. Use "Add Profile Manually" or /mmc-add-profile.`);
    } catch (e) {
        console.error(`[${MODULE_NAME}] Error fetching profiles:`, e);
    }
    return [];
}

// ─── Profile Switching ───────────────────────────────────────────────

/**
 * Switch to a specific connection profile via /profile command
 */
async function switchToProfile(profileName) {
    if (!profileName) return false;

    const context = SillyTavern.getContext();
    const { executeSlashCommandsWithOptions } = context;

    try {
        await executeSlashCommandsWithOptions(`/profile ${quoteForCommand(profileName)}`, {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });

        if (settings.showToasts) {
            toastr.info(`Switched to: ${profileName}`, 'MMC', { timeOut: 2000 });
        }
        console.log(`[${MODULE_NAME}] Switched to profile: ${profileName}`);
        return true;
    } catch (e) {
        console.error(`[${MODULE_NAME}] Error switching profile:`, e);
        toastr.error(`Failed to switch to ${profileName}`, 'MMC');
        return false;
    }
}

/**
 * Save the current profile name so we can restore later
 */
async function saveOriginalProfile() {
    if (originalProfile) return; // Already saved
    try {
        const context = SillyTavern.getContext();
        const result = await context.executeSlashCommandsWithOptions('/profile', {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
        originalProfile = result?.pipe?.trim() || null;
        if (originalProfile && originalProfile === '<None>') {
            originalProfile = null;
        }
        console.log(`[${MODULE_NAME}] Saved original profile: ${originalProfile || '(none)'}`);
    } catch (e) {
        console.log(`[${MODULE_NAME}] Could not save original profile`);
    }
}

/**
 * Restore previously saved profile
 */
async function restoreOriginalProfile() {
    if (!originalProfile) return;
    console.log(`[${MODULE_NAME}] Restoring original profile: ${originalProfile}`);
    await switchToProfile(originalProfile);
    originalProfile = null;
}

// ─── Character ↔ Profile Mapping ─────────────────────────────────────

/**
 * Get the assigned profile for a character (exact match only)
 */
function getCharacterProfile(charName) {
    if (!charName) return null;

    // Exact match
    if (settings.characterProfiles[charName]) {
        return settings.characterProfiles[charName];
    }

    // Case-insensitive exact match
    const lowerName = charName.toLowerCase();
    for (const [key, profile] of Object.entries(settings.characterProfiles)) {
        if (key.toLowerCase() === lowerName) {
            return profile;
        }
    }

    // Fallback if configured
    return settings.fallbackProfile || null;
}

/**
 * Assign a profile to a character
 */
function assignProfile(charName, profileName) {
    if (!charName) return;

    if (profileName) {
        settings.characterProfiles[charName] = profileName;
    } else {
        delete settings.characterProfiles[charName];
    }

    SillyTavern.getContext().saveSettingsDebounced();
    console.log(`[${MODULE_NAME}] Assigned ${charName} → ${profileName || '(none)'}`);
}

// ─── Event Handlers ──────────────────────────────────────────────────

/**
 * Handle character being drafted in group chat.
 * Called by GROUP_MEMBER_DRAFTED event which passes numeric chId.
 */
async function onCharacterDrafted(chId) {
    if (!settings.enabled || !settings.autoSwitch) return;

    const charName = resolveCharacterName(chId);

    if (!charName) {
        console.log(`[${MODULE_NAME}] Could not resolve character from chId=${chId}`);
        return;
    }

    const profile = getCharacterProfile(charName);
    if (profile) {
        // Save original profile on first switch for restore feature
        if (settings.restoreProfileAfterGroup) {
            await saveOriginalProfile();
        }
        console.log(`[${MODULE_NAME}] Auto-switching for ${charName} → ${profile}`);
        await switchToProfile(profile);
    }
}

/**
 * Trigger a specific character to generate with their assigned profile
 */
async function triggerCharacter(charName) {
    const context = SillyTavern.getContext();
    const { executeSlashCommandsWithOptions } = context;

    // Save original profile before switching
    if (settings.restoreProfileAfterGroup) {
        await saveOriginalProfile();
    }

    // Switch profile first
    const profile = getCharacterProfile(charName);
    if (profile) {
        await switchToProfile(profile);
    }

    // Small delay so profile switch completes
    await new Promise(r => setTimeout(r, 100));

    // Trigger the character to generate
    try {
        await executeSlashCommandsWithOptions(`/trigger ${quoteForCommand(charName)}`, {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
    } catch (e) {
        console.error(`[${MODULE_NAME}] Error triggering character:`, e);
        toastr.error(`Failed to trigger ${charName}`, 'MMC');
    }
}

// ─── UI: Group Member Controls ───────────────────────────────────────

/**
 * Build profile dropdown HTML (escaped)
 */
function buildProfileDropdown(charName, selectId) {
    const currentProfile = getCharacterProfile(charName) || '';
    const safeChar = escapeHtml(charName);

    let options = '<option value="">(Default)</option>';
    for (const profile of cachedProfiles) {
        const safeProfile = escapeHtml(profile);
        const selected = profile === currentProfile ? 'selected' : '';
        options += `<option value="${safeProfile}" ${selected}>${safeProfile}</option>`;
    }

    return `<select class="mmc-profile-select" id="${selectId}" data-char="${safeChar}">${options}</select>`;
}

/**
 * Inject controls into group member list.
 * Removes existing controls first so they always reflect current profile list.
 */
function injectGroupMemberControls() {
    const memberSelectors = [
        '.group_member',
        '#rm_group_members .group_member',
    ];

    let members = [];
    for (const selector of memberSelectors) {
        members = document.querySelectorAll(selector);
        if (members.length > 0) break;
    }

    if (members.length === 0) {
        console.log(`[${MODULE_NAME}] No group members found to inject controls`);
        return;
    }

    const context = SillyTavern.getContext();

    members.forEach((member, idx) => {
        // ALWAYS remove existing controls so dropdowns get refreshed
        member.querySelector('.mmc-inline-controls')?.remove();

        // Resolve character name via data-chid → characters[]
        let charName = null;
        const chidAttr = member.getAttribute('data-chid');
        if (chidAttr !== null) {
            const chidNum = parseInt(chidAttr, 10);
            if (!isNaN(chidNum) && context.characters?.[chidNum]) {
                charName = context.characters[chidNum].name;
            }
        }

        // Fallback: read visible name text
        if (!charName) {
            charName = member.querySelector('.ch_name')?.textContent?.trim();
        }

        if (!charName) return;

        const selectId = `mmc_profile_${idx}`;
        const safeChar = escapeHtml(charName);
        const controls = document.createElement('div');
        controls.className = 'mmc-inline-controls';
        controls.innerHTML = `
            <button class="mmc-play-btn" data-char="${safeChar}" title="Switch profile and trigger ${safeChar}">▶</button>
            ${buildProfileDropdown(charName, selectId)}
        `;

        member.appendChild(controls);

        // Event: play button
        controls.querySelector('.mmc-play-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const char = e.target.closest('[data-char]')?.getAttribute('data-char');
            if (char) await triggerCharacter(char);
        });

        // Event: profile select
        controls.querySelector('.mmc-profile-select').addEventListener('change', (e) => {
            e.stopPropagation();
            const char = e.target.getAttribute('data-char');
            assignProfile(char, e.target.value);
        });
    });

    console.log(`[${MODULE_NAME}] Injected controls for ${members.length} group members`);
}

// ─── Slash Commands ──────────────────────────────────────────────────

function registerSlashCommands() {
    const context = SillyTavern.getContext();

    if (!context.SlashCommandParser || !context.SlashCommand) {
        console.warn(`[${MODULE_NAME}] SlashCommand API not available`);
        return false;
    }

    const { SlashCommandParser, SlashCommand, ARGUMENT_TYPE, SlashCommandArgument } = context;

    // /mmc-go [character] — Switch profile and trigger character
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-go',
        callback: async (args, value) => {
            const charName = value?.trim();
            if (!charName) {
                toastr.warning('Usage: /mmc-go CharacterName', 'MMC');
                return '';
            }
            await triggerCharacter(charName);
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Character name to trigger',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Switch to character\'s assigned profile and trigger them to generate.',
    }));

    // /mmc-assign [character]=[profile] — Assign a profile to a character
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-assign',
        callback: async (args, value) => {
            const raw = value?.trim();
            if (!raw || !raw.includes('=')) {
                toastr.warning('Usage: /mmc-assign CharName=ProfileName', 'MMC');
                return '';
            }
            const eqIdx = raw.indexOf('=');
            const charName = raw.substring(0, eqIdx).trim();
            const profileName = raw.substring(eqIdx + 1).trim();
            if (!charName) {
                toastr.warning('Character name is required', 'MMC');
                return '';
            }
            assignProfile(charName, profileName || null);
            toastr.success(profileName
                ? `Assigned ${charName} → ${profileName}`
                : `Cleared assignment for ${charName}`, 'MMC');
            updateProfilesDisplay();
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'CharacterName=ProfileName (or CharacterName= to clear)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Assign a connection profile to a character. Use /mmc-assign Name= to clear.',
    }));

    // /mmc-debug — Show current state
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-debug',
        callback: async () => {
            const assignments = Object.entries(settings.characterProfiles)
                .map(([char, profile]) => `  ${char} → ${profile}`)
                .join('\n') || '  (none)';

            const msg = [
                `<b>MMC v${VERSION}</b>`,
                `Enabled: ${settings.enabled ? '✅' : '❌'}`,
                `Auto-switch: ${settings.autoSwitch ? '✅ ON' : '❌ OFF'}`,
                `Profiles (${cachedProfiles.length}): ${cachedProfiles.length > 0 ? escapeHtml(cachedProfiles.join(', ')) : '(none found)'}`,
                `Fallback: ${escapeHtml(settings.fallbackProfile) || '(none)'}`,
                `Original profile saved: ${escapeHtml(originalProfile) || '(none)'}`,
                `<b>Assignments:</b>`,
                `<pre>${escapeHtml(assignments)}</pre>`,
            ].join('<br>');

            toastr.info(msg, 'MMC Debug', {
                timeOut: 15000,
                escapeHtml: false,
                closeButton: true,
            });
            console.log(`[${MODULE_NAME}] Debug:`, { settings, cachedProfiles, originalProfile });
            return '';
        },
        helpString: 'Show Multi-Model Chat debug information.',
    }));

    // /mmc-add-profile [name] — Manually add a profile name
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-add-profile',
        callback: async (args, value) => {
            const profileName = value?.trim();
            if (!profileName) {
                toastr.warning('Usage: /mmc-add-profile ProfileName', 'MMC');
                return '';
            }
            if (!cachedProfiles.includes(profileName)) {
                cachedProfiles.push(profileName);
                if (!settings.manualProfiles.includes(profileName)) {
                    settings.manualProfiles.push(profileName);
                    SillyTavern.getContext().saveSettingsDebounced();
                }
                toastr.success(`Added profile: ${profileName}`, 'MMC');
                updateProfilesDisplay();
            } else {
                toastr.info(`Profile already exists: ${profileName}`, 'MMC');
            }
            return '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Profile name to add',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Manually add a connection profile name if auto-detection fails.',
    }));

    console.log(`[${MODULE_NAME}] Slash commands registered: /mmc-go, /mmc-assign, /mmc-debug, /mmc-add-profile`);
    return true;
}

// ─── UI: Settings Panel ──────────────────────────────────────────────

/**
 * Update the profiles display in settings
 */
function updateProfilesDisplay() {
    const display = document.getElementById('mmc_profiles_display');
    if (display) {
        if (cachedProfiles.length > 0) {
            const profilesHtml = cachedProfiles.map(p => {
                const safe = escapeHtml(p);
                const isManual = settings.manualProfiles.includes(p);
                if (isManual) {
                    return `<span class="mmc-profile-tag">${safe} <a href="#" class="mmc-remove-profile" data-profile="${safe}" title="Remove">×</a></span>`;
                }
                return safe;
            }).join(', ');
            display.innerHTML = profilesHtml;

            // Attach remove handlers for manual profiles
            display.querySelectorAll('.mmc-remove-profile').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    const profileToRemove = e.target.getAttribute('data-profile');
                    cachedProfiles = cachedProfiles.filter(p => p !== profileToRemove);
                    settings.manualProfiles = settings.manualProfiles.filter(p => p !== profileToRemove);
                    SillyTavern.getContext().saveSettingsDebounced();
                    updateProfilesDisplay();
                    toastr.info(`Removed profile: ${profileToRemove}`, 'MMC');
                });
            });
        } else {
            display.textContent = '(none detected — use Add or Refresh)';
        }
    }

    // Update fallback dropdown
    const dropdown = document.getElementById('mmc_fallback_profile');
    if (dropdown) {
        const currentVal = settings.fallbackProfile;
        dropdown.innerHTML = `<option value="">(None)</option>` +
            cachedProfiles.map(p => {
                const safe = escapeHtml(p);
                return `<option value="${safe}" ${p === currentVal ? 'selected' : ''}>${safe}</option>`;
            }).join('');
    }

    // Update assignments list
    updateAssignmentsDisplay();

    // Re-inject group controls so dropdowns reflect current profile list.
    // Suppress observer to prevent wasteful double-injection.
    suppressObserver = true;
    injectGroupMemberControls();
    // Re-enable observer after a tick (after MutationObserver would have fired)
    requestAnimationFrame(() => { suppressObserver = false; });
}

/**
 * Show current character→profile assignments in the settings panel
 */
function updateAssignmentsDisplay() {
    const container = document.getElementById('mmc_assignments_list');
    if (!container) return;

    const entries = Object.entries(settings.characterProfiles);
    if (entries.length === 0) {
        container.innerHTML = '<small style="opacity:0.6">(no assignments yet)</small>';
        return;
    }

    container.innerHTML = entries.map(([char, profile]) => {
        const sc = escapeHtml(char);
        const sp = escapeHtml(profile);
        return `<div class="mmc-assignment-row">
            <span>${sc} → <b>${sp}</b></span>
            <a href="#" class="mmc-remove-assignment" data-char="${sc}" title="Remove assignment">×</a>
        </div>`;
    }).join('');

    container.querySelectorAll('.mmc-remove-assignment').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const charToRemove = e.target.getAttribute('data-char');
            delete settings.characterProfiles[charToRemove];
            SillyTavern.getContext().saveSettingsDebounced();
            updateAssignmentsDisplay();
            toastr.info(`Cleared assignment for ${charToRemove}`, 'MMC');
        });
    });
}

/**
 * Create settings panel HTML
 */
function createSettingsHTML() {
    const fallbackOptions = cachedProfiles.map(p => {
        const safe = escapeHtml(p);
        return `<option value="${safe}" ${settings.fallbackProfile === p ? 'selected' : ''}>${safe}</option>`;
    }).join('');

    return `
        <div class="mmc-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Multi-Model Chat v${VERSION}</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="mmc-info">
                        <small>
                            Assign different AI profiles to different characters in group chats.
                            Use the <b>▶ play buttons</b> in the group member list to switch profiles and trigger characters.
                            <br><br>
                            <b>Commands:</b> /mmc-go, /mmc-assign, /mmc-debug, /mmc-add-profile
                        </small>
                    </div>

                    <div class="mmc-options">
                        <div class="mmc-option">
                            <input type="checkbox" id="mmc_show_toasts" ${settings.showToasts ? 'checked' : ''}>
                            <label for="mmc_show_toasts">Show toast notifications on profile switch</label>
                        </div>
                        <div class="mmc-option">
                            <input type="checkbox" id="mmc_restore_profile" ${settings.restoreProfileAfterGroup ? 'checked' : ''}>
                            <label for="mmc_restore_profile">Restore original profile when leaving group chat</label>
                        </div>
                        <div class="mmc-option">
                            <input type="checkbox" id="mmc_auto_switch" ${settings.autoSwitch ? 'checked' : ''}>
                            <label for="mmc_auto_switch">Auto-switch profiles when characters are drafted</label>
                        </div>
                    </div>

                    <div class="mmc-fallback">
                        <label for="mmc_fallback_profile">Fallback Profile (for unassigned characters):</label>
                        <select id="mmc_fallback_profile">
                            <option value="">(None)</option>
                            ${fallbackOptions}
                        </select>
                    </div>

                    <div class="mmc-manual-add" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;"><b>Add Profile Manually:</b></label>
                        <small style="display: block; margin-bottom: 5px; opacity: 0.7;">If profiles aren't detected, type the exact name and click Add</small>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="mmc_manual_profile" placeholder="Profile name..." style="flex: 1;">
                            <button id="mmc_add_profile_btn" class="menu_button">Add</button>
                        </div>
                        <div id="mmc_profile_list" style="margin-top: 8px; font-size: 0.85em;">
                            <b>Known profiles:</b> <span id="mmc_profiles_display">${cachedProfiles.length > 0 ? escapeHtml(cachedProfiles.join(', ')) : '(none detected)'}</span>
                        </div>
                    </div>

                    <div class="mmc-assignments-section" style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;"><b>Current Assignments:</b></label>
                        <div id="mmc_assignments_list"></div>
                    </div>

                    <div class="mmc-buttons">
                        <button id="mmc_refresh_profiles" class="menu_button">
                            <i class="fa-solid fa-refresh"></i>
                            <span>Refresh Profiles</span>
                        </button>
                        <button id="mmc_inject_controls" class="menu_button">
                            <i class="fa-solid fa-users"></i>
                            <span>Inject Group Controls</span>
                        </button>
                        <button id="mmc_clear_assignments" class="menu_button">
                            <i class="fa-solid fa-eraser"></i>
                            <span>Clear All Assignments</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Add settings panel to ST
 */
function addSettingsUI() {
    const container = document.getElementById('extensions_settings');
    if (!container) {
        console.warn(`[${MODULE_NAME}] Extensions settings container not found`);
        return;
    }

    // Remove existing if present
    const existing = document.getElementById('mmc_settings_container');
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = 'mmc_settings_container';
    wrapper.innerHTML = createSettingsHTML();
    container.appendChild(wrapper);

    // ── Bind event listeners ──

    document.getElementById('mmc_show_toasts').addEventListener('change', (e) => {
        settings.showToasts = e.target.checked;
        SillyTavern.getContext().saveSettingsDebounced();
    });

    document.getElementById('mmc_restore_profile').addEventListener('change', (e) => {
        settings.restoreProfileAfterGroup = e.target.checked;
        SillyTavern.getContext().saveSettingsDebounced();
    });

    document.getElementById('mmc_auto_switch').addEventListener('change', (e) => {
        settings.autoSwitch = e.target.checked;
        SillyTavern.getContext().saveSettingsDebounced();
        if (e.target.checked) {
            toastr.info('Auto-switch enabled. Profiles will switch automatically when characters are drafted in group chat.', 'MMC', { timeOut: 4000 });
        }
    });

    document.getElementById('mmc_fallback_profile').addEventListener('change', (e) => {
        settings.fallbackProfile = e.target.value;
        SillyTavern.getContext().saveSettingsDebounced();
    });

    document.getElementById('mmc_refresh_profiles').addEventListener('click', async () => {
        await getAvailableProfiles();
        updateProfilesDisplay();
        toastr.success(`Found ${cachedProfiles.length} profile(s)`, 'MMC');
    });

    document.getElementById('mmc_inject_controls').addEventListener('click', () => {
        injectGroupMemberControls();
        toastr.success('Controls injected for group members', 'MMC', { timeOut: 2000 });
    });

    document.getElementById('mmc_clear_assignments').addEventListener('click', () => {
        const count = Object.keys(settings.characterProfiles).length;
        if (count === 0) {
            toastr.info('No assignments to clear', 'MMC');
            return;
        }
        settings.characterProfiles = {};
        SillyTavern.getContext().saveSettingsDebounced();
        updateProfilesDisplay();
        toastr.success(`Cleared ${count} assignment(s)`, 'MMC');
    });

    // Manual profile add button
    document.getElementById('mmc_add_profile_btn').addEventListener('click', () => {
        const input = document.getElementById('mmc_manual_profile');
        const profileName = input.value.trim();
        if (!profileName) return;
        if (!cachedProfiles.includes(profileName)) {
            cachedProfiles.push(profileName);
            if (!settings.manualProfiles.includes(profileName)) {
                settings.manualProfiles.push(profileName);
                SillyTavern.getContext().saveSettingsDebounced();
            }
            input.value = '';
            updateProfilesDisplay();
            toastr.success(`Added profile: ${profileName}`, 'MMC');
        } else {
            toastr.info(`Profile already exists: ${profileName}`, 'MMC');
        }
    });

    // Enter key on manual profile input
    document.getElementById('mmc_manual_profile').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('mmc_add_profile_btn').click();
        }
    });

    // Show current assignments
    updateAssignmentsDisplay();

    console.log(`[${MODULE_NAME}] Settings UI added`);
}

// ─── Settings Persistence ────────────────────────────────────────────

function loadSettings() {
    const context = SillyTavern.getContext();
    const saved = context.extensionSettings?.[MODULE_NAME];

    if (saved) {
        settings = { ...defaultSettings, ...saved };
        // Ensure manualProfiles is an array
        if (!Array.isArray(settings.manualProfiles)) {
            settings.manualProfiles = [];
        }
        // Ensure characterProfiles is an object
        if (typeof settings.characterProfiles !== 'object' || settings.characterProfiles === null) {
            settings.characterProfiles = {};
        }
    }

    // Save reference so mutations get persisted
    context.extensionSettings[MODULE_NAME] = settings;
}

// ─── Initialization ──────────────────────────────────────────────────

async function init() {
    if (isInitialized) return;

    console.log(`[${MODULE_NAME}] Initializing Multi-Model Chat v${VERSION}...`);

    const context = SillyTavern.getContext();

    // Load settings
    loadSettings();

    // Fetch available profiles
    await getAvailableProfiles();

    // Merge in manually saved profiles
    for (const profile of settings.manualProfiles) {
        if (!cachedProfiles.includes(profile)) {
            cachedProfiles.push(profile);
        }
    }

    console.log(`[${MODULE_NAME}] Total profiles (auto + manual): ${cachedProfiles.length}`, cachedProfiles);

    // Add settings UI
    addSettingsUI();

    // Register slash commands
    registerSlashCommands();

    // ── Listen for group member drafted event (for auto-switch) ──
    // IMPORTANT: Use the enum VALUE from context.eventTypes, not the KEY string.
    // context.eventTypes.GROUP_MEMBER_DRAFTED === 'group_member_drafted'
    if (context.eventTypes?.GROUP_MEMBER_DRAFTED) {
        context.eventSource.on(context.eventTypes.GROUP_MEMBER_DRAFTED, onCharacterDrafted);
        console.log(`[${MODULE_NAME}] Listening for event: ${context.eventTypes.GROUP_MEMBER_DRAFTED}`);
    } else {
        // Fallback: use the known literal string
        context.eventSource?.on('group_member_drafted', onCharacterDrafted);
        console.warn(`[${MODULE_NAME}] eventTypes not available, using literal 'group_member_drafted'`);
    }

    // ── Listen for chat change to support profile restore ──
    if (context.eventTypes?.CHAT_CHANGED) {
        context.eventSource.on(context.eventTypes.CHAT_CHANGED, async () => {
            if (settings.restoreProfileAfterGroup && originalProfile) {
                // When leaving a group chat, restore original profile
                const ctx = SillyTavern.getContext();
                if (!ctx.groupId) {
                    await restoreOriginalProfile();
                }
            }
        });
    }

    // ── Observe DOM changes to inject controls when group member list appears ──
    // Debounced to avoid excessive re-injections
    const observer = new MutationObserver((mutations) => {
        let shouldInject = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                const hasGroupMembers = Array.from(mutation.addedNodes).some(node =>
                    node.nodeType === 1 && (
                        node.classList?.contains('group_member') ||
                        node.querySelector?.('.group_member')
                    )
                );
                if (hasGroupMembers) {
                    shouldInject = true;
                    break;
                }
            }
        }

        if (shouldInject && !suppressObserver) {
            // Debounce: coalesce rapid DOM changes into one injection
            clearTimeout(injectDebounceTimer);
            injectDebounceTimer = setTimeout(injectGroupMemberControls, 200);
        }
    });

    // Try to scope the observer to the group members area, fall back to body
    const groupContainer = document.getElementById('rm_group_members')
        || document.querySelector('.rm_group_members')
        || document.body;
    observer.observe(groupContainer, { childList: true, subtree: true });

    isInitialized = true;

    if (settings.showToasts) {
        toastr.success(`Multi-Model Chat v${VERSION} ready! (${cachedProfiles.length} profiles)`, 'MMC', { timeOut: 3000 });
    }

    console.log(`[${MODULE_NAME}] Initialization complete`);
}

// Initialize when jQuery is ready (ST's pattern)
if (typeof jQuery !== 'undefined') {
    jQuery(async () => {
        await init();
    });
} else {
    window.addEventListener('DOMContentLoaded', init);
}
