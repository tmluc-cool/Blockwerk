import { CatmullRomCurve3, Euler, MathUtils, Quaternion, Vector3 } from 'three';
import { setWorldPose } from '../physics/Physics';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import { cameraRegistry } from './camera';
import { controlRegistry } from './controls';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, FieldValues, TickContext } from './defineComponent';

/** Kinds of camera behaviors (block "switch camera to"). */
export type CameraMode =
  'thirdPerson' | 'firstPerson' | 'topDown' | 'side' | 'fixed' | 'path' | 'shared';

/** What blocks can do with a camera behavior. */
export interface CameraBehaviorHandle {
  readonly mode: CameraMode;
  /** Distance to the target in meters (third person, top down, side, shared). */
  distance: number;
  /** Plays the camera path from the start (path behavior). */
  play(): void;
  /** Whether the behavior currently moves the camera. */
  readonly enabled: boolean;
}

/** Camera behaviors by object (an object may have several, one enabled). */
export const cameraBehaviorRegistry = new WeakMap<object, CameraBehaviorHandle[]>();

function register(object: GameObject, handle: CameraBehaviorHandle): () => void {
  const list = cameraBehaviorRegistry.get(object) ?? [];
  list.push(handle);
  cameraBehaviorRegistry.set(object, list);
  return () => {
    const current = cameraBehaviorRegistry.get(object);
    if (!current) return;
    const index = current.indexOf(handle);
    if (index >= 0) current.splice(index, 1);
  };
}

/** The player whose input turns a camera: from its camera component (`all` means player 1). */
function cameraPlayer(object: GameObject): 1 | 2 {
  return cameraRegistry.get(object)?.player === '2' ? 2 : 1;
}

/** The object controlled by a player (first object with a control component for them). */
export function playerObject(world: World, player: 1 | 2): GameObject | null {
  for (const object of world.allObjects()) {
    if (!object.activeInHierarchy || object.destroyed) continue;
    const control = controlRegistry.get(object);
    // NPCs walked by a Nav Agent have a control state too, but they are nobody's player.
    if (control && control.mode !== 'agent' && control.player === player) return object;
  }
  return null;
}

/** Resolves a target field: the referenced object, or the camera's player if empty. */
function resolveTarget(
  context: TickContext,
  self: GameObject,
  id: string | null,
): GameObject | null {
  if (id) {
    const object = context.world.getObject(id);
    return object && !object.destroyed ? object : null;
  }
  return playerObject(context.world, cameraPlayer(self));
}

/** Rotation looking along yaw (around +Y, 0 = +Z) and pitch (positive = looking down). */
function viewRotation(yaw: number, pitch: number): Quaternion {
  return new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ'));
}

/** Unit view direction for yaw and pitch. */
function viewDirection(yaw: number, pitch: number): Vector3 {
  return new Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );
}

/** Yaw and pitch that look along a direction. */
function anglesOf(direction: Vector3): { yaw: number; pitch: number } {
  return {
    yaw: Math.atan2(direction.x, direction.z),
    pitch: Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)),
  };
}

/** The facing yaw of an object in the world. */
function facingYaw(object: GameObject): number {
  const forward = new Vector3(0, 0, 1).applyQuaternion(
    object.object3d.getWorldQuaternion(new Quaternion()),
  );
  return Math.atan2(forward.x, forward.z);
}

/** Frame-rate independent smoothing factor for a smoothing time in seconds. */
function damp(smoothTime: number, dt: number): number {
  return smoothTime <= 0 ? 1 : 1 - Math.exp(-dt / smoothTime);
}

const targetField = {
  type: 'object',
  default: null,
  text: { de: 'Ziel (leer = Spieler)', en: 'Target (empty = player)' },
} as const;

const smoothingField = {
  type: 'number',
  default: 0.1,
  min: 0,
  step: 0.01,
  unit: 'seconds',
  text: { de: 'Glättung', en: 'Damping' },
} as const;

