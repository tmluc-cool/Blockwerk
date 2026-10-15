import { FORMAT_VERSION } from '@blockwerk/project';
import type {
  ComponentData,
  DialogData,
  SaveData,
  UiAction,
  UiBinding,
  UiData,
  JsonValue,
  SceneData,
  SceneObjectData,
  VariableData,
} from '@blockwerk/project';
import type { Quaternion } from 'three';
import { MathUtils, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { colliderRegistry } from '../components/colliders';
import { errorLine } from '../scripts';
import { cloneValue, dictOps, valueToText, listOps } from './values';
import type { CompiledScriptModule, ScriptEntry } from '../scripts';
import { GameObject } from '../world/GameObject';
import type { VariableValue } from '../world/GameObject';
import { applyTransformData, World } from '../world/World';
import type { WorldOptions } from '../world/World';
import type {
  Easing,
  GameApi,
  MathFunction,
  ObjectProperty,
  ObjectRef,
  VariableScope,
} from './api';
import { shapesOverlap, toWorldShape } from './collisions';
import type { MeshBounds } from './collisions';
import { meshData, meshKey, ownMeshes } from '../physics/meshData';
import type { WorldShape } from './collisions';
import { InputState } from './input';
import { PlayerInput } from './actions';
import type { ButtonAction } from './actions';
import { DEFAULT_PHYSICS, Physics } from '../physics/Physics';
import type { PhysicsSettings, ZoneEvent } from '../physics/Physics';
import { loadedRapier } from '../physics/rapier';
import type { TickContext, TickStage } from '../components/defineComponent';
import { CameraTransitions } from '../camera/transitions';
import { animatorRegistry } from '../components/animator';
import { controlRegistry } from '../components/controls';
import * as gameplay from './gameplayApi';
import * as npcApi from './npcApi';
import { NpcCommands } from './npcApi';
import { npcOwners, npcStateOf } from '../npc/state';
import * as itemsApi from './itemsApi';
import { collectPlayers, restorePlayer } from './carry';
import { uiCanvasRegistry } from '../components/uiCanvas';
import { bindingsFor, GameSettings } from '../settings/settings';
import { AUDIO_BUSES } from '../audio/AudioEngine';
import type { SaveStorage } from '../saves/saves';
import type { CarryState, SceneRequest } from './carry';
import { DialogSession } from '../dialog/session';
import type { DialogHost, DialogView } from '../dialog/session';
import { inventoryOf, peekInventory } from '../gameplay/inventory';
import { peekHealth } from '../gameplay/health';
import { SAVE_SLOTS } from '../saves/saves';
import { nearestWithTag } from '../npc/senses';
import type { InteractionHint } from '../gameplay/interaction';
import { playerObject } from '../components/cameraBehaviors';
import { isWeatherType } from '../environment/Weather';
import { emitterRegistry } from '../components/particleSystem';
import { isParticlePreset } from '../effects/presets';
import { AudioEngine, isAudioBus } from '../audio/AudioEngine';
import { CharacterSounds } from '../audio/CharacterSounds';
import { audioListenerCamera } from '../audio/listener';
import { currentQuality, isQualityName, setQuality } from '../rendering/quality';
import type { GameViews } from '../camera/transitions';

/** Length of one logic tick in seconds (fixed 60 Hz, SPEC 8.1). */
export const TICK_SECONDS = 1 / 60;

/** Most ticks run per rendered frame; more are dropped so a slow frame cannot snowball. */
const MAX_TICKS_PER_FRAME = 8;

/** A compiled block-script asset ready to run. */
export interface ScriptAsset {
  readonly assetId: string;
  readonly module: CompiledScriptModule;
  readonly variables: readonly VariableData[];
  /** For every line of the generated code the block it came from. */
  readonly lineToBlock: readonly (string | null)[];
  /** URL used in stack traces of this code (see `loadScriptModule`). */
  readonly sourceUrl: string;
}

/** Messages from the running game for the console. */
export type GameLogEntry =
  | {
      readonly level: 'error';
      readonly kind: 'scriptError';
      readonly message: string;
      readonly objectId: string;
      readonly objectName: string;
      readonly assetId: string;
      readonly blockId: string | null;
    }
  | {
      readonly level: 'warning';
      readonly kind: 'missingScript' | 'missingPrefab';
      readonly objectId: string;
      readonly objectName: string;
      readonly assetId: string | null;
    };

/** An on-screen variable display (Scratch: variable monitor). */
export interface VariableMonitor {
  readonly key: string;
  readonly name: string;
  /** Owning object for object-scoped variables. */
  readonly objectName: string | null;
  readonly value: VariableValue;
}

/** Options for {@link Game}. */
export interface GameOptions extends WorldOptions {
  /** Compiled block-script assets by asset ID. */
  readonly scripts: (assetId: string) => ScriptAsset | null;
  /** Dialog assets by asset ID ("start dialog", Talkable). */
  readonly dialogs?: (assetId: string) => DialogData | null;
  /** Asset ID of the scene this game plays (for "restart scene") and its name (for saves). */
  readonly sceneId?: string;
  readonly sceneName?: string;
  /** UI canvases by asset ID. */
  readonly uis?: (assetId: string) => UiData | null;
  /** The player's settings (volumes, sensitivity, keys); a default set if missing. */
  readonly settings?: GameSettings;
  /** Where save slots are written and read. */
  readonly saves?: SaveStorage;
  /** IDs of the game variables that belong in a save (the host reads them from all scripts). */
  readonly savedVariables?: ReadonlySet<string>;
  /** A save slot to continue from: variables, players, positions. */
  readonly save?: SaveData;
  /** State from the previous scene (variables, players' items and health). */
  readonly carry?: CarryState;
  /** Name of the spawn point the players start at (an object tagged `Spawn`). */
  readonly spawn?: string;
  readonly log?: (entry: GameLogEntry) => void;
  /** Random source in [0, 1); defaults to `Math.random`. */
  readonly random?: () => number;
  /** Creates IDs for clones. */
  readonly createId?: () => string;
  /** Gravity and layer collision matrix (physics runs if the engine is loaded). */
  readonly physics?: PhysicsSettings;
  /** The sound system; defaults to Web Audio in browsers and silence elsewhere. */
  readonly audio?: AudioEngine;
  /** Prefabs for "create [prefab] at": root and objects with variants and nesting resolved. */
  readonly prefabs?: (assetId: string) => {
    readonly root: string;
    readonly objects: Readonly<Record<string, SceneObjectData>>;
  } | null;
}

interface AttachedScript {
  readonly asset: ScriptAsset;
  readonly entries: readonly ScriptEntry[];
}

interface Thread {
  readonly key: string;
  readonly object: GameObject;
  readonly asset: ScriptAsset;
  readonly iterator: Generator<void, void, void>;
  done: boolean;
}

interface ActiveDialog {
  readonly session: DialogSession;
  readonly speaker: GameObject;
  readonly player: 1 | 2;
  /** Highlight keys of the last tick, so holding a key moves only once. */
  readonly wasLocked: boolean;
}

interface TransformSnapshot {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
}

const ORIGIN = new Vector3();

/** Components that make NPCs act; they pause while a dialog is open. */
const NPC_BEHAVIORS = new Set(['patrol', 'wander', 'follow', 'guard', 'attack', 'navAgent']);

/** Shapes count as touching up to this distance (physics keeps resting bodies apart). */
const CONTACT_MARGIN = 0.02;

/** Bounds of an object's own meshes, cached by mesh set (for mesh colliders). */
const meshBoundsCache = new WeakMap<GameObject, { key: string; bounds: MeshBounds }>();

function meshBoundsOf(object: GameObject): MeshBounds {
  // The key is cheap; the triangles are only collected when the meshes changed.
  const key = meshKey(ownMeshes(object.object3d));
  const cached = meshBoundsCache.get(object);
  if (cached?.key === key) return cached.bounds;
  const data = meshData(object.object3d);
  if (!data) return null;
  const bounds = {
    center: data.bounds.getCenter(new Vector3()),
    size: data.bounds.getSize(new Vector3()),
  };
  meshBoundsCache.set(object, { key, bounds });
  return bounds;
}

let cloneCounter = 0;

function defaultCloneId(): string {
  cloneCounter += 1;
  return `clone${cloneCounter.toString(36).padStart(7, '0')}`;
}

function easing(kind: Easing, t: number): number {
  switch (kind) {
    case 'linear':
      return t;
    case 'smooth':
      return t * t * (3 - 2 * t);
    case 'spring': {
      // Overshoots a little and settles (ease-out-back).
      const c = 1.70158;
      return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
    }
  }
}

function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  return typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
}

/**
 * A running game (play mode): a world built from a copy of the scene data, block-script
 * threads driven by a fixed 60 Hz scheduler, input, collisions and the services of
 * {@link GameApi}. Script errors stop only the failing thread and are reported via `log`.
 */
export class Game implements GameApi {
  readonly world: World;
  readonly input = new InputState();
  /** Number of logic ticks run so far. */
  tick = 0;
  /** Speed factor (1 normal, 0.5 and 0.25 slow motion). */
  timeScale = 1;
  paused = false;
  readonly vars: Record<string, VariableValue> = {};

