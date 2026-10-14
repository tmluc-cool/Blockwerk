import { describe, expect, it } from 'vitest';
import {
  BLOCK_CATALOG,
  BlockRegistry,
  buildSearchIndex,
  buildToolbox,
  CATEGORIES,
  defaultRegistry,
  defineBlock,
  LOCALES,
  orderCategories,
  searchBlocks,
  toBlocklyJson,
  VARIABLES_FLYOUT,
} from '../src';

describe('toBlocklyJson', () => {
  it('generates a stack block with a number slot and a dropdown', () => {
    const definition = defaultRegistry.get('motion.move');
    expect(definition).toBeDefined();
    if (!definition) return;
    const json = toBlocklyJson(definition, 'de');
    expect(json).toMatchObject({
      type: 'motion.move',
      colour: '#3f7fe0',
      tooltip: 'Bewegt das Objekt in Blickrichtung, zur Seite oder nach oben und unten.',
      inputsInline: true,
      message0: 'gehe %1 Meter %2',
      previousStatement: null,
      nextStatement: null,
    });
    expect(json.args0?.[0]).toEqual({
      type: 'input_value',
      name: 'meters',
      check: ['Number', 'String'],
    });
    expect(json.args0?.[1]?.options?.[0]).toEqual(['vorwärts', 'forward']);
    expect(toBlocklyJson(definition, 'en').message0).toBe('move %1 m %2');
  });

  it('generates scene reference, variable and color fields', () => {
    const touching = defaultRegistry.get('sensing.touching');
    const setVariable = defaultRegistry.get('variables.set');
    const setColor = defaultRegistry.get('looks.setColor');
    if (!touching || !setVariable || !setColor) throw new Error('missing block');
    expect(toBlocklyJson(touching, 'en').args0).toEqual([
      { type: 'field_bw_reference', name: 'target', source: 'touchTarget', text: 'any' },
    ]);
    expect(toBlocklyJson(touching, 'en').output).toBe('Boolean');
    expect(toBlocklyJson(setVariable, 'en').args0).toEqual([
      { type: 'field_variable', name: 'variable', variable: null },
      { type: 'input_value', name: 'value' },
    ]);
    expect(toBlocklyJson(setColor, 'en').args0).toEqual([
      { type: 'field_colour', name: 'color', colour: '#e04040' },
    ]);
  });

  it('gives value blocks of type any an unchecked output', () => {
    const getVariable = defaultRegistry.get('variables.get');
    if (!getVariable) throw new Error('missing block');
    const json = toBlocklyJson(getVariable, 'en');
    expect('output' in json).toBe(true);
    expect(json.output).toBeNull();
  });

  it('adds label rows for else branches and ends terminal C blocks', () => {
    const ifElse = defaultRegistry.get('control.ifElse');
    const forever = defaultRegistry.get('control.forever');
    if (!ifElse || !forever) throw new Error('missing block');
    const json = toBlocklyJson(ifElse, 'de');
    expect(json.message1).toBe('%1');
    expect(json.message2).toBe('sonst');
    expect(json.args2).toEqual([]);
    expect(json.message3).toBe('%1');
    expect(json.args3).toEqual([{ type: 'input_statement', name: 'else' }]);
    expect(json.nextStatement).toBeNull();
    const loop = toBlocklyJson(forever, 'en');
    expect('nextStatement' in loop).toBe(false);
    expect(loop.previousStatement).toBeNull();
  });

  it('gives hat blocks only a next connection', () => {
    const definition = defaultRegistry.get('events.whenGameStarts');
    if (!definition) throw new Error('missing block');
    const json = toBlocklyJson(definition, 'en');
    expect(json.nextStatement).toBeNull();
    expect('previousStatement' in json).toBe(false);
    expect(json.message0).toBe('when game starts');
  });

  it('puts statement inputs of C blocks on their own rows', () => {
    const loop = defineBlock({
      id: 'control.loopForTest',
      category: 'control',
      shape: 'c',
      inputs: { SUBSTACK: { type: 'statement' } },
      text: { de: 'wiederhole fortlaufend', en: 'forever' },
      compile: ({ SUBSTACK }) => `while (true) {\n${SUBSTACK}\nyield;\n}`,
      docs: { de: 'Endlos.', en: 'Forever.' },
      since: 1,
    });
    const json = toBlocklyJson(loop, 'de');
    expect(json.message1).toBe('%1');
    expect(json.args1).toEqual([{ type: 'input_statement', name: 'SUBSTACK' }]);
  });

  it('escapes percent signs in block texts', () => {
    const block = defineBlock({
      id: 'looks.percentForTest',
      category: 'looks',
      shape: 'stack',
      inputs: { percent: { type: 'number', default: 100 } },
      text: { de: 'setze Grösse auf {percent} %', en: 'set size to {percent} %' },
      compile: ({ percent }) => `self.setSize(${percent});`,
      docs: { de: 'Grösse.', en: 'Size.' },
      since: 1,
    });
    expect(toBlocklyJson(block, 'en').message0).toBe('set size to %1 %%');
  });

  it('works for every catalog block in every language', () => {
    for (const definition of BLOCK_CATALOG) {
      for (const locale of LOCALES) {
        expect(() => toBlocklyJson(definition, locale)).not.toThrow();
      }
    }
  });
});

