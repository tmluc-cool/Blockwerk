// Generates examples/08-kaputt: a small scene with deliberate mistakes for the debugging tools
// (SPEC phase 8). Every mistake must show up in the console in plain German, with a link.
// Run with `npx tsx scripts/make-example-08.mjs`. The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from '../packages/project/src/index.ts';
import { NodeFileSystem } from '../packages/project/src/node.ts';
import { b, call, define, workspace } from '../packages/compiler/test/dsl.ts';

const folder = join(import.meta.dirname, '..', 'examples', '08-kaputt');
rmSync(join(folder, 'Assets'), { recursive: true, force: true });

const SCENE = 'kaputtszen01';
const SCRIPT_RUNAWAY = 'kaputtscr001';
const SCRIPT_SENDER = 'kaputtscr002';
const SCRIPT_COUNTER = 'kaputtscr003';
const VAR_SCORE = 'kaputtvar001';

let objectCounter = 0;
let componentCounter = 0;
const prefixed = (prefix, counter) =>
  `${prefix}${String(counter).padStart(12 - prefix.length, '0')}`;
const oid = () => prefixed('ko', ++objectCounter);
const cid = () => prefixed('kc', ++componentCounter);
const comp = (type, values = {}) => ({ id: cid(), type, enabled: true, values });
const meta = (id, type) => ({ formatVersion: 1, id, type, importSettings: {}, license: null });

const objects = {};
let order = 0;
const area = {};
for (const kind of ['environment', 'player1', 'player2', 'npcs', 'items', 'ui']) {
  const id = oid();
  objects[id] = {
    name: null,
    parent: null,
    order: order++,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    area: kind,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [],
  };
  area[kind] = id;
}
const add = ({
  name,
  parent = area.environment,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  components = [],
  tag = 'Untagged',
  isStatic = false,
}) => {
  const id = oid();
  objects[id] = {
    name,
    parent,
    order: order++,
    active: true,
    tag,
    layer: 'Default',
    static: isStatic,
    transform: { position, rotation: [0, 0, 0], scale },
    components,
  };
  return id;
};

// ------------------------------------------------------------------ scripts
const scoreVariable = {
  id: VAR_SCORE,
  name: 'punkte',
  type: 'number',
  scope: 'game',
  default: 0,
  inspector: false,
};

const scripts = [];
const addScript = (id, name, variables, ...stacks) =>
  scripts.push({ id, name, variables, workspace: workspace(...stacks) });

// Mistake 4: an endless loop in a block that runs "without screen refresh".
addScript(
  SCRIPT_RUNAWAY,
  'Endlosschleife',
  [],
  [
    b('events.whenKey', { key: 'L', mode: 'pressed' }),
    call('Command', 'def-endless', [], SCRIPT_RUNAWAY),
  ],
  [
    define('Command', 'endlos rechnen', 'def-endless', { warp: true }),
    b(
      'control.forever',
      {},
      { body: [b('variables.change', { variable: { id: VAR_SCORE } }, { by: 1 })] },
    ),
  ],
);

// Mistake 2: a message that no script listens to, plus a log message and an empty condition slot.
addScript(
  SCRIPT_SENDER,
  'Tor oeffnen',
  [],
  [
    b('events.whenKey', { key: 'T', mode: 'pressed' }),
    b('control.log', { level: 'info' }, { message: 'Ich öffne das Tor' }),
    b('control.sendMessage', { message: 'tor-auf', target: 'all' }),
  ],
  [
    b('events.whenKey', { key: 'G', mode: 'pressed' }),
    b('control.if', {}, { then: [b('control.log', { level: 'warning' }, { message: 'leer' })] }),
  ],
);

// For the breakpoint test: three steps that change the score.
addScript(
  SCRIPT_COUNTER,
  'Zaehler',
  [scoreVariable],
  [
    b('events.whenKey', { key: 'Z', mode: 'pressed' }),
    b('variables.change', { variable: { id: VAR_SCORE } }, { by: 1 }),
    b('variables.change', { variable: { id: VAR_SCORE } }, { by: 10 }),
    b('variables.change', { variable: { id: VAR_SCORE } }, { by: 100 }),
  ],
);

