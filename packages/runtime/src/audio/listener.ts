import { Quaternion, Vector3 } from 'three';
import type { World } from '../world/World';

/** Where the game is heard from: position, the way it faces and its up direction. */
export interface ListenerPose {
  readonly position: Vector3;
  readonly forward: Vector3;
  readonly up: Vector3;
}

const pose: ListenerPose = { position: new Vector3(), forward: new Vector3(), up: new Vector3() };
const rotation = new Quaternion();

/**
 * The listener's pose: the first enabled Audio Listener, else the game camera (cameras look
 * along -Z, objects face +Z). `null` without either.
 */
export function audioListenerCamera(world: World): ListenerPose | null {
  for (const object of world.allObjects()) {
    if (object.destroyed || !object.activeInHierarchy) continue;
    const component = object.findComponent('audioListener');
    if (!component?.enabled) continue;
    object.object3d.updateWorldMatrix(true, false);
    object.object3d.getWorldPosition(pose.position);
    object.object3d.getWorldQuaternion(rotation);
    pose.forward.set(0, 0, 1).applyQuaternion(rotation);
    pose.up.set(0, 1, 0).applyQuaternion(rotation);
    return pose;
  }
  const camera = world.activeCamera();
  if (!camera) return null;
  camera.updateWorldMatrix(true, false);
  camera.getWorldPosition(pose.position);
  camera.getWorldDirection(pose.forward);
  camera.getWorldQuaternion(rotation);
  pose.up.set(0, 1, 0).applyQuaternion(rotation);
  return pose;
}
