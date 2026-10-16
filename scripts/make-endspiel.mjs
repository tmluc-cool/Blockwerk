// Generates examples/endspiel: the final game of Blockwerk (SPEC phase 11). A main menu leads
// (through the loading screen) to an open landscape with a village, a lake and a day-night cycle.
// The hero is a figure from the Character Studio with two ability cards (double jump, roll).
// Three villagers talk, skeletons patrol, chase and fight, items go into the inventory, a second
// player can join in split screen, the game saves and loads, and it can be won and lost.
// Run with `npx tsx scripts/make-endspiel.mjs`. The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPrefabData,
  createUiTemplate,
  createVariantData,
  instantiatePrefab,
  resolvePrefab,
  updateInstanceOverrides,
} from '../packages/project/src/index.ts';
import { TerrainData, seededRandom } from '../packages/runtime/src/terrain/TerrainData.ts';
import { PARTICLE_PRESETS } from '../packages/runtime/src/effects/presets.ts';
import { b, workspace } from '../packages/compiler/test/dsl.ts';
import { createKit, meta, writeProject } from './lib/projectKit.mjs';

const folder = join(import.meta.dirname, '..', 'examples', 'endspiel');
rmSync(join(folder, 'Assets'), { recursive: true, force: true });

const kit = createKit('es');
const { oid, comp } = kit;
const lib = (name) => `library:${name}`;
const round = (value) => Math.round(value * 100) / 100;

// ------------------------------------------------------------------ ids
const SCENE_MENU = 'esszenmenu01';
const SCENE_LAND = 'esszenland01';
const TERRAIN = 'esterrain001';
const UI = {
  main: 'esuimain0001',
  pause: 'esuipause001',
  settings: 'esuisettin01',
  victory: 'esuivictory1',
  defeat: 'esuidefeat01',
  loading: 'esuiloading1',
  hud: 'esuihud00001',
};
const DIALOG = { mira: 'esdlgmira001', bork: 'esdlgbork001', pip: 'esdlgpip0001' };
const PREFAB = { skeleton: 'espfskelett1', warrior: 'espfkrieger1' };
const VAR = { task: 'esvartask001', quest: 'esvarquest01', potion: 'esvarbork001' };

// ------------------------------------------------------------------ terrain
const SIZE = 200;
const terrain = new TerrainData(129, SIZE);
terrain.generateHills(7, 11, 0.011);
const LAKE = { x: 38, z: -42, r: 24, depth: 12 };
terrain.carveBasin(LAKE.x, LAKE.z, LAKE.r, LAKE.depth);
const VILLAGE = { x: -30, z: 20 };
const RUIN = { x: 44, z: 46 };
const flatten = (spot, radius) => {
  const height = terrain.heightAt(spot.x, spot.z);
  for (let i = 0; i < 12; i++) {
    terrain.apply({ tool: 'flatten', x: spot.x, z: spot.z, radius, strength: 1, height });
  }
  return height;
};
const villageHeight = flatten(VILLAGE, 30);
flatten(RUIN, 15);
const lakeBottom = terrain.heightAt(LAKE.x, LAKE.z);
const WATER_LEVEL = Math.round((lakeBottom + LAKE.depth * 0.48) * 10) / 10;
terrain.autoPaint({ flat: 0, steep: 2, low: 3 }, WATER_LEVEL);
for (let i = 0; i < 4; i++) {
  terrain.apply({ tool: 'paint', x: VILLAGE.x, z: VILLAGE.z, radius: 9, strength: 1, layer: 1 });
  terrain.apply({ tool: 'paint', x: RUIN.x, z: RUIN.z, radius: 6, strength: 1, layer: 1 });
}
// A path from the village to the ruin.
for (let step = 0; step <= 40; step++) {
  const t = step / 40;
  terrain.apply({
    tool: 'paint',
    x: VILLAGE.x + (RUIN.x - VILLAGE.x) * t,
    z: VILLAGE.z + (RUIN.z - VILLAGE.z) * t,
    radius: 2.2,
    strength: 1,
    layer: 1,
  });
}
const groundAt = (x, z) => round(terrain.heightAt(x, z));
const keep = (x, z, spot, radius) => Math.hypot(x - spot.x, z - spot.z) < radius;

// ------------------------------------------------------------------ variables and scripts
const gameVar = (id, name, type, def) => ({
  id,
  name,
  type,
  scope: 'game',
  default: def,
  inspector: false,
  saved: true,
});
const V_TASK = gameVar(VAR.task, 'Aufgabe', 'string', 'Sprich mit Mira im Dorf');
const V_QUEST = gameVar(VAR.quest, 'Quest', 'number', 0);
const V_POTION = gameVar(VAR.potion, 'Trank erhalten', 'number', 0);

