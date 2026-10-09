/**
 * Public-site gate for Archiwistka teczki.
 *
 * Origin of 120h-kultowa: CUKTAI Bot auto-syncs markdown teczki into
 * `src/content/archiwistka/` (commit messages like
 * "Auto-sync teczki from Archiwistka YYYY-MM-DD"). The file
 * `120h-kultowa.md` is an agent hallucination (invented Gdańsk-Wrzeszcz 1999
 * VHS-loop event). Piotr's decision: it must not appear on the public site.
 *
 * The sync script lives outside this repo, so a later sync can restore the
 * markdown. This module is the in-repo lock: listed slugs, hallucination
 * front matter, and the Archiwistka banner line are unpublished even if the
 * file comes back.
 *
 * Do not list `120h-mega-techno-obecnosci` here — that is the real Konin 1994
 * project and must stay public.
 */

export const UNPUBLISHABLE_TECZKA_SLUGS = new Set(['120h-kultowa']);

export const UNPUBLISHABLE_TECZKA_TITLES = new Set(['120h kultowa']);

const HALLUCINATION_STATUS = /halucynac/i;
const HALLUCINATION_BANNER = /^\s*>\s*UWAGA:\s*HALUCYNACJA AGENTÓW/im;

function normalizeId(id: string): string {
  return id.replace(/\.md$/i, '').replace(/\/$/, '').toLowerCase();
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isPublishableTeczka(entry: {
  id: string;
  data: { status?: string; title?: string };
  body?: string;
}): boolean {
  const id = normalizeId(entry.id);
  if (UNPUBLISHABLE_TECZKA_SLUGS.has(id)) return false;
  if (HALLUCINATION_STATUS.test(entry.data.status ?? '')) return false;
  if (HALLUCINATION_BANNER.test(entry.body ?? '')) return false;
  const title = normalizeTitle(entry.data.title ?? '');
  if (title && UNPUBLISHABLE_TECZKA_TITLES.has(title)) return false;
  return true;
}

export function isPublishableArchiveRef(ref: string): boolean {
  const n = normalizeTitle(ref).replace(/-/g, ' ');
  return !UNPUBLISHABLE_TECZKA_TITLES.has(n);
}

export function isPublishablePublicPath(pathname: string): boolean {
  const path = pathname.replace(/\\/g, '/').toLowerCase();
  for (const slug of UNPUBLISHABLE_TECZKA_SLUGS) {
    if (path.includes(`/${slug}`)) return false;
  }
  return true;
}
