import type { GameObject, World } from '@blockwerk/runtime';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three';

/** Color of the view cone and the patrol path. */
const CONE_COLOR = 0xe05a3c;
const PATH_COLOR = 0xe0a526;

interface ConeShape {
  readonly distance: number;
  readonly angle: number;
  readonly hearing: number;
}

function coneGeometry({ distance, angle }: ConeShape): BufferGeometry {
  const steps = Math.max(2, Math.ceil(angle / 6));
  const positions: number[] = [0, 0.06, 0];
  const half = (angle / 2) * (Math.PI / 180);
  for (let i = 0; i <= steps; i++) {
    const a = -half + (i / steps) * half * 2;
    positions.push(Math.sin(a) * distance, 0.06, Math.cos(a) * distance);
  }
  const indices: number[] = [];
  for (let i = 1; i <= steps; i++) indices.push(0, i, i + 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * What the Scene view draws for selected NPCs (SPEC 8.8): the view cone and hearing radius of a
 * Guard, and the path of a Patrol. The shapes live in the overlay scene, not in the objects.
 */
export class NpcGizmos {
  readonly group = new Group();
  private readonly cones = new Map<string, { key: string; root: Group }>();
  private readonly paths = new Map<string, Line>();
  private readonly coneMaterial = new MeshBasicMaterial({
    color: CONE_COLOR,
    transparent: true,
    opacity: 0.22,
    side: DoubleSide,
    depthWrite: false,
  });
  private readonly ringMaterial = new MeshBasicMaterial({
    color: CONE_COLOR,
    transparent: true,
    opacity: 0.5,
    side: DoubleSide,
    depthWrite: false,
  });
  private readonly pathMaterial = new LineBasicMaterial({ color: PATH_COLOR, depthTest: false });

  /** Brings the shapes in line with the selection and the world. */
  update(world: World | null, selection: readonly string[]): void {
    const wanted = new Set(selection);
    for (const [id, cone] of this.cones) {
      if (!wanted.has(id) || !world?.getObject(id)?.findComponent('guard')) {
        this.removeCone(id, cone.root);
      }
    }
    for (const [id, line] of this.paths) {
      if (!wanted.has(id) || !world?.getObject(id)?.findComponent('patrol')) {
        this.group.remove(line);
        line.geometry.dispose();
        this.paths.delete(id);
      }
    }
    if (!world) return;
    for (const id of selection) {
      const object = world.getObject(id);
      if (!object) continue;
      this.updateCone(object, id);
      this.updatePath(world, object, id);
    }
  }

  private removeCone(id: string, root: Group): void {
    this.group.remove(root);
    for (const child of root.children) (child as Mesh).geometry.dispose();
    this.cones.delete(id);
  }

  private updateCone(object: GameObject, id: string): void {
    const guard = object.findComponent('guard');
    if (!guard) return;
    const values = guard.values as Record<string, number>;
    const shape: ConeShape = {
      distance: Number(values['viewDistance'] ?? 14),
      angle: Number(values['viewAngle'] ?? 110),
      hearing: Number(values['hearingRadius'] ?? 4),
    };
    const key = `${shape.distance}|${shape.angle}|${shape.hearing}`;
    let entry = this.cones.get(id);
    if (!entry || entry.key !== key) {
      if (entry) this.removeCone(id, entry.root);
      const root = new Group();
      root.add(new Mesh(coneGeometry(shape), this.coneMaterial));
      const ring = new Mesh(
        new RingGeometry(Math.max(0, shape.hearing - 0.05), shape.hearing, 48).rotateX(
          -Math.PI / 2,
        ),
        this.ringMaterial,
      );
      ring.position.y = 0.06;
      root.add(ring);
      this.group.add(root);
      entry = { key, root };
      this.cones.set(id, entry);
    }
    const position = object.worldPosition();
    entry.root.position.copy(position);
    const forward = object.object3d.getWorldDirection(new Vector3());
    entry.root.rotation.y = Math.atan2(forward.x, forward.z);
  }

  private updatePath(world: World, object: GameObject, id: string): void {
    const patrol = object.findComponent('patrol');
    const routeId = patrol?.values['route'];
    if (!patrol || typeof routeId !== 'string') return;
    const route = world.getObject(routeId);
    if (!route) return;
    const points = route.children.map((child) => child.worldPosition());
    if (points.length < 2) return;
    const loop = patrol.values['mode'] !== 'pingPong';
    const flat = [...points, ...(loop ? [points[0] as Vector3] : [])];
    let line = this.paths.get(id);
    const positions = new Float32Array(flat.length * 3);
    flat.forEach((p, i) => positions.set([p.x, p.y + 0.1, p.z], i * 3));
    if (!line) {
      line = new Line(new BufferGeometry(), this.pathMaterial);
      line.renderOrder = 6;
      this.group.add(line);
      this.paths.set(id, line);
    }
    line.geometry.setAttribute('position', new BufferAttribute(positions, 3));
  }

  /** Frees all shapes. */
  dispose(): void {
    for (const [id, cone] of [...this.cones]) this.removeCone(id, cone.root);
    for (const line of this.paths.values()) line.geometry.dispose();
    this.paths.clear();
    this.coneMaterial.dispose();
    this.ringMaterial.dispose();
    this.pathMaterial.dispose();
  }
}
