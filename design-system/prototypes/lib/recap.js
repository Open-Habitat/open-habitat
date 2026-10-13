// Tilannekatsaus: kortti kentän yllä (Jari 13.10.2026, kierros
// rounds/2026-10-13-katsaus, suunta Kortti). Kortin voi sulkea, ja se pysyy
// suljettuna, kunnes syntyy uudempi katsaus. Otsakkeessa ovat ikä ja merkki uusista
// viesteistä; päivitys on kaksi kiertävää nuolta ja on estetty Pi:n työn ajan.
// Uusi katsaus syntyy itsestään, kun Pi on ollut toimettomana yli kolme minuuttia
// ja katsauksen jälkeen on uutta; yläpalkin "3 min toimettomana" simuloi sitä.
// Mukana kirjoituskentän kanssa, ellei kierros vie `recap = false`.

const ICON_X = SVG('<path d="M6 6l12 12M18 6 6 18"/>');
const RECAPS = [
  { recap: 'Skripti `scripts/status_rows.py` lukee `status.md`:n taulukon ja tulostaa viime viikon rivit JSONina. `--since` antaa rajan käsin, ja `--table` tulostaa samat rivit tasattuna taulukkona; JSON pysyy oletuksena, jotta putkitus ei muutu.', next: 'Aja testit ja varmista, ettei `--table` muuta JSON-tulostetta.' },
  { recap: 'Testit menevät läpi. Yksi testi kaatui, koska oletusikkuna laskettiin koneen kellosta; nyt `--today` on parametri ja testi antaa sen kiinteänä. JSON on yhä oletus ja taulukko tulee `--table`-lipulla.', next: 'Lisää `--today` README:n esimerkkeihin ja tee commit.' },
];
const K = { ix: 0, at: Date.now() - 12 * 60000, stale: true, dismissed: -1, pending: false, auto: false };
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
  const next = `<p class="k-next"><span class="k-label">Seuraavaksi</span><span>${inline(r.next)}</span></p>`;
  return `<p class="k-text">${inline(r.recap)}</p>${next}`;
}
function paintRecap() {
  const w = UI.working && selConv().id === 'c1';
  const show = selConv().id === 'c1' && K.dismissed !== K.at;
  kHost.hidden = !show;
  if (!show) return;
  kHost.innerHTML = `<aside class="recap" aria-label="Tilannekatsaus"><div class="k-head">${recapHead(w)}</div>${recapBody()}</aside>`;
}
{ const comp = document.querySelector('.composer'); comp.parentNode.insertBefore(kHost, comp); }
APP.painted.push(paintRecap);

// ---------- Generation ----------
function generate(auto) {
  if (K.pending) return;
  K.pending = true; K.auto = auto; paintRecap();
  setTimeout(() => {
    K.pending = false; K.ix = 1; K.at = Date.now(); K.stale = false;
    paintRecap();
  }, 1800);
}
kHost.addEventListener('click', (e) => {
  const b = e.target.closest('[data-k]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
  const a = b.dataset.k;
  if (a === 'refresh') return generate(false);
  if (a === 'close') { K.dismissed = K.at; return paintRecap(); }
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
