import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { shapesOverlap, toWorldShape } from '../src/game/collisions';
import type { ColliderShape } from '../src/components/colliders';

const at = (x: number, y: number, z: number, rotationY = 0, scale = 1): Matrix4 =>
  new Matrix4().compose(
    new Vector3(x, y, z),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rotationY),
    new Vector3(scale, scale, scale),
  );

const box: ColliderShape = { kind: 'box', center: [0, 0, 0], size: [1, 1, 1] };
const sphere: ColliderShape = { kind: 'sphere', center: [0, 0, 0], radius: 0.5 };
const capsule: ColliderShape = { kind: 'capsule', center: [0, 0, 0], radius: 0.5, height: 2 };

describe('shapesOverlap', () => {
  it('detects sphere pairs', () => {
    expect(
      shapesOverlap(toWorldShape(sphere, at(0, 0, 0)), toWorldShape(sphere, at(0.9, 0, 0))),
    ).toBe(true);
    expect(
      shapesOverlap(toWorldShape(sphere, at(0, 0, 0)), toWorldShape(sphere, at(1.1, 0, 0))),
    ).toBe(false);
  });

  it('detects box and sphere, including the corner region', () => {
    expect(shapesOverlap(toWorldShape(box, at(0, 0, 0)), toWorldShape(sphere, at(0.9, 0, 0)))).toBe(
      true,
    );
    // Diagonal: corner at (0.5,0.5), sphere center at (0.9,0.9) is 0.57 away.
    expect(
      shapesOverlap(toWorldShape(box, at(0, 0, 0)), toWorldShape(sphere, at(0.9, 0.9, 0))),
    ).toBe(false);
  });

  it('uses the rotation and scale of boxes', () => {
    // Rotated 45°, the box reaches 0.707 along X.
    expect(
      shapesOverlap(toWorldShape(box, at(0, 0, 0, Math.PI / 4)), toWorldShape(box, at(1.2, 0, 0))),
    ).toBe(true);
    expect(shapesOverlap(toWorldShape(box, at(0, 0, 0)), toWorldShape(box, at(1.2, 0, 0)))).toBe(
      false,
    );
    expect(
      shapesOverlap(toWorldShape(box, at(0, 0, 0, 0, 3)), toWorldShape(box, at(1.9, 0, 0))),
    ).toBe(true);
  });

  it('handles capsules', () => {
    expect(
      shapesOverlap(toWorldShape(capsule, at(0, 0, 0)), toWorldShape(sphere, at(0, 1.4, 0))),
    ).toBe(true);
    expect(
      shapesOverlap(toWorldShape(capsule, at(0, 0, 0)), toWorldShape(sphere, at(1.1, 0, 0))),
    ).toBe(false);
    expect(
      shapesOverlap(toWorldShape(capsule, at(0, 0, 0)), toWorldShape(capsule, at(0.9, 0.5, 0))),
    ).toBe(true);
    expect(
      shapesOverlap(toWorldShape(capsule, at(0, 0, 0)), toWorldShape(box, at(0, -1.4, 0))),
    ).toBe(true);
    expect(
      shapesOverlap(toWorldShape(box, at(0, -1.7, 0)), toWorldShape(capsule, at(0, 0, 0))),
    ).toBe(false);
  });
});
