import { create } from 'zustand';

/** What the brush places: a library model or a project prefab. */
export type BrushSource = { readonly kind: 'library' | 'prefab'; readonly id: string };

/** Brush settings (SPEC phase 2: "Pinsel" for spreading many objects). */
export interface BrushState {
  /** Active brush, or `null` when the scene view selects and moves as usual. */
  source: BrushSource | null;
  /** Radius of a stamp in meters. */
  radius: number;
  /** Smallest distance between placed objects in meters. */
  spacing: number;
  /** Random rotation around the up axis. */
  randomRotation: boolean;
  /** Random uniform scale range. */
  scaleMin: number;
  scaleMax: number;
  set: (patch: Partial<Omit<BrushState, 'set'>>) => void;
}

/** The brush of the scene view. */
export const useBrush = create<BrushState>()((set) => ({
  source: null,
  radius: 3,
  spacing: 2,
  randomRotation: true,
  scaleMin: 0.8,
  scaleMax: 1.2,
  set: (patch) => set(patch),
}));

/** A point on the ground plane (x, z). */
export type GroundPoint = readonly [number, number];

/** Attempts per stamp relative to how many objects fit into the circle. */
const ATTEMPTS_PER_SLOT = 3;

/**
 * Points for one brush stamp: random points within `radius` of `center`, each at least
 * `spacing` away from `taken` points and from each other (dart throwing).
 */
export function brushStamp(
  center: GroundPoint,
  radius: number,
  spacing: number,
  taken: readonly GroundPoint[],
  random: () => number = Math.random,
): GroundPoint[] {
  const slots = Math.max(1, Math.floor((radius * radius) / Math.max(spacing * spacing, 0.01)));
  const placed: GroundPoint[] = [];
  const nearby = taken.filter(
    ([x, z]) => Math.hypot(x - center[0], z - center[1]) < radius + spacing,
  );
  for (let attempt = 0; attempt < slots * ATTEMPTS_PER_SLOT && placed.length < slots; attempt++) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const point: GroundPoint = [
      center[0] + Math.cos(angle) * distance,
      center[1] + Math.sin(angle) * distance,
    ];
    const free = [...nearby, ...placed].every(
      ([x, z]) => Math.hypot(x - point[0], z - point[1]) >= spacing,
    );
    if (free) placed.push(point);
  }
  return placed;
}
