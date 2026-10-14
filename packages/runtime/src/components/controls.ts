import { MathUtils, Vector2, Vector3 } from 'three';
import type { GameObject } from '../world/GameObject';
import { abilityRegistry } from './abilities';
import { motorRegistry } from './characterController';
import type { CharacterMotor } from './characterController';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, FieldValues, TickContext } from './defineComponent';

/** Something that happened with an ability. */
export interface ControlEvent {
  readonly ability: 'roll' | 'glide' | 'doubleJump';
  readonly phase: 'started' | 'ended';
}

/** How a control component steers. */
export type ControlMode = 'thirdPerson' | 'firstPerson' | 'topDown' | 'vehicle';

/** Settings of a control that blocks may change at runtime. */
export interface ControlSettings {
  walkSpeed: number;
  runSpeed: number;
  jumpHeight: number;
}

/**
 * What a control is doing, read by the animator, camera behaviors and blocks. Blocks also use it
 * to make the character jump, crouch or stand still.
 */
export interface ControlState {
  readonly mode: ControlMode;
  player: 1 | 2;
  /** Changing a setting here (blocks) overrides the inspector value until the game stops. */
  readonly settings: ControlSettings;
  /** Horizontal speed in m/s (of the last move). */
  readonly speed: number;
  /** Speed relative to the run speed (0..1+), for animation blending. */
  readonly normalizedSpeed: number;
  readonly grounded: boolean;
  running: boolean;
  crouching: boolean;
  /** Rising after a jump. */
  jumping: boolean;
  /** Vertical velocity in m/s (0 on the ground). */
  readonly verticalVelocity: number;
  /** Ticks since the character landed (0 = landed in this tick). */
  ticksSinceLanding: number;
  /** Ticks since the last jump started. */
  ticksSinceJump: number;
  /** Steering is off (block "lock controls"). */
  locked: boolean;
  /** The character is rolling (ability Roll). */
  rolling: boolean;
  /** The character is gliding (ability Glide). */
  gliding: boolean;
  /** Stamina left as a fraction 0..1, `null` without the ability Stamina. */
  stamina: number | null;
  /** Ability events since the last call (the game turns them into "when I roll" events). */
  takeEvents(): ControlEvent[];
  /** Forgets values set by blocks; the component's own values apply again (profile change). */
  clearOverrides(): void;
  /** Makes the character jump as if the jump button was pressed. */
  jump(): void;
  /** Crouches (true) or stands up (false), as long as there is room. */
  setCrouch(crouch: boolean): void;
}

/** Control states by object. */
export const controlRegistry = new WeakMap<object, ControlState>();

type LiveMetrics = 'speed' | 'normalizedSpeed' | 'grounded' | 'verticalVelocity';

/** Adds the movement metrics to a control state, read live from the object's motor. */
function withMetrics(
  object: GameObject,
  settings: ControlSettings,
  state: Omit<ControlState, LiveMetrics>,
): ControlState {
  const motor = (): CharacterMotor | undefined => motorRegistry.get(object);
  const speed = (): number => {
    const velocity = motor()?.actualVelocity;
    return velocity ? Math.hypot(velocity.x, velocity.z) : 0;
  };
  return Object.defineProperties(state, {
    speed: { get: speed, enumerable: true },
    normalizedSpeed: {
      get: () => (settings.runSpeed > 0 ? speed() / settings.runSpeed : 0),
      enumerable: true,
    },
    grounded: { get: () => motor()?.grounded ?? false, enumerable: true },
    verticalVelocity: {
      get: () => {
        const m = motor();
        return !m || m.grounded ? 0 : m.actualVelocity.y;
      },
      enumerable: true,
    },
  }) as ControlState;
}

const playerField = {
  type: 'enum',
  default: '1',
  options: [
    { value: '1', text: { de: 'Spieler 1', en: 'Player 1' } },
    { value: '2', text: { de: 'Spieler 2', en: 'Player 2' } },
  ],
  text: { de: 'Spieler', en: 'Player' },
} as const;

