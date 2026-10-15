import type { BlockScriptData, VariableData } from './schema';

/** A block script of the project, as the refactoring functions see it. */
export interface ScriptRef {
  readonly id: string;
  readonly data: BlockScriptData;
}

/** A game-scoped variable and the scripts that declare it. */
export interface SharedVariable {
  readonly variable: VariableData;
  /** IDs of the block-script assets that carry the declaration. */
  readonly scripts: readonly string[];
}

/**
 * The game-scoped variables of a project (SPEC 7.4). A game variable has one ID for the whole
 * project; every script that uses it carries a copy of the declaration with the same ID, and
 * all copies show the same name. If copies disagree (hand-edited files), the first one wins.
 */
export function sharedGameVariables(scripts: Iterable<ScriptRef>): SharedVariable[] {
  const byId = new Map<string, { variable: VariableData; scripts: string[] }>();
  for (const script of scripts) {
    for (const variable of script.data.variables) {
      if (variable.scope !== 'game') continue;
      const known = byId.get(variable.id);
      if (known) known.scripts.push(script.id);
      else byId.set(variable.id, { variable, scripts: [script.id] });
    }
  }
  return [...byId.values()].sort((a, b) => a.variable.name.localeCompare(b.variable.name));
}

/**
 * Renames a game variable in every script that declares it ("Rename everywhere"). Returns the
 * new data of the scripts that changed; blocks refer to variables by ID and need no change.
 */
export function renameGameVariable(
  scripts: Iterable<ScriptRef>,
  variableId: string,
  name: string,
): Map<string, BlockScriptData> {
  const changed = new Map<string, BlockScriptData>();
  for (const script of scripts) {
    let touched = false;
    const variables = script.data.variables.map((variable) => {
      if (variable.id !== variableId || variable.scope !== 'game' || variable.name === name)
        return variable;
      touched = true;
      return { ...variable, name };
    });
    if (touched) changed.set(script.id, { ...script.data, variables });
  }
  return changed;
}

/**
 * Lets a script use a game variable of the project: adds a copy of the declaration (same ID,
 * name, type, start value and "saved" flag). Returns `null` if the script has it already.
 */
export function adoptGameVariable(
  data: BlockScriptData,
  variable: VariableData,
): BlockScriptData | null {
  if (data.variables.some((item) => item.id === variable.id)) return null;
  return {
    ...data,
    variables: [...data.variables, { ...variable, scope: 'game', inspector: false }],
  };
}

/** Changes that must reach every declaration of a game variable (type, start value, saved). */
export function updateGameVariable(
  scripts: Iterable<ScriptRef>,
  variableId: string,
  change: Partial<Pick<VariableData, 'type' | 'default' | 'saved'>>,
): Map<string, BlockScriptData> {
  const changed = new Map<string, BlockScriptData>();
  for (const script of scripts) {
    let touched = false;
    const variables = script.data.variables.map((variable) => {
      if (variable.id !== variableId || variable.scope !== 'game') return variable;
      touched = true;
      return { ...variable, ...change };
    });
    if (touched) changed.set(script.id, { ...script.data, variables });
  }
  return changed;
}
