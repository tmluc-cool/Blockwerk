import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { seededRandom } from './TerrainData';
import type { TerrainData } from './TerrainData';

/** Settings of the grass of a terrain. */
export interface GrassSettings {
  /** Clumps per square meter on the grass layer at the "High" graphics level. */
  readonly density: number;
  /** Height of a clump in meters. */
  readonly height: number;
  readonly color: string;
  /** Layer (0..3) the grass grows on. */
  readonly layer: number;
  /** No grass below this height in meters (around lakes). */
  readonly minHeight: number;
  /** Graphics level factor on the number of clumps. */
  readonly quality: number;
  /** Distance in meters at which clumps have faded away. */
  readonly distance: number;
}

/** Most clumps one terrain draws, whatever the density. */
const MAX_CLUMPS = 120000;

/** A clump: three crossed, tapered blades, with colors from dark at the root to light at the tip. */
function clumpGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const blades = 3;
  for (let blade = 0; blade < blades; blade++) {
    const angle = (blade / blades) * Math.PI;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const half = 0.09;
    // Two triangles per blade: a wide root and a pointed tip.
    const corners: [number, number, number][] = [
      [-half * dx, 0, -half * dz],
      [half * dx, 0, half * dz],
      [0, 1, 0],
    ];
    for (const [x, y, z] of corners) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      const light = 0.55 + 0.45 * y;
      colors.push(light, light, light);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  return geometry;
}

/**
 * Grass on a terrain: clumps scattered over the grass layer, drawn as one instanced mesh. They
 * sway in the wind and fade out with distance. The scattering is deterministic.
 */
export class TerrainGrass {
  /** Holds the instanced mesh (replaced whenever the clumps are scattered again). */
  readonly root = new Group();
  private readonly geometry = clumpGeometry();
  private mesh: InstancedMesh | null = null;
  private readonly material: MeshStandardMaterial;
  private readonly uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.3 },
    uHeight: { value: 0.4 },
    uFade: { value: 60 },
  };
  private count = 0;

  constructor(
    private readonly data: TerrainData,
    private settings: GrassSettings,
    private readonly windSpeed: () => number,
  ) {
    this.material = new MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      side: DoubleSide,
    });
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'uniform float uTime;\nuniform float uWind;\nuniform float uHeight;\nuniform float uFade;\nvoid main() {',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 clumpCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float tipness = position.y;
          float sway = sin(uTime * 1.7 + clumpCenter.x * 0.6 + clumpCenter.z * 0.45);
          transformed.x += sway * 0.10 * tipness * tipness * (0.4 + uWind);
          transformed.z += sway * 0.06 * tipness * tipness * (0.4 + uWind);
          float away = distance(clumpCenter, cameraPosition);
          transformed *= 1.0 - smoothstep(uFade * 0.7, uFade, away);`,
        );
    };
    this.rebuild(settings);
  }

  /** Number of clumps drawn. */
  get clumps(): number {
    return this.count;
  }

  /** Scatters the clumps again (new settings, repainted terrain or another graphics level). */
  rebuild(settings: GrassSettings = this.settings): void {
    this.settings = settings;
    this.uniforms.uHeight.value = settings.height;
    this.uniforms.uFade.value = settings.distance;
    const density = Math.max(0, settings.density * settings.quality);
    const size = this.data.size;
    const spacing = density > 0 ? 1 / Math.sqrt(density) : Infinity;
    const perSide = Number.isFinite(spacing) ? Math.floor(size / spacing) : 0;
    const random = seededRandom(7);
    const dummy = new Object3D();
    const base = new Color(settings.color);
    const color = new Color();
    const matrices: Object3D[] = [];
    const colors: Color[] = [];
    for (let iz = 0; iz < perSide && matrices.length < MAX_CLUMPS; iz++) {
      for (let ix = 0; ix < perSide && matrices.length < MAX_CLUMPS; ix++) {
        const x = (ix + random()) * spacing - size / 2;
        const z = (iz + random()) * spacing - size / 2;
        const keep = random();
        const weight = this.data.weightAt(settings.layer, x, z);
        if (keep > weight * weight) continue;
        const y = this.data.heightAt(x, z);
        if (y < settings.minHeight || this.data.slopeAt(x, z) > 0.65) continue;
        const scale = 0.7 + random() * 0.7;
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, random() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale * settings.height, scale);
        dummy.updateMatrix();
        matrices.push(dummy.clone());
        const tone = 0.8 + random() * 0.4;
        color.copy(base).multiplyScalar(tone);
        colors.push(color.clone());
      }
    }
    this.count = matrices.length;
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh.dispose();
      this.mesh = null;
    }
    if (this.count === 0) return;
    const mesh = new InstancedMesh(this.geometry, this.material, this.count);
    mesh.name = 'Grass';
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.raycast = () => undefined;
    mesh.onBeforeRender = () => {
      this.uniforms.uTime.value = performance.now() / 1000;
      this.uniforms.uWind.value = Math.min(1.5, this.windSpeed() / 8);
    };
    matrices.forEach((item, i) => mesh.setMatrixAt(i, item.matrix));
    colors.forEach((item, i) => mesh.setColorAt(i, item));
    this.root.add(mesh);
    this.mesh = mesh;
  }

  /** Frees the geometry and material. */
  dispose(): void {
    this.root.removeFromParent();
    this.mesh?.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
