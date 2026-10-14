import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { World } from '../world/World';

/** One rendered view of the game: a camera and which player it shows. */
export interface GameView {
  readonly camera: PerspectiveCamera;
  readonly player: 'all' | '1' | '2';
}

/** The views of the game view and how the screen is split. */
export interface GameViews {
  readonly views: readonly GameView[];
  readonly split: 'horizontal' | 'vertical';
}

interface Blend {
  readonly camera: PerspectiveCamera;
  readonly fromPosition: Vector3;
  readonly fromQuaternion: Quaternion;
  readonly fromFov: number;
  readonly to: PerspectiveCamera;
  elapsed: number;
  readonly duration: number;
}

/**
 * Smooth transitions between cameras (Unity: Cinemachine blends): when another camera takes over
 * a view, the picture glides from the old camera to the new one over the new camera's blend time.
 */
export class CameraTransitions {
  private readonly current = new Map<string, PerspectiveCamera>();
  private readonly blends = new Map<string, Blend>();
  private latest: GameViews = { views: [], split: 'vertical' };

  /** Advances the transitions; call once per tick after the cameras moved. */
  update(world: World, dt: number): void {
    const found = world.viewCameras();
    const views: GameView[] = [];
    for (const view of found.views) {
      const slot = view.player;
      const before = this.current.get(slot);
      if (before && before !== view.camera && view.blendTime > 0) {
        // Start from what was shown last, also in the middle of another transition.
        const shown = this.blends.get(slot)?.camera ?? before;
        shown.updateWorldMatrix(true, false);
        const camera = new PerspectiveCamera();
        this.blends.set(slot, {
          camera,
          fromPosition: shown.getWorldPosition(new Vector3()),
          fromQuaternion: shown.getWorldQuaternion(new Quaternion()),
          fromFov: shown.fov,
          to: view.camera,
          elapsed: 0,
          duration: view.blendTime,
        });
      } else if (before !== view.camera) this.blends.delete(slot);
      this.current.set(slot, view.camera);
      const blend = this.blends.get(slot);
      if (blend) {
        blend.elapsed += dt;
        const t = Math.min(1, blend.elapsed / blend.duration);
        const eased = t * t * (3 - 2 * t);
        const to = blend.to;
        to.updateWorldMatrix(true, false);
        blend.camera.position.lerpVectors(
          blend.fromPosition,
          to.getWorldPosition(new Vector3()),
          eased,
        );
        blend.camera.quaternion.slerpQuaternions(
          blend.fromQuaternion,
          to.getWorldQuaternion(new Quaternion()),
          eased,
        );
        blend.camera.fov = blend.fromFov + (to.fov - blend.fromFov) * eased;
        blend.camera.near = to.near;
        blend.camera.far = to.far;
        blend.camera.updateProjectionMatrix();
        blend.camera.updateMatrixWorld(true);
        if (t >= 1) this.blends.delete(slot);
        views.push({ camera: t >= 1 ? to : blend.camera, player: view.player });
      } else views.push({ camera: view.camera, player: view.player });
    }
    for (const slot of [...this.current.keys()]) {
      if (!found.views.some((view) => view.player === slot)) {
        this.current.delete(slot);
        this.blends.delete(slot);
      }
    }
    this.latest = { views, split: found.split };
  }

  /** The views to render (with transition cameras while a transition runs). */
  views(world: World): GameViews {
    // Before the first tick, show the cameras directly.
    if (this.current.size === 0) {
      const found = world.viewCameras();
      return {
        views: found.views.map(({ camera, player }) => ({ camera, player })),
        split: found.split,
      };
    }
    return this.latest;
  }
}
