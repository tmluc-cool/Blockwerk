import { ASSETS_FOLDER, assetDisplayName, basename, dirname } from '@blockwerk/project';
import type { AnyAsset } from '@blockwerk/project';
import type { IDockviewPanelProps } from 'dockview-react';
import {
  Box,
  ChevronDown,
  Clapperboard,
  FileCode2,
  Folder,
  FolderOpen,
  Package,
  Boxes,
  Image as ImageIcon,
  LayoutPanelTop,
  MessagesSquare,
  Mountain,
  Volume2,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { useState } from 'react';
import { ContextMenu } from '../chrome/ContextMenu';
import type { ContextMenuState } from '../chrome/ContextMenu';
import { createAssetWithPrompt } from '../chrome/menus';
import { createPrefabFromObject, createPrefabVariant } from '../document/prefabActions';
import { importModelFiles, MODEL_FILE_EXTENSIONS } from '../library/importModel';
import { saveToMyPrefabs } from '../library/myPrefabs';
import {
  ASSET_DRAG_TYPE,
  endAssetDrag,
  OBJECTS_DRAG_TYPE,
  startAssetDrag,
} from '../library/projectDrag';
import { openDialogEditor, openScriptEditor, openUiEditor } from '../navigation';
import { prompt } from '../state/dialogs';
import {
  createFolder,
  deleteAsset,
  importSoundFiles,
  moveAssetToFolder,
  openPrefab,
  openScene,
  projectFolders,
  renameAsset,
  SOUND_FILE_EXTENSIONS,
  useDocument,
} from '../state/document';
import { useEditor } from '../state/editor';
import { usePlay } from '../state/play';
import { useT } from '../state/settings';

function depth(folder: string): number {
  return folder.split('/').length - 1;
}

/** Opens an asset like Unity does on double-click. Models have nothing to open. */
function openAsset(asset: AnyAsset): void {
  if (asset.type === 'scene') openScene(asset.id);
  else if (asset.type === 'prefab') openPrefab(asset.id);
  else if (asset.type === 'blockScript') openScriptEditor(asset.id);
  else if (asset.type === 'dialog') openDialogEditor(asset.id);
  else if (asset.type === 'ui') openUiEditor(asset.id);
}

/** Icon of an asset tile. */
function assetIcon(asset: AnyAsset) {
  switch (asset.type) {
    case 'scene':
      return <Clapperboard size={30} />;
    case 'blockScript':
      return <FileCode2 size={30} />;
    case 'dialog':
      return <MessagesSquare size={30} />;
    case 'ui':
      return <LayoutPanelTop size={30} />;
    case 'model':
      return <Box size={30} />;
    case 'image':
      return <ImageIcon size={30} />;
    case 'terrain':
      return <Mountain size={30} />;
    case 'audio':
      return <Volume2 size={30} />;
    case 'prefab':
      return asset.data.base ? (
        <Boxes size={30} className="prefab-icon" />
      ) : (
        <Package size={30} className="prefab-icon" />
      );
  }
}

/** Lets the user pick model files and imports them into a folder. */
function chooseModelFiles(folder: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = MODEL_FILE_EXTENSIONS.join(',');
  input.addEventListener('change', () => {
    void importModelFiles([...(input.files ?? [])], folder);
  });
  input.click();
}

/** Lets the user pick sound files and imports them into a folder. */
function chooseSoundFiles(folder: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = SOUND_FILE_EXTENSIONS.join(',');
  input.addEventListener('change', () => {
    void importSoundFiles([...(input.files ?? [])], folder);
  });
  input.click();
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
      label: t('asset.type.dialog'),
      testId: 'project-create-dialog',
      disabled: playing,
      action: () => createAssetWithPrompt(t, 'dialog', target),
    },
    {
      label: t('asset.type.ui'),
      testId: 'project-create-ui',
      disabled: playing,
      action: () => createAssetWithPrompt(t, 'ui', target),
    },
    {
      label: t('asset.type.scene'),
      disabled: playing,
      action: () => createAssetWithPrompt(t, 'scene', target),
    },
    {
      label: t('project.importModel'),
      testId: 'project-import-model',
      disabled: playing,
      action: () => chooseModelFiles(target),
    },
    {
      label: t('project.importSound'),
      testId: 'project-import-sound',
      disabled: playing,
      action: () => chooseSoundFiles(target),
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
              {
                label: t('inspector.open'),
                disabled:
                  asset.type === 'model' || asset.type === 'image' || asset.type === 'terrain',
                action: () => openAsset(asset),
              },
              ...(asset.type === 'prefab'
                ? [
                    {
                      label: t('prefab.createVariant'),
                      testId: 'project-create-variant',
                      disabled: playing,
                      action: () => {
                        const id = createPrefabVariant(asset.id);
                        if (id) useEditor.getState().selectAsset(id);
                      },
                    },
                    {
                      label: t('myPrefabs.add'),
                      testId: 'project-add-my-prefab',
                      action: () => void saveToMyPrefabs(asset.id),
                    },
                  ]
                : []),
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
                if (event.dataTransfer.types.includes(ASSET_DRAG_TYPE)) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(ASSET_DRAG_TYPE);
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
          data-testid="project-content"
          onContextMenu={(event) => openMenu(event, null)}
          onDragOver={(event) => {
            const types = event.dataTransfer.types;
            if (!playing && (types.includes(OBJECTS_DRAG_TYPE) || types.includes('Files'))) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            if (playing) return;
            event.preventDefault();
            // Objects from the hierarchy become prefabs; model files are imported (like Unity).
            const ids = JSON.parse(
              event.dataTransfer.getData(OBJECTS_DRAG_TYPE) || '[]',
            ) as string[];
            for (const id of ids) createPrefabFromObject(id, current);
            if (event.dataTransfer.files.length > 0) {
              void importModelFiles([...event.dataTransfer.files], current);
            }
          }}
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
              onDragStart={(event) => startAssetDrag(event, asset.id)}
              onDragEnd={endAssetDrag}
            >
              {assetIcon(asset)}
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
