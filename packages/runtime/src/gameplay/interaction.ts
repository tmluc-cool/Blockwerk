import type { Vector3 } from 'three';
import type { GameObject } from '../world/GameObject';

/** What the hint at the bottom of the Game view says (the editor translates the standard kinds). */
export interface InteractionHint {
  readonly kind: 'pickup' | 'open' | 'close' | 'locked' | 'talk' | 'use' | 'custom';
  /** Item or object name (`locked`: the item that is needed), or the full text for `custom`. */
  readonly label: string;
}

/** Something the "Interact" action can do (a door, a chest, an NPC to talk to, a thing to pick up). */
export interface Interactable {
  readonly object: GameObject;
  /** How close the user must be, in meters. */
  radius(): number;
  /** The hint to show, or `null` while the thing cannot be used right now. */
  hint(user: GameObject): InteractionHint | null;
  /** Does it. */
  use(user: GameObject): void;
}

/** All interactable things of a world. */
export class Interactables {
  private readonly all = new Set<Interactable>();

  /** Registers a thing; returns a function that removes it again. */
  register(interactable: Interactable): () => void {
    this.all.add(interactable);
    return () => this.all.delete(interactable);
  }

  /**
   * The thing the user would use now: the nearest one in reach that the user is not turned away
   * from (anything within one meter always counts).
   */
  best(user: GameObject): Interactable | null {
    const from: Vector3 = user.worldPosition();
    const heading = user.object3d.rotation.y;
    let best: Interactable | null = null;
    let bestDistance = Infinity;
    for (const item of this.all) {
      const object = item.object;
      if (object.destroyed || !object.activeInHierarchy || object === user) continue;
      const there = object.worldPosition();
      const distance = Math.hypot(there.x - from.x, there.z - from.z);
      if (distance > item.radius() || distance >= bestDistance) continue;
      if (distance > 1) {
        const wanted = Math.atan2(there.x - from.x, there.z - from.z);
        const diff = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
        if (Math.abs(diff) > (110 * Math.PI) / 180) continue;
      }
      if (!item.hint(user)) continue;
      best = item;
      bestDistance = distance;
    }
    return best;
  }
}
