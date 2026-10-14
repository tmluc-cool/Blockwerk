import { Vector2 } from 'three';

/** Input actions (SPEC 8.10, like Unity's Input System). */
export const ACTIONS = [
  'move',
  'look',
  'jump',
  'sprint',
  'crouch',
  'interact',
  'attack',
  'pause',
] as const;

/** An input action. */
export type ActionName = (typeof ACTIONS)[number];

/** Button actions (all but the axes `move` and `look`). */
export type ButtonAction = Exclude<ActionName, 'move' | 'look'>;

/** A gamepad as the host reads it (Gamepad API, standard mapping). */
export interface GamepadSnapshot {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** Keyboard and gamepad bindings of a player. Keys are `KeyboardEvent.code` values. */
export interface PlayerBindings {
  readonly up: readonly string[];
  readonly down: readonly string[];
  readonly left: readonly string[];
  readonly right: readonly string[];
  /** Keys that turn the view (players without a mouse). */
  readonly lookLeft: readonly string[];
  readonly lookRight: readonly string[];
  readonly lookUp: readonly string[];
  readonly lookDown: readonly string[];
  readonly buttons: Readonly<Record<ButtonAction, readonly string[]>>;
  /** Whether the mouse turns the view and left click attacks. */
  readonly mouse: boolean;
}

/** Gamepad buttons per action (standard mapping: 0 A, 1 B, 2 X, 3 Y, 4 LB, 9 Start, 10 L3). */
export const GAMEPAD_BUTTONS: Readonly<Record<ButtonAction, readonly number[]>> = {
  jump: [0],
  sprint: [4, 10],
  crouch: [1],
  interact: [3],
  attack: [2, 7],
  pause: [9],
};

/** Default bindings: player 1 WASD + mouse, player 2 arrow keys + number pad. */
export const DEFAULT_BINDINGS: Readonly<Record<1 | 2, PlayerBindings>> = {
  1: {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    lookLeft: [],
    lookRight: [],
    lookUp: [],
    lookDown: [],
    buttons: {
      jump: ['Space'],
      sprint: ['ShiftLeft'],
      crouch: ['KeyC', 'ControlLeft'],
      interact: ['KeyE'],
      attack: ['KeyF'],
      pause: ['KeyP', 'Escape'],
    },
    mouse: true,
  },
  2: {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    lookLeft: ['Numpad4'],
    lookRight: ['Numpad6'],
    lookUp: ['Numpad8'],
    lookDown: ['Numpad2'],
    buttons: {
      jump: ['Numpad0'],
      sprint: ['ShiftRight'],
      crouch: ['NumpadDecimal'],
      interact: ['NumpadEnter'],
      attack: ['NumpadAdd'],
      pause: ['NumpadMultiply'],
    },
    mouse: false,
  },
};

/** Mouse look in degrees per pixel. */
export const MOUSE_SENSITIVITY = 0.15;
/** Stick and key look in degrees per second at full deflection. */
export const STICK_LOOK_SPEED = 180;
/** Stick values below this count as zero. */
const DEAD_ZONE = 0.15;

function deadZone(value: number): number {
  if (Math.abs(value) < DEAD_ZONE) return 0;
  return Math.sign(value) * ((Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE));
}

/** Raw input of a running game: physical keys, mouse movement and gamepads. */
export interface RawInput {
  isCodeDown(code: string): boolean;
  /** Mouse movement since the last tick in pixels (+x right, +y down). */
  readonly mouseDelta: Vector2;
  /** Mouse wheel since the last tick in notches (+ = zoom out). */
  readonly wheelDelta: number;
  readonly mouseDown: boolean;
  gamepad(index: number): GamepadSnapshot | null;
}

/**
 * The input actions of one player for the current tick (SPEC 8.10): `move` and `look` as axes,
 * the other actions as buttons with held / pressed / released. Keyboard and gamepad are merged.
 */
export class PlayerInput {
  private held = new Set<ButtonAction>();
  private before = new Set<ButtonAction>();
  private readonly moveAxis = new Vector2();
  private readonly lookAxis = new Vector2();
  private zoomAxis = 0;
  /** Whether a gamepad was used last (e.g. for hints). */
  usingGamepad = false;
  /** Locked input (block "lock controls"): all actions read as idle. */
  locked = false;

