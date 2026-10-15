// Generates examples/07-gross: a trading town with 85+ block scripts over all areas, a script
// library with project-wide custom blocks, lists, dictionaries, local variables and code blocks.
// Run with `npx tsx scripts/make-example-07.mjs`. The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  Project,
  createPrefabData,
  createUiTemplate,
  instantiatePrefab,
  resolvePrefab,
  updateInstanceOverrides,
} from '../packages/project/src/index.ts';
import { NodeFileSystem } from '../packages/project/src/node.ts';
import { b, call, define, param, workspace } from '../packages/compiler/test/dsl.ts';

const folder = join(import.meta.dirname, '..', 'examples', '07-gross');
rmSync(join(folder, 'Assets'), { recursive: true, force: true });

// ------------------------------------------------------------------ ids and helpers
const SCENE_MARKET = 'grossmarkt01';
const LIB_SCRIPT = 'grosslib0001';
const PREFAB_STALL = 'grossstand01';
const UI_HUD = 'grossuihud01';
const UI_SHOP = 'grossuishop1';
const UI_PAUSE = 'grossuipaus1';
const UI_SETTINGS = 'grossuiset01';

const VAR_COINS = 'grossvmuenz1';
const VAR_PRICES = 'grossvpreis1';
const VAR_BAG = 'grossvsack01';
const VAR_MESSAGE = 'grossvmeld01';
const VAR_DAY = 'grossvtag001';

let objectCounter = 0;
let componentCounter = 0;
const prefixed = (prefix, counter) =>
  `${prefix}${String(counter).padStart(12 - prefix.length, '0')}`;
const oid = () => prefixed('go', ++objectCounter);
const cid = () => prefixed('gc', ++componentCounter);
const comp = (type, values = {}) => ({ id: cid(), type, enabled: true, values });
const round = (value) => Math.round(value * 100) / 100;
const lib = (name) => `library:${name}`;

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
  name: 'Handelsstadt',
  startScene: SCENE_MARKET,
  graphicsLevel: 'high',
});
project.tagsAndLayers = {
  formatVersion: 1,
  layers: [],
  tags: ['Enemy', 'NPC', 'Spawn', 'Haendler'],
};
const meta = (id, type) => ({ formatVersion: 1, id, type, importSettings: {}, license: null });

// ------------------------------------------------------------------ variables and scripts
const gameVar = (id, name, type, def, saved = false) => ({
  id,
  name,
  type,
  scope: 'game',
  default: def,
  inspector: false,
  ...(saved ? { saved: true } : {}),
});

const PRICES = {
  Brot: 3,
  Apfel: 2,
  Schwert: 40,
  Trank: 12,
  Karte: 25,
  Fackel: 6,
  Seil: 4,
  Helm: 30,
  Schild: 28,
  Pfeil: 1,
  Zelt: 18,
  Laterne: 9,
};
const V_COINS = gameVar(VAR_COINS, 'Münzen', 'number', 50, true);
const V_PRICES = gameVar(VAR_PRICES, 'Preise', 'dictionary', PRICES);
const V_BAG = gameVar(VAR_BAG, 'Rucksack', 'list', [], true);
const V_MESSAGE = gameVar(VAR_MESSAGE, 'Meldung', 'string', '');
const V_DAY = gameVar(VAR_DAY, 'Tag', 'number', 1, true);
const ALL_VARS = [V_COINS, V_PRICES, V_BAG, V_MESSAGE, V_DAY];

const scriptAssets = [];
let scriptCounter = 0;
/** Adds a block script; every script gets its own ID and file. */
function addScript(name, variables, ...scripts) {
  const id = prefixed('grossscr', ++scriptCounter);
  scriptAssets.push({ id, name, variables, workspace: workspace(...scripts) });
  return id;
}

const v = (id) => ({ id });
const getVar = (id) => b('variables.get', { variable: v(id) });
const setVar = (id, value) => b('variables.set', { variable: v(id) }, { value });
const changeVar = (id, by) => b('variables.change', { variable: v(id) }, { by });
const concat = (a, c) => b('operators.join', {}, { a, b: c });
const say = (text) => call('Command', 'def-say', [text], LIB_SCRIPT);
const earn = (amount) => call('Command', 'def-earn', [amount], LIB_SCRIPT);
const buy = (ware) => call('Command', 'def-buy', [ware], LIB_SCRIPT);
const playSound = (name) => b('sound.play', { sound: `builtin:${name}`, where: 'everywhere' });
const wait = (seconds) => b('control.wait', {}, { seconds });
const random = (from, to) => b('sensing.random', {}, { from, to });

