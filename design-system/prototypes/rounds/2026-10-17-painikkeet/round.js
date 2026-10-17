// Painikkeet (ui-control-audit, 17.10.2026). Production's screens with every button drawn
// by one system: .b plus a hierarchy class (b-primary, b-secondary, b-quiet, b-danger,
// b-danger-soft, b-icon, b-pill, b-seg) and a size role (r-page, r-row, r-inline). The
// directions only set the size variables in round.css; markup and words are shared.
(() => {
const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const QR = I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>');
const PHONE = I('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>');
const LAPTOP = I('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>');
const COPY = I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>');
const GH = I('<path d="M9 19c-4 1.5-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6.2 0C6.6 2.8 5.6 3.1 5.6 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4.2 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>');
const PEN = I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>');
const EYEOFF = I('<path d="M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.6 7.6C4.4 9.1 3 12 3 12s4 6 9 6a8.6 8.6 0 0 0 4.4-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>');
const TRASH = I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>');
const PLUS = I('<path d="M12 5v14M5 12h14"/>');
const ARCHIVE = I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>');
const X = I('<path d="M6 6l12 12M18 6 6 18"/>');
const UP = I('<path d="M12 19V5M6 11l6-6 6 6"/>');
const STOP = I('<rect x="7" y="7" width="10" height="10" rx="1.5"/>');
const BRANCH = I('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11c0 4-6 3-6 8"/>');
const TERM = I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 10 3 2-3 2M12 15h5"/>');
const OUT = I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>');

const b = (cls, label, icon = '', x = '') => `<button type="button" class="b ${cls}"${x}>${icon}${label}</button>`;
const ib = (cls, label, icon) => `<button type="button" class="b b-icon ${cls}" aria-label="${label}" title="${label}">${icon}</button>`;

const rules = {
  v1: '<b>Yksi koko.</b> Jokainen tekstipainike on 44 px ja 14,5 px:n tekstillä, kuten tuotannossa nyt; ikonipainikkeet 36 px. Vain pillerit ja segmentit ovat matalampia (32 px). Puhelin ja työpöytä ovat samat.',
  v2: '<b>Työpöytäkoko.</b> Työpöydällä jokainen tekstipainike on 34 px ja 12,5 px:n tekstillä, kuten hyväksytyissä prototyypeissä; ikonipainikkeet 30 px, pillerit ja segmentit 28 px. Puhelimessa samat painikkeet kasvavat 44 px:iin.',
  v3: '<b>Rooli ratkaisee.</b> Sivun päätoiminto (käyttöönotto, vahvistus, lähetys) on 44 px; kortin ja listarivin toiminto 32 px; kentän ja palkin sisäiset pillerit ja segmentit 26 px. Puhelimessa rivien toiminnot kasvavat 40 px:iin.',
};

function screen(v) {
  return `<div class="pk ${v}">
<p class="pk-rule">${rules[v]} Kaikissa: ikoni tekstin vasemmalla tekstin keskilinjalla ja kiinteällä välillä, fokusrengas 2 px kahden pikselin päässä, ja hierarkia ensisijainen (täytetty) · toissijainen (reunus) · hiljainen (sävy) · vaarallinen.</p>

<section><h3 class="pk-h">Asetukset › Laitteet</h3>
<div class="pk-card">
  <div class="pk-row"><span class="pk-ic">${PHONE}</span><div class="pk-main"><span class="pk-name">Kirjaudu puhelimella</span><span class="pk-meta">Koodi on voimassa minuutin ja toimii kerran.</span></div>${b('b-primary r-row', 'Näytä koodi', QR)}</div>
</div>
<div class="pk-card" style="margin-top:12px">
  <div class="pk-row"><span class="pk-ic">${LAPTOP}</span><div class="pk-main"><span class="pk-name">Linux · Firefox<span class="pk-badge">Tämä selain</span></span><span class="pk-meta">Kirjautunut GitHubilla 14.10. klo 9.12</span></div>${b('b-secondary r-row', 'Kirjaudu ulos…')}</div>
  <div class="pk-row"><span class="pk-ic">${PHONE}</span><div class="pk-main"><span class="pk-name">Android · Chrome</span><span class="pk-meta">Kirjautunut QR-koodilla 28.9. klo 21.05</span></div>${b('b-quiet r-row', 'Kirjaa ulos…')}</div>
</div></section>

<section><h3 class="pk-h">Asetukset › Tili ja Ulkoasu</h3>
<div class="pk-card">
  <div class="pk-row"><span class="pk-av">A</span><div class="pk-main"><span class="pk-name">Alice Example</span><span class="pk-meta">alice@example.invalid</span></div>${b('b-secondary r-row', 'Kirjaudu ulos…', OUT)}</div>
  <div class="pk-row"><div class="pk-main"><span class="pk-name">Git-identiteetti</span><span class="pk-meta">Commitien tekijä. Tallentuu tiedostoon ~/.gitconfig.</span></div>${b('b-secondary r-row', 'Muokkaa Git-identiteettiä')}</div>
  <div class="pk-row"><div class="pk-main"><span class="pk-name">Teema</span></div><span class="pk-seg" role="group" aria-label="Teema">${b('b-seg r-inline', 'Järjestelmä', '', ' aria-pressed="true"')}${b('b-seg r-inline', 'Vaalea', '', ' aria-pressed="false"')}${b('b-seg r-inline', 'Tumma', '', ' aria-pressed="false"')}</span></div>
  <div class="pk-row"><div class="pk-main"><span class="pk-name">Roskakori</span><span class="pk-meta">3 työtilaa · 120 Mt</span></div>${b('b-danger-soft r-row', 'Tyhjennä roskakori…')}</div>
</div></section>

<section><h3 class="pk-h">Työtilasivu</h3>
<div class="pk-ws"><div><h2>aurinkokello</h2><span class="pk-meta">~/src/aurinkokello</span></div>
<span class="pk-actions">${ib('r-row', 'Kopioi polku', COPY)}${ib('r-row', 'Avaa GitHubissa', GH)}${ib('r-row', 'Nimeä uudelleen', PEN)}${ib('r-row', 'Piilota', EYEOFF)}${ib('b-danger-soft r-row', 'Siirrä roskakoriin', TRASH)}<span class="pk-sep"></span>${ib('b-primary r-row', 'Aloita uusi Pi-keskustelu', PLUS)}</span></div>
<div class="pk-card" style="margin-top:12px"><div class="pk-conv"><div class="pk-conv-top">Miksi CI epäonnistuu macOS:llä?${ib('r-inline', 'Arkistoi', ARCHIVE)}</div><span class="pk-meta">Vain luku · 5 t sitten</span><span>CI kaatuu, koska testi olettaa /usr/share/zoneinfo-polun.</span><div class="pk-conv-end"><a class="pk-link" href="#" onclick="return false">Avaa →</a></div></div></div>
</section>

<section><h3 class="pk-h">Keskustelun alakerta</h3>
<div class="pk-card"><div class="pk-recap"><div class="pk-recap-top">Tilannekatsaus <span class="pk-meta">5 t sitten</span>${ib('r-inline', 'Sulje', X)}</div><span>Testit menevät läpi. Seuraavaksi: tarkista muutos.</span></div></div>
<div class="pk-strip" style="margin:10px 0 6px">${b('b-pill r-inline', '1', BRANCH, ' aria-expanded="false" aria-label="Spinoffit: 1"')}${b('b-pill r-inline', '1', TERM, ' aria-expanded="true" aria-label="Prosessit: 1"')}</div>
<div class="pk-entry"><div class="pk-field">Ohjaa tai lähetä jonoon…</div>${ib('b-primary r-page', 'Lähetä', UP)}</div>
<div class="pk-work">${ib('r-inline', 'Keskeytä', STOP)}<span class="pk-seg" role="group" aria-label="Viestin lähetysaika">${b('b-seg r-inline', 'Ohjaa', '', ' aria-pressed="true"')}${b('b-seg r-inline', 'Työn jälkeen', '', ' aria-pressed="false"')}</span>${b('b-quiet r-inline', '2 viestiä jonossa')}</div>
</section>

<section><h3 class="pk-h">Käyttöönotto</h3>
<div class="pk-card pk-onb"><span class="pk-meta">Käyttöönotto · 3/3</span><h3>Kirjaudu OpenAI-tiliisi</h3><p>Kirjaudu ChatGPT-tilillesi, niin voit aloittaa työtiloissa.</p>
<div class="pk-actions">${b('b-primary r-page', 'Aloita kirjautuminen')}${b('b-secondary r-page', 'Takaisin valitsemaan GitHub-repoja')}</div>
${b('b-quiet r-row', 'Keskeytä käyttöönotto ja kirjaudu ulos')}</div>
</section>

<section><h3 class="pk-h">Vahvistus</h3>
<div class="pk-card pk-dialog"><h3>Siirretäänkö aurinkokello roskakoriin?</h3><p>Työtila ja sen keskustelut säilyvät roskakorissa 30 päivää.</p>
<div class="pk-actions">${b('b-secondary r-page', 'Peruuta')}${b('b-danger r-page', 'Siirrä roskakoriin', TRASH)}</div></div>
</section>

<section><h3 class="pk-h">Tilat</h3>
<div class="pk-states">${['', 'is-hover', 'is-press', 'is-focus', 'is-disabled'].map((s, i) => `<figure>${b(`b-primary r-row ${s}`, 'Näytä koodi', QR)}${b(`b-secondary r-row ${s}`, 'Peruuta')}${b(`b-quiet r-row ${s}`, 'Kirjaa ulos…')}<figcaption>${['lepo', 'osoitin päällä', 'painettu', 'näppäimistöfokus', 'estetty'][i]}</figcaption></figure>`).join('')}</div>
</section>
</div>`;
}

const pick = (v) => () => {
  following = false;
  requestAnimationFrame(() => requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; }));
  return screen(v);
};
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