  private readonly options: GameOptions;
  private readonly random_: () => number;
  private threads: Thread[] = [];
  private readonly running = new Map<string, Thread>();
  private readonly attached = new Map<GameObject, AttachedScript[]>();
  private readonly touchingBefore = new Map<GameObject, Set<GameObject>>();
  private readonly destroyQueue = new Set<GameObject>();
  private readonly recentlyRun = new Map<string, { thread: Thread; tick: number }>();
  private readonly clickQueue: GameObject[] = [];
  private readonly monitorEntries = new Map<
    string,
    { name: string; owner: GameObject | null; scope: VariableScope; id: string }
  >();
  private readonly previous = new Map<GameObject, TransformSnapshot>();
  /** Objects of prefabs spawned by scripts, by template ID (`prefab:<asset>/<id>`). */
  private readonly templates = new Map<string, SceneObjectData>();
  private readonly logical = new Map<GameObject, TransformSnapshot>();
  private accumulator = 0;
  private readonly npcCommands = new NpcCommands();
  private readonly hints: Record<1 | 2, InteractionHint | null> = { 1: null, 2: null };
  private dialog: ActiveDialog | null = null;
  private sceneRequest: SceneRequest | null = null;
  private gamePaused_ = false;
  private quitRequested_ = false;
  private readonly attachedSavedVars = new Set<string>();
  private noticeState: { key: string; at: number } | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  readonly settings: GameSettings;
  private readonly timers = new Map<GameObject, Map<string, number>>();
  private readonly loopObjects = new WeakMap<Thread, GameObject>();
  private timerStart = 0;
  private current: Thread | null = null;
  private pointer: { ndc: Vector2 } | null = null;
  private viewAspect = 16 / 9;

  /** Physics of the game; `null` until the physics engine is loaded ({@link initPhysics}). */
  readonly physics: Physics | null;
  /** Input actions of the two players. */
  readonly players = { 1: new PlayerInput(1), 2: new PlayerInput(2) } as const;
  private readonly transitions = new CameraTransitions();

  /** The cameras to render (one, or two for split screen), with smooth camera transitions. */
  views(): GameViews {
    return this.transitions.views(this.world);
  }
  private readonly tickContext: TickContext;

  /** The game's sound system (3D sounds, music, volumes). */
  readonly audio: AudioEngine;
  private readonly characterSounds: CharacterSounds;

  constructor(scene: SceneData, options: GameOptions) {
    this.options = options;
    this.settings = options.settings ?? new GameSettings();
    this.random_ = options.random ?? Math.random;
    this.world = new World(structuredClone(scene), options);
    this.audio = options.audio ?? new AudioEngine();
    this.world.audio = this.audio;
    this.world.showNpcStates = true;
    this.characterSounds = new CharacterSounds(this.world, this.audio, this.random_);
    const rapier = loadedRapier();
    this.physics = rapier
      ? new Physics(rapier, this.world, {
          ...DEFAULT_PHYSICS,
          ...options.physics,
          gravity: scene.environment.gravity ?? options.physics?.gravity ?? DEFAULT_PHYSICS.gravity,
        })
      : null;
    const time = (): number => this.time;
    this.tickContext = {
      dt: TICK_SECONDS,
      get time() {
        return time();
      },
      world: this.world,
      physics: this.physics,
      input: (player) => this.players[player],
      random: () => this.random_(),
    };
    for (const object of this.world.allObjects()) this.attachScripts(object, null);
    if (options.carry) this.applyCarry(options.carry, options.spawn ?? '');
    if (options.save) this.applySave(options.save);
    this.applySettings();
    this.unsubscribeSettings = this.settings.onChange(() => this.applySettings());
  }

  // ---------------------------------------------------------------- settings, pause, UI, saves

  /** Puts the player's settings to work: mixer volumes, graphics level, mouse and keys. */
  private applySettings(): void {
    const values = this.settings.values;
    this.audio.setVolume('master', values.masterVolume / 100);
    const volumes = {
      music: values.musicVolume,
      effects: values.effectsVolume,
      voices: values.voicesVolume,
    } as const;
    for (const bus of AUDIO_BUSES) this.audio.setVolume(bus, volumes[bus] / 100);
    if (values.graphicsLevel) setQuality(values.graphicsLevel);
    for (const player of [1, 2] as const) {
      this.players[player].sensitivity = values.mouseSensitivity;
      this.players[player].setBindings(bindingsFor(player, values.bindings[player]));
    }
  }

  /** Whether the player paused the game (Esc, pause menu); the logic does not run meanwhile. */
  get gamePaused(): boolean {
    return this.gamePaused_;
  }

  /** Pauses or resumes the game for the player. */
  setGamePaused(paused: boolean): void {
    this.gamePaused_ = paused;
  }

  /** The player asked to quit (menu button); the host ends the game. */
  get quitRequested(): boolean {
    return this.quitRequested_;
  }

  /** A short message the UI shows for a moment ("saved", "no save in this slot"). */
  get notice(): { readonly key: string; readonly at: number } | null {
    return this.noticeState;
  }

  /** Item names and counts the player carries. */
  playerItems(player: 1 | 2): [string, number][] {
    const object = playerObject(this.world, player);
    return object ? (peekInventory(object)?.entries() ?? []) : [];
  }

  /** The value a UI element is bound to: `value` of `max` (max is `null` for plain numbers). */
  bindingValue(binding: UiBinding, player: 1 | 2): { value: number; max: number | null } {
    const object = playerObject(this.world, player);
    switch (binding.kind) {
      case 'health': {
        const health = object ? peekHealth(object) : undefined;
        return { value: health?.current ?? 0, max: health?.max ?? 100 };
      }
      case 'stamina':
        return { value: object ? gameplay.staminaPercent(object) : 0, max: 100 };
      case 'item':
        return { value: object ? (peekInventory(object)?.count(binding.item) ?? 0) : 0, max: null };
      case 'variable': {
        const raw = this.vars[binding.variable];
        return { value: typeof raw === 'number' ? raw : Number(raw) || 0, max: null };
      }
      case 'loading':
        return { value: 0, max: 1 };
    }
  }

  /** The text of a bound variable (strings and booleans keep their form), or `null` for other bindings. */
  bindingText(binding: UiBinding): string | null {
    if (binding.kind !== 'variable') return null;
    const raw = this.vars[binding.variable];
    return raw === undefined ? '' : String(raw);
  }

  /** The canvases to draw now, back to front; `modal` ones are menus that need the mouse. */
  uiCanvases(): {
    key: string;
    ui: UiData;
    player: 'all' | '1' | '2';
    order: number;
    modal: boolean;
  }[] {
    const result: {
      key: string;
      ui: UiData;
      player: 'all' | '1' | '2';
      order: number;
      modal: boolean;
    }[] = [];
    for (const object of this.world.allObjects()) {
      if (object.destroyed || !object.activeInHierarchy) continue;
      const state = uiCanvasRegistry.get(object);
      if (!state?.ui) continue;
      const visible =
        state.visibility === 'always' ||
        (state.visibility === 'paused' && this.gamePaused_) ||
        (state.visibility === 'manual' && state.shown);
      if (!visible) continue;
      const ui = this.options.uis?.(state.ui);
      if (ui) {
        result.push({
          key: object.id,
          ui,
          player: state.player,
          order: state.order,
          modal: state.visibility !== 'always',
        });
      }
    }
    return result.sort((a, b) => a.order - b.order);
  }

  /** Shows the canvases that use a UI asset and are opened by hand. */
  showUi(_self: GameObject | null, ui: string): void {
    this.setUiShown(ui.replace(/^ui:/, ''), true);
  }

  /** Hides them again. */
  hideUi(_self: GameObject | null, ui: string): void {
    this.setUiShown(ui.replace(/^ui:/, ''), false);
  }

  private setUiShown(ui: string, shown: boolean): void {
    for (const object of this.world.allObjects()) {
      const state = uiCanvasRegistry.get(object);
      if (state && state.ui === ui) state.shown = shown;
    }
  }

  /** Does what a UI button asks for. */
  runUiAction(action: UiAction): void {
    switch (action.type) {
      case 'sendMessage':
        this.world.messages.send(action.message, { kind: 'all' }, null);
        break;
      case 'showUi':
        this.setUiShown(action.ui, true);
        break;
      case 'hideUi':
        this.setUiShown(action.ui, false);
        break;
      case 'loadScene':
        if (action.scene) this.sceneRequest = { scene: action.scene, spawn: action.spawn };
        break;
      case 'resume':
        this.gamePaused_ = false;
        break;
      case 'restart':
        this.gamePaused_ = false;
        this.restartScene();
        break;
      case 'saveGame':
        this.saveGame(action.slot);
        break;
      case 'loadGame':
        this.loadGame(action.slot);
        break;
      case 'quit':
        this.quitRequested_ = true;
        break;
    }
  }

  /** IDs of the game variables that go into a save. */
  private savedIds(): Set<string> {
    return new Set([...(this.options.savedVariables ?? []), ...this.attachedSavedVars]);
  }

  /** Writes the game into a slot: scene, saved variables and the players. Returns false if it cannot. */
  saveGame(slot: number): boolean {
    const storage = this.options.saves;
    const scene = this.options.sceneId;
    if (!storage || !scene || !Number.isInteger(slot) || slot < 1 || slot > SAVE_SLOTS) {
      this.noticeState = { key: 'saveFailed', at: this.tick };
      return false;
    }
    const vars: Record<string, VariableValue> = {};
    for (const id of this.savedIds()) {
      const value = this.vars[id];
      if (value !== undefined) vars[id] = cloneValue(value);
    }
    const players = this.playerObjects().map((object) => {
      const health = peekHealth(object);
      const stamina = controlRegistry.get(object)?.stamina;
      return {
        position: object.worldPosition().toArray() as [number, number, number],
        yaw: MathUtils.radToDeg(object.object3d.rotation.y),
        items: peekInventory(object)?.snapshot() ?? {},
        health: health ? { current: health.current, max: health.max } : null,
        stamina: stamina === null || stamina === undefined ? null : gameplay.staminaPercent(object),
      };
    });
    storage.write(slot, {
      formatVersion: FORMAT_VERSION,
      slot,
      scene,
      sceneName: this.options.sceneName ?? '',
      savedAt: new Date().toISOString(),
      vars,
      players,
    });
    this.noticeState = { key: 'saved', at: this.tick };
    return true;
  }

