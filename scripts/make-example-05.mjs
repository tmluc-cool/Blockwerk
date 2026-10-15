// Generates examples/05-quest: a village with a quest giver, a chest with a key, a locked gate,
// two zombies (variants of the prefab "Gegner") and a crypt scene behind the gate. Run with
// `npx tsx scripts/make-example-05.mjs`. The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  Project,
  createUiTemplate,
  instantiatePrefab,
  resolvePrefab,
  updateInstanceOverrides,
  createVariantData,
  createPrefabData,
} from '../packages/project/src/index.ts';
import { NodeFileSystem } from '../packages/project/src/node.ts';
import { b, workspace } from '../packages/compiler/test/dsl.ts';

const folder = join(import.meta.dirname, '..', 'examples', '05-quest');
rmSync(join(folder, 'Assets'), { recursive: true, force: true });

// ------------------------------------------------------------------ ids and helpers
const SCENE_VILLAGE = 'questdorf001';
const SCENE_CRYPT = 'questgruft01';
const SCENE_MENU = 'questmenu001';
const UI_MAIN = 'questuimain1';
const UI_PAUSE = 'questuipaus1';
const UI_SETTINGS = 'questuiset01';
const UI_VICTORY = 'questuivic01';
const UI_DEFEAT = 'questuidef01';
const UI_LOADING = 'questuiload1';
const UI_HUD = 'questuihud01';
const DIALOG = 'questdialog1';
const PREFAB_ENEMY = 'questgegner1';
const PREFAB_ZOMBIE_A = 'questzombiea';
const PREFAB_ZOMBIE_B = 'questzombieb';

// Game variables (IDs are shared by the scripts and the dialog).
const VAR_TASK = 'questvartask';
const VAR_LIFE = 'questvarlife';
const VAR_COINS = 'questvarcoin';
const VAR_QUEST = 'questvarstat';

let objectCounter = 0;
let componentCounter = 0;
const prefixed = (prefix, counter) =>
  `${prefix}${String(counter).padStart(12 - prefix.length, '0')}`;
const oid = () => prefixed('qo', ++objectCounter);
const cid = () => prefixed('qc', ++componentCounter);
const comp = (type, values = {}) => ({ id: cid(), type, enabled: true, values });
const round = (value) => Math.round(value * 100) / 100;
const lib = (name) => `library:${name}`;

/** One scene under construction. */
function createScene(environment) {
  const objects = {};
  let order = 0;
  const add = ({
    name,
    parent,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
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
      transform: { position, rotation, scale },
      components,
    };
    return id;
  };
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
  return { objects, add, area, environment, nextOrder: () => order++ };
}

const attach = (scene, objectId, scriptId) =>
  scene.objects[objectId].components.push(comp('blockScript', { script: scriptId }));

const project = new Project({
  formatVersion: 1,
  name: 'Quest',
  startScene: SCENE_MENU,
  graphicsLevel: 'high',
});
project.tagsAndLayers = { formatVersion: 1, layers: [], tags: ['Enemy', 'NPC', 'Spawn'] };
const meta = (id, type) => ({ formatVersion: 1, id, type, importSettings: {}, license: null });

// ------------------------------------------------------------------ block scripts
const gameVar = (id, name, type, def, saved = false) => ({
  id,
  name,
  type,
  scope: 'game',
  default: def,
  inspector: false,
  ...(saved ? { saved: true } : {}),
});
// The quest progress is part of a save slot.
const V_TASK = gameVar(VAR_TASK, 'Aufgabe', 'string', 'Sprich mit Mira', true);
const V_QUEST = gameVar(VAR_QUEST, 'Quest', 'number', 0, true);

const scriptAssets = [];
function addScript(id, name, variables, ...scripts) {
  scriptAssets.push({ id, name, variables, workspace: workspace(...scripts) });
}

// The player: a sound when defeated (the life bar, the inventory and the task are the HUD canvas).
addScript(
  'questscrpt01',
  'Spieler',
  [],
  [
    b('items.whenHealth', { phase: 'died' }),
    b('sound.play', { sound: 'builtin:hurt', where: 'everywhere' }),
  ],
);

