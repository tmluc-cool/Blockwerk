import { Color, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SceneObjectData } from '@blockwerk/project';
import { controlRegistry, Game, initPhysics, setQuality, WaterSurface, World } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

const light = {
  sunDirection: () => new Vector3(0, 1, 0),
  sunColor: () => new Color('#ffffff'),
  skyColor: () => new Color('#99bbee'),
};

const settings = {
  size: [20, 10] as const,
  shallowColor: '#3ea5bc',
  deepColor: '#0c3a58',
  waveHeight: 0.1,
  waveSpeed: 1,
  clarity: 0.5,
};

describe('WaterSurface', () => {
  it('reflects the scene at half or full resolution and only the sky when off', () => {
    const surface = new WaterSurface(light);
    surface.configure({ ...settings, reflection: 'off' });
    expect(surface.reflects).toBe(false);
    expect(surface.root.children).toHaveLength(1);
    surface.configure({ ...settings, reflection: 'half' });
    expect(surface.reflects).toBe(true);
    // The plane was built again with a mirror; there is still only one plane.
    expect(surface.root.children).toHaveLength(1);
    expect(surface.root.children[0]?.type).toBe('Reflector');
    surface.configure({ ...settings, reflection: 'full', waveHeight: 0.3 });
    expect(surface.root.children).toHaveLength(1);
    surface.dispose();
    expect(surface.root.children).toHaveLength(0);
  });
});

describe('water component and swimming', () => {
  const lake = objectData({
    name: 'Lake',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [component('water', { width: 20, depth: 20 }, 'watercomp001')],
  });
  const bed = objectData({
    name: 'Bed',
    transform: { position: [0, -3.5, 0], rotation: [0, 0, 0], scale: [60, 1, 60] },
    components: [component('boxCollider', {}, 'bedcollider01')],
  });
  const hero = (position: [number, number, number]): SceneObjectData =>
    objectData({
      name: 'Hero',
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('characterController', {}, 'herocctrl001'),
        component('thirdPersonControl', {}, 'herocontrol1'),
      ],
    });

  it('knows where the water is', () => {
    const world = new World(sceneData({ lake0000001: lake }));
    expect(world.waterSurfaceAt(0, 0)).toBe(0);
    expect(world.waterSurfaceAt(9.9, -9.9)).toBe(0);
    expect(world.waterSurfaceAt(10.5, 0)).toBeNull();
    world.dispose();
    expect(world.waters.size).toBe(0);
  });

  it('lets a character float and swim in deep water, but walk in shallows', () => {
    setQuality('low');
    const game = new Game(
      sceneData({ lake0000001: lake, bed000000001: bed, hero00000001: hero([0, -2.9, 0]) }),
      { scripts: () => null },
    );
    for (let i = 0; i < 180; i++) game.stepTick();
    const object = game.world.getObject('hero00000001');
    const state = object ? controlRegistry.get(object) : undefined;
    expect(state?.swimming).toBe(true);
    // Floats with the head out of the water, not on the bottom.
    expect(object?.position.y).toBeGreaterThan(-1.8);
    expect(object?.position.y).toBeLessThan(-0.4);
    game.dispose();

    const shallow = new Game(
      sceneData({
        lake0000001: lake,
        bed000000001: { ...bed, transform: { ...bed.transform, position: [0, -0.9, 0] } },
        hero00000001: hero([0, -0.3, 0]),
      }),
      { scripts: () => null },
    );
    for (let i = 0; i < 120; i++) shallow.stepTick();
    const wader = shallow.world.getObject('hero00000001');
    expect(wader && controlRegistry.get(wader)?.swimming).toBe(false);
    shallow.dispose();
    setQuality('high');
  });

  it('does not let anything swim when the water is not swimmable', () => {
    const solid = {
      ...lake,
      components: [component('water', { swimmable: false }, 'watercomp001')],
    };
    const world = new World(sceneData({ lake0000001: solid }));
    expect(world.waterSurfaceAt(0, 0)).toBeNull();
    world.dispose();
  });
});
