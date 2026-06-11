# Multi-Model Chat

A SillyTavern extension that lets each character in a group chat speak through
a different AI model.

Assign a **Connection Profile** to each character; when that character is
drafted to speak, the extension switches to their profile automatically before
generation. Claude for your lead, a fast local model for the bartender NPC,
GPT for the rival — all in one group chat.

Born from [community discussion #3785](https://github.com/SillyTavern/SillyTavern/discussions/3785).

## What's new in v3.0

v3 is a ground-up rewrite focused on the thing v2 struggled with most:
**reliability**.

- **Profile detection actually works now.** v2 guessed at API endpoints and
  settings locations; v3 reads the canonical Connection Manager store. The
  "Add Profile Manually" workaround is gone because it's no longer needed.
- **Auto-switch is the primary mode** (on by default for new installs). The
  v2 handler misread the event SillyTavern sends when drafting a character;
  v3 resolves it correctly and verifies the profile applied before generation
  proceeds. Set it and forget it — the original request, finally honored.
- **"Restore original profile" works.** (v2 advertised it; it was never wired.)
- **Assignments survive renames.** Stored by character file rather than
  display name, with exact matching only. Your v2 assignments migrate
  automatically on first load.
- **New: per-group default profile.** Precedence is
  *character assignment → group default → global fallback*.
- Lighter on your browser: the page-wide DOM observer is gone.

## Prerequisites

- SillyTavern 1.12.6+ with the built-in **Connection Profiles** feature
- At least 2 connection profiles configured
  (API Connections → Connection Profiles → Save)

## Installation

**Extension installer (recommended):** Extensions → Install Extension → paste
this repository's URL → Install → refresh.

**Manual:** drop this folder into
`data/<user>/extensions/multi-model-chat` and restart ST.

## Usage

1. Open a **group chat** and its member list.
2. Each member now has a **profile dropdown** and a **▶ button**.
   A dashed **"MMC group default"** row at the top sets the profile for
   unassigned members of this group.
3. Pick profiles. Done — with auto-switch on, characters speak through their
   assigned model from now on.
4. The **▶ button** manually switches to that character's profile and
   triggers them to speak (useful with auto-mode off, or to force a turn).

### Slash commands

| Command | What it does |
|---|---|
| `/mmc-go Name` | Switch to Name's profile and trigger them |
| `/mmc-assign char="Name" Profile` | Assign a profile (empty profile clears) |
| `/mmc-debug` | Show detected profiles and current assignments |

### Settings (Extensions → Multi-Model Chat)

| Setting | Meaning |
|---|---|
| Enable | Master toggle |
| Auto-switch | Switch profiles automatically when a character is drafted |
| Show toast | Brief notification on each switch |
| Restore original profile | Return to your pre-group profile when leaving a group chat |
| Global fallback | Profile for characters with no assignment anywhere |

## Troubleshooting

- **No profiles in the dropdowns** → you haven't saved any Connection
  Profiles yet, or Connection Manager is disabled. Create profiles under
  API Connections, then hit **Refresh** in MMC settings.
- **"Profile not found" on switch** → the assigned profile was deleted or
  renamed. Re-assign.
- **A character kept an old assignment after migration** → v2 sometimes keyed
  assignments ambiguously; check `/mmc-debug` for entries marked
  *(legacy key)* and re-assign them once to upgrade the key.

## Notes & limitations

- Group chats only — solo chats have one speaker, so just switch profiles
  normally. (Per-character auto-profiles in solo chats may come later.)
- Profiles should be fully configured (API + model + settings); the extension
  switches profiles, it doesn't fill gaps in them.
- Mixing Chat Completion and Text Completion profiles works to the extent the
  profiles themselves are complete.

## License

AGPL-3.0 — same as SillyTavern.

## Credits

- The ST team, and Cohee for clarifying the implementation path
- victoralvelais for the original discussion, and everyone who +1'd it
