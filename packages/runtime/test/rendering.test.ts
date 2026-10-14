import { describe, expect, it } from 'vitest';
import {
  currentQuality,
  DEFAULT_POST_SETTINGS,
  effectivePost,
  onQualityChange,
  postRegistry,
  QUALITY_LEVELS,
  QUALITY_NAMES,
  setQuality,
  World,
} from '../src';
import type { QualityName } from '../src';
import { component, objectData, sceneData } from './helpers';

describe('graphics levels', () => {
  it('get more expensive from Low to Ultra', () => {
    const levels = QUALITY_NAMES.map((name) => QUALITY_LEVELS[name]);
    for (let i = 1; i < levels.length; i++) {
      const before = levels[i - 1];
      const level = levels[i];
      if (!before || !level) throw new Error('level');
      expect(level.shadowMapSize).toBeGreaterThanOrEqual(before.shadowMapSize);
      expect(level.grassDensity).toBeGreaterThanOrEqual(before.grassDensity);
      expect(level.particleDensity).toBeGreaterThanOrEqual(before.particleDensity);
      expect(level.detailDistance).toBeGreaterThanOrEqual(before.detailDistance);
    }
  });

  it('limit the post-processing a camera asks for', () => {
    const all = { ...DEFAULT_POST_SETTINGS, depthOfField: true };
    expect(effectivePost(all, QUALITY_LEVELS.low).active).toBe(false);
    const medium = effectivePost(all, QUALITY_LEVELS.medium);
    expect([medium.bloom, medium.antialiasing, medium.ambientOcclusion]).toEqual([
      true,
      true,
      'off',
    ]);
    expect(effectivePost(all, QUALITY_LEVELS.high).ambientOcclusion).toBe('half');
    const ultra = effectivePost(all, QUALITY_LEVELS.ultra);
    expect([ultra.ambientOcclusion, ultra.depthOfField]).toEqual(['full', true]);
    // Depth of field only runs when the camera asks for it, even on Ultra.
    expect(effectivePost(DEFAULT_POST_SETTINGS, QUALITY_LEVELS.ultra).depthOfField).toBe(false);
    // A switched-off component runs nothing at any level.
    expect(effectivePost(null, QUALITY_LEVELS.ultra).active).toBe(false);
  });

  it('can be switched while a game runs and tell everyone who listens', () => {
    const seen: QualityName[] = [];
    const stop = onQualityChange((name) => seen.push(name));
    const before = currentQuality();
    setQuality('ultra');
    setQuality('low');
    setQuality(before);
    stop();
    setQuality('medium');
    expect(seen).toEqual(['ultra', 'low', ...(before === 'low' ? [] : [before])]);
    expect(currentQuality()).toBe('medium');
    setQuality('high');
  });
});

describe('post-processing component', () => {
  const camera = objectData({
    name: 'Camera',
    components: [
      component('camera', {}, 'cam000000001'),
      component('postProcessing', { bloomIntensity: 0.9, vignette: false }, 'post00000001'),
    ],
  });
  const plain = objectData({
    name: 'Plain',
    components: [component('camera', {}, 'cam000000002')],
  });

  it('gives its settings to the camera of its object, with defaults for missing fields', () => {
    const world = new World(sceneData({ cam000000001: camera, cam000000002: plain }));
    const withPost = world.getObject('cam000000001');
    const without = world.getObject('cam000000002');
    if (!withPost || !without) throw new Error('objects');
    const settings = world.postSettings(withPost.object3d);
    expect(settings?.bloomIntensity).toBe(0.9);
    expect(settings?.vignette).toBe(false);
    expect(settings?.aoRadius).toBe(DEFAULT_POST_SETTINGS.aoRadius);
    // No component: the view uses the default profile.
    expect(world.postSettings(without.object3d)).toBeUndefined();
    world.dispose();
  });

  it('switches the effects off with the component and forgets them with the object', () => {
    const disabled = {
      ...camera,
      components: camera.components.map((c) =>
        c.type === 'postProcessing' ? { ...c, enabled: false } : c,
      ),
    };
    const world = new World(sceneData({ cam000000001: disabled }));
    const object = world.getObject('cam000000001');
    if (!object) throw new Error('object');
    expect(world.postSettings(object.object3d)).toBeNull();
    world.dispose();
    expect(postRegistry.get(object)).toBeUndefined();
  });
});
