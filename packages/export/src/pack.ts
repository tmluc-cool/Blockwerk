import type {
  BlockScriptData,
  DialogData,
  PrefabData,
  SceneData,
  UiData,
} from '@blockwerk/project';

/** Format version of `game/game.json`. A player refuses packs with a different version. */
export const GAME_PACK_VERSION = 1;
/** The manifest of a game pack, relative to the pack folder (`game/`). */
export const GAME_PACK_FILE = 'game.json';

/** A block script as the player runs it: compiled JavaScript, no Blockly, no compiler. */
export interface PackScript {
  readonly name: string;
  /** Function body that returns `{ scripts }` (see `loadScriptModule`). */
  readonly code: string;
  readonly variables: BlockScriptData['variables'];
}

/** A binary file of the pack (model, image, terrain, sound). */
export interface PackFile {
  /** Path relative to the pack folder. */
  readonly path: string;
  readonly type: 'model' | 'image' | 'terrain' | 'audio';
  /** How a model is placed (its import settings); only for models. */
  readonly model?: {
    readonly scale: number;
    readonly pivot: 'bottom' | 'center' | 'original';
    readonly yaw?: number;
    readonly boneMap?: Readonly<Record<string, string>>;
    readonly animationMap?: Readonly<Record<string, string>>;
  };
}

/** Everything a player needs to run a game (SPEC 9.3); written to `game/game.json`. */
export interface GamePack {
  readonly formatVersion: typeof GAME_PACK_VERSION;
  /** Name of the game (window title, name of the save slots). */
  readonly name: string;
  /** Asset ID of the scene the game starts in. */
  readonly startScene: string;
  readonly graphicsLevel?: 'low' | 'medium' | 'high' | 'ultra';
  readonly window: 'fullscreen' | 'windowed';
  /** Image asset (key of `files`) shown while the game loads, if any. */
  readonly splash?: string;
  /** Image asset (key of `files`) used as the app icon, if any. */
  readonly icon?: string;
  /** Physics layers and the layer matrix. */
  readonly layers: readonly string[];
  readonly ignoredCollisions: readonly (readonly [string, string])[];
  /** Scenes of the build, by asset ID; `order` is the build list. */
  readonly scenes: Readonly<Record<string, { readonly name: string; readonly data: SceneData }>>;
  readonly order: readonly string[];
  readonly prefabs: Readonly<Record<string, PrefabData>>;
  readonly dialogs: Readonly<Record<string, DialogData>>;
  readonly uis: Readonly<Record<string, UiData>>;
  readonly scripts: Readonly<Record<string, PackScript>>;
  /** IDs of the game variables that belong in a save. */
  readonly savedVariables: readonly string[];
  /** Binary assets by asset ID. */
  readonly files: Readonly<Record<string, PackFile>>;
  /** Library models by library ID (`kaykit-dungeon/barrel-large`) to their path in the pack. */
  readonly library: Readonly<Record<string, string>>;
}

/** The pack is damaged or from a different version. */
export class GamePackError extends Error {
  override readonly name = 'GamePackError';
}

/** Reads `game.json`; throws {@link GamePackError} if it is not a pack this player understands. */
export function parseGamePack(text: string): GamePack {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GamePackError('The game file is not valid JSON.');
  }
  if (typeof value !== 'object' || value === null) {
    throw new GamePackError('The game file is empty.');
  }
  const pack = value as Partial<GamePack>;
  if (pack.formatVersion !== GAME_PACK_VERSION) {
    throw new GamePackError(
      `The game was built for pack version ${String(pack.formatVersion)}, this player reads ${GAME_PACK_VERSION}.`,
    );
  }
  if (!pack.startScene || !pack.scenes || !(pack.startScene in pack.scenes)) {
    throw new GamePackError('The game has no start scene.');
  }
  return value as GamePack;
}
