/** A block of a message in the Anthropic Messages API (the parts this assistant uses). */
export type ContentBlock =
  | {
      readonly type: 'text';
      readonly text: string;
      readonly cache_control?: { readonly type: 'ephemeral' };
    }
  | {
      readonly type: 'tool_use';
      readonly id: string;
      readonly name: string;
      readonly input: unknown;
    }
  | {
      readonly type: 'tool_result';
      readonly tool_use_id: string;
      readonly content: string;
      readonly is_error?: boolean;
    };

/** A message of the conversation. */
export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string | readonly ContentBlock[];
}

/** A tool the model must call to answer (its input is the structured answer). */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Readonly<Record<string, unknown>>;
}

/** A request to the Messages API. */
export interface MessagesRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly system: readonly ContentBlock[];
  readonly messages: readonly ChatMessage[];
  readonly tools: readonly ToolDefinition[];
  readonly tool_choice: { readonly type: 'tool'; readonly name: string };
}

/** The part of a Messages API response this assistant reads. */
export interface MessagesResponse {
  readonly content: readonly ContentBlock[];
  readonly stop_reason?: string | null;
}

/** The request could not be made or the service refused it. */
export class AiTransportError extends Error {
  override readonly name = 'AiTransportError';
  constructor(
    message: string,
    /** HTTP status, `0` if the service could not be reached. */
    readonly status: number,
  ) {
    super(message);
  }
}

/** Sends a request to the model. The editor, the desktop app and the tests each bring their own. */
export interface AiTransport {
  send(request: MessagesRequest, signal?: AbortSignal): Promise<MessagesResponse>;
}

/** The one address the assistant ever talks to. */
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
/** The API version header. */
export const ANTHROPIC_VERSION = '2023-06-01';

/** Models offered in the settings; the first is the default. Any other model ID can be typed. */
export const AI_MODELS = [
  'claude-sonnet-5-5',
  'claude-opus-5-5',
  'claude-fable-5-1',
  'claude-haiku-5-5',
] as const;
/** The default model. */
export const DEFAULT_AI_MODEL: string = AI_MODELS[0];

/** Reads a failed response into an error with a message the user can act on. */
export function transportErrorFrom(status: number, body: string): AiTransportError {
  let detail: string;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message ?? '';
  } catch {
    detail = body.slice(0, 200);
  }
  return new AiTransportError(detail || `HTTP ${status}`, status);
}

/**
 * Transport over `fetch` (a browser, or Node in the tests of the live check). `browser` adds the
 * header the API wants for direct calls from a web page. Never logs the key.
 */
export function fetchTransport(options: {
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
  readonly browser?: boolean;
}): AiTransport {
  const doFetch = options.fetch ?? fetch;
  return {
    async send(request, signal) {
      let response: Response;
      try {
        response = await doFetch(ANTHROPIC_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            ...(options.browser ? { 'anthropic-dangerous-direct-browser-access': 'true' } : {}),
          },
          body: JSON.stringify(request),
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        throw new AiTransportError(error instanceof Error ? error.message : String(error), 0);
      }
      const body = await response.text();
      if (!response.ok) throw transportErrorFrom(response.status, body);
      return JSON.parse(body) as MessagesResponse;
    },
  };
}
