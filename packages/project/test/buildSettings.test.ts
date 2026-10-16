import { describe, expect, it } from 'vitest';
import { buildSettingsSchema, projectFileSchema, stringifyDeterministic } from '../src';

describe('build settings', () => {
  it('are optional: a project file without them stays as it is', () => {
    const file = { formatVersion: 1, name: 'Spiel', startScene: null };
    const parsed = projectFileSchema.parse(file);
    expect(stringifyDeterministic(parsed)).toBe(stringifyDeterministic(file));
  });

  it('keep scenes, name, window mode, icon and splash', () => {
    const build = {
      scenes: ['abcdefghij01', 'abcdefghij02'],
      productName: 'Mein Spiel',
      window: 'windowed',
      icon: 'abcdefghij03',
      splash: null,
    };
    expect(buildSettingsSchema.parse(build)).toEqual(build);
  });

  it('refuse an unknown window mode and a broken scene ID', () => {
    expect(buildSettingsSchema.safeParse({ window: 'borderless' }).success).toBe(false);
    expect(buildSettingsSchema.safeParse({ scenes: ['x'] }).success).toBe(false);
  });
});
