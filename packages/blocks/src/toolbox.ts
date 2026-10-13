import { AREA_CATEGORIES, CATEGORIES } from './categories';
import type { BlockRegistry } from './registry';
import type { AreaKind, BlockDefinition, CategoryId, Locale } from './types';

/** A block entry in a Blockly toolbox, including shadow blocks for its slots. */
export interface ToolboxBlockJson {
  readonly kind: 'block';
  readonly type: string;
  readonly inputs?: Readonly<
    Record<
      string,
      { readonly shadow: { readonly type: string; readonly fields: Record<string, unknown> } }
    >
  >;
}

/** A category of a Blockly toolbox. */
export interface ToolboxCategoryJson {
  readonly kind: 'category';
  readonly name: string;
  readonly colour: string;
  readonly categorystyle?: string;
  readonly toolboxitemid: CategoryId;
  readonly contents: readonly ToolboxBlockJson[];
}

/** A Blockly category toolbox. */
export interface ToolboxJson {
  readonly kind: 'categoryToolbox';
  readonly contents: readonly ToolboxCategoryJson[];
}

/** Options for {@link buildToolbox}. */
export interface ToolboxOptions {
  readonly locale: Locale;
  /** Active area kind. `null` (tab "All") keeps the default order. */
  readonly area: AreaKind | null;
}

function toolboxBlock(definition: BlockDefinition): ToolboxBlockJson {
  const inputs: Record<string, { shadow: { type: string; fields: Record<string, unknown> } }> = {};
  for (const [name, input] of Object.entries(definition.inputs)) {
    if (input.type === 'number') {
      inputs[name] = { shadow: { type: 'literal.number', fields: { NUM: input.default } } };
    } else if (input.type === 'string') {
      inputs[name] = { shadow: { type: 'literal.text', fields: { TEXT: input.default } } };
    }
  }
  return Object.keys(inputs).length > 0
    ? { kind: 'block', type: definition.id, inputs }
    : { kind: 'block', type: definition.id };
}

/**
 * Orders categories for an area: categories of the area first (SPEC 5.3), then the
 * remaining ones in the default order.
 */
export function orderCategories(area: AreaKind | null): CategoryId[] {
  const preferred = area ? AREA_CATEGORIES[area] : [];
  const rest = CATEGORIES.map((category) => category.id).filter((id) => !preferred.includes(id));
  return [...preferred, ...rest];
}

/**
 * Builds the block palette (Blockly toolbox JSON) for an area. Only categories with visible
 * blocks are included; blocks marked for the area come first within their category.
 */
export function buildToolbox(registry: BlockRegistry, options: ToolboxOptions): ToolboxJson {
  const visible = registry.all().filter((definition) => !definition.hidden);
  const contents: ToolboxCategoryJson[] = [];
  for (const categoryId of orderCategories(options.area)) {
    const blocks = visible.filter((definition) => definition.category === categoryId);
    if (blocks.length === 0) continue;
    const area = options.area;
    const sorted = area
      ? [
          ...blocks.filter((definition) => definition.areas?.includes(area)),
          ...blocks.filter((definition) => !definition.areas?.includes(area)),
        ]
      : blocks;
    const category = CATEGORIES.find((candidate) => candidate.id === categoryId);
    if (!category) continue;
    contents.push({
      kind: 'category',
      name: category.name[options.locale],
      colour: category.color,
      toolboxitemid: categoryId,
      contents: sorted.map(toolboxBlock),
    });
  }
  return { kind: 'categoryToolbox', contents };
}