/** Fields shared by the walking controls; defaults give the Unity feel without tuning. */
const WALK_FIELDS = {
  player: playerField,
  walkSpeed: {
    type: 'number',
    default: 2.2,
    min: 0,
    step: 0.1,
    text: { de: 'Laufgeschwindigkeit (m/s)', en: 'Walk Speed' },
  },
  runSpeed: {
    type: 'number',
    default: 5.5,
    min: 0,
    step: 0.1,
    text: { de: 'Renngeschwindigkeit (m/s)', en: 'Sprint Speed' },
  },
  crouchSpeed: {
    type: 'number',
    default: 1.2,
    min: 0,
    step: 0.1,
    text: { de: 'Duckgeschwindigkeit (m/s)', en: 'Crouch Speed' },
  },
  acceleration: {
    type: 'number',
    default: 10,
    min: 0.1,
    step: 0.5,
    text: { de: 'Beschleunigung', en: 'Speed Change Rate' },
  },
  rotationSmoothTime: {
    type: 'number',
    default: 0.12,
    min: 0,
    step: 0.01,
    unit: 'seconds',
    text: { de: 'Drehglättung', en: 'Rotation Smooth Time' },
  },
  jumpHeight: {
    type: 'number',
    default: 1.2,
    min: 0,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Sprunghöhe', en: 'Jump Height' },
  },
  gravity: {
    type: 'number',
    default: 15,
    min: 0,
    step: 0.5,
    text: { de: 'Schwerkraft (m/s²)', en: 'Gravity' },
  },
  airControl: {
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    text: { de: 'Luftsteuerung', en: 'Air Control' },
  },
  coyoteTime: {
    type: 'number',
    default: 0.15,
    min: 0,
    step: 0.01,
    unit: 'seconds',
    group: 'advanced',
    text: { de: 'Gnadenfrist an Kanten', en: 'Coyote Time' },
  },
  jumpBuffer: {
    type: 'number',
    default: 0.15,
    min: 0,
    step: 0.01,
    unit: 'seconds',
    group: 'advanced',
    text: { de: 'Sprung-Puffer', en: 'Jump Buffer' },
  },
  crouchHeight: {
    type: 'number',
    default: 1.1,
    min: 0.1,
    step: 0.05,
    unit: 'meters',
    group: 'advanced',
    text: { de: 'Höhe geduckt', en: 'Crouch Height' },
  },
} as const satisfies FieldDefinitions;

type WalkValues = FieldValues<typeof WALK_FIELDS>;

/** Shortest signed difference between two angles in radians. */
function angleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

/**
 * Critically damped smoothing towards an angle (Unity: Mathf.SmoothDampAngle). Returns the new
 * angle; `velocity` holds the angular speed between calls.
 */
export function smoothDampAngle(
  current: number,
  target: number,
  velocity: { value: number },
  smoothTime: number,
  dt: number,
): number {
  if (smoothTime <= 0) return target;
  const goal = current + angleDelta(current, target);
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - goal;
  const temp = (velocity.value + omega * change) * dt;
  velocity.value = (velocity.value - omega * temp) * exp;
  return goal + (change + temp) * exp;
}

/** The yaw (radians around +Y, 0 = facing +Z) of a camera's view direction. */
function cameraYaw(context: TickContext, player: 1 | 2): number | null {
  const camera = context.world.cameraForPlayer(player);
  if (!camera) return null;
  camera.updateWorldMatrix(true, false);
  const forward = new Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
  if (Math.hypot(forward.x, forward.z) < 1e-4) {
    // Looking straight down: use the camera's up vector instead.
    const up = new Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    return Math.atan2(up.x, up.z);
  }
  return Math.atan2(forward.x, forward.z);
}

/** Whether there is room above to stand up from a crouch. */
function roomToStand(context: TickContext, object: GameObject, motor: CharacterMotor): boolean {
  if (!context.physics) return true;
  const start = object.worldPosition().add(new Vector3(0, motor.height - 0.05, 0));
  const hit = context.physics.raycast(
    start,
    new Vector3(0, 1, 0),
    motor.standingHeight - motor.height + 0.1,
    object,
  );
  return hit === null;
}

/**
 * The walking logic shared by third-person, first-person and top-down controls (SPEC 8.5):
 * smooth acceleration and braking, turning into the walking direction, running, crouching,
 * jumping with jump buffer and coyote time, air control and landing detection.
 */
