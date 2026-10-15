import { compileProject } from '@blockwerk/compiler';
import { assetDependencies } from '@blockwerk/project';
import type { JsonValue } from '@blockwerk/project';
import { describe, expect, it } from 'vitest';

/**
 * A prefab that carries a block script which calls a project-wide custom block: moving the prefab
 * to another project (SPEC 6.4, section 3 row 7) must bring the script that defines the block.
 */
const LIBRARY = 'scriptlib001';
const SCRIPT = 'scriptuse001';
const PREFAB = 'prefabhero01';
const OTHER = 'scriptother1';

const files: Record<string, JsonValue> = {
  [PREFAB]: {
    formatVersion: 1,
    base: null,
    root: 'objroot000001',
    objects: {
      objroot000001: {
        name: 'Held',
        components: [
          { id: 'cmpscript0001', type: 'blockScript', enabled: true, values: { script: SCRIPT } },
        ],
      },
    },
  },
  [SCRIPT]: {
    formatVersion: 1,
    variables: [],
    workspace: {
      blocks: {
        blocks: [
          {
            type: 'events.whenGameStarts',
            id: 'hat',
            next: {
              block: {
                type: 'custom.callCommand',
                id: 'call',
                extraState: { fn: 'def-hop', library: LIBRARY, name: 'Hüpfen', params: [] },
              },
            },
          },
        ],
      },
    },
  },
  [LIBRARY]: {
    formatVersion: 1,
    variables: [],
    workspace: {
      blocks: {
        blocks: [
          {
            type: 'custom.defineCommand',
            id: 'def-hop',
            fields: { name: 'Hüpfen' },
            extraState: { params: [], scope: 'project' },
            next: {
              block: {
                type: 'control.wait',
                id: 'wait',
                inputs: {
                  seconds: { shadow: { type: 'literal.number', id: 'n', fields: { NUM: 1 } } },
                },
              },
            },
          },
        ],
      },
    },
  },
  // A script of the first project that has nothing to do with the prefab.
  [OTHER]: { formatVersion: 1, variables: [], workspace: { blocks: { blocks: [] } } },
};

describe('a prefab with a custom block moves to another project', () => {
  const needed = assetDependencies(
    PREFAB,
    (id) => files[id],
    (id) => id in files,
  );

  it('takes the script that defines the block with it, and nothing else', () => {
    expect(needed).toEqual([LIBRARY, PREFAB, SCRIPT].sort());
    expect(needed).not.toContain(OTHER);
  });

  it('the script compiles in the new project without a missing block', () => {
    const scripts = needed
      .filter((id) => id === LIBRARY || id === SCRIPT)
      .map((id) => {
        const data = files[id] as unknown as { variables: []; workspace: unknown };
        return { assetId: id, assetName: id, workspace: data.workspace, variables: data.variables };
      });
    const result = compileProject(scripts).get(SCRIPT);
    expect(result?.diagnostics).toEqual([]);
    expect(result?.code).toContain('// custom block: Hüpfen');
    expect(result?.code).toContain('game.wait(1)');
  });

  it('without the library script the call is reported, not silently dropped', () => {
    const data = files[SCRIPT] as unknown as { variables: []; workspace: unknown };
    const result = compileProject([
      { assetId: SCRIPT, assetName: 'Held', workspace: data.workspace, variables: data.variables },
    ]).get(SCRIPT);
    expect(result?.diagnostics.map((item) => item.code)).toEqual(['unknownFunction']);
  });
});
