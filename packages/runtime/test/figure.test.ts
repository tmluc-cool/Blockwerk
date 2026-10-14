import type { JsonValue } from '@blockwerk/project';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
  QuaternionKeyframeTrack,
} from 'three';
import {
  animatorRegistry,
  controlRegistry,
  figureRegistry,
  Game,
  initPhysics,
  ModelCache,
  renderedModels,
} from '../src';
import type { GameObject, ModelTemplate } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

/** T-pose world positions of the bones of a small humanoid. */
const BONES: [string, string | null, [number, number, number]][] = [
  ['hips', null, [0, 1, 0]],
  ['spine', 'hips', [0, 1.2, 0]],
  ['head', 'spine', [0, 1.6, 0]],
  ['leftUpperArm', 'spine', [0.2, 1.45, 0]],
  ['leftLowerArm', 'leftUpperArm', [0.5, 1.45, 0]],
  ['leftHand', 'leftLowerArm', [0.75, 1.45, 0]],
  ['rightUpperArm', 'spine', [-0.2, 1.45, 0]],
  ['rightLowerArm', 'rightUpperArm', [-0.5, 1.45, 0]],
  ['rightHand', 'rightLowerArm', [-0.75, 1.45, 0]],
  ['leftUpperLeg', 'hips', [0.1, 0.95, 0]],
  ['leftLowerLeg', 'leftUpperLeg', [0.1, 0.5, 0]],
  ['leftFoot', 'leftLowerLeg', [0.1, 0.08, 0]],
  ['rightUpperLeg', 'hips', [-0.1, 0.95, 0]],
  ['rightLowerLeg', 'rightUpperLeg', [-0.1, 0.5, 0]],
  ['rightFoot', 'rightLowerLeg', [-0.1, 0.08, 0]],
];

/** A skinned humanoid with the given bone names, plus a loose "Cape" mesh (gear). */
function humanoid(
  name: (standard: string) => string,
  clips: AnimationClip[] = [],
  scale = 1,
): ModelTemplate {
  const bones = new Map<string, Bone>();
  for (const [standard, parent, position] of BONES) {
    const bone = new Bone();
    bone.name = name(standard);
    const parentPosition = BONES.find(([n]) => n === parent)?.[2] ?? [0, 0, 0];
    bone.position.set(
      (position[0] - parentPosition[0]) * scale,
      (position[1] - parentPosition[1]) * scale,
      (position[2] - parentPosition[2]) * scale,
    );
    if (parent) bones.get(parent)?.add(bone);
    bones.set(standard, bone);
  }
  const geometry = new BoxGeometry(0.6, 1.7, 0.3).translate(0, 0.85, 0);
  const count = geometry.attributes['position']?.count ?? 0;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(
      Array.from({ length: count * 4 }, (_, i) => (i % 4 === 0 ? 1 : 0)),
      4,
    ),
  );
  const body = new SkinnedMesh(geometry, new MeshStandardMaterial({ color: '#ffffff' }));
  body.name = 'Body';
  const scene = new Group();
  const hips = bones.get('hips') as Bone;
  hips.position.multiplyScalar(1);
  scene.add(hips);
  scene.add(body);
  body.bind(new Skeleton([...bones.values()]));
  const cape = new Mesh(
    new BoxGeometry(0.5, 1, 0.05).translate(0, 1.2, -0.2),
    new MeshStandardMaterial(),
  );
  cape.name = 'Cape';
  scene.add(cape);
  scene.updateMatrixWorld(true);
  return { scene, animations: clips, skinned: true };
}

