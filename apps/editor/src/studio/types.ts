import type { SceneObjectData } from '@blockwerk/project';
import type { AnimatorHandle, FigureInfo } from '@blockwerk/runtime';
import type { StageViewport } from './StudioStage';

/** What every section of the Character Studio gets to work with. */
export interface SectionProps {
  /** ID of the edited figure. */
  readonly id: string;
  readonly object: SceneObjectData;
  /** What the preview knows about the loaded model (`null` while it loads). */
  readonly info: FigureInfo | null;
  readonly animator: AnimatorHandle | null;
  readonly stage: StageViewport | null;
}
