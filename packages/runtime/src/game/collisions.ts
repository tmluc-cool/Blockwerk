import { Vector3 } from 'three';
import type { Matrix4 } from 'three';
import type { ColliderShape } from '../components/colliders';

/** A collider shape transformed into world space. */
export type WorldShape =
  | {
      readonly kind: 'box';
      readonly center: Vector3;
      readonly axes: readonly [Vector3, Vector3, Vector3];
      readonly half: Vector3;
    }
  | { readonly kind: 'sphere'; readonly center: Vector3; readonly radius: number }
  | { readonly kind: 'capsule'; readonly a: Vector3; readonly b: Vector3; readonly radius: number };

/** Transforms a local collider shape with an object's world matrix. */
export function toWorldShape(shape: ColliderShape, matrixWorld: Matrix4): WorldShape {
  const center = new Vector3(...shape.center).applyMatrix4(matrixWorld);
  const x = new Vector3();
  const y = new Vector3();
  const z = new Vector3();
  matrixWorld.extractBasis(x, y, z);
  const scale = new Vector3(x.length(), y.length(), z.length());
  switch (shape.kind) {
    case 'box':
      return {
        kind: 'box',
        center,
        axes: [x.normalize(), y.normalize(), z.normalize()],
        half: new Vector3(
          Math.abs((shape.size[0] * scale.x) / 2),
          Math.abs((shape.size[1] * scale.y) / 2),
          Math.abs((shape.size[2] * scale.z) / 2),
        ),
      };
    case 'sphere':
      return {
        kind: 'sphere',
        center,
        radius: Math.abs(shape.radius) * Math.max(scale.x, scale.y, scale.z),
      };
    case 'capsule': {
      const radius = Math.abs(shape.radius) * Math.max(scale.x, scale.z);
      const halfSegment = Math.max(0, (Math.abs(shape.height) * scale.y) / 2 - radius);
      const up = y.normalize();
      return {
        kind: 'capsule',
        a: center.clone().addScaledVector(up, -halfSegment),
        b: center.clone().addScaledVector(up, halfSegment),
        radius,
      };
    }
  }
}

/** Closest point on a box to a point. */
function closestPointOnBox(box: Extract<WorldShape, { kind: 'box' }>, point: Vector3): Vector3 {
  const offset = point.clone().sub(box.center);
  const result = box.center.clone();
  const halves = [box.half.x, box.half.y, box.half.z];
  box.axes.forEach((axis, index) => {
    const half = halves[index] ?? 0;
    const distance = Math.max(-half, Math.min(half, offset.dot(axis)));
    result.addScaledVector(axis, distance);
  });
  return result;
}

/** Closest point on segment a–b to a point. */
function closestPointOnSegment(a: Vector3, b: Vector3, point: Vector3): Vector3 {
  const ab = b.clone().sub(a);
  const lengthSq = ab.lengthSq();
  if (lengthSq === 0) return a.clone();
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(ab) / lengthSq));
  return a.clone().addScaledVector(ab, t);
}

/** Squared distance between two segments. */
function segmentSegmentDistanceSq(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): number {
  const d1 = q1.clone().sub(p1);
  const d2 = q2.clone().sub(p2);
  const r = p1.clone().sub(p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);
  let s = 0;
  let t = 0;
  if (a <= 1e-12 && e <= 1e-12) return r.lengthSq();
  if (a <= 1e-12) {
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1.dot(r);
    if (e <= 1e-12) {
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1.dot(d2);
      const denominator = a * e - b * b;
      s = denominator !== 0 ? Math.max(0, Math.min(1, (b * f - c * e) / denominator)) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }
  const c1 = p1.clone().addScaledVector(d1, s);
  const c2 = p2.clone().addScaledVector(d2, t);
  return c1.distanceToSquared(c2);
}

/** Separating axis test for two oriented boxes. */
function boxesOverlap(
  a: Extract<WorldShape, { kind: 'box' }>,
  b: Extract<WorldShape, { kind: 'box' }>,
): boolean {
  const axes: Vector3[] = [...a.axes, ...b.axes];
  for (const axisA of a.axes) {
    for (const axisB of b.axes) {
      const cross = axisA.clone().cross(axisB);
      if (cross.lengthSq() > 1e-10) axes.push(cross.normalize());
    }
  }
  const delta = b.center.clone().sub(a.center);
  const project = (box: Extract<WorldShape, { kind: 'box' }>, axis: Vector3): number =>
    Math.abs(box.axes[0].dot(axis)) * box.half.x +
    Math.abs(box.axes[1].dot(axis)) * box.half.y +
    Math.abs(box.axes[2].dot(axis)) * box.half.z;
  return axes.every((axis) => Math.abs(delta.dot(axis)) <= project(a, axis) + project(b, axis));
}

const CAPSULE_SAMPLES = 9;

/** Whether two world shapes overlap (touching counts as overlapping). */
export function shapesOverlap(first: WorldShape, second: WorldShape): boolean {
  // Order the pair so that only half of the combinations need code.
  const order = { sphere: 0, capsule: 1, box: 2 } as const;
  const [a, b] = order[first.kind] <= order[second.kind] ? [first, second] : [second, first];
  if (a.kind === 'sphere') {
    if (b.kind === 'sphere') return a.center.distanceTo(b.center) <= a.radius + b.radius;
    if (b.kind === 'capsule') {
      return closestPointOnSegment(b.a, b.b, a.center).distanceTo(a.center) <= a.radius + b.radius;
    }
    if (b.kind === 'box') return closestPointOnBox(b, a.center).distanceTo(a.center) <= a.radius;
  }
  if (a.kind === 'capsule') {
    if (b.kind === 'capsule') {
      return segmentSegmentDistanceSq(a.a, a.b, b.a, b.b) <= (a.radius + b.radius) ** 2;
    }
    if (b.kind === 'box') {
      // Approximate the capsule by spheres along its axis.
      for (let i = 0; i < CAPSULE_SAMPLES; i++) {
        const point = a.a.clone().lerp(a.b, i / (CAPSULE_SAMPLES - 1));
        if (closestPointOnBox(b, point).distanceTo(point) <= a.radius) return true;
      }
      return false;
    }
  }
  if (a.kind === 'box' && b.kind === 'box') return boxesOverlap(a, b);
  return false;
}
