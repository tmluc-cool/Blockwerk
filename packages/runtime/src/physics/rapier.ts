import RAPIER from '@dimforge/rapier3d-compat';

/** The Rapier module (physics engine, WebAssembly). */
export type Rapier = typeof RAPIER;

let ready: Promise<Rapier> | null = null;
let loaded: Rapier | null = null;

/**
 * Loads the physics engine once. Games created before it finished run without physics, so the
 * editor starts loading at startup and play mode waits for it.
 */
export function initPhysics(): Promise<Rapier> {
  ready ??= RAPIER.init().then(() => {
    loaded = RAPIER;
    return RAPIER;
  });
  return ready;
}

/** The physics engine if it has been loaded. */
export function loadedRapier(): Rapier | null {
  return loaded;
}
