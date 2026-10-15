import type { UiAction, UiData, UiElement } from '@blockwerk/project';
import type { Game } from '../game/Game';
import { DEFAULT_BINDINGS } from '../game/actions';
import type { ButtonAction } from '../game/actions';
import { QUALITY_NAMES, isQualityName } from '../rendering/quality';
import type { BindingOverrides, GameSettings, SettingsValues } from '../settings/settings';
import { canvasScale, layoutRect } from './layout';
import type { Rect } from './layout';
import type { UiStringKey, UiStrings } from './strings';
import { UI_CSS } from './styles';

/** What the UI layer needs from its host. */
export interface UiHost {
  /** Translates the built-in texts. */
  readonly strings: UiStrings;
  /** URL of an image asset, or `null`. */
  imageUrl?(assetId: string): string | null;
}

/** The loading screen between scenes. */
export interface UiLoading {
  readonly title: string;
  /** 0..1 */
  readonly progress: number;
  /** Which of the tips to show. */
  readonly tip: number;
}

/** What the host passes every frame. */
export interface UiFrame {
  /** The running game, or `null` (menus before a game exists are not part of phase 6). */
  readonly game: Game | null;
  readonly loading?: UiLoading | null;
  /** Views of the game (split screen): their player and how they are split. */
  readonly views?: {
    readonly players: readonly (1 | 2)[];
    readonly split: 'horizontal' | 'vertical';
  };
}

interface Context {
  readonly game: Game;
  readonly player: 1 | 2;
  readonly scale: number;
  readonly renderer: UiRenderer;
}

interface UiNode {
  readonly element: UiElement;
  readonly dom: HTMLElement;
  readonly children: UiNode[];
  update(context: Context): void;
}

interface Instance {
  readonly ui: UiData;
  readonly dom: HTMLElement;
  readonly roots: UiNode[];
  width: number;
  height: number;
}

/** The setting names that are numbers (sliders). */
type NumericSetting =
  'masterVolume' | 'musicVolume' | 'effectsVolume' | 'voicesVolume' | 'mouseSensitivity';

const SLIDER_RANGE: Readonly<Record<NumericSetting, { min: number; max: number; step: number }>> = {
  masterVolume: { min: 0, max: 100, step: 1 },
  musicVolume: { min: 0, max: 100, step: 1 },
  effectsVolume: { min: 0, max: 100, step: 1 },
  voicesVolume: { min: 0, max: 100, step: 1 },
  mouseSensitivity: { min: 0.2, max: 3, step: 0.1 },
};

/** Actions listed by the key binding element, in this order. */
const BINDING_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'jump',
  'sprint',
  'crouch',
  'interact',
  'attack',
  'roll',
  'pause',
] as const;

const NOTICE_MS = 2200;

function isNumericSetting(setting: string | undefined): setting is NumericSetting {
  return setting !== undefined && setting in SLIDER_RANGE;
}

/** A short readable name of a key code (`KeyW` → `W`, `ArrowUp` → `↑`). */
export function keyLabel(code: string | undefined): string {
  if (!code) return '–';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const names: Record<string, string> = {
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Space: '␣',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
  };
  return names[code] ?? code;
}

/** `{value}` replaced by a number without needless decimals. */
export function formatValue(text: string, value: number): string {
  return text.replace(/\{value\}/g, String(Math.round(value * 10) / 10));
}

/** A canvas of the built-in overlay: the interaction hint and the dialog box. */
function builtinOverlay(): UiData {
  const base = {
    visible: true,
    pivot: [0.5, 1] as [number, number],
    anchorMin: [0.5, 1] as [number, number],
    anchorMax: [0.5, 1] as [number, number],
  };
  return {
    formatVersion: 1,
    referenceWidth: 1280,
    referenceHeight: 720,
    elements: [
      {
        ...base,
        id: 'builtin-hint',
        name: 'Hint',
        type: 'hint',
        offsetMin: [-200, -130],
        offsetMax: [200, -90],
        fontSize: 20,
      },
      {
        ...base,
        id: 'builtin-dialog',
        name: 'Dialog',
        type: 'dialog',
        offsetMin: [-320, -330],
        offsetMax: [320, -40],
        fontSize: 18,
      },
    ],
  };
}

function elementTypes(elements: readonly UiElement[], found = new Set<string>()): Set<string> {
  for (const element of elements) {
    found.add(element.type);
    if (element.children) elementTypes(element.children, found);
  }
  return found;
}

