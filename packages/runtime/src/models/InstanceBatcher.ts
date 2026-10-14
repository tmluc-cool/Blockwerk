import { InstancedMesh, Matrix4 } from 'three';
import type { BufferGeometry, Material, Mesh, Object3D, Scene } from 'three';

/** Fewest equal meshes that are drawn as one instanced mesh. */
const MIN_INSTANCES = 3;

interface Batch {
  readonly mesh: InstancedMesh;
  readonly members: Mesh[];
}

/**
 * Automatic instancing (CLAUDE.md: "gleiche Modelle automatisch instanziieren"): meshes of model
 * copies that share geometry and material are drawn as one `InstancedMesh`. The original meshes
 * stay in place (hidden, still pickable and part of the hierarchy); only drawing is batched.
 */
export class InstanceBatcher {
  private readonly batches = new Map<string, Batch>();
  /** Candidate meshes and whether they were shown at the last rebuild. */
  private readonly candidates = new Map<Mesh, boolean>();
  private dirty = false;
  private readonly matrix = new Matrix4();

  constructor(private readonly scene: Scene) {}

  /** Registers a mesh that may be batched (meshes of loaded model copies). */
  add(mesh: Mesh): void {
    this.candidates.set(mesh, false);
    this.dirty = true;
  }

  /** Unregisters a mesh (its object was removed). */
  remove(mesh: Mesh): void {
    if (this.candidates.delete(mesh)) {
      mesh.visible = true;
      Reflect.deleteProperty(mesh.userData, 'instanced');
      this.dirty = true;
    }
  }

  /** Marks the batches for rebuilding (e.g. shadow settings changed). Visibility is tracked itself. */
  invalidate(): void {
    this.dirty = true;
  }

  /** Number of instanced draws and of meshes they replace (for statistics and tests). */
  stats(): { batches: number; instances: number } {
    let instances = 0;
    for (const batch of this.batches.values()) instances += batch.members.length;
    return { batches: this.batches.size, instances };
  }

  /** Brings instance matrices up to date. Call before rendering. */
  update(): void {
    if (this.candidates.size === 0 && this.batches.size === 0) return;
    this.scene.updateMatrixWorld();
    if (!this.dirty) {
      for (const [mesh, shown] of this.candidates) {
        if (this.isShown(mesh) !== shown) {
          this.dirty = true;
          break;
        }
      }
    }
    if (this.dirty) this.rebuild();
    for (const batch of this.batches.values()) {
      batch.members.forEach((member, index) => {
        batch.mesh.setMatrixAt(index, member.matrixWorld);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
    }
  }

  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.removeFromParent();
      batch.mesh.dispose();
    }
    this.batches.clear();
    for (const mesh of this.candidates.keys()) {
      mesh.visible = true;
      Reflect.deleteProperty(mesh.userData, 'instanced');
    }
    this.candidates.clear();
  }

  /** Whether a mesh is in the scene and all its parents are visible. */
  private isShown(mesh: Mesh): boolean {
    let current: Object3D | null = mesh.parent;
    for (; current && current !== this.scene; current = current.parent) {
      if (!current.visible) return false;
    }
    return current === this.scene;
  }

  private rebuild(): void {
    this.dirty = false;
    const groups = new Map<string, Mesh[]>();
    for (const mesh of [...this.candidates.keys()]) {
      mesh.visible = true;
      Reflect.deleteProperty(mesh.userData, 'instanced');
      const shown = this.isShown(mesh);
      this.candidates.set(mesh, shown);
      if (!shown || Array.isArray(mesh.material)) continue;
      const geometry = mesh.geometry as BufferGeometry;
      const material = mesh.material as Material;
      const key = `${geometry.uuid}|${material.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}`;
      const list = groups.get(key) ?? [];
      list.push(mesh);
      groups.set(key, list);
    }
    for (const batch of this.batches.values()) {
      batch.mesh.removeFromParent();
      batch.mesh.dispose();
    }
    this.batches.clear();
    for (const [key, members] of groups) {
      const first = members[0];
      if (!first || members.length < MIN_INSTANCES) continue;
      const instanced = new InstancedMesh(
        first.geometry,
        first.material as Material,
        members.length,
      );
      instanced.castShadow = first.castShadow;
      instanced.receiveShadow = first.receiveShadow;
      instanced.frustumCulled = false;
      instanced.matrixAutoUpdate = false;
      instanced.matrix.copy(this.matrix.identity());
      instanced.userData['instanceBatch'] = true;
      // Instanced meshes are drawing helpers, never picked or saved.
      instanced.raycast = () => undefined;
      for (const member of members) {
        member.visible = false;
        member.userData['instanced'] = true;
      }
      this.scene.add(instanced);
      this.batches.set(key, { mesh: instanced, members });
    }
  }
}
