import type { LibraryEntry } from '@blockwerk/library';

/** One object of a proposed world: a model of the asset library standing somewhere. */
export interface WorldObject {
  /** Library ID such as `kaykit-medieval-hexagon/building-home-a-red`. */
  readonly model: string;
  /** Name in the Hierarchy; the model's name if missing. */
  readonly name?: string;
  /** Meters; the model's origin is at the bottom center. */
  readonly position: readonly [number, number, number];
  /** Turn around the vertical axis in degrees. */
  readonly rotationY?: number;
  /** Uniform scale (default 1). */
  readonly scale?: number;
  readonly tag?: string;
}

/** A proposed world: library objects with positions. */
export interface WorldProposal {
  readonly summary?: string;
  readonly objects: readonly WorldObject[];
}

/** What a world proposal is checked against. */
export interface WorldContext {
  /** The asset library by library ID. */
  readonly library: ReadonlyMap<string, LibraryEntry>;
}

/** Limits that keep a proposal reviewable. */
export const WORLD_LIMITS = {
  objects: 60,
  distance: 500,
  minY: -10,
  maxY: 60,
  minScale: 0.1,
  maxScale: 20,
} as const;

/** The result of checking a world proposal. */
export type WorldCheck =
  | {
      readonly ok: true;
      readonly proposal: WorldProposal;
      readonly objects: readonly Required<
        Pick<WorldObject, 'model' | 'name' | 'position' | 'rotationY' | 'scale'>
      >[];
    }
  | { readonly ok: false; readonly errors: readonly string[] };

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Checks a world proposal against the library index: every model exists, numbers are finite and in
 * range, and objects do not stand inside each other. A valid proposal can be placed as it is.
 */
export function checkWorld(input: unknown, ctx: WorldContext): WorldCheck {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: ['the answer is not an object'] };
  }
  const proposal = input as Partial<WorldProposal>;
  if (!Array.isArray(proposal.objects) || proposal.objects.length === 0) {
    return { ok: false, errors: ['"objects" must list at least one object'] };
  }
  if (proposal.objects.length > WORLD_LIMITS.objects) {
    return {
      ok: false,
      errors: [
        `at most ${WORLD_LIMITS.objects} objects are allowed, got ${proposal.objects.length}`,
      ],
    };
  }
  const errors: string[] = [];
  const objects: {
    model: string;
    name: string;
    position: [number, number, number];
    rotationY: number;
    scale: number;
    radius: number;
  }[] = [];
  proposal.objects.forEach((raw, index) => {
    const at = `objects[${index}]`;
    const object = raw as Partial<WorldObject> | null;
    if (typeof object !== 'object' || object === null) {
      errors.push(`${at}: needs an object`);
      return;
    }
    const model = typeof object.model === 'string' ? object.model.replace(/^library:/, '') : '';
    const entry = ctx.library.get(model);
    if (!entry) {
      errors.push(
        `${at}: the model ${JSON.stringify(object.model)} is not in the library (use an ID from the library list)`,
      );
      return;
    }
    const position = object.position;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(finite)) {
      errors.push(`${at}: "position" needs three numbers [x, y, z]`);
      return;
    }
    const [x, y, z] = position as [number, number, number];
    if (Math.abs(x) > WORLD_LIMITS.distance || Math.abs(z) > WORLD_LIMITS.distance) {
      errors.push(`${at}: x and z must be within ±${WORLD_LIMITS.distance} meters`);
    }
    if (y < WORLD_LIMITS.minY || y > WORLD_LIMITS.maxY) {
      errors.push(`${at}: y must be between ${WORLD_LIMITS.minY} and ${WORLD_LIMITS.maxY}`);
    }
    const rotationY = object.rotationY ?? 0;
    if (!finite(rotationY)) errors.push(`${at}: "rotationY" needs a number of degrees`);
    const scale = object.scale ?? 1;
    if (!finite(scale) || scale < WORLD_LIMITS.minScale || scale > WORLD_LIMITS.maxScale) {
      errors.push(
        `${at}: "scale" must be between ${WORLD_LIMITS.minScale} and ${WORLD_LIMITS.maxScale}`,
      );
    }
    if (
      object.tag !== undefined &&
      (typeof object.tag !== 'string' || !/^[\w -]{1,32}$/.test(object.tag))
    ) {
      errors.push(`${at}: "tag" needs a short text`);
    }
    const name =
      typeof object.name === 'string' && object.name.trim() !== ''
        ? object.name.trim().slice(0, 60)
        : entry.name.en;
    const radius = (Math.max(entry.size[0], entry.size[2]) / 2) * (finite(scale) ? scale : 1);
    objects.push({
      model,
      name,
      position: [x, y, z],
      rotationY: finite(rotationY) ? rotationY : 0,
      scale: finite(scale) ? scale : 1,
      radius,
    });
  });
  // Objects that stand inside each other make a poor village: the model is asked to move them.
  let overlaps = 0;
  for (let a = 0; a < objects.length && overlaps < 5; a += 1) {
    for (let b = a + 1; b < objects.length && overlaps < 5; b += 1) {
      const first = objects[a];
      const second = objects[b];
      if (!first || !second) continue;
      const distance = Math.hypot(
        first.position[0] - second.position[0],
        first.position[2] - second.position[2],
      );
      if (
        distance < 0.6 * (first.radius + second.radius) &&
        Math.abs(first.position[1] - second.position[1]) < 2
      ) {
        errors.push(
          `objects[${a}] and objects[${b}] stand inside each other (${distance.toFixed(1)} m apart, they need about ${(0.6 * (first.radius + second.radius)).toFixed(1)} m)`,
        );
        overlaps += 1;
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 20) };
  return {
    ok: true,
    proposal: proposal as WorldProposal,
    objects: objects.map(({ model, name, position, rotationY, scale }) => ({
      model,
      name,
      position,
      rotationY,
      scale,
    })),
  };
}
