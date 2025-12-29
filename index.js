/**
 * Multi-Model Chat Extension for SillyTavern
 * 
 * Allows assigning different connection profiles to different characters
 * in group chats, enabling multi-model conversations.
 * 
 * Based on community discussion: https://github.com/SillyTavern/SillyTavern/discussions/3785
 */

const MODULE_NAME = 'multi_model_chat';
const EXTENSION_KEY = 'multi_model_chat';

// Default settings
const defaultSettings = Object.freeze({
    enabled: true,
    showNotifications: true,
    restoreProfileAfterGroup: false,
    defaultProfile: '',
});

/**
 * Get or initialize extension settings
 * @returns {object} Extension settings
 */
function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();
    
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }
    
    // Ensure all default keys exist
    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }
    
    return extensionSettings[MODULE_NAME];
}

/**
 * Get the connection profile assigned to a character
 * @param {string} characterName - The character's name
 * @returns {string|null} Profile name or null if not assigned
 */
function getCharacterProfile(characterName) {
    const { characters } = SillyTavern.getContext();
    const character = characters.find(c => c.name === characterName);
    
    if (!character) {
        console.debug(`[${MODULE_NAME}] Character not found: ${characterName}`);
        return null;
    }
    
    return character.data?.extensions?.[EXTENSION_KEY]?.connectionProfile || null;
}

/**
 * Set the connection profile for a character
 * @param {number} characterId - The character's index in the characters array
 * @param {string} profileName - The profile name to assign (empty string to clear)
 */
async function setCharacterProfile(characterId, profileName) {
    const { writeExtensionField, characters } = SillyTavern.getContext();
    
    if (characterId === undefined || characterId < 0) {
        console.warn(`[${MODULE_NAME}] Invalid character ID: ${characterId}`);
        return;
    }
    
    const characterName = characters[characterId]?.name || 'Unknown';
    
    await writeExtensionField(characterId, EXTENSION_KEY, {
        connectionProfile: profileName || '',
    });
    
    console.log(`[${MODULE_NAME}] Set profile for ${characterName}: ${profileName || '(none)'}`);
    
    const settings = getSettings();
    if (settings.showNotifications && profileName) {
        toastr.success(`Profile "${profileName}" assigned to ${characterName}`);
    }
}

/**
 * Get list of available connection profiles
 * @returns {Promise<string[]>} Array of profile names
 */
