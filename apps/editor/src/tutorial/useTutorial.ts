import { create } from 'zustand';
import { useDocument } from '../state/document';
import { usePlay } from '../state/play';
import { blockTypesOf, TUTORIAL_STEPS } from './steps';
import type { TutorialFacts } from './steps';

interface TutorialState {
  readonly active: boolean;
  readonly index: number;
  /** What the editor looked like when the current step began (steps compare against it). */
  readonly start: TutorialFacts | null;
}

/** The tutorial "Your first world in 10 minutes": whether it runs and at which step. */
export const useTutorial = create<TutorialState>()(() => ({
  active: false,
  index: 0,
  start: null,
}));

/** Reads the facts the steps look at from the open project. */
export function readFacts(): TutorialFacts {
  const { scene, project } = useDocument.getState();
  const cubes = Object.entries(scene?.objects ?? {})
    .filter(([, object]) =>
      object.components.some(
        (component) => component.type === 'meshRenderer' && component.values['shape'] === 'cube',
      ),
    )
    .map(([id, object]) => ({ id, position: object.transform.position }));
  const scripts = (project?.assetsOfType('blockScript') ?? []).map((entry) => ({
    id: entry.id,
    blocks: blockTypesOf(entry.data.workspace),
  }));
  const scriptsOnCubes = Object.values(scene?.objects ?? {})
    .filter((object) =>
      object.components.some(
        (component) => component.type === 'meshRenderer' && component.values['shape'] === 'cube',
      ),
    )
    .flatMap((object) =>
      object.components.flatMap((component) =>
        component.type === 'blockScript' && typeof component.values['script'] === 'string'
          ? [component.values['script']]
          : [],
      ),
    );
  return { cubes, scripts, scriptsOnCubes, play: usePlay.getState().status };
}

const STORAGE_KEY = 'blockwerk.tutorial.step';

/** The step where the user left off (0 when none, or when browser storage is unavailable). */
function savedStep(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 && value < TUTORIAL_STEPS.length - 1 ? value : 0;
  } catch {
    return 0;
  }
}

function saveStep(index: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(index));
  } catch {
    // Without storage the tutorial simply starts from the beginning next time.
  }
}

/** Starts the tutorial where the user left off, or at the first step. */
export function startTutorial(): void {
  useTutorial.setState({ active: true, index: savedStep(), start: readFacts() });
}

/** Ends the tutorial. */
export function stopTutorial(): void {
  useTutorial.setState({ active: false, index: 0, start: null });
}

/** Goes to a step (clamped); the last step's "Next" ends the tutorial. */
export function goToStep(index: number): void {
  if (index >= TUTORIAL_STEPS.length) {
    saveStep(0);
    stopTutorial();
    return;
  }
  saveStep(Math.max(0, index));
  useTutorial.setState({ index: Math.max(0, index), start: readFacts() });
}

/** Moves on when what the user just did finishes the current step. */
function checkProgress(): void {
  const { active, index, start } = useTutorial.getState();
  if (!active || !start) return;
  const step = TUTORIAL_STEPS[index];
  if (step?.done?.(readFacts(), start)) goToStep(index + 1);
}

useDocument.subscribe(checkProgress);
usePlay.subscribe(checkProgress);
