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
import { COMPONENTS, PRIMITIVE_SHAPES } from '@blockwerk/runtime';
import {
  addComponentToSelection,
  createCamera,
  createEmpty,
  createLight,
  createPrimitiveObject,
  deleteSelection,
  duplicateSelection,
  LIGHT_TYPES,
  SHAPE_NAMES,
} from '../document/actions';
import { EXAMPLES, exampleName } from '../examples';
import type { TranslationKey } from '../i18n';
import { choose, prompt, showMessage } from '../state/dialogs';
import {
  createBlockScript,
  createNewProject,
  createSceneAsset,
  defaultFolder,
  importProject,
  listProjects,
  openProject,
  openScene,
  redo,
  saveProject,
  undo,
  useDocument,
} from '../state/document';
import { useEditor } from '../state/editor';
import { showPhysicsSettings } from '../state/dialogs';
import { pause, step, togglePlay, usePlay } from '../state/play';
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

/** Entries to create objects (Object menu, hierarchy context menu). */
export function createObjectMenuItems(
  t: Translate,
  parent?: string | null,
  disabled = false,
): MenuItem[] {
  return [
    {
      label: parent ? t('menu.gameObject.createChild') : t('menu.gameObject.createEmpty'),
      shortcut: parent ? undefined : 'Ctrl+Shift+N',
      disabled,
      testId: parent ? 'create-child' : 'create-empty',
      action: () => createEmpty(parent),
    },
    {
      label: t('menu.gameObject.object3d'),
      disabled,
      testId: 'menu-3d-object',
      submenu: PRIMITIVE_SHAPES.map<MenuItem>((shape) => ({
        label: t(SHAPE_NAMES[shape]),
        testId: `create-${shape}`,
        action: () => createPrimitiveObject(shape, parent),
      })),
    },
    {
      label: t('menu.gameObject.light'),
      disabled,
      testId: 'menu-light',
      submenu: LIGHT_TYPES.map<MenuItem>((type) => ({
        label: t(`menu.gameObject.light.${type}`),
        testId: `create-light-${type}`,
        action: () => createLight(type, parent),
      })),
    },
    {
      label: t('menu.gameObject.camera'),
      disabled,
      testId: 'create-camera',
      action: () => createCamera(parent),
    },
  ];
}

async function openProjectDialog(t: Translate): Promise<void> {
  const projects = await listProjects();
  const backend = useDocument.getState().backend;
  const options = projects.map((project) => ({ value: project.ref, label: project.name }));
  if (backend?.choose) options.push({ value: CHOOSE_FOLDER, label: t('menu.file.chooseFolder') });
  const ref = await choose(t('menu.file.openProject'), options);
  if (!ref) return;
  if (ref === CHOOSE_FOLDER) {
    const folder = await backend?.choose?.();
    if (folder) await openProject(folder);
    return;
  }
  await openProject(ref);
}

const CHOOSE_FOLDER = '\u0000choose';

async function openExampleDialog(t: Translate): Promise<void> {
  const id = await choose(
    t('menu.file.openExample'),
    EXAMPLES.map((example) => ({ value: example.id, label: exampleName(example) })),
  );
  const example = EXAMPLES.find((item) => item.id === id);
  if (example) await importProject(exampleName(example), example.files);
}

