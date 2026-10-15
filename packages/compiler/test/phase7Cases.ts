import { expect } from 'vitest';
import { b, call, define, get, param, set, workspace } from './dsl';
import { A, B, DICT, ground, hero, launch, LIST, run, when } from './phase3Cases';
import type { RuntimeCase } from './phase3Cases';

/** Runtime cases of the phase 7 blocks (lists, dictionaries, local variables). */

const start = b('events.whenGameStarts');

export const phase7Cases: RuntimeCase[] = [
  {
    name: 'lists: add, insert, replace, delete, read, find, join and clear',
    covers: [
      'data.newList',
      'data.listAdd',
      'data.listInsert',
      'data.listSet',
      'data.listRemoveAt',
      'data.listGet',
      'data.listLength',
      'data.listContains',
      'data.listIndexOf',
      'data.listJoin',
      'data.listClear',
      'data.split',
    ],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'lists') },
        scripts: {
          lists: workspace(
            when(
              start,
              set(LIST, b('data.newList')),
              b('data.listAdd', {}, { item: 'Apfel', list: get(LIST) }),
              b('data.listAdd', {}, { item: 3, list: get(LIST) }),
              b('data.listInsert', {}, { item: 'Birne', index: 1, list: get(LIST) }),
              b('data.listSet', {}, { index: 2, list: get(LIST), item: 'Kirsche' }),
              set(B, b('data.listJoin', {}, { list: get(LIST), separator: '+' })),
              b('data.listRemoveAt', {}, { index: 3, list: get(LIST) }),
              set(
                A,
                b(
                  'operators.add',
                  {},
                  {
                    a: b('data.listLength', {}, { list: get(LIST) }),
                    b: b('data.listIndexOf', {}, { item: 'KIRSCHE', list: get(LIST) }),
                  },
                ),
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('data.listContains', {}, { list: get(LIST), item: 'Apfel' }),
                  then: [set(B, b('data.listGet', {}, { index: 1, list: get(LIST) }))],
                },
              ),
            ),
          ),
        },
      });
      run(game, 0.1);
      // Birne, Kirsche, 3 → after the replace: Birne, Kirsche, 3; joined text, then "3" is removed.
      expect(game.vars[LIST]).toEqual(['Birne', 'Kirsche']);
      // length 2 + place of "KIRSCHE" 2 (case does not matter)
      expect(game.vars[A]).toBe(4);
      // "Apfel" was replaced, so the condition was false and B keeps the joined text.
      expect(game.vars[B]).toBe('Birne+Kirsche+3');
      game.dispose();
    },
  },
  {
    name: 'lists: reading outside of the list gives an empty value, clear empties it, split cuts text',
    covers: ['data.listGet', 'data.listClear', 'data.split', 'data.listLength'],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'edge') },
        scripts: {
          edge: workspace(
            when(
              start,
              set(LIST, b('data.split', {}, { text: 'a,b,c', separator: ',' })),
              set(B, b('data.listGet', {}, { index: 9, list: get(LIST) })),
              set(A, b('data.listLength', {}, { list: get(LIST) })),
              b('data.listClear', {}, { list: get(LIST) }),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(game.vars[B]).toBe('');
      expect(game.vars[A]).toBe(3);
      expect(game.vars[LIST]).toEqual([]);
      game.dispose();
    },
  },
  {
    name: 'dictionaries: set, read, has, remove, keys and size',
    covers: [
      'data.newDictionary',
      'data.dictSet',
      'data.dictGet',
      'data.dictHas',
      'data.dictRemove',
      'data.dictKeys',
      'data.dictSize',
      'data.listJoin',
    ],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'dict') },
        scripts: {
          dict: workspace(
            when(
              start,
              set(DICT, b('data.newDictionary')),
              b('data.dictSet', {}, { key: 'Leben', dictionary: get(DICT), value: 3 }),
              b('data.dictSet', {}, { key: 'Name', dictionary: get(DICT), value: 'Ritter' }),
              b('data.dictSet', {}, { key: 'Alt', dictionary: get(DICT), value: 1 }),
              b('data.dictRemove', {}, { key: 'Alt', dictionary: get(DICT) }),
              set(
                A,
                b(
                  'operators.add',
                  {},
                  {
                    a: b('data.dictGet', {}, { key: 'Leben', dictionary: get(DICT) }),
                    b: b('data.dictSize', {}, { dictionary: get(DICT) }),
                  },
                ),
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('data.dictHas', {}, { dictionary: get(DICT), key: 'Alt' }),
                  then: [set(B, 'Alt noch da')],
                },
              ),
              b(
                'control.if',
                {},
                {
                  condition: b('data.dictHas', {}, { dictionary: get(DICT), key: 'Name' }),
                  then: [
                    set(
                      B,
                      b(
                        'data.listJoin',
                        {},
                        {
                          list: b('data.dictKeys', {}, { dictionary: get(DICT) }),
                          separator: '/',
                        },
                      ),
                    ),
                  ],
                },
              ),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(game.vars[DICT]).toEqual({ Leben: 3, Name: 'Ritter' });
      expect(game.vars[A]).toBe(5);
      expect(game.vars[B]).toBe('Leben/Name');
      game.dispose();
    },
  },
  {
    name: 'for each item goes through a list and local variables add things up',
    covers: [
      'data.forEachItem',
      'locals.declare',
      'locals.set',
      'locals.change',
      'locals.get',
      'data.split',
      'data.dictKeys',
    ],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'loop') },
        scripts: {
          loop: workspace(
            when(
              start,
              set(LIST, b('data.split', {}, { text: '4,5,6', separator: ',' })),
              b('locals.declare', { name: 'summe' }, { value: 10 }),
              b(
                'data.forEachItem',
                { name: 'zahl' },
                {
                  list: get(LIST),
                  body: [
                    b(
                      'locals.change',
                      { name: 'summe' },
                      { by: b('locals.get', { name: 'zahl' }) },
                    ),
                  ],
                },
              ),
              b(
                'locals.set',
                { name: 'summe' },
                {
                  value: b(
                    'operators.multiply',
                    {},
                    {
                      a: b('locals.get', { name: 'summe' }),
                      b: 2,
                    },
                  ),
                },
              ),
              set(A, b('locals.get', { name: 'summe' })),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(game.vars[A]).toBe(50);
      game.dispose();
    },
  },
  {
    name: 'custom blocks: command, value and condition with typed inputs and "return"',
    covers: [
      'custom.defineCommand',
      'custom.defineValue',
      'custom.defineCondition',
      'custom.callCommand',
      'custom.callValue',
      'custom.callCondition',
      'custom.return',
      'custom.param',
    ],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'custom') },
        scripts: {
          custom: workspace(
            when(
              start,
              call('Command', 'def-count', [3]),
              set(B, call('Value', 'def-label', ['Ritter', 2])),
              b(
                'control.if',
                {},
                {
                  condition: call('Condition', 'def-big', [get(A)]),
                  then: [set(B, 'groß')],
                },
              ),
            ),
            [
              define('Command', 'Zähle', 'def-count', { params: [{ name: 'n', type: 'number' }] }),
              b(
                'control.repeat',
                {},
                {
                  times: param('n'),
                  body: [b('variables.change', { variable: { id: A } }, { by: 1 })],
                },
              ),
              b('custom.return'),
              // never reached
              b('variables.change', { variable: { id: A } }, { by: 100 }),
            ],
            [
              define('Value', 'Beschriftung', 'def-label', {
                params: [
                  { name: 'name', type: 'string' },
                  { name: 'mal', type: 'number' },
                ],
                returns: 'string',
              }),
              b(
                'custom.return',
                {},
                {
                  value: b(
                    'operators.join',
                    {},
                    {
                      a: param('name'),
                      b: b('operators.multiply', {}, { a: param('mal'), b: 10 }),
                    },
                  ),
                },
              ),
            ],
            [
              define('Condition', 'Gross', 'def-big', { params: [{ name: 'x', type: 'number' }] }),
              b(
                'control.if',
                {},
                {
                  condition: b('operators.gt', {}, { a: param('x'), b: 2 }),
                  then: [b('custom.return', {}, { value: b('operators.gt', {}, { a: 1, b: 0 }) })],
                },
              ),
              b('custom.return', {}, { value: b('operators.gt', {}, { a: 0, b: 1 }) }),
            ],
          ),
        },
      });
      run(game, 0.1);
      expect(game.vars[A]).toBe(3);
      expect(game.vars[B]).toBe('groß');
      game.dispose();
    },
  },
  {
    name: 'project-wide custom blocks work in other scripts, including blocks that call blocks',
    covers: [
      'custom.defineCommand',
      'custom.callCommand',
      'custom.defineValue',
      'custom.callValue',
    ],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          hero00000001: hero([], 'user'),
        },
        scripts: {
          // The library script holds the definitions; "dreimal" calls "plus" in the same script.
          library: workspace(
            [
              define('Value', 'plus', 'def-plus', {
                params: [
                  { name: 'a', type: 'number' },
                  { name: 'b', type: 'number' },
                ],
                returns: 'number',
                scope: 'project',
              }),
              b(
                'custom.return',
                {},
                { value: b('operators.add', {}, { a: param('a'), b: param('b') }) },
              ),
            ],
            [
              define('Command', 'dreimal', 'def-three', {
                params: [{ name: 'v', type: 'number' }],
                scope: 'project',
              }),
              b(
                'variables.set',
                { variable: { id: A } },
                { value: call('Value', 'def-plus', [param('v'), 3]) },
              ),
            ],
          ),
          user: workspace(
            when(start, call('Command', 'def-three', [4], 'library')),
            when(
              b('events.whenKey', { key: 'X', mode: 'pressed' }),
              set(A, call('Value', 'def-plus', [20, 1], 'library')),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(game.vars[A]).toBe(7);
      game.input.keyEvent('x', true, 'KeyX');
      run(game, 0.1);
      game.input.keyEvent('x', false, 'KeyX');
      expect(game.vars[A]).toBe(21);
      game.dispose();
    },
  },
  {
    name: 'a loop without screen refresh runs its passes in one tick and a runaway loop is cut up',
    covers: ['custom.defineCommand', 'custom.callCommand'],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'warp') },
        scripts: {
          warp: workspace(
            when(
              start,
              call('Command', 'def-warp', [50]),
              set(B, 'fertig'),
              call('Command', 'def-slow', [50]),
            ),
            [
              define('Command', 'schnell', 'def-warp', {
                params: [{ name: 'n', type: 'number' }],
                warp: true,
              }),
              b(
                'control.repeat',
                {},
                {
                  times: param('n'),
                  body: [b('variables.change', { variable: { id: A } }, { by: 1 })],
                },
              ),
            ],
            [
              define('Command', 'langsam', 'def-slow', { params: [{ name: 'n', type: 'number' }] }),
              b(
                'control.repeat',
                {},
                {
                  times: param('n'),
                  body: [b('variables.change', { variable: { id: A } }, { by: 1 })],
                },
              ),
            ],
          ),
        },
      });
      run(game, 1 / 60);
      // The first call finished inside the first tick, the second one waits a frame per pass.
      expect(game.vars[A]).toBeGreaterThanOrEqual(50);
      expect(game.vars[A]).toBeLessThan(55);
      expect(game.vars[B]).toBe('fertig');
      run(game, 1.5);
      expect(game.vars[A]).toBe(100);
      game.dispose();
    },
  },
  {
    name: 'code blocks run JavaScript with self, game, scene and three, also waiting with yield*',
    covers: ['code.run', 'code.value'],
    run: () => {
      const game = launch({
        objects: { ground000001: ground, hero00000001: hero([], 'code') },
        scripts: {
          code: workspace(
            when(
              start,
              b('code.run', {
                code: 'self.position.y += 2;\nyield* game.wait(0.1);\nself.position.x = three.MathUtils.clamp(9, 0, 3);',
              }),
              set(A, b('code.value', { code: 'scene.findAll().length' })),
              set(B, b('code.value', { code: 'scene.find("Hero").name + "!"' })),
            ),
          ),
        },
      });
      run(game, 0.05);
      const knight = game.scene.find('Hero');
      expect(knight?.position.y).toBeGreaterThan(1.5);
      // The script waits inside the code block, so the rest has not run yet.
      expect(game.vars[B]).toBe('');
      run(game, 0.3);
      expect(knight?.position.x).toBe(3);
      expect(game.vars[A]).toBe(2);
      expect(game.vars[B]).toBe('Hero!');
      game.dispose();
    },
  },
];
