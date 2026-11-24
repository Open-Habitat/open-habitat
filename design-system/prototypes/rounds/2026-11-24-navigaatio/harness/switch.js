// The harness between the picker (../../lib/picker.js, verbatim) and the
// variants. The picker re-mounts a variant by writing `variants[i]()` into
// `stage`; here the stage is an empty element and each render function
// mounts its variant on the real page as a side effect: the previous one is
// unmounted, html[data-nav] switches the variant's CSS, and the reader's
// place is kept so a switch mid-story does not jump (variant 3 inserts
// strips above it). ?nav=off renders the page with no variant, for check.mjs's
// layout-shift baseline only.
const stage = document.getElementById('stage');
const OFF = new URLSearchParams(location.search).get('nav') === 'off';
const DESC = JSON.parse(document.getElementById('proto-desc-data').textContent);
const variants = NAV.variants.map((v, i) => () => {
  if (OFF) { document.documentElement.dataset.nav = 'off'; return ''; }
  // Keep the element at a third of the viewport where it is.
  const probe = document.elementFromPoint(innerWidth / 2, innerHeight / 3)?.closest('.s1-step, .blk, .role, .cap-g, section');
  const before = probe?.getBoundingClientRect().top;
  NAV.active?.unmount?.();
  document.documentElement.dataset.nav = String(i + 1);
  v.mount();
  NAV.active = v;
  if (probe && probe.isConnected) scrollBy(0, probe.getBoundingClientRect().top - before);
  const d = document.querySelector('.proto-desc');
  d.querySelector('b').textContent = `${i + 1} ${v.name}`;
  d.querySelector('span').textContent = DESC[i];
  return '';
});
