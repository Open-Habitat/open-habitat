// The documentation collection: the site's own pages under
// website/src/content/docs/ plus repository documents rendered in place.
// The repository's docs/product.md and docs/operations.md are the source
// of truth (root AGENTS.md, "Code is the record"); the site never keeps a
// copy, it reads them at build time and rewrites their GitHub-relative links.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'astro/loaders';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ownDir = 'website/src/content/docs';
const repoUrl = 'https://github.com/Open-Habitat/open-habitat';

// Repository documents shown on the site, by repository path → site slug.
// They are in English; Starlight shows the English page under /fi/ too, with
// its notice that the page has not been translated.
export const repoDocs = {
  'docs/product.md': 'docs/product',
  'docs/operations.md': 'docs/operations',
};
export const repoDocsDir = path.join(repoRoot, 'docs');

function entryId(repoPath) {
  if (repoDocs[repoPath]) return repoDocs[repoPath];
  return repoPath.slice(ownDir.length + 1).replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
}

function h1(filePath) {
  const match = readFileSync(filePath, 'utf-8').match(/^# (.+)$/m);
  if (!match) throw new Error(`${filePath}: the page has no H1 to use as its title`);
  return match[1].replace(/`/g, '').trim();
}

export function docsCollectionLoader() {
  const inner = glob({
    base: repoRoot,
    pattern: [`${ownDir}/**/*.{md,mdx}`, ...Object.keys(repoDocs)],
    generateId: ({ entry }) => entryId(entry),
  });
  return {
    ...inner,
    name: 'open-habitat-docs-loader',
    load: (context) =>
      inner.load({
        ...context,
        parseData: (entry) => {
          const filePath = path.resolve(repoRoot, entry.filePath ?? '');
          const isRepoDoc = Object.values(repoDocs).includes(entry.id);
          const data = isRepoDoc ? { title: h1(filePath), ...entry.data } : entry.data;
          return context.parseData({ ...entry, data });
        },
      }),
  };
}

function siteLink(fromFile, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) return undefined;
  const [file, anchor] = target.split('#', 2);
  const hash = anchor ? `#${anchor}` : '';
  const absolute = path.resolve(path.dirname(fromFile), decodeURI(file));
  const inRepo = path.relative(repoRoot, absolute).split(path.sep).join('/');
  if (repoDocs[inRepo]) return `/${repoDocs[inRepo]}/${hash}`;
  // Anything else in the repository (the design system, decision records)
  // is shown on GitHub.
  let kind = 'blob';
  try {
    if (statSync(absolute).isDirectory()) kind = 'tree';
  } catch {
    // scripts/validate-project-view.py reports a missing link target.
  }
  return `${repoUrl}/${kind}/main/${inRepo}${hash}`;
}

// Sätteri mdast plugin for the repository documents: drops the H1 (it is the
// title), rewrites relative links to site or GitHub URLs, and tells
// starlight-links-validator the page's slug, which it would otherwise derive
// from src/content/docs/.
export function repoDocsMarkdown({ fileURL }) {
  if (!fileURL) return undefined;
  const filePath = fileURLToPath(fileURL);
  const inRepo = path.relative(repoRoot, filePath).split(path.sep).join('/');
  const slug = repoDocs[inRepo];
  if (!slug) return undefined;
  return {
    name: 'open-habitat-repo-docs',
    before(_root, ctx) {
      if (ctx.data.astro) ctx.data.astro.frontmatter.slug = slug;
    },
    heading(node, ctx) {
      if (node.depth === 1) ctx.removeNode(node);
    },
    link(node, ctx) {
      const url = siteLink(filePath, node.url);
      if (url) ctx.setProperty(node, 'url', url);
    },
  };
}
