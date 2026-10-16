import { defaultRegistry } from '@blockwerk/blocks';
import { describe, expect, it } from 'vitest';
import { checkScript, outlineScript, scriptFromWorkspace } from '../src';
import type { ScriptProposal } from '../src';
import { GUARD_ANSWER, scriptContext } from './fixtures';

const ctx = scriptContext();
const seeded = (): (() => number) => {
  let state = 7;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

/** The errors of a proposal (fails the test if it is valid). */
function errorsOf(proposal: unknown): string[] {
  const result = checkScript(proposal, ctx, seeded());
  if (result.ok) throw new Error('expected errors');
  return [...result.errors];
}

describe('checkScript', () => {
  it('accepts the guard script and builds a workspace that compiles', () => {
    const result = checkScript(GUARD_ANSWER, ctx, seeded());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const blocks = (result.workspace as { blocks: { blocks: { type: string }[] } }).blocks.blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe('events.whenGameStarts');
    expect(JSON.stringify(result.workspace)).toContain('npc.sees');
    for (const id of JSON.stringify(result.workspace).match(/"id":"([a-z0-9]+)"/g) ?? []) {
      expect(id.slice(6, -1)).toMatch(/^[a-z0-9]{12}$/);
    }
  });

  it('declares variables with IDs and plugs literals as shadow blocks', () => {
    const result = checkScript(
      {
        name: 'Zähler',
        variables: [{ name: 'leben', type: 'number', scope: 'object', default: 3 }],
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            { block: 'variables.set', fields: { variable: 'leben' }, inputs: { value: 5 } },
            { block: 'variables.change', fields: { variable: 'punkte' }, inputs: { by: 10 } },
          ],
        ],
      },
      ctx,
      seeded(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0]).toMatchObject({ name: 'leben', scope: 'object', default: 3 });
    const text = JSON.stringify(result.workspace);
    expect(text).toContain('literal.number');
    // The game variable of the project is used by its ID.
    expect(text).toContain('gamevar00001');
  });

  it('refuses answers that are not scripts', () => {
    expect(errorsOf(null)[0]).toMatch(/not an object/);
    expect(errorsOf({ name: 'x' }).join()).toMatch(/stacks/);
    expect(errorsOf({ stacks: [[]] }).join()).toMatch(/name/);
    expect(errorsOf({ name: 'x', stacks: [[]] }).join()).toMatch(/empty/);
  });

  it('refuses blocks that do not exist, and Code and custom blocks', () => {
    const wrap = (...nodes: object[]) => ({
      name: 'x',
      stacks: [[{ block: 'events.whenGameStarts' }, ...nodes]],
    });
    expect(errorsOf(wrap({ block: 'motion.teleportToMars' })).join()).toMatch(/does not exist/);
    expect(errorsOf(wrap({ block: 'code.run', fields: { code: 'alert(1)' } })).join()).toMatch(
      /does not exist|Code blocks/,
    );
    expect(errorsOf(wrap({ block: 'custom.callCommand' })).join()).toMatch(
      /custom blocks|does not exist/,
    );
  });

  it('wants an event first and commands after it', () => {
    expect(
      errorsOf({ name: 'x', stacks: [[{ block: 'control.wait', inputs: { seconds: 1 } }]] }).join(),
    ).toMatch(/event \(hat\)/);
    expect(
      errorsOf({
        name: 'x',
        stacks: [[{ block: 'events.whenGameStarts' }, { block: 'events.everyFrame' }]],
      }).join(),
    ).toMatch(/cannot sit in a stack/);
  });

  it('checks dropdown values, fields and unknown names', () => {
    expect(
      errorsOf({
        name: 'x',
        stacks: [[{ block: 'events.whenKey', fields: { key: 'Banana', mode: 'pressed' } }]],
      }).join(),
    ).toMatch(/not one of/);
    expect(
      errorsOf({
        name: 'x',
        stacks: [[{ block: 'events.whenGameStarts', fields: { color: 'red' } }]],
      }).join(),
    ).toMatch(/no field "color"/);
  });

  it('checks references against the project', () => {
    const reference = (target: string) => ({
      name: 'x',
      stacks: [
        [
          { block: 'events.whenGameStarts' },
          { block: 'npc.follow', fields: { target }, inputs: { distance: 2 } },
        ],
      ],
    });
    expect(checkScript(reference('tag:Enemy'), ctx, seeded()).ok).toBe(true);
    expect(errorsOf(reference('object:nobody000000')).join()).toMatch(/no object/);
    expect(errorsOf(reference('tag:Ghost')).join()).toMatch(/does not exist/);
    expect(errorsOf(reference('the player')).join()).toMatch(/not a valid reference/);
  });

  it('checks slots: types, missing conditions and literals where a block is needed', () => {
    const inIf = (condition: unknown) => ({
      name: 'x',
      stacks: [
        [
          { block: 'events.whenGameStarts' },
          {
            block: 'control.if',
            inputs: { condition },
            bodies: { then: [{ block: 'control.wait', inputs: { seconds: 1 } }] },
          },
        ],
      ],
    });
    expect(errorsOf(inIf(true)).join()).toMatch(/needs a condition block/);
    expect(errorsOf(inIf(undefined)).join()).toMatch(/needs a condition/);
    expect(errorsOf(inIf({ block: 'sensing.timer' })).join()).toMatch(
      /gives number but the slot needs boolean/,
    );
    expect(
      errorsOf({
        name: 'x',
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            { block: 'control.wait', inputs: { seconds: 'soon' } },
          ],
        ],
      }).join(),
    ).toMatch(/needs a number/);
  });

  it('refuses undeclared variables', () => {
    expect(
      errorsOf({
        name: 'x',
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            { block: 'variables.set', fields: { variable: 'mana' }, inputs: { value: 1 } },
          ],
        ],
      }).join(),
    ).toMatch(/not declared/);
  });

  it('keeps scripts reviewable: no more than 6 stacks and 80 blocks, and a cap ends a stack', () => {
    const stack = [{ block: 'events.whenGameStarts' }];
    expect(errorsOf({ name: 'x', stacks: Array.from({ length: 7 }, () => stack) }).join()).toMatch(
      /at most 6 stacks/,
    );
    const many = [
      { block: 'events.whenGameStarts' },
      ...Array.from({ length: 80 }, () => ({ block: 'control.wait', inputs: { seconds: 1 } })),
    ];
    expect(errorsOf({ name: 'x', stacks: [many] }).join()).toMatch(/at most 80/);
    expect(
      errorsOf({
        name: 'x',
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            {
              block: 'control.forever',
              bodies: { body: [{ block: 'control.wait', inputs: { seconds: 1 } }] },
            },
            { block: 'control.wait', inputs: { seconds: 1 } },
          ],
        ],
      }).join(),
    ).toMatch(/ends the script/);
  });

  it('survives garbage everywhere without throwing', () => {
    const garbage: unknown[] = [
      undefined,
      42,
      'text',
      [],
      { name: 5, stacks: 'x' },
      { name: 'x', stacks: [[null]] },
      { name: 'x', stacks: [[{ block: 7 }]] },
      {
        name: 'x',
        stacks: [[{ block: 'events.whenGameStarts', fields: 5, inputs: [], bodies: null }]],
      },
      {
        name: 'x',
        stacks: [
          [
            { block: 'events.whenGameStarts' },
            {
              block: 'control.if',
              inputs: { condition: { block: 'npc.sees', fields: { target: 3 } } },
              bodies: { then: 'nope' },
            },
          ],
        ],
      },
    ];
    for (const value of garbage) {
      expect(() => checkScript(value, ctx, seeded())).not.toThrow();
      expect(checkScript(value, ctx, seeded()).ok).toBe(false);
    }
  });
});

