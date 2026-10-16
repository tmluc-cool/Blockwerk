// Writes the changelog of a release from the Conventional Commits between two tags (SPEC 9.5):
//   node scripts/changelog.mjs <from tag or empty> <to ref> > notes.md
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Headings of the commit types, in the order they appear. */
const SECTIONS = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Changes under the hood'],
  ['docs', 'Documentation'],
  ['test', 'Tests'],
  ['ci', 'Build and CI'],
  ['build', 'Build and CI'],
  ['chore', 'Other'],
  ['style', 'Other'],
];

/** `feat(runtime)!: add a thing` → type `feat`, scope `runtime`, text `add a thing`. */
export function parseCommit(subject) {
  const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/.exec(subject);
  if (!match) return { type: 'chore', scope: null, breaking: false, text: subject };
  return { type: match[1], scope: match[2] ?? null, breaking: Boolean(match[3]), text: match[4] };
}

/** The changelog as Markdown from commit subjects (newest first, as `git log` gives them). */
export function buildChangelog(subjects, title) {
  const groups = new Map();
  const breaking = [];
  for (const subject of subjects) {
    // Merge commits of pull requests carry no information of their own.
    if (/^Merge (pull request|branch)/.test(subject)) continue;
    const commit = parseCommit(subject);
    const heading = SECTIONS.find(([type]) => type === commit.type)?.[1] ?? 'Other';
    const line = `- ${commit.scope ? `**${commit.scope}:** ` : ''}${commit.text}`;
    if (!groups.has(heading)) groups.set(heading, []);
    groups.get(heading).push(line);
    if (commit.breaking) breaking.push(line);
  }
  const lines = [`## ${title}`, ''];
  if (breaking.length > 0) lines.push('### Breaking changes', '', ...breaking, '');
  const headings = [...new Set(SECTIONS.map(([, heading]) => heading))];
  for (const heading of headings) {
    const entries = groups.get(heading);
    if (entries) lines.push(`### ${heading}`, '', ...entries, '');
  }
  if (groups.size === 0) lines.push('No changes recorded.', '');
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [from, to = 'HEAD'] = process.argv.slice(2);
  const range = from ? `${from}..${to}` : to;
  const log = execFileSync('git', ['log', '--no-merges', '--pretty=format:%s', range], {
    encoding: 'utf8',
  });
  const subjects = log.split('\n').filter(Boolean);
  process.stdout.write(buildChangelog(subjects, to.replace(/^refs\/tags\//, '')));
}
