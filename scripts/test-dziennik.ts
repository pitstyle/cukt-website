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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DZIENNIK_DIR = join(ROOT, 'src/content/dziennik');
const DIST = join(ROOT, 'dist');

const TECHNICAL_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'kolejka IG', re: /kolejka\s+IG/i },
  { name: 'Format:', re: /\bFormat:/ },
  { name: 'rura N', re: /\brura\s+\d+/i },
  { name: 'slajd', re: /\bslajd/i },
  { name: 'Stan:', re: /\bStan:/ },
  { name: 'DO PUBLIKACJI', re: /DO PUBLIKACJI/i },
  { name: 'STATUS', re: /\bSTATUS\b/ },
  { name: 'TODO', re: /\bTODO\b/ },
];

const PATH_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: '~/', re: /~\// },
  { name: '/Users/', re: /\/Users\// },
  { name: '/home/', re: /\/home\// },
];

const SECRET_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'sk-', re: /\bsk-[A-Za-z0-9]/ },
  { name: 'ghp_', re: /\bghp_[A-Za-z0-9]+/ },
  { name: 'xox', re: /\bxox[a-z]?-/i },
  { name: 'API_KEY=', re: /API_KEY\s*=/ },
  { name: 'tokens', re: /\btokens?\b/i },
];

const INTERNAL_HOST_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: '100.x tailscale', re: /\b100\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/ },
  { name: '.ts.net', re: /\.ts\.net\b/i },
  { name: 'localhost', re: /\blocalhost\b/i },
];

const MODEL_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'GPT', re: /\bGPT\b/i },
  { name: 'Claude', re: /\bClaude\b/i },
  { name: 'Gemini', re: /\bGemini\b/i },
  { name: 'DeepSeek', re: /\bDeepSeek\b/i },
  { name: 'Llama', re: /\bLlama\b/i },
  { name: 'Qwen', re: /\bQwen\b/i },
  { name: 'Bielik', re: /\bBielik\b/i },
  { name: 'OpenAI', re: /\bOpenAI\b/i },
  { name: 'Anthropic', re: /\bAnthropic\b/i },
  { name: 'cheaperinference', re: /\bcheaperinference\b/i },
  { name: 'OpenRouter', re: /\bOpenRouter\b/i },
];

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

function collectViolations(text: string): string[] {
  const found: string[] = [];
  for (const group of [
    TECHNICAL_PATTERNS,
    PATH_PATTERNS,
    SECRET_PATTERNS,
    INTERNAL_HOST_PATTERNS,
    MODEL_PATTERNS,
  ]) {
    for (const { name, re } of group) {
      if (re.test(text)) found.push(name);
    }
  }
  return found;
}

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

      const violations = collectViolations(raw);
      assert.deepEqual(
        violations,
        [],
        `${file}: forbidden content patterns: ${violations.join(', ')}`,
      );

      // Body is also covered by raw, but keep an explicit check for clarity.
      assert.deepEqual(collectViolations(body), [], `${file}: body has forbidden patterns`);
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
});
