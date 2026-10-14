import type { SceneData, SceneObjectData } from '@blockwerk/project';
import {
  animatorRegistry,
  createRenderer,
  figureRegistry,
  Game,
  initPhysics,
  isSoftwareRenderer,
  jumpArc,
  TICK_SECONDS,
} from '@blockwerk/runtime';
import type { AnimatorHandle, FigureInfo } from '@blockwerk/runtime';
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CircleGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector3,
} from 'three';
import type { Object3D, WebGLRenderer } from 'three';
import { editorModels } from '../library/models';

/** What the stage draws on top of the figure (set from the movement and collision sections). */
export interface StageOverlays {
  /** Jump arcs at walking and running speed. */
  jump: {
    readonly jumpHeight: number;
    readonly gravity: number;
    readonly walkSpeed: number;
    readonly runSpeed: number;
    readonly snapDistance: number;
  } | null;
  /** The collision capsule: height, radius and center offset in meters. */
  capsule: {
    readonly height: number;
    readonly radius: number;
    readonly center: readonly [number, number, number];
  } | null;
  /** Reference figure height in meters (the comparison figure), `null` to hide it. */
  referenceHeight: number | null;
  /** Obstacles to compare the jump with: step, crate, gap. */
  obstacles: boolean;
}

/** Settings of the game camera, shown in the camera preview. */
export interface CameraPreview {
  readonly distance: number;
  readonly height: number;
  readonly shoulder: number;
  readonly fov: number;
}

/** Options of a portrait (SPEC 5.10 "Porträt"). */
export interface PortraitOptions {
  /** Viewing direction around the figure in degrees (0 = from the front). */
  readonly angle: number;
  /** `bust`: head and shoulders, `body`: the whole figure. */
  readonly framing: 'bust' | 'body';
  /** `#rrggbb`, or `null` for a transparent background. */
  readonly background: string | null;
  readonly size: number;
}

let activeStage: StageViewport | null = null;

/** Registers the turntable that is open now (for tests and the studio's toolbar). */
export function setCurrentStage(stage: StageViewport | null): void {
  activeStage = stage;
}

/** The turntable that is open now, if any. */
export function currentStage(): StageViewport | null {
  return activeStage;
}

/** Radius of the turntable disc in meters. */
const STAGE_RADIUS = 1.4;

/** Callbacks from the stage to its panel. */
export interface StageCallbacks {
  /** The model finished loading or changed: figure info for the panel. */
  figure(info: FigureInfo | null, animator: AnimatorHandle | null): void;
}

/** Whether a node hangs below an attached item (items do not count for the body height). */
function isAttached(node: Object3D, info: FigureInfo): boolean {
  for (let current: Object3D | null = node; current; current = current.parent) {
    if ([...info.attached.values()].includes(current)) return true;
  }
  return false;
}

function overlayLine(points: readonly Vector3[], color: number): Line {
  const line = new Line(
    new BufferGeometry().setFromPoints([...points]),
    new LineBasicMaterial({ color, depthTest: false }),
  );
  line.renderOrder = 10;
  return line;
}

/**
 * The turntable of the Character Studio: a small game that shows one figure with studio light,
 * a meter grid, a comparison figure, the jump arc and the collision capsule. Drag to turn the
 * view, mouse wheel to zoom.
 */
export class StageViewport {
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(35, 1, 0.05, 100);
  private readonly helpers = new Group();
  private readonly cameraView = new PerspectiveCamera(50, 1, 0.05, 100);
  private game: Game | null = null;
  private buildKey = '';
  private generation = 0;
  private yaw = 0.5;
  private pitch = 0.18;
  private zoom = 1;
  private spin = false;
  private height = 1.8;
  private overlays: StageOverlays = {
    jump: null,
    capsule: null,
    referenceHeight: 1.8,
    obstacles: true,
  };
  private overlaysKey = '';
  private animation: string | null = 'idle';
  private speed = 1;
  private loop = true;
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private disposed = false;
  private drawn = 0;
  private preview: { canvas: HTMLCanvasElement; settings: CameraPreview } | null = null;
  private readonly cleanup: (() => void)[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly callbacks: StageCallbacks,
  ) {
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.className = 'viewport-canvas studio-canvas';
    canvas.dataset['testid'] = 'studio-canvas';
    container.appendChild(canvas);
    this.renderer = createRenderer({ canvas });
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ): void => {
      canvas.addEventListener(type, listener, options);
      this.cleanup.push(() => canvas.removeEventListener(type, listener));
    };
    let dragging = false;
    listen('pointerdown', (event) => {
      dragging = true;
      canvas.setPointerCapture(event.pointerId);
    });
    listen('pointermove', (event) => {
      if (!dragging) return;
      this.yaw -= event.movementX * 0.01;
      this.pitch = Math.min(1.2, Math.max(-0.3, this.pitch + event.movementY * 0.008));
    });
    listen('pointerup', () => {
      dragging = false;
    });
    listen(
      'wheel',
      (event) => {
        event.preventDefault();
        this.zoom = Math.min(3, Math.max(0.35, this.zoom * Math.exp(event.deltaY * 0.001)));
      },
      { passive: false },
    );
    this.resize(container.clientWidth, container.clientHeight);
    this.frame = requestAnimationFrame(this.loopFrame);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** The running preview game (for tests and the panel). */
  get previewGame(): Game | null {
    return this.game;
  }

