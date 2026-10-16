import type { DialogData, SceneObjectData, UiData, VariableData } from '@blockwerk/project';
import {
  animatorRegistry,
  cameraRegistry,
  controlRegistry,
  figureRegistry,
  Game,
  loadScriptModule,
  ModelCache,
} from '@blockwerk/runtime';
import type {
  AudioEngine,
  CarryState,
  GameLogEntry,
  GameObject,
  SaveStorage,
  ScriptAsset,
} from '@blockwerk/runtime';
import {
  AnimationClip,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  VectorKeyframeTrack,
} from 'three';
import { expect } from 'vitest';
import { compileProject } from '../src';
import type { CompileResult } from '../src';
import { b, set, workspace } from './dsl';
import type { TestBlock } from './dsl';

/** One runtime test case; `covers` lists the block IDs it exercises. */
export interface RuntimeCase {
  readonly name: string;
  readonly covers: readonly string[];
  readonly run: () => void | Promise<void>;
}

export const A = 'varaaaaaaaaa';
export const B = 'varbbbbbbbbb';
export const LIST = 'varlistxxxxx';
export const DICT = 'vardictxxxxx';
export const VARIABLES: VariableData[] = [
  { id: A, name: 'A', type: 'number', scope: 'game', default: 0, inspector: false },
  { id: B, name: 'B', type: 'string', scope: 'game', default: '', inspector: false },
  { id: LIST, name: 'Liste', type: 'list', scope: 'game', default: [], inspector: false },
  {
    id: DICT,
    name: 'Wörterbuch',
    type: 'dictionary',
    scope: 'game',
    default: {},
    inspector: false,
  },
];

type Vec = [number, number, number];

export function object(
  name: string,
  position: Vec,
  components: SceneObjectData['components'],
  more = {},
) {
  return {
    name,
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: { position, rotation: [0, 0, 0] as Vec, scale: [1, 1, 1] as Vec },
    components,
    ...more,
  } satisfies SceneObjectData;
}

export function component(
  type: string,
  values: Record<string, unknown> = {},
  id = type.slice(0, 10),
) {
  return { id: id.padEnd(12, '0').slice(0, 12), type, enabled: true, values } as never;
}

export const ground = object('Ground', [0, -0.5, 0], [component('boxCollider', {}, 'groundcol')], {
  transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [60, 1, 60] },
});

function toAsset(id: string, result: CompileResult): ScriptAsset {
  expect(result.diagnostics).toEqual([]);
  const sourceUrl = `blockwerk://test/${id}.js`;
  return {
    assetId: id,
    module: loadScriptModule(result.code, sourceUrl),
    variables: VARIABLES,
    lineToBlock: result.lineToBlock,
    sourceUrl,
  };
}

/** A scripted object: its components plus a block script (one per object). */
function scripted(
  name: string,
  position: Vec,
  components: SceneObjectData['components'],
  asset: string,
  more = {},
): SceneObjectData {
  return object(
    name,
    position,
    [...components, component('blockScript', { script: asset }, `${asset}sc`)],
    more,
  );
}

export interface Scene {
  readonly objects: Record<string, SceneObjectData>;
  readonly scripts: Record<string, unknown>;
  readonly models?: ModelCache;
  readonly audio?: AudioEngine;
  readonly dialogs?: Record<string, DialogData>;
  readonly sceneId?: string;
  readonly carry?: CarryState;
  readonly spawn?: string;
  readonly uis?: Record<string, UiData>;
  readonly saves?: SaveStorage;
  readonly log?: (entry: GameLogEntry) => void;
}

export function launch(scene: Scene): Game {
  // All scripts are compiled together, so project-wide custom blocks are linked in.
  const compiled = compileProject(
    Object.entries(scene.scripts).map(([id, source]) => ({
      assetId: id,
      assetName: id,
      workspace: source,
      variables: VARIABLES,
    })),
  );
  const assets = new Map([...compiled].map(([id, result]) => [id, toAsset(id, result)] as const));
  return new Game(
    {
      formatVersion: 1,
      environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
      objects: scene.objects,
    },
    {
      scripts: (id) => assets.get(id) ?? null,
      models: scene.models,
      audio: scene.audio,
      dialogs: (id) => scene.dialogs?.[id] ?? null,
      sceneId: scene.sceneId,
      uis: (id) => scene.uis?.[id] ?? null,
      saves: scene.saves,
      carry: scene.carry,
      spawn: scene.spawn,
      random: () => 0.5,
      ...(scene.log ? { log: scene.log } : {}),
    },
  );
}

