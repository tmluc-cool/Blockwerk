import { defaultRegistry } from '@blockwerk/blocks';
import { describe, expect, it } from 'vitest';
import { AiTransportError, buildRequest, MAX_REPAIRS, runTask } from '../src';
import type {
  AiTransport,
  ContentBlock,
  MessagesRequest,
  MessagesResponse,
  ProjectFacts,
  TaskInput,
} from '../src';
import { GUARD_ANSWER, scriptContext, seeded } from './fixtures';
import { smallLibrary } from './library';

const facts: ProjectFacts = {
  projectName: 'Dorf',
  sceneName: 'Hauptszene',
  objects: [
    {
      id: 'guard0000001',
      name: 'Wache',
      tag: 'Enemy',
      position: [3, 0, 4],
      scale: [1, 1, 1],
      components: ['npc', 'navAgent'],
      scripts: [],
    },
    {
      id: 'gate00000001',
      name: 'Tor',
      tag: 'Untagged',
      position: [0, 0, 10],
      scale: [1, 1, 1],
      components: ['meshRenderer'],
      scripts: [],
    },
  ],
  scripts: [],
  tags: ['Enemy'],
  selectedObject: 'guard0000001',
  groundY: 0,
};

function input(task: TaskInput['task'], prompt: string, extra: Partial<TaskInput> = {}): TaskInput {
  const library = smallLibrary();
  return {
    task,
    prompt,
    locale: 'de',
    model: 'claude-sonnet-5-5',
    registry: defaultRegistry,
    facts,
    library,
    components: [{ type: 'npc', label: 'NPC', fields: ['startState: string'] }],
    scriptContext: scriptContext(),
    worldContext: { library: new Map(library.map((entry) => [entry.id, entry])) },
    random: seeded(),
    ...extra,
  };
}

