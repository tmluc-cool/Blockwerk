import { Vector3 } from 'three';
import { animatorRegistry } from '../components/animator';
import { isParticlePreset } from '../effects/presets';
import { angleToPoint, flatDistance, lineOfSight } from '../npc/senses';
import type { Physics } from '../physics/Physics';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import { peekHealth } from './health';

/** Settings of a close-range strike. */
export interface StrikeParams {
  readonly damage: number;
  /** How far the strike reaches, in meters. */
  readonly range: number;
  /** Width of the cone in front of the attacker, in degrees. */
  readonly angle: number;
  /** Only hit objects with this tag (empty: everything with a Health). */
  readonly tag: string;
}

/** Plays the attack animation if the model has one (nothing happens otherwise). */
export function playAttack(attacker: GameObject): void {
  animatorRegistry.get(attacker)?.play('attack', { once: true, fade: 0.1 });
}

function hitFeedback(world: World, target: GameObject, sound: string): void {
  const at = target.worldPosition().add(new Vector3(0, 1, 0));
  if (isParticlePreset('sparks')) world.effects.spawn('sparks', at);
  world.audio?.play(sound, { bus: 'effects', position: at });
}

/**
 * Hits everything with a Health in a cone in front of the attacker (Unity: an overlap sphere
 * with an angle check). Returns the objects that were hurt.
 */
export function strike(world: World, attacker: GameObject, params: StrikeParams): GameObject[] {
  const hurt: GameObject[] = [];
  const here = attacker.worldPosition();
  for (const other of world.allObjects()) {
    if (other === attacker || !other.activeInHierarchy) continue;
    if (params.tag && other.tag !== params.tag) continue;
    const health = peekHealth(other);
    if (!health || health.dead) continue;
    const there = other.worldPosition();
    if (flatDistance(here, there) > params.range) continue;
    if (Math.abs(there.y - here.y) > 2.5) continue;
    if (angleToPoint(attacker, there) > params.angle / 2) continue;
    if (health.damage(params.damage, attacker)) {
      hurt.push(other);
      hitFeedback(world, other, 'hit');
    }
  }
  return hurt;
}

/**
 * Shoots a target without a flying object: the hit lands if nothing solid is in the way
 * (used by ranged attackers that have no projectile prefab).
 */
export function hitscan(
  world: World,
  physics: Physics | null,
  attacker: GameObject,
  target: GameObject,
  damage: number,
): boolean {
  const health = peekHealth(target);
  if (!health || health.dead) return false;
  const eye = attacker.worldPosition().add(new Vector3(0, 1.4, 0));
  const aim = target.worldPosition().add(new Vector3(0, 1, 0));
  if (!lineOfSight(physics, attacker, eye, target, aim)) return false;
  const hit = health.damage(damage, attacker);
  if (hit) {
    hitFeedback(world, target, 'hit');
    world.audio?.play('whoosh', { bus: 'effects', position: eye });
  }
  return hit;
}
