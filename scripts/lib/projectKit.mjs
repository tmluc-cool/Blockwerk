// Small helpers for the generators of template projects (`scripts/make-templates.mjs`): stable
// IDs, an object builder for one scene, and the writer. Everything is deterministic.
import { Project } from '../../packages/project/src/index.ts';
import { NodeFileSystem } from '../../packages/project/src/node.ts';

/** The six area roots every scene has (SPEC 5.3). */
const AREAS = ['environment', 'player1', 'player2', 'npcs', 'items', 'ui'];

export const meta = (id, type) => ({
  formatVersion: 1,
  id,
  type,
  importSettings: {},
  license: null,
});

/** Starts a kit: `prefix` is two letters that make the IDs of one project unique. */
export function createKit(prefix) {
  let objectCounter = 0;
  let componentCounter = 0;
  const padded = (letter, counter) =>
    `${prefix}${letter}${String(counter).padStart(12 - prefix.length - 1, '0')}`;
  const oid = () => padded('o', ++objectCounter);
  const cid = () => padded('c', ++componentCounter);
  const comp = (type, values = {}) => ({ id: cid(), type, enabled: true, values });

  /** One scene under construction. */
  function scene(environment) {
    const objects = {};
    const area = {};
    let order = 0;
    for (const kind of AREAS) {
      const id = oid();
      objects[id] = {
        name: null,
        parent: null,
        order: order++,
        active: true,
        tag: 'Untagged',
        layer: 'Default',
        static: false,
        area: kind,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        components: [],
      };
      area[kind] = id;
    }
    const add = ({
      name,
      parent = area.environment,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      components = [],
      tag = 'Untagged',
      isStatic = false,
    }) => {
      const id = oid();
      objects[id] = {
        name,
        parent,
        order: order++,
        active: true,
        tag,
        layer: 'Default',
        static: isStatic,
        transform: { position, rotation, scale },
        components,
      };
      return id;
    };
    return {
      objects,
      area,
      add,
      nextOrder: () => order++,
      data: { formatVersion: 1, environment, objects },
    };
  }

  /** A box (cube) with a collider, for floors, walls and platforms. */
  const box = (s, name, position, scale, color, extra = {}) =>
    s.add({
      name,
      position,
      scale,
      isStatic: true,
      components: [
        comp('meshRenderer', { shape: 'cube', color, smoothness: 0.1 }),
        comp('boxCollider'),
      ],
      ...extra,
    });

  /** The sun every template scene has. */
  const sun = (s) =>
    s.add({
      name: 'Sonne',
      position: [0, 20, 0],
      rotation: [50, -30, 0],
      components: [comp('light', { lightType: 'directional' })],
    });

  return { oid, cid, comp, scene, box, sun };
}

/**
 * Writes a project to `folder`: scenes, scripts and prefabs are handed in ready-made. `prepare`
 * can add other assets (dialogs, menus, terrains) to the project before it is saved.
 */
export async function writeProject({
  folder,
  name,
  startScene,
  scenes,
  scripts = [],
  prefabs = [],
  tags = [],
  graphicsLevel = 'medium',
  prepare = () => {},
}) {
  const project = new Project({ formatVersion: 1, name, startScene, graphicsLevel });
  project.tagsAndLayers = { formatVersion: 1, layers: [], tags };
  for (const script of scripts) {
    project.adoptAsset(
      `Assets/Block-Skripte/${script.name}.blocks.json`,
      meta(script.id, 'blockScript'),
      {
        data: { formatVersion: 1, variables: script.variables ?? [], workspace: script.workspace },
      },
    );
  }
  for (const prefab of prefabs) {
    project.adoptAsset(`Assets/Prefabs/${prefab.name}.prefab.json`, meta(prefab.id, 'prefab'), {
      data: prefab.data,
    });
  }
  for (const scene of scenes) {
    project.adoptAsset(`Assets/Szenen/${scene.name}.scene.json`, meta(scene.id, 'scene'), {
      data: scene.data,
    });
  }
  prepare(project);
  await project.save(new NodeFileSystem(folder));
  return project;
}
