import { defineBlock } from '../defineBlock';

/**
 * Lists and dictionaries (SPEC 7.3). Lists count from 1 like in Scratch. A dictionary has text
 * keys. Both are plain values: they can be stored in variables and in save games, and "for each
 * item" walks through them.
 */

export const newList = defineBlock({
  id: 'data.newList',
  category: 'data',
  shape: 'reporter',
  output: 'list',
  inputs: {},
  text: { de: 'neue leere Liste', en: 'new empty list' },
  keywords: { de: ['array', 'erstellen'], en: ['array', 'create'] },
  compile: () => '[]',
  docs: {
    de: 'Eine neue Liste ohne Einträge. Zum Beispiel in eine Variable setzen.',
    en: 'A new list without items. For example put it in a variable.',
  },
  since: 7,
});

export const newDictionary = defineBlock({
  id: 'data.newDictionary',
  category: 'data',
  shape: 'reporter',
  output: 'dictionary',
  inputs: {},
  text: { de: 'neues leeres Wörterbuch', en: 'new empty dictionary' },
  keywords: { de: ['map', 'objekt', 'erstellen'], en: ['map', 'object', 'create'] },
  compile: () => '{}',
  docs: {
    de: 'Ein neues Wörterbuch ohne Einträge. Jeder Eintrag hat einen Schlüssel (Text) und einen Wert.',
    en: 'A new dictionary without entries. Every entry has a key (text) and a value.',
  },
  since: 7,
});

export const splitText = defineBlock({
  id: 'data.split',
  category: 'data',
  shape: 'reporter',
  output: 'list',
  inputs: {
    text: { type: 'string', default: 'a,b,c' },
    separator: { type: 'string', default: ',' },
  },
  text: { de: 'teile {text} bei {separator}', en: 'split {text} at {separator}' },
  keywords: { de: ['trennen', 'zerlegen'], en: ['separate', 'cut'] },
  compile: ({ text, separator }) => `game.split(${text}, ${separator})`,
  docs: {
    de: 'Zerlegt einen Text an jedem Trennzeichen in eine Liste.',
    en: 'Cuts a text at every separator into a list.',
  },
  since: 7,
});

export const listAdd = defineBlock({
  id: 'data.listAdd',
  category: 'data',
  shape: 'stack',
  inputs: { item: { type: 'any', default: 'Ding' }, list: { type: 'any', default: '' } },
  text: { de: 'füge {item} zu {list} hinzu', en: 'add {item} to {list}' },
  keywords: { de: ['anhängen', 'liste'], en: ['append', 'push', 'list'] },
  compile: ({ item, list }) => `game.listAdd(${list}, ${item});`,
  docs: {
    de: 'Hängt einen Eintrag ans Ende der Liste.',
    en: 'Adds an item to the end of the list.',
  },
  since: 7,
});

export const listInsert = defineBlock({
  id: 'data.listInsert',
  category: 'data',
  shape: 'stack',
  inputs: {
    item: { type: 'any', default: 'Ding' },
    index: { type: 'number', default: 1 },
    list: { type: 'any', default: '' },
  },
  text: {
    de: 'füge {item} an Stelle {index} in {list} ein',
    en: 'insert {item} at {index} of {list}',
  },
  keywords: { de: ['einfügen', 'liste'], en: ['list'] },
  compile: ({ item, index, list }) => `game.listInsert(${list}, ${index}, ${item});`,
  docs: {
    de: 'Fügt einen Eintrag an der Stelle ein (1 ist der erste). Die folgenden rücken nach hinten.',
    en: 'Inserts an item at the place (1 is the first). The following ones move back.',
  },
  since: 7,
});

export const listRemoveAt = defineBlock({
  id: 'data.listRemoveAt',
  category: 'data',
  shape: 'stack',
  inputs: { index: { type: 'number', default: 1 }, list: { type: 'any', default: '' } },
  text: { de: 'lösche Eintrag {index} aus {list}', en: 'delete item {index} of {list}' },
  keywords: { de: ['entfernen', 'liste'], en: ['remove', 'list'] },
  compile: ({ index, list }) => `game.listRemoveAt(${list}, ${index});`,
  docs: {
    de: 'Löscht den Eintrag an der Stelle (1 ist der erste).',
    en: 'Deletes the item at the place (1 is the first).',
  },
  since: 7,
});

export const listSet = defineBlock({
  id: 'data.listSet',
  category: 'data',
  shape: 'stack',
  inputs: {
    index: { type: 'number', default: 1 },
    list: { type: 'any', default: '' },
    item: { type: 'any', default: 'Ding' },
  },
  text: {
    de: 'ersetze Eintrag {index} von {list} durch {item}',
    en: 'replace item {index} of {list} with {item}',
  },
  keywords: { de: ['ändern', 'liste'], en: ['change', 'set', 'list'] },
  compile: ({ index, list, item }) => `game.listSet(${list}, ${index}, ${item});`,
  docs: {
    de: 'Ersetzt den Eintrag an der Stelle (1 ist der erste).',
    en: 'Replaces the item at the place (1 is the first).',
  },
  since: 7,
});

