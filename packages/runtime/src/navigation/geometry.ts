import { Box3, Vector3 } from 'three';
import type { Matrix4 } from 'three';
import type { Mesh } from 'three';
import type { BufferGeometry } from 'three';
import { colliderRegistry } from '../components/colliders';
import type { ColliderShape } from '../components/colliders';
import { ownMeshes } from '../physics/meshData';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';

/** Triangles the navigation mesh is made from, in world space. */
export interface NavigationGeometry {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly bounds: Box3;
}

/** Components that mean "this object moves": its colliders are not part of the ground. */
const MOVING_COMPONENTS = ['characterController', 'navAgent', 'water', 'particleSystem'];

/** Sides of the prisms that stand in for round colliders. */
const ROUND_SIDES = 12;

class TriangleSink {
  readonly positions: number[] = [];
  readonly indices: number[] = [];
  readonly bounds = new Box3();
  private readonly point = new Vector3();

  addVertex(matrix: Matrix4, x: number, y: number, z: number): number {
    this.point.set(x, y, z).applyMatrix4(matrix);
    this.bounds.expandByPoint(this.point);
    this.positions.push(this.point.x, this.point.y, this.point.z);
    return this.positions.length / 3 - 1;
  }

  addTriangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }
}

/** A box as 12 triangles, outward facing (counter-clockwise seen from outside). */
function addBox(
  sink: TriangleSink,
  matrix: Matrix4,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
): void {
  const [cx, cy, cz] = center;
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;
  const v: number[] = [];
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) {
      for (const z of [-hz, hz]) v.push(sink.addVertex(matrix, cx + x, cy + y, cz + z));
    }
  }
  // Vertex index = x*4 + y*2 + z (each 0 = negative, 1 = positive side).
  const quad = (a: number, b: number, c: number, d: number): void => {
    sink.addTriangle(v[a] ?? 0, v[b] ?? 0, v[c] ?? 0);
    sink.addTriangle(v[a] ?? 0, v[c] ?? 0, v[d] ?? 0);
  };
  quad(2, 3, 7, 6); // +y (top)
  quad(0, 4, 5, 1); // -y
  quad(4, 6, 7, 5); // +x
  quad(0, 1, 3, 2); // -x
  quad(1, 5, 7, 3); // +z
  quad(0, 2, 6, 4); // -z
}

/** A vertical prism with a round base (cylinder, capsule and sphere stand-in). */
function addPrism(
  sink: TriangleSink,
  matrix: Matrix4,
  center: readonly [number, number, number],
  radius: number,
  height: number,
): void {
  const [cx, cy, cz] = center;
  const top = cy + height / 2;
  const bottom = cy - height / 2;
  const topCenter = sink.addVertex(matrix, cx, top, cz);
  const bottomCenter = sink.addVertex(matrix, cx, bottom, cz);
  const topRing: number[] = [];
  const bottomRing: number[] = [];
  for (let i = 0; i < ROUND_SIDES; i++) {
    const angle = (i / ROUND_SIDES) * Math.PI * 2;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    topRing.push(sink.addVertex(matrix, x, top, z));
    bottomRing.push(sink.addVertex(matrix, x, bottom, z));
  }
  for (let i = 0; i < ROUND_SIDES; i++) {
    const next = (i + 1) % ROUND_SIDES;
    const t0 = topRing[i] ?? 0;
    const t1 = topRing[next] ?? 0;
    const b0 = bottomRing[i] ?? 0;
    const b1 = bottomRing[next] ?? 0;
    sink.addTriangle(topCenter, t1, t0);
    sink.addTriangle(bottomCenter, b0, b1);
    sink.addTriangle(t0, t1, b1);
    sink.addTriangle(t0, b1, b0);
  }
}

