import { UI_TEMPLATE_LABELS } from '@blockwerk/project';
import { BUILTIN_SOUNDS, COMPONENTS, UI_STRING_KEYS } from '@blockwerk/runtime';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translate } from '../src/i18n';

const placeholders = (text: string): string[] =>
  Array.from(text.matchAll(/\{(\w+)\}/g), (m) => m[1] ?? '').sort();

describe('i18n', () => {
  it('has the same keys in German and English', () => {
    expect(Object.keys(DICTIONARIES.de).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
  });

  it('has no empty texts', () => {
    for (const dictionary of Object.values(DICTIONARIES)) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), key).not.toBe('');
      }
    }
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(DICTIONARIES.en) as (keyof typeof DICTIONARIES.en)[]) {
      expect(placeholders(DICTIONARIES.de[key]), key).toEqual(placeholders(DICTIONARIES.en[key]));
    }
  });

  it('translates every inspector group of every component and every built-in sound', () => {
    const groups = new Set(
      COMPONENTS.flatMap((definition) =>
        Object.values(definition.fields).flatMap((field) => (field.group ? [field.group] : [])),
      ),
    );
    for (const group of groups)
      expect(DICTIONARIES.en, group).toHaveProperty(`component.group.${group}`);
    for (const name of BUILTIN_SOUNDS)
      expect(DICTIONARIES.en, name).toHaveProperty(`sound.builtin.${name}`);
  });

  it('translates every text of the runtime UI layer and of the menu templates', () => {
    for (const key of UI_STRING_KEYS) expect(DICTIONARIES.en, key).toHaveProperty(`ui.${key}`);
    for (const key of UI_TEMPLATE_LABELS)
      expect(DICTIONARIES.en, key).toHaveProperty(`uiTemplate.${key}`);
  });

  it('fills in parameters', () => {
    expect(translate('de', 'area.newName', { n: 2 })).toBe('Neuer Bereich 2');
    expect(translate('en', 'area.newName', { n: 2 })).toBe('New Area 2');
    expect(translate('en', 'area.newName')).toBe('New Area {n}');
  });
});