  resize(width: number, height: number): void {
    if (width < 1 || height < 1) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Lets the turntable turn on its own. */
  setSpin(spin: boolean): void {
    this.spin = spin;
  }

  /** Plays an animation on the figure. `speed` 0 holds the pose. */
  play(name: string | null, speed: number, loop: boolean): void {
    this.animation = name;
    this.speed = speed;
    this.loop = loop;
    this.applyAnimation();
  }

  /** Sets what is drawn over the figure. */
  setOverlays(overlays: StageOverlays): void {
    const key = JSON.stringify(overlays);
    if (key === this.overlaysKey) return;
    this.overlaysKey = key;
    this.overlays = overlays;
    this.rebuildHelpers();
  }

  /** Shows the game camera's view in a small canvas. `null` stops drawing it. */
  setCameraPreview(canvas: HTMLCanvasElement | null, settings: CameraPreview): void {
    this.preview = canvas ? { canvas, settings } : null;
  }

  /**
   * Shows a figure. The game is built again only when the figure's visual components changed
   * (model, parts, colors, equipment …), so moving sliders does not reload the model.
   */
  async show(object: SceneObjectData | null, bodyHeight: number): Promise<void> {
    const visual = object
      ? JSON.stringify(
          object.components.filter(
            (component) => component.type === 'character' || component.type === 'animator',
          ),
        )
      : '';
    this.height = bodyHeight;
    if (visual === this.buildKey) return;
    this.buildKey = visual;
    const generation = ++this.generation;
    this.game?.dispose();
    this.game = null;
    this.callbacks.figure(null, null);
    if (!object) return;
    await initPhysics();
    if (this.disposed || generation !== this.generation) return;
    const scene: SceneData = {
      formatVersion: 1,
      environment: { ambientIntensity: 0.35, fog: { enabled: false, near: 10, far: 100 } },
      objects: {
        figure0000001: {
          ...object,
          parent: null,
          order: 0,
          active: true,
          transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
          components: object.components.filter(
            (component) => component.type === 'character' || component.type === 'animator',
          ),
        },
      },
    };
    const game = new Game(scene, { scripts: () => null, models: editorModels });
    this.game = game;
    // Machines that draw with the CPU get a smaller shadow map: the figure is small and close.
    if (isSoftwareRenderer(this.renderer)) game.world.environment.setShadowMapSize(1024);
    this.rebuildHelpers();
    await game.world.modelsLoaded();
    game.stepTick();
    // Retargeting and attachments load in a second round.
    await game.world.modelsLoaded();
    game.stepTick();
    if (this.disposed || generation !== this.generation) return;
    const figure = game.world.getObject('figure0000001');
    this.applyAnimation();
    this.callbacks.figure(
      figure ? (figureRegistry.get(figure) ?? null) : null,
      figure ? (animatorRegistry.get(figure) ?? null) : null,
    );
  }

  /** What the stage shows now, for tests: size, mode, parts, equipment and animation clips. */
  inspect(): {
    mode: string | null;
    height: number;
    natural: number;
    gear: string[];
    scale: number[];
    parts: string[];
    attached: string[];
    /** World position of each attached item by attachment point (does it follow the animation?). */
    attachedAt: Record<string, number[]>;
    clips: string[];
    animation: string | null;
    mapped: boolean;
    missing: string[];
    arc: { height: number; walk: number; run: number } | null;
  } | null {
    const figure = this.game?.world.getObject('figure0000001');
    const info = figure ? figureRegistry.get(figure) : undefined;
    if (!figure || !info) return null;
    const box = new Box3();
    info.root.updateMatrixWorld(true);
    info.root.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh || !node.visible || isAttached(node, info)) return;
      (mesh as { skeleton?: { update(): void } }).skeleton?.update();
      box.expandByObject(node, true);
    });
    const jump = this.overlays.jump;
    const arc = jump ? jumpArc(jump, jump.snapDistance) : null;
    return {
      mode: info.mode,
      height: box.isEmpty() ? 0 : box.max.y - box.min.y,
      natural: info.naturalHeight,
      gear: [...info.gear],
      scale: info.root.scale.toArray(),
      parts: [...info.parts],
      attached: [...info.attached.keys()],
      attachedAt: Object.fromEntries(
        [...info.attached].map(([point, item]) => [
          point,
          item.getWorldPosition(new Vector3()).toArray(),
        ]),
      ),
      clips: animatorRegistry.get(figure)?.clips.slice() ?? [],
      animation: animatorRegistry.get(figure)?.current ?? null,
      mapped: info.mapping?.complete ?? false,
      missing: info.mapping ? [...info.mapping.missing] : [],
      arc: arc ? { height: arc.height, walk: arc.walkDistance, run: arc.runDistance } : null,
    };
  }

  /** Renders a portrait of the figure as PNG bytes. */
  portrait(options: PortraitOptions): Uint8Array | null {
    const game = this.game;
    if (!game) return null;
    const { size } = options;
    const camera = new PerspectiveCamera(28, 1, 0.05, 100);
    const bust = options.framing === 'bust';
    const target = new Vector3(0, this.height * (bust ? 0.86 : 0.5), 0);
    const distance = bust ? this.height * 0.75 : this.height * 2.1;
    const angle = (options.angle * Math.PI) / 180;
    camera.position.set(
      target.x + Math.sin(angle) * distance,
      target.y + (bust ? 0.03 : 0.2) * distance,
      target.z + Math.cos(angle) * distance,
    );
    camera.lookAt(target);
    const scene = game.world.scene;
    const previousBackground = scene.background;
    const previousHelpers = this.helpers.visible;
    this.helpers.visible = false;
    scene.background = options.background ? new Color(options.background) : null;
    const previousAlpha = this.renderer.getClearAlpha();
    const canvas = this.renderer.domElement;
    const width = canvas.width;
    const height = canvas.height;
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.renderer.setClearColor(0x000000, options.background ? 1 : 0);
    game.world.prepareRender();
    this.renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    // Back to the studio view.
    scene.background = previousBackground;
    this.helpers.visible = previousHelpers;
    this.renderer.setClearColor(0x000000, previousAlpha);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width / ratio, height / ratio, false);
    const base64 = url.slice(url.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  dispose(): void {
    this.disposed = true;
    if (activeStage === this) activeStage = null;
    cancelAnimationFrame(this.frame);
    for (const stop of this.cleanup) stop();
    this.game?.dispose();
    this.game = null;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private applyAnimation(): void {
    const figure = this.game?.world.getObject('figure0000001');
    const animator = figure ? animatorRegistry.get(figure) : undefined;
    if (!animator) return;
    animator.speed = this.speed;
    if (this.animation) animator.play(this.animation, { once: !this.loop, fade: 0.15 });
    else animator.stop();
  }

  private rebuildHelpers(): void {
    this.helpers.removeFromParent();
    this.helpers.clear();
    const { jump, capsule, referenceHeight, obstacles } = this.overlays;
    // Studio light: soft sky light and a key light from the front left.
    this.helpers.add(new HemisphereLight(0xffffff, 0x4a4f58, 1.4));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 3);
    this.helpers.add(key);
    const grid = new GridHelper(4, 8, 0x6c7a89, 0x3d4650);
    this.helpers.add(grid);
    const disc = new Mesh(
      new CircleGeometry(STAGE_RADIUS, 48).rotateX(-Math.PI / 2),
      new MeshStandardMaterial({ color: 0x3a414a, roughness: 0.9 }),
    );
    disc.position.y = -0.01;
    this.helpers.add(disc);
    if (referenceHeight) {
      const radius = 0.22;
      const reference = new Mesh(
        new CapsuleGeometry(radius, Math.max(0.01, referenceHeight - radius * 2), 4, 12),
        new MeshBasicMaterial({ color: 0x8aa4c0, transparent: true, opacity: 0.22 }),
      );
      reference.position.set(1.1, referenceHeight / 2, 0);
      reference.name = 'reference';
      this.helpers.add(reference);
    }
    if (capsule) {
      const wire = new LineSegments(
        new EdgesGeometry(
          new CapsuleGeometry(
            capsule.radius,
            Math.max(0.01, capsule.height - capsule.radius * 2),
            4,
            12,
          ),
        ),
        new LineBasicMaterial({ color: 0x66e08a, depthTest: false }),
      );
      wire.position.set(capsule.center[0], capsule.center[1], capsule.center[2]);
      wire.renderOrder = 10;
      wire.name = 'capsule';
      this.helpers.add(wire);
    }
    if (jump) {
      const arc = jumpArc(jump, jump.snapDistance);
      const draw = (speed: number, color: number, name: string): void => {
        const points = [new Vector3(0, 0.02, 0)];
        arc.points.forEach((y, index) =>
          points.push(new Vector3(0, y + 0.02, (index + 1) * TICK_SECONDS * speed)),
        );
        const line = overlayLine(points, color);
        line.position.x = -0.5;
        line.name = name;
        this.helpers.add(line);
      };
      draw(jump.walkSpeed, 0xffd166, 'jumpWalk');
      draw(jump.runSpeed, 0x4fc3f7, 'jumpRun');
      if (obstacles) {
        const material = new MeshBasicMaterial({
          color: 0xb0b8c4,
          transparent: true,
          opacity: 0.5,
          side: DoubleSide,
        });
        const box = (height: number, z: number, depth: number, name: string): void => {
          const mesh = new Mesh(new BoxGeometry(0.4, height, depth), material);
          mesh.position.set(-1.2, height / 2, z);
          mesh.name = name;
          this.helpers.add(mesh);
        };
        // Step 0.3 m, crate 1 m; the gap is a dark strip of 2 m.
        box(0.3, 0.8, 0.4, 'obstacleStep');
        box(1, 1.8, 0.6, 'obstacleCrate');
        const gap = new Mesh(
          new BoxGeometry(0.4, 0.02, 2),
          new MeshBasicMaterial({ color: 0x12151a }),
        );
        gap.position.set(-1.2, 0.015, 3.2);
        gap.name = 'obstacleGap';
        this.helpers.add(gap);
      }
    }
    this.game?.world.scene.add(this.helpers);
  }

  private readonly loopFrame = (time: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loopFrame);
    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;
    const game = this.game;
    if (!game) return;
    if (!this.helpers.parent) game.world.scene.add(this.helpers);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= TICK_SECONDS && steps < 4) {
      game.stepTick();
      this.accumulator -= TICK_SECONDS;
      steps++;
    }
    if (steps === 4) this.accumulator = 0;
    if (this.spin) this.yaw += dt * 0.5;
    this.draw(game);
  };

  private draw(game: Game): void {
    const canvas = this.renderer.domElement;
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    if (canvas.width !== Math.floor(canvas.clientWidth * this.renderer.getPixelRatio())) {
      this.resize(canvas.clientWidth, canvas.clientHeight);
    }
    game.world.prepareRender();
    const scene = game.world.scene;
    scene.background = new Color(0x2a2d33);
    // The camera preview is a second full draw; on CPU-drawn machines it refreshes every third frame.
    if (this.preview && (this.drawn++ % 3 === 0 || !isSoftwareRenderer(this.renderer))) {
      this.drawCameraView(game);
    }
    const target = new Vector3(0, this.height * 0.5, 0);
    const distance = (this.height * 2.6 + 0.8) * this.zoom;
    this.camera.position.set(
      target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      target.y + Math.sin(this.pitch) * distance,
      target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    );
    this.camera.lookAt(target);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.renderer.render(scene, this.camera);
  }

  /** Draws the figure as the game camera sees it into the small preview canvas. */
  private drawCameraView(game: Game): void {
    const preview = this.preview;
    if (!preview) return;
    const { canvas: target, settings } = preview;
    const canvas = this.renderer.domElement;
    const ratio = this.renderer.getPixelRatio();
    const width = Math.max(1, Math.min(canvas.clientWidth, 200));
    const height = Math.max(1, Math.round(width * 0.6));
    this.cameraView.fov = settings.fov;
    this.cameraView.aspect = width / height;
    this.cameraView.updateProjectionMatrix();
    // The game camera hangs behind the figure's head, looking at it from the side of the shoulder.
    this.cameraView.position.set(settings.shoulder, settings.height + 0.4, -settings.distance);
    this.cameraView.lookAt(0, settings.height * 0.75, 0);
    const hidden = this.helpers.visible;
    this.helpers.visible = false;
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(0, 0, width, height);
    this.renderer.setScissor(0, 0, width, height);
    this.renderer.render(game.world.scene, this.cameraView);
    this.renderer.setScissorTest(false);
    this.helpers.visible = hidden;
    if (target.width !== width * ratio) {
      target.width = Math.round(width * ratio);
      target.height = Math.round(height * ratio);
    }
    const context = target.getContext('2d');
    context?.drawImage(
      canvas,
      0,
      canvas.height - height * ratio,
      width * ratio,
      height * ratio,
      0,
      0,
      target.width,
      target.height,
    );
  }
}