export function run(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
}

export function get(game: Game, id: string): GameObject {
  const found = game.world.getObject(id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

export const hero = (components: SceneObjectData['components'] = [], asset = 'hero') =>
  scripted(
    'Hero',
    [0, 0, 0],
    [
      component('characterController', {}, 'herocctrl'),
      component('thirdPersonControl', {}, 'herocontrol'),
      ...components,
    ],
    asset,
  );

export const when = (hat: TestBlock, ...blocks: TestBlock[]): TestBlock[] => [hat, ...blocks];

export const phase3Cases: RuntimeCase[] = [
  {
    name: 'action hats and player blocks steer the controller',
    covers: [
      'events.whenAction',
      'player.setValue',
      'player.lockControls',
      'player.crouch',
      'player.standUp',
      'player.jump',
    ],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero() },
        scripts: {
          hero: workspace(
            when(
              b('events.whenAction', { action: 'interact', phase: 'pressed', player: '1' }),
              b('player.setValue', { setting: 'walkSpeed' }, { value: 4 }),
              b('player.lockControls', { state: 'lock' }),
              b('player.crouch'),
            ),
            when(
              b('events.whenAction', { action: 'interact', phase: 'released', player: '1' }),
              b('player.lockControls', { state: 'unlock' }),
              b('player.standUp'),
              b('player.jump'),
            ),
            // Never fires: this is player 1's key.
            when(
              b('events.whenAction', { action: 'interact', phase: 'pressed', player: '2' }),
              set(A, 99),
            ),
          ),
        },
      });
      const state = controlRegistry.get(get(game, 'hero00000001'));
      if (!state) throw new Error('no control');
      run(game, 0.3);
      game.input.keyEvent('e', true, 'KeyE');
      run(game, 0.2);
      expect(state.settings.walkSpeed).toBe(4);
      expect(state.locked).toBe(true);
      expect(state.crouching).toBe(true);
      // Locked: walking does nothing.
      game.input.keyEvent('w', true, 'KeyW');
      run(game, 0.5);
      expect(get(game, 'hero00000001').position.z).toBeCloseTo(0, 1);
      game.input.keyEvent('w', false, 'KeyW');
      game.input.keyEvent('e', false, 'KeyE');
      run(game, 0.3);
      expect(state.locked).toBe(false);
      expect(state.crouching).toBe(false);
      expect(get(game, 'hero00000001').position.y).toBeGreaterThan(0.3);
      expect(game.vars[A]).toBe(0);
      game.dispose();
    },
  },
  {
    name: 'player reporters read the state and teleport puts the player at a checkpoint',
    covers: ['player.onGround', 'player.isRunning', 'player.speed', 'player.teleport'],
    run: () => {
      const checkpoint = object('Checkpoint', [8, 0, 8], []);
      const game = launch({
        objects: { ground000001: ground, check0000001: checkpoint, hero00000001: hero() },
        scripts: {
          hero: workspace(
            when(
              b('events.whenAction', { action: 'interact', phase: 'pressed', player: 'any' }),
              b('player.teleport', { target: 'object:check0000001' }),
            ),
            when(
              b('events.everyFrame'),
              b('control.if', {}, { condition: b('player.onGround'), then: [set(A, 1)] }),
              b('control.if', {}, { condition: b('player.isRunning'), then: [set(B, 'rennt')] }),
              b('variables.change', { variable: { id: A } }, { by: b('player.speed') }),
            ),
          ),
        },
      });
      run(game, 0.3);
      expect(game.vars[A]).toBe(1);
      game.input.keyEvent('w', true, 'KeyW');
      game.input.keyEvent('Shift', true, 'ShiftLeft');
      run(game, 1);
      expect(game.vars[B]).toBe('rennt');
      expect(Number(game.vars[A])).toBeGreaterThan(1);
      game.input.keyEvent('e', true, 'KeyE');
      run(game, 0.1);
      const position = get(game, 'hero00000001').position;
      expect(position.x).toBeCloseTo(8, 0);
      expect(position.z).toBeGreaterThan(7.5);
      game.dispose();
    },
  },
  {
    name: 'zones report who enters and leaves, and velocity moves rigidbodies',
    covers: ['events.whenZone', 'physics.setVelocity'],
    run: () => {
      const zone = scripted(
        'Zone',
        [5, 0.5, 0],
        [component('boxCollider', { isTrigger: true }, 'zonecoll')],
        'zone',
        { tag: 'Zone' },
      );
      const crate = scripted(
        'Crate',
        [0, 0.5, 0],
        [component('boxCollider', {}, 'cratecoll'), component('rigidbody', {}, 'craterigid')],
        'crate',
        { tag: 'Crate' },
      );
      const game = launch({
        objects: { ground000001: ground, zone00000001: zone, crate0000001: crate },
        scripts: {
          zone: workspace(
            when(b('events.whenZone', { target: 'tag:Crate', phase: 'enter' }), set(A, 1)),
            when(b('events.whenZone', { target: 'any', phase: 'exit' }), set(B, 'weg')),
          ),
          crate: workspace(
            when(
              b('events.whenGameStarts'),
              b('control.wait', {}, { seconds: 0.2 }),
              b('physics.setVelocity', {}, { x: 9, y: 0, z: 0 }),
            ),
          ),
        },
      });
      run(game, 0.6);
      expect(get(game, 'crate0000001').position.x).toBeGreaterThan(2);
      run(game, 1.5);
      expect(game.vars[A]).toBe(1);
      expect(game.vars[B]).toBe('weg');
      game.dispose();
    },
  },
  {
    name: 'push, gravity and body type change how objects fall',
    covers: ['physics.push', 'physics.setGravity', 'physics.setBodyType'],
    run: () => {
      const crate = (asset: string, x: number, y: number) =>
        scripted(
          `Crate ${asset}`,
          [x, y, 0],
          [
            component('boxCollider', {}, `${asset}coll`),
            component('rigidbody', {}, `${asset}rigid`),
          ],
          asset,
        );
      const game = launch({
        objects: {
          ground000001: ground,
          pushed000001: crate('pushed', -4, 0.5),
          frozen000001: crate('frozen', 4, 3),
        },
        scripts: {
          pushed: workspace(
            when(
              b('events.whenGameStarts'),
              b('control.wait', {}, { seconds: 0.2 }),
              b('physics.push', { direction: 'up' }, { force: 6 }),
            ),
          ),
          frozen: workspace(
            when(b('events.whenGameStarts'), b('physics.setBodyType', { type: 'kinematic' })),
          ),
        },
      });
      let apex = 0;
      for (let i = 0; i < 90; i++) {
        game.stepTick();
        apex = Math.max(apex, get(game, 'pushed000001').position.y);
      }
      // An impulse of 6 on 1 kg gives 6 m/s: 6² / (2 · 9.81) = 1.8 m above the start.
      expect(apex).toBeGreaterThan(0.5 + 1.5);
      expect(apex).toBeLessThan(0.5 + 2.2);
      // The kinematic crate hangs in the air.
      expect(get(game, 'frozen000001').position.y).toBeCloseTo(3, 1);
      game.dispose();

      // Gravity applies to the whole scene: on the moon a crate falls much more slowly.
      const moon = launch({
        objects: { ground000001: ground, moon00000001: crate('moon', 8, 20) },
        scripts: {
          moon: workspace(
            when(b('events.whenGameStarts'), b('physics.setGravity', {}, { value: 1.62 })),
          ),
        },
      });
      run(moon, 1.5);
      // 0.5 · 1.62 · 1.5² ≈ 1.8 m (Earth: 11 m).
      expect(get(moon, 'moon00000001').position.y).toBeGreaterThan(17.5);
      expect(get(moon, 'moon00000001').position.y).toBeLessThan(19);
      moon.dispose();
    },
  },
  {
    name: 'raycast reporters tell what is ahead',
    covers: ['physics.whatIsAhead', 'physics.distanceAhead'],
    run: () => {
      const wall = object('Wand', [0, 1, 3], [component('boxCollider', {}, 'wallcoll')], {
        transform: { position: [0, 1, 3], rotation: [0, 0, 0], scale: [4, 2, 1] },
      });
      const scout = scripted(
        'Scout',
        [0, 0.5, 0],
        [component('boxCollider', {}, 'scoutcoll')],
        'scout',
      );
      const game = launch({
        objects: { ground000001: ground, wall00000001: wall, scout0000001: scout },
        scripts: {
          scout: workspace(
            when(
              b('events.everyFrame'),
              set(B, b('physics.whatIsAhead', {}, { meters: 5 })),
              set(A, b('physics.distanceAhead', {}, { meters: 10 })),
            ),
          ),
        },
      });
      run(game, 0.2);
      expect(game.vars[B]).toBe('Wand');
      // From the center of the scout (y + 0.5) to the near face of the wall (z = 2.5).
      expect(Number(game.vars[A])).toBeCloseTo(2.5, 1);
      get(game, 'wall00000001').setActive(false);
      run(game, 0.2);
      expect(game.vars[B]).toBe('');
      expect(Number(game.vars[A])).toBe(10);
      game.dispose();
    },
  },
  {
    name: 'camera blocks switch views with transitions and change distance, shake and field of view',
    covers: [
      'camera.switchTo',
      'camera.switchToObject',
      'camera.setDistance',
      'camera.shake',
      'camera.setFieldOfView',
      'camera.playPath',
    ],
    run: () => {
      const rig = (name: string, behavior: string, position: Vec, values = {}) =>
        object(name, position, [
          component('camera', { player: '1' }, `${name}cam`),
          component(behavior, values, `${name}beh`),
        ]);
      const path = object('Path', [0, 0, 0], []);
      const point = (x: number, order: number) =>
        object(`P${order}`, [x, 4, 12], [], { parent: 'path00000001', order });
      const game = launch({
        objects: {
          ground000001: ground,
          hero00000001: hero([], 'hero'),
          third0000001: rig('Third', 'thirdPersonCamera', [0, 3, -5]),
          top000000001: rig('Top', 'topDownCamera', [0, 10, 0]),
          dolly0000001: rig('Dolly', 'cameraPath', [0, 4, 12], {
            path: 'path00000001',
            playOnStart: false,
          }),
          path00000001: path,
          point0000001: point(-3, 0),
          point0000002: point(3, 1),
        },
        scripts: {
          hero: workspace(
            when(
              b('events.whenAction', { action: 'interact', phase: 'pressed', player: '1' }),
              b('camera.switchTo', { view: 'topDown' }),
              b('camera.setDistance', {}, { distance: 20 }),
              b('camera.shake', {}, { strength: 4, seconds: 0.5 }),
              b('camera.setFieldOfView', {}, { fov: 90, seconds: 0.5 }),
            ),
            when(
              b('events.whenAction', { action: 'attack', phase: 'pressed', player: '1' }),
              b('camera.switchToObject', { target: 'object:third0000001' }),
            ),
            when(
              b('events.whenAction', { action: 'crouch', phase: 'pressed', player: '1' }),
              b('camera.playPath', { target: 'object:dolly0000001' }),
            ),
          ),
        },
      });
      const camera = (id: string) => cameraRegistry.get(get(game, id))?.camera;
      run(game, 0.3);
      game.input.keyEvent('e', true, 'KeyE');
      run(game, 0.1);
      game.input.keyEvent('e', false, 'KeyE');
      const top = cameraRegistry.get(get(game, 'top000000001'));
      expect(top?.enabled).toBe(true);
      expect(cameraRegistry.get(get(game, 'third0000001'))?.enabled).toBe(false);
      // The picture glides: right after the switch it is neither of the two cameras.
      expect(game.views().views[0]?.camera).not.toBe(camera('top000000001'));
      expect(
        Math.abs(top?.camera.rotation.x ?? 0) + Math.abs(top?.camera.rotation.z ?? 0),
      ).toBeGreaterThan(0);
      run(game, 0.6);
      expect(game.views().views[0]?.camera).toBe(camera('top000000001'));
      expect(camera('top000000001')?.fov).toBeGreaterThan(80);
      run(game, 0.6);
      expect(camera('top000000001')?.fov).toBeCloseTo(90, 1);
      // 20 m away at the default 60° angle: 20 · sin 60° ≈ 17.3 m above the target.
      expect(
        get(game, 'top000000001').position.y - get(game, 'hero00000001').position.y,
      ).toBeCloseTo(20 * Math.sin(Math.PI / 3), 0);
      game.input.keyEvent('f', true, 'KeyF');
      run(game, 0.1);
      game.input.keyEvent('f', false, 'KeyF');
      expect(cameraRegistry.get(get(game, 'third0000001'))?.enabled).toBe(true);
      expect(top?.enabled).toBe(false);
      run(game, 1);
      game.input.keyEvent('c', true, 'KeyC');
      run(game, 0.1);
      game.input.keyEvent('c', false, 'KeyC');
      expect(cameraRegistry.get(get(game, 'dolly0000001'))?.enabled).toBe(true);
      run(game, 2);
      // The path runs from x = -3 to 3 over 5 seconds.
      expect(get(game, 'dolly0000001').position.x).toBeGreaterThan(-3);
      expect(get(game, 'dolly0000001').position.x).toBeLessThan(3);
      game.dispose();
    },
  },
  {
    name: 'character blocks dress the figure and switch the movement profile',
    covers: [
      'character.attach',
      'character.detach',
      'character.switchPart',
      'character.setPartColor',
      'character.setProfile',
    ],
    run: async () => {
      const models = new ModelCache(() => null);
      const scene = new Group();
      for (const name of ['Body', 'Hat', 'Helmet']) {
        const part = new Mesh(
          new BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
          new MeshStandardMaterial(),
        );
        part.name = name;
        scene.add(part);
      }
      models.provide('library:test/hero', { scene, animations: [], skinned: false });
      const item = new Group();
      item.add(new Mesh(new BoxGeometry(0.1, 0.5, 0.1)));
      models.provide('library:test/sword', { scene: item, animations: [], skinned: false });
      models.provide('library:test/shield', {
        scene: item.clone(),
        animations: [],
        skinned: false,
      });
      const game = launch({
        models,
        objects: {
          ground000001: ground,
          hero00000001: hero(
            [
              component(
                'character',
                {
                  model: 'library:test/hero',
                  hiddenParts: 'Helmet',
                  attachments: 'library:test/shield@leftHand',
                },
                'herofigure',
              ),
            ],
            'hero',
          ),
        },
        scripts: {
          hero: workspace(
            when(
              b('events.whenGameStarts'),
              b('character.attach', {
                item: 'library:test/sword',
                point: 'rightHand',
              }),
              b('character.detach', { point: 'leftHand' }),
              b('character.switchPart', { from: 'Hat', to: 'Helmet' }),
              b('character.setPartColor', { part: 'Body', color: '#ff0000' }),
              b('character.setProfile', { profile: 'heavy' }),
            ),
          ),
        },
      });
      await game.world.modelsLoaded();
      run(game, 0.2);
      await game.world.modelsLoaded();
      const hero1 = get(game, 'hero00000001');
      const info = figureRegistry.get(hero1);
      if (!info) throw new Error('no figure');
      expect(info.root.getObjectByName('Hat')?.visible).toBe(false);
      expect(info.root.getObjectByName('Helmet')?.visible).toBe(true);
      const body = info.root.getObjectByName('Body') as Mesh;
      expect((body.material as MeshStandardMaterial).color.getHex()).toBe(0xff0000);
      expect([...info.attached.keys()]).toEqual(['rightHand']);
      // The heavy profile is slower and jumps lower than the arcade default.
      const control = controlRegistry.get(hero1);
      expect(control?.settings.walkSpeed).toBeLessThan(3);
      expect(hero1.findComponent('character')?.values['profile']).toBe('heavy');
      game.dispose();
    },
  },
  {
    name: 'ability blocks turn abilities on and off and report stamina and rolls',
    covers: [
      'character.setAbility',
      'character.hasAbility',
      'character.setStamina',
      'character.stamina',
      'events.whenAbility',
    ],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          hero00000001: hero(
            [
              component('roll', {}, 'heroroll'),
              component('doubleJump', {}, 'herodjump'),
              component('stamina', { max: 5, drain: 1, regen: 0.5, delay: 0.5 }, 'herostam'),
            ],
            'hero',
          ),
        },
        scripts: {
          hero: workspace(
            when(
              b('events.whenGameStarts'),
              b('character.setStamina', {}, { percent: 40 }),
              set(A, b('character.stamina')),
              b('character.setAbility', { state: 'off', ability: 'doubleJump' }),
            ),
            when(b('events.whenAbility', { ability: 'roll', phase: 'started' }), set(B, 'gerollt')),
            when(
              b('events.whenAction', { action: 'interact', phase: 'pressed', player: '1' }),
              b(
                'control.if',
                {},
                {
                  condition: b('character.hasAbility', { ability: 'doubleJump' }),
                  then: [set(A, 99)],
                },
              ),
            ),
          ),
        },
      });
      run(game, 0.3);
      expect(game.vars[A]).toBe(40);
      // The double jump is switched off now, the roll is still there.
      game.input.keyEvent('e', true, 'KeyE');
      run(game, 0.2);
      game.input.keyEvent('e', false, 'KeyE');
      expect(game.vars[A]).toBe(40);
      game.input.keyEvent('q', true, 'KeyQ');
      run(game, 0.1);
      game.input.keyEvent('q', false, 'KeyQ');
      expect(game.vars[B]).toBe('gerollt');
      game.dispose();
    },
  },
  {
    name: 'animations play on request and report when they finished',
    covers: ['looks.playAnimation', 'events.whenAnimation'],
    run: async () => {
      const clips = Object.entries({ Idle: [0, 1], Wave: [10, 0.5], Cheer: [20, 0.5] } as Record<
        string,
        [number, number]
      >).map(
        ([name, [x, length]]) =>
          new AnimationClip(name, length, [
            new VectorKeyframeTrack('marker.position', [0, length], [x, 0, 0, x, 0, 0]),
          ]),
      );
      const scene = new Group();
      const marker = new Object3D();
      marker.name = 'marker';
      scene.add(marker);
      const models = new ModelCache(() => null);
      models.provide('library:test/hero', { scene, animations: clips, skinned: false });
      const game = launch({
        models,
        objects: {
          ground000001: ground,
          hero00000001: hero(
            [
              component('meshRenderer', { model: 'library:test/hero' }, 'heromesh'),
              component('animator', {}, 'heroanim'),
            ],
            'hero',
          ),
        },
        scripts: {
          hero: workspace(
            when(
              b('events.whenAction', { action: 'attack', phase: 'pressed', player: '1' }),
              b('looks.playAnimation', { mode: 'once' }, { name: 'wave', fade: 0.1 }),
            ),
            when(
              b('events.whenAnimation', { animation: 'wave', phase: 'finished' }),
              set(A, 1),
              b('looks.playAnimation', { mode: 'once' }, { name: 'Cheer', fade: 0.1 }),
            ),
            when(
              b('events.whenAnimation', { animation: 'wave', phase: 'started' }),
              set(B, 'gestartet'),
            ),
          ),
        },
      });
      await game.world.modelsLoaded();
      const hero1 = get(game, 'hero00000001');
      const animator = animatorRegistry.get(hero1);
      if (!animator) throw new Error('no animator');
      run(game, 0.3);
      game.input.keyEvent('f', true, 'KeyF');
      run(game, 0.1);
      game.input.keyEvent('f', false, 'KeyF');
      expect(animator.current).toBe('wave');
      expect(game.vars[B]).toBe('gestartet');
      // The wave lasts 0.5 s; when it ends the script plays the cheer.
      run(game, 0.8);
      expect(game.vars[A]).toBe(1);
      expect(animator.current).toBe('Cheer');
      game.dispose();
    },
  },
];