  /** Asks the host to continue from a slot (the scene is built like after a scene change). */
  loadGame(slot: number): boolean {
    const data = this.options.saves?.read(slot) ?? null;
    if (!data) {
      this.noticeState = { key: 'noSave', at: this.tick };
      return false;
    }
    this.gamePaused_ = false;
    this.sceneRequest = { scene: data.scene, spawn: '', save: data };
    return true;
  }

  /** Whether a slot holds a save. */
  slotUsed(slot: number): boolean {
    return (this.options.saves?.read(slot) ?? null) !== null;
  }

  /** Puts a save back: saved variables, and per player the position, items, health and stamina. */
  private applySave(save: SaveData): void {
    for (const [key, value] of Object.entries(save.vars)) this.vars[key] = cloneValue(value);
    const players = this.playerObjects();
    players.forEach((object, index) => {
      const kept = save.players[index];
      if (!kept) return;
      restorePlayer(
        object,
        { items: kept.items, health: kept.health, stamina: kept.stamina },
        gameplay.setStamina,
      );
      object.setWorldPosition(new Vector3(...kept.position));
      object.object3d.rotation.y = MathUtils.degToRad(kept.yaw);
      this.physics?.setVelocity(object, new Vector3());
    });
  }

  // ---------------------------------------------------------------- scenes

  /** Asset ID of the scene this game plays, if the host named it. */
  get sceneId(): string | null {
    return this.options.sceneId ?? null;
  }

  /** Asks the host to change the scene; "load scene" blocks call this. */
  loadScene(_self: GameObject, scene: string, spawn = ''): void {
    const id = this.str(scene).replace(/^scene:/, '');
    if (id) this.sceneRequest = { scene: id, spawn: this.str(spawn) };
  }

  /** Asks the host to start the current scene again. */
  restartScene(): void {
    if (this.options.sceneId) this.sceneRequest = { scene: this.options.sceneId, spawn: '' };
  }

  /** The scene change the scripts asked for, once; the host then builds the next game. */
  takeSceneRequest(): SceneRequest | null {
    const request = this.sceneRequest;
    this.sceneRequest = null;
    return request;
  }

  /** What the next scene's game takes over: variables, items and health of the players. */
  exportCarry(): CarryState {
    return {
      vars: Object.fromEntries(Object.entries(this.vars).map(([k, v]) => [k, cloneValue(v)])),
      players: collectPlayers(this.playerObjects(), (object) => {
        const percent = gameplay.staminaPercent(object);
        return controlRegistry.get(object)?.stamina === null ? null : percent;
      }),
    };
  }

  /** The objects players control (player 1, player 2), then anything else tagged `Player`. */
  private playerObjects(): GameObject[] {
    const found: GameObject[] = [];
    for (const player of [1, 2] as const) {
      const object = playerObject(this.world, player);
      if (object) found.push(object);
    }
    for (const object of this.world.allObjects()) {
      if (object.tag === 'Player' && !object.destroyed && !found.includes(object)) {
        found.push(object);
      }
    }
    return found;
  }

  /** Takes over the state of the previous scene and puts the players at the spawn point. */
  private applyCarry(carry: CarryState, spawn: string): void {
    for (const [key, value] of Object.entries(carry.vars)) this.vars[key] = cloneValue(value);
    const players = this.playerObjects();
    players.forEach((object, index) => {
      const kept = carry.players[index];
      if (kept) restorePlayer(object, kept, gameplay.setStamina);
    });
    const spawns = [...this.world.allObjects()].filter((object) => object.tag === 'Spawn');
    const point = spawns.find((object) => object.name === spawn) ?? (spawn ? undefined : spawns[0]);
    const first = players[0];
    if (point && first) {
      first.setWorldPosition(point.worldPosition());
      this.physics?.setVelocity(first, new Vector3());
    }
  }

  /** Runs the components' tick at a stage (SPEC 8.1). */
  private tickComponents(stage: TickStage): void {
    for (const object of this.world.allObjects()) {
      if (object.destroyed || !object.activeInHierarchy) continue;
      for (const component of object.components) {
        if (component.enabled && component.behavior.tick) {
          if (this.dialog && NPC_BEHAVIORS.has(component.definition.type)) continue;
          component.behavior.tick(stage, this.tickContext);
        }
      }
    }
  }

  /** Which gamepad each player uses: with one gamepad and a second player, player 2 gets it. */
  private gamepadIndices(): { 1: number | null; 2: number | null } {
    const pads = this.input.connectedGamepads();
    if (pads.length === 1 && this.hasSecondPlayer()) return { 1: null, 2: pads[0] ?? null };
    return { 1: pads[0] ?? null, 2: pads[1] ?? null };
  }

  /** Whether the game turns its view with the mouse (the host then captures the pointer). */
  wantsMouseLook(): boolean {
    const types = new Set(['firstPersonControl', 'firstPersonCamera', 'thirdPersonCamera']);
    for (const object of this.world.allObjects()) {
      if (object.activeInHierarchy && object.components.some((c) => types.has(c.definition.type)))
        return true;
    }
    return false;
  }

  private secondPlayer: boolean | null = null;

  /** Whether any component is set to player 2 (controls, cameras). */
  private hasSecondPlayer(): boolean {
    if (this.secondPlayer === null) {
      this.secondPlayer = [...this.world.allObjects()].some((object) =>
        object.components.some((component) => component.values['player'] === '2'),
      );
    }
    return this.secondPlayer;
  }

  // ---------------------------------------------------------------- frame loop

  /** Seconds of logic time since the game started. */
  get time(): number {
    return this.tick * TICK_SECONDS;
  }

  /**
   * Advances the game by real time: runs as many 60 Hz ticks as fit (scaled by `timeScale`)
   * and returns the interpolation factor (0..1) for rendering between the last two ticks.
   */
  advance(realSeconds: number): number {
    if (!this.paused && !this.gamePaused_) {
      this.accumulator += Math.min(Math.max(realSeconds, 0), 0.25) * this.timeScale;
      let ticks = 0;
      while (this.accumulator >= TICK_SECONDS - 1e-9 && ticks < MAX_TICKS_PER_FRAME) {
        this.stepTick();
        this.accumulator -= TICK_SECONDS;
        ticks++;
      }
      if (ticks === MAX_TICKS_PER_FRAME) this.accumulator = 0;
    }
    return Math.max(0, this.accumulator) / TICK_SECONDS;
  }

  /** Runs exactly one logic tick (Unity: Step), also while paused. */
  stepTick(): void {
    // Order of SPEC 8.1: input, components, scripts, character controllers, physics, events,
    // spawn/destroy, animation, camera.
    this.input.beginTick();
    const pads = this.gamepadIndices();
    this.players[1].update(this.input, pads[1], TICK_SECONDS);
    this.players[2].update(this.input, pads[2], TICK_SECONDS);
    this.snapshotTransforms();
    this.updateTimers();
    this.deliverMessages();
    this.deliverObjectEvents();
    this.tickComponents('control');
    // While someone talks, the NPCs wait (nothing sneaks up on the player in a dialog).
    if (!this.dialog) {
      this.npcCommands.update(this.world, TICK_SECONDS, () => this.random_());
      this.updateNpcStates();
    }
    this.updateDialog();
    this.updateInteraction();
    if (this.tick === 0) this.fire('start', () => true, false);
    this.fire('update', () => true, false);
    this.fire(
      'key',
      (params) => this.keyMatches(params),
      (params) => params['mode'] !== 'held',
    );
    for (const object of this.clickQueue.splice(0)) {
      this.fireFor(object, 'click', () => true, true);
    }
    this.fire(
      'action',
      (params) => this.actionMatches(params),
      (params) => params['phase'] !== 'held',
    );
    this.stepThreads(this.threads);
    this.physics?.sync();
    if (this.world.navigationInUse && !this.dialog) this.world.navigation.update(TICK_SECONDS);
    this.tickComponents('character');
    if (this.physics) {
      this.physics.sync();
      this.physics.step();
      for (const event of this.physics.takeZoneEvents()) this.zoneEvent(event);
    }
    this.touchEvents();
    this.processDestroyQueue();
    this.tickComponents('animate');
    this.animationEvents();
    this.tickComponents('camera');
    this.transitions.update(this.world, TICK_SECONDS);
    this.tick += 1;
    this.world.environment.advance(TICK_SECONDS);
    this.world.effects.update(TICK_SECONDS);
    this.world.updateSun();
    this.updateAudio();
  }

  /** Audio positions (SPEC 8.1): the listener, weather sounds, character sounds. */
  private updateAudio(): void {
    const listener = audioListenerCamera(this.world);
    if (listener) this.audio.setListener(listener.position, listener.forward, listener.up);
    const weather = this.world.environment.weather.state;
    this.audio.updateWeather(weather.type, weather.intensity, weather.windSpeed);
    this.characterSounds.update(TICK_SECONDS);
  }

