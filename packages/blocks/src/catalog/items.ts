import { defineBlock } from '../defineBlock';

export const whenThing = defineBlock({
  id: 'items.whenThing',
  category: 'items',
  shape: 'hat',
  inputs: {
    what: {
      type: 'dropdown',
      default: 'used',
      options: [
        { value: 'used', text: { de: 'benutzt wird', en: 'is used' } },
        { value: 'picked', text: { de: 'aufgehoben wird', en: 'is picked up' } },
        { value: 'opened', text: { de: 'geöffnet wird', en: 'is opened' } },
        { value: 'closed', text: { de: 'geschlossen wird', en: 'is closed' } },
        { value: 'locked', text: { de: 'verschlossen ist', en: 'is locked' } },
        { value: 'switchedOn', text: { de: 'eingeschaltet wird', en: 'is switched on' } },
        { value: 'switchedOff', text: { de: 'ausgeschaltet wird', en: 'is switched off' } },
      ],
    },
  },
  text: { de: 'Wenn ich {what}', en: 'when I am {what}' },
  keywords: {
    de: ['benutzt', 'truhe', 'tür', 'schalter', 'aufheben'],
    en: ['used', 'chest', 'door', 'switch', 'pickup', 'interact'],
  },
  areas: ['items'],
  event: ({ what }) => ({ type: 'thing', params: { what } }),
  docs: {
    de: 'Startet das Skript, wenn mit dem Objekt etwas passiert: Spieler benutzt es, hebt es auf, öffnet oder schließt es (Pickup-, Tür-, Truhen- und Schalter-Komponenten).',
    en: 'Runs the script when something happens to the object: a player uses it, picks it up, opens or closes it (Pickup, Door, Chest and Switch components).',
  },
  since: 5,
});

export const whenHealth = defineBlock({
  id: 'items.whenHealth',
  category: 'items',
  shape: 'hat',
  inputs: {
    phase: {
      type: 'dropdown',
      default: 'hurt',
      options: [
        { value: 'hurt', text: { de: 'verletzt werde', en: 'am hurt' } },
        { value: 'died', text: { de: 'sterbe', en: 'die' } },
      ],
    },
  },
  text: { de: 'Wenn ich {phase}', en: 'when I {phase}' },
  keywords: { de: ['leben', 'schaden', 'tod'], en: ['health', 'damage', 'death', 'hurt'] },
  areas: ['items'],
  event: ({ phase }) => ({ type: 'health', params: { phase } }),
  docs: {
    de: 'Startet das Skript, wenn das Objekt Schaden nimmt oder seine Lebenspunkte auf 0 fallen (Health-Komponente).',
    en: 'Runs the script when the object takes damage or its hit points fall to 0 (Health component).',
  },
  since: 5,
});

export const addItem = defineBlock({
  id: 'items.add',
  category: 'items',
  shape: 'stack',
  inputs: {
    count: { type: 'number', default: 1 },
    item: { type: 'textField', default: 'key' },
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
  },
  text: { de: 'gib {count} × {item} an {target}', en: 'give {count} × {item} to {target}' },
  keywords: {
    de: ['gegenstand', 'inventar', 'schlüssel'],
    en: ['item', 'inventory', 'give', 'key'],
  },
  areas: ['items'],
  compile: ({ count, item, target }) => `game.addItem(self, ${target}, ${item}, ${count});`,
  docs: {
    de: 'Legt Gegenstände ins Inventar eines Objekts (es bekommt eine Inventar-Komponente, falls es keine hat).',
    en: "Puts items into an object's inventory (it gets an Inventory component if it has none).",
  },
  since: 5,
});

export const removeItem = defineBlock({
  id: 'items.remove',
  category: 'items',
  shape: 'stack',
  inputs: {
    count: { type: 'number', default: 1 },
    item: { type: 'textField', default: 'key' },
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
  },
  text: { de: 'nimm {count} × {item} von {target}', en: 'take {count} × {item} from {target}' },
  keywords: { de: ['entfernen', 'abgeben', 'inventar'], en: ['remove', 'take', 'inventory'] },
  areas: ['items'],
  compile: ({ count, item, target }) => `game.removeItem(self, ${target}, ${item}, ${count});`,
  docs: {
    de: 'Nimmt Gegenstände aus dem Inventar. Sind nicht genug da, passiert nichts.',
    en: 'Takes items from the inventory. If there are not enough, nothing happens.',
  },
  since: 5,
});

export const hasItem = defineBlock({
  id: 'items.has',
  category: 'items',
  shape: 'boolean',
  output: 'boolean',
  inputs: {
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
    item: { type: 'textField', default: 'key' },
  },
  text: { de: '{target} hat {item}?', en: '{target} has {item}?' },
  keywords: { de: ['besitzt', 'inventar'], en: ['owns', 'inventory', 'carry'] },
  areas: ['items'],
  compile: ({ target, item }) => `game.hasItem(self, ${target}, ${item})`,
  docs: {
    de: 'Wahr, wenn das Objekt mindestens einen davon im Inventar hat.',
    en: 'True if the object has at least one of them in its inventory.',
  },
  since: 5,
});