const scripts = [];
const addScript = (id, name, variables, ...stacks) =>
  scripts.push({ id, name, variables, workspace: workspace(...stacks) });

// The hero: drink a potion with H, and lose when the life is gone.
addScript(
  'esscripthero',
  'Held',
  [],
  [
    b('events.whenKey', { key: 'H', mode: 'pressed' }),
    b(
      'control.if',
      {},
      {
        condition: b('items.has', { target: 'self', item: 'Heiltrank' }),
        then: [
          b('items.remove', { target: 'self', item: 'Heiltrank' }, { count: 1 }),
          b('items.heal', { target: 'self' }, { amount: 40 }),
          b('sound.play', { sound: 'builtin:win', where: 'everywhere' }),
          b('effects.spawn', { effect: 'sparkle', at: 'self' }),
        ],
      },
    ),
  ],
  [
    b('items.whenHealth', { phase: 'died' }),
    b('sound.play', { sound: 'builtin:hurt', where: 'everywhere' }),
    b('control.wait', {}, { seconds: 1.2 }),
    b('ui.show', { ui: `ui:${UI.defeat}` }),
  ],
);

// Mira ends the game when the spell book is handed in.
addScript(
  'esscriptmira',
  'Mira',
  [V_TASK, V_QUEST, V_POTION],
  [
    b('dialog.whenAnswer', { answer: 'abgeben' }),
    b('effects.spawn', { effect: 'sparkle', at: 'self' }),
    b('sound.play', { sound: 'builtin:win', where: 'everywhere' }),
    b('control.wait', {}, { seconds: 1.5 }),
    b('ui.show', { ui: `ui:${UI.victory}` }),
  ],
);

// A skeleton growls when it starts chasing.
addScript(
  'esscriptskel',
  'Skelett Laute',
  [],
  [
    b('npc.whenState', { state: 'chase' }),
    b('sound.play', { sound: 'builtin:hurt', where: 'here' }),
  ],
);

// The game master: music, and Enter lets the second player join in split screen.
const joinScript = (p2, camera2) =>
  addScript(
    'esscriptmast',
    'Spielleiter',
    [],
    [b('events.whenGameStarts'), b('sound.playMusic', { sound: 'builtin:music-calm' })],
    [
      b('events.whenKey', { key: 'Enter', mode: 'pressed' }),
      b('looks.setActive', { action: 'activate', target: `object:${p2}` }),
      b('looks.setActive', { action: 'activate', target: `object:${camera2}` }),
      b('control.log', { level: 'info' }, { message: 'Spieler 2 ist dabei' }),
    ],
  );

addScript(
  'esscriptmusm',
  'Musik Menue',
  [],
  [b('events.whenGameStarts'), b('sound.playMusic', { sound: 'builtin:music-calm' })],
);