  /** Whether an action event (`when action [jump] [started] for [player]`) fires now. */
  private actionMatches(params: Readonly<Record<string, string | number | boolean>>): boolean {
    const action = String(params['action'] ?? 'jump') as ButtonAction;
    const phase = String(params['phase'] ?? 'pressed');
    const who = String(params['player'] ?? 'any');
    const players =
      who === '1' ? [1 as const] : who === '2' ? [2 as const] : [1 as const, 2 as const];
    return players.some((player) => {
      const input = this.players[player];
      if (phase === 'held') return input.isHeld(action);
      if (phase === 'released') return input.wasReleased(action);
      return input.wasPressed(action);
    });
  }

  /** How often each ability (`roll:started`) and animation (`animation:step:started`) event happened (tests, statistics). */
  readonly eventCounts: Record<string, number> = {};

  private count(key: string): void {
    this.eventCounts[key] = (this.eventCounts[key] ?? 0) + 1;
  }

  /** Hands ability and animation events to scripts; events of objects without scripts are dropped. */
  private animationEvents(): void {
    for (const object of [...this.world.allObjects()]) {
      for (const event of controlRegistry.get(object)?.takeEvents() ?? []) {
        this.count(`${event.ability}:${event.phase}`);
        this.fireFor(
          object,
          'ability',
          (params) =>
            String(params['ability'] ?? 'roll') === event.ability &&
            String(params['phase'] ?? 'started') === event.phase,
          true,
        );
      }
      for (const event of animatorRegistry.get(object)?.takeEvents() ?? []) {
        this.count(`animation:${event.name}:${event.phase}`);
        if (event.phase === 'started') this.characterSounds.onAnimationEvent(object, event.name);
        this.fireFor(
          object,
          'animation',
          (params) =>
            String(params['phase'] ?? 'finished') === event.phase &&
            String(params['animation'] ?? '').toLowerCase() === event.name.toLowerCase(),
          true,
        );
      }
    }
  }

  private zoneEvent(event: ZoneEvent): void {
    if (event.zone.destroyed || event.other.destroyed) return;
    this.fireFor(
      event.zone,
      'zone',
      (params) =>
        String(params['phase'] ?? 'enter') === (event.entered ? 'enter' : 'exit') &&
        this.matches(event.zone, event.other, String(params['target'] ?? 'any')),
      true,
    );
  }

  /**
   * Renders with interpolated transforms: objects are placed between the previous and the
   * current tick while `draw` runs, then restored to their logical state.
   */
  renderInterpolated(alpha: number, draw: () => void): void {
    const t = Math.min(Math.max(alpha, 0), 1);
    this.logical.clear();
    for (const [object, before] of this.previous) {
      if (object.destroyed) continue;
      const node = object.object3d;
      if (
        node.position.equals(before.position) &&
        node.quaternion.equals(before.quaternion) &&
        node.scale.equals(before.scale)
      ) {
        continue;
      }
      this.logical.set(object, {
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
        scale: node.scale.clone(),
      });
      node.position.lerpVectors(before.position, node.position, t);
      node.quaternion.slerpQuaternions(before.quaternion, node.quaternion, t);
      node.scale.lerpVectors(before.scale, node.scale, t);
    }
    try {
      draw();
    } finally {
      for (const [object, state] of this.logical) {
        object.object3d.position.copy(state.position);
        object.object3d.quaternion.copy(state.quaternion);
        object.object3d.scale.copy(state.scale);
      }
      this.logical.clear();
    }
  }

  /** Reports a click on an object in the game view (fires "when this object is clicked"). */
  click(objectId: string): void {
    const object = this.world.getObject(objectId);
    if (object) this.clickQueue.push(object);
  }

  /**
   * Sets the mouse position in the game view: pixels from the center (+Y up) and normalized
   * device coordinates for rays into the scene.
   */
  setPointer(x: number, y: number, ndcX: number, ndcY: number, aspect: number): void {
    this.input.mouseX = x;
    this.input.mouseY = y;
    this.pointer = { ndc: new Vector2(ndcX, ndcY) };
    this.viewAspect = aspect;
  }

  /** On-screen variable displays with their current values. */
  monitors(): VariableMonitor[] {
    const result: VariableMonitor[] = [];
    for (const [key, entry] of this.monitorEntries) {
      if (entry.owner?.destroyed) continue;
      const value = entry.scope === 'game' ? this.vars[entry.id] : entry.owner?.vars[entry.id];
      result.push({
        key,
        name: entry.name,
        objectName: entry.owner?.name ?? null,
        value: value ?? 0,
      });
    }
    return result;
  }

  /**
   * Hat blocks whose scripts are running (for highlighting in the block editor), including
   * scripts that ran within the last `recentTicks` ticks.
   */
  runningScripts(recentTicks = 0): { objectId: string; assetId: string; hatId: string }[] {
    const result = new Map<string, { objectId: string; assetId: string; hatId: string }>();
    const describe = (thread: Thread) => ({
      objectId: thread.object.id,
      assetId: thread.asset.assetId,
      hatId: thread.key.slice(thread.key.indexOf('|') + 1),
    });
    for (const thread of this.threads) if (!thread.done) result.set(thread.key, describe(thread));
    // Scripts that finished within the last ticks also count (so short scripts can glow).
    for (const [key, entry] of this.recentlyRun) {
      if (this.tick - entry.tick > recentTicks) this.recentlyRun.delete(key);
      else if (!result.has(key)) result.set(key, describe(entry.thread));
    }
    return [...result.values()];
  }

  /**
   * Hot reload: replaces a compiled script. Threads whose hat block still exists continue
   * only if its code did not change; changed or removed scripts are stopped and restarted
   * by their next event ("when game starts" scripts restart right away).
   */
  replaceScript(asset: ScriptAsset): void {
    for (const [object, scripts] of this.attached) {
      const index = scripts.findIndex((script) => script.asset.assetId === asset.assetId);
      if (index < 0) continue;
      const old = scripts[index];
      if (!old) continue;
      const oldSources = new Map(old.entries.map((entry) => [entry.id, entry.run.toString()]));
      scripts[index] = { asset, entries: asset.module.scripts };
      for (const variable of asset.variables) {
        if (variable.scope === 'object' && !(variable.id in object.vars))
          object.vars[variable.id] = cloneValue(variable.default);
        if (variable.scope === 'game' && !(variable.id in this.vars))
          this.vars[variable.id] = cloneValue(variable.default);
        if (variable.scope === 'game' && variable.saved) this.attachedSavedVars.add(variable.id);
      }
      for (const entry of asset.module.scripts) {
        const key = `${object.id}|${entry.id}`;
        const thread = this.running.get(key);
        const changed = oldSources.get(entry.id) !== entry.run.toString();
        if (thread && changed) {
          this.kill(thread);
          if (entry.event.type === 'start') this.startThread(object, asset, entry, true);
        }
      }
      for (const [entryId] of oldSources) {
        if (!asset.module.scripts.some((entry) => entry.id === entryId)) {
          const thread = this.running.get(`${object.id}|${entryId}`);
          if (thread) this.kill(thread);
        }
      }
    }
  }

  /** Stops everything and frees the world. */
  dispose(): void {
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    for (const thread of this.threads) thread.done = true;
    this.threads = [];
    this.running.clear();
    this.physics?.dispose();
    this.audio.dispose();
    this.world.dispose();
  }

  // ---------------------------------------------------------------- GameApi: values

  get timer(): number {
    return this.time - this.timerStart;
  }

  get mouseX(): number {
    return this.input.mouseX;
  }

  get mouseY(): number {
    return this.input.mouseY;
  }

  get mouseDown(): boolean {
    return this.input.mouseDown;
  }

