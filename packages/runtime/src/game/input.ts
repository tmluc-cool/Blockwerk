import { Vector2 } from 'three';
import type { GamepadSnapshot, RawInput } from './actions';

/** Key name for the "any key" option of key blocks. */
export const ANY_KEY = 'any';

/**
 * Normalizes a browser keyboard event to the key names used by blocks: letters upper case
 * (by layout, so the key labeled W is "W"), digits, `Space`, `ArrowUp` …, `Enter`, `Shift`.
 */
export function normalizeKey(key: string): string {
  if (key === ' ' || key === 'Spacebar') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  return key;
}

/** Keyboard, mouse and gamepad state of a running game, advanced once per logic tick. */
export class InputState implements RawInput {
  private readonly down = new Set<string>();
  private readonly codes = new Set<string>();
  private readonly pendingMouse = new Vector2();
  private gamepads: readonly (GamepadSnapshot | null)[] = [];
  /** Mouse movement during the last tick in pixels (+x right, +y down). */
  readonly mouseDelta = new Vector2();
  private readonly pressedQueue = new Set<string>();
  private readonly releasedQueue = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  /** Mouse position in pixels from the center of the game view, +Y up (like Scratch). */
  mouseX = 0;
  mouseY = 0;
  mouseDown = false;

  /**
   * Records a key event from the game view: `key` for key blocks (by layout), `code` for input
   * actions (physical position, like Unity's Input System).
   */
  keyEvent(key: string, isDown: boolean, code?: string): void {
    if (code) {
      if (isDown) this.codes.add(code);
      else this.codes.delete(code);
    }
    const name = normalizeKey(key);
    if (isDown) {
      if (!this.down.has(name)) this.pressedQueue.add(name);
      this.down.add(name);
    } else {
      if (this.down.has(name)) this.releasedQueue.add(name);
      this.down.delete(name);
    }
  }

  /** Records mouse movement in pixels (pointer lock movement or drag). */
  mouseMove(dx: number, dy: number): void {
    this.pendingMouse.x += dx;
    this.pendingMouse.y += dy;
  }

  /** Sets the connected gamepads (read by the host every frame). */
  setGamepads(gamepads: readonly (GamepadSnapshot | null)[]): void {
    this.gamepads = gamepads;
  }

  /** Connected gamepads (indices without a gamepad are skipped). */
  connectedGamepads(): number[] {
    return this.gamepads.flatMap((pad, index) => (pad ? [index] : []));
  }

  isCodeDown(code: string): boolean {
    return this.codes.has(code);
  }

  gamepad(index: number): GamepadSnapshot | null {
    return this.gamepads[index] ?? null;
  }

  /** Releases all keys (e.g. when the game view loses focus). */
  releaseAll(): void {
    for (const key of this.down) this.releasedQueue.add(key);
    this.down.clear();
    this.codes.clear();
    this.mouseDown = false;
  }

  /** Starts a logic tick: key presses and releases since the last tick become visible. */
  beginTick(): void {
    this.pressed = new Set(this.pressedQueue);
    this.released = new Set(this.releasedQueue);
    this.pressedQueue.clear();
    this.releasedQueue.clear();
    this.mouseDelta.copy(this.pendingMouse);
    this.pendingMouse.set(0, 0);
  }

  /** Whether a key is held (`any` for any key). */
  isDown(key: string): boolean {
    return key === ANY_KEY ? this.down.size > 0 : this.down.has(key);
  }

  /** Whether a key went down in this tick. */
  wasPressed(key: string): boolean {
    return key === ANY_KEY ? this.pressed.size > 0 : this.pressed.has(key);
  }

  /** Whether a key went up in this tick. */
  wasReleased(key: string): boolean {
    return key === ANY_KEY ? this.released.size > 0 : this.released.has(key);
  }
}
