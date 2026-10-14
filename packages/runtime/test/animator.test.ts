import { beforeAll, describe, expect, it } from 'vitest';
import { AnimationClip, Group, Object3D, VectorKeyframeTrack } from 'three';
import { animatorRegistry, Game, initPhysics, ModelCache } from '../src';
import type { GameObject, ModelTemplate } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

/**
 * Clips that hold a marker bone at a fixed x position each, so the bone's x after blending is
 * the weighted sum of the playing clips (idle 0, walk 10, run 20 …).
 */
const CLIPS: Readonly<Record<string, [number, number]>> = {
  Idle: [0, 1],
  Walking_A: [10, 1.2],
  Running_A: [20, 0.8],
  Jump_Start: [30, 0.4],
  Jump_Idle: [40, 1],
  Jump_Land: [50, 0.5],
  Wave: [60, 1],
};

function template(): ModelTemplate {
  const scene = new Group();
  const bone = new Object3D();
  bone.name = 'marker';
  scene.add(bone);
  const animations = Object.entries(CLIPS).map(
    ([name, [x, duration]]) =>
      new AnimationClip(name, duration, [
        new VectorKeyframeTrack('marker.position', [0, duration], [x, 0, 0, x, 0, 0]),
      ]),
  );
  return { scene, animations, skinned: false };
}

function makeGame(animatorValues: Record<string, unknown> = {}): Game {
  const models = new ModelCache(() => null);
  models.provide('library:test/hero', template());
  const ground = objectData({
    name: 'Ground',
    transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [60, 1, 60] },
    components: [component('boxCollider', {}, 'groundcoll01')],
  });
  const hero = objectData({
    name: 'Hero',
    components: [
      component('meshRenderer', { model: 'library:test/hero' }, 'heromesh0001'),
      component('animator', { crossFade: 0.2, ...animatorValues }, 'heroanim0001'),
      component('characterController', {}, 'heroccontr01'),
      component('thirdPersonControl', {}, 'herocontrol1'),
    ],
  });
  return new Game(sceneData({ ground000001: ground, hero00000001: hero }), {
    scripts: () => null,
    models,
  });
}

function marker(game: Game): number {
  const hero = game.world.getObject('hero00000001') as GameObject;
  let x = NaN;
  hero.object3d.traverse((node) => {
    if (node.name === 'marker') x = node.position.x;
  });
  return x;
}

function run(game: Game, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    game.stepTick();
    each?.();
  }
}

describe('animator', () => {
  it('blends idle, walk and run by speed with smooth cross-fades', async () => {
    const game = makeGame();
    await game.world.modelsLoaded();
    run(game, 0.5);
    const animator = animatorRegistry.get(game.world.getObject('hero00000001') as GameObject);
    expect(animator?.current).toBe('idle');
    expect(marker(game)).toBeCloseTo(0, 3);
    game.input.keyEvent('KeyW', true, 'KeyW');
    // The blend changes gradually: no jumps of the marker from tick to tick.
    let previous = marker(game);
    let largestStep = 0;
    run(game, 1.5, () => {
      largestStep = Math.max(largestStep, Math.abs(marker(game) - previous));
      previous = marker(game);
    });
    expect(largestStep).toBeLessThan(2);
    // At walking speed only the walk clip plays.
    expect(animator?.current).toBe('walk');
    expect(marker(game)).toBeCloseTo(10, 0);
    game.input.keyEvent('ShiftLeft', true, 'ShiftLeft');
    run(game, 1.5);
    expect(animator?.current).toBe('run');
    expect(marker(game)).toBeCloseTo(20, 0);
    game.dispose();
  });

  it('plays jump, fall and land, and one-shot clips from blocks', async () => {
    const game = makeGame();
    await game.world.modelsLoaded();
    run(game, 0.5);
    const animator = animatorRegistry.get(game.world.getObject('hero00000001') as GameObject);
    const seen = new Set<string | null>();
    game.input.keyEvent('Space', true, 'Space');
    run(game, 0.05);
    game.input.keyEvent('Space', false, 'Space');
    run(game, 1.3, () => seen.add(animator?.current ?? null));
    expect([...seen]).toEqual(expect.arrayContaining(['jump', 'fall', 'land']));
    run(game, 1);
    expect(animator?.current).toBe('idle');

    let finished = '';
    if (!animator) throw new Error('animator');
    animator.onFinished = (name) => (finished = name);
    expect(animator.play('Wave', { once: true })).toBe(true);
    expect(animator.play('dance')).toBe(false);
    run(game, 0.5);
    expect(animator.current).toBe('Wave');
    expect(marker(game)).toBeCloseTo(60, 0);
    run(game, 0.7);
    expect(finished).toBe('Wave');
    run(game, 0.5);
    expect(animator.current).toBe('idle');
    expect(marker(game)).toBeCloseTo(0, 0);
    game.dispose();
  });

  it('fires animation events at the marked time of a clip', async () => {
    const game = makeGame({ markers: 'walk@0.5=step' });
    await game.world.modelsLoaded();
    const animator = animatorRegistry.get(game.world.getObject('hero00000001') as GameObject);
    if (!animator) throw new Error('animator');
    run(game, 0.5);
    animator.takeEvents();
    animator.play('walk', { fade: 0.05 });
    const heard: string[] = [];
    run(game, 3, () => {
      for (const event of animator.takeEvents()) if (event.name === 'step') heard.push(event.phase);
    });
    // The walk clip is 1.2 s long: the marker at 0.5 s passes about every 1.2 s.
    expect(heard.length).toBeGreaterThanOrEqual(2);
    expect(heard.length).toBeLessThanOrEqual(3);
    game.dispose();
  });
});
