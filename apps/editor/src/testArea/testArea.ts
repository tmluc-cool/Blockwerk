import { FORMAT_VERSION } from '@blockwerk/project';
import type {
  BlockScriptData,
  ComponentData,
  JsonValue,
  SceneData,
  SceneObjectData,
  Vec3,
} from '@blockwerk/project';
import type { TranslationKey } from '../i18n';

/** ID of the block script that moves the platform of the test area. */
export const TEST_PLATFORM_SCRIPT = 'testareaplat';

/** Where the player is put (meters), facing +Z. */
export const TEST_AREA_SPAWN: Vec3 = [0, 0.05, -10];

/** The test area scene and the block scripts that exist only inside it. */
export interface TestArea {
  readonly scene: SceneData;
  readonly scripts: ReadonlyMap<string, BlockScriptData>;
  /** ID of the player object that was put into the scene. */
  readonly playerId: string;
}

type Name = (key: TranslationKey) => string;

/** Measurements the test area is built from (also used by tests). */
export const TEST_AREA = {
  /** Step heights of the four staircases; the last one is higher than a character can climb. */
  stepHeights: [0.15, 0.25, 0.35, 0.5],
  rampAngles: [15, 30, 45, 60],
  gapWidths: [1, 2, 3, 4],
  /** Height of the platforms with gaps. */
  gapPlatformTop: 0.6,
} as const;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ta${String(counter).padStart(10, '0')}`;
}

function component(type: string, values: ComponentData['values'] = {}): ComponentData {
  return { id: nextId(), type, enabled: true, values };
}

function make(overrides: Partial<SceneObjectData>): SceneObjectData {
  return {
    name: null,
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: true,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [],
    ...overrides,
  };
}

/** A block that is solid (renderer and collider) with its bottom-center at `position`. */
function solid(
  name: string,
  position: Vec3,
  size: Vec3,
  color: string,
  rotation: Vec3 = [0, 0, 0],
  extra: Partial<SceneObjectData> = {},
): SceneObjectData {
  return make({
    name,
    transform: { position, rotation, scale: size },
    components: [
      component('meshRenderer', { shape: 'cube', color, smoothness: 0.2 }),
      component('boxCollider'),
    ],
    ...extra,
  });
}

/** A number or a text shadow block in a Blockly workspace. */
function shadow(id: string, value: number): JsonValue {
  return { shadow: { type: 'literal.number', id, fields: { NUM: value } } };
}

function glide(
  id: string,
  seconds: number,
  x: number,
  y: number,
  z: number,
  next?: JsonValue,
): JsonValue {
  return {
    type: 'motion.glideToXYZ',
    id,
    fields: { easing: 'smooth' },
    inputs: {
      seconds: shadow(`${id}-s`, seconds),
      x: shadow(`${id}-x`, x),
      y: shadow(`${id}-y`, y),
      z: shadow(`${id}-z`, z),
    },
    ...(next ? { next: { block: next } } : {}),
  };
}

/** "when game starts → forever: glide to the right end, glide to the left end". */
function platformScript(from: Vec3, to: Vec3): BlockScriptData {
  const back = glide('ta-b', 3, from[0], from[1], from[2]);
  const there = glide('ta-a', 3, to[0], to[1], to[2], back);
  return {
    formatVersion: FORMAT_VERSION,
    variables: [],
    workspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'events.whenGameStarts',
            id: 'ta-h',
            next: {
              block: { type: 'control.forever', id: 'ta-f', inputs: { body: { block: there } } },
            },
          },
        ],
      },
    },
  };
}

/** The children of `rootId` (and the root) in a set of objects. */
export function subtreeOf(
  objects: Readonly<Record<string, SceneObjectData>>,
  rootId: string,
): Record<string, SceneObjectData> {
  const result: Record<string, SceneObjectData> = {};
  const visit = (id: string): void => {
    const object = objects[id];
    if (!object || id in result) return;
    result[id] = object;
    for (const [childId, child] of Object.entries(objects)) {
      if (child.parent === id) visit(childId);
    }
  };
  visit(rootId);
  return result;
}

/**
 * Builds the test area (SPEC 5.6): meter grid, staircases with different step heights, ramps
 * of 15°, 30°, 45° and 60°, jump gaps of rising width, a moving platform, a stack of physics
 * crates, narrow corridors, a dummy and targets. The chosen player (all its objects, components
 * and block scripts) is put in at the start. Never part of a project.
 */
export function buildTestArea(
  name: Name,
  player: Readonly<Record<string, SceneObjectData>>,
  playerId: string,
): TestArea {
  counter = 0;
  const objects: Record<string, SceneObjectData> = {};
  const add = (object: SceneObjectData): string => {
    const id = nextId();
    objects[id] = { ...object, order: Object.keys(objects).length };
    return id;
  };

  add(
    make({
      name: name('testArea.sun'),
      transform: { position: [0, 10, 0], rotation: [50, -30, 0], scale: [1, 1, 1] },
      components: [component('light', { lightType: 'directional' })],
    }),
  );
  add(
    make({
      name: name('testArea.ground'),
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [10, 1, 10] },
      components: [
        component('meshRenderer', {
          shape: 'plane',
          color: '#8a9a7b',
          texture: 'tiles',
          tiling: 10,
        }),
        component('boxCollider', { center: [0, -0.05, 0], size: [10, 0.1, 10] }),
      ],
    }),
  );

  // Staircases (z = 2 …): steps of 0.15, 0.25, 0.35 m can be climbed, 0.5 m cannot.
  TEST_AREA.stepHeights.forEach((height, flight) => {
    const x = -21 + flight * 6;
    for (let step = 1; step <= 6; step++) {
      add(
        solid(
          `${name('testArea.stairs')} ${height} m`,
          [x, (step * height) / 2, 2 + (step - 0.5) * 0.6],
          [3, step * height, 0.6],
          '#b9a98c',
        ),
      );
    }
    add(
      solid(
        `${name('testArea.stairs')} ${height} m`,
        [x, (6 * height) / 2, 2 + 6 * 0.6 + 1.5],
        [3, 6 * height, 3],
        '#a99878',
      ),
    );
  });

  // Ramps rising towards +Z.
  const rampLength = 8;
  TEST_AREA.rampAngles.forEach((angle, index) => {
    const radians = (angle * Math.PI) / 180;
    const x = 5 + index * 5;
    add(
      solid(
        `${name('testArea.ramp')} ${angle}°`,
        [x, (rampLength / 2) * Math.sin(radians), 2 + (rampLength / 2) * Math.cos(radians)],
        [3, 0.2, rampLength],
        ['#6fbf73', '#e6d35a', '#e8964a', '#d9604c'][index] ?? '#999999',
        [-angle, 0, 0],
      ),
    );
  });

  // Jump gaps (z = 16): platforms 4 m long with gaps of 1, 2, 3 and 4 m.
  let gapX = -24;
  const top = TEST_AREA.gapPlatformTop;
  add(solid(name('testArea.gap'), [gapX + 2, top / 2, 16], [4, top, 3], '#7fa6c9'));
  gapX += 4;
  for (const width of TEST_AREA.gapWidths) {
    gapX += width;
    add(
      solid(`${name('testArea.gap')} ${width} m`, [gapX + 2, top / 2, 16], [4, top, 3], '#7fa6c9'),
    );
    gapX += 4;
  }

  // Moving platform (z = 26): slides sideways, thin enough to step on.
  const platformFrom: Vec3 = [-8, -0.1, 26];
  const platformTo: Vec3 = [-1, -0.1, 26];
  add(
    solid(name('testArea.platform'), platformFrom, [3, 0.6, 3], '#c9a14a', [0, 0, 0], {
      static: false,
      components: [
        component('meshRenderer', { shape: 'cube', color: '#c9a14a', smoothness: 0.2 }),
        component('boxCollider'),
        component('blockScript', { script: TEST_PLATFORM_SCRIPT }),
      ],
    }),
  );

  // Stack of physics crates: 4 + 3 + 2 + 1.
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4 - row; column++) {
      add(
        make({
          name: name('testArea.crate'),
          static: false,
          transform: {
            position: [6 + (column - (3 - row) / 2) * 0.85, 0.4 + row * 0.8, 26],
            rotation: [0, 0, 0],
            scale: [0.8, 0.8, 0.8],
          },
          components: [
            component('meshRenderer', { shape: 'cube', color: '#a9754a', smoothness: 0.1 }),
            component('boxCollider'),
            component('rigidbody', { mass: 4 }),
          ],
        }),
      );
    }
  }

  // Corridors: 1.0 m wide (passable) and 0.5 m wide (too narrow for the 0.6 m capsule).
  const wallColor = '#8c8c96';
  for (const [x, gap] of [
    [16, 1.0],
    [21, 0.5],
  ] as const) {
    add(solid(name('testArea.corridor'), [x - gap / 2 - 0.15, 1, 26], [0.3, 2, 8], wallColor));
    add(solid(name('testArea.corridor'), [x + gap / 2 + 0.15, 1, 26], [0.3, 2, 8], wallColor));
  }

  // Dummy and targets.
  add(
    make({
      name: name('testArea.dummy'),
      transform: { position: [-14, 0.9, 26], rotation: [0, 0, 0], scale: [1, 1.8, 1] },
      components: [
        component('meshRenderer', { shape: 'capsule', color: '#d9d4c7' }),
        component('capsuleCollider'),
      ],
    }),
  );
  for (let target = 0; target < 3; target++) {
    add(
      make({
        name: name('testArea.target'),
        transform: {
          position: [-14 + target * 2.5, 1.5, 34],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        components: [
          component('meshRenderer', { shape: 'sphere', color: '#d9534f' }),
          component('sphereCollider'),
        ],
      }),
    );
  }

  // The player: put in at the start, facing +Z.
  const playerRoot = player[playerId];
  if (playerRoot) {
    const spawned = { ...player };
    spawned[playerId] = {
      ...playerRoot,
      parent: null,
      order: 0,
      transform: { ...playerRoot.transform, position: TEST_AREA_SPAWN, rotation: [0, 0, 0] },
    };
    Object.assign(objects, spawned);
    const hasCamera = Object.values(player).some((object) =>
      object.components.some((c) => c.type === 'camera'),
    );
    if (!hasCamera) {
      add(
        make({
          name: name('testArea.camera'),
          tag: 'MainCamera',
          static: false,
          transform: { position: [0, 3, -16], rotation: [15, 0, 0], scale: [1, 1, 1] },
          components: [component('camera'), component('thirdPersonCamera')],
        }),
      );
    }
  }

  return {
    scene: {
      formatVersion: FORMAT_VERSION,
      environment: { ambientIntensity: 0.32, fog: { enabled: true, near: 60, far: 400 } },
      objects,
    },
    scripts: new Map([[TEST_PLATFORM_SCRIPT, platformScript(platformFrom, platformTo)]]),
    playerId,
  };
}
