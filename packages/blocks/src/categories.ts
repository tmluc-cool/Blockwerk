import type { AreaKind, CategoryId, LocalizedText } from './types';

/** A palette category with its color and label. */
export interface CategoryDefinition {
  readonly id: CategoryId;
  readonly name: LocalizedText;
  /** Block color as hex string. */
  readonly color: string;
}

/** All categories in their default palette order. */
export const CATEGORIES: readonly CategoryDefinition[] = [
  { id: 'events', name: { de: 'Ereignisse', en: 'Events' }, color: '#e0a526' },
  { id: 'motion', name: { de: 'Bewegung', en: 'Motion' }, color: '#3f7fe0' },
  { id: 'looks', name: { de: 'Aussehen', en: 'Looks' }, color: '#8a63d2' },
  { id: 'sound', name: { de: 'Klang', en: 'Sound' }, color: '#c84fa4' },
  { id: 'control', name: { de: 'Steuerung', en: 'Control' }, color: '#e07b2e' },
  { id: 'sensing', name: { de: 'Fühlen', en: 'Sensing' }, color: '#2fa6c9' },
  { id: 'operators', name: { de: 'Operatoren', en: 'Operators' }, color: '#45a85a' },
  { id: 'variables', name: { de: 'Variablen', en: 'Variables' }, color: '#e8663c' },
  { id: 'player', name: { de: 'Spieler', en: 'Player' }, color: '#22968a' },
  { id: 'camera', name: { de: 'Kamera', en: 'Camera' }, color: '#5266c9' },
  { id: 'character', name: { de: 'Figur', en: 'Character' }, color: '#b4508f' },
  { id: 'physics', name: { de: 'Physik', en: 'Physics' }, color: '#8c7a4b' },
  { id: 'npc', name: { de: 'NPC und KI', en: 'NPC and AI' }, color: '#b0533b' },
  { id: 'environment', name: { de: 'Umgebung', en: 'Environment' }, color: '#57953a' },
  { id: 'items', name: { de: 'Gegenstände', en: 'Items' }, color: '#bf8a24' },
  { id: 'effects', name: { de: 'Effekte', en: 'Effects' }, color: '#d9566f' },
  { id: 'ui', name: { de: 'UI', en: 'UI' }, color: '#5f7186' },
  { id: 'scenes', name: { de: 'Szenen und Speichern', en: 'Scenes and Saving' }, color: '#7a58a3' },
  {
    id: 'data',
    name: { de: 'Listen und Wörterbücher', en: 'Lists and Dictionaries' },
    color: '#d9532b',
  },
  { id: 'code', name: { de: 'Code', en: 'Code' }, color: '#5a6b78' },
  { id: 'myBlocks', name: { de: 'Meine Blöcke', en: 'My Blocks' }, color: '#d64b4b' },
  { id: 'debug', name: { de: 'Debug', en: 'Debug' }, color: '#7d7d7d' },
];

/** Categories shown first in the palette of each area (SPEC 5.3). */
export const AREA_CATEGORIES: Readonly<Record<AreaKind, readonly CategoryId[]>> = {
  environment: ['environment', 'sound'],
  player: ['player', 'character', 'motion', 'camera', 'looks'],
  npc: ['npc', 'character', 'motion', 'looks'],
  items: ['items', 'physics'],
  ui: ['ui', 'scenes'],
};

/** Looks up a category definition. */
export function getCategory(id: CategoryId): CategoryDefinition {
  const category = CATEGORIES.find((candidate) => candidate.id === id);
  if (!category) throw new Error(`Unknown category "${id}".`);
  return category;
}
