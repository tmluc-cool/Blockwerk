/** Machine-readable diagnostic codes. The editor turns them into localized messages. */
export type DiagnosticCode = 'unknownBlock' | 'notAStatement' | 'notAValue' | 'invalidField';

/** A problem found while compiling, pointing at the block that caused it. */
export interface Diagnostic {
  readonly severity: 'error' | 'warning';
  readonly code: DiagnosticCode;
  /** ID of the offending block. */
  readonly blockId: string;
  /** Extra details, e.g. the block type or field name. */
  readonly params: Readonly<Record<string, string>>;
}

/** Thrown when the input is not valid Blockly JSON at all. */
export class CompileError extends Error {
  override readonly name = 'CompileError';
}
