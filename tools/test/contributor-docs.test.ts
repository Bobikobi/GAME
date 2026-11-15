/** Keeps the two newcomer paths and their entry pages tied to the repository they describe. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DOCUMENTS = [
  'docs/creators/README.md',
  'docs/team/ONBOARDING.md',
  'docs/STANDARDS.md',
  'CONTRIBUTING.md',
  'README.md',
  'ROADMAP.md',
] as const;
const PNPM_COMMANDS = new Set(['install']);
const REPOSITORY_ROOTS = new Set(['.claude', '.github', 'content', 'docs', 'game', 'kernel', 'schema', 'templates', 'tools']);
const ROOT_FILE = /^(?:\.[a-z][\w.-]*|[A-Z][A-Z0-9_-]*\.md|package\.json)$/;

type Reference = { document: string; value: string };
type Audit = {
  commands: Reference[];
  paths: Reference[];
  links: Reference[];
  problems: string[];
};

function pnpmScript(command: string): string | undefined {
  const words = command.trim().split(/\s+/);
  let index = 1;
  while (words[index]?.startsWith('-')) {
    if (words[index] === '--filter' || words[index] === '-C' || words[index] === '--dir') index += 2;
    else index++;
  }
  return words[index];
}

function repoPath(value: string): string | undefined {
  if (/\s|<|>|[|{}]/.test(value)) return undefined;
  const namesFolder = value.endsWith('/');
  const clean = value.replace(/[),.;:]+$/, '').replace(/\/\*$/, '').replace(/\/$/, '');
  const [root] = clean.split('/');
  // Only root-anchored paths count. Content ids such as core/west-glade and
  // examples containing placeholders are deliberately outside this rule. A
  // trailing slash names a root folder; distinctive root files name themselves.
  if (root && REPOSITORY_ROOTS.has(root) && (clean.includes('/') || namesFolder)) return clean;
  return ROOT_FILE.test(clean) ? clean : undefined;
}

function auditDocuments(): Audit {
  const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  const releasePackage = JSON.parse(readFileSync(join(ROOT, 'kernel/package.json'), 'utf8')) as { version: string };
  const commands: Reference[] = [];
  const paths: Reference[] = [];
  const links: Reference[] = [];
  const problems: string[] = [];

  for (const document of DOCUMENTS) {
    const absolute = join(ROOT, document);
    if (!existsSync(absolute)) {
      problems.push(`${document}: document does not exist`);
      continue;
    }
    const text = readFileSync(absolute, 'utf8');

    const namedCommands = [
      ...[...text.matchAll(/`(pnpm\s+[^`\n]+)`/g)].map((match) => match[1]!),
      ...[...text.matchAll(/^\s*(pnpm\s+[^\n#]+)/gm)].map((match) => match[1]!.trim()),
    ];
    for (const command of namedCommands) {
      const script = pnpmScript(command);
      commands.push({ document, value: command });
      if (script && !packageJson.scripts[script] && !PNPM_COMMANDS.has(script)) {
        problems.push(`${document}: ${command} is neither a package script nor an allowed pnpm command`);
      }
    }

    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1]!.trim().split(/\s+"/)[0]!;
      if (/^(?:https?:|mailto:|#)/.test(target)) continue;
      const path = decodeURIComponent(target.split(/[?#]/)[0]!);
      links.push({ document, value: target });
      if (!existsSync(normalize(join(ROOT, dirname(document), path)))) {
        problems.push(`${document}: relative link ${target} does not exist`);
      }
    }

    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      const path = repoPath(match[1]!);
      if (!path) continue;
      paths.push({ document, value: path });
      if (!existsSync(join(ROOT, path))) problems.push(`${document}: repository path ${path} does not exist`);
    }

    for (const match of text.matchAll(/(?:current version|where it stands)\s*\(?(?:is\s+)?v?(\d+\.\d+\.\d+)\)?/gi)) {
      if (match[1] !== releasePackage.version) {
        problems.push(`${document}: current version v${match[1]} does not match kernel/package.json v${releasePackage.version}`);
      }
    }
  }

  return { commands, paths, links, problems: [...new Set(problems)].sort() };
}

describe('the contributor entry documents', () => {
  it('name commands, paths, links and the current version that exist', () => {
    const audit = auditDocuments();
    console.log(`contributor docs: ${audit.commands.length} commands, ${audit.paths.length} paths, ${audit.links.length} relative links`);
    expect(audit.problems).toEqual([]);
  });

  it('treats only root-anchored, concrete backtick values as repository paths', () => {
    expect(repoPath('tools/anim/README.md')).toBe('tools/anim/README.md');
    expect(repoPath('kernel/')).toBe('kernel');
    expect(repoPath('AGENTS.md')).toBe('AGENTS.md');
    expect(repoPath('content/extensions/<your-handle>/')).toBeUndefined();
    expect(repoPath('core/west-glade')).toBeUndefined();
  });
});
