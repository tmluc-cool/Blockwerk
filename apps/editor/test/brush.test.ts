import { describe, expect, it } from 'vitest';
import { brushStamp } from '../src/library/brush';

/** Deterministic random numbers. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('brush', () => {
  it('places points inside the radius, keeping the spacing', () => {
    const points = brushStamp([10, -5], 4, 1.5, [], seeded(1));
    expect(points.length).toBeGreaterThan(2);
    for (const [x, z] of points) expect(Math.hypot(x - 10, z + 5)).toBeLessThanOrEqual(4);
    for (const a of points) {
      for (const b of points) {
        if (a !== b) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it('does not place points next to existing ones', () => {
    const taken = brushStamp([0, 0], 3, 1, [], seeded(2));
    const again = brushStamp([0, 0], 3, 1, taken, seeded(3));
    for (const a of again) {
      for (const b of taken) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThanOrEqual(1);
    }
  });
});
