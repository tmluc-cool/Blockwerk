import type { Vec3 } from '@blockwerk/project';
import { defineComponent } from './defineComponent';
import type { FieldDefinitions, FieldValues } from './defineComponent';
import type { LocalizedText } from '../text';

const centerText: LocalizedText = { de: 'Mitte', en: 'Center' };
const triggerText: LocalizedText = { de: 'Ist Trigger', en: 'Is Trigger' };

/** Collision shape of a collider in the local space of its object. */
export type ColliderShape =
  | { readonly kind: 'box'; readonly center: Vec3; readonly size: Vec3 }
  | { readonly kind: 'sphere'; readonly center: Vec3; readonly radius: number }
  | {
      readonly kind: 'capsule';
      readonly center: Vec3;
      readonly radius: number;
      readonly height: number;
    }
  | {
      readonly kind: 'cylinder';
      readonly center: Vec3;
      readonly radius: number;
      readonly height: number;
    }
  /** The object's own meshes (Unity: Mesh Collider); `convex` wraps them in a hull. */
  | { readonly kind: 'mesh'; readonly center: Vec3; readonly convex: boolean }
  /** A height map (terrain): `resolution` × `resolution` heights in meters, `size` meters wide. */
  | {
      readonly kind: 'heightfield';
      readonly center: Vec3;
      readonly resolution: number;
      readonly size: number;
      readonly heights: Float32Array;
      /** Lowest and highest height, for rough overlap tests. */
      readonly minHeight: number;
      readonly maxHeight: number;
    };

/** Live state of a collider, read by the collision and physics systems. */
export interface ColliderState {
  shape: ColliderShape;
  isTrigger: boolean;
  enabled: boolean;
  /** Friction coefficient (Unity: Physic Material). */
  friction: number;
  /** Bounciness 0..1 (Unity: Physic Material). */
  bounciness: number;
  /** Increases whenever something changed (physics rebuilds the collider). */
  version: number;
}

/** Collider states by object, kept by the collider behaviors. */
export const colliderRegistry = new WeakMap<object, ColliderState[]>();

/** Registers a collider state for an object; returns a function that removes it again. */
export function registerCollider(owner: object, state: ColliderState): () => void {
  const list = colliderRegistry.get(owner) ?? [];
  list.push(state);
  colliderRegistry.set(owner, list);
  return () => {
    const index = list.indexOf(state);
    if (index >= 0) list.splice(index, 1);
  };
}

/** Fields every collider has: trigger, center and physics material. */
const COMMON_FIELDS = {
  isTrigger: { type: 'boolean', default: false, text: triggerText },
  center: { type: 'vector3', default: [0, 0, 0], unit: 'meters', text: centerText },
  friction: {
    type: 'number',
    default: 0.6,
    min: 0,
    max: 2,
    step: 0.05,
    group: 'material',
    text: { de: 'Reibung', en: 'Friction' },
  },
  bounciness: {
    type: 'number',
    default: 0,
    min: 0,
    max: 1,
    step: 0.05,
    group: 'material',
    text: { de: 'Abprallen', en: 'Bounciness' },
  },
} as const satisfies FieldDefinitions;

type CommonValues = FieldValues<typeof COMMON_FIELDS>;

/** The behavior shared by all colliders: registers a state and keeps it up to date. */
function colliderBehavior<V extends CommonValues>(
  owner: object,
  shape: (values: V) => ColliderShape,
  initial: ColliderShape,
) {
  const state: ColliderState = {
    shape: initial,
    isTrigger: false,
    enabled: true,
    friction: 0.6,
    bounciness: 0,
    version: 0,
  };
  const unregister = registerCollider(owner, state);
  return {
    apply(values: V) {
      state.shape = shape(values);
      state.isTrigger = values.isTrigger;
      state.friction = values.friction;
      state.bounciness = values.bounciness;
      state.version += 1;
    },
    setEnabled(enabled: boolean) {
      state.enabled = enabled;
      state.version += 1;
    },
    destroy: unregister,
  };
}

const radiusField = {
  type: 'number',
  default: 0.5,
  min: 0,
  step: 0.05,
  unit: 'meters',
  text: { de: 'Radius', en: 'Radius' },
} as const;

const heightField = {
  type: 'number',
  default: 2,
  min: 0,
  step: 0.1,
  unit: 'meters',
  text: { de: 'Höhe', en: 'Height' },
} as const;