/**
 * The UI layer (SPEC 8.12): draws the canvases of the running game as HTML elements over the game
 * view, one set per player in split screen, plus the interaction hint, the dialog box, the loading
 * screen and short notices. The host creates it with the element the game canvas lives in and
 * calls {@link update} every frame.
 */
export class UiRenderer {
  private readonly doc: Document;
  private readonly root: HTMLElement;
  private readonly instances = new Map<string, Instance>();
  private readonly viewDoms = new Map<string, HTMLElement>();
  private loadingDom: HTMLElement | null = null;
  private noticeDom: HTMLElement | null = null;
  private game: Game | null = null;
  private width = 0;
  private height = 0;
  private capturing: { player: 1 | 2; action: keyof BindingOverrides } | null = null;
  private padBefore = false;
  private readonly cleanup: (() => void)[] = [];
  private noticeShownAt = -1;

  constructor(
    private readonly parent: HTMLElement,
    readonly host: UiHost,
    readonly settings: GameSettings,
  ) {
    this.doc = parent.ownerDocument;
    if (!this.doc.getElementById('bw-ui-style')) {
      const style = this.doc.createElement('style');
      style.id = 'bw-ui-style';
      style.textContent = UI_CSS;
      this.doc.head.appendChild(style);
    }
    this.root = this.doc.createElement('div');
    this.root.className = 'bw-ui';
    this.root.dataset['testid'] = 'ui-root';
    parent.appendChild(this.root);
    const onKey = (event: KeyboardEvent): void => this.onKeyDown(event);
    // Capture phase: a key that is being rebound must not reach the game.
    this.doc.addEventListener('keydown', onKey, true);
    this.cleanup.push(() => this.doc.removeEventListener('keydown', onKey, true));
    const view = this.doc.defaultView;
    if (view && typeof view.ResizeObserver === 'function') {
      const observer = new view.ResizeObserver(() => this.measure());
      observer.observe(parent);
      this.cleanup.push(() => observer.disconnect());
    }
    this.measure();
  }

  /** Sets the size by hand (tests, hosts without a resize observer). */
  setSize(width: number, height: number): void {
    this.manualSize = true;
    this.width = width;
    this.height = height;
    this.relayout();
  }

  private manualSize = false;

  private measure(): void {
    if (this.manualSize) return;
    const width = this.parent.clientWidth;
    const height = this.parent.clientHeight;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.relayout();
  }

  /** The page the layer lives in (the host releases the pointer lock through it). */
  parentDocument(): Document {
    return this.doc;
  }

  /** Whether a key is being rebound (the host should not treat keys as game input then). */
  get capturingKey(): boolean {
    return this.capturing !== null;
  }

  dispose(): void {
    for (const fn of this.cleanup) fn();
    this.root.remove();
    this.instances.clear();
    this.viewDoms.clear();
  }

  // ---------------------------------------------------------------- keyboard

  private onKeyDown(event: KeyboardEvent): void {
    const game = this.game;
    // Only keys pressed in the game view count (not typing in other windows of the editor).
    if (!(event.target instanceof Node) || !this.parent.contains(event.target)) return;
    if (this.capturing) {
      event.preventDefault();
      event.stopPropagation();
      const { player, action } = this.capturing;
      this.capturing = null;
      if (event.code !== 'Escape') this.settings.setBinding(player, action, [event.code]);
      this.refreshKeybindings();
      return;
    }
    if (!game) return;
    const pause = this.settings.values.bindings[1]?.pause ?? ['KeyP'];
    if (event.code === 'Escape' || pause.includes(event.code)) {
      if (game.talking || event.repeat) return;
      event.preventDefault();
      game.setGamePaused(!game.gamePaused);
    }
  }

  private refreshKeybindings(): void {
    for (const instance of this.instances.values()) {
      const visit = (nodes: UiNode[]): void => {
        for (const node of nodes) {
          if (node.element.type === 'keybindings' && this.game) {
            node.update({ game: this.game, player: 1, scale: 1, renderer: this });
          }
          visit(node.children);
        }
      };
      visit(instance.roots);
    }
  }

  /** Starts listening for the next key of an action (the key binding element's buttons). */
  beginCapture(player: 1 | 2, action: keyof BindingOverrides): void {
    this.capturing = { player, action };
    this.refreshKeybindings();
  }

