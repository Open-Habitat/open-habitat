// Sanelu viestikenttään (proto-speech-input, 28.10.2026). Kierros piirtää oman alakertansa
// tuotannon Rivillä-mallin mukaan (kenttä ja sen alarivi: Liitä, Komennot, Tiedosto, malli,
// Lähetä) ja lisää riville mikrofonin. Sanelu on simuloitu: synteettinen puhe etenee sivun
// omalla kellolla (nopeus 1×, 10× tai 60×), ja Kohtaus-valinta hyppää pitkän sanelun
// kiinnostaviin kohtiin. Suunnat eroavat vain siinä, mikä pitkän sanelun päättää.
(() => {
const comp = document.querySelector('.composer');
const S = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
const I = {
  mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>'),
  clip: S('<path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>'),
  slash: S('<path d="M15 4 9 20"/>'),
  at: S('<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.3 6.7"/>'),
  up: S('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', ' stroke-width="2.2"'),
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
  done: S('<path d="m5 12.5 4.5 4.5L19 7"/>', ' stroke-width="2.2"'),
  warn: S('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5"/><path d="M12 17.2h.01"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>'),
  close: S('<path d="M6 6l12 12M18 6 6 18"/>'),
};

// ---------- Synthetic speech ----------
// A person dictates a long brief for the aurinkokello workspace. Words come at a talking pace
// with short pauses between sentences and longer ones between thoughts; the cycle repeats for
// dictations longer than the text (a 25-minute dictation is ~3 000 words).
const PARAS = [
  'Okei, aloitetaan isommasta kokonaisuudesta. Haluan, että statusrivit kootaan jatkossa viikoittain eikä päivittäin, ja että sama skripti osaa tehdä myös kuukauden yhteenvedon. Älä vielä kirjoita koodia, vaan kerro ensin, miten jakaisit työn.',
  'Taustaksi: statusrivit luetaan nyt tiedostosta status.md, ja jokaisella rivillä on päivä, kohde ja tila. Viikon yhteenvedossa samat kohteet yhdistetään yhdeksi riviksi, ja tilaksi tulee viimeisin tila. Jos kohde on ollut kesken koko viikon, se näytetään erikseen.',
  'Sitten päivämäärät. Viikko alkaa maanantaista, ja viikkonumero lasketaan ISO-standardin mukaan. Vuodenvaihteessa viikko voi kuulua edelliseen vuoteen, joten testaa se erikseen. Käytä kiinteää päivämäärää testeissä, ei tämän päivän päivämäärää.',
  'Komentorivillä haluan valitsimen --viikko, joka ottaa viikkonumeron, ja valitsimen --kuukausi muodossa vuosi viiva kuukausi. Jos kumpaakaan ei anneta, oletus on kuluva viikko. --since-lippu jää ennalleen, mutta sitä ei voi käyttää yhdessä uusien valitsimien kanssa.',
  'Tulosteen pitää olla edelleen JSON-muotoinen, jotta Matin raportointi ei hajoa. Lisää JSONiin kenttä jakso, jossa on alku- ja loppupäivä. Taulukkotuloste --table saa näyttää viikon otsikkorivinä ja kohteet sen alla sisennettyinä.',
  'Yksi asia vielä tulosteesta: kohteiden järjestys on aakkosjärjestys, mutta kesken olevat tulevat ensin. Tämä on tärkeää, koska luen listaa yleensä puhelimesta ja haluan nähdä keskeneräiset heti.',
  'Testeistä: tests-kansiossa on jo test_status_rows.py. Laajenna sitä, älä tee uutta tiedostoa. Lisää ainakin vuodenvaihteen viikko, tyhjä viikko, viikko jossa sama kohde vaihtaa tilaa kolme kertaa, ja kuukausi jossa on viisi maanantaita.',
  'Aja pytest ennen kuin näytät mitään, ja jos jokin vanha testi menee rikki, pysähdy ja kerro miksi. En halua, että vanhoja odotusarvoja muutetaan hiljaa.',
  'Dokumentaatio: README:ssä on esimerkkikomennot. Päivitä ne vastaamaan uusia valitsimia ja lisää yksi esimerkki kuukauden yhteenvedosta. docs-kansion käyttöohjeeseen riittää lyhyt kappale, ei uutta lukua.',
  'Ja sitten tekniset rajat. Pysy Pythonin vakiokirjastossa, älä lisää riippuvuuksia. Python 3.11 riittää. Jos tarvitset päivämääräapuja, tee ne samaan tiedostoon pieniksi funktioiksi, joille annetaan tämä päivä parametrina.',
  'Kun olet valmis, tee yksi commit testeineen ja kirjoita viestiin lyhyesti, mitä muuttui ja miksi. Älä pushaa. Näytä lopuksi git diff --stat ja kolmen esimerkkikomennon tulosteet.',
  'Lisään vielä yhden toiveen. Jos huomaat työn aikana jotain muuta korjattavaa, kirjaa se notes-kansioon tämän päivän muistiinpanoihin äläkä korjaa sitä nyt. Palataan niihin huomenna.',
];
// Interim guesses that Soniox would correct when the token turns final.
const MISHEARD = { 'JSON-muotoinen,': 'Jason muotoinen', 'JSONiin': 'Jasoniin', '--since-lippu': 'sinssi lippu', 'pytest': 'pai test', 'test_status_rows.py.': 'testi status rows', 'README:ssä': 'riidmissä', 'Matin': 'matin', 'pushaa.': 'puussaa' };
const WORD = 0.4, LAG = 1.3, PARA_BREAK = 4;
const GAPS = [2.5, 6, 3, 8, 4.5, 2.2, 7, 3.5, 5, 9, 3, 6];
const W = []; let CYCLE = 0;
{
  let t = 0.8;
  PARAS.forEach((p, i) => {
    for (const w of p.split(/\s+/)) { W.push({ w, s: t, e: t + WORD * 0.85 }); t += WORD + (/[.?!:]$/.test(w) ? 0.55 : /,$/.test(w) ? 0.18 : 0); }
    t += GAPS[i];
  });
  CYCLE = t;
}
const N = W.length;

// ---------- Directions ----------
const MIN = 60, HOUR = 3600;
const DIRS = {
  cap: { warnAt: 25 * MIN, endAt: 30 * MIN },
  silence: { silWarn: 2 * MIN, silEnd: 3 * MIN, backWarn: 4 * HOUR - 5 * MIN, endAt: 4 * HOUR },
  ask: { askEvery: 25 * MIN, grace: 5 * MIN, backWarn: 4 * HOUR - 5 * MIN, endAt: 4 * HOUR },
};

// ---------- State ----------
const D = {
  dir: 'cap', phase: 'idle', t: 0, speed: 1, base: '', hushAt: Infinity, hushLen: 0,
  fin: 0, finText: '', notice: null, fail: null, key: 'own', ask: 0, asked: false, askNote: 0,
  drop: null, last: 0, hold: false, downAt: 0, sentText: '', draft: '', runId: 0,
};
let raf = 0;
const now = () => performance.now();
const fmt = (sec) => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / HOUR), m = Math.floor(sec % HOUR / 60), s = sec % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };

// Timeline with the person's own long silence (the pause scene) cut in.
const toSpeech = (t) => t < D.hushAt ? t : t < D.hushAt + D.hushLen ? D.hushAt : t - D.hushLen;
const startOf = (k) => { const c = Math.floor(k / N); const s = c * CYCLE + W[k % N].s; return s < D.hushAt ? s : s + D.hushLen; };
const endOf = (k) => startOf(k) + WORD * 0.85;
function countAt(t) { // words started by real time t
  const st = toSpeech(t); if (st <= 0) return 0;
  const c = Math.floor(st / CYCLE), r = st - c * CYCLE;
  let lo = 0, hi = N; while (lo < hi) { const m = (lo + hi) >> 1; if (W[m].s <= r) lo = m + 1; else hi = m; }
  return c * N + lo;
}
const silence = (t) => { const n = countAt(t); return n ? Math.max(0, t - endOf(n - 1)) : t; };
const sep = (k) => k === 0 ? '' : (startOf(k) - endOf(k - 1) >= PARA_BREAK ? '\n\n' : ' ');
function finalsTo(n) { // append words [D.fin, n) to finText
  if (n <= D.fin) return;
  const parts = [];
  for (let k = D.fin; k < n; k++) parts.push(sep(k), W[k % N].w);
  D.finText += parts.join(''); D.fin = n;
}
function interim() {
  const n = countAt(D.t), out = [];
  for (let k = D.fin; k < n; k++) { const w = W[k % N].w; out.push(sep(k), D.t - startOf(k) < 0.6 && MISHEARD[w] ? MISHEARD[w] : w); }
  return out.join('');
}
const finalCount = (t) => countAt(t - LAG);

