/**
 * Content-only contract for future autonomous dziennik PRs.
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-dziennik-content-only.ts <file> [file...]
 *   git diff --name-only ... | node --experimental-strip-types scripts/check-dziennik-content-only.ts --stdin
 *
 * Exits 0 when every path is under src/content/dziennik/**.
 * Exits 1 when any path falls outside that tree (or the list is empty).
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED_PREFIX = 'src/content/dziennik/';

export function normalizePath(filePath: string): string {
  return filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

export function isDziennikContentPath(filePath: string): boolean {
  const path = normalizePath(filePath);
  if (!path || path.startsWith('#')) return true; // ignore blanks / comments
  return path.startsWith(ALLOWED_PREFIX);
}

export function findNonDziennikPaths(files: string[]): string[] {
  return files
    .map(normalizePath)
    .filter((path) => path.length > 0 && !path.startsWith('#'))
    .filter((path) => !isDziennikContentPath(path));
}

export function assertDziennikContentOnly(files: string[]): void {
  const concrete = files
    .map(normalizePath)
    .filter((path) => path.length > 0 && !path.startsWith('#'));

  if (concrete.length === 0) {
    throw new Error('content-only check requires at least one changed file under src/content/dziennik/');
  }

  const outside = findNonDziennikPaths(concrete);
  if (outside.length > 0) {
    throw new Error(
      `content-only PR may only touch ${ALLOWED_PREFIX}**\n` +
        outside.map((path) => `  - ${path}`).join('\n'),
    );
  }

  const inside = concrete.filter((path) => isDziennikContentPath(path));
  if (inside.length === 0) {
    throw new Error(`content-only PR must include at least one file under ${ALLOWED_PREFIX}`);
  }
}

function readStdinPaths(): string[] {
  const raw = readFileSync(0, 'utf8');
  return raw.split(/\r?\n/);
}

function main(argv: string[]): number {
  const useStdin = argv.includes('--stdin');
  const files = useStdin
    ? readStdinPaths()
    : argv.filter((arg) => arg !== '--stdin' && !arg.endsWith('check-dziennik-content-only.ts'));

  try {
    assertDziennikContentOnly(files);
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
