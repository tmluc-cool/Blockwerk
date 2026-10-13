import { ChevronDown, Folder, FolderOpen } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useState } from 'react';
import type { TranslationKey } from '../i18n';
import { useT } from '../state/settings';

const FOLDERS: readonly { id: string; nameKey: TranslationKey }[] = [
  { id: 'scenes', nameKey: 'project.folder.scenes' },
  { id: 'prefabs', nameKey: 'project.folder.prefabs' },
  { id: 'blockScripts', nameKey: 'project.folder.blockScripts' },
  { id: 'models', nameKey: 'project.folder.models' },
  { id: 'materials', nameKey: 'project.folder.materials' },
  { id: 'textures', nameKey: 'project.folder.textures' },
  { id: 'sounds', nameKey: 'project.folder.sounds' },
  { id: 'ui', nameKey: 'project.folder.ui' },
];

/** Project window: folder tree of the Assets folder (contents follow with the project format in phase 1). */
export function ProjectPanel(_props: IDockviewPanelProps) {
  const t = useT();
  const [folder, setFolder] = useState<string>('scenes');
  return (
    <div className="panel project" data-testid="project">
      <div className="panel-toolbar">
        <input className="search" type="search" placeholder={t('project.search')} />
      </div>
      <div className="split">
        <div className="tree folder-tree" role="tree" tabIndex={0}>
          <div className="tree-row tree-root">
            <ChevronDown size={14} />
            <FolderOpen size={14} />
            <strong>{t('project.assets')}</strong>
          </div>
          {FOLDERS.map((item) => (
            <div
              key={item.id}
              role="treeitem"
              aria-selected={item.id === folder}
              className={`tree-row tree-item${item.id === folder ? ' selected' : ''}`}
              onClick={() => setFolder(item.id)}
            >
              <Folder size={14} />
              <span>{t(item.nameKey)}</span>
            </div>
          ))}
        </div>
        <div className="folder-content">
          <div className="empty-hint">{t('project.emptyFolder')}</div>
        </div>
      </div>
    </div>
  );
}