  /** Which action waits for a key, if any. */
  capturingAction(): { player: 1 | 2; action: keyof BindingOverrides } | null {
    return this.capturing;
  }

  // ---------------------------------------------------------------- frame

  /** Brings the layer up to date with the game; call it once per frame. */
  update(frame: UiFrame): void {
    this.game = frame.game;
    this.measure();
    const game = frame.game;
    if (game) this.pollGamepad(game);
    const wanted = new Map<string, { ui: UiData; viewKey: string; player: 1 | 2; rect: Rect }>();
    if (game) {
      const players = frame.views?.players ?? [1];
      const split = frame.views?.split ?? 'vertical';
      const canvases = game.uiCanvases();
      const hudTypes = new Set<string>();
      const add = (
        key: string,
        ui: UiData,
        viewIndex: number,
        player: 1 | 2,
        full: boolean,
      ): void => {
        const rect = full ? this.fullRect() : this.viewRect(viewIndex, players.length, split);
        wanted.set(`${key}|${full ? 'full' : viewIndex}`, {
          ui,
          viewKey: full ? 'full' : String(viewIndex),
          player,
          rect,
        });
      };
      canvases.forEach((canvas) => {
        for (const type of elementTypes(canvas.ui.elements)) hudTypes.add(type);
        const paused = game.gamePaused;
        // A canvas for one player is drawn in that player's view; "all" in every view (own HUD per
        // player); while the game is paused everything is drawn once over the whole screen.
        if (paused || players.length < 2) {
          if (canvas.player === '2' && players.length < 2 && !paused) return;
          add(canvas.key, canvas.ui, 0, canvas.player === '2' ? 2 : 1, true);
        } else {
          players.forEach((player, index) => {
            if (canvas.player === 'all' || canvas.player === String(player)) {
              add(canvas.key, canvas.ui, index, player, false);
            }
          });
        }
      });
      const overlay = builtinOverlay();
      const missing = overlay.elements.filter((element) => !hudTypes.has(element.type));
      if (missing.length > 0) {
        const ui = this.overlayFor(missing);
        players.forEach((player, index) => {
          if (players.length < 2) add('builtin', ui, 0, 1, true);
          else add('builtin', ui, index, player, false);
        });
      }
    }
    this.syncInstances(wanted);
    if (game) {
      for (const [key, instance] of this.instances) {
        const info = wanted.get(key);
        if (!info) continue;
        const scale = canvasScale(
          info.rect.width,
          info.rect.height,
          instance.ui.referenceWidth,
          instance.ui.referenceHeight,
        );
        const context: Context = { game, player: info.player, scale, renderer: this };
        const visit = (nodes: UiNode[]): void => {
          for (const node of nodes) {
            node.update(context);
            visit(node.children);
          }
        };
        visit(instance.roots);
      }
    }
    this.updateNotice(game);
    this.updateLoading(frame.loading ?? null);
  }

  private overlayCache: { key: string; ui: UiData } | null = null;

  /** The built-in overlay with only the elements no canvas provides (same object while unchanged). */
  private overlayFor(missing: readonly UiElement[]): UiData {
    const key = missing.map((element) => element.id).join(',');
    if (this.overlayCache?.key !== key) {
      this.overlayCache = { key, ui: { ...builtinOverlay(), elements: [...missing] } };
    }
    return this.overlayCache.ui;
  }

  private fullRect(): Rect {
    return { x: 0, y: 0, width: this.width, height: this.height };
  }

  /** Rectangle of a split-screen view in CSS pixels, origin at the top left. */
  private viewRect(index: number, count: number, split: 'horizontal' | 'vertical'): Rect {
    const w = this.width;
    const h = this.height;
    if (count < 2) return this.fullRect();
    if (split === 'vertical') {
      const part = Math.floor(w / count);
      return {
        x: index * part,
        y: 0,
        width: index === count - 1 ? w - index * part : part,
        height: h,
      };
    }
    const part = Math.floor(h / count);
    return {
      x: 0,
      y: index * part,
      width: w,
      height: index === count - 1 ? h - index * part : part,
    };
  }