/** A transport that answers from a list and remembers the requests. */
function fake(
  ...answers: (MessagesResponse | Error)[]
): AiTransport & { requests: MessagesRequest[] } {
  const requests: MessagesRequest[] = [];
  return {
    requests,
    async send(request) {
      // The messages array is shared and grows: keep a copy of what was sent.
      requests.push({ ...request, messages: [...request.messages] });
      const next = answers[Math.min(requests.length - 1, answers.length - 1)];
      if (!next) throw new Error('no answer prepared');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

const toolUse = (name: string, value: unknown, id = 'toolu_1'): MessagesResponse => ({
  content: [{ type: 'tool_use', id, name, input: value }],
  stop_reason: 'tool_use',
});

describe('buildRequest', () => {
  it('forces the tool of the task and puts the catalogs in cached system blocks', () => {
    const request = buildRequest(input('logic', 'Wache soll das Tor bewachen'));
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'propose_script' });
    expect(request.tools).toHaveLength(1);
    const system = request.system
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n');
    expect(system).toContain('events.everyFrame');
    expect(system).toContain('npc.follow');
    expect(system).toContain('Write names, summaries and answers in German');
    expect(request.system.some((block) => block.type === 'text' && block.cache_control)).toBe(true);
    // Code blocks and custom blocks are not offered at all.
    expect(system).not.toMatch(/^code\./m);
    expect(system).not.toContain('custom.');
    const user = request.messages[0]?.content;
    expect(typeof user === 'string' && user).toContain('guard0000001 | Wache');
    expect(typeof user === 'string' && user).toContain('Wache soll das Tor bewachen');
  });

  it('adds the library only for the world task', () => {
    const world = buildRequest(input('world', '5 Häuser'));
    expect(world.tool_choice.name).toBe('propose_world');
    expect(JSON.stringify(world.system)).toContain('town');
    expect(JSON.stringify(world.system)).toContain('house | House | buildings | 4 4 4');
    expect(JSON.stringify(buildRequest(input('logic', 'x')).system)).not.toContain('house | House');
  });

  it('gives explain and diagnose the component list and what the editor knows', () => {
    const request = buildRequest(
      input('diagnose', 'Warum läuft sie nicht?', {
        diagnostics: ['console: Wache findet keinen Weg'],
      }),
    );
    expect(request.tool_choice.name).toBe('answer');
    expect(JSON.stringify(request.system)).toContain('startState: string');
    expect(JSON.stringify(request.messages)).toContain('Wache findet keinen Weg');
  });

  it('sends the open script to tidy up as blocks', () => {
    const workspace = {
      blocks: {
        blocks: [
          {
            type: 'events.whenGameStarts',
            id: 'a',
            next: {
              block: {
                type: 'control.wait',
                id: 'b',
                inputs: {
                  seconds: { shadow: { type: 'literal.number', id: 'c', fields: { NUM: 2 } } },
                },
              },
            },
          },
        ],
      },
    };
    const request = buildRequest(
      input('cleanup', 'aufräumen', { selectedScript: { name: 'Alt', workspace, variables: [] } }),
    );
    expect(request.tool_choice.name).toBe('propose_script');
    const sent = request.messages[0]?.content;
    expect(typeof sent === 'string' && sent).toContain('"block":"control.wait"');
  });
});

describe('runTask', () => {
  it('returns a checked script with its outline when the first answer is valid', async () => {
    const transport = fake(toolUse('propose_script', GUARD_ANSWER));
    const result = await runTask(
      transport,
      input('logic', 'Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht'),
    );
    expect(result.kind).toBe('script');
    if (result.kind !== 'script') return;
    expect(result.attempts).toBe(0);
    expect(result.outline[0]).toBe('Wenn Spiel startet');
    expect(result.check.proposal.attachTo).toBe('guard0000001');
    expect(transport.requests).toHaveLength(1);
  });

  it('sends an invalid answer back with the errors and takes the repaired one', async () => {
    const broken = {
      ...GUARD_ANSWER,
      stacks: [[{ block: 'events.whenGameStarts' }, { block: 'npc.attack' }]],
    };
    const transport = fake(
      toolUse('propose_script', broken),
      toolUse('propose_script', GUARD_ANSWER, 'toolu_2'),
    );
    const result = await runTask(transport, input('logic', 'x'));
    expect(result.kind).toBe('script');
    if (result.kind === 'script') expect(result.attempts).toBe(1);
    expect(transport.requests).toHaveLength(2);
    const second = transport.requests[1]?.messages ?? [];
    expect(second).toHaveLength(3);
    const feedback = second[2]?.content as ContentBlock[];
    expect(feedback[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'toolu_1',
      is_error: true,
    });
    expect(JSON.stringify(feedback)).toContain('does not exist');
  });

  it('gives up after two repair attempts and says why', async () => {
    const broken = { name: 'x', stacks: [[{ block: 'motion.fly' }]] };
    const transport = fake(toolUse('propose_script', broken));
    const result = await runTask(transport, input('logic', 'x'));
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') {
      expect(result.attempts).toBe(MAX_REPAIRS + 1);
      expect(result.errors.join()).toMatch(/does not exist/);
    }
    // The first request and at most two repairs, nothing more.
    expect(transport.requests).toHaveLength(3);
  });

  it('treats an answer without a tool call as invalid and asks again', async () => {
    const transport = fake(
      { content: [{ type: 'text', text: 'Gern! Hier ist mein Vorschlag …' }] },
      toolUse('propose_script', GUARD_ANSWER),
    );
    const result = await runTask(transport, input('logic', 'x'));
    expect(result.kind).toBe('script');
    expect(JSON.stringify(transport.requests[1]?.messages)).toContain('did not call the tool');
  });

  it('survives every kind of broken answer', async () => {
    const answers: unknown[] = [
      null,
      'text',
      5,
      [],
      {},
      { name: 'x' },
      { name: 'x', stacks: 'no' },
      { stacks: [[{ block: null }]] },
    ];
    for (const answer of answers) {
      const transport = fake(toolUse('propose_script', answer));
      const result = await runTask(transport, input('logic', 'x'));
      expect(result.kind).toBe('invalid');
      expect(transport.requests).toHaveLength(3);
    }
  });

  it('checks a world answer against the library', async () => {
    const good = {
      summary: 'Fünf Häuser',
      objects: [
        { model: 'town/house', position: [0, 0, 10] },
        { model: 'town/well', position: [0, 0, 0] },
      ],
    };
    const ok = await runTask(fake(toolUse('propose_world', good)), input('world', 'x'));
    expect(ok.kind).toBe('world');
    const bad = await runTask(
      fake(toolUse('propose_world', { objects: [{ model: 'moon/base', position: [0, 0, 0] }] })),
      input('world', 'x'),
    );
    expect(bad.kind).toBe('invalid');
  });

  it('returns plain answers for explain and diagnose, and refuses empty ones', async () => {
    const text = await runTask(
      fake(toolUse('answer', { text: ' Die Wache folgt dir. ' })),
      input('explain', 'x'),
    );
    expect(text).toEqual({ kind: 'text', text: 'Die Wache folgt dir.' });
    const empty = await runTask(fake(toolUse('answer', { text: '  ' })), input('diagnose', 'x'));
    expect(empty.kind).toBe('invalid');
  });

  it('reports a failing service instead of throwing', async () => {
    const result = await runTask(
      fake(new AiTransportError('invalid x-api-key', 401)),
      input('logic', 'x'),
    );
    expect(result).toEqual({ kind: 'failed', message: 'invalid x-api-key', status: 401 });
    const offline = await runTask(fake(new Error('network down')), input('logic', 'x'));
    expect(offline).toMatchObject({ kind: 'failed', status: 0 });
  });
});
