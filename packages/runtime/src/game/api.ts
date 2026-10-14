import type { Vector3 } from 'three';
import type { GameObject, VariableValue } from '../world/GameObject';

/**
 * Reference to an object in a block field: `self`, `object:<id>`, `tag:<name>`, `any`,
 * or `mouse` where the block allows it.
 */
export type ObjectRef = string;

/** Easing of the glide block. */
export type Easing = 'linear' | 'smooth' | 'spring';

/** Properties readable with "[x] of [object]". */
export type ObjectProperty = 'x' | 'y' | 'z' | 'heading' | 'size';

/** Math functions of the "[abs] of ( )" block. */
export type MathFunction =
  'abs' | 'floor' | 'ceiling' | 'sqrt' | 'sin' | 'cos' | 'tan' | 'ln' | 'exp';

/** Scope of a block-script variable. */
export type VariableScope = 'object' | 'game';

/**
 * Everything compiled block scripts can use, passed to every script as `game`. Angles are in
 * degrees, distances in meters, times in seconds. Values coming from blocks are converted
 * like in Scratch (text "5" counts as number 5, invalid numbers as 0).
 */
export interface GameApi {
  /** Seconds since the game started (logic time, affected by slow motion and pause). */
  readonly time: number;
  /** Game-scoped variables by ID. */
  readonly vars: Record<string, VariableValue>;
  /** Seconds since start or since the last timer reset (Scratch: timer). */
  readonly timer: number;
  readonly mouseX: number;
  readonly mouseY: number;
  readonly mouseDown: boolean;

  num(value: unknown): number;
  str(value: unknown): string;
  bool(value: unknown): boolean;
  /** Scratch comparison: numeric if both are numbers, otherwise case-insensitive text. */
  compare(a: unknown, b: unknown): number;
  mod(a: number, b: number): number;
  mathFunction(name: MathFunction, value: number): number;
  /** Random number; whole numbers if both limits are whole numbers. */
  random(from: number, to: number): number;
  letterOf(index: number, text: string): string;
  contains(text: string, part: string): boolean;

  /** Waits for some seconds (use with `yield*`). */
  wait(seconds: number): Generator<void, void, void>;
  /** Moves over time to an object or point (use with `yield*`). */
  glideTo(
    self: GameObject,
    target: ObjectRef | readonly [number, number, number],
    seconds: number,
    easing: Easing,
  ): Generator<void, void, void>;

  keyDown(key: string): boolean;
  find(self: GameObject, ref: ObjectRef): GameObject | null;
  touching(self: GameObject, ref: ObjectRef): boolean;
  distanceTo(self: GameObject, ref: ObjectRef): number;
  propertyOf(self: GameObject, ref: ObjectRef, property: ObjectProperty): number;
  goTo(self: GameObject, ref: ObjectRef): void;
  lookAt(self: GameObject, ref: ObjectRef): void;
  /** World position of the mouse on the ground plane at the object's height. */
  mousePoint(self: GameObject): Vector3 | null;

  setColor(self: GameObject, color: string): void;
  setVisible(self: GameObject, visible: boolean): void;
  setSizePercent(self: GameObject, percent: number): void;
  setActive(self: GameObject, ref: ObjectRef, active: boolean): void;
  clone(self: GameObject, ref: ObjectRef): void;
  /** Creates an instance of a prefab (`prefab:<asset ID>`) at an object's position. */
  spawn(self: GameObject, prefab: string, at: ObjectRef): void;
  /** Destroys an object at the end of the tick. Returns `true` if it is the caller itself. */
  destroy(self: GameObject, ref: ObjectRef): boolean;

  resetTimer(): void;
  /** Stops all scripts of the game. */
  stopAll(): void;
  /** Stops all other scripts of the object. */
  stopOtherScripts(self: GameObject): void;

  /** Shows or hides an on-screen display of a variable (Scratch: show variable). */
  showVariable(
    self: GameObject,
    scope: VariableScope,
    id: string,
    name: string,
    visible: boolean,
  ): void;
}
