import type { Group } from 'three';
import type { AnimationClip, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** A loaded model that can be instantiated many times. */
export interface ModelTemplate {
  readonly scene: Group;
  readonly animations: readonly AnimationClip[];
  readonly skinned: boolean;
}

/** Where models come from: a model reference (`library:<id>` or a project asset ID) to a URL. */
export type ModelUrlResolver = (ref: string) => string | null;

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
      const url = this.resolve(ref);
      template = url
        ? this.fetchModel(url).then(
            (gltf) => {
              let skinned = false;
              gltf.scene.traverse((node) => {
                if ((node as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinned = true;
              });
              const loaded: ModelTemplate = {
                scene: gltf.scene,
                animations: gltf.animations,
                skinned,
              };
              this.loaded.set(ref, loaded);
              return loaded;
            },
            () => {
              this.loaded.set(ref, null);
              return null;
            },
          )
        : Promise.resolve(null);
      if (!url) this.loaded.set(ref, null);
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

  /** Forgets a model (after a project model was re-imported). */
  invalidate(ref: string): void {
    this.templates.delete(ref);
    this.loaded.delete(ref);
  }

  private async fetchModel(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Model ${url}: HTTP ${response.status}`);
    return this.loader.parseAsync(await response.arrayBuffer(), '');
  }

  /** A copy of a loaded model. Static copies share geometry and materials. */
  static instantiate(template: ModelTemplate): Object3D {
    return template.skinned ? cloneSkinned(template.scene) : template.scene.clone(true);
  }
}
