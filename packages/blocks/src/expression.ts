/**
 * Typing expressions instead of dragging operator blocks (SPEC 7.8): `x/2 + 10` becomes a tree of
 * operator blocks. The parser is a pure function; the editor gives it the names it can resolve
 * and puts the resulting block tree into the workspace.
 */

/** A parsed expression. */
export type Expression =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'unary'; readonly op: '-' | 'not'; readonly operand: Expression }
  | {
      readonly kind: 'binary';
      readonly op: BinaryOperator;
      readonly left: Expression;
      readonly right: Expression;
    }
  | { readonly kind: 'call'; readonly name: string; readonly args: readonly Expression[] };

/** Operators between two values. */
export type BinaryOperator =
  '+' | '-' | '*' | '/' | '%' | '<' | '>' | '<=' | '>=' | '=' | '!=' | 'and' | 'or' | '&';

/** Thrown when a text is not an expression. `position` is the index of the problem. */
export class ExpressionError extends Error {
  override readonly name = 'ExpressionError';
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
  }
}

type Token =
  | { readonly type: 'number'; readonly value: number; readonly at: number }
  | { readonly type: 'text'; readonly value: string; readonly at: number }
  | { readonly type: 'word'; readonly value: string; readonly at: number }
  | { readonly type: 'op'; readonly value: string; readonly at: number };

const LOGIC_WORDS: Readonly<Record<string, 'and' | 'or' | 'not'>> = {
  and: 'and',
  und: 'and',
  or: 'or',
  oder: 'or',
  not: 'not',
  nicht: 'not',
};
const OPERATOR_CHARS = '+-*/%()<>=!,&';

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source.charAt(i);
    if (/\s/.test(char)) {
      i++;
    } else if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(source.charAt(i + 1)))) {
      const match = /^(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?/i.exec(source.slice(i));
      const text = match?.[0] ?? char;
      tokens.push({ type: 'number', value: Number(text.replace(',', '.')), at: i });
      i += text.length;
    } else if (char === '"' || char === "'") {
      let j = i + 1;
      let text = '';
      while (j < source.length && source.charAt(j) !== char) {
        text += source.charAt(j);
        j++;
      }
      if (j >= source.length) throw new ExpressionError('Unterminated text.', i);
      tokens.push({ type: 'text', value: text, at: i });
      i = j + 1;
    } else if (/[\p{L}_]/u.test(char)) {
      // A name may hold single spaces ("Anzahl Leben"), but "and", "or" and "not" end it.
      let j = i;
      let end = i;
      let first = true;
      for (;;) {
        const match = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(source.slice(j));
        if (!match) break;
        if (!first && LOGIC_WORDS[match[0].toLowerCase()]) break;
        end = j + match[0].length;
        if (LOGIC_WORDS[match[0].toLowerCase()]) break;
        first = false;
        if (source.charAt(end) !== ' ') break;
        j = end + 1;
      }
      tokens.push({ type: 'word', value: source.slice(i, end), at: i });
      i = end;
    } else if (OPERATOR_CHARS.includes(char)) {
      const two = source.slice(i, i + 2);
      if (two === '<=' || two === '>=' || two === '!=' || two === '==') {
        tokens.push({ type: 'op', value: two === '==' ? '=' : two, at: i });
        i += 2;
      } else {
        tokens.push({ type: 'op', value: char, at: i });
        i++;
      }
    } else {
      throw new ExpressionError(`Unexpected "${char}".`, i);
    }
  }
  return tokens;
}

class Parser {
  private index = 0;
  constructor(
    private readonly tokens: readonly Token[],
    private readonly length: number,
  ) {}

