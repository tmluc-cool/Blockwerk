/** Converts a glob (`*` within a folder, `**` across folders) to a regular expression. */
export function globToRegExp(glob: string): RegExp {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i] ?? '';
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      pattern += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (char === '*') {
      pattern += '[^/]*';
    } else if (char === '?') {
      pattern += '[^/]';
    } else {
      pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`, 'i');
}

/** The fixed folder in front of the first wildcard (`a/b/*.gltf` → `a/b/`). */
export function globBase(glob: string): string {
  const wildcard = glob.search(/[*?]/);
  const head = wildcard < 0 ? glob : glob.slice(0, wildcard);
  return head.slice(0, head.lastIndexOf('/') + 1);
}
