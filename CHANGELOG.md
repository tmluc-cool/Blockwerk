# Changelog

All notable changes are listed here. From the first release on, this file is generated from the
[Conventional Commits](https://www.conventionalcommits.org/) of each release.

## Unreleased

### Phase 9: Build and export

- **File → Build Settings** (Ctrl+Shift+B): scene list with the start scene, platform, name, window
  mode, graphics level, icon and start image; **Build** and **Build and Run**.
- **Web build** as a folder and a ZIP (itch.io), also from the browser version of the editor.
- **Windows app** (`<Name>.exe`): starts in fullscreen, offline, without the editor, with a loading
  screen and a settings menu; built by the Windows version of Blockwerk.
- Only the assets a game uses are exported; scripts are compiled, so the game carries neither
  Blockly nor the compiler. `CREDITS.txt` lists every third-party asset and the engine parts with
  their licenses.
- `pnpm export <project> --out <folder>` for the command line, `pnpm dist` for the installer and
  the portable exe of Blockwerk, `release.yml` publishes a GitHub Release for every tag `v*`.

### Phase 8: Debugging

- Scene check before every start: empty fields, broken references, empty condition slots, messages
  without a receiver, NPCs outside the navigation mesh, players without a camera, models without a
  collider; each shown in the console in plain language (German and English) with a link.
- Runtime problems explained: an NPC without a path, a figure without a walk animation, missing
  scripts and prefabs.
- "Write to log" block (info, warning, error).
- Loop guard: an endless loop "without screen refresh" is stopped with an error; the editor keeps
  responding.
- Breakpoints (click, F9, optional condition), "Next block" (F10), "Continue"; the stopped block is
  highlighted. Debug hooks exist only in the editor's play mode.
- Play-mode Inspector shows running scripts and lets you change game and object variables live.
- Profiler window: frame time by scripts, physics, rendering and UI; draw calls; triangles.
- `examples/08-kaputt`: a scene with deliberate mistakes for trying all of this.

### Phase 7: Large projects

- Lists and dictionaries as variable types and values (also in saves), with blocks to create, add,
  insert, remove, read, set, count, search and loop over them; game variables are shared by ID
  across all scripts of a project.
- Custom blocks (command, value and condition) with typed parameters, "return", and "without screen
  refresh"; visible in one script or project-wide (a script library); local variables; a "My Blocks"
  palette category; calls follow their definition.
- Advisory type check ("expects a number, got text") shown on the block and in the console.
- Typing instead of dragging: type on the workspace to find a block, Enter inserts it, Tab jumps to
  the next field; an expression such as `x/2 + 10` in a number slot builds operator blocks.
- "Extract as custom block" for selected blocks; collapse, comments and clean-up from Blockly.
- Search window (Ctrl+Shift+F) across block scripts, scenes, dialogs and UI canvases; "Go to
  definition", "All usages" and "Rename everywhere" for variables, messages, tags and custom blocks
  as one undo step.
- Code view (generated JavaScript, read-only, block and line linked) and a Code block with a
  documented API (`self`, `game`, `scene`, `three`); syntax errors are reported before play.
- Prefabs carry their block scripts, script libraries and custom blocks into other projects.
- `examples/07-gross` ("Handelsstadt"): 86 block scripts over all areas, a script library with
  custom blocks, lists and dictionaries; opens in under 3 seconds.

### Phase 6: UI, menus, saving

- UI canvases as a new asset type (`*.ui.json`): elements with anchors and offsets like Unity's
  RectTransform (panel, text, image, bar, button, slider, toggle, drop-down, hint, crosshair,
  inventory, dialog box, key bindings), data bindings (variable, health, stamina, item count) and
  button actions; the UI Canvas component shows a canvas in a scene, per player in split screen.
- UI Editor window: element list, preview with dragging, properties, anchor presets, button
  actions and menus from templates (main menu, pause menu, settings, victory, defeat, loading
  screen, HUD).
- The UI layer in the runtime: the interaction hint, the dialog box and the loading screen moved
  from the editor into it, so exported games have them too; in-game pause with Esc, P or the
  gamepad's Start button.
- Settings (graphics level, four volumes, mouse sensitivity, full screen, key bindings per player)
  that the game applies and the browser keeps.
- Save slots (three per project): scene, variables marked "saved", and per player position,
  inventory, health and stamina; blocks "show UI", "hide UI", "save game", "load game" and "slot is
  used?"; variables get a "saved" flag.
- `examples/05-quest` now starts in a main menu and has a pause menu, settings, a life bar, an
  inventory display, interaction hints, a victory screen and the three save slots.

### Phase 5: NPCs and game logic

- Navigation: a mesh built with Recast from the static colliders of the scene, a Navigation window
  (agent size, bake, display in the Scene view) and the Nav Agent and Nav Obstacle components.
- NPC components Wander, Patrol, Follow, Flee, Guard (view cone and hearing) and Attack, driven by
  a plain state name per NPC (shown above the NPC in play mode); blocks for walking, states and
  "sees / hears".
- Dialogs: new asset type `dialog`, a Dialog editor window (lines as cards, answers with conditions
  and actions), the Talkable component, a dialog box in the Game view (mouse, number keys, arrows,
  gamepad) and the blocks "start dialog" and "when dialog answer".
- Items and combat: Inventory, Pickup, Usable, Door, Switch, Chest, Health, Destructible,
  Checkpoint, Melee Hit and Projectile components, the Interact action (E, gamepad Y) with a hint,
  and the item blocks (give, take, "has", count, open/close, pick up, damage, heal, health).
- Messages, timers and "for each object" blocks.
- Scene change with a loading screen: the blocks "load scene" and "restart scene" keep the game
  variables and the player's items, health and stamina and put the player at a spawn point.
- Example project `examples/05-quest`.

### Phase 4: environment and graphics

- Graphics levels Low, Medium, High and Ultra (resolution, shadows, anti-aliasing, post-processing,
  grass and particle density, water reflection), switchable while the game runs (Game view, block,
  project default). Post-processing component on the camera: tone mapping, bloom, ambient occlusion,
  color grading, vignette, depth of field.
- Sky with a day-night cycle (sun, moon, stars), weather (rain, snow, fog, wind), a Lighting window
  and blocks for time, weather, wind, fog, sun, lamps and graphics level.
- Particle system component with Unity-like modules and the templates dust, sparks, explosion, smoke,
  fire, magic, rain, snow and sparkle; dust when a character lands; blocks for effects.
- Terrain with a height map, four paint layers, instanced grass and a height-field collider, stored as
  `*.terrain.bin`; Scene view brushes (raise, lower, smooth, flatten, paint) with undo.
- Water with waves, reflections and sun glints; characters swim in it.
- Audio: Audio Source and Audio Listener with 3D sound, music with cross-fades, mixer channels for
  music, effects and voices, footsteps by ground, jump, landing and splash sounds, built-in
  synthesized sounds and sound import (WAV, OGG, MP3); sound blocks.
- Example project `examples/04-landschaft`.

### Phase 3b: Character Studio

- Character Studio window: turntable with jump arc, collision capsule and comparison figure; model
  choice and upload; builder (parts, body sliders), colors with palettes and a random button;
  equipment on attachment points; movement profiles and sliders; ability cards; animation list with
  event timeline; camera preview; portraits saved as images; Player 2 as a prefab variant with other
  colors; "Play in Test Area".
- Standard skeleton (VRM bone names), automatic bone assignment and runtime retargeting: every
  library animation works on any humanoid model; models without a skeleton become rigid figures that
  bob, lean and squash.
- VRM, GLB, glTF, FBX and OBJ import with humanoid bone assignment and license in the import settings.
- Abilities Double Jump, Roll, Glide and Stamina as components, with blocks for character, equipment
  and abilities.
- Example project `examples/03b-figur`.

### Phase 3: player, physics, animation

- Physics with Rapier: Rigidbody, Box/Sphere/Capsule/Cylinder/Mesh Collider, triggers and zone events,
  layer matrix and scene gravity (Edit → Physics Settings), impulses, raycasts.
- Character Controller (slopes, steps, ground snap, pushing, moving platforms) and the controls
  Third Person, First Person, Top Down and Vehicle with jump buffer, coyote time, crouch and sprint.
- Input actions per player for keyboard, mouse and gamepad; player 2 and split screen.
- Camera behaviors: third-person orbit with wall avoidance, first person, top down, side view, fixed,
  camera path and shared camera; shake, field-of-view changes and smooth camera transitions.
- Animator with automatic clip matching to standard states and smooth locomotion blending.
- Blocks for actions, zones, player, camera, animation and physics.
- Test Area ("Play in Test Area") and example project `examples/03-held`.

### Phase 2: project window, asset library, prefabs

- Asset library built by `pnpm assets:fetch` from pinned CC0 sources: license check, optimized
  GLB (meshopt, pivot at the bottom center, normalized scale), previews, index and license list.
  Start pack: 903 KayKit models.
- Asset Library window with fuzzy search in German and English, categories, filters, favorites,
  recently used, rotatable 3D preview, drag into the scene onto surfaces, brush for spreading many
  models, "Import into Project" and "My Prefabs" shared by all projects.
- Models in the Mesh Renderer (library or imported GLB, glTF, FBX, OBJ) with import settings, and
  automatic instancing of equal models.
- Prefabs like Unity: create by dragging into the project window, blue instances, prefab mode,
  overrides with apply and revert, variants, nested prefabs, unpack; block "create [prefab] at".
- Example project `examples/02-dorf` and frames per second in the Game view statistics.

### Phase 1: objects, components, block scripts, play mode

- Projects on disk (desktop) or in browser storage: deterministic JSON, meta files with stable IDs,
  saving only changed files, migrations with backups, autosave, undo and redo.
- Hierarchy with area roots, drag and drop, rename, duplicate and delete; scene gizmos for move,
  rotate, scale and combined with snapping; inspector generated from component definitions with
  multi-editing, add component, copy and paste values.
- Components: Mesh Renderer with primitive shapes and material, Box/Sphere/Capsule Collider,
  Camera, Light, Block Script with inspector variables.
- Block catalog of phase 1 (events, motion, looks, control, sensing, operators, variables) with
  golden and runtime tests; variables panel in the block editor.
- Play mode with pause, step, slow motion, hot reload, glowing scripts, keep value, editor tint
  and console links to blocks.
- Example project `examples/01-hindernis`.

### Phase 0: foundation and Unity layout

- pnpm monorepo with TypeScript (strict), ESLint, Prettier, Vitest and Playwright.
- Editor with dockable windows in the Unity standard layout: menu bar, tool bar, area tabs,
  Hierarchy, Scene, Game, Block Editor, Inspector, Project, Asset Library and Console. Windows can
  be moved, grouped as tabs, undocked into floating windows or their own browser windows. Layouts
  are saved automatically and can be saved under a name.
- Scene view with sky, sun, soft shadows, textured ground, grid, Unity camera navigation and
  axis gizmo. Game view with statistics.
- Blocks defined once with `defineBlock`; Blockly definitions, palette per area and search index
  are generated from it. Compiler from Blockly JSON via IR to JavaScript generator functions.
- German and English user interface, dark and light theme.
- Electron desktop shell that runs offline.
- GitHub foundation: community files, issue and pull request templates, CI on Windows and Linux.
