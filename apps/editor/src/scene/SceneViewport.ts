import { createRenderer } from '@blockwerk/runtime';
import type { GameObject, World } from '@blockwerk/runtime';
import type { TransformData } from '@blockwerk/project';
import { ModelCache } from '@blockwerk/runtime';
import {
  ArrowHelper,
  BufferAttribute,
  BufferGeometry,
  Box3,
  Box3Helper,
  CameraHelper,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Raycaster,
  RingGeometry,
  Scene,
  Sphere,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Camera, Intersection, Material, Matrix4, WebGLRenderer } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { transformFromMatrix } from '../document/sceneOps';
import { editorModels } from '../library/models';
import type { Tool } from '../state/editor';
import { EditorGrid } from './EditorGrid';
import { SceneCamera } from './SceneCamera';
import type { AxisView } from './SceneCamera';
import { brushStamp } from '../library/brush';
import type { GroundPoint } from '../library/brush';
import { useNavigationView } from '../navigation/navigationView';
import { NpcGizmos } from './npcGizmos';
import { SceneInput } from './SceneInput';
import { currentEditWorld, currentWorld, onWorldChange, registerRenderView } from './worlds';
import { isOnScreen } from './visibility';

/** Shading modes of the scene view (Unity: Draw Mode). */
export type ShadingMode = 'shaded' | 'wireframe';

/** Snapshot of the scene camera for the axis gizmo, test hooks and the UI. */
export interface SceneCameraSnapshot {
  readonly position: readonly [number, number, number];
  readonly pivot: readonly [number, number, number];
  readonly distance: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly orthographic: boolean;
  readonly axisView: AxisView | null;
  readonly speed: number;
  /** True while a focus or axis-view transition is running. */
  readonly animating: boolean;
  /** True while the right mouse button is held (fly mode). */
  readonly flying: boolean;
  /** Camera rotation as quaternion `[x, y, z, w]`. */
  readonly quaternion: readonly [number, number, number, number];
}

/** Callbacks from the viewport to the React panel and the editor state. */
export interface SceneViewportCallbacks {
  cameraChanged(snapshot: SceneCameraSnapshot): void;
  /** A click selected an object (or nothing). `additive` when Ctrl/Shift was held. */
  pick(id: string | null, additive: boolean): void;
  tool(): Tool;
  pivotMode(): 'pivot' | 'center';
  space(): 'local' | 'global';
  flyingChanged(flying: boolean): void;
  /** The gizmo moved objects: new local transforms by object ID. */
  transform(transforms: ReadonlyMap<string, TransformData>): void;
  /** A gizmo drag ended. */
  transformEnd(): void;
  /** Brush settings while the brush is active, else `null`. */
  brush(): ViewportBrush | null;
  /** The brush placed objects at these points (one undo step per stroke `stroke`). */
  brushPlace(points: readonly Vector3[], stroke: number): void;
  /** Radius of the terrain brush while it is on, else `null`. */
  terrainBrush(): number | null;
  /** A terrain brush stroke at a surface point. */
  terrainStroke(point: Vector3 | null, phase: 'start' | 'move' | 'end'): void;
}

/** What the viewport needs to know about the brush. */
export interface ViewportBrush {
  readonly radius: number;
  readonly spacing: number;
  /** Ground positions (x, z) of objects of the same kind already in the scene. */
  existing(): GroundPoint[];
}

const SELECTION_COLOR = new Color(0xffa133);
const ICON_COLOR = 0xd8dde6;
const SUN_COLOR = 0xffd34d;
const MAX_FRAME_RADIUS = 30;
/** Longest time step per frame in seconds, so a stalled frame does not make the camera jump. */
const MAX_FRAME_STEP = 0.25;
/** Increments of Ctrl snapping (Unity defaults). */
const SNAP = { move: 0.25, rotate: 15, scale: 0.1 } as const;

interface Icon {
  readonly root: Group;
  readonly picker: Mesh;
  readonly kind: 'camera' | 'light';
  readonly update: (selected: boolean) => void;
  readonly dispose: () => void;
}

