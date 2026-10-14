import { defineBlock } from '../defineBlock';
import type { LocalizedText } from '../types';

/** Defines a reporter with two number slots. */
function arithmetic(
  id: string,
  text: LocalizedText,
  docs: LocalizedText,
  compile: (a: string, b: string) => string,
  keywords: Readonly<Record<'de' | 'en', readonly string[]>>,
): ReturnType<typeof defineBlock> {
  return defineBlock({
    id,
    category: 'operators',
    shape: 'reporter',
    output: 'number',
    inputs: { a: { type: 'number', default: 0 }, b: { type: 'number', default: 0 } },
    text,
    keywords,
    compile: ({ a, b }) => compile(a, b),
    docs,
    since: 1,
  });
}

export const add = arithmetic(
  'operators.add',
  { de: '{a} + {b}', en: '{a} + {b}' },
  { de: 'Summe zweier Zahlen.', en: 'Sum of two numbers.' },
  (a, b) => `${a} + ${b}`,
  { de: ['plus', 'addieren', 'summe'], en: ['plus', 'sum'] },
);

export const subtract = arithmetic(
  'operators.subtract',
  { de: '{a} − {b}', en: '{a} − {b}' },
  { de: 'Differenz zweier Zahlen.', en: 'Difference of two numbers.' },
  (a, b) => `${a} - ${b}`,
  { de: ['minus', 'abziehen'], en: ['minus', 'difference'] },
);

export const multiply = arithmetic(
  'operators.multiply',
  { de: '{a} × {b}', en: '{a} × {b}' },
  { de: 'Produkt zweier Zahlen.', en: 'Product of two numbers.' },
  (a, b) => `${a} * ${b}`,
  { de: ['mal', 'multiplizieren'], en: ['times', 'product'] },
);

export const divide = arithmetic(
  'operators.divide',
  { de: '{a} ÷ {b}', en: '{a} ÷ {b}' },
  { de: 'Quotient zweier Zahlen.', en: 'Quotient of two numbers.' },
  (a, b) => `${a} / ${b}`,
  { de: ['geteilt', 'dividieren'], en: ['divided', 'quotient'] },
);

export const mod = arithmetic(
  'operators.mod',
  { de: 'Rest von {a} geteilt durch {b}', en: '{a} mod {b}' },
  {
    de: 'Rest der Division, immer mit dem Vorzeichen des Teilers (wie in Scratch).',
    en: 'Remainder of the division, always with the sign of the divisor (as in Scratch).',
  },
  (a, b) => `game.mod(${a}, ${b})`,
  { de: ['modulo', 'rest'], en: ['modulo', 'remainder'] },
);

export const min = arithmetic(
  'operators.min',
  { de: 'kleinere von {a} und {b}', en: 'min of {a} and {b}' },
  { de: 'Die kleinere der beiden Zahlen.', en: 'The smaller of the two numbers.' },
  (a, b) => `Math.min(${a}, ${b})`,
  { de: ['minimum', 'kleinste'], en: ['minimum', 'smallest'] },
);

export const max = arithmetic(
  'operators.max',
  { de: 'grössere von {a} und {b}', en: 'max of {a} and {b}' },
  { de: 'Die grössere der beiden Zahlen.', en: 'The larger of the two numbers.' },
  (a, b) => `Math.max(${a}, ${b})`,
  { de: ['maximum', 'grösste'], en: ['maximum', 'largest'] },
);

export const round = defineBlock({
  id: 'operators.round',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: { value: { type: 'number', default: 0 } },
  text: { de: 'runde {value}', en: 'round {value}' },
  keywords: { de: ['ganzzahl', 'aufrunden'], en: ['integer', 'whole'] },
  compile: ({ value }) => `Math.round(${value})`,
  docs: { de: 'Rundet auf die nächste ganze Zahl.', en: 'Rounds to the nearest whole number.' },
  since: 1,
});

