// @vitest-environment jsdom
import type { UiData, UiElement } from '@blockwerk/project';
import { beforeAll, describe, expect, it } from 'vitest';
import { Game, GameSettings, initPhysics, MemorySaveStorage, UiRenderer } from '../src';
import type { UiStrings } from '../src';
import { component, objectData, sceneData } from './helpers';

beforeAll(async () => {
  await initPhysics();
});

const strings: UiStrings = (key, params) =>
  params ? `${key}:${Object.values(params).join(',')}` : key;

const element = (
  id: string,
  type: UiElement['type'],
  more: Partial<UiElement> = {},
): UiElement => ({
  id,
  name: id,
  type,
  visible: true,
  anchorMin: [0, 0],
  anchorMax: [0, 0],
  pivot: [0, 0],
  offsetMin: [24, 24],
  offsetMax: [264, 48],
  ...more,
});

const hud: UiData = {
  formatVersion: 1,
  referenceWidth: 1280,
  referenceHeight: 720,
  elements: [
    element('life', 'bar', { bind: { kind: 'health' }, color: '#d33' }),
    element('label', 'text', {
      text: 'Leben {value}',
      bind: { kind: 'health' },
      offsetMin: [24, 60],
      offsetMax: [264, 90],
    }),
    element('bag', 'inventory', { offsetMin: [24, 100], offsetMax: [264, 300] }),
  ],
};

const pause: UiData = {
  formatVersion: 1,
  referenceWidth: 1280,
  referenceHeight: 720,
  elements: [
    element('panel', 'panel', {
      anchorMin: [0.5, 0.5],
      anchorMax: [0.5, 0.5],
      offsetMin: [-200, -150],
      offsetMax: [200, 150],
      children: [
        element('resume', 'button', {
          text: 'Weiter',
          offsetMin: [10, 10],
          offsetMax: [390, 50],
          actions: [{ type: 'resume' }],
        }),
        element('save', 'button', {
          text: 'Speichern',
          offsetMin: [10, 60],
          offsetMax: [390, 100],
          actions: [{ type: 'saveGame', slot: 2 }],
        }),
        element('music', 'slider', {
          setting: 'musicVolume',
          offsetMin: [10, 110],
          offsetMax: [390, 140],
        }),
        element('keys', 'keybindings', { offsetMin: [10, 150], offsetMax: [390, 290] }),
      ],
    }),
  ],
};

function make(settings = new GameSettings()) {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const saves = new MemorySaveStorage();
  const game = new Game(
    sceneData({
      hero000001: objectData({
        name: 'Held',
        tag: 'Player',
        components: [
          component('characterController', {}, 'heroccontr01'),
          component('thirdPersonControl', {}, 'herocontrol1'),
          component('health', { max: 100, invulnerable: 0 }, 'healthcomp001'),
          component('inventory', { startItems: 'Schlüssel:1' }, 'inventorycmp1'),
        ],
      }),
      hud000000001: objectData({
        name: 'HUD',
        components: [component('uiCanvas', { ui: 'hud', visibility: 'always' }, 'uicanvashud1')],
      }),
      pause0000001: objectData({
        name: 'Pause',
        components: [component('uiCanvas', { ui: 'pause', visibility: 'paused' }, 'uicanvaspau1')],
      }),
    }),
    {
      scripts: () => null,
      uis: (id) => (id === 'hud' ? hud : id === 'pause' ? pause : null),
      settings,
      saves,
      sceneId: 'scene0000001',
      random: () => 0.5,
    },
  );
  const renderer = new UiRenderer(parent, { strings }, settings);
  renderer.setSize(1280, 720);
  const frame = (loading = null as { title: string; progress: number; tip: number } | null) =>
    renderer.update({ game, loading });
  return { parent, game, renderer, settings, frame, saves };
}

const byName = (root: ParentNode, name: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(`[data-name="${name}"]`);
  if (!found) throw new Error(`no element ${name}`);
  return found;
};

