import { assetDisplayName } from '@blockwerk/project';
import type {
  DialogAction,
  DialogAnswer,
  DialogCondition,
  DialogData,
  DialogNode,
} from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { updateDialog, useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { useT } from '../state/settings';

type Translate = ReturnType<typeof useT>;

interface GameVariable {
  readonly id: string;
  readonly name: string;
}

/** Makes a short ID from the text of an answer (used by "when dialog answer …"). */
function slug(text: string, taken: ReadonlySet<string>): string {
  const base =
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24) || 'antwort';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

function newNodeId(data: DialogData): string {
  for (let n = Object.keys(data.nodes).length + 1; ; n++) {
    if (!(`line${n}` in data.nodes)) return `line${n}`;
  }
}

const ACTION_TYPES = [
  'setVariable',
  'addItem',
  'removeItem',
  'sendMessage',
  'startTimer',
  'changeState',
] as const;

function blankAction(type: DialogAction['type']): DialogAction {
  switch (type) {
    case 'setVariable':
      return { type, variable: '', value: 1 };
    case 'addItem':
    case 'removeItem':
      return { type, item: 'key', count: 1 };
    case 'sendMessage':
      return { type, message: 'ok', target: 'all' };
    case 'startTimer':
      return { type, name: 'timer1', seconds: 5 };
    case 'changeState':
      return { type, target: 'self', state: 'idle' };
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="dialog-field">
      <span className="muted">{label}</span>
      {children}
    </label>
  );
}

/** Parses the text of a value field: numbers and true/false keep their type. */
function parseValue(text: string): string | number | boolean {
  if (text === 'true') return true;
  if (text === 'false') return false;
  const number = Number(text);
  return text.trim() !== '' && Number.isFinite(number) ? number : text;
}

function ActionRow({
  action,
  variables,
  t,
  testId,
  onChange,
  onRemove,
}: {
  action: DialogAction;
  variables: readonly GameVariable[];
  t: Translate;
  testId: string;
  onChange: (action: DialogAction) => void;
  onRemove: () => void;
}) {
  return (
    <div className="dialog-row" data-testid={testId}>
      <select
        value={action.type}
        data-testid={`${testId}-type`}
        onChange={(event) => onChange(blankAction(event.target.value as DialogAction['type']))}
      >
        {ACTION_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`dialog.action.${type}`)}
          </option>
        ))}
      </select>
      {action.type === 'setVariable' && (
        <>
          <select
            value={action.variable}
            onChange={(event) => onChange({ ...action, variable: event.target.value })}
          >
            <option value="">{t('dialog.chooseVariable')}</option>
            {variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.name}
              </option>
            ))}
          </select>
          <input
            value={String(action.value)}
            aria-label={t('dialog.value')}
            onChange={(event) => onChange({ ...action, value: parseValue(event.target.value) })}
          />
        </>
      )}
      {(action.type === 'addItem' || action.type === 'removeItem') && (
        <>
          <input
            value={action.item}
            aria-label={t('dialog.item')}
            data-testid={`${testId}-item`}
            onChange={(event) => onChange({ ...action, item: event.target.value })}
          />
          <input
            type="number"
            min={1}
            value={action.count}
            aria-label={t('dialog.count')}
            onChange={(event) =>
              onChange({ ...action, count: Math.max(1, Math.round(Number(event.target.value))) })
            }
          />
        </>
      )}
      {action.type === 'sendMessage' && (
        <>
          <input
            value={action.message}
            aria-label={t('dialog.message')}
            onChange={(event) => onChange({ ...action, message: event.target.value })}
          />
          <input
            value={action.target}
            aria-label={t('dialog.target')}
            onChange={(event) => onChange({ ...action, target: event.target.value })}
          />
        </>
      )}
      {action.type === 'startTimer' && (
        <>
          <input
            value={action.name}
            aria-label={t('dialog.timerName')}
            onChange={(event) => onChange({ ...action, name: event.target.value })}
          />
          <input
            type="number"
            min={0}
            value={action.seconds}
            aria-label={t('dialog.seconds')}
            onChange={(event) =>
              onChange({ ...action, seconds: Math.max(0, Number(event.target.value)) })
            }
          />
        </>
      )}
      {action.type === 'changeState' && (
        <>
          <input
            value={action.target}
            aria-label={t('dialog.target')}
            onChange={(event) => onChange({ ...action, target: event.target.value })}
          />
          <input
            value={action.state}
            aria-label={t('dialog.state')}
            onChange={(event) => onChange({ ...action, state: event.target.value })}
          />
        </>
      )}
      <button
        type="button"
        className="icon-button flat"
        title={t('dialog.delete')}
        onClick={onRemove}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function ActionList({
  actions,
  variables,
  t,
  testId,
  onChange,
}: {
  actions: readonly DialogAction[];
  variables: readonly GameVariable[];
  t: Translate;
  testId: string;
  onChange: (actions: DialogAction[]) => void;
}) {
  return (
    <div className="dialog-actions">
      {actions.map((action, index) => (
        <ActionRow
          key={index}
          action={action}
          variables={variables}
          t={t}
          testId={`${testId}-${index}`}
          onChange={(next) => onChange(actions.map((item, i) => (i === index ? next : item)))}
          onRemove={() => onChange(actions.filter((_, i) => i !== index))}
        />
      ))}
      <button
        type="button"
        data-testid={`${testId}-add`}
        onClick={() => onChange([...actions, blankAction('addItem')])}
      >
        <Plus size={12} /> {t('dialog.addAction')}
      </button>
    </div>
  );
}

