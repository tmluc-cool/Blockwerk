import {
  DataTexture,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';

/** Number of texels per tile edge. One tile covers one square meter. */
export const GROUND_TEXTURE_SIZE = 256;

/** Deterministic 2D value noise in the range [0, 1). */
function hashNoise(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise sampled on a periodic lattice so the tile repeats seamlessly. */
function smoothNoise(u: number, v: number, period: number): number {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const wrap = (n: number): number => ((n % period) + period) % period;
  const a = hashNoise(wrap(x0), wrap(y0));
  const b = hashNoise(wrap(x0 + 1), wrap(y0));
  const c = hashNoise(wrap(x0), wrap(y0 + 1));
  const d = hashNoise(wrap(x0 + 1), wrap(y0 + 1));
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Generates the RGBA pixels of the default ground tile: a calm, slightly mottled
 * stone-grey surface with a soft seam at the tile border. Pure function, usable in tests.
 */
export function generateGroundPixels(size: number = GROUND_TEXTURE_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const base = [148, 152, 140];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const noise =
        0.55 * smoothNoise(u, v, 8) + 0.3 * smoothNoise(u, v, 32) + 0.15 * hashNoise(x, y);
      const edge = Math.min(u, v, 1 - u, 1 - v) * size;
      const seam = edge < 1.5 ? 0.82 : edge < 3 ? 0.93 : 1;
      const shade = (0.88 + noise * 0.2) * seam;
      const i = (y * size + x) * 4;
      data[i] = Math.min(255, Math.round((base[0] ?? 0) * shade));
      data[i + 1] = Math.min(255, Math.round((base[1] ?? 0) * shade));
      data[i + 2] = Math.min(255, Math.round((base[2] ?? 0) * shade));
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Creates the tiling ground texture (one repeat per meter, set `repeat` to the ground size). */
export function createGroundTexture(): DataTexture {
  const texture = new DataTexture(
    generateGroundPixels(),
    GROUND_TEXTURE_SIZE,
    GROUND_TEXTURE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