// The quest giver reacts to the answers of the dialog.
addScript(
  'questscrpt02',
  'Quest-Geberin',
  [V_TASK, V_QUEST],
  [
    b('dialog.whenAnswer', { answer: 'annehmen' }),
    b('sound.play', { sound: 'builtin:click', where: 'everywhere' }),
  ],
  [
    b('dialog.whenAnswer', { answer: 'abgeben' }),
    b('effects.spawn', { effect: 'sparkle', at: 'self' }),
    b('sound.play', { sound: 'builtin:win', where: 'everywhere' }),
    b('control.wait', {}, { seconds: 1.5 }),
    b('ui.show', { ui: `ui:${UI_VICTORY}` }),
  ],
);

// Zone in front of the crypt: go inside.
addScript(
  'questscrpt03',
  'Gruft betreten',
  [],
  [
    b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
    b('scenes.load', { scene: `scene:${SCENE_CRYPT}`, spawn: 'Eingang' }),
  ],
);

// Zone at the crypt exit: back to the village.
addScript(
  'questscrpt04',
  'Gruft verlassen',
  [],
  [
    b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
    b('scenes.load', { scene: `scene:${SCENE_VILLAGE}`, spawn: 'Gruft' }),
  ],
);

// A zombie growls when it starts chasing.
addScript(
  'questscrpt05',
  'Zombie-Laute',
  [],
  [
    b('npc.whenState', { state: 'chase' }),
    b('sound.play', { sound: 'builtin:hurt', where: 'here' }),
  ],
);

// Music in both scenes.
addScript(
  'questscrpt06',
  'Musik Dorf',
  [],
  [b('events.whenGameStarts'), b('sound.playMusic', { sound: 'builtin:music-calm' })],
);
addScript(
  'questscrpt07',
  'Musik Gruft',
  [],
  [b('events.whenGameStarts'), b('sound.playMusic', { sound: 'builtin:ambient-night' })],
);

for (const { id, name, variables, workspace: ws } of scriptAssets) {
  project.adoptAsset(`Assets/Block-Skripte/${name}.blocks.json`, meta(id, 'blockScript'), {
    data: { formatVersion: 1, variables, workspace: ws },
  });
}

// ------------------------------------------------------------------ dialog
const setTask = (text) => ({ type: 'setVariable', variable: VAR_TASK, value: text });
project.adoptAsset('Assets/Dialoge/Mira.dialog.json', meta(DIALOG, 'dialog'), {
  data: {
    formatVersion: 1,
    start: 'hallo',
    nodes: {
      hallo: {
        speaker: 'Mira',
        text: 'Willkommen im Dorf, Fremder! Ich bin Mira, die Magierin. Kann ich etwas für dich tun – oder du etwas für mich?',
        answers: [
          {
            id: 'fragen',
            text: 'Was brauchst du?',
            next: 'auftrag',
            condition: { type: 'variable', variable: VAR_QUEST, op: '==', value: 0 },
          },
          {
            id: 'hinweis',
            text: 'Wo war das noch gleich?',
            next: 'tipp',
            condition: { type: 'variable', variable: VAR_QUEST, op: '==', value: 1 },
          },
          {
            id: 'abgeben',
            text: 'Ich habe dein Zauberbuch gefunden.',
            next: 'belohnung',
            condition: { type: 'hasItem', item: 'Zauberbuch', count: 1 },
            actions: [
              { type: 'removeItem', item: 'Zauberbuch', count: 1 },
              { type: 'addItem', item: 'Münze', count: 25 },
              { type: 'setVariable', variable: VAR_QUEST, value: 2 },
              setTask('Erledigt – danke fürs Helfen!'),
            ],
          },
          { id: 'tschuess', text: 'Auf Wiedersehen.', next: null },
        ],
        x: 0,
        y: 0,
      },
      auftrag: {
        speaker: 'Mira',
        text: 'Mein Zauberbuch liegt in der Gruft hinter dem Tor im Norden. Den Schlüssel findest du in der Truhe am Brunnen. Aber Vorsicht: Zwei Zombies treiben sich im Dorf herum!',
        answers: [
          {
            id: 'annehmen',
            text: 'Ich hole es dir.',
            next: 'danke',
            actions: [
              { type: 'setVariable', variable: VAR_QUEST, value: 1 },
              setTask('Finde den Schlüssel in der Truhe'),
            ],
          },
          { id: 'ablehnen', text: 'Vielleicht später.', next: null },
        ],
        x: 360,
        y: 0,
      },
      danke: {
        speaker: 'Mira',
        text: 'Wunderbar! Bring mir das Buch, dann belohne ich dich.',
        answers: [],
        next: null,
        x: 720,
        y: 0,
      },
      tipp: {
        speaker: 'Mira',
        text: 'Der Schlüssel liegt in der Truhe am Brunnen. Das Tor ist ganz im Norden. In der Gruft liegt mein Buch.',
        answers: [],
        next: null,
        x: 360,
        y: 260,
      },
      belohnung: {
        speaker: 'Mira',
        text: 'Mein Zauberbuch! Hier sind 25 Münzen für dich.',
        answers: [],
        next: null,
        x: 360,
        y: 520,
      },
    },
  },
});