// ------------------------------------------------------------------ dialogs
const set = (variable, value) => ({ type: 'setVariable', variable, value });
const dialogs = [];
dialogs.push({
  id: DIALOG.mira,
  name: 'Mira',
  data: {
    formatVersion: 1,
    start: 'hallo',
    nodes: {
      hallo: {
        speaker: 'Mira',
        text: 'Willkommen in Birkenau, Fremder! Ich bin Mira, die Magierin. Kann ich etwas für dich tun, oder du etwas für mich?',
        answers: [
          {
            id: 'fragen',
            text: 'Was brauchst du?',
            next: 'auftrag',
            condition: { type: 'variable', variable: VAR.quest, op: '==', value: 0 },
          },
          {
            id: 'hinweis',
            text: 'Wo war das noch gleich?',
            next: 'tipp',
            condition: { type: 'variable', variable: VAR.quest, op: '==', value: 1 },
          },
          {
            id: 'abgeben',
            text: 'Ich habe dein Zauberbuch gefunden.',
            next: 'belohnung',
            condition: { type: 'hasItem', item: 'Zauberbuch', count: 1 },
            actions: [
              { type: 'removeItem', item: 'Zauberbuch', count: 1 },
              { type: 'addItem', item: 'Münze', count: 25 },
              set(VAR.quest, 2),
              set(VAR.task, 'Erledigt – das Dorf ist gerettet!'),
            ],
          },
          { id: 'tschuess', text: 'Auf Wiedersehen.', next: null },
        ],
        x: 0,
        y: 0,
      },
      auftrag: {
        speaker: 'Mira',
        text: 'Skelette haben mein Zauberbuch in die Ruine im Nordosten verschleppt. Folge dem Pfad. Bork, die Wache am Brunnen, kann dir einen Heiltrank geben, und mit Doppelsprung und Rolle kommst du an ihnen vorbei.',
        answers: [
          {
            id: 'annehmen',
            text: 'Ich hole es dir.',
            next: 'danke',
            actions: [set(VAR.quest, 1), set(VAR.task, 'Hole das Zauberbuch aus der Ruine')],
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
        text: 'Die Ruine liegt im Nordosten, am Ende des Pfads. Pass auf die Skelette auf!',
        answers: [],
        next: null,
        x: 360,
        y: 260,
      },
      belohnung: {
        speaker: 'Mira',
        text: 'Mein Zauberbuch! Hier sind 25 Münzen für dich. Das Dorf ist gerettet!',
        answers: [],
        next: null,
        x: 360,
        y: 520,
      },
    },
  },
});
dialogs.push({
  id: DIALOG.bork,
  name: 'Bork',
  data: {
    formatVersion: 1,
    start: 'hallo',
    nodes: {
      hallo: {
        speaker: 'Bork',
        text: 'Halt! Ich bin Bork, die Wache von Birkenau. Mit dem Schwert in der Hand (Taste F oder linke Maustaste) schlägst du Skelette in die Flucht.',
        answers: [
          {
            id: 'trank',
            text: 'Hast du etwas gegen Wunden?',
            next: 'gegeben',
            condition: { type: 'variable', variable: VAR.potion, op: '==', value: 0 },
            actions: [{ type: 'addItem', item: 'Heiltrank', count: 2 }, set(VAR.potion, 1)],
          },
          { id: 'tschuess', text: 'Danke, Bork.', next: null },
        ],
        x: 0,
        y: 0,
      },
      gegeben: {
        speaker: 'Bork',
        text: 'Hier, zwei Heiltränke aus dem Vorrat der Wache. Drück H, wenn es brenzlig wird.',
        answers: [],
        next: null,
        x: 360,
        y: 0,
      },
    },
  },
});
dialogs.push({
  id: DIALOG.pip,
  name: 'Pip',
  data: {
    formatVersion: 1,
    start: 'hallo',
    nodes: {
      hallo: {
        speaker: 'Pip',
        text: 'Psst! Ich bin Pip. Für fünf Münzen verkaufe ich dir einen Heiltrank. Die Münzen liegen überall im Dorf herum.',
        answers: [
          {
            id: 'kaufen',
            text: 'Einen Heiltrank, bitte.',
            next: 'verkauft',
            condition: { type: 'hasItem', item: 'Münze', count: 5 },
            actions: [
              { type: 'removeItem', item: 'Münze', count: 5 },
              { type: 'addItem', item: 'Heiltrank', count: 1 },
            ],
          },
          { id: 'tipp', text: 'Hast du einen Tipp?', next: 'tipp' },
          { id: 'tschuess', text: 'Später.', next: null },
        ],
        x: 0,
        y: 0,
      },
      verkauft: {
        speaker: 'Pip',
        text: 'Gute Wahl! Der Trank wirkt sofort.',
        answers: [],
        next: null,
        x: 360,
        y: 0,
      },
      tipp: {
        speaker: 'Pip',
        text: 'Spring zweimal, dann kommst du über jeden Zaun. Mit Q rollst du dich weg, wenn ein Skelett zuschlägt. Und wenn dein Freund Enter drückt, spielt ihr zu zweit.',
        answers: [],
        next: null,
        x: 360,
        y: 260,
      },
    },
  },
});

// ------------------------------------------------------------------ shared object builders
const heroComponents = (player, tint) => [
  comp('character', {
    attachments: 'library:kaykit-adventurers/sword-1handed@rightHand',
    bodyHeight: 1.8,
    model: lib('kaykit-adventurers/knight'),
    profile: 'arcade',
    shownGear: 'Knight_Helmet',
    tints: `Knight_Body=${tint};Knight_ArmLeft=${tint};Knight_ArmRight=${tint}`,
  }),
  comp('animator'),
  comp('characterController', { center: [0, 0.9, 0], height: 1.8, radius: 0.35 }),
  comp('thirdPersonControl', {
    acceleration: 25,
    airControl: 0.9,
    gravity: 18,
    jumpHeight: 1.8,
    rotationSmoothTime: 0.06,
    runSpeed: 6.5,
    walkSpeed: 3,
    ...(player === 2 ? { player: '2' } : {}),
  }),
  comp('doubleJump'),
  comp('roll'),
  comp('inventory'),
  comp('health', { max: 100, invulnerable: 0.8, onDeath: 'nothing' }),
  comp('meleeHit', { damage: 25, range: 2.4, cooldown: 0.5 }),
];

const attach = (scene, objectId, scriptId) =>
  scene.objects[objectId].components.push(comp('blockScript', { script: scriptId }));

const addCanvas = (scene, name, ui, visibility, order = 0) =>
  scene.add({
    name,
    parent: scene.area.ui,
    components: [comp('uiCanvas', { ui, visibility, sortOrder: order, player: 'all' })],
  });

// ------------------------------------------------------------------ the landscape scene
const land = kit.scene({
  ambientIntensity: 0.4,
  fog: { enabled: true, near: 70, far: 260 },
  // A day lasts four minutes: dawn, noon, dusk, night and dawn again.
  sky: { timeOfDay: 9, dayLength: 240, sunAzimuth: 0 },
  weather: { type: 'clear', intensity: 0, windSpeed: 3, windDirection: 70 },
  navigation: { agentRadius: 0.45, agentHeight: 1.9, maxClimb: 0.5, maxSlope: 40, cellSize: 0.5 },
});
const area = land.area;
land.add({
  name: 'Sonne',
  position: [0, 30, 0],
  rotation: [48, -35, 0],
  components: [comp('light', { lightType: 'directional' })],
});
land.add({
  name: 'Landschaft',
  components: [
    comp('terrain', { terrain: TERRAIN, revision: 0, grassDensity: 2.2, grassHeight: 0.6 }),
  ],
});
land.add({
  name: 'See',
  position: [LAKE.x, WATER_LEVEL, LAKE.z],
  components: [
    comp('water', { width: 84, depth: 84 }),
    comp('audioSource', {
      sound: 'builtin:ambient-stream',
      loop: true,
      volume: 0.7,
      minDistance: 8,
      maxDistance: 60,
    }),
  ],
});

/** A library model standing on the ground at x, z. */
const place = (name, model, x, z, yaw = 0, scale = 1, extra = [], parent = area.environment) =>
  land.add({
    name,
    parent,
    position: [round(x), groundAt(x, z), round(z)],
    rotation: [0, yaw, 0],
    scale: [scale, scale, scale],
    components: [comp('meshRenderer', { model: lib(model) }), ...extra],
  });
const boxCollider = (size, center) => comp('boxCollider', { size, center });

// The village Birkenau: houses around a plaza with a well.
const ring = [
  ['building-home-a-red', 0, 14, 180],
  ['building-home-b-blue', 12, 8, 235],
  ['building-home-a-yellow', 15, -3, 260],
  ['building-tavern-red', 8, -13, 330],
  ['building-home-b-green', -6, -15, 20],
  ['building-home-a-blue', -14, -6, 85],
  ['building-home-b-red', -15, 7, 110],
  ['building-church-blue', 0, -22, 0],
  ['building-market-red', -20, 18, 150],
  ['building-blacksmith-yellow', 20, 14, 215],
];
for (const [model, dx, dz, yaw] of ring) {
  place(
    model.replace('building-', ''),
    `kaykit-medieval-hexagon/${model}`,
    VILLAGE.x + dx,
    VILLAGE.z + dz,
    yaw,
    1,
    [boxCollider([3, 3, 3], [0, 1.5, 0])],
  );
}
place('Brunnen', 'kaykit-medieval-hexagon/building-well-blue', VILLAGE.x, VILLAGE.z, 0, 1, [
  boxCollider([2, 3, 2], [0, 1.5, 0]),
]);
place(
  'Windmuehle',
  'kaykit-medieval-hexagon/building-windmill-yellow',
  VILLAGE.x + 34,
  VILLAGE.z + 6,
  200,
  1.4,
  [boxCollider([4, 6, 4], [0, 3, 0])],
);
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2 + 0.3;
  place(
    `Fass ${i + 1}`,
    'kaykit-medieval-hexagon/barrel',
    VILLAGE.x + Math.cos(angle) * 5,
    VILLAGE.z + Math.sin(angle) * 5,
    i * 40,
    1.4,
    [comp('capsuleCollider', { center: [0, 0.4, 0], radius: 0.35, height: 0.8 })],
  );
}
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2 + 0.8;
  const x = VILLAGE.x + Math.cos(angle) * 9;
  const z = VILLAGE.z + Math.sin(angle) * 9;
  place(`Laterne ${i + 1}`, 'kaykit-halloween/post-lantern', x, z, (angle * 180) / Math.PI, 2, [
    comp('capsuleCollider', { center: [0, 1.5, 0], radius: 0.25, height: 3 }),
  ]);
  land.add({
    name: `Lampe ${i + 1}`,
    position: [round(x), round(groundAt(x, z) + 3.4), round(z)],
    components: [
      comp('light', {
        lightType: 'point',
        color: '#ffb866',
        intensity: 18,
        range: 14,
        castShadows: false,
      }),
    ],
  });
}
// A camp fire at the lake shore.
const camp = { x: LAKE.x - 31, z: LAKE.z + 8 };
land.add({
  name: 'Lagerfeuer',
  parent: area.items,
  position: [camp.x, groundAt(camp.x, camp.z) + 0.3, camp.z],
  components: [
    comp('particleSystem', { preset: 'fire', ...PARTICLE_PRESETS.fire }),
    comp('light', {
      lightType: 'point',
      color: '#ff8a3a',
      intensity: 14,
      range: 12,
      castShadows: false,
    }),
  ],
});
place('Zelt', 'kaykit-medieval-hexagon/tent', camp.x + 3, camp.z - 2, 120, 1.2, [
  boxCollider([2.4, 2, 2.4], [0, 1, 0]),
]);

