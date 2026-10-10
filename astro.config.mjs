// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { isPublishablePublicPath, unpublishedTeczkaRedirects } from './src/lib/public-teczki.ts';

export default defineConfig({
  site: 'https://cukt.click',
  integrations: [
    sitemap({
      filter: (page) => isPublishablePublicPath(page),
    }),
  ],
  build: {
    format: 'directory',
  },
  redirects: {
    '/personal/habeas-mentem': '/habeas-mentem',
    '/personal/habeas-mentem/': '/habeas-mentem',
    // Specific unpublished slugs only — not `/archive/[id]`. Dynamic [id]
    // routes never emit these paths (isPublishableTeczka), so no collision.
    ...unpublishedTeczkaRedirects(),
  },
  markdown: {
    shikiConfig: {
      theme: {
        name: 'cuktai-black',
        type: 'dark',
        colors: {
          'editor.background': '#000000',
          'editor.foreground': '#ffffff',
        },
        settings: [
          {
            scope: ['source', 'text'],
            settings: { foreground: '#ffffff' },
          },
        ],
      },
    },
  },
});
