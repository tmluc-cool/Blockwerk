import { MathUtils, Vector3 } from 'three';
import { controlRegistry } from './controls';
import type { ControlState } from './controls';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, TickContext, TickStage } from './defineComponent';
import type { NavigationAgent } from '../navigation/Navigation';
import type { GameObject } from '../world/GameObject';

/** What blocks and NPC components use to send an agent somewhere. */
export interface NavAgentHandle {
  /** Walking speed in m/s (components of the NPC change it, e.g. running when chasing). */
  speed: number;
  /**
   * Starts walking to a point. Returns `false` if the point cannot be reached. `target` names the
   * object the walk is for: if there is no way to it, the problem is reported in the console.
   */
  moveTo(point: Vector3, target?: GameObject): boolean;
  /** Stops walking. */
  stop(): void;
  /** Walking to a destination now. */
  readonly moving: boolean;
  /** The agent got to its last destination. */
  readonly arrived: boolean;
  /** The last destination, or `null`. */
  readonly destination: Vector3 | null;
  /** Distance to the destination in meters (`Infinity` without one). */
  readonly remaining: number;
  /** Current horizontal speed in m/s. */
  readonly currentSpeed: number;
}

/** Nav agents by object (Unity: GetComponent<NavMeshAgent>). */
export const navAgentRegistry = new WeakMap<object, NavAgentHandle>();

const fields = {
  speed: {
    type: 'number',
    default: 3.5,
    min: 0,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Geschwindigkeit (m/s)', en: 'Speed (m/s)' },
  },
  acceleration: {
    type: 'number',
    default: 12,
    min: 0.1,
    step: 0.5,
    text: { de: 'Beschleunigung', en: 'Acceleration' },
  },
  stoppingDistance: {
    type: 'number',
    default: 0.3,
    min: 0,
    step: 0.05,
    unit: 'meters',
    text: { de: 'Anhalteabstand', en: 'Stopping Distance' },
  },
  turnSpeed: {
    type: 'number',
    default: 540,
    min: 0,
    step: 10,
    unit: 'degrees',
    text: { de: 'Drehtempo (°/s)', en: 'Angular Speed (°/s)' },
  },
  radius: {
    type: 'number',
    default: 0.4,
    min: 0.05,
    step: 0.05,
    unit: 'meters',
    text: { de: 'Radius', en: 'Radius' },
  },
  height: {
    type: 'number',
    default: 1.8,
    min: 0.3,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Höhe', en: 'Height' },
  },
  avoidance: {
    type: 'boolean',
    default: true,
    text: { de: 'Anderen ausweichen', en: 'Avoid Others' },
  },
} as const satisfies FieldDefinitions;

/** A control state for characters moved by an agent, so the animator and the sounds know their speed. */
function agentControlState(speedOf: () => number, topSpeed: () => number): ControlState {
  const settings = { walkSpeed: 1, runSpeed: 1, jumpHeight: 0 };
  return {
    mode: 'agent',
    player: 1,
    settings,
    get speed() {
      return speedOf();
    },
    get normalizedSpeed() {
      const top = topSpeed();
      return top > 0 ? speedOf() / top : 0;
    },
    grounded: true,
    running: false,
    crouching: false,
    jumping: false,
    verticalVelocity: 0,
    ticksSinceLanding: 1000,
    ticksSinceJump: 1000,
    swimming: false,
    locked: false,
    rolling: false,
    gliding: false,
    stamina: null,
    setStamina() {},
    takeEvents: () => [],
    clearOverrides() {},
    jump() {},
    setCrouch() {},
  };
}

const HORIZONTAL = new Vector3();

/**
 * Nav-Agent (Unity: NavMeshAgent): walks its object over the navigation mesh to a destination,
 * around obstacles and around other agents. NPC components and the "go to" block give it
 * destinations; the character component's animations follow its speed.
 */
