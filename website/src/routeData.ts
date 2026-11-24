// Starlight route middleware: adds the share image and the twitter:* title and
// description (src/share.ts) to every documentation page, from the page's own
// title and description, after Starlight has built its head. A tag Starlight
// or the config already wrote is left as it is, so nothing is doubled.
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { shareTags, siteDescription } from './share';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const site = context.site ?? new URL(context.url.origin);
  const title = route.entry.data.title;
  const description = route.entry.data.description ?? siteDescription;
  const key = (attrs: Record<string, unknown> | undefined) => attrs?.property ?? attrs?.name;
  const present = new Set(route.head.filter((h) => h.tag === 'meta').map((h) => key(h.attrs)));
  for (const tag of shareTags(site, title, description)) {
    if (!present.has(key(tag.attrs))) route.head.push(tag);
  }
});
