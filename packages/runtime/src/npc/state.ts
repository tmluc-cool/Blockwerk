import type { GameObject } from '../world/GameObject';

/** What happened to an NPC's state; "When state [x]" blocks react to `enter`. */
export interface NpcStateChange {
  readonly type: 'enter' | 'leave';
  readonly state: string;
}

/**
 * The state of an NPC (SPEC 8.8): a plain name such as `patrol` or `chase`. Behavior components
 * run only while the NPC is in their state; an NPC without any state (empty name) runs all of them.
 */
export class NpcState {
  /** Current state; empty means "no state machine in use". */
  current = '';
  /** Draw the state above the NPC in play mode. */
  show = true;
  private seconds_ = 0;
  private events: NpcStateChange[] = [];

  /** Seconds the NPC has been in the current state. */
  get seconds(): number {
    return this.seconds_;
  }

  /** Changes the state (nothing happens if it is the same). */
  change(next: string): void {
    const state = next.trim();
    if (state === this.current) return;
    if (this.current) this.events.push({ type: 'leave', state: this.current });
    this.current = state;
    this.seconds_ = 0;
    if (state) this.events.push({ type: 'enter', state });
  }

  /** Whether a behavior that belongs to `state` may run now. */
  isActive(state: string): boolean {
    return this.current === '' || state === '' || this.current === state;
  }

  /** Lets time pass in the current state. */
  advance(dt: number): void {
    this.seconds_ += dt;
  }

  /** State changes since the last call. */
  takeEvents(): NpcStateChange[] {
    const taken = this.events;
    this.events = [];
    return taken;
  }
}

const states = new WeakMap<GameObject, NpcState>();
/** Every object that ever got a state, so the game can advance and report them. */
const owners = new Set<GameObject>();

/** The state of an object, created on first use. */
export function npcStateOf(object: GameObject): NpcState {
  let state = states.get(object);
  if (!state) {
    state = new NpcState();
    states.set(object, state);
    owners.add(object);
  }
  return state;
}

/** The state of an object if it has one. */
export function peekNpcState(object: GameObject): NpcState | undefined {
  return states.get(object);
}

/** Objects with an NPC state that are still alive (used once per tick by the game). */
export function npcOwners(): Iterable<GameObject> {
  for (const object of owners) if (object.destroyed) owners.delete(object);
  return owners;
}
