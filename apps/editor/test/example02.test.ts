import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import {
  assetDisplayName,
  createId,
  instanceMembers,
  loadProject,
  resolvePrefab,
  syncPrefabInstances,
} from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import { Game, loadScriptModule } from '@blockwerk/runtime';
import type { ScriptAsset } from '@blockwerk/runtime';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

/** Acceptance of phase 2 without the UI: `examples/02-dorf` (SPEC 10, phase 2). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '02-dorf');
const LANTERN = 'dorflaterne1';
const RED_LANTERN = 'dorfrotelat1';

function filesOf(directory: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else result[relative(directory, path).split(sep).join('/')] = readFileSync(path, 'utf8');
    }
  };
  walk(directory);
  return result;
}

function sceneOf(project: Project): SceneData {
  const id = project.settings.startScene;
  const scene = id ? project.assetOfType(id, 'scene') : undefined;
  if (!scene) throw new Error('no start scene');
  return scene.data;
}

function prefabs(project: Project) {
  return (id: string) => project.assetOfType(id, 'prefab')?.data;
}

/** Library models used by objects of the scene. */
function libraryModels(scene: SceneData): string[] {
  return Object.values(scene.objects).flatMap((object) =>
    object.components
      .map((component) => component.values['model'])
      .filter((model): model is string => typeof model === 'string'),
  );
}

describe('examples/02-dorf', () => {
  it('loads without problems, prefab instances are in sync and a save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
    // Syncing with the prefabs (as the editor does when opening) changes nothing.
    const scene = sceneOf(project);
    const synced = syncPrefabInstances(scene.objects, prefabs(project), createId);
    for (const [id, object] of Object.entries(scene.objects)) expect(synced[id]).toBe(object);
  });

  it('is a village of houses, a well, fences and 200 trees, all from the library', async () => {
    const scene = sceneOf(await loadProject(new NodeFileSystem(folder)));
    const models = libraryModels(scene);
    expect(models.every((model) => model.startsWith('library:'))).toBe(true);
    const count = (pattern: RegExp) => models.filter((model) => pattern.test(model)).length;
    expect(count(/tree-single/)).toBe(200);
    expect(count(/building-well/)).toBe(1);
    expect(count(/building-(home|tavern|church|market|blacksmith)/)).toBeGreaterThanOrEqual(8);
    expect(count(/fence/)).toBeGreaterThanOrEqual(40);
    // Every library model of the scene exists in the library index (when it was built).
    let index: { entries: { id: string }[] } | null = null;
    try {
      index = JSON.parse(
        readFileSync(join(import.meta.dirname, '..', '..', '..', 'library', 'index.json'), 'utf8'),
      ) as { entries: { id: string }[] };
    } catch {
      // `pnpm assets:fetch` was not run.
    }
    if (index) {
      const ids = new Set(index.entries.map((entry) => `library:${entry.id}`));
      expect(models.filter((model) => !ids.has(model))).toEqual([]);
    }
  });

  it('"Rote Laterne" is a variant of "Laterne"; one lantern overrides its brightness', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const scene = sceneOf(project);
    const red = resolvePrefab(RED_LANTERN, prefabs(project));
    const lightOf = (objects: SceneData['objects'] | undefined) =>
      Object.values(objects ?? {})
        .flatMap((object) => object.components)
        .find((component) => component.type === 'light')?.values;
    expect(lightOf(red?.objects)).toMatchObject({ color: '#ff4a3a', lightType: 'point' });
    const roots = Object.entries(scene.objects).filter(([, object]) => object.prefab?.overrides);
    expect(roots.filter(([, object]) => object.prefab?.asset === LANTERN)).toHaveLength(4);
    expect(roots.filter(([, object]) => object.prefab?.asset === RED_LANTERN)).toHaveLength(2);
    const overridden = roots.filter(([, object]) => (object.prefab?.overrides ?? []).length > 0);
    expect(overridden).toHaveLength(1);
    const [rootId] = overridden[0] ?? [];
    const members = instanceMembers(scene.objects, rootId ?? '');
    const lights = [...members.values()].map((id) => ({ [id]: scene.objects[id] }));
    expect(lightOf(Object.assign({}, ...lights) as SceneData['objects'])).toMatchObject({
      intensity: 10,
    });
  });

  it('the camera ride circles the village and looks at it', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const assets = new Map<string, ScriptAsset>();
    for (const entry of project.assetsOfType('blockScript')) {
      const result = compileBlockScript(entry.data.workspace, {
        assetName: assetDisplayName(entry.path),
        variables: entry.data.variables,
      });
      expect(result.diagnostics).toEqual([]);
      assets.set(entry.id, {
        assetId: entry.id,
        module: loadScriptModule(result.code),
        variables: entry.data.variables,
        lineToBlock: result.lineToBlock,
        sourceUrl: `test://${entry.id}`,
      });
    }
    const log: unknown[] = [];
    const game = new Game(sceneOf(project), {
      scripts: (id) => assets.get(id) ?? null,
      log: (entry) => log.push(entry),
    });
    expect(log).toEqual([]);
    const camera = game.world.getObject('dorfkamera01');
    if (!camera) throw new Error('no camera');
    const distances: number[] = [];
    // A full circle takes 3600 ticks (0.1° per frame); check a quarter of it.
    for (let tick = 0; tick < 900; tick++) {
      game.stepTick();
      if (tick % 100 === 0) {
        const position = camera.worldPosition();
        distances.push(Math.hypot(position.x, position.z));
        const forward = new Vector3(0, 0, 1).transformDirection(camera.object3d.matrixWorld);
        const toCenter = new Vector3(-position.x, 0, -position.z).normalize();
        expect(forward.setY(0).normalize().dot(toCenter)).toBeGreaterThan(0.9);
      }
    }
    for (const distance of distances) {
      expect(distance).toBeGreaterThan(30);
      expect(distance).toBeLessThan(40);
    }
    game.dispose();
  });
});
