// Generates the five template projects of phase 11 into `templates/`: a third-person adventure,
// a first-person arena, a 3D platformer, a co-op collecting game and a small racing game
// (File > New Project from Template). Each is one small scene with one or two scripts, built
// from library models and simple shapes. Run with `pnpm templates` (`tsx scripts/make-templates.mjs`).
// The output is deterministic.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { createPrefabData } from '../packages/project/src/index.ts';
import { b, get, workspace } from '../packages/compiler/test/dsl.ts';
import { createKit, writeProject } from './lib/projectKit.mjs';

const root = join(import.meta.dirname, '..', 'templates');
rmSync(root, { recursive: true, force: true });

const ENV = {
  ambientIntensity: 0.4,
  fog: { enabled: true, near: 55, far: 150 },
  sky: { timeOfDay: 11, dayLength: 0, sunAzimuth: 0 },
};
const lib = (name) => `library:${name}`;
const KNIGHT = lib('kaykit-adventurers/knight');
const ROGUE = lib('kaykit-adventurers/rogue');
const body = { center: [0, 0.9, 0], height: 1.8, radius: 0.35 };
const variable = (id, name) => ({
  id,
  name,
  type: 'number',
  scope: 'game',
  default: 0,
  inspector: false,
});
const logLine = (level, message) => b('control.log', { level }, { message });
const script = (id, name, variables, ...stacks) => ({
  id,
  name,
  variables,
  workspace: workspace(...stacks),
});
/** A script component pointing to a script asset. */
const withScript = (k, id) => k.comp('blockScript', { script: id });
const ring = (count, radius, offset = 0) =>
  Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2;
    return [
      Math.round(Math.cos(angle) * radius * 10) / 10,
      Math.round(Math.sin(angle) * radius * 10) / 10,
    ];
  });

const templates = [];

// ------------------------------------------------------------------ 1. third-person adventure
{
  const k = createKit('ta');
  const s = k.scene(ENV);
  k.sun(s);
  k.box(s, 'Wiese', [0, -0.5, 0], [70, 1, 70], '#6f9a58');
  s.add({
    name: 'Ritter',
    parent: s.area.player1,
    tag: 'Player',
    components: [
      k.comp('meshRenderer', { model: KNIGHT }),
      k.comp('animator'),
      k.comp('characterController', body),
      k.comp('thirdPersonControl'),
      k.comp('inventory'),
      withScript(k, 'taskript0001'),
    ],
  });
  s.add({
    name: 'Hauptkamera',
    parent: s.area.player1,
    tag: 'MainCamera',
    position: [0, 3, -6],
    components: [k.comp('camera'), k.comp('thirdPersonCamera')],
  });
  const trees = [...ring(10, 18), ...ring(8, 27, 0.2)];
  trees.forEach(([x, z], i) =>
    s.add({
      name: `Baum ${i + 1}`,
      position: [x, 0, z],
      components: [
        k.comp('meshRenderer', {
          model: lib(`kaykit-medieval-hexagon/tree-single-${i % 2 ? 'b' : 'a'}`),
        }),
        k.comp('capsuleCollider', { center: [0, 1, 0], height: 2, radius: 0.4 }),
      ],
    }),
  );
  ring(5, 11, 0.5).forEach(([x, z], i) =>
    s.add({
      name: `Stein ${i + 1}`,
      position: [x, 0, z],
      components: [
        k.comp('meshRenderer', { model: lib('kaykit-medieval-hexagon/rock-single-a') }),
        k.comp('capsuleCollider', { center: [0, 0.6, 0], height: 1.2, radius: 0.7 }),
      ],
    }),
  );
  ring(8, 7, 0.3).forEach(([x, z], i) =>
    s.add({
      name: `Münze ${i + 1}`,
      parent: s.area.items,
      position: [x, 0.5, z],
      components: [
        k.comp('meshRenderer', { model: lib('kaykit-prototype/coin-a') }),
        k.comp('sphereCollider', { isTrigger: true, radius: 0.6 }),
        k.comp('pickup', { item: 'Münze', count: 1 }),
      ],
    }),
  );
  s.add({
    name: 'Ziel',
    parent: s.area.items,
    position: [0, 0, 22],
    components: [
      k.comp('meshRenderer', { model: lib('kaykit-medieval-hexagon/flag-red') }),
      k.comp('boxCollider', { isTrigger: true, center: [0, 1, 0], size: [3, 2, 3] }),
      withScript(k, 'taskript0002'),
    ],
  });
  templates.push({
    id: 'abenteuer',
    name: 'Abenteuer',
    start: 'taszene00001',
    scene: { id: 'taszene00001', name: 'Wiese', data: s.data },
    scripts: [
      script(
        'taskript0001',
        'Willkommen',
        [],
        [
          b('events.whenGameStarts'),
          logLine(
            'info',
            'Sammle die Münzen und erreiche die rote Flagge. WASD laufen, Leertaste springen, Maus drehen.',
          ),
        ],
      ),
      script(
        'taskript0002',
        'Ziel erreicht',
        [],
        [
          b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
          logLine('info', 'Geschafft! Du hast die Flagge erreicht.'),
        ],
      ),
    ],
  });
}

