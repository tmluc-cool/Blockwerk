import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SceneCamera } from '../src/scene/SceneCamera';

function cameraAt(position: Vector3, target: Vector3): SceneCamera {
  const camera = new SceneCamera();
  camera.lookAt(position, target);
  return camera;
}

describe('SceneCamera', () => {
  it('reproduces the position and target given to lookAt', () => {
    const camera = cameraAt(new Vector3(4, 3, 6), new Vector3(0, 0.5, 0));
    expect(camera.position.distanceTo(new Vector3(4, 3, 6))).toBeLessThan(1e-9);
    expect(camera.pivot.toArray()).toEqual([0, 0.5, 0]);
  });

  it('orbits around the pivot without changing the distance', () => {
    const camera = cameraAt(new Vector3(0, 2, 10), new Vector3(0, 0, 0));
    const distance = camera.position.distanceTo(camera.pivot);
    camera.orbit(120, -40);
    expect(camera.pivot.toArray()).toEqual([0, 0, 0]);
    expect(camera.position.distanceTo(camera.pivot)).toBeCloseTo(distance, 9);
    expect(camera.position.x).not.toBeCloseTo(0, 3);
  });

  it('looks around without moving the camera (free look)', () => {
    const camera = cameraAt(new Vector3(1, 2, 3), new Vector3(0, 0, 0));
    const before = camera.position;
    camera.look(200, 50);
    expect(camera.position.distanceTo(before)).toBeLessThan(1e-9);
    expect(camera.pivot.length()).toBeGreaterThan(0.1);
  });

  it('pans so the scene follows the mouse', () => {
    const camera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    camera.pan(100, 0, 500);
    // Dragging right moves the view left: the pivot moves to -X.
    expect(camera.pivot.x).toBeLessThan(0);
    expect(camera.pivot.y).toBeCloseTo(0, 9);
    const unitsPerPixel = camera.unitsPerPixel(500);
    expect(camera.pivot.x).toBeCloseTo(-100 * unitsPerPixel, 9);
  });

  it('zooms towards the pivot and clamps the distance', () => {
    const camera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    camera.zoom(-500);
    expect(camera.distance).toBeLessThan(10);
    camera.zoom(-1e7);
    expect(camera.distance).toBeGreaterThan(0);
  });

  it('flies along the view direction and moves the pivot along', () => {
    const camera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    const moved = camera.fly({ x: 0, y: 0, z: 1, fast: false }, 0.5);
    expect(moved).toBe(true);
    expect(camera.position.z).toBeLessThan(10);
    expect(camera.distance).toBeCloseTo(10, 9);
    const slow = camera.position.z;
    const fastCamera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    fastCamera.fly({ x: 0, y: 0, z: 1, fast: true }, 0.5);
    expect(10 - fastCamera.position.z).toBeGreaterThan(10 - slow);
  });

  it('moves up and down in world space with Q/E', () => {
    const camera = cameraAt(new Vector3(0, 5, 10), new Vector3(0, 0, 0));
    camera.fly({ x: 0, y: 1, z: 0, fast: false }, 1);
    expect(camera.position.y).toBeGreaterThan(5);
    expect(camera.position.x).toBeCloseTo(0, 9);
  });

  it('frames an object with a smooth transition', () => {
    const camera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    camera.frame(new Vector3(5, 1, 0), 1);
    expect(camera.animating).toBe(true);
    for (let i = 0; i < 100 && camera.animating; i++) camera.update(1 / 60);
    expect(camera.animating).toBe(false);
    expect(camera.pivot.distanceTo(new Vector3(5, 1, 0))).toBeLessThan(1e-9);
    expect(camera.distance).toBeGreaterThan(1);
    expect(camera.distance).toBeLessThan(5);
  });

  it('switches to axis views and reports them', () => {
    const camera = cameraAt(new Vector3(3, 3, 3), new Vector3(0, 0, 0));
    camera.setAxisView('top');
    camera.finishTransition();
    expect(camera.orthographic).toBe(true);
    expect(camera.currentAxisView()).toBe('top');
    expect(camera.forward.y).toBeCloseTo(-1, 9);
    camera.setAxisView('right');
    camera.finishTransition();
    expect(camera.currentAxisView()).toBe('right');
    expect(camera.forward.x).toBeCloseTo(-1, 9);
    camera.orbit(10, 0);
    expect(camera.currentAxisView()).toBeNull();
  });

  it('writes matching perspective and orthographic cameras', () => {
    const camera = cameraAt(new Vector3(0, 0, 10), new Vector3(0, 0, 0));
    const perspective = new PerspectiveCamera();
    const orthographic = new OrthographicCamera();
    camera.apply(perspective, orthographic, 2);
    expect(perspective.position.z).toBeCloseTo(10, 9);
    expect(perspective.aspect).toBe(2);
    expect(orthographic.top).toBeCloseTo(10 * Math.tan(Math.PI / 6), 9);
    expect(orthographic.right).toBeCloseTo(orthographic.top * 2, 9);
  });
});
