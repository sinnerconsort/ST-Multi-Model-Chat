# Multi-Model Chat

A SillyTavern extension that enables using different AI models/APIs for different characters in group chats.

## The Problem

By default, SillyTavern group chats use a single API connection for all characters. This means every character in your group chat speaks using the same model, which limits creative possibilities:

- You can't have one character use Claude while another uses GPT
- You can't assign a cheaper/faster model to simple characters and a smarter model to complex ones  
- You can't leverage different models' strengths for different character personalities

## The Solution

Multi-Model Chat lets you assign a **Connection Profile** to each character. When that character is drafted to speak in a group chat, the extension automatically switches to their assigned profile before generation.

## Features

- 🔄 **Automatic Profile Switching**: Seamlessly switches connection profiles when characters speak
- 🎭 **Per-Character Assignment**: Assign different profiles to different characters
- 📢 **Optional Notifications**: Get notified when profiles switch (can be disabled)
- 🔙 **Profile Restoration**: Optionally restore your original profile after leaving a group chat
- 💾 **Persistent Storage**: Profile assignments are saved in character cards and export with them

## Prerequisites

- SillyTavern 1.12.6 or later
- **Connection Profiles** extension enabled (built-in since 1.12.6)
- At least 2 connection profiles configured

## Installation

### Via SillyTavern Extension Installer (Recommended)

1. Open SillyTavern
2. Go to **Extensions** → **Install Extension**
3. Paste this repository URL: `https://github.com/SinnerConsort/st-multi-model-chat`
4. Click **Install**
5. Refresh the page

### Manual Installation

1. Navigate to your SillyTavern installation's `data/<user>/extensions` folder
2. Clone or download this repository into a folder named `multi-model-chat`
3. Restart SillyTavern

## Setup

### Step 1: Create Connection Profiles

Before using this extension, you need connection profiles configured:

1. Go to **API Connections** (plug icon)
2. Configure your first API/model combination
3. In the **Connection Profiles** section, click **Save** and name it (e.g., "Claude-Sonnet")
4. Repeat for each API/model you want to use (e.g., "GPT-4", "Local-Llama", etc.)

### Step 2: Assign Profiles to Characters

1. Open a character's settings
2. Click **Advanced Definitions**
3. Find the **Multi-Model Chat** section
4. Select a connection profile from the dropdown
5. The profile is saved automatically

### Step 3: Use in Group Chat

1. Create or open a group chat with characters that have profiles assigned
2. Chat normally - the extension handles profile switching automatically
3. Watch the notifications (if enabled) to see when profiles switch

## Settings

Access settings via **Extensions** → **Multi-Model Chat**:

| Setting | Description |
|---------|-------------|
| **Enable profile switching** | Master toggle for the extension |
| **Show notifications** | Display toasts when profiles switch |
| **Restore original profile** | Return to your previous profile after leaving a group chat |

## How It Works

1. When you're in a group chat, SillyTavern selects which character will speak next
2. The extension listens for the `GROUP_MEMBER_DRAFTED` event
3. It checks if that character has an assigned connection profile
4. If yes, it executes `/profile [name]` to switch before generation begins
5. The character's response is generated using their assigned API/model

## Tips & Best Practices

### Profile Naming
Name your profiles descriptively so they're easy to assign:
- `Claude-Opus-Creative`
- `GPT4-Analytical`  
- `Local-Fast`

### Strategic Assignment
Consider assigning models based on character needs:
- **Complex characters**: Use more capable models (Claude Opus, GPT-4)
- **Simple NPCs**: Use faster/cheaper models (Haiku, local models)
- **Specific personalities**: Match model "vibes" to characters

### Mixing API Types
The extension works across different API types:
- OpenAI ↔ Anthropic ↔ Local models
- Just make sure each profile is fully configured with all necessary settings

## Troubleshooting

### Profile doesn't switch
- Ensure the extension is enabled in settings
- Verify the character has a profile assigned (check Advanced Definitions)
- Make sure the profile name exists (use Refresh Profiles button)

### "Profile not found" errors
- The assigned profile may have been deleted
- Re-assign a valid profile to the character

### Slow switching
- Profile switching happens via slash commands which have minimal overhead
- If you notice delays, they're likely from API connection time, not the extension

## Known Limitations

- Works only in **group chats** (solo chats don't need this)
- Requires **Chat Completion** API profiles (Text Completion may have issues)
- Profile switching is visible in the UI (Connection Profiles section updates)

## Contributing

Contributions welcome! This extension was born from [community discussion #3785](https://github.com/SillyTavern/SillyTavern/discussions/3785).

Ideas for improvement:
- Support for Text Completion APIs
- Preset switching in addition to profiles
- Per-group default profiles
- Profile assignment via World Info

## License

AGPL-3.0 - Same as SillyTavern

## Credits

- SillyTavern team for the excellent extension API
- Cohee for clarifying the implementation path
- victoralvelais for initiating the GitHub discussion
- The ST community for requesting this feature
