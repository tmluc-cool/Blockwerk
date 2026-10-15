import { describe, expect, it } from 'vitest';
import {
  Game,
  initPhysics,
  setTerrainSource,
  TERRAIN_LAYERS,
  TerrainData,
  TerrainGrass,
  terrainRegistry,
  World,
} from '../src';
import { component, objectData, sceneData } from './helpers';

describe('TerrainData', () => {
  it('starts flat and fully painted with layer 0', () => {
    const terrain = new TerrainData(17, 32);
    expect(terrain.heightAt(3, -4)).toBe(0);
    expect(terrain.weightAt(0, 5, 5)).toBe(1);
    expect(terrain.weightAt(1, 5, 5)).toBe(0);
    expect(terrain.cell).toBe(2);
  });

  it('reads interpolated heights and clamps outside the terrain', () => {
    const terrain = new TerrainData(3, 2);
    terrain.heights.set([0, 0, 0, 0, 2, 0, 0, 0, 0]);
    expect(terrain.heightAt(0, 0)).toBeCloseTo(2);
    expect(terrain.heightAt(0.5, 0)).toBeCloseTo(1);
    expect(terrain.heightAt(-100, -100)).toBe(0);
    expect(terrain.heightAt(100, 0)).toBe(0);
  });

  it('raises, lowers, smooths and flattens with a round soft brush', () => {
    const terrain = new TerrainData(33, 32);
    const raised = terrain.apply({ tool: 'raise', x: 0, z: 0, radius: 6, strength: 1 });
    expect(raised).not.toBeNull();
    const peak = terrain.heightAt(0, 0);
    expect(peak).toBeGreaterThan(0);
    expect(terrain.heightAt(12, 12)).toBe(0);
    expect(terrain.heightAt(3, 0)).toBeLessThan(peak);
    terrain.apply({ tool: 'lower', x: 0, z: 0, radius: 6, strength: 1 });
    expect(terrain.heightAt(0, 0)).toBeCloseTo(0, 5);
    for (let i = 0; i < 5; i++)
      terrain.apply({ tool: 'raise', x: 0, z: 0, radius: 4, strength: 1 });
    const high = terrain.heightAt(0, 0);
    terrain.apply({ tool: 'smooth', x: 0, z: 0, radius: 6, strength: 1 });
    expect(terrain.heightAt(0, 0)).toBeLessThan(high);
    for (let i = 0; i < 20; i++) {
      terrain.apply({ tool: 'flatten', x: 0, z: 0, radius: 6, strength: 1, height: 1 });
    }
    expect(terrain.heightAt(0, 0)).toBeCloseTo(1, 1);
  });

  it('paints layers whose weights always add up to 255', () => {
    const terrain = new TerrainData(17, 16);
    terrain.apply({ tool: 'paint', x: 0, z: 0, radius: 4, strength: 1, layer: 2 });
    expect(terrain.weightAt(2, 0, 0)).toBeGreaterThan(0.9);
    expect(terrain.weightAt(2, 7, 7)).toBe(0);
    for (let i = 0; i < terrain.resolution ** 2; i++) {
      let sum = 0;
      for (let layer = 0; layer < TERRAIN_LAYERS; layer++) {
        sum += terrain.splat[i * TERRAIN_LAYERS + layer] ?? 0;
      }
      expect(sum).toBe(255);
    }
  });

  it('keeps a brush outside the terrain from changing anything', () => {
    const terrain = new TerrainData(9, 8);
    expect(terrain.apply({ tool: 'raise', x: 100, z: 100, radius: 2, strength: 1 })).toBeNull();
  });

  it('makes the same hills from the same seed and different ones from another', () => {
    const make = (seed: number): TerrainData => {
      const terrain = new TerrainData(33, 64);
      terrain.generateHills(seed, 5, 0.05);
      return terrain;
    };
    expect(make(1).heights).toEqual(make(1).heights);
    expect(make(1).heights).not.toEqual(make(2).heights);
    const range = make(1).heightRange();
    expect(range.max - range.min).toBeGreaterThan(1);
    expect(range.max).toBeLessThanOrEqual(5.01);
    expect(range.min).toBeGreaterThanOrEqual(-5.01);
  });

  it('digs a basin and paints sand, grass and rock by the shape of the land', () => {
    const terrain = new TerrainData(65, 64);
    terrain.generateHills(3, 3, 0.04);
    const before = terrain.heightAt(0, 0);
    terrain.carveBasin(0, 0, 8, 4);
    expect(terrain.heightAt(0, 0)).toBeLessThan(before - 3);
    terrain.autoPaint({ flat: 0, steep: 2, low: 3 }, terrain.heightAt(0, 0) + 1);
    expect(terrain.weightAt(3, 0, 0)).toBeGreaterThan(0.9);
  });

  it('writes the same bytes every time and reads them back', () => {
    const terrain = new TerrainData(17, 16);
    terrain.generateHills(9, 2, 0.1);
    terrain.apply({ tool: 'paint', x: 1, z: 1, radius: 3, strength: 1, layer: 1 });
    const bytes = terrain.serialize();
    expect(terrain.serialize()).toEqual(bytes);
    const copy = TerrainData.deserialize(bytes);
    expect(copy.resolution).toBe(17);
    expect(copy.size).toBe(16);
    expect(copy.heights).toEqual(terrain.heights);
    expect(copy.splat).toEqual(terrain.splat);
  });

  it('rejects files that are not terrains', () => {
    expect(() => TerrainData.deserialize(new Uint8Array(4))).toThrow();
    expect(() => TerrainData.deserialize(new Uint8Array(64))).toThrow('Not a terrain file');
    const bytes = new TerrainData(5, 4).serialize();
    expect(() => TerrainData.deserialize(bytes.subarray(0, bytes.length - 1))).toThrow();
  });
});