  private syncInstances(
    wanted: Map<string, { ui: UiData; viewKey: string; player: 1 | 2; rect: Rect }>,
  ): void {
    for (const [key, instance] of [...this.instances]) {
      const info = wanted.get(key);
      if (!info || info.ui !== instance.ui) {
        instance.dom.remove();
        this.instances.delete(key);
      }
    }
    for (const [key, info] of wanted) {
      let instance = this.instances.get(key);
      if (!instance) {
        const dom = this.doc.createElement('div');
        dom.className = 'bw-ui-view';
        dom.dataset['testid'] = 'ui-canvas';
        this.root.appendChild(dom);
        instance = { ui: info.ui, dom, roots: [], width: -1, height: -1 };
        for (const element of info.ui.elements) {
          const node = this.build(element);
          instance.roots.push(node);
          dom.appendChild(node.dom);
        }
        this.instances.set(key, instance);
      }
      const { rect } = info;
      const { style } = instance.dom;
      style.left = `${rect.x}px`;
      style.top = `${rect.y}px`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
      if (instance.width !== rect.width || instance.height !== rect.height) {
        instance.width = rect.width;
        instance.height = rect.height;
        const scale = canvasScale(
          rect.width,
          rect.height,
          info.ui.referenceWidth,
          info.ui.referenceHeight,
        );
        this.layoutNodes(
          instance.roots,
          { x: 0, y: 0, width: rect.width, height: rect.height },
          scale,
        );
      }
    }
    // Canvases drawn in order: the wanted map is already sorted back to front.
    for (const key of wanted.keys()) {
      const instance = this.instances.get(key);
      if (instance) this.root.appendChild(instance.dom);
    }
  }

  private relayout(): void {
    for (const instance of this.instances.values()) {
      instance.width = -1;
      instance.height = -1;
    }
  }

  private layoutNodes(nodes: readonly UiNode[], parent: Rect, scale: number): void {
    for (const node of nodes) {
      const rect = layoutRect(parent, node.element, scale);
      const { style } = node.dom;
      style.left = `${rect.x}px`;
      style.top = `${rect.y}px`;
      style.width = `${rect.width}px`;
      style.height = `${rect.height}px`;
      style.fontSize = `${(node.element.fontSize ?? 20) * scale}px`;
      this.layoutNodes(
        node.children,
        { x: 0, y: 0, width: rect.width, height: rect.height },
        scale,
      );
    }
  }

  // ---------------------------------------------------------------- gamepad, notices, loading

  private pollGamepad(game: Game): void {
    const pad = game.input.gamepad(game.input.connectedGamepads()[0] ?? -1);
    const down = !!pad?.buttons[9]?.pressed;
    if (down && !this.padBefore && !game.talking) game.setGamePaused(!game.gamePaused);
    this.padBefore = down;
  }

  private updateNotice(game: Game | null): void {
    const notice = game?.notice;
    if (!notice || !game) {
      this.noticeDom?.remove();
      this.noticeDom = null;
      return;
    }
    if (this.noticeShownAt !== notice.at || !this.noticeDom) {
      if (this.noticeShownAt !== notice.at) this.noticeShownAt = notice.at;
      this.noticeDom?.remove();
      this.noticeDom = this.doc.createElement('div');
      this.noticeDom.className = 'bw-ui-notice';
      this.noticeDom.dataset['testid'] = 'ui-notice';
      this.noticeDom.dataset['key'] = notice.key;
      this.noticeDom.textContent = this.host.strings(`notice.${notice.key}` as UiStringKey);
      this.root.appendChild(this.noticeDom);
      this.noticeStartedAt = this.doc.defaultView?.performance.now() ?? 0;
    }
    const now = this.doc.defaultView?.performance.now() ?? 0;
    if (now - this.noticeStartedAt > NOTICE_MS) {
      this.noticeDom.remove();
      this.noticeDom = null;
    }
  }

  private noticeStartedAt = 0;

  private updateLoading(loading: UiLoading | null): void {
    if (!loading) {
      this.loadingDom?.remove();
      this.loadingDom = null;
      return;
    }
    if (!this.loadingDom) {
      const dom = this.doc.createElement('div');
      dom.className = 'bw-ui-loading';
      dom.dataset['testid'] = 'loading-screen';
      dom.innerHTML =
        '<h2 data-testid="loading-title"></h2><div class="bw-ui-loading-bar"><div class="bw-ui-loading-fill"></div></div><p></p>';
      this.root.appendChild(dom);
      this.loadingDom = dom;
    }
    const dom = this.loadingDom;
    const title = dom.querySelector('h2');
    const fill = dom.querySelector<HTMLElement>('.bw-ui-loading-fill');
    const tip = dom.querySelector('p');
    const text = this.host.strings('loading.title', { name: loading.title });
    if (title && title.textContent !== text) title.textContent = text;
    if (fill) fill.style.width = `${Math.round(loading.progress * 100)}%`;
    const tipText = this.host.strings(`loading.tip.${loading.tip % 3}` as UiStringKey);
    if (tip && tip.textContent !== tipText) tip.textContent = tipText;
  }

