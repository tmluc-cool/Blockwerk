import type { VariableData } from '@blockwerk/project';
import { assetDisplayName } from '@blockwerk/project';
import { peekNpcState } from '@blockwerk/runtime';
import type { GameObject } from '@blockwerk/runtime';
import { useState } from 'react';
import { revealLink } from '../../navigation';
import { useDocument } from '../../state/document';
import { currentGame, usePlay } from '../../state/play';
import { useT } from '../../state/settings';

/** The text a variable value is edited as: lists and dictionaries as JSON. */
function asText(value: unknown): string {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Turns edited text into a value of the variable's type, or `undefined` if it does not fit. */
function fromText(
  variable: VariableData,
  text: string,
): number | string | boolean | object | undefined {
  switch (variable.type) {
    case 'number': {
      const number = Number(text.replace(',', '.'));
      return text.trim() !== '' && Number.isFinite(number) ? number : undefined;
    }
    case 'boolean':
      return text === 'true' ? true : text === 'false' ? false : undefined;
    case 'list':
    case 'dictionary':
      try {
        const parsed: unknown = JSON.parse(text);
        const isList = Array.isArray(parsed);
        if ((variable.type === 'list') !== isList) return undefined;
        return typeof parsed === 'object' && parsed !== null ? parsed : undefined;
      } catch {
        return undefined;
      }
    default:
      return text;
  }
}

/** One live value: shows the current one and writes a new one into the running game. */
function LiveValue({
  variable,
  read,
  write,
}: {
  variable: VariableData;
  read: () => unknown;
  write: (value: never) => void;
}) {
  const current = asText(read());
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? current;
  const commit = (): void => {
    if (draft === null) return;
    const parsed = fromText(variable, draft);
    if (parsed !== undefined) write(parsed as never);
    setDraft(null);
  };
  return (
    <input
      className="live-value"
      value={shown}
      data-testid={`live-var-${variable.name}`}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(null);
        event.stopPropagation();
      }}
    />
  );
}

/**
 * What the Inspector adds in play mode (SPEC 9.2): the scripts of the object that are running and
 * the block each one is at, the state of an NPC, and the variables of its block scripts, all
 * changeable while the game runs. Nothing here is written to the project.
 */
export function PlayDebug({ object }: { object: GameObject }) {
  const t = useT();
  const project = useDocument((state) => state.project);
  usePlay((state) => state.frame);
  usePlay((state) => state.status);
  const game = currentGame();
  if (!game) return null;
  const id = object.cloneOf ?? object.id;
  const positions = game.scriptPositions().filter((position) => position.objectId === id);
  const npc = peekNpcState(object);
  const scriptIds = new Set<string>();
  for (const component of object.components) {
    const script = component.values['script'];
    if (component.definition.type === 'blockScript' && typeof script === 'string') {
      scriptIds.add(script);
    }
  }
  const objectVariables: VariableData[] = [];
  const gameVariables = new Map<string, VariableData>();
  for (const scriptId of scriptIds) {
    for (const variable of project?.assetOfType(scriptId, 'blockScript')?.data.variables ?? []) {
      if (variable.scope === 'game') gameVariables.set(variable.id, variable);
      else if (!objectVariables.some((known) => known.id === variable.id)) {
        objectVariables.push(variable);
      }
    }
  }
  const nameOf = (assetId: string): string => {
    const entry = project?.asset(assetId);
    return entry ? assetDisplayName(entry.path) : assetId;
  };

  return (
    <section className="component play-debug" data-testid="play-debug">
      <div className="component-header">
        <strong>{t('debug.title')}</strong>
      </div>
      <div className="component-body">
        <div className="play-debug-group">
          <div className="muted">{t('debug.runningScripts')}</div>
          {positions.length === 0 && <div className="empty-hint small">{t('debug.noScripts')}</div>}
          {positions.map((position, index) => (
            <button
              key={`${position.assetId}-${index}`}
              type="button"
              className="link-button"
              data-testid="running-script"
              onClick={() =>
                revealLink({
                  objectId: position.objectId,
                  assetId: position.assetId,
                  ...(position.blockId ? { blockId: position.blockId } : {}),
                })
              }
            >
              {nameOf(position.assetId)}
            </button>
          ))}
        </div>
        {npc && npc.current !== '' && (
          <div className="play-debug-group">
            <div className="muted">{t('debug.npcState')}</div>
            <input
              className="live-value"
              defaultValue={npc.current}
              key={npc.current}
              data-testid="live-npc-state"
              onKeyDown={(event) => {
                if (event.key === 'Enter') npc.change(event.currentTarget.value);
                event.stopPropagation();
              }}
            />
            <span className="muted">{t('studio.seconds', { value: npc.seconds.toFixed(1) })}</span>
          </div>
        )}
        {objectVariables.length > 0 && (
          <div className="play-debug-group">
            <div className="muted">{t('debug.variables')}</div>
            {objectVariables.map((variable) => (
              <label key={variable.id} className="live-row">
                <span>{variable.name}</span>
                <LiveValue
                  variable={variable}
                  read={() => object.vars[variable.id]}
                  write={(value) => {
                    object.vars[variable.id] = value;
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {gameVariables.size > 0 && (
          <div className="play-debug-group">
            <div className="muted">{t('debug.gameVariables')}</div>
            {[...gameVariables.values()].map((variable) => (
              <label key={variable.id} className="live-row">
                <span>{variable.name}</span>
                <LiveValue
                  variable={variable}
                  read={() => game.vars[variable.id]}
                  write={(value) => {
                    game.vars[variable.id] = value;
                  }}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