/** The top-level menus of the menu bar (Unity: File, Edit, Assets, GameObject, Component, Window, Help). */
export function menuBarMenus(t: Translate): { id: string; label: string; items: MenuItem[] }[] {
  const settings = useSettings.getState();
  const document = useDocument.getState();
  const playing = usePlay.getState().status !== 'stopped';
  const hasSelection = useEditor.getState().selection.length > 0;
  return [
    {
      id: 'file',
      label: t('menu.file'),
      items: [
        {
          label: t('menu.file.newProject'),
          testId: 'menu-new-project',
          disabled: playing,
          action: () => {
            void prompt(t('menu.file.newProject'), t('project.defaultName')).then((name) => {
              if (name?.trim()) void createNewProject(name.trim());
            });
          },
        },
        {
          label: t('menu.file.openProject'),
          testId: 'menu-open-project',
          disabled: playing,
          action: () => void openProjectDialog(t),
        },
        {
          label: t('menu.file.openExample'),
          testId: 'menu-open-example',
          disabled: playing || EXAMPLES.length === 0,
          action: () => void openExampleDialog(t),
        },
        { kind: 'separator' },
        {
          label: t('menu.file.newScene'),
          disabled: playing || !document.project,
          action: () => {
            void prompt(t('menu.file.newScene'), t('project.defaultSceneName')).then((name) => {
              const entry = name?.trim()
                ? createSceneAsset(defaultFolder('scene'), name.trim())
                : null;
              if (entry) openScene(entry.id);
            });
          },
        },
        {
          label: t('menu.file.save'),
          shortcut: 'Ctrl+S',
          testId: 'menu-save',
          disabled: !document.project,
          action: () => void saveProject(),
        },
        {
          label: t('menu.file.autosave'),
          checked: settings.autosave,
          testId: 'menu-autosave',
          action: () => settings.setAutosave(!settings.autosave),
        },
        { kind: 'separator' },
        { label: t('menu.file.buildSettings'), shortcut: 'Ctrl+Shift+B', disabled: true },
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit'),
      items: [
        {
          label: document.undoLabel
            ? `${t('menu.edit.undo')}: ${t(document.undoLabel as TranslationKey)}`
            : t('menu.edit.undo'),
          shortcut: 'Ctrl+Z',
          testId: 'menu-undo',
          disabled: !document.undoLabel,
          action: undo,
        },
        {
          label: document.redoLabel
            ? `${t('menu.edit.redo')}: ${t(document.redoLabel as TranslationKey)}`
            : t('menu.edit.redo'),
          shortcut: 'Ctrl+Y',
          testId: 'menu-redo',
          disabled: !document.redoLabel,
          action: redo,
        },
        { kind: 'separator' },
        {
          label: t('menu.gameObject.duplicate'),
          shortcut: 'Ctrl+D',
          disabled: playing || !hasSelection,
          action: duplicateSelection,
        },
        {
          label: t('menu.gameObject.delete'),
          shortcut: 'Entf',
          disabled: playing || !hasSelection,
          action: deleteSelection,
        },
        { kind: 'separator' },
        { label: t('menu.edit.play'), shortcut: 'Ctrl+P', action: togglePlay },
        {
          label: t('menu.edit.pause'),
          shortcut: 'Ctrl+Shift+P',
          disabled: !playing,
          action: pause,
        },
        { label: t('menu.edit.step'), shortcut: 'Ctrl+Alt+P', action: step },
        { kind: 'separator' },
        { label: t('menu.edit.projectSettings'), disabled: true },
        {
          label: t('menu.edit.physicsSettings'),
          testId: 'menu-physics-settings',
          action: showPhysicsSettings,
        },
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
        {
          label: t('menu.assets.create'),
          disabled: playing || !document.project,
          submenu: [
            {
              label: t('asset.type.blockScript'),
              testId: 'menu-create-block-script',
              action: () => createAssetWithPrompt(t, 'blockScript'),
            },
            {
              label: t('asset.type.scene'),
              action: () => createAssetWithPrompt(t, 'scene'),
            },
          ],
        },
        { label: t('menu.assets.import'), disabled: true },
      ],
    },
    {
      id: 'gameObject',
      label: t('menu.gameObject'),
      items: createObjectMenuItems(t, undefined, playing),
    },
    {
      id: 'component',
      label: t('menu.component'),
      items: COMPONENTS.map<MenuItem>((definition) => ({
        label: definition.text[settings.locale],
        disabled: playing || !hasSelection,
        testId: `menu-component-${definition.type}`,
        action: () => addComponentToSelection(definition.type, definition.unique === true),
      })),
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

/** Asks for a name and creates an asset in the default folder. */
export function createAssetWithPrompt(
  t: Translate,
  type: 'blockScript' | 'scene',
  folder?: string,
): void {
  const defaultName =
    type === 'blockScript' ? t('asset.newBlockScript') : t('project.defaultSceneName');
  void prompt(
    t(type === 'blockScript' ? 'asset.type.blockScript' : 'asset.type.scene'),
    defaultName,
  ).then((name) => {
    if (!name?.trim()) return;
    const target = folder ?? defaultFolder(type);
    const entry =
      type === 'blockScript'
        ? createBlockScript(target, name.trim())
        : createSceneAsset(target, name.trim());
    if (entry) useEditor.getState().selectAsset(entry.id);
  });
}
