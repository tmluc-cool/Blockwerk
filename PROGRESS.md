# Progress

Status of the phases from `SPEC.md`, section 10. Per phase: plan before starting, acceptance result afterwards.

| Phase | Title | Status |
|---|---|---|
| 0 | Foundation and Unity layout | done |
| 1 | Objects, components, block scripts, Play Mode | done |
| 2 | Project window, Asset Library, Prefabs | done |
| 3 | Player, physics, animation | in progress |
| 3b | Character Studio | open |
| 4 | Environment and graphics | open |
| 5 | NPCs and game logic | open |
| 6 | UI, menus, saving | open |
| 7 | Large projects | open |
| 8 | Debugging | open |
| 9 | Build and export | open |
| 10 | AI assistant | open |
| 11 | Polish and final acceptance | open |

---

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
