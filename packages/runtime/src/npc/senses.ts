import { Vector3 } from 'three';
import type { Physics } from '../physics/Physics';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';

/** The object with a tag that is nearest to a point (inactive objects and `except` are skipped). */
export function nearestWithTag(
  world: World,
  tag: string,
  from: Vector3,
  except?: GameObject,
): GameObject | null {
  let best: GameObject | null = null;
  let bestDistance = Infinity;
  const point = new Vector3();
  for (const object of world.allObjects()) {
    if (object === except || object.tag !== tag || !object.activeInHierarchy) continue;
    const distance = object.worldPosition(point).distanceToSquared(from);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = object;
    }
  }
  return best;
}

/** Horizontal distance between two points. */
export function flatDistance(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Angle in degrees between an object's forward direction and a point (0 = straight ahead). */
export function angleToPoint(viewer: GameObject, point: Vector3): number {
  const from = viewer.worldPosition();
  const dx = point.x - from.x;
  const dz = point.z - from.z;
  if (dx === 0 && dz === 0) return 0;
  const heading = viewer.object3d.rotation.y;
  const wanted = Math.atan2(dx, dz);
  let diff = wanted - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs((diff * 180) / Math.PI);
}

/** Whether nothing solid is between an eye position and a target (physics rays). */
export function lineOfSight(
  physics: Physics | null,
  viewer: GameObject,
  eye: Vector3,
  target: GameObject,
  targetPoint: Vector3,
): boolean {
  if (!physics) return true;
  const direction = targetPoint.clone().sub(eye);
  const distance = direction.length();
  if (distance < 0.01) return true;
  const hit = physics.raycast(eye, direction, distance, viewer);
  if (!hit) return true;
  // The target's own colliders (and its children's) do not block the view.
  for (let object: GameObject | null = hit.object; object; object = object.parent) {
    if (object === target) return true;
  }
  return hit.distance >= distance - 0.05;
}
