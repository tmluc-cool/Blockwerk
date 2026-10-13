import { buildToolbox, defaultRegistry, toBlocklyJson } from '@blockwerk/blocks';
import type { AreaKind, Locale, ToolboxJson } from '@blockwerk/blocks';
import * as Blockly from 'blockly/core';
import * as BlocklyDe from 'blockly/msg/de';
import * as BlocklyEn from 'blockly/msg/en';
import type { Theme } from '../state/settings';

const BLOCKLY_MESSAGES: Readonly<Record<Locale, Record<string, string>>> = {
  de: BlocklyDe as unknown as Record<string, string>,
  en: BlocklyEn as unknown as Record<string, string>,
};

/**
 * Switches Blockly's own texts and (re)defines all blocks from `packages/blocks` in the
 * given language. Existing workspaces must be reloaded afterwards to pick up the texts.
 */
export function defineBlocks(locale: Locale): void {
  Blockly.setLocale(BLOCKLY_MESSAGES[locale]);
  for (const definition of defaultRegistry.all()) {
    Reflect.deleteProperty(Blockly.Blocks, definition.id);
    Blockly.common.defineBlocksWithJsonArray([toBlocklyJson(definition, locale)]);
  }
}

/** The block palette for an area in a language. */
export function toolboxFor(locale: Locale, area: AreaKind | null): ToolboxJson {
  return buildToolbox(defaultRegistry, { locale, area });
}

const THEMES: Partial<Record<Theme, Blockly.Theme>> = {};

/** Blockly theme matching the editor theme. Blocks get Scratch-like hats on events. */
export function blocklyTheme(theme: Theme): Blockly.Theme {
  const existing = THEMES[theme];
  if (existing) return existing;
  const dark = theme === 'dark';
  const created = Blockly.Theme.defineTheme(`blockwerk-${theme}`, {
    name: `blockwerk-${theme}`,
    base: Blockly.Themes.Classic,
    startHats: true,
    componentStyles: {
      workspaceBackgroundColour: dark ? '#1f2126' : '#f4f5f7',
      toolboxBackgroundColour: dark ? '#26282e' : '#e9ebef',
      toolboxForegroundColour: dark ? '#d7dbe2' : '#23262b',
      flyoutBackgroundColour: dark ? '#2c2f36' : '#dde1e7',
      flyoutForegroundColour: dark ? '#d7dbe2' : '#23262b',
      flyoutOpacity: 0.96,
      scrollbarColour: dark ? '#5a5f6a' : '#a5abb5',
      scrollbarOpacity: 0.6,
      insertionMarkerColour: '#ffffff',
      insertionMarkerOpacity: 0.35,
      cursorColour: '#ffa133',
    },
    fontStyle: {
      family: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      weight: '600',
      size: 11,
    },
  });
  THEMES[theme] = created;
  return created;
}

/** Example script shown in the block editor until block-script assets exist (phase 1). */
export const DEMO_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'events.whenGameStarts',
        id: 'demo-start',
        x: 40,
        y: 40,
        next: {
          block: {
            type: 'motion.moveForward',
            id: 'demo-move',
            inputs: {
              meters: { shadow: { type: 'literal.number', id: 'demo-meters', fields: { NUM: 2 } } },
            },
          },
        },
      },
    ],
  },
} as const;
