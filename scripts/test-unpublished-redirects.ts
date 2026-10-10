import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { unpublishedTeczkaRedirects } from '../src/lib/public-teczki.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

function readDist(rel: string): string {
  return readFileSync(join(DIST, rel), 'utf8');
}

function isAstroRedirectPage(html: string, destination: string): boolean {
  const dest = destination.replace(/\/$/, '') || '/';
  const refresh = /http-equiv=["']refresh["']/i.test(html);
  const pointsHere =
    html.includes(`url=${dest}`) ||
    html.includes(`url=${dest}/`) ||
    html.includes(`href="${dest}"`) ||
    html.includes(`href="${dest}/"`) ||
    html.includes(`href='${dest}'`) ||
    html.includes(`href='${dest}/'`);
  return refresh && pointsHere;
}

function isNormalTeczkaPage(html: string): boolean {
  if (/http-equiv=["']refresh["']/i.test(html)) return false;
  return html.includes('TECZKA') || html.includes('page-title') || html.includes('project-body');
}

const distReady = existsSync(join(DIST, 'archive', '120h-mega-techno-obecnosci', 'index.html'));

describe('built unpublished teczka redirects', { skip: !distReady }, () => {
  it('writes redirect HTML over /archive/120h-kultowa and /archiwistka/120h-kultowa', () => {
    const archiveHtml = readDist('archive/120h-kultowa/index.html');
    const archiwistkaHtml = readDist('archiwistka/120h-kultowa/index.html');

    assert.ok(
      isAstroRedirectPage(archiveHtml, '/archive'),
      'dist/archive/120h-kultowa/index.html must redirect to /archive',
    );
    assert.ok(
      isAstroRedirectPage(archiwistkaHtml, '/archiwistka'),
      'dist/archiwistka/120h-kultowa/index.html must redirect to /archiwistka',
    );
    assert.equal(isNormalTeczkaPage(archiveHtml), false);
    assert.equal(isNormalTeczkaPage(archiwistkaHtml), false);
  });

  it('keeps the real Konin 1994 teczka as a normal page', () => {
    const html = readDist('archive/120h-mega-techno-obecnosci/index.html');
    assert.ok(isNormalTeczkaPage(html), 'dist/archive/120h-mega-techno-obecnosci/index.html must be a teczka page');
    assert.ok(
      html.toLowerCase().includes('mega techno'),
      'real teczka page should mention Mega Techno Obecności',
    );
    assert.equal(isAstroRedirectPage(html, '/archive'), false);
  });

  it('covers every unpublished slug from the denylist', () => {
    for (const [from, to] of Object.entries(unpublishedTeczkaRedirects())) {
      const rel = `${from.replace(/^\//, '')}/index.html`;
      assert.ok(existsSync(join(DIST, rel)), `missing built redirect ${rel}`);
      assert.ok(
        isAstroRedirectPage(readDist(rel), to),
        `${rel} must redirect to ${to}`,
      );
    }
  });
});