function ConditionRow({
  condition,
  variables,
  t,
  testId,
  onChange,
}: {
  condition: DialogCondition | undefined;
  variables: readonly GameVariable[];
  t: Translate;
  testId: string;
  onChange: (condition: DialogCondition | undefined) => void;
}) {
  return (
    <div className="dialog-row">
      <span className="muted">{t('dialog.condition')}</span>
      <select
        value={condition?.type ?? 'none'}
        data-testid={`${testId}-type`}
        onChange={(event) => {
          const type = event.target.value;
          if (type === 'hasItem') onChange({ type, item: 'key', count: 1 });
          else if (type === 'variable')
            onChange({ type, variable: variables[0]?.id ?? '', op: '==', value: 1 });
          else onChange(undefined);
        }}
      >
        <option value="none">{t('dialog.condition.none')}</option>
        <option value="hasItem">{t('dialog.condition.hasItem')}</option>
        <option value="variable">{t('dialog.condition.variable')}</option>
      </select>
      {condition?.type === 'hasItem' && (
        <>
          <input
            value={condition.item}
            aria-label={t('dialog.item')}
            data-testid={`${testId}-item`}
            onChange={(event) => onChange({ ...condition, item: event.target.value })}
          />
          <input
            type="number"
            min={1}
            value={condition.count}
            aria-label={t('dialog.count')}
            onChange={(event) =>
              onChange({ ...condition, count: Math.max(1, Math.round(Number(event.target.value))) })
            }
          />
        </>
      )}
      {condition?.type === 'variable' && (
        <>
          <select
            value={condition.variable}
            onChange={(event) => onChange({ ...condition, variable: event.target.value })}
          >
            <option value="">{t('dialog.chooseVariable')}</option>
            {variables.map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.name}
              </option>
            ))}
          </select>
          <select
            value={condition.op}
            onChange={(event) =>
              onChange({ ...condition, op: event.target.value as typeof condition.op })
            }
          >
            {(['==', '!=', '>', '<', '>=', '<='] as const).map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            value={String(condition.value)}
            aria-label={t('dialog.value')}
            onChange={(event) => onChange({ ...condition, value: parseValue(event.target.value) })}
          />
        </>
      )}
    </div>
  );
}

