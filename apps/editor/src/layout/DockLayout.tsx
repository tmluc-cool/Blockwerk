import { DockviewReact, themeDark, themeLight } from 'dockview-react';
import type { DockviewApi, DockviewReadyEvent, IDockviewPanelProps } from 'dockview-react';
import type { FunctionComponent } from 'react';
import { useEffect } from 'react';
import { AssetLibraryPanel } from '../panels/AssetLibraryPanel';
import { BlockEditorPanel } from '../panels/BlockEditorPanel';
import { ConsolePanel } from '../panels/ConsolePanel';
import { FigurePanel } from '../panels/FigurePanel';
import { GamePanel } from '../panels/GamePanel';
import { HierarchyPanel } from '../panels/HierarchyPanel';
import { InspectorPanel } from '../panels/InspectorPanel';
import { LightingPanel } from '../panels/LightingPanel';
import { DialogEditorPanel } from '../panels/DialogEditorPanel';
import { SearchPanel } from '../panels/SearchPanel';
import { UiEditorPanel } from '../panels/UiEditorPanel';
import { NavigationPanel } from '../panels/NavigationPanel';
import { BuildSettingsPanel } from '../panels/BuildSettingsPanel';
import { ProfilerPanel } from '../panels/ProfilerPanel';
import { ProjectPanel } from '../panels/ProjectPanel';
import { ScenePanel } from '../panels/ScenePanel';
import { installShortcuts } from '../shortcuts';
import { useConsole } from '../state/console';
import { t, useSettings, useT } from '../state/settings';
import { POPOUT_URL, retitlePanels, setLayoutApi } from './layoutController';
import type { PanelId } from './panels';
import { withPanelBoundary } from './PanelBoundary';
import { applyPreset } from './presets';
import { loadCurrentLayout, saveCurrentLayout } from './storage';

const PANEL_COMPONENTS: Readonly<Record<PanelId, FunctionComponent<IDockviewPanelProps>>> = {
  figure: FigurePanel,
  hierarchy: HierarchyPanel,
  scene: ScenePanel,
  game: GamePanel,
  blockEditor: BlockEditorPanel,
  dialogEditor: DialogEditorPanel,
  uiEditor: UiEditorPanel,
  search: SearchPanel,
  inspector: InspectorPanel,
  lighting: LightingPanel,
  navigation: NavigationPanel,
  profiler: ProfilerPanel,
  buildSettings: BuildSettingsPanel,
  project: ProjectPanel,
  assetLibrary: AssetLibraryPanel,
  console: ConsolePanel,
};

/** Window components, each wrapped in an error boundary. */
const COMPONENTS = Object.fromEntries(
  Object.entries(PANEL_COMPONENTS).map(([id, component]) => [id, withPanelBoundary(id, component)]),
) as Record<PanelId, FunctionComponent<IDockviewPanelProps>>;

const SAVE_DELAY_MS = 250;

/** Restores the last layout, or builds the default layout if there is none or it is broken. */
function restoreLayout(api: DockviewApi): void {
  const saved = loadCurrentLayout();
  if (saved) {
    try {
      api.fromJSON(saved);
      retitlePanels();
      if (api.panels.length > 0) {
        useConsole.getState().log('info', 'console.layoutLoaded');
        return;
      }
    } catch {
      api.clear();
    }
  }
  applyPreset(api, 'standard', t);
}

/** The docking area with all editor windows. Layout changes are saved automatically. */
export function DockLayout() {
  const theme = useSettings((state) => state.theme);
  const locale = useSettings((state) => state.locale);
  const translate = useT();

  useEffect(() => {
    retitlePanels();
  }, [locale]);

  const onReady = (event: DockviewReadyEvent): void => {
    const api = event.api;
    setLayoutApi(api);
    restoreLayout(api);
    let timer: ReturnType<typeof setTimeout> | undefined;
    api.onDidLayoutChange(() => {
      clearTimeout(timer);
      timer = setTimeout(() => saveCurrentLayout(api.toJSON()), SAVE_DELAY_MS);
    });
    api.onDidOpenPopoutWindowFail(() =>
      useConsole.getState().log('warning', 'layout.popoutFailed'),
    );
    api.onDidAddPopoutGroup((popout) => {
      const uninstall = installShortcuts(popout.window);
      popout.window.addEventListener('pagehide', uninstall, { once: true });
      popout.window.document.documentElement.dataset['theme'] = useSettings.getState().theme;
    });
  };

  return (
    <DockviewReact
      className="dock"
      components={COMPONENTS}
      onReady={onReady}
      theme={theme === 'dark' ? themeDark : themeLight}
      popoutUrl={POPOUT_URL}
      getTabContextMenuItems={({ panel, group, api }) => {
        const location = group.api.location.type;
        return [
          {
            label: translate('dock.float'),
            disabled: location === 'floating',
            action: () => api.addFloatingGroup(panel),
          },
          {
            label: translate('dock.popout'),
            disabled: location === 'popout',
            action: () => {
              void api.addPopoutGroup(panel, { popoutUrl: POPOUT_URL });
            },
          },
          {
            label: translate('dock.maximize'),
            disabled: location !== 'grid',
            action: () => api.maximizeGroup(panel),
          },
          'separator',
          { label: translate('dock.close'), action: () => panel.api.close() },
        ];
      }}
    />
  );
}
