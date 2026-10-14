import { Quaternion, Vector3 } from 'three';
import { animatorRegistry } from '../components/animator';
import { cameraRegistry } from '../components/camera';
import type { CameraEntry } from '../components/camera';
import { cameraBehaviorRegistry } from '../components/cameraBehaviors';
import { abilityRegistry, ABILITY_NAMES } from '../components/abilities';
import { parseAttachments, parseList } from '../components/lists';
import { applyMovementProfile, isProfileName } from '../character/movement';
import { controlRegistry } from '../components/controls';
import { resolveValues } from '../components/defineComponent';
import type { ControlSettings, ControlState } from '../components/controls';
import type { Physics } from '../physics/Physics';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import type { ObjectRef } from './api';

/** What the gameplay blocks (player, camera, animation, physics) need from the game. */
export interface GameplayContext {
  readonly world: World;
  readonly physics: Physics | null;
  find(self: GameObject, ref: ObjectRef): GameObject | null;
}

/** Directions of the "push" block, relative to the object's facing direction. */
export type PushDirection = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down';

/** The control component of an object (or of its parents), if it has one. */
function controlOf(self: GameObject): ControlState | null {
  for (let current: GameObject | null = self; current; current = current.parent) {
    const control = controlRegistry.get(current);
    if (control) return control;
  }
  return null;
}

// ------------------------------------------------------------------ player

/** Changes a movement setting of the object's control (walk speed, run speed, jump height). */
export function setControlValue(
  self: GameObject,
  setting: keyof ControlSettings,
  value: number,
): void {
  const control = controlOf(self);
  if (control) control.settings[setting] = Math.max(0, value);
}

/** Makes the object jump as if the jump button was pressed. */
export function jump(self: GameObject): void {
  controlOf(self)?.jump();
}

/** Crouches or stands up. */
export function crouch(self: GameObject, on: boolean): void {
  controlOf(self)?.setCrouch(on);
}

/** Locks or unlocks the steering of the object's control. */
export function lockControls(self: GameObject, locked: boolean): void {
  const control = controlOf(self);
  if (control) control.locked = locked;
}

/** Whether the object stands on the ground. */
export function onGround(self: GameObject): boolean {
  return controlOf(self)?.grounded ?? false;
}

/** Whether the object is sprinting. */
export function isRunning(self: GameObject): boolean {
  return controlOf(self)?.running ?? false;
}

/** Horizontal speed in m/s. */
export function moveSpeed(self: GameObject): number {
  return controlOf(self)?.speed ?? 0;
}

// ------------------------------------------------------------------ camera

/** The camera that shows what the object controls (player 1 unless the control says 2). */
function cameraOf(context: GameplayContext, self: GameObject): CameraEntry | null {
  const own = cameraRegistry.get(self);
  if (own) return own;
  const player = controlOf(self)?.player ?? 1;
  return context.world.cameraEntryForPlayer(player);
}

/** Makes one camera the active one for its player: all other cameras of that player turn off. */
function activateCamera(context: GameplayContext, target: GameObject): void {
  const entry = cameraRegistry.get(target);
  if (!entry) return;
  for (const object of context.world.allObjects()) {
    const other = cameraRegistry.get(object);
    if (other && other !== entry && other.player === entry.player) other.enabled = false;
  }
  entry.enabled = true;
}

/** Switches to the camera with the given behavior (`thirdPerson`, `firstPerson`, `topDown` …). */
export function switchCamera(context: GameplayContext, view: string): void {
  for (const object of context.world.allObjects()) {
    const behaviors = cameraBehaviorRegistry.get(object);
    if (behaviors?.some((behavior) => behavior.mode === view)) {
      activateCamera(context, object);
      return;
    }
  }
}

/** Switches to the camera on another object. */
export function switchCameraTo(context: GameplayContext, self: GameObject, ref: ObjectRef): void {
  const target = context.find(self, ref);
  if (target) activateCamera(context, target);
}