// ------------------------------------------------------------------ 2. first-person arena
{
  const k = createKit('tb');
  const s = k.scene(ENV);
  k.sun(s);
  k.box(s, 'Boden', [0, -0.5, 0], [36, 1, 36], '#4a4f5a');
  const wall = '#7b7f8a';
  k.box(s, 'Mauer Nord', [0, 2, 18.5], [37, 4, 1], wall);
  k.box(s, 'Mauer Süd', [0, 2, -18.5], [37, 4, 1], wall);
  k.box(s, 'Mauer Ost', [18.5, 2, 0], [1, 4, 37], wall);
  k.box(s, 'Mauer West', [-18.5, 2, 0], [1, 4, 37], wall);
  [
    [-6, -4],
    [6, -4],
    [-6, 6],
    [6, 6],
  ].forEach(([x, z], i) => k.box(s, `Deckung ${i + 1}`, [x, 1, z], [3, 2, 1.2], '#8d7b6a'));
  s.add({
    name: 'Spieler',
    parent: s.area.player1,
    tag: 'Player',
    position: [0, 0, -14],
    components: [
      k.comp('characterController', body),
      k.comp('firstPersonControl'),
      k.comp('health', { max: 100, onDeath: 'nothing' }),
      withScript(k, 'tbskript0001'),
      withScript(k, 'tbskript0002'),
    ],
  });
  s.add({
    name: 'Kamera',
    parent: s.area.player1,
    tag: 'MainCamera',
    position: [0, 1.6, -14],
    components: [k.comp('camera', { fieldOfView: 75 }), k.comp('firstPersonCamera')],
  });
  [
    [-10, 10],
    [10, 10],
    [0, 14],
    [-14, 0],
  ].forEach(([x, z], i) =>
    s.add({
      name: `Skelett ${i + 1}`,
      parent: s.area.npcs,
      tag: 'Enemy',
      position: [x, 0, z],
      rotation: [0, 180, 0],
      components: [
        k.comp('meshRenderer', { model: lib('kaykit-skeletons/skeleton-minion') }),
        k.comp('animator'),
        k.comp('navAgent', { height: 1.9, radius: 0.4, speed: 2.6 }),
        k.comp('npc', { startState: 'chase' }),
        k.comp('follow', { distance: 1.2, speed: 2.6 }),
        k.comp('attack', { cooldown: 1.4, damage: 10, range: 1.9, windup: 0.4 }),
        k.comp('health', { invulnerable: 0.1, max: 40, onDeath: 'destroy' }),
        k.comp('capsuleCollider', {
          center: [0, 0.95, 0],
          height: 1.9,
          isTrigger: true,
          radius: 0.4,
        }),
      ],
    }),
  );
  // The bullet is a prefab: a small ball that flies straight ahead and hurts the first enemy.
  const bullet = {
    name: 'Kugel',
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: { position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [0.25, 0.25, 0.25] },
    components: [
      k.comp('meshRenderer', { shape: 'sphere', color: '#ffd23f' }),
      k.comp('projectile', {
        speed: 22,
        damage: 20,
        lifetime: 3,
        ignoreTag: 'Player',
        effect: 'sparks',
      }),
    ],
  };
  const bulletId = k.oid();
  const { prefab } = createPrefabData({ [bulletId]: bullet }, bulletId, k.oid);
  templates.push({
    id: 'arena',
    name: 'Arena',
    start: 'tbszene00001',
    scene: { id: 'tbszene00001', name: 'Arena', data: s.data },
    prefabs: [{ id: 'tbkugel00001', name: 'Kugel', data: prefab }],
    tags: ['Enemy'],
    scripts: [
      script(
        'tbskript0001',
        'Schiessen',
        [],
        [
          b('events.whenGameStarts'),
          logLine(
            'info',
            'Besiege die Skelette! Linke Maustaste schiesst, WASD laufen, Maus zielt.',
          ),
        ],
        [
          b('events.whenAction', { action: 'attack', phase: 'pressed', player: 'any' }),
          b('control.spawnPrefab', { prefab: 'prefab:tbkugel00001', at: 'self' }),
        ],
      ),
      script(
        'tbskript0002',
        'Niederlage',
        [],
        [b('items.whenHealth', { phase: 'died' }), logLine('warning', 'Du wurdest besiegt.')],
      ),
    ],
  });
}

