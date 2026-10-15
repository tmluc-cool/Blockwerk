import { doubleJump, glide, roll, stamina } from './abilities';
import { animator } from './animator';
import { audioListener, audioSource } from './audio';
import { blockScript } from './blockScript';
import { character } from './figure';
import { camera } from './camera';
import {
  cameraPath,
  firstPersonCamera,
  fixedCamera,
  sharedCamera,
  sideCamera,
  thirdPersonCamera,
  topDownCamera,
} from './cameraBehaviors';
import { characterController } from './characterController';
import {
  boxCollider,
  capsuleCollider,
  cylinderCollider,
  meshCollider,
  sphereCollider,
} from './colliders';
import { firstPersonControl, thirdPersonControl, topDownControl, vehicleControl } from './controls';
import { rigidbody } from './rigidbody';
import type { ComponentDefinition } from './defineComponent';
import { light } from './light';
import { meshRenderer } from './meshRenderer';
import { navAgent } from './navAgent';
import { navObstacle } from './navObstacle';
import { particleSystem } from './particleSystem';
import { postProcessing } from './postProcessing';
import { terrain } from './terrain';
import { water } from './water';

/** All built-in component types in "Add Component" order. */
export const COMPONENTS: readonly ComponentDefinition[] = [
  meshRenderer,
  character,
  animator,
  rigidbody,
  boxCollider,
  sphereCollider,
  capsuleCollider,
  cylinderCollider,
  meshCollider,
  characterController,
  thirdPersonControl,
  firstPersonControl,
  topDownControl,
  vehicleControl,
  doubleJump,
  roll,
  glide,
  stamina,
  camera,
  thirdPersonCamera,
  firstPersonCamera,
  topDownCamera,
  sideCamera,
  fixedCamera,
  cameraPath,
  sharedCamera,
  postProcessing,
  particleSystem,
  terrain,
  water,
  navAgent,
  navObstacle,
  audioSource,
  audioListener,
  light,
  blockScript,
] as unknown as readonly ComponentDefinition[];

const byType = new Map(COMPONENTS.map((definition) => [definition.type, definition]));

/** Looks up a component definition by its type name. */
export function getComponentDefinition(type: string): ComponentDefinition | undefined {
  return byType.get(type);
}
