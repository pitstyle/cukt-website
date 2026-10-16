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

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\u00ad/g, '').replace(/\s+/g, ' ');
}

describe('habeas mentem druk draft route', () => {
  it('marks /habeas-mentem/druk as a draft, not the public habeas page', () => {
    assert.equal(isDraftPublicPath('/habeas-mentem/druk'), true);
    assert.equal(isDraftPublicPath('https://cukt.click/habeas-mentem/druk/'), true);
    assert.equal(isIndexedPublicPath('https://cukt.click/habeas-mentem/druk/'), false);
    assert.equal(isDraftPublicPath('/habeas-mentem'), false);
    assert.equal(isDraftPublicPath('/habeas-mentem/'), false);
    assert.equal(isIndexedPublicPath('https://cukt.click/habeas-mentem/'), true);
  });

  it('is not linked from nav, sitemap config, or the public habeas page', () => {
    const base = read('src/layouts/Base.astro');
    const habeas = read('src/pages/habeas-mentem.astro');
    const index = read('src/pages/index.astro');
    const astroConfig = read('astro.config.mjs');

    assert.equal(base.includes('/habeas-mentem/druk'), false);
    assert.equal(habeas.includes('/habeas-mentem/druk'), false);
    assert.equal(index.includes('/habeas-mentem/druk'), false);
    assert.match(astroConfig, /isIndexedPublicPath/);
  });

  it('keeps the baked statute snapshot and rebuild sources', () => {
    const fragment = read('src/data/habeas-mentem-druk-e3.html');
    const text = plainText(fragment);
    assert.equal((fragment.match(/class="page"/g) || []).length, 2);
    assert.equal(fragment.includes('data:font'), false);
    assert.equal(fragment.includes('data:image'), false);
    assert.match(text, /KARTA PRAW DO CHAOSU I WOLNOŚCI POZNAWCZEJ/);
    assert.match(text, /PREAMBUŁA/);
    assert.match(text, /Neuroduties/);
    assert.match(text, /Carhart-Harris/);
    assert.match(text, /Lider Lars/);
    assert.match(text, /przez Wiktoria Cukt 2\.0/);
    const blocks = read('tools/habeas-druk/blocks-hy.json').replace(/\u00ad/g, '');
    assert.match(blocks, /Art\. 10 i Art\. 16 nie występują w wersji 2\.7/);
    assert.match(blocks, /przez Wiktoria Cukt 2\.0 i Piotra Wyrzykowskiego/);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/template.html')), true);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/blocks-hy.json')), true);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/cfg.json')), true);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/build.mjs')), true);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/render.mjs')), true);
    assert.equal(existsSync(join(ROOT, 'tools/habeas-druk/README.md')), true);
    assert.equal(existsSync(join(ROOT, 'public/fonts/JetBrainsMono-Variable.ttf')), true);
    assert.equal(existsSync(join(ROOT, 'public/fonts/BebasNeue-Regular.ttf')), true);
    assert.equal(
      existsSync(join(ROOT, 'public/habeas-mentem/druk/habeas-mentem-ustawa-druk-E3-A4.pdf')),
      true,
    );
  });
});

const distPage = join(DIST, 'habeas-mentem/druk/index.html');
const distReady = existsSync(distPage);

describe('built habeas mentem druk page', { skip: !distReady }, () => {
  it('emits an unindexed A4 print page with a PDF download', () => {
    const html = readFileSync(distPage, 'utf8');
    assert.match(html, /noindex/);
    assert.match(html, /@page\{size:A4;margin:0\}|@page \{ size: A4; margin: 0 \}/);
    assert.match(html, /print-color-adjust:\s*exact/);
    assert.match(html, /Pobierz PDF/);
    assert.match(html, /habeas-mentem-ustawa-druk-E3-A4\.pdf/);
    assert.match(html, /\/fonts\/JetBrainsMono-Variable\.ttf/);
    assert.match(html, /\/fonts\/BebasNeue-Regular\.ttf/);
    assert.equal(html.includes('data:font'), false);
    assert.equal((html.match(/class="page"/g) || []).length, 2);
    assert.match(plainText(html), /KARTA PRAW DO CHAOSU I WOLNOŚCI POZNAWCZEJ/);
    assert.doesNotMatch(html, /class="nav"/);
  });

  it('omits the draft from the sitemap', () => {
    const sitemap0 = join(DIST, 'sitemap-0.xml');
    const sitemap = existsSync(sitemap0)
      ? readFileSync(sitemap0, 'utf8')
      : readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.equal(sitemap.includes('/habeas-mentem/druk'), false);
    assert.match(sitemap, /https:\/\/cukt\.click\/habeas-mentem\/?</);
  });
});
