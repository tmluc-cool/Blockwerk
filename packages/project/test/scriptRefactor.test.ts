import { describe, expect, it } from 'vitest';
import {
  blockScriptSchema,
  renameGameVariable,
  sharedGameVariables,
  updateGameVariable,
  adoptGameVariable,
} from '../src';
import type { BlockScriptData, ScriptRef, VariableData } from '../src';

const score: VariableData = {
  id: 'varscore0000',
  name: 'Punkte',
  type: 'number',
  scope: 'game',
  default: 0,
  inspector: false,
};
const speed: VariableData = {
  id: 'varspeed0000',
  name: 'Tempo',
  type: 'number',
  scope: 'object',
  default: 1,
  inspector: true,
};

function script(id: string, variables: VariableData[]): ScriptRef {
  return { id, data: { formatVersion: 1, variables, workspace: {} } };
}

describe('variable types', () => {
  it('lists and dictionaries are valid variable types with JSON start values', () => {
    const data: BlockScriptData = {
      formatVersion: 1,
      variables: [
        { ...score, id: 'varlistxxxxx', name: 'Liste', type: 'list', default: [1, 'a'] },
        { ...score, id: 'vardictxxxxx', name: 'Karte', type: 'dictionary', default: { a: 1 } },
      ],
      workspace: {},
    };
    expect(blockScriptSchema.parse(data)).toEqual(data);
  });
});

describe('shared game variables', () => {
  const scripts = [
    script('scriptaaaaaa', [score, speed]),
    script('scriptbbbbbb', [score]),
    script('scriptcccccc', []),
  ];

  it('lists each game variable once with the scripts that declare it', () => {
    expect(sharedGameVariables(scripts)).toEqual([
      { variable: score, scripts: ['scriptaaaaaa', 'scriptbbbbbb'] },
    ]);
  });

  it('renaming changes every declaration and leaves object variables alone', () => {
    const changed = renameGameVariable(scripts, score.id, 'Münzen');
    expect([...changed.keys()]).toEqual(['scriptaaaaaa', 'scriptbbbbbb']);
    expect(changed.get('scriptaaaaaa')?.variables.map((variable) => variable.name)).toEqual([
      'Münzen',
      'Tempo',
    ]);
    expect(renameGameVariable(scripts, speed.id, 'x').size).toBe(0);
    expect(renameGameVariable(scripts, score.id, 'Punkte').size).toBe(0);
  });

  it('type, start value and the saved flag reach every declaration', () => {
    const changed = updateGameVariable(scripts, score.id, { saved: true, default: 5 });
    for (const data of changed.values()) {
      expect(data.variables.find((variable) => variable.id === score.id)).toMatchObject({
        saved: true,
        default: 5,
      });
    }
  });

  it('a script can use a game variable of another script once', () => {
    const empty = scripts[2]?.data;
    if (!empty) throw new Error('missing script');
    const used = adoptGameVariable(empty, score);
    expect(used?.variables).toEqual([score]);
    expect(used && adoptGameVariable(used, score)).toBeNull();
  });
});