  constructor(
    readonly player: 1 | 2,
    private bindings: PlayerBindings = DEFAULT_BINDINGS[player],
  ) {}

  /** Replaces the bindings (project settings). */
  setBindings(bindings: PlayerBindings): void {
    this.bindings = bindings;
  }

  /** Reads the raw input for a new tick; `gamepad` is this player's gamepad index or `null`. */
  update(raw: RawInput, gamepadIndex: number | null, dt: number): void {
    const b = this.bindings;
    const any = (codes: readonly string[]): boolean => codes.some((code) => raw.isCodeDown(code));
    const axis = (minus: readonly string[], plus: readonly string[]): number =>
      (any(plus) ? 1 : 0) - (any(minus) ? 1 : 0);
    this.moveAxis.set(axis(b.left, b.right), axis(b.down, b.up));
    this.lookAxis.set(
      axis(b.lookLeft, b.lookRight) * STICK_LOOK_SPEED * dt,
      axis(b.lookDown, b.lookUp) * STICK_LOOK_SPEED * dt,
    );
    this.zoomAxis = 0;
    if (b.mouse) {
      this.lookAxis.x += raw.mouseDelta.x * MOUSE_SENSITIVITY;
      this.lookAxis.y -= raw.mouseDelta.y * MOUSE_SENSITIVITY;
      this.zoomAxis += raw.wheelDelta;
    }
    const next = new Set<ButtonAction>();
    for (const action of Object.keys(b.buttons) as ButtonAction[]) {
      if (any(b.buttons[action])) next.add(action);
    }
    if (b.mouse && raw.mouseDown) next.add('attack');
    const pad = gamepadIndex === null ? null : raw.gamepad(gamepadIndex);
    if (pad) {
      const lx = deadZone(pad.axes[0] ?? 0);
      const ly = deadZone(pad.axes[1] ?? 0);
      const rx = deadZone(pad.axes[2] ?? 0);
      const ry = deadZone(pad.axes[3] ?? 0);
      const used = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0;
      if (Math.hypot(lx, ly) > this.moveAxis.length()) this.moveAxis.set(lx, -ly);
      this.lookAxis.x += rx * STICK_LOOK_SPEED * dt;
      this.lookAxis.y -= ry * STICK_LOOK_SPEED * dt;
      let pressedAny = false;
      for (const action of Object.keys(GAMEPAD_BUTTONS) as ButtonAction[]) {
        if (GAMEPAD_BUTTONS[action].some((index) => pad.buttons[index]?.pressed)) {
          next.add(action);
          pressedAny = true;
        }
      }
      // D-pad up and down zoom (about four notches per second).
      const dpad = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
      this.zoomAxis += dpad * 4 * dt;
      if (used || pressedAny) this.usingGamepad = true;
    }
    if (this.moveAxis.lengthSq() > 1) this.moveAxis.normalize();
    if (this.locked) {
      this.moveAxis.set(0, 0);
      this.lookAxis.set(0, 0);
      this.zoomAxis = 0;
      next.clear();
    }
    this.before = this.held;
    this.held = next;
  }

  /** Movement axis: x right, y forward, length up to 1. */
  move(): Vector2 {
    return this.moveAxis.clone();
  }

  /** View turn of this tick in degrees: x right, y up. */
  look(): Vector2 {
    return this.lookAxis.clone();
  }

  /** Camera zoom of this tick in mouse-wheel notches (+ = further away). */
  zoom(): number {
    return this.zoomAxis;
  }

  /** Whether a button action is held. */
  isHeld(action: ButtonAction): boolean {
    return this.held.has(action);
  }

  /** Whether a button action started in this tick. */
  wasPressed(action: ButtonAction): boolean {
    return this.held.has(action) && !this.before.has(action);
  }

  /** Whether a button action ended in this tick. */
  wasReleased(action: ButtonAction): boolean {
    return !this.held.has(action) && this.before.has(action);
  }
}
