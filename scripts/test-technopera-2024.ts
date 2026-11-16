import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(ROOT, 'src/pages/technopera.astro');
const DATA = join(ROOT, 'src/data/technopera.ts');

describe('technopera 2024 section', () => {
  const page = readFileSync(PAGE, 'utf8');
  const data = readFileSync(DATA, 'utf8');

  it('keeps the 2026 trailer ID untouched', () => {
    assert.match(data, /TECHNOPERA_TRAILER_YOUTUBE_ID = 'wGgNAnhErss'/);
  });

  it('adds the 2024 documentation video id', () => {
    assert.match(data, /TECHNOPERA_2024_YOUTUBE_ID = 'ugKsEBb4gTo'/);
  });

  it('uses the exact Polish title with a colon', () => {
    assert.match(page, /Technopera 2024: Czego nie wyjawia nam maszyna i dlaczego\?/);
  });

  it('links the official Shakespeare Theatre source', () => {
    assert.match(page, /TECHNOPERA_2024_SOURCE_URL/);
    assert.match(
      data,
      /teatrszekspirowski\.pl\/event\/technopera-2024-czego-nie-wyjawia-nam-maszyna-i-dlaczego\//,
    );
  });

  it('exposes a plain YouTube link', () => {
    assert.match(page, /https:\/\/youtu\.be\/\$\{TECHNOPERA_2024_YOUTUBE_ID\}|https:\/\/youtu\.be\/ugKsEBb4gTo/);
  });

  it('links the Trojmiasto.pl press review and a verbatim quote', () => {
    assert.match(page, /TECHNOPERA_2024_PRESS_URL/);
    assert.match(data, /trojmiasto\.pl\/kultura\/A-moze-ty-tez-jestes-cyborgiem/);
    assert.match(page, /Publiczność przyjęła show z entuzjazmem\./);
    assert.match(page, /Magdalena Raczek/);
  });

  it('keeps 2026 premiere facts on the page', () => {
    assert.match(page, /4\.10\.2026/);
    assert.match(page, /MEDIATEKA/);
    assert.match(page, /AUKSODRONE/);
  });
});