const sensitivityFields = {
  sensitivity: {
    type: 'number',
    default: 1,
    min: 0.05,
    step: 0.05,
    text: { de: 'Empfindlichkeit', en: 'Sensitivity' },
  },
  invertY: { type: 'boolean', default: false, text: { de: 'Y umkehren', en: 'Invert Y' } },
} as const satisfies FieldDefinitions;

/** Base for camera behaviors: registration, enabled state and the camera tick. */
function behavior(
  object: GameObject,
  mode: CameraMode,
  tick: (context: TickContext) => void,
  extra: Partial<Pick<CameraBehaviorHandle, 'play'>> & {
    distance?: () => number;
    setDistance?: (d: number) => void;
  } = {},
) {
  let enabled = true;
  const handle: CameraBehaviorHandle = {
    mode,
    get distance() {
      return extra.distance?.() ?? 0;
    },
    set distance(value: number) {
      extra.setDistance?.(value);
    },
    play: extra.play ?? (() => undefined),
    get enabled() {
      return enabled;
    },
  };
  const unregister = register(object, handle);
  return {
    setEnabled(next: boolean) {
      enabled = next;
    },
    tick(stage: string, context: TickContext) {
      if (stage === 'camera' && enabled) tick(context);
    },
    destroy() {
      unregister();
    },
  };
}

const THIRD_PERSON_CAMERA_FIELDS = {
  target: targetField,
  distance: {
    type: 'number',
    default: 4,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Abstand', en: 'Distance' },
  },
  minDistance: {
    type: 'number',
    default: 1.5,
    min: 0.2,
    step: 0.1,
    unit: 'meters',
    group: 'zoom',
    text: { de: 'Kleinster Abstand', en: 'Min Distance' },
  },
  maxDistance: {
    type: 'number',
    default: 8,
    min: 0.5,
    step: 0.1,
    unit: 'meters',
    group: 'zoom',
    text: { de: 'Grösster Abstand', en: 'Max Distance' },
  },
  height: {
    type: 'number',
    default: 1.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Höhe', en: 'Height' },
  },
  shoulder: {
    type: 'number',
    default: 0.4,
    step: 0.05,
    unit: 'meters',
    text: { de: 'Schulter-Versatz', en: 'Shoulder Offset' },
  },
  damping: smoothingField,
  ...sensitivityFields,
  minPitch: {
    type: 'number',
    default: -35,
    min: -89,
    max: 89,
    step: 1,
    unit: 'degrees',
    group: 'advanced',
    text: { de: 'Kleinster Neigungswinkel', en: 'Bottom Clamp' },
  },
  maxPitch: {
    type: 'number',
    default: 70,
    min: -89,
    max: 89,
    step: 1,
    unit: 'degrees',
    group: 'advanced',
    text: { de: 'Grösster Neigungswinkel', en: 'Top Clamp' },
  },
  avoidWalls: {
    type: 'boolean',
    default: true,
    text: { de: 'Wänden ausweichen', en: 'Avoid Obstacles' },
  },
  cameraRadius: {
    type: 'number',
    default: 0.2,
    min: 0.01,
    step: 0.05,
    unit: 'meters',
    group: 'advanced',
    text: { de: 'Kamera-Radius', en: 'Camera Radius' },
  },
  sprintFov: {
    type: 'number',
    default: 8,
    min: 0,
    step: 1,
    unit: 'degrees',
    text: { de: 'Sichtfeld beim Rennen', en: 'Sprint FOV Boost' },
  },
} as const satisfies FieldDefinitions;

/**
 * Third-Person-Kamera (Unity: Cinemachine Third Person Follow / FreeLook): orbits the target with
 * mouse or right stick, follows with a little lag, zooms with the mouse wheel, moves in front of
 * walls and widens the view while sprinting.
 */