function walkingControl(object: GameObject, mode: Exclude<ControlMode, 'vehicle'>) {
  let values: WalkValues | null = null;
  const base: ControlSettings = { walkSpeed: 2.2, runSpeed: 5.5, jumpHeight: 1.2 };
  const overrides: Partial<ControlSettings> = {};
  // Blocks change the settings; values from the inspector apply unless a block set them.
  const settings = new Proxy(base, {
    set(target, key, value) {
      if (key !== 'walkSpeed' && key !== 'runSpeed' && key !== 'jumpHeight') return false;
      if (typeof value !== 'number') return false;
      overrides[key] = value;
      target[key] = value;
      return true;
    },
  });
  const horizontal = new Vector2();
  const turnVelocity = { value: 0 };
  let verticalVelocity = 0;
  let coyote = 0;
  let buffered = 0;
  let wasGrounded = true;
  let crouchRequest: boolean | null = null;
  const events: ControlEvent[] = [];
  let airJumpsUsed = 0;
  let rollTime = 0;
  let rollCooldown = 0;
  const rollDirection = new Vector2();
  let staminaLeft: number | null = null;
  let staminaDelay = 0;
  let exhausted = false;
  const state = withMetrics(object, settings, {
    mode,
    player: 1,
    settings,
    running: false,
    crouching: false,
    jumping: false,
    ticksSinceLanding: 1000,
    ticksSinceJump: 1000,
    locked: false,
    rolling: false,
    gliding: false,
    stamina: null,
    takeEvents() {
      return events.splice(0);
    },
    clearOverrides() {
      for (const key of Object.keys(overrides)) Reflect.deleteProperty(overrides, key);
      if (values) {
        base.walkSpeed = values.walkSpeed;
        base.runSpeed = values.runSpeed;
        base.jumpHeight = values.jumpHeight;
      }
    },
    jump() {
      buffered = values?.jumpBuffer ?? 0.15;
      if (buffered <= 0) buffered = 1 / 60;
    },
    setCrouch(crouch) {
      crouchRequest = crouch;
    },
  });
  controlRegistry.set(object, state);

  const tick = (context: TickContext): void => {
    const v = values;
    const motor = motorRegistry.get(object);
    if (!v || !motor) return;
    const dt = context.dt;
    const input = context.input(state.player);
    const locked = state.locked;
    const move = locked ? new Vector2() : input.move();
    const look = locked ? new Vector2() : input.look();
    const grounded = motor.grounded;
    // Landing and leaving the ground.
    if (grounded && !wasGrounded) state.ticksSinceLanding = 0;
    else state.ticksSinceLanding += 1;
    state.ticksSinceJump += 1;
    wasGrounded = grounded;
    coyote = grounded ? v.coyoteTime : Math.max(0, coyote - dt);
    buffered = Math.max(0, buffered - dt);
    if (!locked && input.wasPressed('jump')) state.jump();
    const abilities = abilityRegistry.get(object);
    if (grounded) airJumpsUsed = 0;

    // Roll: a quick dodge in the facing direction; low and not steerable meanwhile.
    rollCooldown = Math.max(0, rollCooldown - dt);
    const rollConfig = abilities?.roll;
    if (
      rollConfig &&
      !locked &&
      grounded &&
      rollTime <= 0 &&
      rollCooldown <= 0 &&
      input.wasPressed('roll')
    ) {
      rollTime = rollConfig.seconds;
      const yawNow = object.object3d.rotation.y;
      rollDirection.set(Math.sin(yawNow), Math.cos(yawNow));
      state.rolling = true;
      events.push({ ability: 'roll', phase: 'started' });
    }
    if (state.rolling && (rollTime <= 0 || !rollConfig)) {
      state.rolling = false;
      rollTime = 0;
      rollCooldown = rollConfig?.cooldown ?? 0;
      events.push({ ability: 'roll', phase: 'ended' });
    }

    // Crouch: held button or block request; stand up only with room above.
    const wantsCrouch = state.rolling || (crouchRequest ?? (!locked && input.isHeld('crouch')));
    if (wantsCrouch && !state.crouching) {
      state.crouching = true;
      motor.setHeight(v.crouchHeight);
    } else if (!wantsCrouch && state.crouching && roomToStand(context, object, motor)) {
      state.crouching = false;
      motor.setHeight(motor.standingHeight);
    }

    // Turning: first person turns with the view, the others into the walking direction.
    let yaw = object.object3d.rotation.y;
    if (mode === 'firstPerson') yaw -= MathUtils.degToRad(look.x);
    const reference = mode === 'firstPerson' ? yaw : (cameraYaw(context, state.player) ?? 0);
    // Input relative to the camera: forward is away from it, right is to its right.
    const forward = new Vector2(Math.sin(reference), Math.cos(reference));
    const right = new Vector2(-forward.y, forward.x);
    const direction = forward.multiplyScalar(move.y).add(right.multiplyScalar(move.x));
    const amount = Math.min(1, move.length());
    const staminaConfig = abilities?.stamina;
    if (staminaConfig) {
      staminaLeft ??= staminaConfig.max;
      staminaLeft = Math.min(staminaLeft, staminaConfig.max);
      if (exhausted && staminaLeft >= staminaConfig.max * 0.25) exhausted = false;
    } else {
      staminaLeft = null;
      exhausted = false;
    }
    state.running =
      !state.crouching && !state.rolling && amount > 0.1 && input.isHeld('sprint') && !exhausted;
    if (staminaConfig && staminaLeft !== null) {
      if (state.running) {
        staminaLeft = Math.max(0, staminaLeft - staminaConfig.drain * dt);
        staminaDelay = staminaConfig.delay;
        if (staminaLeft <= 0) exhausted = true;
      } else {
        staminaDelay = Math.max(0, staminaDelay - dt);
        if (staminaDelay <= 0) {
          staminaLeft = Math.min(staminaConfig.max, staminaLeft + staminaConfig.regen * dt);
        }
      }
      state.stamina = staminaLeft / staminaConfig.max;
    } else {
      state.stamina = null;
    }
    const topSpeed = state.crouching
      ? v.crouchSpeed
      : state.running
        ? settings.runSpeed
        : settings.walkSpeed;
    const target =
      direction.lengthSq() > 0
        ? direction.normalize().multiplyScalar(topSpeed * amount)
        : new Vector2();
    // Smooth speed change (Unity: Lerp with SpeedChangeRate); less grip in the air.
    const rate = v.acceleration * (grounded ? 1 : v.airControl);
    if (state.rolling && rollConfig) {
      horizontal.copy(rollDirection).multiplyScalar(rollConfig.speed);
      rollTime -= dt;
    } else {
      horizontal.lerp(target, Math.min(1, rate * dt));
      if (horizontal.length() < 0.01 && target.lengthSq() === 0) horizontal.set(0, 0);
    }
    if (!state.rolling && mode !== 'firstPerson' && target.lengthSq() > 0) {
      const wanted = Math.atan2(target.x, target.y);
      yaw = smoothDampAngle(yaw, wanted, turnVelocity, v.rotationSmoothTime, dt);
    }
    object.object3d.rotation.y = yaw;

    // Vertical: jump, gravity, sticking to the ground.
    const gravity = v.gravity;
    if (buffered > 0 && (grounded || coyote > 0) && !state.crouching) {
      // Half a step of gravity less, so the discrete arc peaks at exactly the jump height.
      const launch = Math.sqrt(2 * gravity * Math.max(0, settings.jumpHeight));
      verticalVelocity = Math.max(0, launch - (gravity * dt) / 2);
      buffered = 0;
      coyote = 0;
      state.jumping = true;
      state.ticksSinceJump = 0;
    } else if (
      buffered > 0 &&
      !grounded &&
      abilities?.doubleJump &&
      airJumpsUsed < abilities.doubleJump.jumps &&
      !state.crouching &&
      !state.rolling
    ) {
      // Further jumps in the air (ability Double Jump).
      const launch = Math.sqrt(2 * gravity * Math.max(0, abilities.doubleJump.height));
      verticalVelocity = Math.max(0, launch - (gravity * dt) / 2);
      airJumpsUsed += 1;
      buffered = 0;
      state.jumping = true;
      state.ticksSinceJump = 0;
      events.push({ ability: 'doubleJump', phase: 'started' });
    } else if (grounded && verticalVelocity <= 0) {
      verticalVelocity = -0.5;
      state.jumping = false;
    } else {
      if (motor.hitCeiling && verticalVelocity > 0) verticalVelocity = 0;
      verticalVelocity = Math.max(-50, verticalVelocity - gravity * dt);
      if (verticalVelocity <= 0) state.jumping = false;
    }
    // Glide: holding jump while falling limits the fall speed.
    const glideConfig = abilities?.glide;
    const glidingNow =
      !!glideConfig &&
      !grounded &&
      !locked &&
      input.isHeld('jump') &&
      verticalVelocity < -glideConfig.fallSpeed;
    if (glidingNow && glideConfig) verticalVelocity = -glideConfig.fallSpeed;
    if (glidingNow !== state.gliding) {
      state.gliding = glidingNow;
      events.push({ ability: 'glide', phase: glidingNow ? 'started' : 'ended' });
    }
    motor.velocity.set(horizontal.x, verticalVelocity, horizontal.y);
  };

  return {
    state,
    apply(next: WalkValues) {
      values = next;
      state.player = next.player === '2' ? 2 : 1;
      base.walkSpeed = overrides.walkSpeed ?? next.walkSpeed;
      base.runSpeed = overrides.runSpeed ?? next.runSpeed;
      base.jumpHeight = overrides.jumpHeight ?? next.jumpHeight;
    },
    tick,
  };
}

