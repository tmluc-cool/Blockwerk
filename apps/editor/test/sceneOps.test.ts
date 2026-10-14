import { createDefaultScene } from '@blockwerk/project';
import type { SceneData, SceneObjectData } from '@blockwerk/project';
import { describe, expect, it } from 'vitest';
import { History } from '../src/document/history';
import {
  addComponent,
  areaRootOf,
  areaRoots,
  childIds,
  copyName,
  createObject,
  deleteObjects,
  duplicateObjects,
  hierarchyOrder,
  moveComponent,
  moveObjects,
  removeComponent,
  setComponentValue,
  setTransformAxis,
  worldMatrix,
} from '../src/document/sceneOps';

function scene(): SceneData {
  return createDefaultScene({ camera: 'Kamera', sun: 'Sonne', ground: 'Boden' });
}

function idOf(data: SceneData, name: string): string {
  const entry = Object.entries(data.objects).find(([, object]) => object.name === name);
  if (!entry) throw new Error(`no ${name}`);
  return entry[0];
}

function object(data: SceneData, id: string): SceneObjectData {
  const found = data.objects[id];
  if (!found) throw new Error(`no ${id}`);
  return found;
}

describe('scene operations', () => {
  it('creates objects as last child and keeps other objects untouched', () => {
    const start = scene();
    const player = areaRoots(start).find((entry) => entry.object.area === 'player1')?.id ?? null;
    const { scene: next, id } = createObject(start, {
      name: 'Würfel',
      parent: player,
      components: [{ type: 'meshRenderer', enabled: true, values: {} }],
    });
    expect(childIds(next, player).at(-1)).toBe(id);
    expect(object(next, id).components[0]?.id).toMatch(/^[a-z0-9]{12}$/);
    expect(areaRootOf(next, id)).toBe(player);
    for (const [otherId, other] of Object.entries(start.objects)) {
      expect(next.objects[otherId]).toBe(other);
    }
  });

  it('deletes objects with their children', () => {
    const start = scene();
    const environment = areaRoots(start)[0]?.id ?? '';
    const next = deleteObjects(start, [environment]);
    expect(Object.values(next.objects).map((item) => item.name)).not.toContain('Sonne');
    expect(Object.keys(next.objects)).toHaveLength(Object.keys(start.objects).length - 3);
  });

  it('duplicates like Unity: new IDs, "(1)" names, right after the original', () => {
    const start = scene();
    const ground = idOf(start, 'Boden');
    const first = duplicateObjects(start, [ground]);
    const copy = object(first.scene, first.ids[0] ?? '');
    expect(copy.name).toBe('Boden (1)');
    expect(copy.components.map((component) => component.id)).not.toEqual(
      object(start, ground).components.map((component) => component.id),
    );
    const siblings = childIds(first.scene, copy.parent);
    expect(siblings.indexOf(first.ids[0] ?? '')).toBe(siblings.indexOf(ground) + 1);
    const second = duplicateObjects(first.scene, [ground]);
    expect(object(second.scene, second.ids[0] ?? '').name).toBe('Boden (2)');
    expect(copyName('Boden (2)', new Set())).toBe('Boden (3)');
  });

  it('reparents objects and keeps their place in the world', () => {
    let data = scene();
    const parent = createObject(data, {
      name: 'Eltern',
      parent: null,
      transform: { position: [10, 0, 0], rotation: [0, 90, 0], scale: [2, 2, 2] },
    });
    data = parent.scene;
    const child = createObject(data, {
      name: 'Kind',
      parent: null,
      transform: { position: [10, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    });
    data = child.scene;
    const before = worldMatrix(data, child.id).elements;
    data = moveObjects(data, [child.id], { kind: 'inside', parent: parent.id });
    expect(object(data, child.id).parent).toBe(parent.id);
    expect(object(data, child.id).transform.position).toEqual([-2.5, 0, 0]);
    worldMatrix(data, child.id).elements.forEach((value, index) => {
      expect(value).toBeCloseTo(before[index] ?? 0, 4);
    });
    // Moving a parent into its own child does nothing.
    expect(moveObjects(data, [parent.id], { kind: 'inside', parent: child.id })).toBe(data);
  });

  it('reorders siblings before and after a target', () => {
    let data = scene();
    const a = createObject(data, { name: 'A', parent: null });
    const b = createObject(a.scene, { name: 'B', parent: null });
    data = moveObjects(b.scene, [b.id], { kind: 'before', sibling: a.id });
    const roots = childIds(data, null);
    expect(roots.indexOf(b.id)).toBe(roots.indexOf(a.id) - 1);
    data = moveObjects(data, [b.id], { kind: 'after', sibling: a.id });
    expect(childIds(data, null).at(-1)).toBe(b.id);
    expect(hierarchyOrder(data)).toHaveLength(Object.keys(data.objects).length);
  });

  it('edits transforms and components of several objects at once', () => {
    let data = scene();
    const a = createObject(data, { name: 'A', parent: null });
    const b = createObject(a.scene, { name: 'B', parent: null });
    data = setTransformAxis(b.scene, [a.id, b.id], 'position', 1, 3);
    expect(object(data, a.id).transform.position).toEqual([0, 3, 0]);
    expect(object(data, b.id).transform.position).toEqual([0, 3, 0]);
    data = addComponent(data, [a.id, b.id], 'meshRenderer', true);
    data = addComponent(data, [a.id], 'meshRenderer', true);
    expect(object(data, a.id).components).toHaveLength(1);
    data = setComponentValue(data, [a.id, b.id], 'meshRenderer', 0, 'color', '#ff0000');
    expect(object(data, b.id).components[0]?.values['color']).toBe('#ff0000');
    const unchanged = setComponentValue(data, [a.id], 'meshRenderer', 0, 'color', '#ff0000');
    expect(unchanged).toBe(data);
    data = addComponent(data, [a.id], 'boxCollider', false);
    data = moveComponent(data, [a.id], 'boxCollider', 0, -1);
    expect(object(data, a.id).components.map((component) => component.type)).toEqual([
      'boxCollider',
      'meshRenderer',
    ]);
    data = removeComponent(data, [a.id], 'meshRenderer', 0);
    expect(object(data, a.id).components.map((component) => component.type)).toEqual([
      'boxCollider',
    ]);
  });
});

describe('duplicating prefab instances', () => {
  it('keeps links and component IDs of whole instances, unlinks parts', () => {
    const base: SceneData = {
      formatVersion: 1,
      environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
      objects: {
        root00000001: {
          name: 'Laterne',
          parent: null,
          order: 0,
          active: true,
          tag: 'Untagged',
          layer: 'Default',
          static: false,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [{ id: 'comp00000001', type: 'meshRenderer', enabled: true, values: {} }],
          prefab: { asset: 'prefab000001', object: 'proot0000001', overrides: [] },
        },
        lamp00000001: {
          name: 'Lampe',
          parent: 'root00000001',
          order: 0,
          active: true,
          tag: 'Untagged',
          layer: 'Default',
          static: false,
          transform: { position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [{ id: 'comp00000002', type: 'light', enabled: true, values: {} }],
          prefab: { asset: 'prefab000001', object: 'plamp0000001' },
        },
      },
    };
    const whole = duplicateObjects(base, ['root00000001']);
    const copy = whole.scene.objects[whole.ids[0] ?? ''];
    expect(copy?.prefab?.overrides).toEqual([]);
    expect(copy?.components[0]?.id).toBe('comp00000001');
    const part = duplicateObjects(base, ['lamp00000001']);
    const lamp = part.scene.objects[part.ids[0] ?? ''];
    expect(lamp?.prefab).toBeUndefined();
    expect(lamp?.components[0]?.id).not.toBe('comp00000002');
  });
});

describe('History', () => {
  it('undoes, redoes and merges quick edits with the same key', () => {
    let time = 0;
    const history = new History<number>(() => time);
    let value = 0;
    const change = (next: number, key?: string): void => {
      history.record(value, 'edit', key);
      value = next;
    };
    change(1, 'drag');
    time = 100;
    change(2, 'drag');
    time = 200;
    change(3, 'drag');
    time = 5000;
    change(4, 'drag');
    change(5);
    const undo = (): void => {
      const step = history.undo(value);
      if (step) value = step.state;
    };
    undo();
    expect(value).toBe(4);
    undo();
    expect(value).toBe(3);
    undo();
    expect(value).toBe(0);
    expect(history.undo(value)).toBeNull();
    const redo = history.redo(value);
    expect(redo?.state).toBe(3);
  });

  it('merges a stroke however slow until it is sealed', () => {
    let time = 0;
    const history = new History<number>(() => time);
    history.record(0, 'brush', 'stroke-1', true);
    time = 5000;
    history.record(1, 'brush', 'stroke-1', true);
    history.seal();
    history.record(2, 'brush', 'stroke-1', true);
    expect(history.undo(3)?.state).toBe(2);
    expect(history.undo(2)?.state).toBe(0);
    expect(history.undo(0)).toBeNull();
  });
});