/** Sets the distance of the active camera's behavior (third person, top down, side, shared). */
export function setCameraDistance(
  context: GameplayContext,
  self: GameObject,
  distance: number,
): void {
  const entry = cameraOf(context, self);
  if (!entry) return;
  for (const object of context.world.allObjects()) {
    if (cameraRegistry.get(object) !== entry) continue;
    for (const behavior of cameraBehaviorRegistry.get(object) ?? []) {
      if (behavior.distance > 0) behavior.distance = distance;
    }
  }
}

/** Shakes the active camera. */
export function shakeCamera(
  context: GameplayContext,
  self: GameObject,
  strength: number,
  seconds: number,
): void {
  cameraOf(context, self)?.shake(strength, seconds);
}

/** Changes the active camera's field of view smoothly. */
export function setFieldOfView(
  context: GameplayContext,
  self: GameObject,
  fov: number,
  seconds: number,
): void {
  cameraOf(context, self)?.animateFov(fov, seconds);
}

/** Plays the camera path on another object (and makes its camera the active one). */
export function playCameraPath(context: GameplayContext, self: GameObject, ref: ObjectRef): void {
  const target = context.find(self, ref);
  if (!target) return;
  const path = cameraBehaviorRegistry.get(target)?.find((behavior) => behavior.mode === 'path');
  if (!path) return;
  activateCamera(context, target);
  path.play();
}

// ------------------------------------------------------------------ animation

/** Plays a standard state (`wave`) or a clip by name on the object's animator. */
export function playAnimation(
  self: GameObject,
  name: string,
  mode: 'once' | 'loop',
  fade: number,
): void {
  animatorRegistry.get(self)?.play(name, { once: mode === 'once', fade: Math.max(0, fade) });
}

// ------------------------------------------------------------------ physics

const DIRECTIONS: Readonly<Record<PushDirection, readonly [number, number, number]>> = {
  forward: [0, 0, 1],
  backward: [0, 0, -1],
  left: [1, 0, 0],
  right: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
};

/** The direction in the world, relative to the object's facing direction. */
function worldDirection(self: GameObject, direction: PushDirection): Vector3 {
  const [x, y, z] = DIRECTIONS[direction];
  return new Vector3(x, y, z).applyQuaternion(self.object3d.getWorldQuaternion(new Quaternion()));
}

/** Pushes the object with an impulse (N·s) in a direction relative to its facing direction. */
export function push(
  context: GameplayContext,
  self: GameObject,
  force: number,
  direction: PushDirection,
): void {
  context.physics?.applyImpulse(self, worldDirection(self, direction).multiplyScalar(force));
}

/** Sets the velocity of the object's rigidbody in m/s (world space). */
export function setVelocity(
  context: GameplayContext,
  self: GameObject,
  x: number,
  y: number,
  z: number,
): void {
  context.physics?.setVelocity(self, new Vector3(x, y, z));
}

/** Sets the scene gravity as acceleration towards the ground in m/s². */
export function setGravity(context: GameplayContext, value: number): void {
  context.physics?.setGravity([0, -value, 0]);
}

/** Changes the body type of the object. */
export function setBodyType(
  context: GameplayContext,
  self: GameObject,
  type: 'static' | 'dynamic' | 'kinematic',
): void {
  context.physics?.setBodyType(self, type);
}

/** What is straight ahead within some meters: the name of the object, or empty text. */
export function whatIsAhead(context: GameplayContext, self: GameObject, meters: number): string {
  const hit = context.physics?.raycast(
    self.worldPosition().add(new Vector3(0, 0.5, 0)),
    worldDirection(self, 'forward'),
    Math.max(0, meters),
    self,
  );
  return hit?.object?.name ?? '';
}

/** Distance to what is straight ahead, or `meters` if nothing is in the way. */
export function distanceAhead(context: GameplayContext, self: GameObject, meters: number): number {
  const hit = context.physics?.raycast(
    self.worldPosition().add(new Vector3(0, 0.5, 0)),
    worldDirection(self, 'forward'),
    Math.max(0, meters),
    self,
  );
  return hit ? hit.distance : meters;
}

