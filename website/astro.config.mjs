// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { repoDocsDir, repoDocsMarkdown } from './docs.mjs';
import { indexable } from './launch.mjs';

export default defineConfig({
  site: 'https://open-habitat.ai',
  markdown: {
    processor: satteri({ mdastPlugins: [repoDocsMarkdown] }),
  },
  integrations: [
    starlight({
      title: 'Open Habitat',
      // English at the root, because the project, its repository and its
      // documents are English-first; Finnish is a full translation of the
      // site's own pages under /fi/.
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        fi: { label: 'Suomi', lang: 'fi' },
      },
      favicon: '/favicon.svg',
      head: indexable ? [] : [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } }],
      // The product's own design system: its tokens, light and dark on the
      // same data-theme attribute Starlight sets, and its bundled fonts.
      customCss: ['../design-system/styles.css', './src/styles/habitat.css'],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
      },
      expressiveCode: {
        themes: ['github-dark-dimmed', 'github-light'],
        styleOverrides: {
          borderRadius: '8px',
          borderColor: 'var(--ah-line)',
          codeBackground: 'var(--ah-sunken)',
          codeFontFamily: 'var(--ah-mono)',
          uiFontFamily: 'var(--ah-font)',
          frames: {
            shadowColor: 'transparent',
            editorTabBarBackground: 'var(--ah-rail)',
            terminalTitlebarBackground: 'var(--ah-rail)',
            terminalBackground: 'var(--ah-sunken)',
            terminalTitlebarBorderBottomColor: 'var(--ah-line)',
          },
        },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Open-Habitat/open-habitat' },
      ],
      markdown: { processedDirs: [repoDocsDir] },
      sidebar: [
        {
          label: 'Documentation',
          translations: { fi: 'Dokumentaatio' },
          items: [
            { slug: 'docs' },
            { slug: 'docs/try' },
            { slug: 'docs/security' },
          ],
        },
        {
          label: 'Reference',
          translations: { fi: 'Lähdedokumentit' },
          items: [
            {
              slug: 'docs/product',
              label: 'Goal and user journeys',
              translations: { fi: 'Tavoite ja käyttöpolut' },
            },
            {
              slug: 'docs/operations',
              label: 'Install and operate',
              translations: { fi: 'Asennus ja ylläpito' },
            },
          ],
        },
      ],
      // The repository documents are English only; their /fi/ pages are
      // Starlight's untranslated fallbacks, so links to them are valid.
      plugins: [starlightLinksValidator({ errorOnFallbackPages: false })],
    }),
  ],
});