function AnswerCard({
  answer,
  nodes,
  variables,
  t,
  testId,
  onChange,
  onRemove,
}: {
  answer: DialogAnswer;
  nodes: readonly [string, DialogNode][];
  variables: readonly GameVariable[];
  t: Translate;
  testId: string;
  onChange: (answer: DialogAnswer) => void;
  onRemove: () => void;
}) {
  return (
    <div className="dialog-answer" data-testid={testId}>
      <div className="dialog-row">
        <input
          className="dialog-grow"
          value={answer.text}
          placeholder={t('dialog.answerText')}
          aria-label={t('dialog.answerText')}
          data-testid={`${testId}-text`}
          onChange={(event) => onChange({ ...answer, text: event.target.value })}
        />
        <Field label={t('dialog.answerId')}>
          <input
            value={answer.id}
            data-testid={`${testId}-id`}
            onChange={(event) => onChange({ ...answer, id: event.target.value })}
          />
        </Field>
        <Field label={t('dialog.next')}>
          <select
            value={answer.next ?? ''}
            data-testid={`${testId}-next`}
            onChange={(event) => onChange({ ...answer, next: event.target.value || null })}
          >
            <option value="">{t('dialog.end')}</option>
            {nodes.map(([id], index) => (
              <option key={id} value={id}>
                {t('dialog.lineNumber', { n: index + 1 })}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="icon-button flat"
          title={t('dialog.delete')}
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <ConditionRow
        condition={answer.condition}
        variables={variables}
        t={t}
        testId={`${testId}-condition`}
        onChange={(condition) => {
          const { condition: _removed, ...rest } = answer;
          onChange(condition ? { ...rest, condition } : rest);
        }}
      />
      <ActionList
        actions={answer.actions ?? []}
        variables={variables}
        t={t}
        testId={`${testId}-actions`}
        onChange={(actions) => {
          const { actions: _removed, ...rest } = answer;
          onChange(actions.length > 0 ? { ...rest, actions } : rest);
        }}
      />
    </div>
  );
}

/**
 * Dialog editor (SPEC 8.8): the lines of a conversation as cards. Each card has the speaker,
 * the text, the answers with their conditions and actions, and where every answer leads.
 */
export function DialogEditorPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const project = useDocument((state) => state.project);
  useDocument((state) => state.assetsVersion);
  const openId = useEditor((state) => state.openDialog);
  const entry = openId ? project?.assetOfType(openId, 'dialog') : undefined;
  if (!project || !entry) {
    return (
      <div className="panel dialog-editor" data-testid="dialog-editor">
        <div className="empty-hint">{t('dialog.empty')}</div>
      </div>
    );
  }
  const data = entry.data;
  const variables: GameVariable[] = project
    .assetsOfType('blockScript')
    .flatMap((script) => script.data.variables)
    .filter((variable) => variable.scope === 'game')
    .map((variable) => ({ id: variable.id, name: variable.name }));
  const save = (next: DialogData): void => updateDialog(entry.id, next);
  const nodes = Object.entries(data.nodes);
  const setNode = (id: string, node: DialogNode): void =>
    save({ ...data, nodes: { ...data.nodes, [id]: node } });
  const removeNode = (id: string): void => {
    const rest = Object.fromEntries(Object.entries(data.nodes).filter(([key]) => key !== id));
    const fixed = Object.fromEntries(
      Object.entries(rest).map(([key, node]) => [
        key,
        {
          ...node,
          next: node.next === id ? null : node.next,
          answers: node.answers.map((answer) =>
            answer.next === id ? { ...answer, next: null } : answer,
          ),
        },
      ]),
    );
    const start = data.start === id ? (Object.keys(fixed)[0] ?? data.start) : data.start;
    save({ ...data, start, nodes: fixed });
  };
  const takenIds = (): Set<string> =>
    new Set(nodes.flatMap(([, node]) => node.answers.map((answer) => answer.id)));
  return (
    <div className="panel dialog-editor" data-testid="dialog-editor">
      <div className="panel-toolbar">
        <strong data-testid="dialog-name">{assetDisplayName(entry.path)}</strong>
        <span className="toolbar-spacer" />
        <button
          type="button"
          data-testid="dialog-add-line"
          onClick={() => {
            const id = newNodeId(data);
            save({
              ...data,
              nodes: {
                ...data.nodes,
                [id]: { speaker: '', text: '', answers: [], x: 0, y: nodes.length * 40 },
              },
            });
          }}
        >
          <Plus size={13} /> {t('dialog.addLine')}
        </button>
      </div>
      <div className="dialog-cards">
        {nodes.map(([id, node], index) => (
          <section
            key={id}
            className={`dialog-card${id === data.start ? ' start' : ''}`}
            data-testid={`dialog-line-${index}`}
          >
            <header>
              <strong>{t('dialog.lineNumber', { n: index + 1 })}</strong>
              {id === data.start ? (
                <span className="dialog-badge">{t('dialog.start')}</span>
              ) : (
                <button type="button" onClick={() => save({ ...data, start: id })}>
                  {t('dialog.setStart')}
                </button>
              )}
              <span className="toolbar-spacer" />
              <button
                type="button"
                className="icon-button flat"
                title={t('dialog.delete')}
                disabled={nodes.length <= 1}
                onClick={() => removeNode(id)}
              >
                <Trash2 size={13} />
              </button>
            </header>
            <Field label={t('dialog.speaker')}>
              <input
                value={node.speaker}
                data-testid={`dialog-line-${index}-speaker`}
                onChange={(event) => setNode(id, { ...node, speaker: event.target.value })}
              />
            </Field>
            <Field label={t('dialog.text')}>
              <textarea
                rows={3}
                value={node.text}
                data-testid={`dialog-line-${index}-text`}
                onChange={(event) => setNode(id, { ...node, text: event.target.value })}
              />
            </Field>
            <h5>{t('dialog.lineActions')}</h5>
            <ActionList
              actions={node.actions ?? []}
              variables={variables}
              t={t}
              testId={`dialog-line-${index}-actions`}
              onChange={(actions) => {
                const { actions: _removed, ...rest } = node;
                setNode(id, actions.length > 0 ? { ...rest, actions } : rest);
              }}
            />
            <h5>{t('dialog.answers')}</h5>
            {node.answers.map((answer, answerIndex) => (
              <AnswerCard
                key={answerIndex}
                answer={answer}
                nodes={nodes}
                variables={variables}
                t={t}
                testId={`dialog-line-${index}-answer-${answerIndex}`}
                onChange={(next) =>
                  setNode(id, {
                    ...node,
                    answers: node.answers.map((item, i) => (i === answerIndex ? next : item)),
                  })
                }
                onRemove={() =>
                  setNode(id, {
                    ...node,
                    answers: node.answers.filter((_, i) => i !== answerIndex),
                  })
                }
              />
            ))}
            <button
              type="button"
              data-testid={`dialog-line-${index}-add-answer`}
              onClick={() =>
                setNode(id, {
                  ...node,
                  answers: [
                    ...node.answers,
                    {
                      id: slug(t('dialog.newAnswer'), takenIds()),
                      text: t('dialog.newAnswer'),
                      next: null,
                    },
                  ],
                })
              }
            >
              <Plus size={12} /> {t('dialog.addAnswer')}
            </button>
            {node.answers.length === 0 && (
              <Field label={t('dialog.continueWith')}>
                <select
                  value={node.next ?? ''}
                  data-testid={`dialog-line-${index}-next`}
                  onChange={(event) => setNode(id, { ...node, next: event.target.value || null })}
                >
                  <option value="">{t('dialog.end')}</option>
                  {nodes.map(([otherId], otherIndex) => (
                    <option key={otherId} value={otherId}>
                      {t('dialog.lineNumber', { n: otherIndex + 1 })}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
