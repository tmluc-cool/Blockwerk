import { describe, expect, it } from 'vitest';
import { compileBlockScript } from '../src';
import { loadFixture } from './fixtures';

describe('debug hooks', () => {
  const { workspace } = loadFixture('debug.blocks.json');

  it('are left out of normal code', () => {
    const code = compileBlockScript(workspace, { assetName: 'debug' }).code;
    expect(code).not.toContain('debugHit');
  });

  it('come before every statement block and point at that block', () => {
    const result = compileBlockScript(workspace, { assetName: 'debug', debug: true });
    const lines = result.code.split('\n');
    const hooks = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes('game.debugHit('));
    expect(hooks.map(({ line }) => line.trim())).toEqual([
      'if (game.debugHit("dbg-2")) yield;',
      'if (game.debugHit("dbg-4")) yield;',
    ]);
    for (const { index } of hooks) {
      // The hook belongs to its block, and the block's own code follows right after it.
      expect(result.lineToBlock[index]).toBe(result.lineToBlock[index + 1]);
      expect(lines[index + 1]).toContain('game.writeLog(');
    }
    expect(result.diagnostics).toEqual([]);
  });
});
