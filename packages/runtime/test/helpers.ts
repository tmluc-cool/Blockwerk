import type { ComponentData, SceneData, SceneObjectData, VariableData } from '@blockwerk/project';
import type { CompiledScriptModule, ScriptAsset, ScriptEntry } from '../src';

let counter = 0;

/** Creates a test ID that satisfies the stable-ID format. */
export function testId(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`.padEnd(12, '0').slice(0, 12);
}

/** Creates scene-object data with defaults. */
export function objectData(overrides: Partial<SceneObjectData> = {}): SceneObjectData {
  return {
    name: 'Object',
    parent: null,
    order: 0,
    active: true,
    tag: 'Untagged',
    layer: 'Default',
    static: false,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    components: [],
    ...overrides,
  };
}

/** Creates component data. */
export function component(
  type: string,
  values: ComponentData['values'] = {},
  id = testId('c'),
): ComponentData {
  return { id, type, enabled: true, values };
}

/** Creates scene data from objects by ID. */
export function sceneData(objects: Record<string, SceneObjectData>): SceneData {
  return {
    formatVersion: 1,
    environment: { ambientIntensity: 0.3, fog: { enabled: false, near: 10, far: 100 } },
    objects,
  };
}

/** Wraps hand-written script entries as a script asset. */
export function scriptAsset(
  assetId: string,
  entries: ScriptEntry[],
  variables: readonly VariableData[] = [],
): ScriptAsset {
  const module: CompiledScriptModule = { scripts: entries };
  return {
    assetId,
    module,
    variables,
    lineToBlock: [],
    sourceUrl: `blockwerk://test/${assetId}.js`,
  };
}