// The ruin in the north-east where the book lies.
place('Ruine', 'kaykit-halloween/crypt', RUIN.x, RUIN.z + 4, 200, 1.4, [
  boxCollider([3.6, 4.8, 4.8], [0, 2.4, 0]),
]);
place('Torbogen', 'kaykit-halloween/arch-gate', RUIN.x - 2, RUIN.z - 6, 0, 1.6, [
  boxCollider([0.8, 3, 0.8], [-1.6, 1.5, 0]),
  boxCollider([0.8, 3, 0.8], [1.6, 1.5, 0]),
]);
[
  [-8, 2],
  [9, 4],
  [-6, 9],
  [7, -2],
].forEach(([dx, dz], index) => {
  place(
    `Grab ${index + 1}`,
    'kaykit-halloween/grave-a',
    RUIN.x + dx,
    RUIN.z + dz,
    index * 30,
    1.4,
    [boxCollider([1.2, 1.3, 0.6], [0, 0.65, 0])],
  );
});
land.add({
  name: 'Zauberbuch',
  parent: area.items,
  position: [RUIN.x + 2, groundAt(RUIN.x, RUIN.z) + 0.9, RUIN.z - 2],
  scale: [4, 4, 4],
  components: [
    comp('meshRenderer', { model: lib('kaykit-adventurers/spellbook-closed') }),
    comp('pickup', { item: 'Zauberbuch', count: 1, mode: 'interact', radius: 2.4, sound: 'coin' }),
    comp('sphereCollider', { isTrigger: true, radius: 0.6 }),
  ],
});

