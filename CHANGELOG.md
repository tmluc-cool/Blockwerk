# Changelog

All notable changes are listed here. From the first release on, this file is generated from the
[Conventional Commits](https://www.conventionalcommits.org/) of each release.

## Unreleased

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