describe('UiRenderer', () => {
  it('places elements by their anchors and scales them with the screen', () => {
    const { parent, renderer, frame } = make();
    frame();
    const life = byName(parent, 'life');
    expect(life.style.left).toBe('24px');
    expect(life.style.top).toBe('24px');
    expect(life.style.width).toBe('240px');
    expect(life.style.height).toBe('24px');
    renderer.setSize(2560, 1440);
    frame();
    expect(life.style.left).toBe('48px');
    expect(life.style.width).toBe('480px');
    renderer.dispose();
  });

  it('shows the life bar, the bound text and the inventory, and keeps them up to date', () => {
    const { parent, game, frame, renderer } = make();
    game.stepTick();
    frame();
    expect(byName(parent, 'life').dataset['fraction']).toBe('1');
    expect(byName(parent, 'label').textContent).toBe('Leben 100');
    expect(
      [...parent.querySelectorAll('[data-testid="ui-inventory-item"]')].map((n) => n.textContent),
    ).toEqual(['Schlüssel × 1']);
    const hero = game.world.getObject('hero000001');
    if (!hero) throw new Error('no hero');
    game.damageObject(hero, 'self', 35);
    game.addItem(hero, 'self', 'Münze', 4);
    frame();
    expect(byName(parent, 'life').dataset['fraction']).toBe('0.65');
    expect(byName(parent, 'label').textContent).toBe('Leben 65');
    expect(parent.querySelectorAll('[data-testid="ui-inventory-item"]')).toHaveLength(2);
    renderer.dispose();
  });

  it('shows the pause menu only while the game is paused; the buttons work', () => {
    const { parent, game, frame, renderer } = make();
    frame();
    expect(parent.querySelector('[data-name="resume"]')).toBeNull();
    game.setGamePaused(true);
    frame();
    const resume = byName(parent, 'resume').querySelector('button');
    expect(resume?.textContent).toBe('Weiter');
    resume?.click();
    expect(game.gamePaused).toBe(false);
    frame();
    expect(parent.querySelector('[data-name="resume"]')).toBeNull();
    renderer.dispose();
  });

  it('Escape pauses and resumes, but not while someone talks', () => {
    const { parent, game, frame, renderer } = make();
    frame();
    const escape = (target: Node = parent): void => {
      target.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
    };
    escape();
    expect(game.gamePaused).toBe(true);
    escape();
    expect(game.gamePaused).toBe(false);
    // Typing somewhere else in the page (another window of the editor) does not pause.
    escape(document.body);
    expect(game.gamePaused).toBe(false);
    renderer.dispose();
  });

  it('a slider changes the setting and the game applies it', () => {
    const { parent, game, settings, frame, renderer } = make();
    game.setGamePaused(true);
    frame();
    const input = byName(parent, 'music').querySelector('input');
    if (!input) throw new Error('no slider');
    expect(input.value).toBe('70');
    input.value = '25';
    input.dispatchEvent(new Event('input'));
    expect(settings.get('musicVolume')).toBe(25);
    expect(game.audio.volume('music')).toBeCloseTo(0.25);
    renderer.dispose();
  });

  it('rebinding: click the key, press a new one; the next key goes to the setting, not the game', () => {
    const { parent, game, settings, frame, renderer } = make();
    game.setGamePaused(true);
    frame();
    const jump = parent.querySelector<HTMLButtonElement>('[data-testid="ui-key-jump"]');
    expect(jump?.textContent).toBe('␣');
    jump?.click();
    expect(renderer.capturingKey).toBe(true);
    frame();
    expect(parent.querySelector('[data-testid="ui-key-jump"]')?.textContent).toBe('keys.press');
    parent.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyJ', cancelable: true, bubbles: true }),
    );
    expect(renderer.capturingKey).toBe(false);
    expect(settings.get('bindings')[1]?.jump).toEqual(['KeyJ']);
    frame();
    expect(parent.querySelector('[data-testid="ui-key-jump"]')?.textContent).toBe('J');
    expect(game.gamePaused).toBe(true);
    renderer.dispose();
  });

  it('the save button writes the slot and shows a notice', () => {
    const { parent, game, saves, frame, renderer } = make();
    game.setGamePaused(true);
    frame();
    byName(parent, 'save').querySelector('button')?.click();
    expect(saves.read(2)?.scene).toBe('scene0000001');
    frame();
    expect(parent.querySelector('[data-testid="ui-notice"]')?.textContent).toBe('notice.saved');
    renderer.dispose();
  });

  it('the hint and the dialog box appear without a canvas that provides them', () => {
    const { parent, game, frame, renderer } = make();
    frame();
    expect(parent.querySelector('[data-type="hint"]')).not.toBeNull();
    expect((parent.querySelector('[data-type="hint"]') as HTMLElement).style.display).toBe('none');
    expect(game.dialogView()).toBeNull();
    renderer.dispose();
  });

  it('draws the loading screen with title, progress and tip', () => {
    const { parent, frame, renderer } = make();
    frame({ title: 'Gruft', progress: 0.5, tip: 1 });
    expect(parent.querySelector('[data-testid="loading-title"]')?.textContent).toBe(
      'loading.title:Gruft',
    );
    expect((parent.querySelector('.bw-ui-loading-fill') as HTMLElement).style.width).toBe('50%');
    expect(parent.querySelector('.bw-ui-loading p')?.textContent).toBe('loading.tip.1');
    frame(null);
    expect(parent.querySelector('[data-testid="loading-screen"]')).toBeNull();
    renderer.dispose();
  });
});
