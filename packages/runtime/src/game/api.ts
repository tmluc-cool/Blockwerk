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

  // Player (SPEC 8.5): act on the object's control component.
  setControlValue(
    self: GameObject,
    setting: 'walkSpeed' | 'runSpeed' | 'jumpHeight',
    value: number,
  ): void;
  jump(self: GameObject): void;
  crouch(self: GameObject, on: boolean): void;
  lockControls(self: GameObject, locked: boolean): void;
  onGround(self: GameObject): boolean;
  isRunning(self: GameObject): boolean;
  moveSpeed(self: GameObject): number;
  /** Puts the object at another object and stops its movement. */
  teleport(self: GameObject, ref: ObjectRef): void;

  // Character (SPEC 5.10)
  attach(self: GameObject, item: string, point: string): void;
  detach(self: GameObject, point: string): void;
  setPartVisible(self: GameObject, part: string, visible: boolean): void;
  switchPart(self: GameObject, from: string, to: string): void;
  setPartColor(self: GameObject, part: string, color: string): void;
  setProfile(self: GameObject, name: string): void;
  enableAbility(self: GameObject, name: string, on: boolean): void;
  hasAbility(self: GameObject, name: string): boolean;
  setStamina(self: GameObject, percent: number): void;
  staminaPercent(self: GameObject): number;

  // Camera (SPEC 8.6)
  // Environment and graphics (SPEC 8.9, 8.3)
  setTimeOfDay(hours: number): void;
  timeOfDay(): number;
  setTimeSpeed(factor: number): void;
  setWeather(type: string, seconds: number): void;
  weather(): string;
  setWind(speed: number, direction: number): void;
  setFogDensity(percent: number): void;
  setSunBrightness(percent: number): void;
  setLightEnabled(self: GameObject, ref: ObjectRef, on: boolean): void;
  setLightColor(self: GameObject, ref: ObjectRef, color: string): void;
  playSound(self: GameObject, sound: string, where: string): void;
  playMusic(sound: string): void;
  crossfadeMusic(sound: string, seconds: number): void;
  stopAllSounds(): void;
  setVolume(bus: string, percent: number): void;
  spawnEffect(self: GameObject, effect: string, at: ObjectRef): void;
  startParticles(self: GameObject, ref: ObjectRef): void;
  stopParticles(self: GameObject, ref: ObjectRef): void;
  setGraphicsLevel(level: string): void;
  graphicsLevel(): string;

  switchCamera(view: string): void;
  switchCameraTo(self: GameObject, ref: ObjectRef): void;
  setCameraDistance(self: GameObject, distance: number): void;
  shakeCamera(self: GameObject, strength: number, seconds: number): void;
  setFieldOfView(self: GameObject, fov: number, seconds: number): void;
  playCameraPath(self: GameObject, ref: ObjectRef): void;

  // Messages, timers and loops over objects (Appendix A, phase 5)
  /** Sends a message to `self`, `all`, `tag:<name>` or `object:<id>`; delivered next tick. */
  sendMessage(self: GameObject, message: string, target: ObjectRef): void;
  /** Starts (or restarts) a timer of this object; "When timer [x] runs out" fires after `seconds`. */
  startTimer(self: GameObject, name: string, seconds: number): void;
  /** The active objects a reference names (a tag: all with it; `all`/`any`: every object). */
  objectsMatching(self: GameObject, ref: ObjectRef): GameObject[];
  /** Makes `object` the one the reference `loop` names in the running script. */
  setLoopObject(object: GameObject): void;

  // Items, inventory, health and combat (SPEC 8.13)
  addItem(self: GameObject, target: ObjectRef, item: string, count: number): void;
  removeItem(self: GameObject, target: ObjectRef, item: string, count: number): boolean;
  hasItem(self: GameObject, target: ObjectRef, item: string): boolean;
  itemCount(self: GameObject, target: ObjectRef, item: string): number;
  /** Opens, closes or flips a door, chest or switch (blocks ignore keys). */
  operateThing(self: GameObject, target: ObjectRef, action: 'open' | 'close' | 'toggle'): void;
  /** Lets `self` pick up a pickup object. */
  pickUp(self: GameObject, target: ObjectRef): void;
  damageObject(self: GameObject, target: ObjectRef, amount: number): void;
  healObject(self: GameObject, target: ObjectRef, amount: number): void;
  healthOfObject(self: GameObject, target: ObjectRef): number;

  // NPCs and navigation (SPEC 8.8)
  /** Walks to an object over the navigation mesh and waits until it arrived (use with `yield*`). */
  navigateTo(self: GameObject, target: ObjectRef): Generator<void, void, void>;
  followTarget(self: GameObject, target: ObjectRef, distance: number): void;
  fleeFrom(self: GameObject, target: ObjectRef): void;
  wanderAround(self: GameObject, radius: number): void;
  patrolRoute(self: GameObject, route: ObjectRef): void;
  stopWalking(self: GameObject): void;
  npcState(self: GameObject): string;
  setNpcState(self: GameObject, state: string): void;
  sees(self: GameObject, target: ObjectRef): boolean;
  hears(self: GameObject, target: ObjectRef): boolean;

  // Animation (SPEC 8.7)
  playAnimation(self: GameObject, name: string, mode: 'once' | 'loop', fade: number): void;

  // Physics (SPEC 8.4)
  push(
    self: GameObject,
    force: number,
    direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down',
  ): void;
  setVelocity(self: GameObject, x: number, y: number, z: number): void;
  setGravity(value: number): void;
  setBodyType(self: GameObject, type: 'static' | 'dynamic' | 'kinematic'): void;
  /** Name of the object straight ahead within some meters, or empty text. */
  whatIsAhead(self: GameObject, meters: number): string;
  distanceAhead(self: GameObject, meters: number): number;

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
