import type { UiData } from '@blockwerk/project';
import { MemorySaveStorage } from '@blockwerk/runtime';
import { expect } from 'vitest';
import { b, set, workspace } from './dsl';
import { A, B, ground, hero, launch, run, when } from './phase3Cases';
import type { RuntimeCase } from './phase3Cases';
import { component, object } from './phase3Cases';

/** Runtime cases of the phase 6 blocks (UI canvases, save slots). */

const menu: UiData = {
  formatVersion: 1,
  referenceWidth: 1280,
  referenceHeight: 720,
  elements: [],
};

export const phase6Cases: RuntimeCase[] = [
  {
    name: 'show UI and hide UI open and close a canvas that is set to "by hand"',
    covers: ['ui.show', 'ui.hide'],
    run: () => {
      const game = launch({
        objects: {
          ground000001: ground,
          hero00000001: hero([], 'opener'),
          canvas000001: object(
            'Menü',
            [0, 0, 0],
            [component('uiCanvas', { ui: 'menu0000001', visibility: 'manual' }, 'uicanvascmp1')],
          ),
        },
        uis: { menu0000001: menu },
        scripts: {
          opener: workspace(
            when(
              b('events.whenKey', { key: 'M', mode: 'pressed' }),
              b('ui.show', { ui: 'ui:menu0000001' }),
              set(A, 1),
              b('control.wait', {}, { seconds: 0.2 }),
              b('ui.hide', { ui: 'ui:menu0000001' }),
              set(A, 2),
            ),
          ),
        },
      });
      run(game, 0.1);
      expect(game.uiCanvases()).toHaveLength(0);
      game.input.keyEvent('m', true, 'KeyM');
      run(game, 0.1);
      game.input.keyEvent('m', false, 'KeyM');
      expect(game.vars[A]).toBe(1);
      expect(game.uiCanvases().map((canvas) => canvas.ui)).toEqual([menu]);
      run(game, 0.4);
      expect(game.vars[A]).toBe(2);
      expect(game.uiCanvases()).toHaveLength(0);
      game.dispose();
    },
  },
  {
    name: 'save game, slot used and load game work with the three slots',
    covers: ['saves.save', 'saves.load', 'saves.slotUsed'],
    run: () => {
      const saves = new MemorySaveStorage();
      const game = launch({
        sceneId: 'scene0000001',
        saves,
        objects: { ground000001: ground, hero00000001: hero([], 'saver') },
        scripts: {
          saver: workspace(
            when(
              b('events.whenKey', { key: 'S', mode: 'pressed' }),
              b('saves.save', { slot: '2' }),
            ),
            when(
              b('events.whenKey', { key: 'U', mode: 'pressed' }),
              set(A, b('saves.slotUsed', { slot: '3' })),
              set(B, b('saves.slotUsed', { slot: '2' })),
            ),
            when(
              b('events.whenKey', { key: 'L', mode: 'pressed' }),
              b('saves.load', { slot: '2' }),
            ),
          ),
        },
      });
      const press = (key: string): void => {
        game.input.keyEvent(key, true, `Key${key.toUpperCase()}`);
        run(game, 0.1);
        game.input.keyEvent(key, false, `Key${key.toUpperCase()}`);
        run(game, 0.05);
      };
      run(game, 0.1);
      // Nothing saved yet: loading says so and asks for nothing.
      press('l');
      expect(game.takeSceneRequest()).toBeNull();
      expect(game.notice?.key).toBe('noSave');
      press('s');
      expect(saves.read(2)?.scene).toBe('scene0000001');
      expect(saves.read(3)).toBeNull();
      press('u');
      expect(game.vars[A]).toBe(false);
      expect(game.vars[B]).toBe(true);
      press('l');
      expect(game.takeSceneRequest()?.save?.slot).toBe(2);
      game.dispose();
    },
  },
];
