import { createPrimitive, Environment } from '@blockwerk/runtime';
import { Euler, MathUtils, Object3D, PerspectiveCamera, Scene } from 'three';
import type { Mesh } from 'three';
import { SAMPLE_SCENE, SUN } from '../state/scene';
import type { SceneObjectInfo } from '../state/scene';

/** The three.js representation of the sample scene, built once per viewport. */
export interface SampleWorld {
  readonly scene: Scene;
  readonly environment: Environment;
  /** Scene graph node per scene-object ID. */
  readonly objects: ReadonlyMap<string, Object3D>;
  /** Meshes that can be picked with the mouse, with the ID of their scene object. */
  readonly pickables: readonly { readonly id: string; readonly mesh: Mesh }[];
  /** The camera of the "Main Camera" object, used by the Game view. */
  readonly mainCamera: PerspectiveCamera;
  dispose(): void;
}

/** Applies position, rotation (degrees, Unity order Z-X-Y) and scale of a scene object. */
export function applyTransform(target: Object3D, info: SceneObjectInfo): void {
  target.position.set(...info.position);
  const [x, y, z] = info.rotation;
  target.rotation.copy(
    new Euler(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'YXZ'),
  );
  target.scale.set(...info.scale);
}

/** Builds sky, sun, ground, test cube and main camera of the sample scene. */
export function buildSampleWorld(): SampleWorld {
  const scene = new Scene();
  const environment = new Environment({ sunElevation: SUN.elevation, sunAzimuth: SUN.azimuth });
  environment.addTo(scene);

  const objects = new Map<string, Object3D>();
  const pickables: { id: string; mesh: Mesh }[] = [];
  const mainCamera = new PerspectiveCamera(60, 16 / 9, 0.1, 5000);

  for (const info of SAMPLE_SCENE) {
    switch (info.kind) {
      case 'camera': {
        applyTransform(mainCamera, info);
        mainCamera.name = info.id;
        scene.add(mainCamera);
        objects.set(info.id, mainCamera);
        break;
      }
      case 'sun': {
        const marker = new Object3D();
        marker.name = info.id;
        applyTransform(marker, info);
        scene.add(marker);
        objects.set(info.id, marker);
        break;
      }
      case 'ground': {
        if (environment.ground) {
          objects.set(info.id, environment.ground);
          pickables.push({ id: info.id, mesh: environment.ground });
        }
        break;
      }
      case 'cube': {
        const cube = createPrimitive('cube', { color: 0xe8893a, roughness: 0.5 });
        cube.name = info.id;
        applyTransform(cube, info);
        scene.add(cube);
        objects.set(info.id, cube);
        pickables.push({ id: info.id, mesh: cube });
        break;
      }
    }
  }

  return {
    scene,
    environment,
    objects,
    pickables,
    mainCamera,
    dispose() {
      for (const { mesh } of pickables) {
        if (mesh === environment.ground) continue;
        mesh.geometry.dispose();
        const material = mesh.material;
        (Array.isArray(material) ? material : [material]).forEach((item) => item.dispose());
      }
      environment.dispose();
    },
  };
}
