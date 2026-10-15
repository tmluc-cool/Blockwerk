import { DEFAULT_BINDINGS } from '../game/actions';
import type { ButtonAction, PlayerBindings } from '../game/actions';
import { isQualityName } from '../rendering/quality';
import type { QualityName } from '../rendering/quality';

/** What a player can set in the settings menu (SPEC 8.12). */
export interface SettingsValues {
  /** Volumes in percent. */
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  voicesVolume: number;
  /** Factor on the mouse look (1 = normal). */
  mouseSensitivity: number;
  fullscreen: boolean;
  /** `null` = the project's level. */
  graphicsLevel: QualityName | null;
  /** Keys per player and action (`KeyboardEvent.code` values); missing = the default. */
  bindings: { 1?: BindingOverrides; 2?: BindingOverrides };
}

/** Keys the player has changed. */
export type BindingOverrides = Partial<
  Record<ButtonAction | 'up' | 'down' | 'left' | 'right', string[]>
>;

/** The standard settings. */
export const DEFAULT_SETTINGS: Readonly<SettingsValues> = {
  masterVolume: 100,
  musicVolume: 70,
  effectsVolume: 100,
  voicesVolume: 100,
  mouseSensitivity: 1,
  fullscreen: false,
  graphicsLevel: null,
  bindings: {},
};

/** Where the settings are kept between games (browser: local storage). */
export interface SettingsStorage {
  load(): unknown;
  save(values: SettingsValues): void;
}

type Listener = (key: keyof SettingsValues) => void;

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

/** Cleans up stored data: unknown or wrong values fall back to the defaults. */
export function sanitizeSettings(raw: unknown): SettingsValues {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bindings: SettingsValues['bindings'] = {};
  const stored = source['bindings'];
  if (typeof stored === 'object' && stored !== null) {
    for (const player of [1, 2] as const) {
      const entry = (stored as Record<string, unknown>)[String(player)];
      if (typeof entry !== 'object' || entry === null) continue;
      const clean: BindingOverrides = {};
      for (const [action, codes] of Object.entries(entry)) {
        if (Array.isArray(codes) && codes.every((code) => typeof code === 'string')) {
          clean[action as keyof BindingOverrides] = codes as string[];
        }
      }
      bindings[player] = clean;
    }
  }
  const level = source['graphicsLevel'];
  return {
    masterVolume: clamp(source['masterVolume'], 0, 100, DEFAULT_SETTINGS.masterVolume),
    musicVolume: clamp(source['musicVolume'], 0, 100, DEFAULT_SETTINGS.musicVolume),
    effectsVolume: clamp(source['effectsVolume'], 0, 100, DEFAULT_SETTINGS.effectsVolume),
    voicesVolume: clamp(source['voicesVolume'], 0, 100, DEFAULT_SETTINGS.voicesVolume),
    mouseSensitivity: clamp(source['mouseSensitivity'], 0.2, 3, DEFAULT_SETTINGS.mouseSensitivity),
    fullscreen: source['fullscreen'] === true,
    graphicsLevel: typeof level === 'string' && isQualityName(level) ? level : null,
    bindings,
  };
}

/** The bindings of a player with the player's changes applied. */
export function bindingsFor(
  player: 1 | 2,
  overrides: BindingOverrides | undefined,
): PlayerBindings {
  const base = DEFAULT_BINDINGS[player];
  if (!overrides) return base;
  const buttons = { ...base.buttons };
  for (const action of Object.keys(buttons) as ButtonAction[]) {
    const codes = overrides[action];
    if (codes && codes.length > 0) buttons[action] = codes;
  }
  const direction = (name: 'up' | 'down' | 'left' | 'right'): readonly string[] => {
    const codes = overrides[name];
    return codes && codes.length > 0 ? codes : base[name];
  };
  return {
    ...base,
    up: direction('up'),
    down: direction('down'),
    left: direction('left'),
    right: direction('right'),
    buttons,
  };
}

/**
 * The player's settings. The host creates one (with its storage), hands it to the game and to the
 * UI; sliders and toggles change it, the game applies it to the sound, the quality and the input.
 */
export class GameSettings {
  private current: SettingsValues;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly storage?: SettingsStorage) {
    this.current = sanitizeSettings(storage?.load());
  }

  /** A copy of all values. */
  get values(): SettingsValues {
    return structuredClone(this.current);
  }

  /** One value. */
  get<K extends keyof SettingsValues>(key: K): SettingsValues[K] {
    return this.current[key];
  }

  /** Changes one value, stores all values and tells the listeners. */
  set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]): void {
    this.current = sanitizeSettings({ ...this.current, [key]: value });
    this.storage?.save(this.current);
    for (const listener of [...this.listeners]) listener(key);
  }

  /** Puts one key binding of a player (`codes` empty = back to the default). */
  setBinding(player: 1 | 2, action: keyof BindingOverrides, codes: readonly string[]): void {
    const bindings = structuredClone(this.current.bindings);
    const entry: BindingOverrides = { ...bindings[player] };
    entry[action] = codes.length === 0 ? undefined : [...codes];
    bindings[player] = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== undefined),
    ) as BindingOverrides;
    this.set('bindings', bindings);
  }

  /** Calls `listener` after every change; returns a function that removes it. */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
