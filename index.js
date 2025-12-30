/**
 * Multi-Model Chat Extension for SillyTavern v2.0.0
 * 
 * Allows assigning different connection profiles to different characters
 * in group chats, enabling multi-model conversations.
 * 
 * Features:
 * - Profile dropdowns in group member list
 * - Play buttons to trigger character with profile switch
 * - Slash commands: /mmc-go, /mmc-debug
 * - Optional automatic profile switching on character draft
 * - Fallback profile for unassigned characters
 */

const MODULE_NAME = 'multi_model_chat';
const VERSION = '2.0.0';

// Default settings
const defaultSettings = {
    enabled: true,
    showToasts: true,
    restoreProfileAfterGroup: false,
    autoSwitch: false, // Off by default - use manual play buttons
    fallbackProfile: '',
    characterProfiles: {}, // { charName: profileName }
};

let settings = { ...defaultSettings };
let cachedProfiles = [];
let originalProfile = null;
let isInitialized = false;

/**
 * Get available connection profiles from SillyTavern
 */
async function getAvailableProfiles() {
    try {
        const response = await fetch('/api/settings/get', { method: 'POST' });
        const data = await response.json();
        
        if (data?.connectionManager?.profiles) {
            cachedProfiles = Object.keys(data.connectionManager.profiles);
            return cachedProfiles;
        }
    } catch (e) {
        console.error(`[${MODULE_NAME}] Error fetching profiles:`, e);
    }
    return [];
}

/**
 * Switch to a specific connection profile
 */
async function switchToProfile(profileName) {
    if (!profileName) return false;
    
    const context = SillyTavern.getContext();
    
    try {
        // Use ST's executeSlashCommands to switch profiles
        await context.executeSlashCommands(`/api-profiles name="${profileName}"`);
        
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
 * Get the assigned profile for a character
 */
function getCharacterProfile(charName) {
    // Check direct assignment first
    if (settings.characterProfiles[charName]) {
        return settings.characterProfiles[charName];
    }
    
    // Check if there's a partial match (for names with/without extensions)
    for (const [key, profile] of Object.entries(settings.characterProfiles)) {
        if (charName.includes(key) || key.includes(charName)) {
            return profile;
        }
    }
    
    // Return fallback if set
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

/**
 * Handle character being drafted in group chat
 */
async function onCharacterDrafted(eventData) {
    if (!settings.enabled || !settings.autoSwitch) return;
    
    const context = SillyTavern.getContext();
    let charName = null;
    
    // Extract character name from event data
    if (typeof eventData === 'string') {
        charName = eventData;
    } else if (typeof eventData === 'number') {
        // It's a character index
        const chars = context.characters;
        if (chars && chars[eventData]) {
            charName = chars[eventData].name;
        }
    } else if (eventData?.name) {
        charName = eventData.name;
    } else if (eventData?.character) {
        charName = eventData.character;
    }
    
    if (!charName) {
        console.log(`[${MODULE_NAME}] Could not extract character name from event`);
        return;
    }
    
    const profile = getCharacterProfile(charName);
    if (profile) {
        console.log(`[${MODULE_NAME}] Auto-switching for ${charName} → ${profile}`);
        await switchToProfile(profile);
    }
}

/**
 * Trigger a specific character to generate with their assigned profile
 */
async function triggerCharacter(charName) {
    const context = SillyTavern.getContext();
    
    // Switch profile first
    const profile = getCharacterProfile(charName);
    if (profile) {
        await switchToProfile(profile);
    }
    
    // Small delay to ensure profile switch completes
    await new Promise(r => setTimeout(r, 100));
    
    // Trigger the character to generate
    try {
        await context.executeSlashCommands(`/trigger ${charName}`);
    } catch (e) {
        console.error(`[${MODULE_NAME}] Error triggering character:`, e);
        toastr.error(`Failed to trigger ${charName}`, 'MMC');
    }
}

/**
 * Build profile dropdown HTML
 */
function buildProfileDropdown(charName, selectId) {
    const currentProfile = getCharacterProfile(charName) || '';
    
    let options = '<option value="">(Default)</option>';
    for (const profile of cachedProfiles) {
        const selected = profile === currentProfile ? 'selected' : '';
        options += `<option value="${profile}" ${selected}>${profile}</option>`;
    }
    
    return `<select class="mmc-profile-select" id="${selectId}" data-char="${charName}">${options}</select>`;
}

/**
 * Inject controls into group member list
 */
function injectGroupMemberControls() {
    // Multiple possible selectors for different ST versions
    const memberSelectors = [
        '.group_member',
        '.character_select',
        '#rm_group_members .group_member_card',
        '.group_members_list .character_select',
        '[data-group-member]'
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
    
    members.forEach((member, idx) => {
        // Skip if already has controls
        if (member.querySelector('.mmc-inline-controls')) return;
        
        // Get character name
        let charName = member.getAttribute('chid');
        if (!charName) {
            charName = member.querySelector('.ch_name')?.textContent?.trim();
        }
        if (!charName) {
            charName = member.querySelector('[data-name]')?.getAttribute('data-name');
        }
        if (!charName) {
            charName = member.textContent?.trim()?.split('\n')[0];
        }
        
        if (!charName) return;
        
        const selectId = `mmc_profile_${idx}`;
        const controls = document.createElement('div');
        controls.className = 'mmc-inline-controls';
        controls.innerHTML = `
            <button class="mmc-play-btn" data-char="${charName}" title="Switch profile and trigger ${charName}">▶</button>
            ${buildProfileDropdown(charName, selectId)}
        `;
        
        member.appendChild(controls);
        
        // Add event listeners
        controls.querySelector('.mmc-play-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            const char = e.target.getAttribute('data-char');
            await triggerCharacter(char);
        });
        
        controls.querySelector('.mmc-profile-select').addEventListener('change', (e) => {
            e.stopPropagation();
            const char = e.target.getAttribute('data-char');
            assignProfile(char, e.target.value);
        });
    });
    
    console.log(`[${MODULE_NAME}] Injected controls for ${members.length} group members`);
}

/**
 * Register slash commands
 */
function registerSlashCommands() {
    const context = SillyTavern.getContext();
    
    if (!context.SlashCommandParser || !context.SlashCommand) {
        console.warn(`[${MODULE_NAME}] SlashCommand API not available`);
        return false;
    }
    
    const { SlashCommandParser, SlashCommand, ARGUMENT_TYPE, SlashCommandArgument } = context;
    
    // /mmc-go [character] - Switch profile and trigger character
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
                isRequired: true
            })
        ],
        helpString: 'Switch to character\'s assigned profile and trigger them to generate.'
    }));
    
    // /mmc-debug - Show current state
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mmc-debug',
        callback: async () => {
            const assignments = Object.entries(settings.characterProfiles)
                .map(([char, profile]) => `${char} → ${profile}`)
                .join('\n') || '(none)';
            
            const msg = `MMC v${VERSION}\nAuto-switch: ${settings.autoSwitch ? 'ON' : 'OFF'}\nProfiles: ${cachedProfiles.length}\nAssignments:\n${assignments}`;
            
            toastr.info(msg.replace(/\n/g, '<br>'), 'MMC Debug', { 
                timeOut: 10000,
                escapeHtml: false 
            });
            console.log(`[${MODULE_NAME}] Debug:`, { settings, cachedProfiles });
            return '';
        },
        helpString: 'Show Multi-Model Chat debug information.'
    }));
    
    console.log(`[${MODULE_NAME}] Slash commands registered: /mmc-go, /mmc-debug`);
    return true;
}