// ------------------------------------------------------------------ shared object builders
const knight = (scene, position, rotation) => {
  const id = scene.add({
    name: 'Ritter',
    parent: scene.area.player1,
    position,
    rotation,
    tag: 'Player',
    components: [
      comp('meshRenderer', { model: lib('kaykit-adventurers/knight') }),
      comp('animator'),
      comp('characterController', { center: [0, 0.9, 0], height: 1.8, radius: 0.35 }),
      comp('thirdPersonControl'),
      comp('inventory'),
      comp('health', { max: 100, invulnerable: 0.8, onDeath: 'respawn', respawnDelay: 2 }),
      comp('meleeHit', { damage: 25, range: 2.4, cooldown: 0.5 }),
    ],
  });
  scene.add({
    name: 'Hauptkamera',
    parent: scene.area.player1,
    position: [position[0], position[1] + 3, position[2] - 6],
    rotation: [15, 0, 0],
    tag: 'MainCamera',
    components: [
      comp('camera', { fieldOfView: 60 }),
      comp('thirdPersonCamera'),
      comp('postProcessing'),
    ],
  });
  return id;
};

const sun = (scene) =>
  scene.add({
    name: 'Sonne',
    parent: scene.area.environment,
    position: [0, 30, 0],
    rotation: [50, -30, 0],
    components: [comp('light', { lightType: 'directional' })],
  });

const model = (scene, name, modelName, position, yaw = 0, size = 1, extra = [], parent) =>
  scene.add({
    name,
    parent: parent ?? scene.area.environment,
    position: position.map(round),
    rotation: [0, yaw, 0],
    scale: [size, size, size],
    components: [comp('meshRenderer', { model: lib(modelName) }), ...extra],
  });

const ground = (scene, name, color, size, center = [0, -0.5, 0]) =>
  scene.add({
    name,
    parent: scene.area.environment,
    position: center,
    scale: [size[0], 1, size[1]],
    isStatic: true,
    components: [
      comp('meshRenderer', { shape: 'cube', color, smoothness: 0.1 }),
      comp('boxCollider'),
    ],
  });

/** A box collider on its own object (invisible wall). */
const wall = (scene, name, position, size) =>
  scene.add({
    name,
    parent: scene.area.environment,
    position,
    isStatic: true,
    components: [comp('boxCollider', { size })],
  });

// ------------------------------------------------------------------ village scene
const village = createScene({
  ambientIntensity: 0.4,
  fog: { enabled: true, near: 40, far: 120 },
  sky: { timeOfDay: 14, dayLength: 0, sunAzimuth: 0 },
  navigation: { agentRadius: 0.45, agentHeight: 1.9, maxClimb: 0.4, maxSlope: 45, cellSize: 0.25 },
});
sun(village);
ground(village, 'Wiese', '#6f9a4a', [90, 90], [0, -0.5, 8]);

// Houses ring the plaza; their boxes are obstacles for the zombies.
const houses = [
  ['building-home-a-red', -17, 5, 90],
  ['building-home-b-blue', -15, -9, 60],
  ['building-tavern-red', 16, 6, 270],
  ['building-home-a-yellow', 18, -12, 300],
  ['building-market-red', -2, 17, 180],
  ['building-blacksmith-yellow', 10, 15, 200],
];
for (const [name, x, z, yaw] of houses) {
  model(
    village,
    name.replace('building-', ''),
    `kaykit-medieval-hexagon/${name}`,
    [x, 0, z],
    yaw,
    1.5,
    [comp('boxCollider', { size: [3, 3.5, 3], center: [0, 1.75, 0] })],
  );
}
model(village, 'Brunnen', 'kaykit-medieval-hexagon/building-well-blue', [0, 0, -2], 0, 1.2, [
  comp('boxCollider', { size: [2, 3, 2], center: [0, 1.5, 0] }),
]);

