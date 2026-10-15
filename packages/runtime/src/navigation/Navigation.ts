import { Vector3 } from 'three';
import {
  Crowd,
  getNavMeshPositionsAndIndices,
  init as initRecast,
  NavMeshQuery,
} from 'recast-navigation';
import type { NavMesh } from 'recast-navigation';
import { generateSoloNavMesh } from 'recast-navigation/generators';
import type { World } from '../world/World';
import { collectNavigationGeometry } from './geometry';

/** The agent size a navigation mesh is made for (Unity: the Bake tab of the Navigation window). */
export interface NavigationSettings {
  /** Radius of the agents in meters; walkable areas keep this distance from walls. */
  agentRadius: number;
  /** Height of the agents in meters; lower ceilings are not walkable. */
  agentHeight: number;
  /** Highest step the agents climb, in meters. */
  maxClimb: number;
  /** Steepest slope the agents walk up, in degrees. */
  maxSlope: number;
  /** Size of a mesh cell in meters; 0 picks it automatically. */
  cellSize: number;
}

/** Settings of a scene without its own. */
export const DEFAULT_NAVIGATION: NavigationSettings = {
  agentRadius: 0.4,
  agentHeight: 1.8,
  maxClimb: 0.4,
  maxSlope: 45,
  cellSize: 0,
};

let ready: Promise<void> | null = null;
let loaded = false;

/**
 * Loads the navigation engine (Recast and Detour, WebAssembly) once. Like the physics engine it
 * starts at editor startup; games created before it finished have no navigation.
 */
export function initNavigation(): Promise<void> {
  ready ??= initRecast().then(() => {
    loaded = true;
  });
  return ready;
}

/** Whether the navigation engine has been loaded. */
export function navigationLoaded(): boolean {
  return loaded;
}

/** Cells per side the automatic cell size aims for, and the most it allows. */
const AUTO_CELLS = 700;
const MAX_CELLS = 1200;

/** Parameters of a moving agent. */
export interface NavigationAgentParams {
  radius: number;
  height: number;
  speed: number;
  acceleration: number;
  /** Agents push each other apart and steer around each other. */
  avoidance: boolean;
}

/** One agent in the crowd. Created by {@link Navigation.addAgent}. */
export interface NavigationAgent {
  /** Where the agent is on the mesh (updated every tick). */
  readonly position: Vector3;
  /** Its velocity in m/s (updated every tick). */
  readonly velocity: Vector3;
  /** Where it is heading, or `null`. */
  readonly target: Vector3 | null;
  /** Walks to a point; the point is moved to the nearest spot of the mesh. Returns whether one exists. */
  moveTo(point: Vector3): boolean;
  /** Stops where it is. */
  stop(): void;
  /** Puts the agent somewhere (on the nearest spot of the mesh). */
  warp(point: Vector3): void;
  /** Changes speed, acceleration or avoidance. */
  update(params: Partial<NavigationAgentParams>): void;
  /** Takes the agent out of the crowd. */
  remove(): void;
}

interface AgentEntry extends NavigationAgent {
  params: NavigationAgentParams;
  crowdAgent: ReturnType<Crowd['addAgent']> | null;
  targetPoint: Vector3 | null;
}

const UPDATE_FLAGS_BASE = 1 | 8 | 16;
const UPDATE_FLAGS_AVOID = 2 | 4;

/**
 * Navigation of a scene (SPEC 8.8): builds a navigation mesh from the scene's ground and obstacles,
 * answers path and point queries, and moves a crowd of agents so many NPCs do not block each
 * other. The mesh is built lazily and again after {@link Navigation.invalidate}.
 */
export class Navigation {
  private navMesh: NavMesh | null = null;
  private query: NavMeshQuery | null = null;
  private crowd: Crowd | null = null;
  private dirty = true;
  private readonly agents = new Set<AgentEntry>();
  /** Counts the builds, so views notice a new mesh. */
  revision = 0;

