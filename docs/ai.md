# The AI assistant

Blockwerk can build block scripts and place library objects for you from a sentence (SPEC 9.4). It
is **optional and off by default**: without your own key nothing of it exists in the editor, and the
editor makes no request outside itself.

## Switching it on

1. Get an API key from Anthropic (a key of your own, nothing is bundled).
2. **Edit → Preferences**: paste the key and press **Save**. The key is never shown again.
3. The **AI** button appears in the toolbar and **Window → AI Assistant** in the menu. **Remove key**
   in the preferences makes both disappear again.

Where the key is kept:

| Version                | Storage                                                                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop app (Electron) | Encrypted with the operating system (`safeStorage`) in the main process. The page never sees the key; the main process sends the request, and only to `api.anthropic.com`. Without system encryption: this session only. |
| Browser version        | Local storage of your browser, **unencrypted**. Use the desktop app on a shared computer.                                                                                                                                |

The **model** can be chosen in the preferences (default `claude-sonnet-5-5`, any model ID can be
typed). Everything the assistant sends goes to Anthropic: your request, the block catalog and the
asset library list, and a short summary of the project (names, positions, script names, and for
"Why does this not work?" the console and the variable values). Nothing is sent without you
pressing **Send**. There is no telemetry.

## What it does

Five tasks in the AI Assistant window:

| Task                    | Answer                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Build logic             | A block script for the selected object, e.g. "The guard watches the gate and chases the player when it sees him". |
| Build world             | Library objects at positions, e.g. "Put 5 houses and a well on the meadow".                                       |
| Explain                 | A text about the open script.                                                                                     |
| Why does this not work? | A text, using the console, the scene check and the variable values of the play mode.                              |
| Tidy up                 | A cleaned-up version of the open script that replaces it.                                                         |

**Nothing changes before you confirm.** A script is shown as a block outline with the same texts as
the blocks. A world is shown as **half-transparent ghost objects in the Scene view** plus a list.
**Apply** makes it real as **one undo step** (Ctrl+Z takes all of it back); **Discard** throws it
away.

## How wrong answers are caught

The model answers through forced tool calls, so the answer is structured data. Before you see it,
the answer is checked:

- **Scripts:** every block must exist in the catalog, fit its place, have valid field values, valid
  references to objects, tags and assets, matching socket types, and the script must **compile**
  without errors. No Code blocks and no custom blocks. Limits on size and depth.
- **Worlds:** every model must exist in the library index, numbers must be finite and in range, at
  most 60 objects, objects do not stand inside each other.

An invalid answer goes back to the model with the list of errors, at most **two times**. If it is
still invalid you get "The assistant could not give a valid answer" with the reasons, and nothing
changes. Behavior blocks such as "follow" start once and keep going; the assistant is told to call
them once, not every frame.

## Trying it without the editor

`ANTHROPIC_API_KEY=… pnpm ai:live` asks the two example questions above against the real API and
prints the outline and the objects. It is not part of the tests or the CI. The tests use answers
written by hand, in the way a model answers, including invalid ones.
