/** `a=b;c=d` → pairs. */
export function parseList(text: string): [string, string][] {
  return text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const split = entry.lastIndexOf('=');
      return split > 0
        ? ([[entry.slice(0, split).trim(), entry.slice(split + 1).trim()]] as [string, string][])
        : [];
    });
}

/** Attachments are written as `item@point;item@point`. */
export function parseAttachments(text: string): [string, string][] {
  return text
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const split = entry.lastIndexOf('@');
      return split > 0
        ? ([[entry.slice(0, split).trim(), entry.slice(split + 1).trim()]] as [string, string][])
        : [];
    });
}
