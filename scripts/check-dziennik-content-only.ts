/**
 * Content-only contract for future autonomous dziennik PRs.
 *
 * Allowed content path: src/content/dziennik/**
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

export const DZIENNIK_CONTENT_PREFIX = 'src/content/dziennik/';
const ALLOWED_PREFIX = DZIENNIK_CONTENT_PREFIX;

export type DziennikAutoMergeContext = {
  headRef: string;
  baseRef: string;
  headRepoFullName: string;
  baseRepoFullName: string;
  authorLogin: string;
  ownerLogin: string;
  changedFiles: string[];
};

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

/**
 * Fail-closed eligibility for squash auto-merge of Mini-generated journal PRs.
 * All conditions must hold; any mismatch returns ok: false with a reason.
 */
export function evaluateDziennikAutoMerge(
  ctx: DziennikAutoMergeContext,
): { ok: true } | { ok: false; reason: string } {
  if (!ctx.headRef.startsWith('dziennik/')) {
    return { ok: false, reason: `head branch must start with dziennik/ (got ${ctx.headRef})` };
  }
  if (ctx.baseRef !== 'main') {
    return { ok: false, reason: `base branch must be main (got ${ctx.baseRef})` };
  }
  if (ctx.headRepoFullName !== ctx.baseRepoFullName) {
    return {
      ok: false,
      reason: `fork PRs are not auto-merged (${ctx.headRepoFullName} ≠ ${ctx.baseRepoFullName})`,
    };
  }
  if (ctx.authorLogin !== ctx.ownerLogin) {
    return {
      ok: false,
      reason: `author must be repo owner token user (got ${ctx.authorLogin}, owner ${ctx.ownerLogin})`,
    };
  }
  try {
    assertDziennikContentOnly(ctx.changedFiles);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: message };
  }
  return { ok: true };
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
