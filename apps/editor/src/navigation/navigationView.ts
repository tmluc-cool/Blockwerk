import { initNavigation, navigationLoaded } from '@blockwerk/runtime';
import { create } from 'zustand';
import { currentEditWorld } from '../scene/worlds';
import { useDocument } from '../state/document';

/** What the Navigation window shows and what the Scene view draws of the navigation mesh. */
export interface NavigationViewState {
  /** Draw the mesh in the Scene view. */
  show: boolean;
  /** Build the mesh again (after a pause) when the scene changes. */
  auto: boolean;
  /** Counts the builds, so the Scene view redraws its copy of the mesh. */
  revision: number;
  /** Triangles of the last mesh (0 = none). */
  triangles: number;
  /** Time the last build took, in milliseconds. */
  bakeMs: number | null;
  /** `none`: not built yet, `ok`, `empty`: the scene has no ground to walk on. */
  status: 'none' | 'ok' | 'empty';
  setShow(show: boolean): void;
  setAuto(auto: boolean): void;
}

export const useNavigationView = create<NavigationViewState>((set) => ({
  show: true,
  auto: true,
  revision: 0,
  triangles: 0,
  bakeMs: null,
  status: 'none',
  setShow: (show) => set({ show }),
  setAuto: (auto) => set({ auto }),
}));

/** Builds the navigation mesh of the open scene now (Unity: Navigation → Bake). */
export function bakeNavigation(): void {
  if (!navigationLoaded()) {
    void initNavigation().then(bakeNavigation, () => undefined);
    return;
  }
  const world = currentEditWorld();
  if (!world) return;
  const started = performance.now();
  const ok = world.navigation.bake();
  const mesh = world.navigation.debugMesh();
  useNavigationView.setState((state) => ({
    revision: state.revision + 1,
    triangles: mesh ? mesh.indices.length / 3 : 0,
    bakeMs: Math.round(performance.now() - started),
    status: ok ? 'ok' : 'empty',
  }));
}

let timer: ReturnType<typeof setTimeout> | null = null;
const AUTO_DELAY_MS = 700;

// Automatic re-bake: after the scene changed, once the editing paused.
useDocument.subscribe((state, previous) => {
  if (state.scene === previous.scene) return;
  const view = useNavigationView.getState();
  if (!view.auto || view.status === 'none') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    bakeNavigation();
  }, AUTO_DELAY_MS);
});