// Crates and barrels give cover: the zombies have to chase around them.
const crates = [
  [-6, -4],
  [-4, 9],
  [6, 8],
  [7, -9],
  [-10, -2],
  [11, 0],
];
crates.forEach(([x, z], index) => {
  model(
    village,
    `Kiste ${index + 1}`,
    'kaykit-medieval-hexagon/crate-a-big',
    [x, 0, z],
    index * 37,
    1.3,
    [comp('boxCollider', { size: [1, 1, 1], center: [0, 0.5, 0] })],
  );
});
[
  [-8, 3],
  [3, 12],
  [14, -5],
].forEach(([x, z], index) => {
  model(village, `Fass ${index + 1}`, 'kaykit-dungeon/barrel-large', [x, 0, z], index * 70, 1, [
    comp('boxCollider', { size: [1.1, 1.4, 1.1], center: [0, 0.7, 0] }),
  ]);
});
// Trees at the edge of the village.
for (let i = 0; i < 18; i++) {
  const angle = (i / 18) * Math.PI * 2;
  const x = Math.cos(angle) * 36;
  const z = Math.sin(angle) * 30 - 6;
  if (z > 20) continue;
  model(
    village,
    `Baum ${i + 1}`,
    i % 2 ? 'kaykit-medieval-hexagon/tree-single-a' : 'kaykit-medieval-hexagon/tree-single-b',
    [x, 0, z],
    i * 53,
    1.5,
    [comp('capsuleCollider', { center: [0, 2, 0], radius: 0.4, height: 4 })],
  );
}

// The fence across the north end, with the locked gate in the middle.
const FENCE_Z = 24;
for (let i = 1; i <= 5; i++) {
  for (const side of [-1, 1]) {
    model(
      village,
      'Zaun',
      'kaykit-medieval-hexagon/fence-stone-straight',
      [side * i * 4.62, 0, FENCE_Z],
      90,
      1,
      [comp('boxCollider', { size: [0.8, 3, 4.62], center: [0, 1.5, 0] })],
    );
  }
}
const gate = model(
  village,
  'Tor',
  'kaykit-medieval-hexagon/fence-stone-straight-gate',
  [0, 0, FENCE_Z],
  90,
  1,
  [
    comp('boxCollider', { size: [0.8, 3, 4.62], center: [0, 1.5, 0] }),
    comp('door', {
      style: 'lift',
      distance: 3.2,
      duration: 1.2,
      key: 'Schlüssel',
      consumeKey: true,
    }),
  ],
);
// Side walls so nobody walks around the fence.
wall(village, 'Rand Ost', [41, 2, 8], [1, 4, 90]);
wall(village, 'Rand West', [-41, 2, 8], [1, 4, 90]);
wall(village, 'Rand Süd', [0, 2, -37], [90, 4, 1]);

// North of the fence: the way to the crypt.
model(village, 'Gruft', 'kaykit-halloween/crypt', [0, 0, 40], 180, 1.4, [
  comp('boxCollider', { size: [3.6, 4.8, 4.8], center: [0, 2.4, 0] }),
]);
[
  [-12, 31],
  [12, 33],
  [-9, 38],
  [10, 40],
].forEach(([x, z], index) => {
  model(village, `Grab ${index + 1}`, 'kaykit-halloween/grave-a', [x, 0, z], index * 30, 1.4, [
    comp('boxCollider', { size: [1.2, 1.3, 0.6], center: [0, 0.65, 0] }),
  ]);
});
const crypt = village.add({
  name: 'Gruft-Eingang',
  parent: village.area.items,
  position: [0, 1, 34.5],
  components: [comp('boxCollider', { isTrigger: true, size: [4, 2, 2] })],
});
attach(village, crypt, 'questscrpt03');
// Where the player starts.
village.add({
  name: 'Start',
  parent: village.area.items,
  position: [0, 0, -26],
  tag: 'Spawn',
});
// Where the player appears when coming back from the crypt.
village.add({
  name: 'Gruft',
  parent: village.area.items,
  position: [0, 0, 30],
  tag: 'Spawn',
});

