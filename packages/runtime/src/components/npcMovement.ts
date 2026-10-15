import type { Vector3 } from 'three';
import { defineComponent } from './defineComponent';
import type {
  ComponentBehavior,
  ComponentContext,
  TickContext,
  TickStage,
} from './defineComponent';
import { navAgentRegistry } from './navAgent';
import { npcStateOf } from '../npc/state';
import { FleeRunner, FollowRunner, PatrolRunner, WanderRunner } from '../npc/runners';
import type { Runner } from '../npc/runners';
import { nearestWithTag } from '../npc/senses';
import type { GameObject } from '../world/GameObject';

const stateField = (own: string) =>
  ({
    type: 'string',
    default: own,
    text: { de: 'Aktiv im Zustand', en: 'Active in State' },
  }) as const;

const speedField = (value: number) =>
  ({
    type: 'number',
    default: value,
    min: 0,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Geschwindigkeit (m/s)', en: 'Speed (m/s)' },
  }) as const;

const targetTagField = {
  type: 'string',
  default: 'Player',
  text: { de: 'Ziel-Tag', en: 'Target Tag' },
} as const;

/**
 * Runs a movement runner while the NPC is in the component's state, and stops it when the
 * state ends. NPCs need a Nav Agent to walk; without one the behavior does nothing.
 */
function gated(
  { object, world }: ComponentContext,
  activeState: () => string,
  runner: () => Runner,
): Pick<ComponentBehavior, 'tick'> & { reset(): void } {
  const state = npcStateOf(object);
  let current: Runner | null = null;
  let wasActive = false;
  return {
    reset() {
      current = null;
    },
    tick(stage: TickStage, context: TickContext) {
      if (stage !== 'control') return;
      const agent = navAgentRegistry.get(object);
      if (!agent) return;
      const active = state.isActive(activeState());
      if (active) {
        current ??= runner();
        current.update({ object, world, agent, dt: context.dt, random: () => context.random() });
        wasActive = true;
      } else if (wasActive) {
        current?.stop({ agent });
        wasActive = false;
      }
    },
  };
}

function targetFinder(context: ComponentContext, tag: () => string): () => GameObject | null {
  return () => {
    const from: Vector3 = context.object.worldPosition();
    return nearestWithTag(context.world, tag(), from, context.object);
  };
}

const wanderFields = {
  radius: {
    type: 'number',
    default: 8,
    min: 0.5,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Radius', en: 'Radius' },
  },
  minPause: {
    type: 'number',
    default: 1,
    min: 0,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Pause (kürzeste)', en: 'Pause (shortest)' },
  },
  maxPause: {
    type: 'number',
    default: 4,
    min: 0,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Pause (längste)', en: 'Pause (longest)' },
  },
  speed: speedField(1.6),
  activeInState: stateField('wander'),
} as const;

/** Wander: walks short trips around the place where the object started. */
export const wander = defineComponent({
  type: 'wander',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshAgent (random destinations)',
  text: { de: 'Wandern', en: 'Wander' },
  docs: {
    de: 'Der NPC läuft immer wieder zu zufälligen Punkten im Umkreis seines Startplatzes und bleibt dazwischen stehen. Braucht einen Nav-Agenten und das Navigationsnetz.',
    en: 'The NPC keeps walking to random points around where it started and stops in between. Needs a Nav Agent and the navigation mesh.',
  },
  keywords: {
    de: ['herumlaufen', 'ki', 'npc', 'spazieren'],
    en: ['roam', 'ai', 'npc', 'idle walk'],
  },
  fields: wanderFields,
  create(context, initial) {
    let values = initial;
    const home = context.object.worldPosition();
    const gate = gated(
      context,
      () => values.activeInState,
      () => new WanderRunner(home, values),
    );
    return {
      tick: gate.tick,
      apply(next) {
        values = next;
        gate.reset();
      },
      destroy() {},
    };
  },
});

const patrolFields = {
  route: {
    type: 'object',
    default: null,
    text: { de: 'Wegpunkte (Eltern-Objekt)', en: 'Waypoints (parent object)' },
  },
  mode: {
    type: 'enum',
    default: 'loop',
    options: [
      { value: 'loop', text: { de: 'Rundweg', en: 'Loop' } },
      { value: 'pingPong', text: { de: 'Hin und zurück', en: 'Ping-pong' } },
    ],
    text: { de: 'Ablauf', en: 'Mode' },
  },
  wait: {
    type: 'number',
    default: 1,
    min: 0,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Wartezeit am Punkt', en: 'Wait at Each Point' },
  },
  speed: speedField(1.8),
  activeInState: stateField('patrol'),
} as const;