// ---------- Composer ----------
function buildComposer() {
  comp.className = 'composer sp-composer';
  comp.innerHTML = `<section class="sp-area" aria-label="Kirjoita viesti">
<div class="sp-above" aria-live="polite"></div>
<div class="sp-box">
  <textarea class="sp-field" rows="1" aria-label="Viesti agentille" placeholder="Kirjoita agentille…"></textarea>
  <div class="sp-field sp-live" role="textbox" aria-multiline="true" aria-readonly="true" aria-label="Sanelu, teksti syntyy puheesta" hidden><span class="sp-base"></span><span class="sp-final"></span><span class="sp-int"></span><span class="sp-caret" aria-hidden="true"></span></div>
  <div class="sp-row">
    <button type="button" class="sp-btn sp-tool" data-sp="tool" data-tool="Liitä" title="Liitä tiedosto">${I.clip}<span class="lbl">Liitä</span></button>
    <button type="button" class="sp-btn sp-tool" data-sp="tool" data-tool="Komennot" title="Komennot ja taidot · kirjoita myös / kentässä">${I.slash}<span class="lbl">Komennot</span></button>
    <button type="button" class="sp-btn sp-tool" data-sp="tool" data-tool="Tiedosto" title="Tiedosto · kirjoita myös @ kentässä">${I.at}<span class="lbl">Tiedosto</span></button>
    <span class="sp-grow"></span>
    <span class="sp-model sp-tool" title="Malli ja ajattelutaso">gpt-5.5 · medium</span>
    <span class="sp-mic-slot">${micBtn()}${pill()}</span>
    <span class="sp-stop-slot"></span>
    <button type="button" class="sp-send" data-sp="send" aria-label="Lähetä" title="Lähetä">${I.up}</button>
  </div>
</div>
<div class="sp-below" aria-live="polite"></div>
</section>`;
  const ta = comp.querySelector('textarea');
  ta.value = D.draft; fit(ta);
  ta.addEventListener('input', () => { D.draft = ta.value; fit(ta); if (D.notice && D.notice.soft) D.notice = null; paintComposer(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
}
function fit(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 268) + 'px'; }
const els = () => ({
  ta: comp.querySelector('textarea'), live: comp.querySelector('.sp-live'), above: comp.querySelector('.sp-above'), below: comp.querySelector('.sp-below'),
  mic: comp.querySelector('.sp-mic-slot'), stop: comp.querySelector('.sp-stop-slot'), send: comp.querySelector('.sp-send'), area: comp.querySelector('.sp-area'),
});
const dictating = () => ['connecting', 'live', 'reconnecting', 'finishing'].includes(D.phase);
const agentWorking = () => UI.working && selConv().id === 'c1';

const BARS = 5;
function level() {
  if (D.phase !== 'live') return 0;
  const sil = silence(D.t); if (sil > 0.35) return 0;
  return 0.35 + 0.65 * Math.abs(Math.sin(D.t * 7.3) * Math.cos(D.t * 3.1));
}
function pillLabel() {
  if (D.phase === 'connecting') return 'Yhdistetään…';
  if (D.phase === 'reconnecting') return 'Yhdistetään uudelleen…';
  if (D.phase === 'finishing') return 'Viimeistellään…';
  if (D.hold) return 'päästä irti, niin sanelu loppuu';
  const sil = silence(D.t);
  return sil >= 2 ? `tauko ${fmt(sil)}` : 'kuuntelee';
}
function pill() {
  return `<button type="button" class="sp-pill" data-sp="stop-dictation" hidden aria-label="Lopeta sanelu" title="Lopeta sanelu (Esc). Teksti jää kenttään.">
<span class="sp-dot" aria-hidden="true"></span><span class="sp-bars" aria-hidden="true">${'<i></i>'.repeat(BARS)}</span><span class="sp-time">${fmt(D.t)}</span><span class="sp-state">${pillLabel()}</span><span class="sp-done">${I.done}<span>Valmis</span></span></button>`;
}
function micBtn() {
  return `<button type="button" class="sp-btn sp-mic" data-sp="mic" aria-label="Sanele" title="Sanele · napauta aloittaaksesi, pidä pohjassa puhuaksesi">${I.mic}<span class="lbl">Sanele</span></button>`;
}

// What sits above the field: the ceiling's approach, depending on the direction.
function aboveHtml() {
  if (D.phase !== 'live' && D.phase !== 'reconnecting') return '';
  const c = DIRS[D.dir], t = D.t;
  if (D.dir === 'cap' && t >= c.warnAt) {
    const left = c.endAt - t, last = left <= 60;
    return `<div class="sp-note${last ? ' urgent' : ''}" data-note="cap">${I.clock}<span><strong>Sanelu päättyy ${fmt(left)} kuluttua</strong> <span class="sub">30 minuutin kohdalla. Kaikki sanottu jää kenttään, ja voit jatkaa uudella sanelulla.</span></span></div>`;
  }
  if (D.dir === 'silence') {
    const sil = silence(t);
    if (sil >= c.silWarn) {
      const left = c.silEnd - sil;
      return `<div class="sp-note${left <= 30 ? ' urgent' : ''}" data-note="silence">${I.clock}<span><strong>Hiljaista ${fmt(sil)}</strong> <span class="sub">Sanelu päättyy ${fmt(left)} kuluttua, ellei puhetta kuulu.</span></span></div>`;
    }
  }
  if ((D.dir === 'silence' || D.dir === 'ask') && t >= c.backWarn) {
    return `<div class="sp-note${c.endAt - t <= 60 ? ' urgent' : ''}" data-note="backstop">${I.clock}<span><strong>Sanelu päättyy ${fmt(c.endAt - t)} kuluttua</strong> <span class="sub">Neljä tuntia on yhden sanelun enimmäispituus. Teksti jää kenttään.</span></span></div>`;
  }
  if (D.dir === 'ask' && D.asked) {
    const left = D.ask + c.grace - t;
    return `<div class="sp-ask${left <= 60 ? ' urgent' : ''}" role="group" aria-label="Jatketaanko sanelua?" data-note="ask">
<div class="sp-ask-text">${I.clock}<span><strong>Jatketaanko sanelua?</strong> <span class="sub">Sanelu on kestänyt ${fmt(D.ask)}. Se päättyy ${fmt(left)} kuluttua, ellet jatka.</span></span></div>
<div class="sp-ask-acts"><button type="button" class="sp-b primary" data-sp="continue">Jatka sanelua</button><button type="button" class="sp-b" data-sp="stop-dictation">Lopeta nyt</button></div></div>`;
  }
  if (D.dir === 'ask' && D.askNote && now() - D.askNote < 3500) {
    return `<div class="sp-note calm" data-note="continued">${I.done}<span>Sanelu jatkuu. <span class="sub">Kysyn uudelleen ${fmt(D.ask + c.askEvery)} kohdalla.</span></span></div>`;
  }
  return '';
}
function belowHtml() {
  const n = D.notice; if (!n) return '';
  const acts = (n.acts || []).map(([a, label, primary]) => `<button type="button" class="sp-b${primary ? ' primary' : ''}" data-sp="${a}">${label}</button>`).join('');
  return `<div class="sp-notice ${n.tone || 'info'}" role="${n.tone === 'danger' ? 'alert' : 'status'}" data-notice="${n.id}">${n.tone === 'danger' ? I.warn : I.info}<div class="sp-notice-body"><strong>${n.title}</strong>${n.text ? `<p>${n.text}</p>` : ''}${acts ? `<div class="sp-notice-acts">${acts}</div>` : ''}</div><button type="button" class="sp-x" data-sp="dismiss" aria-label="Sulje ilmoitus">${I.close}</button></div>`;
}

let lastAbove = null, lastBelow = null, lastStop = null;
function paintComposer() {
  const e = els(); if (!e.ta) return;
  const on = dictating();
  e.area.classList.toggle('dictating', on);
  e.area.classList.toggle('working', agentWorking());
  e.ta.hidden = on; e.live.hidden = !on;
  // Mic slot: the button at rest, the recording pill in the same place while dictating.
  const micB = e.mic.querySelector('.sp-mic'), pillB = e.mic.querySelector('.sp-pill');
  micB.hidden = on; pillB.hidden = !on;
  if (on) paintPill(pillB);
  const st = agentWorking() ? `<button type="button" class="sp-agent-stop" data-sp="agent-stop" aria-label="Pysäytä agentin työ" title="Pysäytä agentin työ">${I.stop}</button>` : '';
  if (st !== lastStop) { e.stop.innerHTML = st; lastStop = st; }
  const text = on ? D.base + D.finText : e.ta.value;
  const ready = !!text.trim();
  e.send.toggleAttribute('aria-disabled', !ready); if (!ready) e.send.setAttribute('aria-disabled', 'true');
  e.send.title = on ? 'Lopeta sanelu ja lähetä' : agentWorking() ? 'Ohjaa: agentti saa viestin työn välivaiheessa' : 'Lähetä';
  e.send.setAttribute('aria-label', e.send.title);
  e.ta.placeholder = agentWorking() ? 'Ohjaa agenttia…' : 'Kirjoita agentille…';
  for (const b of comp.querySelectorAll('.sp-tool')) b.toggleAttribute('disabled', on);
  const a = aboveHtml(); if (a !== lastAbove) { e.above.innerHTML = a; lastAbove = a; }
  const b = belowHtml(); if (b !== lastBelow) { e.below.innerHTML = b; lastBelow = b; }
  if (on) paintLive(e.live);
}
function paintPill(p) {
  if (!p) return;
  p.querySelector('.sp-time').textContent = fmt(D.t);
  p.querySelector('.sp-state').textContent = pillLabel();
  p.setAttribute('aria-label', `Lopeta sanelu, ${fmt(D.t)}`);
  p.classList.toggle('paused', D.phase === 'live' && silence(D.t) >= 2);
  p.classList.toggle('busy', D.phase !== 'live');
  p.classList.toggle('hold', D.hold);
  const lv = level();
  p.querySelectorAll('.sp-bars i').forEach((b, i) => { const h = lv ? Math.max(0.18, Math.min(1, lv * (0.55 + 0.45 * Math.abs(Math.sin(D.t * (4 + i * 1.7) + i))))) : 0.18; b.style.transform = `scaleY(${h.toFixed(2)})`; });
}
function paintLive(live) {
  const base = live.querySelector('.sp-base'), fin = live.querySelector('.sp-final'), int = live.querySelector('.sp-int');
  if (base.textContent !== D.base) base.textContent = D.base;
  if (fin.textContent.length !== D.finText.length) fin.textContent = D.finText;
  const it = D.phase === 'finishing' ? '' : interim();
  if (int.textContent !== it) int.textContent = it;
  live.classList.toggle('empty', !D.base && !D.finText && !it);
  live.dataset.placeholder = D.phase === 'connecting' ? 'Yhdistetään Sonioxiin…' : 'Puhu, teksti tulee tähän…';
  live.scrollTop = live.scrollHeight;
}
APP.painted.push(paintComposer);

// ---------- Dictation ----------
function loop() {
  cancelAnimationFrame(raf);
  const step = () => {
    const t1 = now(), dt = Math.min(0.25, (t1 - D.last) / 1000); D.last = t1;
    if (D.phase === 'live') { D.t += dt * D.speed; finalsTo(finalCount(D.t)); policy(); }
    paintComposer();
    if (dictating() || (D.askNote && now() - D.askNote < 3600)) raf = requestAnimationFrame(step);
  };
  D.last = now(); raf = requestAnimationFrame(step);
}
function policy() {
  const c = DIRS[D.dir], t = D.t;
  if (D.drop && t >= D.drop.at) { const d = D.drop; D.drop = null; return reconnect(d.fail); }
  if (D.dir === 'cap' && t >= c.endAt) { D.t = c.endAt; return finish('cap'); }
  if (D.dir === 'silence' && silence(t) >= c.silEnd) return finish('silence');
  if (D.dir === 'ask') {
    if (!D.asked && t >= D.ask + c.askEvery) { D.ask += c.askEvery; D.asked = true; }
    if (D.asked && t >= D.ask + c.grace) return finish('noanswer');
  }
  if (c.endAt && t >= c.endAt) { D.t = c.endAt; return finish('backstop'); }
}
function start(at = 0, opts = {}) {
  if (dictating()) return;
  const run = ++D.runId;
  const ta = comp.querySelector('textarea');
  const existing = ta.value;
  D.base = existing && !/\s$/.test(existing) ? existing + ' ' : existing;
  D.notice = null; D.t = at; D.fin = 0; D.finText = ''; D.ask = 0; D.asked = false; D.askNote = 0;
  D.hushAt = opts.hushAt ?? Infinity; D.hushLen = opts.hushLen ?? 0; D.drop = opts.drop ?? null;
  // Jatkokysymys: questions before the jump point count as answered.
  if (D.dir === 'ask') D.ask = Math.floor(at / DIRS.ask.askEvery) * DIRS.ask.askEvery;
  if (opts.asked) { D.ask = opts.asked; D.asked = true; }
  finalsTo(finalCount(at));
  D.phase = 'connecting'; paintComposer(); loop();
  setTimeout(() => {
    if (run !== D.runId || D.phase !== 'connecting') return;
    if (D.key === 'none' || D.fail) { D.phase = 'idle'; D.notice = startError(); paintComposer(); return; }
    D.phase = 'live'; D.last = now(); loop();
  }, opts.instant ? 60 : 650);
}
function startError() {
  if (D.key === 'none') return { id: 'nokey', tone: 'info', title: 'Sanelu tarvitsee Soniox-avaimen', text: 'Lisää oma avain asetuksissa. Jos palvelimen ylläpitäjä lisää yhteisen avaimen, sanelu toimii ilman omaa.', acts: [['settings', 'Avaa asetukset', true]] };
  if (D.fail === 'mic') return { id: 'mic', tone: 'danger', title: 'Selain ei antanut mikrofonia', text: 'Salli mikrofoni osoiterivin lukkokuvakkeesta ja yritä uudelleen.', acts: [['retry', 'Yritä uudelleen', true]] };
  if (D.fail === 'rejected') return { id: 'rejected', tone: 'danger', title: 'Soniox hylkäsi avaimen', text: 'Avain on poistettu tai sen oikeudet eivät riitä reaaliaikaiseen saneluun. Vaihda avain asetuksissa.', acts: [['settings', 'Avaa asetukset', true]] };
  if (D.fail === 'limit') return { id: 'limit', tone: 'danger', title: 'Sanelu ei nyt mahdu', text: 'Palvelimen yhteisellä Soniox-avaimella on jo 10 sanelua käynnissä. Yritä hetken päästä tai lisää oma avain.', acts: [['retry', 'Yritä uudelleen', true], ['settings', 'Avaa asetukset']] };
  return null;
}
function reconnect(fail) {
  D.phase = 'reconnecting'; paintComposer();
  const run = D.runId;
  setTimeout(() => {
    if (run !== D.runId || D.phase !== 'reconnecting') return;
    if (fail) return finish('drop');
    D.phase = 'live'; D.last = now(); loop();
  }, 1600);
}
// Stop: the open interim is finalized (Soniox `finalize`), then the field is plain text again.
function finish(reason) {
  if (!dictating()) return;
  const run = D.runId;
  D.phase = 'finishing'; paintComposer();
  setTimeout(() => {
    if (run !== D.runId) return;
    // Interim words become text: on a drop they are the best guess we have and stay editable.
    finalsTo(countAt(D.t));
    const text = D.base + D.finText;
    D.phase = 'idle'; D.hold = false;
    const ta = comp.querySelector('textarea'); ta.value = text; D.draft = text; fit(ta);
    D.notice = endNotice(reason);
    if (reason === 'send') { doSend(); return; }
    paintComposer();
    ta.focus(); ta.setSelectionRange(text.length, text.length); ta.scrollTop = ta.scrollHeight;
  }, reason === 'drop' ? 200 : 550);
}
function endNotice(reason) {
  const more = ['resume', 'Jatka sanelua', true];
  if (reason === 'cap') return { id: 'cap', title: 'Sanelu päättyi 30 minuutin kattoon', text: 'Kaikki sanottu on kentässä. Jatka uudella sanelulla, jos sinulla on vielä sanottavaa.', acts: [more], soft: true };
  if (reason === 'silence') return { id: 'silence', title: 'Sanelu päättyi, koska oli hiljaista 3 minuuttia', text: 'Teksti on kentässä.', acts: [more], soft: true };
  if (reason === 'noanswer') return { id: 'noanswer', title: 'Sanelu päättyi, koska jatkoon ei vastattu', text: 'Teksti on kentässä.', acts: [more], soft: true };
  if (reason === 'backstop') return { id: 'backstop', title: 'Sanelu päättyi neljän tunnin enimmäispituuteen', text: 'Teksti on kentässä.', acts: [more], soft: true };
  if (reason === 'drop') return { id: 'drop', tone: 'danger', title: 'Sanelu katkesi: yhteys Sonioxiin ei palannut', text: `Teksti ${fmt(D.t)} asti on kentässä. Viimeiset sanat voivat olla epätarkkoja.`, acts: [more] };
  return null;
}
function send() {
  if (dictating()) { if ((D.base + D.finText).trim()) finish('send'); return; }
  doSend();
}
function doSend() {
  const ta = comp.querySelector('textarea'); const text = ta.value.trim();
  if (!text) { paintComposer(); return; }
  if (selConv().id !== 'c1') { toast('Tässä vedoksessa viestin voi lähettää Status-skriptiin.'); return; }
  const host = stage.querySelector('.vwrap');
  if (host) {
    const time = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    host.insertAdjacentHTML('beforeend', userBubble({ md: text.length > 1400 ? text.slice(0, 1400) + ' …' : text, time }, 0));
    following = true; stage.scrollTop = stage.scrollHeight;
  }
  ta.value = ''; D.draft = ''; fit(ta); D.notice = null; paintComposer();
  toast(agentWorking() ? 'Ohjaus lähti agentille.' : 'Viesti lähti. Vedoksessa agentti ei vastaa saneluun.');
}

// ---------- Interaction ----------
comp.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-sp="mic"]'); if (!b || e.button !== 0) return;
  if (dictating()) return;
  D.downAt = now(); D.hold = false;
  e.preventDefault(); start();
  // Held past half a second: push-to-talk, release ends the dictation.
  const run = D.runId;
  const timer = setTimeout(() => { if (run === D.runId && dictating()) { D.hold = true; paintComposer(); } }, 500);
  const up = () => { clearTimeout(timer); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); if (D.hold && run === D.runId) finish('user'); };
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
});
comp.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sp]'); if (!b || b.disabled) return;
  const a = b.dataset.sp;
  if (a === 'mic') { if (e.detail === 0) start(); return; } // keyboard activation; pointer handled above
  if (a === 'stop-dictation') { if (now() - D.downAt < 350) return; return finish('user'); }
  if (a === 'send') { if (b.getAttribute('aria-disabled') === 'true') return; return send(); }
  if (a === 'continue') { D.asked = false; D.askNote = now(); paintComposer(); loop(); return; }
  if (a === 'dismiss') { D.notice = null; return paintComposer(); }
  if (a === 'resume' || a === 'retry') { D.notice = null; D.fail = a === 'retry' ? null : D.fail; return start(); }
  if (a === 'settings') return toast('Asetukset › Sanelu avautuisi tässä: oma Soniox-avain ja alue (EU tai US).');
  if (a === 'tool') return toast(`${b.dataset.tool} ei kuulu tähän vedokseen.`);
  if (a === 'agent-stop') {
    const t = stage.querySelector('.turn.live.working'); run++;
    if (t) { const s = t.querySelector('.strip.working'); if (s) s.outerHTML = `<div class="strip stopped"><span class="act">${I.stop}Pysäytetty</span></div>`; t.classList.remove('working'); }
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && dictating() && D.phase !== 'finishing') { e.preventDefault(); finish('user'); }
});

