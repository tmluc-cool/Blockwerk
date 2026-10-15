import { Vector3 } from 'three';
import type { NavAgentHandle } from '../components/navAgent';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import { flatDistance } from './senses';

/** What a movement behavior needs each tick. */
export interface RunnerContext {
  readonly object: GameObject;
  readonly world: World;
  readonly agent: NavAgentHandle;
  readonly dt: number;
  readonly random: () => number;
}

/**
 * A movement behavior of an NPC. The components (Wander, Patrol, Follow, Flee) and the blocks
 * ("follow … with distance …") share these, so both behave the same.
 */
export interface Runner {
  /** Runs one tick while the behavior is active. */
  update(context: RunnerContext): void;
  /** Called when the behavior stops being active: stops walking. */
  stop(context: Pick<RunnerContext, 'agent'>): void;
}

/** Walks around a home position in short trips with pauses (Unity: a wander script). */
export class WanderRunner implements Runner {
  private pause = -1;
  private readonly home: Vector3;
  private walking = false;

  constructor(
    home: Vector3,
    private readonly params: {
      radius: number;
      minPause: number;
      maxPause: number;
      speed: number;
    },
  ) {
    this.home = home.clone();
  }

  update({ world, agent, dt, random }: RunnerContext): void {
    if (agent.moving) return;
    if (this.walking) {
      this.walking = false;
      this.pause = -1;
    }
    if (this.pause < 0) {
      const { minPause, maxPause } = this.params;
      this.pause = minPause + random() * Math.max(0, maxPause - minPause);
    }
    this.pause -= dt;
    if (this.pause > 0) return;
    const point = world.navigation.randomPointAround(this.home, this.params.radius, random);
    this.pause = -1;
    if (!point) return;
    agent.speed = this.params.speed;
    this.walking = agent.moveTo(point);
  }

  stop({ agent }: Pick<RunnerContext, 'agent'>): void {
    agent.stop();
    this.walking = false;
    this.pause = -1;
  }
}

/** Walks along waypoints (the children of a route object), with a pause at each. */
export class PatrolRunner implements Runner {
  private index = 0;
  private direction = 1;
  private waiting = 0;
  private heading = false;
  private resumed = true;

  constructor(
    private readonly route: () => GameObject | null,
    private readonly params: { pingPong: boolean; wait: number; speed: number },
  ) {}

  private points(): Vector3[] {
    const route = this.route();
    if (!route) return [];
    return route.children.filter((c) => !c.destroyed).map((c) => c.worldPosition());
  }

  update({ object, agent, dt }: RunnerContext): void {
    const points = this.points();
    if (points.length === 0) return;
    if (this.resumed) {
      // After an interruption (a chase) go on at the nearest waypoint.
      const here = object.worldPosition();
      let nearest = 0;
      let best = Infinity;
      points.forEach((p, i) => {
        const d = flatDistance(p, here);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
      this.index = nearest;
      this.heading = false;
      this.waiting = 0;
      this.resumed = false;
    }
    this.index = Math.min(this.index, points.length - 1);
    if (agent.moving) return;
    if (this.heading) {
      // Arrived (or the way ended): wait, then take the next waypoint.
      this.waiting += dt;
      if (this.waiting < this.params.wait) return;
      this.heading = false;
      this.waiting = 0;
      this.advance(points.length);
    }
    const target = points[this.index];
    if (!target) return;
    agent.speed = this.params.speed;
    this.heading = agent.moveTo(target);
    if (!this.heading) this.advance(points.length);
  }

  private advance(count: number): void {
    if (count <= 1) return;
    if (this.params.pingPong) {
      if (this.index + this.direction >= count || this.index + this.direction < 0) {
        this.direction = -this.direction;
      }
      this.index += this.direction;
    } else {
      this.index = (this.index + 1) % count;
    }
  }

  stop({ agent }: Pick<RunnerContext, 'agent'>): void {
    agent.stop();
    this.resumed = true;
  }
}

/** Follows a target to within some distance, finding the way around obstacles. */
export class FollowRunner implements Runner {
  private timer = 0;

  constructor(
    private readonly target: () => GameObject | null,
    private readonly params: { distance: number; speed: number; repath: number },
  ) {}

  update({ object, agent, dt }: RunnerContext): void {
    const target = this.target();
    if (!target) return;
    const there = target.worldPosition();
    const here = object.worldPosition();
    if (flatDistance(here, there) <= this.params.distance) {
      if (agent.moving) agent.stop();
      object.lookAtPoint(there);
      return;
    }
    this.timer -= dt;
    const destination = agent.destination;
    const stale = !destination || flatDistance(destination, there) > 0.5;
    if (this.timer > 0 && agent.moving && !stale) return;
    this.timer = this.params.repath;
    agent.speed = this.params.speed;
    agent.moveTo(there);
  }

  stop({ agent }: Pick<RunnerContext, 'agent'>): void {
    agent.stop();
    this.timer = 0;
  }
}

/** Runs away from a target until it is far enough away. */
export class FleeRunner implements Runner {
  private timer = 0;

  constructor(
    private readonly target: () => GameObject | null,
    private readonly params: { safeDistance: number; speed: number },
  ) {}

  update({ object, world, agent, dt, random }: RunnerContext): void {
    const target = this.target();
    if (!target) return;
    const there = target.worldPosition();
    const here = object.worldPosition();
    const distance = flatDistance(here, there);
    if (distance >= this.params.safeDistance) {
      if (agent.moving) agent.stop();
      return;
    }
    this.timer -= dt;
    if (this.timer > 0 && agent.moving) return;
    this.timer = 0.5;
    const away = new Vector3(here.x - there.x, 0, here.z - there.z);
    if (away.lengthSq() < 1e-6) away.set(random() - 0.5, 0, random() - 0.5);
    away.normalize().multiplyScalar(8);
    const spot = world.navigation.nearest(here.clone().add(away), 5);
    if (!spot) return;
    agent.speed = this.params.speed;
    agent.moveTo(spot);
  }

  stop({ agent }: Pick<RunnerContext, 'agent'>): void {
    agent.stop();
    this.timer = 0;
  }
}
