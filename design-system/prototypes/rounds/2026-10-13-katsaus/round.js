// Kierros 13.10.2026 (recap-above-composer): Tilannekatsaus kentän yllä.
// Kortin voi sulkea, ja se pysyy suljettuna, kunnes syntyy uudempi katsaus.
// Otsakkeessa ovat ikä ja merkki uusista viesteistä; päivitys on kaksi kiertävää
// nuolta. Sivun yläpalkin "3 min toimettomana" simuloi automaattista luontia:
// se syntyy vain, kun Pi on pysähtynyt ja katsauksen jälkeen on uutta.

const ICON_X = SVG('<path d="M6 6l12 12M18 6 6 18"/>');
const ICON_ARROW = SVG('<path d="M5 12h14M13 6l6 6-6 6"/>');
const RECAPS = [
  { recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit JSONina. `--since` antaa rajan käsin, ja `--table` tulostaa samat rivit tasattuna taulukkona; JSON pysyy oletuksena, jotta putkitus ei muutu.', next: 'Aja testit ja varmista, ettei `--table` muuta JSON-tulostetta.' },
  { recap: 'Testit menevät läpi. Yksi testi kaatui, koska oletusikkuna laskettiin koneen kellosta; nyt `--today` on parametri ja testi antaa sen kiinteänä. JSON on yhä oletus ja taulukko tulee `--table`-lipulla.', next: 'Lisää `--today` README:n esimerkkeihin ja tee commit.' },
];
const K = { v: 'v1', ix: 0, at: 0, stale: true, dismissed: -1, pending: false, open: false, auto: false };
const kHost = document.createElement('div'); kHost.className = 'recap-host';
const ago = () => { const m = Math.round((Date.now() - K.at) / 60000); return m < 1 ? 'juuri nyt' : m < 60 ? `${m} min sitten` : `${Math.round(m / 60)} t sitten`; };
const refreshReason = 'Odota Pi:n vuoron päättymistä.';

function recapHead(w) {
  const dis = w ? ` aria-disabled="true" title="${refreshReason}"` : ' title="Päivitä katsaus"';
  return `<span class="k-title">Tilannekatsaus</span><span class="k-age">${K.pending ? 'luodaan…' : ago()}</span>${K.stale && !K.pending ? '<span class="k-stale" title="Keskustelussa on katsauksen jälkeen uusia viestejä">uusia viestejä</span>' : ''}${K.auto && !K.stale && !K.pending ? '<span class="k-auto">luotu automaattisesti</span>' : ''}<span class="k-grow"></span><button class="icon-btn k-btn${K.pending ? ' spin' : ''}" type="button" data-k="refresh" aria-label="Päivitä katsaus"${dis}>${ICON_REFRESH}</button><button class="icon-btn k-btn" type="button" data-k="close" aria-label="Sulje katsaus" title="Sulje katsaus">${ICON_X}</button>`;
}
function recapBody() {
  const r = RECAPS[K.ix];
  if (K.pending) return `<div class="k-skel" aria-hidden="true"><span></span><span></span><span class="short"></span></div>`;
  const next = K.v === 'v3'
    ? `<button type="button" class="k-next-btn" data-k="use" title="Siirrä ehdotus kenttään">${ICON_ARROW}<span>${inline(r.next)}</span></button>`
    : `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>`;
  return `<p class="k-text">${inline(r.recap)}</p>${next}`;
}
function paintRecap() {
  const w = UI.working && selConv().id === 'c1';
  const show = selConv().id === 'c1' && K.dismissed !== K.at;
  kHost.hidden = !show; kHost.className = `recap-host k-${K.v}`;
  if (!show) return;
  if (K.v === 'v2' && !K.open) {
    kHost.innerHTML = `<aside class="recap row" aria-label="Tilannekatsaus"><button type="button" class="k-open" data-k="toggle" aria-expanded="false">${CHEV}<span class="k-title">Tilannekatsaus</span><span class="k-age">${K.pending ? 'luodaan…' : ago()}</span>${K.stale && !K.pending ? '<span class="k-stale">uusia viestejä</span>' : ''}<span class="k-peek">${K.pending ? '' : inline(RECAPS[K.ix].recap)}</span></button><button class="icon-btn k-btn${K.pending ? ' spin' : ''}" type="button" data-k="refresh" aria-label="Päivitä katsaus"${w ? ` aria-disabled="true" title="${refreshReason}"` : ' title="Päivitä katsaus"'}>${ICON_REFRESH}</button><button class="icon-btn k-btn" type="button" data-k="close" aria-label="Sulje katsaus" title="Sulje katsaus">${ICON_X}</button></aside>`;
    return;
  }
  const fold = K.v === 'v2' ? `<button type="button" class="icon-btn k-btn k-fold" data-k="toggle" aria-expanded="true" aria-label="Pienennä katsaus" title="Pienennä katsaus">${CHEV}</button>` : '';
  kHost.innerHTML = `<aside class="recap" aria-label="Tilannekatsaus"><div class="k-head">${fold}${recapHead(w)}</div>${recapBody()}</aside>`;
}
function place() {
  const comp = document.querySelector('.composer');
  if (K.v === 'v3') comp.querySelector('.cwrap').prepend(kHost);
  else comp.parentNode.insertBefore(kHost, comp);
}
APP.painted.push(paintRecap);

// ---------- Generation ----------
function generate(auto) {
  if (K.pending) return;
  K.pending = true; K.auto = auto; paintRecap();
  setTimeout(() => {
    K.pending = false; K.ix = 1; K.at = Date.now(); K.stale = false; K.open = K.v === 'v2' ? K.open : false;
    paintRecap();
  }, 1800);
}
kHost.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.dataset.k;
  if (a === 'refresh') return generate(false);
  if (a === 'close') { K.dismissed = K.at; return paintRecap(); }
  if (a === 'toggle') { K.open = !K.open; return paintRecap(); }
  if (a === 'use') {
    const ta = document.querySelector('.composer textarea'); ta.value = RECAPS[K.ix].next.replace(/`/g, ''); ta.dispatchEvent(new Event('input')); ta.focus();
  }
});
// New native messages make the recap stale; a live turn is one.
new MutationObserver(() => { if (stage.querySelector('.turn.live') && K.ix === 0 && !K.stale) { K.stale = true; paintRecap(); } }).observe(stage, { childList: true, subtree: true });
setInterval(paintRecapAge, 30000);
function paintRecapAge() { const el = kHost.querySelector('.k-age'); if (el && !K.pending) el.textContent = ago(); }

// Page-bar helper: three idle minutes. Generates only when Pi has settled and something is newer.
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', '<button type="button" id="idle3" class="page-btn">3 min toimettomana</button>');
document.getElementById('idle3').addEventListener('click', () => {
  if (UI.working) return toast('Pi työskentelee; katsaus odottaa vuoron päättymistä.');
  if (!K.stale) return toast('Katsauksen jälkeen ei ole uutta, joten uutta katsausta ei luoda.');
  generate(true);
});

function show(v) {
  K.v = v; K.ix = 0; K.at = Date.now() - 12 * 60000; K.stale = true; K.dismissed = -1; K.pending = false; K.open = false; K.auto = false;
  place(); return appView();
}
const v1 = () => show('v1');
const v2 = () => show('v2');
const v3 = () => show('v3');