// Quest giver, chest, lanterns.
const mira = village.add({
  name: 'Mira',
  parent: village.area.npcs,
  position: [-8, 0, -9],
  rotation: [0, 120, 0],
  tag: 'NPC',
  components: [
    comp('meshRenderer', { model: lib('kaykit-adventurers/mage') }),
    comp('animator'),
    comp('talkable', { dialog: DIALOG, name: 'Mira', radius: 3 }),
    comp('boxCollider', { size: [0.8, 1.9, 0.8], center: [0, 0.95, 0] }),
  ],
});
attach(village, mira, 'questscrpt02');
village.add({
  name: 'Truhe',
  parent: village.area.items,
  position: [4.5, 0, -6.5],
  rotation: [0, 200, 0],
  components: [
    comp('meshRenderer', { model: lib('kaykit-dungeon/chest') }),
    comp('boxCollider', { size: [1.2, 0.9, 1], center: [0, 0.45, 0] }),
    comp('chest', { contents: 'Schlüssel:1', radius: 2.4 }),
  ],
});
[
  [-3, -14],
  [3, -14],
].forEach(([x, z], index) => {
  village.add({
    name: `Laterne ${index + 1}`,
    parent: village.area.environment,
    position: [x, 0, z],
    components: [comp('meshRenderer', { model: lib('kaykit-halloween/post-lantern') })],
  });
  village.add({
    name: `Licht ${index + 1}`,
    parent: village.area.environment,
    position: [x, 2.6, z],
    components: [
      comp('light', {
        lightType: 'point',
        color: '#ffb866',
        intensity: 10,
        range: 10,
        castShadows: false,
      }),
    ],
  });
});

// The player.
const hero = knight(village, [0, 0.1, -26], [0, 0, 0]);
attach(village, hero, 'questscrpt01');
const musicVillage = village.add({ name: 'Musik', parent: village.area.environment });
attach(village, musicVillage, 'questscrpt06');

// ------------------------------------------------------------------ prefabs: Gegner and its variants
const prefabSource = (id) => prefabData.get(id) ?? null;
const prefabData = new Map();
const enemyScene = createScene({});
const enemyRoot = enemyScene.add({
  name: 'Gegner',
  parent: null,
  tag: 'Enemy',
  components: [
    comp('meshRenderer', { model: lib('kaykit-skeletons/skeleton-minion') }),
    comp('animator'),
    comp('navAgent', { speed: 3.4, radius: 0.4, height: 1.9 }),
    comp('npc', { startState: 'patrol' }),
    comp('patrol', { route: null, wait: 1.2, speed: 1.6 }),
    comp('guard', { viewDistance: 16, viewAngle: 110, hearingRadius: 4, loseTime: 4 }),
    comp('follow', { distance: 1.4, speed: 3.6 }),
    comp('attack', { range: 1.9, damage: 12, cooldown: 1.3, windup: 0.4 }),
    comp('health', { max: 60, invulnerable: 0.3, onDeath: 'destroy' }),
    comp('capsuleCollider', { isTrigger: true, center: [0, 0.95, 0], radius: 0.4, height: 1.9 }),
  ],
});
attach(enemyScene, enemyRoot, 'questscrpt05');
const enemyObjects = Object.fromEntries(
  Object.entries(enemyScene.objects).filter(([, object]) => object.area === undefined),
);
const { prefab: enemyPrefab } = createPrefabData(enemyObjects, enemyRoot, oid);
prefabData.set(PREFAB_ENEMY, enemyPrefab);
project.adoptAsset('Assets/Prefabs/Gegner.prefab.json', meta(PREFAB_ENEMY, 'prefab'), {
  data: enemyPrefab,
});

