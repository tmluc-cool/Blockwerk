import { ASSETS_FOLDER, assetDisplayName, basename, dirname } from '@blockwerk/project';
import type { AnyAsset } from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import { ChevronDown, Clapperboard, FileCode2, Folder, FolderOpen } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { ContextMenu } from '../chrome/ContextMenu';
import type { ContextMenuState } from '../chrome/ContextMenu';
import { createAssetWithPrompt } from '../chrome/menus';
import { openScriptEditor } from '../navigation';
import { prompt } from '../state/dialogs';
import {
  createFolder,
  deleteAsset,
  moveAssetToFolder,
  openScene,
  projectFolders,
  renameAsset,
  useDocument,
} from '../state/document';
import { useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { useT } from '../state/settings';

const DRAG_TYPE = 'application/x-blockwerk-asset';

function depth(folder: string): number {
  return folder.split('/').length - 1;
}

/** Opens an asset like Unity does on double-click. */
function openAsset(asset: AnyAsset): void {
  if (asset.type === 'scene') openScene(asset.id);
  else openScriptEditor(asset.id);
}

/** Project window (SPEC 5.8): folder tree of `Assets/` on the left, contents on the right. */
export function ProjectPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const project = useDocument((state) => state.project);
  const sceneId = useDocument((state) => state.sceneId);
  const extraFolders = useDocument((state) => state.extraFolders);
  useDocument((state) => state.assetsVersion);
  const selectedAssetId = useEditor((state) => state.selectedAssetId);
  const playing = usePlay((state) => state.status !== 'stopped');
  const [folder, setFolder] = useState<string>(ASSETS_FOLDER);
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const folders = projectFolders(project, extraFolders);
  const current = folders.includes(folder) ? folder : ASSETS_FOLDER;
  const needle = query.trim().toLowerCase();
  const assets = (project?.assets ?? []).filter((asset) =>
    needle
      ? assetDisplayName(asset.path).toLowerCase().includes(needle)
      : dirname(asset.path) === current,
  );
  const subfolders = needle
    ? []
    : folders.filter((item) => item !== current && dirname(item) === current);

  const createItems = (target: string) => [
    {
      label: t('asset.type.blockScript'),
      testId: 'project-create-block-script',
      disabled: playing,
      action: () => createAssetWithPrompt(t, 'blockScript', target),
    },
    {
      label: t('asset.type.scene'),
      disabled: playing,
      action: () => createAssetWithPrompt(t, 'scene', target),
    },
    {
      label: t('project.folder'),
      disabled: playing,
      action: () => {
        void prompt(t('project.folder'), t('project.newFolder')).then((name) => {
          if (name?.trim()) setFolder(createFolder(target, name));
        });
      },
    },
  ];

  const openMenu = (event: MouseEvent, asset: AnyAsset | null): void => {
    event.preventDefault();
    event.stopPropagation();
    if (asset) useEditor.getState().selectAsset(asset.id);
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: [
        { label: t('project.create'), testId: 'project-create', submenu: createItems(current) },
        ...(asset
          ? [
              { kind: 'separator' as const },
              { label: t('inspector.open'), action: () => openAsset(asset) },
              {
                label: t('menu.gameObject.rename'),
                shortcut: 'F2',
                disabled: playing,
                testId: 'project-rename',
                action: () => setRenaming(asset.id),
              },
              {
                label: t('menu.gameObject.delete'),
                disabled: playing || asset.id === sceneId,
                testId: 'project-delete',
                action: () => {
                  if (deleteAsset(asset.id)) useEditor.getState().selectAsset(null);
                },
              },
            ]
          : []),
      ],
    });
  };

  return (
    <div className="panel project" data-testid="project">
      <div className="panel-toolbar">
        <button
          type="button"
          className="text-button"
          data-testid="project-create-button"
          disabled={playing}
          onClick={(event) => openMenu(event, null)}
        >
          {t('project.create')}
        </button>
        <input
          className="search"
          type="search"
          placeholder={t('project.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="split">
        <div className="tree folder-tree" role="tree" tabIndex={0}>
          {folders.map((item) => (
            <div
              key={item}
              role="treeitem"
              aria-selected={item === current}
              className={`tree-row tree-item${item === current ? ' selected' : ''}`}
              style={{ paddingLeft: 6 + depth(item) * 14 }}
              data-folder={item}
              onClick={() => setFolder(item)}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes(DRAG_TYPE)) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(DRAG_TYPE);
                if (id) moveAssetToFolder(id, item);
              }}
            >
              {item === ASSETS_FOLDER ? <ChevronDown size={14} /> : null}
              {item === current ? <FolderOpen size={14} /> : <Folder size={14} />}
              {item === ASSETS_FOLDER ? (
                <strong>{t('project.assets')}</strong>
              ) : (
                <span>{basename(item)}</span>
              )}
            </div>
          ))}
        </div>
        <div
          className="folder-content"
          onContextMenu={(event) => openMenu(event, null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) useEditor.getState().selectAsset(null);
          }}
        >
          {assets.length === 0 && subfolders.length === 0 && (
            <div className="empty-hint">{t('project.emptyFolder')}</div>
          )}
          {subfolders.map((item) => (
            <div key={item} className="asset-tile folder" onDoubleClick={() => setFolder(item)}>
              <Folder size={30} />
              <span>{basename(item)}</span>
            </div>
          ))}
          {assets.map((asset) => (
            <div
              key={asset.id}
              className={`asset-tile${asset.id === selectedAssetId ? ' selected' : ''}${asset.id === sceneId ? ' open' : ''}`}
              data-testid={`asset-${assetDisplayName(asset.path)}`}
              data-asset-id={asset.id}
              draggable={!playing && renaming !== asset.id}
              tabIndex={0}
              onClick={() => useEditor.getState().selectAsset(asset.id)}
              onDoubleClick={() => openAsset(asset)}
              onContextMenu={(event) => openMenu(event, asset)}
              onKeyDown={(event) => {
                if (event.key === 'F2' && !playing) setRenaming(asset.id);
                if (event.key === 'Enter') openAsset(asset);
              }}
              onDragStart={(event) => {
                event.dataTransfer.setData(DRAG_TYPE, asset.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
            >
              {asset.type === 'scene' ? <Clapperboard size={30} /> : <FileCode2 size={30} />}
              {renaming === asset.id ? (
                <input
                  autoFocus
                  className="rename-field"
                  data-testid="asset-rename-input"
                  defaultValue={assetDisplayName(asset.path)}
                  onFocus={(event) => event.currentTarget.select()}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    renameAsset(asset.id, event.currentTarget.value);
                    setRenaming(null);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      event.currentTarget.value = assetDisplayName(asset.path);
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <span>{assetDisplayName(asset.path)}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
