import type { BlockRegistry, Locale } from '@blockwerk/blocks';
import type { LibraryEntry } from '@blockwerk/library';
import {
  blockCatalogText,
  componentCatalogText,
  libraryCatalogText,
  projectSummaryText,
} from './catalog';
import type { ComponentInfo, ProjectFacts } from './catalog';
import { checkScript, outlineScript, scriptFromWorkspace } from './script';
import type { ScriptCheck, ScriptContext, ScriptNode } from './script';
import { AiTransportError } from './transport';
import type {
  AiTransport,
  ChatMessage,
  ContentBlock,
  MessagesRequest,
  ToolDefinition,
} from './transport';
import { checkWorld } from './world';
import type { WorldCheck, WorldContext } from './world';

/** What the assistant can be asked to do (SPEC 9.4). */
export type AiTask = 'logic' | 'world' | 'explain' | 'diagnose' | 'cleanup';

/** At most this many times an invalid answer goes back to the model (SPEC 9.4). */
export const MAX_REPAIRS = 2;

const SCRIPT_TOOL: ToolDefinition = {
  name: 'propose_script',
  description:
    'Propose a block script. Use only blocks from the catalog. Every stack starts with an event (hat) block.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Short name of the script, e.g. "Guard the gate".' },
      summary: { type: 'string', description: 'One or two sentences about what the script does.' },
      attachTo: {
        type: 'string',
        description:
          'ID of the object the script belongs on (from the object list). Leave out for the selected object.',
      },
      variables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string', enum: ['number', 'string', 'boolean'] },
            scope: { type: 'string', enum: ['object', 'game'] },
            default: {},
          },
          required: ['name', 'type'],
        },
      },
      stacks: {
        type: 'array',
        description: 'Each stack is a list of blocks, the first one an event (hat) block.',
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              block: { type: 'string', description: 'Block ID from the catalog.' },
              fields: {
                type: 'object',
                description:
                  'Values written on the block: dropdowns, numbers, texts, references, variable names.',
              },
              inputs: {
                type: 'object',
                description: 'Slots: a number, text, or another block object.',
              },
              bodies: {
                type: 'object',
                description: 'Bodies of C-shaped blocks: name -> list of blocks.',
              },
            },
            required: ['block'],
          },
        },
      },
    },
    required: ['name', 'stacks'],
  },
};

const WORLD_TOOL: ToolDefinition = {
  name: 'propose_world',
  description: 'Propose objects of the asset library to place in the scene.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'One or two sentences about what is placed.' },
      objects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            model: {
              type: 'string',
              description: 'Library ID <package>/<name> from the library list.',
            },
            name: { type: 'string' },
            position: {
              type: 'array',
              items: { type: 'number' },
              description: '[x, y, z] in meters; y is the ground level.',
            },
            rotationY: { type: 'number', description: 'Degrees around the vertical axis.' },
            scale: { type: 'number' },
            tag: { type: 'string' },
          },
          required: ['model', 'position'],
        },
      },
    },
    required: ['objects'],
  },
};

const ANSWER_TOOL: ToolDefinition = {
  name: 'answer',
  description: 'Answer in plain language.',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The answer, a few short paragraphs at most.' },
    },
    required: ['text'],
  },
};

/** What a task needs to run. */
export interface TaskInput {
  readonly task: AiTask;
  /** What the user typed. */
  readonly prompt: string;
  readonly locale: Locale;
  readonly model: string;
  readonly registry: BlockRegistry;
  readonly facts: ProjectFacts;
  readonly library: readonly LibraryEntry[];
  readonly components: readonly ComponentInfo[];
  readonly scriptContext: ScriptContext;
  readonly worldContext: WorldContext;
  /** The script the user has open (for explain, why-not and tidy up). */
  readonly selectedScript?: {
    readonly name: string;
    readonly workspace: unknown;
    readonly variables: readonly {
      readonly id: string;
      readonly name: string;
      readonly type: string;
      readonly scope: string;
    }[];
  };
  /** For "why does this not work": console lines, scene-check problems, variable values. */
  readonly diagnostics?: readonly string[];
  readonly random?: () => number;
  readonly signal?: AbortSignal;
}

/** The outcome of a task. Nothing has been changed yet: the editor shows it as a preview. */
export type TaskResult =
  | {
      readonly kind: 'script';
      readonly check: Extract<ScriptCheck, { ok: true }>;
      readonly outline: string[];
      readonly attempts: number;
    }
  | {
      readonly kind: 'world';
      readonly check: Extract<WorldCheck, { ok: true }>;
      readonly attempts: number;
    }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'invalid'; readonly errors: readonly string[]; readonly attempts: number }
  | { readonly kind: 'failed'; readonly message: string; readonly status: number };

function toolFor(task: AiTask): ToolDefinition {
  switch (task) {
    case 'logic':
    case 'cleanup':
      return SCRIPT_TOOL;
    case 'world':
      return WORLD_TOOL;
    default:
      return ANSWER_TOOL;
  }
}