async function getAvailableProfiles() {
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    
    try {
        const result = await executeSlashCommandsWithOptions('/profile-list', {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
        
        if (result?.pipe) {
            const profiles = JSON.parse(result.pipe);
            return Array.isArray(profiles) ? profiles : [];
        }
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to get profile list:`, error);
    }
    
    return [];
}

/**
 * Get the currently active profile
 * @returns {Promise<string>} Current profile name
 */
async function getCurrentProfile() {
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    
    try {
        const result = await executeSlashCommandsWithOptions('/profile', {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
        
        return result?.pipe || '';
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to get current profile:`, error);
        return '';
    }
}

/**
 * Switch to a connection profile
 * @param {string} profileName - The profile to switch to
 * @returns {Promise<boolean>} Success status
 */
async function switchProfile(profileName) {
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    
    if (!profileName) {
        console.debug(`[${MODULE_NAME}] No profile specified, skipping switch`);
        return false;
    }
    
    try {
        await executeSlashCommandsWithOptions(`/profile ${profileName}`, {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
        
        console.log(`[${MODULE_NAME}] Switched to profile: ${profileName}`);
        return true;
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to switch profile:`, error);
        toastr.error(`Failed to switch to profile "${profileName}"`);
        return false;
    }
}

// Store the profile that was active before group chat started
let profileBeforeGroupChat = '';

/**
 * Handle the GROUP_MEMBER_DRAFTED event
 * This fires when a character is selected to speak in a group chat
 * @param {object} data - Event data containing the character info
 */
async function onGroupMemberDrafted(data) {
    const settings = getSettings();
    
    if (!settings.enabled) {
        return;
    }
    
    const characterName = data?.name || data;
    
    if (!characterName) {
        console.debug(`[${MODULE_NAME}] No character name in event data`);
        return;
    }
    
    console.debug(`[${MODULE_NAME}] Group member drafted: ${characterName}`);
    
    const targetProfile = getCharacterProfile(characterName);
    
    if (!targetProfile) {
        console.debug(`[${MODULE_NAME}] No profile assigned to ${characterName}`);
        return;
    }
    
    const currentProfile = await getCurrentProfile();
    
    if (currentProfile === targetProfile) {
        console.debug(`[${MODULE_NAME}] Already on profile ${targetProfile}, no switch needed`);
        return;
    }
    
    // Store current profile for potential restoration
    if (!profileBeforeGroupChat && settings.restoreProfileAfterGroup) {
        profileBeforeGroupChat = currentProfile;
    }
    
    if (settings.showNotifications) {
        toastr.info(`Switching to "${targetProfile}" for ${characterName}`, 'Multi-Model Chat', {
            timeOut: 2000,
            preventDuplicates: true,
        });
    }
    
    await switchProfile(targetProfile);
}

/**
 * Handle chat changed event to potentially restore profile
 */
async function onChatChanged() {
    const settings = getSettings();
    const { groupId } = SillyTavern.getContext();
    
    // If we left a group chat and have a stored profile to restore
    if (!groupId && profileBeforeGroupChat && settings.restoreProfileAfterGroup) {
        console.log(`[${MODULE_NAME}] Restoring profile: ${profileBeforeGroupChat}`);
        await switchProfile(profileBeforeGroupChat);
        profileBeforeGroupChat = '';
    }
}

/**
 * Create the profile selector dropdown for the character editor
 * @returns {Promise<HTMLElement>} The selector container element
 */
async function createProfileSelector() {
    const container = document.createElement('div');
    container.id = 'mmc_profile_selector_container';
    container.classList.add('mmc-profile-selector');
    
    const label = document.createElement('label');
    label.htmlFor = 'mmc_profile_select';
    label.textContent = 'Connection Profile';
    label.title = 'Assign a connection profile to use when this character speaks in group chats';
    
    const select = document.createElement('select');
    select.id = 'mmc_profile_select';
    select.classList.add('text_pole');
    
    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '— Use Default —';
    select.appendChild(emptyOption);
    
    // Load available profiles
    const profiles = await getAvailableProfiles();
    for (const profile of profiles) {
        const option = document.createElement('option');
        option.value = profile;
        option.textContent = profile;
        select.appendChild(option);
    }
    
    // Handle profile selection change
    select.addEventListener('change', async (e) => {
        const { characterId } = SillyTavern.getContext();
        if (characterId !== undefined) {
            await setCharacterProfile(characterId, e.target.value);
        }
    });
    
    container.appendChild(label);
    container.appendChild(select);
    
    return container;
}

/**
 * Update the profile selector when character changes
 */
async function updateProfileSelector() {
    const select = document.getElementById('mmc_profile_select');
    if (!select) return;
    
    const { characterId, characters } = SillyTavern.getContext();
    
    if (characterId === undefined) {
        select.value = '';
        select.disabled = true;
        return;
    }
    
    select.disabled = false;
    
    const character = characters[characterId];
    const currentProfile = character?.data?.extensions?.[EXTENSION_KEY]?.connectionProfile || '';
    
    // Update options if needed
    const profiles = await getAvailableProfiles();
    const existingValues = Array.from(select.options).map(o => o.value).filter(v => v);
    
    // Add any new profiles
    for (const profile of profiles) {
        if (!existingValues.includes(profile)) {
            const option = document.createElement('option');
            option.value = profile;
            option.textContent = profile;
            select.appendChild(option);
        }
    }
    
    select.value = currentProfile;
}

/**
 * Inject the profile selector into the character advanced definitions panel
 */
async function injectProfileSelector() {
    // Check if already injected
    if (document.getElementById('mmc_profile_selector_container')) {
        await updateProfileSelector();
        return;
    }
    
    // Find the advanced definitions panel
    // We'll inject after the "Main Prompt Overrides" section
    const advancedPanel = document.getElementById('character_popup');
    if (!advancedPanel) {
        console.debug(`[${MODULE_NAME}] Character popup not found, will retry`);
        return;
    }
    
    // Find a good injection point - after prompt overrides or at end of form_create block
    const formCreate = advancedPanel.querySelector('.form_create');
    if (!formCreate) {
        console.debug(`[${MODULE_NAME}] Form create block not found`);
        return;
    }
    
    // Create and inject the selector
    const selector = await createProfileSelector();
    
    // Create a wrapper with header like other sections
    const wrapper = document.createElement('div');
    wrapper.classList.add('mmc-section');
    
    const header = document.createElement('h4');
    header.innerHTML = '<span data-i18n="Multi-Model Chat">Multi-Model Chat</span>';
    
    const description = document.createElement('small');
    description.classList.add('mmc-description');
    description.textContent = 'Select a connection profile for this character to use in group chats.';
    
    wrapper.appendChild(header);
    wrapper.appendChild(description);
    wrapper.appendChild(selector);
    
    // Insert at a reasonable position
    const scenarioOverride = formCreate.querySelector('[name="scenario_override"]')?.closest('div');
    if (scenarioOverride) {
        scenarioOverride.after(wrapper);
    } else {
        formCreate.appendChild(wrapper);
    }
    
    await updateProfileSelector();
}

/**
 * Add settings UI to the extensions panel
 */
async function addSettingsUI() {
    const { renderExtensionTemplateAsync, eventSource, event_types } = SillyTavern.getContext();
    
    // Create settings HTML
    const settingsHtml = `
        <div class="mmc-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Multi-Model Chat</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="mmc-settings-content">
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_enabled" />
                            <span data-i18n="Enable profile switching in group chats">Enable profile switching in group chats</span>
                        </label>
                        
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_notifications" />
                            <span data-i18n="Show notifications on profile switch">Show notifications on profile switch</span>
                        </label>
                        
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_restore_profile" />
                            <span data-i18n="Restore original profile after leaving group chat">Restore original profile after leaving group chat</span>
                        </label>
                        
                        <hr />
                        
                        <div class="mmc-info">
                            <small>
                                Assign profiles to characters in their Advanced Definitions panel.
                                Profiles are switched automatically when a character speaks in a group chat.
                            </small>
                        </div>
                        
                        <div class="mmc-buttons">
                            <button id="mmc_refresh_profiles" class="menu_button">
                                <i class="fa-solid fa-refresh"></i>
                                <span data-i18n="Refresh Profiles">Refresh Profiles</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to extensions settings
    const container = document.getElementById('extensions_settings');
    if (container) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = settingsHtml;
        container.appendChild(tempDiv.firstElementChild);
        
        // Initialize settings UI
        const settings = getSettings();
        
        document.getElementById('mmc_enabled').checked = settings.enabled;
        document.getElementById('mmc_notifications').checked = settings.showNotifications;
        document.getElementById('mmc_restore_profile').checked = settings.restoreProfileAfterGroup;
        
        // Add event listeners
        document.getElementById('mmc_enabled').addEventListener('change', (e) => {
            settings.enabled = e.target.checked;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        
        document.getElementById('mmc_notifications').addEventListener('change', (e) => {
            settings.showNotifications = e.target.checked;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        
        document.getElementById('mmc_restore_profile').addEventListener('change', (e) => {
            settings.restoreProfileAfterGroup = e.target.checked;
            SillyTavern.getContext().saveSettingsDebounced();
        });
        
        document.getElementById('mmc_refresh_profiles').addEventListener('click', async () => {
            await updateProfileSelector();
            toastr.success('Profile list refreshed');
        });
    }
}

/**
 * Initialize the extension
 */
async function init() {
    console.log(`[${MODULE_NAME}] Initializing Multi-Model Chat extension...`);
    
    const { eventSource, event_types } = SillyTavern.getContext();
    
    // Register event handlers
    eventSource.on(event_types.GROUP_MEMBER_DRAFTED, onGroupMemberDrafted);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHAT_CHANGED, updateProfileSelector);
    
    // Also update selector when character panel opens
    const characterPopup = document.getElementById('character_popup');
    if (characterPopup) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const display = window.getComputedStyle(characterPopup).display;
                    if (display !== 'none') {
                        injectProfileSelector();
                    }
                }
            }
        });
        observer.observe(characterPopup, { attributes: true });
    }
    
    // Add settings UI
    await addSettingsUI();
    
    // Try to inject selector if character panel is already open
    await injectProfileSelector();
    
    console.log(`[${MODULE_NAME}] Multi-Model Chat extension initialized!`);
}

// Initialize when app is ready
const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
