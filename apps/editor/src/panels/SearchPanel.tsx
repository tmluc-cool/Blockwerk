import { renameGameVariable } from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import { create } from 'zustand';
import {
  collectThings,
  renameCustomBlock,
  renameMessage,
  renameTag,
  renameVariableIn,
  searchThings,
} from '../document/refactor';
import type { AssetView, Thing, ThingKind, Usage } from '../document/refactor';
import { openDialogEditor, openScriptEditor, openUiEditor } from '../navigation';
import { prompt } from '../state/dialogs';
import { addTagOrLayer, applyAssetChanges, openScene, useDocument } from '../state/document';
import { useEditor } from '../state/editor';
import { useT } from '../state/settings';
import { assetDisplayName } from '@blockwerk/project';
import type { TranslationKey } from '../i18n';

/** What the Search window shows: the text in its field and the kind of things it looks for. */
export const useSearch = create<{
  query: string;
  kind: ThingKind | 'all';
  setQuery: (query: string) => void;
  setKind: (kind: ThingKind | 'all') => void;
}>()((set) => ({
  query: '',
  kind: 'all',
  setQuery: (query) => set({ query }),
  setKind: (kind) => set({ kind }),
}));

const KINDS: readonly (ThingKind | 'all')[] = [
  'all',
  'variable',
  'customBlock',
  'message',
  'tag',
  'object',
  'text',
];

/** Everything the search reads: scenes (the open one as it is now), scripts, dialogs, UI, prefabs. */
function projectAssets(): AssetView[] {
  const { project, sceneId, scene } = useDocument.getState();
  if (!project) return [];
  const result: AssetView[] = [];
  for (const type of ['scene', 'blockScript', 'dialog', 'ui', 'prefab'] as const) {
    for (const entry of project.assetsOfType(type)) {
      result.push({
        id: entry.id,
        type,
        name: assetDisplayName(entry.path),
        data: type === 'scene' && entry.id === sceneId && scene ? scene : entry.data,
      });
    }
  }
  return result;
}

/** Takes the user to a place where a thing is used. */
function showUsage(usage: Usage): void {
  const editor = useEditor.getState();
  switch (usage.assetType) {
    case 'blockScript':
      openScriptEditor(usage.assetId);
      if (usage.blockId) editor.showBlock(usage.assetId, usage.blockId);
      break;
    case 'dialog':
      openDialogEditor(usage.assetId);
      break;
    case 'ui':
      openUiEditor(usage.assetId);
      break;
    case 'scene':
      openScene(usage.assetId);
      if (usage.objectId) editor.select(usage.objectId);
      break;
    case 'prefab':
      editor.selectAsset(usage.assetId);
      break;
  }
}

/** Asks for a new name and renames a thing everywhere. */
async function renameEverywhere(
  thing: Thing,
  assets: readonly AssetView[],
  t: ReturnType<typeof useT>,
) {
  const name = (await prompt(t('search.renameTo', { name: thing.name }), thing.name))?.trim();
  if (!name || name === thing.name) return;
  switch (thing.kind) {
    case 'message':
      applyAssetChanges('refactor.renameMessage', renameMessage(assets, thing.key, name));
      break;
    case 'tag': {
      addTagOrLayer('tags', name);
      applyAssetChanges('refactor.renameTag', renameTag(assets, thing.key, name));
      break;
    }
    case 'customBlock':
      applyAssetChanges('refactor.renameBlock', renameCustomBlock(assets, thing.key, name));
      break;
    case 'variable': {
      const scripts = assets
        .filter((asset) => asset.type === 'blockScript')
        .map((asset) => ({ id: asset.id, data: asset.data as never }));
      const shared = renameGameVariable(scripts, thing.key, name);
      if (shared.size > 0) {
        applyAssetChanges('refactor.renameVariable', shared);
      } else {
        const owner = assets.find(
          (asset) =>
            asset.type === 'blockScript' &&
            (asset.data as { variables?: { id: string }[] }).variables?.some(
              (variable) => variable.id === thing.key,
            ),
        );
        if (owner)
          applyAssetChanges('refactor.renameVariable', renameVariableIn(owner, thing.key, name));
      }
      break;
    }
    default:
      break;
  }
}

const RENAMABLE: readonly ThingKind[] = ['variable', 'customBlock', 'message', 'tag'];

function UsageRow({ usage }: { usage: Usage }) {
  const t = useT();
  const object = usage.objectId
    ? (useDocument.getState().scene?.objects[usage.objectId]?.name ?? usage.objectId)
    : null;
  return (
    <button
      type="button"
      className="search-usage"
      data-testid="search-usage"
      onClick={() => showUsage(usage)}
    >
      <span className="search-asset">{usage.assetName}</span>
      <span className="muted">
        {object ? `${object} · ` : ''}
        {usage.context === 'definition' ? t('search.definition') : usage.context}
      </span>
    </button>
  );
}

/**
 * Search window (Window → Search, Ctrl+Shift+F; SPEC 7.8): finds variables, custom blocks,
 * messages, tags, objects and texts across every script, scene, dialog and UI canvas, lists where
 * they are used, jumps there, and renames them everywhere.
 */
export function SearchPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const { query, kind, setQuery, setKind } = useSearch();
  const [open, setOpen] = useState<string | null>(null);
  const assetsVersion = useDocument((state) => state.assetsVersion);
  const scene = useDocument((state) => state.scene);
  const project = useDocument((state) => state.project);
  const assets = useMemo(
    () => projectAssets(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assets change with these
    [project, assetsVersion, scene],
  );
  const things = useMemo(() => (query.trim() === '' ? [] : collectThings(assets)), [assets, query]);
  const found = useMemo(
    () => searchThings(things, query, kind === 'all' ? undefined : [kind]).slice(0, 200),
    [things, query, kind],
  );
  return (
    <div className="panel search-panel" data-testid="search-panel">
      <div className="panel-toolbar">
        <input
          className="search-input"
          autoFocus
          value={query}
          placeholder={t('search.placeholder')}
          data-testid="search-input"
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          value={kind}
          data-testid="search-kind"
          onChange={(event) => setKind(event.target.value as ThingKind | 'all')}
        >
          {KINDS.map((item) => (
            <option key={item} value={item}>
              {t(`search.kind.${item}` as TranslationKey)}
            </option>
          ))}
        </select>
      </div>
      <div className="search-results" data-testid="search-results">
        {query.trim() === '' && <div className="empty-hint">{t('search.hint')}</div>}
        {query.trim() !== '' && found.length === 0 && (
          <div className="empty-hint">{t('search.none')}</div>
        )}
        {found.map((thing) => {
          const id = `${thing.kind}:${thing.key}`;
          const expanded = open === id;
          return (
            <div className="search-thing" key={id} data-testid={`search-thing-${thing.name}`}>
              <div className="search-row">
                <button
                  type="button"
                  className="search-toggle"
                  onClick={() => setOpen(expanded ? null : id)}
                >
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <span className="search-kind">
                    {t(`search.kind.${thing.kind}` as TranslationKey)}
                  </span>
                  <strong>{thing.name}</strong>
                  <span className="muted">{thing.usages.length}</span>
                </button>
                {RENAMABLE.includes(thing.kind) && (
                  <button
                    type="button"
                    className="icon-button flat"
                    title={t('search.rename')}
                    data-testid="search-rename"
                    onClick={() => void renameEverywhere(thing, assets, t)}
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              {expanded &&
                thing.usages.map((usage, index) => <UsageRow key={index} usage={usage} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
