import { defaultRegistry } from '@blockwerk/blocks';
import type { BlockRegistry } from '@blockwerk/blocks';
import { generateCode } from './codegen';
import type { GeneratedCode } from './codegen';
import type { Diagnostic } from './diagnostics';
import type { CustomSignature } from './functions';
import type { IRExpression, IRFunction, IRProgram, IRStatement } from './ir';
import { workspaceSignatures, workspaceToIR } from './toIR';
import type { ScriptVariable } from './toIR';

/** A block script of the project, as {@link buildLibrary} and {@link compileProject} read it. */
export interface ProjectScript {
  /** Asset ID of the block script. */
  readonly assetId: string;
  /** Name of the block-script asset (for the header comment). */
  readonly assetName: string;
  /** Serialized Blockly workspace. */
  readonly workspace: unknown;
  /** Variables of the block script. */
  readonly variables?: readonly ScriptVariable[];
}

/**
 * The project-wide custom blocks (SPEC 7.6): every definition marked "in all scripts" with its
 * IR, ready to be linked into the scripts that call it.
 */
export interface ProjectLibrary {
  readonly signatures: ReadonlyMap<string, CustomSignature>;
  readonly functions: ReadonlyMap<string, IRFunction>;
}

/** Options for {@link compileBlockScript}. */
export interface CompileOptions {
  /** Name of the block-script asset (for the header comment). */
  readonly assetName: string;
  /** ID of the block-script asset; custom blocks of this script are keyed with it. */
  readonly assetId?: string;
  /** Block definitions to use. Defaults to the built-in catalog. */
  readonly registry?: BlockRegistry;
  /** Variables of the block script. */
  readonly variables?: readonly ScriptVariable[];
  /** Project-wide custom blocks this script may call (see {@link buildLibrary}). */
  readonly library?: ProjectLibrary;
  /** Add the hooks for breakpoints and stepping (see `CodegenOptions.debug`). */
  readonly debug?: boolean;
}

/** Result of compiling one block-script asset. */
export interface CompileResult extends GeneratedCode {
  readonly program: IRProgram;
  readonly diagnostics: readonly Diagnostic[];
}

/** An empty library. */
export const EMPTY_LIBRARY: ProjectLibrary = { signatures: new Map(), functions: new Map() };

/**
 * Reads the project-wide custom blocks out of all block scripts of a project. Cheap when no
 * script defines one. Definitions that are only visible in their own script are not part of it.
 */
export function buildLibrary(
  scripts: readonly ProjectScript[],
  registry: BlockRegistry = defaultRegistry,
): ProjectLibrary {
  const all = new Map<string, CustomSignature>();
  for (const script of scripts) {
    for (const signature of workspaceSignatures(script.workspace, script.assetId)) {
      all.set(signature.key, signature);
    }
  }
  const shared = new Map([...all].filter(([, signature]) => signature.scope === 'project'));
  if (shared.size === 0) return EMPTY_LIBRARY;
  const functions = new Map<string, IRFunction>();
  for (const script of scripts) {
    if (![...shared.values()].some((signature) => signature.assetId === script.assetId)) continue;
    const variables = script.variables ?? [];
    const { program } = workspaceToIR(script.workspace, registry, variables, {
      assetId: script.assetId,
      signatures: shared,
    });
    for (const fn of program.functions) {
      if (shared.has(fn.id)) functions.set(fn.id, { ...fn, variables, external: true });
    }
  }
  return { signatures: shared, functions };
}

/** Keys of the custom blocks a list of statements calls. */
function callsIn(statements: readonly IRStatement[], into: Set<string>): void {
  const expression = (value: IRExpression): void => {
    if (value.kind === 'call') {
      into.add(value.functionId);
      value.args.forEach(expression);
    } else if (value.kind === 'block') {
      Object.values(value.args).forEach(expression);
    }
  };
  for (const statement of statements) {
    switch (statement.kind) {
      case 'call':
        into.add(statement.functionId);
        statement.args.forEach(expression);
        break;
      case 'block':
        Object.values(statement.args).forEach(expression);
        for (const body of Object.values(statement.substacks)) callsIn(body, into);
        break;
      case 'declareLocal':
      case 'setLocal':
        expression(statement.value);
        break;
      case 'return':
        if (statement.value) expression(statement.value);
        break;
    }
  }
}

/** Adds the project-wide functions a program calls (and what those call) to its own functions. */
function link(program: IRProgram, library: ProjectLibrary): IRProgram {
  if (library.functions.size === 0) return program;
  const functions = [...program.functions];
  const have = new Set(functions.map((fn) => fn.id));
  const wanted = new Set<string>();
  for (const script of program.scripts) callsIn(script.body, wanted);
  for (const fn of functions) callsIn(fn.body, wanted);
  const queue = [...wanted];
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || have.has(key)) continue;
    const fn = library.functions.get(key);
    if (!fn) continue;
    have.add(key);
    functions.push(fn);
    const more = new Set<string>();
    callsIn(fn.body, more);
    queue.push(...more);
  }
  return { scripts: program.scripts, functions };
}

/**
 * Compiles a serialized Blockly workspace to JavaScript generator functions
 * (Blockly JSON → IR → JavaScript). Pure function.
 */
export function compileBlockScript(workspace: unknown, options: CompileOptions): CompileResult {
  const registry = options.registry ?? defaultRegistry;
  const variables = options.variables ?? [];
  const library = options.library ?? EMPTY_LIBRARY;
  const { program: own, diagnostics } = workspaceToIR(workspace, registry, variables, {
    ...(options.assetId === undefined ? {} : { assetId: options.assetId }),
    signatures: library.signatures,
  });
  const program = link(own, library);
  const generated = generateCode(program, registry, {
    assetName: options.assetName,
    variables,
    ...(options.debug ? { debug: true } : {}),
  });
  return { ...generated, program, diagnostics };
}

/** Compiles every block script of a project; project-wide custom blocks are linked in. */
export function compileProject(
  scripts: readonly ProjectScript[],
  registry: BlockRegistry = defaultRegistry,
  options: { readonly debug?: boolean } = {},
): Map<string, CompileResult> {
  const library = buildLibrary(scripts, registry);
  const results = new Map<string, CompileResult>();
  for (const script of scripts) {
    results.set(
      script.assetId,
      compileBlockScript(script.workspace, {
        assetName: script.assetName,
        assetId: script.assetId,
        registry,
        variables: script.variables ?? [],
        library,
        ...(options.debug ? { debug: true } : {}),
      }),
    );
  }
  return results;
}