/** Patrol: walks along the children of a route object, one after the other. */
export const patrol = defineComponent({
  type: 'patrol',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshAgent (waypoints)',
  text: { de: 'Patrouille', en: 'Patrol' },
  docs: {
    de: 'Der NPC läuft die Wegpunkte ab: die Kinder des Objekts im Feld „Wegpunkte“, in der Reihenfolge der Hierarchie. Am Ende geht er im Kreis weiter oder läuft zurück. Nach einer Unterbrechung (zum Beispiel einer Verfolgung) macht er am nächsten Wegpunkt weiter.',
    en: 'The NPC walks its waypoints: the children of the object in the "Waypoints" field, in hierarchy order. At the end it goes around again or walks back. After an interruption (for example a chase) it carries on at the nearest waypoint.',
  },
  keywords: {
    de: ['wache', 'weg', 'route', 'ki', 'npc'],
    en: ['guard', 'route', 'path', 'waypoints', 'ai'],
  },
  fields: patrolFields,
  create(context, initial) {
    let values = initial;
    const route = (): GameObject | null =>
      values.route ? (context.world.getObject(values.route) ?? null) : null;
    const gate = gated(
      context,
      () => values.activeInState,
      () =>
        new PatrolRunner(route, {
          pingPong: values.mode === 'pingPong',
          wait: values.wait,
          speed: values.speed,
        }),
    );
    return {
      tick: gate.tick,
      apply(next) {
        values = next;
        gate.reset();
      },
      destroy() {},
    };
  },
});

const followFields = {
  targetTag: targetTagField,
  distance: {
    type: 'number',
    default: 1.6,
    min: 0,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Abstand', en: 'Distance' },
  },
  speed: speedField(3.6),
  activeInState: stateField('chase'),
} as const;

/** Follow: runs after the nearest object with a tag and keeps a distance. */
export const follow = defineComponent({
  type: 'follow',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshAgent (SetDestination)',
  text: { de: 'Folgen', en: 'Follow' },
  docs: {
    de: 'Der NPC läuft dem nächsten Objekt mit dem Ziel-Tag hinterher, um Hindernisse herum, und bleibt im eingestellten Abstand stehen. Läuft nur im Zustand „chase“ (anpassbar); eine Wache setzt ihn dorthin, wenn sie das Ziel sieht.',
    en: 'The NPC runs after the nearest object with the target tag, around obstacles, and stops at the set distance. It runs only in the state "chase" (adjustable); a Guard puts it there when it sees the target.',
  },
  keywords: {
    de: ['verfolgen', 'hinterher', 'ki', 'npc', 'zombie'],
    en: ['chase', 'pursue', 'ai', 'npc', 'zombie'],
  },
  fields: followFields,
  create(context, initial) {
    let values = initial;
    const gate = gated(
      context,
      () => values.activeInState,
      () =>
        new FollowRunner(
          targetFinder(context, () => values.targetTag),
          { distance: values.distance, speed: values.speed, repath: 0.3 },
        ),
    );
    return {
      tick: gate.tick,
      apply(next) {
        values = next;
        gate.reset();
      },
      destroy() {},
    };
  },
});

const fleeFields = {
  targetTag: targetTagField,
  safeDistance: {
    type: 'number',
    default: 14,
    min: 1,
    step: 1,
    unit: 'meters',
    text: { de: 'Sicherer Abstand', en: 'Safe Distance' },
  },
  speed: speedField(4.5),
  activeInState: stateField('flee'),
} as const;

/** Flee: runs away from the nearest object with a tag. */
export const flee = defineComponent({
  type: 'flee',
  category: 'gameplay',
  unique: true,
  unity: 'NavMeshAgent (flee)',
  text: { de: 'Fliehen', en: 'Flee' },
  docs: {
    de: 'Der NPC läuft vom nächsten Objekt mit dem Ziel-Tag weg, bis der sichere Abstand erreicht ist. Läuft nur im Zustand „flee“ (anpassbar).',
    en: 'The NPC runs away from the nearest object with the target tag until the safe distance is reached. It runs only in the state "flee" (adjustable).',
  },
  keywords: {
    de: ['weglaufen', 'angst', 'ki', 'npc'],
    en: ['run away', 'afraid', 'ai', 'npc', 'escape'],
  },
  fields: fleeFields,
  create(context, initial) {
    let values = initial;
    const gate = gated(
      context,
      () => values.activeInState,
      () =>
        new FleeRunner(
          targetFinder(context, () => values.targetTag),
          { safeDistance: values.safeDistance, speed: values.speed },
        ),
    );
    return {
      tick: gate.tick,
      apply(next) {
        values = next;
        gate.reset();
      },
      destroy() {},
    };
  },
});
