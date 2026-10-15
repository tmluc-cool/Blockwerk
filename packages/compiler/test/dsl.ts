/**
 * Tiny builder for Blockly workspace JSON in tests. Numbers in value inputs become number
 * shadows, strings become text shadows, arrays are statement bodies.
 */
export interface TestBlock {
  type: string;
  id: string;
  fields?: Record<string, unknown>;
  extraState?: unknown;
  inputs?: Record<string, { shadow?: TestBlock; block?: TestBlock }>;
  next?: { block: TestBlock };
}

/** A value for a block input. */
export type TestInput = number | string | TestBlock | readonly TestBlock[] | undefined;

let counter = 0;

function nextId(): string {
  counter += 1;
  return `t-${counter}`;
}

/** Creates a block. */
export function b(
  type: string,
  fields: Record<string, unknown> = {},
  inputs: Record<string, TestInput> = {},
): TestBlock {
  const block: TestBlock = { type, id: nextId() };
  if (Object.keys(fields).length > 0) block.fields = fields;
  const connections: Record<string, { shadow?: TestBlock; block?: TestBlock }> = {};
  for (const [name, value] of Object.entries(inputs)) {
    if (value === undefined) continue;
    if (typeof value === 'number') {
      connections[name] = {
        shadow: { type: 'literal.number', id: nextId(), fields: { NUM: value } },
      };
    } else if (typeof value === 'string') {
      connections[name] = {
        shadow: { type: 'literal.text', id: nextId(), fields: { TEXT: value } },
      };
    } else if (isBlockList(value)) {
      const first = chain(...value);
      if (first) connections[name] = { block: first };
    } else {
      connections[name] = { block: value };
    }
  }
  if (Object.keys(connections).length > 0) block.inputs = connections;
  return block;
}

function isBlockList(value: TestBlock | readonly TestBlock[]): value is readonly TestBlock[] {
  return Array.isArray(value);
}

/** Links blocks into a stack and returns the first one. */
export function chain(...blocks: readonly TestBlock[]): TestBlock | undefined {
  for (let i = blocks.length - 2; i >= 0; i--) {
    const block = blocks[i];
    const following = blocks[i + 1];
    if (block && following) block.next = { block: following };
  }
  return blocks[0];
}

/** A workspace with one script per argument (hat block first). */
export function workspace(...scripts: readonly (readonly TestBlock[])[]): unknown {
  const tops = scripts.map((blocks) => chain(...blocks)).filter((block) => block !== undefined);
  return { blocks: { languageVersion: 0, blocks: tops } };
}

/** Reads a variable. */
export function get(id: string): TestBlock {
  return b('variables.get', { variable: { id } });
}

/** Sets a variable. */
export function set(id: string, value: TestInput): TestBlock {
  return b('variables.set', { variable: { id } }, { value });
}

/** A custom block definition; `state` has the `params`, `returns`, `warp` and `scope`. */
export function define(
  kind: 'Command' | 'Value' | 'Condition',
  name: string,
  id: string,
  state: Record<string, unknown> = {},
): TestBlock {
  return { type: `custom.define${kind}`, id, fields: { name }, extraState: state };
}

/** A call of a custom block; `fn` is the ID of its definition block. */
export function call(
  kind: 'Command' | 'Value' | 'Condition',
  fn: string,
  args: TestInput[] = [],
  library?: string,
): TestBlock {
  const inputs: Record<string, TestInput> = {};
  args.forEach((arg, index) => {
    inputs[`ARG${index}`] = arg;
  });
  const block = b(`custom.call${kind}`, {}, inputs);
  block.extraState = library === undefined ? { fn } : { fn, library };
  return block;
}

/** The value of a parameter of the custom block this block sits in. */
export function param(name: string): TestBlock {
  return b('custom.param', { name });
}
