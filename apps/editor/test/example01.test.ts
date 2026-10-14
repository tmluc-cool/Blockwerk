import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { compileBlockScript } from '@blockwerk/compiler';
import { assetDisplayName, loadProject, MemoryFileSystem } from '@blockwerk/project';
import type { Project } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import { Game, loadScriptModule } from '@blockwerk/runtime';
import type { ScriptAsset } from '@blockwerk/runtime';
import { describe, expect, it } from 'vitest';

/** Acceptance of phase 1 without the UI: `examples/01-hindernis` (SPEC 10, phase 1). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '01-hindernis');

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

function scripts(project: Project): Map<string, ScriptAsset> {
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compileBlockScript(entry.data.workspace, {
      assetName: assetDisplayName(entry.path),
      variables: entry.data.variables,
    });
    expect(result.diagnostics, entry.path).toEqual([]);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  return assets;
}

function startGame(project: Project): Game {
  const sceneId = project.settings.startScene;
  const scene = sceneId ? project.assetOfType(sceneId, 'scene') : undefined;
  if (!scene) throw new Error('no start scene');
  const assets = scripts(project);
  const log: unknown[] = [];
  const game = new Game(scene.data, {
    scripts: (id) => assets.get(id) ?? null,
    log: (entry) => log.push(entry),
  });
  expect(log).toEqual([]);
  return game;
}

describe('examples/01-hindernis', () => {
  it('loads without problems and an unchanged save writes nothing', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const files = filesOf(folder);
    const changed = [...project.files()]
      .filter(([path, text]) => files[path] !== text)
      .map(([path]) => path);
    expect(changed).toEqual([]);
    expect(project.dirty).toBe(false);
    expect(project.assets.map((entry) => entry.path)).toEqual([
      'Assets/Block-Skripte/Einsammeln.blocks.json',
      'Assets/Block-Skripte/Steuerung.blocks.json',
      'Assets/Szenen/Parcours.scene.json',
    ]);
  });

  it('a cube steered with WASD collects three spheres and the points count up', async () => {
    const game = startGame(await loadProject(new NodeFileSystem(folder)));
    const player = game.world.getObject('hindplayer01');
    const second = game.world.getObject('hindplayer02');
    if (!player || !second) throw new Error('missing cubes');
    game.stepTick();
    expect(game.monitors().map((monitor) => [monitor.name, monitor.value])).toEqual([
      ['Punkte', 0],
    ]);
    game.input.keyEvent('w', true);
    // 3.5 seconds at 60 Hz: Tempo 4 m/s carries the player 14 m along +Z past all spheres.
    for (let tick = 0; tick < 210; tick++) game.stepTick();
    game.input.keyEvent('w', false);
    game.stepTick();
    expect(player.position.z).toBeCloseTo(14, 1);
    expect(game.vars['varpunkte001']).toBe(3);
    expect(game.monitors().map((monitor) => [monitor.name, monitor.value])).toEqual([
      ['Punkte', 3],
    ]);
    for (const id of ['hindcoin0001', 'hindcoin0002', 'hindcoin0003']) {
      expect(game.world.getObject(id)).toBeUndefined();
    }
    // The same script on the second cube runs independently with its own speed (Tempo 2).
    expect(second.position.z).toBeCloseTo(7, 1);
    expect(second.position.x).toBe(-4);
    // A/D move sideways.
    game.input.keyEvent('d', true);
    for (let tick = 0; tick < 60; tick++) game.stepTick();
    expect(player.position.x).toBeCloseTo(-4, 1);
    game.dispose();
  });

  it('renaming an asset keeps every reference', async () => {
    const fs = new MemoryFileSystem(filesOf(folder));
    const project = await loadProject(fs);
    const script = project.assetAt('Assets/Block-Skripte/Steuerung.blocks.json');
    if (!script) throw new Error('missing script');
    project.moveAsset(script.id, 'Assets/Spieler/Fahren.blocks.json');
    await project.save(fs);
    const reloaded = await loadProject(fs);
    expect(reloaded.problems).toEqual([]);
    expect(reloaded.asset(script.id)?.path).toBe('Assets/Spieler/Fahren.blocks.json');
    const game = startGame(reloaded);
    game.input.keyEvent('w', true);
    for (let tick = 0; tick < 60; tick++) game.stepTick();
    expect(game.world.getObject('hindplayer01')?.position.z).toBeGreaterThan(3.5);
    game.dispose();
  });
});