export const navAgent = defineComponent({
  type: 'navAgent',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshAgent',
  text: { de: 'Nav-Agent', en: 'Nav Agent' },
  docs: {
    de: 'Lässt das Objekt auf dem Navigationsnetz zu einem Ziel laufen, um Hindernisse und andere Agenten herum. Die Wegfindung ist an, sobald das Navigationsnetz berechnet ist (Fenster Navigation). Mit den NPC-Komponenten (Wandern, Patrouille, Folgen …) oder dem Block „gehe zu …“ bekommt der Agent seine Ziele.',
    en: 'Walks the object over the navigation mesh to a destination, around obstacles and other agents. Pathfinding works as soon as the navigation mesh is built (Navigation window). The NPC components (Wander, Patrol, Follow …) or the "go to …" block give the agent its destinations.',
  },
  keywords: {
    de: ['navigation', 'wegfindung', 'npc', 'laufen', 'ki', 'agent'],
    en: ['navigation', 'pathfinding', 'npc', 'walk', 'ai', 'agent', 'navmesh'],
  },
  fields,
  create({ object, world }, initial) {
    let values = initial;
    let agent: NavigationAgent | null = null;
    let destination: Vector3 | null = null;
    let moving = false;
    let arrived = false;
    let speedNow = 0;
    let speedSetting = initial.speed;
    const lastWritten = new Vector3(Number.NaN, 0, 0);
    const position = new Vector3();

    const handle: NavAgentHandle = {
      get speed() {
        return speedSetting;
      },
      set speed(value) {
        speedSetting = Math.max(0, value);
        agent?.update({ speed: speedSetting });
      },
      moveTo(point, target) {
        destination = point.clone();
        arrived = false;
        if (world.navigation.ensureBuilt()) {
          ensureAgent();
          const ok = agent?.moveTo(point) ?? false;
          moving = ok;
          if (!ok) {
            destination = null;
            if (target) {
              world.reportProblem({
                severity: 'error',
                code: 'noPathToTarget',
                params: { object: object.name, target: target.name },
                link: { objectId: object.cloneOf ?? object.id },
              });
            }
          }
          return ok;
        }
        // No navigation mesh (no ground or the engine is missing): walk in a straight line.
        moving = true;
        return true;
      },
      stop() {
        destination = null;
        moving = false;
        agent?.stop();
      },
      get moving() {
        return moving;
      },
      get arrived() {
        return arrived;
      },
      get destination() {
        return destination;
      },
      get remaining() {
        if (!destination) return Number.POSITIVE_INFINITY;
        object.worldPosition(position);
        return Math.hypot(destination.x - position.x, destination.z - position.z);
      },
      get currentSpeed() {
        return speedNow;
      },
    };
    navAgentRegistry.set(object, handle);
    const state = agentControlState(
      () => speedNow,
      () => speedSetting,
    );
    // A player control or a vehicle on the same object keeps the registry slot.
    if (!controlRegistry.has(object)) controlRegistry.set(object, state);

    function ensureAgent(): void {
      if (agent) return;
      agent = world.navigation.addAgent(object.worldPosition(), {
        radius: values.radius,
        height: values.height,
        speed: speedSetting,
        acceleration: values.acceleration,
        avoidance: values.avoidance,
      });
    }

    const tick = (context: TickContext): void => {
      const dt = context.dt;
      object.worldPosition(position);
      if (world.navigation.ensureBuilt()) {
        ensureAgent();
        // Something else moved the object (a teleport block): the agent follows it.
        if (
          Number.isFinite(lastWritten.x) &&
          Math.hypot(position.x - lastWritten.x, position.z - lastWritten.z) > 0.05
        ) {
          agent?.warp(position);
        }
        if (agent) {
          HORIZONTAL.set(agent.velocity.x, 0, agent.velocity.z);
          speedNow = HORIZONTAL.length();
          if (agent.position.distanceToSquared(position) > 1e-8) {
            object.setWorldPosition(agent.position);
          }
          lastWritten.copy(agent.position);
        }
      } else if (destination && moving) {
        // Straight-line fallback.
        HORIZONTAL.set(destination.x - position.x, 0, destination.z - position.z);
        const distance = HORIZONTAL.length();
        const step = Math.min(distance, speedSetting * dt);
        if (distance > 1e-6) HORIZONTAL.multiplyScalar(1 / distance);
        speedNow = step / dt;
        position.x += HORIZONTAL.x * step;
        position.z += HORIZONTAL.z * step;
        object.setWorldPosition(position);
        lastWritten.copy(position);
      } else {
        speedNow = 0;
      }
      if (speedNow > 0.2) {
        const wanted =
          agent && world.navigation.built
            ? Math.atan2(agent.velocity.x, agent.velocity.z)
            : Math.atan2(HORIZONTAL.x, HORIZONTAL.z);
        const current = object.object3d.rotation.y;
        let diff = MathUtils.euclideanModulo(wanted - current + Math.PI, Math.PI * 2) - Math.PI;
        const maxTurn = MathUtils.degToRad(values.turnSpeed) * dt;
        diff = MathUtils.clamp(diff, -maxTurn, maxTurn);
        object.object3d.rotation.y = current + diff;
      }
      if (destination && moving) {
        object.worldPosition(position);
        const remaining = Math.hypot(destination.x - position.x, destination.z - position.z);
        if (remaining <= Math.max(values.stoppingDistance, 0.05)) {
          moving = false;
          arrived = true;
          agent?.stop();
          speedNow = 0;
        }
      }
    };

    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage === 'character') tick(context);
      },
      apply(next) {
        const speedChanged = next.speed !== values.speed;
        values = next;
        if (speedChanged) speedSetting = next.speed;
        agent?.update({
          radius: next.radius,
          height: next.height,
          speed: speedSetting,
          acceleration: next.acceleration,
          avoidance: next.avoidance,
        });
      },
      destroy() {
        agent?.remove();
        agent = null;
        if (navAgentRegistry.get(object) === handle) navAgentRegistry.delete(object);
        if (controlRegistry.get(object) === state) controlRegistry.delete(object);
      },
    };
  },
});