export const thirdPersonCamera = defineComponent({
  type: 'thirdPersonCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'Third-Person-Kamera', en: 'Third Person Camera' },
  docs: {
    de: 'Kamera-Verhalten: kreist hinter der Figur (Maus oder rechter Stick), folgt mit leichter Verzögerung, zoomt mit dem Mausrad und weicht Wänden aus. Gehört an ein Objekt mit Kamera.',
    en: 'Camera behavior: orbits behind the character (mouse or right stick), follows with a slight lag, zooms with the mouse wheel and avoids walls. Goes on an object with a Camera.',
  },
  keywords: { de: ['kamera', 'folgen', 'orbit'], en: ['camera', 'follow', 'orbit', 'cinemachine'] },
  fields: THIRD_PERSON_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof THIRD_PERSON_CAMERA_FIELDS> | null = null;
    let yaw = 0;
    let pitch = MathUtils.degToRad(12);
    let zoom = 4;
    let current = 4;
    let started = false;
    const pivot = new Vector3();
    const apply = (next: FieldValues<typeof THIRD_PERSON_CAMERA_FIELDS>): void => {
      if (!values || values.distance !== next.distance) zoom = next.distance;
      values = next;
    };
    const base = behavior(
      object,
      'thirdPerson',
      (context) => {
        const v = values;
        const target = v && resolveTarget(context, object, v.target);
        if (!v || !target) return;
        const dt = context.dt;
        const input = context.input(cameraPlayer(object));
        const goal = target.worldPosition().add(new Vector3(0, v.height, 0));
        if (!started) {
          started = true;
          yaw = facingYaw(target);
          pivot.copy(goal);
          current = zoom;
        }
        const look = input.look();
        yaw -= MathUtils.degToRad(look.x * v.sensitivity);
        pitch -= MathUtils.degToRad(look.y * v.sensitivity) * (v.invertY ? -1 : 1);
        pitch = MathUtils.clamp(
          pitch,
          MathUtils.degToRad(v.minPitch),
          MathUtils.degToRad(v.maxPitch),
        );
        zoom = MathUtils.clamp(
          zoom + input.zoom() * 0.5,
          v.minDistance,
          Math.max(v.minDistance, v.maxDistance),
        );
        pivot.lerp(goal, damp(v.damping, dt));
        const direction = viewDirection(yaw, pitch);
        const right = new Vector3(-Math.cos(yaw), 0, Math.sin(yaw));
        const origin = pivot.clone().addScaledVector(right, v.shoulder);
        // Walls: pull in at once, ease back out.
        let allowed = zoom;
        if (v.avoidWalls && context.physics) {
          const end = origin.clone().addScaledVector(direction, -zoom);
          allowed = Math.max(
            0.1,
            context.physics.sphereCast(origin, end, v.cameraRadius, [target, object]),
          );
        }
        current = allowed < current ? allowed : current + (allowed - current) * damp(0.3, dt);
        setWorldPose(object, origin.addScaledVector(direction, -current), viewRotation(yaw, pitch));
        const entry = cameraRegistry.get(object);
        if (entry) {
          const running = controlRegistry.get(target)?.running ?? false;
          entry.fovBoost += ((running ? v.sprintFov : 0) - entry.fovBoost) * damp(0.25, dt);
        }
      },
      {
        distance: () => zoom,
        setDistance: (d) => {
          zoom = Math.max(0.2, d);
        },
      },
    );
    return { ...base, apply };
  },
});

