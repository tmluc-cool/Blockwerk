import { BufferAttribute, BufferGeometry, Color, Mesh, MeshStandardMaterial } from 'three';
import type { Vector3Tuple } from 'three';
import { TERRAIN_LAYERS } from './TerrainData';
import type { TerrainData, TerrainRegion } from './TerrainData';

/** Colors of the four paint layers (`#rrggbb`). */
export type TerrainLayerColors = readonly [string, string, string, string];

/** Shader code that blends the layers; detail comes from noise on the world position. */
const NOISE_HEADER = /* glsl */ `
varying vec4 vSplat;
varying vec3 vTerrainPos;
uniform vec3 uLayer0;
uniform vec3 uLayer1;
uniform vec3 uLayer2;
uniform vec3 uLayer3;
float terrainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float terrainNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(terrainHash(i), terrainHash(i + vec2(1.0, 0.0)), f.x),
             mix(terrainHash(i + vec2(0.0, 1.0)), terrainHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * The drawn surface of a terrain: one mesh with a vertex per height sample. The four paint
 * layers are blended in the material with a little noise so large areas do not look flat.
 */
export class TerrainMesh {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly material: MeshStandardMaterial;
  private readonly layerUniforms = [0, 1, 2, 3].map(() => ({ value: new Color() }));
  private readonly position: Float32Array;
  private readonly normal: Float32Array;
  private readonly splat: Float32Array;

  constructor(
    private data: TerrainData,
    colors: TerrainLayerColors,
  ) {
    const count = data.resolution * data.resolution;
    this.position = new Float32Array(count * 3);
    this.normal = new Float32Array(count * 3);
    this.splat = new Float32Array(count * TERRAIN_LAYERS);
    this.geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    this.geometry.setAttribute('normal', new BufferAttribute(this.normal, 3));
    this.geometry.setAttribute('splat', new BufferAttribute(this.splat, TERRAIN_LAYERS));
    this.geometry.setIndex(new BufferAttribute(buildIndex(data.resolution), 1));
    this.material = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
    this.material.onBeforeCompile = (shader) => {
      this.layerUniforms.forEach((uniform, i) => {
        shader.uniforms[`uLayer${i}`] = uniform;
      });
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'attribute vec4 splat;\nvarying vec4 vSplat;\nvarying vec3 vTerrainPos;\nvoid main() {',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSplat = splat;\nvTerrainPos = position;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', `${NOISE_HEADER}\nvoid main() {`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          {
            float broad = terrainNoise(vTerrainPos.xz * 0.12);
            float fine = terrainNoise(vTerrainPos.xz * 1.9);
            float shade = 0.78 + 0.26 * broad + 0.12 * (fine - 0.5);
            vec3 layerColor = uLayer0 * vSplat.x + uLayer1 * vSplat.y + uLayer2 * vSplat.z + uLayer3 * vSplat.w;
            diffuseColor.rgb *= layerColor * shade;
          }`,
        );
    };
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = 'Terrain';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.setColors(colors);
    this.update(null);
  }

  /** The height data this mesh shows. */
  get terrain(): TerrainData {
    return this.data;
  }

  /** Changes the colors of the paint layers. */
  setColors(colors: TerrainLayerColors): void {
    colors.forEach((color, i) => this.layerUniforms[i]?.value.set(color));
  }

  /** Redraws after the data changed (the whole terrain with `null`, or just a region). */
  update(region: TerrainRegion | null): void {
    const n = this.data.resolution;
    const last = n - 1;
    const minX = Math.max(0, (region?.minX ?? 0) - 1);
    const maxX = Math.min(last, (region?.maxX ?? last) + 1);
    const minZ = Math.max(0, (region?.minZ ?? 0) - 1);
    const maxZ = Math.min(last, (region?.maxZ ?? last) + 1);
    const heights = this.data.heights;
    const cell = this.data.cell;
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const i = z * n + x;
        this.position[i * 3] = (x / last - 0.5) * this.data.size;
        this.position[i * 3 + 1] = heights[i] ?? 0;
        this.position[i * 3 + 2] = (z / last - 0.5) * this.data.size;
        const left = heights[z * n + Math.max(0, x - 1)] ?? 0;
        const right = heights[z * n + Math.min(last, x + 1)] ?? 0;
        const back = heights[Math.max(0, z - 1) * n + x] ?? 0;
        const front = heights[Math.min(last, z + 1) * n + x] ?? 0;
        const dx = (left - right) / (2 * cell);
        const dz = (back - front) / (2 * cell);
        const length = Math.hypot(dx, 1, dz);
        this.normal[i * 3] = dx / length;
        this.normal[i * 3 + 1] = 1 / length;
        this.normal[i * 3 + 2] = dz / length;
        for (let layer = 0; layer < TERRAIN_LAYERS; layer++) {
          this.splat[i * TERRAIN_LAYERS + layer] =
            (this.data.splat[i * TERRAIN_LAYERS + layer] ?? 0) / 255;
        }
      }
    }
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.getAttribute('normal').needsUpdate = true;
    this.geometry.getAttribute('splat').needsUpdate = true;
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  /** Bounds of the surface in local space as `[min, max]`. */
  bounds(): [Vector3Tuple, Vector3Tuple] {
    const box = this.geometry.boundingBox;
    if (!box)
      return [
        [0, 0, 0],
        [0, 0, 0],
      ];
    return [box.min.toArray(), box.max.toArray()];
  }

  /** Frees the geometry and material. */
  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}

/** Triangles of the grid; indices need 32 bits above 256 vertices per side. */
function buildIndex(resolution: number): Uint16Array | Uint32Array {
  const quads = (resolution - 1) * (resolution - 1);
  const index =
    resolution * resolution > 65535 ? new Uint32Array(quads * 6) : new Uint16Array(quads * 6);
  let k = 0;
  for (let z = 0; z < resolution - 1; z++) {
    for (let x = 0; x < resolution - 1; x++) {
      const a = z * resolution + x;
      const b = a + 1;
      const c = a + resolution;
      const d = c + 1;
      // Counter-clockwise seen from above (+Y).
      index[k++] = a;
      index[k++] = c;
      index[k++] = b;
      index[k++] = b;
      index[k++] = c;
      index[k++] = d;
    }
  }
  return index;
}
