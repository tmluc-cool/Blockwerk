# Changelog

All notable changes are listed here. From the first release on, this file is generated from the
[Conventional Commits](https://www.conventionalcommits.org/) of each release.

## Unreleased

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