/** A variant of "Gegner" that changes the model, the name and the speed. */
function makeVariant(id, name, modelName, patrolSpeed, viewAngle) {
  const resolvedBase = resolvePrefab(PREFAB_ENEMY, prefabSource);
  const variant = createVariantData(PREFAB_ENEMY, resolvedBase);
  const rootObject = resolvedBase.objects[resolvedBase.root];
  const idOf = (type) => rootObject.components.find((c) => c.type === type).id;
  variant.overrides = [
    { object: resolvedBase.root, path: 'name', value: name },
    {
      object: resolvedBase.root,
      path: `component:${idOf('meshRenderer')}:model`,
      value: lib(modelName),
    },
    { object: resolvedBase.root, path: `component:${idOf('patrol')}:speed`, value: patrolSpeed },
    { object: resolvedBase.root, path: `component:${idOf('guard')}:viewAngle`, value: viewAngle },
  ];
  prefabData.set(id, variant);
  project.adoptAsset(`Assets/Prefabs/${name}.prefab.json`, meta(id, 'prefab'), { data: variant });
}
makeVariant(PREFAB_ZOMBIE_A, 'Zombie A', 'kaykit-skeletons/skeleton-warrior', 1.4, 100);
makeVariant(PREFAB_ZOMBIE_B, 'Zombie B', 'kaykit-skeletons/skeleton-minion', 1.9, 120);

/** Places an instance of a zombie variant that patrols a route of the village. */
function placeZombie(prefabId, name, position, yaw, routeId) {
  const resolved = resolvePrefab(prefabId, prefabSource);
  const { rootId, objects } = instantiatePrefab(prefabId, resolved, {
    parent: village.area.npcs,
    order: village.nextOrder(),
    transform: { position, rotation: [0, yaw, 0] },
    createId: oid,
  });
  const root = objects[rootId];
  root.name = name;
  root.components.find((c) => c.type === 'patrol').values.route = routeId;
  Object.assign(village.objects, objects);
  Object.assign(village.objects, updateInstanceOverrides(village.objects, rootId, prefabSource));
  return rootId;
}

/** A route: a parent object with ordered points as children. */
function makeRoute(name, points) {
  const route = village.add({ name, parent: village.area.items });
  points.forEach(([x, z], index) => {
    village.add({
      name: `Punkt ${index + 1}`,
      parent: route,
      position: [x, 0, z],
    });
  });
  return route;
}
// Zombie A walks around the crates at the left of the plaza, Zombie B along the road to the gate.
const routeA = makeRoute('Route A', [
  [-12, -12],
  [-12, 4],
  [-3, 7],
  [-3, -8],
]);
const routeB = makeRoute('Route B', [
  [8, 3],
  [10, 12],
  [2, 20],
  [-8, 19],
  [4, 10],
]);
placeZombie(PREFAB_ZOMBIE_A, 'Zombie A', [-12, 0, -12], 0, routeA);
placeZombie(PREFAB_ZOMBIE_B, 'Zombie B', [8, 0, 3], 90, routeB);

