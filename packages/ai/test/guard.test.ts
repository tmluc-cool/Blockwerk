import { defaultRegistry } from '@blockwerk/blocks';
import { compileBlockScript } from '@blockwerk/compiler';
import type { ComponentData, SceneObjectData } from '@blockwerk/project';
import {
  Game,
  initNavigation,
  initPhysics,
  loadScriptModule,
  peekNpcState,
} from '@blockwerk/runtime';
import type { ScriptAsset } from '@blockwerk/runtime';
import { beforeAll, describe, expect, it } from 'vitest';
import { AiTransportError, runTask } from '../src';
import type { AiTransport, TaskInput } from '../src';
import { GUARD_ANSWER, scriptContext, seeded } from './fixtures';
import { smallLibrary } from './library';

beforeAll(async () => {
  await initPhysics();
  await initNavigation();
});

const component = (type: string, values: ComponentData['values'], id: string): ComponentData => ({
  id,
  type,
  enabled: true,
  values,
});
const object = (overrides: Partial<SceneObjectData>): SceneObjectData => ({
  name: 'Object',
  parent: null,
  order: 0,
  active: true,
  tag: 'Untagged',
  layer: 'Default',
  static: false,
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  components: [],
  ...overrides,
});

describe('the guard example of SPEC phase 10', () => {
  it('turns "guard the gate and chase the player when it sees him" into a script that works', async () => {
    // The model's answer (canned) goes through the whole pipeline: request, check, compile.
    const transport: AiTransport = {
      send: () =>
        Promise.resolve({
          content: [{ type: 'tool_use', id: 't1', name: 'propose_script', input: GUARD_ANSWER }],
        }),
    };
    const library = smallLibrary();
    const input: TaskInput = {
      task: 'logic',
      prompt: 'Wache soll das Tor bewachen und den Spieler verfolgen, wenn sie ihn sieht',
      locale: 'de',
      model: 'claude-sonnet-5-5',
      registry: defaultRegistry,
      facts: { projectName: 'T', sceneName: 'S', objects: [], scripts: [], tags: [], groundY: 0 },
      library,
      components: [],
      scriptContext: scriptContext(),
      worldContext: { library: new Map() },
      random: seeded(),
    };
    const result = await runTask(transport, input);
    expect(result.kind).toBe('script');
    if (result.kind !== 'script') return;

    // "After applying": compile what the editor would store and run it in a game.
    const compiled = compileBlockScript(result.check.workspace, {
      assetName: result.check.proposal.name,
      variables: result.check.variables,
    });
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const asset: ScriptAsset = {
      assetId: 'guardscript01',
      module: loadScriptModule(compiled.code, 'blockwerk://test/guard.js'),
      variables: result.check.variables,
      lineToBlock: compiled.lineToBlock,
      sourceUrl: 'blockwerk://test/guard.js',
    };
    const game = new Game(
      {
        formatVersion: 1,
        environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
        objects: {
          ground000001: object({
            name: 'Ground',
            transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [80, 1, 80] },
            components: [component('boxCollider', {}, 'groundcoll01')],
          }),
          gate00000001: object({
            name: 'Tor',
            transform: { position: [-10, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1] },
          }),
          guard0000001: object({
            name: 'Wache',
            tag: 'Enemy',
            transform: { position: [-10, 0, -8], rotation: [0, 0, 0], scale: [1, 1, 1] },
            components: [
              component('navAgent', { speed: 3 }, 'guardnav0001'),
              component('npc', { startState: 'idle' }, 'guardnpc0001'),
              component(
                'guard',
                { viewDistance: 20, viewAngle: 120, hearingRadius: 2, loseTime: 2 },
                'guardgrd0001',
              ),
              component('blockScript', { script: 'guardscript01' }, 'guardscr0001'),
            ],
          }),
          player000001: object({
            name: 'Spieler',
            tag: 'Player',
            transform: { position: [-10, 0, 4], rotation: [0, 0, 0], scale: [1, 1, 1] },
          }),
        },
      },
      { scripts: (id) => (id === 'guardscript01' ? asset : null), random: () => 0.5 },
    );
    const guard = game.world.getObject('guard0000001');
    const player = game.world.getObject('player000001');
    const gate = game.world.getObject('gate00000001');
    if (!guard || !player || !gate) throw new Error('missing objects');
    void peekNpcState;
    const distance = () => guard.position.distanceTo(player.position);
    const before = distance();
    for (let tick = 0; tick < 6 * 60; tick += 1) game.stepTick();
    // It saw the player straight ahead and walked up to him.
    expect(distance()).toBeLessThan(before - 5);
    expect(distance()).toBeLessThan(2.5);
    // The player leaves; out of sight the guard goes back to the gate.
    player.setPosition(35, 0, 35);
    for (let tick = 0; tick < 12 * 60; tick += 1) game.stepTick();
    expect(guard.position.distanceTo(gate.position)).toBeLessThan(3);
  });

  it('does nothing when the service says no', async () => {
    const transport: AiTransport = {
      send: () => Promise.reject(new AiTransportError('overloaded', 529)),
    };
    const result = await runTask(transport, {
      task: 'logic',
      prompt: 'x',
      locale: 'en',
      model: 'm',
      registry: defaultRegistry,
      facts: { projectName: 'T', sceneName: 'S', objects: [], scripts: [], tags: [], groundY: 0 },
      library: [],
      components: [],
      scriptContext: scriptContext(),
      worldContext: { library: new Map() },
    });
    expect(result).toEqual({ kind: 'failed', message: 'overloaded', status: 529 });
  });
});