// The library: project-wide custom blocks ("My Blocks"), usable in every script.
scriptAssets.push({
  id: LIB_SCRIPT,
  name: 'Werkzeuge',
  variables: ALL_VARS,
  workspace: workspace(
    // Message line of the HUD.
    [
      define('Command', 'Meldung zeigen', 'def-say', {
        params: [{ name: 'text', type: 'string' }],
        scope: 'project',
      }),
      setVar(VAR_MESSAGE, param('text')),
    ],
    // Change the coins and play the coin sound.
    [
      define('Command', 'Münzen ändern', 'def-earn', {
        params: [{ name: 'menge', type: 'number' }],
        scope: 'project',
      }),
      changeVar(VAR_COINS, param('menge')),
      playSound('coin'),
    ],
    // The price of a ware from the dictionary.
    [
      define('Value', 'Preis von', 'def-price', {
        params: [{ name: 'ware', type: 'string' }],
        returns: 'number',
        scope: 'project',
      }),
      b(
        'custom.return',
        {},
        { value: b('data.dictGet', {}, { key: param('ware'), dictionary: getVar(VAR_PRICES) }) },
      ),
    ],
    // Buying: uses the blocks above (a custom block that calls custom blocks).
    [
      define('Command', 'Kaufen', 'def-buy', {
        params: [{ name: 'ware', type: 'string' }],
        scope: 'project',
      }),
      b(
        'control.ifElse',
        {},
        {
          condition: b(
            'operators.not',
            {},
            {
              value: b(
                'operators.lt',
                {},
                {
                  a: getVar(VAR_COINS),
                  b: call('Value', 'def-price', [param('ware')], LIB_SCRIPT),
                },
              ),
            },
          ),
          then: [
            earn(
              b(
                'operators.subtract',
                {},
                { a: 0, b: call('Value', 'def-price', [param('ware')], LIB_SCRIPT) },
              ),
            ),
            b('data.listAdd', {}, { item: param('ware'), list: getVar(VAR_BAG) }),
            say(concat('Gekauft: ', param('ware'))),
          ],
          else: [say(concat('Zu wenig Münzen für ', param('ware'))), playSound('hurt')],
        },
      ),
    ],
    // A condition.
    [
      define('Condition', 'Reich?', 'def-rich', { scope: 'project' }),
      b(
        'custom.return',
        {},
        {
          value: b(
            'operators.not',
            {},
            { value: b('operators.lt', {}, { a: getVar(VAR_COINS), b: 100 }) },
          ),
        },
      ),
    ],
    // Average of a list, with local variables and a loop.
    [
      define('Value', 'Durchschnitt', 'def-average', {
        params: [{ name: 'liste', type: 'list' }],
        returns: 'number',
        scope: 'project',
      }),
      b('locals.declare', { name: 'summe' }, { value: 0 }),
      b('locals.declare', { name: 'anzahl' }, { value: 0 }),
      b(
        'data.forEachItem',
        { name: 'eintrag' },
        {
          list: param('liste'),
          body: [
            b('locals.change', { name: 'summe' }, { by: b('locals.get', { name: 'eintrag' }) }),
            b('locals.change', { name: 'anzahl' }, { by: 1 }),
          ],
        },
      ),
      b(
        'control.ifElse',
        {},
        {
          condition: b('operators.eq', {}, { a: b('locals.get', { name: 'anzahl' }), b: 0 }),
          then: [b('custom.return', {}, { value: 0 })],
          else: [
            b(
              'custom.return',
              {},
              {
                value: b(
                  'operators.divide',
                  {},
                  {
                    a: b('locals.get', { name: 'summe' }),
                    b: b('locals.get', { name: 'anzahl' }),
                  },
                ),
              },
            ),
          ],
        },
      ),
    ],
    // Dice without screen refresh: all throws in one tick.
    [
      define('Value', 'Würfel-Summe', 'def-dice', {
        params: [{ name: 'anzahl', type: 'number' }],
        returns: 'number',
        warp: true,
        scope: 'project',
      }),
      b('locals.declare', { name: 'summe' }, { value: 0 }),
      b(
        'control.repeat',
        {},
        {
          times: param('anzahl'),
          body: [b('locals.change', { name: 'summe' }, { by: random(1, 6) })],
        },
      ),
      b('custom.return', {}, { value: b('locals.get', { name: 'summe' }) }),
    ],
  ),
});