function defineWalkingControl(
  type: string,
  mode: Exclude<ControlMode, 'vehicle'>,
  text: { de: string; en: string },
  docs: { de: string; en: string },
  keywords: { de: string[]; en: string[] },
) {
  return defineComponent({
    type,
    category: 'gameplay',
    unique: true,
    text,
    docs,
    keywords,
    fields: WALK_FIELDS,
    create({ object }) {
      const control = walkingControl(object, mode);
      return {
        apply(values) {
          control.apply(values);
        },
        tick(stage, context) {
          if (stage === 'control') control.tick(context);
        },
        destroy() {
          if (controlRegistry.get(object) === control.state) controlRegistry.delete(object);
        },
      };
    },
  });
}

/** Third-Person-Steuerung: moves relative to the camera and turns into the walking direction. */
export const thirdPersonControl = defineWalkingControl(
  'thirdPersonControl',
  'thirdPerson',
  { de: 'Third-Person-Steuerung', en: 'Third Person Controller' },
  {
    de: 'Steuert die Figur relativ zur Kamera: Bewegen, Rennen, Ducken, Springen. Braucht einen Charakter-Controller.',
    en: 'Moves the character relative to the camera: walk, sprint, crouch, jump. Needs a Character Controller.',
  },
  {
    de: ['spieler', 'steuerung', 'laufen', 'springen'],
    en: ['player', 'controller', 'walk', 'jump'],
  },
);