  constructor(
    private readonly world: World,
    public settings: NavigationSettings = DEFAULT_NAVIGATION,
  ) {}

  /** Whether the engine is loaded and a mesh exists (building it first if needed). */
  ensureBuilt(): boolean {
    if (!loaded) return false;
    if (this.dirty) this.bake();
    return this.navMesh !== null;
  }

  /** Marks the mesh as outdated (a door opened, terrain changed); it is built again on next use. */
  invalidate(): void {
    this.dirty = true;
  }

  /** Builds the navigation mesh now. Returns `false` if the scene has no ground or the engine is missing. */
  bake(): boolean {
    this.dirty = false;
    if (!loaded) return false;
    this.disposeMesh();
    const geometry = collectNavigationGeometry(this.world);
    if (!geometry) return false;
    const { agentRadius, agentHeight, maxClimb, maxSlope } = this.settings;
    const size = geometry.bounds.getSize(new Vector3());
    const longest = Math.max(size.x, size.z, 1);
    let cs =
      this.settings.cellSize > 0
        ? this.settings.cellSize
        : Math.max(agentRadius / 3, longest / AUTO_CELLS);
    cs = Math.max(cs, longest / MAX_CELLS);
    cs = Math.round(cs * 1000) / 1000;
    const ch = Math.round((cs / 2) * 1000) / 1000;
    const result = generateSoloNavMesh(geometry.positions, geometry.indices, {
      cs,
      ch,
      walkableSlopeAngle: maxSlope,
      walkableHeight: Math.ceil(agentHeight / ch),
      walkableClimb: Math.floor(maxClimb / ch),
      walkableRadius: Math.ceil(agentRadius / cs),
      maxEdgeLen: Math.round(12 / (cs * 5)) * 5 || 12,
    });
    if (!result.success || !result.navMesh) return false;
    this.navMesh = result.navMesh;
    this.query = new NavMeshQuery(this.navMesh);
    this.crowd = new Crowd(this.navMesh, {
      maxAgents: 128,
      maxAgentRadius: Math.max(agentRadius, 1),
    });
    this.revision += 1;
    for (const entry of this.agents) this.attach(entry);
    return true;
  }

  /** Whether a mesh has been built. */
  get built(): boolean {
    return this.navMesh !== null;
  }

  /** The nearest point of the mesh within `radius` meters of a point, or `null`. */
  nearest(point: Vector3, radius = 2): Vector3 | null {
    if (!this.ensureBuilt() || !this.query) return null;
    const result = this.query.findClosestPoint(point, {
      halfExtents: { x: radius, y: Math.max(radius, this.settings.agentHeight), z: radius },
    });
    if (!result.success) return null;
    return new Vector3(result.point.x, result.point.y, result.point.z);
  }

  /** The way from one point to another as corner points, or `null` if there is none. */
  findPath(from: Vector3, to: Vector3): Vector3[] | null {
    if (!this.ensureBuilt() || !this.query) return null;
    const half = { x: 2, y: Math.max(2, this.settings.agentHeight), z: 2 };
    const result = this.query.computePath(from, to, { halfExtents: half });
    if (!result.success || result.path.length === 0) return null;
    return result.path.map((p) => new Vector3(p.x, p.y, p.z));
  }

  /** A random point of the mesh within `radius` meters of a center, or `null`. */
  randomPointAround(center: Vector3, radius: number): Vector3 | null {
    if (!this.ensureBuilt() || !this.query) return null;
    const start = this.query.findNearestPoly(center, {
      halfExtents: { x: 2, y: Math.max(2, this.settings.agentHeight), z: 2 },
    });
    if (!start.success) return null;
    const result = this.query.findRandomPointAroundCircle(start.nearestPoint, radius, {
      startRef: start.nearestRef,
    });
    if (!result.success) return null;
    const p = result.randomPoint;
    return new Vector3(p.x, p.y, p.z);
  }

