import type { IDockviewPanelProps } from 'dockview-react';
import { useT } from '../state/settings';

/** Asset library window (filled by `pnpm assets:fetch` in phase 2). */
export function AssetLibraryPanel(_props: IDockviewPanelProps) {
  const t = useT();
  return (
    <div className="panel asset-library" data-testid="asset-library">
      <div className="panel-toolbar">
        <input className="search" type="search" placeholder={t('assetLibrary.search')} />
      </div>
      <div className="empty-hint">{t('assetLibrary.empty')}</div>
    </div>
  );
}
