import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const games = JSON.parse(readFileSync(join(root, 'scripts', 'site-games.json'), 'utf8'));
const page = readFileSync(join(root, 'docs', 'site', 'index.html'), 'utf8');

describe('GitHub Pages site (SPEC phase 11)', () => {
  it('only lists games whose project exists', () => {
    for (const game of games) {
      expect(existsSync(join(root, game.folder, 'blockwerk.json')), game.folder).toBe(true);
    }
  });

  it('has unique slugs and a title and description for every game', () => {
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length);
    for (const game of games) {
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.about.length).toBeGreaterThan(0);
    }
  });

  it('start page has the place for the game list, the editor link and the screenshot', () => {
    expect(page).toContain('<!-- games -->');
    expect(page).toContain('href="editor/"');
    const screenshot = /src="screenshots\/([^"]+)"/.exec(page)?.[1] ?? '';
    expect(existsSync(join(root, 'docs', 'screenshots', screenshot))).toBe(true);
  });

  it('start page works offline: no external scripts, fonts or images', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/(src|href)="https?:\/\/[^"]*\.(js|css|png|jpg|woff2?)"/i);
  });
});
