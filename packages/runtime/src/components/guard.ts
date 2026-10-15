import { Vector3 } from 'three';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, TickContext, TickStage } from './defineComponent';
import { npcStateOf } from '../npc/state';
import { angleToPoint, flatDistance, lineOfSight } from '../npc/senses';
import type { Physics } from '../physics/Physics';
import type { GameObject } from '../world/GameObject';

/** What a Guard can tell blocks ("do I see [x]?", "do I hear [x]?"). */
export interface GuardHandle {
  /** Whether the object is in the view cone and not hidden behind something. */
  sees(target: GameObject): boolean;
  /** Whether the object is within hearing distance. */
  hears(target: GameObject): boolean;
  /** The object it noticed last (seen or heard), if it is still alive. */
  readonly noticed: GameObject | null;
  /** Where it noticed something last. */
  readonly lastSeen: Vector3 | null;
}

/** Guards by object. */
export const guardRegistry = new WeakMap<object, GuardHandle>();

const fields = {
  targetTag: {
    type: 'string',
    default: 'Player',
    text: { de: 'Ziel-Tag', en: 'Target Tag' },
  },
  viewDistance: {
    type: 'number',
    default: 14,
    min: 0,
    step: 1,
    unit: 'meters',
    text: { de: 'Sichtweite', en: 'View Distance' },
  },
  viewAngle: {
    type: 'number',
    default: 110,
    min: 10,
    max: 360,
    step: 5,
    unit: 'degrees',
    text: { de: 'Sichtkegel (Öffnungswinkel)', en: 'View Cone (full angle)' },
  },
  hearingRadius: {
    type: 'number',
    default: 4,
    min: 0,
    step: 0.5,
    unit: 'meters',
    text: { de: 'Hörweite', en: 'Hearing Radius' },
  },
  eyeHeight: {
    type: 'number',
    default: 1.6,
    min: 0,
    step: 0.1,
    unit: 'meters',
    text: { de: 'Augenhöhe', en: 'Eye Height' },
  },
  seenState: {
    type: 'string',
    default: 'chase',
    text: { de: 'Zustand bei Entdeckung', en: 'State When Noticed' },
  },
  lostState: {
    type: 'string',
    default: 'patrol',
    text: { de: 'Zustand bei Verlust', en: 'State When Lost' },
  },
  loseTime: {
    type: 'number',
    default: 4,
    min: 0,
    step: 0.5,
    unit: 'seconds',
    text: { de: 'Verlust nach', en: 'Lose Target After' },
  },
  activeInState: {
    type: 'string',
    default: '',
    text: { de: 'Aktiv im Zustand (leer = immer)', en: 'Active in State (empty = always)' },
  },
} as const satisfies FieldDefinitions;

/** The senses check runs this often (per second); it is enough for walking NPCs. */
const CHECKS_PER_SECOND = 10;

/**
 * Guard (SPEC 8.8): watches with a view cone and a hearing radius. When it notices the target it
 * switches the NPC to the "noticed" state (chase); when it has lost the target for a while it
 * switches to the "lost" state (back to patrol).
 */
export const guard = defineComponent({
  type: 'guard',
  category: 'gameplay',
  unique: true,
  unity: 'Physics.Raycast + field of view',
  text: { de: 'Wache', en: 'Guard' },
  docs: {
    de: 'Die Wache sieht Objekte mit dem Ziel-Tag im Sichtkegel (nicht durch Wände) und hört sie in der Hörweite. Bemerkt sie jemanden, wechselt der NPC in den Zustand „chase“; verliert sie ihn für die eingestellte Zeit, geht er zurück in den Zustand „patrol“. Der Sichtkegel ist in der Szenenansicht zu sehen, wenn das Objekt ausgewählt ist.',
    en: 'The guard sees objects with the target tag in its view cone (not through walls) and hears them within the hearing radius. When it notices someone the NPC switches to the state "chase"; when it loses them for the set time it goes back to the state "patrol". The view cone is drawn in the Scene view while the object is selected.',
  },
  keywords: {
    de: ['sicht', 'sehen', 'hören', 'wache', 'zombie', 'entdecken', 'ki'],
    en: ['sight', 'vision', 'hearing', 'guard', 'zombie', 'detect', 'ai', 'cone'],
  },
  fields,
  create({ object, world }, initial) {
    let values = initial;
    const state = npcStateOf(object);
    // A guard alone is enough to have a state machine.
    if (state.current === '') state.change(values.lostState);
    let physics: Physics | null = null;
    let timer = 0;
    let noticed: GameObject | null = null;
    let lastSeen: Vector3 | null = null;
    let lostFor = 0;

    const eye = (): Vector3 => object.worldPosition().add(new Vector3(0, values.eyeHeight, 0));
    const aimPoint = (target: GameObject): Vector3 =>
      target.worldPosition().add(new Vector3(0, Math.min(1, values.eyeHeight * 0.6), 0));

    const hears = (target: GameObject): boolean =>
      target.activeInHierarchy &&
      flatDistance(object.worldPosition(), target.worldPosition()) <= values.hearingRadius;
    const sees = (target: GameObject): boolean => {
      if (!target.activeInHierarchy) return false;
      const there = target.worldPosition();
      if (flatDistance(object.worldPosition(), there) > values.viewDistance) return false;
      if (angleToPoint(object, there) > values.viewAngle / 2) return false;
      return lineOfSight(physics, object, eye(), target, aimPoint(target));
    };
    guardRegistry.set(object, {
      sees,
      hears,
      get noticed() {
        return noticed && !noticed.destroyed ? noticed : null;
      },
      get lastSeen() {
        return lastSeen;
      },
    });

    const check = (): GameObject | null => {
      let best: GameObject | null = null;
      let bestDistance = Infinity;
      const here = object.worldPosition();
      for (const other of world.allObjects()) {
        if (other === object || other.tag !== values.targetTag || !other.activeInHierarchy)
          continue;
        const distance = flatDistance(here, other.worldPosition());
        if (distance >= bestDistance) continue;
        if (hears(other) || sees(other)) {
          best = other;
          bestDistance = distance;
        }
      }
      return best;
    };

    return {
      tick(stage: TickStage, context: TickContext) {
        if (stage !== 'control') return;
        physics = context.physics;
        if (!state.isActive(values.activeInState)) return;
        timer -= context.dt;
        if (timer > 0) return;
        timer = 1 / CHECKS_PER_SECOND;
        const found = check();
        if (found) {
          noticed = found;
          lastSeen = found.worldPosition();
          lostFor = 0;
          if (state.current !== values.seenState) state.change(values.seenState);
        } else if (state.current === values.seenState) {
          lostFor += 1 / CHECKS_PER_SECOND;
          if (lostFor >= values.loseTime) {
            lostFor = 0;
            state.change(values.lostState);
          }
        }
      },
      apply(next) {
        values = next;
      },
      destroy() {
        guardRegistry.delete(object);
      },
    };
  },
});
