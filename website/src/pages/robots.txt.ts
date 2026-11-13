// Crawlers are kept out until launch; the switch is website/launch.mjs.
import type { APIRoute } from 'astro';
import { indexable } from '../../launch.mjs';

export const GET: APIRoute = ({ site }) => {
  const body = indexable
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
