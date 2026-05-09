// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cukt.click',
  integrations: [sitemap()],
  build: {
    format: 'directory',
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
