import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isPublishableArchiveRef,
  isPublishablePublicPath,
  isPublishableTeczka,
  unpublishedTeczkaRedirects,
} from '../src/lib/public-teczki.ts';

describe('public teczki denylist', () => {
  it('unpublished the hallucinated 120h-kultowa slug', () => {
    assert.equal(
      isPublishableTeczka({
        id: '120h-kultowa',
        data: { title: '120h Kultowa', status: 'W TOKU' },
        body: '# TECZKA: 120h Kultowa\n',
      }),
      false,
    );
  });

  it('keeps the real Konin 1994 teczka public', () => {
    assert.equal(
      isPublishableTeczka({
        id: '120h-mega-techno-obecnosci',
        data: {
          title: '120h Mega Techno Obecności',
          status: 'należy napisać pismo.',
        },
        body: '# TECZKA: 120h Mega Techno Obecności\n',
      }),
      true,
    );
  });

  it('skips front matter status: halucynacja', () => {
    assert.equal(
      isPublishableTeczka({
        id: 'some-other-slug',
        data: { title: 'Something real-looking', status: 'halucynacja' },
        body: 'body',
      }),
      false,
    );
  });

  it('skips the Archiwistka hallucination banner', () => {
    assert.equal(
      isPublishableTeczka({
        id: 'another-slug',
        data: { title: 'Invented', status: 'W TOKU' },
        body: '> UWAGA: HALUCYNACJA AGENTÓW\n\nrest of file\n',
      }),
      false,
    );
  });

  it('strips 120h Kultowa from archive_refs and sitemap paths', () => {
    assert.equal(isPublishableArchiveRef('120h Kultowa'), false);
    assert.equal(isPublishableArchiveRef('120h Mega Techno Obecności'), true);
    assert.equal(isPublishablePublicPath('/archive/120h-kultowa/'), false);
    assert.equal(isPublishablePublicPath('/archiwistka/120h-kultowa'), false);
    assert.equal(isPublishablePublicPath('/archive/120h-mega-techno-obecnosci/'), true);
  });

  it('redirects unpublished slugs to the archive indexes', () => {
    const redirects = unpublishedTeczkaRedirects();
    assert.equal(redirects['/archive/120h-kultowa'], '/archive');
    assert.equal(redirects['/archiwistka/120h-kultowa'], '/archiwistka');
    assert.equal(redirects['/archive/120h-mega-techno-obecnosci'], undefined);
    assert.equal(redirects['/archiwistka/120h-mega-techno-obecnosci'], undefined);
  });
});
