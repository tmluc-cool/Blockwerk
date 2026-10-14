/** Number of paint layers of a terrain. */
export const TERRAIN_LAYERS = 4;

/** Magic bytes at the start of a `.terrain.bin` file. */
const MAGIC = 0x52545742; // "BWTR" little endian
const VERSION = 1;
const HEADER_BYTES = 16;

/** Tools that change a terrain (SPEC 8.14). */
export const TERRAIN_TOOLS = ['raise', 'lower', 'smooth', 'flatten', 'paint'] as const;
export type TerrainTool = (typeof TERRAIN_TOOLS)[number];

/** A brush stroke: where, how big, how strong. Positions are in meters from the terrain center. */
export interface TerrainBrush {
  readonly tool: TerrainTool;
  readonly x: number;
  readonly z: number;
  /** Radius in meters. */
  readonly radius: number;
  /** Strength 0..1 per application. */
  readonly strength: number;
  /** Layer painted with the `paint` tool (0..3). */
  readonly layer?: number;
  /** Height the `flatten` tool levels to, in meters. */
  readonly height?: number;
}

/** A square rectangle of vertices that changed (for partial updates). */
export interface TerrainRegion {
  readonly minX: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxZ: number;
}

/** A small deterministic random number generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in 2D; same inputs always give the same result. */
function valueNoise(x: number, z: number, seed: number): number {
  const hash = (ix: number, iz: number): number => {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/**
 * The height map and paint weights of a terrain: a square grid of `resolution` × `resolution`
 * vertices covering `size` × `size` meters, centered on the object. Heights are in meters;
 * every vertex has four layer weights (0..255) that add up to 255.
 */
export class TerrainData {
  /** Vertices per side. */
  readonly resolution: number;
  /** Side length in meters. */
  readonly size: number;
  /** Height in meters per vertex, row by row (index = z * resolution + x). */
  readonly heights: Float32Array;
  /** Layer weights per vertex, four bytes each. */
  readonly splat: Uint8Array;

  constructor(resolution: number, size: number) {
    if (!Number.isInteger(resolution) || resolution < 3 || resolution > 1025) {
      throw new Error(`Terrain resolution must be an integer from 3 to 1025, got ${resolution}.`);
    }
    if (!(size > 0)) throw new Error('Terrain size must be positive.');
    this.resolution = resolution;
    this.size = size;
    this.heights = new Float32Array(resolution * resolution);
    this.splat = new Uint8Array(resolution * resolution * TERRAIN_LAYERS);
    for (let i = 0; i < resolution * resolution; i++) this.splat[i * TERRAIN_LAYERS] = 255;
  }

  /** Distance between two neighboring vertices in meters. */
  get cell(): number {
    return this.size / (this.resolution - 1);
  }

  /** Index of the vertex nearest to a position, clamped to the terrain; or -1 outside. */
  private cellOf(x: number, z: number): { gx: number; gz: number; fx: number; fz: number } {
    const last = this.resolution - 1;
    const u = Math.min(Math.max((x / this.size + 0.5) * last, 0), last);
    const v = Math.min(Math.max((z / this.size + 0.5) * last, 0), last);
    const gx = Math.min(Math.floor(u), last - 1);
    const gz = Math.min(Math.floor(v), last - 1);
    return { gx, gz, fx: u - gx, fz: v - gz };
  }

  /** Height in meters at a position (meters from the center), interpolated. */
  heightAt(x: number, z: number): number {
    const { gx, gz, fx, fz } = this.cellOf(x, z);
    const n = this.resolution;
    const h = this.heights;
    const i = gz * n + gx;
    const h00 = h[i] ?? 0;
    const h10 = h[i + 1] ?? 0;
    const h01 = h[i + n] ?? 0;
    const h11 = h[i + n + 1] ?? 0;
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz + (h00 - h10 - h01 + h11) * fx * fz;
  }

  /** Steepness at a position in 0..1 (0 flat, 1 = 45 degrees or more). */
  slopeAt(x: number, z: number): number {
    const step = this.cell;
    const dx = (this.heightAt(x + step, z) - this.heightAt(x - step, z)) / (2 * step);
    const dz = (this.heightAt(x, z + step) - this.heightAt(x, z - step)) / (2 * step);
    return Math.min(1, Math.hypot(dx, dz));
  }

  /** Weight (0..1) of a paint layer at a position, interpolated. */
  weightAt(layer: number, x: number, z: number): number {
    const { gx, gz, fx, fz } = this.cellOf(x, z);
    const n = this.resolution;
    const at = (ix: number, iz: number): number =>
      (this.splat[(iz * n + ix) * TERRAIN_LAYERS + layer] ?? 0) / 255;
    const a = at(gx, gz);
    const b = at(gx + 1, gz);
    const c = at(gx, gz + 1);
    const d = at(gx + 1, gz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  /** Lowest and highest height in meters. */
  heightRange(): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const height of this.heights) {
      if (height < min) min = height;
      if (height > max) max = height;
    }
    return { min, max };
  }

  /** Fills the terrain with rolling hills (fractal noise). Returns the whole region. */
  generateHills(seed: number, amplitude: number, frequency: number): TerrainRegion {
    const n = this.resolution;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const wx = (x / (n - 1) - 0.5) * this.size;
        const wz = (z / (n - 1) - 0.5) * this.size;
        let height = 0;
        let strength = 1;
        let scale = frequency;
        let total = 0;
        for (let octave = 0; octave < 4; octave++) {
          height += (valueNoise(wx * scale, wz * scale, seed + octave * 31) - 0.5) * strength;
          total += strength;
          strength *= 0.5;
          scale *= 2;
        }
        this.heights[z * n + x] = (height / total) * 2 * amplitude;
      }
    }
    return this.fullRegion();
  }

  /** Digs a round basin (a lake bed) with soft edges. */
  carveBasin(x: number, z: number, radius: number, depth: number): TerrainRegion | null {
    return this.applyHeights(x, z, radius * 1.6, (height, distance) => {
      const t = Math.min(1, distance / (radius * 1.6));
      const bowl = 1 - t * t * (3 - 2 * t);
      return height - depth * bowl;
    });
  }

  /**
   * Paints the layers from the shape of the land: `low` below the given height (sand around
   * a lake), `steep` on slopes (rock), `flat` otherwise (grass).
   */
  autoPaint(layers: { flat: number; steep: number; low: number }, lowHeight: number): void {
    const n = this.resolution;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const wx = (x / (n - 1) - 0.5) * this.size;
        const wz = (z / (n - 1) - 0.5) * this.size;
        const height = this.heights[z * n + x] ?? 0;
        const slope = this.slopeAt(wx, wz);
        const steep = Math.min(1, Math.max(0, (slope - 0.35) / 0.25));
        const low = Math.min(1, Math.max(0, (lowHeight + 0.3 - height) / 0.6));
        const weights = [0, 0, 0, 0];
        weights[layers.low] = (weights[layers.low] ?? 0) + low;
        weights[layers.steep] = (weights[layers.steep] ?? 0) + (1 - low) * steep;
        weights[layers.flat] = (weights[layers.flat] ?? 0) + (1 - low) * (1 - steep);
        this.setWeights((z * n + x) * TERRAIN_LAYERS, weights);
      }
    }
  }

  private setWeights(offset: number, weights: readonly number[]): void {
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    let used = 0;
    let largest = 0;
    for (let layer = 0; layer < TERRAIN_LAYERS; layer++) {
      const value = Math.round(((weights[layer] ?? 0) / total) * 255);
      this.splat[offset + layer] = value;
      used += value;
      if ((weights[layer] ?? 0) > (weights[largest] ?? 0)) largest = layer;
    }
    // Rounding must not change the total.
    this.splat[offset + largest] = (this.splat[offset + largest] ?? 0) + (255 - used);
  }

  /** Applies a brush stroke and returns the vertices that changed. */
  apply(brush: TerrainBrush): TerrainRegion | null {
    const strength = Math.min(1, Math.max(0, brush.strength));
    if (brush.tool === 'paint') return this.paint(brush, strength);
    if (brush.tool === 'smooth') {
      return this.applyHeights(brush.x, brush.z, brush.radius, (height, distance, x, z) => {
        const step = this.cell;
        const average =
          (this.heightAt(x + step, z) +
            this.heightAt(x - step, z) +
            this.heightAt(x, z + step) +
            this.heightAt(x, z - step)) /
          4;
        return (
          height + (average - height) * Math.min(1, falloff(distance, brush.radius) * strength * 2)
        );
      });
    }
    const target = brush.height ?? 0;
    return this.applyHeights(brush.x, brush.z, brush.radius, (height, distance) => {
      const weight = falloff(distance, brush.radius) * strength;
      if (brush.tool === 'raise') return height + weight * this.cell * 0.5;
      if (brush.tool === 'lower') return height - weight * this.cell * 0.5;
      return height + (target - height) * Math.min(1, weight * 2);
    });
  }

  private paint(brush: TerrainBrush, strength: number): TerrainRegion | null {
    const layer = Math.min(TERRAIN_LAYERS - 1, Math.max(0, Math.round(brush.layer ?? 0)));
    const region = this.regionOf(brush.x, brush.z, brush.radius);
    if (!region) return null;
    const n = this.resolution;
    for (let z = region.minZ; z <= region.maxZ; z++) {
      for (let x = region.minX; x <= region.maxX; x++) {
        const distance = Math.hypot(this.worldX(x) - brush.x, this.worldX(z) - brush.z);
        if (distance > brush.radius) continue;
        const add = falloff(distance, brush.radius) * strength;
        const offset = (z * n + x) * TERRAIN_LAYERS;
        const weights: number[] = [];
        for (let i = 0; i < TERRAIN_LAYERS; i++) {
          const current = (this.splat[offset + i] ?? 0) / 255;
          weights.push(i === layer ? current + (1 - current) * add : current * (1 - add));
        }
        this.setWeights(offset, weights);
      }
    }
    return region;
  }

  /** Runs a height change over the vertices inside a circle. */
  private applyHeights(
    x: number,
    z: number,
    radius: number,
    change: (height: number, distance: number, wx: number, wz: number) => number,
  ): TerrainRegion | null {
    const region = this.regionOf(x, z, radius);
    if (!region) return null;
    const n = this.resolution;
    const next = new Map<number, number>();
    for (let gz = region.minZ; gz <= region.maxZ; gz++) {
      for (let gx = region.minX; gx <= region.maxX; gx++) {
        const wx = this.worldX(gx);
        const wz = this.worldX(gz);
        const distance = Math.hypot(wx - x, wz - z);
        if (distance > radius) continue;
        next.set(gz * n + gx, change(this.heights[gz * n + gx] ?? 0, distance, wx, wz));
      }
    }
    for (const [index, height] of next) this.heights[index] = height;
    return region;
  }

  private worldX(index: number): number {
    return (index / (this.resolution - 1) - 0.5) * this.size;
  }

  private regionOf(x: number, z: number, radius: number): TerrainRegion | null {
    const last = this.resolution - 1;
    const toIndex = (value: number): number => (value / this.size + 0.5) * last;
    const minX = Math.max(0, Math.floor(toIndex(x - radius)));
    const maxX = Math.min(last, Math.ceil(toIndex(x + radius)));
    const minZ = Math.max(0, Math.floor(toIndex(z - radius)));
    const maxZ = Math.min(last, Math.ceil(toIndex(z + radius)));
    if (minX > maxX || minZ > maxZ) return null;
    return { minX, minZ, maxX, maxZ };
  }

  private fullRegion(): TerrainRegion {
    const last = this.resolution - 1;
    return { minX: 0, minZ: 0, maxX: last, maxZ: last };
  }

  /** The `.terrain.bin` file: header, heights (float32), layer weights (uint8). */
  serialize(): Uint8Array {
    const count = this.resolution * this.resolution;
    const bytes = new Uint8Array(HEADER_BYTES + count * 4 + count * TERRAIN_LAYERS);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, MAGIC, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, this.resolution, true);
    view.setFloat32(8, this.size, true);
    view.setUint32(12, TERRAIN_LAYERS, true);
    for (let i = 0; i < count; i++) {
      view.setFloat32(HEADER_BYTES + i * 4, this.heights[i] ?? 0, true);
    }
    bytes.set(this.splat, HEADER_BYTES + count * 4);
    return bytes;
  }

  /** Reads a `.terrain.bin` file; throws if it is not a terrain file. */
  static deserialize(bytes: Uint8Array): TerrainData {
    if (bytes.byteLength < HEADER_BYTES) throw new Error('Terrain file is too short.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== MAGIC) throw new Error('Not a terrain file.');
    if (view.getUint16(4, true) !== VERSION) throw new Error('Unsupported terrain file version.');
    const resolution = view.getUint16(6, true);
    const size = view.getFloat32(8, true);
    const layers = view.getUint32(12, true);
    if (layers !== TERRAIN_LAYERS) throw new Error('Unsupported number of terrain layers.');
    const terrain = new TerrainData(resolution, size);
    const count = resolution * resolution;
    if (bytes.byteLength !== HEADER_BYTES + count * 4 + count * TERRAIN_LAYERS) {
      throw new Error('Terrain file has the wrong size.');
    }
    for (let i = 0; i < count; i++) {
      terrain.heights[i] = view.getFloat32(HEADER_BYTES + i * 4, true);
    }
    terrain.splat.set(bytes.subarray(HEADER_BYTES + count * 4));
    return terrain;
  }

  /** An independent copy. */
  clone(): TerrainData {
    const copy = new TerrainData(this.resolution, this.size);
    copy.heights.set(this.heights);
    copy.splat.set(this.splat);
    return copy;
  }
}

/** Brush weight: 1 in the middle, smoothly 0 at the edge. */
function falloff(distance: number, radius: number): number {
  const t = Math.min(1, Math.max(0, distance / Math.max(radius, 1e-6)));
  return 1 - t * t * (3 - 2 * t);
}
