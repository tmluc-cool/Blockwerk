import { defineComponent } from './defineComponent';
import type { FieldDefinitions } from './defineComponent';
import { inventoryOf, parseItems } from '../gameplay/inventory';

const fields = {
  startItems: {
    type: 'string',
    default: '',
    text: { de: 'Start-Gegenstände', en: 'Starting Items' },
  },
} as const satisfies FieldDefinitions;

/** Inventory (SPEC 8.13): what a player carries. Items are names, counts after a colon. */
export const inventory = defineComponent({
  type: 'inventory',
  category: 'gameplay',
  unique: true,
  unity: 'Inventory (custom component)',
  text: { de: 'Inventar', en: 'Inventory' },
  docs: {
    de: 'Das Inventar des Spielers: Gegenstände mit Namen und Anzahl. „Start-Gegenstände“ nimmt eine Liste wie „Schlüssel:1, Münze:5“. Die Blöcke „füge … zum Inventar hinzu“, „habe ich …?“ und „Anzahl“ arbeiten damit; Truhen, Aufhebbares und Dialoge legen hier ab. Auch ohne die Komponente bekommt ein Objekt beim ersten Gegenstand ein Inventar.',
    en: 'The player’s inventory: items with a name and a count. "Starting Items" takes a list like "Key:1, Coin:5". The blocks "add … to inventory", "do I have …?" and "count" work with it; chests, pickups and dialogs put things here. Even without the component an object gets an inventory with its first item.',
  },
  keywords: {
    de: ['rucksack', 'tasche', 'gegenstände', 'items'],
    en: ['bag', 'backpack', 'items', 'loot'],
  },
  fields,
  create({ object }, initial) {
    const items = inventoryOf(object);
    for (const [name, count] of parseItems(initial.startItems)) items.add(name, count);
    return {
      apply() {},
      destroy() {},
    };
  },
});
