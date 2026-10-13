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
} from '../src';

describe('toBlocklyJson', () => {
  it('generates the stack block from SPEC 7.10', () => {
    const definition = defaultRegistry.get('motion.moveForward');
    expect(definition).toBeDefined();
    if (!definition) return;
    expect(toBlocklyJson(definition, 'de')).toEqual({
      type: 'motion.moveForward',
      colour: '#3f7fe0',
      tooltip: 'Bewegt das Objekt in Blickrichtung.',
      inputsInline: true,
      message0: 'gehe %1 Meter vorwärts',
      args0: [{ type: 'input_value', name: 'meters', check: ['Number', 'String'] }],
      previousStatement: null,
      nextStatement: null,
    });
    expect(toBlocklyJson(definition, 'en').message0).toBe('move %1 m forward');
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
      id: 'control.forever',
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
      id: 'looks.setSize',
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
  it('lists only categories with visible blocks and adds number shadows', () => {
    const toolbox = buildToolbox(defaultRegistry, { locale: 'de', area: null });
    expect(toolbox.contents.map((category) => category.toolboxitemid)).toEqual([
      'events',
      'motion',
    ]);
    const motion = toolbox.contents.find((category) => category.toolboxitemid === 'motion');
    expect(motion?.name).toBe('Bewegung');
    expect(motion?.contents[0]).toEqual({
      kind: 'block',
      type: 'motion.moveForward',
      inputs: { meters: { shadow: { type: 'literal.number', fields: { NUM: 1 } } } },
    });
  });

  it('puts the categories of the active area first', () => {
    expect(orderCategories('player').slice(0, 4)).toEqual(['player', 'motion', 'camera', 'looks']);
    expect(orderCategories(null)).toEqual(CATEGORIES.map((category) => category.id));
    const toolbox = buildToolbox(defaultRegistry, { locale: 'en', area: 'player' });
    expect(toolbox.contents[0]?.toolboxitemid).toBe('motion');
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
      }),
      ...BLOCK_CATALOG,
    ]);
    const motion = buildToolbox(registry, { locale: 'en', area: 'npc' }).contents.find(
      (category) => category.toolboxitemid === 'motion',
    );
    expect(motion?.contents.map((block) => block.type)).toEqual([
      'motion.moveForward',
      'motion.other',
    ]);
  });
});

describe('search', () => {
  it('finds blocks by label words and keywords in both languages', () => {
    const de = buildSearchIndex(defaultRegistry, 'de');
    expect(searchBlocks(de, 'gehe')[0]?.id).toBe('motion.moveForward');
    expect(searchBlocks(de, 'lauf')[0]?.id).toBe('motion.moveForward');
    expect(searchBlocks(de, 'wenn spiel')[0]?.id).toBe('events.whenGameStarts');
    const en = buildSearchIndex(defaultRegistry, 'en');
    expect(searchBlocks(en, 'walk')[0]?.label).toBe('move ( ) m forward');
    expect(searchBlocks(en, 'zzz')).toEqual([]);
  });

  it('does not index hidden blocks', () => {
    const ids = buildSearchIndex(defaultRegistry, 'en').map((entry) => entry.id);
    expect(ids).not.toContain('literal.number');
  });
});

describe('BlockRegistry', () => {
  it('rejects duplicate ids', () => {
    expect(() => new BlockRegistry([...BLOCK_CATALOG, ...BLOCK_CATALOG])).toThrow(/Duplicate/);
  });
});
