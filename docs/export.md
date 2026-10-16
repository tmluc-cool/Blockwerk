# Building and exporting a game

Blockwerk turns a project into a game that runs without the editor (SPEC 9.3). Nothing needs an
account, a network or a license: the game is a folder you can copy, zip and share.

## In the editor

**File → Build Settings** (Ctrl+Shift+B):

- **Scenes in Build:** which scenes belong to the game, in which order, and which one starts.
  Scenes that something leads to (a "load scene" block, a menu button) come along even if they are
  not ticked.
- **Platform:** _Windows app (.exe)_ or _Web (folder and ZIP)_.
- **Game:** name, window mode (fullscreen or window), graphics level, icon and start image.
- **Build** writes the game. **Build and Run** also starts the Windows app.

What goes into the game: only the assets the scenes use (models, sounds, images, terrains,
prefabs, dialogs, menus). The block scripts are compiled to JavaScript; the game carries neither
Blockly nor the compiler. `CREDITS.txt` lists every third-party asset with author, license and
source, and the engine parts with their licenses.

## What you get

| Platform | Result                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------- |
| Web      | A folder (`index.html`, the player, `game/`) and a ZIP of it. Upload it to itch.io or any server.  |
| Windows  | A folder with `<Name>.exe`, `CREDITS.txt` and the game. Starts in fullscreen, offline, no install. |

A Windows app can only be built with the **Windows version of Blockwerk** (it carries the Windows
player). The web build works in every version, also in the browser.

The game keeps the player's settings (volumes, mouse, keys, graphics, fullscreen) and the save
slots on the player's computer, per game name.

## From the command line

```
pnpm --filter @blockwerk/player build              # the player page (once, `pnpm build` does it)
pnpm export examples/05-quest --out out/quest-web --zip
```

For a Windows app the player template is needed. It is made from the Electron runtime of the
system it runs on, so run this on Windows:

```
pnpm build
pnpm player-template
pnpm export examples/05-quest --out out/quest --platform windows
```

On another system `--platform app` makes an app of that system from the same pieces (used by the
tests). `pnpm dist` builds the installer and the portable exe of Blockwerk itself; both carry the
player template.

## Releases

A tag `v*` (for example `v0.9.0`) starts `.github/workflows/release.yml`: it builds the Windows
installer and the portable exe, the web version of the editor and the start package of the asset
library, writes the changelog from the Conventional Commits since the last tag and publishes it
all as a GitHub Release. Changes to the workflow run the same build as a dry run.

The installer and the exe are **not code signed**. Windows may show its SmartScreen notice the
first time; "More info → Run anyway" starts the program.

## How it works

- `packages/export` finds the used assets, compiles the scripts and writes `game/game.json` and the
  files (`buildGame`), then puts them next to the player (`assembleWebBuild`).
- `apps/player` is the page that runs a game: loading screen, input, UI, settings, saves, scene
  changes. It imports the runtime and nothing from the editor.
- `apps/desktop` holds the player shell (`playerMain.ts`): a window that shows the player page and
  the game from its `resources/` folder. It has no menu, asks for no network and shows only the
  game's own files.
