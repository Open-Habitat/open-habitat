// The theme a round's Teema picker starts in, for rounds built from production
// components with their own build.mjs (stage.js does the same for library
// rounds). An explicit choice wins: the round's own ?theme=, which its picker
// sets when it relaunches. Then the theme Habitat passes to an offered view as
// #ah-theme=light|dark, then the device's or Habitat frame's
// prefers-color-scheme. Import it into round.tsx:
//   import { initialTheme } from '../../lib/view-theme.js';
//   let reviewTheme = initialTheme();
export function initialTheme(allowed = ['light', 'dark', 'contrast'], where = globalThis.location, media = globalThis.matchMedia) {
  const chosen = new URLSearchParams(where?.search ?? '').get('theme');
  if (chosen && allowed.includes(chosen)) return chosen;
  const hint = /(?:^#|&)ah-theme=(light|dark)(?:&|$)/.exec(where?.hash ?? '')?.[1];
  if (hint && allowed.includes(hint)) return hint;
  return media?.('(prefers-color-scheme: dark)').matches && allowed.includes('dark') ? 'dark' : 'light';
}
