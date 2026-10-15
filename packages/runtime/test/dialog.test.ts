import type { DialogData } from '@blockwerk/project';
import { beforeAll, describe, expect, it } from 'vitest';
import { DialogSession, Game, initNavigation, initPhysics, peekInventory } from '../src';
import type { DialogAction, DialogHost } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const dialog: DialogData = {
  formatVersion: 1,
  start: 'greet',
  nodes: {
    greet: {
      speaker: 'Mira',
      text: 'Kannst du mir helfen?',
      actions: [{ type: 'setVariable', variable: 'met', value: true }],
      answers: [
        {
          id: 'help',
          text: 'Gern',
          next: 'quest',
          actions: [{ type: 'addItem', item: 'map', count: 1 }],
        },
        {
          id: 'reward',
          text: 'Ich habe den Schluessel',
          next: null,
          condition: { type: 'hasItem', item: 'key', count: 1 },
        },
        {
          id: 'rich',
          text: 'Ich habe viel Gold',
          next: null,
          condition: { type: 'variable', variable: 'gold', op: '>=', value: 100 },
        },
        { id: 'no', text: 'Nein', next: null },
      ],
    },
    quest: { speaker: 'Mira', text: '', answers: [], next: 'thanks' },
    thanks: { speaker: 'Mira', text: 'Danke!', answers: [], next: null },
  },
};

function host(overrides: Partial<DialogHost> = {}): {
  host: DialogHost;
  performed: DialogAction[];
  answered: string[];
} {
  const performed: DialogAction[] = [];
  const answered: string[] = [];
  return {
    performed,
    answered,
    host: {
      hasItem: () => false,
      variable: () => undefined,
      perform: (action) => performed.push(action),
      answered: (id) => answered.push(id),
      ...overrides,
    },
  };
}

describe('DialogSession', () => {
  it('runs the actions of the first line and shows only answers whose condition holds', () => {
    const { host: h, performed } = host();
    const session = new DialogSession(dialog, h);
    expect(performed).toEqual([{ type: 'setVariable', variable: 'met', value: true }]);
    expect(session.view()?.choices.map((choice) => choice.id)).toEqual(['help', 'no']);
  });

  it('offers conditional answers when the item or the variable is there', () => {
    const { host: h } = host({
      hasItem: (item) => item === 'key',
      variable: (id) => (id === 'gold' ? 120 : undefined),
    });
    const session = new DialogSession(dialog, h);
    expect(session.view()?.choices.map((choice) => choice.id)).toEqual([
      'help',
      'reward',
      'rich',
      'no',
    ]);
  });

  it('does the answer actions, skips empty lines and ends at the last line', () => {
    const { host: h, performed, answered } = host();
    const session = new DialogSession(dialog, h);
    session.choose(0);
    expect(answered).toEqual(['help']);
    expect(performed).toContainEqual({ type: 'addItem', item: 'map', count: 1 });
    // The empty "quest" line is skipped; "thanks" has no answers and only continues.
    expect(session.view()?.text).toBe('Danke!');
    expect(session.view()?.choices).toEqual([]);
    session.confirm();
    expect(session.done).toBe(true);
    expect(session.view()).toBeNull();
  });

  it('moves the highlight around and confirms the highlighted answer', () => {
    const { host: h, answered } = host();
    const session = new DialogSession(dialog, h);
    session.move(1);
    expect(session.view()?.selected).toBe(1);
    session.move(1);
    expect(session.view()?.selected).toBe(0);
    session.move(-1);
    session.confirm();
    expect(answered).toEqual(['no']);
    expect(session.done).toBe(true);
  });
});

describe('talkable', () => {
  const ground = objectData({
    name: 'Ground',
    transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [40, 1, 40] },
    components: [component('boxCollider', {}, 'groundcoll01')],
  });
  const make = () =>
    new Game(
      sceneData({
        ground000001: ground,
        hero00000001: objectData({
          name: 'Held',
          tag: 'Player',
          components: [
            component('characterController', {}, 'heroccontr01'),
            component('thirdPersonControl', {}, 'herocontrol1'),
          ],
        }),
        mira00000001: objectData({
          name: 'Mira',
          transform: { position: [0, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: [
            component('talkable', { dialog: 'dialog000001', name: 'Mira' }, 'talkcomp0001'),
          ],
        }),
      }),
      {
        scripts: () => null,
        dialogs: (id) => (id === 'dialog000001' ? dialog : null),
        random: () => 0.5,
      },
    );
  const run = (game: Game, seconds: number): void => {
    for (let i = 0; i < Math.round(seconds * 60); i++) game.stepTick();
  };

  it('shows a hint, opens the dialog with Interact and drives it with the keyboard', () => {
    const game = make();
    run(game, 0.2);
    expect(game.interactionHint(1)).toEqual({ kind: 'talk', label: 'Mira' });
    game.input.keyEvent('e', true, 'KeyE');
    run(game, 0.05);
    game.input.keyEvent('e', false, 'KeyE');
    run(game, 0.05);
    expect(game.talking).toBe(true);
    expect(game.dialogView()?.speaker).toBe('Mira');
    // The key that opened the dialog did not already pick an answer.
    expect(game.dialogView()?.text).toBe('Kannst du mir helfen?');
    // While talking the player does not move and no hint is shown.
    expect(game.interactionHint(1)).toBeNull();
    // "1" picks the first answer ("Gern"), which gives a map and leads to the last line.
    game.input.keyEvent('1', true, 'Digit1');
    run(game, 0.05);
    game.input.keyEvent('1', false, 'Digit1');
    run(game, 0.05);
    expect(game.dialogView()?.text).toBe('Danke!');
    game.input.keyEvent('Enter', true, 'Enter');
    run(game, 0.05);
    game.input.keyEvent('Enter', false, 'Enter');
    run(game, 0.05);
    expect(game.talking).toBe(false);
    const hero = game.world.getObject('hero00000001');
    expect(hero && peekInventory(hero)?.count('map')).toBe(1);
    expect(game.vars['met']).toBe(true);
    game.dispose();
  });
});
