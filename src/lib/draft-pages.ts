/**
 * Unlinked draft routes: built and reachable by URL, but not in nav or sitemap.
 */

export const DRAFT_PUBLIC_PATHS = ['/portfolio'] as const;

export function isDraftPublicPath(pathname: string): boolean {
  const path = pathname.replace(/\\/g, '/').toLowerCase();
  return DRAFT_PUBLIC_PATHS.some((marker) => path.includes(marker));
}

export function isIndexedPublicPath(pathname: string): boolean {
  if (isDraftPublicPath(pathname)) return false;
  return true;
}
