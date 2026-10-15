import { describe, expect, it } from 'vitest';
import {
  collectThings,
  renameCustomBlock,
  renameMessage,
  renameTag,
  renameVariableIn,
  searchThings,
} from '../src/document/refactor';
import type { AssetView } from '../src/document/refactor';

const block = (type: string, id: string, rest: Record<string, unknown> = {}) => ({
  type,
  id,
  ...rest,
});

const lib: AssetView = {
  id: 'scriptlib001',
  type: 'blockScript',
  name: 'Bibliothek',
  data: {
    formatVersion: 1,
    variables: [
      {
        id: 'varscore0000',
        name: 'Punkte',
        type: 'number',
        scope: 'game',
        default: 0,
        inspector: false,
      },
    ],
    workspace: {
      blocks: {
        blocks: [
          block('custom.defineCommand', 'def-jump', {
            fields: { name: 'Hüpfen' },
            extraState: { params: [], scope: 'project' },
          }),
          block('events.whenMessage', 'm1', { fields: { message: 'start' } }),
        ],
      },
    },
  },
};

const user: AssetView = {
  id: 'scriptuser01',
  type: 'blockScript',
  name: 'Nutzer',
  data: {
    formatVersion: 1,
    variables: [
      {
        id: 'varscore0000',
        name: 'Punkte',
        type: 'number',
        scope: 'game',
        default: 0,
        inspector: false,
      },
    ],
    workspace: {
      blocks: {
        blocks: [
          block('events.whenGameStarts', 'h1', {
            next: {
              block: block('control.sendMessage', 'send1', {
                fields: { message: 'start', target: 'tag:Gegner' },
                next: {
                  block: block('custom.callCommand', 'call1', {
                    extraState: {
                      fn: 'def-jump',
                      library: 'scriptlib001',
                      name: 'Hüpfen',
                      params: [],
                    },
                    next: {
                      block: block('variables.set', 'set1', {
                        fields: { variable: { id: 'varscore0000' } },
                      }),
                    },
                  }),
                },
              }),
            },
          }),
        ],
      },
    },
  },
};

const scene: AssetView = {
  id: 'scenedorf001',
  type: 'scene',
  name: 'Dorf',
  data: {
    formatVersion: 1,
    objects: {
      zombie000001: {
        name: 'Zombie',
        tag: 'Gegner',
        transform: {},
        components: [
          { id: 'switchcmp001', type: 'switch', enabled: true, values: { message: 'start' } },
        ],
      },
    },
  },
};

const dialog: AssetView = {
  id: 'dialogmira01',
  type: 'dialog',
  name: 'Mira',
  data: {
    nodes: {
      a: {
        answers: [{ actions: [{ type: 'sendMessage', message: 'start' }] }],
      },
    },
  },
};

const assets = [lib, user, scene, dialog];

describe('things of a project', () => {
  const things = collectThings(assets);
  const find = (kind: string, name: string) =>
    things.find((thing) => thing.kind === kind && thing.name === name);

  it('a message is found in blocks, dialogs and component fields', () => {
    const start = find('message', 'start');
    expect(start?.usages.map((usage) => usage.assetName).sort()).toEqual([
      'Bibliothek',
      'Dorf',
      'Mira',
      'Nutzer',
    ]);
  });

  it('a game variable is one thing across scripts, with its uses', () => {
    const score = find('variable', 'Punkte');
    expect(score?.usages.map((usage) => usage.blockId)).toEqual(['set1']);
  });

  it('a custom block shows its definition and its calls, also from another script', () => {
    const jump = find('customBlock', 'Hüpfen');
    expect(jump?.usages.map((usage) => `${usage.assetName}:${usage.context}`).sort()).toEqual([
      'Bibliothek:definition',
      'Nutzer:custom.callCommand',
    ]);
  });

  it('a tag is used by objects and by blocks', () => {
    const tag = find('tag', 'Gegner');
    expect(tag?.usages.map((usage) => usage.assetName).sort()).toEqual(['Dorf', 'Nutzer']);
  });

  it('search finds things by part of the name without case', () => {
    expect(searchThings(things, 'pUnK').map((thing) => thing.name)).toEqual(['Punkte']);
    expect(searchThings(things, '')).toEqual([]);
    expect(searchThings(things, 'zomb', ['object']).map((thing) => thing.name)).toEqual(['Zombie']);
  });
});

describe('rename everywhere', () => {
  it('renames a message in every kind of asset and leaves the others alone', () => {
    const changes = renameMessage(assets, 'start', 'los');
    expect([...changes.keys()].sort()).toEqual([
      'dialogmira01',
      'scenedorf001',
      'scriptlib001',
      'scriptuser01',
    ]);
    const after = JSON.stringify([...changes.values()]);
    expect(after).not.toContain('"start"');
    expect(after.match(/"los"/g)).toHaveLength(4);
    expect(renameMessage(assets, 'gibtsnicht', 'x').size).toBe(0);
    expect(renameMessage(assets, 'start', 'start').size).toBe(0);
  });

  it('renames a tag on objects and in tag references', () => {
    const changes = renameTag(assets, 'Gegner', 'Feind');
    expect([...changes.keys()].sort()).toEqual(['scenedorf001', 'scriptuser01']);
    expect(JSON.stringify(changes.get('scenedorf001'))).toContain('"tag":"Feind"');
    expect(JSON.stringify(changes.get('scriptuser01'))).toContain('tag:Feind');
  });

  it('renames a custom block in its definition and in the copies kept by calls', () => {
    const changes = renameCustomBlock(assets, 'scriptlib001/def-jump', 'Springen');
    expect(JSON.stringify(changes.get('scriptlib001'))).toContain('"name":"Springen"');
    expect(JSON.stringify(changes.get('scriptuser01'))).toContain('"name":"Springen"');
    expect(JSON.stringify(changes.get('scriptuser01'))).not.toContain('Hüpfen');
  });

  it('renames an object variable in its script only', () => {
    const own: AssetView = {
      ...lib,
      data: {
        ...(lib.data as object),
        variables: [{ id: 'varspeed0000', name: 'Tempo', scope: 'object' }],
      },
    };
    const changes = renameVariableIn(own, 'varspeed0000', 'Speed');
    expect(JSON.stringify(changes.get('scriptlib001'))).toContain('"name":"Speed"');
    expect(renameVariableIn(own, 'varspeed0000', 'Tempo').size).toBe(0);
  });
});
