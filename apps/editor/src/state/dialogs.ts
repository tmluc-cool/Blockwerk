import { create } from 'zustand';

/** A modal dialog request. */
export type DialogRequest =
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
