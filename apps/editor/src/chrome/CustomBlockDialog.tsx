import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CustomBlockSpec, FrameParam } from '../blocks/frameApi';
import { useDialogs } from '../state/dialogs';
import type { DialogRequest } from '../state/dialogs';
import { useT } from '../state/settings';
import type { TranslationKey } from '../i18n';

const PARAM_TYPES = ['any', 'number', 'string', 'boolean', 'list', 'dictionary'] as const;
const KINDS = ['command', 'value', 'condition'] as const;

/** A name for a new input that no other input has. */
function freeName(params: readonly FrameParam[]): string {
  for (let index = 1; ; index++) {
    const name = `x${index}`;
    if (!params.some((param) => param.name === name)) return name;
  }
}

/**
 * "Make a block" / "Edit custom block" (SPEC 7.6): the name, the kind (command, value or
 * condition), the typed inputs, the type of the result, "run without screen refresh" and
 * whether every script may use the block.
 */
export function CustomBlockDialog({
  dialog,
}: {
  dialog: Extract<DialogRequest, { kind: 'customBlock' }>;
}) {
  const t = useT();
  const close = useDialogs((state) => state.close);
  const [spec, setSpec] = useState<CustomBlockSpec>(dialog.spec);
  const finish = (result: CustomBlockSpec | null): void => {
    close();
    dialog.resolve(result);
  };
  const setParam = (index: number, change: Partial<FrameParam>): void =>
    setSpec((current) => ({
      ...current,
      params: current.params.map((param, at) => (at === index ? { ...param, ...change } : param)),
    }));
  const move = (index: number, by: number): void =>
    setSpec((current) => {
      const params = [...current.params];
      const [item] = params.splice(index, 1);
      if (item) params.splice(index + by, 0, item);
      return { ...current, params };
    });
  const names = spec.params.map((param) => param.name.trim());
  const valid =
    spec.name.trim() !== '' &&
    names.every((name) => name !== '') &&
    new Set(names).size === names.length;
  return (
    <form
      className="dialog dialog-wide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      data-testid="custom-block-dialog"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid)
          finish({
            ...spec,
            name: spec.name.trim(),
            params: spec.params.map((param) => ({ ...param, name: param.name.trim() })),
          });
      }}
    >
      <h2 id="dialog-title">
        {t(dialog.creating ? 'customBlock.titleNew' : 'customBlock.titleEdit')}
      </h2>
      <div className="custom-row">
        <label>{t('customBlock.name')}</label>
        <input
          autoFocus
          value={spec.name}
          data-testid="custom-block-name"
          onChange={(event) => setSpec({ ...spec, name: event.target.value })}
        />
      </div>
      <div className="custom-row">
        <label>{t('customBlock.kind')}</label>
        <select
          value={spec.kind}
          disabled={!dialog.creating}
          data-testid="custom-block-kind"
          onChange={(event) =>
            setSpec({ ...spec, kind: event.target.value as CustomBlockSpec['kind'] })
          }
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`customBlock.kind.${kind}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>
      {spec.kind === 'value' && (
        <div className="custom-row">
          <label>{t('customBlock.returns')}</label>
          <select
            value={spec.returns}
            data-testid="custom-block-returns"
            onChange={(event) => setSpec({ ...spec, returns: event.target.value })}
          >
            {PARAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`customBlock.type.${type}` as TranslationKey)}
              </option>
            ))}
          </select>
        </div>
      )}
      <h3>{t('customBlock.inputs')}</h3>
      {spec.params.length === 0 && <p className="muted">{t('customBlock.noInputs')}</p>}
      {spec.params.map((param, index) => (
        <div className="custom-param" key={index} data-testid="custom-block-param">
          <input
            value={param.name}
            aria-label={t('customBlock.inputName')}
            onChange={(event) => setParam(index, { name: event.target.value })}
          />
          <select
            value={param.type}
            aria-label={t('customBlock.inputType')}
            onChange={(event) => setParam(index, { type: event.target.value })}
          >
            {PARAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`customBlock.type.${type}` as TranslationKey)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button flat"
            disabled={index === 0}
            title={t('customBlock.moveUp')}
            onClick={() => move(index, -1)}
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            className="icon-button flat"
            disabled={index === spec.params.length - 1}
            title={t('customBlock.moveDown')}
            onClick={() => move(index, 1)}
          >
            <ArrowDown size={13} />
          </button>
          <button
            type="button"
            className="icon-button flat"
            title={t('customBlock.removeInput')}
            onClick={() =>
              setSpec({ ...spec, params: spec.params.filter((_item, at) => at !== index) })
            }
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="custom-add"
        data-testid="custom-block-add-input"
        onClick={() =>
          setSpec({
            ...spec,
            params: [...spec.params, { name: freeName(spec.params), type: 'any' }],
          })
        }
      >
        <Plus size={13} /> {t('customBlock.addInput')}
      </button>
      <label className="custom-check" title={t('customBlock.warpHelp')}>
        <input
          type="checkbox"
          checked={spec.warp}
          data-testid="custom-block-warp"
          onChange={(event) => setSpec({ ...spec, warp: event.target.checked })}
        />
        {t('customBlock.warp')}
      </label>
      <label className="custom-check" title={t('customBlock.projectHelp')}>
        <input
          type="checkbox"
          checked={spec.scope === 'project'}
          data-testid="custom-block-project"
          onChange={(event) =>
            setSpec({ ...spec, scope: event.target.checked ? 'project' : 'script' })
          }
        />
        {t('customBlock.project')}
      </label>
      <div className="dialog-buttons">
        <button type="button" onClick={() => finish(null)}>
          {t('dialog.cancel')}
        </button>
        <button type="submit" className="primary" disabled={!valid} data-testid="custom-block-ok">
          {t('dialog.ok')}
        </button>
      </div>
    </form>
  );
}