// ------------------------------------------------------------------ crypt scene
const crypt_ = createScene({
  ambientIntensity: 0.22,
  fog: { enabled: true, near: 8, far: 36 },
  sky: { timeOfDay: 22, dayLength: 0, sunAzimuth: 0 },
});
const TILE = 2.8;
for (let ix = -2; ix <= 2; ix++) {
  for (let iz = 0; iz <= 5; iz++) {
    model(crypt_, 'Boden', 'kaykit-dungeon/floor-tile-large', [ix * TILE, -0.05, iz * TILE], 0, 1);
  }
}
// Invisible floor: the tiles are thin.
wall(crypt_, 'Boden-Collider', [0, -0.5, 7], [20, 1, 24]);
// Walls around the room.
for (let ix = -2; ix <= 2; ix++) {
  model(crypt_, 'Wand Nord', 'kaykit-dungeon/wall', [ix * TILE, 0, 5 * TILE + 1.4], 0, 1, [
    comp('boxCollider', { size: [2.8, 2.8, 0.7], center: [0, 1.4, 0] }),
  ]);
}
for (let iz = 0; iz <= 5; iz++) {
  model(crypt_, 'Wand Ost', 'kaykit-dungeon/wall', [2 * TILE + 1.4, 0, iz * TILE], 90, 1, [
    comp('boxCollider', { size: [2.8, 2.8, 0.7], center: [0, 1.4, 0] }),
  ]);
  model(crypt_, 'Wand West', 'kaykit-dungeon/wall', [-2 * TILE - 1.4, 0, iz * TILE], 270, 1, [
    comp('boxCollider', { size: [2.8, 2.8, 0.7], center: [0, 1.4, 0] }),
  ]);
}
for (let ix = -2; ix <= 2; ix++) {
  model(crypt_, 'Wand Süd', 'kaykit-dungeon/wall', [ix * TILE, 0, -TILE + 0.2], 180, 1, [
    comp('boxCollider', { size: [2.8, 2.8, 0.7], center: [0, 1.4, 0] }),
  ]);
}
[
  [-4.2, 5.4],
  [4.2, 5.4],
  [-4.2, -0.4],
  [4.2, -0.4],
].forEach(([x, z], index) => {
  model(crypt_, `Fackel ${index + 1}`, 'kaykit-dungeon/torch-lit', [x, 1.4, z], 0, 1.6);
  crypt_.add({
    name: `Fackellicht ${index + 1}`,
    parent: crypt_.area.environment,
    position: [x, 2.2, z],
    components: [
      comp('light', {
        lightType: 'point',
        color: '#ff9a44',
        intensity: 12,
        range: 11,
        castShadows: false,
      }),
    ],
  });
});
[
  [-2.5, 9],
  [2.5, 9],
].forEach(([x, z], index) => {
  model(crypt_, `Säule ${index + 1}`, 'kaykit-dungeon/pillar', [x, 0, z], 0, 1, [
    comp('boxCollider', { size: [1.05, 2.8, 1.05], center: [0, 1.4, 0] }),
  ]);
});
// The spell book on a table at the far end.
model(crypt_, 'Tisch', 'kaykit-dungeon/table-long', [0, 0, 12.6], 90, 1, [
  comp('boxCollider', { size: [2.5, 1, 1.2], center: [0, 0.5, 0] }),
]);
crypt_.add({
  name: 'Zauberbuch',
  parent: crypt_.area.items,
  position: [0, 1.15, 12.6],
  scale: [4, 4, 4],
  components: [
    comp('meshRenderer', { model: lib('kaykit-adventurers/spellbook-closed') }),
    comp('pickup', { item: 'Zauberbuch', count: 1, mode: 'interact', radius: 2.4, sound: 'coin' }),
  ],
});
crypt_.add({
  name: 'Eingang',
  parent: crypt_.area.items,
  position: [0, 0, 0.5],
  tag: 'Spawn',
});
const exit = crypt_.add({
  name: 'Ausgang',
  parent: crypt_.area.items,
  position: [0, 1, -1.4],
  components: [comp('boxCollider', { isTrigger: true, size: [6, 2, 1.2] })],
});
attach(crypt_, exit, 'questscrpt04');
const heroCrypt = knight(crypt_, [0, 0.1, 0.5], [0, 0, 0]);
attach(crypt_, heroCrypt, 'questscrpt01');
const musicCrypt = crypt_.add({ name: 'Musik', parent: crypt_.area.environment });
attach(crypt_, musicCrypt, 'questscrpt07');

// ------------------------------------------------------------------ UI canvases (menus and HUD)
const labels = {
  gameTitle: 'Die Quest von Mira',
  play: 'Spielen',
  loadSlot: 'Laden {n}',
  settings: 'Einstellungen',
  quit: 'Beenden',
  paused: 'Pause',
  resume: 'Fortsetzen',
  restart: 'Neu starten',
  saveSlot: 'Speichern {n}',
  mainMenu: 'Hauptmenü',
  back: 'Zurück',
  graphics: 'Grafik',
  masterVolume: 'Gesamtlautstärke',
  musicVolume: 'Musik',
  effectsVolume: 'Effekte',
  voicesVolume: 'Sprache',
  mouseSensitivity: 'Maus-Empfindlichkeit',
  fullscreen: 'Vollbild',
  keys: 'Tastenbelegung',
  victory: 'Auftrag erfüllt!',
  defeat: 'Niederlage',
  loading: 'Lädt …',
  life: 'Leben',
};
const targets = { startScene: SCENE_VILLAGE, menuScene: SCENE_MENU, settingsUi: UI_SETTINGS };
const uiAssets = [
  [UI_MAIN, 'Hauptmenue', 'mainMenu'],
  [UI_PAUSE, 'Pausemenue', 'pauseMenu'],
  [UI_SETTINGS, 'Einstellungen', 'settings'],
  [UI_VICTORY, 'Sieg', 'victory'],
  [UI_DEFEAT, 'Niederlage', 'defeat'],
  [UI_LOADING, 'Ladebildschirm', 'loading'],
  [UI_HUD, 'HUD', 'hud'],
];
for (const [id, name, kind] of uiAssets) {
  const data = createUiTemplate(kind, labels, targets);
  if (kind === 'hud') {
    // The task of the quest, below the life bar (a text bound to a game variable).
    data.elements.splice(2, 0, {
      id: 'etask',
      name: 'Aufgabe',
      type: 'text',
      visible: true,
      anchorMin: [0, 0],
      anchorMax: [0, 0],
      pivot: [0, 0],
      offsetMin: [24, 92],
      offsetMax: [424, 122],
      text: 'Aufgabe: {value}',
      bind: { kind: 'variable', variable: VAR_TASK },
      align: 'left',
      fontSize: 18,
    });
  }
  if (kind === 'pauseMenu') {
    // Continuing also closes the settings.
    const walk = (list) => {
      for (const element of list) {
        if (element.text === labels.resume) {
          element.actions = [{ type: 'hideUi', ui: UI_SETTINGS }, ...(element.actions ?? [])];
        }
        walk(element.children ?? []);
      }
    };
    walk(data.elements);
  }
  project.adoptAsset(`Assets/UI/${name}.ui.json`, meta(id, 'ui'), { data });
}