// Forest and rocks.
const random = seededRandom(4242);
const treeNames = [
  'kaykit-medieval-hexagon/tree-single-a',
  'kaykit-medieval-hexagon/tree-single-b',
];
const rockNames = ['a', 'b', 'c', 'd', 'e'].map((n) => `kaykit-medieval-hexagon/rock-single-${n}`);
let trees = 0;
for (let gz = -94; gz <= 94; gz += 5) {
  for (let gx = -94; gx <= 94; gx += 5) {
    const x = gx + (random() - 0.5) * 4;
    const z = gz + (random() - 0.5) * 4;
    const patch = Math.sin(x * 0.045 + 1.3) * Math.sin(z * 0.05 - 0.4) + Math.sin((x + z) * 0.03);
    if (patch < 0.15 || random() > 0.5) continue;
    if (keep(x, z, VILLAGE, 40) || keep(x, z, RUIN, 22) || keep(x, z, camp, 8)) continue;
    const height = terrain.heightAt(x, z);
    if (
      height < WATER_LEVEL + 1.2 ||
      terrain.slopeAt(x, z) > 0.45 ||
      terrain.weightAt(0, x, z) < 0.6
    ) {
      continue;
    }
    place(
      `Baum ${++trees}`,
      treeNames[random() < 0.5 ? 0 : 1],
      x,
      z,
      Math.floor(random() * 360),
      round(1.1 + random() * 0.9),
      [comp('capsuleCollider', { center: [0, 2, 0], radius: 0.4, height: 4 })],
    );
  }
}
let rocks = 0;
for (let i = 0; i < 36; i++) {
  const x = (random() - 0.5) * 180;
  const z = (random() - 0.5) * 180;
  if (keep(x, z, VILLAGE, 34) || keep(x, z, RUIN, 20) || terrain.heightAt(x, z) < WATER_LEVEL) {
    continue;
  }
  place(
    `Fels ${++rocks}`,
    rockNames[Math.floor(random() * rockNames.length)],
    x,
    z,
    Math.floor(random() * 360),
    round(1.5 + random() * 2.5),
    [comp('sphereCollider', { center: [0, 0.8, 0], radius: 1 })],
  );
}

// Coins and a chest with potions.
const coinSpots = [];
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  coinSpots.push([VILLAGE.x + Math.cos(angle) * 14, VILLAGE.z + Math.sin(angle) * 14]);
}
for (let i = 0; i <= 5; i++) {
  const t = (i + 1) / 7;
  coinSpots.push([VILLAGE.x + (RUIN.x - VILLAGE.x) * t + 2, VILLAGE.z + (RUIN.z - VILLAGE.z) * t]);
}
coinSpots.forEach(([x, z], index) => {
  land.add({
    name: `Muenze ${index + 1}`,
    parent: area.items,
    position: [round(x), round(groundAt(x, z) + 0.7), round(z)],
    scale: [1.5, 1.5, 1.5],
    components: [
      comp('meshRenderer', { model: lib('kaykit-prototype/coin-a') }),
      comp('pickup', { item: 'Münze', count: 1 }),
      comp('sphereCollider', { isTrigger: true, radius: 0.6 }),
    ],
  });
});
land.add({
  name: 'Truhe',
  parent: area.items,
  position: [VILLAGE.x + 6, groundAt(VILLAGE.x + 6, VILLAGE.z - 8), VILLAGE.z - 8],
  rotation: [0, 200, 0],
  components: [
    comp('meshRenderer', { model: lib('kaykit-dungeon/chest') }),
    boxCollider([1.2, 0.9, 1], [0, 0.45, 0]),
    comp('chest', { contents: 'Heiltrank:1', radius: 2.4 }),
  ],
});

