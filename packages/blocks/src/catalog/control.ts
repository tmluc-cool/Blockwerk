import { defineBlock } from '../defineBlock';

export const wait = defineBlock({
  id: 'control.wait',
  category: 'control',
  shape: 'stack',
  inputs: { seconds: { type: 'number', default: 1 } },
  text: { de: 'warte {seconds} s', en: 'wait {seconds} s' },
  keywords: { de: ['pause', 'sekunden'], en: ['delay', 'seconds', 'sleep'] },
  compile: ({ seconds }) => `yield* game.wait(${seconds});`,
  docs: { de: 'Wartet die angegebene Zeit.', en: 'Waits for the given time.' },
  since: 1,
});

export const waitUntil = defineBlock({
  id: 'control.waitUntil',
  category: 'control',
  shape: 'stack',
  inputs: { condition: { type: 'boolean' } },
  text: { de: 'warte bis {condition}', en: 'wait until {condition}' },
  keywords: { de: ['bedingung'], en: ['condition'] },
  compile: ({ condition }) => `while (!${condition}) {\n  yield;\n}`,
  docs: {
    de: 'Wartet, bis die Bedingung wahr ist (wird jeden Frame geprüft).',
    en: 'Waits until the condition is true (checked every frame).',
  },
  since: 1,
});

export const repeat = defineBlock({
  id: 'control.repeat',
  category: 'control',
  shape: 'c',
  inputs: { times: { type: 'number', default: 10 }, body: { type: 'statement' } },
  text: { de: 'wiederhole {times} mal', en: 'repeat {times}' },
  keywords: { de: ['schleife', 'mal'], en: ['loop', 'times', 'for'] },
  compile: ({ times }, { uid }) =>
    `for (let ${uid} = Math.round(${times}); ${uid} > 0; ${uid}--) {\n  /*@substack:body*/\n  yield;\n}`,
  docs: {
    de: 'Führt den Inhalt so oft aus. Nach jedem Durchlauf folgt der nächste Frame.',
    en: 'Runs the body that many times. Each pass ends with the next frame.',
  },
  since: 1,
});

export const forever = defineBlock({
  id: 'control.forever',
  category: 'control',
  shape: 'c',
  terminal: true,
  inputs: { body: { type: 'statement' } },
  text: { de: 'wiederhole fortlaufend', en: 'forever' },
  keywords: { de: ['schleife', 'immer', 'endlos'], en: ['loop', 'always', 'while'] },
  compile: () => 'while (true) {\n  /*@substack:body*/\n  yield;\n}',
  docs: {
    de: 'Führt den Inhalt immer wieder aus, einmal pro Frame.',
    en: 'Runs the body again and again, once per frame.',
  },
  since: 1,
});

export const repeatUntil = defineBlock({
  id: 'control.repeatUntil',
  category: 'control',
  shape: 'c',
  inputs: { condition: { type: 'boolean' }, body: { type: 'statement' } },
  text: { de: 'wiederhole bis {condition}', en: 'repeat until {condition}' },
  keywords: { de: ['schleife', 'solange'], en: ['loop', 'while'] },
  compile: ({ condition }) => `while (!${condition}) {\n  /*@substack:body*/\n  yield;\n}`,
  docs: {
    de: 'Führt den Inhalt aus, bis die Bedingung wahr ist.',
    en: 'Runs the body until the condition is true.',
  },
  since: 1,
});

export const ifThen = defineBlock({
  id: 'control.if',
  category: 'control',
  shape: 'c',
  inputs: { condition: { type: 'boolean' }, then: { type: 'statement' } },
  text: { de: 'falls {condition} dann', en: 'if {condition} then' },
  keywords: { de: ['wenn', 'bedingung'], en: ['condition', 'when'] },
  compile: ({ condition }) => `if (${condition}) {\n  /*@substack:then*/\n}`,
  docs: {
    de: 'Führt den Inhalt nur aus, wenn die Bedingung wahr ist.',
    en: 'Runs the body only if the condition is true.',
  },
  since: 1,
});

