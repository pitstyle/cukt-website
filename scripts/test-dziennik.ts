import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertDziennikContentOnly,
  findNonDziennikPaths,
  isDziennikContentPath,
} from './check-dziennik-content-only.ts';
import { findDziennikForbidden } from './dziennik-forbidden.ts';
import {
  ENTRY_AVAILABLE_IN_POLISH,
  needsPolishOnlyNote,
  normalizeDziennikDate,
  renderInlineMarkdown,
  shouldShowDescriptionOnEntry,
  stripInlineMarkdown,
} from '../src/lib/dziennik.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DZIENNIK_DIR = join(ROOT, 'src/content/dziennik');
const DIST = join(ROOT, 'dist');

function listMarkdownEntries(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name))
    .sort();
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  if (!raw.startsWith('---')) {
    return { data: {}, body: raw };
  }
  const end = raw.indexOf('\n---', 3);
  if (end === -1) {
    return { data: {}, body: raw };
  }
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4);
  const data: Record<string, unknown> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value: unknown = m[2].trim();
    if (typeof value === 'string') {
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }
    }
    data[key] = value;
  }
  return { data, body };
}

describe('dziennik date normalisation', () => {
  it('formats Date and string values as YYYY-MM-DD', () => {
    assert.equal(normalizeDziennikDate(new Date(Date.UTC(2026, 2, 23))), '2026-03-23');
    assert.equal(normalizeDziennikDate('2026-03-23'), '2026-03-23');
    assert.equal(normalizeDziennikDate('2026-03-23T12:00:00.000Z'), '2026-03-23');
  });
});

describe('dziennik forbidden patterns', () => {
  it('blocks kolejka IG, slajd, model names, and relative internal paths', () => {
    assert.ok(findDziennikForbidden('wrzuć do kolejka IG dziś').includes('kolejka IG'));
    assert.ok(findDziennikForbidden('zobacz slajd 3').includes('slajd'));
    assert.ok(findDziennikForbidden('trained with GPT').includes('GPT'));
    assert.ok(findDziennikForbidden('see publications/habeas/notes.md').includes('publications/'));
    assert.ok(findDziennikForbidden('open wiki/index.md').includes('wiki/'));
    assert.ok(findDziennikForbidden('from state/queue.json').includes('state/'));
    assert.ok(
      findDziennikForbidden('path research/outline.md').includes('relative .md/.json/.py path'),
    );
    assert.ok(findDziennikForbidden('load helper.py').includes('bare .md/.json/.py file'));
  });

  it('allows ordinary prose "token" but blocks secret-looking contexts', () => {
    assert.deepEqual(findDziennikForbidden('The legal token of unpredictability.'), []);
    assert.ok(findDziennikForbidden('token: abc123').includes('token assignment'));
    assert.ok(findDziennikForbidden('token = abc123').includes('token assignment'));
    assert.ok(findDziennikForbidden('Authorization: Bearer abc.def').includes('Bearer token'));
    assert.ok(findDziennikForbidden('sk-abcdefghijklmnop').includes('sk-'));
    assert.ok(findDziennikForbidden('ghp_abcdefghijklmnop').includes('ghp_'));
  });

  it('documents sync with cuktai-3.0 dziennik_site.py', () => {
    const src = readFileSync(join(ROOT, 'scripts/dziennik-forbidden.ts'), 'utf8');
    assert.match(src, /cuktai\/habeas\/dziennik_site\.py/);
    assert.match(src, /KEEP IN SYNC/i);
  });
});

describe('dziennik EN fallback note', () => {
  it('flags missing EN fields for the Polish-only note', () => {
    assert.equal(
      needsPolishOnlyNote({ title: 'T', thesis: 'Teza' }),
      true,
    );
    assert.equal(
      needsPolishOnlyNote({
        title: 'T',
        title_en: 'Title',
        thesis: 'Teza',
        thesis_en: 'Thesis',
      }),
      false,
    );
    assert.equal(
      needsPolishOnlyNote({
        title: 'T',
        title_en: 'Title',
        thesis: 'Teza',
        thesis_en: 'Thesis',
        description: 'Opis',
      }),
      true,
    );
    assert.equal(ENTRY_AVAILABLE_IN_POLISH, 'Entry available in Polish');
  });
});

describe('dziennik inline markdown + description dedupe', () => {
  it('renders inline emphasis instead of raw markers', () => {
    assert.equal(
      renderInlineMarkdown('Teza **mocna** i *miękka*'),
      'Teza <strong>mocna</strong> i <em>miękka</em>',
    );
    assert.equal(stripInlineMarkdown('Teza **mocna**'), 'Teza mocna');
    assert.match(renderInlineMarkdown('<script>'), /&lt;script&gt;/);
  });

  it('hides description when it duplicates body or signature text', () => {
    const signature =
      'Dokument wytworzony autonomicznie przez Autonomiczny Urząd Kultury Technicznej CUKTAI. Wiktoria Cukt 2.0 — AI Prezydentka Republiki. Zrealizowano w ramach stypendium Ministra Kultury i Dziedzictwa Narodowego.';
    assert.equal(shouldShowDescriptionOnEntry(signature, 'ciało wpisu bez podpisu'), false);
    assert.equal(
      shouldShowDescriptionOnEntry('krótki opis unikalny', `## Body\n\n${signature}`),
      true,
    );
    assert.equal(
      shouldShowDescriptionOnEntry('powtórka w ciele', 'Wstęp.\n\npowtórka w ciele\n\nKoniec.'),
      false,
    );
    assert.equal(shouldShowDescriptionOnEntry(undefined, 'body'), false);
  });
});

