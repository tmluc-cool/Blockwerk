import { defineBlock } from '../defineBlock';

/**
 * Local variables (SPEC 7.4): they live in one stack of one script or custom block. They are
 * identified by their name, which the palette offers in a dropdown of the names declared above.
 */

export const declareLocal = defineBlock({
  id: 'locals.declare',
  category: 'variables',
  shape: 'stack',
  inputs: { name: { type: 'textField', default: 'temp' }, value: { type: 'any', default: '0' } },
  text: { de: 'lokale Variable {name} = {value}', en: 'local variable {name} = {value}' },
  keywords: { de: ['anlegen', 'temporär'], en: ['create', 'temporary', 'let', 'var'] },
  local: { field: 'name', role: 'declare' },
  compile: ({ value }, meta) => `var ${meta.local('name')} = ${value};`,
  docs: {
    de: 'Legt eine Variable an, die nur in diesem Stapel und in dem, was darunter und darin liegt, gilt.',
    en: 'Creates a variable that only exists in this stack and in everything below and inside it.',
  },
  since: 7,
});

export const setLocal = defineBlock({
  id: 'locals.set',
  category: 'variables',
  shape: 'stack',
  inputs: { name: { type: 'textField', default: 'temp' }, value: { type: 'any', default: '0' } },
  text: { de: 'setze lokale {name} auf {value}', en: 'set local {name} to {value}' },
  keywords: { de: ['zuweisen', 'temporär'], en: ['assign', 'temporary'] },
  local: { field: 'name', role: 'use' },
  compile: ({ value }, meta) => `${meta.local('name')} = ${value};`,
  docs: {
    de: 'Gibt einer lokalen Variable einen neuen Wert.',
    en: 'Gives a local variable a new value.',
  },
  since: 7,
});

export const changeLocal = defineBlock({
  id: 'locals.change',
  category: 'variables',
  shape: 'stack',
  inputs: { name: { type: 'textField', default: 'temp' }, by: { type: 'number', default: 1 } },
  text: { de: 'ändere lokale {name} um {by}', en: 'change local {name} by {by}' },
  keywords: { de: ['erhöhen', 'zählen'], en: ['increase', 'count'] },
  local: { field: 'name', role: 'use' },
  compile: ({ by }, meta) => {
    const name = meta.local('name');
    return `${name} = game.num(${name}) + ${by};`;
  },
  docs: {
    de: 'Zählt eine Zahl zur lokalen Variable dazu.',
    en: 'Adds a number to the local variable.',
  },
  since: 7,
});

export const getLocal = defineBlock({
  id: 'locals.get',
  category: 'variables',
  shape: 'reporter',
  output: 'any',
  inputs: { name: { type: 'textField', default: 'temp' } },
  text: { de: 'lokale {name}', en: 'local {name}' },
  keywords: { de: ['wert', 'temporär'], en: ['value', 'temporary'] },
  local: { field: 'name', role: 'use' },
  compile: (_args, meta) => meta.local('name'),
  docs: { de: 'Der Wert der lokalen Variable.', en: 'The value of the local variable.' },
  since: 7,
});
