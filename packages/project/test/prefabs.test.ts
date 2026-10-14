import { describe, expect, it } from 'vitest';
import {
  applyOverridesToPrefab,
  createPrefabData,
  createVariantData,
  FORMAT_VERSION,
  instanceMembers,
  instanceRootOf,
  instantiatePrefab,
  linkToPrefab,
  prefabFromEdited,
  prefabSchema,
  resolvePrefab,
  revertOverrides,
  sceneSchema,
  syncPrefabInstances,
  updateInstanceOverrides,
} from '../src';
import type { ComponentData, PrefabData, SceneData, SceneObjectData } from '../src';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `id${counter.toString().padStart(10, '0')}`;
}

function object(
  name: string,
  parent: string | null,
  components: ComponentData[] = [],
  order = 0,
): SceneObjectData {
  return {
    name,
    parent,
    order,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components,
  };
}

function light(color: string, intensity: number): ComponentData {
  return { id: 'lightcomp001', type: 'light', enabled: true, values: { color, intensity } };
}

/** A lantern: pole with a light child. */
function lanternScene(): Record<string, SceneObjectData> {
  return {
    lantern00001: object('Laterne', null, [
      { id: 'render000001', type: 'meshRenderer', enabled: true, values: { shape: 'cylinder' } },
    ]),
    lamp00000001: object('Lampe', 'lantern00001', [light('#ffcc66', 2)]),
  };
}

/** A tiny prefab store. */
function store(initial: Record<string, PrefabData> = {}) {
  const prefabs = new Map(Object.entries(initial));
  return {
    prefabs,
    source: (id: string) => prefabs.get(id),
  };
}

function lampOf(objects: Record<string, SceneObjectData>, rootId: string): SceneObjectData {
  const members = instanceMembers(objects, rootId);
  const lamp = [...members.values()].find((id) => objects[id]?.name === 'Lampe');
  const data = lamp ? objects[lamp] : undefined;
  if (!data) throw new Error('no lamp');
  return data;
}

function lightValues(object: SceneObjectData) {
  return object.components.find((component) => component.type === 'light')?.values;
}

/** Makes the "Laterne" prefab from the scene and places two more instances. */
function setUp() {
  const { prefabs, source } = store();
  let objects: Record<string, SceneObjectData> = lanternScene();
  const { prefab, links } = createPrefabData(objects, 'lantern00001', nextId);
  prefabs.set('laterne00001', prefab);
  objects = linkToPrefab(objects, 'lantern00001', 'laterne00001', links);
  const resolved = resolvePrefab('laterne00001', source);
  if (!resolved) throw new Error('unresolved');
  const roots = ['lantern00001'];
  for (const x of [4, 8]) {
    const created = instantiatePrefab('laterne00001', resolved, {
      parent: null,
      order: x,
      transform: { position: [x, 0, 0], rotation: [0, 90, 0] },
      createId: nextId,
    });
    objects = { ...objects, ...created.objects };
    roots.push(created.rootId);
  }
  return { prefabs, source, objects, roots };
}

