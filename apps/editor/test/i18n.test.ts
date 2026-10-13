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

  it('fills in parameters', () => {
    expect(translate('de', 'area.newName', { n: 2 })).toBe('Neuer Bereich 2');
    expect(translate('en', 'area.newName', { n: 2 })).toBe('New Area 2');
    expect(translate('en', 'area.newName')).toBe('New Area {n}');
  });
});