// ------------------------------------------------------------------ 3. 3D platformer
{
  const k = createKit('tc');
  const s = k.scene({ ...ENV, sky: { timeOfDay: 9, dayLength: 0, sunAzimuth: 0 } });
  k.sun(s);
  const stone = '#b3a58b';
  const plan = [
    [0, 0, 0],
    [0, 0.4, 5],
    [3, 0.9, 9.5],
    [6.5, 1.4, 13],
    [6.5, 2, 18.5],
    [3, 2.7, 23],
    [-2, 3.3, 26],
    [-6, 4, 30],
    [-6, 4.6, 36],
    [-2, 5.3, 40],
    [2, 6, 44],
  ];
  plan.forEach(([x, y, z], i) =>
    k.box(s, `Plattform ${i + 1}`, [x, y - 0.25, z], [3.4, 0.5, 3.4], stone),
  );
  const goal = plan[plan.length - 1];
  k.box(s, 'Ziel-Plattform', [goal[0], goal[1] - 0.25, goal[2] + 4], [5, 0.5, 5], '#5ea862');
  s.add({ name: 'Startpunkt', position: [0, 1.2, 0] });
  s.add({
    name: 'Ritter',
    parent: s.area.player1,
    tag: 'Player',
    position: [0, 0.6, 0],
    components: [
      k.comp('meshRenderer', { model: KNIGHT }),
      k.comp('animator'),
      k.comp('characterController', body),
      k.comp('thirdPersonControl', { jumpHeight: 1.5 }),
      k.comp('doubleJump'),
      withScript(k, 'tcskript0001'),
    ],
  });
  s.add({
    name: 'Hauptkamera',
    parent: s.area.player1,
    tag: 'MainCamera',
    position: [0, 3, -6],
    components: [k.comp('camera'), k.comp('thirdPersonCamera', { distance: 5.5 })],
  });
  plan.slice(1, -1).forEach(([x, y, z], i) =>
    s.add({
      name: `Edelstein ${i + 1}`,
      parent: s.area.items,
      position: [x, y + 0.7, z],
      components: [
        k.comp('meshRenderer', { model: lib('kaykit-prototype/coin-b') }),
        k.comp('sphereCollider', { isTrigger: true, radius: 0.6 }),
        k.comp('pickup', { item: 'Edelstein', count: 1 }),
      ],
    }),
  );
  s.add({
    name: 'Flagge',
    parent: s.area.items,
    position: [goal[0], goal[1], goal[2] + 4],
    components: [
      k.comp('meshRenderer', { model: lib('kaykit-medieval-hexagon/flag-green') }),
      k.comp('boxCollider', { isTrigger: true, center: [0, 1, 0], size: [3, 2, 3] }),
      withScript(k, 'tcskript0002'),
    ],
  });
  const startPoint = Object.entries(s.objects).find(([, o]) => o.name === 'Startpunkt')[0];
  templates.push({
    id: 'plattformer',
    name: 'Plattformer',
    start: 'tcszene00001',
    scene: { id: 'tcszene00001', name: 'Plattformen', data: s.data },
    scripts: [
      script(
        'tcskript0001',
        'Absturz',
        [],
        [
          b('events.whenGameStarts'),
          logLine(
            'info',
            'Springe über die Plattformen. Leertaste springt, in der Luft noch einmal für den Doppelsprung.',
          ),
        ],
        [
          b('events.everyFrame'),
          b(
            'control.if',
            {},
            {
              condition: b('operators.lt', {}, { a: b('motion.position', { axis: 'y' }), b: -6 }),
              then: [b('player.teleport', { target: `object:${startPoint}` })],
            },
          ),
        ],
      ),
      script(
        'tcskript0002',
        'Geschafft',
        [],
        [
          b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
          logLine('info', 'Geschafft! Du hast die Flagge erreicht.'),
        ],
      ),
    ],
  });
}