/**
 * Create settings panel HTML
 */
function createSettingsHTML() {
    const fallbackOptions = cachedProfiles.map(p => 
        `<option value="${p}" ${settings.fallbackProfile === p ? 'selected' : ''}>${p}</option>`
    ).join('');
    
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
                            <b>Commands:</b> /mmc-go [name], /mmc-debug
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
                            <label for="mmc_auto_switch">Auto-switch profiles (experimental)</label>
                        </div>
                    </div>
                    
                    <div class="mmc-fallback">
                        <label for="mmc_fallback_profile">Fallback Profile (for unassigned characters):</label>
                        <select id="mmc_fallback_profile">
                            <option value="">(None)</option>
                            ${fallbackOptions}
                        </select>
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
    
    // Bind event listeners
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
            toastr.warning('Auto-switch is experimental. Use play buttons if you experience issues.', 'MMC', { timeOut: 5000 });
        }
    });
    
    document.getElementById('mmc_fallback_profile').addEventListener('change', (e) => {
        settings.fallbackProfile = e.target.value;
        SillyTavern.getContext().saveSettingsDebounced();
    });
    
    document.getElementById('mmc_refresh_profiles').addEventListener('click', async () => {
        await getAvailableProfiles();
        // Refresh the dropdown
        const dropdown = document.getElementById('mmc_fallback_profile');
        if (dropdown) {
            dropdown.innerHTML = `<option value="">(None)</option>` + 
                cachedProfiles.map(p => `<option value="${p}" ${settings.fallbackProfile === p ? 'selected' : ''}>${p}</option>`).join('');
        }
        // Re-inject group controls
        injectGroupMemberControls();
        toastr.success(`Found ${cachedProfiles.length} profiles`, 'MMC');
    });
    
    document.getElementById('mmc_inject_controls').addEventListener('click', () => {
        injectGroupMemberControls();
    });
    
    console.log(`[${MODULE_NAME}] Settings UI added`);
}

/**
 * Load saved settings
 */
function loadSettings() {
    const context = SillyTavern.getContext();
    const saved = context.extensionSettings?.[MODULE_NAME];
    
    if (saved) {
        settings = { ...defaultSettings, ...saved };
    }
    
    // Ensure settings are saved to extension settings
    context.extensionSettings[MODULE_NAME] = settings;
}

/**
 * Initialize the extension
 */
async function init() {
    if (isInitialized) return;
    
    console.log(`[${MODULE_NAME}] Initializing Multi-Model Chat v${VERSION}...`);
    
    const context = SillyTavern.getContext();
    
    // Load settings
    loadSettings();
    
    // Fetch available profiles
    await getAvailableProfiles();
    console.log(`[${MODULE_NAME}] Found ${cachedProfiles.length} connection profiles`);
    
    // Add settings UI
    addSettingsUI();
    
    // Register slash commands
    registerSlashCommands();
    
    // Listen for group member drafted event (for auto-switch)
    context.eventSource?.on('GROUP_MEMBER_DRAFTED', onCharacterDrafted);
    
    // Observe DOM changes to inject controls when group member list opens
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes.length) {
                // Check if group member list was added
                const hasGroupMembers = Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === 1 && (
                        node.classList?.contains('group_member') ||
                        node.querySelector?.('.group_member')
                    )
                );
                if (hasGroupMembers) {
                    setTimeout(injectGroupMemberControls, 100);
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    isInitialized = true;
    
    if (settings.showToasts) {
        toastr.success(`Multi-Model Chat v${VERSION} ready!`, 'MMC', { timeOut: 3000 });
    }
    
    console.log(`[${MODULE_NAME}] Initialization complete`);
}

// Initialize when jQuery is ready (ST's pattern)
if (typeof jQuery !== 'undefined') {
    jQuery(async () => {
        await init();
    });
} else {
    // Fallback
    window.addEventListener('DOMContentLoaded', init);
}
