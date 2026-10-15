import { FORMAT_VERSION } from './schema';
import type { UiAction, UiData, UiElement } from './schema';

/** The ready-made menus (SPEC 8.12). */
export const UI_TEMPLATE_KINDS = [
  'mainMenu',
  'pauseMenu',
  'settings',
  'victory',
  'defeat',
  'loading',
  'hud',
] as const;
/** A ready-made menu. */
export type UiTemplateKind = (typeof UI_TEMPLATE_KINDS)[number];

/** Texts of the templates, in the language of the author (the editor passes its translations). */
export const UI_TEMPLATE_LABELS = [
  'gameTitle',
  'play',
  'loadSlot',
  'settings',
  'quit',
  'paused',
  'resume',
  'restart',
  'saveSlot',
  'mainMenu',
  'back',
  'graphics',
  'masterVolume',
  'musicVolume',
  'effectsVolume',
  'voicesVolume',
  'mouseSensitivity',
  'fullscreen',
  'keys',
  'victory',
  'defeat',
  'loading',
  'life',
] as const;
/** The name of a template text. */
export type UiTemplateLabel = (typeof UI_TEMPLATE_LABELS)[number];

/** Where the template buttons lead (asset IDs; missing ones leave the button without that action). */
export interface UiTemplateTargets {
  /** The scene "Play" starts. */
  readonly startScene?: string;
  /** The scene of the main menu ("Main menu" buttons). */
  readonly menuScene?: string;
  /** The settings canvas (opened by "Settings", closed by "Back"). */
  readonly settingsUi?: string;
}

type Labels = Readonly<Record<UiTemplateLabel, string>>;

class Builder {
  private counter = 0;

  next(): string {
    this.counter += 1;
    return `e${this.counter}`;
  }

  /** A fixed-size element at an anchor, offsets from the anchor point. */
  at(
    type: UiElement['type'],
    name: string,
    anchor: readonly [number, number],
    x: number,
    y: number,
    w: number,
    h: number,
    more: Partial<UiElement> = {},
  ): UiElement {
    return {
      id: this.next(),
      name,
      type,
      visible: true,
      anchorMin: [anchor[0], anchor[1]],
      anchorMax: [anchor[0], anchor[1]],
      pivot: [anchor[0], anchor[1]],
      offsetMin: [x, y],
      offsetMax: [x + w, y + h],
      ...more,
    };
  }

  stretch(name: string, more: Partial<UiElement> = {}): UiElement {
    return {
      id: this.next(),
      name,
      type: 'panel',
      visible: true,
      anchorMin: [0, 0],
      anchorMax: [1, 1],
      pivot: [0.5, 0.5],
      offsetMin: [0, 0],
      offsetMax: [0, 0],
      ...more,
    };
  }
}

const CENTER: readonly [number, number] = [0.5, 0.5];
const TOP_CENTER: readonly [number, number] = [0.5, 0];

function canvas(elements: UiElement[]): UiData {
  return { formatVersion: FORMAT_VERSION, referenceWidth: 1280, referenceHeight: 720, elements };
}

function fill(text: string, slot: number): string {
  return text.replace('{n}', String(slot));
}

/** A column of centered buttons starting at `top`, each 320 × 48. */
function buttonColumn(
  b: Builder,
  buttons: readonly { text: string; actions: UiAction[] }[],
  top: number,
): UiElement[] {
  return buttons.map((button, index) =>
    b.at('button', button.text, CENTER, -160, top + index * 60, 320, 48, {
      text: button.text,
      fontSize: 22,
      actions: button.actions,
    }),
  );
}

function slotButtons(
  b: Builder,
  text: string,
  top: number,
  action: (slot: 1 | 2 | 3) => UiAction,
): UiElement[] {
  return ([1, 2, 3] as const).map((slot, index) =>
    b.at('button', fill(text, slot), CENTER, -160 + index * 112, top, 96, 40, {
      text: fill(text, slot),
      fontSize: 16,
      actions: [action(slot)],
    }),
  );
}

/**
 * The ready-made menu canvases. They are plain UI assets, so everything can be changed afterwards
 * in the UI editor. `labels` are the texts in the author's language.
 */
