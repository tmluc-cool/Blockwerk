import { defaultRegistry } from '@blockwerk/blocks';
import type { Locale } from '@blockwerk/blocks';
import type { BlockScriptData, Project, UiData, UiElement } from '@blockwerk/project';
import { checkWorld } from '@blockwerk/runtime';
import type {
  AssetFieldType,
  CheckContext,
  EmptySlot,
  Problem,
  ScriptFacts,
  SentMessage,
  World,
} from '@blockwerk/runtime';

/** A block of a saved Blockly workspace, as far as the check needs it. */
interface WorkspaceBlock {
  readonly type?: string;
  readonly id?: string;
  readonly fields?: Readonly<Record<string, unknown>>;
  readonly inputs?: Readonly<
    Record<string, { readonly block?: WorkspaceBlock; readonly shadow?: WorkspaceBlock }>
  >;
  readonly next?: { readonly block?: WorkspaceBlock };
}

function* walk(block: WorkspaceBlock | undefined): Generator<WorkspaceBlock> {
  if (!block) return;
  yield block;
  for (const input of Object.values(block.inputs ?? {})) {
    yield* walk(input.block);
    yield* walk(input.shadow);
  }
  yield* walk(block.next?.block);
}

/**
 * Reads what the scene check needs from a block script: the messages it sends and listens to, and
 * the condition slots that are still empty.
 */
export function scriptFacts(
  assetId: string,
  name: string,
  data: BlockScriptData,
  locale: Locale,
): ScriptFacts {
  const sends: SentMessage[] = [];
  const receives: string[] = [];
  const emptySlots: EmptySlot[] = [];
  const top = (data.workspace as { blocks?: { blocks?: WorkspaceBlock[] } }).blocks?.blocks ?? [];
  for (const root of top) {
    for (const block of walk(root)) {
      if (!block.type || !block.id) continue;
      const message = block.fields?.['message'];
      if (block.type === 'control.sendMessage' && typeof message === 'string') {
        sends.push({ message, blockId: block.id });
      } else if (block.type === 'events.whenMessage' && typeof message === 'string') {
        receives.push(message);
      }
      const definition = defaultRegistry.get(block.type);
      if (!definition) continue;
      for (const [slot, input] of Object.entries(definition.inputs)) {
        if (input.type !== 'boolean') continue;
        const filled = block.inputs?.[slot];
        if (filled?.block || filled?.shadow) continue;
        emptySlots.push({ blockId: block.id, blockText: definition.text[locale] });
        break;
      }
    }
  }
  return { assetId, name, sends, receives, emptySlots };
}

/** Messages that buttons of a UI canvas send. */
function uiSenders(
  data: UiData,
  assetId: string,
  name: string,
): NonNullable<CheckContext['otherSenders']>[number][] {
  const found: NonNullable<CheckContext['otherSenders']>[number][] = [];
  const visit = (element: UiElement): void => {
    for (const action of element.actions ?? []) {
      if (action.type === 'sendMessage') {
        found.push({ message: action.message, source: name, link: { assetId } });
      }
    }
    for (const child of element.children ?? []) visit(child);
  };
  for (const element of data.elements) visit(element);
  return found;
}

/** The asset names of a project's entries, for the check's messages. */
export interface CheckProject {
  readonly project: Project;
  readonly displayName: (path: string) => string;
  readonly locale: Locale;
}

/**
 * Checks a scene that was just built into a world (SPEC 9.2: diagnosis before every start) and
 * returns the problems found. Pure with respect to the editor state: everything it needs comes in.
 */
export function checkScene(world: World, source: CheckProject): Problem[] {
  const { project, displayName, locale } = source;
  const scriptIds = new Set<string>();
  const uiIds = new Set<string>();
  for (const object of world.allObjects()) {
    for (const component of object.components) {
      const script = component.values['script'];
      if (component.definition.type === 'blockScript' && typeof script === 'string') {
        scriptIds.add(script);
      }
      const ui = component.values['ui'];
      if (component.definition.type === 'uiCanvas' && typeof ui === 'string') uiIds.add(ui);
    }
  }
  const scripts: ScriptFacts[] = [];
  for (const id of scriptIds) {
    const entry = project.assetOfType(id, 'blockScript');
    if (entry) scripts.push(scriptFacts(id, displayName(entry.path), entry.data, locale));
  }
  const otherSenders: NonNullable<CheckContext['otherSenders']>[number][] = [];
  for (const id of uiIds) {
    const entry = project.assetOfType(id, 'ui');
    if (entry) otherSenders.push(...uiSenders(entry.data, id, displayName(entry.path)));
  }
  const context: CheckContext = {
    assetExists(_type: AssetFieldType, reference: string): boolean {
      // Library models and built-in sounds are not project assets.
      if (reference.includes(':')) return true;
      return project.asset(reference) !== undefined;
    },
    scripts,
    otherSenders,
  };
  return checkWorld(world, context);
}