const FIRST_PERSON_CAMERA_FIELDS = {
  target: targetField,
  eyeHeight: {
    type: 'number',
    default: 1.6,
    step: 0.05,
    unit: 'meters',
    text: { de: 'Augenhöhe', en: 'Eye Height' },
  },
  ...sensitivityFields,
  minPitch: {
    type: 'number',
    default: -80,
    min: -89,
    max: 89,
    step: 1,
    unit: 'degrees',
    group: 'advanced',
    text: { de: 'Kleinster Neigungswinkel', en: 'Bottom Clamp' },
  },
  maxPitch: {
    type: 'number',
    default: 80,
    min: -89,
    max: 89,
    step: 1,
    unit: 'degrees',
    group: 'advanced',
    text: { de: 'Grösster Neigungswinkel', en: 'Top Clamp' },
  },
  sprintFov: {
    type: 'number',
    default: 5,
    min: 0,
    step: 1,
    unit: 'degrees',
    text: { de: 'Sichtfeld beim Rennen', en: 'Sprint FOV Boost' },
  },
} as const satisfies FieldDefinitions;

/** First-Person-Kamera: sits at eye height, the view tilts with mouse or right stick. */
export const firstPersonCamera = defineComponent({
  type: 'firstPersonCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'First-Person-Kamera', en: 'First Person Camera' },
  docs: {
    de: 'Kamera-Verhalten: Sicht aus den Augen der Figur. Hoch und runter schauen mit Maus oder rechtem Stick, links und rechts dreht die Figur (First-Person-Steuerung).',
    en: 'Camera behavior: view from the eyes of the character. Look up and down with mouse or right stick; left and right turn the character (First Person Controller).',
  },
  keywords: { de: ['kamera', 'ego', 'augen'], en: ['camera', 'fps', 'eyes'] },
  fields: FIRST_PERSON_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof FIRST_PERSON_CAMERA_FIELDS> | null = null;
    let pitch = 0;
    let ownYaw: number | null = null;
    const base = behavior(object, 'firstPerson', (context) => {
      const v = values;
      const target = v && resolveTarget(context, object, v.target);
      if (!v || !target) return;
      const look = context.input(cameraPlayer(object)).look();
      pitch -= MathUtils.degToRad(look.y * v.sensitivity) * (v.invertY ? -1 : 1);
      pitch = MathUtils.clamp(
        pitch,
        MathUtils.degToRad(-v.maxPitch),
        MathUtils.degToRad(-v.minPitch),
      );
      // The first-person control turns the character; without it the camera turns itself.
      const control = controlRegistry.get(target);
      let yaw = facingYaw(target);
      if (control?.mode !== 'firstPerson') {
        ownYaw = (ownYaw ?? yaw) - MathUtils.degToRad(look.x * v.sensitivity);
        yaw = ownYaw;
      }
      const eye = target.worldPosition().add(new Vector3(0, v.eyeHeight, 0));
      setWorldPose(object, eye, viewRotation(yaw, pitch));
      const entry = cameraRegistry.get(object);
      if (entry) {
        entry.fovBoost +=
          ((control?.running ? v.sprintFov : 0) - entry.fovBoost) * damp(0.25, context.dt);
      }
    });
    return {
      ...base,
      apply(next) {
        values = next;
      },
    };
  },
});

const TOP_DOWN_CAMERA_FIELDS = {
  target: targetField,
  distance: {
    type: 'number',
    default: 14,
    min: 1,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Abstand', en: 'Distance' },
  },
  angle: {
    type: 'number',
    default: 60,
    min: 10,
    max: 90,
    step: 1,
    unit: 'degrees',
    text: { de: 'Neigung', en: 'Angle' },
  },
  direction: {
    type: 'number',
    default: 0,
    step: 5,
    unit: 'degrees',
    text: { de: 'Blickrichtung', en: 'Heading' },
  },
  damping: { ...smoothingField, default: 0.15 },
} as const satisfies FieldDefinitions;