  parse(): Expression {
    const expression = this.or();
    const rest = this.tokens[this.index];
    if (rest) throw new ExpressionError('Unexpected input.', rest.at);
    return expression;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isOp(...values: string[]): boolean {
    const token = this.peek();
    return token?.type === 'op' && values.includes(token.value);
  }

  private isWord(word: 'and' | 'or' | 'not'): boolean {
    const token = this.peek();
    return token?.type === 'word' && LOGIC_WORDS[token.value.toLowerCase()] === word;
  }

  private or(): Expression {
    let left = this.and();
    while (this.isWord('or')) {
      this.index++;
      left = { kind: 'binary', op: 'or', left, right: this.and() };
    }
    return left;
  }

  private and(): Expression {
    let left = this.not();
    while (this.isWord('and')) {
      this.index++;
      left = { kind: 'binary', op: 'and', left, right: this.not() };
    }
    return left;
  }

  private not(): Expression {
    if (this.isWord('not')) {
      this.index++;
      return { kind: 'unary', op: 'not', operand: this.not() };
    }
    return this.comparison();
  }

  private comparison(): Expression {
    const left = this.sum();
    if (this.isOp('<', '>', '<=', '>=', '=', '!=')) {
      const op = (this.tokens[this.index++] as Token).value as BinaryOperator;
      return { kind: 'binary', op, left, right: this.sum() };
    }
    return left;
  }

  private sum(): Expression {
    let left = this.product();
    while (this.isOp('+', '-', '&')) {
      const op = (this.tokens[this.index++] as Token).value as BinaryOperator;
      left = { kind: 'binary', op, left, right: this.product() };
    }
    return left;
  }

  private product(): Expression {
    let left = this.unary();
    while (this.isOp('*', '/', '%')) {
      const op = (this.tokens[this.index++] as Token).value as BinaryOperator;
      left = { kind: 'binary', op, left, right: this.unary() };
    }
    return left;
  }

  private unary(): Expression {
    if (this.isOp('-')) {
      this.index++;
      const operand = this.unary();
      return operand.kind === 'number'
        ? { kind: 'number', value: -operand.value }
        : { kind: 'unary', op: '-', operand };
    }
    if (this.isOp('+')) {
      this.index++;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): Expression {
    const token = this.peek();
    if (!token) throw new ExpressionError('The expression ends too early.', this.length);
    this.index++;
    if (token.type === 'number') return { kind: 'number', value: token.value };
    if (token.type === 'text') return { kind: 'text', value: token.value };
    if (token.type === 'word') {
      if (this.isOp('(')) {
        this.index++;
        const args: Expression[] = [];
        if (!this.isOp(')')) {
          args.push(this.or());
          while (this.isOp(',')) {
            this.index++;
            args.push(this.or());
          }
        }
        if (!this.isOp(')'))
          throw new ExpressionError('Missing ")".', this.peek()?.at ?? this.length);
        this.index++;
        return { kind: 'call', name: token.value, args };
      }
      return { kind: 'name', name: token.value };
    }
    if (token.value === '(') {
      const inner = this.or();
      if (!this.isOp(')'))
        throw new ExpressionError('Missing ")".', this.peek()?.at ?? this.length);
      this.index++;
      return inner;
    }
    throw new ExpressionError(`Unexpected "${token.value}".`, token.at);
  }
}

/** Parses an expression such as `x/2 + 10`. Throws {@link ExpressionError}. */
export function parseExpression(source: string): Expression {
  return new Parser(tokenize(source), source.length).parse();
}

/** Whether a text is just a number (so no blocks are needed). */
export function isPlainNumber(source: string): boolean {
  return /^\s*[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?\s*$/i.test(source);
}

/** Whether a text looks like something typed to be an expression rather than a block search. */
export function looksLikeExpression(source: string): boolean {
  const text = source.trim();
  if (text === '') return false;
  if (isPlainNumber(text)) return false;
  return (
    /[+\-*/%()<>=!&"']/.test(text) &&
    /[\p{L}\p{N}"']/u.test(text) &&
    /^[^\p{L}]*[\p{L}\p{N}"'(.-]/u.test(text)
  );
}

/** A block in Blockly's JSON form (what `Blockly.serialization.blocks.append` takes). */
export interface BlockState {
  type: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlockState; shadow?: BlockState }>;
}

/** What names in an expression mean. */
export interface ExpressionScope {
  /** The ID of the variable of the script with this name (compared without case), or `null`. */
  variable(name: string): string | null;
  /** Whether a local variable or parameter with this name exists where the expression goes. */
  local(name: string): boolean;
  /** Whether a parameter of the custom block with this name exists. */
  param(name: string): boolean;
}

const MATH_FUNCTIONS = [
  'abs',
  'floor',
  'ceiling',
  'sqrt',
  'sin',
  'cos',
  'tan',
  'ln',
  'exp',
] as const;

function number(value: number): { shadow: BlockState } {
  return { shadow: { type: 'literal.number', fields: { NUM: value } } };
}

function text(value: string): { shadow: BlockState } {
  return { shadow: { type: 'literal.text', fields: { TEXT: value } } };
}

function slot(
  node: Expression,
  scope: ExpressionScope,
): { block?: BlockState; shadow?: BlockState } {
  if (node.kind === 'number') return number(node.value);
  if (node.kind === 'text') return text(node.value);
  return { block: toBlocks(node, scope) };
}

/** A slot that takes a condition: numbers and text cannot go there. */
function conditionSlot(
  node: Expression,
  scope: ExpressionScope,
): { block?: BlockState; shadow?: BlockState } {
  if (node.kind === 'number' || node.kind === 'text') {
    throw new ExpressionError('A condition is expected here.', 0);
  }
  return { block: toBlocks(node, scope) };
}

function binary(
  type: string,
  left: Expression,
  right: Expression,
  scope: ExpressionScope,
): BlockState {
  return { type, inputs: { a: slot(left, scope), b: slot(right, scope) } };
}

/**
 * Builds the operator blocks for an expression. Numbers and text become shadow blocks inside the
 * slots; names become variable, local or input blocks. Throws {@link ExpressionError} for a name
 * or function that does not exist.
 */
export function toBlocks(node: Expression, scope: ExpressionScope): BlockState {
  switch (node.kind) {
    case 'number':
      return { type: 'operators.add', inputs: { a: number(node.value), b: number(0) } };
    case 'text':
      return { type: 'operators.join', inputs: { a: text(node.value), b: text('') } };
    case 'name': {
      if (scope.param(node.name)) return { type: 'custom.param', fields: { name: node.name } };
      if (scope.local(node.name)) return { type: 'locals.get', fields: { name: node.name } };
      const id = scope.variable(node.name);
      if (id) return { type: 'variables.get', fields: { variable: { id } } };
      throw new ExpressionError(`Unknown name "${node.name}".`, 0);
    }
    case 'unary':
      return node.op === 'not'
        ? { type: 'operators.not', inputs: { value: conditionSlot(node.operand, scope) } }
        : binary('operators.subtract', { kind: 'number', value: 0 }, node.operand, scope);
    case 'binary':
      switch (node.op) {
        case '+':
          return binary('operators.add', node.left, node.right, scope);
        case '-':
          return binary('operators.subtract', node.left, node.right, scope);
        case '*':
          return binary('operators.multiply', node.left, node.right, scope);
        case '/':
          return binary('operators.divide', node.left, node.right, scope);
        case '%':
          return binary('operators.mod', node.left, node.right, scope);
        case '&':
          return binary('operators.join', node.left, node.right, scope);
        case '<':
          return binary('operators.lt', node.left, node.right, scope);
        case '>':
          return binary('operators.gt', node.left, node.right, scope);
        case '=':
          return binary('operators.eq', node.left, node.right, scope);
        case '<=':
          return {
            type: 'operators.not',
            inputs: { value: { block: binary('operators.gt', node.left, node.right, scope) } },
          };
        case '>=':
          return {
            type: 'operators.not',
            inputs: { value: { block: binary('operators.lt', node.left, node.right, scope) } },
          };
        case '!=':
          return {
            type: 'operators.not',
            inputs: { value: { block: binary('operators.eq', node.left, node.right, scope) } },
          };
        case 'and':
        case 'or':
          return {
            type: `operators.${node.op}`,
            inputs: {
              a: conditionSlot(node.left, scope),
              b: conditionSlot(node.right, scope),
            },
          };
      }
      break;
    case 'call': {
      const name = node.name.toLowerCase();
      const [first, second, third] = node.args;
      if ((MATH_FUNCTIONS as readonly string[]).includes(name) && first && node.args.length === 1) {
        return {
          type: 'operators.mathFunction',
          fields: { fn: name },
          inputs: { value: slot(first, scope) },
        };
      }
      if (name === 'round' && first && node.args.length === 1) {
        return { type: 'operators.round', inputs: { value: slot(first, scope) } };
      }
      if ((name === 'min' || name === 'max') && first && second && node.args.length === 2) {
        return binary(`operators.${name}`, first, second, scope);
      }
      if (name === 'clamp' && first && second && third && node.args.length === 3) {
        return {
          type: 'operators.clamp',
          inputs: { value: slot(first, scope), low: slot(second, scope), high: slot(third, scope) },
        };
      }
      throw new ExpressionError(`Unknown function "${node.name}".`, 0);
    }
  }
  throw new ExpressionError('Unsupported expression.', 0);
}

/** Parses a text and builds its blocks in one go. Throws {@link ExpressionError}. */
export function expressionToBlocks(source: string, scope: ExpressionScope): BlockState {
  return toBlocks(parseExpression(source), scope);
}
