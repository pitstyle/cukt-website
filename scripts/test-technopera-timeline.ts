import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'src/pages/technopera.astro');

function timelineItemForYear(source: string, year: string): string {
  const items = source.split(/<div class="timeline-item[^"]*">/);
  const match = items.find((item) => item.includes(`<div class="timeline-year">${year}</div>`));
  assert.ok(match, `expected a timeline item for ${year}`);
  return match;
}

function attr(html: string, name: string): string {
  const match = html.match(new RegExp(`${name}="([^"]*)"`));
  assert.ok(match, `expected ${name} on the 1997 timeline item`);
  return match[1];
}

function firstIndex(text: string, pattern: RegExp, label: string): number {
  const index = text.search(pattern);
  assert.ok(index >= 0, `${label} must mention ${pattern}`);
  return index;
}

function assertShowOrder(label: string, text: string) {
  const wro = firstIndex(text, /WRO/i, label);
  const banff = firstIndex(text, /Banff/i, label);
  const dessau = firstIndex(text, /Dessau|Ostranenie|Bauhaus/i, label);
  assert.ok(
    wro < banff && banff < dessau,
    `${label} must list WRO before Banff before Dessau; got: ${text}`,
  );
}

describe('technopera 1997 timeline order', () => {
  const source = readFileSync(PAGE, 'utf8');
  const item = timelineItemForYear(source, '1997');

  it('lists WRO, then Banff, then Dessau in English', () => {
    assertShowOrder('data-en', attr(item, 'data-en'));
  });

  it('lists WRO, then Banff, then Dessau in Polish', () => {
    assertShowOrder('data-pl', attr(item, 'data-pl'));
  });
});
