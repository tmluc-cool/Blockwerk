import { compileBlockScript } from '@blockwerk/compiler';
import { createId, sceneSchema } from '@blockwerk/project';
import type { ComponentData, SceneObjectData } from '@blockwerk/project';
import { Game, initPhysics, loadScriptModule } from '@blockwerk/runtime';
import type { GameObject, ScriptAsset } from '@blockwerk/runtime';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildTestArea,
  subtreeOf,
  TEST_AREA,
  TEST_PLATFORM_SCRIPT,
} from '../src/testArea/testArea';

/** Acceptance of the test area (SPEC 5.6 and phase 3) without the UI. */

beforeAll(async () => {
  await initPhysics();
});

function component(type: string, values: ComponentData['values'] = {}): ComponentData {
  return { id: createId(), type, enabled: true, values };
}

const HERO = 'heroheroher1';

function heroObjects(): Record<string, SceneObjectData> {
  return {
    [HERO]: {
      name: 'Hero',
      parent: null,
      order: 0,
      active: true,
      tag: 'Player',
      layer: 'Default',
      static: false,
      transform: { position: [3, 1, 3], rotation: [0, 90, 0], scale: [1, 1, 1] },
      components: [component('characterController'), component('thirdPersonControl')],
    },
  };
}

function launch(): { game: Game; hero: GameObject; area: ReturnType<typeof buildTestArea> } {
  const area = buildTestArea((key) => key, heroObjects(), HERO);
  const assets = new Map<string, ScriptAsset>();
  for (const [id, data] of area.scripts) {
    const result = compileBlockScript(data.workspace, { assetName: id, variables: data.variables });
    expect(result.diagnostics).toEqual([]);
    assets.set(id, {
      assetId: id,
      module: loadScriptModule(result.code, `blockwerk://test/${id}.js`),
      variables: data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `blockwerk://test/${id}.js`,
    });
  }
  const game = new Game(area.scene, { scripts: (id) => assets.get(id) ?? null });
  const hero = game.world.getObject(HERO);
  if (!hero) throw new Error('no hero');
  return { game, hero, area };
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

/** Puts the hero at a spot, facing +Z, and lets it settle. */
function placeAt(game: Game, hero: GameObject, x: number, y: number, z: number): void {
  hero.object3d.rotation.set(0, 0, 0);
  hero.setPosition(x, y, z);
  run(game, 0.4);
}

const key = (game: Game, code: string, down: boolean): void =>
  game.input.keyEvent(code, down, code);

describe('test area', () => {
  it('is a valid scene with the player inside, facing +Z at the start', () => {
    const { area } = launch();
    expect(sceneSchema.safeParse(area.scene).success).toBe(true);
    expect(area.scene.objects[HERO]?.transform.position).toEqual([0, 0.05, -10]);
    // A player without a camera gets a third-person rig.
    const types = Object.values(area.scene.objects).flatMap((o) => o.components.map((c) => c.type));
    expect(types).toContain('thirdPersonCamera');
    expect(subtreeOf(area.scene.objects, HERO)).toHaveProperty(HERO);
  });

  it('keeps the camera of a player that brings its own', () => {
    const objects = heroObjects();
    objects['herocamera01'] = {
      ...(objects[HERO] as SceneObjectData),
      name: 'Cam',
      parent: HERO,
      components: [component('camera')],
    };
    const area = buildTestArea((key2) => key2, objects, HERO);
    const cameras = Object.values(area.scene.objects).filter((o) =>
      o.components.some((c) => c.type === 'camera'),
    );
    expect(cameras).toHaveLength(1);
  });

  it('climbs the staircases up to the step offset but not the 0.5 m one', () => {
    TEST_AREA.stepHeights.forEach((height, flight) => {
      const { game, hero } = launch();
      placeAt(game, hero, -21 + flight * 6, 0.05, 0.5);
      key(game, 'KeyW', true);
      let highest = 0;
      run(game, 6, () => (highest = Math.max(highest, hero.position.y)));
      const climbable = height <= 0.35;
      if (climbable) expect(highest, `${height} m steps`).toBeGreaterThan(6 * height - 0.2);
      else expect(highest, `${height} m steps`).toBeLessThan(0.3);
      game.dispose();
    });
  });

  it('walks up ramps up to the slope limit and slides off steeper ones', () => {
    TEST_AREA.rampAngles.forEach((angle, index) => {
      const { game, hero } = launch();
      placeAt(game, hero, 5 + index * 5, 0.05, 0.5);
      key(game, 'KeyW', true);
      let highest = 0;
      run(game, 6, () => (highest = Math.max(highest, hero.position.y)));
      if (angle <= 45) expect(highest, `${angle}°`).toBeGreaterThan(1.5);
      else expect(highest, `${angle}°`).toBeLessThan(1);
      game.dispose();
    });
  });

  it('jumps over gaps depending on speed', () => {
    const attempt = (gap: number, sprint: boolean): boolean => {
      const { game, hero } = launch();
      // The platform before the gap ends at x = -20, later ones after the earlier gaps.
      let edge = -20;
      for (const width of TEST_AREA.gapWidths) {
        if (width === gap) break;
        edge += width + 4;
      }
      placeAt(game, hero, edge - 2.5, TEST_AREA.gapPlatformTop + 0.05, 16);
      // Input is camera-relative: the camera looks along +Z, so "A" walks towards +X.
      key(game, 'KeyA', true);
      if (sprint) key(game, 'ShiftLeft', true);
      let jumped = false;
      let crossed = false;
      run(game, 3, () => {
        if (!jumped && hero.position.x > edge - 0.2) {
          jumped = true;
          key(game, 'Space', true);
        }
        // Landed on the platform behind the gap (not on the ground below).
        if (
          hero.position.x > edge + gap + 0.5 &&
          hero.position.y > TEST_AREA.gapPlatformTop - 0.2
        ) {
          crossed = true;
        }
      });
      game.dispose();
      return crossed;
    };
    expect(attempt(1, false)).toBe(true);
    expect(attempt(3, true)).toBe(true);
    expect(attempt(4, false)).toBe(false);
  });

  it('carries the player on the moving platform', () => {
    const { game, hero } = launch();
    placeAt(game, hero, -8, 0.3, 26);
    const platform = [...game.world.allObjects()].find((o) =>
      o.components.some((c) => c.definition.type === 'blockScript'),
    );
    if (!platform) throw new Error('no platform');
    let platformMax = -Infinity;
    let heroMax = -Infinity;
    run(game, 3.5, () => {
      platformMax = Math.max(platformMax, platform.position.x);
      heroMax = Math.max(heroMax, hero.position.x);
    });
    // The platform slides 7 m to the right and back; the player stands still on it and rides along.
    expect(platformMax).toBeGreaterThan(-1.5);
    expect(heroMax).toBeGreaterThan(-2.5);
    // It rides along, not ahead of the platform.
    expect(heroMax).toBeLessThan(platformMax + 0.3);
    expect(hero.position.y).toBeGreaterThan(0.1);
    expect(TEST_PLATFORM_SCRIPT).toBe('testareaplat');
    game.dispose();
  });

  it('pushes the stack of crates', () => {
    const { game, hero } = launch();
    const crates = [...game.world.allObjects()].filter((o) =>
      o.components.some((c) => c.definition.type === 'rigidbody'),
    );
    expect(crates).toHaveLength(10);
    const before = crates.map((crate) => crate.position.clone());
    placeAt(game, hero, 6, 0.05, 22);
    key(game, 'KeyW', true);
    key(game, 'ShiftLeft', true);
    run(game, 3);
    const moved = crates.filter((crate, index) => {
      const start = before[index];
      return start !== undefined && crate.position.distanceTo(start) > 0.5;
    });
    expect(moved.length).toBeGreaterThan(2);
    game.dispose();
  });

  it('lets the player through the 1.0 m corridor but not the 0.5 m one', () => {
    for (const [x, passes] of [
      [16, true],
      [21, false],
    ] as const) {
      const { game, hero } = launch();
      placeAt(game, hero, x, 0.05, 20);
      key(game, 'KeyW', true);
      run(game, 6);
      if (passes) expect(hero.position.z, `corridor at ${x}`).toBeGreaterThan(31);
      else expect(hero.position.z, `corridor at ${x}`).toBeLessThan(27);
      game.dispose();
    }
  });
});