// The villagers.
const villager = (name, model, dialog, spot, yaw) =>
  land.add({
    name,
    parent: area.npcs,
    position: [round(spot[0]), groundAt(spot[0], spot[1]), round(spot[1])],
    rotation: [0, yaw, 0],
    tag: 'NPC',
    components: [
      comp('meshRenderer', { model: lib(model) }),
      comp('animator'),
      comp('talkable', { dialog, name, radius: 3 }),
      boxCollider([0.8, 1.9, 0.8], [0, 0.95, 0]),
    ],
  });
const mira = villager(
  'Mira',
  'kaykit-adventurers/mage',
  DIALOG.mira,
  [VILLAGE.x - 4, VILLAGE.z - 7],
  150,
);
villager('Bork', 'kaykit-adventurers/barbarian', DIALOG.bork, [VILLAGE.x + 3, VILLAGE.z + 4], 200);
villager('Pip', 'kaykit-adventurers/rogue-hooded', DIALOG.pip, [VILLAGE.x + 9, VILLAGE.z - 11], 20);
attach(land, mira, 'esscriptmira');

// Skeletons: the prefab "Skelett" and a stronger variant.
const prefabData = new Map();
const prefabSource = (id) => prefabData.get(id) ?? null;
const prefabs = [];
const enemyScene = kit.scene({});
const enemyRoot = enemyScene.add({
  name: 'Skelett',
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
attach(enemyScene, enemyRoot, 'esscriptskel');
const enemyObjects = Object.fromEntries(
  Object.entries(enemyScene.objects).filter(([, object]) => object.area === undefined),
);
const { prefab: skeletonPrefab } = createPrefabData(enemyObjects, enemyRoot, oid);
prefabData.set(PREFAB.skeleton, skeletonPrefab);
prefabs.push({ id: PREFAB.skeleton, name: 'Skelett', data: skeletonPrefab });
{
  const base = resolvePrefab(PREFAB.skeleton, prefabSource);
  const variant = createVariantData(PREFAB.skeleton, base);
  const rootObject = base.objects[base.root];
  const idOf = (type) => rootObject.components.find((c) => c.type === type).id;
  variant.overrides = [
    { object: base.root, path: 'name', value: 'Skelett Krieger' },
    {
      object: base.root,
      path: `component:${idOf('meshRenderer')}:model`,
      value: lib('kaykit-skeletons/skeleton-warrior'),
    },
    { object: base.root, path: `component:${idOf('attack')}:damage`, value: 18 },
    { object: base.root, path: `component:${idOf('health')}:max`, value: 90 },
  ];
  prefabData.set(PREFAB.warrior, variant);
  prefabs.push({ id: PREFAB.warrior, name: 'Skelett Krieger', data: variant });
}

/** A patrol route: a parent object with ordered points as children. */
function makeRoute(name, points) {
  const route = land.add({ name, parent: area.items });
  points.forEach(([x, z], index) => {
    land.add({
      name: `Punkt ${index + 1}`,
      parent: route,
      position: [round(x), groundAt(x, z), round(z)],
    });
  });
  return route;
}
/** Places an instance of a skeleton prefab that patrols a route. */
function placeSkeleton(prefabId, name, spot, yaw, routeId) {
  const resolved = resolvePrefab(prefabId, prefabSource);
  const { rootId, objects } = instantiatePrefab(prefabId, resolved, {
    parent: area.npcs,
    order: land.nextOrder?.() ?? 0,
    transform: {
      position: [round(spot[0]), groundAt(spot[0], spot[1]), round(spot[1])],
      rotation: [0, yaw, 0],
    },
    createId: oid,
  });
  const root = objects[rootId];
  root.name = name;
  root.components.find((c) => c.type === 'patrol').values.route = routeId;
  Object.assign(land.objects, objects);
  Object.assign(land.objects, updateInstanceOverrides(land.objects, rootId, prefabSource));
  return rootId;
}
const routeA = makeRoute('Route Dorf Ost', [
  [VILLAGE.x + 26, VILLAGE.z - 6],
  [VILLAGE.x + 30, VILLAGE.z + 10],
  [VILLAGE.x + 22, VILLAGE.z + 22],
  [VILLAGE.x + 20, VILLAGE.z + 4],
]);
const routeB = makeRoute('Route Pfad', [
  [VILLAGE.x + 50, VILLAGE.z + 14],
  [VILLAGE.x + 56, VILLAGE.z + 22],
  [VILLAGE.x + 46, VILLAGE.z + 28],
]);
const routeC = makeRoute('Route Ruine', [
  [RUIN.x - 6, RUIN.z - 8],
  [RUIN.x + 8, RUIN.z - 8],
  [RUIN.x + 8, RUIN.z + 6],
  [RUIN.x - 6, RUIN.z + 6],
]);
const routeD = makeRoute('Route Ruine 2', [
  [RUIN.x + 4, RUIN.z + 12],
  [RUIN.x - 8, RUIN.z + 12],
  [RUIN.x - 8, RUIN.z - 2],
]);
placeSkeleton(PREFAB.skeleton, 'Skelett 1', [VILLAGE.x + 26, VILLAGE.z - 6], 0, routeA);
placeSkeleton(PREFAB.skeleton, 'Skelett 2', [VILLAGE.x + 50, VILLAGE.z + 14], 90, routeB);
placeSkeleton(PREFAB.warrior, 'Skelett Krieger 1', [RUIN.x - 6, RUIN.z - 8], 90, routeC);
placeSkeleton(PREFAB.warrior, 'Skelett Krieger 2', [RUIN.x + 4, RUIN.z + 12], 180, routeD);

// The players. Player 2 and the second camera are switched off until Enter is pressed.
// South of the well, facing north: the camera behind the hero has open ground, not the well.
const spawn = { x: VILLAGE.x + 2, z: VILLAGE.z - 9 };
const hero = land.add({
  name: 'Ritter',
  parent: area.player1,
  position: [spawn.x, round(groundAt(spawn.x, spawn.z) + 0.1), spawn.z],
  rotation: [0, 0, 0],
  tag: 'Player',
  components: heroComponents(1, '#3a6ea5'),
});
attach(land, hero, 'esscripthero');
land.add({
  name: 'Hauptkamera',
  parent: area.player1,
  position: [spawn.x, round(groundAt(spawn.x, spawn.z) + 3), spawn.z - 6],
  rotation: [15, 0, 0],
  tag: 'MainCamera',
  components: [
    comp('camera', { fieldOfView: 60, player: '1' }),
    comp('thirdPersonCamera'),
    comp('postProcessing'),
  ],
});
const hero2 = land.add({
  name: 'Ritterin',
  parent: area.player2,
  position: [spawn.x + 1.6, round(groundAt(spawn.x + 1.6, spawn.z) + 0.1), spawn.z],
  rotation: [0, 0, 0],
  tag: 'Player',
  components: heroComponents(2, '#a53a3a'),
});
land.objects[hero2].active = false;
const camera2 = land.add({
  name: 'Kamera Spieler 2',
  parent: area.player2,
  position: [spawn.x + 1.6, round(groundAt(spawn.x, spawn.z) + 3), spawn.z - 6],
  rotation: [15, 0, 0],
  components: [
    comp('camera', { fieldOfView: 60, player: '2' }),
    comp('thirdPersonCamera'),
    comp('postProcessing'),
  ],
});
land.objects[camera2].active = false;
const master = land.add({ name: 'Spielleiter', parent: area.items });
joinScript(hero2, camera2);
attach(land, master, 'esscriptmast');

// ------------------------------------------------------------------ UI canvases (menus and HUD)
const labels = {
  gameTitle: 'Das Dorf Birkenau',
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
  victory: 'Das Dorf ist gerettet!',
  defeat: 'Niederlage',
  loading: 'Lädt …',
  life: 'Leben',
};
const targets = { startScene: SCENE_LAND, menuScene: SCENE_MENU, settingsUi: UI.settings };
const uiAssets = [
  [UI.main, 'Hauptmenue', 'mainMenu'],
  [UI.pause, 'Pausemenue', 'pauseMenu'],
  [UI.settings, 'Einstellungen', 'settings'],
  [UI.victory, 'Sieg', 'victory'],
  [UI.defeat, 'Niederlage', 'defeat'],
  [UI.loading, 'Ladebildschirm', 'loading'],
  [UI.hud, 'HUD', 'hud'],
];
const textElement = (id, name, offsetMin, offsetMax, text, extra = {}) => ({
  id,
  name,
  type: 'text',
  visible: true,
  anchorMin: [0, 0],
  anchorMax: [0, 0],
  pivot: [0, 0],
  offsetMin,
  offsetMax,
  text,
  align: 'left',
  fontSize: 18,
  ...extra,
});
const uiData = [];
for (const [id, name, kind] of uiAssets) {
  const data = createUiTemplate(kind, labels, targets);
  if (kind === 'hud') {
    data.elements.splice(
      2,
      0,
      textElement('etask', 'Aufgabe', [24, 92], [424, 122], 'Aufgabe: {value}', {
        bind: { kind: 'variable', variable: VAR.task },
      }),
      textElement(
        'ehint',
        'Hinweis',
        [24, 130],
        [520, 156],
        'E sprechen · F schlagen · Q rollen · H Trank · Enter: Spieler 2',
        {
          fontSize: 14,
        },
      ),
    );
  }
  if (kind === 'pauseMenu') {
    const walk = (list) => {
      for (const element of list) {
        if (element.text === labels.resume) {
          element.actions = [{ type: 'hideUi', ui: UI.settings }, ...(element.actions ?? [])];
        }
        walk(element.children ?? []);
      }
    };
    walk(data.elements);
  }
  uiData.push({ id, name, data });
}
addCanvas(land, 'HUD', UI.hud, 'always', 0);
addCanvas(land, 'Pausemenue', UI.pause, 'paused', 5);
addCanvas(land, 'Einstellungen', UI.settings, 'manual', 10);
addCanvas(land, 'Sieg', UI.victory, 'manual', 20);
addCanvas(land, 'Niederlage', UI.defeat, 'manual', 20);

// ------------------------------------------------------------------ the main menu scene
const menu = kit.scene({
  ambientIntensity: 0.45,
  fog: { enabled: true, near: 40, far: 140 },
  sky: { timeOfDay: 17, dayLength: 0, sunAzimuth: 0 },
});
kit.sun(menu);
kit.box(menu, 'Wiese', [0, -0.5, 8], [90, 1, 90], '#6f9a4a');
[
  ['building-home-a-red', -14, 6, 160],
  ['building-tavern-red', 0, 14, 180],
  ['building-home-b-blue', 14, 6, 200],
  ['building-well-blue', 0, 2, 0],
].forEach(([name, x, z, yaw]) => {
  menu.add({
    name: name.replace('building-', ''),
    position: [x, 0, z],
    rotation: [0, yaw, 0],
    scale: [1.5, 1.5, 1.5],
    components: [
      comp('meshRenderer', { model: lib(`kaykit-medieval-hexagon/${name}`) }),
      comp('boxCollider', { size: [3, 3, 3], center: [0, 1.5, 0] }),
    ],
  });
});
for (let i = 0; i < 10; i++) {
  menu.add({
    name: `Baum ${i + 1}`,
    position: [-30 + i * 6.5, 0, 22 + (i % 3) * 3],
    rotation: [0, i * 47, 0],
    scale: [1.5, 1.5, 1.5],
    components: [
      comp('meshRenderer', { model: lib(treeNames[i % 2]) }),
      comp('capsuleCollider', { center: [0, 2, 0], radius: 0.4, height: 4 }),
    ],
  });
}
menu.add({
  name: 'Hauptkamera',
  parent: menu.area.player1,
  position: [0, 4, -16],
  rotation: [8, 0, 0],
  tag: 'MainCamera',
  components: [comp('camera', { fieldOfView: 55 }), comp('postProcessing')],
});
addCanvas(menu, 'Hauptmenue', UI.main, 'always', 0);
addCanvas(menu, 'Einstellungen', UI.settings, 'manual', 10);
const musicMenu = menu.add({ name: 'Musik', parent: menu.area.environment });
attach(menu, musicMenu, 'esscriptmusm');

// ------------------------------------------------------------------ write
await writeProject({
  folder,
  name: 'Endspiel',
  startScene: SCENE_MENU,
  graphicsLevel: 'high',
  scenes: [
    {
      id: SCENE_MENU,
      name: 'Hauptmenue',
      data: { formatVersion: 1, environment: menu.data.environment, objects: menu.objects },
    },
    {
      id: SCENE_LAND,
      name: 'Land',
      data: { formatVersion: 1, environment: land.data.environment, objects: land.objects },
    },
  ],
  scripts,
  prefabs,
  tags: ['Enemy', 'NPC'],
  prepare: (project) => {
    project.adoptAsset('Assets/Landschaften/Birkenau.terrain.bin', meta(TERRAIN, 'terrain'), {
      bytes: terrain.serialize(),
    });
    for (const { id, name, data } of uiData) {
      project.adoptAsset(`Assets/UI/${name}.ui.json`, meta(id, 'ui'), { data });
    }
    for (const { id, name, data } of dialogs) {
      project.adoptAsset(`Assets/Dialoge/${name}.dialog.json`, meta(id, 'dialog'), { data });
    }
  },
});
console.log(
  JSON.stringify({
    trees,
    rocks,
    land: Object.keys(land.objects).length,
    menu: Object.keys(menu.objects).length,
    waterLevel: WATER_LEVEL,
    villageGround: round(villageHeight),
  }),
);