describe('dziennik content safety', () => {
  const files = listMarkdownEntries(DZIENNIK_DIR);

  it('has a dziennik content directory', () => {
    assert.ok(existsSync(DZIENNIK_DIR), 'src/content/dziennik must exist');
  });

  it('every entry has a non-empty thesis and no forbidden text', () => {
    assert.ok(files.length > 0, 'expected at least one example entry in src/content/dziennik');

    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const thesis = typeof data.thesis === 'string' ? data.thesis.trim() : '';
      assert.ok(thesis.length > 0, `${file}: thesis must be a non-empty string`);

      const violations = findDziennikForbidden(raw);
      assert.deepEqual(
        violations,
        [],
        `${file}: forbidden content patterns: ${violations.join(', ')}`,
      );
      assert.deepEqual(findDziennikForbidden(body), [], `${file}: body has forbidden patterns`);
    }
  });

  it('ships a draft example that will not publish', () => {
    const example = files.find((f) => f.endsWith('przyklad-formatu.md'));
    assert.ok(example, 'expected src/content/dziennik/przyklad-formatu.md');
    const { data } = parseFrontmatter(readFileSync(example, 'utf8'));
    assert.equal(data.draft, true);
    assert.match(String(data.thesis), /PRZYKŁAD|EXAMPLE/i);
  });
});

describe('dziennik content-only guard', () => {
  it('accepts only paths under src/content/dziennik/', () => {
    assert.equal(isDziennikContentPath('src/content/dziennik/foo.md'), true);
    assert.equal(isDziennikContentPath('src/pages/habeas-mentem.astro'), false);
    assert.deepEqual(findNonDziennikPaths([
      'src/content/dziennik/a.md',
      'astro.config.mjs',
    ]), ['astro.config.mjs']);
  });

  it('passes a content-only file list and fails mixed lists', () => {
    assert.doesNotThrow(() =>
      assertDziennikContentOnly(['src/content/dziennik/a.md', 'src/content/dziennik/b.md']),
    );
    assert.throws(
      () => assertDziennikContentOnly(['src/content/dziennik/a.md', 'README.md']),
      /content-only PR may only touch/,
    );
    assert.throws(() => assertDziennikContentOnly([]), /at least one changed file/);
  });
});

const distIndex = join(DIST, 'habeas-mentem/dziennik/index.html');
const distReady = existsSync(distIndex);

describe('built dziennik pages', { skip: !distReady }, () => {
  it('builds the journal index and omits draft entries', () => {
    const html = readFileSync(distIndex, 'utf8');
    assert.match(html, /DZIENNIK|journal|dziennik/i);
    assert.equal(html.includes('przyklad-formatu'), false);
    assert.equal(existsSync(join(DIST, 'habeas-mentem/dziennik/przyklad-formatu/index.html')), false);
  });

  it('includes journal URLs in the sitemap', () => {
    const sitemap0 = join(DIST, 'sitemap-0.xml');
    const sitemap = existsSync(sitemap0)
      ? readFileSync(sitemap0, 'utf8')
      : readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
    assert.ok(sitemap.includes('/habeas-mentem/dziennik'), 'sitemap should list dziennik');
    assert.equal(sitemap.includes('przyklad-formatu'), false);
  });

  it('emits /dziennik redirect to /habeas-mentem/dziennik', () => {
    const redirectPage = join(DIST, 'dziennik/index.html');
    assert.ok(existsSync(redirectPage), 'dist/dziennik/index.html missing');
    const html = readFileSync(redirectPage, 'utf8');
    assert.match(html, /http-equiv=["']refresh["']/i);
    assert.ok(
      html.includes('/habeas-mentem/dziennik'),
      'redirect should point at /habeas-mentem/dziennik',
    );
  });

  it('wires the Polish-only EN note into journal templates', () => {
    const indexSrc = readFileSync(join(ROOT, 'src/pages/habeas-mentem/dziennik/index.astro'), 'utf8');
    const entrySrc = readFileSync(join(ROOT, 'src/pages/habeas-mentem/dziennik/[id].astro'), 'utf8');
    assert.match(indexSrc, /ENTRY_AVAILABLE_IN_POLISH/);
    assert.match(entrySrc, /ENTRY_AVAILABLE_IN_POLISH/);
    assert.match(indexSrc, /needsPolishOnlyNote/);
    assert.match(entrySrc, /needsPolishOnlyNote/);
  });
});
