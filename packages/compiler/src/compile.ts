import { defaultRegistry } from '@blockwerk/blocks';
import type { BlockRegistry } from '@blockwerk/blocks';
import { generateCode } from './codegen';
import type { GeneratedCode } from './codegen';
import type { Diagnostic } from './diagnostics';
import type { IRProgram } from './ir';
import { workspaceToIR } from './toIR';
import type { ScriptVariable } from './toIR';

/** Options for {@link compileBlockScript}. */
export interface CompileOptions {
  /** Name of the block-script asset (for the header comment). */
  readonly assetName: string;
  /** Block definitions to use. Defaults to the built-in catalog. */
  readonly registry?: BlockRegistry;
  /** Variables of the block script. */
  readonly variables?: readonly ScriptVariable[];
}

/** Result of compiling one block-script asset. */
export interface CompileResult extends GeneratedCode {
  readonly program: IRProgram;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * Compiles a serialized Blockly workspace to JavaScript generator functions
 * (Blockly JSON → IR → JavaScript). Pure function.
 */
export function compileBlockScript(workspace: unknown, options: CompileOptions): CompileResult {
  const registry = options.registry ?? defaultRegistry;
  const variables = options.variables ?? [];
  const { program, diagnostics } = workspaceToIR(workspace, registry, variables);
  const generated = generateCode(program, registry, { assetName: options.assetName, variables });
  return { ...generated, program, diagnostics };
}
