import { Box3, Group, Vector3 } from 'three';
import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** A loaded model that can be instantiated many times. */
export interface ModelTemplate {
  readonly scene: Group;
  readonly animations: readonly AnimationClip[];
  readonly skinned: boolean;
  /** Clip names chosen for standard animation states in the import settings. */
  readonly animationMap?: Readonly<Record<string, string>>;
  /** Humanoid bones set in the import settings: standard bone name → node name. */
  readonly boneMap?: Readonly<Record<string, string>>;
}

/** Where a model file is and how it is placed (import settings of project models). */
export interface ModelSource {
  /** URL of the GLB file (http, blob or data). */
  readonly url: string;
  /** Uniform scale to meters (default 1). */
  readonly scale?: number;
  /** Where the origin goes: bottom center, center of the bounds, or as in the file (default). */
  readonly pivot?: 'bottom' | 'center' | 'original';
  /** Clip names for standard animation states (import settings), e.g. `{ wave: 'Hello' }`. */
  readonly animationMap?: Readonly<Record<string, string>>;
  /** Humanoid bones set in the import settings: standard bone name → node name. */
  readonly boneMap?: Readonly<Record<string, string>>;
  /** Turns the model around the vertical axis in degrees (default 0). */
  readonly yaw?: number;
}

/**
 * Where models come from: a model reference (`library:<id>` or a project asset ID) to a URL or
 * a {@link ModelSource}, or `null` if there is no such model.
 */
export type ModelUrlResolver = (
  ref: string,
) => string | ModelSource | null | Promise<string | ModelSource | null>;

/**
 * Loads GLB models once and hands out copies. Copies of static models share geometry and
 * materials, so the world can draw equal models together (automatic instancing).
 */
export class ModelCache {
  private readonly loader = new GLTFLoader();
  private readonly templates = new Map<string, Promise<ModelTemplate | null>>();
  private readonly loaded = new Map<string, ModelTemplate | null>();

  constructor(private readonly resolve: ModelUrlResolver) {
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

  /** Loads a model (cached). Resolves to `null` if it cannot be found or loaded. */
  load(ref: string): Promise<ModelTemplate | null> {
    let template = this.templates.get(ref);
    if (!template) {
      template = this.fetchTemplate(ref).then(
        (loaded) => {
          this.loaded.set(ref, loaded);
          return loaded;
        },
        () => {
          this.loaded.set(ref, null);
          return null;
        },
      );
      this.templates.set(ref, template);
    }
    return template;
  }

  /**
   * A model that has finished loading: the template, `null` if it failed, or `undefined`
   * while it is still loading (or was never requested).
   */
  peek(ref: string): ModelTemplate | null | undefined {
    return this.loaded.get(ref);
  }

  /** Registers an already loaded model under a reference (previews, tests). */
  provide(ref: string, template: ModelTemplate): void {
    this.templates.set(ref, Promise.resolve(template));
    this.loaded.set(ref, template);
  }

  /** Forgets a model (after a project model was re-imported). */
  invalidate(ref: string): void {
    this.templates.delete(ref);
    this.loaded.delete(ref);
  }

  private async fetchTemplate(ref: string): Promise<ModelTemplate | null> {
    const resolved = await this.resolve(ref);
    if (!resolved) return null;
    const source: ModelSource = typeof resolved === 'string' ? { url: resolved } : resolved;
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Model ${source.url}: HTTP ${response.status}`);
    const gltf = await this.loader.parseAsync(await response.arrayBuffer(), '');
    const scene = placeModel(gltf.scene, source);
    let skinned = false;
    scene.traverse((node) => {
      if ((node as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned = true;
    });
    return {
      scene,
      animations: gltf.animations,
      skinned,
      animationMap: source.animationMap,
      boneMap: source.boneMap,
    };
  }

  /** A copy of a loaded model. Static copies share geometry and materials. */
  static instantiate(template: ModelTemplate): Object3D {
    return template.skinned ? cloneSkinned(template.scene) : template.scene.clone(true);
  }
}

/** Applies scale and pivot of a model source: wraps the model in a group when needed. */
function placeModel(model: Group, source: ModelSource): Group {
  const scale = source.scale ?? 1;
  const pivot = source.pivot ?? 'original';
  const yaw = source.yaw ?? 0;
  if (scale === 1 && pivot === 'original' && yaw === 0) return model;
  model.scale.multiplyScalar(scale);
  if (yaw !== 0) model.rotateY((yaw * Math.PI) / 180);
  model.updateMatrixWorld(true);
  if (pivot !== 'original') {
    const bounds = new Box3().setFromObject(model);
    if (!bounds.isEmpty()) {
      const anchor = bounds.getCenter(new Vector3());
      if (pivot === 'bottom') anchor.y = bounds.min.y;
      model.position.sub(anchor);
    }
  }
  const root = new Group();
  root.name = model.name;
  root.add(model);
  return root;
}
