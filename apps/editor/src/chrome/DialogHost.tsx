import { useState } from 'react';
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

/** Renders the open modal dialog, if any. */
export function DialogHost() {
  const t = useT();
  const dialog = useDialogs((state) => state.dialog);
  const close = useDialogs((state) => state.close);
  if (!dialog) return null;
  return (
    <div className="dialog-backdrop">
      {dialog.kind === 'prompt' ? (
        <PromptDialog dialog={dialog} />
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
