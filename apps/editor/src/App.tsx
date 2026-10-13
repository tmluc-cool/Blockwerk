import { useEffect } from 'react';
import { AreaTabs } from './chrome/AreaTabs';
import { DialogHost } from './chrome/DialogHost';
import { MenuBar } from './chrome/MenuBar';
import { Toolbar } from './chrome/Toolbar';
import { DockLayout } from './layout/DockLayout';
import { useSettings } from './state/settings';

/** The editor window: menu bar, tool bar, area tabs and the docking area. */
export function App() {
  const theme = useSettings((state) => state.theme);
  const locale = useSettings((state) => state.locale);

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);

  return (
    <div className="app">
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
