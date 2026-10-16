/** Machine-readable codes of problems the game or the scene check finds (texts live in the editor). */
export type ProblemCode =
  | 'emptyReference'
  | 'brokenAssetReference'
  | 'brokenObjectReference'
  | 'emptySlot'
  | 'messageWithoutReceiver'
  | 'npcOutsideNavigation'
  | 'npcWithoutNavigation'
  | 'playerWithoutCamera'
  | 'modelWithoutCollider'
  | 'figureWithoutAnimation'
  | 'noPathToTarget'
  | 'loopWithoutWaiting';

/** Where a click on a problem jumps to. */
export interface ProblemLink {
  readonly objectId?: string;
  readonly assetId?: string;
  readonly blockId?: string;
}

/** A problem: what is wrong (code and details), how bad it is, and where it is. */
export interface Problem {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: ProblemCode;
  /** Names and numbers for the message text. */
  readonly params: Readonly<Record<string, string>>;
  readonly link: ProblemLink;
}