export const mathFunction = defineBlock({
  id: 'operators.mathFunction',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: {
    fn: {
      type: 'dropdown',
      default: 'abs',
      options: [
        { value: 'abs', text: { de: 'Betrag', en: 'abs' } },
        { value: 'floor', text: { de: 'abrunden', en: 'floor' } },
        { value: 'ceiling', text: { de: 'aufrunden', en: 'ceiling' } },
        { value: 'sqrt', text: { de: 'Wurzel', en: 'sqrt' } },
        { value: 'sin', text: { de: 'sin', en: 'sin' } },
        { value: 'cos', text: { de: 'cos', en: 'cos' } },
        { value: 'tan', text: { de: 'tan', en: 'tan' } },
        { value: 'ln', text: { de: 'ln', en: 'ln' } },
        { value: 'exp', text: { de: 'e ^', en: 'e ^' } },
      ],
    },
    value: { type: 'number', default: 0 },
  },
  text: { de: '{fn} von {value}', en: '{fn} of {value}' },
  keywords: {
    de: ['betrag', 'wurzel', 'sinus', 'kosinus'],
    en: ['absolute', 'root', 'sine', 'cosine'],
  },
  compile: ({ fn, value }) => `game.mathFunction(${fn}, ${value})`,
  docs: {
    de: 'Mathematische Funktion. Winkel in Grad.',
    en: 'Mathematical function. Angles in degrees.',
  },
  since: 1,
});

export const clamp = defineBlock({
  id: 'operators.clamp',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: {
    value: { type: 'number', default: 0 },
    low: { type: 'number', default: 0 },
    high: { type: 'number', default: 10 },
  },
  text: {
    de: 'begrenze {value} auf {low} bis {high}',
    en: 'clamp {value} between {low} and {high}',
  },
  keywords: { de: ['grenze', 'beschränken'], en: ['limit', 'restrict'] },
  compile: ({ value, low, high }) => `Math.min(Math.max(${value}, ${low}), ${high})`,
  docs: {
    de: 'Hält eine Zahl zwischen zwei Grenzen.',
    en: 'Keeps a number between two limits.',
  },
  since: 1,
});

export const lerp = defineBlock({
  id: 'operators.lerp',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: {
    a: { type: 'number', default: 0 },
    b: { type: 'number', default: 10 },
    t: { type: 'number', default: 0.5 },
  },
  text: { de: 'interpoliere von {a} bis {b} mit {t}', en: 'lerp from {a} to {b} by {t}' },
  keywords: { de: ['übergang', 'mischen'], en: ['interpolate', 'blend', 'mix'] },
  compile: ({ a, b, t }) => `${a} + (${b} - ${a}) * ${t}`,
  docs: {
    de: 'Wert zwischen zwei Zahlen: 0 ergibt die erste, 1 die zweite (Unity: Mathf.Lerp ohne Begrenzung).',
    en: 'Value between two numbers: 0 gives the first, 1 the second (Unity: Mathf.LerpUnclamped).',
  },
  since: 1,
});

/** Defines a comparison with two slots that accept anything. */
function comparison(
  id: string,
  symbol: string,
  operator: string,
  docs: LocalizedText,
): ReturnType<typeof defineBlock> {
  return defineBlock({
    id,
    category: 'operators',
    shape: 'boolean',
    output: 'boolean',
    inputs: { a: { type: 'any', default: '' }, b: { type: 'any', default: '50' } },
    text: { de: `{a} ${symbol} {b}`, en: `{a} ${symbol} {b}` },
    keywords: { de: ['vergleich'], en: ['compare'] },
    compile: ({ a, b }) => `game.compare(${a}, ${b}) ${operator} 0`,
    docs,
    since: 1,
  });
}

export const lessThan = comparison('operators.lt', '<', '<', {
  de: 'Wahr, wenn der linke Wert kleiner ist.',
  en: 'True if the left value is smaller.',
});

export const equals = comparison('operators.eq', '=', '===', {
  de: 'Wahr, wenn beide Werte gleich sind (Text ohne Gross-/Kleinschreibung).',
  en: 'True if both values are equal (text ignores upper/lower case).',
});

export const greaterThan = comparison('operators.gt', '>', '>', {
  de: 'Wahr, wenn der linke Wert grösser ist.',
  en: 'True if the left value is larger.',
});

