// What a link to the site shows when it is shared (Slack, LinkedIn, X,
// WhatsApp, Telegram, iMessage…): one image for the whole site and the
// sentence that says what Open Habitat is. The front page's head and the
// documentation's route middleware (src/routeData.ts) both read it.
// public/og.png is rendered by scripts/og-image.mjs; the alt text describes it.

export const siteName = 'Open Habitat';

export const siteDescription =
  'Open Habitat runs coding-grade agents on a Linux server you control. Each person on the team is a Linux user there and works with their agents in a browser tab. Open source, early pre-release.';

export const shareImage = {
  path: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Open Habitat: coding-grade agents on a server for you and your team. A conversation with an agent in the browser, on a desktop and a phone.',
};

type Head = { tag: 'meta'; attrs: Record<string, string> }[];

// The tags Starlight does not emit itself: the image and the twitter:* copies
// of the title and description. Starlight already writes description,
// canonical, og:type/url/locale/title/description/site_name and
// twitter:card, so the front page adds those itself and the docs do not.
export function shareTags(site: URL, title: string, description: string): Head {
  const image = new URL(shareImage.path, site).href;
  const meta = (key: 'name' | 'property', id: string, content: string) => ({
    tag: 'meta' as const,
    attrs: { [key]: id, content },
  });
  return [
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(shareImage.width)),
    meta('property', 'og:image:height', String(shareImage.height)),
    meta('property', 'og:image:alt', shareImage.alt),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', shareImage.alt),
  ];
}
