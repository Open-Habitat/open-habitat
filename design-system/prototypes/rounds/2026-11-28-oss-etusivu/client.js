// The page's browser half: the screens' interactions, the Copy button and the
// browser row's live demo. The page is rendered at build time; this script
// holds no content.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Interactions inside the screens and sections (delegated) ----------
document.addEventListener('click', (e) => {
  // The kit's screens: a stage's summary row opens its work, a tool row its output.
  const st = e.target.closest('.ah-stage-toggle');
  if (st) {
    const open = st.getAttribute('aria-expanded') !== 'true';
    st.setAttribute('aria-expanded', String(open));
    st.setAttribute('aria-label', open ? st.dataset.hide : st.dataset.show);
    st.parentElement.nextElementSibling.hidden = !open;
    const pill = st.querySelector('.ah-stage-pill'); if (pill) pill.textContent = open ? 'Hide work' : 'Show work';
    return;
  }
  const disc = e.target.closest('.ah-tool-disclosure');
  if (disc) {
    const open = disc.getAttribute('aria-expanded') !== 'true';
    disc.setAttribute('aria-expanded', String(open));
    disc.nextElementSibling.hidden = !open;
    return;
  }
  const dl = e.target.closest('.ah-offer-b');
  if (dl) { const s = dl.querySelector('span'); const t = s.textContent; s.textContent = dl.dataset.done; dl.dataset.done = t; dl.classList.toggle('done'); return; }
  const tg = e.target.closest('[data-set]');
  if (tg) {
    const host = tg.closest('[data-view]');
    host.dataset.state = tg.dataset.set;
    host.querySelectorAll('[data-set]').forEach((b) => b.setAttribute('aria-pressed', String(b === tg)));
    const lbl = host.querySelector(':not(button)[data-label]');
    if (lbl && tg.dataset.label) lbl.textContent = tg.dataset.label;
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const text = cp.closest('.ag-win').querySelector('pre').textContent;
    const done = () => { cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = 'Copy'; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => { cp.textContent = 'Select and copy'; });
    else cp.textContent = 'Select and copy';
    return;
  }
});

// ---------- The browser row's live demo (screens.mjs browserDemo) ----------
// The scene plays by itself; the control sends {scenecast:'pause'|'play'} and
// shows the state the scene answers with (accepted only from the scene's own
// window), so play continues from the paused frame. Under reduced motion only
// the poster shows until the person presses play.
for (const fig of document.querySelectorAll('[data-demo]')) {
  const box = fig.querySelector('.demo-box'), btn = fig.querySelector('.demo-ctl');
  let frame = null;
  const send = (m) => frame?.contentWindow?.postMessage({ scenecast: m }, '*');
  const show = (playing) => { btn.dataset.paused = String(!playing); btn.setAttribute('aria-label', playing ? 'Pause the demo' : 'Play the demo'); };
  const make = (then) => { frame = document.createElement('iframe'); frame.className = 'demo-frame'; frame.src = fig.dataset.demo; frame.title = 'Demo: the server browser'; frame.setAttribute('sandbox', 'allow-scripts'); frame.tabIndex = -1; frame.addEventListener('load', () => send(then), { once: true }); box.insertBefore(frame, btn); };
  addEventListener('message', (e) => { if (!frame || e.source !== frame.contentWindow || !e.data || e.data.scenecast !== 'state') return; show(!!e.data.playing); fig.dataset.t = e.data.t; });
  btn.hidden = false;
  if (reduced()) show(false); else { show(true); make('state'); }
  btn.addEventListener('click', () => {
    if (!frame) { make('play'); return; } // reduced motion: the first play starts the scene
    send(btn.dataset.paused === 'true' ? 'play' : 'pause');
  });
}
