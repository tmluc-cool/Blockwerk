import { AI_MODELS, AiTransportError, DEFAULT_AI_MODEL, fetchTransport } from '@blockwerk/ai';
import type { AiTransport, MessagesResponse } from '@blockwerk/ai';
import { create } from 'zustand';
import '../storage/desktopApi';

const KEY_STORAGE = 'blockwerk.ai.key';
const MODEL_STORAGE = 'blockwerk.ai.model';

/** Where the key is kept: encrypted by the desktop app, for this session only, or in the browser. */
export type KeyPlace = 'encrypted' | 'session' | 'browser';

interface AiSettingsState {
  /** Whether a key is stored: only then the assistant exists in the editor. */
  readonly hasKey: boolean;
  readonly keyPlace: KeyPlace | null;
  readonly model: string;
}

function readStored(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function writeStored(name: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(name);
    else localStorage.setItem(name, value);
  } catch {
    // Storage may be blocked; the setting then lasts until the editor closes.
  }
}

const desktop = (): NonNullable<Window['blockwerkDesktop']>['ai'] => window.blockwerkDesktop?.ai;

/** The assistant's settings: the key (never shown again) and the model. */
export const useAiSettings = create<AiSettingsState>()(() => ({
  hasKey: !window.blockwerkDesktop?.ai && readStored(KEY_STORAGE) !== null,
  keyPlace: !window.blockwerkDesktop?.ai && readStored(KEY_STORAGE) !== null ? 'browser' : null,
  model: readStored(MODEL_STORAGE) ?? DEFAULT_AI_MODEL,
}));

// The desktop app keeps the key in its main process: ask it once whether there is one.
void desktop()
  ?.hasKey()
  .then((hasKey) => useAiSettings.setState({ hasKey, keyPlace: hasKey ? 'encrypted' : null }))
  .catch(() => undefined);

/** Stores the key (SPEC 9.4: local; in the desktop app encrypted). */
export async function saveAiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (trimmed === '') return;
  const api = desktop();
  if (api) {
    const place = await api.setKey(trimmed);
    useAiSettings.setState({ hasKey: true, keyPlace: place });
    return;
  }
  writeStored(KEY_STORAGE, trimmed);
  useAiSettings.setState({ hasKey: true, keyPlace: 'browser' });
}

/** Removes the key: the assistant disappears from the editor. */
export async function removeAiKey(): Promise<void> {
  await desktop()?.clearKey();
  writeStored(KEY_STORAGE, null);
  useAiSettings.setState({ hasKey: false, keyPlace: null });
}

/** Chooses the model (any model ID). */
export function setAiModel(model: string): void {
  const trimmed = model.trim() || DEFAULT_AI_MODEL;
  writeStored(MODEL_STORAGE, trimmed === DEFAULT_AI_MODEL ? null : trimmed);
  useAiSettings.setState({ model: trimmed });
}

/** Models the settings offer. */
export const OFFERED_MODELS: readonly string[] = AI_MODELS;

/**
 * The way to the model, or `null` without a key. In the desktop app the main process makes the
 * request with the key it holds; in a browser the page sends it directly.
 */
export function currentAiTransport(): AiTransport | null {
  if (!useAiSettings.getState().hasKey) return null;
  const api = desktop();
  if (api) {
    return {
      async send(request) {
        const reply = await api.send(request);
        if (!reply.ok) throw new AiTransportError(reply.message, reply.status);
        return reply.body as MessagesResponse;
      },
    };
  }
  const key = readStored(KEY_STORAGE);
  return key ? fetchTransport({ apiKey: key, browser: true }) : null;
}
