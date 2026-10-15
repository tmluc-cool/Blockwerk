import type { DialogAction, DialogCondition, DialogData, DialogNode } from '@blockwerk/project';

/** What a dialog needs from the game while it runs. */
export interface DialogHost {
  /** Whether the player carries at least `count` of an item. */
  hasItem(item: string, count: number): boolean;
  /** Value of a game variable. */
  variable(id: string): string | number | boolean | undefined;
  /** Does what a line or answer asks for (give an item, set a variable, send a message …). */
  perform(action: DialogAction): void;
  /** Called when the player picks an answer. */
  answered(answerId: string): void;
}

/** One answer the player can pick right now. */
export interface DialogChoice {
  /** Position in the list (what `choose` takes). */
  readonly index: number;
  readonly id: string;
  readonly text: string;
}

/** What the dialog box shows. */
export interface DialogView {
  readonly speaker: string;
  readonly text: string;
  /** Empty for a line that only continues. */
  readonly choices: readonly DialogChoice[];
  /** The answer the keyboard or gamepad has highlighted. */
  readonly selected: number;
}

const MAX_STEPS = 200;

/** Compares a game variable with a value like the "=" and ">" blocks do. */
function compare(
  left: string | number | boolean | undefined,
  op: '==' | '!=' | '>' | '<' | '>=' | '<=',
  right: string | number | boolean,
): boolean {
  const a = left ?? 0;
  const numeric = typeof a !== 'string' && typeof right !== 'string';
  const x = numeric ? Number(a) : String(a).toLowerCase();
  const y = numeric ? Number(right) : String(right).toLowerCase();
  switch (op) {
    case '==':
      return x === y;
    case '!=':
      return x !== y;
    case '>':
      return x > y;
    case '<':
      return x < y;
    case '>=':
      return x >= y;
    case '<=':
      return x <= y;
  }
}

/** Evaluates a condition of an answer. */
export function conditionHolds(condition: DialogCondition, host: DialogHost): boolean {
  if (condition.type === 'hasItem') return host.hasItem(condition.item, condition.count);
  return compare(host.variable(condition.variable), condition.op, condition.value);
}

/**
 * A running conversation (SPEC 8.8: Dialog editor): walks the lines of a dialog asset, shows
 * only the answers whose condition holds and does the actions of lines and answers.
 */
export class DialogSession {
  private nodeId: string | null;
  private visible: { id: string; text: string; source: number }[] = [];
  private highlighted = 0;
  private finished = false;

  constructor(
    private readonly data: DialogData,
    private readonly host: DialogHost,
  ) {
    this.nodeId = null;
    this.enter(data.start);
  }

  /** Whether the conversation is over. */
  get done(): boolean {
    return this.finished;
  }

  /** What to show now, or `null` once the conversation is over. */
  view(): DialogView | null {
    const node = this.node();
    if (this.finished || !node) return null;
    return {
      speaker: node.speaker,
      text: node.text,
      choices: this.visible.map((choice, index) => ({ index, id: choice.id, text: choice.text })),
      selected: this.highlighted,
    };
  }

  /** Moves the highlight through the answers. */
  move(delta: number): void {
    const count = this.visible.length;
    if (count === 0) return;
    this.highlighted = (((this.highlighted + delta) % count) + count) % count;
  }

  /** Picks the highlighted answer, or continues after a line without answers. */
  confirm(): void {
    this.choose(this.highlighted);
  }

  /** Picks an answer by its position; for a line without answers any index continues. */
  choose(index: number): void {
    const node = this.node();
    if (this.finished || !node) return;
    if (this.visible.length === 0) {
      this.go(node.next ?? null);
      return;
    }
    const picked = this.visible[index];
    const answer = picked ? node.answers[picked.source] : undefined;
    if (!picked || !answer) return;
    for (const action of answer.actions ?? []) this.host.perform(action);
    this.host.answered(answer.id);
    this.go(answer.next);
  }

  private node(): DialogNode | undefined {
    return this.nodeId === null ? undefined : this.data.nodes[this.nodeId];
  }

  private go(next: string | null): void {
    if (next === null || !(next in this.data.nodes)) {
      this.finished = true;
      this.nodeId = null;
      this.visible = [];
      return;
    }
    this.enter(next);
  }

  /** Shows a line: runs its actions and collects the answers that may appear. */
  private enter(id: string): void {
    let steps = 0;
    let target: string | null = id;
    // A line without text and answers that leads on is skipped (a pure "do this" step).
    while (target !== null && steps++ < MAX_STEPS) {
      const node: DialogNode | undefined = this.data.nodes[target];
      if (!node) break;
      for (const action of node.actions ?? []) this.host.perform(action);
      const visible = node.answers
        .map((answer, source) => ({ id: answer.id, text: answer.text, source, answer }))
        .filter(({ answer }) => !answer.condition || conditionHolds(answer.condition, this.host))
        .map(({ id: answerId, text, source }) => ({ id: answerId, text, source }));
      if (node.text === '' && node.answers.length === 0 && node.next) {
        target = node.next;
        continue;
      }
      this.nodeId = target;
      this.visible = visible;
      this.highlighted = 0;
      return;
    }
    this.finished = true;
    this.nodeId = null;
    this.visible = [];
  }
}