/** Editor scene view: renders the shared world with grid, icons and gizmos, handles navigation. */
export class SceneViewport {
  readonly camera = new SceneCamera();
  private readonly renderer: WebGLRenderer;
  private readonly perspective = new PerspectiveCamera();
  private readonly orthographic = new OrthographicCamera();
  private readonly overlay = new Scene();
  private readonly grid = new EditorGrid();
  private readonly npcGizmos = new NpcGizmos();
  private readonly input: SceneInput;
  private readonly raycaster = new Raycaster();
  private readonly gizmos: TransformControls[];
  private readonly proxy = new Object3D();
  private readonly icons = new Map<string, Icon>();
  private readonly selectionBoxes = new Map<string, Box3Helper>();
  private readonly wireframe = new MeshBasicMaterial({ color: 0xd0d4dc, wireframe: true });
  private world: World | null = null;
  /** Outline of the brush on the surface under the pointer. */
  private readonly brushRing = new Mesh(
    new RingGeometry(0.96, 1, 64).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color: 0xf39a2b, depthTest: false, transparent: true }),
  );
  private stroke: { id: number; taken: GroundPoint[]; last: Vector3 | null } | null = null;
  private strokeCount = 0;
  /** Model shown where a dragged library entry would land. */
  private dropPreview: { ref: string; object: Object3D | null; point: Vector3 } | null = null;
  private selection: readonly string[] = [];
  private dragStart: { proxy: Matrix4; objects: Map<string, Matrix4> } | null = null;
  private snapping = false;
  private frameHandle = 0;
  private lastTime = 0;
  private dirty = true;
  private width = 1;
  private height = 1;
  private disposed = false;
  private shading: ShadingMode = 'shaded';
  private skyAndFog = true;
  private readonly unsubscribe: () => void;
  /** The navigation mesh drawn over the scene (Navigation window → Show). */
  private navigationMesh: Mesh | null = null;
  private navigationDrawn: { world: World; revision: number } | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: SceneViewportCallbacks,
  ) {
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.className = 'viewport-canvas';
    canvas.tabIndex = 0;
    canvas.dataset['testid'] = 'scene-canvas';
    container.appendChild(canvas);
    this.renderer = createRenderer({ canvas });
    this.overlay.add(this.grid);
    this.overlay.add(this.npcGizmos.group);
    this.overlay.add(this.proxy);

    // Transform gizmos; the combined tool shows move and rotate handles together. The capture
    // listener runs before the gizmos' own pointerdown handlers.
    canvas.addEventListener('pointerdown', this.syncGizmos, { capture: true });
    const move = new TransformControls(this.perspective, canvas);
    const rotate = new TransformControls(this.perspective, canvas);
    rotate.setMode('rotate');
    rotate.setSize(1.15);
    this.gizmos = [move, rotate];
    for (const gizmo of this.gizmos) {
      this.overlay.add(gizmo.getHelper());
      gizmo.addEventListener('mouseDown', () => this.beginDrag());
      gizmo.addEventListener('objectChange', () => this.drag());
      gizmo.addEventListener('mouseUp', () => this.endDrag());
      gizmo.addEventListener('change', () => this.requestRender());
    }

    this.camera.lookAt(new Vector3(6, 4.5, -8), new Vector3(0, 0.5, 0));
    this.input = new SceneInput(canvas, this.camera, {
      invalidate: () => this.requestRender(),
      click: (x, y, additive) => this.pick(x, y, additive),
      tool: () => this.callbacks.tool(),
      flyingChanged: (flying) => {
        this.callbacks.flyingChanged(flying);
        this.requestRender();
      },
      gizmoHit: (x, y) => this.gizmoHit(x, y),
      brushActive: () => this.callbacks.brush() !== null || this.callbacks.terrainBrush() !== null,
      paint: (x, y, phase) => this.paint(x, y, phase),
      hover: (x, y) => this.hoverBrush(x, y),
    });
    this.brushRing.visible = false;
    this.brushRing.renderOrder = 10;
    this.overlay.add(this.brushRing);
    const view = container.ownerDocument.defaultView;
    view?.addEventListener('keydown', this.onModifier);
    view?.addEventListener('keyup', this.onModifier);
    const unsubscribeWorld = onWorldChange(() => this.worldChanged());
    const unregister = registerRenderView(this);
    const unsubscribeNavigation = useNavigationView.subscribe(() => this.requestRender());
    this.unsubscribe = () => {
      unsubscribeWorld();
      unsubscribeNavigation();
      unregister();
    };
    this.worldChanged();
    this.resize(container.clientWidth, container.clientHeight);
  }

  /** The canvas element of the viewport. */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Current camera state. */
  snapshot(): SceneCameraSnapshot {
    const camera = this.camera;
    const q = camera.quaternion;
    return {
      position: camera.position.toArray() as [number, number, number],
      pivot: camera.pivot.toArray() as [number, number, number],
      distance: camera.distance,
      yaw: camera.yaw,
      pitch: camera.pitch,
      orthographic: camera.orthographic,
      axisView: camera.currentAxisView(),
      speed: camera.speed,
      animating: camera.animating,
      flying: this.input.flying,
      quaternion: [q.x, q.y, q.z, q.w],
    };
  }

  /** Sets the drawing size in CSS pixels. */
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const view = this.container.ownerDocument.defaultView;
    this.renderer.setPixelRatio(Math.min(view?.devicePixelRatio ?? 1, 2));
    this.renderer.setSize(w, h, false);
    this.requestRender();
  }

  /** Shows the selection (outlines and gizmo). */
  setSelection(ids: readonly string[]): void {
    this.selection = ids;
    this.updateSelection();
    this.requestRender();
  }

  /** Re-reads tool, pivot mode and space from the editor. */
  refreshTool(): void {
    this.updateGizmo();
    this.requestRender();
  }

  /** Frames the given objects (F key, double-click in the hierarchy). */
  focus(ids: readonly string[]): void {
    const objects = this.objects(ids);
    if (objects.length === 0) return;
    const box = new Box3();
    for (const object of objects) {
      const own = new Box3().setFromObject(object.object3d);
      if (own.isEmpty()) own.expandByPoint(object.worldPosition());
      box.union(own);
    }
    const sphere = box.getBoundingSphere(new Sphere());
    this.camera.frame(sphere.center, Math.min(Math.max(sphere.radius, 0.5), MAX_FRAME_RADIUS));
    this.requestRender();
  }

  /** Where an object appears on the canvas in CSS pixels (tests, tooltips). */
  screenPoint(id: string): { x: number; y: number } | null {
    const object = this.world?.getObject(id);
    if (!object) return null;
    this.camera.apply(this.perspective, this.orthographic, this.width / this.height);
    const point = object.worldPosition().project(this.activeCamera());
    return { x: ((point.x + 1) / 2) * this.width, y: ((1 - point.y) / 2) * this.height };
  }

  /** The point new objects are placed at (Unity: the scene view pivot). */
  placementPoint(): Vector3 {
    return this.camera.pivot.clone();
  }

  /**
   * The world point under a canvas position (CSS pixels) for placing objects: the first
   * surface of an object, else the ground plane, else the pivot. `ignore` objects are skipped.
   */
  surfacePoint(x: number, y: number, ignore: readonly string[] = []): Vector3 {
    this.camera.apply(this.perspective, this.orthographic, this.width / this.height);
    this.raycaster.setFromCamera(this.pointer(x, y), this.activeCamera());
    const world = this.world;
    if (world) {
      world.scene.updateMatrixWorld();
      const hit = this.raycaster.intersectObjects(world.scene.children, true).find((item) => {
        if (!isPickable(item.object)) return false;
        const object = world.objectFromNode(item.object);
        return object !== undefined && !ignore.includes(object.id);
      });
      if (hit) return hit.point.clone();
    }
    const ground = this.raycaster.ray.intersectPlane(
      new Plane(new Vector3(0, 1, 0), 0),
      new Vector3(),
    );
    return ground ?? this.placementPoint();
  }

  /**
   * Where a model placed without a drop position stands: on the first surface below the pivot,
   * else on the ground plane below it (Unity places at the pivot; standing is nicer for models).
   */
  surfaceBelowPivot(ignore: readonly string[] = []): Vector3 {
    const pivot = this.placementPoint();
    const world = this.world;
    if (world) {
      world.scene.updateMatrixWorld();
      this.raycaster.set(pivot.clone().add(new Vector3(0, 0.01, 0)), new Vector3(0, -1, 0));
      const hit = this.raycaster.intersectObjects(world.scene.children, true).find((item) => {
        if (!isPickable(item.object)) return false;
        const object = world.objectFromNode(item.object);
        return object !== undefined && !ignore.includes(object.id);
      });
      if (hit) return hit.point.clone();
    }
    return pivot.y > 0 ? new Vector3(pivot.x, 0, pivot.z) : pivot;
  }

  /** Updates the gizmo and brush outline after the brush was switched on or off. */
  refreshBrush(): void {
    if (!this.callbacks.brush() && this.callbacks.terrainBrush() === null) {
      this.brushRing.visible = false;
    }
    this.updateGizmo();
    this.requestRender();
  }

  /** The height of the first surface at (x, z), from above; 0 without any surface. */
  private surfaceAt(x: number, z: number): Vector3 {
    const world = this.world;
    if (world) {
      this.raycaster.set(new Vector3(x, 1000, z), new Vector3(0, -1, 0));
      const hit = this.raycaster
        .intersectObjects(world.scene.children, true)
        .find((item) => isPickable(item.object) && world.objectFromNode(item.object));
      if (hit) return hit.point.clone();
    }
    return new Vector3(x, 0, z);
  }

  private hoverBrush(x: number, y: number): void {
    const brush = this.callbacks.brush();
    const terrainRadius = this.callbacks.terrainBrush();
    if (!brush && terrainRadius !== null) {
      const point = this.surfacePoint(x, y);
      this.brushRing.position.copy(point).add(new Vector3(0, 0.02, 0));
      this.brushRing.scale.setScalar(terrainRadius);
      this.brushRing.visible = true;
      this.requestRender();
      return;
    }
    if (!brush) {
      if (this.brushRing.visible) {
        this.brushRing.visible = false;
        this.requestRender();
      }
      return;
    }
    const point = this.surfacePoint(x, y);
    this.brushRing.position.copy(point).add(new Vector3(0, 0.02, 0));
    this.brushRing.scale.setScalar(brush.radius);
    this.brushRing.visible = true;
    this.requestRender();
  }

  /** A brush stroke: stamps objects whenever the pointer moved far enough. */
  private paint(x: number, y: number, phase: 'start' | 'move' | 'end'): void {
    if (this.callbacks.terrainBrush() !== null) {
      this.world?.scene.updateMatrixWorld();
      this.callbacks.terrainStroke(phase === 'end' ? null : this.surfacePoint(x, y), phase);
      if (phase !== 'end') this.hoverBrush(x, y);
      return;
    }
    const brush = this.callbacks.brush();
    if (!brush || phase === 'end') {
      // The whole stroke is one undo step.
      if (this.stroke) this.callbacks.transformEnd();
      this.stroke = null;
      return;
    }
    if (phase === 'start' || !this.stroke) {
      this.strokeCount += 1;
      this.stroke = { id: this.strokeCount, taken: brush.existing(), last: null };
    }
    const stroke = this.stroke;
    this.world?.scene.updateMatrixWorld();
    const center = this.surfacePoint(x, y);
    if (stroke.last && stroke.last.distanceTo(center) < Math.max(brush.spacing, brush.radius / 2)) {
      return;
    }
    stroke.last = center;
    const points = brushStamp([center.x, center.z], brush.radius, brush.spacing, stroke.taken);
    if (points.length === 0) return;
    stroke.taken.push(...points);
    this.callbacks.brushPlace(
      points.map(([px, pz]) => this.surfaceAt(px, pz)),
      stroke.id,
    );
  }

  /**
   * Shows model `ref` standing at `point` while a library entry is dragged over the view;
   * `null` hides it.
   */
  showDropPreview(ref: string | null, point?: Vector3): void {
    const world = this.world;
    if (!ref || !world) {
      this.dropPreview?.object?.removeFromParent();
      this.dropPreview = null;
      this.requestRender();
      return;
    }
    if (this.dropPreview?.ref !== ref) {
      this.dropPreview?.object?.removeFromParent();
      const preview: { ref: string; object: Object3D | null; point: Vector3 } = {
        ref,
        object: null,
        point: point?.clone() ?? this.placementPoint(),
      };
      this.dropPreview = preview;
      void editorModels.load(ref).then((template) => {
        if (this.dropPreview !== preview || !template || !this.world) return;
        preview.object = ModelCache.instantiate(template);
        preview.object.position.copy(preview.point);
        this.world.scene.add(preview.object);
        this.requestRender();
      });
    }
    if (point) {
      this.dropPreview.point.copy(point);
      this.dropPreview.object?.position.copy(point);
    }
    this.requestRender();
  }

  private ghosts: { group: Group; token: object } | null = null;

  /**
   * Shows a proposal (the AI assistant's world) as half-transparent models standing where they
   * would be placed; `null` removes them. The Scene view frames them so they are in sight.
   */
  showGhosts(
    items:
      | readonly {
          readonly model: string;
          readonly position: readonly [number, number, number];
          readonly rotationY: number;
          readonly scale: number;
        }[]
      | null,
  ): void {
    if (this.ghosts) {
      this.ghosts.group.removeFromParent();
      this.ghosts.group.traverse((node) => {
        const mesh = node as Mesh;
        if (mesh.isMesh) {
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            material.dispose();
          }
        }
      });
      this.ghosts = null;
    }
    const world = this.world;
    if (!items || items.length === 0 || !world) {
      this.requestRender();
      return;
    }
    const token = {};
    const group = new Group();
    group.name = 'ai-ghosts';
    this.ghosts = { group, token };
    world.scene.add(group);
    const bounds = new Box3();
    let pending = items.length;
    for (const item of items) {
      void editorModels.load(`library:${item.model}`).then((template) => {
        pending -= 1;
        if (this.ghosts?.token !== token) return;
        if (template) {
          const object = ModelCache.instantiate(template);
          object.position.set(item.position[0], item.position[1], item.position[2]);
          object.rotation.y = (item.rotationY * Math.PI) / 180;
          object.scale.setScalar(item.scale);
          object.traverse((node) => {
            const mesh = node as Mesh;
            if (!mesh.isMesh) return;
            // Own materials: the models share theirs with the scene.
            const make = (material: Material): Material => {
              const copy = material.clone();
              copy.transparent = true;
              copy.opacity = 0.45;
              copy.depthWrite = false;
              return copy;
            };
            mesh.material = Array.isArray(mesh.material)
              ? mesh.material.map(make)
              : make(mesh.material);
            mesh.castShadow = false;
          });
          group.add(object);
          bounds.expandByObject(object);
        }
        if (pending === 0 && !bounds.isEmpty()) {
          const sphere = bounds.getBoundingSphere(new Sphere());
          this.camera.frame(sphere.center, Math.min(Math.max(sphere.radius, 2), 80));
        }
        this.requestRender();
      });
    }
  }

  /** Turns to an axis view (scene gizmo). */
  setAxisView(view: AxisView): void {
    this.camera.setAxisView(view);
    this.requestRender();
  }

  /** Toggles perspective and orthographic projection. */
  toggleProjection(): void {
    this.camera.orthographic = !this.camera.orthographic;
    this.requestRender();
  }

  setShading(mode: ShadingMode): void {
    this.shading = mode;
    this.requestRender();
  }

  get shadingMode(): ShadingMode {
    return this.shading;
  }

  setGridVisible(visible: boolean): void {
    this.grid.visible = visible;
    this.requestRender();
  }

  setSkyAndFogVisible(visible: boolean): void {
    this.skyAndFog = visible;
    this.requestRender();
  }

  /** Schedules a frame. Rendering only happens when something changed. */
  requestRender(): void {
    this.dirty = true;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    const view = this.container.ownerDocument.defaultView;
    if (this.frameHandle && view) view.cancelAnimationFrame(this.frameHandle);
    view?.removeEventListener('keydown', this.onModifier);
    view?.removeEventListener('keyup', this.onModifier);
    this.input.dispose();
    for (const gizmo of this.gizmos) {
      gizmo.detach();
      gizmo.dispose();
    }
    for (const icon of this.icons.values()) icon.dispose();
    for (const box of this.selectionBoxes.values()) box.dispose();
    if (this.navigationMesh) {
      this.navigationMesh.geometry.dispose();
      (this.navigationMesh.material as MeshBasicMaterial).dispose();
    }
    this.grid.dispose();
    this.npcGizmos.dispose();
    this.wireframe.dispose();
    for (const world of new Set([this.world, currentEditWorld()])) {
      world?.environment.releaseRenderer(this.renderer);
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private objects(ids: readonly string[]): GameObject[] {
    const world = this.world;
    if (!world) return [];
    return ids.map((id) => world.getObject(id)).filter((object): object is GameObject => !!object);
  }

  private worldChanged(): void {
    const world = currentWorld();
    if (world !== this.world) {
      this.showDropPreview(null);
      // Baked lighting stays with its world (worlds free it when they are disposed).
      this.world = world;
      for (const icon of this.icons.values()) icon.dispose();
      this.icons.clear();
    }
    if (!this.dragStart) this.updateSelection();
    this.requestRender();
  }

  private readonly onModifier = (event: KeyboardEvent): void => {
    const snapping = event.ctrlKey || event.metaKey;
    if (snapping === this.snapping) return;
    this.snapping = snapping;
    this.updateSnapping();
  };

  private updateSnapping(): void {
    const [move, rotate] = this.gizmos;
    const on = this.snapping;
    const mode = this.callbacks.tool();
    move?.setTranslationSnap(on ? SNAP.move : null);
    move?.setScaleSnap(on ? SNAP.scale : null);
    rotate?.setRotationSnap(on ? (SNAP.rotate * Math.PI) / 180 : null);
    if (mode === 'scale') move?.setScaleSnap(on ? SNAP.scale : null);
  }

  /** Places outlines and gizmo for the current selection. */
  private updateSelection(): void {
    const objects = this.objects(this.selection);
    for (const [id, box] of this.selectionBoxes) {
      if (!objects.some((object) => object.id === id)) {
        this.overlay.remove(box);
        box.dispose();
        this.selectionBoxes.delete(id);
      }
    }
    for (const object of objects) {
      if (this.selectionBoxes.has(object.id)) continue;
      const box = new Box3Helper(new Box3(), SELECTION_COLOR);
      this.selectionBoxes.set(object.id, box);
      this.overlay.add(box);
    }
    this.updateGizmo();
  }

  private updateGizmo(): void {
    const objects = this.objects(this.selection);
    const tool = this.callbacks.tool();
    const [move, rotate] = this.gizmos;
    if (!move || !rotate) return;
    const showMove = tool === 'move' || tool === 'scale' || tool === 'transform' || tool === 'rect';
    const showRotate = tool === 'rotate' || tool === 'transform';
    move.setMode(tool === 'scale' ? 'scale' : 'translate');
    const space = this.callbacks.space() === 'local' || tool === 'scale' ? 'local' : 'world';
    for (const gizmo of this.gizmos) gizmo.setSpace(space);
    if (objects.length === 0 || this.callbacks.brush() || this.callbacks.terrainBrush() !== null) {
      move.detach();
      rotate.detach();
      return;
    }
    this.placeProxy(objects);
    if (showMove) move.attach(this.proxy);
    else move.detach();
    if (showRotate) rotate.attach(this.proxy);
    else rotate.detach();
    this.updateSnapping();
  }

  /** Puts the gizmo proxy at the pivot of the active object or the center of the selection. */
  private placeProxy(objects: readonly GameObject[]): void {
    const active = objects[objects.length - 1];
    if (!active) return;
    active.object3d.updateWorldMatrix(true, false);
    const position = new Vector3();
    if (this.callbacks.pivotMode() === 'center') {
      const box = new Box3();
      for (const object of objects) {
        const own = new Box3().setFromObject(object.object3d);
        if (own.isEmpty()) own.expandByPoint(object.worldPosition());
        box.union(own);
      }
      box.getCenter(position);
    } else {
      position.setFromMatrixPosition(active.object3d.matrixWorld);
    }
    this.proxy.position.copy(position);
    active.object3d.getWorldQuaternion(this.proxy.quaternion);
    this.proxy.scale.set(1, 1, 1);
    this.proxy.updateMatrixWorld(true);
  }

  private beginDrag(): void {
    const objects = this.objects(this.selection);
    this.proxy.updateMatrixWorld(true);
    const starts = new Map<string, Matrix4>();
    const selected = new Set(this.selection);
    for (const object of objects) {
      // Children of selected objects move with their parent.
      let ancestorSelected = false;
      for (let parent = object.parent; parent; parent = parent.parent) {
        if (selected.has(parent.id)) ancestorSelected = true;
      }
      if (ancestorSelected) continue;
      object.object3d.updateWorldMatrix(true, false);
      starts.set(object.id, object.object3d.matrixWorld.clone());
    }
    this.dragStart = { proxy: this.proxy.matrixWorld.clone(), objects: starts };
  }

  private drag(): void {
    const start = this.dragStart;
    const world = this.world;
    if (!start || !world) return;
    this.proxy.updateMatrixWorld(true);
    const delta = this.proxy.matrixWorld.clone().multiply(start.proxy.clone().invert());
    const transforms = new Map<string, TransformData>();
    for (const [id, matrix] of start.objects) {
      const object = world.getObject(id);
      if (!object) continue;
      const next = delta.clone().multiply(matrix);
      const parent = object.parent?.object3d;
      if (parent) {
        parent.updateWorldMatrix(true, false);
        next.premultiply(parent.matrixWorld.clone().invert());
      }
      transforms.set(id, transformFromMatrix(next));
    }
    if (transforms.size > 0) this.callbacks.transform(transforms);
  }

  private endDrag(): void {
    this.dragStart = null;
    this.callbacks.transformEnd();
    this.updateSelection();
    this.requestRender();
  }

  private activeCamera(): Camera {
    return this.camera.orthographic ? this.orthographic : this.perspective;
  }

  private pointer(x: number, y: number): Vector2 {
    return new Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
  }

  /**
   * Puts the gizmo handles where the selection is now. They otherwise follow it only when a
   * frame is drawn, so a click right after selecting in the hierarchy would grab the handles
   * of the previous selection.
   */
  private readonly syncGizmos = (): void => {
    for (const gizmo of this.gizmos) {
      if (!gizmo.object) continue;
      gizmo.camera = this.activeCamera();
      gizmo.getHelper().updateMatrixWorld(true);
    }
  };

  private gizmoHit(x: number, y: number): boolean {
    this.syncGizmos();
    const pointer = this.pointer(x, y);
    for (const gizmo of this.gizmos) {
      if (!gizmo.object || !gizmo.enabled) continue;
      gizmo.pointerHover({ x: pointer.x, y: pointer.y, button: 0 } as unknown as PointerEvent);
      if (gizmo.axis !== null) return true;
    }
    return false;
  }

  private pick(x: number, y: number, additive: boolean): void {
    const world = this.world;
    if (!world) return;
    this.raycaster.setFromCamera(this.pointer(x, y), this.activeCamera());
    const pickers = [...this.icons.values()].map((icon) => icon.picker);
    const iconHit = this.raycaster.intersectObjects(pickers, false)[0];
    const meshHit = this.raycaster
      .intersectObjects(world.scene.children, true)
      .find((hit: Intersection) => isPickable(hit.object) && world.objectFromNode(hit.object));
    let id: string | null = null;
    if (iconHit && (!meshHit || iconHit.distance <= meshHit.distance)) {
      id = [...this.icons].find(([, icon]) => icon.picker === iconHit.object)?.[0] ?? null;
    } else if (meshHit) {
      id = world.objectFromNode(meshHit.object)?.id ?? null;
    }
    this.callbacks.pick(id, additive);
  }

  /** Keeps camera and light icons in sync with the world (Unity: gizmo icons). */
  private updateIcons(): void {
    const world = this.world;
    const seen = new Set<string>();
    if (world) {
      for (const object of world.allObjects()) {
        const kind = object.findComponent('camera')
          ? 'camera'
          : object.findComponent('light')
            ? 'light'
            : null;
        if (!kind || !object.activeInHierarchy) continue;
        seen.add(object.id);
        let icon = this.icons.get(object.id);
        if (icon && icon.kind !== kind) {
          icon.dispose();
          icon = undefined;
        }
        if (!icon) {
          icon = kind === 'camera' ? this.cameraIcon() : this.lightIcon();
          this.icons.set(object.id, icon);
        }
        object.object3d.updateWorldMatrix(true, false);
        icon.root.position.setFromMatrixPosition(object.object3d.matrixWorld);
        object.object3d.getWorldQuaternion(icon.root.quaternion);
        icon.root.updateMatrixWorld(true);
        icon.update(this.selection.includes(object.id));
      }
    }
    for (const [id, icon] of this.icons) {
      if (!seen.has(id)) {
        icon.dispose();
        this.icons.delete(id);
      }
    }
  }

  private cameraIcon(): Icon {
    const root = new Group();
    const frustum = new PerspectiveCamera(60, 16 / 9, 0.05, 0.45);
    // Game cameras look along +Z; the frustum helper draws along -Z, so turn it around.
    frustum.rotation.y = Math.PI;
    root.add(frustum);
    const helper = new CameraHelper(frustum);
    const picker = new Mesh(
      new SphereGeometry(0.45, 8, 6),
      new MeshBasicMaterial({ visible: false }),
    );
    root.add(picker);
    this.overlay.add(root, helper);
    let wasSelected: boolean | null = null;
    return {
      root,
      picker,
      kind: 'camera',
      update: (selected) => {
        root.updateMatrixWorld(true);
        if (selected !== wasSelected) {
          wasSelected = selected;
          const color = new Color(selected ? SELECTION_COLOR : ICON_COLOR);
          helper.setColors(color, color, color, color, new Color(ICON_COLOR));
          frustum.far = selected ? 4 : 0.45;
          frustum.updateProjectionMatrix();
        }
        helper.update();
      },
      dispose: () => {
        this.overlay.remove(root, helper);
        helper.dispose();
        picker.geometry.dispose();
      },
    };
  }

  private lightIcon(): Icon {
    const root = new Group();
    // Lights shine along +Z.
    const arrow = new ArrowHelper(new Vector3(0, 0, 1), new Vector3(), 1.6, SUN_COLOR, 0.35, 0.18);
    root.add(arrow);
    const picker = new Mesh(
      new SphereGeometry(0.45, 8, 6),
      new MeshBasicMaterial({ visible: false }),
    );
    root.add(picker);
    this.overlay.add(root);
    return {
      root,
      picker,
      kind: 'light',
      update: (selected) => arrow.setColor(selected ? SELECTION_COLOR : SUN_COLOR),
      dispose: () => {
        this.overlay.remove(root);
        arrow.dispose();
        picker.geometry.dispose();
      },
    };
  }

  private schedule(): void {
    if (this.frameHandle || this.disposed) return;
    const view = this.container.ownerDocument.defaultView;
    if (!view) return;
    this.frameHandle = view.requestAnimationFrame(this.frame);
  }

  private readonly frame = (time: number): void => {
    this.frameHandle = 0;
    if (this.disposed) return;
    const dt = this.lastTime ? Math.min(MAX_FRAME_STEP, (time - this.lastTime) / 1000) : 1 / 60;
    this.lastTime = time;
    // While flying the view is redrawn every frame (like Unity's scene view while navigating).
    let changed = this.dirty || this.input.flying;
    if (this.input.flying) this.camera.fly(this.input.flyInput(), dt);
    if (this.camera.update(dt)) changed = true;
    if (changed) {
      this.render();
      this.callbacks.cameraChanged(this.snapshot());
    }
    this.dirty = false;
    if (this.input.flying || this.camera.animating) {
      this.schedule();
    } else {
      this.lastTime = 0;
    }
  };

  /** Renders now (also called by the play loop for every game frame). */
  render(): void {
    // Hidden tabs (e.g. behind the Game view while playing) draw nothing.
    if (!isOnScreen(this.canvas)) return;
    const aspect = this.width / this.height;
    this.camera.apply(this.perspective, this.orthographic, aspect);
    const camera = this.activeCamera();
    for (const gizmo of this.gizmos) gizmo.camera = camera;
    this.grid.update(camera, this.camera.distance);
    this.updateIcons();
    for (const [id, box] of this.selectionBoxes) {
      const object = this.world?.getObject(id);
      if (!object) continue;
      box.box.setFromObject(object.object3d);
      if (box.box.isEmpty())
        box.box.setFromCenterAndSize(object.worldPosition(), new Vector3(0.3, 0.3, 0.3));
    }
    const renderer = this.renderer;
    renderer.autoClear = true;
    const world = this.world;
    if (world) {
      world.prepareRender();
      world.environment.setFocus(this.camera.pivot);
      world.environment.prepare(renderer, camera);
      const scene = world.scene;
      const fog = scene.fog;
      const sky = world.environment.sky.visible;
      if (!this.skyAndFog) {
        scene.fog = null;
        world.environment.sky.visible = false;
        scene.background = new Color(0x30343b);
      }
      if (this.shading === 'wireframe') {
        scene.overrideMaterial = this.wireframe;
        world.environment.sky.visible = false;
        scene.background = new Color(0x26292f);
      }
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      scene.fog = fog;
      scene.background = null;
      world.environment.sky.visible = sky;
    } else {
      renderer.setClearColor(0x30343b);
      renderer.clear();
    }
    renderer.autoClear = false;
    this.updateNavigationMesh();
    this.npcGizmos.update(this.world, this.selection);
    renderer.render(this.overlay, camera);
    renderer.autoClear = true;
  }

  /** Keeps the drawing of the navigation mesh in step with the world's mesh and the window. */
  private updateNavigationMesh(): void {
    const view = useNavigationView.getState();
    const world = this.world;
    const navigation = world?.navigationInUse ? world.navigation : null;
    const visible = view.show && navigation?.built === true;
    if (!visible || !world || !navigation) {
      if (this.navigationMesh) this.navigationMesh.visible = false;
      return;
    }
    const drawn = this.navigationDrawn;
    if (!this.navigationMesh || drawn?.world !== world || drawn.revision !== navigation.revision) {
      const data = navigation.debugMesh();
      if (!data) return;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(data.positions, 3));
      geometry.setIndex(new BufferAttribute(data.indices, 1));
      if (!this.navigationMesh) {
        this.navigationMesh = new Mesh(
          geometry,
          new MeshBasicMaterial({
            color: 0x2aa7c9,
            transparent: true,
            opacity: 0.4,
            side: DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
          }),
        );
        this.navigationMesh.renderOrder = 5;
        this.overlay.add(this.navigationMesh);
      } else {
        this.navigationMesh.geometry.dispose();
        this.navigationMesh.geometry = geometry;
      }
      this.navigationDrawn = { world, revision: navigation.revision };
    }
    this.navigationMesh.visible = true;
  }
}

/**
 * Visible meshes count for picking (helpers and invisible parts do not). Meshes drawn by
 * automatic instancing are hidden themselves but count as visible.
 */
function isPickable(object: Object3D): boolean {
  if (!(object as { isMesh?: boolean }).isMesh) return false;
  if (!object.visible && object.userData['instanced'] !== true) return false;
  for (let current: Object3D | null = object.parent; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}