/** Draufsicht-Kamera: follows from above at a fixed angle. */
export const topDownCamera = defineComponent({
  type: 'topDownCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'Draufsicht-Kamera', en: 'Top Down Camera' },
  docs: {
    de: 'Kamera-Verhalten: folgt dem Ziel von schräg oben, ohne sich zu drehen.',
    en: 'Camera behavior: follows the target from above at an angle, without turning.',
  },
  keywords: { de: ['kamera', 'oben', 'draufsicht'], en: ['camera', 'top down', 'isometric'] },
  fields: TOP_DOWN_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof TOP_DOWN_CAMERA_FIELDS> | null = null;
    let distance = 14;
    let pivot: Vector3 | null = null;
    const base = behavior(
      object,
      'topDown',
      (context) => {
        const v = values;
        const target = v && resolveTarget(context, object, v.target);
        if (!v || !target) return;
        const goal = target.worldPosition();
        pivot = pivot ? pivot.lerp(goal, damp(v.damping, context.dt)) : goal;
        const yaw = MathUtils.degToRad(v.direction);
        const pitch = MathUtils.degToRad(Math.min(89.9, v.angle));
        const position = pivot.clone().addScaledVector(viewDirection(yaw, pitch), -distance);
        setWorldPose(object, position, viewRotation(yaw, pitch));
      },
      { distance: () => distance, setDistance: (d) => (distance = Math.max(0.5, d)) },
    );
    return {
      ...base,
      apply(next) {
        if (!values || values.distance !== next.distance) distance = next.distance;
        values = next;
      },
    };
  },
});

const SIDE_CAMERA_FIELDS = {
  target: targetField,
  distance: {
    type: 'number',
    default: 10,
    min: 1,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Abstand', en: 'Distance' },
  },
  height: {
    type: 'number',
    default: 1.5,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Höhe', en: 'Height' },
  },
  followHeight: {
    type: 'boolean',
    default: true,
    text: { de: 'Höhe folgen', en: 'Follow Height' },
  },
  damping: { ...smoothingField, default: 0.15 },
} as const satisfies FieldDefinitions;

/** Seitenansicht-Kamera: looks along +Z at the target, for platformers running along X. */
export const sideCamera = defineComponent({
  type: 'sideCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'Seitenansicht-Kamera', en: 'Side View Camera' },
  docs: {
    de: 'Kamera-Verhalten: zeigt das Ziel von der Seite (Blick entlang +Z) wie in einem Jump-and-Run.',
    en: 'Camera behavior: shows the target from the side (looking along +Z) like a platformer.',
  },
  keywords: {
    de: ['kamera', 'seite', 'jump and run'],
    en: ['camera', 'side', 'platformer', '2.5d'],
  },
  fields: SIDE_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof SIDE_CAMERA_FIELDS> | null = null;
    let distance = 10;
    let pivot: Vector3 | null = null;
    const base = behavior(
      object,
      'side',
      (context) => {
        const v = values;
        const target = v && resolveTarget(context, object, v.target);
        if (!v || !target) return;
        const goal = target.worldPosition().add(new Vector3(0, v.height, 0));
        if (!v.followHeight && pivot) goal.y = pivot.y;
        pivot = pivot ? pivot.lerp(goal, damp(v.damping, context.dt)) : goal;
        setWorldPose(object, pivot.clone().add(new Vector3(0, 0, -distance)), viewRotation(0, 0));
      },
      { distance: () => distance, setDistance: (d) => (distance = Math.max(0.5, d)) },
    );
    return {
      ...base,
      apply(next) {
        if (!values || values.distance !== next.distance) distance = next.distance;
        values = next;
      },
    };
  },
});

const FIXED_CAMERA_FIELDS = {
  lookAt: { type: 'object', default: null, text: { de: 'Blickt auf', en: 'Look At' } },
  lookAtPlayer: {
    type: 'boolean',
    default: false,
    visibleIf: { field: 'lookAt', empty: true },
    text: { de: 'Auf Spieler blicken', en: 'Look At Player' },
  },
  damping: { ...smoothingField, default: 0.2 },
} as const satisfies FieldDefinitions;

