import { evaluateExpression, parseExpression } from '@blockwerk/blocks';
import type { BreakpointCondition, DebugHit } from '@blockwerk/runtime';
import { create } from 'zustand';
import { prompt, showMessage } from './dialogs';
import { t } from './settings';

/** One breakpoint: `condition` is the text the user typed, `null` stops always. */
export interface Breakpoint {
  readonly assetId: string;
  readonly blockId: string;
  readonly condition: string | null;
}

interface DebugState {
  /** Breakpoints by `"<assetId>/<blockId>"`. */
  breakpoints: Readonly<Record<string, Breakpoint>>;
  /** Where a script stopped now (`null`: nothing is stopped). */
  hit: DebugHit | null;
  toggleBreakpoint: (assetId: string, blockId: string) => void;
  setCondition: (assetId: string, blockId: string, condition: string | null) => void;
  clearBreakpoints: () => void;
  setHit: (hit: DebugHit | null) => void;
}

const key = (assetId: string, blockId: string): string => `${assetId}/${blockId}`;

/** Breakpoints and the place the game stopped at (SPEC 9.2). */
export const useDebug = create<DebugState>()((set) => ({
  breakpoints: {},
  hit: null,
  toggleBreakpoint: (assetId, blockId) =>
    set((state) => {
      const id = key(assetId, blockId);
      if (id in state.breakpoints) {
        return {
          breakpoints: Object.fromEntries(
            Object.entries(state.breakpoints).filter(([other]) => other !== id),
          ),
        };
      }
      return { breakpoints: { ...state.breakpoints, [id]: { assetId, blockId, condition: null } } };
    }),
  setCondition: (assetId, blockId, condition) =>
    set((state) => ({
      breakpoints: {
        ...state.breakpoints,
        [key(assetId, blockId)]: { assetId, blockId, condition },
      },
    })),
  clearBreakpoints: () => set({ breakpoints: {} }),
  setHit: (hit) => set({ hit }),
}));

/** Why a condition text is not usable, or `null` if it is (empty means "always"). */
export function conditionProblem(text: string): string | null {
  if (text.trim() === '') return null;
  try {
    evaluateExpression(parseExpression(text), () => 0);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Asks for the condition of a breakpoint (empty: always stop) and keeps it if it is valid. */
export async function askBreakpointCondition(assetId: string, blockId: string): Promise<void> {
  const current = useDebug.getState().breakpoints[key(assetId, blockId)]?.condition ?? '';
  const text = await prompt(t('debug.conditionMessage'), current);
  if (text === null) return;
  const problem = conditionProblem(text);
  if (problem !== null) {
    showMessage(t('debug.conditionTitle'), t('debug.conditionInvalid', { message: problem }));
    return;
  }
  useDebug.getState().setCondition(assetId, blockId, text.trim() === '' ? null : text.trim());
}

/** The breakpoints in the form the game wants them: a condition becomes a function. */
export function breakpointConditions(): Map<string, BreakpointCondition | null> {
  const result = new Map<string, BreakpointCondition | null>();
  for (const [id, breakpoint] of Object.entries(useDebug.getState().breakpoints)) {
    const text = breakpoint.condition?.trim() ?? '';
    if (text === '') {
      result.set(id, null);
      continue;
    }
    let expression;
    try {
      expression = parseExpression(text);
    } catch {
      result.set(id, null);
      continue;
    }
    const parsed = expression;
    result.set(id, (read) => {
      const value = evaluateExpression(parsed, read);
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value !== 0;
      return value !== '' && value.toLowerCase() !== 'false';
    });
  }
  return result;
}
