# Progress

Status of the phases from `SPEC.md`, section 10. Per phase: plan before starting, acceptance result afterwards.

| Phase | Title | Status |
|---|---|---|
| 0 | Foundation and Unity layout | done |
| 1 | Objects, components, block scripts, Play Mode | done |
| 2 | Project window, Asset Library, Prefabs | done |
| 3 | Player, physics, animation | done |
| 3b | Character Studio | done |
| 4 | Environment and graphics | done |
| 5 | NPCs and game logic | done |
| 6 | UI, menus, saving | done |
| 7 | Large projects | in review |
| 8 | Debugging | open |
| 9 | Build and export | open |
| 10 | AI assistant | open |
| 11 | Polish and final acceptance | open |

---

## Phase 7: Large projects

Branch: `phase/07-grosse-projekte` (builds on `main` with Phase 6 merged).

### Plan

**Subtasks** (SPEC 7.3, 7.4, 7.6, 7.8, 7.9, section 3 rows 6, 7, 9, 12–15, 20, Phase 7)

1. **Data types and shared variables** (`packages/project`, `packages/blocks`, `packages/runtime`): variable types `list` and `dictionary` (values are JSON, also in saves), blocks for lists and dictionaries (create, add, insert, remove, get, set, length, contains, join, "for each item in list", dictionary key / value blocks) with golden and runtime tests. This also builds the list blocks that Phase 5 left open. Game-scoped variables become really **project-wide**: a game variable keeps one ID, every script that uses it carries the same declaration, the Variables panel lists the game variables of the whole project ("use in this script"), and renaming one changes it in every script.
2. **Custom blocks** (`packages/blocks`, `packages/compiler`): command, value and condition blocks with typed parameters (number, text, condition, any, list, dictionary), "return" with a value, "run without screen refresh" (`warp`: loops of the function do not wait for the next frame), and **local variables** (declare, set, change, get). A custom block is a definition block in a block script's workspace; visible in that script only or **project-wide** (then every block script can call it, "block library" = ordinary block-script assets that hold definitions). Calls store the ID of the defining script and block, so prefab and project copy find the dependency. The IR and the code generator already know functions and locals (Phase 0); `toIR` learns to read them, and a function table across scripts links project-wide calls.
3. **Type check** (`packages/compiler`): plugged values are checked against the socket type, return types and parameter types are checked at calls; problems become diagnostics ("expects a number, got text") that the editor shows on the block and the console lists, and that stop nothing from running (conversion as in SPEC 7.3).
4. **Block editor: custom blocks and locals** (`apps/editor`): "Make a block" dialog (name, kind, parameters with type, project-wide, run without screen refresh), "My Blocks" palette category, edit / delete a definition, call blocks follow definition changes (name, parameters), right click on selected blocks → "Extract as custom block" (the selection becomes a definition, free variables become parameters, the selection is replaced by a call), a hint for scripts with more than about 30 blocks.
5. **Typing instead of dragging** (`packages/blocks`, `apps/editor`): typing on the workspace opens a fuzzy search over all blocks (German and English, with synonyms, the index of `buildSearchIndex`); Enter inserts the block at the cursor or after the selected block, Tab jumps to the next field of the block; typing an expression such as `x/2 + 10` into a number slot builds operator blocks (parser with `+ - * / % ( )`, comparison, `and`, `or`, `not`, variables, numbers, text) — pure function with tests.
6. **Navigation and refactoring** (`apps/editor`, `packages/project`): a **Search window** (Window → Search) across all block scripts, scenes, dialogs and UI canvases (variables, messages, custom blocks, tags, objects, assets, text in blocks), "Go to definition" and "All usages" on a block, "Rename everywhere" for variables, messages, tags and custom blocks (one undo step); in the block editor: collapse stacks, comments (Blockly's), colored regions (a comment block with a color that shows as a labeled bar), minimap, "Clean up" (arrange stacks).
7. **Code view and Code block** (`packages/blocks`, `packages/compiler`, `apps/editor`): a switch in the block editor shows the generated JavaScript of the script, read-only, with block ↔ line link in both directions (uses `lineToBlock`); a **Code block** (stack and value form) for advanced users with a documented API (`self`, `game`, `scene`, `three`), never rewritten automatically, with syntax errors reported as diagnostics before play.
8. **Carrying blocks with prefabs**: saving a prefab to "My Prefabs" and importing it into another project brings the block scripts, block libraries and custom blocks with it (the dependency walk of Phase 2 follows the stored IDs); an import test shows no missing block.
9. **Example** `examples/07-gross` (generated by `scripts/make-example-07.mjs`): a project with **at least 80 block scripts** over all areas (environment, players, NPCs, items, UI), custom blocks (a small library), lists and dictionaries, loads in under 3 seconds (project load + compile of everything, measured by a test) and runs in play mode. Acceptance tests, screenshot, PR.

**Affected packages:** `blocks` (data blocks, custom blocks, locals, code blocks, search), `compiler` (functions, locals, type check, parser), `project` (variable types, rename helpers, dependencies), `runtime` (list and dictionary helpers on `game`), `apps/editor` (block editor, search window, refactoring, code view), `examples/`.

**Risks**

- This is a long phase in the area that is hardest to get right (Blockly itself): custom blocks that change while calls exist, undo across several scripts, and typing in the workspace. Each subtask ends with tests before the next begins; the editor side keeps Blockly's own procedure machinery out of it and uses plain definition and call blocks whose shape is rebuilt from the definition.
- Rename everywhere touches many files; it runs as one document change (one undo step) and is covered by tests on a project with several scripts, scenes and a dialog.
- 80 scripts in one project must stay fast: scripts are compiled lazily per asset and cached by content (the editor already hot-reloads per asset); the load-time test fails above 3 seconds.
- End-to-end tests are slow on Windows CI; new browser tests stay few (custom block round trip, typing, rename everywhere), logic is covered by unit tests.

### Assumptions

- **No new asset type and no file-format break.** Custom block definitions are blocks in a block script's workspace (`custom.define*`), so project files stay plain JSON and old projects load unchanged. A "block library" is an ordinary block script that is marked project-wide in its definitions. Variable `type` gets the two values `list` and `dictionary` and `default` may be any JSON value; both are additive.
- **IDs:** a call block stores `library` (asset ID of the script that holds the definition, empty for the same script) and `fn` (ID of the definition block). The asset ID is a plain 12-character string, so the existing prefab dependency walk finds it.
- **Local variables are identified by name inside one script or function** (as the IR already does); renaming one is local to that script.
- **"Run without screen refresh"** removes the per-pass wait of loops inside the function; waits, dialogs and glides still wait (they are not loops).
- **Code block is trusted code** like the project itself: it runs with the same rights as the game, in the same worker as the scripts; it can break the game but not the editor (play mode is isolated, SPEC section 3 row 4).
- **Dictionaries** have text keys; values are numbers, text, conditions, lists or dictionaries. Lists hold any of these.
- **Type check is advisory:** it reports, it never blocks play (SPEC 7.3: number and text convert automatically, everything else is checked when editing).

### Result

**Implemented**

- **Lists and dictionaries** as variable types (`list`, `dictionary`, JSON values, also in saves) with blocks to create, add, insert, remove, get, set, count, search, join and "for each item", and dictionary key / value blocks. Game variables are **project-wide**: one ID, the same declaration in every script that uses it.
- **Custom blocks** (command, value, condition) with typed parameters, "return", "run without screen refresh" (a slice of 20,000 loop passes per frame instead of one) and **local variables**. Definitions are blocks of a block script (`custom.define*`), visible in that script or project-wide; calls store the defining script and block ID, the compiler links project-wide calls into the callers. No file-format break.
- **Type check** (advisory): problems are diagnostics on the block and in the console; nothing stops play.
- **Typing instead of dragging:** type on the workspace to find a block (German and English, synonyms), Enter inserts it, Tab jumps to the next field; `x/2 + 10` typed into a number slot builds operator blocks.
- **Extract as custom block**, "My Blocks" palette, edit / delete definitions, calls follow their definition.
- **Search window** (Ctrl+Shift+F), "Go to definition", "All usages" and **Rename everywhere** (variables, messages, tags, custom blocks) as one undo step.
- **Code view** (generated JavaScript, read-only, block ↔ line link) and **Code block** (`self`, `game`, `scene`, `three`; syntax errors reported before play; documented in `docs/code-block.md`).
- **Prefabs carry blocks:** the dependency walk finds block scripts, script libraries and custom blocks, so a prefab moved to a new project has no missing block.
- **Example** `examples/07-gross` ("Handelsstadt", generated by `scripts/make-example-07.mjs`): 86 block scripts over environment, players, NPCs, items, UI and scenes, a script library "Werkzeuge" with custom blocks (messages, coins, prices, buying, dice), lists (backpack) and a dictionary (prices).

**Acceptance**

- [x] (a) *`examples/07-gross` has at least 80 block scripts over all areas and loads in under 3 seconds.* `apps/editor/test/example07.test.ts`: 86 scripts, all six areas, compiles with zero diagnostics, project load + compile measured under 3 s, runs for 20 s without script errors; end-to-end: opened from File → Open Example in about 2.5 s (3.5 s on the first, cold run).
- [x] (b) *Renaming a variable changes every use in every script.* Unit test (`refactor.test.ts`) renames "Münzen" across all scripts of the example; end-to-end renames a variable and a message through the editor and undoes it in one step.
- [x] (c) *Typing `wenn taste` + Enter inserts an event block; `x/2 + 10` typed into a number slot builds operator blocks.* End-to-end (`phase7.spec.ts`) and parser tests (`expression.test.ts`).
- [x] (d) *A prefab with a block script and a custom block, moved to a new project, has no missing block.* `carryBlocks.test.ts` and the dependency check of the example's prefab.
- [x] Golden and runtime tests for every new block; compiler tests for functions, locals, warp and the type check; project tests for the rename helpers.
- [x] `pnpm test` (481 tests), `pnpm lint`, `pnpm typecheck`, `pnpm build` green locally; end-to-end 65/65 in the editor project. The two desktop (Electron) tests cannot start in this container (no X server); CI runs them under a virtual display.
- [ ] CI on GitHub green on Ubuntu and Windows for the last commit of the pull request (see the pull request).

**Open / not done**

- No minimap and no colored regions in the block editor: collapse, comments and "Clean up" come from Blockly's defaults (a minimap plugin produced rendering errors and was dropped).
- The type check is advisory; a library function may not use object variables of the script that defines it.
- Code blocks are trimmed to single lines in the code view's block link; Code blocks are never rewritten.
- Phase 6 leftovers stay: no undo in the UI Editor, no gamepad navigation in menus, saves do not hold NPCs, doors and chests.
- Windows-specific problems with names: the browser storage of the test Chromium here refuses umlauts in file names, so the example's file names are ASCII ("Waechter 1"); real browsers and the desktop app accept umlauts.
- The Windows CI runner (software rendering) is the weak spot: after the Phase 7 merge a different 3D-heavy end-to-end test timed out in most runs (phase 1 and 3 in run 56, phase 3b in runs 60 and 62, none in run 61 and in the Phase 6 run). One real bug showed up in it and was fixed (stale blur timer of the quick-insert popup, PR 19); the rest are timeouts of tests whose logic passes on Linux. The Windows job now retries a failing test once (`retries: 1` in `playwright.config.ts`); a test that passes only on the retry is reported as "flaky" in the log. Linux and local runs stay strict.

### Assumptions (added while building)

- Call blocks written by tools carry `name` and `params` of their definition in `extraState`, like the editor writes them; the generator fills them in.

## Phase 6: UI, menus, saving

Branch: `phase/06-oberflaeche` (builds on `main` with Phase 5 merged).

### Plan

**Subtasks** (SPEC 8.12, 8.14, 7.4, 5.11, 1.1 items 8 and 9, 10)

1. **UI asset and layout** (`packages/project`, `packages/runtime/src/ui`): new asset type `ui` (`*.ui.json`) = one UI canvas: reference size, scale mode and a tree of elements. Every element has a rect like Unity's RectTransform (anchor min/max in 0..1, pivot, offset min/max in reference pixels) and a type: `panel`, `text`, `image`, `bar`, `button`, `slider`, `toggle`, `dropdown`, `hint` ("[E] Talk"), `crosshair`, plus the composites `inventory`, `dialog` and `keybindings`. Elements can be **bound** to data (game variable, health, stamina, item count, loading progress) and buttons run **actions** (send message, show / hide a canvas, load scene, resume, restart, save to slot, load from slot). The layout is a pure function (`layoutRect`) with unit tests.
2. **UI renderer** (`packages/runtime/src/ui`): a DOM layer on top of the game canvas, owned by the host (editor Game view, later the exported game), driven by the current `Game`: it draws the canvases of `UI Canvas` components, one set per player in split screen (own HUD per player), handles mouse, number keys and the gamepad for buttons, and the built-in layers for the **interaction hint**, the **dialog box** and the **loading screen** (these move from the editor panel into the runtime, so exported games have them too). Built-in strings come from a translate callback of the host, so the runtime has no UI text of its own.
3. **Settings** (`packages/runtime/src/settings`): graphics level, music / effects / voices volume, mouse sensitivity, key bindings per player and full screen; stored by the host (browser: local storage), applied to quality, audio mixer, input and the window. Menus change them through slider / toggle / dropdown / keybindings elements.
4. **In-game pause:** the Pause action (Esc, P, gamepad Start) toggles a paused game; canvases with "visible: while paused" appear. The editor's own Pause button stays separate.
5. **Menu prefabs** (`packages/project/src/uiTemplates.ts`): main menu, pause menu, settings, victory, defeat, loading screen with progress, and a HUD (life bar, inventory, hint). They are ordinary `ui` assets made from templates, so they can be edited afterwards; the UI editor offers "Add menu from template".
6. **Saving** (`packages/runtime/src/saves`): a variable can be marked "saved" (optional field in the variable format, checkbox in the inspector's variable list); a save slot stores the scene, the saved game variables and, per player, position, rotation, inventory, health and stamina. `SaveStorage` is an interface (browser: local storage per project; the desktop export writes files in Phase 9). Blocks "save game to slot", "load game from slot", "slot [n] is used"; buttons do the same. Loading builds the game of the saved scene like a scene change (loading screen) and puts the players back.
7. **UI editor window** (`apps/editor`, Window → UI Editor): preview of the canvas with the elements as selectable and draggable rectangles, element list, inspector of the selected element (anchor presets, offsets, colors, text, bindings, actions), add / delete / duplicate, "add from template". Edits are saved into the project at once.
8. **Blocks** "show UI [x]", "hide UI [x]", "save game", "load game", "slot used?" with golden and runtime tests.
9. **Example** `examples/05-quest` grows a main menu scene (start scene), a pause menu, settings (graphics level, volumes, mouse sensitivity, key bindings), a life bar, an inventory display and interaction hints; saved variables Quest and Aufgabe. Acceptance tests (unit tests on the real project, end-to-end), screenshot, PR.

**Affected packages:** `project` (ui asset type, `saved` flag, save data, templates), `runtime` (ui, settings, saves, pause), `blocks`, `compiler`, `apps/editor` (UI editor, settings and save storage, Game view), `examples/05-quest`.

**Risks**

- This phase touches everything players see. The DOM layer must work in the editor's Game view (focus, pointer lock, split screen) without breaking the existing keyboard handling; menus release the pointer lock while they are open.
- Phase 5's end-to-end tests start the quest example in the village. With a main menu as the start scene they have to open the village scene first (a test hook), not to click through the menu every time; one test plays through the menu.
- Software rendering makes end-to-end tests slow; the new browser tests stay few (menu → game → pause → settings → save/load in one test) and the layout and save logic are covered by unit tests.
- Key rebinding needs a capture mode that must not trigger game actions while it is active.

### Assumptions

- **UI canvases are assets, not scene objects.** A scene shows them through a `UI Canvas` component (asset, player, sort order, visibility: always / while paused / manual). This keeps scenes small and makes the menu prefabs ordinary assets. Unity's Canvas + RectTransform children map to this (documented in the UI editor's help text).
- **Reference size 1280 × 720**, scale mode "scale with screen" (factor = min of the two ratios); element offsets are in reference pixels, text sizes too.
- **Saved variables:** game-scoped variables only (object variables belong to scenes that are rebuilt). NPCs, doors and chests are not saved (a save restores the quest progress, the player and the inventory, not the whole world state); this is written into the save dialog's tooltip and the docs.
- **Slots:** three slots per project (`slot 1..3`), each with the scene name and a time stamp; the browser keeps them in local storage under `blockwerk.saves.<project name>`. Loading a slot replaces the running game.
- **Pause:** the in-game pause freezes the logic tick but not the UI, the music or the camera blend; Esc also releases the pointer lock in the browser, which is why the game view re-captures on the next click.

### Result

**Implemented**

- **UI canvases as assets** (`*.ui.json`, asset type `ui`): elements with Unity-style rects (anchors, pivot, offsets in reference pixels, 1280 × 720 scaled with the screen), types panel, text, image, bar, button, slider, toggle, dropdown, hint, crosshair, inventory, dialog, keybindings; bindings (variable, health, stamina, item count, loading progress); button actions (message, show / hide canvas, load scene, resume, restart, save, load, quit). A **UI Canvas** component shows an asset (player, sort order, visible always / while paused / manual).
- **UI renderer in the runtime** (DOM layer owned by the host): one HUD per player in split screen, mouse and keyboard handling, key rebinding capture, built-in hint, dialog box, loading screen and notices (moved out of the editor, exported games get them too). Strings come from a callback of the host.
- **Settings:** graphics level, master / music / effects / voices volume, mouse sensitivity, full screen, key bindings per player; stored in the browser, applied to quality, audio buses and input.
- **In-game pause** (Esc, P, gamepad Start; Ctrl/Alt/Meta combinations stay with the editor): freezes the logic tick, shows canvases "while paused".
- **Saving:** variables can be marked "saved"; three slots store scene, saved variables and per player position, rotation, items, health and stamina; blocks and buttons save and load; loading builds the saved scene with the loading screen.
- **Menu templates:** main menu, pause menu, settings, victory, defeat, loading and HUD as ordinary assets (UI Editor: "Add menu from template").
- **UI Editor window** (Window → UI Editor): preview with selectable, draggable elements, element list, inspector with anchor presets, bindings and actions.
- **Blocks:** show UI, hide UI, save game, load game, slot used (golden and runtime tests).
- **Example** `examples/05-quest` now starts in a main menu scene (Play, Settings, Quit, Load 1–3), has a HUD (life bar, stamina, coins, task, inventory, interaction hint), a pause menu, a settings menu, victory and defeat screens; Quest and Aufgabe are saved variables.

**Acceptance**

- [x] (a) *`examples/05-quest` has main menu, pause menu, settings (graphics level, volume, mouse sensitivity, key bindings), life bar, inventory display, interaction hints.* Unit test on the real project (`apps/editor/test/example05.test.ts`) checks that every menu button does its action, the HUD shows life and items, pause shows the pause canvas and the settings change the stored values. End-to-end (`e2e/editor/phase6.spec.ts`): menu → village → pause → settings → save → load.
- [x] (b) *Save / load with three slots restores position, inventory and quest progress.* Unit test saves into slot 1 and 3 at different places, changes everything, loads each slot and compares position, items, health and quest variable; end-to-end repeats it through the buttons.
- [x] (c) *Unity-feel items 8 (menus / settings) and 9 (loading screen instead of a stutter at scene change).* Menus and settings are covered by (a); the loading screen is shown on scene change and when a slot is loaded (end-to-end).
- [x] Layout, settings, saves, renderer (jsdom), split-screen HUD, schema, templates, UI tree and translation tests; golden and runtime tests for the new blocks.
- [x] `pnpm test` (427 tests), `pnpm lint`, `pnpm typecheck` green locally; end-to-end 58/58 (one Phase 1 test failed first because the new pause key swallowed the editor's Ctrl+P; fixed and covered by a unit test).
- [x] CI on GitHub green on Ubuntu and Windows for the last commit of the pull request ([CI run](https://github.com/tmluc-cool/Blockwerk/actions/runs/38731693786)). Earlier runs failed on Windows: the in-game pause key swallowed the editor's Ctrl+P, and a slow frame could remove the loading screen before it was drawn; both are fixed.

**Open / not done**

- The UI Editor has no undo (like the Dialog editor); there is no separate "input actions" window; the key bindings are edited in the settings menu only.
- Menus are driven by mouse (and the browser's Tab focus); there is no gamepad navigation through menus yet.
- The built-in loading screen is always used; the loading template exists as an asset but is not wired to scene changes.
- Saves hold quest variables and player state only: NPCs, doors, chests and object variables are not saved.
- Still not built from Phase 5 (list blocks came in Phase 7): "drop item", "pause / resume" blocks and the event "When scene starts".
- The Windows CI of Phase 5's own pull request was never seen; the Phase 5 end-to-end tests (quest example, loading screen) pass on Windows in the Phase 6 run.

Screenshots: `docs/screenshots/phase-06.png` (pause menu and settings over the village HUD) and `docs/screenshots/phase-06-menu.png` (main menu).

## Phase 5: NPCs and game logic

Branch: `phase/05-gegner` (builds on `main` with Phase 4 merged).

### Plan

**Subtasks** (SPEC 8.8, 8.13, 8.15, Appendix A "(5)" blocks, 10)

1. **Navigation** (`packages/runtime/src/navigation`): the navigation mesh is built with Recast (`recast-navigation`, MIT, WASM) from the static geometry of the scene (colliders of non-dynamic objects, terrain, walkable model meshes). Agent radius, height, climb and slope come from a `navigation` block in the scene's `environment` (optional, old scenes stay byte-identical). Obstacles are objects with a **Nav Obstacle** component (carve the mesh at runtime through a tile cache). A **Navigation window** in the editor (Window → AI → Navigation, Unity: Navigation) edits the parameters, bakes the mesh and shows it in the Scene view (toggle), with automatic re-bake after changes. A **Nav-Agent** component (Unity: NavMeshAgent: speed, acceleration, stopping distance, radius, height, avoidance) moves its object along paths; groups use Detour's crowd so many NPCs do not block each other.
2. **NPC components and states** (`packages/runtime/src/npc`): **Wander**, **Patrol**, **Follow**, **Flee**, **Guard** (view cone and hearing radius), **Attack** (melee and ranged) and **Talkable** — each with inspector fields, docs and blocks. A small **State** model: every NPC object has a current state name (text); each behavior component runs only while the NPC is in its state (field "Active in state", default is the component's own name), and Guard switches the state when it sees or hears its target. Blocks: "When state [x]", "change state to [x]", "(current state)". In play mode the state is drawn above the NPC (toggle in the Game view); the Scene view draws the view cone and patrol path of the selection.
3. **Dialogs** (`packages/project` + `packages/runtime/src/dialog` + editor): new asset type `dialog` (`*.dialog.json`): nodes with speaker, text, answers (each with a target node, optional condition and actions). A **Dialog editor** window (Window → Dialog) edits the nodes as cards with a node picker for the targets and a preview. Runtime dialog runner; the Game view shows a simple dialog overlay (Phase 6 brings the full UI) which is answered with the mouse, the number keys, the up/down keys and the gamepad. Blocks: "start dialog [x]" (waits until it ends) and "When dialog answer [x]".
4. **Items, inventory, health, combat** (`packages/runtime/src/gameplay`): components **Inventory**, **Pickup** (Aufhebbar), **Usable** (Benutzbar), **Door** (needs a key item, slides or turns, collider off when open), **Switch**, **Chest** (contents, key), **Health** (max, damage cooldown, on death: destroy / respawn / message), **Melee Hit**, **Projectile**, **Destructible**, **Checkpoint**. One **Interact** action (E / gamepad X) with an on-screen hint for the nearest usable thing in reach. Blocks from Appendix A: add to / remove from inventory, "have I [x]?", count, open/close door or chest, pick up / drop, damage, heal, health of, "When I am hit / die".
5. **Messages, timers, lists** (`packages/runtime`, `packages/compiler`): "send message [x] to [object | tag | everyone]", "When I receive message [x]", "start timer [x] for ( ) s", "When timer [x] runs out" and the list blocks of Appendix A with "for each [item] in [list]" and "for each object with tag [x]". Messages are queued and delivered at the start of the next logic tick (documented in the tick order and tested).
6. **Several scenes with a loading screen:** "load scene [x] with loading screen", "restart scene", "pause / resume", event "When scene starts". `Game` can replace its world while keeping the game variables, the sound system and the **player state** (objects tagged `Player`: inventory, health, stamina, control settings, character look). The loading screen shows a title, a progress bar and a hint while the next scene's models load, for at least 0.4 s so it never flickers.
7. **Blocks** for all of the above in `packages/blocks`, each with a golden test and a runtime test. Palette categories "NPC and AI", "Items and inventory", "Scenes and messages".
8. **Example** `examples/05-quest` (generated by `scripts/make-example-05.mjs`): a village with a quest giver (dialog), a chest with a key, a gate, a bring-back item and a reward; two zombies (variants of the prefab `Gegner`) patrolling and chasing around obstacles; a cave scene reached through a door with the loading screen. Acceptance tests (unit tests on the real project + end-to-end), screenshot, PR.

**Affected packages:** `runtime` (navigation, npc, dialog, gameplay, scene switch), `blocks`, `compiler` (lists and messages), `project` (dialog asset type, navigation settings), `apps/editor` (Navigation window, Dialog editor, overlays, inspector fields), `examples/`.

**Risks**

- Recast needs the geometry of the scene as triangles. Library models are glTF meshes; for the tests and the example the geometry comes from the colliders and the terrain, and models count when they have a mesh collider or the flag "Navigation static". A bake over a big terrain must stay fast; the grid cell size is derived from the agent radius and capped (about 1 million cells).
- The WASM module must start in Node (unit tests), in the browser (editor) and in Electron; it is loaded like Rapier, once, behind an `initNavigation()` call.
- This is the largest phase so far. Each subtask is its own set of commits; the order above is the build order, and nothing from a later subtask is needed by an earlier one except the messages (4 uses them for switches).
- End-to-end tests on the Windows CI runner are slow (software rendering); new browser tests stay few and short, and the logic is covered by unit tests on the real example project.
- Scene change replaces the world inside one `Game` object; everything that holds on to `game.world` (views, Statistics, the test hooks) has to read it again after a change. A `sceneChanged` callback covers this.

### Assumptions

- **Navigation is not stored in the project.** The mesh is built when play mode starts (and on demand in the editor); it is deterministic, so nothing changes in saved files. The scene only stores the agent parameters (optional `environment.navigation`).
- **State model:** the state is a plain text on the object, not a graph. States are free text; the components bring the usual names (`idle`, `patrol`, `wander`, `chase`, `flee`, `attack`, `talk`). No state set means "all behavior components run".
- **Patrol points** are the children of an object that the Patrol component points to (order = order in the hierarchy), because component fields do not hold lists.
- **Dialog file:** `{ formatVersion, start, nodes: { <id>: { speaker, text, answers: [{ text, next, condition?, actions? }] } } }`. Conditions are `hasItem`, `variable` (compare) and `message`-free; actions are `setVariable`, `addItem`, `removeItem`, `sendMessage`, `startTimer`, `changeState`. Dialog texts are written in one language by the author (they are game content, not editor text).
- **Interaction:** one "Interact" action (key E, gamepad Y; X stays the attack button); the nearest **Usable / Door / Chest / Pickup (manual) / Talkable** within its radius and in front of the player (anything within 1 m always counts) is the target, and its hint is shown at the bottom of the Game view (the editor translates the standard hints, so the runtime stays free of UI text).
- **Inventory** counts items by name (text). Persistent across scenes through the player-state snapshot; saving to disk comes with Phase 6.
- **Combat** is distance-based, no animation events needed: Melee Hit hits everything with a Health component inside a short cone in front of the attacker when its cooldown is over; ranged attacks spawn a Projectile object. The attack animation (if the model has one) is only played, not waited for.
- **Zombies and quest giver** use KayKit characters from the CC0 library (`pnpm assets:fetch`): the quest giver is the library's mage, the player the knight. The library has no zombie, so the two zombies use the skeleton warrior and the skeleton minion (CC0) and keep the name "Zombie".
- **Scene change is done by the host, not inside one `Game`** (this replaces the plan above): a block only *asks* (`game.loadScene`), the editor's play loop sees the request, shows the loading screen, builds a new `Game` for the next scene with the previous game's `CarryState` (game variables, and per player: inventory, health, stamina) and drops the old one. This keeps `Game.world` constant for its whole life, so nothing that holds on to it can go stale. The player appears at the object tagged `Spawn` with the requested name. Everything else about the old scene is lost (a chest opened in the village is closed again when the village is loaded the second time); saving scene state comes with Phase 6.
- **The loading screen** shows the scene's name, a progress bar and one of three tips, and stays 0.45 s after the next scene was built (building blocks the page for a moment, so the bar is only a rough indication).
- **NPCs wait while a dialog is open** (patrol, follow, guard, attack, nav agents and the NPC command queue are paused), so nothing sneaks up on a player who is reading.
- **Dialog editor:** one card per line with plain pickers for the targets (no node graph, no preview); changes are saved into the project immediately, without undo (the Dialog editor has no history yet). Answer IDs are what "When dialog answer [x]" listens for; the editor suggests one when an answer is added.
- **Game variables in dialogs** are referenced by variable ID; the editor lists the game variables of all block scripts in the project.

### Result

**Implemented**

- **Navigation:** Recast mesh from the static colliders of a scene (built lazily when the first agent needs it, or by the Bake button), Navigation window (agent radius, height, climb, slope, show mesh in the Scene view, settings stored in the scene with undo), Nav Agent and Nav Obstacle components.
- **NPC components and states:** Wander, Patrol (points are the children of a route object), Follow, Flee, Guard (view cone, hearing, line of sight), Attack (melee and ranged) and a plain state name per NPC; the state shows above the NPC in play mode; the Scene view draws view cone and path of the selection. Blocks: go to (pathfinding), follow, flee, wander, patrol, stand still, change state, current state, "sees", "hears", "When state".
- **Dialogs:** asset type `dialog`, Dialog editor window, Talkable component, dialog box in the Game view (mouse, number keys, arrow keys and Enter, gamepad), conditions (item, variable) and actions (variable, item, message, timer, NPC state), blocks "start dialog" (waits) and "When dialog answer".
- **Items, inventory, health, combat:** Inventory, Pickup, Usable, Door (slide, lift, swing; key), Switch, Chest, Health (destroy, respawn, event only), Destructible, Checkpoint, Melee Hit (F, gamepad X) and Projectile components; the Interact action (E, gamepad Y) with a hint; blocks give, take, "has", count, open/close/toggle, pick up, damage, heal, health, "When I am used / picked up / opened …" and "When I am hurt / defeated".
- **Messages, timers, loops:** "send message to", "When I receive message", "start timer", "When timer runs out", "for each object" with `loop` as a reference; messages arrive at the start of the next tick.
- **Scenes:** "load scene [x] with loading screen, spawn point [y]" and "restart scene"; loading screen with title, bar and tip; the player's items, health and stamina and the game variables are carried over.
- **Example** `examples/05-quest`: village with plaza, well, six houses, crates and barrels, a fence with a locked gate, Mira the quest giver (dialog), a chest with a key, two zombies (variants "Zombie A" and "Zombie B" of the prefab "Gegner", patrolling routes, view cone, chase around houses and crates, attacks), a crypt scene with the spell book behind the gate, loading screen both ways, HUD with task, life and coins (all made with blocks and components).

**Acceptance**

- [x] (a) *NPC gives a quest through a dialog, the player finds a key in a chest, opens a gate, brings an item back and gets a reward.* Unit test on the real project (`apps/editor/test/example05.test.ts`) plays the whole quest headlessly: accept in the dialog, key from the chest, gate locked and then open (key used up), the crypt entrance zone asks for the crypt, the book is picked up there, back in the village the book goes to Mira, 25 coins arrive, the quest variable is 2. End-to-end test: dialog box with mouse answers, chest by the Interact key.
- [x] (b) *Two zombies (prefab variants of "Gegner") patrol, spot the player with a view cone and chase around obstacles; the state is visible in play mode.* Unit test: both patrol (their positions change, state `patrol`), step into the cone of Zombie A → state `chase`; the player then stands behind a house and the zombie reaches them within 15 s and hurts them. The test also checks that the instances really are variants of the base prefab. The state label shows above the zombies (end-to-end test reads the states, screenshot shows the `chase` label).
- [x] (c) *Scene change village → crypt with a loading screen, player state kept.* End-to-end test: the loading screen with the scene name appears, the game continues in the crypt scene, the key from the chest and the quest variable are still there. Unit test: items, health, stamina and variables arrive and the player stands at the named spawn point.
- [x] Block tests: golden fixtures and runtime cases for every new block (`npc`, `messages`, `items`, `dialog`, `scenes`); the "every block is covered" tests pass.
- [x] Component tests: `navigation`, `npc`, `gameplay` (pickups, doors, chests, health, combat), `dialog` (session, Talkable) in `packages/runtime/test`.
- [x] End-to-end: Navigation window, quest example with dialog and scene change, Dialog editor.
- [x] `pnpm test` (378 tests), `pnpm lint`, `pnpm typecheck` green locally; end-to-end 56/56.
- [x] CI on GitHub: Ubuntu and Windows green in the Phase 6 run ([CI run](https://github.com/tmluc-cool/Blockwerk/actions/runs/38731693786)), which includes the Phase 5 tests.

**Open / not done**

- **List blocks** (variable type "list", "add to list", "for each item in list") are not built; the project's variable format only knows number, text and boolean. "For each object with tag" is done. This is a plan item; it moves to Phase 6, where saving needs list values anyway.
- **"drop item"** block: not built (only "pick up"). **"pause / resume"** blocks and the event "When scene starts": not built ("When game starts" fires again at every scene start and does the same job).
- **Dialog editor:** no preview and no undo. **Control settings and the character look** are not carried over a scene change (each scene brings its own player object); the example's player is the same in both scenes.
- No scene state is kept when a scene is left (a chest opened before is closed again); that is saving, Phase 6.
- The 3D feel of the zombies' walking could not be judged by eye here (software rendering); their movement and states are tested by numbers.

Screenshot: `docs/screenshots/phase-05.png` (Game view with Mira's dialog, the task / life / coin display and a zombie that has noticed the player).

## Phase 4: Environment and graphics

Branch: `phase/04-umgebung` (builds on `main` with Phases 3 and 3b merged).

### Plan

**Subtasks** (SPEC 8.3, 8.9, 8.11, 8.16, 9.1, 10)

1. **Graphics levels and post-processing** (`packages/runtime`): levels Low / Medium / High / Ultra (resolution scale, shadow map size and cascade distance, shadow type, anti-aliasing, post-processing on/off, grass and particle density, draw distance), switchable in play mode without a restart (Game view drop-down, a block, and the project default). **Post-processing** as a component on the camera object (Unity's Volume): tone mapping, bloom, ambient occlusion, anti-aliasing, color grading, vignette, optional depth of field (`postprocessing`, Zlib; `n8ao`, ISC).
2. **Sky, day-night cycle, weather, fog:** the scene's environment settings grow optional fields (time of day, day length, sun azimuth, fog color/density, weather type and intensity, wind). The sun, sky, ambient light, fog and a star dome follow the time of day; moon light at night. Weather: rain, snow, fog, wind, with ground-wetness and sound hooks. A **Lighting window** (Unity: Window → Rendering → Lighting) edits all of this live in the Scene and Game views.
3. **Particle system component** with inspector modules like Unity (emission, shape, lifetime, color over time, size over time, gravity) and the templates dust (landing), sparks, explosion, smoke, fire, magic, rain, snow, collect sparkle. The character controller spawns dust when landing.
4. **Terrain:** component with a height map, up to 4 texture layers painted with brushes (raise, lower, smooth, flatten, paint), stored as a binary asset next to the scene (`*.terrain.bin`, SPEC 9.1); a height-field collider; grass and plants spread by instancing following the painted layer. Scene view brushes and a Terrain inspector.
5. **Water:** component with reflection and waves, a swim option in the character controller (buoyancy, slower movement, swim animation state when the model has one).
6. **Audio** (`packages/runtime`): Audio Source component with 3D sound (volume and direction by distance, Web Audio), listener on the camera, music with cross-fade, separate volumes for music, effects and voices, footsteps through animation events and the character's sound set, ambient sounds per area. New asset type `audio` for imported sounds; built-in synthesized sound effects so every example has sound without third-party files.
7. **Blocks** (Appendix A "(4)" blocks): set time of day, set weather, set graphics level, play sound (at), play music, stop/volume, play/stop particle effect — each with a golden and a runtime test.
8. **Example** `examples/04-landschaft`: hill landscape with lake, forest, village, day-night cycle and rain; measure draw calls (< 500) and frame time; acceptance tests, screenshot, PR.

**Affected packages:** `runtime` (environment, post-processing, particles, terrain, water, audio, quality), `blocks`, `compiler`, `project` (environment fields, terrain and audio asset types, graphics setting), `apps/editor` (Lighting window, terrain brushes, quality switch, audio import), `examples/`.

**Risks**

- 60 FPS cannot be measured in this environment (software rendering at 2–4 FPS). The acceptance measures what can be measured: draw calls, triangles, instance counts, per-frame CPU time of the engine, and the graphics-level switch; real FPS needs a machine with a graphics card (Game view → Statistics).
- Post-processing, terrain, grass and water are the heaviest pieces; each has a cheaper path for Low/Medium, and the levels are tuned by counts (shadow map size, instance counts) rather than by timing.
- No CC0 sound files can be downloaded here (hosts blocked): the built-in sounds are synthesized in code; imported sounds use the same Audio Source.
- Terrain data is binary and must be deterministic: a fixed little-endian layout and no git diffs for unchanged terrain.

### Assumptions

- **Environment data:** new fields are optional in the scene's `environment` so old scenes stay byte-identical. The graphics level default is an optional field in `blockwerk.json`; players switch at runtime.
- **Terrain file:** `.terrain.bin` holds a small header (magic, version, resolution, size, layer count), float heights and 8-bit layer weights; it is a binary asset type like models (stable ID in a meta file).
- **Quality levels** (`packages/runtime/src/rendering/quality.ts`): Low (no post-processing, 1024 shadow map, quarter grass, 0.4 particles), Medium, High (default of the project; AO at half resolution, full grass) and Ultra (4096 shadow map, depth of field, 1.5× grass and particles, full-size water reflection). A software renderer (as in tests) starts on Low; the project's `graphicsLevel` or the player's choice wins.
- **Sky and weather:** the clock is optional (`environment.sky`); without it the sun object's rotation places the sun as before. Weather changes fade over seconds. Rain and snow are drawn by the graphics card from a clock (no per-frame CPU work); the audio engine plays rain and wind loops that follow the weather.
- **Terrain:** the object's origin is the center of a square terrain (default 200 m, 129×129 samples). The file stores float32 heights (not 16-bit, simpler and exact for the collider) and 8-bit layer weights; the file is always written the same way. Brushes edit one shared working copy (live in the Scene and Game view); each stroke is one undo step through a revision counter in the component and in-memory snapshots (40 per terrain, lost when the project closes; the file on disk is always the latest state). Plants other than grass (trees, rocks) are placed with the library brush from Phase 2, which instances equal models automatically.
- **Water:** a plane of the given size at the object's height; the quality level picks sky-color only (Low), a half-resolution planar reflection (Medium, High) or a full one (Ultra). Characters swim when the water is deeper than 1.1 m at their feet (float with the head out, 0.55× speed, jump swims up); there is no dedicated swim animation, the walk/idle clips are used.
- **Audio:** Web Audio with a panner per 3D sound (linear fade from "full volume up to" to "silent from", equal-power panning for direction). No CC0 sound files can be downloaded here, so the 15 effects and 6 loops (footsteps per ground, jump, land, hurt, win, coin, click, hit, whoosh, explosion, splash, wind, rain, stream, night, two music pieces) are synthesized in code from fixed seeds. Imported sounds (WAV, OGG, MP3) become the project's `audio` assets. Ambient sounds per area are Audio Sources on objects of that area (loop, 2D or 3D). Footsteps come from animation events named `step` when the animator has such markers and from stride length otherwise; the sound set of the Character component (`footstep=…;jump=…`, per ground `footstep:stone=…`, `none` for silence) overrides the built-in ones.
- **Examples with binary files:** `examples/*/…/*.bin` (and `.glb`, `.png`, `.wav`, `.ogg`, `.mp3`) are bundled as data URLs and written as bytes into the new project. German folder names with umlauts are avoided (the browser's file storage in this environment dropped them), so the terrain folder is `Landschaften`.
- **`examples/04-landschaft`** is generated by `scripts/make-example-04.mjs` (run `npx tsx scripts/make-example-04.mjs`): fixed seeds, so the same files come out every time. The library models (KayKit medieval pack, CC0) need `pnpm assets:fetch`.

### Result

**Implemented**

- **Graphics levels and post-processing:** four levels, switchable while playing (Game view, Lighting window, block, project default), a Post-Processing component on the camera (tone mapping, bloom, ambient occlusion, color grading, vignette, depth of field).
- **Sky, day-night, weather, fog:** sun, moon, stars and fog follow the clock; rain, snow, fog and wind; Lighting window (Window → Lighting) with undo; blocks set time, time speed, weather, wind, fog density, sun brightness, lamps on/off and color, graphics level; "time of day" reporter.
- **Particles:** Particle System component with inspector modules (emission, shape, lifetime and speed, size and color over life, forces) and nine templates; the character controller raises dust on a hard landing; blocks create effect, start and stop particle system.
- **Terrain:** component, `.terrain.bin` asset type (project package), height-field collider, four paint layers, instanced grass that follows the grass layer and the graphics level, brushes (raise, lower, smooth, flatten, paint) and "generate hills" in the inspector, Object → 3D object → Terrain.
- **Water:** component with waves, sun glints, planar reflection by graphics level, fog and transparency; swimming in the character controller.
- **Audio:** Audio Source and Audio Listener components, `AudioEngine` with three mixer channels, music cross-fade, weather loops, character sound sets (footsteps by ground, jump, land, splash); asset type `audio` with import and preview; sound blocks (play sound here/everywhere, play music, fade music, stop all, set volume); Game view mute button.
- **Example** `examples/04-landschaft`: 200 m of hills with a lake (swimmable, reflective), about 300 trees and 30 rocks (instanced library models), a village with ten buildings, well, windmill, barrels and four lanterns that turn on at night, a camp fire (fire and smoke particles, warm light), grass, a day cycle (8 o'clock, one day in three minutes), rain after 45 seconds, music, stream sound at the lake, F = hit (sparks, sound, camera shake), E = explosion.

**Acceptance**

- [x] `examples/04-landschaft` runs in play mode (hill landscape with lake, forest, village, day-night cycle and rain). Unit test on the real project (`apps/editor/test/example04.test.ts`): the knight stands on the hills, floats in the lake, the clock moves 1.33 h in 10 s, lamps turn on at 21:00 and off at 10:00, rain starts after 45 s, music and the 3D stream play, footsteps follow the ground, F and E give sparks, sound and shake.
- [ ] 60 FPS on "High": **not measurable here** (software rendering at 0.5–2 FPS). Measured instead in the end-to-end test: **about 120 draw calls** (limit 500, checked at every level in the end-to-end test) and under 1 M triangles on "High"; the logic tick costs about 3 ms (3300 ticks including physics, scripts and 380 objects in 10 s in Node); the grass is capped at 90 000 clumps with distance fade. A real graphics card is needed to confirm 60 FPS (Game view → Statistics).
- [x] Unity-feel checklist 4 (real shadows, soft light, sky, fog, bloom, ambient occlusion): sun shadows with a level-dependent map, baked sky light, sky shader, fog, Post-Processing component on the example's camera (screenshot).
- [x] Checklist 6 (sound: footsteps, jumps, hits; quieter with distance, from the right direction): footsteps, jump, landing and splash from the sound set, hit and explosion sounds on keys F and E; 3D sounds use a linear distance model with a panner (unit tests read panner position, distance model and listener from a recording context). The sound itself cannot be heard here.
- [x] Checklist 7 (feedback: dust on landing, particles on hits, short camera shake): `landing dust` test in `character.test.ts`; key F in the example gives sparks and `shake camera`.
- [x] Graphics level switches while playing without a restart: end-to-end test runs Low → Ultra → Medium → High in one play session (frames keep coming, start time unchanged, draw calls stay under 500); unit test on the example.
- [x] Terrain brush, lighting window, audio source: end-to-end tests (brush strokes and undo, time of day/weather/quality with undo, built-in sound choice).
- [x] `pnpm test` (332 tests), `pnpm lint`, `pnpm typecheck` green locally; end-to-end 53/53.
- [ ] CI on GitHub: see pull request.

Not demonstrable here: 60 FPS, the sound itself (no speakers), the look on a real graphics card (shadow softness, bloom strength) and the desktop installer.

Screenshot: `docs/screenshots/phase-04.png` (Scene view while the game runs: lake with reflection, forest, village).

## Phase 3b: Character Studio

Branch: `phase/03b-figuren-studio` (builds on Phase 3; PR #6 is not merged yet).

### Plan

**Subtasks** (SPEC 5.10, 8.7)

1. **Standard skeleton and retargeting** (`packages/character`): the VRM 1.0 humanoid bone names are the internal standard (15 required bones, optional spine/chest/neck, fingers, toes). Automatic bone mapping of a loaded skeleton by name patterns (Mixamo-style, KayKit Rig_Medium, Blender `.L/.R`, VRM) and by hierarchy; mapping stored with the model and editable. Retargeting of animation clips from one humanoid skeleton onto another (rotation retargeting in rest-pose space, hip translation scaled by leg length).
2. **Model import:** GLB/glTF and VRM (the humanoid bones and the license note are read from the file, see Assumptions), FBX and OBJ through the existing converter; models without a skeleton become rigid figures with automatic bobbing, leaning and squash.
3. **Character component** (single definition, also shown in the Inspector): model, bone map, body height, colors per part, attachments, movement profile, abilities, collision capsule, sound set, portrait. Every character is a Prefab; "Player 2: like Player 1 with other colors" is a Prefab Variant.
4. **Character Studio window** (first tab in the Player 1, Player 2 and NPC areas): turntable preview with studio light, meter grid, comparison figure, collision capsule with handles, jump arc; animation list with preview, speed, fade, loop, slow motion and an event timeline; movement sliders and the five movement profiles; ability cards (double jump, sprint with stamina, roll, crouch, swim, climb, glide, wall jump, dive, pick up/carry, interact); camera preview with draggable distance, height and shoulder offset; portrait rendering saved as an image asset; "Play in Test Area".
5. **Builder:** parts from modular CC0 characters with a shared skeleton, color palettes and a random button, body sliders through bone scaling; attachment points (right/left hand, back, head, hip, custom) with library items that follow the animation.
6. **Abilities as components** with their blocks (double jump, roll, stamina, climb, glide …) and golden/runtime tests; blocks from SPEC Appendix A "Character" (attach item, switch part, set color, switch movement profile, enable ability, has ability, stamina, "when I roll/glide/climb/swim").
7. **Example and acceptance:** `examples/03b-figur` and tests (below), screenshot, PR.

**Affected packages:** `character` (new), `runtime` (character component, retargeting, abilities, rigid-figure motion), `blocks`, `compiler`, `project` (character settings, portrait asset), `library` (modular character pack source), `apps/editor` (Studio window, import).

**Risks**

- Retargeting quality depends on rest poses; automatic tests compare bone directions and foot sliding against the source clip with tolerances, the visual result needs a look on a machine with a graphics card.
- The modular CC0 characters (Quaternius) are on a host that is blocked in this cloud environment; the builder is developed against the KayKit characters here and gets the Quaternius source description for machines with normal internet access. A CC0 VRM test model has to be found on a reachable host (GitHub).
- VRM license metadata and spring bones: spring bones are not simulated in this phase (assumption).
- The Studio is a large UI: it is built as panels over the character component so that each panel stays small and testable.

### Assumptions

- **Standard skeleton:** the VRM 1.0 humanoid names (55 bones, 15 required) are the internal skeleton. Models are mapped by name (Mixamo, VRoid, Blender rigify, KayKit, plain names) and by hierarchy; corrections are stored in the model's import settings (`boneMap`) or on the Character component. Decision confirmed by the user: **retargeting at runtime** and a **Character component on the prefab**.
- **Retargeting:** world-space rotation change of the source bone applied to the rest pose of the target bone (A-pose and T-pose are aligned), hips movement scaled by the hip height, and the bone scale of the clip transferred relative to the rest scale (KayKit keeps its bones scaled in the rest pose and lets every clip set the real scale). The body height is measured in the standing (idle) pose for the same reason.
- **VRM without a dependency:** `@pixiv/three-vrm` is not needed for what Blockwerk uses of a VRM file (humanoid bones, license, facing direction), so `packages/character/src/vrm.ts` reads those from the GLB directly (VRM 0.x and 1.0). The file stays an ordinary GLB; expressions and spring bones are not simulated. VRM 0.x avatars face backwards and get a yaw of 180° in their import settings (new optional import settings `yaw`, `boneMap`, `animationMap`).
- **Images:** the portrait needs an image in the project, so there is a new binary asset type `image` (PNG, with a meta file and stable ID like models). Old projects are unaffected; the format version stays 1. `Assets/Bilder/` (`Images`) is the default folder.
- **Loose gear:** meshes without skin on a skinned model (swords, shields, helmet, cape of the KayKit characters) are hidden until they are listed in the new Character field `shownGear`; the builder and the blocks switch them. Body parts are shown unless listed in `hiddenParts`.
- **Builder:** the modular Quaternius characters are on a host that is blocked in this cloud environment, so the builder works with what a model offers: its parts (shown/hidden), colors per part with palettes and a random button, body sliders (build, head size, arm and leg length through bone scaling, 0.6 to 1.8×), and library items on the attachment points. The Quaternius source description follows when the library is built on a machine with normal internet access.
- **Abilities:** double jump, roll, glide and stamina are components that publish their settings; the control reads them every tick. Swimming, climbing, wall jump, dive roll, carrying and interacting are shown as cards but come with the water (Phase 4) and the NPC/item mechanics (Phase 5).
- **Sound sets:** the Character component has a field `sounds` (event=sound) and the Studio a section for it; the sounds play once the audio system exists (Phase 4).
- **Animation events:** the Animator has the field `markers` (`state@seconds=name`); a marker passed by the clip raises "when animation [name] started".
- **Studio:** the window is a dockable panel "Figur" (first tab next to Scene, Game and Block Editor). It edits the figure with ordinary scene edits (undo works), and shows a preview game with only the Character component and the Animator. Collision capsule, jump arc and comparison figure are drawn on the turntable; the capsule is edited with sliders (no mouse handles).
- **Player 2:** "Like Player 1, other colors" makes the figure a prefab (if it is none), creates a prefab variant of it with the next color palette and steering for player 2, puts it into the Player 2 area and creates a camera for it (player 1's camera then shows player 1 only).
- **Test model for the automatic tests:** a small rigged humanoid generated in the tests themselves (`packages/character/test/avatars.ts`, CC0): GLB with and without skeleton, VRM 1.0 and ASCII FBX. No third-party model is shipped.

### Result

**Implemented**

- **`packages/character`:** standard skeleton, bone mapping by name and hierarchy, retargeting (rotation, hips, scale), VRM reader; 17 tests.
- **Runtime:** Character component (model, body height, build/head/arm/leg sliders, hidden/shown parts, colors, attachments, movement profile, library animation source, bone map, sound set), rigid figures that bob, lean and squash, movement profiles (Arcade, Realistic, Agile, Heavy, Floating), jump arc simulation (matches the real jump within 10 %), ability components Double Jump, Roll, Glide and Stamina, Animator events.
- **Blocks (Appendix A "Character"):** attach item, put away, switch part, set part color, switch movement profile, enable/disable ability, has ability, set stamina, stamina, "when I roll/glide/double jump". Golden and runtime tests for each.
- **Editor:** VRM, GLB, glTF, FBX and OBJ import with humanoid bone assignment in the import settings; the Character Studio (model, builder, colors, equipment, movement, collision, sounds, portrait, animation list with timeline, camera preview, ability cards, Play in Test Area, Player 2, save to My Characters); image assets.
- **Example** `examples/03b-figur`.

**Acceptance**

- [x] A VRM avatar and a rigged FBX model are uploaded and walk, run and jump with the library animations; the only manual work is confirming the bone assignment (end-to-end test with generated CC0 test models; the VRM uses bone names no recognition understands, so only the VRM humanoid makes it work).
- [x] A model without a skeleton is a rigid figure (end-to-end test; unit test for bobbing, leaning and squash).
- [x] Builder: show parts, color palette, sword into the right hand; the sword follows the animation (end-to-end test measures the hand position while running).
- [x] Profile Arcade → Heavy: the numbers and the arc change (1.80 m → 0.60 m), the knight walks at 1.4 m/s in the Test Area, and the real jump of the running game is 0.54 to 0.66 m (end-to-end test steps the paused game tick by tick).
- [x] Ability cards Double Jump and Roll dragged onto the figure work in the Test Area without a single block (end-to-end test counts the ability events).
- [x] Portrait becomes an image asset; "Like Player 1, other colors" creates a prefab variant for player 2 (end-to-end test).
- [x] `pnpm test` (265 tests), `pnpm lint`, `pnpm typecheck` and `pnpm build` green locally; end-to-end 49/49.
- [ ] CI on GitHub: see pull request.

Not demonstrable here: the look of the retargeted animations on other characters than the KayKit knight (needs a look with a graphics card), the modular Quaternius characters (host blocked), 60 FPS.

Screenshot: `docs/screenshots/phase-03b.png`.

## Phase 3: Player, physics, animation

Branch: `phase/03-spieler` (builds on Phase 2, which is merged).

### Plan

**Subtasks**

1. **Physics** (`packages/runtime`, SPEC 8.4) with Rapier3D (`@dimforge/rapier3d-compat`, Apache-2.0)
   - **Rigidbody** component (dynamic, kinematic; mass, damping, gravity on/off, lock rotation). Colliders (Box, Sphere, Capsule, new: Cylinder, Convex Hull, Mesh) with friction and bounciness, "Is Trigger".
   - Objects without a Rigidbody are fixed obstacles (like Unity's static colliders); objects moved by script are carried along.
   - Physics layer matrix in the project settings, gravity per scene. Physics runs only in Play Mode, at a fixed 60 Hz step at the point defined in SPEC 8.1.
   - Touch events from Phase 1 stay unchanged; new "When [object | tag] enters / leaves zone" for triggers.
2. **Player characters** (SPEC 8.5): **Character Controller** component (Rapier's kinematic controller: ramps up to a limit angle, sliding off, climbing stairs, sticking to the ground, sliding along walls, pushing dynamic objects). Control components **Third Person**, **First Person**, **Top Down** and **Vehicle** with acceleration/braking, turning in the walking direction, sprinting, crouching, jumping with jump buffer and coyote time, air control, landing detection. Default values chosen so that the Unity-feel checklist is met without adjustment.
3. **Input** (SPEC 8.10): input actions `Move`, `Look`, `Jump`, `Sprint`, `Crouch`, `Interact`, `Attack`, `Pause` with bindings per player (player 1: WASD + mouse or gamepad 1; player 2: arrow keys + numpad or gamepad 2). Gamepads via the Gamepad API, mouse cursor captured in the game, `Esc` releases it.
4. **Camera** (SPEC 8.6): camera behaviors **Third-person orbit** (mouse and right stick, distance, height, smoothing, wall collision, zoom via mouse wheel, field of view while sprinting), **First person**, **Top down**, **Side view**, **fixed camera**, **camera fly-through** (waypoints), camera shake, smooth transitions. **Player 2:** split screen (horizontal/vertical) or shared camera.
5. **Animation** (SPEC 8.7): **Animator (simplified)** component for models with a skeleton: automatic mapping of clip names to standard states (Idle, Walk, Run, Jump, Fall, Land, Crouch, Attack, Hit, Die, Wave …), smooth blending, playback speed matched to movement speed. Mapping of deviating names in the import Inspector.
6. **Blocks** from Appendix A marked "(3)": actions and zones, player, camera, animation, physics. Every block with a golden test and a runtime test.
7. **Editor:** new components in the Inspector (from the definitions), physics settings (layer matrix, gravity), Game view with mouse capture, gamepads and split screen, **Test Area** (SPEC 5.6) with "Play in Test Area".
8. **Example** `examples/03-held` (knight from the library using components only, walls, stairs, ramps, crates, moving platform) and acceptance with tests and screenshot.

**Affected packages:** `runtime` (physics, controller, camera, Animator, input), `blocks`, `compiler`, `project` (physics settings, gravity), `apps/editor`, `examples/`.

**Risks**

- Rapier as WASM: starting Play Mode must stay under 1 second (load once and reuse).
- Game feel can only be partly checked automatically: tests measure acceleration curves, turning speed, jump height, camera distance at walls and blend times; the rest via screenshot and report.
- There are no gamepads in the test environment: the tests supply a simulated gamepad through the Gamepad API.
- KayKit characters have no "Fall" and "Crouch" animations; "Fall" uses the jump hover animation, "Crouch" falls back to Idle when there is no clip.
- Retargeting to the standard skeleton (VRM bone names) belongs to the Character Studio (Phase 3b); in Phase 3 characters play their own animations.

### Assumptions

- **Physics:** Rapier (`@dimforge/rapier3d-compat`, Apache-2.0) is loaded once when the editor starts. It runs only in Play Mode, in the fixed 60 Hz tick at the place from SPEC 8.1. Bodies are built from the components each tick: a Rigidbody owns a body, colliders of children without their own Rigidbody join it. Objects with colliders but no Rigidbody are fixed; as soon as scripts move one, it becomes a kinematic body that pushes and carries.
- **Layers:** the physics layer matrix is stored as the optional list `ignoredCollisions` in `Einstellungen/tags-und-ebenen.json` (missing means everything collides, so existing projects stay byte-identical). The gravity of a scene is stored in the scene (`environment.gravity`). Both are edited in "Edit → Physics Settings …". There are at most 16 layers.
- **Character Controller:** Rapier's kinematic character controller with the Unity defaults (slope limit 45°, step offset 0.35 m, skin width 0.08 m). The skin width must be 0.08: with a smaller one Rapier's autostep fails on 0.25 m steps. The capsule floats one skin width above the feet; an overlap with fixed colliders (spawned inside something) is resolved by a push-out before every move.
- **Moving platforms:** a character rides a platform with the platform's own measured movement (Rapier's velocity of a position-driven kinematic body is zero in every second tick), added after the collision test.
- **Controls:** one movement engine for third person, first person, top down and vehicle controls. Movement is relative to the camera of the player; turning uses a critically damped angle smoothing. The standard values meet the feel checklist without tuning (walk 2.2 m/s, sprint 5.5 m/s, jump 1.2 m, 0.15 s jump buffer and coyote time).
- **Input actions:** the key bindings are fixed in code for now (player 1: WASD, Space, Shift, C, E, F, mouse; player 2: arrow keys and number pad); the settings window with rebinding comes in Phase 6. Gamepads use the Gamepad API (standard mapping). With one gamepad and a second player in the scene, player 2 gets it. The mouse turns the view while the pointer is captured (click in the Game view, `Esc` releases it); the wheel zooms the third-person camera.
- **Cameras:** behaviors are separate components next to the Camera component (third person, first person, top down, side view, fixed, camera path, shared). Switching cameras makes the picture glide over the blend time of the new camera. Split screen needs two cameras set to player 1 and player 2; the picking of objects by mouse in the Game view uses the first camera.
- **Object references in fields:** new field type "object" (Hierarchy drag or list). References to objects inside a prefab are not remapped between instances yet.
- **Animator:** clip names are matched to the standard states by patterns (KayKit and common naming); import settings can override them. Controls drive the animator; the walk/run blend follows the speed, so feet do not slide. Figures play their own animations (retargeting is part of Phase 3b). "Fall" uses the jump-idle clip; "Crouch" falls back to idle when a model has no clip for it.
- **Blocks:** "when animation [name] started/finished" reacts to animations started with "play animation" (GLB clips carry no events). "what is ahead" returns the name of the object (empty if nothing). All blocks act on the object itself.
- **Test Area:** built-in scene, never part of a project: ground with a 1 m tile grid, four staircases (0.15, 0.25, 0.35 and 0.5 m steps), ramps (15°, 30°, 45°, 60°), jump gaps (1 to 4 m), a moving platform, a pyramid of crates, corridors (1.0 and 0.5 m), a dummy and targets. Water basin and ladder come with the water (Phase 4) and the climbing mechanics; the ground labels are left out. The chosen player is put in with all components and block scripts.
- **Example `03-held`:** the knight from the library with only components (no block scripts). It uses primitives for walls, stairs and ramp and library props for crates and barrels.

### Result

**Implemented**

- **Physics** (`packages/runtime`): Rigidbody (dynamic, kinematic, mass, damping, gravity on/off, freeze rotation), Box, Sphere, Capsule, Cylinder and Mesh (convex) Collider with friction and bounciness, triggers with zone events, layer matrix, scene gravity, impulses, raycasts, body type at runtime.
- **Player:** Character Controller and the controls Third Person, First Person, Top Down and Vehicle with smooth acceleration, turning, sprint, crouch (only with room above), jump with buffer and coyote time, air control, landing detection; pushing crates and riding platforms.
- **Input:** actions Move, Look, Jump, Sprint, Crouch, Interact, Attack, Pause per player for keyboard, mouse and gamepad.
- **Camera:** third-person orbit (mouse and right stick, lag, wheel zoom, wall avoidance, wider view while sprinting), first person, top down, side view, fixed, camera path, shared camera, shake, field-of-view changes, smooth transitions between cameras, split screen (horizontal or vertical).
- **Animator:** standard states with automatic clip matching, cross-fades, idle/walk/run blend with matched playback speed, jump, fall, land, crouch, one-shot clips and animation events.
- **Blocks (Appendix A, phase 3):** when action, when zone enters/leaves, when animation started/finished, player (set walk/run/jump values, jump, crouch, stand up, lock/unlock controls, teleport, on the ground?, running?, speed), camera (switch view, switch to camera object, distance, shake, camera path, field of view), play animation, physics (push, set velocity, gravity, body type, what is ahead, distance ahead). Every block has a golden and a runtime test.
- **Editor:** Physics Settings window (gravity and layer matrix), pointer capture, mouse wheel, gamepad polling, split-screen rendering, object field, "Play in Test Area" (Window menu and Hierarchy context menu).
- **Example** `examples/03-held` and the **Test Area**.

**Acceptance**

- [x] `examples/03-held`: animated figure from the library, only components (no own blocks): walks, runs, jumps, lands with smooth transitions, the camera moves in front of the wall behind the start. Checked by unit tests on the real example project (speed curves, states idle → walk → run, jump → fall, camera against the wall) and by an end-to-end test with the real knight model in the editor. Items 1, 2, 3 and 5 of the feel checklist are covered by these measurements; the look of the motion should still be judged on a machine with a graphics card.
- [x] Test Area: stairs up to the step offset (and not the 0.5 m one), ramps up to the slope limit (15°, 30°, 45° climbed, 60° not), jump gaps depending on speed, moving platform (rides along), pushing crates, corridors (1.0 m passes, 0.5 m does not). Unit test `apps/editor/test/testArea.test.ts`; "Play in Test Area" is checked end to end.
- [x] Player 2 with a gamepad in split screen, each with their own camera: end-to-end test with a simulated gamepad (Gamepad API); the unit tests cover player 2 bindings and the single-gamepad rule.
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green locally; CI on GitHub: see pull request.

Not demonstrable here: real controller hardware, 60 FPS (software rendering, see Phase 2).

Tests and screenshot: see the numbers in the pull request. Screenshot: `docs/screenshots/phase-03.png`.

## Phase 2: Project window, Asset Library, Prefabs

Branch: `phase/02-bibliothek` (builds on Phase 1).

### Plan

**Subtasks**

1. **Build the Asset Library** (`packages/library`, SPEC 6.1, 6.2, Appendix C)
   - Source descriptions in `packages/library/sources/*.json` (URL, license, author, categories and tags by file name, name translations, collider suggestion, animation names).
   - `pnpm assets:fetch`: downloads the packs (Git or ZIP), checks the license (CC0 only), optimizes each model with `@gltf-transform` (duplicates, welding, Meshopt compression), normalizes scale and pivot (bottom center), renders preview images (Playwright + three.js) and writes `library/index.json` and `library/LICENSES.md`. Models that were already processed are skipped (cache).
   - Starter pack: KayKit packs (CC0, official on GitHub): Medieval Hexagon, Dungeon, City, Furniture, Restaurant, Halloween, Room Base, Prototype, Adventurer and Skeleton characters (about 900 models in total). Kenney, Quaternius and Poly Haven also get source descriptions.
2. **Runtime:** load models (GLTF with Meshopt), model field in the Model Renderer (library or project model instead of a primitive), **automatic instancing** of identical models (`InstancedMesh`), collider suggestion from the model dimensions.
3. **Project format** (extension, see proposal below): binary files, asset types "Model" and "Prefab", prefab instances with overrides, variants, nested prefabs.
4. **Editor**
   - Asset Library: grid with preview images, categories, fuzzy search (de/en), filters (animated, polygon count), favorites, recently used, rotatable 3D preview, "Import into Project".
   - Dragging into the Scene with snapping to the surface under the mouse pointer; **brush** to scatter many objects with random rotation and size.
   - Project window: import models (drag in a file or via menu; GLB/glTF directly, FBX/OBJ are converted to GLB), import Inspector (scale with a 1.8 m reference figure, pivot, generate collider, license), preview images, size slider, type filter.
   - Prefabs like Unity: dragging an object from the Hierarchy into the Project window creates a Prefab; instances are blue in the Hierarchy; Prefab Mode via double-click; overridden values bold with a border marker, "Apply"/"Revert" per value and for everything; variants; nested prefabs; "My Prefabs" (across projects, with dependencies).
5. **Example** `examples/02-dorf` (houses, well, fences, 200 trees) and acceptance with tests, frame rate measurement and screenshot.

**Format extension proposal** (for confirmation; implementation only after the library)

```
Assets/Modelle/haus.glb               imported model (binary) + haus.glb.meta.json
                                      meta.importSettings: { scale, pivot, generateCollider }, meta.license
Assets/Prefabs/laterne.prefab.json    { formatVersion, root, objects: { ID → object as in scenes },
                                        base?: prefab ID of the base (variant), overrides: [...] }
Scene, prefab instance:               object gets  prefab: { asset: prefab ID, object: ID in the prefab }
                                      and on the instance root object  overrides: [ { object, path, value } ]
Model Renderer:                       field  model: "library:<ID>" or project asset ID (instead of a primitive)
```

- Instances are stored in full in the scene (readable, the runtime needs no prefab logic). On loading and after every prefab change they are regenerated from the prefab, and the overrides are kept. Position, rotation and name of the instance root object always count as overridden (like in Unity).
- Variants store only their differences from the base (same override list). Nested prefabs are prefab instances inside a prefab.
- Library models are referenced only by stable ID and are not copied into the project; "Import into Project" copies the GLB to `Assets/Modelle/`.

**Affected packages:** `library` (newly filled), `runtime`, `project`, `apps/editor`, `apps/desktop` (ship the library, binary files), `examples/`, `.github/workflows` (fetch and cache the library in CI).

**Risks**

- Network: in this cloud environment kenney.nl, quaternius.com, itch.io and polyhaven.com are blocked, GitHub is reachable. The starter pack therefore comes from the KayKit packs on GitHub here; the other sources work on machines with normal internet access and in CI.
- Texture compression: `sharp` (the default path of `@gltf-transform`) brings libvips under LGPL and is not allowed. KayKit uses a small color palette as a texture, so textures stay PNG; Meshopt shrinks the geometry.
- Frame rate: CI renders without a graphics card (SwiftShader). 60 FPS is measured via draw calls (instancing) and frame time; measurements from software rendering are only a rough guide.
- Size: the library (about 100 MB) is not in the repository (`library/` is in `.gitignore`), CI downloads and caches it.

### Assumptions

- **Project format as proposed** (no objections): models as `Assets/Modelle/*.glb` with import settings (scale, pivot, generate collider) and license in the meta file; prefabs as `Assets/Prefabs/*.prefab.json`. Prefab instances are stored in full in the scene (readable, the runtime needs no prefab logic); every object of an instance carries `prefab: { asset, object }`, the root object additionally carries the list of overrides. Name, position and rotation of the instance root always belong to the instance (like in Unity).
- **Overrides** are created automatically on every change to an instance (Inspector, gizmo, undo) and are shown in bold with a blue border marker; right-clicking the value or the "Overrides" list in the prefab bar applies or reverts. Added objects and components are kept on sync. Deleted prefab parts of an instance come back on the next sync (Unity requires "Unpack" for this, which exists in the context menu).
- **Variants** store only their differences from the base (plus their own new objects). If an instance is dragged out into a new prefab, the instance is unpacked in the process.
- **Library scale:** the KayKit packs have different toy scales. Each pack gets a factor in its source description so that a character is about 1.8 m tall and doors, furniture and trees match (e.g. Medieval ×4, City ×5, characters ×0.55, Halloween ×0.6). The factor goes into the cache key.
- **Starter pack from KayKit:** in this cloud environment kenney.nl, quaternius.com, itch.io and polyhaven.com are blocked. The starter pack therefore consists of 10 KayKit packs from GitHub (903 models, all CC0). Source descriptions for Kenney, Quaternius and Poly Haven follow as soon as these sites are reachable.
- **Textures stay PNG:** the default texture compression of `@gltf-transform` needs `sharp` (libvips, LGPL) and is not allowed. KayKit uses a small color palette texture, Meshopt shrinks the geometry.
- **Shipping the library:** `library/` is not in the repository. The browser editor and the preview server serve it under `library/`; the desktop app reads it from the repository folder (development) or from its resources (installer, Phase 9).
- **"My Prefabs"** are stored per user in the browser database (IndexedDB, in the desktop app in the user profile), with all dependencies (models, block scripts, nested prefabs, base of variants) and identical asset IDs. When taking them into a project, existing assets (same ID) are not created twice.
- **"create [Prefab] at [Object]"** is a stack block (the new object starts "When I am created"). The return value "→ returns object" comes with object variables in a later phase.
- **Brush:** scatters the selected library model or prefab onto surfaces with minimum distance, random rotation and size; one brush stroke is one undo step; `Esc` ends the brush.
- **A model replaces the primitive:** if a model is set in the Model Renderer, the shape and material fields are hidden; the model keeps its own materials. If the model is missing, the primitive appears as a placeholder.
- **Hidden views do not draw:** Scene or Game behind another tab are not rendered (in Play Mode this saves half of the work).

### Result

**Implemented**

- **Asset Library** (`packages/library`): source descriptions with a pinned version (Git commit), license check, optimization with `@gltf-transform` (duplicates, welding, pivot bottom center, scale, Meshopt), preview images, `library/index.json` and `library/LICENSES.md`, cache for unchanged models. 903 CC0 models from 10 KayKit packs.
- **Runtime:** load models (GLB with Meshopt) with import settings, model field in the Model Renderer, **automatic instancing** of identical models (`InstancedMesh`, visibility and movement are tracked, selection by mouse click is preserved), create prefabs at runtime.
- **Project format:** binary files in all file systems (memory, Node, browser, desktop), model and prefab assets, overrides, variants, nested prefabs, dependencies, taking over assets with the same ID.
- **Editor:** "Asset Library" window (fuzzy search de/en, categories, animated/polygon filters, favorites, recently used, size slider, rotatable 3D preview, details with license and author, "Place in Scene", "Import into Project", "My Prefabs"), dragging into the Scene with preview and snapping to the surface, brush. Model field with search and drop. Project window: import models (GLB, glTF, FBX and OBJ are converted to GLB), import Inspector with size and 1.8 m comparison, create a Prefab by dragging from the Hierarchy, drag prefabs and models into the Scene or Hierarchy, Prefab Variants. Prefab instances blue, prefab bar in the Inspector (Open, Select, apply/revert overrides, Unpack), Prefab Mode with a "Back to Scene" bar. The Game view stats show frames per second.
- **Example** `examples/02-dorf`: village square with a well, 10 houses, a fence ring with a gate, a path, 200 trees, the Prefab "Laterne" (street lamp with light) and the variant "Rote Laterne", one lamp with an overridden brightness, a camera fly-through around the village (block script).

**Acceptance**

- [x] Starter pack with at least 300 models, all CC0, each with a preview image and a license entry: 903 models from 10 packs (unit test checks index, license, preview image and file of every entry; `library/LICENSES.md`).
- [ ] `examples/02-dorf`: village with houses, well, fences and 200 trees built in under 15 minutes from the library alone, 60 FPS in Play Mode. Construction met: the E2E test builds a village with 8 houses, a well, fences and 200 trees through the UI (library, dragging in, brush) in 0.3 minutes and plays it; `examples/02-dorf` is the expanded village. **60 FPS cannot be demonstrated here** because the environment renders without a graphics card (see measurement); please check on a machine with a graphics card.
- [x] Prefab "Laterne" changed: all instances pick it up, an overridden value stays; variant "Rote Laterne" inherits changes of the base (unit tests in `packages/project` and E2E test in the editor with Prefab Mode, saving and reloading).
- [ ] `pnpm test`, `pnpm lint`, `pnpm build` green locally; CI on GitHub: see pull request (the first run builds the library, afterwards it comes from the cache).

Measurement in the "Dorf" example (Game view, software renderer without a graphics card): 35 draw calls for 289 objects, 123,120 triangles, about 10–15 ms of work per frame, 2 frames/s. For comparison, the simple example from Phase 1 reaches only 4 frames/s here; the frame rate in this environment is limited by software rendering.

Tests: 177 unit/golden/runtime tests (Vitest), 41 end-to-end tests (39 browser, 2 desktop app). Screenshot: `docs/screenshots/phase-02.png`.

**Open / notes for later**

- **Confirm 60 FPS on a real graphics card:** open the "Dorf" example, Play, switch on "Stats" in the Game window (shows frames/s, frame time, draw calls).
- Kenney, Quaternius and Poly Haven (textures, HDRI sky), animals, vehicles and effects are missing from the starter pack until the sites are reachable (Appendix C).
- Animated characters from the library are only played with the Animator (Phase 3); skeleton models are not instanced yet.
- Materials as separate assets, textures and sounds in the Project window follow in later phases; preview images for project models in the Project window as well.
- "My Prefabs" does not show preview images yet.

## Phase 1: Objects, components, block scripts, Play Mode

Branch: `phase/01-objekte` (builds on Phase 0, PR #1 is not merged yet).

### Plan

**Subtasks**

1. **Project format** (`packages/project`, SPEC 9.1)
   - File system interface with three implementations: in memory (tests), Node.js (Electron, tests, examples), browser (Origin Private File System, projects stay stored in the browser).
   - zod schemas, format version, migrations with backup copy, deterministic writing (sorted keys, 2 spaces, LF). Only files whose content has changed are saved.
   - Meta files with a stable ID per asset, references only via IDs. Renaming and moving assets takes the meta file along.
2. **Runtime** (`packages/runtime`)
   - `defineComponent` as the single source for components (fields, types, default values, texts). Components in Phase 1: Transform, Model Renderer (primitives), Material, Box/Sphere/Capsule Collider (overlap test without physics, Rapier follows in Phase 3), Camera, Light, Block Script.
   - Build the world from scene data; scheduler with a fixed 60 Hz logic rate, order according to SPEC 8.1, generator threads according to Appendix B, interpolation for rendering.
   - Services for scripts: input (keys, mouse), time, waiting, stopwatch, random, touches, create/destroy, variables (object and game), variable displays on screen.
   - Errors in scripts stop only the thread and end up in the Console with the block ID.
3. **Blocks and compiler**: all blocks from Appendix A marked "(1)" (events, motion, looks, control, sensing, operators, variables). Scratch-style type conversion, object, tag and key selection lists from the scene. Every block kind with a golden test and a runtime test.
4. **Editor**
   - Open project, save (`Ctrl+S`), auto-save; open example project; new project from template.
   - Hierarchy: parent-child, drag and drop, rename (`F2`), duplicate (`Ctrl+D`), delete (`Del`), empty object (`Ctrl+Shift+N`). Area tabs are root objects and filter the Hierarchy.
   - Scene: gizmos for Move, Rotate, Scale, Combined with snapping (`Ctrl`), multi-selection (`Ctrl`/`Shift`), primitives in the "Object" menu.
   - Inspector: header (Active, Name, Tag, Layer, Static), Transform, components from `defineComponent`, "Add Component" with search, context menu (Reset, Copy, Paste, Remove, move up/down), multi-editing with "—".
   - Block Script as an asset in the Project window and as a component; variable list in the Block Editor with "show in Inspector"; double-click opens the Block Editor.
   - Undo/Redo for all changes to the scene.
   - Play Mode: start in under 1 second, reset on stop, "Keep this value", Pause, Step, slow motion (0.25×, 0.5×), hot reload of the blocks, editor tint.
   - Console: clicking an entry jumps to the block or object.
5. **Example** `examples/01-hindernis` and acceptance with tests and screenshot.

**Project format proposal** (details for SPEC 9.1, for confirmation before implementation)

```
mein-spiel/
  blockwerk.json                         { formatVersion, name, startScene (asset ID), settings }
  Assets/
    Szenen/hindernis.scene.json          objects as map ID → object (name, parent ID, order,
                                         active, tag, layer, static, transform, component list)
    Szenen/hindernis.scene.json.meta.json { formatVersion, id, type, importSettings, license }
    Block-Skripte/steuerung.blocks.json  { formatVersion, variables[], workspace (Blockly JSON) }
    Block-Skripte/steuerung.blocks.json.meta.json
  Einstellungen/tags-und-ebenen.json      tags and layers
  .blockwerk/                            backup copies, cache (in .gitignore)
```

- Objects are stored as a map with sorted IDs in the file, the order among siblings as a number `order`. This way a change produces diffs only on the affected object.
- Area tabs are root objects with a field `area` (kind of area).
- Meta files are named like the file plus `.meta.json` (like Unity's `.meta`).
- IDs: 12 characters, lowercase letters and digits, random.

**Affected packages:** `project` (newly filled), `runtime`, `blocks`, `compiler`, `apps/editor`, `apps/desktop` (file access via IPC), `examples/`.

**Risks**

- Scope: Phase 1 is the largest phase so far. Order: runtime and compiler first (testable without a UI), then the project format, then the editor.
- Isolation of Play Mode: script errors are caught per thread. Infinite loops without yielding a frame cannot occur in Phase 1 (loops always yield the frame); the safeguard for this comes with dedicated blocks "without screen refresh" (Phase 7/8).
- Touches without a physics engine: simple overlap tests of the colliders. Rapier replaces this in Phase 3, the blocks stay the same.
- Browser storage (OPFS) is per browser profile; export/import as a folder follows with the desktop app or Phase 9.

### Assumptions

- **Project format as proposed** (no objections). The folders under `Assets/` are named like the UI in new projects (German "Szenen", "Block-Skripte"; English "Scenes", "Block Scripts"); `Einstellungen/` and `.blockwerk/` are fixed names as in SPEC 9.1. New projects get a `.gitignore` with `.blockwerk/`.
- **Storage location:** in the browser, projects live in the browser's private file system (OPFS); in the desktop app as real folders under `Documents/Blockwerk` (or in a freely chosen folder via "Open Project → Choose Another Folder"). The desktop app allows file access only in project folders that were created or chosen.
- **Auto-save** two seconds after every change and when leaving the page, never while playing. Can be switched off under "File → Auto Save".
- **Touches without physics:** colliders are checked for overlap (box, sphere, capsule). Objects still pass through obstacles; Rapier comes in Phase 3, the blocks stay the same.
- **Blocks with a Phase 2 connection:** "create [Prefab | Asset] at [ ] → returns object" exists in Phase 1 as "create copy of [Object]" (Unity: Instantiate of a scene object); the prefab variant with a return value follows with prefabs in Phase 2. "set color / material" sets the color in Phase 1 (material assets follow). "activate / deactivate" acts on objects; components follow.
- **"destroy [me | object]"** is a stack block; if it destroys the own object, the script ends immediately (like "delete this clone" in Scratch).
- **Facing direction:** 0° looks toward +Z, 90° toward +X, exactly like the Y rotation in the Inspector. Because of the confirmed coordinate system (+X is left), the value decreases when turning right.
- **Mouse x/y** in pixels from the center of the Game view, up and right positive (like Scratch).
- **Block ID renamed:** the test block `motion.moveForward` from Phase 0 is now called `motion.move` with a direction selection. There was no release yet, so without migration.
- **Variables** in Phase 1: types number, text, boolean; scope "for this object" (can be shown in the Inspector, value per object in the Block Script component) or "for the whole game". Scene and local variables come with Phase 5/7 (local variables already exist in the compiler), "is saved" with Phase 6.
- **Play Mode:** Scene and Game views both show the running game world; Hierarchy and Inspector show the game objects live (including copies). Changes in the Inspector or with gizmos affect only the game; "Keep this value" sits next to every changed value, "Keep all changes of this object" as a button above the Inspector (instead of only via right-click).
- **Start time of Play Mode** is measured from the click to the first fully drawn game frame and printed to the Console. For this, the game world takes over the precomputed sky light of the editor world; the sky light map is 64 px (sufficient for diffuse light, saves a lot of time).
- **Glowing running scripts:** scripts that ran in the last quarter second glow (otherwise short scripts like "When key held" would never be visible).
- **Snapping with `Ctrl`** in Unity default steps: 0.25 m, 15°, scale 0.1.
- **New objects** appear at the pivot of the Scene camera in the active area (Unity: at the Scene pivot). Primitives get a fitting collider, as in Unity.
- **Combined tool** shows move and rotate handles together; the Rect tool behaves like Move until the UI phase.
- **Built-in tags** as in Unity: `Untagged`, `MainCamera`, `Player`; layer `Default`. Custom tags and layers via the selection list in the Inspector.
- **Unknown components** (e.g. from a newer version) are preserved unchanged on saving.
- **Example projects** are opened in the editor via "File → Open Example Project" as a copy; the files in `examples/` stay untouched. Prettier does not format project files in `examples/` (the editor writes them deterministically itself).

### Result

**Implemented**

- **Runtime:** components via `defineComponent` (Model Renderer with primitives and Material, Box/Sphere/Capsule Collider, Camera, Light, Block Script); world from scene data with incremental sync; game with fixed 60 Hz logic, generator threads, interpolation, events (start, every frame, keys, click, touch, created, destroyed), copies, variables and displays. Script errors stop only the affected thread and report the block ID.
- **Blocks:** all blocks from Appendix A marked "(1)" (events, motion, looks, control, sensing, operators, variables), selection lists with objects and tags of the scene (stable IDs), color field, variable fields. Scratch-style type conversion at slots. Every block with a golden test and a runtime test.
- **Project format:** `packages/project` with file system interface (memory, Node, browser, desktop via IPC), meta files with stable IDs, deterministic writing of changed files only, safe renaming (also of only upper/lower case), messages about damaged, copied or newer files, migrations with backup copy.
- **Editor:** project new/open/example, save (`Ctrl+S`), auto-save, Undo/Redo (`Ctrl+Z`/`Ctrl+Y`). Hierarchy with areas as root objects, drag and drop (keeps the world position), rename (`F2`), duplicate (`Ctrl+D`), delete (`Del`), context menu, search, multi-selection (`Ctrl`/`Shift`). Scene with gizmos (Move, Rotate, Scale, Combined; Pivot/Center, Local/Global; snapping with `Ctrl`), camera and light icons, selection outline. Inspector from the component definitions with multi-editing ("—"), dragging on field labels, context menu (Reset, copy/paste values, Remove, move up/down), "Add Component" with search and categories, tags and layers. Project window with folder tree, create, rename, delete, move by dragging, double-click opens. Block Editor with script selection, header (script and object), variable list on the right (type, scope, start value, "show in Inspector").
- **Play Mode:** Play/Pause/Step (`Ctrl+P`, `Ctrl+Shift+P`, `Ctrl+Alt+P`), slow motion 0.5× and 0.25×, editor tint, Game view receives the keyboard, variable displays, hot reload of the blocks, glowing scripts, "Keep this value", reset on stop. Console with jump to block and object.
- **Desktop:** projects as real folders, access only to approved project folders.
- **Example** `examples/01-hindernis`: obstacle course made of primitives, a controlled cube (Block Script "Steuerung" with Inspector field "Tempo"), a second cube with the same script and a different speed, three spheres with the tag `Einsammelbar` (script "Einsammeln"), score display.

**Acceptance**

- [x] `examples/01-hindernis`: a cube with a Block Script is controlled with WASD, collects three spheres (tag `Einsammelbar`), points appear; the speed is an Inspector field (unit test without UI and E2E test in the editor with real key presses).
- [x] The same Block Script on a second cube with a different speed works independently (speed 2 instead of 4: half the distance, checked in both tests).
- [x] Play Mode starts in under 1 second (measured from the click to the first game frame, about 30–160 ms in the software renderer of the tests), stopping resets, a kept value stays (E2E).
- [x] Save, close, load: identical; saving again changes no file (zero Git diffs; checked on the example on disk, in the browser by reloading and in the desktop app by restarting). Renaming an asset breaks no reference (unit and E2E test).
- [x] `pnpm test`, `pnpm lint`, `pnpm build` green; CI on GitHub green on Windows and Linux ([CI run](https://github.com/tmluc-cool/Blockwerk/actions/runs/38411453659)).

Measurement in the example project (Game view, software renderer): 27 draw calls, 14,160 triangles, frame time 3.5 ms.

Tests: 135 unit/golden/runtime tests (Vitest), 33 end-to-end tests (31 browser, 2 desktop app). Screenshot: `docs/screenshots/phase-01.png`.

**Open / notes for later**

- Physics (Rapier) comes in Phase 3; until then there is no gravity and there are no solid obstacles.
- Identical models share their geometry but are not yet instanced automatically (comes with the library models in Phase 2).
- Dragging objects from the Hierarchy onto block slots, or references by dragging into Inspector fields (SPEC 5.7, 5.9), typing to search blocks (7.8), "Play from here" (5.5), snapping to vertices (`V`) and the layers menu are not implemented yet.
- Browser projects stay in the respective browser profile; import/export as a folder or `.blockwerk` file follows.

## Phase 0: Foundation and Unity layout

### Plan

**Subtasks**

1. **Monorepo scaffold**
   - pnpm workspace with `packages/*` and `apps/*`, Node LTS (`.nvmrc`), TypeScript strict (`tsconfig.base.json`).
   - ESLint (flat config, `typescript-eslint`, `no-explicit-any` as an error, import ban for Blockly/`apps` in `packages/runtime`, no text literals in JSX), Prettier (LF, 2 spaces), `.gitattributes` with LF.
   - Vitest with one project per package, Playwright for browser and Electron.
   - Scripts: `pnpm dev`, `pnpm dev:desktop`, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm build`.
   - Packages according to `CLAUDE.md`: `blocks`, `compiler`, `runtime` with content; `project`, `library`, `character` as empty scaffolds for later phases.
2. **Editor shell** (`apps/editor`, React + Vite + Zustand + `dockview`)
   - Menu bar (File, Edit, Assets, Object, Component, Window, Help), toolbar (Hand/Move/Rotate/Scale/Rect/Combined with `Q`–`Y`, Pivot/Center, Local/Global, Play/Pause/Step, Layers, Layout).
   - Area tabs (All, Environment, Player 1, Player 2, NPCs, Items, UI, +) with `Alt+1` … `Alt+9`.
   - Dockable windows: Hierarchy, Scene, Game, Block Editor, Inspector, Project, Asset Library, Console. Move, group as tabs, detach as floating and detach into a separate window.
   - Layouts: automatic saving of the current layout, templates "Default" and "Blocks large", save, load and delete custom layouts. `Ctrl+1` … `Ctrl+5` focuses windows.
   - i18n German/English via JSON files, switching in the menu, test for complete keys in both languages. Dark theme as default, light selectable.
3. **Scene view** (`packages/runtime` + `apps/editor`)
   - Runtime: renderer (WebGL2, ACES tone mapping, sRGB), environment from a computed sky with sun position, ambient light from the sky, sun with soft shadows, textured ground, fog in the distance.
   - Default scene in the editor: Main Camera, sun, ground, test cube. The Hierarchy shows them, selection by click in the Hierarchy or Scene, the Inspector shows name and Transform (read-only, editing comes in Phase 1).
   - Unity camera controls: right mouse button + WASD fly, Q/E down/up, Shift faster, mouse wheel while flying changes speed; Alt + left mouse button orbit; middle mouse button or Hand tool pan; mouse wheel zoom; `F` and double-click in the Hierarchy focus (smoothly animated).
   - Axis cube at the top right: click on an axis → view from that side, click on the label → perspective/orthographic.
   - Editor grid (infinite, fades out), selection outline. Game view renders from the Main Camera with stats (frame time, draw calls, triangles).
4. **Blocks**
   - `defineBlock` in `packages/blocks` as the single source, from it Blockly JSON, toolbox per area (matching categories first) and search keywords.
   - Test blocks: "When game starts" (hat) and "move ( ) meters forward" (stack, example from SPEC 7.10).
   - Minimal compiler (block JSON → intermediate representation → JavaScript generator functions according to Appendix B). The intermediate representation already contains functions with return values and local variables.
   - Golden test and runtime test for every new block kind.
   - Blockly in the Block Editor with language switching (Blockly texts and own block texts), header with script and object.
5. **Electron shell** (`apps/desktop`): main process, preload with context isolation, detached windows allowed, `pnpm dev:desktop` starts Vite and Electron.
6. **GitHub foundation**: `README.md` scaffold, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `CHANGELOG.md`, `THIRD_PARTY.md` (with license check as a script), issue templates (bug, idea, new block, new asset pack), PR template with checklist, `ci.yml` (lint, type check, tests, build, Playwright with screenshots as an artifact, Windows and Linux).
7. **Acceptance**: check all criteria, screenshot to `docs/screenshots/phase-00.png`, enter the result here, pull request.

**Affected packages:** all (new creation). Content in `blocks`, `compiler`, `runtime`, `apps/editor`, `apps/desktop`.

**Risks**

- WebGL in headless Chromium and Electron without a GPU (CI, containers): start Playwright with SwiftShader. Performance there is not meaningful, function only.
- Detached windows (popout) with a WebGL canvas and Blockly: both hang on the document of the main window. Must be checked in the browser and in Electron.
- Electron on Linux CI needs `xvfb` and `--no-sandbox` (AppArmor on Ubuntu runners).
- Saved layouts with detached windows must not force popups on startup (popup blocker).
- Version jumps of the dependencies since the state of the model's knowledge: check APIs of `dockview`, `blockly`, `three`, `vitest` against the installed types when integrating.

### Assumptions

- **Branch:** Phase 0 is developed on the branch `claude/new-session-k687n4` instead of `phase/00-fundament`. The cloud session may only push to this branch. The user left the choice open.
- **Example project Phase 0:** the project format only comes in Phase 1, and there is no Play Mode in Phase 0 yet. The default scene of the editor (sky, sun, ground, test cube) serves as the "example scene". `examples/` gets real projects from Phase 1 on.
- **Default scene without a project file:** the objects of the default scene live only in memory in Phase 0. Their names come from the i18n files. From Phase 1 on, object names are project data.
- **Layouts** are user settings and not part of the project (like in Unity). They are stored in the editor's `localStorage` (in Electron in the user folder) and survive restarts.
- **AI button** in the toolbar stays invisible as long as no API key is stored (SPEC 9.4: "Without a key none of this is visible").
- **Play, Pause, Step** are visible but disabled in Phase 0. Play Mode comes in Phase 1.
- **Coordinate system (confirmed by the user):** Y up, 1 unit = 1 meter, "forward" is local +Z (like SPEC 7.10 and glTF), "right" is local −X.
- **Electron menu:** the menu bar is part of the editor UI (identical in browser and desktop). The native Electron menu is hidden.
- **Icons:** own, neutral symbols from `lucide-react` (ISC), no Unity or Scratch graphics.

- **Repository documents in English:** all repository documents (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `PROGRESS.md`, issue and pull request templates) are in English, like code and commits. Only `SPEC.md` and `CLAUDE.md` are German. The editor and the engine stay bilingual (German and English).
- **Licenses MIT-0 and 0BSD** count as variants of MIT and BSD respectively and are allowed. `lru-cache` (BlueOak-1.0.0) enters the project only via Blockly → jsdom (Node.js) and is not in the editor bundle; this is justified in `THIRD_PARTY.md` as an exception.
- **Software rendering:** the Electron app falls back to SwiftShader when the GPU is missing or blocked, so that the 3D views always run (local content only, therefore harmless).
- **Playwright 1.56** instead of the latest version, because the cloud environment has exactly this Chromium preinstalled. CI installs the same version.
- **ESLint 10 without `eslint-plugin-react`:** the rule "no fixed texts in JSX" is a small custom rule (`blockwerk/no-ui-literals`) in `eslint.config.js`.

### Result

**Implemented**

- Monorepo with `packages/blocks`, `compiler`, `runtime` (with content) and `project`, `library`, `character` (scaffolds), `apps/editor`, `apps/desktop`. TypeScript strict, ESLint (including import boundaries for `runtime`, `blocks`, `compiler`), Prettier, Vitest, Playwright, license check.
- Editor in the Unity default layout: menu bar, toolbar (Q W E R T Y, Pivot/Center, Local/Global, Play/Pause/Step disabled, Layers, Layout), area tabs with `Alt+1…9` and custom tabs, dockable windows Hierarchy, Scene, Game, Block Editor, Inspector, Project, Asset Library, Console.
- Move windows, group as tabs, detach as floating, detach into a separate window (browser and Electron). Layout is saved automatically; templates "Default" and "Blocks large"; save, load, delete custom layouts; reopen windows via "Window"; `Ctrl+1…5` focuses windows.
- Scene view: computed sky with clouds, sun with soft shadows, ambient light from the sky, textured ground, fog, editor grid, camera and sun gizmo, selection by click. Camera like Unity: right mouse button + WASD/QE fly (Shift faster, mouse wheel = speed), Alt + left orbit, Alt + right zoom, middle mouse button or Hand tool pan, mouse wheel zoom, `F` and double-click focus. Axis cube with axis views and Perspective/Orthographic.
- Game view from the Main Camera with aspect ratio and stats (frame time, draw calls, triangles). Example scene: 4 draw calls, 38 triangles.
- `defineBlock` as the single source; from it Blockly JSON, palette per area, search index. Test blocks "When game starts" and "move ( ) meters forward". Compiler block JSON → intermediate representation (with functions, return values, local variables) → generator functions with line-to-block mapping. Golden and runtime tests that enforce every catalog block kind.
- Block Editor with Blockly (Zelos rendering, hat blocks), Blockly media local instead of from the CDN. Blockly runs in a separate page (`blocks.html`) in the window, so that dragging, palette and number fields also work in a floating or detached window (second screen).
- German/English fully via i18n files (menus, windows, blocks, Blockly), dark and light theme.
- Electron shell: editor via `blockwerk://` with a Content Security Policy without network, detached windows as editor windows, `pnpm dev:desktop`.
- GitHub foundation: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SECURITY.md`, `CHANGELOG.md`, `THIRD_PARTY.md` (generated and checked), issue templates (bug, idea, new block, asset pack), PR template, `ci.yml` for Windows and Linux.

**Acceptance**

- [x] `pnpm dev` and `pnpm dev:desktop` open the editor. `pnpm test` (59 tests), `pnpm lint`, `pnpm build` green.
- [x] Repository is on GitHub (public), CI runs green there on Windows and Linux ([CI run](https://github.com/tmluc-cool/Blockwerk/actions/runs/38379593872)).
- [x] Windows can be moved, grouped as tabs and detached; layout is kept after a restart (E2E in the browser by reloading and in Electron by a real restart of the app).
- [x] Scene camera is operated like in Unity: fly, orbit, pan, zoom, focus (E2E tests).
- [x] The empty scene looks decent: sky, light, soft shadow of a test cube (`docs/screenshots/phase-00.png`).

Tests: 59 unit/golden tests (Vitest), 24 end-to-end tests (23 browser, 1 desktop app with restart). A guard in the E2E tests fails as soon as the editor makes a network request outside `localhost`.

**Open / notes for later**

- Play Mode, project format, real objects and Inspector editing come in Phase 1. Until then Play/Pause/Step and many menu items are visible but disabled.
- GitHub Discussions is not enabled in the repository yet (link in the issue templates), labels (`good first issue`, `block`, …) and the protection of `main` must be set up in the repository settings.
- The GitHub Actions versions (`@v4`) still run with a Node 20 notice; raise to the current major versions at the next CI rework.