/** Box Collider (Unity: BoxCollider). */
export const boxCollider = defineComponent({
  type: 'boxCollider',
  category: 'physics',
  unity: 'BoxCollider',
  text: { de: 'Box-Collider', en: 'Box Collider' },
  docs: { de: 'Quaderförmige Kollisionsform.', en: 'Box-shaped collision volume.' },
  keywords: { de: ['kollision', 'quader'], en: ['collision', 'box'] },
  fields: {
    ...COMMON_FIELDS,
    size: {
      type: 'vector3',
      default: [1, 1, 1],
      unit: 'meters',
      text: { de: 'Grösse', en: 'Size' },
    },
  },
  create({ object }) {
    return colliderBehavior(
      object,
      (values) => ({ kind: 'box', center: values.center, size: values.size }),
      { kind: 'box', center: [0, 0, 0], size: [1, 1, 1] },
    );
  },
});

/** Sphere Collider (Unity: SphereCollider). */
export const sphereCollider = defineComponent({
  type: 'sphereCollider',
  category: 'physics',
  unity: 'SphereCollider',
  text: { de: 'Kugel-Collider', en: 'Sphere Collider' },
  docs: { de: 'Kugelförmige Kollisionsform.', en: 'Sphere-shaped collision volume.' },
  keywords: { de: ['kollision', 'kugel'], en: ['collision', 'sphere'] },
  fields: { ...COMMON_FIELDS, radius: radiusField },
  create({ object }) {
    return colliderBehavior(
      object,
      (values) => ({ kind: 'sphere', center: values.center, radius: values.radius }),
      { kind: 'sphere', center: [0, 0, 0], radius: 0.5 },
    );
  },
});

/** Capsule Collider (Unity: CapsuleCollider), upright along Y. */
export const capsuleCollider = defineComponent({
  type: 'capsuleCollider',
  category: 'physics',
  unity: 'CapsuleCollider',
  text: { de: 'Kapsel-Collider', en: 'Capsule Collider' },
  docs: {
    de: 'Kapselförmige Kollisionsform, z. B. für Figuren.',
    en: 'Capsule-shaped collision volume, e.g. for characters.',
  },
  keywords: { de: ['kollision', 'kapsel', 'figur'], en: ['collision', 'capsule', 'character'] },
  fields: { ...COMMON_FIELDS, radius: radiusField, height: heightField },
  create({ object }) {
    return colliderBehavior(
      object,
      (values) => ({
        kind: 'capsule',
        center: values.center,
        radius: values.radius,
        height: values.height,
      }),
      { kind: 'capsule', center: [0, 0, 0], radius: 0.5, height: 2 },
    );
  },
});

/** Cylinder Collider, upright along Y (SPEC 8.4; Unity has no built-in counterpart). */
export const cylinderCollider = defineComponent({
  type: 'cylinderCollider',
  category: 'physics',
  text: { de: 'Zylinder-Collider', en: 'Cylinder Collider' },
  docs: {
    de: 'Zylinderförmige Kollisionsform, z. B. für Säulen und Fässer.',
    en: 'Cylinder-shaped collision volume, e.g. for pillars and barrels.',
  },
  keywords: { de: ['kollision', 'zylinder', 'säule'], en: ['collision', 'cylinder', 'pillar'] },
  fields: { ...COMMON_FIELDS, radius: radiusField, height: { ...heightField, default: 1 } },
  create({ object }) {
    return colliderBehavior(
      object,
      (values) => ({
        kind: 'cylinder',
        center: values.center,
        radius: values.radius,
        height: values.height,
      }),
      { kind: 'cylinder', center: [0, 0, 0], radius: 0.5, height: 1 },
    );
  },
});

/** Mesh Collider (Unity: MeshCollider): the exact shape of the object's model or shape. */
export const meshCollider = defineComponent({
  type: 'meshCollider',
  category: 'physics',
  unity: 'MeshCollider',
  text: { de: 'Mesh-Collider', en: 'Mesh Collider' },
  docs: {
    de: 'Nutzt die Form des Modells als Kollisionsform. „Konvex“ legt eine Hülle darum; nur konvexe Mesh-Collider können sich mit einem Rigidbody bewegen.',
    en: 'Uses the model as collision shape. "Convex" wraps it in a hull; only convex mesh colliders can move with a Rigidbody.',
  },
  keywords: { de: ['kollision', 'netz', 'modell', 'hülle'], en: ['collision', 'mesh', 'hull'] },
  fields: {
    ...COMMON_FIELDS,
    convex: { type: 'boolean', default: false, text: { de: 'Konvex', en: 'Convex' } },
  },
  create({ object }) {
    return colliderBehavior(
      object,
      (values) => ({ kind: 'mesh', center: values.center, convex: values.convex }),
      { kind: 'mesh', center: [0, 0, 0], convex: false },
    );
  },
});