  // ---------------------------------------------------------------- elements

  /** Runs a button's actions. */
  run(actions: readonly UiAction[] | undefined): void {
    for (const action of actions ?? []) this.game?.runUiAction(action);
    // The click took the keyboard focus; the game gets it back.
    this.parent.querySelector('canvas')?.focus();
  }

  private build(element: UiElement): UiNode {
    const dom = this.doc.createElement('div');
    dom.className = 'bw-ui-el';
    dom.dataset['type'] = element.type;
    dom.dataset['testid'] = `ui-${element.type}`;
    dom.dataset['name'] = element.name;
    const { style } = dom;
    if (element.background) style.background = element.background;
    if (element.color) style.color = element.color;
    if (element.opacity !== undefined) style.opacity = String(element.opacity);
    style.textAlign = element.align ?? 'center';
    style.justifyContent =
      element.align === 'left' ? 'flex-start' : element.align === 'right' ? 'flex-end' : 'center';
    const node: UiNode = { element, dom, children: [], update: () => undefined };
    const make = this.makers[element.type];
    node.update = make.call(this, node);
    for (const child of element.children ?? []) {
      const childNode = this.build(child);
      node.children.push(childNode);
      dom.appendChild(childNode.dom);
    }
    return node;
  }

  private readonly makers: Record<UiElement['type'], (node: UiNode) => (context: Context) => void> =
    {
      panel: (node) => (context) => this.showIf(node, context),
      text: (node) => this.makeText(node),
      image: (node) => this.makeImage(node),
      bar: (node) => this.makeBar(node),
      button: (node) => this.makeButton(node),
      slider: (node) => this.makeSlider(node),
      toggle: (node) => this.makeToggle(node),
      dropdown: (node) => this.makeDropdown(node),
      hint: (node) => this.makeHint(node),
      crosshair: (node) => {
        node.dom.classList.add('bw-ui-crosshair');
        return () => undefined;
      },
      inventory: (node) => this.makeInventory(node),
      dialog: (node) => this.makeDialog(node),
      keybindings: (node) => this.makeKeybindings(node),
    };

  private showIf(node: UiNode, _context: Context): void {
    node.dom.style.display = node.element.visible === false ? 'none' : '';
  }

  private setText(dom: HTMLElement, text: string): void {
    if (dom.textContent !== text) dom.textContent = text;
  }

  private makeText(node: UiNode): (context: Context) => void {
    return (context) => {
      this.showIf(node, context);
      const { element } = node;
      const template = element.text ?? '';
      const raw = element.bind ? context.game.bindingText(element.bind) : null;
      if (raw !== null && Number.isNaN(Number(raw))) {
        this.setText(node.dom, template.replace(/\{value\}/g, raw));
        return;
      }
      const bound = element.bind ? context.game.bindingValue(element.bind, context.player) : null;
      this.setText(node.dom, formatValue(template, bound?.value ?? 0));
    };
  }

  private makeImage(node: UiNode): (context: Context) => void {
    const img = this.doc.createElement('img');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    const url = node.element.image ? (this.host.imageUrl?.(node.element.image) ?? null) : null;
    if (url) img.src = url;
    node.dom.appendChild(img);
    return (context) => this.showIf(node, context);
  }

  private makeBar(node: UiNode): (context: Context) => void {
    const fill = this.doc.createElement('div');
    fill.className = 'bw-ui-bar-fill';
    fill.style.background = node.element.color ?? '#d33';
    node.dom.style.background = node.element.background ?? 'rgba(0,0,0,0.5)';
    node.dom.style.justifyContent = 'flex-start';
    node.dom.appendChild(fill);
    return (context) => {
      this.showIf(node, context);
      const { element } = node;
      const bound = element.bind ? context.game.bindingValue(element.bind, context.player) : null;
      const max = bound?.max ?? element.max ?? 1;
      const fraction = max > 0 ? Math.min(1, Math.max(0, (bound?.value ?? 0) / max)) : 0;
      const width = `${Math.round(fraction * 1000) / 10}%`;
      if (fill.style.width !== width) fill.style.width = width;
      node.dom.dataset['fraction'] = String(Math.round(fraction * 1000) / 1000);
    };
  }

