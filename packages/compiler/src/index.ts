export type { IRExpression, IRFunction, IRProgram, IRScript, IRStatement } from './ir';
export { CompileError } from './diagnostics';
export type { Diagnostic, DiagnosticCode } from './diagnostics';
export { parseWorkspace, workspaceSignatures, workspaceToIR } from './toIR';
export { CALL_KINDS, DEFINITION_KINDS, functionKey, PARAM_TYPES, signatureOf } from './functions';
export type { CustomKind, CustomParam, CustomSignature, ParamType } from './functions';
export type {
  IRResult,
  ScriptVariable,
  SerializedBlock,
  SerializedConnection,
  SerializedWorkspace,
} from './toIR';
export { CodegenError, generateCode, literal } from './codegen';
export type { CodegenOptions, GeneratedCode } from './codegen';
export { buildLibrary, compileBlockScript, compileProject, EMPTY_LIBRARY } from './compile';
export type { CompileOptions, CompileResult, ProjectLibrary, ProjectScript } from './compile';
export { identifier, NameTable, stableHash } from './names';
