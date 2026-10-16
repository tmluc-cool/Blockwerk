import { useState } from 'react';
import {
  OFFERED_MODELS,
  removeAiKey,
  saveAiKey,
  setAiModel,
  useAiSettings,
} from '../ai/aiSettings';
import { useDialogs } from '../state/dialogs';
import { useT } from '../state/settings';

/**
 * Edit → Preferences: the optional AI assistant's key and model (SPEC 9.4). With a key the
 * assistant appears in the editor; removing the key makes it disappear again.
 */
export function PreferencesDialog() {
  const t = useT();
  const close = useDialogs((state) => state.close);
  const { hasKey, keyPlace, model } = useAiSettings();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (): void => {
    setBusy(true);
    void saveAiKey(key).finally(() => {
      setKey('');
      setBusy(false);
    });
  };
  return (
    <div
      className="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      data-testid="preferences-dialog"
    >
      <h2 id="dialog-title">{t('preferences.title')}</h2>
      <h3>{t('preferences.ai')}</h3>
      <p className="muted">{t('preferences.aiHint')}</p>
      {hasKey ? (
        <p data-testid="ai-key-status">
          {t(`preferences.keyStored.${keyPlace ?? 'browser'}` as never)}
        </p>
      ) : (
        <p className="muted" data-testid="ai-key-status">
          {t('preferences.keyNone')}
        </p>
      )}
      <label className="field-row">
        <span className="field-label">{t('preferences.key')}</span>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          placeholder={t('preferences.keyPlaceholder')}
          data-testid="ai-key-input"
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <label className="field-row">
        <span className="field-label">{t('preferences.model')}</span>
        <input
          list="ai-models"
          defaultValue={model}
          data-testid="ai-model-input"
          onBlur={(event) => setAiModel(event.target.value)}
        />
        <datalist id="ai-models">
          {OFFERED_MODELS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <div className="dialog-buttons">
        {hasKey && (
          <button type="button" data-testid="ai-key-remove" onClick={() => void removeAiKey()}>
            {t('preferences.keyRemove')}
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={busy || key.trim() === ''}
          data-testid="ai-key-save"
          onClick={submit}
        >
          {t('preferences.keySave')}
        </button>
        <button type="button" onClick={close} data-testid="preferences-close">
          {t('dialog.close')}
        </button>
      </div>
    </div>
  );
}