describe('prefabs', () => {
  it('creates a prefab from objects and links them as an instance', () => {
    const { prefabs, objects, roots } = setUp();
    const prefab = prefabs.get('laterne00001');
    expect(prefabSchema.safeParse(prefab).success).toBe(true);
    expect(Object.keys(prefab?.objects ?? {})).toHaveLength(2);
    expect(objects['lantern00001']?.prefab?.overrides).toEqual([]);
    expect(instanceMembers(objects, 'lantern00001').size).toBe(2);
    const scene: SceneData = {
      formatVersion: FORMAT_VERSION,
      environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
      objects,
    };
    expect(sceneSchema.safeParse(scene).success).toBe(true);
    // Every instance: 2 objects, root at its own place.
    expect(Object.keys(objects)).toHaveLength(6);
    expect(objects[roots[1] ?? '']?.transform.position).toEqual([4, 0, 0]);
    const lamp = [...instanceMembers(objects, roots[1] ?? '').values()].find(
      (id) => id !== roots[1],
    );
    expect(instanceRootOf(objects, lamp ?? '')).toBe(roots[1]);
  });

  it('changing the prefab updates all instances; an overridden value stays', () => {
    const { prefabs, source, roots, ...rest } = setUp();
    let objects = rest.objects;
    const [first, second, third] = roots as [string, string, string];
    // Instance 2 gets a blue lamp: an override.
    const lampId = [...instanceMembers(objects, second).values()].find((id) => id !== second);
    const lamp = objects[lampId ?? ''];
    if (!lamp || !lampId) throw new Error('no lamp');
    objects = {
      ...objects,
      [lampId]: { ...lamp, components: [light('#3366ff', 2)] },
    };
    objects = updateInstanceOverrides(objects, second, source);
    expect(objects[second]?.prefab?.overrides).toEqual([
      {
        object: lamp.prefab?.object,
        path: 'component:lightcomp001:color',
        value: '#3366ff',
      },
    ]);

    // The prefab's lamp gets brighter, and a new child (a sign) appears.
    const prefab = prefabs.get('laterne00001');
    if (!prefab) throw new Error('no prefab');
    const prefabLamp = Object.entries(prefab.objects).find(([, item]) => item.name === 'Lampe');
    if (!prefabLamp) throw new Error('no prefab lamp');
    prefabs.set('laterne00001', {
      ...prefab,
      objects: {
        ...prefab.objects,
        [prefabLamp[0]]: { ...prefabLamp[1], components: [light('#ffcc66', 5)] },
        sign00000001: object('Schild', prefab.root, [], 1),
      },
    });
    objects = syncPrefabInstances(objects, source, nextId);

    expect(lightValues(lampOf(objects, first))).toEqual({ color: '#ffcc66', intensity: 5 });
    expect(lightValues(lampOf(objects, third))).toEqual({ color: '#ffcc66', intensity: 5 });
    expect(lightValues(lampOf(objects, second))).toEqual({ color: '#3366ff', intensity: 5 });
    for (const root of roots) {
      const names = [...instanceMembers(objects, root).values()].map((id) => objects[id]?.name);
      expect(names.sort()).toEqual(['Lampe', 'Laterne', 'Schild']);
    }
    // Instance roots keep their own place.
    expect(objects[second]?.transform.position).toEqual([4, 0, 0]);
    expect(objects[second]?.transform.rotation).toEqual([0, 90, 0]);
  });

  it('a variant inherits changes of its base and keeps its own values', () => {
    const { prefabs, source, roots, ...rest } = setUp();
    const base = resolvePrefab('laterne00001', source);
    if (!base) throw new Error('unresolved');
    // "Rote Laterne": the lamp is red.
    const variant = createVariantData('laterne00001', base);
    const redLamp = Object.entries(base.objects).find(([, item]) => item.name === 'Lampe');
    if (!redLamp) throw new Error('no lamp');
    const edited = {
      ...base.objects,
      [redLamp[0]]: { ...redLamp[1], components: [light('#ff0000', 2)] },
    };
    prefabs.set('rotelaterne1', prefabFromEdited(variant, edited, source));
    expect(prefabs.get('rotelaterne1')?.overrides).toEqual([
      { object: redLamp[0], path: 'component:lightcomp001:color', value: '#ff0000' },
    ]);
    const red = resolvePrefab('rotelaterne1', source);
    if (!red) throw new Error('unresolved');
    let objects = { ...rest.objects };
    const created = instantiatePrefab('rotelaterne1', red, {
      parent: null,
      order: 9,
      createId: nextId,
    });
    objects = { ...objects, ...created.objects };

    // The base lamp gets brighter: the variant and its instances follow, still red.
    const prefab = prefabs.get('laterne00001');
    if (!prefab) throw new Error('no prefab');
    prefabs.set('laterne00001', {
      ...prefab,
      objects: {
        ...prefab.objects,
        [redLamp[0]]: { ...redLamp[1], components: [light('#ffcc66', 7)] },
      },
    });
    expect(
      lightValues(resolvePrefab('rotelaterne1', source)?.objects[redLamp[0]] ?? redLamp[1]),
    ).toEqual({
      color: '#ff0000',
      intensity: 7,
    });
    objects = syncPrefabInstances(objects, source, nextId);
    expect(lightValues(lampOf(objects, created.rootId))).toEqual({
      color: '#ff0000',
      intensity: 7,
    });
    expect(lightValues(lampOf(objects, roots[0] ?? ''))).toEqual({
      color: '#ffcc66',
      intensity: 7,
    });
  });

  it('nested prefabs follow the inner prefab', () => {
    const { prefabs, source, objects: sceneObjects, roots } = setUp();
    // "Strasse" contains two lantern instances.
    const street: Record<string, SceneObjectData> = {
      street000001: object('Strasse', null),
    };
    const lanterns = Object.fromEntries(
      Object.entries(sceneObjects).filter(([id]) => {
        const root = instanceRootOf(sceneObjects, id);
        return root === roots[1] || root === roots[2];
      }),
    );
    for (const root of [roots[1], roots[2]]) {
      const data = lanterns[root ?? ''];
      if (data) lanterns[root ?? ''] = { ...data, parent: 'street000001' };
    }
    const { prefab } = createPrefabData({ ...street, ...lanterns }, 'street000001', nextId);
    prefabs.set('strasse00001', prefab);
    expect(
      Object.values(prefab.objects).filter((item) => item.prefab?.asset === 'laterne00001'),
    ).toHaveLength(4);
    const resolved = resolvePrefab('strasse00001', source);
    if (!resolved) throw new Error('unresolved');
    const created = instantiatePrefab('strasse00001', resolved, {
      parent: null,
      order: 0,
      createId: nextId,
    });
    let objects: Record<string, SceneObjectData> = created.objects;
    expect(Object.keys(objects)).toHaveLength(5);

    // The lantern prefab changes: the street prefab and its instances follow.
    const lantern = prefabs.get('laterne00001');
    if (!lantern) throw new Error('no prefab');
    const lamp = Object.entries(lantern.objects).find(([, item]) => item.name === 'Lampe');
    if (!lamp) throw new Error('no lamp');
    prefabs.set('laterne00001', {
      ...lantern,
      objects: { ...lantern.objects, [lamp[0]]: { ...lamp[1], components: [light('#00ff00', 1)] } },
    });
    objects = syncPrefabInstances(objects, source, nextId);
    const lamps = Object.values(objects).filter((item) => item.name === 'Lampe');
    expect(lamps).toHaveLength(2);
    for (const item of lamps) expect(lightValues(item)).toEqual({ color: '#00ff00', intensity: 1 });
  });

  it('applies overrides to the prefab and reverts them', () => {
    const { prefabs, source, roots, ...rest } = setUp();
    let objects = rest.objects;
    const second = roots[1] ?? '';
    const lampId = [...instanceMembers(objects, second).values()].find((id) => id !== second);
    const lamp = objects[lampId ?? ''];
    if (!lamp || !lampId) throw new Error('no lamp');
    objects = { ...objects, [lampId]: { ...lamp, components: [light('#3366ff', 3)] } };
    objects = updateInstanceOverrides(objects, second, source);
    expect(objects[second]?.prefab?.overrides).toHaveLength(2);

    // Revert only the intensity.
    objects = revertOverrides(objects, second, source, (item) => item.path.endsWith(':intensity'));
    expect(lightValues(lampOf(objects, second))).toEqual({ color: '#3366ff', intensity: 2 });

    // Apply the color to the prefab: every instance turns blue, the override is gone.
    const prefab = prefabs.get('laterne00001');
    if (!prefab) throw new Error('no prefab');
    prefabs.set(
      'laterne00001',
      applyOverridesToPrefab(
        prefab,
        objects[second]?.prefab?.overrides ?? [],
        source,
        'laterne00001',
      ),
    );
    objects = revertOverrides(objects, second, source);
    objects = syncPrefabInstances(objects, source, nextId);
    for (const root of roots) {
      expect(lightValues(lampOf(objects, root))).toEqual({ color: '#3366ff', intensity: 2 });
    }
    expect(objects[second]?.prefab?.overrides).toEqual([]);
  });

  it('keeps objects and components the user added to an instance', () => {
    const { source, roots, ...rest } = setUp();
    const root = roots[0] ?? '';
    const lampId = [...instanceMembers(rest.objects, root).values()].find((id) => id !== root);
    const lamp = rest.objects[lampId ?? ''];
    if (!lamp || !lampId) throw new Error('no lamp');
    let objects: Record<string, SceneObjectData> = {
      ...rest.objects,
      [lampId]: {
        ...lamp,
        components: [
          ...lamp.components,
          { id: 'extra0000001', type: 'boxCollider', enabled: true, values: {} },
        ],
      },
      flag00000001: object('Fahne', root),
    };
    objects = updateInstanceOverrides(objects, root, source);
    expect(objects[root]?.prefab?.overrides).toEqual([]);
    objects = syncPrefabInstances(objects, source, nextId);
    expect(objects['flag00000001']?.parent).toBe(root);
    expect(objects[lampId]?.components.map((item) => item.id)).toContain('extra0000001');
  });

  it('records values the prefab leaves at their default as overrides', () => {
    const { source, roots, ...rest } = setUp();
    const root = roots[1] ?? '';
    const object = rest.objects[root];
    if (!object) throw new Error('no root');
    const objects = updateInstanceOverrides(
      {
        ...rest.objects,
        [root]: {
          ...object,
          components: object.components.map((component) => ({
            ...component,
            values: { ...component.values, color: '#3366ff' },
          })),
        },
      },
      root,
      source,
    );
    expect(objects[root]?.prefab?.overrides).toEqual([
      { object: object.prefab?.object, path: 'component:render000001:color', value: '#3366ff' },
    ]);
  });

  it('keeps unchanged objects identical when syncing', () => {
    const { source, objects } = setUp();
    const synced = syncPrefabInstances(objects, source, nextId);
    for (const [id, item] of Object.entries(objects)) expect(synced[id]).toBe(item);
  });

  it('survives missing prefabs and cycles', () => {
    const { prefabs, source, objects } = setUp();
    prefabs.delete('laterne00001');
    expect(syncPrefabInstances(objects, source, nextId)).toEqual(objects);
    const looping: PrefabData = {
      formatVersion: FORMAT_VERSION,
      base: 'loop00000001',
      root: 'x00000000001',
      objects: {},
      overrides: [],
    };
    prefabs.set('loop00000001', looping);
    expect(resolvePrefab('loop00000001', source)).toBeUndefined();
  });
});
