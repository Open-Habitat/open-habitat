// Markdownin koko näkymän esikatselu (proto-markdown-full-preview-button, 28.10.2026). Kierros
// piirtää Habitatin oman editorin (CodeMirror 6 -paneeli: otsake, työkalurivi, teksti ja
// esikatselu) tuotannon BrowserEditorin mukaan. Teksti on muokattava: rivinumerot, korostus
// ja esikatselu seuraavat kirjoitusta. Näppäimet ja paluu samaan kohtaan ovat yhteisiä;
// suunnat vaihtavat vain esikatselun ohjaimen.
(() => {
const S_ = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
const I = {
  eye: S_('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>'),
  split: S_('<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M12 4.5v15"/><path d="M6 9h3M6 12h3M6 15h2"/>'),
  pen: S_('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  text: S_('<path d="M5 6h14M5 10h14M5 14h9M5 18h11"/>'),
  back: S_('<path d="m15 6-6 6 6 6"/>'),
  fwd: S_('<path d="m9 6 6 6-6 6"/>'),
  close: S_('<path d="M6 6l12 12M18 6 6 18"/>'),
  chat: S_('<circle cx="12" cy="12" r="8"/>'),
};
const esc_ = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Content: a long synthetic plan ----------
const DOC = `# Saaristoretki 2027

Tämä on Kaarinan pyöräseuran kesäretken suunnitelma. Agentti päivittää tiedostoa sitä mukaa kuin varaukset ja aikataulut varmistuvat; **lukitut** kohdat on merkitty erikseen.

> Lähtö lauantaina 12.6. kello 8.30 Aurajoen rannasta. Paluu sunnuntaina 13.6. noin kello 18.

## Tiivistelmä

- Reitti on Saariston rengastie myötäpäivään, yhteensä noin 200 km kahdessa päivässä.
- Mukana on 18 pyöräilijää ja yksi huoltoauto.
- Yöpyminen Houtskarissa, Hyppeisin majatalossa.
- Lauttoja on viisi; kaksi niistä on yhteysaluksia, joihin mahtuu rajallisesti pyöriä.

## Aikataulu

### Lauantai

| Aika | Paikka | Huomio |
| --- | --- | --- |
| 8.30 | Aurajoen ranta | Kokoontuminen ja lyhyt ohjeistus |
| 9.00 | Lähtö | Ryhmä A edellä, ryhmä B kymmenen minuuttia perässä |
| 10.40 | Paraisten lautta | Lautta kulkee 20 minuutin välein |
| 12.15 | Nauvon satama | Lounas Gästhamnissa, varattu 18 hengelle |
| 14.30 | Retais–Korppoo | Lautta 40 minuutin välein |
| 17.45 | Galtby | Yhteysalus Houtskariin, pyörät varattu |
| 19.00 | Hyppeis | Majoittuminen ja sauna |

### Sunnuntai

| Aika | Paikka | Huomio |
| --- | --- | --- |
| 8.00 | Aamiainen | Majatalo avaa keittiön tunnin tavallista aiemmin |
| 9.15 | Mossala–Iniö | Yhteysalus, **lukittu** |
| 11.30 | Kustavi | Lounas omin eväin |
| 13.00 | Vartsala | Lyhyt tauko sillan jälkeen |
| 16.30 | Askainen | Viimeinen huoltopiste |
| 18.00 | Aurajoen ranta | Maali |

## Reitti

Reitti kulkee Paraisten ja Nauvon kautta Korppooseen ja sieltä yhteysaluksella Houtskariin. Sunnuntaina jatketaan Iniön kautta mantereelle ja Kustavin ja Taivassalon kautta takaisin Turkuun.

### Etapit

1. Turku–Nauvo, 54 km, kaksi lauttaa.
2. Nauvo–Korppoo, 38 km, yksi lautta.
3. Korppoo–Houtskari, 41 km, yhteysalus.
4. Houtskari–Iniö, 22 km, yhteysalus.
5. Iniö–Turku, 67 km, ei lauttoja.

### Vaativat kohdat

Korppoon ja Galtbyn välinen tie on kapea, ja iltapäivällä siinä on paljon autoja lautalle menossa. Ajetaan jonossa ja pidetään väliä.

Iniön jälkeen on pitkä nousu ennen Kustavia. Huoltoauto odottaa mäen päällä.

## Lautat

Yhteysalusten pyöräpaikat varataan etukäteen Finferriesin ja Ålandstrafikenin varausjärjestelmistä. Tavallisille lautoille ei tarvitse varausta.

| Lautta | Väli | Varaus | Tila |
| --- | --- | --- | --- |
| Parainen | Lillmälö–Prostvik | Ei tarvita | — |
| Nauvo | Retais–Korppoo | Ei tarvita | — |
| Galtby | Korppoo–Houtskari | 18 pyörää | **lukittu** |
| Mossala | Houtskari–Iniö | 18 pyörää | **lukittu** |
| Heponiemi | Iniö–Kustavi | 18 pyörää | odottaa vahvistusta |

## Majoitus

Hyppeisin majatalossa on varattuna kuusi huonetta ja yksi kahdeksan hengen aitta. Huoneet jaetaan ryhmittäin; jako on erillisessä taulukossa \`majoitus.csv\`.

- Sauna lämpiää kello 19–22.
- Illallinen kello 20, kasvisvaihtoehto tilattu neljälle.
- Pyörät säilytetään lukitussa vajassa.

## Huolto

Huoltoauto kulkee ryhmän perässä ja kuljettaa varusteet ja varaosat. Kuljettajana Matti lauantaina ja Leena sunnuntaina.

### Varaosat

- Sisärenkaat 26", 28" ja 29", kaksi kutakin
- Ketjuöljy ja rätit
- Kaksi varajarrupalasarjaa
- Pumppu ja painemittari
- Ensiapulaukku

### Ryhmät

| Ryhmä | Vauhti | Vetäjä | Koko |
| --- | --- | --- | --- |
| A | 26–28 km/h | Ville | 9 |
| B | 22–24 km/h | Sanna | 9 |

## Sää

Jos tuulee yli 12 m/s tai sataa rankasti, sunnuntain etappi lyhennetään: Iniöstä ajetaan huoltoautolla Kustaviin. Päätös tehdään aamulla kello 7.

## Kustannukset

| Kulu | Hinta | Yhteensä |
| --- | --- | --- |
| Majoitus | 62 € / hlö | 1 116 € |
| Illallinen ja aamiainen | 38 € / hlö | 684 € |
| Lounas Nauvossa | 17 € / hlö | 306 € |
| Huoltoauton polttoaine | — | 140 € |
| Yhteensä | | 2 246 € |

Osallistumismaksu on 125 € henkeä kohden, ja seura maksaa erotuksen.

## Tarkistuslista ennen lähtöä

1. Vahvista Heponiemen lautan pyöräpaikat.
2. Lähetä osallistujille aikataulu ja majoitusjako.
3. Tarkista huoltoauton vakuutus.
4. Varmista, että jokaisella on toimiva takavalo.

## Komento aikataulun päivittämiseen

Agentti päivittää lauttojen ajat seuran skriptillä:

\`\`\`sh
python3 tools/lautat.py --reitti saaristo --pvm 2027-06-12 --kirjoita aikataulu.md
\`\`\`

## Avoimet kysymykset

- Ajetaanko Vartsalan silta jonossa vai odotetaanko liikennettä?
- Tarvitaanko toinen huoltoauto, jos osallistujia tulee yli 20?
- Kuka vie avaimen takaisin majataloon sunnuntaiaamuna?
`;

// ---------- State ----------
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const S = { dir: 'two', mode: 'off', conv: false, kbd: mac ? 'mac' : 'pc', text: DOC, dirty: false, saved: false, srcTop: 0, narrow: false };
const keys = () => S.kbd === 'mac' ? { full: '⌘⇧V', side: '⌘⌥V' } : { full: 'Ctrl+Shift+V', side: 'Ctrl+Alt+V' };
const ARIA_KEYS = { full: 'Control+Shift+V Meta+Shift+V', side: 'Control+Alt+V Meta+Alt+V' };
// What the pane shows: "beside" on a narrow pane is "in place", as in production.
const shown = () => S.mode === 'side' && S.narrow ? 'only' : S.mode;
const DIRS = {
  two: { name: 'Painike', note: 'Esikatselu avaa koko näkymän; kuvake sen vieressä avaa rinnakkaisen. Kapeassa paneelissa kuvake jää pois.' },
  seg: { name: 'Valitsin', note: 'Teksti · Rinnakkain · Esikatselu yhdessä valitsimessa; valittu tila näkyy aina. Kapeassa paneelissa Teksti · Esikatselu.' },
  float: { name: 'Kelluva', note: 'Työkalurivillä ei esikatselua. Dokumentin oikeassa alakulmassa Esikatselu, joka vaihtuu Muokkaa-painikkeeksi.' },
};

// ---------- Source: highlighted rows under a transparent textarea ----------
function hlLine(l, fence) {
  if (fence || l.startsWith('```')) return `<span class="sx-c">${esc_(l)}</span>`;
  if (/^#{1,6} /.test(l)) return `<span class="sx-h">${esc_(l)}</span>`;
  let s = esc_(l)
    .replace(/`([^`]+)`/g, '<span class="sx-s">`$1`</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<span class="sx-b">**$1**</span>');
  s = s.replace(/^(\s*)(- |\d+\. |&gt; )/, '$1<span class="sx-k">$2</span>');
  if (/^\|/.test(l)) s = s.replace(/\|/g, '<span class="sx-k">|</span>');
  return s;
}
function rows(text) {
  let fence = false;
  return text.split('\n').map((l, i) => {
    const isFence = l.startsWith('```'); const inFence = fence || isFence;
    if (isFence) fence = !fence;
    const head = !inFence && /^#{1,6} /.test(l);
    return `<div class="ln${head ? ' head' : ''}" data-n="${i + 1}">${hlLine(l, inFence) || '\u200b'}</div>`;
  }).join('');
}
// Source line numbers of the headings, in the order the preview draws them.
function headLines(text) {
  const out = []; let fence = false;
  text.split('\n').forEach((l, i) => { if (l.startsWith('```')) fence = !fence; else if (!fence && /^#{1,6} /.test(l)) out.push(i); });
  return out;
}
const preview = (text) => `<div class="prose md-doc">${md(text)}</div>`;

// ---------- Rendering ----------
const tip = (label, k) => `data-tip="${label}${k ? ' · ' + k : ''}"`;
function controls() {
  const k = keys(), m = shown();
  if (S.dir === 'two') return `<span class="md-ctl">
    <button type="button" class="b quiet text${m === 'only' ? ' on' : ''}" data-act="only" aria-pressed="${m === 'only'}" aria-keyshortcuts="${ARIA_KEYS.full}" ${tip('Esikatselu koko näkymään', k.full)}>${I.eye}<span>Esikatselu</span></button>
    <button type="button" class="b quiet icon wide-only${m === 'side' ? ' on' : ''}" data-act="side" aria-pressed="${m === 'side'}" aria-label="Esikatselu rinnakkain" aria-keyshortcuts="${ARIA_KEYS.side}" ${tip('Esikatselu rinnakkain', k.side)}>${I.split}</button>
  </span>`;
  if (S.dir === 'seg') {
    const seg = (id, label, icon, t, extra = '') => `<button type="button" class="seg${extra}" data-act="${id}" aria-pressed="${m === id}" ${t}>${icon}<span>${label}</span></button>`;
    return `<span class="md-ctl segmented" role="group" aria-label="Näkymä">
      ${seg('off', 'Teksti', I.text, tip('Teksti', 'Esc'))}
      ${seg('side', 'Rinnakkain', I.split, `aria-keyshortcuts="${ARIA_KEYS.side}" ${tip('Esikatselu rinnakkain', k.side)}`, ' wide-only')}
      ${seg('only', 'Esikatselu', I.eye, `aria-keyshortcuts="${ARIA_KEYS.full}" ${tip('Esikatselu koko näkymään', k.full)}`)}
    </span>`;
  }
  return '';
}
function fab() {
  if (S.dir !== 'float') return '';
  const k = keys(), m = shown();
  // The main button is always text ⇄ full view; the small one above it toggles beside.
  const main = m === 'only'
    ? `<button type="button" class="fab main" data-act="off" aria-keyshortcuts="Escape" ${tip('Takaisin tekstiin', 'Esc')}>${I.pen}<span>Muokkaa</span></button>`
    : `<button type="button" class="fab main" data-act="only" aria-keyshortcuts="${ARIA_KEYS.full}" ${tip('Esikatselu koko näkymään', k.full)}>${I.eye}<span>Esikatselu</span></button>`;
  const side = m !== 'only' ? `<button type="button" class="fab mini wide-only" data-act="side" aria-pressed="${m === 'side'}" aria-label="Esikatselu rinnakkain" aria-keyshortcuts="${ARIA_KEYS.side}" ${tip(m === 'side' ? 'Sulje rinnakkainen' : 'Esikatselu rinnakkain', k.side)}>${m === 'side' ? I.close : I.split}</button>` : '';
  return `<div class="md-fab">${side}${main}</div>`;
}
function stateText() { return S.dirty ? 'Muokattu' : S.saved ? 'Tallennettu' : ''; }
function toolbar() {
  return `<button type="button" class="b secondary text" data-act="files">Tiedostot</button>
    <code class="md-file">suunnitelmat/saaristoretki-2027.md</code>
    <span class="md-state" role="status">${stateText()}</span>
    ${controls()}
    <button type="button" class="b secondary text" data-act="save" ${S.dirty ? '' : 'disabled'}>Tallenna</button>`;
}
function conversation() {
  return `<section class="md-conv" aria-label="Keskustelu">
    <div class="md-conv-head"><strong>Saaristoretken suunnitelma</strong><span>Valmis</span></div>
    <div class="md-conv-body">
      <article class="md-user">Päivitä lauttojen varaustilanne suunnitelmaan ja lisää kustannukset taulukoksi.</article>
      <article class="prose"><p>Päivitin tiedoston <code>suunnitelmat/saaristoretki-2027.md</code>: Galtbyn ja Mossalan pyöräpaikat ovat lukittuja, Heponiemi odottaa vielä vahvistusta. Kustannukset ovat nyt omana taulukkonaan, yhteensä 2 246 €.</p></article>
    </div>
    <div class="md-conv-compose"><span>Kirjoita agentille…</span></div>
  </section>`;
}
function render() {
  const d = DIRS[S.dir], m = shown();
  return `<div class="md-demo" data-dir="${S.dir}">
  <div class="md-note"><strong>${d.name}</strong><span>${d.note}</span>
    <label>Keskustelu <select data-set="conv"><option value="0"${S.conv ? '' : ' selected'}>piilossa</option><option value="1"${S.conv ? ' selected' : ''}>rinnalla</option></select></label>
    <label>Näppäimet <select data-set="kbd"><option value="mac"${S.kbd === 'mac' ? ' selected' : ''}>Mac</option><option value="pc"${S.kbd === 'pc' ? ' selected' : ''}>PC</option></select></label>
  </div>
  <div class="md-app" data-conv="${S.conv}">
    ${S.conv ? conversation() : ''}
    <section class="md-editor" data-narrow="${S.narrow}">
      <header class="md-head"><h2>CodeMirror 6</h2><span class="md-head-ctl">
        <button type="button" class="b icon quiet" aria-label="Näytä keskustelu">${S.conv ? I.fwd : I.back}</button>
        <button type="button" class="b icon quiet" aria-label="Sulje editori">${I.close}</button></span></header>
      <div class="md-toolbar">${toolbar()}</div>
      <div class="md-body" data-preview="${S.mode}" data-shown="${m}">
        <div class="md-src"><div class="md-code"><pre class="md-rows" aria-hidden="true">${rows(S.text)}</pre><textarea spellcheck="false" aria-label="Tiedoston teksti">${esc_(S.text)}</textarea></div></div>
        ${m !== 'off' ? `<section class="md-pv" tabindex="0" aria-label="Esikatselu">${preview(S.text)}</section>` : ''}
        ${fab()}
      </div>
    </section>
    ${S.conv ? '' : `<aside class="md-rail">${I.chat}<span>Keskustelu</span></aside>`}
  </div>
</div>`;
}

// ---------- Behaviour ----------
const $ = (sel) => stage.querySelector(sel);
let ro = null;
function measure() {
  const body = $('.md-body'); if (!body) return;
  const narrow = body.clientWidth < 720;
  if (narrow !== S.narrow) { S.narrow = narrow; paint(); }
}
function sizeArea() { const ta = $('.md-code textarea'); if (ta) { ta.style.height = '0'; ta.style.height = $('.md-rows').offsetHeight + 'px'; } }
function watch() {
  ro?.disconnect();
  const body = $('.md-body'); if (!body) return;
  ro = new ResizeObserver(() => { measure(); sizeArea(); }); ro.observe(body);
  sizeArea();
}
// Repaint keeps the source's scroll, the caret and which part had focus.
function paint(focus) {
  const src = $('.md-src'); const ta = $('.md-code textarea');
  const top = src && src.offsetParent ? (S.srcTop = src.scrollTop) : S.srcTop;
  const sel = ta ? [ta.selectionStart, ta.selectionEnd] : null;
  const holder = focus ?? (ta && document.activeElement === ta ? 'src' : $('.md-pv')?.contains(document.activeElement) ? 'pv' : null);
  stage.querySelector('.md-demo').outerHTML = render();
  watch();
  const s2 = $('.md-src'); if (s2 && s2.offsetParent) s2.scrollTop = top;
  const ta2 = $('.md-code textarea'); if (ta2 && sel) ta2.setSelectionRange(...sel);
  if (holder === 'src' && ta2 && s2.offsetParent) ta2.focus({ preventScroll: true });
  if (holder === 'pv') $('.md-pv')?.focus({ preventScroll: true });
}
// The preview opens where the text was: the section under the top of the text, and as far
// into it as the text was. Leaving the preview brings the text to where the reading was.
// The anchor is a source line, so it survives the text being hidden.
const lineRows = () => [...stage.querySelectorAll('.md-rows .ln')];
function srcLine() {
  const src = $('.md-src'); const rs = lineRows();
  return Math.max(0, rs.findIndex(r => r.offsetTop + r.offsetHeight > src.scrollTop + 2));
}
function pvHeads(pv) { const base = pv.firstElementChild.offsetTop; return [...pv.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.offsetTop - base); }
function lineToPv(line) {
  const pv = $('.md-pv'); if (!pv) return;
  const hs = headLines(S.text), ys = pvHeads(pv), total = S.text.split('\n').length;
  let k = -1; hs.forEach((h, i) => { if (h <= line) k = i; });
  if (k < 0) { pv.scrollTop = 0; return; }
  const a = hs[k], b = hs[k + 1] ?? total; const f = (line - a) / Math.max(1, b - a);
  const ya = ys[k], yb = ys[k + 1] ?? pv.scrollHeight;
  pv.scrollTop = Math.max(0, ya + f * (yb - ya) - 12);
}
function pvLine() {
  const pv = $('.md-pv'); const y = pv.scrollTop + 12;
  const hs = headLines(S.text), ys = pvHeads(pv), total = S.text.split('\n').length;
  let k = -1; ys.forEach((h, i) => { if (h <= y) k = i; });
  if (k < 0) return 0;
  const ya = ys[k], yb = ys[k + 1] ?? pv.scrollHeight; const f = (y - ya) / Math.max(1, yb - ya);
  const a = hs[k], b = hs[k + 1] ?? total;
  return Math.floor(a + f * (b - a));
}
function setMode(want) {
  const before = shown();
  const next = want === 'off' ? 'off' : (shown() === want || S.mode === want) ? 'off' : want;
  const line = before === 'only' ? pvLine() : srcLine();
  const ta = $('.md-code textarea');
  const holder = ta && document.activeElement === ta ? 'src' : $('.md-pv')?.contains(document.activeElement) ? 'pv' : null;
  S.mode = next;
  paint(null);
  const after = shown();
  const s2 = $('.md-src');
  if (after !== 'only') { const r = lineRows()[line]; s2.scrollTop = r ? r.offsetTop : 0; }
  if (after !== 'off' && after !== before) lineToPv(line);
  // Hiding the part that had focus moves focus to the part that is left (production rule).
  const pv = $('.md-pv'); const text = $('.md-code textarea');
  if (holder === 'src' && after === 'only') pv?.focus({ preventScroll: true });
  else if (holder === 'src' || (holder === 'pv' && !pv)) text?.focus({ preventScroll: true });
  else if (holder === 'pv') pv.focus({ preventScroll: true });
}
const inEditor = () => document.activeElement === document.body || !!stage.querySelector('.md-editor')?.contains(document.activeElement);
document.addEventListener('keydown', (e) => {
  if (!stage.querySelector('.md-demo') || !inEditor()) return;
  const mod = e.metaKey || e.ctrlKey;
  // e.code, not e.key: Option+V types √ on a Mac, so the key name changes with Alt.
  if (mod && e.shiftKey && !e.altKey && e.code === 'KeyV') { e.preventDefault(); e.stopPropagation(); setMode('only'); }
  // AltGr arrives as Ctrl+Alt on Windows; AltGr+V types a character on some layouts.
  else if (mod && e.altKey && !e.shiftKey && e.code === 'KeyV' && !e.getModifierState('AltGraph')) { e.preventDefault(); e.stopPropagation(); setMode('side'); }
  else if (e.key === 'Escape' && shown() === 'only') { e.preventDefault(); e.stopPropagation(); setMode('off'); }
}, true);
stage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || !stage.querySelector('.md-demo')?.contains(b)) return;
  const act = b.dataset.act;
  if (act === 'save') { S.dirty = false; S.saved = true; paint(); return; }
  if (act === 'files') return;
  if (S.dir === 'seg') { if (act === 'off') setMode('off'); else if (shown() !== act) setMode(act); return; }
  setMode(act);
});
stage.addEventListener('change', (e) => {
  const s = e.target.closest('[data-set]'); if (!s) return;
  if (s.dataset.set === 'conv') { S.conv = s.value === '1'; S.narrow = false; paint(); requestAnimationFrame(measure); }
  if (s.dataset.set === 'kbd') { S.kbd = s.value; paint(); }
});
let pvTimer = 0;
stage.addEventListener('input', (e) => {
  const ta = e.target.closest('.md-code textarea'); if (!ta) return;
  S.text = ta.value; S.dirty = true; S.saved = false;
  $('.md-rows').innerHTML = rows(S.text); sizeArea();
  const st = $('.md-state'); if (st) st.textContent = stateText();
  const save = $('[data-act="save"]'); if (save) save.disabled = false;
  // The preview follows the buffer behind typing, as production defers it.
  // Beside the text, the preview keeps the edited section in view.
  clearTimeout(pvTimer); pvTimer = setTimeout(() => {
    const pv = $('.md-pv'); if (!pv) return;
    pv.innerHTML = preview(S.text);
    if (shown() === 'side') lineToPv(S.text.slice(0, ta.selectionStart).split('\n').length - 1);
  }, 120);
});

function start(dir) {
  Object.assign(S, { dir, mode: 'off', text: DOC, dirty: false, saved: false, srcTop: 0, narrow: false });
  requestAnimationFrame(() => { watch(); measure(); });
  return render();
}
window.mdTwo = () => start('two');
window.mdSeg = () => start('seg');
window.mdFloat = () => start('float');
// Test hook for verify.mjs.
window.__md = { S, setMode, shown };
})();