  num(value: unknown): number {
    if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const number = Number(value);
      return Number.isNaN(number) ? 0 : number;
    }
    return 0;
  }

  str(value: unknown): string {
    return valueToText(value);
  }

  bool(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      return lower !== '' && lower !== '0' && lower !== 'false';
    }
    return false;
  }

  compare(a: unknown, b: unknown): number {
    if (isNumeric(a) && isNumeric(b)) return this.num(a) - this.num(b);
    const left = this.str(a).toLowerCase();
    const right = this.str(b).toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }

  mod(a: number, b: number): number {
    if (b === 0) return Number.NaN;
    return ((a % b) + b) % b;
  }

  mathFunction(name: MathFunction, value: number): number {
    const radians = MathUtils.degToRad(value);
    const round10 = (x: number): number => Math.round(x * 1e10) / 1e10;
    switch (name) {
      case 'abs':
        return Math.abs(value);
      case 'floor':
        return Math.floor(value);
      case 'ceiling':
        return Math.ceil(value);
      case 'sqrt':
        return Math.sqrt(value);
      case 'sin':
        return round10(Math.sin(radians));
      case 'cos':
        return round10(Math.cos(radians));
      case 'tan':
        return round10(Math.tan(radians));
      case 'ln':
        return Math.log(value);
      case 'exp':
        return Math.exp(value);
    }
  }

  random(from: number, to: number): number {
    const low = Math.min(from, to);
    const high = Math.max(from, to);
    if (Number.isInteger(low) && Number.isInteger(high)) {
      return low + Math.floor(this.random_() * (high - low + 1));
    }
    return low + this.random_() * (high - low);
  }

  letterOf(index: number, text: string): string {
    const characters = Array.from(text);
    return characters[Math.floor(index) - 1] ?? '';
  }

  contains(text: string, part: string): boolean {
    return text.toLowerCase().includes(part.toLowerCase());
  }

  // ---------------------------------------------------------------- GameApi: lists, dictionaries

  split(text: string, separator: string): VariableValue[] {
    return text === '' ? [] : text.split(separator);
  }
  listAdd(list: unknown, item: VariableValue): void {
    listOps.add(list, item);
  }
  listInsert(list: unknown, index: number, item: VariableValue): void {
    listOps.insert(list, index, item);
  }
  listRemoveAt(list: unknown, index: number): void {
    listOps.removeAt(list, index);
  }
  listSet(list: unknown, index: number, item: VariableValue): void {
    listOps.set(list, index, item);
  }
  listClear(list: unknown): void {
    listOps.clear(list);
  }
  listGet(list: unknown, index: number): VariableValue {
    return listOps.get(list, index);
  }
  listLength(list: unknown): number {
    return listOps.length(list);
  }
  listIndexOf(list: unknown, item: unknown): number {
    return listOps.indexOf(list, item);
  }
  listJoin(list: unknown, separator: string): string {
    return listOps.join(list, separator);
  }
  items(value: unknown): VariableValue[] {
    return listOps.items(value);
  }
  dictSet(dictionary: unknown, key: string, value: VariableValue): void {
    dictOps.set(dictionary, key, value);
  }
  dictRemove(dictionary: unknown, key: string): void {
    dictOps.remove(dictionary, key);
  }
  dictGet(dictionary: unknown, key: string): VariableValue {
    return dictOps.get(dictionary, key);
  }
  dictHas(dictionary: unknown, key: string): boolean {
    return dictOps.has(dictionary, key);
  }
  dictKeys(dictionary: unknown): VariableValue[] {
    return dictOps.keys(dictionary);
  }
  dictSize(dictionary: unknown): number {
    return dictOps.size(dictionary);
  }

  // ---------------------------------------------------------------- GameApi: time

  *wait(seconds: number): Generator<void, void, void> {
    const end = this.time + Math.max(0, seconds);
    yield;
    while (this.time < end - 1e-9) yield;
  }

  *glideTo(
    self: GameObject,
    target: ObjectRef | readonly [number, number, number],
    seconds: number,
    kind: Easing,
  ): Generator<void, void, void> {
    const end =
      typeof target === 'string' ? this.worldPositionOf(self, target) : new Vector3(...target);
    if (!end) return;
    const start = self.worldPosition();
    const ticks = Math.max(1, Math.round(Math.max(0, seconds) / TICK_SECONDS));
    for (let i = 1; i <= ticks; i++) {
      self.setWorldPosition(start.clone().lerp(end, easing(kind, i / ticks)));
      yield;
    }
  }

  // ---------------------------------------------------------------- GameApi: messages and timers

  sendMessage(self: GameObject, message: string, target: ObjectRef): void {
    const text = this.str(message);
    if (target === 'all' || target === 'any') {
      this.world.messages.send(text, { kind: 'all' }, self);
    } else if (target.startsWith('tag:')) {
      this.world.messages.send(text, { kind: 'tag', tag: target.slice(4) }, self);
    } else {
      const object = this.find(self, target);
      if (object) this.world.messages.send(text, { kind: 'object', object }, self);
    }
  }

  startTimer(self: GameObject, name: string, seconds: number): void {
    const timers = this.timers.get(self) ?? new Map<string, number>();
    timers.set(this.str(name), Math.max(0, this.num(seconds)));
    this.timers.set(self, timers);
  }

  objectsMatching(self: GameObject, ref: ObjectRef): GameObject[] {
    if (ref === 'all' || ref === 'any') {
      return [...this.world.allObjects()].filter((object) => object.activeInHierarchy);
    }
    if (ref.startsWith('tag:')) {
      const tag = ref.slice(4);
      return [...this.world.allObjects()].filter(
        (object) => object.tag === tag && object.activeInHierarchy,
      );
    }
    const found = this.find(self, ref);
    return found ? [found] : [];
  }

  setLoopObject(object: GameObject): void {
    if (this.current) this.loopObjects.set(this.current, object);
  }

  /** Counts the timers down and starts "When timer [x] runs out" scripts (SPEC 8.1: after input). */
  private updateTimers(): void {
    for (const [object, timers] of this.timers) {
      if (object.destroyed) {
        this.timers.delete(object);
        continue;
      }
      for (const [name, left] of [...timers]) {
        const next = left - TICK_SECONDS;
        if (next > 1e-9) {
          timers.set(name, next);
          continue;
        }
        timers.delete(name);
        this.fireFor(object, 'timer', (params) => String(params['name'] ?? '') === name, true);
      }
      if (timers.size === 0) this.timers.delete(object);
    }
  }

  /** Delivers the messages queued since the last tick. */
  private deliverMessages(): void {
    for (const { message, target } of this.world.messages.take()) {
      const recipients =
        target.kind === 'object'
          ? [target.object]
          : [...this.world.allObjects()].filter(
              (object) => target.kind === 'all' || object.tag === target.tag,
            );
      for (const object of recipients) {
        this.fireFor(
          object,
          'message',
          (params) => String(params['message'] ?? '') === message,
          true,
        );
      }
    }
  }

  // ---------------------------------------------------------------- GameApi: items and combat

  private get itemsContext(): itemsApi.ItemsContext {
    return {
      world: this.world,
      resolve: (self, ref) => npcApi.resolveNearest(this.npcContext, self, ref),
    };
  }

  addItem(self: GameObject, target: ObjectRef, item: string, count: number): void {
    itemsApi.addItem(this.itemsContext, self, target, this.str(item), this.num(count));
  }

  removeItem(self: GameObject, target: ObjectRef, item: string, count: number): boolean {
    return itemsApi.removeItem(this.itemsContext, self, target, this.str(item), this.num(count));
  }

  hasItem(self: GameObject, target: ObjectRef, item: string): boolean {
    return itemsApi.hasItem(this.itemsContext, self, target, this.str(item));
  }

  itemCount(self: GameObject, target: ObjectRef, item: string): number {
    return itemsApi.itemCount(this.itemsContext, self, target, this.str(item));
  }

  operateThing(self: GameObject, target: ObjectRef, action: 'open' | 'close' | 'toggle'): void {
    itemsApi.operateThing(this.itemsContext, self, target, action);
  }

  pickUp(self: GameObject, target: ObjectRef): void {
    itemsApi.pickUp(this.itemsContext, self, target);
  }

  damageObject(self: GameObject, target: ObjectRef, amount: number): void {
    itemsApi.damage(this.itemsContext, self, target, this.num(amount));
  }

  healObject(self: GameObject, target: ObjectRef, amount: number): void {
    itemsApi.heal(this.itemsContext, self, target, this.num(amount));
  }

  healthOfObject(self: GameObject, target: ObjectRef): number {
    return itemsApi.healthPoints(this.itemsContext, self, target);
  }

  /** What the Interact action would do for a player now (for the hint in the Game view). */
  interactionHint(player: 1 | 2): InteractionHint | null {
    return this.hints[player];
  }

  /** Lets the players use what is in front of them and keeps the hints up to date. */
  private updateInteraction(): void {
    if (this.dialog) {
      this.hints[1] = null;
      this.hints[2] = null;
      return;
    }
    for (const player of [1, 2] as const) {
      const user = playerObject(this.world, player);
      const best = user ? this.world.interactables.best(user) : null;
      this.hints[player] = user && best ? best.hint(user) : null;
      if (user && best && this.players[player].wasPressed('interact')) best.use(user);
    }
  }

  /** Starts the scripts waiting for events that components raised (hurt, used, opened …). */
  private deliverObjectEvents(): void {
    for (const event of this.world.objectEvents.take()) {
      if (event.object.destroyed) continue;
      this.fireFor(
        event.object,
        event.type,
        (params) =>
          Object.entries(event.params).every(
            ([key, value]) => String(params[key]) === String(value),
          ),
        true,
      );
    }
  }

  // ---------------------------------------------------------------- GameApi: dialogs

  /** The dialog box content now, or `null` while nobody talks. */
  dialogView(): DialogView | null {
    return this.dialog?.session.view() ?? null;
  }

  /** Whether a conversation is running. */
  get talking(): boolean {
    return this.dialog !== null;
  }

  /** Picks an answer by its position (mouse click on the dialog box). */
  chooseDialogAnswer(index: number): void {
    this.dialog?.session.choose(index);
    this.finishDialogIfDone();
  }

  /** Highlights the next or previous answer. */
  moveDialogSelection(delta: number): void {
    this.dialog?.session.move(delta);
  }

  /** Confirms the highlighted answer (or continues a line). */
  confirmDialog(): void {
    this.dialog?.session.confirm();
    this.finishDialogIfDone();
  }

  /** Starts a conversation; false if the asset does not exist or another one runs. */
  openDialog(speaker: GameObject, user: GameObject, assetId: string): boolean {
    const data = this.options.dialogs?.(assetId);
    if (!data || this.dialog) return false;
    const player: 1 | 2 = playerObject(this.world, 2) === user ? 2 : 1;
    const session = new DialogSession(data, this.dialogHost(speaker, user));
    const wasLocked = this.players[player].locked;
    this.players[player].locked = true;
    this.dialog = { session, speaker, player, wasLocked };
    this.finishDialogIfDone();
    return true;
  }

  /** "start dialog [x]": talks and waits until the conversation is over (use with `yield*`). */
  *startDialog(self: GameObject, ref: string): Generator<void, void, void> {
    const assetId = this.str(ref).replace(/^dialog:/, '');
    const user =
      playerObject(this.world, 1) ?? nearestWithTag(this.world, 'Player', self.worldPosition());
    if (!user) return;
    while (this.dialog) yield;
    if (!this.openDialog(self, user, assetId)) return;
    const mine = this.dialog;
    while (this.dialog && this.dialog === mine) yield;
  }

  private dialogHost(speaker: GameObject, user: GameObject): DialogHost {
    return {
      hasItem: (item, count) => (peekInventory(user)?.count(item) ?? 0) >= count,
      variable: (id) => {
        const value = this.vars[id];
        return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
          ? value
          : undefined;
      },
      answered: (answerId) => {
        for (const object of this.world.allObjects()) {
          if (!object.activeInHierarchy) continue;
          this.fireFor(
            object,
            'dialogAnswer',
            (params) => String(params['answer']) === answerId,
            true,
          );
        }
      },
      perform: (action) => {
        switch (action.type) {
          case 'setVariable':
            this.vars[action.variable] = action.value;
            break;
          case 'addItem':
            inventoryOf(user).add(action.item, action.count);
            break;
          case 'removeItem':
            inventoryOf(user).remove(action.item, action.count);
            break;
          case 'sendMessage':
            this.sendMessage(speaker, action.message, action.target);
            break;
          case 'startTimer':
            this.startTimer(speaker, action.name, action.seconds);
            break;
          case 'changeState': {
            const target = npcApi.resolveNearest(this.npcContext, speaker, action.target);
            if (target) npcApi.setState(target, action.state);
            break;
          }
        }
      },
    };
  }

  /** Ends the conversation once its session is over and gives the player control back. */
  private finishDialogIfDone(): void {
    const active = this.dialog;
    if (!active?.session.done) return;
    this.players[active.player].locked = active.wasLocked;
    this.dialog = null;
  }

  /** Starts requested conversations and reads the keys that drive the dialog box. */
  private updateDialog(): void {
    const requests = this.world.dialogRequests.splice(0);
    if (!this.dialog) {
      for (const request of requests) {
        if (this.openDialog(request.speaker, request.user, request.dialog)) break;
      }
      return;
    }
    const input = this.input;
    const padIndex = this.gamepadIndices()[this.dialog.player];
    const pad = padIndex === null ? null : input.gamepad(padIndex);
    const padPressed = (index: number): boolean => !!pad?.buttons[index]?.pressed;
    const pressed = (...keys: string[]): boolean => keys.some((key) => input.wasPressed(key));
    if (pressed('ArrowDown', 'S') || this.padEdge(12, padPressed(13))) this.moveDialogSelection(1);
    if (pressed('ArrowUp', 'W') || this.padEdge(13, padPressed(12))) this.moveDialogSelection(-1);
    for (let digit = 1; digit <= 9; digit++) {
      if (input.wasPressed(String(digit))) this.chooseDialogAnswer(digit - 1);
    }
    if (pressed('Enter', 'Space', 'E') || this.padEdge(14, padPressed(0) || padPressed(3))) {
      this.confirmDialog();
    }
  }

  private readonly padBefore = new Map<number, boolean>();

  /** Rising edge of a gamepad button (`key` identifies it). */
  private padEdge(key: number, now: boolean): boolean {
    const before = this.padBefore.get(key) ?? false;
    this.padBefore.set(key, now);
    return now && !before;
  }

  // ---------------------------------------------------------------- GameApi: NPCs

  private get npcContext(): npcApi.NpcContext {
    return { world: this.world, find: (self, ref) => this.find(self, ref), random: this.random_ };
  }

  /** Lets time pass in the NPC states and starts "When state [x]" scripts for new states. */
  private updateNpcStates(): void {
    for (const object of npcOwners()) {
      const state = npcStateOf(object);
      state.advance(TICK_SECONDS);
      for (const event of state.takeEvents()) {
        if (event.type !== 'enter') continue;
        this.fireFor(
          object,
          'state',
          (params) => String(params['state'] ?? '') === event.state,
          true,
        );
      }
    }
  }

  *navigateTo(self: GameObject, target: ObjectRef): Generator<void, void, void> {
    yield* npcApi.navigateTo(this.npcContext, this.npcCommands, self, target, TICK_SECONDS);
  }

  followTarget(self: GameObject, target: ObjectRef, distance: number): void {
    npcApi.followObject(this.npcContext, this.npcCommands, self, target, distance);
  }

  fleeFrom(self: GameObject, target: ObjectRef): void {
    npcApi.fleeFrom(this.npcContext, this.npcCommands, self, target);
  }

  wanderAround(self: GameObject, radius: number): void {
    npcApi.wanderAround(this.npcCommands, self, radius);
  }

  patrolRoute(self: GameObject, route: ObjectRef): void {
    npcApi.patrolRoute(this.npcContext, this.npcCommands, self, route);
  }

  stopWalking(self: GameObject): void {
    npcApi.stopWalking(this.npcCommands, self);
  }

  npcState(self: GameObject): string {
    return npcApi.stateOf(self);
  }

  setNpcState(self: GameObject, state: string): void {
    npcApi.setState(self, state);
  }

  sees(self: GameObject, target: ObjectRef): boolean {
    return npcApi.guardSees(this.npcContext, self, target);
  }

  hears(self: GameObject, target: ObjectRef): boolean {
    return npcApi.guardHears(this.npcContext, self, target);
  }

  resetTimer(): void {
    this.timerStart = this.time;
  }

  // ---------------------------------------------------------------- GameApi: objects

  keyDown(key: string): boolean {
    return this.input.isDown(key);
  }

  find(self: GameObject, ref: ObjectRef): GameObject | null {
    if (ref === 'self') return self;
    if (ref === 'loop') {
      const looped = this.current ? this.loopObjects.get(this.current) : undefined;
      return looped && !looped.destroyed ? looped : null;
    }
    if (ref.startsWith('object:')) {
      const object = this.world.getObject(ref.slice(7));
      return object && !object.destroyed ? object : null;
    }
    if (ref.startsWith('tag:')) {
      const tag = ref.slice(4);
      for (const object of this.world.allObjects()) {
        if (object !== self && object.tag === tag && object.activeInHierarchy) return object;
      }
    }
    return null;
  }

  touching(self: GameObject, ref: ObjectRef): boolean {
    return this.touchingObjects(self).some((other) => this.matches(self, other, ref));
  }

  distanceTo(self: GameObject, ref: ObjectRef): number {
    const target = this.worldPositionOf(self, ref);
    return target ? self.worldPosition().distanceTo(target) : 0;
  }

  propertyOf(self: GameObject, ref: ObjectRef, property: ObjectProperty): number {
    const object = this.find(self, ref);
    if (!object) return 0;
    const position = object.worldPosition();
    switch (property) {
      case 'x':
        return position.x;
      case 'y':
        return position.y;
      case 'z':
        return position.z;
      case 'heading':
        return object.heading;
      case 'size':
        return object.baseScale.x === 0
          ? 100
          : (object.object3d.scale.x / object.baseScale.x) * 100;
    }
  }

  goTo(self: GameObject, ref: ObjectRef): void {
    const target = this.worldPositionOf(self, ref);
    if (target) self.setWorldPosition(target);
  }

  // ---------------------------------------------------------------- GameApi: gameplay

  setControlValue(
    self: GameObject,
    setting: 'walkSpeed' | 'runSpeed' | 'jumpHeight',
    value: number,
  ): void {
    gameplay.setControlValue(self, setting, value);
  }

  jump(self: GameObject): void {
    gameplay.jump(self);
  }

  crouch(self: GameObject, on: boolean): void {
    gameplay.crouch(self, on);
  }

  lockControls(self: GameObject, locked: boolean): void {
    gameplay.lockControls(self, locked);
  }

  onGround(self: GameObject): boolean {
    return gameplay.onGround(self);
  }

  isRunning(self: GameObject): boolean {
    return gameplay.isRunning(self);
  }

  moveSpeed(self: GameObject): number {
    return gameplay.moveSpeed(self);
  }

  teleport(self: GameObject, ref: ObjectRef): void {
    this.goTo(self, ref);
    this.physics?.setVelocity(self, new Vector3());
  }

  attach(self: GameObject, item: string, point: string): void {
    gameplay.attachItem(self, item, point);
  }

  detach(self: GameObject, point: string): void {
    gameplay.detachItem(self, point);
  }

  setPartVisible(self: GameObject, part: string, visible: boolean): void {
    gameplay.setPartVisible(self, part, visible);
  }

  switchPart(self: GameObject, from: string, to: string): void {
    gameplay.switchPart(self, from, to);
  }

  setPartColor(self: GameObject, part: string, color: string): void {
    gameplay.setPartColor(self, part, color);
  }

  setProfile(self: GameObject, name: string): void {
    gameplay.setProfile(self, name);
  }

  enableAbility(self: GameObject, name: string, on: boolean): void {
    gameplay.enableAbility(self, name, on);
  }

  hasAbility(self: GameObject, name: string): boolean {
    return gameplay.hasAbility(self, name);
  }

  setStamina(self: GameObject, percent: number): void {
    gameplay.setStamina(self, percent);
  }

  staminaPercent(self: GameObject): number {
    return gameplay.staminaPercent(self);
  }

  setTimeOfDay(hours: number): void {
    this.world.environment.setTimeOfDay(hours);
  }

  timeOfDay(): number {
    return this.world.environment.timeOfDay ?? 12;
  }

  /** Lets the time run `factor` times faster than real time (1 = a real day, 0 = stands still). */
  setTimeSpeed(factor: number): void {
    const hours = this.world.environment.timeOfDay ?? 12;
    this.world.environment.setClock({
      timeOfDay: hours,
      dayLength: factor > 0 ? 86400 / factor : 0,
      sunAzimuth: 0,
    });
  }

  /** Changes the weather; it fades over `seconds` (the strength stays as set before). */
  setWeather(type: string, seconds: number): void {
    if (!isWeatherType(type)) return;
    const current = this.world.environment.weather.state;
    const intensity = type === 'clear' ? 0 : current.intensity > 0 ? current.intensity : 0.85;
    this.world.environment.setWeather({ ...current, type, intensity }, seconds <= 0, seconds);
  }

  weather(): string {
    return this.world.environment.weather.state.type;
  }

  setWind(speed: number, direction: number): void {
    const current = this.world.environment.weather.state;
    this.world.environment.setWeather(
      { ...current, windSpeed: Math.max(0, speed), windDirection: direction },
      false,
      0.5,
    );
  }

  setFogDensity(percent: number): void {
    this.world.environment.setFogDensity(percent / 100);
  }

  setSunBrightness(percent: number): void {
    this.world.environment.setSunBrightness(percent / 100);
  }

  playSound(self: GameObject, sound: string, where: string): void {
    if (!sound) return;
    this.audio.play(sound, {
      bus: 'effects',
      position: where === 'everywhere' ? null : self.worldPosition(),
    });
  }

  playMusic(sound: string): void {
    if (sound) this.audio.playMusic(sound, 1);
  }

  crossfadeMusic(sound: string, seconds: number): void {
    if (sound) this.audio.crossfadeMusic(sound, Math.max(0, seconds));
  }

  stopAllSounds(): void {
    this.audio.stopAll();
  }

  setVolume(bus: string, percent: number): void {
    if (isAudioBus(bus)) this.audio.setVolume(bus, percent / 100);
  }

  spawnEffect(self: GameObject, effect: string, at: ObjectRef): void {
    const target = this.find(self, at);
    if (!target || !isParticlePreset(effect)) return;
    this.world.effects.spawn(effect, target.worldPosition());
  }

  startParticles(self: GameObject, ref: ObjectRef): void {
    emitterRegistry.get(this.find(self, ref) ?? self)?.play();
  }

  stopParticles(self: GameObject, ref: ObjectRef): void {
    emitterRegistry.get(this.find(self, ref) ?? self)?.stop();
  }

  setLightEnabled(self: GameObject, ref: ObjectRef, on: boolean): void {
    gameplay.setLightEnabled(this.find(self, ref), on);
  }

  setLightColor(self: GameObject, ref: ObjectRef, color: string): void {
    gameplay.setLightColor(this.find(self, ref), color);
  }

  setGraphicsLevel(level: string): void {
    if (isQualityName(level)) setQuality(level);
  }

  graphicsLevel(): string {
    return currentQuality();
  }

  switchCamera(view: string): void {
    gameplay.switchCamera(this, view);
  }

  switchCameraTo(self: GameObject, ref: ObjectRef): void {
    gameplay.switchCameraTo(this, self, ref);
  }

  setCameraDistance(self: GameObject, distance: number): void {
    gameplay.setCameraDistance(this, self, distance);
  }

  shakeCamera(self: GameObject, strength: number, seconds: number): void {
    gameplay.shakeCamera(this, self, strength, seconds);
  }

  setFieldOfView(self: GameObject, fov: number, seconds: number): void {
    gameplay.setFieldOfView(this, self, fov, seconds);
  }

  playCameraPath(self: GameObject, ref: ObjectRef): void {
    gameplay.playCameraPath(this, self, ref);
  }

  playAnimation(self: GameObject, name: string, mode: 'once' | 'loop', fade: number): void {
    gameplay.playAnimation(self, name, mode, fade);
  }

  push(
    self: GameObject,
    force: number,
    direction: 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down',
  ): void {
    gameplay.push(this, self, force, direction);
  }

  setVelocity(self: GameObject, x: number, y: number, z: number): void {
    gameplay.setVelocity(this, self, x, y, z);
  }

  setGravity(value: number): void {
    gameplay.setGravity(this, value);
  }

  setBodyType(self: GameObject, type: 'static' | 'dynamic' | 'kinematic'): void {
    gameplay.setBodyType(this, self, type);
  }

  whatIsAhead(self: GameObject, meters: number): string {
    return gameplay.whatIsAhead(this, self, meters);
  }

  distanceAhead(self: GameObject, meters: number): number {
    return gameplay.distanceAhead(this, self, meters);
  }

  lookAt(self: GameObject, ref: ObjectRef): void {
    const target = this.worldPositionOf(self, ref);
    if (target) self.lookAtPoint(target);
  }

  mousePoint(self: GameObject): Vector3 | null {
    const camera = this.world.activeCamera();
    if (!camera || !this.pointer) return null;
    camera.aspect = this.viewAspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(this.pointer.ndc, camera);
    const plane = new Plane(new Vector3(0, 1, 0), -self.worldPosition().y);
    return raycaster.ray.intersectPlane(plane, new Vector3());
  }

  setColor(self: GameObject, color: string): void {
    const renderer = self.findComponent('meshRenderer');
    if (!renderer) return;
    renderer.values = { ...renderer.values, color };
    renderer.behavior.apply(renderer.values);
  }

  setVisible(self: GameObject, visible: boolean): void {
    self.setVisible(visible);
  }

  setSizePercent(self: GameObject, percent: number): void {
    const factor = Math.max(0, percent) / 100;
    self.object3d.scale.copy(self.baseScale).multiplyScalar(factor);
  }

  setActive(self: GameObject, ref: ObjectRef, active: boolean): void {
    this.find(self, ref)?.setActive(active);
  }

  spawn(self: GameObject, prefab: string, at: ObjectRef): void {
    const assetId = prefab.startsWith('prefab:') ? prefab.slice('prefab:'.length) : prefab;
    const template = assetId ? this.prefabTemplate(assetId) : null;
    const data = template ? this.templates.get(template) : undefined;
    if (!template || !data) {
      this.options.log?.({
        level: 'warning',
        kind: 'missingPrefab',
        objectId: self.cloneOf ?? self.id,
        objectName: self.name,
        assetId: assetId || null,
      });
      return;
    }
    const target = this.find(self, at);
    const copy = this.instantiate(template, data, null);
    applyTransformData(copy, data);
    if (target) copy.setWorldPosition(target.worldPosition());
    for (const object of copy.descendantsAndSelf()) {
      this.fireFor(object, 'created', () => true, true);
    }
  }

  clone(self: GameObject, ref: ObjectRef): void {
    const source = this.find(self, ref);
    if (!source || source.destroyed) return;
    const origin = source.cloneOf ?? source.id;
    const data = this.dataOf(origin);
    if (!data) return;
    const copy = this.instantiate(origin, data, source.parent);
    copy.object3d.position.copy(source.object3d.position);
    copy.object3d.quaternion.copy(source.object3d.quaternion);
    copy.object3d.scale.copy(source.object3d.scale);
    copy.setVisible(source.visible);
    for (const [key, value] of Object.entries(source.vars)) copy.vars[key] = cloneValue(value);
    for (const object of copy.descendantsAndSelf()) {
      this.fireFor(object, 'created', () => true, true);
    }
  }

  destroy(self: GameObject, ref: ObjectRef): boolean {
    const object = this.find(self, ref);
    if (object) this.destroyQueue.add(object);
    return object === self;
  }

  stopAll(): void {
    for (const thread of this.threads) this.kill(thread);
  }

  stopOtherScripts(self: GameObject): void {
    for (const thread of this.threads) {
      if (thread.object === self && thread !== this.current) this.kill(thread);
    }
  }

  showVariable(
    self: GameObject,
    scope: VariableScope,
    id: string,
    name: string,
    visible: boolean,
  ): void {
    const key = `${scope}:${scope === 'object' ? self.id : ''}:${id}`;
    if (visible)
      this.monitorEntries.set(key, { name, owner: scope === 'object' ? self : null, scope, id });
    else this.monitorEntries.delete(key);
  }

  // ---------------------------------------------------------------- internals

  private attachScripts(
    object: GameObject,
    overrides: Readonly<Record<string, JsonValue>> | null,
  ): void {
    const data = this.dataOf(object.cloneOf ?? object.id);
    const scripts: AttachedScript[] = [];
    for (const component of object.components) {
      if (component.definition.type !== 'blockScript' || !component.enabled) continue;
      const assetId =
        typeof component.values['script'] === 'string' ? component.values['script'] : null;
      const asset = assetId ? this.options.scripts(assetId) : null;
      if (!asset) {
        this.options.log?.({
          level: 'warning',
          kind: 'missingScript',
          objectId: object.id,
          objectName: object.name,
          assetId,
        });
        continue;
      }
      const stored = data?.components.find((item: ComponentData) => item.id === component.id)
        ?.values['variables'];
      const values = (overrides ??
        (stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {})) as Record<
        string,
        JsonValue
      >;
      for (const variable of asset.variables) {
        if (variable.scope === 'game') {
          if (!(variable.id in this.vars)) this.vars[variable.id] = cloneValue(variable.default);
          if (variable.saved) this.attachedSavedVars.add(variable.id);
          continue;
        }
        const value = values[variable.id];
        object.vars[variable.id] =
          variable.inspector &&
          (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
            ? value
            : cloneValue(variable.default);
      }
      scripts.push({ asset, entries: asset.module.scripts });
    }
    if (scripts.length > 0) this.attached.set(object, scripts);
  }

  /** Data of a scene object or of an object of a spawned prefab (`prefab:<asset>/<id>`). */
  private dataOf(id: string): SceneObjectData | undefined {
    return this.world.sceneData.objects[id] ?? this.templates.get(id);
  }

  /** Registers the objects of a prefab as templates; returns the root's template ID. */
  private prefabTemplate(assetId: string): string | null {
    const prefix = `prefab:${assetId}/`;
    const resolved = this.options.prefabs?.(assetId);
    if (!resolved) return null;
    if (!this.templates.has(prefix + resolved.root)) {
      for (const [id, data] of Object.entries(resolved.objects)) {
        this.templates.set(prefix + id, {
          ...data,
          parent:
            data.parent !== null && data.parent in resolved.objects ? prefix + data.parent : null,
        });
      }
    }
    return prefix + resolved.root;
  }

  private instantiate(
    originId: string,
    data: SceneObjectData,
    parent: GameObject | null,
  ): GameObject {
    const createId = this.options.createId ?? defaultCloneId;
    const object = new GameObject({
      id: createId(),
      name: data.name ?? '',
      tag: data.tag,
      layer: data.layer,
    });
    object.cloneOf = originId;
    object.baseScale.set(...data.transform.scale);
    object.setActive(data.active);
    this.world.adoptObject(object, parent);
    for (const component of data.components) this.world.addComponent(object, component);
    this.attachScripts(object, null);
    const children = [...Object.entries(this.world.sceneData.objects), ...this.templates.entries()]
      .filter(([, child]) => child.parent === originId)
      .sort((a, b) => a[1].order - b[1].order);
    for (const [childId, childData] of children) {
      const child = this.instantiate(childId, childData, object);
      child.object3d.position.set(...childData.transform.position);
      child.object3d.rotation.set(
        MathUtils.degToRad(childData.transform.rotation[0]),
        MathUtils.degToRad(childData.transform.rotation[1]),
        MathUtils.degToRad(childData.transform.rotation[2]),
        'YXZ',
      );
      child.object3d.scale.set(...childData.transform.scale);
    }
    return object;
  }

  private fire(
    type: string,
    match: (params: Readonly<Record<string, string | number | boolean>>) => boolean,
    restart: boolean | ((params: Readonly<Record<string, string | number | boolean>>) => boolean),
  ): void {
    for (const object of [...this.attached.keys()]) this.fireFor(object, type, match, restart);
  }

  private fireFor(
    object: GameObject,
    type: string,
    match: (params: Readonly<Record<string, string | number | boolean>>) => boolean,
    restart: boolean | ((params: Readonly<Record<string, string | number | boolean>>) => boolean),
  ): Thread[] {
    const started: Thread[] = [];
    if (object.destroyed || !object.activeInHierarchy) return started;
    for (const script of this.attached.get(object) ?? []) {
      for (const entry of script.entries) {
        const params = entry.event.params ?? {};
        if (entry.event.type !== type || !match(params)) continue;
        const shouldRestart = typeof restart === 'function' ? restart(params) : restart;
        const thread = this.startThread(object, script.asset, entry, shouldRestart);
        if (thread) started.push(thread);
      }
    }
    return started;
  }

  private startThread(
    object: GameObject,
    asset: ScriptAsset,
    entry: ScriptEntry,
    restart: boolean,
  ): Thread | null {
    const key = `${object.id}|${entry.id}`;
    const existing = this.running.get(key);
    if (existing && !existing.done) {
      if (!restart) return null;
      this.kill(existing);
    }
    const thread: Thread = { key, object, asset, iterator: entry.run(object, this), done: false };
    this.running.set(key, thread);
    this.threads.push(thread);
    return thread;
  }

  private kill(thread: Thread): void {
    if (thread.done) return;
    thread.done = true;
    if (this.running.get(thread.key) === thread) this.running.delete(thread.key);
    try {
      thread.iterator.return();
    } catch {
      // Ignore errors from finally blocks of stopped scripts.
    }
  }

  private stepThreads(threads: readonly Thread[]): void {
    for (const thread of [...threads]) {
      if (thread.done) continue;
      if (thread.object.destroyed) {
        this.kill(thread);
        continue;
      }
      if (!thread.object.activeInHierarchy) continue;
      this.current = thread;
      this.recentlyRun.set(thread.key, { thread, tick: this.tick });
      try {
        if (thread.iterator.next().done) this.finish(thread);
      } catch (error) {
        this.finish(thread);
        this.report(thread, error);
      } finally {
        this.current = null;
      }
    }
    this.threads = this.threads.filter((thread) => !thread.done);
  }

  private finish(thread: Thread): void {
    thread.done = true;
    if (this.running.get(thread.key) === thread) this.running.delete(thread.key);
  }

  private report(thread: Thread, error: unknown): void {
    const line = errorLine(error, thread.asset.sourceUrl);
    const blockId = line === null ? null : (thread.asset.lineToBlock[line] ?? null);
    this.options.log?.({
      level: 'error',
      kind: 'scriptError',
      message: error instanceof Error ? error.message : String(error),
      objectId: thread.object.cloneOf ?? thread.object.id,
      objectName: thread.object.name,
      assetId: thread.asset.assetId,
      blockId,
    });
  }

  private keyMatches(params: Readonly<Record<string, string | number | boolean>>): boolean {
    const key = String(params['key'] ?? 'any');
    switch (params['mode']) {
      case 'pressed':
        return this.input.wasPressed(key);
      case 'released':
        return this.input.wasReleased(key);
      default:
        return this.input.isDown(key);
    }
  }

  private matches(self: GameObject, other: GameObject, ref: ObjectRef): boolean {
    if (other === self) return false;
    if (ref === 'any') return true;
    if (ref.startsWith('object:')) {
      const id = ref.slice(7);
      return other.id === id || other.cloneOf === id;
    }
    if (ref.startsWith('tag:')) return other.tag === ref.slice(4);
    return false;
  }

  private worldShapes(object: GameObject): WorldShape[] {
    const colliders = colliderRegistry.get(object);
    if (!colliders || colliders.length === 0) return [];
    object.object3d.updateWorldMatrix(true, false);
    return colliders
      .filter((collider) => collider.enabled)
      .map((collider) =>
        toWorldShape(
          collider.shape,
          object.object3d.matrixWorld,
          CONTACT_MARGIN,
          collider.shape.kind === 'mesh' ? meshBoundsOf(object) : null,
        ),
      );
  }

  /** Objects whose colliders overlap one of the object's colliders. Hidden objects touch nothing. */
  private touchingObjects(self: GameObject): GameObject[] {
    if (!self.visible || !self.activeInHierarchy) return [];
    const own = this.worldShapes(self);
    if (own.length === 0) return [];
    const result: GameObject[] = [];
    for (const other of this.world.allObjects()) {
      if (other === self || other.destroyed || !other.visible || !other.activeInHierarchy) continue;
      const shapes = this.worldShapes(other);
      if (shapes.some((shape) => own.some((mine) => shapesOverlap(mine, shape))))
        result.push(other);
    }
    return result;
  }

  private touchEvents(): void {
    const started: Thread[] = [];
    for (const [object, scripts] of this.attached) {
      const hasTouchHats = scripts.some((script) =>
        script.entries.some((entry) => entry.event.type === 'touch'),
      );
      if (!hasTouchHats || object.destroyed) continue;
      const now = new Set(this.touchingObjects(object));
      const before = this.touchingBefore.get(object) ?? new Set<GameObject>();
      this.touchingBefore.set(object, now);
      const sets: Record<string, GameObject[]> = {
        enter: [...now].filter((other) => !before.has(other)),
        stay: [...now],
        exit: [...before].filter((other) => !now.has(other)),
      };
      started.push(
        ...this.fireFor(
          object,
          'touch',
          (params) =>
            (sets[String(params['phase'])] ?? []).some((other) =>
              this.matches(object, other, String(params['target'] ?? 'any')),
            ),
          (params) => params['phase'] !== 'stay',
        ),
      );
    }
    // Touch scripts react in the same tick (Unity: OnTrigger… runs before the next Update).
    this.stepThreads(started);
  }

  private processDestroyQueue(): void {
    for (const object of this.world.destroyRequests) this.destroyQueue.add(object);
    this.world.destroyRequests.clear();
    if (this.destroyQueue.size === 0) return;
    const queue = [...this.destroyQueue];
    this.destroyQueue.clear();
    for (const object of queue) {
      if (object.destroyed) continue;
      const doomed = [...object.descendantsAndSelf()];
      for (const item of doomed)
        this.stepThreads(this.fireFor(item, 'destroyed', () => true, true));
      for (const item of doomed) {
        for (const thread of this.threads) if (thread.object === item) this.kill(thread);
        this.attached.delete(item);
        this.touchingBefore.delete(item);
        this.previous.delete(item);
      }
      this.world.removeObject(object.id);
    }
    this.threads = this.threads.filter((thread) => !thread.done);
  }

  private snapshotTransforms(): void {
    for (const object of this.world.allObjects()) {
      const node = object.object3d;
      const snapshot = this.previous.get(object);
      if (snapshot) {
        snapshot.position.copy(node.position);
        snapshot.quaternion.copy(node.quaternion);
        snapshot.scale.copy(node.scale);
      } else {
        this.previous.set(object, {
          position: node.position.clone(),
          quaternion: node.quaternion.clone(),
          scale: node.scale.clone(),
        });
      }
    }
  }

  private worldPositionOf(self: GameObject, ref: ObjectRef): Vector3 | null {
    if (ref === 'mouse') return this.mousePoint(self);
    if (ref === 'origin') return ORIGIN.clone();
    return this.find(self, ref)?.worldPosition() ?? null;
  }
}
