import { createContext, useContext } from 'react';

/** The visible label of the Inspector row a field sits in, so its control gets an accessible name. */
export const FieldLabelContext = createContext<string | undefined>(undefined);

/** The accessible name of a control in an Inspector row; `part` names one of several controls. */
export function useFieldLabel(part?: string): string | undefined {
  const label = useContext(FieldLabelContext);
  if (label === undefined) return part;
  return part ? `${label} ${part}` : label;
}
