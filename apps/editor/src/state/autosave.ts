import { hasUnsavedChanges, saveProject, useDocument } from './document';
import { usePlay } from './play';
import { useSettings } from './settings';

/** Seconds after the last change before the project is saved automatically. */
const AUTOSAVE_DELAY_MS = 2000;

let timer: ReturnType<typeof setTimeout> | null = null;

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!useSettings.getState().autosave || !hasUnsavedChanges()) return;
  timer = setTimeout(() => {
    timer = null;
    // Never in the middle of playing: play mode changes are not part of the project.
    if (usePlay.getState().status !== 'stopped') return;
    void saveProject({ quiet: true });
  }, AUTOSAVE_DELAY_MS);
}

/** Saves automatically a moment after every change, after play mode and when the page is hidden. */
export function installAutosave(view: Window): void {
  useDocument.subscribe((state, previous) => {
    if (state.revision !== previous.revision) schedule();
  });
  usePlay.subscribe((state, previous) => {
    if (state.status === 'stopped' && previous.status !== 'stopped') schedule();
  });
  view.document.addEventListener('visibilitychange', () => {
    if (
      view.document.visibilityState === 'hidden' &&
      useSettings.getState().autosave &&
      hasUnsavedChanges()
    ) {
      void saveProject({ quiet: true });
    }
  });
}
