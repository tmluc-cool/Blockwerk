import type { BreakpointCondition, DebugHit, GameLogEntry } from '@blockwerk/runtime';
import { expect } from 'vitest';
import { b, call, define, workspace } from './dsl';
import { A, B, ground, hero, launch, run, when } from './phase3Cases';
import type { RuntimeCase } from './phase3Cases';

/** Runtime cases of the phase 8 blocks (debugging). */

export const phase8Cases: RuntimeCase[] = [
  {
    name: 'write to log sends level, text and the place of the block to the console',
    covers: ['control.log'],
    run: () => {
      const entries: GameLogEntry[] = [];
      const game = launch({
        log: (entry) => entries.push(entry),
        objects: { ground000001: ground, hero00000001: hero([], 'logger') },
        scripts: {
          logger: workspace(
            when(
              b('events.whenGameStarts'),
              b('control.log', { level: 'info' }, { message: 'Hallo Welt' }),
              b('control.log', { level: 'warning' }, { message: 3 }),
              b('control.log', { level: 'error' }, { message: 'Kaputt' }),
            ),
          ),
        },
      });
      run(game, 0.2);
      const logs = entries.filter((entry) => entry.kind === 'userLog');
      expect(logs.map((entry) => [entry.level, entry.kind === 'userLog' && entry.message])).toEqual(
        [
          ['info', 'Hallo Welt'],
          ['warning', '3'],
          ['error', 'Kaputt'],
        ],
      );
      for (const entry of logs) {
        if (entry.kind !== 'userLog') continue;
        expect(entry.objectName).toBe('Hero');
        expect(entry.assetId).toBe('logger');
        expect(entry.blockId).toMatch(/^t-\d+$/);
      }
      // Each message points at its own block.
      const ids = logs.map((entry) => (entry.kind === 'userLog' ? entry.blockId : null));
      expect(new Set(ids).size).toBe(3);
    },
  },
  {
    name: 'a loop without screen refresh that never ends is stopped and reported, the game goes on',
    covers: ['control.forever'],
    run: () => {
      const entries: GameLogEntry[] = [];
      const game = launch({
        log: (entry) => entries.push(entry),
        objects: { ground000001: ground, hero00000001: hero([], 'runaway') },
        scripts: {
          runaway: workspace(when(b('events.whenGameStarts'), call('Command', 'def-endless', [])), [
            define('Command', 'endlos', 'def-endless', { warp: true }),
            b(
              'control.forever',
              {},
              { body: [b('variables.change', { variable: { id: A } }, { by: 1 })] },
            ),
          ]),
        },
      });
      run(game, 8);
      const problems = entries.filter((entry) => entry.kind === 'problem');
      expect(problems).toHaveLength(1);
      const problem = problems[0];
      if (problem?.kind !== 'problem') throw new Error('no problem');
      expect(problem.problem).toMatchObject({
        severity: 'error',
        code: 'loopWithoutWaiting',
        link: { objectId: 'hero00000001', assetId: 'runaway' },
      });
      // The script is gone, the game still ticks.
      const before = game.tick;
      run(game, 0.5);
      expect(game.tick).toBeGreaterThan(before);
      expect(game.vars[A]).toBeGreaterThan(1_000_000);
    },
  },
  {
    name: 'a breakpoint stops the script before its block, step goes one block on, continue finishes',
    covers: ['variables.set'],
    run: () => {
      const hits: DebugHit[] = [];
      const breakpoints = new Map<string, BreakpointCondition | null>();
      const first = b('variables.set', { variable: { id: A } }, { value: 1 });
      const second = b('variables.set', { variable: { id: A } }, { value: 2 });
      const third = b('variables.set', { variable: { id: B } }, { value: 3 });
      const game = launch({
        debug: { breakpoints: () => breakpoints, onHit: (hit) => hits.push(hit) },
        objects: { ground000001: ground, hero00000001: hero([], 'steps') },
        scripts: { steps: workspace(when(b('events.whenGameStarts'), first, second, third)) },
      });
      breakpoints.set(`steps/${second.id}`, null);
      // The editor pauses the game when a script stops, so the test stops ticking, too.
      game.stepTick();
      // Stopped before the second block: the first one ran, the second did not.
      expect(hits.map((hit) => hit.blockId)).toEqual([second.id]);
      expect(hits[0]).toMatchObject({ objectId: 'hero00000001', assetId: 'steps' });
      expect(game.vars[A]).toBe(1);
      expect(game.scriptPositions().map((position) => position.blockId)).toEqual([second.id]);
      // Step: the second block runs, the script stops before the third.
      game.debugStep();
      game.stepTick();
      expect(hits.map((hit) => hit.blockId)).toEqual([second.id, third.id]);
      expect(game.vars[A]).toBe(2);
      expect(game.vars[B]).toBe('');
      // Continue: nothing stops any more, the script runs to its end.
      breakpoints.clear();
      run(game, 0.2);
      expect(hits).toHaveLength(2);
      expect(game.vars[B]).toBe(3);
    },
  },
];
