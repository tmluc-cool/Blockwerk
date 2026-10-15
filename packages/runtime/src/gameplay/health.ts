import type { GameObject } from '../world/GameObject';

/** What happened to a Health since the last call. */
export interface HealthEvent {
  readonly type: 'hurt' | 'died';
  readonly source: GameObject | null;
}

/**
 * Hit points of an object (SPEC 8.13, 8.15). Damage is ignored while the object is invulnerable
 * after a hit, so a monster hitting every tick does not kill in a blink.
 */
export class Health {
  max = 100;
  current = 100;
  /** Seconds after a hit in which more damage is ignored. */
  invulnerableTime = 0.4;
  /** The last object that hurt this one. */
  lastAttacker: GameObject | null = null;
  private cooldown = 0;
  private dead_ = false;
  private events: HealthEvent[] = [];

  /** Whether the hit points ran out. */
  get dead(): boolean {
    return this.dead_;
  }

  /** Hit points as a share of the maximum (0..1). */
  get fraction(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  /** Hurts the object. Returns whether the damage was applied. */
  damage(amount: number, source: GameObject | null = null): boolean {
    if (this.dead_ || !(amount > 0) || this.cooldown > 0) return false;
    this.current = Math.max(0, this.current - amount);
    this.cooldown = this.invulnerableTime;
    this.lastAttacker = source;
    this.events.push({ type: 'hurt', source });
    if (this.current <= 0) {
      this.dead_ = true;
      this.events.push({ type: 'died', source });
    }
    return true;
  }

  /** Gives hit points back (not above the maximum). */
  heal(amount: number): void {
    if (this.dead_ || !(amount > 0)) return;
    this.current = Math.min(this.max, this.current + amount);
  }

  /** Brings a dead object back with full hit points. */
  revive(): void {
    this.dead_ = false;
    this.current = this.max;
    this.cooldown = 0;
  }

  /** Lets time pass (ends the invulnerable time). */
  advance(dt: number): void {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
  }

  /** Events since the last call. */
  takeEvents(): HealthEvent[] {
    const taken = this.events;
    this.events = [];
    return taken;
  }
}

const healths = new WeakMap<GameObject, Health>();

/** The health of an object, created when first needed (100 hit points, no component required). */
export function healthOf(object: GameObject): Health {
  let health = healths.get(object);
  if (!health) {
    health = new Health();
    healths.set(object, health);
  }
  return health;
}

/** The health of an object if it has one. */
export function peekHealth(object: GameObject): Health | undefined {
  return healths.get(object);
}
