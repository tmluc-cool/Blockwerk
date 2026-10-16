/**
 * @blockwerk/ai: the logic of the AI assistant (SPEC 9.4): catalogs for the prompt, the answer
 * formats, the validators that check every answer against the block catalog, the project and the
 * asset library, the repair loop and the transport to the Anthropic Messages API. No DOM, no
 * state; the editor shows previews and applies what the user confirms.
 */
export {
  blockCatalogText,
  componentCatalogText,
  libraryCatalogText,
  projectSummaryText,
} from './catalog';
export type { ComponentInfo, ProjectFacts } from './catalog';
export { checkScript, outlineScript, SCRIPT_LIMITS, scriptFromWorkspace } from './script';
export type {
  ScriptCheck,
  ScriptContext,
  ScriptNode,
  ScriptProposal,
  ScriptValue,
  ScriptVariable,
} from './script';
export { checkWorld, WORLD_LIMITS } from './world';
export type { WorldCheck, WorldContext, WorldObject, WorldProposal } from './world';
export { buildRequest, MAX_REPAIRS, runTask } from './session';
export type { AiTask, TaskInput, TaskResult } from './session';
export {
  AI_MODELS,
  AiTransportError,
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  DEFAULT_AI_MODEL,
  fetchTransport,
  transportErrorFrom,
} from './transport';
export type {
  AiTransport,
  ChatMessage,
  ContentBlock,
  MessagesRequest,
  MessagesResponse,
  ToolDefinition,
} from './transport';
