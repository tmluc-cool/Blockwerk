import type { Vec3 } from '@blockwerk/project';
import { defineComponent } from './defineComponent';
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
    };

/** Live state of a collider, read by the collision system. */
export interface ColliderState {
  shape: ColliderShape;
  isTrigger: boolean;
  enabled: boolean;
}

/** Collider states by object, kept by the collider behaviors. */
export const colliderRegistry = new WeakMap<object, ColliderState[]>();

function register(owner: object, state: ColliderState): () => void {
  const list = colliderRegistry.get(owner) ?? [];
  list.push(state);
  colliderRegistry.set(owner, list);
  return () => {
    const index = list.indexOf(state);
    if (index >= 0) list.splice(index, 1);
  };
}

/** Box Collider (Unity: BoxCollider). */
export const boxCollider = defineComponent({
  type: 'boxCollider',
  category: 'physics',
  unity: 'BoxCollider',
  text: { de: 'Box-Collider', en: 'Box Collider' },
  docs: { de: 'Quaderförmige Kollisionsform.', en: 'Box-shaped collision volume.' },
  keywords: { de: ['kollision', 'quader'], en: ['collision', 'box'] },
  fields: {
    isTrigger: { type: 'boolean', default: false, text: triggerText },
    center: { type: 'vector3', default: [0, 0, 0], unit: 'meters', text: centerText },
    size: {
      type: 'vector3',
      default: [1, 1, 1],
      unit: 'meters',
      text: { de: 'Grösse', en: 'Size' },
    },
  },
  create({ object }) {
    const state: ColliderState = {
      shape: { kind: 'box', center: [0, 0, 0], size: [1, 1, 1] },
      isTrigger: false,
      enabled: true,
    };
    const unregister = register(object, state);
    return {
      apply(values) {
        state.shape = { kind: 'box', center: values.center, size: values.size };
        state.isTrigger = values.isTrigger;
      },
      setEnabled(enabled) {
        state.enabled = enabled;
      },
      destroy: unregister,
    };
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
  fields: {
    isTrigger: { type: 'boolean', default: false, text: triggerText },
    center: { type: 'vector3', default: [0, 0, 0], unit: 'meters', text: centerText },
    radius: {
      type: 'number',
      default: 0.5,
      min: 0,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Radius', en: 'Radius' },
    },
  },
  create({ object }) {
    const state: ColliderState = {
      shape: { kind: 'sphere', center: [0, 0, 0], radius: 0.5 },
      isTrigger: false,
      enabled: true,
    };
    const unregister = register(object, state);
    return {
      apply(values) {
        state.shape = { kind: 'sphere', center: values.center, radius: values.radius };
        state.isTrigger = values.isTrigger;
      },
      setEnabled(enabled) {
        state.enabled = enabled;
      },
      destroy: unregister,
    };
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
  fields: {
    isTrigger: { type: 'boolean', default: false, text: triggerText },
    center: { type: 'vector3', default: [0, 0, 0], unit: 'meters', text: centerText },
    radius: {
      type: 'number',
      default: 0.5,
      min: 0,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Radius', en: 'Radius' },
    },
    height: {
      type: 'number',
      default: 2,
      min: 0,
      step: 0.1,
      unit: 'meters',
      text: { de: 'Höhe', en: 'Height' },
    },
  },
  create({ object }) {
    const state: ColliderState = {
      shape: { kind: 'capsule', center: [0, 0, 0], radius: 0.5, height: 2 },
      isTrigger: false,
      enabled: true,
    };
    const unregister = register(object, state);
    return {
      apply(values) {
        state.shape = {
          kind: 'capsule',
          center: values.center,
          radius: values.radius,
          height: values.height,
        };
        state.isTrigger = values.isTrigger;
      },
      setEnabled(enabled) {
        state.enabled = enabled;
      },
      destroy: unregister,
    };
  },
});
