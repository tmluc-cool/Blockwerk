import { Vector3 } from 'three';
import { controlRegistry } from '../components/controls';
import { parseList } from '../components/lists';
import { terrainRegistry } from '../components/terrain';
import { TERRAIN_LAYERS } from '../terrain/TerrainData';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import type { AudioEngine } from './AudioEngine';

/** Events of a character that can have a sound in its sound set. */
export const CHARACTER_SOUND_SLOTS = ['footstep', 'jump', 'land', 'hurt', 'win', 'splash'] as const;
export type CharacterSoundSlot = (typeof CHARACTER_SOUND_SLOTS)[number];

/** Sound names a surface (paint layer of a terrain) uses for footsteps. */
const SURFACE_OF_LAYER = ['grass', 'dirt', 'stone', 'sand'] as const;

/** Built-in sound per event and surface, used where the sound set says nothing. */
function defaultSound(slot: CharacterSoundSlot, surface: string | null): string {
  switch (slot) {
    case 'footstep':
      return surface === 'grass'
        ? 'footstep-grass'
        : surface === 'stone'
          ? 'footstep-stone'
          : surface === 'sand'
            ? 'footstep-sand'
            : 'footstep';
    default:
      return slot;
  }
}

/** Distance of a stride in meters while walking and running. */
const STRIDE_WALK = 1.5;
const STRIDE_RUN = 2.3;
/** Seconds in the air after which landing makes a sound. */
const LAND_AIR_SECONDS = 0.3;

interface Tracker {
  stride: number;
  air: number;
  swimming: boolean;
}

/**
 * Plays the sound set of characters (SPEC 8.11, 5.10): footsteps (from animation events, or by
 * stride length when the animation has none), jump, landing and splash. Footsteps depend on the
 * ground: the paint layer of the terrain under the feet.
 */
export class CharacterSounds {
  private readonly trackers = new WeakMap<GameObject, Tracker>();
  private readonly position = new Vector3();

  constructor(
    private readonly world: World,
    private readonly engine: AudioEngine,
    private readonly random: () => number,
  ) {}

  /** The sound set of a character: `event=sound` pairs, also `footstep:grass=…` per surface. */
  private soundSet(object: GameObject): Map<string, string> {
    const text = object.findComponent('character')?.values['sounds'];
    return new Map(parseList(typeof text === 'string' ? text : ''));
  }

  /** The kind of ground under a position, or `null` without a terrain. */
  surfaceAt(x: number, z: number): string | null {
    for (const object of this.world.allObjects()) {
      const state = terrainRegistry.get(object);
      if (!state || object.destroyed) continue;
      const local = object.object3d.worldToLocal(new Vector3(x, 0, z));
      const half = state.data.size / 2;
      if (Math.abs(local.x) > half || Math.abs(local.z) > half) continue;
      let best = 0;
      let bestWeight = -1;
      for (let layer = 0; layer < TERRAIN_LAYERS; layer++) {
        const weight = state.data.weightAt(layer, local.x, local.z);
        if (weight > bestWeight) {
          bestWeight = weight;
          best = layer;
        }
      }
      return SURFACE_OF_LAYER[best] ?? null;
    }
    return null;
  }

  /** Plays an event's sound for a character; nothing if the set says `none`. */
  play(object: GameObject, slot: CharacterSoundSlot): void {
    const set = this.soundSet(object);
    const here = object.worldPosition(this.position);
    const surface = slot === 'footstep' ? this.surfaceAt(here.x, here.z) : null;
    const chosen =
      (surface ? set.get(`${slot}:${surface}`) : undefined) ??
      set.get(slot) ??
      defaultSound(slot, surface);
    if (chosen === 'none' || chosen === '') return;
    this.engine.play(chosen, {
      bus: slot === 'hurt' || slot === 'win' ? 'voices' : 'effects',
      position: here.clone(),
      volume: slot === 'footstep' ? 0.5 : 0.9,
      pitch: 0.94 + this.random() * 0.12,
      minDistance: 2,
      maxDistance: 25,
    });
  }

  /** An animation event of a character ("step" marks a foot touching the ground). */
  onAnimationEvent(object: GameObject, name: string): void {
    if (name === 'step' || name === 'footstep') this.play(object, 'footstep');
  }

  /** Whether the character's animation marks its own steps (then no stride-based steps). */
  private hasStepMarkers(object: GameObject): boolean {
    const markers = object.findComponent('animator')?.values['markers'];
    return typeof markers === 'string' && /=\s*(step|footstep)\b/.test(markers);
  }

  /** Runs once per logic tick: jump, landing, splash and stride-based footsteps. */
  update(dt: number): void {
    for (const object of this.world.allObjects()) {
      if (object.destroyed || !object.activeInHierarchy) continue;
      const control = controlRegistry.get(object);
      if (!control || control.mode === 'vehicle') continue;
      let tracker = this.trackers.get(object);
      if (!tracker) {
        tracker = { stride: 0, air: 0, swimming: false };
        this.trackers.set(object, tracker);
      }
      if (control.ticksSinceJump === 0) this.play(object, 'jump');
      if (control.swimming && !tracker.swimming) this.play(object, 'splash');
      tracker.swimming = control.swimming;
      if (control.grounded || control.swimming) {
        if (tracker.air > LAND_AIR_SECONDS && control.grounded) this.play(object, 'land');
        tracker.air = 0;
      } else {
        tracker.air += dt;
      }
      if (control.grounded && !control.swimming && !this.hasStepMarkers(object)) {
        tracker.stride += control.speed * dt;
        const length = control.running ? STRIDE_RUN : STRIDE_WALK;
        if (control.speed < 0.4) tracker.stride = 0;
        else if (tracker.stride >= length) {
          tracker.stride -= length;
          this.play(object, 'footstep');
        }
      } else {
        tracker.stride = 0;
      }
    }
  }
}
