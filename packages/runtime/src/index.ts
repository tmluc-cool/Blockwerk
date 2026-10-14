export { createRenderer } from './rendering/createRenderer';
export type { RendererOptions } from './rendering/createRenderer';
export { measureFrame } from './rendering/RenderStats';
export type { RenderStats } from './rendering/RenderStats';
export { Environment, snapToLightTexels } from './environment/Environment';
export type { EnvironmentOptions } from './environment/Environment';
export {
  createGroundTexture,
  generateGroundPixels,
  GROUND_TEXTURE_SIZE,
} from './environment/groundTexture';
export { createPrimitive, createPrimitiveGeometry, PRIMITIVE_SHAPES } from './primitives';
export type { PrimitiveOptions, PrimitiveShape } from './primitives';
export { GameObject } from './world/GameObject';
export type {
  ComponentInstance,
  GameObjectOptions,
  MoveDirection,
  TurnDirection,
  VariableValue,
} from './world/GameObject';
export { applyTransformData, World } from './world/World';
export { ModelCache } from './models/ModelCache';
export type { ModelSource, ModelTemplate, ModelUrlResolver } from './models/ModelCache';
export { InstanceBatcher } from './models/InstanceBatcher';
export type { WorldOptions } from './world/World';
export { defineComponent, isFieldVisible, resolveValues } from './components/defineComponent';
export type * from './components/defineComponent';
export { COMPONENTS, getComponentDefinition } from './components';
export { colliderRegistry } from './components/colliders';
export type { ColliderShape, ColliderState } from './components/colliders';
export { cameraRegistry } from './components/camera';
export type { Locale, LocalizedText } from './text';
export { loadScriptModule, ScriptModuleError } from './scripts';
export type { CompiledScriptModule, ScriptEntry, ScriptEvent, ScriptThread } from './scripts';
export { Game, TICK_SECONDS } from './game/Game';
export type { GameLogEntry, GameOptions, ScriptAsset, VariableMonitor } from './game/Game';
export type {
  Easing,
  GameApi,
  MathFunction,
  ObjectProperty,
  ObjectRef,
  VariableScope,
} from './game/api';
export { ANY_KEY, InputState, normalizeKey } from './game/input';
export { shapesOverlap, toWorldShape } from './game/collisions';
export type { WorldShape } from './game/collisions';
export { errorLine, FUNCTION_HEADER_LINES } from './scripts';
