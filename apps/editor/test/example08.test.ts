import { join } from 'node:path';
import { compileProject } from '@blockwerk/compiler';
import { assetDisplayName, loadProject } from '@blockwerk/project';
import type { Project } from '@blockwerk/project';
import { NodeFileSystem } from '@blockwerk/project/node';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  MemorySaveStorage,
  ModelCache,
} from '@blockwerk/runtime';
import type { BreakpointCondition, DebugHit, GameLogEntry, ScriptAsset } from '@blockwerk/runtime';
import { Group } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkScene } from '../src/document/sceneCheck';
import { translate } from '../src/i18n';
import type { TranslationKey } from '../src/i18n';

/** Acceptance of phase 8 without the UI: `examples/08-kaputt` (SPEC 10, phase 8). */
const folder = join(import.meta.dirname, '..', '..', '..', 'examples', '08-kaputt');

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const VAR_SCORE = 'kaputtvar001';

interface Launched {
  readonly game: Game;
  readonly log: GameLogEntry[];
}

function launch(
  project: Project,
  options: {
    debug?: {
      breakpoints: () => ReadonlyMap<string, BreakpointCondition | null>;
      onHit: (hit: DebugHit) => void;
    };
  } = {},
): Launched {
  const compiled = compileProject(
    project.assetsOfType('blockScript').map((entry) => ({
      assetId: entry.id,
      assetName: assetDisplayName(entry.path),
      workspace: entry.data.workspace,
      variables: entry.data.variables,
    })),
    undefined,
    options.debug ? { debug: true } : {},
  );
  const assets = new Map<string, ScriptAsset>();
  for (const entry of project.assetsOfType('blockScript')) {
    const result = compiled.get(entry.id);
    if (!result) throw new Error(`no result for ${entry.id}`);
    assets.set(entry.id, {
      assetId: entry.id,
      module: loadScriptModule(result.code),
      variables: entry.data.variables,
      lineToBlock: result.lineToBlock,
      sourceUrl: `test://${entry.id}`,
    });
  }
  const scene = project.assetsOfType('scene')[0];
  if (!scene) throw new Error('no scene');
  // The barrel is a plain prop: a model without a single animation.
  const models = new ModelCache(() => null);
  models.provide('library:kaykit-dungeon/barrel-large', {
    scene: new Group(),
    animations: [],
    skinned: false,
  });
  const log: GameLogEntry[] = [];
  const game = new Game(scene.data, {
    scripts: (id) => assets.get(id) ?? null,
    saves: new MemorySaveStorage(),
    sceneId: scene.id,
    models,
    log: (entry) => log.push(entry),
    random: () => 0.5,
    ...(options.debug ? { debug: options.debug } : {}),
  });
  return { game, log };
}

const run = (game: Game, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
};

const problemsOf = (log: readonly GameLogEntry[]) =>
  log.flatMap((entry) => (entry.kind === 'problem' ? [entry.problem] : []));

