import { describe, expect, it } from 'vitest';
import { World } from '../src';
import { component, objectData, sceneData } from './helpers';

const sun = objectData({
  name: 'Sun',
  transform: { position: [0, 3, 0], rotation: [42, 142, 0], scale: [1, 1, 1] },
  components: [component('light', { lightType: 'directional' }, 'sunlight0000')],
});

describe('World', () => {
  it('builds objects, components and the hierarchy from scene data', () => {
    const world = new World(
      sceneData({
        area00000001: objectData({ name: null, area: 'player1', order: 0 }),
        cube00000001: objectData({
          name: 'Cube',
          parent: 'area00000001',
          transform: { position: [1, 2, 3], rotation: [0, 90, 0], scale: [2, 2, 2] },
          components: [
            component('meshRenderer', { shape: 'sphere', color: '#ff0000' }, 'render000001'),
          ],
        }),
        sun000000001: sun,
      }),
      { displayName: () => 'Spieler 1' },
    );
    const cube = world.getObject('cube00000001');
    expect(cube?.parent?.name).toBe('Spieler 1');
    expect(cube?.position.toArray()).toEqual([1, 2, 3]);
    expect(cube?.object3d.rotation.y).toBeCloseTo(Math.PI / 2, 6);
    expect(cube?.findComponent('meshRenderer')?.values['shape']).toBe('sphere');
    expect(world.roots.map((root) => root.id)).toEqual(['area00000001', 'sun000000001']);
    world.dispose();
  });

  it('syncs only changed objects and keeps component instances', () => {
    const initial = sceneData({
      cube00000001: objectData({ components: [component('meshRenderer', {}, 'render000001')] }),
      ball00000001: objectData({ order: 1 }),
    });
    const world = new World(initial);
    const renderer = world.getObject('cube00000001')?.findComponent('meshRenderer');
    const cubeData = initial.objects['cube00000001'];
    if (!cubeData) throw new Error('missing');
    world.sync({
      ...initial,
      objects: {
        ...initial.objects,
        cube00000001: {
          ...cubeData,
          components: [
            {
              id: 'render000001',
              type: 'meshRenderer',
              enabled: true,
              values: { color: '#00ff00' },
            },
          ],
        },
      },
    });
    const after = world.getObject('cube00000001')?.findComponent('meshRenderer');
    expect(after).toBe(renderer);
    expect(after?.values['color']).toBe('#00ff00');

    world.sync({ ...initial, objects: { ball00000001: objectData({ order: 1 }) } });
    expect(world.getObject('cube00000001')).toBeUndefined();
    world.dispose();
  });

  it('reparents objects when the parent changes', () => {
    const data = sceneData({
      parent000001: objectData({ name: 'Parent' }),
      child0000001: objectData({ name: 'Child', order: 1 }),
    });
    const world = new World(data);
    const childData = data.objects['child0000001'];
    if (!childData) throw new Error('missing');
    world.sync({
      ...data,
      objects: { ...data.objects, child0000001: { ...childData, parent: 'parent000001' } },
    });
    expect(world.getObject('child0000001')?.parent?.id).toBe('parent000001');
    expect(world.roots.map((root) => root.id)).toEqual(['parent000001']);
    world.dispose();
  });

  it('drives the sky sun from the first directional light and finds the active camera', () => {
    const world = new World(
      sceneData({
        sun000000001: sun,
        camera000001: objectData({ components: [component('camera')] }),
      }),
    );
    const direction = world.environment.getSunDirection();
    // The sun object looks down (pitch 42°), so the sun is above the ground.
    expect(direction.y).toBeCloseTo(Math.sin((42 * Math.PI) / 180), 5);
    expect(world.activeCamera()).not.toBeNull();
    world.dispose();
  });

  it('reports unknown component types instead of failing', () => {
    const unknown: string[] = [];
    const world = new World(
      sceneData({ thing00000001: objectData({ components: [component('futureThing')] }) }),
      {
        onUnknownComponent: (objectId, data) => unknown.push(`${objectId}:${data.type}`),
      },
    );
    expect(unknown).toEqual(['thing00000001:futureThing']);
    world.dispose();
  });
});
