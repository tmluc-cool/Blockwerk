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

/** Starts the tutorial at the first step. */
export function startTutorial(): void {
  useTutorial.setState({ active: true, index: 0, start: readFacts() });
}

/** Ends the tutorial. */
export function stopTutorial(): void {
  useTutorial.setState({ active: false, index: 0, start: null });
}

/** Goes to a step (clamped); the last step's "Next" ends the tutorial. */
export function goToStep(index: number): void {
  if (index >= TUTORIAL_STEPS.length) {
    stopTutorial();
    return;
  }
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
