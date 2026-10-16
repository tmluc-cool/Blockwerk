import { runTask } from '@blockwerk/ai';
import type { AiTask, TaskResult } from '@blockwerk/ai';
import { FORMAT_VERSION } from '@blockwerk/project';
import type { BlockScriptData } from '@blockwerk/project';
import { create } from 'zustand';
import { libraryComponents } from '../document/actions';
import { createObject } from '../document/sceneOps';
import { activeSceneView } from '../scene/sceneViews';
import {
  applyAiScript,
  applyAssetChanges,
  defaultFolder,
  editScene,
  useDocument,
} from '../state/document';
import { activeObjectId, useEditor } from '../state/editor';
import { useAssetLibrary } from '../library/assetLibrary';
import { currentAiTransport, useAiSettings } from './aiSettings';
import { buildTaskInput } from './context';

/** State of the assistant window. A result is only a preview until the user applies it. */
interface AiState {
  task: AiTask;
  prompt: string;
  status: 'idle' | 'working';
  result: TaskResult | null;
  /** A problem before or instead of a request (no project, no script, no library). */
  notice: 'noProject' | 'needScript' | 'needLibrary' | null;
  /** Set after "Apply": the preview is gone and the change is made. */
  applied: boolean;
  setTask: (task: AiTask) => void;
  setPrompt: (prompt: string) => void;
}

/** The assistant's state: the task, the typed request and the proposal waiting for a decision. */
export const useAi = create<AiState>()((set) => ({
  task: 'logic',
  prompt: '',
  status: 'idle',
  result: null,
  notice: null,
  applied: false,
  setTask: (task) => {
    showWorld(null);
    set({ task, result: null, notice: null, applied: false });
  },
  setPrompt: (prompt) => set({ prompt }),
}));

/** Shows or hides the half-transparent objects of a world proposal in the Scene view. */
function showWorld(result: TaskResult | null): void {
  const view = activeSceneView();
  if (!view) return;
  if (result?.kind === 'world') {
    view.showGhosts(
      result.check.objects.map((object) => ({
        model: object.model,
        position: object.position,
        rotationY: object.rotationY,
        scale: object.scale,
      })),
    );
  } else {
    view.showGhosts(null);
  }
}

/** Sends the request of the current task. Nothing in the project changes. */
export async function runAssistant(): Promise<void> {
  const { task, prompt, status } = useAi.getState();
  if (status === 'working') return;
  showWorld(null);
  useAi.setState({ result: null, notice: null, applied: false });
  const transport = currentAiTransport();
  const input = buildTaskInput(task, prompt, useAiSettings.getState().model);
  if (!transport || !input) {
    useAi.setState({ notice: 'noProject' });
    return;
  }
  if (task === 'cleanup' && !input.selectedScript) {
    useAi.setState({ notice: 'needScript' });
    return;
  }
  if (task === 'world' && input.library.length === 0) {
    useAi.setState({ notice: 'needLibrary' });
    return;
  }
  // When tidying up, the variables of the script keep their IDs.
  const ready =
    task === 'cleanup' && input.selectedScript
      ? {
          ...input,
          scriptContext: {
            ...input.scriptContext,
            ownVariables:
              useDocument
                .getState()
                .project?.assetOfType(useEditor.getState().openScript?.assetId ?? '', 'blockScript')
                ?.data.variables ?? [],
          },
        }
      : input;
  useAi.setState({ status: 'working' });
  const result = await runTask(transport, ready);
  useAi.setState({ status: 'idle', result });
  showWorld(result);
}

/** Throws the proposal away. */
export function discardProposal(): void {
  showWorld(null);
  useAi.setState({ result: null, applied: false });
}

/** The area root new objects of a proposal go under: the Environment area, if the scene has one. */
function environmentRoot(): string | null {
  const scene = useDocument.getState().scene;
  if (!scene) return null;
  const root = Object.entries(scene.objects).find(([, object]) => object.area === 'environment');
  return root?.[0] ?? null;
}

/** Makes the proposal real as one undo step. */
export function applyProposal(): void {
  const { result, task } = useAi.getState();
  const { project, scene } = useDocument.getState();
  if (!result || !project || !scene) return;
  if (result.kind === 'script') {
    const data: BlockScriptData = {
      formatVersion: FORMAT_VERSION,
      variables: result.check.variables,
      workspace: result.check.workspace as BlockScriptData['workspace'],
    };
    if (task === 'cleanup') {
      const open = useEditor.getState().openScript?.assetId;
      if (open) applyAssetChanges('undo.aiCleanup', new Map([[open, data]]));
    } else {
      const wanted = result.check.proposal.attachTo;
      const selected = activeObjectId(useEditor.getState());
      const objectId = wanted && wanted in scene.objects ? wanted : selected;
      const id = applyAiScript({
        name: result.check.proposal.name,
        data,
        objectId: objectId && objectId in scene.objects ? objectId : null,
        folder: defaultFolder('blockScript'),
      });
      if (id) useEditor.getState().openBlockScript({ assetId: id, objectId: objectId ?? null });
    }
  } else if (result.kind === 'world') {
    const library = useAssetLibrary.getState().byId;
    const parent = environmentRoot();
    const created: string[] = [];
    editScene('undo.aiWorld', (current) => {
      let next = current;
      for (const object of result.check.objects) {
        const entry = library.get(object.model);
        if (!entry) continue;
        const made = createObject(next, {
          name: object.name,
          parent,
          components: libraryComponents(entry),
          transform: {
            position: [...object.position],
            rotation: [0, object.rotationY, 0],
            scale: [object.scale, object.scale, object.scale],
          },
        });
        next = made.scene;
        created.push(made.id);
      }
      return next;
    });
    useEditor.getState().setSelection(created);
  }
  showWorld(null);
  useAi.setState({ result: null, applied: true });
}
