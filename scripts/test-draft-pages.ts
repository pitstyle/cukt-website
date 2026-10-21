import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isDraftPublicPath, isIndexedPublicPath } from '../src/lib/draft-pages.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

describe('portfolio draft route', () => {
  it('marks /portfolio as a draft, not other public pages', () => {
    assert.equal(isDraftPublicPath('/portfolio'), true);
    assert.equal(isDraftPublicPath('https://cukt.click/portfolio/'), true);
    assert.equal(isIndexedPublicPath('https://cukt.click/portfolio/'), false);
    assert.equal(isDraftPublicPath('/habeas-mentem'), false);
    assert.equal(isIndexedPublicPath('https://cukt.click/habeas-mentem/'), true);
  });

  it('is not linked from nav, homepage, or sitemap config without the draft filter', () => {
    const base = read('src/layouts/Base.astro');
    const index = read('src/pages/index.astro');
    const astroConfig = read('astro.config.mjs');

    assert.equal(base.includes('href="/portfolio"'), false);
    assert.equal(index.includes('/portfolio'), false);
    assert.match(astroConfig, /isIndexedPublicPath/);
  });
});

const distPage = join(DIST, 'portfolio/index.html');
const distReady = existsSync(distPage);

describe('built portfolio draft page', { skip: !distReady }, () => {
  it('emits robots noindex', () => {
    const html = readFileSync(distPage, 'utf8');
    assert.match(html, /noindex/);
  });

  it('omits the draft from the sitemap', () => {
    const sitemap0 = join(DIST, 'sitemap-0.xml');
    const sitemap = existsSync(sitemap0)
      ? readFileSync(sitemap0, 'utf8')
      : readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('/portfolio'), false);
  });
});
