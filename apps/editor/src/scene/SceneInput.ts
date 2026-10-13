import type { Tool } from '../state/editor';
import type { FlyInput, SceneCamera } from './SceneCamera';

/** Callbacks from the input handler to the viewport. */
export interface SceneInputCallbacks {
  /** The camera changed; render a new frame. */
  invalidate(): void;
  /** Left click without dragging, in element-relative CSS pixels. */
  click(x: number, y: number): void;
  /** Currently active toolbar tool. */
  tool(): Tool;
  /** Fly mode started or ended. */
  flyingChanged(flying: boolean): void;
}

type DragMode = 'none' | 'fly' | 'orbit' | 'pan' | 'zoom' | 'click';

const CLICK_TOLERANCE = 4;
const FLY_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);

/**
 * Unity-style scene navigation:
 * right mouse + WASD/QE fly (Shift faster, wheel changes speed), Alt + left orbit,
 * Alt + right zoom, middle mouse or hand tool pan, wheel zoom.
 */
export class SceneInput {
  private mode: DragMode = 'none';
  private lastX = 0;
  private lastY = 0;
  private startX = 0;
  private startY = 0;
  private pointerId = -1;
  private readonly keys = new Set<string>();
  private keyWindow: Window | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly camera: SceneCamera,
    private readonly callbacks: SceneInputCallbacks,
  ) {
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('lostpointercapture', this.onLostCapture);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  /** Whether fly mode is active (right mouse button held). */
  get flying(): boolean {
    return this.mode === 'fly';
  }

  /** Current WASD/QE state as fly input. */
  flyInput(): FlyInput {
    const axis = (plus: string, minus: string): number =>
      (this.keys.has(plus) ? 1 : 0) - (this.keys.has(minus) ? 1 : 0);
    return {
      x: axis('KeyD', 'KeyA'),
      y: axis('KeyE', 'KeyQ'),
      z: axis('KeyW', 'KeyS'),
      fast: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  dispose(): void {
    this.endDrag();
    const element = this.element;
    element.removeEventListener('pointerdown', this.onPointerDown);
    element.removeEventListener('pointermove', this.onPointerMove);
    element.removeEventListener('pointerup', this.onPointerUp);
    element.removeEventListener('pointercancel', this.onPointerUp);
    element.removeEventListener('lostpointercapture', this.onLostCapture);
    element.removeEventListener('wheel', this.onWheel);
    element.removeEventListener('contextmenu', this.onContextMenu);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.mode !== 'none') return;
    let mode: DragMode = 'none';
    if (event.button === 2) mode = event.altKey ? 'zoom' : 'fly';
    else if (event.button === 1) mode = 'pan';
    else if (event.button === 0) {
      if (event.altKey) mode = 'orbit';
      else if (this.callbacks.tool() === 'hand') mode = 'pan';
      else mode = 'click';
    }
    if (mode === 'none') return;
    event.preventDefault();
    this.element.focus({ preventScroll: true });
    this.mode = mode;
    this.pointerId = event.pointerId;
    this.lastX = this.startX = event.clientX;
    this.lastY = this.startY = event.clientY;
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events may not support capture; dragging still works while over the element.
    }
    if (mode === 'fly') this.startFlying();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.mode === 'none' || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    if (dx === 0 && dy === 0) return;
    switch (this.mode) {
      case 'fly':
        this.camera.look(dx, dy);
        break;
      case 'orbit':
        this.camera.orbit(dx, dy);
        break;
      case 'pan':
        this.camera.pan(dx, dy, this.element.clientHeight);
        break;
      case 'zoom':
        this.camera.zoom((dy - dx) * 2);
        break;
      case 'click':
        return;
    }
    this.callbacks.invalidate();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.mode === 'none' || event.pointerId !== this.pointerId) return;
    const wasClick =
      this.mode === 'click' &&
      Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < CLICK_TOLERANCE;
    const rect = this.element.getBoundingClientRect();
    this.endDrag();
    if (wasClick) this.callbacks.click(event.clientX - rect.left, event.clientY - rect.top);
  };

  private readonly onLostCapture = (): void => {
    this.endDrag();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    const delta = event.deltaY * scale;
    if (this.mode === 'fly') this.camera.adjustSpeed(delta);
    else this.camera.zoom(delta);
    this.callbacks.invalidate();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!FLY_KEYS.has(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    this.keys.add(event.code);
    this.callbacks.invalidate();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.keys.clear();
    this.endDrag();
  };

  private startFlying(): void {
    const view = this.element.ownerDocument.defaultView;
    if (!view) return;
    this.keyWindow = view;
    view.addEventListener('keydown', this.onKeyDown, true);
    view.addEventListener('keyup', this.onKeyUp, true);
    view.addEventListener('blur', this.onBlur);
    this.callbacks.flyingChanged(true);
  }

  private endDrag(): void {
    const wasFlying = this.mode === 'fly';
    if (this.pointerId >= 0 && this.element.hasPointerCapture(this.pointerId)) {
      this.element.releasePointerCapture(this.pointerId);
    }
    this.mode = 'none';
    this.pointerId = -1;
    if (this.keyWindow) {
      this.keyWindow.removeEventListener('keydown', this.onKeyDown, true);
      this.keyWindow.removeEventListener('keyup', this.onKeyUp, true);
      this.keyWindow.removeEventListener('blur', this.onBlur);
      this.keyWindow = null;
    }
    this.keys.clear();
    if (wasFlying) this.callbacks.flyingChanged(false);
  }
}