describe('terrain component', () => {
  const terrainObject = (assetId: string) =>
    objectData({
      name: 'Terrain',
      components: [component('terrain', { terrain: assetId, grass: false }, 'terraincomp1')],
    });
  const ball = (position: [number, number, number]) =>
    objectData({
      name: 'Ball',
      transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] },
      components: [
        component('sphereCollider', { radius: 0.5 }, 'ballcollid01'),
        component('rigidbody', {}, 'ballrigid001'),
      ],
    });

  it('draws the height map and lets a ball roll to rest on it (not mirrored or turned)', async () => {
    await initPhysics();
    // A ramp that rises towards +X only.
    const ramp = new TerrainData(33, 64);
    for (let z = 0; z < 33; z++) {
      for (let x = 0; x < 33; x++) ramp.heights[z * 33 + x] = (x / 32 - 0.5) * 64 * 0.25;
    }
    setTerrainSource((id) => (id === 'ramp00000001' ? ramp : null));
    const game = new Game(
      sceneData({
        terrain00001: terrainObject('ramp00000001'),
        ballhigh0001: ball([20, 14, 0]),
        balllow00001: ball([-20, 14, 0]),
        ballside0001: ball([0, 14, 20]),
      }),
      { scripts: () => null },
    );
    for (let i = 0; i < 180; i++) game.stepTick();
    const y = (id: string): number => game.world.getObject(id)?.position.y ?? NaN;
    // The surface is 0.25 * x high; a ball of radius 0.5 rests about 0.5 above it.
    expect(y('ballhigh0001')).toBeGreaterThan(3);
    expect(y('balllow00001')).toBeLessThan(-3);
    // Nothing slopes along Z, so a ball at x = 0 stays near height 0.5.
    expect(Math.abs(y('ballside0001') - 0.5)).toBeLessThan(1.5);
    const state = terrainRegistry.get(game.world.getObject('terrain00001') as never);
    expect(state?.data.heightAt(20, 0)).toBeCloseTo(5, 1);
    game.dispose();
    setTerrainSource(() => null);
  });

  it('shows nothing and does not fail when the terrain file is missing', async () => {
    setTerrainSource(() => null);
    const world = new World(sceneData({ terrain00001: terrainObject('missing00001') }));
    const object = world.getObject('terrain00001');
    expect(object && terrainRegistry.get(object)).toBeUndefined();
    world.dispose();
  });

  it('draws grass on the grass layer only, fewer clumps on a lower graphics level', () => {
    const data = new TerrainData(33, 40);
    for (let i = 0; i < 8; i++) {
      data.apply({ tool: 'paint', x: 0, z: 0, radius: 60, strength: 1, layer: 1 });
    }
    const count = (quality: number): number => {
      const grass = new TerrainGrass(
        data,
        {
          density: 2,
          height: 0.4,
          color: '#80b050',
          layer: 0,
          minHeight: -1000,
          quality,
          distance: 50,
        },
        () => 0,
      );
      const clumps = grass.clumps;
      grass.dispose();
      return clumps;
    };
    // Everything is painted with layer 1 (dirt), so no clumps grow on layer 0.
    expect(count(1)).toBe(0);
    const grassy = new TerrainData(33, 40);
    const grass = (quality: number): number => {
      const g = new TerrainGrass(
        grassy,
        {
          density: 2,
          height: 0.4,
          color: '#80b050',
          layer: 0,
          minHeight: -1000,
          quality,
          distance: 50,
        },
        () => 0,
      );
      const clumps = g.clumps;
      g.dispose();
      return clumps;
    };
    expect(grass(1)).toBeGreaterThan(2000);
    expect(grass(0.25)).toBeLessThan(grass(1) * 0.4);
  });
});