/** A walking and an idle clip on the standard bone names. */
function donorClips(): AnimationClip[] {
  const swing = (bone: string, angle: number): QuaternionKeyframeTrack => {
    const q = (a: number) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), a);
    const a = q(angle);
    const b = q(-angle);
    return new QuaternionKeyframeTrack(
      `${bone}.quaternion`,
      [0, 0.5, 1],
      [a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, a.x, a.y, a.z, a.w],
    );
  };
  const still = (bone: string): QuaternionKeyframeTrack =>
    new QuaternionKeyframeTrack(`${bone}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
  return [
    new AnimationClip('Idle', 1, [still('hips')]),
    new AnimationClip('Walking_A', 1, [swing('leftUpperLeg', 0.6), swing('rightUpperLeg', -0.6)]),
    new AnimationClip('Running_A', 1, [swing('leftUpperLeg', 0.9), swing('rightUpperLeg', -0.9)]),
  ];
}

const ground = objectData({
  name: 'Ground',
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [40, 1, 40] },
  components: [component('boxCollider', {}, 'groundcoll01')],
});

function figureHero(values: Record<string, JsonValue>) {
  return objectData({
    name: 'Hero',
    components: [
      component('character', values, 'herofigure01'),
      component('animator', {}, 'heroanimator1'),
      component('characterController', {}, 'herocctrl001'),
      component('thirdPersonControl', {}, 'herocontrol1'),
    ],
  });
}

async function launch(
  models: ModelCache,
  values: Record<string, JsonValue>,
): Promise<{ game: Game; hero: GameObject }> {
  const game = new Game(sceneData({ ground000001: ground, hero00000001: figureHero(values) }), {
    scripts: () => null,
    models,
  });
  await game.world.modelsLoaded();
  game.stepTick();
  // Retargeting waits for the donor model, which loads in a second round.
  await game.world.modelsLoaded();
  const hero = game.world.getObject('hero00000001') as GameObject;
  return { game, hero };
}

function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

describe('figure', () => {
  it('recognizes a skeleton, scales to the body height and plays library animations retargeted', async () => {
    const models = new ModelCache(() => null);
    models.provide(
      'library:test/donor',
      humanoid((n) => n, donorClips()),
    );
    // The model has other bone names and no animations of its own.
    models.provide(
      'library:test/hero',
      humanoid((n) => n.replace('left', 'L_').replace('right', 'R_'), [], 1.2),
    );
    const { game, hero } = await launch(models, {
      model: 'library:test/hero',
      animationSource: 'library:test/donor',
      hiddenParts: 'Cape',
    });
    const info = figureRegistry.get(hero);
    expect(info?.mode).toBe('skeleton');
    expect(info?.mapping?.complete).toBe(true);
    expect(info?.gear).toEqual(['Cape']);
    // 1.7 m tall box scaled to the body height 1.8 (the hidden cape does not count).
    const root = info?.root as Group;
    expect(root.scale.y).toBeCloseTo(1.8 / 1.7, 2);
    expect(root.getObjectByName('Cape')?.visible).toBe(false);
    // The library walk/run/idle arrived as extra clips and the animator uses them.
    const extra = renderedModels.get(hero)?.extraClips ?? [];
    expect(extra.map((clip) => clip.name).sort()).toEqual(['Idle', 'Running_A', 'Walking_A']);
    game.input.keyEvent('w', true, 'KeyW');
    run(game, 1.5);
    expect(animatorRegistry.get(hero)?.current).toBe('walk');
    // The target's own bones (other names) are animated: the left leg swings.
    const leg = root.getObjectByName('L_UpperLeg');
    const angles: number[] = [];
    for (let i = 0; i < 40; i++) {
      game.stepTick();
      angles.push(2 * Math.asin(Math.abs(leg?.quaternion.x ?? 0)));
    }
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(0.3);
    game.dispose();
  });

  it('tints parts and attaches items to the right hand, following the animation', async () => {
    const models = new ModelCache(() => null);
    models.provide(
      'library:test/donor',
      humanoid((n) => n, donorClips()),
    );
    models.provide(
      'library:test/hero',
      humanoid((n) => n),
    );
    const sword = new Group();
    sword.add(new Mesh(new BoxGeometry(0.05, 0.8, 0.05)));
    models.provide('library:test/sword', { scene: sword, animations: [], skinned: false });
    const { game, hero } = await launch(models, {
      model: 'library:test/hero',
      tints: 'Body=#ff0000',
      attachments: 'library:test/sword@rightHand',
      animationSource: 'library:test/donor',
    });
    const info = figureRegistry.get(hero);
    const body = info?.root.getObjectByName('Body') as SkinnedMesh;
    expect((body.material as MeshStandardMaterial).color.getHex()).toBe(
      new Color('#ff0000').getHex(),
    );
    const item = info?.attached.get('rightHand');
    expect(item?.parent?.name).toBe('rightHand');
    game.dispose();
  });

  it('a model without skeleton is a rigid figure that bobs, leans and squashes on landing', async () => {
    const models = new ModelCache(() => null);
    const scene = new Group();
    const slime = new Mesh(
      new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      new MeshStandardMaterial(),
    );
    slime.name = 'Slime';
    scene.add(slime);
    models.provide('library:test/slime', { scene, animations: [], skinned: false });
    const { game, hero } = await launch(models, { model: 'library:test/slime' });
    const info = figureRegistry.get(hero);
    expect(info?.mode).toBe('rigid');
    const root = info?.root as Group;
    expect(root.scale.y).toBeCloseTo(1.8, 2);
    run(game, 0.5);
    const rest = root.position.y;
    game.input.keyEvent('w', true, 'KeyW');
    let highest = rest;
    run(game, 1);
    for (let i = 0; i < 40; i++) {
      game.stepTick();
      highest = Math.max(highest, root.position.y);
    }
    expect(highest).toBeGreaterThan(rest + 0.02);
    expect(root.rotation.x).toBeGreaterThan(0.05);
    game.input.keyEvent('w', false, 'KeyW');
    game.input.keyEvent(' ', true, 'Space');
    run(game, 0.05);
    game.input.keyEvent(' ', false, 'Space');
    let squashed = false;
    for (let i = 0; i < 120; i++) {
      game.stepTick();
      if (root.scale.y < 1.8 * 0.9 && controlRegistry.get(hero)?.grounded) squashed = true;
    }
    expect(squashed).toBe(true);
    game.dispose();
  });
});
