import { defaultRegistry } from '@blockwerk/blocks';
import type { ScriptContext, ScriptProposal } from '../src';

/** What a proposal is checked against in the tests: a scene with a gate and a guard. */
export function scriptContext(): ScriptContext {
  return {
    registry: defaultRegistry,
    objectIds: new Set(['gate00000001', 'guard0000001']),
    tags: new Set(['Enemy']),
    assets: {
      prefab: new Set(['prefab000001']),
      dialog: new Set(),
      scene: new Set(),
      ui: new Set(),
      audio: new Set(),
    },
    gameVariables: [{ id: 'gamevar00001', name: 'punkte', type: 'number' }],
  };
}

/**
 * The answer a model would give for "The guard should guard the gate and chase the player when it
 * sees him": wait until the player is in view, chase, and when he is gone walk back to the gate.
 */
export const GUARD_ANSWER: ScriptProposal = {
  name: 'Wache am Tor',
  summary: 'Die Wache bleibt am Tor und verfolgt den Spieler, sobald sie ihn sieht.',
  attachTo: 'guard0000001',
  stacks: [
    [
      { block: 'events.whenGameStarts' },
      {
        block: 'control.forever',
        bodies: {
          body: [
            {
              block: 'control.waitUntil',
              inputs: { condition: { block: 'npc.sees', fields: { target: 'tag:Player' } } },
            },
            { block: 'npc.follow', fields: { target: 'tag:Player' }, inputs: { distance: 1.5 } },
            {
              block: 'control.waitUntil',
              inputs: {
                condition: {
                  block: 'operators.not',
                  inputs: { value: { block: 'npc.sees', fields: { target: 'tag:Player' } } },
                },
              },
            },
            { block: 'control.wait', inputs: { seconds: 2 } },
            { block: 'npc.goTo', fields: { target: 'object:gate00000001' } },
          ],
        },
      },
    ],
  ],
};

/** A repeatable random source (a constant would give every block the same ID). */
export function seeded(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}