export const countItem = defineBlock({
  id: 'items.count',
  category: 'items',
  shape: 'reporter',
  output: 'number',
  inputs: {
    item: { type: 'textField', default: 'coin' },
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
  },
  text: { de: 'Anzahl {item} bei {target}', en: 'count of {item} on {target}' },
  keywords: { de: ['anzahl', 'münzen', 'inventar'], en: ['count', 'coins', 'inventory', 'amount'] },
  areas: ['items'],
  compile: ({ item, target }) => `game.itemCount(self, ${target}, ${item})`,
  docs: {
    de: 'Wie viele dieser Gegenstände das Objekt im Inventar hat.',
    en: 'How many of this item the object has in its inventory.',
  },
  since: 5,
});

export const setDoor = defineBlock({
  id: 'items.operate',
  category: 'items',
  shape: 'stack',
  inputs: {
    action: {
      type: 'dropdown',
      default: 'open',
      options: [
        { value: 'open', text: { de: 'öffne', en: 'open' } },
        { value: 'close', text: { de: 'schließe', en: 'close' } },
        { value: 'toggle', text: { de: 'wechsle', en: 'toggle' } },
      ],
    },
    target: { type: 'reference', source: 'object', default: 'self' },
  },
  text: { de: '{action} {target}', en: '{action} {target}' },
  keywords: { de: ['tür', 'tor', 'truhe', 'schalter'], en: ['door', 'gate', 'chest', 'switch'] },
  areas: ['items'],
  compile: ({ action, target }) => `game.operateThing(self, ${target}, ${action});`,
  docs: {
    de: 'Öffnet, schließt oder wechselt eine Tür, ein Tor, eine Truhe oder einen Schalter. Der Block braucht keinen Schlüssel – die Bedingung baust du selbst davor.',
    en: 'Opens, closes or toggles a door, gate, chest or switch. The block needs no key – build the condition yourself in front of it.',
  },
  since: 5,
});

export const pickUp = defineBlock({
  id: 'items.pickUp',
  category: 'items',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'any' } },
  text: { de: 'hebe {target} auf', en: 'pick up {target}' },
  keywords: { de: ['aufheben', 'einsammeln'], en: ['collect', 'grab', 'take'] },
  areas: ['items'],
  compile: ({ target }) => `game.pickUp(self, ${target});`,
  docs: {
    de: 'Dieses Objekt hebt einen Aufheb-Gegenstand (Pickup-Komponente) auf: Er landet im Inventar und verschwindet aus der Szene.',
    en: 'This object picks up a pickup object (Pickup component): it goes into the inventory and leaves the scene.',
  },
  since: 5,
});

export const damage = defineBlock({
  id: 'items.damage',
  category: 'items',
  shape: 'stack',
  inputs: {
    amount: { type: 'number', default: 10 },
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
  },
  text: { de: 'füge {target} {amount} Schaden zu', en: 'deal {amount} damage to {target}' },
  keywords: { de: ['verletzen', 'treffer', 'leben'], en: ['hurt', 'hit', 'health', 'attack'] },
  areas: ['items'],
  compile: ({ amount, target }) => `game.damageObject(self, ${target}, ${amount});`,
  docs: {
    de: 'Zieht dem Objekt Lebenspunkte ab. Fallen sie auf 0, stirbt es.',
    en: 'Takes hit points from the object. If they fall to 0, it dies.',
  },
  since: 5,
});

export const heal = defineBlock({
  id: 'items.heal',
  category: 'items',
  shape: 'stack',
  inputs: {
    amount: { type: 'number', default: 10 },
    target: { type: 'reference', source: 'object', default: 'tag:Player' },
  },
  text: { de: 'heile {target} um {amount}', en: 'heal {target} by {amount}' },
  keywords: { de: ['leben', 'heilen'], en: ['health', 'restore', 'cure'] },
  areas: ['items'],
  compile: ({ amount, target }) => `game.healObject(self, ${target}, ${amount});`,
  docs: {
    de: 'Gibt dem Objekt Lebenspunkte zurück (höchstens bis zum Maximum).',
    en: 'Gives hit points back to the object (at most up to the maximum).',
  },
  since: 5,
});

export const health = defineBlock({
  id: 'items.health',
  category: 'items',
  shape: 'reporter',
  output: 'number',
  inputs: { target: { type: 'reference', source: 'object', default: 'tag:Player' } },
  text: { de: 'Leben von {target}', en: 'health of {target}' },
  keywords: { de: ['lebenspunkte'], en: ['hit points', 'hp'] },
  areas: ['items'],
  compile: ({ target }) => `game.healthOfObject(self, ${target})`,
  docs: {
    de: 'Die Lebenspunkte des Objekts (0, wenn es keine Health-Komponente hat).',
    en: 'The hit points of the object (0 if it has no Health component).',
  },
  since: 5,
});
