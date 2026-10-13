import { createRenderer } from '@blockwerk/runtime';
import {
  ArrowHelper,
  Box3,
  BoxHelper,
  CameraHelper,
  Color,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Sphere,
  SphereGeometry,
  MeshBasicMaterial,
  Vector2,
  Vector3,
} from 'three';
import type { Object3D, WebGLRenderer } from 'three';
import type { Tool } from '../state/editor';
import { findSceneObject, SAMPLE_SCENE } from '../state/scene';
import { EditorGrid } from './EditorGrid';
import { buildSampleWorld } from './sampleWorld';
import type { SampleWorld } from './sampleWorld';
import { SceneCamera } from './SceneCamera';
import type { AxisView } from './SceneCamera';
import { SceneInput } from './SceneInput';

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

/** Callbacks from the viewport to the React panel. */
export interface SceneViewportCallbacks {
  cameraChanged(snapshot: SceneCameraSnapshot): void;
  select(id: string | null): void;
  tool(): Tool;
  flyingChanged(flying: boolean): void;
}

const SELECTION_COLOR = new Color(0xffa133);
const MAX_FRAME_RADIUS = 12;
/** Longest time step per frame in seconds, so a stalled frame does not make the camera jump. */
const MAX_FRAME_STEP = 0.25;
const CAMERA_GIZMO_COLOR = 0xd8dde6;
const CAMERA_GIZMO_FAR = 0.45;
const CAMERA_GIZMO_SELECTED_FAR = 4;

/** Editor scene view: renders the sample scene with grid and gizmos and handles navigation. */
export class SceneViewport {
  readonly camera = new SceneCamera();
  private readonly renderer: WebGLRenderer;
  private readonly world: SampleWorld;
  private readonly perspective = new PerspectiveCamera();
  private readonly orthographic = new OrthographicCamera();
  private readonly grid = new EditorGrid();
  private readonly input: SceneInput;
  private readonly raycaster = new Raycaster();
  private readonly gizmoPickers: { id: string; mesh: Mesh }[] = [];
  private readonly frustumProxy = new PerspectiveCamera(60, 16 / 9, 0.05, CAMERA_GIZMO_FAR);
  private readonly cameraHelper: CameraHelper;
  private readonly sunArrow: ArrowHelper;
  private selectionHelper: BoxHelper | null = null;
  private selectedId: string | null = null;
  private frameHandle = 0;
  private lastTime = 0;
  private dirty = true;
  private width = 1;
  private height = 1;
  private disposed = false;
  private shading: ShadingMode = 'shaded';

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
    this.world = buildSampleWorld();
    this.world.environment.bakeLighting(this.renderer);
    this.world.scene.add(this.grid);

    // Gizmos for objects without geometry (camera frustum and sun direction), like Unity's icons.
    // Small frustum as camera icon; the full view frustum is shown while the camera is selected.
    const mainCamera = this.world.mainCamera;
    this.frustumProxy.position.copy(mainCamera.position);
    this.frustumProxy.quaternion.copy(mainCamera.quaternion);
    this.frustumProxy.updateMatrixWorld();
    this.cameraHelper = new CameraHelper(this.frustumProxy);
    this.styleCameraGizmo(false);
    this.world.scene.add(this.cameraHelper);
    const sunMarker = this.world.objects.get('sun');
    const sunDirection = this.world.environment.getSunDirection().negate();
    this.sunArrow = new ArrowHelper(
      sunDirection,
      sunMarker?.position ?? new Vector3(),
      1.6,
      0xffd34d,
      0.35,
      0.18,
    );
    this.world.scene.add(this.sunArrow);
    this.addGizmoPicker('main-camera', mainCamera.position);
    if (sunMarker) this.addGizmoPicker('sun', sunMarker.position);

    this.camera.lookAt(new Vector3(4.6, 3.1, 6.4), new Vector3(0, 0.5, 0));

    this.input = new SceneInput(canvas, this.camera, {
      invalidate: () => this.requestRender(),
      click: (x, y) => this.pick(x, y),
      tool: () => this.callbacks.tool(),
      flyingChanged: (flying) => {
        this.callbacks.flyingChanged(flying);
        this.requestRender();
      },
    });
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

