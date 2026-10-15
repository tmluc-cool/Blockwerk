import { peekHealth, healthOf } from '../gameplay/health';
import { inventoryOf, peekInventory } from '../gameplay/inventory';
import type { GameObject } from '../world/GameObject';
import type { VariableValue } from '../world/GameObject';

/** What one player object keeps when the game changes to another scene. */
export interface PlayerCarry {
  readonly items: Readonly<Record<string, number>>;
  readonly health: { readonly current: number; readonly max: number } | null;
  /** Stamina in percent, or `null` if the player has none. */
  readonly stamina: number | null;
}

/** State handed from the game of one scene to the game of the next (SPEC 8.15: scene change). */
export interface CarryState {
  readonly vars: Readonly<Record<string, VariableValue>>;
  readonly players: readonly PlayerCarry[];
}

/** A request to change the scene, made by a block and carried out by the host. */
export interface SceneRequest {
  /** Asset ID of the scene to load. */
  readonly scene: string;
  /** Name of the spawn point (an object with the tag `Spawn`) the player appears at. */
  readonly spawn: string;
}

/** Collects what the Player-tagged objects keep. */
export function collectPlayers(
  players: readonly GameObject[],
  stamina: (object: GameObject) => number | null,
): PlayerCarry[] {
  return players.map((object) => {
    const health = peekHealth(object);
    return {
      items: peekInventory(object)?.snapshot() ?? {},
      health: health ? { current: health.current, max: health.max } : null,
      stamina: stamina(object),
    };
  });
}

/** Gives a player object what its predecessor in the old scene kept. */
export function restorePlayer(
  object: GameObject,
  carry: PlayerCarry,
  setStamina: (object: GameObject, percent: number) => void,
): void {
  if (Object.keys(carry.items).length > 0) inventoryOf(object).restore(carry.items);
  if (carry.health) {
    const health = healthOf(object);
    health.max = carry.health.max;
    health.current = Math.min(carry.health.current, carry.health.max);
  }
  if (carry.stamina !== null) setStamina(object, carry.stamina);
}
