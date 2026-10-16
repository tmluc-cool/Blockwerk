import { outlineScript } from '@blockwerk/ai';
import type { AiTask, ScriptNode } from '@blockwerk/ai';
import { defaultRegistry } from '@blockwerk/blocks';
import type { IDockviewPanelProps } from 'dockview-react';
import type { ReactElement } from 'react';
import { applyProposal, discardProposal, runAssistant, useAi } from '../ai/useAi';
import { useDocument } from '../state/document';
import { activeObjectId, useEditor } from '../state/editor';
import { useSettings, useT } from '../state/settings';
import type { TranslationKey } from '../i18n';

const TASKS: readonly AiTask[] = ['logic', 'world', 'explain', 'diagnose', 'cleanup'];

/** Name of an object of the open scene. */
function objectName(id: string | null | undefined): string | null {
  const scene = useDocument.getState().scene;
  const object = id && scene ? scene.objects[id] : undefined;
  return object ? (object.name ?? object.area ?? id ?? null) : null;
}

/**
 * AI Assistant window (SPEC 9.4): build logic, build a world, explain, "why does this not work?",
 * tidy up. Every answer is a preview first; nothing in the project changes before "Apply", and
 * "Apply" is one undo step. The window exists only while a key is stored.
 */
export function AiPanel(_props: IDockviewPanelProps): ReactElement {
  const t = useT();
  const locale = useSettings((state) => state.locale);
  const { task, prompt, status, result, notice, applied } = useAi();
  const selected = useEditor(activeObjectId);
  const openScript = useEditor((state) => state.openScript);
  useDocument((state) => state.scene);
  const working = status === 'working';
  const needsText = task !== 'explain' && task !== 'cleanup';

  return (
    <div className="studio-panel ai-panel" data-testid="ai-panel">
      <div className="ai-tasks" role="tablist">
        {TASKS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={task === name}
            className={task === name ? 'ai-task active' : 'ai-task'}
            data-testid={`ai-task-${name}`}
            onClick={() => useAi.getState().setTask(name)}
          >
            {t(`ai.task.${name}` as TranslationKey)}
          </button>
        ))}
      </div>
      <p className="panel-hint">{t(`ai.hint.${task}` as TranslationKey)}</p>
      <label className="ai-prompt">
        <span className="field-label">{t('ai.prompt')}</span>
        <textarea
          rows={4}
          value={prompt}
          data-testid="ai-prompt"
          onChange={(event) => useAi.getState().setPrompt(event.target.value)}
        />
      </label>
      <div className="studio-row">
        <button
          type="button"
          className="text-button"
          disabled={working || (needsText && prompt.trim() === '')}
          data-testid="ai-send"
          onClick={() => void runAssistant()}
        >
          {t('ai.send')}
        </button>
        {working && <span data-testid="ai-working">{t('ai.working')}</span>}
      </div>
      <p className="panel-hint">{t('ai.privacy')}</p>

      {notice && (
        <p className="build-problem warning" data-testid="ai-notice">
          {t(`ai.${notice}` as TranslationKey)}
        </p>
      )}
      {applied && (
        <p data-testid="ai-applied" className="ai-applied">
          {t('ai.applied')}
        </p>
      )}

      {result?.kind === 'script' && (
        <section className="studio-group" data-testid="ai-preview">
          <h4>{t('ai.preview')}</h4>
          <p data-testid="ai-preview-title">
            {t('ai.preview.script', { name: result.check.proposal.name })}
          </p>
          {result.check.proposal.summary && <p>{result.check.proposal.summary}</p>}
          <p className="panel-hint">
            {task === 'cleanup'
              ? t('ai.preview.replace', {
                  name: openScript?.assetId ? openScript.assetId.slice(0, 6) + '…' : '',
                })
              : (() => {
                  const wanted = result.check.proposal.attachTo;
                  const name = objectName(wanted) ?? objectName(selected);
                  return name
                    ? t('ai.preview.attach', { object: name })
                    : t('ai.preview.attachNone');
                })()}
          </p>
          <pre className="ai-outline" data-testid="ai-outline">
            {outlineScript(
              result.check.proposal.stacks as readonly (readonly ScriptNode[])[],
              defaultRegistry,
              locale,
            ).join('\n')}
          </pre>
          <div className="studio-row">
            <button
              type="button"
              className="text-button"
              data-testid="ai-apply"
              onClick={applyProposal}
            >
              {t('ai.apply')}
            </button>
            <button
              type="button"
              className="text-button"
              data-testid="ai-discard"
              onClick={discardProposal}
            >
              {t('ai.discard')}
            </button>
          </div>
        </section>
      )}

      {result?.kind === 'world' && (
        <section className="studio-group" data-testid="ai-preview">
          <h4>{t('ai.preview')}</h4>
          <p data-testid="ai-preview-title">
            {t('ai.preview.world', { count: result.check.objects.length })}
          </p>
          {result.check.proposal.summary && <p>{result.check.proposal.summary}</p>}
          <ul className="ai-objects" data-testid="ai-objects">
            {result.check.objects.map((object, index) => (
              <li key={index}>
                {t('ai.objectLine', {
                  name: object.name,
                  x: Math.round(object.position[0] * 10) / 10,
                  y: Math.round(object.position[1] * 10) / 10,
                  z: Math.round(object.position[2] * 10) / 10,
                })}
              </li>
            ))}
          </ul>
          <div className="studio-row">
            <button
              type="button"
              className="text-button"
              data-testid="ai-apply"
              onClick={applyProposal}
            >
              {t('ai.apply')}
            </button>
            <button
              type="button"
              className="text-button"
              data-testid="ai-discard"
              onClick={discardProposal}
            >
              {t('ai.discard')}
            </button>
          </div>
        </section>
      )}

      {result?.kind === 'text' && (
        <section className="studio-group" data-testid="ai-answer">
          <h4>{t('ai.answer')}</h4>
          <p className="ai-answer-text">{result.text}</p>
        </section>
      )}

      {result?.kind === 'invalid' && (
        <section className="studio-group" data-testid="ai-invalid">
          <p className="build-problem error">{t('ai.invalid')}</p>
          <p className="panel-hint">{t('ai.invalidDetails')}</p>
          <ul className="build-problems">
            {result.errors.map((error, index) => (
              <li key={index} className="build-problem">
                {error}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result?.kind === 'failed' && (
        <section className="studio-group" data-testid="ai-failed">
          <p className="build-problem error">
            {result.status === 401 || result.status === 403
              ? t('ai.failedKey')
              : t('ai.failed', { message: result.message })}
          </p>
        </section>
      )}
    </div>
  );
}
