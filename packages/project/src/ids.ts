const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Length of stable IDs. */
export const ID_LENGTH = 12;

/** Creates a new random stable ID (12 lower-case letters and digits). */
export function createId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}

/** Whether a string is a valid stable ID. */
export function isId(value: string): boolean {
  return /^[a-z0-9]{12}$/.test(value);
}
