import { describe, expect, it } from 'vitest';
import {
  BUILTIN_EFFECTS,
  BUILTIN_LOOPS,
  BUILTIN_SOUNDS,
  isBuiltinSound,
  isLoopingSound,
  SYNTH_RATE,
  synthesize,
} from '../src';

describe('built-in sounds', () => {
  it('makes every sound with finite samples inside -1..1 and some loudness', () => {
    for (const name of BUILTIN_SOUNDS) {
      const samples = synthesize(name);
      expect(samples.length, name).toBeGreaterThan(SYNTH_RATE * 0.04);
      let peak = 0;
      for (const sample of samples) {
        expect(Number.isFinite(sample), name).toBe(true);
        peak = Math.max(peak, Math.abs(sample));
      }
      expect(peak, name).toBeGreaterThan(0.2);
      expect(peak, name).toBeLessThanOrEqual(1);
    }
  });

  it('makes the same samples every time', () => {
    expect(synthesize('explosion')).toEqual(synthesize('explosion'));
    expect(synthesize('footstep-grass')).not.toEqual(synthesize('footstep-stone'));
  });

  it('keeps effects short and loops long enough to loop without a hole at the seam', () => {
    for (const name of BUILTIN_EFFECTS) {
      expect(synthesize(name).length, name).toBeLessThan(SYNTH_RATE * 1.5);
    }
    for (const name of BUILTIN_LOOPS) {
      const samples = synthesize(name);
      expect(samples.length, name).toBeGreaterThan(SYNTH_RATE * 4);
      // The loop ends as loud as it starts, so it does not pump or click when it repeats.
      const level = (from: number): number => {
        let sum = 0;
        for (let i = from; i < from + 2000; i++) sum += (samples[i] ?? 0) ** 2;
        return Math.sqrt(sum / 2000);
      };
      const ratio = level(samples.length - 2000) / Math.max(level(0), 1e-6);
      expect(ratio, name).toBeGreaterThan(0.3);
      expect(ratio, name).toBeLessThan(3);
    }
  });

  it('recognizes built-in names and which of them loop', () => {
    expect(isBuiltinSound('jump')).toBe(true);
    expect(isBuiltinSound('library:something')).toBe(false);
    expect(isLoopingSound('music-calm')).toBe(true);
    expect(isLoopingSound('jump')).toBe(false);
  });
});