/** A height map as a grid of triangles (every `stride`-th sample). */
function addHeightfield(
  sink: TriangleSink,
  matrix: Matrix4,
  center: readonly [number, number, number],
  shape: Extract<ColliderShape, { kind: 'heightfield' }>,
): void {
  const n = shape.resolution;
  if (n < 2) return;
  // At most about 130 samples per side keep the mesh light.
  const stride = Math.max(1, Math.ceil((n - 1) / 128));
  const samples: number[] = [];
  for (let i = 0; i < n; i += stride) samples.push(i);
  if (samples[samples.length - 1] !== n - 1) samples.push(n - 1);
  const grid: number[][] = [];
  for (const gz of samples) {
    const row: number[] = [];
    for (const gx of samples) {
      const x = center[0] + (gx / (n - 1) - 0.5) * shape.size;
      const z = center[2] + (gz / (n - 1) - 0.5) * shape.size;
      row.push(sink.addVertex(matrix, x, center[1] + (shape.heights[gz * n + gx] ?? 0), z));
    }
    grid.push(row);
  }
  for (let r = 0; r + 1 < grid.length; r++) {
    for (let c = 0; c + 1 < (grid[r]?.length ?? 0); c++) {
      const a = grid[r]?.[c] ?? 0;
      const b = grid[r]?.[c + 1] ?? 0;
      const d = grid[r + 1]?.[c] ?? 0;
      const e = grid[r + 1]?.[c + 1] ?? 0;
      // Counter-clockwise seen from above.
      sink.addTriangle(a, d, b);
      sink.addTriangle(b, d, e);
    }
  }
}

/** The triangles of an object's own meshes in world space (mesh colliders). */
function addMeshes(sink: TriangleSink, object: GameObject): void {
  object.object3d.updateWorldMatrix(true, true);
  for (const mesh of ownMeshes(object.object3d) as Mesh[]) {
    const geometry = mesh.geometry as BufferGeometry;
    const positions = geometry.getAttribute('position');
    if (!positions) continue;
    const base: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      base.push(
        sink.addVertex(mesh.matrixWorld, positions.getX(i), positions.getY(i), positions.getZ(i)),
      );
    }
    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i + 2 < index.count; i += 3) {
        sink.addTriangle(
          base[index.getX(i)] ?? 0,
          base[index.getX(i + 1)] ?? 0,
          base[index.getX(i + 2)] ?? 0,
        );
      }
    } else {
      for (let i = 0; i + 2 < positions.count; i += 3) {
        sink.addTriangle(base[i] ?? 0, base[i + 1] ?? 0, base[i + 2] ?? 0);
      }
    }
  }
}

function isMoving(object: GameObject): boolean {
  if (MOVING_COMPONENTS.some((type) => object.findComponent(type))) return true;
  const body = object.findComponent('rigidbody');
  return body !== undefined && body.values['type'] === 'dynamic';
}

/**
 * Collects the walkable ground and the obstacles of a scene as triangles (Unity: the "Navigation
 * Static" geometry). Sources are the enabled, non-trigger colliders of objects that do not move
 * (the same shapes the physics uses), plus boxes of Nav Obstacle components; objects with a
 * Nav Obstacle set to "ignore" are left out. Returns `null` for a scene without any ground.
 */
export function collectNavigationGeometry(world: World): NavigationGeometry | null {
  const sink = new TriangleSink();
  for (const object of world.allObjects()) {
    if (!object.activeInHierarchy) continue;
    const modifier = object.findComponent('navObstacle');
    const mode = modifier?.enabled === false ? null : (modifier?.values['mode'] ?? null);
    if (mode === 'ignore') continue;
    object.object3d.updateWorldMatrix(true, false);
    const matrix = object.object3d.matrixWorld;
    if (modifier && mode === 'obstacle') {
      const size = modifier.values['size'] as [number, number, number];
      const center = modifier.values['center'] as [number, number, number];
      addBox(sink, matrix, center, size);
    }
    if (isMoving(object)) continue;
    for (const collider of colliderRegistry.get(object) ?? []) {
      if (!collider.enabled || collider.isTrigger) continue;
      const shape = collider.shape;
      const center = shape.center;
      switch (shape.kind) {
        case 'box':
          addBox(sink, matrix, center, shape.size);
          break;
        case 'sphere':
          addPrism(sink, matrix, center, shape.radius, shape.radius * 2);
          break;
        case 'capsule':
        case 'cylinder':
          addPrism(sink, matrix, center, shape.radius, shape.height);
          break;
        case 'heightfield':
          addHeightfield(sink, matrix, center, shape);
          break;
        case 'mesh':
          addMeshes(sink, object);
          break;
      }
    }
  }
  if (sink.indices.length === 0) return null;
  return {
    positions: new Float32Array(sink.positions),
    indices: new Uint32Array(sink.indices),
    bounds: sink.bounds,
  };
}
