// Kansiotarjouksen tiedostot: rivin omat toiminnot (proto-folder-offer-file-rows). Tuotannon
// Näytä tiedostot -paneeli (FileShelf) näyttää yläreunassa valitun tiedoston ison esikatselun;
// Jari ei halua sitä, koska rivien pikkukuvat riittävät. Tämä kierros poistaa yläreunan
// esikatselun ja antaa jokaiselle riville omat toiminnot (esikatselu, lataus). Sisältö on sama
// kaikissa suunnissa: kevätjuhlan aineistokansio (54 tiedostoa, alikansioita kolmessa tasossa,
// kuvia, asiakirjoja ja tiedosto, jota selain ei osaa näyttää) ja aiempi yksittäinen taulukko.
// Suunta päättää, missä ja milloin rivin toiminnot näkyvät.
(() => {
  // ---------- Content ----------
  const MB = 1048576;
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const F = {}, O = {};
  const add = (offer, dir, name, kind, extra = {}) => {
    const path = (dir ? dir + '/' : '') + name, id = `${offer}:${path}`;
    F[id] = { id, offer, dir, name, path, kind, ...extra };
    O[offer].files.push(id);
    return F[id];
  };
  O.budjetti = { key: 'budjetti', at: '10.12', title: 'budjettiluonnos.xlsx', files: [] };
  add('budjetti', '', 'budjettiluonnos.xlsx', 'xlsx', { bytes: 48 * 1024, lines: 41, columns: 6 });
  O.juhla = { key: 'juhla', at: '10.41', title: 'Kevätjuhlan aineisto', root: 'kevatjuhla-2027', files: [] };
  const photo = (dir, names) => names.forEach((n) => { const r = hash(n), wide = r % 5 !== 0; add('juhla', dir, n + '.jpg', 'image', { bytes: (1.8 + (r % 260) / 100) * MB, w: wide ? 4000 : 3000, h: wide ? 3000 : 4000 }); });
  photo('kuvat/juhla/valitut', ['avaus', 'kuoro-lavalla', 'tanssi', 'palkinnot', 'ryhmakuva', 'ilta-pihalla']);
  photo('kuvat/juhla', ['avauspuhe', 'kuoro-1', 'kuoro-2', 'tanssi-1', 'tanssi-2', 'palkinnot', 'yleiso', 'kakku', 'kahvijono', 'lapset-lavalla', 'loppulaulu', 'ryhmakuva', 'ilotulitus-piha', 'kiitos']);
  photo('kuvat/valmistelut', ['poytien-kanto', 'liinat', 'kukkakimput', 'valot-1', 'valot-2', 'aanentoisto', 'nimilaput', 'kakku-tulee', 'tuolirivit', 'ilmapallot-puhallus', 'ovikyltti', 'lava-matto']);
  photo('kuvat', ['sali-valmiina', 'lava-ylhaalta', 'kuoro-harjoitus', 'ovet-auki', 'kahvio', 'ilmapallot', 'aula-kukat', 'piha-iltapaivalla']);
  add('juhla', 'asiakirjat', 'ohjelma.pdf', 'pdf', { bytes: 0.9 * MB, pages: 2 });
  add('juhla', 'asiakirjat', 'kutsu.docx', 'docx', { bytes: 86 * 1024 });
  add('juhla', 'asiakirjat', 'kiitokset-vapaaehtoisille-ja-yhteistyokumppaneille-kevat-2027.docx', 'docx', { bytes: 112 * 1024 });
  add('juhla', 'asiakirjat', 'budjetti.xlsx', 'xlsx', { bytes: 52 * 1024, lines: 44, columns: 6 });
  add('juhla', 'asiakirjat', 'osallistujat.csv', 'csv', { bytes: 9 * 1024, lines: 143, columns: 4 });
  add('juhla', 'asiakirjat', 'puheenvuorot.md', 'markdown', { bytes: 3 * 1024, lines: 38 });
  add('juhla', 'julisteet', 'juliste-a3.png', 'image', { bytes: 6.2 * MB, w: 2480, h: 3508, poster: true });
  add('juhla', 'julisteet', 'somekuva-nelio.png', 'image', { bytes: 1.3 * MB, w: 1080, h: 1080, poster: true });
  add('juhla', 'julisteet', 'logo.svg', 'svg', { bytes: 4 * 1024 });
  add('juhla', 'julisteet', 'juliste-painoon.indd', 'file', { bytes: 38.6 * MB });
  add('juhla', '', 'LUE-MINUT.md', 'markdown', { bytes: 1.4 * 1024, lines: 19 });
  add('juhla', '', 'diaesitys.pptx', 'pptx', { bytes: 14.8 * MB });
  add('juhla', '', 'tervehdys-rehtorilta.mp4', 'video', { bytes: 46.2 * MB });
  add('juhla', '', 'tekijanoikeudet.txt', 'text', { bytes: 640, lines: 8 });
  const ORDER = ['budjetti', 'juhla'];
  const total = ORDER.reduce((n, k) => n + O[k].files.length, 0);

  // Production's kinds (FileOffer.tsx): what the file is and what its preview button says.
  const KIND = {
    image: { type: (e) => `${e}-kuva`, action: 'Näytä isona' },
    svg: { type: () => 'SVG-kuva', action: 'Näytä isona' },
    video: { type: (e) => `Video (${e})`, action: 'Toista' },
    markdown: { type: () => 'Markdown', action: 'Lue' },
    pdf: { type: () => 'PDF-asiakirja', action: 'Esikatsele' },
    docx: { type: () => 'Word-asiakirja', action: 'Esikatsele' },
    pptx: { type: () => 'PowerPoint-esitys', action: 'Selaa dioja' },
    xlsx: { type: () => 'Excel-taulukko', action: 'Näytä taulukko' },
    csv: { type: (e) => `${e}-taulukko`, action: 'Näytä taulukko' },
    text: { type: (e) => `Teksti (${e})`, action: 'Lue' },
    file: { type: () => 'Tuntematon tyyppi' },
  };
  const ext = (f) => (/\.([^./]{1,12})$/.exec(f.name) || [])[1] || '';
  const isImg = (f) => f.kind === 'image' || f.kind === 'svg';
  const nf = (n) => n.toLocaleString('fi-FI');
  const size = (b) => b < 1024 ? `${Math.round(b)} t` : b < MB ? `${Math.round(b / 1024)} kt` : `${(b / MB).toLocaleString('fi-FI', { maximumFractionDigits: 1 })} Mt`;
  const facts = (f) => {
    const out = [KIND[f.kind].type(ext(f).toUpperCase())];
    if (f.kind === 'file') out.push(`.${ext(f)}`);
    if (f.w) out.push(`${nf(f.w)} × ${nf(f.h)}`);
    if (f.kind === 'csv') out.push(`${nf(f.lines - 1)} riviä`, `${f.columns} saraketta`);
    else if (f.lines) out.push(`${nf(f.lines)} riviä`);
    out.push(size(f.bytes));
    return out;
  };
  const folderPath = (f) => [O[f.offer].root, f.dir].filter(Boolean).join('/');
  const oBytes = (o) => o.files.reduce((n, id) => n + F[id].bytes, 0);

  const ws = UI.ws[0];
  Object.assign(ws, { id: 'koulun-juhlat', path: '~/work/koulun-juhlat' });
  ws.convs[0].title = 'Kevätjuhlan kuvat ja aineisto';
  ws.convs.splice(1, ws.convs.length - 1,
    { id: 'c2', title: 'Syysjuhlan kutsu', st: 'done' },
    { id: 'c3', title: 'Vanhempainillan diat', st: 'done' });
  UI.titles = ['Kevätjuhlan kuvat ja aineisto']; UI.working = false;

  const run1 = (cmd, out) => ({ t: 'tool', name: 'bash', target: cmd, args: { command: cmd }, result: out });
  const offerTool = (k, src, title) => run1(`open-habitat agent file offer --current --source ${src}${title ? ` --title "${title}"` : ''}`, `{"ok":true,"result":{"offer":{"offer_id":"f${k}3k7w","files":${O[k].files.length},"target":"conversation"}}}`);
  CONVO.splice(0, CONVO.length,
    { kind: 'marker', t: 'settings', time: '10:05', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '10:05', md: 'Tee kevätjuhlan budjetista luonnos taulukkona.' },
    { kind: 'turn', time: '10:12', blocks: [
      run1('python3 budjetti.py --out out/budjettiluonnos.xlsx', 'Kirjoitettu out/budjettiluonnos.xlsx (40 riviä)'),
      offerTool('budjetti', 'out/budjettiluonnos.xlsx'),
      { t: 'reply', md: 'Luonnoksessa on menot ja tulot ryhmittäin sekä varaus odottamattomiin kuluihin.' },
    ] },
    { kind: 'offer', key: 'budjetti' },
    { kind: 'user', time: '10:30', md: 'Kokoa juhlan kaikki aineisto yhteen kansioon: valokuvat (valmistelut, juhla ja valitut parhaat), asiakirjat, julisteet ja rehtorin videotervehdys. Pidä kansiorakenne.' },
    { kind: 'turn', time: '10:41', blocks: [
      { t: 'think', md: '**Collecting the spring party material into one folder**' },
      run1('python3 kokoa.py --kuvat kuvat/ --asiakirjat docs/ --out out/kevatjuhla-2027', 'Kirjoitettu 54 tiedostoa, 6 kansiota'),
      offerTool('juhla', 'out/kevatjuhla-2027', 'Kevätjuhlan aineisto'),
      { t: 'reply', md: 'Kansiossa on kuvat kolmessa alikansiossa, asiakirjat, julisteet ja videotervehdys. Painoon menevä juliste on InDesign-tiedostona, jonka voit avata vain omalla koneellasi.' },
    ] },
    { kind: 'offer', key: 'juhla' },
  );

  // ---------- Synthetic pictures ----------
  const CACHE = new Map();
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL('image/jpeg', 0.84); };
  function scene(g, w, h, name) {
    const r = hash(name), rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(r % 2147483646 + 1);
    const out = /piha|ilta|ovet/.test(name), night = /ilotulitus|ilta|valot/.test(name);
    const wall = g.createLinearGradient(0, 0, 0, h * 0.7);
    if (night) { wall.addColorStop(0, '#141a33'); wall.addColorStop(1, out ? '#3a3260' : '#2b2a3a'); }
    else if (out) { wall.addColorStop(0, `hsl(${200 + r % 16} 60% 58%)`); wall.addColorStop(1, '#d9ecf4'); }
    else { const hue = 28 + (r % 24); wall.addColorStop(0, `hsl(${hue} 42% ${70 + r % 8}%)`); wall.addColorStop(1, `hsl(${hue} 35% 84%)`); }
    g.fillStyle = wall; g.fillRect(0, 0, w, h);
    const floor = h * (0.64 + rnd() * 0.06);
    g.fillStyle = out ? (night ? '#1f2e22' : '#6f9f4c') : `hsl(${24 + r % 10} 38% ${night ? 22 : 46}%)`; g.fillRect(0, floor, w, h - floor);
    if (/lava|kuoro|tanssi|avaus|palkinnot|loppulaulu|lapset/.test(name)) { g.fillStyle = night ? '#4a2333' : '#8c2f3c'; g.fillRect(w * 0.12, h * 0.12, w * 0.76, floor - h * 0.2); g.fillStyle = '#5b3a24'; g.fillRect(w * 0.08, floor - h * 0.1, w * 0.84, h * 0.1); }
    if (/valot|ilotulitus|ilta/.test(name)) for (let i = 0; i < 6; i++) { const x = w * rnd(), y = h * rnd() * 0.45; const gr = g.createRadialGradient(x, y, 0, x, y, h * 0.18); gr.addColorStop(0, ['#ffd86b', '#ff7aa8', '#7fd3ff'][i % 3]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    if (/ilmapallo|sali|aula/.test(name)) for (let i = 0; i < 9; i++) { g.fillStyle = ['#e4572e', '#f3c13a', '#3a7fd5', '#2fa36b', '#c34fa0'][i % 5]; g.beginPath(); g.ellipse(w * rnd(), h * (0.1 + rnd() * 0.35), h * 0.045, h * 0.055, 0, 0, 7); g.fill(); }
    if (/poyt|liinat|kahvi|kakku|nimilaput/.test(name)) for (let i = 0; i < 3; i++) { const x = w * (0.08 + i * 0.32); g.fillStyle = '#f6f3ea'; g.fillRect(x, floor - h * 0.08, w * 0.26, h * 0.06); g.fillStyle = '#7a5b3e'; g.fillRect(x + w * 0.02, floor - h * 0.02, w * 0.02, h * 0.12); g.fillRect(x + w * 0.22, floor - h * 0.02, w * 0.02, h * 0.12); if (/kakku/.test(name) && i === 1) { g.fillStyle = '#f2d3e0'; g.fillRect(x + w * 0.06, floor - h * 0.17, w * 0.14, h * 0.09); g.fillStyle = '#e4572e'; g.fillRect(x + w * 0.12, floor - h * 0.22, w * 0.01, h * 0.05); } }
    if (/kukka/.test(name)) for (let i = 0; i < 14; i++) { g.fillStyle = ['#f4a9c0', '#fff1a8', '#c9a7f2', '#ffffff'][i % 4]; g.beginPath(); g.arc(w * (0.3 + rnd() * 0.4), h * (0.35 + rnd() * 0.2), h * 0.03, 0, 7); g.fill(); }
    if (/tuoli/.test(name)) for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { g.fillStyle = '#3b4250'; g.fillRect(w * (0.06 + i * 0.1), floor + h * (0.04 + row * 0.09), w * 0.06, h * 0.05); }
    const crowd = /kuoro|yleiso|ryhma|tanssi|lapset|loppulaulu|kahvijono|avaus|palkinnot|kiitos|harjoitus/.test(name);
    if (crowd) { const n = /yleiso|ryhma|kuoro|loppulaulu/.test(name) ? 11 : 5; for (let i = 0; i < n; i++) { const x = w * ((i + 0.5) / n) + (rnd() - 0.5) * w * 0.03, y = floor - h * (0.02 + (i % 2) * 0.05); g.fillStyle = ['#2f3a56', '#7a3b2e', '#365f4a', '#5a4b7a', '#8a6a2a'][i % 5]; g.beginPath(); g.roundRect(x - w * 0.03, y - h * 0.16, w * 0.06, h * 0.2, w * 0.02); g.fill(); g.fillStyle = ['#f1c7a6', '#c99572', '#8d5a3b', '#e8b996'][i % 4]; g.beginPath(); g.arc(x, y - h * 0.2, h * 0.04, 0, 7); g.fill(); } }
    if (/aanentoisto/.test(name)) { g.fillStyle = '#20232a'; g.fillRect(w * 0.15, floor - h * 0.34, w * 0.12, h * 0.34); g.fillRect(w * 0.73, floor - h * 0.34, w * 0.12, h * 0.34); }
    if (/ovikyltti/.test(name)) { g.fillStyle = '#fff'; g.fillRect(w * 0.3, h * 0.25, w * 0.4, h * 0.22); g.fillStyle = '#1e4fb0'; g.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText('Kevätjuhla →', w * 0.5, h * 0.39); }
  }
  function picture(f, w) {
    const k = `${f.id}:${w}`;
    if (CACHE.has(k)) return CACHE.get(k);
    let url;
    if (f.kind === 'svg') url = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120" fill="#fff"/><circle cx="58" cy="60" r="34" fill="#f3c13a"/><path d="M58 30v60M28 60h60" stroke="#e4572e" stroke-width="8" stroke-linecap="round"/><text x="104" y="70" font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="#1e4fb0">Kevät</text></svg>');
    else if (f.poster) { const H = Math.round(w * f.h / f.w); url = canvas(w, H, (g, W, Hh) => { scene(g, W, Hh, 'sali-ilmapallot'); g.fillStyle = 'rgba(20,30,80,.55)'; g.fillRect(0, Hh * 0.55, W, Hh * 0.3); g.fillStyle = '#fff'; const fs = Math.min(W, Hh) * 0.13; g.font = `700 ${fs}px system-ui, sans-serif`; g.fillText('Kevätjuhla', W * 0.07, Hh * 0.55 + fs * 1.2); g.font = `${fs * 0.45}px system-ui, sans-serif`; g.fillText('la 29.5.2027 klo 12', W * 0.07, Hh * 0.55 + fs * 1.9); }); }
    else url = canvas(w, Math.round(w * f.h / f.w), (g, W, H) => scene(g, W, H, f.name));
    CACHE.set(k, url); return url;
  }

  // ---------- Pieces ----------
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    down: I('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'),
    eye: I('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    files: I('<path d="M9 3h6l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v4h4M5 7v12a2 2 0 0 0 2 2h8"/>'),
    folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    zip: I('<path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8"/><path d="M1.5 4.5h21v3.5h-21zM10 12h4"/>'),
    search: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    table: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>'),
    chev: I('<path d="m9 6 6 6-6 6"/>'),
    play: I('<path d="M8 5.5v13l10.5-6.5z"/>'),
  };
  const btn = (cls, attrs, inner, label) => `<button type="button" class="${cls}" ${attrs}${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</button>`;
  const thumb = (f, cls = 'fr-thumb') => isImg(f)
    ? `<img class="${cls}${f.kind === 'svg' ? ' logo' : ''}" src="${picture(f, f.poster ? 120 : 160)}" alt="">`
    : `<span class="${cls} fr-ext" data-kind="${f.kind}">${esc(ext(f).toUpperCase().slice(0, 4) || '?')}</span>`;
  const previewBtn = (f, cls = 'icon-btn fr-act') => KIND[f.kind].action ? btn(cls, `data-fr-preview="${esc(f.id)}"`, ICON.eye, `${KIND[f.kind].action}: ${f.name}`) : `<span class="fr-act-none" aria-hidden="true"></span>`;
  const dlBtn = (f, cls = 'icon-btn fr-act') => btn(cls, `data-fr-dl="${esc(f.id)}"`, ICON.down, `Lataa: ${f.name}`);
  const pathLine = (f, q) => q && f.dir ? `<span class="fr-path">${esc(f.dir)}/</span>` : '';

  // ---------- The conversation's card (production FileOfferCard, unchanged by this round) ----------
  function card(o) {
    const many = o.files.length > 1;
    if (!many) {
      const f = F[o.files[0]];
      return `<aside class="fr-card ah-in" role="note" aria-label="Agentin tarjoama tiedosto: ${esc(o.title)}" data-fr-offer="${o.key}">
<span class="fr-mark" data-kind="data" aria-hidden="true">${ICON.table}</span>
<div class="fr-cbody"><span class="fr-label">Agentti tarjoaa ladattavaksi:</span><strong class="fr-title">${esc(o.title)}</strong>
<span class="fr-meta">${[...facts(f), 'Vain sinulle'].join(' · ')}</span>
<span class="fr-cactions">${btn('primary', `data-fr-dl="${esc(f.id)}"`, `${ICON.down}Lataa`)}${btn('secondary', `data-fr-preview="${esc(f.id)}"`, KIND[f.kind].action)}</span></div></aside>`;
    }
    const imgs = o.files.filter((id) => isImg(F[id]));
    const tops = new Map(); o.files.forEach((id) => { const t = F[id].dir.split('/')[0]; if (t) tops.set(t, (tops.get(t) || 0) + 1); });
    return `<aside class="fr-card ah-in" role="note" aria-label="Agentin tarjoama tiedosto: ${esc(o.title)}" data-fr-offer="${o.key}">
<span class="fr-mark" aria-hidden="true">${ICON.folder}</span>
<div class="fr-cbody"><span class="fr-label">Agentti tarjoaa ladattavaksi kansion:</span><strong class="fr-title">${esc(o.title)}<span class="fr-croot"> ${esc(o.root)}/</span></strong>
<span class="fr-meta">${o.files.length} tiedostoa · ${tops.size} kansiota · ${size(oBytes(o))} · Vain sinulle</span>
<span class="fr-strip">${imgs.slice(0, 8).map((id) => btn('fr-stripimg', `data-fr-preview="${esc(id)}"`, `<img src="${picture(F[id], 160)}" alt="">`, `Näytä isona: ${F[id].path}`)).join('')}${imgs.length > 8 ? `<span class="fr-more">+${imgs.length - 8}</span>` : ''}</span>
<span class="fr-chips">${[...tops].map(([n, c]) => `<span>${ICON.folder}${esc(n)} <span class="fr-n">${c}</span></span>`).join('')}</span>
<span class="fr-cactions">${btn('primary', `data-fr-zip="${o.key}"`, `${ICON.down}Lataa kaikki (.zip)`)}${btn('secondary', `data-fr-shelf="${o.key}"`, `${ICON.file}Näytä tiedostot`)}</span></div></aside>`;
  }

  // ---------- The rows: the one thing the directions decide ----------
  let VIEW = 'hover';
  const SH = { open: false, q: '', dirs: {}, exp: null };
  const ROW = {
    // 1 Leijuva: the row opens the preview; its own buttons appear on hover and focus.
    hover: (f, q) => `<li class="fr-row fr-h" data-fr-id="${esc(f.id)}">
${btn('fr-main', `data-fr-preview="${esc(f.id)}" title="${esc(KIND[f.kind].action || 'Näytä tiedot')}"`, `${thumb(f)}<span class="fr-text"><span class="fr-name">${esc(f.name)}</span>${pathLine(f, q)}<span class="fr-sub">${size(f.bytes)}</span></span>`)}
<span class="fr-size">${size(f.bytes)}</span><span class="fr-acts">${previewBtn(f)}${dlBtn(f)}</span></li>`,
    // 2 Näkyvä: facts and both buttons on every row, always.
    shown: (f, q) => `<li class="fr-row fr-s" data-fr-id="${esc(f.id)}">${thumb(f)}
<span class="fr-text"><span class="fr-name">${esc(f.name)}</span>${pathLine(f, q)}<span class="fr-sub">${facts(f).join(' · ')}</span></span>
<span class="fr-acts">${previewBtn(f)}${dlBtn(f)}</span></li>`,
    // 3 Avautuva: the row unfolds into its facts and named buttons.
    open: (f, q) => { const on = SH.exp === f.id; return `<li class="fr-row fr-o${on ? ' on' : ''}" data-fr-id="${esc(f.id)}">
${btn('fr-main', `data-fr-exp="${esc(f.id)}" aria-expanded="${on}"`, `${thumb(f)}<span class="fr-text"><span class="fr-name">${esc(f.name)}</span>${pathLine(f, q)}</span><span class="fr-size">${size(f.bytes)}</span><span class="fr-chev">${ICON.chev}</span>`)}
${on ? `<div class="fr-more"><span class="fr-sub">${facts(f).join(' · ')}</span><span class="fr-sub">${esc(folderPath(f))}/ · klo ${O[f.offer].at} · Vain sinulle</span>${f.kind === 'file' ? `<span class="fr-sub">Selain ei osaa näyttää .${esc(ext(f))}-tiedostoa. Lataa se ja avaa omalla ohjelmallasi.</span>` : ''}
<span class="fr-mactions">${btn('primary fr-small', `data-fr-dl="${esc(f.id)}"`, `${ICON.down}Lataa`)}${KIND[f.kind].action ? btn('secondary fr-small', `data-fr-preview="${esc(f.id)}"`, `${ICON.eye}${KIND[f.kind].action}`) : ''}</span></div>` : ''}</li>`; },
  };

  // ---------- The panel (FileShelf without the selected file's preview) ----------
  const panel = document.createElement('aside');
  panel.className = 'fr-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Keskustelun tiedostot');
  panel.innerHTML = `<div class="fr-phead"><h2 tabindex="-1">Tiedostot <span class="fr-n">${total}</span></h2>${btn('icon-btn', 'data-fr-close', ICON.x, 'Sulje tiedostot')}</div>
<div class="fr-pscroll"><label class="fr-search">${ICON.search}<input type="search" data-fr-q placeholder="Etsi kaikista tarjouksista" aria-label="Etsi kaikista tarjouksista"></label><div class="fr-plist"></div></div>`;
  document.querySelector('.frame .body').appendChild(panel);
  const list = panel.querySelector('.fr-plist');

  function tree(o) {
    const root = { dirs: new Map(), files: [] };
    for (const id of o.files) {
      let node = root, at = '';
      for (const part of F[id].dir ? F[id].dir.split('/') : []) {
        at = at ? `${at}/${part}` : part;
        if (!node.dirs.has(part)) node.dirs.set(part, { path: at, dirs: new Map(), files: [] });
        node = node.dirs.get(part);
      }
      node.files.push(id);
    }
    return root;
  }
  const count = (node) => node.files.length + [...node.dirs.values()].reduce((n, d) => n + count(d), 0);
  function branch(o, node, depth) {
    const dirs = [...node.dirs.entries()].map(([name, d]) => {
      const key = `${o.key}:${d.path}`, open = SH.dirs[key] ?? depth === 0;
      return `<li class="fr-dir"><details data-fr-dir="${esc(key)}"${open ? ' open' : ''}><summary><span class="fr-dchev">${ICON.chev}</span>${ICON.folder}<span class="fr-dname">${esc(name)}/</span><span class="fr-n">${count(d)}</span></summary>${branch(o, d, depth + 1)}</details></li>`;
    }).join('');
    return `<ul>${dirs}${node.files.map((id) => ROW[VIEW](F[id])).join('')}</ul>`;
  }
  function section(k) {
    const o = O[k], q = SH.q.trim().toLocaleLowerCase('fi-FI');
    const hits = q ? o.files.filter((id) => F[id].path.toLocaleLowerCase('fi-FI').includes(q)) : null;
    if (hits && !hits.length) return '';
    const head = `<h3><span>klo ${o.at} · ${esc(o.title)} <span class="fr-n">${o.files.length}</span></span>${o.files.length > 1 ? btn('quiet-btn fr-zip', `data-fr-zip="${k}"`, `${ICON.zip}.zip`, `Lataa kaikki zipinä: ${o.title}`) : ''}</h3>`;
    return `<section class="fr-sec" data-fr-sec="${k}" aria-label="klo ${o.at} · ${esc(o.title)}">${head}${hits ? `<ul>${hits.map((id) => ROW[VIEW](F[id], true)).join('')}</ul>` : branch(o, tree(o), 0)}</section>`;
  }
  function paintPanel() {
    panel.hidden = !SH.open;
    panel.dataset.view = VIEW;
    if (panel.hidden) return;
    const html = [...ORDER].reverse().map(section).join('');
    list.innerHTML = html || `<p class="fr-hint" role="status">Ei osumia: ”${esc(SH.q)}”</p>`;
  }
  APP.painted.push(paintPanel);
  panel.addEventListener('toggle', (e) => { const d = e.target.closest?.('[data-fr-dir]'); if (d) SH.dirs[d.dataset.frDir] = d.open; }, true);

  const baseActions = APP.actions;
  APP.actions = (c) => c.id !== 'c1' ? baseActions(c) : btn(`icon-btn tb-btn fr-tb${SH.open ? ' on' : ''}`, `data-fr-toggle aria-expanded="${SH.open}" aria-label="Tiedostot, ${total}" title="Keskustelun tiedostot"`, `${ICON.files}<span class="fr-tbn">${total}</span>`) + baseActions(c);

  // ---------- Preview dialog (AttachmentPreview fed from the offer) ----------
  const LUE = `# Kevätjuhla 2027 · aineisto

- **kuvat/**: yleiskuvat, *valmistelut/* ja *juhla/*; parhaat ovat kansiossa *juhla/valitut/*
- **asiakirjat/**: ohjelma, kutsu, budjetti, osallistujat ja puheenvuorot
- **julisteet/**: A3-juliste verkkoon, somekuva, logo ja painoon menevä InDesign-tiedosto
- **tervehdys-rehtorilta.mp4**: kahden minuutin videotervehdys

Kuvissa näkyy oppilaita. Julkaise vain kuvia kansiosta *valitut/*, joihin on lupa.`;
  const PUHE = `# Puheenvuorot\n\n1. **Avaus** · rehtori, 5 min\n2. **Kuoro** · kolme kappaletta\n3. **Stipendit** · vanhempainyhdistys\n4. **Kiitokset** · juhlatoimikunta`;
  const TXT = 'Valokuvat: Aino Lehtinen ja Juho Salonen\nJuliste ja logo: juhlatoimikunta\n\nKuvia saa käyttää koulun omassa viestinnässä.\nJulkaise vain kansion valitut/ kuvia.';
  const table = (rows) => `<table class="fr-table"><tbody>${rows.map((r, i) => `<tr>${r.map((c) => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>`;
  function body(f) {
    if (isImg(f)) return `<div class="fr-dimg${f.kind === 'svg' ? ' logo' : ''}"><img src="${picture(f, f.poster ? 700 : 1200)}" alt="${esc(f.name)}"></div>`;
    if (f.kind === 'markdown') return `<div class="fr-md prose">${md(f.name === 'LUE-MINUT.md' ? LUE : PUHE)}</div>`;
    if (f.kind === 'text') return `<pre class="fr-txt">${esc(TXT)}</pre>`;
    if (f.kind === 'xlsx') return table([['Ryhmä', 'Erä', 'Arvio €'], ['Tarjoilu', 'Kakku ja kahvi', '420'], ['Tarjoilu', 'Mehut', '85'], ['Koristelu', 'Ilmapallot ja liinat', '140'], ['Tekniikka', 'Äänentoiston vuokra', '260'], ['Palkinnot', 'Stipendit', '600'], ['Varaus', 'Odottamattomat', '150']]);
    if (f.kind === 'csv') return table([['Nimi', 'Luokka', 'Huoltajia', 'Erityisruokavalio'], ['Aada K.', '3B', '2', 'Gluteeniton'], ['Eetu L.', '5A', '1', ''], ['Iida M.', '1C', '2', 'Laktoositon'], ['Onni P.', '6B', '2', '']]);
    if (f.kind === 'video') return `<div class="fr-video"><img src="${picture({ id: 'video', name: 'avauspuhe-lava', w: 1600, h: 900 }, 960)}" alt=""><span class="fr-play">${ICON.play}</span><span class="fr-vtime">0:00 / 2:14</span></div>`;
    if (f.kind === 'pptx') return `<div class="fr-slides">${['Kevätjuhla 2027', 'Ohjelma', 'Kiitos!'].map((t, i) => `<div class="fr-slide"><strong>${t}</strong><span>${i + 1} / 3</span></div>`).join('')}</div>`;
    if (f.kind === 'pdf' || f.kind === 'docx') return `<div class="fr-pages">${Array.from({ length: f.pages || 1 }, (_, p) => `<div class="fr-page"><span class="fr-ph">${f.kind === 'pdf' ? (p ? 'Kahvitarjoilu ja kuvaus' : 'Kevätjuhlan ohjelma') : f.name.startsWith('kutsu') ? 'Tervetuloa kevätjuhlaan' : 'Kiitos, vapaaehtoiset ja yhteistyökumppanit'}</span>${Array.from({ length: 11 }, (_, i) => `<span class="fr-pl" style="width:${94 - (i * 17) % 40}%"></span>`).join('')}</div>`).join('')}</div>`;
    return `<p class="fr-none">Selain ei osaa näyttää .${esc(ext(f))}-tiedostoa. Lataa se ja avaa omalla ohjelmallasi.</p>`;
  }
  const dlg = document.createElement('dialog');
  dlg.className = 'fr-dlg'; dlg.setAttribute('aria-labelledby', 'fr-dlg-title');
  document.querySelector('.frame').appendChild(dlg);
  let opener = null;
  function openPreview(id, from) {
    const f = F[id]; opener = from;
    dlg.dataset.kind = f.kind;
    dlg.innerHTML = `<div class="fr-dhead">${thumb(f, 'fr-dmark')}<h2 id="fr-dlg-title">${esc(f.name)}</h2>${btn('icon-btn', 'data-fr-dclose', ICON.x, 'Sulje')}</div>
<p class="fr-dfacts">${esc(folderPath(f) ? folderPath(f) + '/' : '')}${folderPath(f) ? ' · ' : ''}${facts(f).join(' · ')} · Vain sinulle</p>
<div class="fr-dbody">${body(f)}</div>
<div class="fr-dactions">${btn('primary', `data-fr-dl="${esc(id)}"`, `${ICON.down}Lataa`)}</div>`;
    if (!dlg.open) dlg.showModal();
  }
  dlg.addEventListener('close', () => { dlg.innerHTML = ''; if (opener?.isConnected) opener.focus(); opener = null; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-fr-dclose]')) dlg.close(); });

  // ---------- Actions ----------
  function openShelf(key, focus) {
    SH.open = true; SH.exp = null; paint();
    const sec = key && panel.querySelector(`[data-fr-sec="${key}"]`);
    panel.querySelector('.fr-pscroll').scrollTop = 0;
    // The newest offer sits under the search; an older one is scrolled to.
    if (sec && sec !== panel.querySelector('.fr-sec')) sec.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (focus) panel.querySelector('.fr-phead h2').focus();
  }
  function closeShelf() { SH.open = false; paint(); document.querySelector('[data-fr-toggle]')?.focus(); }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fr-preview], [data-fr-dl], [data-fr-zip], [data-fr-shelf], [data-fr-toggle], [data-fr-close], [data-fr-exp]');
    if (!t || (t.closest('.fr-dlg') && !t.matches('[data-fr-dl]'))) return;
    e.preventDefault(); e.stopPropagation();
    const d = t.dataset;
    if (d.frDl) return toast(`Lataus alkoi: ${F[d.frDl].name} · ${size(F[d.frDl].bytes)}`);
    if (d.frZip) { const o = O[d.frZip]; return toast(`Lataus alkoi: ${o.root}.zip · ${o.files.length} tiedostoa · ${size(oBytes(o))}`); }
    if (d.frPreview) return openPreview(d.frPreview, t);
    if (d.frShelf) return openShelf(d.frShelf, true);
    if (d.frToggle !== undefined) return SH.open ? closeShelf() : openShelf(null, true);
    if (d.frClose !== undefined) return closeShelf();
    if (d.frExp) { SH.exp = SH.exp === d.frExp ? null : d.frExp; paintPanel(); return panel.querySelector(`[data-fr-exp="${CSS.escape(d.frExp)}"]`)?.focus(); }
  }, true);
  panel.addEventListener('input', (e) => { if (e.target.matches('[data-fr-q]')) { SH.q = e.target.value; SH.exp = null; paintPanel(); } });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.open && !(e.target.matches('[data-fr-q]') && e.target.value)) { e.preventDefault(); closeShelf(); } });

  // ---------- Directions ----------
  const baseMarker = markerR;
  function view(dir) {
    VIEW = dir; SH.q = ''; SH.dirs = {}; SH.exp = null; panel.querySelector('[data-fr-q]').value = '';
    if (dlg.open) dlg.close();
    UI.pop = false; UI.working = false; run++;
    const at = CONVO.map((m, i) => m.kind === 'offer' ? i : -1).filter((i) => i >= 0);
    at.forEach((i) => { CONVO[i].kind = 'marker'; });
    markerR = (m, i) => m.key ? card(O[m.key]) : baseMarker(m, i);
    const html = lanka('fr-dir-' + dir, { meta: 'top', fold: 'head', runs: 'separate' });
    at.forEach((i) => { CONVO[i].kind = 'offer'; });
    // The round starts where Jari is: Näytä tiedostot pressed on the folder card.
    SH.open = true; paint(); panel.querySelector('.fr-pscroll').scrollTop = 0;
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; });
    return html;
  }
  window.frHover = () => view('hover');
  window.frShown = () => view('shown');
  window.frOpen = () => view('open');
  window.__fr = { F, O, SH, openShelf, closeShelf };
})();
