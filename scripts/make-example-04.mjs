// Generates examples/04-landschaft: a hill landscape with a lake, a forest, a village, a day-night
// cycle and rain. Run with `npx tsx scripts/make-example-04.mjs`. The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { Project } from '../packages/project/src/index.ts';
import { NodeFileSystem } from '../packages/project/src/node.ts';
import { TerrainData, seededRandom } from '../packages/runtime/src/terrain/TerrainData.ts';
import { PARTICLE_PRESETS } from '../packages/runtime/src/effects/presets.ts';
import { b, workspace } from '../packages/compiler/test/dsl.ts';

const folder = join(import.meta.dirname, '..', 'examples', '04-landschaft');
rmSync(join(folder, 'Assets'), { recursive: true, force: true });

// ------------------------------------------------------------------ terrain
const SIZE = 200;
const terrain = new TerrainData(129, SIZE);
terrain.generateHills(4, 13, 0.012);
const LAKE = { x: 34, z: -36, r: 24, depth: 12 };
terrain.carveBasin(LAKE.x, LAKE.z, LAKE.r, LAKE.depth);
const VILLAGE = { x: -30, z: 22 };
const villageHeight = terrain.heightAt(VILLAGE.x, VILLAGE.z);
for (let i = 0; i < 12; i++) {
  terrain.apply({
    tool: 'flatten',
    x: VILLAGE.x,
    z: VILLAGE.z,
    radius: 30,
    strength: 1,
    height: villageHeight,
  });
}
const lakeBottom = terrain.heightAt(LAKE.x, LAKE.z);
const WATER_LEVEL = Math.round((lakeBottom + LAKE.depth * 0.48) * 10) / 10;
terrain.autoPaint({ flat: 0, steep: 2, low: 3 }, WATER_LEVEL);
// A dirt plaza and paths in the village.
for (let i = 0; i < 4; i++) {
  terrain.apply({ tool: 'paint', x: VILLAGE.x, z: VILLAGE.z, radius: 9, strength: 1, layer: 1 });
}
for (let step = 0; step <= 12; step++) {
  const t = step / 12;
  terrain.apply({
    tool: 'paint',
    x: VILLAGE.x + (-40 - VILLAGE.x) * 0 + t * 70,
    z: VILLAGE.z - t * 40,
    radius: 2.5,
    strength: 1,
    layer: 1,
  });
}

// ------------------------------------------------------------------ ids
let objectCounter = 0;
let componentCounter = 0;
const oid = () => `ls${String(++objectCounter).padStart(10, '0')}`;
const cid = () => `lc${String(++componentCounter).padStart(10, '0')}`;
const comp = (type, values = {}) => ({ id: cid(), type, enabled: true, values });

const objects = {};
let order = 0;
function add({
  name,
  parent,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  components = [],
  tag = 'Untagged',
}) {
  const id = oid();
  objects[id] = {
    name,
    parent,
    order: order++,
    active: true,
    tag,
    layer: 'Default',
    static: false,
    transform: { position, rotation, scale },
    components,
  };
  return id;
}

