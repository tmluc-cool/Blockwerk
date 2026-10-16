import { Vector3 } from 'three';
import { guardRegistry } from '../components/guard';
import { navAgentRegistry } from '../components/navAgent';
import { npcStateOf, peekNpcState } from '../npc/state';
import { FleeRunner, FollowRunner, PatrolRunner, WanderRunner } from '../npc/runners';
import type { Runner } from '../npc/runners';
import { nearestWithTag } from '../npc/senses';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import type { ObjectRef } from './api';

/** What the NPC functions of the game API need from the game. */
export interface NpcContext {
  readonly world: World;
  find(self: GameObject, ref: ObjectRef): GameObject | null;
  random(): number;
}

/** Longest a "go to" block waits for the NPC to arrive, in seconds. */
const GO_TO_TIMEOUT = 180;

/**
 * Behaviors started by blocks ("follow … with distance …"), one per object. They run every
 * logic tick in the `control` stage, like the NPC components.
 */
export class NpcCommands {
  private readonly running = new Map<GameObject, Runner>();

  /** Replaces the object's block-started behavior. */
  set(object: GameObject, runner: Runner): void {
    this.clear(object);
    this.running.set(object, runner);
  }

  /** Ends the object's block-started behavior and stops it walking. */
  clear(object: GameObject): void {
    const runner = this.running.get(object);
    if (!runner) return;
    this.running.delete(object);
    const agent = navAgentRegistry.get(object);
    if (agent) runner.stop({ agent });
  }

  /** Runs all behaviors one tick. */
  update(world: World, dt: number, random: () => number): void {
    for (const [object, runner] of this.running) {
      if (object.destroyed) {
        this.running.delete(object);
        continue;
      }
      const agent = navAgentRegistry.get(object);
      if (agent) runner.update({ object, world, agent, dt, random });
    }
  }
}

/** The object a reference names; tags choose the nearest object, not the first. */
export function resolveNearest(
  context: NpcContext,
  self: GameObject,
  ref: ObjectRef,
): GameObject | null {
  if (ref.startsWith('tag:')) {
    return nearestWithTag(context.world, ref.slice(4), self.worldPosition(), self);
  }
  return context.find(self, ref);
}

/** Walks to an object over the navigation mesh and waits until it got there (`yield*` this). */
export function* navigateTo(
  context: NpcContext,
  commands: NpcCommands,
  self: GameObject,
  ref: ObjectRef,
  tick: number,
): Generator<void, void, void> {
  const agent = navAgentRegistry.get(self);
  const target = resolveNearest(context, self, ref);
  if (!agent || !target) return;
  commands.clear(self);
  if (!agent.moveTo(target.worldPosition(), target)) return;
  for (let waited = 0; agent.moving && waited < GO_TO_TIMEOUT; waited += tick) yield;
}

/** Starts following an object (until another command or "stand still"). */
export function followObject(
  context: NpcContext,
  commands: NpcCommands,
  self: GameObject,
  ref: ObjectRef,
  distance: number,
): void {
  commands.set(
    self,
    new FollowRunner(() => resolveNearest(context, self, ref), {
      distance: Math.max(0, distance),
      speed: navAgentRegistry.get(self)?.speed ?? 3.5,
      repath: 0.3,
    }),
  );
}

/** Starts running away from an object. */
export function fleeFrom(
  context: NpcContext,
  commands: NpcCommands,
  self: GameObject,
  ref: ObjectRef,
): void {
  commands.set(
    self,
    new FleeRunner(() => resolveNearest(context, self, ref), {
      safeDistance: 14,
      speed: navAgentRegistry.get(self)?.speed ?? 4.5,
    }),
  );
}

/** Starts wandering around the place the NPC is at now. */
export function wanderAround(commands: NpcCommands, self: GameObject, radius: number): void {
  commands.set(
    self,
    new WanderRunner(self.worldPosition(), {
      radius: Math.max(0.5, radius),
      minPause: 1,
      maxPause: 4,
      speed: navAgentRegistry.get(self)?.speed ?? 1.6,
    }),
  );
}

/** Starts walking the waypoints that are the children of a route object. */
export function patrolRoute(
  context: NpcContext,
  commands: NpcCommands,
  self: GameObject,
  ref: ObjectRef,
): void {
  commands.set(
    self,
    new PatrolRunner(() => context.find(self, ref), {
      pingPong: false,
      wait: 1,
      speed: navAgentRegistry.get(self)?.speed ?? 1.8,
    }),
  );
}

/** Stops walking and ends a block-started behavior. */
export function stopWalking(commands: NpcCommands, self: GameObject): void {
  commands.clear(self);
  navAgentRegistry.get(self)?.stop();
}

/** The state of an NPC (empty text if it has none). */
export function stateOf(self: GameObject): string {
  return peekNpcState(self)?.current ?? '';
}

/** Changes the state of an NPC. */
export function setState(self: GameObject, state: string): void {
  npcStateOf(self).change(state);
}

/** Whether a guard sees an object (the object itself needs no Guard component to be seen). */
export function guardSees(context: NpcContext, self: GameObject, ref: ObjectRef): boolean {
  const target = resolveNearest(context, self, ref);
  return !!target && (guardRegistry.get(self)?.sees(target) ?? fallbackSees(self, target));
}

/** Whether a guard hears an object. */
export function guardHears(context: NpcContext, self: GameObject, ref: ObjectRef): boolean {
  const target = resolveNearest(context, self, ref);
  return !!target && (guardRegistry.get(self)?.hears(target) ?? fallbackHears(self, target));
}

/** Without a Guard component: a plain 120° cone up to 15 m, and 4 m for hearing. */
function fallbackSees(self: GameObject, target: GameObject): boolean {
  const from = self.worldPosition();
  const to = target.worldPosition();
  const flat = new Vector3(to.x - from.x, 0, to.z - from.z);
  if (flat.length() > 15) return false;
  const heading = self.object3d.rotation.y;
  const wanted = Math.atan2(flat.x, flat.z);
  const diff = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
  return Math.abs(diff) <= (60 * Math.PI) / 180;
}

function fallbackHears(self: GameObject, target: GameObject): boolean {
  return self.worldPosition().distanceTo(target.worldPosition()) <= 4;
}
