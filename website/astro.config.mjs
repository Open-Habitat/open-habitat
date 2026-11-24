// @ts-check
import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import { repoDocsDir, repoDocsMarkdown } from './docs.mjs';
import { indexable } from './launch.mjs';
import { contrastScript } from './contrast.mjs';
import { landingPlugin } from './landing.mjs';
import { siteDescription } from './src/share.ts';

export default defineConfig({
  site: 'https://open-habitat.ai',
  markdown: {
    processor: satteri({ mdastPlugins: [repoDocsMarkdown] }),
  },
  // The English front page's blocks (landing.mjs).
  vite: { plugins: [landingPlugin()] },
  integrations: [
    starlight({
      title: 'Open Habitat',
      // The description of a page that has none of its own (src/share.ts).
      description: siteDescription,
      // English only (Jari, 24.11.2026: the Finnish pages were removed).
      locales: { root: { label: 'English', lang: 'en' } },
      favicon: '/favicon.svg',
      // The share image and twitter:* tags on every page (src/routeData.ts).
      routeMiddleware: './src/routeData.ts',
      head: [
        { tag: 'script', content: contrastScript },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
        ...(indexable ? [] : [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } }]),
      ],
      // The product's own design system: its tokens and bundled fonts, then
      // the brand's themes (Päivä, Yö, Korkea kontrasti) on the same
      // data-theme attribute Starlight sets, and the mark.
      customCss: ['../design-system/styles.css', './src/styles/brand.css', './src/styles/habitat.css'],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Hero: './src/components/Hero.astro',
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
          items: [
            { slug: 'docs' },
            { slug: 'docs/try' },
            { slug: 'docs/security' },
          ],
        },
        {
          label: 'Reference',
          items: [
            {
              slug: 'docs/product',
              label: 'Goal and user journeys',
            },
            {
              slug: 'docs/operations',
              label: 'Install and operate',
            },
          ],
        },
      ],
      plugins: [starlightLinksValidator()],
    }),
  ],
});
