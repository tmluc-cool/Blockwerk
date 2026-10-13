/** Edits within this time with the same merge key become one undo step (dragging, typing). */
const MERGE_WINDOW_MS = 1000;

/** Most undo steps kept. */
const MAX_STEPS = 200;

interface Step<T> {
  readonly state: T;
  readonly label: string;
}

/**
 * Undo/redo history of immutable states. `record` is called with the state *before* a change,
 * so the current state lives outside the history.
 */
export class History<T> {
  private readonly undoSteps: Step<T>[] = [];
  private readonly redoSteps: Step<T>[] = [];
  private lastKey: string | null = null;
  private lastTime = 0;

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Remembers the state before a change. Changes with the same `mergeKey` in quick succession merge. */
  record(before: T, label: string, mergeKey?: string): void {
    const time = this.now();
    const merge =
      mergeKey !== undefined && mergeKey === this.lastKey && time - this.lastTime < MERGE_WINDOW_MS;
    this.lastKey = mergeKey ?? null;
    this.lastTime = time;
    this.redoSteps.length = 0;
    if (merge) return;
    this.undoSteps.push({ state: before, label });
    if (this.undoSteps.length > MAX_STEPS) this.undoSteps.shift();
  }

  /** Returns the state to go back to, given the current one. */
  undo(current: T): Step<T> | null {
    const step = this.undoSteps.pop();
    if (!step) return null;
    this.redoSteps.push({ state: current, label: step.label });
    this.lastKey = null;
    return step;
  }

  /** Returns the state to go forward to, given the current one. */
  redo(current: T): Step<T> | null {
    const step = this.redoSteps.pop();
    if (!step) return null;
    this.undoSteps.push({ state: current, label: step.label });
    this.lastKey = null;
    return step;
  }

  /** Label of the next undo step. */
  get undoLabel(): string | null {
    return this.undoSteps[this.undoSteps.length - 1]?.label ?? null;
  }

  /** Label of the next redo step. */
  get redoLabel(): string | null {
    return this.redoSteps[this.redoSteps.length - 1]?.label ?? null;
  }

  /** Ends merging, so the next change starts a new step. */
  seal(): void {
    this.lastKey = null;
  }

  clear(): void {
    this.undoSteps.length = 0;
    this.redoSteps.length = 0;
    this.lastKey = null;
  }
}