describe('buildToolbox', () => {
  it('lists only categories with visible blocks and adds shadows', () => {
    const toolbox = buildToolbox(defaultRegistry, { locale: 'de', area: null });
    expect(toolbox.contents.map((category) => category.toolboxitemid)).toEqual([
      'events',
      'motion',
      'looks',
      'control',
      'sensing',
      'operators',
      'variables',
      'player',
      'camera',
      'character',
      'physics',
      'environment',
      'effects',
    ]);
    const motion = toolbox.contents.find((category) => category.toolboxitemid === 'motion');
    expect(motion?.name).toBe('Bewegung');
    expect(motion?.contents?.[0]).toEqual({
      kind: 'block',
      type: 'motion.move',
      inputs: { meters: { shadow: { type: 'literal.number', fields: { NUM: 1 } } } },
    });
    const operators = toolbox.contents.find((category) => category.toolboxitemid === 'operators');
    expect(operators?.contents?.find((block) => block.type === 'operators.eq')).toEqual({
      kind: 'block',
      type: 'operators.eq',
      inputs: {
        a: { shadow: { type: 'literal.text', fields: { TEXT: '' } } },
        b: { shadow: { type: 'literal.text', fields: { TEXT: '50' } } },
      },
    });
  });

  it('builds the variables category through the editor flyout callback', () => {
    const toolbox = buildToolbox(defaultRegistry, { locale: 'en', area: null });
    const variables = toolbox.contents.find((category) => category.toolboxitemid === 'variables');
    expect(variables?.custom).toBe(VARIABLES_FLYOUT);
    expect(variables?.contents).toBeUndefined();
  });

  it('puts the categories of the active area first', () => {
    expect(orderCategories('player').slice(0, 5)).toEqual([
      'player',
      'character',
      'motion',
      'camera',
      'looks',
    ]);
    expect(orderCategories(null)).toEqual(CATEGORIES.map((category) => category.id));
    const toolbox = buildToolbox(defaultRegistry, { locale: 'en', area: 'player' });
    expect(toolbox.contents.slice(0, 5).map((category) => category.toolboxitemid)).toEqual([
      'player',
      'character',
      'motion',
      'camera',
      'looks',
    ]);
  });

  it('sorts blocks marked for the area to the top of their category', () => {
    const registry = new BlockRegistry([
      defineBlock({
        id: 'motion.other',
        category: 'motion',
        shape: 'stack',
        inputs: {},
        text: { de: 'anders', en: 'other' },
        compile: () => '',
        docs: { de: 'x', en: 'x' },
        since: 1,
        areas: ['npc'],
      }),
      ...BLOCK_CATALOG,
    ]);
    const motion = buildToolbox(registry, { locale: 'en', area: 'npc' }).contents.find(
      (category) => category.toolboxitemid === 'motion',
    );
    expect(motion?.contents?.slice(0, 4).map((block) => block.type)).toEqual([
      'motion.other',
      'motion.move',
      'motion.turn',
      'motion.lookAt',
    ]);
  });
});

describe('search', () => {
  it('finds blocks by label words and keywords in both languages', () => {
    const de = buildSearchIndex(defaultRegistry, 'de');
    expect(searchBlocks(de, 'gehe meter')[0]?.id).toBe('motion.move');
    expect(searchBlocks(de, 'lauf')[0]?.id).toBe('motion.move');
    expect(searchBlocks(de, 'wenn spiel')[0]?.id).toBe('events.whenGameStarts');
    const en = buildSearchIndex(defaultRegistry, 'en');
    expect(searchBlocks(en, 'walk')[0]?.label).toBe('move ( ) m [forward]');
    expect(searchBlocks(en, 'modulo')[0]?.id).toBe('operators.mod');
    expect(searchBlocks(en, 'zzz')).toEqual([]);
  });

  it('does not index hidden blocks', () => {
    const ids = buildSearchIndex(defaultRegistry, 'en').map((entry) => entry.id);
    expect(ids).not.toContain('literal.number');
    expect(ids).not.toContain('literal.text');
  });
});

describe('BlockRegistry', () => {
  it('rejects duplicate ids', () => {
    expect(() => new BlockRegistry([...BLOCK_CATALOG, ...BLOCK_CATALOG])).toThrow(/Duplicate/);
  });
});