const AREAS = ['environment', 'player1', 'player2', 'npcs', 'items', 'ui'];
const area = {};
for (const kind of AREAS) {
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

const round = (value) => Math.round(value * 100) / 100;
const groundAt = (x, z) => round(terrain.heightAt(x, z));
const lib = (name) => `library:${name}`;

// ------------------------------------------------------------------ project
const project = new Project({
  formatVersion: 1,
  name: 'Landschaft',
  startScene: 'landscene001',
  graphicsLevel: 'high',
});
const terrainMeta = {
  formatVersion: 1,
  id: 'landterrain1',
  type: 'terrain',
  importSettings: {},
  license: null,
};
project.adoptAsset('Assets/Landschaften/Landschaft.terrain.bin', terrainMeta, {
  bytes: terrain.serialize(),
});

// ------------------------------------------------------------------ environment
add({
  name: 'Sonne',
  parent: area.environment,
  position: [0, 30, 0],
  rotation: [48, -35, 0],
  components: [comp('light', { lightType: 'directional' })],
});
add({
  name: 'Landschaft',
  parent: area.environment,
  components: [
    comp('terrain', { terrain: 'landterrain1', revision: 0, grassDensity: 2.4, grassHeight: 0.6 }),
  ],
});
add({
  name: 'See',
  parent: area.environment,
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

// ------------------------------------------------------------------ village
const keep = (x, z, radius) => Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < radius;
const lamps = [];
const villageGround = round(villageHeight);
const placeModel = (
  name,
  model,
  x,
  z,
  yaw = 0,
  scale = 1,
  parent = area.environment,
  collider = null,
) => {
  const components = [comp('meshRenderer', { model: lib(model) })];
  if (collider) components.push(comp('boxCollider', collider));
  return add({
    name,
    parent,
    position: [round(x), groundAt(x, z), round(z)],
    rotation: [0, yaw, 0],
    scale: [scale, scale, scale],
    components,
  });
};
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
  placeModel(
    model.replace('building-', ''),
    `kaykit-medieval-hexagon/${model}`,
    VILLAGE.x + dx,
    VILLAGE.z + dz,
    yaw,
    1,
    area.environment,
    { size: [3, 3, 3], center: [0, 1.5, 0] },
  );
}
placeModel(
  'Brunnen',
  'kaykit-medieval-hexagon/building-well-blue',
  VILLAGE.x,
  VILLAGE.z,
  0,
  1,
  area.environment,
  { size: [2, 3, 2], center: [0, 1.5, 0] },
);
placeModel(
  'Windmühle',
  'kaykit-medieval-hexagon/building-windmill-yellow',
  VILLAGE.x + 34,
  VILLAGE.z + 6,
  200,
  1.4,
  area.environment,
  { size: [4, 6, 4], center: [0, 3, 0] },
);
for (let i = 0; i < 6; i++) {
  const angle = (i / 6) * Math.PI * 2 + 0.3;
  placeModel(
    `Fass ${i + 1}`,
    'kaykit-medieval-hexagon/barrel',
    VILLAGE.x + Math.cos(angle) * 5,
    VILLAGE.z + Math.sin(angle) * 5,
    i * 40,
    1.4,
  );
}
for (let i = 0; i < 4; i++) {
  const angle = (i / 4) * Math.PI * 2 + 0.8;
  const x = VILLAGE.x + Math.cos(angle) * 9;
  const z = VILLAGE.z + Math.sin(angle) * 9;
  const post = placeModel(
    `Laterne ${i + 1}`,
    'kaykit-halloween/post-lantern',
    x,
    z,
    (angle * 180) / Math.PI,
    2,
  );
  const lamp = add({
    name: `Lampe ${i + 1}`,
    parent: area.environment,
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
  lamps.push(lamp);
  void post;
}
// Camp fire at the lake shore with fire, smoke and a warm light.
const camp = { x: LAKE.x - 31, z: LAKE.z + 6 };
const campY = groundAt(camp.x, camp.z);
add({
  name: 'Lagerfeuer',
  parent: area.items,
  position: [camp.x, campY + 0.3, camp.z],
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
add({
  name: 'Rauch',
  parent: area.items,
  position: [camp.x, campY + 1.2, camp.z],
  components: [comp('particleSystem', { preset: 'smoke', ...PARTICLE_PRESETS.smoke })],
});
placeModel('Zelt', 'kaykit-medieval-hexagon/tent', camp.x + 3, camp.z - 2, 120, 1.2);

// ------------------------------------------------------------------ forest and rocks
const random = seededRandom(1234);
const treeNames = [
  'kaykit-medieval-hexagon/tree-single-a',
  'kaykit-medieval-hexagon/tree-single-b',
];
const rockNames = [
  'rock-single-a',
  'rock-single-b',
  'rock-single-c',
  'rock-single-d',
  'rock-single-e',
].map((n) => `kaykit-medieval-hexagon/${n}`);
let trees = 0;
for (let gz = -94; gz <= 94; gz += 4.6) {
  for (let gx = -94; gx <= 94; gx += 4.6) {
    const x = gx + (random() - 0.5) * 4;
    const z = gz + (random() - 0.5) * 4;
    // Forest patches: coarse noise decides where trees stand.
    const patch = Math.sin(x * 0.045 + 1.3) * Math.sin(z * 0.05 - 0.4) + Math.sin((x + z) * 0.03);
    if (patch < 0.15 || random() > 0.55) continue;
    if (keep(x, z, 40)) continue;
    const height = terrain.heightAt(x, z);
    if (
      height < WATER_LEVEL + 1.2 ||
      terrain.slopeAt(x, z) > 0.45 ||
      terrain.weightAt(0, x, z) < 0.6
    )
      continue;
    if (Math.hypot(x - camp.x, z - camp.z) < 8) continue;
    const scale = round(1.1 + random() * 0.9);
    const tree = placeModel(
      `Baum ${++trees}`,
      treeNames[random() < 0.5 ? 0 : 1],
      x,
      z,
      Math.floor(random() * 360),
      scale,
      area.environment,
      null,
    );
    objects[tree].components.push(
      comp('capsuleCollider', { center: [0, 2, 0], radius: 0.4, height: 4 }),
    );
  }
}
let rocks = 0;
for (let i = 0; i < 40; i++) {
  const x = (random() - 0.5) * 180;
  const z = (random() - 0.5) * 180;
  const height = terrain.heightAt(x, z);
  if (keep(x, z, 36) || height < WATER_LEVEL - 0.5) continue;
  placeModel(
    `Fels ${++rocks}`,
    rockNames[Math.floor(random() * rockNames.length)],
    x,
    z,
    Math.floor(random() * 360),
    round(1.5 + random() * 2.5),
  );
}

// ------------------------------------------------------------------ player and camera
const spawn = { x: VILLAGE.x + 4, z: VILLAGE.z - 8 };
add({
  name: 'Ritter',
  parent: area.player1,
  position: [spawn.x, round(terrain.heightAt(spawn.x, spawn.z) + 0.1), spawn.z],
  rotation: [0, 160, 0],
  tag: 'Player',
  components: [
    comp('meshRenderer', { model: lib('kaykit-adventurers/knight') }),
    comp('animator'),
    comp('characterController', { center: [0, 0.9, 0], height: 1.8, radius: 0.35 }),
    comp('thirdPersonControl'),
  ],
});
add({
  name: 'Hauptkamera',
  parent: area.player1,
  position: [spawn.x, round(terrain.heightAt(spawn.x, spawn.z) + 3), spawn.z - 6],
  rotation: [15, 0, 0],
  tag: 'MainCamera',
  components: [
    comp('camera', { fieldOfView: 60 }),
    comp('thirdPersonCamera'),
    comp('postProcessing'),
  ],
});
const hero = Object.keys(objects).find((key) => objects[key].name === 'Ritter');
const camera = Object.keys(objects).find((key) => objects[key].name === 'Hauptkamera');
void camera;

// ------------------------------------------------------------------ block scripts
const weatherScript = workspace([
  b('events.whenGameStarts'),
  b('environment.setTimeOfDay', {}, { hours: 8 }),
  b('environment.setTimeSpeed', {}, { factor: 480 }),
  b('sound.playMusic', { sound: 'builtin:music-calm' }),
  b(
    'control.forever',
    {},
    {
      body: [
        b('control.wait', {}, { seconds: 45 }),
        b('environment.setWeather', { weather: 'rain' }, { seconds: 12 }),
        b('control.wait', {}, { seconds: 40 }),
        b('environment.setWeather', { weather: 'clear' }, { seconds: 12 }),
      ],
    },
  ),
]);
const lampTargets = lamps.map((lamp) => `object:${lamp}`);
const nightCondition = () =>
  b(
    'operators.or',
    {},
    {
      a: b('operators.gt', {}, { a: b('environment.timeOfDay'), b: 18.5 }),
      b: b('operators.lt', {}, { a: b('environment.timeOfDay'), b: 5.5 }),
    },
  );
const lampScript = workspace([
  b('events.whenGameStarts'),
  b(
    'control.forever',
    {},
    {
      body: [
        b(
          'control.ifElse',
          {},
          {
            condition: nightCondition(),
            then: lampTargets.map((target) => b('environment.setLight', { target, state: 'on' })),
            else: lampTargets.map((target) => b('environment.setLight', { target, state: 'off' })),
          },
        ),
        b('control.wait', {}, { seconds: 1 }),
      ],
    },
  ),
]);
const hitScript = workspace(
  [
    b('events.whenKey', { key: 'F', mode: 'pressed' }),
    b('effects.spawn', { effect: 'sparks', at: 'self' }),
    b('sound.play', { sound: 'builtin:hit', where: 'here' }),
    b('camera.shake', {}, { strength: 1.5, seconds: 0.3 }),
  ],
  [
    b('events.whenKey', { key: 'E', mode: 'pressed' }),
    b('effects.spawn', { effect: 'explosion', at: 'self' }),
    b('sound.play', { sound: 'builtin:explosion', where: 'here' }),
    b('camera.shake', {}, { strength: 3, seconds: 0.6 }),
  ],
);
const scripts = [
  ['Wetter und Zeit', weatherScript, 'landscript01'],
  ['Laternen', lampScript, 'landscript02'],
  ['Schlag', hitScript, 'landscript03'],
];
for (const [name, workspaceJson, id] of scripts) {
  project.adoptAsset(
    `Assets/Block-Skripte/${name}.blocks.json`,
    { formatVersion: 1, id, type: 'blockScript', importSettings: {}, license: null },
    {
      data: { formatVersion: 1, variables: [], workspace: workspaceJson },
    },
  );
}
const attach = (objectId, scriptId) =>
  objects[objectId].components.push(comp('blockScript', { script: scriptId }));
const weatherObject = add({ name: 'Wetter', parent: area.environment, components: [] });
attach(weatherObject, 'landscript01');
attach(weatherObject, 'landscript02');
attach(hero, 'landscript03');

// ------------------------------------------------------------------ scene
project.adoptAsset(
  'Assets/Szenen/Landschaft.scene.json',
  { formatVersion: 1, id: 'landscene001', type: 'scene', importSettings: {}, license: null },
  {
    data: {
      formatVersion: 1,
      environment: {
        ambientIntensity: 0.4,
        fog: { enabled: true, near: 70, far: 260 },
        sky: { timeOfDay: 8, dayLength: 0, sunAzimuth: 0 },
        weather: { type: 'clear', intensity: 0, windSpeed: 3, windDirection: 70 },
      },
      objects,
    },
  },
);
await project.save(new NodeFileSystem(folder));
console.log(
  JSON.stringify({
    trees,
    rocks,
    objects: Object.keys(objects).length,
    waterLevel: WATER_LEVEL,
    lakeBottom,
    villageGround,
    range: terrain.heightRange(),
  }),
);
