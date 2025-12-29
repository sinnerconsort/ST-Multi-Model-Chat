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
    fallbackProfile: '',
});

// Cache for available profiles
let cachedProfiles = [];
let profileCacheTime = 0;
const PROFILE_CACHE_TTL = 30000; // 30 seconds

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
 * Get character index by name
 * @param {string} characterName - The character's name
 * @returns {number} Character index or -1 if not found
 */
function getCharacterIndexByName(characterName) {
    const { characters } = SillyTavern.getContext();
    return characters.findIndex(c => c.name === characterName);
}

/**
 * Set the connection profile for a character by index
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
    
    // Update any visible UI elements
    updateGroupMemberProfiles();
}

/**
 * Set the connection profile for a character by name
 * @param {string} characterName - The character's name
 * @param {string} profileName - The profile name to assign
 */
async function setCharacterProfileByName(characterName, profileName) {
    const charIndex = getCharacterIndexByName(characterName);
    if (charIndex >= 0) {
        await setCharacterProfile(charIndex, profileName);
    }
}

/**
 * Get list of available connection profiles
 * @param {boolean} forceRefresh - Force refresh the cache
 * @returns {Promise<string[]>} Array of profile names
 */
async function getAvailableProfiles(forceRefresh = false) {
    const now = Date.now();
    
    // Return cached if still valid
    if (!forceRefresh && cachedProfiles.length > 0 && (now - profileCacheTime) < PROFILE_CACHE_TTL) {
        return cachedProfiles;
    }
    
    const { executeSlashCommandsWithOptions } = SillyTavern.getContext();
    
    try {
        const result = await executeSlashCommandsWithOptions('/profile-list', {
            handleExecutionErrors: false,
            handleParserErrors: false,
        });
        
        if (result?.pipe) {
            const profiles = JSON.parse(result.pipe);
            if (Array.isArray(profiles)) {
                cachedProfiles = profiles;
                profileCacheTime = now;
                return profiles;
            }
        }
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to get profile list:`, error);
    }
    
    return cachedProfiles.length > 0 ? cachedProfiles : [];
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
        // Quote the profile name to handle spaces and special characters
        const quotedName = profileName.includes(' ') ? `"${profileName}"` : profileName;
        
        await executeSlashCommandsWithOptions(`/profile ${quotedName}`, {
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
    
    // Handle various event data formats
    const characterName = typeof data === 'string' ? data : (data?.name || data?.charName || data?.character);
    
    if (!characterName) {
        console.debug(`[${MODULE_NAME}] No character name in event data:`, data);
        return;
    }
    
    console.debug(`[${MODULE_NAME}] Group member drafted: ${characterName}`);
    
    // Get character's assigned profile, or fallback
    let targetProfile = getCharacterProfile(characterName);
    
    if (!targetProfile && settings.fallbackProfile) {
        console.debug(`[${MODULE_NAME}] Using fallback profile for ${characterName}`);
        targetProfile = settings.fallbackProfile;
    }
    
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
    
    // Update group member UI if in a group
    if (groupId) {
        setTimeout(updateGroupMemberProfiles, 500);
    }
}

/**
 * Create a profile dropdown for inline use
 * @param {string} characterName - Character this dropdown is for
 * @param {string} currentValue - Currently selected profile
 * @param {string[]} profiles - Available profiles
 * @returns {HTMLSelectElement}
 */
function createInlineProfileSelect(characterName, currentValue, profiles) {
    const select = document.createElement('select');
    select.classList.add('mmc-inline-select', 'text_pole');
    select.dataset.character = characterName;
    select.title = `Connection profile for ${characterName}`;
    
    // Empty option
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— Default —';
    select.appendChild(emptyOpt);
    
    // Profile options
    for (const profile of profiles) {
        const opt = document.createElement('option');
        opt.value = profile;
        // Truncate long profile names for display
        opt.textContent = profile.length > 25 ? profile.substring(0, 22) + '...' : profile;
        opt.title = profile;
        select.appendChild(opt);
    }
    
    select.value = currentValue || '';
    
    // Handle change
    select.addEventListener('change', async (e) => {
        e.stopPropagation();
        await setCharacterProfileByName(characterName, e.target.value);
    });
    
    // Prevent click from triggering parent elements
    select.addEventListener('click', (e) => e.stopPropagation());
    
    return select;
}

/**
 * Add/update profile selectors in the group chat member list
 */
async function updateGroupMemberProfiles() {
    const { groupId, groups } = SillyTavern.getContext();
    
    if (!groupId) return;
    
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    const profiles = await getAvailableProfiles();
    
    // Find the group members container
    // This selector may need adjustment based on ST version
    const membersList = document.querySelector('#rm_group_members, .group_member_list, [id*="group_members"]');
    if (!membersList) {
        console.debug(`[${MODULE_NAME}] Group members list not found`);
        return;
    }
    
    // Find each member entry and add/update profile selector
    const memberEntries = membersList.querySelectorAll('.group_member, [class*="group_member"]');
    
    for (const entry of memberEntries) {
        // Try to get character name from the entry
        const nameElement = entry.querySelector('.ch_name, .character_name, [class*="name"]');
        const characterName = nameElement?.textContent?.trim() || entry.dataset?.character;
        
        if (!characterName) continue;
        
        // Check if we already added a selector
        let existingSelect = entry.querySelector('.mmc-inline-select');
        
        if (existingSelect) {
            // Update value
            const currentProfile = getCharacterProfile(characterName) || '';
            if (existingSelect.value !== currentProfile) {
                existingSelect.value = currentProfile;
            }
        } else {
            // Create and add selector
            const currentProfile = getCharacterProfile(characterName) || '';
            const select = createInlineProfileSelect(characterName, currentProfile, profiles);
            
            // Find a good place to insert - after name or at end of entry
            const insertTarget = entry.querySelector('.ch_name, .character_name') || entry;
            
            // Create a wrapper
            const wrapper = document.createElement('div');
            wrapper.classList.add('mmc-member-profile');
            wrapper.appendChild(select);
            
            insertTarget.parentNode?.insertBefore(wrapper, insertTarget.nextSibling);
        }
    }
}

/**
 * Create the profile selector for the character editor panel
 * @returns {Promise<HTMLElement>}
 */
async function createCharacterEditorSelector() {
    const container = document.createElement('div');
    container.id = 'mmc_char_editor_container';
    container.classList.add('mmc-section');
    
    const header = document.createElement('div');
    header.classList.add('mmc-section-header');
    header.innerHTML = `
        <h4>
            <i class="fa-solid fa-shuffle"></i>
            <span>Multi-Model Chat</span>
        </h4>
    `;
    
    const description = document.createElement('small');
    description.classList.add('mmc-description');
    description.textContent = 'Select a connection profile for this character to use in group chats.';
    
    const selectWrapper = document.createElement('div');
    selectWrapper.classList.add('mmc-profile-selector');
    
    const label = document.createElement('label');
    label.htmlFor = 'mmc_profile_select';
    label.textContent = 'Connection Profile';
    
    const select = document.createElement('select');
    select.id = 'mmc_profile_select';
    select.classList.add('text_pole', 'wide100p');
    
    // Empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '— Use Default / Fallback —';
    select.appendChild(emptyOption);
    
    // Load profiles
    const profiles = await getAvailableProfiles();
    for (const profile of profiles) {
        const option = document.createElement('option');
        option.value = profile;
        option.textContent = profile;
        select.appendChild(option);
    }
    
    // Handle change
    select.addEventListener('change', async (e) => {
        const { characterId } = SillyTavern.getContext();
        if (characterId !== undefined) {
            await setCharacterProfile(characterId, e.target.value);
        }
    });
    
    selectWrapper.appendChild(label);
    selectWrapper.appendChild(select);
    
    container.appendChild(header);
    container.appendChild(description);
    container.appendChild(selectWrapper);
    
    return container;
}

/**
 * Update the character editor selector with current character's profile
 */
async function updateCharacterEditorSelector() {
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
    
    // Refresh profile options
    const profiles = await getAvailableProfiles();
    const existingValues = new Set(Array.from(select.options).map(o => o.value));
    
    for (const profile of profiles) {
        if (!existingValues.has(profile)) {
            const option = document.createElement('option');
            option.value = profile;
            option.textContent = profile;
            select.appendChild(option);
        }
    }
    
    select.value = currentProfile;
}

/**
 * Try to inject the profile selector into the character editor
 * Uses multiple strategies to find the right injection point
 */
async function injectCharacterEditorSelector() {
    // Already injected?
    if (document.getElementById('mmc_char_editor_container')) {
        await updateCharacterEditorSelector();
        return;
    }
    
    // Strategy 1: Look for the character popup / advanced definitions
    const injectionTargets = [
        // Advanced definitions popup
        () => {
            const popup = document.getElementById('character_popup');
            if (!popup || popup.style.display === 'none') return null;
            
            // Try to find after prompt overrides section
            const promptOverrides = popup.querySelector('.prompt_overrides, [class*="prompt_override"]');
            if (promptOverrides) return { target: promptOverrides, position: 'after' };
            
            // Or after post-history instructions
            const postHistory = popup.querySelector('[name="post_history_instructions"]')?.closest('div');
            if (postHistory) return { target: postHistory.parentElement, position: 'append' };
            
            // Fallback to form_create
            const formCreate = popup.querySelector('.form_create, form');
            if (formCreate) return { target: formCreate, position: 'append' };
            
            return null;
        },
        // Right side character panel
        () => {
            const charPanel = document.getElementById('rm_ch_create_block');
            if (!charPanel) return null;
            
            const advancedBtn = charPanel.querySelector('#character_advanced_button');
            if (advancedBtn) return { target: advancedBtn.parentElement, position: 'after' };
            
            return null;
        },
        // Any visible character editing form
        () => {
            const forms = document.querySelectorAll('[id*="character"][class*="popup"]:not([style*="display: none"]), #character_popup:not([style*="display: none"])');
            for (const form of forms) {
                const target = form.querySelector('.form_create, form, .character_edit');
                if (target) return { target, position: 'append' };
            }
            return null;
        }
    ];
    
    let injectionPoint = null;
    
    for (const strategy of injectionTargets) {
        injectionPoint = strategy();
        if (injectionPoint) break;
    }
    
    if (!injectionPoint) {
        console.debug(`[${MODULE_NAME}] No suitable injection point found`);
        return;
    }
    
    const selector = await createCharacterEditorSelector();
    
    const { target, position } = injectionPoint;
    
    if (position === 'after') {
        target.after(selector);
    } else if (position === 'before') {
        target.before(selector);
    } else {
        target.appendChild(selector);
    }
    
    await updateCharacterEditorSelector();
    console.log(`[${MODULE_NAME}] Injected character editor selector`);
}

/**
 * Add settings UI to the extensions panel
 */
async function addSettingsUI() {
    const settings = getSettings();
    const profiles = await getAvailableProfiles();
    
    // Build profile options for fallback selector
    let profileOptions = '<option value="">— None —</option>';
    for (const profile of profiles) {
        const selected = profile === settings.fallbackProfile ? 'selected' : '';
        const escaped = profile.replace(/"/g, '&quot;');
        profileOptions += `<option value="${escaped}" ${selected}>${profile}</option>`;
    }
    
    const settingsHtml = `
        <div class="mmc-settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b><i class="fa-solid fa-shuffle"></i> Multi-Model Chat</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div class="mmc-settings-content">
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_enabled" ${settings.enabled ? 'checked' : ''} />
                            <span>Enable profile switching in group chats</span>
                        </label>
                        
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_notifications" ${settings.showNotifications ? 'checked' : ''} />
                            <span>Show notifications on profile switch</span>
                        </label>
                        
                        <label class="checkbox_label">
                            <input type="checkbox" id="mmc_restore_profile" ${settings.restoreProfileAfterGroup ? 'checked' : ''} />
                            <span>Restore original profile after leaving group chat</span>
                        </label>
                        
                        <hr />
                        
                        <div class="mmc-setting-row">
                            <label for="mmc_fallback_profile">
                                <span>Fallback Profile</span>
                                <small>Used for characters without an assigned profile</small>
                            </label>
                            <select id="mmc_fallback_profile" class="text_pole">
                                ${profileOptions}
                            </select>
                        </div>
                        
                        <hr />
                        
                        <div class="mmc-info">
                            <small>
                                <i class="fa-solid fa-info-circle"></i>
                                Assign profiles to characters in their Advanced Definitions panel,
                                or directly in the group chat member list.
                            </small>
                        </div>
                        
                        <div class="mmc-buttons">
                            <button id="mmc_refresh_profiles" class="menu_button">
                                <i class="fa-solid fa-refresh"></i>
                                <span>Refresh Profiles</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('extensions_settings');
    if (!container) {
        console.warn(`[${MODULE_NAME}] Extensions settings container not found`);
        return;
    }
    
    // Remove existing if present (for reload)
    const existing = container.querySelector('.mmc-settings');
    if (existing) existing.remove();
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = settingsHtml;
    container.appendChild(tempDiv.firstElementChild);
    
    // Event listeners
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
    
    document.getElementById('mmc_fallback_profile').addEventListener('change', (e) => {
        settings.fallbackProfile = e.target.value;
        SillyTavern.getContext().saveSettingsDebounced();
        if (e.target.value) {
            toastr.info(`Fallback profile set to "${e.target.value}"`);
        }
    });
    
    document.getElementById('mmc_refresh_profiles').addEventListener('click', async () => {
        cachedProfiles = [];
        const profiles = await getAvailableProfiles(true);
        
        // Update fallback selector
        const fallbackSelect = document.getElementById('mmc_fallback_profile');
        if (fallbackSelect) {
            const currentValue = fallbackSelect.value;
            fallbackSelect.innerHTML = '<option value="">— None —</option>';
            for (const profile of profiles) {
                const opt = document.createElement('option');
                opt.value = profile;
                opt.textContent = profile;
                fallbackSelect.appendChild(opt);
            }
            fallbackSelect.value = currentValue;
        }
        
        await updateCharacterEditorSelector();
        await updateGroupMemberProfiles();
        toastr.success(`Loaded ${profiles.length} profiles`);
    });
}

/**
 * Set up observers to detect when character editor opens
 */
function setupObservers() {
    // Watch for character popup visibility changes
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            // Check for added nodes that might be character panels
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.id?.includes('character') || node.classList?.contains('character')) {
                            setTimeout(injectCharacterEditorSelector, 100);
                        }
                    }
                }
            }
            
            // Check for style/class changes on character popup
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target.id === 'character_popup' || target.id?.includes('character')) {
                    const isVisible = target.style.display !== 'none' && 
                                     !target.classList.contains('hidden') &&
                                     target.offsetParent !== null;
                    if (isVisible) {
                        setTimeout(injectCharacterEditorSelector, 100);
                    }
                }
            }
        }
    });
    
    // Observe the whole document for character panel changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });
    
    // Also watch for group member list changes
    const groupObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                const target = mutation.target;
                if (target.id?.includes('group') || target.classList?.contains('group')) {
                    setTimeout(updateGroupMemberProfiles, 200);
                }
            }
        }
    });
    
    groupObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Initialize the extension
 */
async function init() {
    console.log(`[${MODULE_NAME}] Initializing Multi-Model Chat extension v1.1...`);
    
    const { eventSource, event_types } = SillyTavern.getContext();
    
    // Register event handlers
    eventSource.on(event_types.GROUP_MEMBER_DRAFTED, onGroupMemberDrafted);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    
    // Set up DOM observers
    setupObservers();
    
    // Add settings UI
    await addSettingsUI();
    
    // Pre-cache profiles
    await getAvailableProfiles();
    
    // Initial injection attempts
    setTimeout(injectCharacterEditorSelector, 500);
    setTimeout(updateGroupMemberProfiles, 1000);
    
    console.log(`[${MODULE_NAME}] Multi-Model Chat extension initialized!`);
}

// Initialize when app is ready
const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.APP_READY, init);
