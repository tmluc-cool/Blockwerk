import { app, ipcMain, safeStorage } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Key and requests of the AI assistant (SPEC 9.4). The key is stored encrypted with the system's
 * `safeStorage` and never leaves this process: the page asks for a request and gets the answer,
 * and the only address ever contacted is the Anthropic Messages API. Without a key nothing is
 * sent anywhere. Where the system offers no encryption the key is kept for this session only.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Larger requests are refused (the prompts are about 60 KB). */
const MAX_BODY_BYTES = 3_000_000;

let sessionKey: string | null = null;

function keyFile(): string {
  return join(app.getPath('userData'), 'ai-key.bin');
}

async function readKey(): Promise<string | null> {
  if (sessionKey) return sessionKey;
  try {
    const data = await readFile(keyFile());
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : null;
  } catch {
    return null;
  }
}

/** The result of a request as the page receives it (errors are values, so their status survives). */
export type AiReply =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly status: number; readonly message: string };

/** Where the key ended up. */
export type KeyStorage = 'encrypted' | 'session';

/** Sends a request to the Messages API with the stored key. */
export async function sendRequest(request: unknown): Promise<AiReply> {
  const key = await readKey();
  if (!key) return { ok: false, status: 401, message: 'No API key is stored.' };
  const body = JSON.stringify(request);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    return { ok: false, status: 413, message: 'The request is too large.' };
  }
  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body,
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text.slice(0, 200);
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? message;
      } catch {
        // The body was not JSON; the beginning of it is the message.
      }
      return { ok: false, status: response.status, message: message || `HTTP ${response.status}` };
    }
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Registers the assistant's services (`window.blockwerkDesktop.ai`). */
export function registerAi(): void {
  ipcMain.handle('ai:hasKey', async () => (await readKey()) !== null);
  ipcMain.handle('ai:setKey', async (_event, key: unknown): Promise<KeyStorage> => {
    const trimmed = typeof key === 'string' ? key.trim() : '';
    if (trimmed === '' || trimmed.length > 500) throw new Error('The key is empty or too long.');
    if (safeStorage.isEncryptionAvailable()) {
      await mkdir(app.getPath('userData'), { recursive: true });
      await writeFile(keyFile(), safeStorage.encryptString(trimmed));
      sessionKey = null;
      return 'encrypted';
    }
    sessionKey = trimmed;
    return 'session';
  });
  ipcMain.handle('ai:clearKey', async () => {
    sessionKey = null;
    await rm(keyFile(), { force: true });
  });
  ipcMain.handle('ai:send', (_event, request: unknown) => sendRequest(request));
}
