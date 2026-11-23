/**
 * CI gate for dziennik/* auto-merge. Reads eligibility from env + CHANGED_FILES.
 * Fail-closed: any mismatch exits 1.
 *
 * Env:
 *   HEAD_REF, BASE_REF, HEAD_REPO, BASE_REPO, AUTHOR, OWNER, CHANGED_FILES
 */

import { evaluateDziennikAutoMerge } from './check-dziennik-content-only.ts';

const files = (process.env.CHANGED_FILES || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const result = evaluateDziennikAutoMerge({
  headRef: process.env.HEAD_REF || '',
  baseRef: process.env.BASE_REF || '',
  headRepoFullName: process.env.HEAD_REPO || '',
  baseRepoFullName: process.env.BASE_REPO || '',
  authorLogin: process.env.AUTHOR || '',
  ownerLogin: process.env.OWNER || '',
  changedFiles: files,
});

if (!result.ok) {
  console.error(`auto-merge blocked: ${result.reason}`);
  process.exit(1);
}

console.log('auto-merge eligibility ok');
