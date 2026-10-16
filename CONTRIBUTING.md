# Contributing to Blockwerk

Thanks for helping! This guide explains the setup, the rules and the most common contributions.
Looking for a first task? See [docs/good-first-issues.md](docs/good-first-issues.md).
The full specification is in [SPEC.md](SPEC.md); the working rules in [CLAUDE.md](CLAUDE.md) apply
to human contributors too.

## Development environment

- Node.js LTS (22.12 or newer, see `.nvmrc`) and pnpm 10 (`corepack enable` picks the right version).
- `pnpm install` installs everything, including Electron.
- End-to-end tests use Playwright's Chromium: `pnpm exec playwright install chromium` once.
  On Linux without a display, run them with `xvfb-run -a`.

## Commands

| Command             | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `pnpm dev`          | Editor in the browser with hot reload                                        |
| `pnpm dev:desktop`  | Editor in Electron (starts Vite and Electron)                                |
| `pnpm test`         | All unit and golden tests (Vitest)                                           |
| `pnpm test:e2e`     | Builds, then runs the Playwright tests for the browser and desktop app       |
| `pnpm lint`         | ESLint, Prettier check and license check                                     |
| `pnpm typecheck`    | TypeScript in every package                                                  |
| `pnpm build`        | Type check, editor build, desktop build                                      |
| `pnpm format`       | Formats all files with Prettier                                              |
| `pnpm run licenses` | Checks dependency licenses and regenerates `THIRD_PARTY.md`                  |
| `pnpm screenshot`   | Builds and writes the screenshot of the sample scene to `docs/screenshots/`  |
| `pnpm tour`         | Records the animated tour of the README (`docs/screenshots/editor-tour.gif`) |
| `pnpm site`         | Builds the GitHub Pages site (`site/`: start page, editor, playable games)   |

## Repository layout

```
packages/blocks     The only place where blocks are defined (shape, inputs, texts, codegen)
packages/compiler   Block JSON → intermediate representation → JavaScript (pure functions)
packages/runtime    3D engine and components, no dependency on the editor or Blockly
packages/project    Project format, meta files, schemas, load/save, migrations (from phase 1)
packages/library    Asset library sources, index and licenses (from phase 2)
packages/character  Standard skeleton, retargeting, character builder (from phase 3b)
apps/editor         Editor UI (browser and Electron)
apps/desktop        Electron shell
examples/           One example project per phase, used as acceptance test
e2e/                Playwright tests
docs/               Documentation sources and screenshots
```

## Rules

- TypeScript strict, no `any`. Public functions get types and a short comment.
- Identifiers, comments and commit messages in English.
- **Every user-facing text exists in German and English** and comes from the i18n files
  (`apps/editor/src/i18n/de.json` and `en.json`), never hard-coded. ESLint enforces this for JSX.
- `packages/runtime` imports nothing from `apps/` or Blockly; `packages/blocks` and
  `packages/compiler` stay pure (no three.js, no Blockly).
- New dependencies must be MIT, Apache-2.0, BSD, ISC, Zlib or CC0. Run `pnpm run licenses` and commit
  the updated `THIRD_PARTY.md`.
- The editor never uses the network. Only `pnpm assets:fetch` (development) and the optional AI
  assistant with the user's own API key may.
- A new block needs an entry in `packages/blocks/src/unity.ts` (its Unity counterpart, or an empty
  string if there is none), a new component a `unity` field. Run `pnpm docs:reference` and commit
  `docs/reference/` (a test fails if it is out of date).
- Do not use names, logos, icons or graphics of Unity, Scratch or other products.

## Commits and pull requests

- Small, focused commits following [Conventional Commits](https://www.conventionalcommits.org/),
  for example `feat(runtime): add third-person camera` or `fix(editor): keep layout on reload`.
  Scopes are the package names: `blocks`, `compiler`, `runtime`, `project`, `library`,
  `character`, `editor`, `desktop`, plus `e2e`, `ci`, `docs`.
- Pull requests use the template checklist. CI must be green on Windows and Linux.
- UI changes come with a screenshot.

## How to add a block

Blocks are defined once in `packages/blocks`; Blockly definitions, palette, search index and docs
are generated from the definition.

1. Add the definition to the matching file in `packages/blocks/src/catalog/` (or a new file):

   ```ts
   export const moveForward = defineBlock({
     id: 'motion.moveForward',
     category: 'motion',
     shape: 'stack',
     inputs: { meters: { type: 'number', default: 1 } },
     text: { de: 'gehe {meters} Meter vorwärts', en: 'move {meters} m forward' },
     keywords: { de: ['laufen', 'bewegen'], en: ['walk', 'move'] },
     areas: ['player', 'npc'],
     compile: ({ meters }) => `self.moveLocal(0, 0, ${meters});`,
     docs: {
       de: 'Bewegt das Objekt in Blickrichtung.',
       en: 'Moves the object along its facing direction.',
     },
     since: 1,
   });
   ```

2. Register it in `packages/blocks/src/catalog/index.ts`.
3. Add a **golden test**: a Blockly workspace using the block in
   `packages/compiler/test/golden/<name>.blocks.json`, then run
   `UPDATE_GOLDEN=1 pnpm test` once and check the generated `<name>.expected.js`.
4. Add a **runtime test** case in `packages/compiler/test/runtime.test.ts` that runs the compiled
   block against the runtime and lists the block in `covers`.

Tests fail if a catalog block has no golden or runtime test.

## How to add a component

The component system arrives in phase 1. This section will describe how a component is defined
once (fields, types, defaults, texts, blocks) and shown in the inspector, the character studio,
the docs and the AI catalog.

## How to add an asset pack

The asset library arrives in phase 2. Packs are added only through a source description in
`packages/library/sources/` and **must be CC0**. No Mixamo files and no files from paid stores.

## How to add or improve a translation

1. Add the key with the German text to `apps/editor/src/i18n/de.json` and the English text to
   `en.json`. The English UI uses the Unity terms, the German UI the terms of SPEC 5.1.
2. Use it in the code with `t('your.key')` (or `useT()` in components).
3. `pnpm test` checks that both files have the same keys and placeholders.

Block texts live in the block definitions (`text`, `docs`, `keywords`) in `packages/blocks`.