const RULES = `You are the assistant of Blockwerk, a 3D game engine that works like Unity but whose logic is built from Scratch-like blocks.
You never change the project yourself: you answer through the tool you are given, and the user sees a preview and decides.
Rules:
- Use only blocks, fields and library models that are listed below. Never invent IDs.
- Coordinates: Y points up, 1 unit = 1 meter. Angles in degrees. Time in seconds.
- Blocks are the truth: build scripts from catalog blocks, never write code. Keep scripts short and readable.
- A script is a list of stacks; every stack starts with an event (hat) block; "bodies" hold the blocks inside C-shaped blocks.
- Fields (dropdowns, numbers, texts, references, variable names) go into "fields"; sockets (round and pointed slots) go into "inputs" as a literal or another value block.
- References: self, any, all, loop, mouse, origin, object:<id> (IDs from the object list), tag:<name>, prefab:<id>, dialog:<id>, scene:<id>, ui:<id>, builtin:<sound>, audio:<id>.
- Behavior blocks (npc.follow, npc.flee, npc.wander, npc.patrol, npc.goTo) start a behavior that keeps going: call them once when something happens (after a "wait until"), never in an every-frame script. A script that should react again waits for the next change with "wait until" inside "forever".
- Variables must be declared in "variables" (or already exist as game variables) before blocks use them.
- If an answer is rejected you get the list of errors: fix exactly those and answer again.`;

/** Builds the request for a task (and is what the tests look at). */
export function buildRequest(input: TaskInput): MessagesRequest {
  const language = input.locale === 'de' ? 'German' : 'English';
  const system: ContentBlock[] = [
    { type: 'text', text: `${RULES}\nWrite names, summaries and answers in ${language}.` },
    {
      type: 'text',
      text: `Block catalog (ID [shape -> output] label | fields):\n${blockCatalogText(input.registry, 'en')}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
  if (input.task === 'world') {
    system.push({
      type: 'text',
      text: libraryCatalogText(input.library, 'en'),
      cache_control: { type: 'ephemeral' },
    });
  }
  if (input.task === 'explain' || input.task === 'diagnose') {
    system.push({
      type: 'text',
      text: `Component types:\n${componentCatalogText(input.components)}`,
    });
  }
  const parts: string[] = [projectSummaryText(input.facts)];
  if (input.selectedScript) {
    const stacks = scriptFromWorkspace(
      input.selectedScript.workspace,
      input.registry,
      input.selectedScript.variables,
    );
    parts.push(
      `Open script "${input.selectedScript.name}" (variables: ${input.selectedScript.variables.map((variable) => `${variable.name} ${variable.scope} ${variable.type}`).join(', ') || 'none'}):\n${JSON.stringify(stacks)}`,
    );
  }
  if (input.diagnostics && input.diagnostics.length > 0) {
    parts.push(`What the editor knows:\n${input.diagnostics.join('\n')}`);
  }
  const task = {
    logic: 'Build block logic for this request.',
    world: 'Place library objects in the scene for this request.',
    explain: 'Explain the open script (or the selected object) in simple words.',
    diagnose: 'Find out why something does not work and say what to change.',
    cleanup:
      'Tidy up the open script: same behavior, clearer structure, better names. Answer with the full new script.',
  }[input.task];
  parts.push(`Task: ${task}\nRequest: ${input.prompt}`);
  const tool = toolFor(input.task);
  return {
    model: input.model,
    max_tokens: input.task === 'world' ? 8192 : 4096,
    system,
    messages: [{ role: 'user', content: parts.join('\n\n') }],
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
  };
}

function validate(task: AiTask, answer: unknown, input: TaskInput): TaskResult | string[] {
  if (task === 'logic' || task === 'cleanup') {
    const check = checkScript(answer, input.scriptContext, input.random);
    if (!check.ok) return [...check.errors];
    return {
      kind: 'script',
      check,
      outline: outlineScript(
        check.proposal.stacks as readonly (readonly ScriptNode[])[],
        input.registry,
        input.locale,
      ),
      attempts: 0,
    };
  }
  if (task === 'world') {
    const check = checkWorld(answer, input.worldContext);
    return check.ok ? { kind: 'world', check, attempts: 0 } : [...check.errors];
  }
  const text = (answer as { text?: unknown } | null)?.text;
  return typeof text === 'string' && text.trim() !== ''
    ? { kind: 'text', text: text.trim() }
    : ['"text" is missing'];
}

/**
 * Runs a task: asks the model, checks the answer, and sends an invalid answer back with the list of
 * errors, at most {@link MAX_REPAIRS} times (SPEC 9.4). Never throws: failures come back as a
 * result. Nothing is changed in the project.
 */
export async function runTask(transport: AiTransport, input: TaskInput): Promise<TaskResult> {
  const request = buildRequest(input);
  const messages: ChatMessage[] = [...request.messages];
  let errors: string[] = [];
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt += 1) {
    let response;
    try {
      response = await transport.send({ ...request, messages }, input.signal);
    } catch (error) {
      if (error instanceof AiTransportError) {
        return { kind: 'failed', message: error.message, status: error.status };
      }
      return {
        kind: 'failed',
        message: error instanceof Error ? error.message : String(error),
        status: 0,
      };
    }
    const call = response.content.find((block) => block.type === 'tool_use');
    if (!call || call.type !== 'tool_use') {
      errors = ['the answer did not call the tool'];
      messages.push({
        role: 'assistant',
        content:
          response.content.length > 0 ? response.content : [{ type: 'text', text: '(no answer)' }],
      });
      messages.push({
        role: 'user',
        content: `Your answer was rejected: ${errors.join('; ')}. Call the tool "${request.tool_choice.name}" with the answer.`,
      });
      continue;
    }
    const outcome = validate(input.task, call.input, input);
    if (!Array.isArray(outcome)) {
      return 'attempts' in outcome ? { ...outcome, attempts: attempt } : outcome;
    }
    errors = outcome;
    messages.push({ role: 'assistant', content: [call] });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: `Your answer was rejected. Errors:\n${errors.map((error) => `- ${error}`).join('\n')}\nFix these and call the tool again.`,
        },
      ],
    });
  }
  return { kind: 'invalid', errors, attempts: MAX_REPAIRS + 1 };
}
