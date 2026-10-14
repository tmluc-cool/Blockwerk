import { defineComponent } from './defineComponent';

/** How a body moves (Unity: Rigidbody with or without "Is Kinematic"). */
export type BodyType = 'dynamic' | 'kinematic';

/** Live state of a rigidbody, read by the physics system. */
export interface RigidbodyState {
  type: BodyType;
  mass: number;
  drag: number;
  angularDrag: number;
  useGravity: boolean;
  /** Locked rotation axes (x, y, z). */
  freezeRotation: [boolean, boolean, boolean];
  continuous: boolean;
  enabled: boolean;
  /** Increases whenever something changed. */
  version: number;
}

/** Rigidbody states by object. */
export const rigidbodyRegistry = new WeakMap<object, RigidbodyState>();

/** Rigidbody (Unity: Rigidbody): the object is moved by physics (SPEC 8.4). */
export const rigidbody = defineComponent({
  type: 'rigidbody',
  category: 'physics',
  unique: true,
  unity: 'Rigidbody',
  text: { de: 'Rigidbody', en: 'Rigidbody' },
  docs: {
    de: 'Lässt die Physik das Objekt bewegen: Schwerkraft, Stösse, Umfallen. „Kinematisch“ bewegt sich nur per Skript oder Animation, schiebt aber andere Körper.',
    en: 'Lets physics move the object: gravity, pushes, falling over. "Kinematic" moves only by script or animation but pushes other bodies.',
  },
  keywords: {
    de: ['physik', 'schwerkraft', 'körper', 'fallen'],
    en: ['physics', 'gravity', 'body', 'fall'],
  },
  fields: {
    bodyType: {
      type: 'enum',
      default: 'dynamic',
      options: [
        { value: 'dynamic', text: { de: 'Dynamisch', en: 'Dynamic' } },
        { value: 'kinematic', text: { de: 'Kinematisch', en: 'Kinematic' } },
      ],
      text: { de: 'Art', en: 'Body Type' },
    },
    mass: {
      type: 'number',
      default: 1,
      min: 0.001,
      step: 0.1,
      text: { de: 'Masse (kg)', en: 'Mass' },
    },
    drag: {
      type: 'number',
      default: 0,
      min: 0,
      step: 0.05,
      text: { de: 'Luftwiderstand', en: 'Drag' },
    },
    angularDrag: {
      type: 'number',
      default: 0.05,
      min: 0,
      step: 0.05,
      text: { de: 'Drehwiderstand', en: 'Angular Drag' },
    },
    useGravity: {
      type: 'boolean',
      default: true,
      text: { de: 'Schwerkraft', en: 'Use Gravity' },
    },
    freezeRotationX: {
      type: 'boolean',
      default: false,
      group: 'constraints',
      text: { de: 'Drehung X sperren', en: 'Freeze Rotation X' },
    },
    freezeRotationY: {
      type: 'boolean',
      default: false,
      group: 'constraints',
      text: { de: 'Drehung Y sperren', en: 'Freeze Rotation Y' },
    },
    freezeRotationZ: {
      type: 'boolean',
      default: false,
      group: 'constraints',
      text: { de: 'Drehung Z sperren', en: 'Freeze Rotation Z' },
    },
    continuous: {
      type: 'boolean',
      default: false,
      text: { de: 'Schnelle Objekte (CCD)', en: 'Continuous Collision' },
    },
  },
  create({ object }) {
    const state: RigidbodyState = {
      type: 'dynamic',
      mass: 1,
      drag: 0,
      angularDrag: 0.05,
      useGravity: true,
      freezeRotation: [false, false, false],
      continuous: false,
      enabled: true,
      version: 0,
    };
    rigidbodyRegistry.set(object, state);
    return {
      apply(values) {
        state.type = values.bodyType as BodyType;
        state.mass = values.mass;
        state.drag = values.drag;
        state.angularDrag = values.angularDrag;
        state.useGravity = values.useGravity;
        state.freezeRotation = [
          values.freezeRotationX,
          values.freezeRotationY,
          values.freezeRotationZ,
        ];
        state.continuous = values.continuous;
        state.version += 1;
      },
      setEnabled(enabled) {
        state.enabled = enabled;
        state.version += 1;
      },
      destroy() {
        if (rigidbodyRegistry.get(object) === state) rigidbodyRegistry.delete(object);
      },
    };
  },
});