/** An object that shows a UI canvas in a scene. */
const addCanvas = (scene, name, ui, visibility, order = 0) =>
  scene.add({
    name,
    parent: scene.area.ui,
    components: [comp('uiCanvas', { ui, visibility, sortOrder: order, player: 'all' })],
  });
for (const scene of [village, crypt_]) {
  addCanvas(scene, 'HUD', UI_HUD, 'always', 0);
  addCanvas(scene, 'Pausemenü', UI_PAUSE, 'paused', 5);
  addCanvas(scene, 'Einstellungen', UI_SETTINGS, 'manual', 10);
}
addCanvas(village, 'Sieg', UI_VICTORY, 'manual', 20);

// ------------------------------------------------------------------ main menu scene
const menu = createScene({
  ambientIntensity: 0.45,
  fog: { enabled: true, near: 40, far: 140 },
  sky: { timeOfDay: 17, dayLength: 0, sunAzimuth: 0 },
});
sun(menu);
ground(menu, 'Wiese', '#6f9a4a', [90, 90], [0, -0.5, 8]);
[
  ['building-home-a-red', -14, 6, 160],
  ['building-tavern-red', 0, 14, 180],
  ['building-home-b-blue', 14, 6, 200],
  ['building-well-blue', 0, 2, 0],
].forEach(([name, x, z, yaw]) => {
  model(
    menu,
    name.replace('building-', ''),
    `kaykit-medieval-hexagon/${name}`,
    [x, 0, z],
    yaw,
    1.5,
  );
});
for (let i = 0; i < 10; i++) {
  model(
    menu,
    `Baum ${i + 1}`,
    i % 2 ? 'kaykit-medieval-hexagon/tree-single-a' : 'kaykit-medieval-hexagon/tree-single-b',
    [-30 + i * 6.5, 0, 22 + (i % 3) * 3],
    i * 47,
    1.5,
  );
}
menu.add({
  name: 'Hauptkamera',
  parent: menu.area.player1,
  position: [0, 4, -16],
  rotation: [8, 0, 0],
  tag: 'MainCamera',
  components: [comp('camera', { fieldOfView: 55 }), comp('postProcessing')],
});
addCanvas(menu, 'Hauptmenü', UI_MAIN, 'always', 0);
addCanvas(menu, 'Einstellungen', UI_SETTINGS, 'manual', 10);
const musicMenu = menu.add({ name: 'Musik', parent: menu.area.environment });
attach(menu, musicMenu, 'questscrpt06');

// ------------------------------------------------------------------ write
const writeScene = (id, name, scene) =>
  project.adoptAsset(`Assets/Szenen/${name}.scene.json`, meta(id, 'scene'), {
    data: { formatVersion: 1, environment: scene.environment, objects: scene.objects },
  });
writeScene(SCENE_MENU, 'Hauptmenue', menu);
writeScene(SCENE_VILLAGE, 'Dorf', village);
writeScene(SCENE_CRYPT, 'Gruft', crypt_);

await project.save(new NodeFileSystem(folder));
console.log(
  JSON.stringify({
    village: Object.keys(village.objects).length,
    crypt: Object.keys(crypt_.objects).length,
    gate,
    mira,
  }),
);