// ------------------------------------------------------------------ character (SPEC 5.10)

/** Changes the values of the object's Figur component and applies them. */
function updateFigure(
  self: GameObject,
  change: (values: Readonly<Record<string, unknown>>) => Record<string, unknown>,
): void {
  const component = self.findComponent('character');
  if (!component) return;
  component.values = { ...component.values, ...change(component.values) } as never;
  component.behavior.apply(resolveValues(component.definition, component.values));
}

/** Hangs an item (`library:…` model) on an attachment point, replacing what hung there. */
export function attachItem(self: GameObject, item: string, point: string): void {
  updateFigure(self, (values) => {
    const kept = parseAttachments(String(values['attachments'] ?? '')).filter(
      ([, at]) => at !== point,
    );
    return { attachments: [...kept, [item, point]].map(([a, b]) => `${a}@${b}`).join(';') };
  });
}

/** Takes what hangs on an attachment point off. */
export function detachItem(self: GameObject, point: string): void {
  updateFigure(self, (values) => ({
    attachments: parseAttachments(String(values['attachments'] ?? ''))
      .filter(([, at]) => at !== point)
      .map(([a, b]) => `${a}@${b}`)
      .join(';'),
  }));
}

/** Splits a `;` list into names. */
function names(text: unknown): string[] {
  return String(text ?? '')
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Shows or hides a part of the figure's model by its name (gear parts are hidden until shown). */
export function setPartVisible(self: GameObject, part: string, visible: boolean): void {
  updateFigure(self, (values) => {
    const hidden = names(values['hiddenParts']).filter((name) => name !== part);
    const shown = names(values['shownGear']).filter((name) => name !== part);
    if (visible) shown.push(part);
    else hidden.push(part);
    return { hiddenParts: hidden.join(';'), shownGear: shown.join(';') };
  });
}

/** Swaps one part for another (a hat for a helmet): hides the first, shows the second. */
export function switchPart(self: GameObject, from: string, to: string): void {
  updateFigure(self, (values) => {
    const hidden = names(values['hiddenParts']).filter((name) => name !== to);
    const shown = names(values['shownGear']).filter((name) => name !== from && name !== to);
    if (from && !hidden.includes(from)) hidden.push(from);
    shown.push(to);
    return { hiddenParts: hidden.join(';'), shownGear: shown.join(';') };
  });
}

/** Tints a part of the figure (an empty color removes the tint). */
export function setPartColor(self: GameObject, part: string, color: string): void {
  updateFigure(self, (values) => {
    const tints = parseList(String(values['tints'] ?? '')).filter(([name]) => name !== part);
    if (color) tints.push([part, color]);
    return { tints: tints.map(([a, b]) => `${a}=${b}`).join(';') };
  });
}

/** Switches the movement profile (all movement values change at once). */
export function setProfile(self: GameObject, name: string): void {
  if (!isProfileName(name)) return;
  applyMovementProfile(self, name);
  updateFigure(self, () => ({ profile: name }));
}

/** Turns an ability on or off. */
export function enableAbility(self: GameObject, name: string, on: boolean): void {
  const component = self.findComponent(name);
  if (!component || !(ABILITY_NAMES as readonly string[]).includes(name)) return;
  component.enabled = on;
  component.behavior.setEnabled?.(on);
}

/** Whether the object has an ability that is turned on. */
export function hasAbility(self: GameObject, name: string): boolean {
  const abilities = abilityRegistry.get(self) as Record<string, unknown> | undefined;
  return abilities?.[name] !== undefined;
}

/** Sets the stamina in percent. */
export function setStamina(self: GameObject, percent: number): void {
  controlOf(self)?.setStamina(percent / 100);
}

/** Stamina in percent (100 without the ability). */
export function staminaPercent(self: GameObject): number {
  const stamina = controlOf(self)?.stamina;
  return stamina === null || stamina === undefined ? 100 : Math.round(stamina * 1000) / 10;
}
