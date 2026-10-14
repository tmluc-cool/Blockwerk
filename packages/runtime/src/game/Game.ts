import type {
  ComponentData,
  JsonValue,
  SceneData,
  SceneObjectData,
  VariableData,
} from '@blockwerk/project';
import type { Quaternion } from 'three';
import { MathUtils, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { colliderRegistry } from '../components/colliders';
import { errorLine } from '../scripts';
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
import type { WorldShape } from './collisions';
import { InputState } from './input';

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
  readonly log?: (entry: GameLogEntry) => void;
  /** Random source in [0, 1); defaults to `Math.random`. */
  readonly random?: () => number;
  /** Creates IDs for clones. */
  readonly createId?: () => string;
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

interface TransformSnapshot {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
}

const ORIGIN = new Vector3();

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
  private timerStart = 0;
  private current: Thread | null = null;
  private pointer: { ndc: Vector2 } | null = null;
  private viewAspect = 16 / 9;

  constructor(scene: SceneData, options: GameOptions) {
    this.options = options;
    this.random_ = options.random ?? Math.random;
    this.world = new World(structuredClone(scene), options);
    for (const object of this.world.allObjects()) this.attachScripts(object, null);
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
    if (!this.paused) {
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
    this.input.beginTick();
    this.snapshotTransforms();
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
    this.stepThreads(this.threads);
    this.touchEvents();
    this.processDestroyQueue();
    this.tick += 1;
    this.world.updateSun();
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
          object.vars[variable.id] = variable.default;
        if (variable.scope === 'game' && !(variable.id in this.vars))
          this.vars[variable.id] = variable.default;
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
    for (const thread of this.threads) thread.done = true;
    this.threads = [];
    this.running.clear();
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
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
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

  resetTimer(): void {
    this.timerStart = this.time;
  }

  // ---------------------------------------------------------------- GameApi: objects

  keyDown(key: string): boolean {
    return this.input.isDown(key);
  }

  find(self: GameObject, ref: ObjectRef): GameObject | null {
    if (ref === 'self') return self;
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
    Object.assign(copy.vars, source.vars);
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
          if (!(variable.id in this.vars)) this.vars[variable.id] = variable.default;
          continue;
        }
        const value = values[variable.id];
        object.vars[variable.id] =
          variable.inspector &&
          (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean')
            ? value
            : variable.default;
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
      .map((collider) => toWorldShape(collider.shape, object.object3d.matrixWorld));
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
