import { thingRegistry } from '../components/items';
import { healthOf, peekHealth } from '../gameplay/health';
import { inventoryOf, peekInventory } from '../gameplay/inventory';
import { nearestWithTag } from '../npc/senses';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import type { ObjectRef } from './api';

/** What the item functions of the game API need from the game. */
export interface ItemsContext {
  readonly world: World;
  /** The object a reference names (a tag: the nearest one). */
  resolve(self: GameObject, ref: ObjectRef): GameObject | null;
}

/** Adds items to an object's inventory. */
export function addItem(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  item: string,
  count: number,
): void {
  const object = context.resolve(self, target);
  if (object) inventoryOf(object).add(item, count);
}

/** Takes items from an object's inventory; `false` if there were not enough. */
export function removeItem(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  item: string,
  count: number,
): boolean {
  const object = context.resolve(self, target);
  return object ? inventoryOf(object).remove(item, count) : false;
}

/** Whether an object has an item. */
export function hasItem(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  item: string,
): boolean {
  const object = context.resolve(self, target);
  return !!object && (peekInventory(object)?.has(item) ?? false);
}

/** How many of an item an object has. */
export function itemCount(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  item: string,
): number {
  const object = context.resolve(self, target);
  return object ? (peekInventory(object)?.count(item) ?? 0) : 0;
}

/** Opens, closes or flips a door, chest or switch; whoever stands nearest gets a chest's contents. */
export function operateThing(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  action: 'open' | 'close' | 'toggle',
): void {
  const object = context.resolve(self, target);
  const thing = object ? thingRegistry.get(object) : undefined;
  if (!object || !thing) return;
  const user = nearestWithTag(context.world, 'Player', object.worldPosition()) ?? self;
  if (action === 'open') thing.open(user, true);
  else if (action === 'close') thing.close();
  else thing.toggle(user, true);
}

/** Lets `self` pick up a pickup object. */
export function pickUp(context: ItemsContext, self: GameObject, target: ObjectRef): void {
  const object = context.resolve(self, target);
  if (object) thingRegistry.get(object)?.take(self);
}

/** Hurts an object (it gets a Health with 100 hit points if it has none). */
export function damage(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  amount: number,
): void {
  const object = context.resolve(self, target);
  if (object) healthOf(object).damage(amount, self);
}

/** Gives hit points back. */
export function heal(
  context: ItemsContext,
  self: GameObject,
  target: ObjectRef,
  amount: number,
): void {
  const object = context.resolve(self, target);
  if (object) healthOf(object).heal(amount);
}

/** Hit points of an object (0 if it has no Health). */
export function healthPoints(context: ItemsContext, self: GameObject, target: ObjectRef): number {
  const object = context.resolve(self, target);
  return object ? (peekHealth(object)?.current ?? 0) : 0;
}