describe('outlineScript and scriptFromWorkspace', () => {
  it('shows the blocks as readable lines in both languages', () => {
    const en = outlineScript(GUARD_ANSWER.stacks, defaultRegistry, 'en');
    expect(en[0]).toBe('when game starts');
    expect(en.join('\n')).toContain('wait until (do I see tag:Player?)');
    expect(en.join('\n')).toContain('  follow tag:Player at distance 1.5');
    expect(en.join('\n')).toContain('  go to object:gate00000001 (pathfinding)');
    const de = outlineScript(GUARD_ANSWER.stacks, defaultRegistry, 'de');
    expect(de[0]).toBe('Wenn Spiel startet');
    expect(de.join('\n')).toContain('  folge tag:Player mit Abstand 1.5');
  });

  it('reads a saved workspace back into the proposal format', () => {
    const result = checkScript(GUARD_ANSWER, ctx, seeded());
    if (!result.ok) throw new Error('expected a valid script');
    const back = scriptFromWorkspace(result.workspace, defaultRegistry, []);
    expect(back).toEqual(GUARD_ANSWER.stacks);
  });

  it('names variables by their names', () => {
    const proposal: ScriptProposal = {
      name: 'x',
      variables: [{ name: 'leben', type: 'number', scope: 'object' }],
      stacks: [
        [
          { block: 'events.whenGameStarts' },
          { block: 'variables.set', fields: { variable: 'leben' }, inputs: { value: 1 } },
        ],
      ],
    };
    const result = checkScript(proposal, ctx, seeded());
    if (!result.ok) throw new Error('expected a valid script');
    expect(scriptFromWorkspace(result.workspace, defaultRegistry, result.variables)).toEqual(
      proposal.stacks,
    );
  });
});
