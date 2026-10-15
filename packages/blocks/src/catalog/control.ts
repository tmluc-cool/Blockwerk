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

export const sendMessage = defineBlock({
  id: 'control.sendMessage',
  category: 'control',
  shape: 'stack',
  inputs: {
    message: { type: 'textField', default: 'ok' },
    target: { type: 'reference', source: 'messageTarget', default: 'all' },
  },
  text: { de: 'sende Nachricht {message} an {target}', en: 'send message {message} to {target}' },
  keywords: {
    de: ['signal', 'rufen', 'senden', 'broadcast'],
    en: ['broadcast', 'signal', 'notify', 'send'],
  },
  compile: ({ message, target }) => `game.sendMessage(self, ${message}, ${target});`,
  docs: {
    de: 'Schickt eine Nachricht an ein Objekt, an alle Objekte mit einem Tag oder an alle. Empfänger sind Skripte mit „Wenn ich Nachricht … empfange“. Zugestellt wird am Anfang des nächsten Ticks.',
    en: 'Sends a message to one object, to all objects with a tag, or to everyone. Receivers are scripts with "when I receive message …". Delivery happens at the start of the next tick.',
  },
  since: 5,
});

export const startTimer = defineBlock({
  id: 'control.startTimer',
  category: 'control',
  shape: 'stack',
  inputs: {
    name: { type: 'textField', default: 'timer1' },
    seconds: { type: 'number', default: 5 },
  },
  text: { de: 'starte Timer {name} mit {seconds} s', en: 'start timer {name} for {seconds} s' },
  keywords: { de: ['uhr', 'countdown', 'verzögerung'], en: ['countdown', 'delay', 'alarm'] },
  compile: ({ name, seconds }) => `game.startTimer(self, ${name}, ${seconds});`,
  docs: {
    de: 'Startet einen Timer dieses Objekts. Danach läuft das Skript weiter; wenn die Zeit um ist, startet „Wenn Timer … abläuft“. Derselbe Name startet den Timer neu.',
    en: 'Starts a timer of this object. The script goes on right away; when the time is up, "when timer … runs out" starts. The same name restarts the timer.',
  },
  since: 5,
});

export const forEachObject = defineBlock({
  id: 'control.forEachObject',
  category: 'control',
  shape: 'c',
  inputs: {
    target: { type: 'reference', source: 'touchTarget', default: 'any' },
    body: { type: 'statement' },
  },
  text: { de: 'für jedes Objekt in {target}', en: 'for each object in {target}' },
  keywords: {
    de: ['schleife', 'alle', 'jedes', 'tag'],
    en: ['loop', 'every', 'each', 'tag', 'foreach'],
  },
  compile: ({ target }, { uid }) =>
    `for (const ${uid} of game.objectsMatching(self, ${target})) {\n  game.setLoopObject(${uid});\n  /*@substack:body*/\n}`,
  docs: {
    de: 'Führt den Inhalt für jedes Objekt mit dem Tag aus (oder für alle). Im Inhalt steht „Schleifen-Objekt“ in den Objekt-Auswahlen für das gerade dran. Alle Durchläufe laufen im selben Frame, außer der Inhalt wartet.',
    en: 'Runs the body for every object with the tag (or for everyone). Inside the body, "loop object" in the object choices names the current one. All passes run in the same frame unless the body waits.',
  },
  since: 5,
});
