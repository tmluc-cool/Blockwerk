import type { Locale } from '@blockwerk/blocks';
import { LOCALES } from '@blockwerk/blocks';
import {
  applyLayoutPreset,
  deleteLayout,
  loadNamedLayout,
  openPanel,
  resetLayout,
  saveLayoutAs,
  useLayout,
} from '../layout/layoutController';
import { PANELS } from '../layout/panels';
import { prompt, showMessage } from '../state/dialogs';
import type { Translate } from '../i18n';
import { useConsole } from '../state/console';
import { useSettings } from '../state/settings';
import { translate } from '../i18n';
import type { MenuItem } from './Menu';

/** Version shown in the About dialog. */
export const EDITOR_VERSION = '0.0.0';

/** Switches the user interface language and logs it in the console. */
export function changeLocale(locale: Locale): void {
  if (useSettings.getState().locale === locale) return;
  useSettings.getState().setLocale(locale);
  useConsole.getState().log('info', 'console.languageChanged');
}

/** Layout entries shared by the Window menu and the toolbar Layout dropdown. */
export function layoutMenuItems(t: Translate): MenuItem[] {
  const named = useLayout.getState().named;
  return [
    {
      label: t('layout.standard'),
      testId: 'layout-standard',
      action: () => applyLayoutPreset('standard'),
    },
    {
      label: t('layout.largeBlocks'),
      testId: 'layout-largeBlocks',
      action: () => applyLayoutPreset('largeBlocks'),
    },
    ...named.map<MenuItem>((layout) => ({
      label: layout.name,
      testId: `layout-named-${layout.name}`,
      action: () => loadNamedLayout(layout.name),
    })),
    { kind: 'separator' },
    {
      label: t('layout.saveAs'),
      testId: 'layout-save-as',
      action: () => {
        void prompt(t('layout.namePrompt')).then((name) => {
          if (name) saveLayoutAs(name);
        });
      },
    },
    {
      label: t('layout.delete'),
      disabled: named.length === 0,
      submenu: named.map<MenuItem>((layout) => ({
        label: t('layout.deleteNamed', { name: layout.name }),
        action: () => deleteLayout(layout.name),
      })),
    },
    { label: t('layout.reset'), testId: 'layout-reset', action: resetLayout },
  ];
}

/** The top-level menus of the menu bar (Unity: File, Edit, Assets, GameObject, Component, Window, Help). */
export function menuBarMenus(t: Translate): { id: string; label: string; items: MenuItem[] }[] {
  const settings = useSettings.getState();
  return [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        { label: t('menu.file.newScene'), shortcut: 'Ctrl+N', disabled: true },
        { label: t('menu.file.openScene'), shortcut: 'Ctrl+O', disabled: true },
        { label: t('menu.file.save'), shortcut: 'Ctrl+S', disabled: true },
        { kind: 'separator' },
        { label: t('menu.file.buildSettings'), shortcut: 'Ctrl+Shift+B', disabled: true },
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      items: [
        { label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', disabled: true },
        { label: t('menu.edit.redo'), shortcut: 'Ctrl+Y', disabled: true },
        { kind: 'separator' },
        { label: t('menu.edit.projectSettings'), disabled: true },
        {
          label: t('menu.edit.language'),
          testId: 'menu-language',
          submenu: LOCALES.map<MenuItem>((locale) => ({
            label: translate(locale, `language.${locale}`),
            checked: settings.locale === locale,
            testId: `language-${locale}`,
            action: () => changeLocale(locale),
          })),
        },
        {
          label: t('menu.edit.theme'),
          testId: 'menu-theme',
          submenu: (['dark', 'light'] as const).map<MenuItem>((theme) => ({
            label: t(theme === 'dark' ? 'menu.edit.theme.dark' : 'menu.edit.theme.light'),
            checked: settings.theme === theme,
            testId: `theme-${theme}`,
            action: () => useSettings.getState().setTheme(theme),
          })),
        },
      ],
    },
    {
      id: 'assets',
      label: t('menu.assets'),
      items: [
        { label: t('menu.assets.create'), disabled: true },
        { label: t('menu.assets.import'), disabled: true },
      ],
    },
    {
      id: 'gameObject',
      label: t('menu.gameObject'),
      items: [
        { label: t('menu.gameObject.createEmpty'), shortcut: 'Ctrl+Shift+N', disabled: true },
        { kind: 'separator' },
        { label: t('menu.gameObject.cube'), disabled: true },
        { label: t('menu.gameObject.sphere'), disabled: true },
        { label: t('menu.gameObject.light'), disabled: true },
        { label: t('menu.gameObject.camera'), disabled: true },
      ],
    },
    {
      id: 'component',
      label: t('menu.component'),
      items: [{ label: t('menu.component.add'), shortcut: 'Ctrl+Shift+A', disabled: true }],
    },
    {
      id: 'window',
      label: t('menu.window'),
      items: [
        {
          label: t('menu.window.panels'),
          testId: 'menu-open-window',
          submenu: PANELS.map<MenuItem>((panel) => ({
            label: t(panel.titleKey),
            shortcut: panel.focusKey ? `Ctrl+${panel.focusKey}` : undefined,
            testId: `open-${panel.id}`,
            action: () => openPanel(panel.id),
          })) as MenuItem[],
        },
        { label: t('menu.window.layouts'), testId: 'menu-layouts', submenu: layoutMenuItems(t) },
      ],
    },
    {
      id: 'help',
      label: t('menu.help'),
      items: [
        {
          label: t('menu.help.shortcuts'),
          action: () => showMessage(t('menu.help.shortcuts'), t('help.shortcutsText')),
        },
        {
          label: t('menu.help.about'),
          action: () =>
            showMessage(t('menu.help.about'), t('help.aboutText', { version: EDITOR_VERSION })),
        },
      ],
    },
  ];
}
