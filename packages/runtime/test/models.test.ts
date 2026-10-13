import { describe, expect, it } from 'vitest';
import type { InstancedMesh, Mesh } from 'three';
import { Game, ModelCache, World } from '../src';
import type { GameObject } from '../src';
import { component, objectData, sceneData, scriptAsset } from './helpers';

/** A one-triangle GLB model as a data URL (no files or network needed). */
function triangleModel(): string {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const gltf = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Triangle' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.6, 0.2, 1] } }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    buffers: [{ byteLength: positions.byteLength }],
  };
  const pad = (data: Buffer, fill: number): Buffer =>
    Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4, fill)]);
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20);
  const bin = pad(Buffer.from(positions.buffer), 0);
  const chunk = (data: Buffer, type: number): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32LE(data.length, 0);
    header.writeUInt32LE(type, 4);
    return Buffer.concat([header, data]);
  };
  const body = Buffer.concat([chunk(json, 0x4e4f534a), chunk(bin, 0x004e4942)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return `data:model/gltf-binary;base64,${Buffer.concat([header, body]).toString('base64')}`;
}

const MODEL_URL = triangleModel();

function models(): ModelCache {
  return new ModelCache((ref) => (ref === 'library:test/tree' ? MODEL_URL : null));
}

function trees(count: number, model = 'library:test/tree') {
  const objects: Record<string, ReturnType<typeof objectData>> = {};
  for (let index = 0; index < count; index++) {
    const id = `tree${index.toString().padStart(8, '0')}`;
    objects[id] = objectData({
      name: `Tree ${index}`,
      order: index,
      transform: { position: [index * 2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('meshRenderer', { model }, `rend${index.toString().padStart(8, '0')}`),
      ],
    });
  }
  return sceneData(objects);
}

function instancedMeshes(world: World): InstancedMesh[] {
  return world.scene.children.filter(
    (child): child is InstancedMesh =>
      (child as { isInstancedMesh?: boolean }).isInstancedMesh === true,
  );
}

function modelOf(object: GameObject | undefined) {
  return object?.object3d.children.find((child) => child.userData['model'] === true);
}

describe('models and automatic instancing', () => {
  it('loads a model into the Mesh Renderer instead of the shape', async () => {
    let loaded = 0;
    const world = new World(trees(1), { models: models(), onModelLoaded: () => loaded++ });
    const tree = world.getObject('tree00000000');
    await world.modelsLoaded();
    expect(loaded).toBe(1);
    const model = modelOf(tree);
    expect(model).toBeDefined();
    // The built-in shape is gone; the model is picked as the object.
    expect(tree?.object3d.children).toHaveLength(1);
    let mesh: Mesh | null = null;
    model?.traverse((node) => {
      if ((node as { isMesh?: boolean }).isMesh) mesh = node as Mesh;
    });
    expect(world.objectFromNode(mesh)?.id).toBe('tree00000000');
    world.dispose();
  });

  it('draws equal models as one instanced mesh and follows visibility and movement', async () => {
    const world = new World(trees(200), { models: models() });
    await world.modelsLoaded();
    world.prepareRender();
    expect(world.batcher.stats()).toEqual({ batches: 1, instances: 200 });
    const [batch] = instancedMeshes(world);
    expect(batch?.count).toBe(200);

    world.getObject('tree00000007')?.setVisible(false);
    world.getObject('tree00000008')?.setActive(false);
    world.prepareRender();
    expect(world.batcher.stats().instances).toBe(198);

    const moved = world.getObject('tree00000001');
    moved?.object3d.position.set(0, 5, 0);
    world.prepareRender();
    const batchNow = instancedMeshes(world)[0];
    const members: number[] = [];
    for (let index = 0; index < (batchNow?.count ?? 0); index++) {
      const matrix = batchNow?.instanceMatrix.array.slice(index * 16, index * 16 + 16);
      if (matrix?.[13] === 5) members.push(index);
    }
    expect(members).toHaveLength(1);

    world.removeObject('tree00000002');
    world.prepareRender();
    expect(world.batcher.stats().instances).toBe(197);
    world.dispose();
    expect(instancedMeshes(world)).toHaveLength(0);
  });

  it('keeps few copies as normal meshes', async () => {
    const world = new World(trees(2), { models: models() });
    await world.modelsLoaded();
    world.prepareRender();
    expect(world.batcher.stats()).toEqual({ batches: 0, instances: 0 });
    world.dispose();
  });

  it('shows the shape when a model is missing or no loader is given', async () => {
    const missing = new World(trees(1, 'library:test/unknown'), { models: models() });
    await missing.modelsLoaded();
    const tree = missing.getObject('tree00000000');
    expect(modelOf(tree)).toBeUndefined();
    expect(tree?.object3d.children).toHaveLength(1);
    missing.dispose();

    const plain = new World(trees(1));
    expect(plain.getObject('tree00000000')?.object3d.children).toHaveLength(1);
    plain.dispose();
  });

  it('switches between model and shape when the field changes', async () => {
    const data = trees(1);
    const world = new World(data, { models: models() });
    await world.modelsLoaded();
    const tree = world.getObject('tree00000000');
    const object = data.objects['tree00000000'];
    if (!object) throw new Error('no tree');
    const [renderer] = object.components;
    if (!renderer) throw new Error('no renderer');
    world.sync({
      ...data,
      objects: {
        tree00000000: {
          ...object,
          components: [{ ...renderer, values: { model: null, shape: 'sphere' } }],
        },
      },
    });
    expect(modelOf(tree)).toBeUndefined();
    expect((tree?.object3d.children[0] as Mesh | undefined)?.isMesh).toBe(true);
    world.dispose();
  });

  it('gives clones in play mode their own copy of the model', async () => {
    const asset = scriptAsset('script000001', [
      {
        id: 'hat',
        event: { type: 'start' },
        *run(self, api) {
          api.clone(self, 'self');
        },
      },
    ]);
    const data = trees(1);
    const tree = data.objects['tree00000000'];
    if (!tree) throw new Error('no tree');
    const game = new Game(
      {
        ...data,
        objects: {
          tree00000000: {
            ...tree,
            components: [...tree.components, component('blockScript', { script: 'script000001' })],
          },
        },
      },
      { scripts: () => asset, models: models() },
    );
    await game.world.modelsLoaded();
    game.stepTick();
    await game.world.modelsLoaded();
    const copies = [...game.world.allObjects()].filter((object) => modelOf(object));
    expect(copies).toHaveLength(2);
    game.dispose();
  });
});
