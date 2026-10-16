// Live check of the AI assistant against the real Anthropic API (SPEC 9.4, phase 10).
//   ANTHROPIC_API_KEY=sk-ant-... pnpm ai:live [--model <id>]
// Asks the two example questions of the phase acceptance, runs the answers through the same
// validators and repair loop as the editor, and prints what the user would see in the preview.
// Needs network access and a key; it is not part of the tests or the CI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchTransport, runTask, DEFAULT_AI_MODEL } from '../packages/ai/src/index.ts';
import type { ProjectFacts, TaskInput } from '../packages/ai/src/index.ts';
import { defaultRegistry } from '../packages/blocks/src/index.ts';
import { libraryIndexSchema } from '../packages/library/src/index.ts';
import { COMPONENTS } from '../packages/runtime/src/index.ts';

const { values } = parseArgs({ options: { model: { type: 'string' } } });
const apiKey = process.env['ANTHROPIC_API_KEY'];
if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY to run the live check.');
  process.exit(2);
}
const model = values.model ?? DEFAULT_AI_MODEL;

const indexPath = join(import.meta.dirname, '..', 'library', 'index.json');
const entries = libraryIndexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8'))).entries;

const facts: ProjectFacts = {
  projectName: 'Live check',
  sceneName: 'Wiese',
  groundY: 0,
  tags: ['Player', 'Untagged'],
  selectedObject: 'wache0000001',
  objects: [
    {
      id: 'spieler00001',
      name: 'Spieler',
      tag: 'Player',
      position: [0, 0, 8],
      scale: [1, 1, 1],
      components: ['meshRenderer', 'characterController'],
      scripts: [],
    },
    {
      id: 'wache0000001',
      name: 'Wache',
      tag: 'Untagged',
      position: [4, 0, -3],
      scale: [1, 1, 1],
      components: ['meshRenderer', 'navAgent', 'npc'],
      scripts: [],
    },
    {
      id: 'tor000000001',
      name: 'Tor',
      tag: 'Untagged',
      position: [0, 0, -4],
      scale: [1, 1, 1],
      components: ['meshRenderer'],
      scripts: [],
    },
  ],
  scripts: [],
};

const base: Omit<TaskInput, 'task' | 'prompt'> = {
  locale: 'de',
  model,
  registry: defaultRegistry,
  facts,
  library: entries,
  components: COMPONENTS.map((definition) => ({
    type: definition.type,
    label: definition.text.en,
    fields: Object.keys(definition.fields),
  })),
  scriptContext: {
    registry: defaultRegistry,
    objectIds: new Set(facts.objects.map((object) => object.id)),
    tags: new Set(facts.tags),
    assets: {
      prefab: new Set(),
      dialog: new Set(),
      scene: new Set(),
      ui: new Set(),
      audio: new Set(),
    },
    gameVariables: [],
  },
  worldContext: { library: new Map(entries.map((entry) => [entry.id, entry])) },
};

const transport = fetchTransport({ apiKey });
let failed = false;

for (const [task, prompt] of [
  ['logic', 'Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht'],
  ['world', 'Stell 5 Häuser und einen Brunnen auf die Wiese'],
] as const) {
  console.log(`\n== ${task}: ${prompt}`);
  const result = await runTask(transport, { ...base, task, prompt });
  if (result.kind === 'script') {
    console.log(result.check.proposal.name);
    console.log(result.outline.join('\n'));
  } else if (result.kind === 'world') {
    for (const object of result.check.objects)
      console.log(`${object.model} at ${object.position.join(', ')}`);
  } else {
    failed = true;
    console.log(JSON.stringify(result, null, 2));
  }
}
process.exit(failed ? 1 : 0);
