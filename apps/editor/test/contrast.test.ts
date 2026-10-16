import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast of the theme colors (WCAG 2.1): normal text needs 4.5:1, large text and parts of the
 * interface 3:1. Reads the color tokens from `styles.css`, so a new color cannot slip in unchecked.
 */

const css = readFileSync(join(import.meta.dirname, '..', 'src', 'styles.css'), 'utf8');

/** The `--bw-*` color tokens of the theme block that starts with `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const result: Record<string, string> = {};
  for (const match of css.slice(open, close).matchAll(/--bw-([a-z-]+):\s*([^;]+);/g)) {
    result[match[1] ?? ''] = (match[2] ?? '').trim();
  }
  return result;
}

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const THEMES = {
  dark: tokens(":root,\n[data-theme='dark']"),
  light: tokens("[data-theme='light']"),
};

/** [foreground, background, minimum ratio, what it is] */
const PAIRS: readonly [string, string, number, string][] = [
  ['text', 'bg', 4.5, 'text on the window background'],
  ['text', 'chrome', 4.5, 'text on the menu bar'],
  ['text', 'panel', 4.5, 'text in windows'],
  ['text', 'panel-alt', 4.5, 'text on alternate rows'],
  ['text', 'header', 4.5, 'text in window headers'],
  ['text', 'input', 4.5, 'text in input fields'],
  ['text-dim', 'panel', 4.5, 'secondary text in windows'],
  ['text-dim', 'input', 4.5, 'secondary text and hints in input fields'],
  ['accent-text', 'accent', 4.5, 'text on the accent color'],
  ['selection-text', 'selection', 4.5, 'selected rows'],
  ['warning', 'panel', 3, 'warning text and icons'],
  ['error', 'panel', 3, 'error text and icons'],
  ['prefab', 'panel', 3, 'prefab names'],
  ['accent', 'panel', 3, 'the focus outline and active tabs'],
];

describe('theme contrast', () => {
  for (const [theme, colors] of Object.entries(THEMES)) {
    for (const [foreground, background, minimum, what] of PAIRS) {
      it(`${theme}: ${what} is at least ${minimum}:1`, () => {
        const fg = colors[foreground];
        const bg = colors[background];
        expect(fg, foreground).toMatch(/^#/);
        expect(bg, background).toMatch(/^#/);
        expect(contrast(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(minimum);
      });
    }
  }
});
