export { createRenderer } from './rendering/createRenderer';
export {
  autoQuality,
  currentQuality,
  isQualityName,
  isSoftwareRenderer,
  onQualityChange,
  pixelRatioFor,
  QUALITY_LEVELS,
  QUALITY_NAMES,
  qualitySettings,
  setQuality,
} from './rendering/quality';
export type { QualityName, QualitySettings } from './rendering/quality';
export { DEFAULT_POST_SETTINGS, effectivePost, PostProcessing } from './rendering/PostProcessing';
export type { EffectivePost, PostSettings } from './rendering/PostProcessing';
export { ViewRenderer } from './rendering/ViewRenderer';
export { postRegistry } from './components/postProcessing';
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
export {
  ANIMATION_STATES,
  ANIMATION_STATE_TEXT,
  LOOPING_STATES,
  matchClips,
} from './animation/states';
export type { AnimationState } from './animation/states';
export { InstanceBatcher } from './models/InstanceBatcher';
export type { WorldOptions } from './world/World';
export { defineComponent, isFieldVisible, resolveValues } from './components/defineComponent';
export type * from './components/defineComponent';
export { COMPONENTS, getComponentDefinition } from './components';
export { emitterRegistry } from './components/particleSystem';
export { terrainRegistry } from './components/terrain';
export type { TerrainState } from './components/terrain';
export { loadTerrain, setTerrainSource } from './terrain/source';
export { TerrainGrass } from './terrain/TerrainGrass';
export { TerrainMesh } from './terrain/TerrainMesh';
export { Effects } from './effects/Effects';
export { ParticleEmitter } from './effects/ParticleEmitter';
export {
  DEFAULT_PARTICLE_PARAMS,
  isParticlePreset,
  PARTICLE_PRESET_NAMES,
  PARTICLE_PRESETS,
  particleTemplateValues,
} from './effects/presets';
export type { ParticleParams, ParticlePresetName } from './effects/presets';
export { colliderRegistry } from './components/colliders';
export { navAgentRegistry } from './components/navAgent';
export { guardRegistry } from './components/guard';
export { thingRegistry } from './components/items';
export type { CarryState, PlayerCarry, SceneRequest } from './game/carry';
export { DialogSession, conditionHolds } from './dialog/session';
export type { DialogChoice, DialogHost, DialogView } from './dialog/session';
export type { DialogAction } from '@blockwerk/project';
export type { ThingHandle } from './components/items';
export { Health, healthOf, peekHealth } from './gameplay/health';
export { Inventory, inventoryOf, peekInventory } from './gameplay/inventory';
export type { InteractionHint } from './gameplay/interaction';
export type { GuardHandle } from './components/guard';
export { NpcState, npcStateOf, peekNpcState } from './npc/state';
export type { NpcStateChange } from './npc/state';
export type { NavAgentHandle } from './components/navAgent';
export {
  collectNavigationGeometry,
  DEFAULT_NAVIGATION,
  initNavigation,
  Navigation,
  navigationLoaded,
} from './navigation';
export type {
  NavigationAgent,
  NavigationAgentParams,
  NavigationGeometry,
  NavigationSettings,
} from './navigation';
export type { ColliderShape, ColliderState } from './components/colliders';
export { cameraRegistry } from './components/camera';
export { motorRegistry } from './components/characterController';
export { ATTACHMENT_POINTS, DEFAULT_ANIMATION_SOURCE, figureRegistry } from './components/figure';
export { parseAttachments, parseList } from './components/lists';
export type { AttachmentPoint, FigureInfo } from './components/figure';
export {
  applyMovementProfile,
  isProfileName,
  jumpArc,
  MOVEMENT_PROFILES,
  PROFILE_NAMES,
  PROFILE_TEXT,
} from './character/movement';
export type { ProfileName, ProfileValues } from './character/movement';
export { abilityRegistry, ABILITY_NAMES } from './components/abilities';
export type { AbilityConfig, AbilityName } from './components/abilities';
export { animatorRegistry } from './components/animator';
export type { AnimatorHandle } from './components/animator';
export { renderedModels } from './components/meshRenderer';
export type { RenderedModel } from './components/meshRenderer';
export { cameraBehaviorRegistry, playerObject } from './components/cameraBehaviors';
export type { CameraBehaviorHandle, CameraMode } from './components/cameraBehaviors';
export type { CameraEntry } from './components/camera';
export { CameraTransitions } from './camera/transitions';
export type { GameView, GameViews } from './camera/transitions';
export type { CharacterMotor } from './components/characterController';
export { controlRegistry, smoothDampAngle } from './components/controls';
export type {
  ControlEvent,
  ControlMode,
  ControlSettings,
  ControlState,
} from './components/controls';
export type { Locale, LocalizedText } from './text';
export { loadScriptModule, ScriptModuleError } from './scripts';
export type { CompiledScriptModule, ScriptEntry, ScriptEvent, ScriptThread } from './scripts';
export { Game, TICK_SECONDS } from './game/Game';
export type { GameLogEntry, GameOptions, ScriptAsset, VariableMonitor } from './game/Game';
export type {
  Easing,
  GameApi,
  SceneApi,
  MathFunction,
  ObjectProperty,
  ObjectRef,
  VariableScope,
} from './game/api';
export { ANY_KEY, InputState, normalizeKey } from './game/input';
export { shapesOverlap, toWorldShape } from './game/collisions';
export type { WorldShape } from './game/collisions';
export { errorLine, FUNCTION_HEADER_LINES } from './scripts';
export { initPhysics, loadedRapier } from './physics/rapier';
export type { Rapier } from './physics/rapier';
export { DEFAULT_PHYSICS, Physics, setWorldPose } from './physics/Physics';
export type { PhysicsHit, PhysicsSettings, ZoneEvent } from './physics/Physics';
export {
  ACTIONS,
  DEFAULT_BINDINGS,
  GAMEPAD_BUTTONS,
  MOUSE_SENSITIVITY,
  PlayerInput,
} from './game/actions';
export type {
  ActionName,
  ButtonAction,
  GamepadSnapshot,
  PlayerBindings,
  RawInput,
} from './game/actions';

