import type { LocalizedText } from '../text';
import { controlRegistry } from '../components/controls';
import { resolveValues } from '../components/defineComponent';
import type { GameObject } from '../world/GameObject';

/** The values of a movement profile (fields of the control components). */
export interface ProfileValues {
  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly acceleration: number;
  readonly rotationSmoothTime: number;
  readonly jumpHeight: number;
  readonly gravity: number;
  readonly airControl: number;
}

/** Names of the movement profiles (SPEC 5.10). */
export const PROFILE_NAMES = ['arcade', 'realistic', 'agile', 'heavy', 'floating'] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

/** Movement profiles: presets for all movement sliders. */
export const MOVEMENT_PROFILES: Readonly<Record<ProfileName, ProfileValues>> = {
  // Direct and snappy with high jumps.
  arcade: {
    walkSpeed: 3,
    runSpeed: 6.5,
    acceleration: 25,
    rotationSmoothTime: 0.06,
    jumpHeight: 1.8,
    gravity: 18,
    airControl: 0.9,
  },
  // Sluggish and heavy-footed.
  realistic: {
    walkSpeed: 1.6,
    runSpeed: 4,
    acceleration: 6,
    rotationSmoothTime: 0.2,
    jumpHeight: 0.9,
    gravity: 20,
    airControl: 0.25,
  },
  // Ninja: fast and agile.
  agile: {
    walkSpeed: 3.5,
    runSpeed: 7.5,
    acceleration: 30,
    rotationSmoothTime: 0.05,
    jumpHeight: 1.5,
    gravity: 16,
    airControl: 0.8,
  },
  // Knight in armor.
  heavy: {
    walkSpeed: 1.4,
    runSpeed: 3.2,
    acceleration: 5,
    rotationSmoothTime: 0.25,
    jumpHeight: 0.6,
    gravity: 22,
    airControl: 0.15,
  },
  // Ghost: slow, long floaty jumps.
  floating: {
    walkSpeed: 2,
    runSpeed: 4,
    acceleration: 3,
    rotationSmoothTime: 0.2,
    jumpHeight: 2.5,
    gravity: 6,
    airControl: 1,
  },
};

/** Names of the profiles in the editor and in blocks. */
export const PROFILE_TEXT: Readonly<Record<ProfileName, LocalizedText>> = {
  arcade: { de: 'Arcade', en: 'Arcade' },
  realistic: { de: 'Realistisch', en: 'Realistic' },
  agile: { de: 'Flink', en: 'Agile' },
  heavy: { de: 'Schwer', en: 'Heavy' },
  floating: { de: 'Schwebend', en: 'Floating' },
};

/** Whether a name is a movement profile. */
export function isProfileName(name: string): name is ProfileName {
  return (PROFILE_NAMES as readonly string[]).includes(name);
}

/**
 * Applies a movement profile to the control component of an object while the game runs (block
 * "switch movement profile"). Values set by blocks before are forgotten.
 */
export function applyMovementProfile(object: GameObject, name: ProfileName): boolean {
  const control = controlRegistry.get(object);
  const component = object.components.find((candidate) =>
    candidate.behavior === undefined
      ? false
      : candidate.definition.type.endsWith('Control') &&
        candidate.definition.type !== 'vehicleControl',
  );
  if (!control || !component) return false;
  component.values = { ...component.values, ...MOVEMENT_PROFILES[name] };
  component.behavior.apply(resolveValues(component.definition, component.values));
  control.clearOverrides();
  return true;
}

/**
 * Height, time in the air and length of a jump in meters for given movement values. This runs
 * the same per-tick steps as the character controller, so the arc shown in the Character Studio
 * matches the real jump.
 */
export function jumpArc(
  values: Pick<ProfileValues, 'jumpHeight' | 'gravity' | 'runSpeed' | 'walkSpeed'>,
  snapDistance = 0.3,
): {
  /** Time in the air in seconds. */
  readonly airtime: number;
  /** Highest point above the ground in meters. */
  readonly height: number;
  /** Distance of a jump at walking speed and at running speed. */
  readonly walkDistance: number;
  readonly runDistance: number;
  /** Height above the ground after each tick (for drawing). */
  readonly points: readonly number[];
} {
  const dt = 1 / 60;
  const g = values.gravity;
  if (g <= 0 || values.jumpHeight <= 0) {
    return { airtime: 0, height: 0, walkDistance: 0, runDistance: 0, points: [] };
  }
  let velocity = Math.max(0, Math.sqrt(2 * g * values.jumpHeight) - (g * dt) / 2);
  let y = 0;
  let apex = 0;
  const points: number[] = [];
  // The controller sticks to the ground within its snap distance, so a falling character
  // lands a little before it would reach the ground (half the apex at most).
  const landAt = Math.min(snapDistance, values.jumpHeight * 0.5);
  for (let tick = 0; tick < 6000; tick++) {
    y += velocity * dt;
    apex = Math.max(apex, y);
    velocity -= g * dt;
    if (velocity < 0 && y <= landAt) {
      points.push(0);
      break;
    }
    points.push(Math.max(0, y));
  }
  const airtime = points.length * dt;
  return {
    airtime,
    height: apex,
    walkDistance: airtime * values.walkSpeed,
    runDistance: airtime * values.runSpeed,
    points,
  };
}