// ------------------------------------------------------------------ 4. co-op collecting game
{
  const k = createKit('td');
  const s = k.scene(ENV);
  const VAR = 'tdvarmuenze1';
  k.sun(s);
  k.box(s, 'Platz', [0, -0.5, 0], [44, 1, 44], '#c6b98a');
  [
    [-8, 0],
    [8, 0],
    [0, 8],
    [0, -8],
  ].forEach(([x, z], i) => k.box(s, `Säule ${i + 1}`, [x, 1.5, z], [1.6, 3, 1.6], '#9a8f7a'));
  const hero = (name, model, area, x, player) =>
    s.add({
      name,
      parent: area,
      tag: 'Player',
      position: [x, 0, -10],
      components: [
        k.comp('meshRenderer', { model }),
        k.comp('animator'),
        k.comp('characterController', body),
        k.comp('thirdPersonControl', { player }),
      ],
    });
  hero('Ritter', KNIGHT, s.area.player1, -2, '1');
  hero('Schurkin', ROGUE, s.area.player2, 2, '2');
  s.add({
    name: 'Kamera 1',
    parent: s.area.player1,
    tag: 'MainCamera',
    position: [-2, 3, -16],
    components: [k.comp('camera', { player: '1', split: 'vertical' }), k.comp('thirdPersonCamera')],
  });
  s.add({
    name: 'Kamera 2',
    parent: s.area.player2,
    position: [2, 3, -16],
    components: [k.comp('camera', { player: '2' }), k.comp('thirdPersonCamera')],
  });
  const coins = [...ring(8, 10), ...ring(4, 4, 0.4)];
  coins.forEach(([x, z], i) =>
    s.add({
      name: `Münze ${i + 1}`,
      parent: s.area.items,
      position: [x, 0.6, z],
      components: [
        k.comp('meshRenderer', { model: lib('kaykit-prototype/coin-a') }),
        k.comp('sphereCollider', { isTrigger: true, radius: 0.6 }),
        withScript(k, 'tdskript0001'),
      ],
    }),
  );
  s.add({ name: 'Spielleitung', components: [withScript(k, 'tdskript0002')] });
  templates.push({
    id: 'koop',
    name: 'Koop',
    start: 'tdszene00001',
    scene: { id: 'tdszene00001', name: 'Platz', data: s.data },
    scripts: [
      script(
        'tdskript0001',
        'Muenze einsammeln',
        [variable(VAR, 'muenzen')],
        [
          b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
          b('variables.change', { variable: { id: VAR } }, { by: 1 }),
          b('control.destroy', { target: 'self' }),
        ],
      ),
      script(
        'tdskript0002',
        'Spielleitung',
        [variable(VAR, 'muenzen')],
        [
          b('events.whenGameStarts'),
          b('variables.show', { variable: { id: VAR } }),
          logLine(
            'info',
            'Sammelt zusammen alle Münzen! Spieler 1: WASD, Spieler 2: Pfeiltasten oder Gamepad.',
          ),
          b(
            'control.waitUntil',
            {},
            { condition: b('operators.eq', {}, { a: get(VAR), b: coins.length }) },
          ),
          logLine('info', 'Geschafft! Ihr habt alle Münzen gesammelt.'),
        ],
      ),
    ],
  });
}

