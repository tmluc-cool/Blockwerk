import { Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Environment, generateGroundPixels, snapToLightTexels } from '../src';

describe('generateGroundPixels', () => {
  it('is deterministic', () => {
    expect(generateGroundPixels(32)).toEqual(generateGroundPixels(32));
  });

  it('produces opaque pixels', () => {
    const pixels = generateGroundPixels(16);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });
});

describe('snapToLightTexels', () => {
  it('moves the point by less than one texel perpendicular to the light', () => {
    const direction = new Vector3(0.3, 0.8, -0.5).normalize();
    const point = new Vector3(12.34, 0.5, -7.89);
    const texel = 0.05;
    const snapped = snapToLightTexels(point, direction, texel);
    const offset = snapped.clone().sub(point);
    expect(Math.abs(offset.dot(direction))).toBeLessThan(1e-9);
    expect(offset.length()).toBeLessThanOrEqual(texel * Math.SQRT1_2 + 1e-9);
  });

  it('returns the same result for points within one texel', () => {
    const direction = new Vector3(0, 1, 0);
    const a = snapToLightTexels(new Vector3(1.01, 0, 2.01), direction, 0.1);
    const b = snapToLightTexels(new Vector3(1.02, 0, 2.02), direction, 0.1);
    expect(a.distanceTo(b)).toBeLessThan(1e-9);
  });
});

describe('Environment', () => {
  it('adds sky, sun, ground and fog to a scene', () => {
    const scene = new Scene();
    const environment = new Environment();
    environment.addTo(scene);
    expect(scene.getObjectByName('Sky')).toBeDefined();
    expect(scene.getObjectByName('Sun')).toBeDefined();
    expect(scene.getObjectByName('Ground')).toBeDefined();
    expect(scene.fog).not.toBeNull();
    expect(environment.sun.castShadow).toBe(true);
    environment.dispose();
    expect(scene.getObjectByName('Sky')).toBeUndefined();
    expect(scene.fog).toBeNull();
  });

  it('points the sun along the requested elevation', () => {
    const environment = new Environment({ sunElevation: 90, sunAzimuth: 0 });
    const direction = environment.getSunDirection();
    expect(direction.y).toBeCloseTo(1, 6);
    const offset = environment.sun.position.clone().sub(environment.sun.target.position);
    expect(offset.normalize().y).toBeCloseTo(1, 6);
  });

  it('can be created without ground', () => {
    const environment = new Environment({ groundSize: 0, fog: false });
    const scene = new Scene();
    environment.addTo(scene);
    expect(environment.ground).toBeNull();
    expect(scene.fog).toBeNull();
  });
});
