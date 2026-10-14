# Changelog

All notable changes are listed here. From the first release on, this file is generated from the
[Conventional Commits](https://www.conventionalcommits.org/) of each release.

## Unreleased

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
