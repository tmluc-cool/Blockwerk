import { useEffect } from 'react';
import { AreaTabs } from './chrome/AreaTabs';
import { DialogHost } from './chrome/DialogHost';
import { MenuBar } from './chrome/MenuBar';
import { Toolbar } from './chrome/Toolbar';
import { DockLayout } from './layout/DockLayout';
import { useDocument } from './state/document';
import { usePlay } from './state/play';
import { useSettings } from './state/settings';

/** The editor window: menu bar, tool bar, area tabs and the docking area. */
export function App() {
  const theme = useSettings((state) => state.theme);
  const locale = useSettings((state) => state.locale);
  const playing = usePlay((state) => state.status !== 'stopped');
  const projectName = useDocument((state) => state.project?.settings.name ?? null);
  const dirty = useDocument((state) => state.revision !== state.savedRevision);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);

  useEffect(() => {
    document.title = projectName ? `${projectName}${dirty ? ' *' : ''} – Blockwerk` : 'Blockwerk';
  }, [projectName, dirty]);

  return (
    <div className={`app${playing ? ' playing' : ''}`} data-testid="app">
      <MenuBar />
      <Toolbar />
      <AreaTabs />
      <main className="dock-host">
        <DockLayout />
      </main>
      <DialogHost />
    </div>
  );
}
