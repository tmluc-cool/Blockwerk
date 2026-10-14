import type { Vec3 } from '@blockwerk/project';
import { Vector3 } from 'three';
import { characterRegistry } from '../physics/Physics';
import type { CharacterMoveSettings } from '../physics/Physics';
import { defineComponent } from './defineComponent';

/**
 * The moving part of a character: control components set the wanted velocity, the character
 * controller moves by it each tick and reports the result.
 */
export interface CharacterMotor {
  /** Wanted velocity in m/s (world space), set by control components and blocks. */
  readonly velocity: Vector3;
  /** Movement actually made in the last tick, in m/s. */
  readonly actualVelocity: Vector3;
  grounded: boolean;
  /** Something above stopped the last upward move. */
  hitCeiling: boolean;
  /** Current capsule height (crouching makes it lower). */
  height: number;
  /** Changes the capsule height (crouch / stand). */
  setHeight(height: number): void;
  /** Standing capsule height from the component. */
  readonly standingHeight: number;
}

/** Character motors by object. */
export const motorRegistry = new WeakMap<object, CharacterMotor>();

/**
 * Character Controller (Unity: CharacterController, SPEC 8.5): a capsule moved by Rapier's
 * kinematic character controller. Walks up slopes up to the slope limit and slides down
 * steeper ones, climbs steps, sticks to the ground, glides along walls and pushes loose objects.
 * Control components or blocks tell it where to go.
 */
export const characterController = defineComponent({
  type: 'characterController',
  category: 'physics',
  unique: true,
  unity: 'CharacterController',
  text: { de: 'Charakter-Controller', en: 'Character Controller' },
  docs: {
    de: 'Kapsel für Spielerfiguren: geht Rampen bis zum Grenzwinkel hoch, steigt Treppen, haftet beim Bergab-Laufen am Boden, gleitet an Wänden entlang und schiebt lose Objekte.',
    en: 'Capsule for player characters: walks up slopes to the limit, climbs stairs, sticks to the ground going downhill, glides along walls and pushes loose objects.',
  },
  keywords: {
    de: ['spieler', 'figur', 'laufen', 'kapsel'],
    en: ['player', 'character', 'walk', 'capsule'],
  },
  fields: {
    height: {
      type: 'number',
      default: 1.8,
      min: 0.1,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Höhe', en: 'Height' },
    },
    radius: {
      type: 'number',
      default: 0.3,
      min: 0.05,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Radius', en: 'Radius' },
    },
    center: {
      type: 'vector3',
      default: [0, 0.9, 0],
      unit: 'meters',
      text: { de: 'Mitte', en: 'Center' },
    },
    slopeLimit: {
      type: 'number',
      default: 45,
      min: 0,
      max: 89,
      step: 1,
      unit: 'degrees',
      text: { de: 'Grenzwinkel', en: 'Slope Limit' },
    },
    stepOffset: {
      type: 'number',
      default: 0.35,
      min: 0,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Stufenhöhe', en: 'Step Offset' },
    },
    skinWidth: {
      type: 'number',
      default: 0.08,
      min: 0.01,
      step: 0.005,
      unit: 'meters',
      text: { de: 'Hautdicke', en: 'Skin Width' },
    },
    snapDistance: {
      type: 'number',
      default: 0.3,
      min: 0,
      step: 0.05,
      unit: 'meters',
      text: { de: 'Am Boden haften', en: 'Ground Snap' },
    },
    pushMass: {
      type: 'number',
      default: 70,
      min: 0,
      step: 5,
      text: { de: 'Schiebekraft (kg)', en: 'Push Mass' },
    },
  },
  create({ object }) {
    let version = 0;
    let shape: { radius: number; height: number; center: Vec3; skin: number; enabled: boolean } = {
      radius: 0.3,
      height: 1.8,
      center: [0, 0.9, 0],
      skin: 0.08,
      enabled: true,
    };
    let settings: CharacterMoveSettings = {
      slopeLimit: 45,
      stepOffset: 0.35,
      skinWidth: 0.08,
      snapDistance: 0.3,
      pushMass: 70,
    };
    let standing = 1.8;
    const publish = (): void => {
      version += 1;
      characterRegistry.set(object, { ...shape, version });
    };
    const motor: CharacterMotor = {
      velocity: new Vector3(),
      actualVelocity: new Vector3(),
      grounded: false,
      hitCeiling: false,
      height: 1.8,
      get standingHeight() {
        return standing;
      },
      setHeight(height) {
        if (Math.abs(height - motor.height) < 1e-4) return;
        motor.height = height;
        // Keep the feet where they are: the center moves with the height.
        const bottom = shape.center[1] - shape.height / 2;
        shape = {
          ...shape,
          height,
          center: [shape.center[0], bottom + height / 2, shape.center[2]],
        };
        publish();
      },
    };
    motorRegistry.set(object, motor);
    return {
      apply(values) {
        standing = values.height;
        motor.height = values.height;
        shape = {
          radius: values.radius,
          height: values.height,
          center: values.center,
          skin: values.skinWidth,
          enabled: shape.enabled,
        };
        settings = {
          slopeLimit: values.slopeLimit,
          stepOffset: values.stepOffset,
          skinWidth: values.skinWidth,
          snapDistance: values.snapDistance,
          pushMass: values.pushMass,
        };
        publish();
      },
      setEnabled(enabled) {
        shape = { ...shape, enabled };
        publish();
      },
      tick(stage, context) {
        if (stage !== 'character') return;
        const desired = motor.velocity.clone().multiplyScalar(context.dt);
        if (!context.physics) {
          object.object3d.position.add(desired);
          motor.actualVelocity.copy(motor.velocity);
          motor.grounded = false;
          return;
        }
        const result = context.physics.moveCharacter(object, desired, settings);
        motor.actualVelocity.copy(result.movement).divideScalar(context.dt);
        motor.grounded = result.grounded;
        motor.hitCeiling = result.hitCeiling;
      },
      destroy() {
        characterRegistry.delete(object);
        if (motorRegistry.get(object) === motor) motorRegistry.delete(object);
      },
    };
  },
});
