import { useState } from 'react';
import { PhysicsDialog } from './PhysicsDialog';
import { useDialogs } from '../state/dialogs';
import type { DialogRequest } from '../state/dialogs';
import { useT } from '../state/settings';

function PromptDialog({ dialog }: { dialog: Extract<DialogRequest, { kind: 'prompt' }> }) {
  const t = useT();
  const close = useDialogs((state) => state.close);
  const [value, setValue] = useState(dialog.defaultValue);
  const finish = (result: string | null): void => {
    close();
    dialog.resolve(result);
  };
  return (
    <form
      className="dialog"
      role="dialog"
      aria-modal="true"
      data-testid="prompt-dialog"
      onSubmit={(event) => {
        event.preventDefault();
        finish(value);
      }}
    >
      <h2>{dialog.title}</h2>
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        data-testid="prompt-input"
      />
      <div className="dialog-buttons">
        <button type="button" onClick={() => finish(null)}>
          {t('dialog.cancel')}
        </button>
        <button type="submit" className="primary" data-testid="prompt-ok">
          {t('dialog.ok')}
        </button>
      </div>
    </form>
  );
}

function ChoiceDialog({ dialog }: { dialog: Extract<DialogRequest, { kind: 'choice' }> }) {
  const t = useT();
  const close = useDialogs((state) => state.close);
  const finish = (result: string | null): void => {
    close();
    dialog.resolve(result);
  };
  return (
    <div className="dialog" role="dialog" aria-modal="true" data-testid="choice-dialog">
      <h2>{dialog.title}</h2>
      <div className="choice-list">
        {dialog.options.length === 0 && <p className="muted">{t('dialog.nothingToChoose')}</p>}
        {dialog.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice"
            onClick={() => finish(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="dialog-buttons">
        <button type="button" onClick={() => finish(null)}>
          {t('dialog.cancel')}
        </button>
      </div>
    </div>
  );
}

/** Renders the open modal dialog, if any. */
export function DialogHost() {
  const t = useT();
  const dialog = useDialogs((state) => state.dialog);
  const close = useDialogs((state) => state.close);
  if (!dialog) return null;
  return (
    <div className="dialog-backdrop">
      {dialog.kind === 'physics' ? (
        <PhysicsDialog />
      ) : dialog.kind === 'prompt' ? (
        <PromptDialog dialog={dialog} />
      ) : dialog.kind === 'choice' ? (
        <ChoiceDialog dialog={dialog} />
      ) : (
        <div className="dialog" role="dialog" aria-modal="true" data-testid="message-dialog">
          <h2>{dialog.title}</h2>
          <p>{dialog.message}</p>
          <div className="dialog-buttons">
            <button type="button" className="primary" autoFocus onClick={close}>
              {t('dialog.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
