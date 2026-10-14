import { blockScript } from './blockScript';
import { camera } from './camera';
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

/** All built-in component types in "Add Component" order. */
export const COMPONENTS: readonly ComponentDefinition[] = [
  meshRenderer,
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
  camera,
  light,
  blockScript,
] as unknown as readonly ComponentDefinition[];

const byType = new Map(COMPONENTS.map((definition) => [definition.type, definition]));

/** Looks up a component definition by its type name. */
export function getComponentDefinition(type: string): ComponentDefinition | undefined {
  return byType.get(type);
}