export const listClear = defineBlock({
  id: 'data.listClear',
  category: 'data',
  shape: 'stack',
  inputs: { list: { type: 'any', default: '' } },
  text: { de: 'lösche alle Einträge von {list}', en: 'delete all items of {list}' },
  keywords: { de: ['leeren', 'liste'], en: ['clear', 'empty', 'list'] },
  compile: ({ list }) => `game.listClear(${list});`,
  docs: { de: 'Leert die Liste.', en: 'Empties the list.' },
  since: 7,
});

export const listGet = defineBlock({
  id: 'data.listGet',
  category: 'data',
  shape: 'reporter',
  output: 'any',
  inputs: { index: { type: 'number', default: 1 }, list: { type: 'any', default: '' } },
  text: { de: 'Eintrag {index} von {list}', en: 'item {index} of {list}' },
  keywords: { de: ['lesen', 'liste', 'element'], en: ['get', 'read', 'list', 'element'] },
  compile: ({ index, list }) => `game.listGet(${list}, ${index})`,
  docs: {
    de: 'Der Eintrag an der Stelle (1 ist der erste). Gibt es ihn nicht, ist das Ergebnis leer.',
    en: 'The item at the place (1 is the first). If there is none, the result is empty.',
  },
  since: 7,
});

export const listLength = defineBlock({
  id: 'data.listLength',
  category: 'data',
  shape: 'reporter',
  output: 'number',
  inputs: { list: { type: 'any', default: '' } },
  text: { de: 'Länge von {list}', en: 'length of {list}' },
  keywords: { de: ['anzahl', 'liste'], en: ['count', 'size', 'list'] },
  compile: ({ list }) => `game.listLength(${list})`,
  docs: { de: 'Wie viele Einträge die Liste hat.', en: 'How many items the list has.' },
  since: 7,
});

export const listContains = defineBlock({
  id: 'data.listContains',
  category: 'data',
  shape: 'boolean',
  output: 'boolean',
  inputs: { list: { type: 'any', default: '' }, item: { type: 'any', default: 'Ding' } },
  text: { de: '{list} enthält {item}?', en: '{list} contains {item}?' },
  keywords: { de: ['enthalten', 'liste'], en: ['has', 'includes', 'list'] },
  compile: ({ list, item }) => `(game.listIndexOf(${list}, ${item}) > 0)`,
  docs: {
    de: 'Wahr, wenn der Eintrag in der Liste vorkommt (Groß- und Kleinschreibung egal).',
    en: 'True if the item is in the list (upper and lower case do not matter).',
  },
  since: 7,
});

export const listIndexOf = defineBlock({
  id: 'data.listIndexOf',
  category: 'data',
  shape: 'reporter',
  output: 'number',
  inputs: { item: { type: 'any', default: 'Ding' }, list: { type: 'any', default: '' } },
  text: { de: 'Stelle von {item} in {list}', en: 'place of {item} in {list}' },
  keywords: { de: ['suchen', 'finden', 'liste'], en: ['find', 'search', 'index', 'list'] },
  compile: ({ item, list }) => `game.listIndexOf(${list}, ${item})`,
  docs: {
    de: 'Die Stelle des ersten Treffers (1 ist die erste), 0 wenn der Eintrag fehlt.',
    en: 'The place of the first match (1 is the first), 0 if the item is missing.',
  },
  since: 7,
});

export const listJoin = defineBlock({
  id: 'data.listJoin',
  category: 'data',
  shape: 'reporter',
  output: 'string',
  inputs: { list: { type: 'any', default: '' }, separator: { type: 'string', default: ', ' } },
  text: { de: 'verbinde {list} mit {separator}', en: 'join {list} with {separator}' },
  keywords: { de: ['text', 'liste'], en: ['text', 'list', 'concat'] },
  compile: ({ list, separator }) => `game.listJoin(${list}, ${separator})`,
  docs: {
    de: 'Macht aus den Einträgen einen Text, getrennt durch das Trennzeichen.',
    en: 'Makes one text of the items, separated by the separator.',
  },
  since: 7,
});

export const dictSet = defineBlock({
  id: 'data.dictSet',
  category: 'data',
  shape: 'stack',
  inputs: {
    key: { type: 'string', default: 'Schlüssel' },
    dictionary: { type: 'any', default: '' },
    value: { type: 'any', default: 'Wert' },
  },
  text: {
    de: 'setze {key} in {dictionary} auf {value}',
    en: 'set {key} in {dictionary} to {value}',
  },
  keywords: { de: ['wörterbuch', 'schlüssel'], en: ['dictionary', 'map', 'key'] },
  compile: ({ key, dictionary, value }) => `game.dictSet(${dictionary}, ${key}, ${value});`,
  docs: {
    de: 'Legt den Eintrag mit diesem Schlüssel an oder überschreibt ihn.',
    en: 'Creates the entry with this key or overwrites it.',
  },
  since: 7,
});