/** First-Person-Steuerung: the view turns the character, movement is relative to it. */
export const firstPersonControl = defineWalkingControl(
  'firstPersonControl',
  'firstPerson',
  { de: 'First-Person-Steuerung', en: 'First Person Controller' },
  {
    de: 'Ego-Sicht: Maus oder rechter Stick drehen die Figur, Bewegen ist relativ zur Blickrichtung. Braucht einen Charakter-Controller.',
    en: 'First person: mouse or right stick turn the character, movement follows the view. Needs a Character Controller.',
  },
  { de: ['ego', 'spieler', 'steuerung'], en: ['fps', 'player', 'controller'] },
);

/** Draufsicht-Steuerung: like third person, for cameras from above. */
export const topDownControl = defineWalkingControl(
  'topDownControl',
  'topDown',
  { de: 'Draufsicht-Steuerung', en: 'Top Down Controller' },
  {
    de: 'Für Spiele von oben: Bewegen in Bildschirmrichtung, die Figur dreht sich in Laufrichtung. Braucht einen Charakter-Controller.',
    en: 'For games seen from above: move in screen directions, the character turns into the walking direction. Needs a Character Controller.',
  },
  { de: ['draufsicht', 'oben', 'spieler'], en: ['top down', 'player', 'controller'] },
);

