import { describe, expect, it } from 'vitest';
import { buildChangelog, parseCommit } from './changelog.mjs';

describe('parseCommit', () => {
  it('reads type, scope and text', () => {
    expect(parseCommit('feat(runtime): add third-person camera')).toEqual({
      type: 'feat',
      scope: 'runtime',
      breaking: false,
      text: 'add third-person camera',
    });
  });

  it('knows a breaking change by the exclamation mark', () => {
    expect(parseCommit('feat(project)!: new file format').breaking).toBe(true);
  });

  it('files a message without a type under chore', () => {
    expect(parseCommit('Update readme').type).toBe('chore');
  });
});

describe('buildChangelog', () => {
  const subjects = [
    'fix(editor): the hierarchy keeps its scroll position',
    'feat(export): game pack builder',
    'Merge pull request #22 from tmluc-cool/phase/08-kaputt',
    'docs: plan for phase 9',
    'feat(editor)!: replace the old layout file',
  ];

  it('groups by type, features first, and lists breaking changes on top', () => {
    const text = buildChangelog(subjects, 'v0.9.0');
    expect(text.startsWith('## v0.9.0')).toBe(true);
    expect(text.indexOf('### Breaking changes')).toBeLessThan(text.indexOf('### Features'));
    expect(text.indexOf('### Features')).toBeLessThan(text.indexOf('### Fixes'));
    expect(text).toContain('- **export:** game pack builder');
    expect(text).toContain('- **editor:** the hierarchy keeps its scroll position');
    expect(text).toContain('### Documentation');
  });

  it('leaves merge commits out', () => {
    expect(buildChangelog(subjects, 'v0.9.0')).not.toContain('Merge pull request');
  });

  it('says so when nothing changed', () => {
    expect(buildChangelog([], 'v0.9.1')).toContain('No changes recorded.');
  });
});