  /** The triangles of the built mesh, to draw it in the Scene view. */
  debugMesh(): { positions: Float32Array; indices: Uint32Array } | null {
    if (!this.navMesh) return null;
    const [positions, indices] = getNavMeshPositionsAndIndices(this.navMesh);
    return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
  }

  /** Adds an agent at a position (moved onto the mesh). */
  addAgent(position: Vector3, params: NavigationAgentParams): NavigationAgent {
    const entry: AgentEntry = {
      position: position.clone(),
      velocity: new Vector3(),
      get target() {
        return entry.targetPoint;
      },
      params: { ...params },
      crowdAgent: null,
      targetPoint: null,
      moveTo: (point) => {
        entry.targetPoint = point.clone();
        if (!entry.crowdAgent) return false;
        const spot = this.nearest(point, 2.5);
        if (!spot) return false;
        entry.targetPoint = spot;
        return entry.crowdAgent.requestMoveTarget(spot);
      },
      stop: () => {
        entry.targetPoint = null;
        entry.crowdAgent?.resetMoveTarget();
        entry.velocity.set(0, 0, 0);
      },
      warp: (point) => {
        const spot = this.nearest(point, 3) ?? point;
        entry.position.copy(spot);
        entry.crowdAgent?.teleport(spot);
      },
      update: (next) => {
        entry.params = { ...entry.params, ...next };
        this.applyParams(entry);
      },
      remove: () => {
        this.agents.delete(entry);
        if (entry.crowdAgent && this.crowd) this.crowd.removeAgent(entry.crowdAgent);
        entry.crowdAgent = null;
      },
    };
    this.agents.add(entry);
    if (this.ensureBuilt()) this.attach(entry);
    return entry;
  }

  private attach(entry: AgentEntry): void {
    if (!this.crowd) return;
    const spot = this.nearest(entry.position, 3) ?? entry.position;
    entry.position.copy(spot);
    entry.crowdAgent = this.crowd.addAgent(spot, {
      radius: entry.params.radius,
      height: entry.params.height,
      maxSpeed: entry.params.speed,
      maxAcceleration: entry.params.acceleration,
      collisionQueryRange: entry.params.radius * 12,
      pathOptimizationRange: entry.params.radius * 30,
      separationWeight: 2,
      updateFlags: UPDATE_FLAGS_BASE | (entry.params.avoidance ? UPDATE_FLAGS_AVOID : 0),
    });
    if (entry.targetPoint) entry.crowdAgent.requestMoveTarget(entry.targetPoint);
  }

  private applyParams(entry: AgentEntry): void {
    entry.crowdAgent?.updateParameters({
      radius: entry.params.radius,
      height: entry.params.height,
      maxSpeed: entry.params.speed,
      maxAcceleration: entry.params.acceleration,
      updateFlags: UPDATE_FLAGS_BASE | (entry.params.avoidance ? UPDATE_FLAGS_AVOID : 0),
    });
  }

  /** Moves all agents one logic tick and reads their positions back. */
  update(dt: number): void {
    if (this.agents.size === 0 || !loaded) return;
    if (this.dirty) this.bake();
    if (!this.crowd) return;
    this.crowd.update(dt);
    for (const entry of this.agents) {
      const agent = entry.crowdAgent;
      if (!agent) continue;
      const p = agent.position();
      const v = agent.velocity();
      entry.position.set(p.x, p.y, p.z);
      entry.velocity.set(v.x, v.y, v.z);
    }
  }

  private disposeMesh(): void {
    for (const entry of this.agents) entry.crowdAgent = null;
    this.crowd?.destroy();
    this.crowd = null;
    this.query = null;
    this.navMesh?.destroy();
    this.navMesh = null;
  }

  /** Frees the mesh and the crowd. */
  dispose(): void {
    this.agents.clear();
    this.disposeMesh();
  }
}
