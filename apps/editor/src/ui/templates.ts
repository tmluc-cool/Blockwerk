import { assetDisplayName, createUiTemplate, UI_TEMPLATE_LABELS } from '@blockwerk/project';
import type { UiTemplateKind, UiTemplateLabel } from '@blockwerk/project';
import { createUiAsset, defaultFolder, useDocument } from '../state/document';
import { t } from '../state/settings';

/** The template texts in the editor's language (they become content of the new canvas). */
function labels(): Record<UiTemplateLabel, string> {
  const result = Object.fromEntries(
    UI_TEMPLATE_LABELS.map((key) => [key, t(`uiTemplate.${key}` as never)]),
  ) as Record<UiTemplateLabel, string>;
  const name = useDocument.getState().project?.settings.name;
  if (name) result.gameTitle = name;
  return result;
}

/** The UI asset with the name of a template, if the project has one. */
function existing(kind: UiTemplateKind): string | null {
  const name = t(`uiEditor.template.${kind}` as never);
  const found = useDocument
    .getState()
    .project?.assetsOfType('ui')
    .find((asset) => assetDisplayName(asset.path) === name);
  return found?.id ?? null;
}

/**
 * Adds a ready-made menu to the project. Menus that open the settings need the settings canvas, so it
 * is made first when the project has none. The buttons lead to the open scene until the author
 * points them elsewhere.
 */
export function addMenuFromTemplate(kind: UiTemplateKind): string | null {
  const { project, sceneId } = useDocument.getState();
  if (!project) return null;
  const folder = defaultFolder('ui');
  let settingsUi = existing('settings');
  if (kind !== 'settings' && ['mainMenu', 'pauseMenu'].includes(kind) && !settingsUi) {
    const entry = createUiAsset(
      folder,
      t('uiEditor.template.settings'),
      createUiTemplate('settings', labels(), {}),
    );
    settingsUi = entry?.id ?? null;
    if (entry && settingsUi) {
      // The "Back" button has to know its own canvas.
      const data = createUiTemplate('settings', labels(), { settingsUi });
      project.updateAsset(entry.id, 'ui', data);
    }
  }
  const targets = {
    ...(sceneId ? { startScene: sceneId, menuScene: sceneId } : {}),
    ...(settingsUi ? { settingsUi } : {}),
  };
  const name = t(`uiEditor.template.${kind}` as never);
  const entry = createUiAsset(folder, name, createUiTemplate(kind, labels(), targets));
  if (kind === 'settings' && entry) {
    project.updateAsset(
      entry.id,
      'ui',
      createUiTemplate('settings', labels(), { settingsUi: entry.id }),
    );
  }
  return entry?.id ?? null;
}