export function createUiTemplate(
  kind: UiTemplateKind,
  labels: Labels,
  targets: UiTemplateTargets = {},
): UiData {
  const b = new Builder();
  const toMenu: UiAction[] = targets.menuScene
    ? [{ type: 'loadScene', scene: targets.menuScene, spawn: '' }]
    : [];
  switch (kind) {
    case 'mainMenu': {
      const open: UiAction[] = targets.settingsUi
        ? [{ type: 'showUi', ui: targets.settingsUi }]
        : [];
      const play: UiAction[] = targets.startScene
        ? [{ type: 'loadScene', scene: targets.startScene, spawn: '' }]
        : [];
      return canvas([
        b.stretch('Background', { background: 'rgba(8,10,16,0.82)' }),
        b.at('text', 'Title', TOP_CENTER, -400, 90, 800, 90, {
          text: labels.gameTitle,
          fontSize: 64,
        }),
        ...buttonColumn(
          b,
          [
            { text: labels.play, actions: play },
            { text: labels.settings, actions: open },
            { text: labels.quit, actions: [{ type: 'quit' }] },
          ],
          300,
        ),
        ...slotButtons(b, labels.loadSlot, 490, (slot) => ({ type: 'loadGame', slot })),
      ]);
    }
    case 'pauseMenu': {
      const open: UiAction[] = targets.settingsUi
        ? [{ type: 'showUi', ui: targets.settingsUi }]
        : [];
      return canvas([
        b.stretch('Background', { background: 'rgba(8,10,16,0.7)' }),
        b.at('text', 'Title', TOP_CENTER, -300, 70, 600, 70, { text: labels.paused, fontSize: 48 }),
        ...buttonColumn(
          b,
          [
            { text: labels.resume, actions: [{ type: 'resume' }] },
            { text: labels.settings, actions: open },
            { text: labels.restart, actions: [{ type: 'restart' }] },
            { text: labels.mainMenu, actions: toMenu },
          ],
          170,
        ),
        ...slotButtons(b, labels.saveSlot, 430, (slot) => ({ type: 'saveGame', slot })),
        ...slotButtons(b, labels.loadSlot, 480, (slot) => ({ type: 'loadGame', slot })),
      ]);
    }
    case 'settings': {
      const rows: { label: string; element: (y: number) => UiElement }[] = [
        {
          label: labels.graphics,
          element: (y) =>
            b.at('dropdown', 'Graphics', CENTER, 30, y, 250, 34, {
              setting: 'graphicsLevel',
              fontSize: 18,
            }),
        },
        ...(
          [
            ['masterVolume', 'masterVolume'],
            ['musicVolume', 'musicVolume'],
            ['effectsVolume', 'effectsVolume'],
            ['voicesVolume', 'voicesVolume'],
            ['mouseSensitivity', 'mouseSensitivity'],
          ] as const
        ).map(([label, setting]) => ({
          label: labels[label],
          element: (y: number) => b.at('slider', label, CENTER, 30, y, 250, 34, { setting }),
        })),
        {
          label: labels.fullscreen,
          element: (y) =>
            b.at('toggle', 'Fullscreen', CENTER, 30, y, 250, 34, {
              setting: 'fullscreen',
              text: '',
              fontSize: 18,
            }),
        },
      ];
      const children: UiElement[] = [];
      rows.forEach((row, index) => {
        const y = -250 + index * 42;
        children.push(
          b.at('text', row.label, CENTER, -330, y, 330, 34, {
            text: row.label,
            fontSize: 20,
            align: 'left',
          }),
          row.element(y),
        );
      });
      children.push(
        b.at('keybindings', 'Keys', CENTER, -330, 60, 660, 150, { fontSize: 16 }),
        b.at('button', labels.back, CENTER, -100, 225, 200, 44, {
          text: labels.back,
          fontSize: 20,
          actions: targets.settingsUi ? [{ type: 'hideUi', ui: targets.settingsUi }] : [],
        }),
      );
      return canvas([
        b.at('panel', 'Panel', CENTER, -360, -300, 720, 560, {
          background: 'rgba(14,16,24,0.96)',
          children,
        }),
      ]);
    }
    case 'victory':
    case 'defeat': {
      const title = kind === 'victory' ? labels.victory : labels.defeat;
      return canvas([
        b.stretch('Background', {
          background: kind === 'victory' ? 'rgba(10,40,20,0.85)' : 'rgba(50,10,10,0.85)',
        }),
        b.at('text', 'Title', TOP_CENTER, -400, 170, 800, 100, { text: title, fontSize: 72 }),
        ...buttonColumn(
          b,
          [
            { text: labels.restart, actions: [{ type: 'restart' }] },
            { text: labels.mainMenu, actions: toMenu },
          ],
          340,
        ),
      ]);
    }
    case 'loading':
      return canvas([
        b.stretch('Background', { background: '#0b0d12' }),
        b.at('text', 'Title', CENTER, -300, -60, 600, 60, { text: labels.loading, fontSize: 40 }),
        b.at('bar', 'Progress', CENTER, -200, 20, 400, 16, {
          bind: { kind: 'loading' },
          color: '#4a8cff',
          background: 'rgba(255,255,255,0.15)',
        }),
      ]);
    case 'hud':
      return canvas([
        b.at('bar', 'Life bar', [0, 0], 24, 24, 260, 26, {
          bind: { kind: 'health' },
          color: '#d33',
          background: 'rgba(0,0,0,0.55)',
        }),
        b.at('text', 'Life text', [0, 0], 24, 56, 260, 28, {
          text: `${labels.life} {value}`,
          bind: { kind: 'health' },
          align: 'left',
          fontSize: 18,
        }),
        b.at('inventory', 'Inventory', [1, 0], -280, 24, 256, 220, {
          align: 'left',
          fontSize: 18,
          background: 'rgba(0,0,0,0.35)',
        }),
        b.at('hint', 'Hint', [0.5, 1], -200, -130, 400, 40, { fontSize: 20 }),
        b.at('dialog', 'Dialog', [0.5, 1], -320, -330, 640, 290, { fontSize: 18 }),
      ]);
  }
}
