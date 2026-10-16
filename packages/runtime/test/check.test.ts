import { beforeAll, describe, expect, it } from 'vitest';
import { checkWorld, Game, initNavigation, initPhysics } from '../src';
import type { CheckContext, Problem } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [40, 1, 40] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

const noContext: CheckContext = { assetExists: () => true, scripts: [] };

function check(
  objects: Record<string, ReturnType<typeof objectData>>,
  context: Partial<CheckContext> = {},
): Problem[] {
  const game = new Game(sceneData(objects), { scripts: () => null });
  return checkWorld(game.world, { ...noContext, ...context });
}

const codes = (problems: readonly Problem[]): string[] => problems.map((problem) => problem.code);

describe('scene check', () => {
  it('finds nothing in a healthy scene', () => {
    expect(check({ ground000001: ground })).toEqual([]);
  });

  it('reports an empty required inspector field with the object to jump to', () => {
    const problems = check({
      ground000001: ground,
      hero00000001: objectData({
        name: 'Held',
        components: [component('blockScript', {}, 'herosc000001')],
      }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      severity: 'warning',
      code: 'emptyReference',
      params: { object: 'Held' },
      link: { objectId: 'hero00000001' },
    });
  });

  it('reports references to assets and objects that do not exist', () => {
    const problems = check(
      {
        ground000001: ground,
        hero00000001: objectData({
          name: 'Held',
          components: [
            component('blockScript', { script: 'gone00000001' }, 'herosc000001'),
            component('cameraFollow', { target: 'nobody000001' }, 'herofollow001'),
          ],
        }),
      },
      { assetExists: (_type, reference) => reference !== 'gone00000001' },
    );
    expect(codes(problems)).toContain('brokenAssetReference');
    expect(problems.find((p) => p.code === 'brokenAssetReference')?.severity).toBe('error');
  });

  it('reports messages without a receiver, from scripts and from UI buttons', () => {
    const problems = check(
      { ground000001: ground },
      {
        scripts: [
          {
            assetId: 'sender000001',
            name: 'Sender',
            sends: [
              { message: 'allein', blockId: 'b1' },
              { message: 'gehört', blockId: 'b2' },
            ],
            receives: [],
            emptySlots: [],
          },
          {
            assetId: 'listener0001',
            name: 'Hörer',
            sends: [],
            receives: ['gehört'],
            emptySlots: [],
          },
        ],
        otherSenders: [
          { message: 'vomMenue', source: 'Hauptmenü', link: { assetId: 'menu00000001' } },
          { message: 'gehört', source: 'Hauptmenü', link: { assetId: 'menu00000001' } },
          { message: 'amMenue', source: 'Hauptmenü', link: { assetId: 'menu00000001' } },
        ],
      },
    );
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatchObject({
      code: 'messageWithoutReceiver',
      params: { message: 'allein', source: 'Sender' },
      link: { assetId: 'sender000001', blockId: 'b1' },
    });
    expect(problems.map((p) => p.params['message'])).toEqual(['allein', 'vomMenue', 'amMenue']);
  });

  it('reports empty block slots with the block', () => {
    const problems = check(
      { ground000001: ground },
      {
        scripts: [
          {
            assetId: 'script000001',
            name: 'Leer',
            sends: [],
            receives: [],
            emptySlots: [{ blockId: 'b9', blockText: 'gehe ( ) Meter' }],
          },
        ],
      },
    );
    expect(problems[0]).toMatchObject({
      code: 'emptySlot',
      link: { assetId: 'script000001', blockId: 'b9' },
    });
  });

  it('finds an NPC that stands outside the navigation mesh', () => {
    const problems = check({
      ground000001: ground,
      inside0000001: objectData({
        name: 'Wache 1',
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        components: [component('navAgent', {}, 'guard1nav001')],
      }),
      outside000001: objectData({
        name: 'Wache 2',
        transform: { position: [60, 0, 60], rotation: [0, 0, 0], scale: [1, 1, 1] },
        components: [component('navAgent', {}, 'guard2nav001')],
      }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      severity: 'error',
      code: 'npcOutsideNavigation',
      params: { object: 'Wache 2' },
      link: { objectId: 'outside000001' },
    });
  });

  it('reports NPCs in a scene without any ground', () => {
    const problems = check({
      outside000001: objectData({
        name: 'Wache',
        components: [component('navAgent', {}, 'guardnav0001')],
      }),
    });
    expect(codes(problems)).toEqual(['npcWithoutNavigation']);
  });

  it('reports a player without a camera, and none when there is one', () => {
    const player = objectData({
      name: 'Held',
      components: [component('thirdPersonControl', {}, 'herocontrol1')],
    });
    expect(codes(check({ ground000001: ground, hero00000001: player }))).toEqual([
      'playerWithoutCamera',
    ]);
    const camera = objectData({
      name: 'Kamera',
      components: [component('camera', {}, 'cam000000001')],
    });
    expect(check({ ground000001: ground, hero00000001: player, camera000001: camera })).toEqual([]);
  });

  it('lists models without a collider as one hint', () => {
    const model = (name: string, collider: boolean) =>
      objectData({
        name,
        components: [
          component(
            'meshRenderer',
            { model: 'library:kenney/house' },
            `${name}mesh`.padEnd(12, '0'),
          ),
          ...(collider ? [component('boxCollider', {}, `${name}coll`.padEnd(12, '0'))] : []),
        ],
      });
    const problems = check({
      ground000001: ground,
      a0000000001: model('Haus1', false),
      a0000000002: model('Haus2', false),
      a0000000003: model('Haus3', true),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      severity: 'info',
      code: 'modelWithoutCollider',
      params: { count: '2' },
    });
  });
});

describe('problems found while playing', () => {
  it('reports an NPC that cannot reach its target, once, with the target named', () => {
    const entries: unknown[] = [];
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: objectData({
          name: 'Held',
          tag: 'Player',
          transform: { position: [60, 0, 60], rotation: [0, 0, 0], scale: [1, 1, 1] },
        }),
        guard0000001: objectData({
          name: 'Wache 2',
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [
            component('navAgent', {}, 'guardnav0001'),
            component('npc', { startState: 'chase' }, 'guardnpc0001'),
            component('follow', { distance: 1.5 }, 'guardfollow1'),
          ],
        }),
      }),
      { scripts: () => null, log: (entry) => entries.push(entry) },
    );
    for (let i = 0; i < 180; i++) game.stepTick();
    const problems = entries.filter(
      (entry): entry is { kind: 'problem'; problem: Problem } =>
        typeof entry === 'object' && entry !== null && 'kind' in entry && entry.kind === 'problem',
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]?.problem).toMatchObject({
      severity: 'error',
      code: 'noPathToTarget',
      params: { object: 'Wache 2', target: 'Held' },
      link: { objectId: 'guard0000001' },
    });
  });
});