export const dictRemove = defineBlock({
  id: 'data.dictRemove',
  category: 'data',
  shape: 'stack',
  inputs: {
    key: { type: 'string', default: 'Schlüssel' },
    dictionary: { type: 'any', default: '' },
  },
  text: { de: 'lösche {key} aus {dictionary}', en: 'delete {key} from {dictionary}' },
  keywords: { de: ['wörterbuch', 'entfernen'], en: ['dictionary', 'remove'] },
  compile: ({ key, dictionary }) => `game.dictRemove(${dictionary}, ${key});`,
  docs: { de: 'Löscht den Eintrag mit diesem Schlüssel.', en: 'Deletes the entry with this key.' },
  since: 7,
});

export const dictGet = defineBlock({
  id: 'data.dictGet',
  category: 'data',
  shape: 'reporter',
  output: 'any',
  inputs: {
    key: { type: 'string', default: 'Schlüssel' },
    dictionary: { type: 'any', default: '' },
  },
  text: { de: '{key} aus {dictionary}', en: '{key} of {dictionary}' },
  keywords: { de: ['wörterbuch', 'lesen', 'wert'], en: ['dictionary', 'get', 'value'] },
  compile: ({ key, dictionary }) => `game.dictGet(${dictionary}, ${key})`,
  docs: {
    de: 'Der Wert zu diesem Schlüssel. Gibt es ihn nicht, ist das Ergebnis leer.',
    en: 'The value of this key. If there is none, the result is empty.',
  },
  since: 7,
});

export const dictHas = defineBlock({
  id: 'data.dictHas',
  category: 'data',
  shape: 'boolean',
  output: 'boolean',
  inputs: {
    dictionary: { type: 'any', default: '' },
    key: { type: 'string', default: 'Schlüssel' },
  },
  text: { de: '{dictionary} hat {key}?', en: '{dictionary} has {key}?' },
  keywords: { de: ['wörterbuch', 'enthalten'], en: ['dictionary', 'contains'] },
  compile: ({ dictionary, key }) => `game.dictHas(${dictionary}, ${key})`,
  docs: { de: 'Wahr, wenn es den Schlüssel gibt.', en: 'True if the key exists.' },
  since: 7,
});

export const dictKeys = defineBlock({
  id: 'data.dictKeys',
  category: 'data',
  shape: 'reporter',
  output: 'list',
  inputs: { dictionary: { type: 'any', default: '' } },
  text: { de: 'Schlüssel von {dictionary}', en: 'keys of {dictionary}' },
  keywords: { de: ['wörterbuch', 'liste'], en: ['dictionary', 'list'] },
  compile: ({ dictionary }) => `game.dictKeys(${dictionary})`,
  docs: {
    de: 'Eine Liste mit allen Schlüsseln, in der Reihenfolge des Anlegens.',
    en: 'A list of all keys, in the order they were added.',
  },
  since: 7,
});

export const dictSize = defineBlock({
  id: 'data.dictSize',
  category: 'data',
  shape: 'reporter',
  output: 'number',
  inputs: { dictionary: { type: 'any', default: '' } },
  text: { de: 'Anzahl Einträge in {dictionary}', en: 'number of entries in {dictionary}' },
  keywords: { de: ['wörterbuch', 'größe'], en: ['dictionary', 'size', 'length'] },
  compile: ({ dictionary }) => `game.dictSize(${dictionary})`,
  docs: {
    de: 'Wie viele Einträge das Wörterbuch hat.',
    en: 'How many entries the dictionary has.',
  },
  since: 7,
});

export const forEachItem = defineBlock({
  id: 'data.forEachItem',
  category: 'data',
  shape: 'c',
  inputs: {
    name: { type: 'textField', default: 'Eintrag' },
    list: { type: 'any', default: '' },
    body: { type: 'statement' },
  },
  text: { de: 'für jeden {name} in {list}', en: 'for each {name} in {list}' },
  keywords: { de: ['schleife', 'liste', 'jeder'], en: ['loop', 'list', 'each', 'for'] },
  local: { field: 'name', role: 'loop', substack: 'body' },
  compile: ({ list }, meta) =>
    `for (const ${meta.local('name')} of game.items(${list})) {\n  /*@substack:body*/\n}`,
  docs: {
    de: 'Geht die Einträge einer Liste der Reihe nach durch. Den aktuellen Eintrag liefert der Block „lokale Variable“ mit dem eingestellten Namen. Bei einem Wörterbuch geht es die Schlüssel durch.',
    en: 'Goes through the items of a list one after the other. The block "local variable" with the chosen name gives the current item. For a dictionary it goes through the keys.',
  },
  since: 7,
});
