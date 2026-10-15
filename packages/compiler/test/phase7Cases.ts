import { expect } from 'vitest';
import { b, get, set, workspace } from './dsl';
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
];