// ------------------------------------------------------------------ the market scene
const market = createScene({
  ambientIntensity: 0.4,
  fog: { enabled: true, near: 60, far: 160 },
  sky: { timeOfDay: 9, dayLength: 0, sunAzimuth: 0 },
  navigation: { agentRadius: 0.45, agentHeight: 1.9, maxClimb: 0.4, maxSlope: 45, cellSize: 0.3 },
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

market.add({
  name: 'Sonne',
  parent: market.area.environment,
  position: [0, 30, 0],
  rotation: [50, -30, 0],
  components: [comp('light', { lightType: 'directional' })],
});
market.add({
  name: 'Wiese',
  parent: market.area.environment,
  position: [0, -0.5, 0],
  scale: [100, 1, 100],
  isStatic: true,
  components: [
    comp('meshRenderer', { shape: 'cube', color: '#7aa24f', smoothness: 0.1 }),
    comp('boxCollider'),
  ],
});

// -- environment: 14 scripts --------------------------------------------------------------
const environmentScripts = [
  addScript(
    'Tagesablauf',
    [V_DAY],
    [
      b('events.whenGameStarts'),
      b('environment.setTimeOfDay', {}, { hours: 8 }),
      b('environment.setTimeSpeed', {}, { factor: 240 }),
      b(
        'control.forever',
        {},
        {
          body: [
            b(
              'control.waitUntil',
              {},
              {
                condition: b('operators.lt', {}, { a: b('environment.timeOfDay'), b: 1 }),
              },
            ),
            changeVar(VAR_DAY, 1),
            wait(5),
          ],
        },
      ),
    ],
  ),
  addScript(
    'Wetterwechsel',
    [],
    [
      b('events.whenGameStarts'),
      b(
        'control.forever',
        {},
        {
          body: [
            wait(45),
            b('environment.setWeather', { weather: 'rain' }, { seconds: 5 }),
            wait(25),
            b('environment.setWeather', { weather: 'clear' }, { seconds: 5 }),
          ],
        },
      ),
    ],
  ),
  addScript(
    'Glocken',
    [],
    [
      b('events.whenGameStarts'),
      b('control.forever', {}, { body: [wait(30), playSound('whoosh'), playSound('click')] }),
    ],
  ),
  addScript(
    'Wind',
    [],
    [
      b('events.whenGameStarts'),
      b(
        'control.forever',
        {},
        {
          body: [
            b('environment.setWind', {}, { speed: random(1, 8), direction: random(0, 360) }),
            wait(10),
          ],
        },
      ),
    ],
  ),
  addScript(
    'Morgennebel',
    [],
    [
      b('events.whenGameStarts'),
      b('environment.setFogDensity', {}, { percent: 25 }),
      wait(20),
      b('environment.setFogDensity', {}, { percent: 5 }),
    ],
  ),
  addScript(
    'Sonnenhelligkeit',
    [],
    [
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
                condition: b(
                  'operators.or',
                  {},
                  {
                    a: b('operators.lt', {}, { a: b('environment.timeOfDay'), b: 6 }),
                    b: b('operators.gt', {}, { a: b('environment.timeOfDay'), b: 20 }),
                  },
                ),
                then: [b('environment.setSunBrightness', {}, { percent: 20 })],
                else: [b('environment.setSunBrightness', {}, { percent: 100 })],
              },
            ),
            wait(5),
          ],
        },
      ),
    ],
  ),
];
for (let i = 1; i <= 6; i++) {
  // One script per lantern: on at night, off by day.
  environmentScripts.push(
    addScript(
      `Laterne ${i}`,
      [],
      [
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
                  condition: b(
                    'operators.or',
                    {},
                    {
                      a: b('operators.lt', {}, { a: b('environment.timeOfDay'), b: 6 }),
                      b: b('operators.gt', {}, { a: b('environment.timeOfDay'), b: 18 }),
                    },
                  ),
                  then: [b('environment.setLight', { state: 'on' })],
                  else: [b('environment.setLight', { state: 'off' })],
                },
              ),
              wait(2 + (i % 3)),
            ],
          },
        ),
      ],
    ),
  );
}
environmentScripts.push(
  addScript(
    'Sternschnuppe',
    [],
    [
      b('events.whenGameStarts'),
      b(
        'control.forever',
        {},
        { body: [wait(random(20, 40)), b('effects.spawn', { effect: 'sparkle' })] },
      ),
    ],
  ),
  addScript(
    'Musikwechsel',
    [],
    [
      b('events.whenGameStarts'),
      b('sound.playMusic', { sound: 'builtin:music-calm' }),
      b(
        'control.forever',
        {},
        {
          body: [
            wait(60),
            b('sound.crossfadeMusic', { sound: 'builtin:music-adventure' }, { seconds: 4 }),
            wait(60),
            b('sound.crossfadeMusic', { sound: 'builtin:music-calm' }, { seconds: 4 }),
          ],
        },
      ),
    ],
  ),
);
// Scripts without an object of their own live on small helper objects.
const helperNames = ['Tagesablauf', 'Wetter', 'Glocken', 'Wind', 'Nebel', 'Sonnenlicht'];
helperNames.forEach((name, index) => {
  const holder = market.add({ name, parent: market.area.environment });
  attach(market, holder, environmentScripts[index]);
});
// Lanterns: model, light and script on one object each.
for (let i = 1; i <= 6; i++) {
  const x = -15 + (i - 1) * 6;
  model(market, `Laterne ${i}`, 'kaykit-halloween/post-lantern', [x, 0, -8], 0, 1);
  const light = market.add({
    name: `Licht ${i}`,
    parent: market.area.environment,
    position: [x, 2.6, -8],
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
  attach(market, light, environmentScripts[5 + i]);
}
const shooting = market.add({
  name: 'Himmel',
  parent: market.area.environment,
  position: [0, 40, 0],
});
attach(market, shooting, environmentScripts[12]);
const musicHolder = market.add({ name: 'Musik', parent: market.area.environment });
attach(market, musicHolder, environmentScripts[13]);

// Houses and trees give the town its shape.
const houseModels = [
  'building-home-a-red',
  'building-home-b-blue',
  'building-home-a-yellow',
  'building-tavern-red',
  'building-market-red',
  'building-blacksmith-yellow',
];
const houseScripts = [];
for (let i = 1; i <= 12; i++) {
  const column = (i - 1) % 6;
  const row = Math.floor((i - 1) / 6);
  const position = [-25 + column * 10, 0, 22 + row * 12];
  const house = model(
    market,
    `Haus ${i}`,
    `kaykit-medieval-hexagon/${houseModels[(i - 1) % houseModels.length]}`,
    position,
    180,
    1.4,
    [comp('boxCollider', { size: [3, 3.5, 3], center: [0, 1.75, 0] })],
    market.area.items,
  );
  const door = market.add({
    name: `Eingang ${i}`,
    parent: market.area.items,
    position: [position[0], 1, position[2] - 3.2],
    components: [comp('boxCollider', { isTrigger: true, size: [3, 2, 1.6] })],
  });
  houseScripts.push(
    addScript(
      `Haus ${i}`,
      [V_COINS],
      [
        b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
        say(`Haus ${i}: Willkommen!`),
        playSound('click'),
        b(
          'control.if',
          {},
          {
            condition: b('operators.eq', {}, { a: b('operators.mod', {}, { a: i, b: 4 }), b: 0 }),
            then: [earn(1)],
          },
        ),
      ],
    ),
  );
  attach(market, door, houseScripts[i - 1]);
  void house;
}
for (let i = 0; i < 16; i++) {
  const angle = (i / 16) * Math.PI * 2;
  model(
    market,
    `Baum ${i + 1}`,
    i % 2 ? 'kaykit-medieval-hexagon/tree-single-a' : 'kaykit-medieval-hexagon/tree-single-b',
    [Math.cos(angle) * 44, 0, Math.sin(angle) * 44],
    i * 53,
    1.5,
    [comp('capsuleCollider', { center: [0, 2, 0], radius: 0.4, height: 4 })],
  );
}

// -- player 1: 8 scripts ------------------------------------------------------------------
const knight = (scene, parent, position, tag = 'Player') => {
  const id = scene.add({
    name: tag === 'Player' ? 'Ritter' : 'Begleiter',
    parent,
    position,
    tag,
    components: [
      comp('meshRenderer', { model: lib('kaykit-adventurers/knight') }),
      comp('animator'),
      comp('characterController', { center: [0, 0.9, 0], height: 1.8, radius: 0.35 }),
      ...(tag === 'Player' ? [comp('thirdPersonControl'), comp('inventory')] : []),
      comp('health', { max: 100, invulnerable: 0.8, onDeath: 'respawn', respawnDelay: 2 }),
    ],
  });
  return id;
};
const hero = knight(market, market.area.player1, [0, 0.1, -20]);
market.add({
  name: 'Hauptkamera',
  parent: market.area.player1,
  position: [0, 3.1, -26],
  rotation: [15, 0, 0],
  tag: 'MainCamera',
  components: [
    comp('camera', { fieldOfView: 60 }),
    comp('thirdPersonCamera'),
    comp('postProcessing'),
  ],
});
const playerScripts = [
  addScript(
    'Spieler Start',
    [V_COINS],
    [b('events.whenGameStarts'), say('Willkommen auf dem Markt! H für Hilfe.')],
  ),
  addScript(
    'Springen mit Staub',
    [],
    [
      b('events.whenAction', { action: 'jump', phase: 'pressed', player: 'any' }),
      b('effects.spawn', { effect: 'dust' }),
      playSound('whoosh'),
    ],
  ),
  addScript(
    'Brot kaufen',
    [V_COINS, V_PRICES, V_BAG, V_MESSAGE],
    [b('events.whenKey', { key: 'B', mode: 'pressed' }), buy('Brot')],
  ),
  addScript(
    'Preise zeigen',
    [V_PRICES, V_MESSAGE],
    [
      b('events.whenKey', { key: 'P', mode: 'pressed' }),
      say(
        b(
          'data.listJoin',
          {},
          {
            list: b('data.dictKeys', {}, { dictionary: getVar(VAR_PRICES) }),
            separator: ', ',
          },
        ),
      ),
    ],
  ),
  addScript(
    'Rucksack zeigen',
    [V_BAG, V_MESSAGE],
    [
      b('events.whenKey', { key: 'R', mode: 'pressed' }),
      say(concat('Rucksack: ', b('data.listJoin', {}, { list: getVar(VAR_BAG), separator: ', ' }))),
    ],
  ),
  addScript(
    'Reichtum',
    [V_COINS],
    [
      b('events.whenGameStarts'),
      b('control.waitUntil', {}, { condition: call('Condition', 'def-rich', [], LIB_SCRIPT) }),
      say('Du bist reich!'),
      playSound('win'),
      b('effects.spawn', { effect: 'sparkle' }),
    ],
  ),
  addScript(
    'Würfeln',
    [V_MESSAGE],
    [
      b('events.whenKey', { key: 'T', mode: 'pressed' }),
      say(concat('Würfel: ', call('Value', 'def-dice', [10], LIB_SCRIPT))),
    ],
  ),
  addScript(
    'Durchschnittspreis',
    [V_MESSAGE],
    [
      b('events.whenKey', { key: 'D', mode: 'pressed' }),
      say(
        concat(
          'Durchschnitt: ',
          b(
            'operators.round',
            {},
            {
              value: call(
                'Value',
                'def-average',
                [b('data.split', {}, { text: '2,3,40,12,25', separator: ',' })],
                LIB_SCRIPT,
              ),
            },
          ),
        ),
      ),
    ],
  ),
];
playerScripts.forEach((id) => attach(market, hero, id));

// -- player 2: 2 scripts ------------------------------------------------------------------
const companion = knight(market, market.area.player2, [3, 0.1, -20], 'NPC');
market.objects[companion].components.push(comp('navAgent', { speed: 3, radius: 0.4, height: 1.9 }));
market.objects[companion].components.push(comp('npc', { startState: 'follow' }));
market.objects[companion].components.push(comp('follow', { distance: 2.5, speed: 3.2 }));
attach(
  market,
  companion,
  addScript(
    'Begleiter folgt',
    [],
    [b('events.whenGameStarts'), b('npc.follow', { target: 'tag:Player' }, { distance: 2.5 })],
  ),
);
attach(
  market,
  companion,
  addScript(
    'Begleiter jubelt',
    [],
    [
      b('events.whenMessage', { message: 'gekauft' }),
      b('effects.spawn', { effect: 'sparkle' }),
      b('looks.playAnimation', { mode: 'once' }, { name: 'wave', fade: 0.2 }),
    ],
  ),
);

// -- npcs: 12 merchants, 8 guards, 4 villagers --------------------------------------------
const wares = Object.keys(PRICES);
const merchantNames = [
  'Bäcker Anna',
  'Obst-Max',
  'Schmied Karl',
  'Alchemistin Rosa',
  'Kartograph Ole',
  'Fackel-Frieda',
  'Seiler Jan',
  'Helmschmied Udo',
  'Schildmacherin Eva',
  'Pfeilbauer Tom',
  'Zeltverleih Lisa',
  'Laternen-Leo',
];
merchantNames.forEach((name, index) => {
  const ware = wares[index];
  const x = -22 + index * 4;
  const merchant = model(
    market,
    name,
    index % 2 ? 'kaykit-adventurers/mage' : 'kaykit-adventurers/knight',
    [x, 0, 4],
    180,
    1,
    [comp('capsuleCollider', { isTrigger: true, center: [0, 1, 0], radius: 2.2, height: 2 })],
    market.area.npcs,
  );
  market.objects[merchant].tag = 'Haendler';
  attach(
    market,
    merchant,
    addScript(
      `Händler ${name}`,
      [V_COINS, V_PRICES, V_BAG, V_MESSAGE],
      [
        b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
        say(
          concat(
            `${name}: ${ware} für `,
            b('data.dictGet', {}, { key: ware, dictionary: getVar(VAR_PRICES) }),
          ),
        ),
        wait(1),
        buy(ware),
        b('control.sendMessage', { message: 'gekauft', target: 'all' }),
      ],
    ),
  );
});
for (let i = 1; i <= 8; i++) {
  const guard = model(
    market,
    `Wächter ${i}`,
    'kaykit-adventurers/knight',
    [-28 + i * 7, 0, 12],
    90 * i,
    1,
    [
      comp('navAgent', { speed: 2.4, radius: 0.4, height: 1.9 }),
      comp('npc', { startState: 'wander' }),
      comp('wander', { radius: 6 + i, speed: 1.4, wait: 1.5 }),
      comp('guard', { viewDistance: 14, viewAngle: 100, hearingRadius: 4, loseTime: 3 }),
    ],
    market.area.npcs,
  );
  attach(
    market,
    guard,
    addScript(
      `Wächter ${i}`,
      [],
      [
        b('npc.whenState', { state: 'chase' }),
        playSound(i % 2 ? 'hit' : 'whoosh'),
        b('control.sendMessage', { message: 'alarm', target: 'all' }),
        wait(2 + i),
        b('npc.setState', { state: 'wander' }),
      ],
    ),
  );
}
for (let i = 1; i <= 4; i++) {
  const villager = model(
    market,
    `Dorfbewohner ${i}`,
    'kaykit-adventurers/mage',
    [10 + i * 3, 0, 8 - i * 3],
    45 * i,
    1,
    [
      comp('navAgent', { speed: 1.8, radius: 0.4, height: 1.9 }),
      comp('npc', { startState: 'wander' }),
      comp('wander', { radius: 5 + i, speed: 1.2, wait: 2 }),
    ],
    market.area.npcs,
  );
  attach(
    market,
    villager,
    addScript(
      `Dorfbewohner ${i}`,
      [],
      [
        b('events.whenGameStarts'),
        b(
          'control.forever',
          {},
          { body: [b('npc.wander', {}, { radius: 5 + i }), wait(random(3, 9))] },
        ),
      ],
    ),
  );
}

// -- items: 18 chests ------------------------------------------------------------------------
for (let i = 1; i <= 18; i++) {
  const column = (i - 1) % 6;
  const row = Math.floor((i - 1) / 6);
  const chest = market.add({
    name: `Truhe ${i}`,
    parent: market.area.items,
    position: [-20 + column * 8, 0, -12 + row * 4],
    rotation: [0, i * 29, 0],
    components: [
      comp('meshRenderer', { model: lib('kaykit-dungeon/chest') }),
      comp('boxCollider', { size: [1.2, 0.9, 1], center: [0, 0.45, 0] }),
      comp('chest', { contents: `Münze:${i}`, radius: 2.4 }),
    ],
  });
  attach(
    market,
    chest,
    addScript(
      `Truhe ${i}`,
      [V_COINS, V_MESSAGE],
      [
        b('items.whenThing', { what: 'opened' }),
        earn(i * 5),
        b('effects.spawn', { effect: i % 2 ? 'sparkle' : 'magic' }),
        say(`Truhe ${i}: ${i * 5} Münzen!`),
      ],
    ),
  );
}

// A stall prefab with a script that uses custom blocks; three instances stand in the town.
const stallScene = createScene({});
const stallRoot = stallScene.add({
  name: 'Marktstand',
  parent: null,
  components: [
    comp('meshRenderer', { model: lib('kaykit-medieval-hexagon/building-market-red') }),
    comp('boxCollider', { isTrigger: true, size: [4, 2, 4], center: [0, 1, 0] }),
  ],
});
attach(
  stallScene,
  stallRoot,
  addScript(
    'Marktstand',
    [V_COINS, V_PRICES, V_BAG, V_MESSAGE],
    [
      b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
      say('Marktstand: Zeltplane und Seile!'),
      buy('Seil'),
    ],
  ),
);
const stallObjects = Object.fromEntries(
  Object.entries(stallScene.objects).filter(([, object]) => object.area === undefined),
);
const { prefab: stallPrefab } = createPrefabData(stallObjects, stallRoot, oid);
const prefabSource = (id) => (id === PREFAB_STALL ? stallPrefab : null);
project.adoptAsset('Assets/Prefabs/Marktstand.prefab.json', meta(PREFAB_STALL, 'prefab'), {
  data: stallPrefab,
});
[
  [-30, 10, 90],
  [30, 10, 270],
  [0, -30, 0],
].forEach(([x, z, yaw], index) => {
  const resolved = resolvePrefab(PREFAB_STALL, prefabSource);
  const { rootId, objects } = instantiatePrefab(PREFAB_STALL, resolved, {
    parent: market.area.items,
    order: market.nextOrder(),
    transform: { position: [x, 0, z], rotation: [0, yaw, 0] },
    createId: oid,
  });
  objects[rootId].name = `Marktstand ${index + 1}`;
  Object.assign(market.objects, objects);
  Object.assign(market.objects, updateInstanceOverrides(market.objects, rootId, prefabSource));
});

// -- ui: canvases and 6 scripts -----------------------------------------------------------------
const labels = {
  gameTitle: 'Handelsstadt',
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
  victory: 'Geschafft!',
  defeat: 'Niederlage',
  loading: 'Lädt …',
  life: 'Leben',
};
const targets = { startScene: SCENE_MARKET, menuScene: SCENE_MARKET, settingsUi: UI_SETTINGS };
const textLine = (id, name, y, text, variable) => ({
  id,
  name,
  type: 'text',
  visible: true,
  anchorMin: [0, 0],
  anchorMax: [0, 0],
  pivot: [0, 0],
  offsetMin: [24, y],
  offsetMax: [624, y + 30],
  text,
  bind: { kind: 'variable', variable },
  align: 'left',
  fontSize: 18,
});
for (const [id, name, kind] of [
  [UI_HUD, 'HUD', 'hud'],
  [UI_PAUSE, 'Pausemenue', 'pauseMenu'],
  [UI_SETTINGS, 'Einstellungen', 'settings'],
]) {
  const data = createUiTemplate(kind, labels, targets);
  if (kind === 'hud') {
    data.elements.splice(2, 0, textLine('ecoins', 'Münzen', 92, 'Münzen: {value}', VAR_COINS));
    data.elements.splice(3, 0, textLine('eday', 'Tag', 124, 'Tag {value}', VAR_DAY));
    data.elements.splice(4, 0, textLine('emsg', 'Meldung', 156, '{value}', VAR_MESSAGE));
  }
  project.adoptAsset(`Assets/UI/${name}.ui.json`, meta(id, 'ui'), { data });
}
{
  // The shop list: a menu canvas that scripts open with a key.
  const data = createUiTemplate('hud', labels, targets);
  data.elements = [
    textLine('shoptitle', 'Titel', 320, 'Laden: Preise stehen im Wörterbuch', VAR_MESSAGE),
    textLine('shopcoins', 'Münzen', 360, 'Münzen: {value}', VAR_COINS),
  ];
  project.adoptAsset('Assets/UI/Laden.ui.json', meta(UI_SHOP, 'ui'), { data });
}
const addCanvas = (name, ui, visibility, order) =>
  market.add({
    name,
    parent: market.area.ui,
    components: [comp('uiCanvas', { ui, visibility, sortOrder: order, player: 'all' })],
  });
addCanvas('HUD', UI_HUD, 'always', 0);
addCanvas('Pausemenü', UI_PAUSE, 'paused', 5);
addCanvas('Einstellungen', UI_SETTINGS, 'manual', 10);
const shopCanvas = addCanvas('Laden', UI_SHOP, 'manual', 20);
const uiScripts = [
  addScript(
    'Laden öffnen',
    [],
    [b('events.whenKey', { key: 'M', mode: 'pressed' }), b('ui.show', { ui: `ui:${UI_SHOP}` })],
  ),
  addScript(
    'Laden schließen',
    [],
    [b('events.whenKey', { key: 'N', mode: 'pressed' }), b('ui.hide', { ui: `ui:${UI_SHOP}` })],
  ),
  addScript(
    'Einstellungen öffnen',
    [],
    [b('events.whenKey', { key: 'O', mode: 'pressed' }), b('ui.show', { ui: `ui:${UI_SETTINGS}` })],
  ),
  addScript(
    'Hilfe',
    [V_MESSAGE],
    [
      b('events.whenKey', { key: 'H', mode: 'pressed' }),
      say('B Brot kaufen, P Preise, R Rucksack, T würfeln, D Durchschnitt, M Laden'),
    ],
  ),
  addScript(
    'Meldungen aufräumen',
    [V_MESSAGE],
    [
      b('events.whenGameStarts'),
      b('control.forever', {}, { body: [wait(8), setVar(VAR_MESSAGE, '')] }),
    ],
  ),
  addScript(
    'Alarm anzeigen',
    [V_MESSAGE],
    [b('events.whenMessage', { message: 'alarm' }), say('Alarm! Die Wächter sind aufmerksam.')],
  ),
];
const uiHolder = market.add({ name: 'Menü-Skripte', parent: market.area.ui });
uiScripts.forEach((id) => attach(market, uiHolder, id));
void shopCanvas;

// ------------------------------------------------------------------ write
/** Walks every block of a workspace JSON (statements, inputs, next chains). */
function eachBlock(block, visit) {
  if (!block) return;
  visit(block);
  for (const input of Object.values(block.inputs ?? {})) {
    eachBlock(input.block, visit);
    eachBlock(input.shadow, visit);
  }
  eachBlock(block.next?.block, visit);
}

// Call blocks carry the name and parameters of their definition, as the editor writes them.
const definitions = new Map();
for (const script of scriptAssets) {
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
for (const script of scriptAssets) {
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

/** File names stay ASCII so the example also works in browsers whose OPFS rejects umlauts. */
function asciiName(name) {
  return name
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
}
for (const script of scriptAssets) {
  project.adoptAsset(
    `Assets/Block-Skripte/${asciiName(script.name)}.blocks.json`,
    meta(script.id, 'blockScript'),
    {
      data: { formatVersion: 1, variables: script.variables, workspace: script.workspace },
    },
  );
}
project.adoptAsset('Assets/Szenen/Markt.scene.json', meta(SCENE_MARKET, 'scene'), {
  data: { formatVersion: 1, environment: market.environment, objects: market.objects },
});

await project.save(new NodeFileSystem(folder));
console.log(
  JSON.stringify({
    scripts: scriptAssets.length,
    objects: Object.keys(market.objects).length,
  }),
);
