import { defaultRegistry } from '@blockwerk/blocks';
import type {
  ComponentInfo,
  ProjectFacts,
  ScriptContext,
  TaskInput,
  WorldContext,
} from '@blockwerk/ai';
import { assetDisplayName } from '@blockwerk/project';
import type { Project, SceneData } from '@blockwerk/project';
import { COMPONENTS } from '@blockwerk/runtime';
import { useAssetLibrary } from '../library/assetLibrary';
import { useConsole } from '../state/console';
import { useDocument } from '../state/document';
import { activeObjectId, useEditor } from '../state/editor';
import { currentGame } from '../state/play';
import { t, useSettings } from '../state/settings';
import type { TranslationKey } from '../i18n';

/** The component types as the assistant gets them: name, label and the names of the fields. */
function componentInfos(): ComponentInfo[] {
  return COMPONENTS.map((definition) => ({
    type: definition.type,
    label: definition.text.en,
    fields: Object.entries(definition.fields)
      .filter(([, field]) => !('hidden' in field && field.hidden))
      .map(([name, field]) => `${name}: ${field.type}`),
  }));
}

/** Name of an object as the Hierarchy shows it. */
function objectLabel(scene: SceneData, id: string): string {
  const object = scene.objects[id];
  return object?.name ?? object?.area ?? id;
}

/**
 * The height of the ground: the top of the largest static object that carries a collider and has
 * "ground", "floor", "meadow" or the like in its name; 0 if there is none.
 */
function groundLevel(scene: SceneData): number {
  let best = 0;
  let area = 0;
  for (const object of Object.values(scene.objects)) {
    const name = (object.name ?? '').toLowerCase();
    if (!/boden|ground|floor|wiese|meadow|gras|grass|terrain|platte/.test(name)) continue;
    const size = object.transform.scale[0] * object.transform.scale[2];
    if (size > area) {
      area = size;
      best = object.transform.position[1] + object.transform.scale[1] / 2;
    }
  }
  return Math.round(best * 100) / 100;
}

/** What the assistant is told about the open project (kept small). */
export function projectFacts(project: Project, scene: SceneData, sceneName: string): ProjectFacts {
  const scriptNames = new Map(
    project.assetsOfType('blockScript').map((entry) => [entry.id, assetDisplayName(entry.path)]),
  );
  const selected = activeObjectId(useEditor.getState());
  return {
    projectName: project.settings.name,
    sceneName,
    objects: Object.entries(scene.objects)
      .filter(
        ([, object]) => !(object.area && object.area !== 'custom' && !object.components.length),
      )
      .map(([id, object]) => ({
        id,
        name: objectLabel(scene, id),
        tag: object.tag,
        position: object.transform.position,
        scale: object.transform.scale,
        components: object.components.map((component) => component.type),
        scripts: object.components
          .filter((component) => component.type === 'blockScript')
          .map((component) => scriptNames.get(String(component.values['script'] ?? '')) ?? ''),
      })),
    scripts: project.assetsOfType('blockScript').map((entry) => ({
      name: assetDisplayName(entry.path),
      variables: entry.data.variables.map((variable) => ({
        name: variable.name,
        type: variable.type,
        scope: variable.scope,
      })),
    })),
    tags: project.tagsAndLayers.tags,
    ...(selected && scene.objects[selected]
      ? { selectedObject: `${selected} (${objectLabel(scene, selected)})` }
      : {}),
    groundY: groundLevel(scene),
  };
}

/** The checks a block proposal has to pass: which objects, tags, assets and game variables exist. */
export function scriptContext(project: Project, scene: SceneData): ScriptContext {
  const ids = (type: 'prefab' | 'dialog' | 'scene' | 'ui' | 'audio') =>
    new Set(project.assetsOfType(type).map((entry) => entry.id));
  return {
    registry: defaultRegistry,
    objectIds: new Set(Object.keys(scene.objects)),
    tags: new Set(project.tagsAndLayers.tags),
    assets: {
      prefab: ids('prefab'),
      dialog: ids('dialog'),
      scene: ids('scene'),
      ui: ids('ui'),
      audio: ids('audio'),
    },
    gameVariables: project
      .assetsOfType('blockScript')
      .flatMap((entry) => entry.data.variables)
      .filter((variable) => variable.scope === 'game'),
  };
}

/** The library as the world check reads it. */
export function worldContext(): WorldContext {
  return { library: useAssetLibrary.getState().byId };
}

/**
 * For "Why does this not work?": the last console lines and, while playing, the values of the
 * variables shown on screen. Texts are in English, like the rest of the prompt.
 */
function diagnostics(): string[] {
  const lines: string[] = [];
  const entries = useConsole.getState().entries.slice(-30);
  const locale = useSettings.getState().locale;
  for (const entry of entries) {
    lines.push(
      `console ${entry.level}: ${t(entry.key as TranslationKey, entry.params)} (${locale})`,
    );
  }
  const game = currentGame();
  if (game) {
    for (const monitor of game.monitors()) {
      lines.push(
        `variable ${monitor.objectName ? `${monitor.objectName}.` : ''}${monitor.name} = ${JSON.stringify(monitor.value)}`,
      );
    }
  }
  return lines;
}

/** Everything a task needs from the editor, or `null` if no project and scene are open. */
export function buildTaskInput(
  task: TaskInput['task'],
  prompt: string,
  model: string,
): TaskInput | null {
  const { project, scene, sceneId } = useDocument.getState();
  const index = useAssetLibrary.getState().index;
  if (!project || !scene) return null;
  const sceneEntry = sceneId ? project.asset(sceneId) : undefined;
  const openScript = useEditor.getState().openScript?.assetId;
  const script = openScript ? project.assetOfType(openScript, 'blockScript') : undefined;
  const base: TaskInput = {
    task,
    prompt,
    locale: useSettings.getState().locale,
    model,
    registry: defaultRegistry,
    facts: projectFacts(project, scene, sceneEntry ? assetDisplayName(sceneEntry.path) : '–'),
    library: index?.entries ?? [],
    components: componentInfos(),
    scriptContext: scriptContext(project, scene),
    worldContext: worldContext(),
  };
  return {
    ...base,
    ...(script
      ? {
          selectedScript: {
            name: assetDisplayName(script.path),
            workspace: script.data.workspace,
            variables: script.data.variables,
          },
        }
      : {}),
    ...(task === 'diagnose' ? { diagnostics: diagnostics() } : {}),
  };
}
