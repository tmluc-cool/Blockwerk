import { defineBlock } from '../defineBlock';

export const getVariable = defineBlock({
  id: 'variables.get',
  category: 'variables',
  shape: 'reporter',
  output: 'any',
  inputs: { variable: { type: 'variable' } },
  text: { de: '{variable}', en: '{variable}' },
  compile: (_args, meta) => meta.variable('variable').accessor,
  docs: { de: 'Der Wert der Variable.', en: 'The value of the variable.' },
  since: 1,
});

export const setVariable = defineBlock({
  id: 'variables.set',
  category: 'variables',
  shape: 'stack',
  inputs: { variable: { type: 'variable' }, value: { type: 'any', default: '0' } },
  text: { de: 'setze {variable} auf {value}', en: 'set {variable} to {value}' },
  keywords: { de: ['zuweisen', 'wert'], en: ['assign', 'value'] },
  compile: ({ value }, meta) => `${meta.variable('variable').accessor} = ${value};`,
  docs: { de: 'Gibt der Variable einen neuen Wert.', en: 'Gives the variable a new value.' },
  since: 1,
});

export const changeVariable = defineBlock({
  id: 'variables.change',
  category: 'variables',
  shape: 'stack',
  inputs: { variable: { type: 'variable' }, by: { type: 'number', default: 1 } },
  text: { de: 'ändere {variable} um {by}', en: 'change {variable} by {by}' },
  keywords: { de: ['erhöhen', 'zählen', 'plus'], en: ['increase', 'increment', 'count'] },
  compile: ({ by }, meta) => {
    const { accessor } = meta.variable('variable');
    return `${accessor} = game.num(${accessor}) + ${by};`;
  },
  docs: {
    de: 'Zählt eine Zahl zur Variable dazu (negative Zahlen ziehen ab).',
    en: 'Adds a number to the variable (negative numbers subtract).',
  },
  since: 1,
});

export const showVariable = defineBlock({
  id: 'variables.show',
  category: 'variables',
  shape: 'stack',
  inputs: { variable: { type: 'variable' } },
  text: { de: 'zeige Anzeige {variable}', en: 'show variable {variable}' },
  keywords: { de: ['einblenden', 'monitor'], en: ['display', 'monitor'] },
  compile: (_args, meta) => {
    const ref = meta.variable('variable');
    return `game.showVariable(self, ${JSON.stringify(ref.scope)}, ${JSON.stringify(ref.id)}, ${JSON.stringify(ref.name)}, true);`;
  },
  docs: {
    de: 'Blendet den Wert der Variable in der Spielansicht ein.',
    en: 'Shows the value of the variable in the game view.',
  },
  since: 1,
});

export const hideVariable = defineBlock({
  id: 'variables.hide',
  category: 'variables',
  shape: 'stack',
  inputs: { variable: { type: 'variable' } },
  text: { de: 'verstecke Anzeige {variable}', en: 'hide variable {variable}' },
  keywords: { de: ['ausblenden', 'monitor'], en: ['display', 'monitor'] },
  compile: (_args, meta) => {
    const ref = meta.variable('variable');
    return `game.showVariable(self, ${JSON.stringify(ref.scope)}, ${JSON.stringify(ref.id)}, ${JSON.stringify(ref.name)}, false);`;
  },
  docs: {
    de: 'Blendet die Anzeige der Variable wieder aus.',
    en: 'Hides the display of the variable again.',
  },
  since: 1,
});
