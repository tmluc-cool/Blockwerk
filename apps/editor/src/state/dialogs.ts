import { create } from 'zustand';
import type { CustomBlockSpec } from '../blocks/frameApi';

/** A modal dialog request. */
export type DialogRequest =
  | { kind: 'physics' }
  | {
      kind: 'customBlock';
      spec: CustomBlockSpec;
      creating: boolean;
      resolve: (spec: CustomBlockSpec | null) => void;
    }
  | { kind: 'prompt'; title: string; defaultValue: string; resolve: (value: string | null) => void }
  | { kind: 'message'; title: string; message: string }
  | {
      kind: 'choice';
      title: string;
      options: readonly { value: string; label: string }[];
      resolve: (value: string | null) => void;
    };

interface DialogState {
  dialog: DialogRequest | null;
  close: () => void;
}

/** The currently open modal dialog. */
export const useDialogs = create<DialogState>()((set) => ({
  dialog: null,
  close: () => set({ dialog: null }),
}));

/** Asks the user for a text. Resolves to `null` when cancelled. */
export function prompt(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogs.setState({ dialog: { kind: 'prompt', title, defaultValue, resolve } });
  });
}

/** Shows an information message. */
export function showMessage(title: string, message: string): void {
  useDialogs.setState({ dialog: { kind: 'message', title, message } });
}

/** Lets the user pick one of several options. Resolves to `null` when cancelled. */
export function choose(
  title: string,
  options: readonly { value: string; label: string }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogs.setState({ dialog: { kind: 'choice', title, options, resolve } });
  });
}

/** Opens the physics settings: scene gravity and the layer collision matrix. */
export function showPhysicsSettings(): void {
  useDialogs.setState({ dialog: { kind: 'physics' } });
}

/** Opens the "Make a block" / "Edit custom block" dialog. Resolves to `null` when cancelled. */
export function editCustomBlock(
  spec: CustomBlockSpec,
  creating: boolean,
): Promise<CustomBlockSpec | null> {
  return new Promise((resolve) => {
    useDialogs.setState({ dialog: { kind: 'customBlock', spec, creating, resolve } });
  });
}