describe('figure without a walk animation', () => {
  it('reports a moving figure whose model has no walking or running clip', async () => {
    const { AnimationClip, Group, Object3D, VectorKeyframeTrack } = await import('three');
    const { ModelCache } = await import('../src');
    const scene = new Group();
    const bone = new Object3D();
    bone.name = 'marker';
    scene.add(bone);
    const clip = new AnimationClip('Wave', 1, [
      new VectorKeyframeTrack('marker.position', [0, 1], [0, 0, 0, 0, 0, 0]),
    ]);
    const models = new ModelCache(() => null);
    models.provide('library:test/statue', { scene, animations: [clip], skinned: false });
    const entries: unknown[] = [];
    const game = new Game(
      sceneData({
        ground000001: ground,
        hero00000001: objectData({
          name: 'Statue',
          components: [
            component('meshRenderer', { model: 'library:test/statue' }, 'heromesh0001'),
            component('animator', {}, 'heroanim0001'),
            component('characterController', {}, 'heroccontr01'),
            component('thirdPersonControl', {}, 'herocontrol1'),
          ],
        }),
      }),
      { scripts: () => null, models, log: (entry) => entries.push(entry) },
    );
    for (let i = 0; i < 30; i++) game.stepTick();
    const problems = entries.filter(
      (entry): entry is { kind: 'problem'; problem: Problem } =>
        typeof entry === 'object' && entry !== null && 'kind' in entry && entry.kind === 'problem',
    );
    expect(problems.map((entry) => entry.problem.code)).toEqual(['figureWithoutAnimation']);
    expect(problems[0]?.problem.link).toEqual({ objectId: 'hero00000001' });
  });
});