export const ifElse = defineBlock({
  id: 'control.ifElse',
  category: 'control',
  shape: 'c',
  inputs: {
    condition: { type: 'boolean' },
    then: { type: 'statement' },
    else: { type: 'statement', label: { de: 'sonst', en: 'else' } },
  },
  text: { de: 'falls {condition} dann', en: 'if {condition} then' },
  keywords: { de: ['wenn', 'sonst', 'bedingung'], en: ['condition', 'otherwise'] },
  compile: ({ condition }) =>
    `if (${condition}) {\n  /*@substack:then*/\n} else {\n  /*@substack:else*/\n}`,
  docs: {
    de: 'Führt den oberen Teil aus, wenn die Bedingung wahr ist, sonst den unteren.',
    en: 'Runs the upper part if the condition is true, otherwise the lower part.',
  },
  since: 1,
});

export const createClone = defineBlock({
  id: 'control.clone',
  category: 'control',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'erzeuge Kopie von {target}', en: 'create clone of {target}' },
  keywords: { de: ['klon', 'duplizieren', 'spawnen'], en: ['spawn', 'instantiate', 'duplicate'] },
  compile: ({ target }) => `game.clone(self, ${target});`,
  docs: {
    de: 'Erzeugt eine Kopie des Objekts an seiner Stelle (Unity: Instantiate). In der Kopie startet „Wenn ich erstellt werde“.',
    en: 'Creates a copy of the object at its place (Unity: Instantiate). "When I am created" runs in the copy.',
  },
  since: 1,
});

export const spawnPrefab = defineBlock({
  id: 'control.spawnPrefab',
  category: 'control',
  shape: 'stack',
  inputs: {
    prefab: { type: 'reference', source: 'prefab', default: 'prefab:' },
    at: { type: 'reference', source: 'object', default: 'self' },
  },
  text: { de: 'erzeuge {prefab} bei {at}', en: 'create {prefab} at {at}' },
  keywords: {
    de: ['prefab', 'spawnen', 'erschaffen', 'instanz'],
    en: ['prefab', 'spawn', 'instantiate'],
  },
  compile: ({ prefab, at }) => `game.spawn(self, ${prefab}, ${at});`,
  docs: {
    de: 'Erzeugt ein Exemplar eines Prefabs an der Stelle eines Objekts (Unity: Instantiate mit Prefab). Im neuen Objekt startet „Wenn ich erstellt werde“.',
    en: 'Creates an instance of a prefab at an object\'s position (Unity: Instantiate with a prefab). "When I am created" runs in the new object.',
  },
  since: 1,
});

export const destroy = defineBlock({
  id: 'control.destroy',
  category: 'control',
  shape: 'stack',
  inputs: { target: { type: 'reference', source: 'object', default: 'self' } },
  text: { de: 'zerstöre {target}', en: 'destroy {target}' },
  keywords: { de: ['löschen', 'entfernen'], en: ['delete', 'remove'] },
  compile: ({ target }) => `if (game.destroy(self, ${target})) return;`,
  docs: {
    de: 'Entfernt ein Objekt aus dem Spiel (Unity: Destroy). Zerstört es sich selbst, endet das Skript.',
    en: 'Removes an object from the game (Unity: Destroy). If it destroys itself, the script ends.',
  },
  since: 1,
});

export const stop = defineBlock({
  id: 'control.stop',
  category: 'control',
  shape: 'cap',
  inputs: {
    what: {
      type: 'dropdown',
      default: 'thisScript',
      options: [
        { value: 'thisScript', text: { de: 'dieses Skript', en: 'this script' } },
        { value: 'all', text: { de: 'alle', en: 'all' } },
      ],
    },
  },
  text: { de: 'stoppe {what}', en: 'stop {what}' },
  keywords: { de: ['ende', 'beenden', 'abbrechen'], en: ['end', 'halt', 'return'] },
  compile: ({ what }) => (what === '"all"' ? 'game.stopAll();\nreturn;' : 'return;'),
  docs: {
    de: 'Beendet dieses Skript oder alle Skripte des Spiels.',
    en: 'Ends this script or all scripts of the game.',
  },
  since: 1,
});