describe('examples/08-kaputt', { timeout: 120_000 }, () => {
  it('lists the deliberate mistakes before the start, each with a place to jump to', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    expect(project.problems).toEqual([]);
    const { game } = launch(project);
    const problems = checkScene(game.world, {
      project,
      displayName: assetDisplayName,
      locale: 'de',
    });
    const byCode = (code: string) => problems.filter((problem) => problem.code === code);
    // Empty inspector field.
    expect(byCode('emptyReference')).toHaveLength(1);
    expect(byCode('emptyReference')[0]?.params['object']).toBe('Schalter ohne Skript');
    // A message without a receiver.
    expect(byCode('messageWithoutReceiver').map((problem) => problem.params['message'])).toEqual([
      'tor-auf',
    ]);
    // An NPC outside the navigation mesh.
    expect(byCode('npcOutsideNavigation')[0]?.params['object']).toBe('Wache 2');
    // Every problem points somewhere.
    for (const problem of problems) {
      expect(
        problem.link.objectId ?? problem.link.assetId,
        `${problem.code} has a link`,
      ).toBeDefined();
    }
  });

  it('writes every problem in plain German and English', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game, log } = launch(project);
    run(game, 8);
    const problems = [
      ...checkScene(game.world, { project, displayName: assetDisplayName, locale: 'de' }),
      ...problemsOf(log),
    ];
    // The check and the running game together know every kind of problem the example has.
    expect(new Set(problems.map((problem) => problem.code))).toEqual(
      new Set([
        'emptyReference',
        'messageWithoutReceiver',
        'npcOutsideNavigation',
        'emptySlot',
        'modelWithoutCollider',
        'noPathToTarget',
        'figureWithoutAnimation',
      ]),
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      for (const locale of ['de', 'en'] as const) {
        const text = translate(locale, `check.${problem.code}` as TranslationKey, {
          ...problem.params,
          script: 'Skript',
          component: 'Komponente',
          field: 'Feld',
        });
        expect(text).not.toMatch(/^check\./);
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('reports what goes wrong while playing: no way to the player, no walk animation', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game, log } = launch(project);
    run(game, 3);
    const found = problemsOf(log);
    const noPath = found.find((problem) => problem.code === 'noPathToTarget');
    expect(noPath?.params).toMatchObject({ object: 'Wache 2', target: 'Held ohne Animation' });
    expect(noPath?.link.objectId).toBeDefined();
    const noAnimation = found.find((problem) => problem.code === 'figureWithoutAnimation');
    expect(noAnimation?.params['object']).toBe('Held ohne Animation');
  });

  it('stops an endless loop without frame handover, tells where, and never freezes', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const { game, log } = launch(project);
    run(game, 0.2);
    const before = performance.now();
    game.input.keyEvent('l', true, 'KeyL');
    run(game, 8);
    game.input.keyEvent('l', false, 'KeyL');
    const loop = problemsOf(log).find((problem) => problem.code === 'loopWithoutWaiting');
    expect(loop).toMatchObject({
      severity: 'error',
      link: { assetId: 'kaputtscr001' },
    });
    expect(loop?.link.objectId).toBeDefined();
    // The whole run, including the runaway loop, took seconds, not minutes.
    expect(performance.now() - before).toBeLessThan(20_000);
    const ticks = game.tick;
    run(game, 0.5);
    expect(game.tick).toBeGreaterThan(ticks);
  });

  it('stops at a breakpoint, lets a value be changed, steps and continues', async () => {
    const project = await loadProject(new NodeFileSystem(folder));
    const counter = project
      .assetsOfType('blockScript')
      .find((entry) => entry.id === 'kaputtscr003');
    if (!counter) throw new Error('no counter script');
    const changes: string[] = [];
    const top = (counter.data.workspace as { blocks: { blocks: { next?: unknown }[] } }).blocks
      .blocks[0];
    let block = (top?.next as { block?: { id: string; next?: unknown } } | undefined)?.block;
    while (block) {
      changes.push(block.id);
      block = (block.next as { block?: { id: string; next?: unknown } } | undefined)?.block;
    }
    expect(changes).toHaveLength(3);
    const breakpoints = new Map<string, BreakpointCondition | null>([
      [`kaputtscr003/${changes[1]}`, (read) => Number(read('punkte')) >= 1],
    ]);
    const hits: DebugHit[] = [];
    const { game } = launch(project, {
      debug: { breakpoints: () => breakpoints, onHit: (hit) => hits.push(hit) },
    });
    run(game, 0.2);
    game.input.keyEvent('z', true, 'KeyZ');
    game.stepTick();
    // Stopped before the second block; the first one ran (the condition saw punkte = 1).
    expect(hits.map((hit) => hit.blockId)).toEqual([changes[1]]);
    expect(game.vars[VAR_SCORE]).toBe(1);
    // Change the value while stopped, then step one block and continue.
    game.vars[VAR_SCORE] = 500;
    game.debugStep();
    game.stepTick();
    expect(hits.map((hit) => hit.blockId)).toEqual([changes[1], changes[2]]);
    expect(game.vars[VAR_SCORE]).toBe(510);
    breakpoints.clear();
    game.debugResume();
    game.input.keyEvent('z', false, 'KeyZ');
    run(game, 0.2);
    expect(game.vars[VAR_SCORE]).toBe(610);
  });
});