// ---------- Page bar: scenes and speed ----------
const SCENES = {
  common: [
    ['rest', 'Lepo'],
    ['live', 'Sanelu alkaa'],
    ['long', 'Pitkä sanelu, 12 min'],
    ['pause', 'Tauko puheessa'],
    ['draft', 'Jatkaa kirjoitettua tekstiä'],
    ['done', 'Sanelu lopetettu'],
  ],
  cap: [['warn', 'Katto lähestyy, 25 min'], ['end', 'Katto täyttyy, 30 min']],
  silence: [['warn', 'Hiljaisuus 2 min'], ['end', 'Hiljaisuus päättää, 3 min'], ['back', 'Takaraja 4 h']],
  ask: [['warn', 'Jatkokysymys, 25 min'], ['end', 'Ei vastausta, 30 min'], ['back', 'Takaraja 4 h']],
  errors: [['drop', 'Yhteys katkeaa hetkeksi'], ['dropfail', 'Yhteys ei palaa'], ['nokey', 'Ei avainta'], ['mic', 'Mikrofoni estetty'], ['rejected', 'Avain hylätty'], ['limit', 'Yhteinen avain täynnä']],
};
const bar = document.querySelector('.page-bar .hint');
bar.insertAdjacentHTML('beforebegin', `<label>Kohtaus <select id="sp-scene"></select></label><label>Nopeus <select id="sp-speed"><option value="1">1×</option><option value="10">10×</option><option value="60">60×</option></select></label>`);
const sceneSel = document.getElementById('sp-scene'), speedSel = document.getElementById('sp-speed');
function fillScenes() {
  const g = (label, list) => `<optgroup label="${label}">${list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</optgroup>`;
  sceneSel.innerHTML = g('Sanelu', SCENES.common) + g('Pitkän sanelun loppu', SCENES[D.dir]) + g('Virheet', SCENES.errors);
}
speedSel.addEventListener('change', () => { D.speed = +speedSel.value; });
sceneSel.addEventListener('change', () => scene(sceneSel.value));
// A long dictation starts at a pause boundary so the jump lands mid-thought, not mid-word.
function scene(id) {
  D.runId++; D.phase = 'idle'; D.notice = null; D.fail = null; D.key = 'own'; D.hold = false;
  const ta = comp.querySelector('textarea'); ta.value = ''; D.draft = ''; fit(ta);
  const c = DIRS[D.dir];
  const go = (at, o = {}) => start(at, { instant: true, ...o });
  if (id === 'rest') return paintComposer();
  if (id === 'live') return start(0);
  if (id === 'long') return go(12 * MIN);
  // The person goes quiet after the last word before the given minute.
  const quiet = (t) => { D.hushAt = Infinity; D.hushLen = 0; return endOf(countAt(t) - 1); };
  if (id === 'pause') { const h = quiet(6 * MIN); return go(h + 38, { hushAt: h, hushLen: 50 }); }
  if (id === 'draft') { ta.value = 'Kaksi korjausta edelliseen:'; D.draft = ta.value; fit(ta); return start(0); }
  if (id === 'done') { go(4 * MIN); return setTimeout(() => finish('user'), 120); }
  if (id === 'warn') {
    if (D.dir === 'cap') return go(c.warnAt - 6);
    if (D.dir === 'silence') { const h = quiet(9 * MIN); return go(h + c.silWarn - 6, { hushAt: h, hushLen: 10 * MIN }); }
    return go(c.askEvery - 6);
  }
  if (id === 'end') {
    if (D.dir === 'cap') return go(c.endAt - 8);
    if (D.dir === 'silence') { const h = quiet(9 * MIN); return go(h + c.silEnd - 8, { hushAt: h, hushLen: 10 * MIN }); }
    return go(c.askEvery + c.grace - 8, { asked: c.askEvery });
  }
  if (id === 'back') return go(c.backWarn - 4);
  if (id === 'drop' || id === 'dropfail') return go(3 * MIN, { drop: { at: 3 * MIN + 2.5, fail: id === 'dropfail' } });
  if (id === 'nokey') { D.key = 'none'; return start(0); }
  if (['mic', 'rejected', 'limit'].includes(id)) { D.fail = id; return start(0); }
}

// ---------- Directions ----------
function mountDir(dir) {
  D.dir = dir; D.runId++; D.phase = 'idle'; D.notice = null; D.fail = null; D.key = 'own'; D.draft = '';
  buildComposer(); fillScenes(); sceneSel.value = 'rest'; lastAbove = lastBelow = lastStop = null;
  comp.dataset.dir = dir;
  return appView();
}
window.spCap = () => mountDir('cap');
window.spSilence = () => mountDir('silence');
window.spAsk = () => mountDir('ask');
// Test hook for the round's verify script: freeze the clock to take stable pictures.
window.__sp = { D, scene, pause: () => { D.speed = 0; }, speed: (s) => { D.speed = s; } };
buildComposer();
})();
