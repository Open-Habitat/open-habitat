// The ink overlap page: pick two inks, thin or full, and drag the second print
// (or use the Overlap slider). The overlap itself is the browser's multiply
// blend; this file only keeps the controls, the swatch and the sentence in step.
// Same numbers as inkPage() in block.js.
(() => {
  const B = '[data-block="role-erin"]';
  const CLOTH = [0xf7, 0xf2, 0xe7];
  const INKS = { indigo: ['Indigo', '#2f4f73'], rust: ['Rust', '#b45a33'], weld: ['Weld yellow', '#d9b23a'] };
  const NAMES = { 'indigo+rust': 'a warm slate', 'indigo+weld': 'a deep green', 'rust+weld': 'a burnt orange', 'indigo+indigo': 'a deeper indigo', 'rust+rust': 'a deeper rust', 'weld+weld': 'a deeper gold' };
  const STRENGTH = { thin: 0.55, full: 0.85 };
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, o) => '#' + CLOTH.map((c, i) => Math.round(c * (1 - o + o * rgb(a)[i] / 255) * (1 - o + o * rgb(b)[i] / 255)).toString(16).padStart(2, '0')).join('');

  const render = (ip) => {
    const { a, b, st } = ip.dataset;
    const o = STRENGTH[st];
    ip.style.setProperty('--a', INKS[a][1]);
    ip.style.setProperty('--b', INKS[b][1]);
    ip.style.setProperty('--o', o);
    ip.querySelectorAll('[data-ink-a]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.inkA === a)));
    ip.querySelectorAll('[data-ink-b]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.inkB === b)));
    ip.querySelectorAll('.ip-st').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.st === st)));
    ip.querySelector('.ip-m').style.setProperty('--m', mix(INKS[a][1], INKS[b][1], o));
    const name = NAMES[[a, b].sort().join('+')];
    const t = ip.querySelector('.ip-rt');
    t.innerHTML = '';
    const strong = document.createElement('b');
    strong.textContent = `${INKS[a][0]}, then ${INKS[b][0].toLowerCase()}`;
    t.append(strong, ` make ${name}`);
  };
  const setX = (ip, x) => {
    x = Math.max(0, Math.min(100, Math.round(x)));
    ip.style.setProperty('--x', x);
    const r = ip.querySelector('.ip-x input');
    if (r && +r.value !== x) r.value = x;
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest(`${B} .ip button`);
    if (!btn) return;
    const ip = btn.closest('.ip');
    if (btn.dataset.inkA) ip.dataset.a = btn.dataset.inkA;
    else if (btn.dataset.inkB) ip.dataset.b = btn.dataset.inkB;
    else if (btn.dataset.st) ip.dataset.st = btn.dataset.st;
    render(ip);
  });
  document.addEventListener('input', (e) => {
    const r = e.target.closest(`${B} .ip-x input`);
    if (r) setX(r.closest('.ip'), +r.value);
  });

  // Dragging the second print: its centre follows the pointer along the cloth.
  // --x 0 puts it beside the first print, 100 right on top of it.
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const p = e.target.closest(`${B} .ip-pb`);
    if (!p) return;
    const ip = p.closest('.ip');
    const cloth = ip.querySelector('.ip-cloth').getBoundingClientRect();
    const a = ip.querySelector('.ip-pa').getBoundingClientRect();
    const startX = e.clientX; const start = +getComputedStyle(ip).getPropertyValue('--x');
    // 100 units of --x span the distance between "beside" and "on top".
    const span = a.width * 0.95;
    drag = { ip, startX, start, span, id: e.pointerId, cloth };
    p.setPointerCapture?.(e.pointerId);
    p.classList.add('is-drag');
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    setX(drag.ip, drag.start - ((e.clientX - drag.startX) / drag.span) * 100);
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.ip.querySelector('.ip-pb').classList.remove('is-drag');
    drag = null;
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
