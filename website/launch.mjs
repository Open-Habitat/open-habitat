// The one switch between the preview and the public launch. While it is
// false every page carries <meta name="robots" content="noindex, nofollow">
// and /robots.txt disallows everything (src/pages/robots.txt.ts). Turning
// it to true removes both; nothing else needs to change.
export const indexable = false;