// ------------------------------------------------------------------ 5. small racing game
{
  const k = createKit('te');
  const s = k.scene(ENV);
  const LAPS = 'tevarrunden1';
  const HALF = 'tevarhalb001';
  k.sun(s);
  k.box(s, 'Wiese', [0, -0.5, 0], [100, 1, 80], '#7aa05f');
  // The road is a ring around an island: south and north straights, east and west sides.
  const road = '#4b4d55';
  k.box(s, 'Straße Süd', [0, 0.02, -15], [64, 0.05, 10], road);
  k.box(s, 'Straße Nord', [0, 0.02, 15], [64, 0.05, 10], road);
  k.box(s, 'Straße Ost', [27, 0.02, 0], [10, 0.05, 30], road);
  k.box(s, 'Straße West', [-27, 0.02, 0], [10, 0.05, 30], road);
  k.box(s, 'Insel', [0, 0.75, 0], [44, 1.5, 20], '#6d8f52');
  const edge = '#e0e0e0';
  k.box(s, 'Leitplanke Süd', [0, 0.4, -21], [70, 0.8, 0.6], edge);
  k.box(s, 'Leitplanke Nord', [0, 0.4, 21], [70, 0.8, 0.6], edge);
  k.box(s, 'Leitplanke Ost', [33.5, 0.4, 0], [0.6, 0.8, 42], edge);
  k.box(s, 'Leitplanke West', [-33.5, 0.4, 0], [0.6, 0.8, 42], edge);
  s.add({
    name: 'Taxi',
    parent: s.area.player1,
    tag: 'Player',
    position: [-10, 0.1, -15],
    rotation: [0, 90, 0],
    components: [
      k.comp('meshRenderer', { model: lib('kaykit-city/car-taxi') }),
      k.comp('characterController', { center: [0, 0.5, 0], height: 1, radius: 0.9 }),
      k.comp('vehicleControl'),
      withScript(k, 'teskript0003'),
    ],
  });
  s.add({
    name: 'Hauptkamera',
    parent: s.area.player1,
    tag: 'MainCamera',
    position: [-18, 3, -15],
    components: [k.comp('camera'), k.comp('thirdPersonCamera', { distance: 7, height: 2.5 })],
  });
  const zone = (name, x, z, scriptId) =>
    s.add({
      name,
      parent: s.area.items,
      position: [x, 1, z],
      components: [
        k.comp('boxCollider', { isTrigger: true, size: [1, 2, 10] }),
        withScript(k, scriptId),
      ],
    });
  zone('Ziellinie', 0, -15, 'teskript0001');
  zone('Halbzeit', 0, 15, 'teskript0002');
  const lineMarks = (z, color, name) => k.box(s, name, [0, 0.06, z], [1, 0.02, 10], color);
  lineMarks(-15, '#ffffff', 'Startlinie');
  lineMarks(15, '#ffd23f', 'Halbzeitlinie');
  templates.push({
    id: 'rennen',
    name: 'Rennen',
    start: 'teszene00001',
    scene: { id: 'teszene00001', name: 'Rennstrecke', data: s.data },
    scripts: [
      script(
        'teskript0001',
        'Ziellinie',
        [variable(LAPS, 'runden'), variable(HALF, 'halb')],
        [
          b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
          b(
            'control.if',
            {},
            {
              condition: b('operators.eq', {}, { a: get(HALF), b: 1 }),
              then: [
                b('variables.set', { variable: { id: HALF } }, { value: 0 }),
                b('variables.change', { variable: { id: LAPS } }, { by: 1 }),
                b(
                  'control.if',
                  {},
                  {
                    condition: b('operators.eq', {}, { a: get(LAPS), b: 3 }),
                    then: [logLine('info', 'Ziel! Du hast alle drei Runden geschafft.')],
                  },
                ),
              ],
            },
          ),
        ],
      ),
      script(
        'teskript0002',
        'Halbzeit',
        [variable(HALF, 'halb')],
        [
          b('events.whenZone', { target: 'tag:Player', phase: 'enter' }),
          b('variables.set', { variable: { id: HALF } }, { value: 1 }),
        ],
      ),
      script(
        'teskript0003',
        'Rennstart',
        [variable(LAPS, 'runden')],
        [
          b('events.whenGameStarts'),
          b('variables.show', { variable: { id: LAPS } }),
          logLine('info', 'Fahre drei Runden. Pfeiltasten oder WASD lenken, Shift ist Turbo.'),
        ],
      ),
    ],
  });
}

// ------------------------------------------------------------------ write everything
for (const t of templates) {
  await writeProject({
    folder: join(root, t.id),
    name: t.name,
    startScene: t.start,
    scenes: [t.scene],
    scripts: t.scripts,
    prefabs: t.prefabs ?? [],
    tags: t.tags ?? [],
  });
}
console.log(
  JSON.stringify(
    templates.map((t) => ({ id: t.id, objects: Object.keys(t.scene.data.objects).length })),
  ),
);