// Call blocks carry the name and parameters of their definition, as the editor writes them.
function eachBlock(block, visit) {
  if (!block) return;
  visit(block);
  for (const input of Object.values(block.inputs ?? {})) {
    eachBlock(input.block, visit);
    eachBlock(input.shadow, visit);
  }
  eachBlock(block.next?.block, visit);
}
const definitions = new Map();
for (const script of scripts) {
  for (const top of script.workspace.blocks.blocks) {
    eachBlock(top, (block) => {
      if (block.type.startsWith('custom.define')) {
        definitions.set(`${script.id}/${block.id}`, {
          name: block.fields.name,
          params: block.extraState?.params ?? [],
        });
      }
    });
  }
}
for (const script of scripts) {
  for (const top of script.workspace.blocks.blocks) {
    eachBlock(top, (block) => {
      if (!block.type.startsWith('custom.call')) return;
      const library = block.extraState.library ?? script.id;
      const definition = definitions.get(`${library}/${block.extraState.fn}`);
      if (!definition) throw new Error(`Unknown custom block ${library}/${block.extraState.fn}`);
      block.extraState = { ...block.extraState, ...definition };
    });
  }
}

// ------------------------------------------------------------------ the scene
add({
  name: 'Sonne',
  position: [0, 8, 0],
  components: [comp('light', { lightType: 'directional' })],
});
add({
  name: 'Kamera',
  position: [0, 6, -12],
  components: [comp('camera', { fieldOfView: 60 })],
});
add({
  name: 'Boden',
  position: [0, -0.5, 0],
  scale: [30, 1, 30],
  isStatic: true,
  components: [comp('boxCollider')],
});
// Mistake 5: a figure that walks (player control) but whose model has no animations at all.
add({
  name: 'Held ohne Animation',
  parent: area.player1,
  position: [0, 0, 0],
  tag: 'Player',
  components: [
    comp('meshRenderer', { model: 'library:kaykit-dungeon/barrel-large' }),
    comp('animator'),
    comp('characterController', { center: [0, 0.9, 0], height: 1.8, radius: 0.35 }),
    comp('thirdPersonControl'),
  ],
});
// Mistake 6: a model without any collider (a figure with a Character Controller does not count).
add({
  name: 'Haus ohne Kollision',
  position: [-9, 0, -4],
  components: [comp('meshRenderer', { model: 'library:kaykit-city/building-a' })],
});
// Mistake 1: a script component with an empty field.
add({
  name: 'Schalter ohne Skript',
  position: [-4, 0, 3],
  components: [comp('blockScript', {})],
});
// Mistake 3: an NPC far outside the navigation mesh that wants to reach the player.
add({
  name: 'Wache 2',
  parent: area.npcs,
  position: [80, 0, 80],
  components: [
    comp('navAgent'),
    comp('npc', { startState: 'chase' }),
    comp('follow', { distance: 1.5 }),
  ],
});
// The scripts of the mistakes run on one object, the counter on another.
const scriptHolder = add({
  name: 'Skript-Halter',
  position: [4, 0, 3],
  components: [
    comp('blockScript', { script: SCRIPT_RUNAWAY }),
    comp('blockScript', { script: SCRIPT_SENDER }),
    comp('blockScript', { script: SCRIPT_COUNTER }),
  ],
});
void scriptHolder;

// ------------------------------------------------------------------ the project
const project = new Project({
  formatVersion: 1,
  name: 'Kaputt',
  startScene: SCENE,
  graphicsLevel: 'medium',
});
project.tagsAndLayers = { formatVersion: 1, layers: [], tags: ['Enemy', 'NPC'] };
for (const script of scripts) {
  project.adoptAsset(
    `Assets/Block-Skripte/${script.name}.blocks.json`,
    meta(script.id, 'blockScript'),
    { data: { formatVersion: 1, variables: script.variables, workspace: script.workspace } },
  );
}
project.adoptAsset('Assets/Szenen/Kaputt.scene.json', meta(SCENE, 'scene'), {
  data: {
    formatVersion: 1,
    environment: {
      ambientIntensity: 0.4,
      fog: { enabled: false, near: 60, far: 160 },
      sky: { timeOfDay: 10, dayLength: 0, sunAzimuth: 0 },
    },
    objects,
  },
});

await project.save(new NodeFileSystem(folder));
console.log(JSON.stringify({ scripts: scripts.length, objects: Object.keys(objects).length }));