  private makeButton(node: UiNode): (context: Context) => void {
    const button = this.doc.createElement('button');
    button.className = 'bw-ui-btn';
    button.type = 'button';
    button.textContent = node.element.text ?? '';
    button.style.fontSize = 'inherit';
    button.addEventListener('click', () => this.run(node.element.actions));
    node.dom.appendChild(button);
    return (context) => this.showIf(node, context);
  }

  private makeSlider(node: UiNode): (context: Context) => void {
    const { element } = node;
    const input = this.doc.createElement('input');
    input.type = 'range';
    const setting = isNumericSetting(element.setting) ? element.setting : null;
    const range = setting ? SLIDER_RANGE[setting] : { min: 0, max: 1, step: 0.01 };
    input.min = String(element.min ?? range.min);
    input.max = String(element.max ?? range.max);
    input.step = String(element.step ?? range.step);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (setting) this.settings.set(setting, value);
      else if (element.bind?.kind === 'variable' && this.game) {
        this.game.vars[element.bind.variable] = value;
      }
    });
    node.dom.appendChild(input);
    return (context) => {
      this.showIf(node, context);
      let value = 0;
      if (setting) value = this.settings.get(setting);
      else if (element.bind) value = context.game.bindingValue(element.bind, context.player).value;
      if (this.doc.activeElement !== input && input.value !== String(value))
        input.value = String(value);
    };
  }

  private makeToggle(node: UiNode): (context: Context) => void {
    const { element } = node;
    const label = this.doc.createElement('label');
    const input = this.doc.createElement('input');
    input.type = 'checkbox';
    const text = this.doc.createElement('span');
    text.textContent = element.text ?? '';
    label.append(input, text);
    label.style.display = 'flex';
    label.style.gap = '8px';
    input.addEventListener('change', () => {
      if (element.setting === 'fullscreen') this.settings.set('fullscreen', input.checked);
      else if (element.bind?.kind === 'variable' && this.game) {
        this.game.vars[element.bind.variable] = input.checked;
      }
    });
    node.dom.appendChild(label);
    return (context) => {
      this.showIf(node, context);
      const on =
        element.setting === 'fullscreen'
          ? this.settings.get('fullscreen')
          : element.bind?.kind === 'variable'
            ? Boolean(context.game.vars[element.bind.variable])
            : false;
      if (input.checked !== on) input.checked = on;
    };
  }

  private makeDropdown(node: UiNode): (context: Context) => void {
    const select = this.doc.createElement('select');
    const options: [string, UiStringKey][] = [
      ['', 'graphics.auto'],
      ...QUALITY_NAMES.map((name): [string, UiStringKey] => [name, `graphics.${name}`]),
    ];
    for (const [value, key] of options) {
      const option = this.doc.createElement('option');
      option.value = value;
      option.textContent = this.host.strings(key);
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      this.settings.set('graphicsLevel', isQualityName(select.value) ? select.value : null);
    });
    node.dom.appendChild(select);
    return (context) => {
      this.showIf(node, context);
      const value = this.settings.get('graphicsLevel') ?? '';
      if (this.doc.activeElement !== select && select.value !== value) select.value = value;
    };
  }

  private makeHint(node: UiNode): (context: Context) => void {
    node.dom.classList.add('bw-ui-hint');
    return (context) => {
      const hint = context.game.talking ? null : context.game.interactionHint(context.player);
      node.dom.style.display = hint && node.element.visible !== false ? '' : 'none';
      if (!hint) return;
      const text =
        hint.kind === 'custom'
          ? hint.label
          : this.host.strings(`hint.${hint.kind}` as UiStringKey, { label: hint.label });
      this.setText(node.dom, text);
      node.dom.dataset['kind'] = hint.kind;
      node.dom.dataset['testid'] = 'interaction-hint';
    };
  }

  private makeInventory(node: UiNode): (context: Context) => void {
    const list = this.doc.createElement('div');
    list.className = 'bw-ui-list';
    node.dom.appendChild(list);
    let last = '';
    return (context) => {
      this.showIf(node, context);
      const items = context.game.playerItems(context.player);
      const key = JSON.stringify(items);
      if (key === last) return;
      last = key;
      list.replaceChildren();
      if (items.length === 0) {
        const empty = this.doc.createElement('div');
        empty.textContent = this.host.strings('inventory.empty');
        list.appendChild(empty);
      }
      for (const [name, count] of items) {
        const row = this.doc.createElement('div');
        row.dataset['testid'] = 'ui-inventory-item';
        row.textContent = `${name} × ${count}`;
        list.appendChild(row);
      }
    };
  }

  private makeDialog(node: UiNode): (context: Context) => void {
    const box = this.doc.createElement('div');
    box.className = 'bw-ui-dialog';
    box.dataset['testid'] = 'dialog-box';
    node.dom.appendChild(box);
    node.dom.style.alignItems = 'flex-end';
    let last = '';
    return (context) => {
      const view = context.game.dialogView();
      node.dom.style.display = view && node.element.visible !== false ? '' : 'none';
      const key = JSON.stringify(view);
      if (key === last) return;
      last = key;
      box.replaceChildren();
      if (!view) return;
      if (view.speaker) {
        const speaker = this.doc.createElement('div');
        speaker.className = 'speaker';
        speaker.textContent = view.speaker;
        box.appendChild(speaker);
      }
      const text = this.doc.createElement('div');
      text.className = 'text';
      text.dataset['testid'] = 'dialog-text';
      text.textContent = view.text;
      box.appendChild(text);
      if (view.choices.length === 0) {
        const next = this.doc.createElement('button');
        next.type = 'button';
        next.className = 'selected';
        next.dataset['testid'] = 'dialog-continue';
        next.textContent = this.host.strings('dialog.continue');
        next.addEventListener('click', () => context.game.confirmDialog());
        box.appendChild(next);
        return;
      }
      for (const choice of view.choices) {
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.className = choice.index === view.selected ? 'selected' : '';
        button.dataset['testid'] = `dialog-answer-${choice.index}`;
        button.textContent = `${choice.index + 1}. ${choice.text}`;
        button.addEventListener('click', () => context.game.chooseDialogAnswer(choice.index));
        box.appendChild(button);
      }
    };
  }

  private makeKeybindings(node: UiNode): (context: Context) => void {
    const grid = this.doc.createElement('div');
    grid.className = 'bw-ui-keys';
    node.dom.appendChild(grid);
    return (context) => {
      this.showIf(node, context);
      const bindings = this.settings.values.bindings[context.player];
      const capture = this.capturing;
      const key = JSON.stringify([bindings, capture, context.player]);
      if (grid.dataset['state'] === key) return;
      grid.dataset['state'] = key;
      grid.replaceChildren();
      for (const action of BINDING_ACTIONS) {
        const label = this.doc.createElement('span');
        label.textContent = this.host.strings(`action.${action}` as UiStringKey);
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.dataset['testid'] = `ui-key-${action}`;
        const waiting = capture?.action === action && capture.player === context.player;
        button.className = waiting ? 'capturing' : '';
        button.textContent = waiting
          ? this.host.strings('keys.press')
          : keyLabel(this.currentCode(context.player, action));
        button.addEventListener('click', () => this.beginCapture(context.player, action));
        grid.append(label, button);
      }
    };
  }

  /** The first key of an action with the player's changes applied. */
  private currentCode(player: 1 | 2, action: (typeof BINDING_ACTIONS)[number]): string | undefined {
    const values: SettingsValues = this.settings.values;
    const changed = values.bindings[player]?.[action];
    return changed?.[0] ?? DEFAULT_KEYS[player][action];
  }
}

const DEFAULT_KEYS: Record<1 | 2, Partial<Record<(typeof BINDING_ACTIONS)[number], string>>> = {
  1: keysOf(1),
  2: keysOf(2),
};

function keysOf(player: 1 | 2): Partial<Record<(typeof BINDING_ACTIONS)[number], string>> {
  const bindings = DEFAULT_BINDINGS[player];
  const result: Partial<Record<(typeof BINDING_ACTIONS)[number], string>> = {
    up: bindings.up[0],
    down: bindings.down[0],
    left: bindings.left[0],
    right: bindings.right[0],
  };
  for (const action of Object.keys(bindings.buttons) as ButtonAction[]) {
    result[action] = bindings.buttons[action][0];
  }
  return result;
}
