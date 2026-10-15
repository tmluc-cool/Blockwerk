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
import { attack, meleeHit, projectile } from './combat';
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
import { checkpoint, destructible, health } from './health';
import { guard } from './guard';
import { inventory } from './inventory';
import { chest, door, pickup, switchComponent, usable } from './items';
import { navAgent } from './navAgent';
import { navObstacle } from './navObstacle';
import { npc } from './npc';
import { flee, follow, patrol, wander } from './npcMovement';
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
  npc,
  wander,
  patrol,
  follow,
  flee,
  guard,
  attack,
  inventory,
  health,
  meleeHit,
  projectile,
  pickup,
  usable,
  door,
  switchComponent,
  chest,
  destructible,
  checkpoint,
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