const VEHICLE_FIELDS = {
  player: playerField,
  maxSpeed: {
    type: 'number',
    default: 12,
    min: 0,
    step: 0.5,
    text: { de: 'Höchstgeschwindigkeit (m/s)', en: 'Max Speed' },
  },
  acceleration: {
    type: 'number',
    default: 6,
    min: 0,
    step: 0.5,
    text: { de: 'Beschleunigung (m/s²)', en: 'Acceleration' },
  },
  braking: {
    type: 'number',
    default: 14,
    min: 0,
    step: 0.5,
    text: { de: 'Bremsen (m/s²)', en: 'Braking' },
  },
  reverseSpeed: {
    type: 'number',
    default: 4,
    min: 0,
    step: 0.5,
    text: { de: 'Rückwärts (m/s)', en: 'Reverse Speed' },
  },
  turnSpeed: {
    type: 'number',
    default: 90,
    min: 0,
    step: 5,
    unit: 'degrees',
    text: { de: 'Lenkung (°/s)', en: 'Turn Speed' },
  },
  gravity: {
    type: 'number',
    default: 15,
    min: 0,
    step: 0.5,
    text: { de: 'Schwerkraft (m/s²)', en: 'Gravity' },
  },
} as const satisfies FieldDefinitions;

/** Fahrzeug-Steuerung: gas, brake, reverse and steering like an arcade car. */
export const vehicleControl = defineComponent({
  type: 'vehicleControl',
  category: 'gameplay',
  unique: true,
  text: { de: 'Fahrzeug-Steuerung', en: 'Vehicle Controller' },
  docs: {
    de: 'Fährt wie ein Spielzeugauto: vorwärts Gas, rückwärts Bremse und Rückwärtsgang, links/rechts lenken, Rennen ist Turbo. Braucht einen Charakter-Controller.',
    en: 'Drives like a toy car: forward accelerates, back brakes and reverses, left/right steer, sprint is turbo. Needs a Character Controller.',
  },
  keywords: { de: ['auto', 'fahren', 'fahrzeug'], en: ['car', 'drive', 'vehicle'] },
  fields: VEHICLE_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof VEHICLE_FIELDS> | null = null;
    let speed = 0;
    let verticalVelocity = 0;
    const settings: ControlSettings = { walkSpeed: 12, runSpeed: 18, jumpHeight: 0 };
    const state = withMetrics(object, settings, {
      mode: 'vehicle',
      player: 1,
      settings,
      running: false,
      crouching: false,
      jumping: false,
      ticksSinceLanding: 1000,
      ticksSinceJump: 1000,
      locked: false,
      rolling: false,
      gliding: false,
      stamina: null,
      takeEvents: () => [],
      clearOverrides() {},
      jump() {},
      setCrouch() {},
    });
    controlRegistry.set(object, state);
    return {
      apply(next) {
        values = next;
        state.player = next.player === '2' ? 2 : 1;
        settings.walkSpeed = next.maxSpeed;
        settings.runSpeed = next.maxSpeed * 1.5;
      },
      tick(stage, context) {
        if (stage !== 'control') return;
        const motor = motorRegistry.get(object);
        const v = values;
        if (!motor || !v) return;
        const dt = context.dt;
        const input = context.input(state.player);
        const move = state.locked ? new Vector2() : input.move();
        const turbo = !state.locked && input.isHeld('sprint');
        const top = turbo ? settings.runSpeed : settings.walkSpeed;
        const { acceleration, braking, reverseSpeed: reverse } = v;
        if (move.y > 0.05) speed = Math.min(top * move.y, speed + acceleration * dt);
        else if (move.y < -0.05) {
          speed =
            speed > 0
              ? Math.max(0, speed - braking * dt)
              : Math.max(-reverse, speed - acceleration * dt);
        } else {
          speed -= Math.sign(speed) * Math.min(Math.abs(speed), (acceleration / 2) * dt);
        }
        // Steering works while moving, reversed when driving backwards.
        const steer = MathUtils.degToRad(v.turnSpeed);
        const grip = Math.min(1, Math.abs(speed) / 3) * Math.sign(speed || 1);
        object.object3d.rotation.y -= move.x * steer * grip * dt;
        const yaw = object.object3d.rotation.y;
        if (motor.grounded && verticalVelocity <= 0) verticalVelocity = -2;
        else verticalVelocity = Math.max(-50, verticalVelocity - v.gravity * dt);
        motor.velocity.set(Math.sin(yaw) * speed, verticalVelocity, Math.cos(yaw) * speed);
        state.running = turbo;
      },
      destroy() {
        if (controlRegistry.get(object) === state) controlRegistry.delete(object);
      },
    };
  },
});