/** Feste Kamera: stays where it is and optionally turns to watch a target. */
export const fixedCamera = defineComponent({
  type: 'fixedCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'Feste Kamera', en: 'Fixed Camera' },
  docs: {
    de: 'Kamera-Verhalten: bleibt an ihrem Platz. Mit „Blickt auf“ dreht sie sich weich zum Ziel, wie eine Überwachungskamera.',
    en: 'Camera behavior: stays in place. With "Look At" it turns smoothly towards the target, like a security camera.',
  },
  keywords: { de: ['kamera', 'fest', 'überwachung'], en: ['camera', 'fixed', 'static'] },
  fields: FIXED_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof FIXED_CAMERA_FIELDS> | null = null;
    const base = behavior(object, 'fixed', (context) => {
      const v = values;
      if (!v || (!v.lookAt && !v.lookAtPlayer)) return;
      const target = resolveTarget(context, object, v.lookAt);
      if (!target) return;
      const position = object.worldPosition();
      const point = target.worldPosition().add(new Vector3(0, 1, 0));
      const { yaw, pitch } = anglesOf(point.sub(position));
      const current = object.object3d.getWorldQuaternion(new Quaternion());
      current.slerp(viewRotation(yaw, pitch), damp(v.damping, context.dt));
      setWorldPose(object, position, current);
    });
    return {
      ...base,
      apply(next) {
        values = next;
      },
    };
  },
});

const CAMERA_PATH_FIELDS = {
  path: { type: 'object', default: null, text: { de: 'Pfad', en: 'Path' } },
  duration: {
    type: 'number',
    default: 5,
    min: 0.1,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Dauer', en: 'Duration' },
  },
  loop: { type: 'boolean', default: false, text: { de: 'Wiederholen', en: 'Loop' } },
  playOnStart: {
    type: 'boolean',
    default: true,
    text: { de: 'Beim Start abspielen', en: 'Play On Start' },
  },
  lookAt: {
    type: 'object',
    default: null,
    text: { de: 'Blickt auf (leer = Fahrtrichtung)', en: 'Look At (empty = path direction)' },
  },
} as const satisfies FieldDefinitions;

/** Kamerafahrt: moves along the child objects of a path object as waypoints. */
export const cameraPath = defineComponent({
  type: 'cameraPath',
  category: 'gameplay',
  unique: true,
  text: { de: 'Kamerafahrt', en: 'Camera Path' },
  docs: {
    de: 'Kamera-Verhalten: fährt weich durch Wegpunkte. Die Wegpunkte sind die Kind-Objekte des Pfad-Objekts, in der Reihenfolge der Hierarchie.',
    en: 'Camera behavior: moves smoothly through waypoints. The waypoints are the children of the path object, in hierarchy order.',
  },
  keywords: {
    de: ['kamera', 'fahrt', 'wegpunkte', 'film'],
    en: ['camera', 'dolly', 'waypoints', 'cutscene'],
  },
  fields: CAMERA_PATH_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof CAMERA_PATH_FIELDS> | null = null;
    let elapsed = 0;
    let playing: boolean | null = null;
    const base = behavior(
      object,
      'path',
      (context) => {
        const v = values;
        if (!v) return;
        playing ??= v.playOnStart;
        const path = v.path ? context.world.getObject(v.path) : null;
        if (!path || !playing) return;
        const points = path.children
          .filter((child) => child.activeInHierarchy)
          .map((child) => child.worldPosition());
        if (points.length === 0) return;
        elapsed += context.dt;
        let t = elapsed / v.duration;
        if (t >= 1) {
          if (v.loop) {
            elapsed %= v.duration;
            t = elapsed / v.duration;
          } else {
            t = 1;
            playing = false;
          }
        }
        if (points.length === 1) {
          setWorldPose(
            object,
            points[0] ?? new Vector3(),
            object.object3d.getWorldQuaternion(new Quaternion()),
          );
          return;
        }
        const curve = new CatmullRomCurve3(points, v.loop, 'centripetal');
        const position = curve.getPointAt(t);
        let rotation: Quaternion;
        const watched = v.lookAt ? context.world.getObject(v.lookAt) : null;
        if (watched) {
          const { yaw, pitch } = anglesOf(watched.worldPosition().sub(position));
          rotation = viewRotation(yaw, pitch);
        } else {
          const { yaw, pitch } = anglesOf(curve.getTangentAt(Math.min(t, 0.999)));
          rotation = viewRotation(yaw, pitch);
        }
        setWorldPose(object, position, rotation);
      },
      {
        play: () => {
          elapsed = 0;
          playing = true;
        },
      },
    );
    return {
      ...base,
      apply(next) {
        values = next;
      },
    };
  },
});