  /** Highlights the selected object. */
  setSelection(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    if (this.selectionHelper) {
      this.world.scene.remove(this.selectionHelper);
      this.selectionHelper.dispose();
      this.selectionHelper = null;
    }
    const object = id ? this.world.objects.get(id) : undefined;
    const info = findSceneObject(id);
    if (object && info && info.kind === 'cube') {
      this.selectionHelper = new BoxHelper(object, SELECTION_COLOR);
      this.world.scene.add(this.selectionHelper);
    }
    this.styleCameraGizmo(id === 'main-camera');
    (this.sunArrow.line.material as MeshBasicMaterial).color.set(
      id === 'sun' ? SELECTION_COLOR : 0xffd34d,
    );
    this.requestRender();
  }

  /** Frames an object (F key, double-click in the hierarchy). */
  focus(id: string | null): void {
    const object = id ? this.world.objects.get(id) : undefined;
    const info = findSceneObject(id);
    if (!object || !info) return;
    const sphere = new Sphere();
    if (info.kind === 'cube') {
      new Box3().setFromObject(object).getBoundingSphere(sphere);
    } else if (info.kind === 'ground') {
      sphere.set(new Vector3(0, 0, 0), MAX_FRAME_RADIUS);
    } else {
      sphere.set(object.getWorldPosition(new Vector3()), 1);
    }
    this.camera.frame(sphere.center, Math.min(sphere.radius, MAX_FRAME_RADIUS));
    this.requestRender();
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
    this.world.scene.traverse((node) => {
      if (node instanceof Mesh && node.material instanceof MeshStandardMaterial) {
        node.material.wireframe = mode === 'wireframe';
      }
    });
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
    this.world.environment.sky.visible = visible;
    const fog = this.world.scene.fog;
    if (fog && 'far' in fog) fog.far = visible ? 650 : 1e9;
    this.world.scene.background = visible ? null : new Color(0x30343b);
    this.requestRender();
  }

  /** Schedules a frame. Rendering only happens when something changed. */
  requestRender(): void {
    this.dirty = true;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    const view = this.container.ownerDocument.defaultView;
    if (this.frameHandle && view) view.cancelAnimationFrame(this.frameHandle);
    this.input.dispose();
    this.selectionHelper?.dispose();
    this.cameraHelper.dispose();
    this.sunArrow.dispose();
    for (const picker of this.gizmoPickers) picker.mesh.geometry.dispose();
    this.grid.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private styleCameraGizmo(selected: boolean): void {
    const line = new Color(selected ? SELECTION_COLOR : CAMERA_GIZMO_COLOR);
    this.cameraHelper.setColors(line, line, line, line, new Color(CAMERA_GIZMO_COLOR));
    this.frustumProxy.far = selected ? CAMERA_GIZMO_SELECTED_FAR : CAMERA_GIZMO_FAR;
    this.frustumProxy.updateProjectionMatrix();
    this.cameraHelper.update();
  }

  private addGizmoPicker(id: string, position: Vector3): void {
    const mesh = new Mesh(
      new SphereGeometry(0.45, 8, 6),
      new MeshBasicMaterial({ visible: false }),
    );
    mesh.position.copy(position);
    mesh.name = `${id}-picker`;
    this.world.scene.add(mesh);
    this.gizmoPickers.push({ id, mesh });
  }

  private pick(x: number, y: number): void {
    const pointer = new Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const camera = this.camera.orthographic ? this.orthographic : this.perspective;
    this.raycaster.setFromCamera(pointer, camera);
    const candidates: { id: string; mesh: Object3D }[] = [
      ...this.gizmoPickers,
      ...this.world.pickables,
    ];
    const hits = this.raycaster.intersectObjects(
      candidates.map((candidate) => candidate.mesh),
      false,
    );
    const hit = hits[0];
    const id = hit
      ? (candidates.find((candidate) => candidate.mesh === hit.object)?.id ?? null)
      : null;
    this.callbacks.select(id && SAMPLE_SCENE.some((object) => object.id === id) ? id : null);
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

  private render(): void {
    const aspect = this.width / this.height;
    this.camera.apply(this.perspective, this.orthographic, aspect);
    const camera = this.camera.orthographic ? this.orthographic : this.perspective;
    this.world.environment.setFocus(this.camera.pivot);
    this.world.environment.update(camera);
    this.grid.update(camera, this.camera.distance);
    this.selectionHelper?.update();
    this.renderer.render(this.world.scene, camera);
  }
}