export const and = defineBlock({
  id: 'operators.and',
  category: 'operators',
  shape: 'boolean',
  output: 'boolean',
  inputs: { a: { type: 'boolean' }, b: { type: 'boolean' } },
  text: { de: '{a} und {b}', en: '{a} and {b}' },
  keywords: { de: ['beide'], en: ['both'] },
  compile: ({ a, b }) => `${a} && ${b}`,
  docs: { de: 'Wahr, wenn beide Bedingungen wahr sind.', en: 'True if both conditions are true.' },
  since: 1,
});

export const or = defineBlock({
  id: 'operators.or',
  category: 'operators',
  shape: 'boolean',
  output: 'boolean',
  inputs: { a: { type: 'boolean' }, b: { type: 'boolean' } },
  text: { de: '{a} oder {b}', en: '{a} or {b}' },
  keywords: { de: ['eine'], en: ['either'] },
  compile: ({ a, b }) => `${a} || ${b}`,
  docs: {
    de: 'Wahr, wenn mindestens eine Bedingung wahr ist.',
    en: 'True if at least one condition is true.',
  },
  since: 1,
});

export const not = defineBlock({
  id: 'operators.not',
  category: 'operators',
  shape: 'boolean',
  output: 'boolean',
  inputs: { value: { type: 'boolean' } },
  text: { de: 'nicht {value}', en: 'not {value}' },
  keywords: { de: ['gegenteil'], en: ['opposite', 'negate'] },
  compile: ({ value }) => `!${value}`,
  docs: { de: 'Kehrt eine Bedingung um.', en: 'Inverts a condition.' },
  since: 1,
});

export const join = defineBlock({
  id: 'operators.join',
  category: 'operators',
  shape: 'reporter',
  output: 'string',
  inputs: { a: { type: 'string', default: 'Apfel ' }, b: { type: 'string', default: 'Banane' } },
  text: { de: 'verbinde {a} und {b}', en: 'join {a} {b}' },
  keywords: { de: ['text', 'zusammenfügen'], en: ['text', 'concat', 'string'] },
  compile: ({ a, b }) => `${a} + ${b}`,
  docs: { de: 'Hängt zwei Texte aneinander.', en: 'Joins two texts.' },
  since: 1,
});

export const length = defineBlock({
  id: 'operators.length',
  category: 'operators',
  shape: 'reporter',
  output: 'number',
  inputs: { text: { type: 'string', default: 'Apfel' } },
  text: { de: 'Länge von {text}', en: 'length of {text}' },
  keywords: { de: ['zeichen', 'anzahl'], en: ['characters', 'count'] },
  compile: ({ text }) => `${text}.length`,
  docs: { de: 'Anzahl der Zeichen eines Texts.', en: 'Number of characters of a text.' },
  since: 1,
});

export const letterOf = defineBlock({
  id: 'operators.letterOf',
  category: 'operators',
  shape: 'reporter',
  output: 'string',
  inputs: { index: { type: 'number', default: 1 }, text: { type: 'string', default: 'Apfel' } },
  text: { de: 'Zeichen {index} von {text}', en: 'letter {index} of {text}' },
  keywords: { de: ['buchstabe'], en: ['character'] },
  compile: ({ index, text }) => `game.letterOf(${index}, ${text})`,
  docs: {
    de: 'Ein Zeichen eines Texts, gezählt ab 1.',
    en: 'One character of a text, counted from 1.',
  },
  since: 1,
});

export const contains = defineBlock({
  id: 'operators.contains',
  category: 'operators',
  shape: 'boolean',
  output: 'boolean',
  inputs: { text: { type: 'string', default: 'Apfel' }, part: { type: 'string', default: 'a' } },
  text: { de: '{text} enthält {part}?', en: '{text} contains {part}?' },
  keywords: { de: ['suchen', 'text'], en: ['includes', 'search', 'text'] },
  compile: ({ text, part }) => `game.contains(${text}, ${part})`,
  docs: {
    de: 'Wahr, wenn der Text den Teil enthält (ohne Gross-/Kleinschreibung).',
    en: 'True if the text contains the part (ignoring upper/lower case).',
  },
  since: 1,
});