export type { SkyClock } from './environment/Environment';
export {
  CLEAR_WEATHER,
  isWeatherType,
  WEATHER_TYPES,
  weatherLook,
  Weather,
} from './environment/Weather';
export type { WeatherLook, WeatherState, WeatherType } from './environment/Weather';
export { seededRandom, TERRAIN_LAYERS, TERRAIN_TOOLS, TerrainData } from './terrain/TerrainData';
export type { TerrainBrush, TerrainRegion, TerrainTool } from './terrain/TerrainData';
export { WaterSurface } from './water/WaterSurface';
export type { WaterReflection, WaterSettings } from './water/WaterSurface';
export {
  BUILTIN_EFFECTS,
  BUILTIN_LOOPS,
  BUILTIN_SOUNDS,
  isBuiltinSound,
  isLoopingSound,
  SYNTH_RATE,
  synthesize,
} from './audio/synth';
export type { BuiltinSound } from './audio/synth';
export { AUDIO_BUSES, AudioEngine, isAudioBus, setAudioSource } from './audio/AudioEngine';
export type {
  AudioBus,
  AudioEngineOptions,
  AudioSource,
  PlayOptions,
  SoundHandle,
} from './audio/AudioEngine';
export { audioSourceRegistry } from './components/audio';
export type { AudioSourceState } from './components/audio';
export {
  RecordedGain,
  RecordedPanner,
  RecordedSource,
  RecordingAudioContext,
} from './audio/RecordingAudioContext';

export { uiCanvasRegistry } from './components/uiCanvas';
export type { UiCanvasState, UiVisibility } from './components/uiCanvas';
export { bindingsFor, DEFAULT_SETTINGS, GameSettings, sanitizeSettings } from './settings/settings';
export type { BindingOverrides, SettingsStorage, SettingsValues } from './settings/settings';
export { MemorySaveStorage, parseSave, SAVE_SLOTS } from './saves/saves';
export type { SaveStorage } from './saves/saves';
export { ANCHOR_PRESETS, applyAnchorPreset, canvasScale, layoutRect } from './ui/layout';
export type { AnchorPreset, Rect, UiPlacement } from './ui/layout';
export { formatValue, keyLabel, UiRenderer } from './ui/UiRenderer';
export { cloneValue, valueToText } from './game/values';
export type { UiFrame, UiHost, UiLoading } from './ui/UiRenderer';
export { UI_STRING_KEYS } from './ui/strings';
export type { UiStringKey, UiStrings } from './ui/strings';
export { checkWorld } from './check/checkWorld';
export type { CheckContext, EmptySlot, ScriptFacts, SentMessage } from './check/checkWorld';
export type { Problem, ProblemCode, ProblemLink } from './check/problems';