const SHARED_CAMERA_FIELDS = {
  distance: {
    type: 'number',
    default: 10,
    min: 1,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Kleinster Abstand', en: 'Min Distance' },
  },
  framing: {
    type: 'number',
    default: 1.4,
    min: 0.5,
    step: 0.1,
    text: { de: 'Rand', en: 'Framing' },
  },
  angle: {
    type: 'number',
    default: 45,
    min: 5,
    max: 89,
    step: 1,
    unit: 'degrees',
    text: { de: 'Neigung', en: 'Angle' },
  },
  direction: {
    type: 'number',
    default: 0,
    step: 5,
    unit: 'degrees',
    text: { de: 'Blickrichtung', en: 'Heading' },
  },
  damping: { ...smoothingField, default: 0.3 },
} as const satisfies FieldDefinitions;

/** Gemeinsame Kamera: keeps all players in view (local multiplayer without split screen). */
export const sharedCamera = defineComponent({
  type: 'sharedCamera',
  category: 'gameplay',
  unique: true,
  text: { de: 'Gemeinsame Kamera', en: 'Shared Camera' },
  docs: {
    de: 'Kamera-Verhalten für Spieler 2 ohne geteilten Bildschirm: zeigt beide Spieler und geht weiter weg, wenn sie sich voneinander entfernen.',
    en: 'Camera behavior for player 2 without split screen: shows both players and moves back as they move apart.',
  },
  keywords: {
    de: ['kamera', 'spieler 2', 'gemeinsam'],
    en: ['camera', 'player 2', 'group', 'coop'],
  },
  fields: SHARED_CAMERA_FIELDS,
  create({ object }) {
    let values: FieldValues<typeof SHARED_CAMERA_FIELDS> | null = null;
    let distance = 10;
    let pivot: Vector3 | null = null;
    let current: number | null = null;
    const base = behavior(
      object,
      'shared',
      (context) => {
        const v = values;
        if (!v) return;
        const players = [playerObject(context.world, 1), playerObject(context.world, 2)].filter(
          (player): player is GameObject => player !== null,
        );
        if (players.length === 0) return;
        const center = new Vector3();
        for (const player of players) center.add(player.worldPosition());
        center.divideScalar(players.length).add(new Vector3(0, 1, 0));
        let spread = 0;
        for (const player of players)
          spread = Math.max(spread, player.worldPosition().distanceTo(center));
        // Distance that fits the spread into the view, with some margin.
        const fov = MathUtils.degToRad(cameraRegistry.get(object)?.camera.fov ?? 60);
        const wanted = Math.max(distance, (spread * v.framing) / Math.tan(fov / 2));
        const k = damp(v.damping, context.dt);
        pivot = pivot ? pivot.lerp(center, k) : center;
        current = current === null ? wanted : current + (wanted - current) * k;
        const yaw = MathUtils.degToRad(v.direction);
        const pitch = MathUtils.degToRad(v.angle);
        setWorldPose(
          object,
          pivot.clone().addScaledVector(viewDirection(yaw, pitch), -current),
          viewRotation(yaw, pitch),
        );
      },
      { distance: () => distance, setDistance: (d) => (distance = Math.max(0.5, d)) },
    );
    return {
      ...base,
      apply(next) {
        if (!values || values.distance !== next.distance) distance = next.distance;
        values = next;
      },
    };
  },
});
