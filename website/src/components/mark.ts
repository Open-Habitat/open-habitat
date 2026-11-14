// The Open Habitat mark as markup: the ring is the habitat, the dot the
// resident (the agent), the opening the door. Its look and its states
// (thinking, working, waiting, done, intro…) are CSS in
// src/styles/brand.css; the colour comes from currentColor.

const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';

export type MarkState = 'idle' | 'intro' | 'thinking' | 'working' | 'waiting' | 'done';

export function mark(
  state: MarkState = 'idle',
  px = 20,
  { subs = [] as MarkState[], label = '' } = {},
): string {
  // Sub-agents orbit the resident, evenly spaced from the top.
  const orbit = subs.length
    ? `<g class="oh-orbit">${subs
        .map((s, i) => {
          const a = (i / subs.length) * 2 * Math.PI - Math.PI / 2;
          return `<circle class="oh-sub" data-state="${s}" r="1.3" cx="${(5.6 * Math.cos(a)).toFixed(2)}" cy="${(5.6 * Math.sin(a)).toFixed(2)}"/>`;
        })
        .join('')}</g>`
    : '';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" ${a11y}><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/>${orbit}</svg>`;
}
