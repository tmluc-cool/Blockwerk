import type { AssetFieldType } from '../components/defineComponent';
import type { GameObject } from '../world/GameObject';
import type { World } from '../world/World';
import type { Problem, ProblemLink } from './problems';

/** A message that a block sends, with the block that sends it. */
export interface SentMessage {
  readonly message: string;
  readonly blockId: string;
}

/** An empty input slot of a block. */
export interface EmptySlot {
  readonly blockId: string;
  readonly blockText: string;
}

/** What the scene check needs to know about one block script (read by the editor from the blocks). */
export interface ScriptFacts {
  readonly assetId: string;
  readonly name: string;
  readonly sends: readonly SentMessage[];
  /** Messages the script reacts to. */
  readonly receives: readonly string[];
  readonly emptySlots: readonly EmptySlot[];
}

/** What the scene check cannot see in the world itself. */
export interface CheckContext {
  /** Whether an asset of that kind exists in the project (`library:<id>` models included). */
  assetExists(type: AssetFieldType, reference: string): boolean;
  /** The block scripts that run in this scene, with what the check needs from their blocks. */
  readonly scripts: readonly ScriptFacts[];
  /** Messages that something other than a block script sends (UI buttons), with their place. */
  readonly otherSenders?: readonly {
    readonly message: string;
    /** What sends it, for the message text (for example the name of the UI canvas). */
    readonly source: string;
    readonly link: ProblemLink;
  }[];
}

const link = (object: GameObject, extra: Partial<ProblemLink> = {}): ProblemLink => ({
  objectId: object.cloneOf ?? object.id,
  ...extra,
});

/** Component types that make an object a player (the "… Control" components). */
function isPlayerControl(type: string): boolean {
  return type.endsWith('Control') && type !== 'vehicleControl';
}

/**
 * Looks for mistakes in a freshly built scene before the game starts (SPEC 9.2): empty or broken
 * references in inspector fields, empty block slots, messages nobody listens to, NPCs the
 * navigation mesh does not reach, players without a camera, models without a collider.
 * Nothing here stops the game; the result is a list for the console.
 */
export function checkWorld(world: World, context: CheckContext): Problem[] {
  const problems: Problem[] = [];
  const objects = [...world.allObjects()];
  checkReferences(world, objects, context, problems);
  checkScripts(context, problems);
  checkNavigation(world, objects, problems);
  checkPlayers(objects, problems);
  checkColliders(objects, problems);
  return problems;
}

function checkReferences(
  world: World,
  objects: readonly GameObject[],
  context: CheckContext,
  problems: Problem[],
): void {
  for (const object of objects) {
    for (const component of object.components) {
      if (!component.enabled) continue;
      for (const [name, definition] of Object.entries(component.definition.fields)) {
        if (definition.type !== 'asset' && definition.type !== 'object') continue;
        const value = component.values[name];
        const text = component.definition.text;
        const params = {
          object: object.name,
          component: text.de,
          componentEn: text.en,
          field: definition.text.de,
          fieldEn: definition.text.en,
        };
        if (value === null || value === undefined || value === '') {
          if (definition.required) {
            problems.push({
              severity: 'warning',
              code: 'emptyReference',
              params,
              link: link(object),
            });
          }
          continue;
        }
        const reference = String(value);
        const exists =
          definition.type === 'asset'
            ? context.assetExists(definition.assetType, reference)
            : world.getObject(reference) !== undefined;
        if (!exists) {
          problems.push({
            severity: 'error',
            code: definition.type === 'asset' ? 'brokenAssetReference' : 'brokenObjectReference',
            params,
            link: link(object),
          });
        }
      }
    }
  }
}

function checkScripts(context: CheckContext, problems: Problem[]): void {
  const receivers = new Set<string>();
  for (const script of context.scripts)
    for (const message of script.receives) receivers.add(message);
  const unheard = (message: string, source: string, at: ProblemLink): void => {
    if (message === '' || receivers.has(message)) return;
    problems.push({
      severity: 'warning',
      code: 'messageWithoutReceiver',
      params: { message, source },
      link: at,
    });
  };
  for (const script of context.scripts) {
    for (const sent of script.sends) {
      unheard(sent.message, script.name, { assetId: script.assetId, blockId: sent.blockId });
    }
    for (const slot of script.emptySlots) {
      problems.push({
        severity: 'warning',
        code: 'emptySlot',
        params: { script: script.name, block: slot.blockText },
        link: { assetId: script.assetId, blockId: slot.blockId },
      });
    }
  }
  for (const sender of context.otherSenders ?? [])
    unheard(sender.message, sender.source, sender.link);
}

function checkNavigation(world: World, objects: readonly GameObject[], problems: Problem[]): void {
  const walkers = objects.filter(
    (object) =>
      object.activeInHierarchy &&
      object.components.some(
        (component) => component.enabled && component.definition.type === 'navAgent',
      ),
  );
  if (walkers.length === 0) return;
  const navigation = world.navigation;
  if (!navigation.ensureBuilt()) {
    const first = walkers[0];
    if (first) {
      problems.push({
        severity: 'warning',
        code: 'npcWithoutNavigation',
        params: { object: first.name, count: String(walkers.length) },
        link: link(first),
      });
    }
    return;
  }
  for (const walker of walkers) {
    const at = walker.worldPosition();
    if (navigation.nearest(at, 1.2) === null) {
      problems.push({
        severity: 'error',
        code: 'npcOutsideNavigation',
        params: { object: walker.name },
        link: link(walker),
      });
    }
  }
}

function checkPlayers(objects: readonly GameObject[], problems: Problem[]): void {
  const players = objects.filter((object) =>
    object.components.some(
      (component) => component.enabled && isPlayerControl(component.definition.type),
    ),
  );
  const first = players[0];
  if (!first) return;
  const hasCamera = objects.some(
    (object) =>
      object.activeInHierarchy &&
      object.components.some(
        (component) => component.enabled && component.definition.type === 'camera',
      ),
  );
  if (!hasCamera) {
    problems.push({
      severity: 'error',
      code: 'playerWithoutCamera',
      params: { object: first.name },
      link: link(first),
    });
  }
}

/**
 * Objects with a model but no collider are listed together: one line, not one per tree. A figure
 * with a Character Controller counts as having one.
 */
function checkColliders(objects: readonly GameObject[], problems: Problem[]): void {
  const without = objects.filter((object) => {
    const renderer = object.components.find(
      (component) => component.enabled && component.definition.type === 'meshRenderer',
    );
    if (!renderer || !renderer.values['model']) return false;
    // A Character Controller is the collision shape of a figure.
    return !object.components.some(
      (component) =>
        component.definition.type.endsWith('Collider') ||
        component.definition.type === 'characterController',
    );
  });
  const first = without[0];
  if (!first) return;
  problems.push({
    severity: 'info',
    code: 'modelWithoutCollider',
    params: { object: first.name, count: String(without.length) },
    link: link(first),
  });
}
