// Agentin tiedosto ihmiselle (proto-agent-file-offer, kierros 1). Synteettinen keskustelu:
// agentti tarjoaa ensin PDF-luonnoksen (myöhemmin poistettu), sitten kolmen tiedoston paketin
// (PNG-kaavio, Excel, PDF) ja lopuksi korjatun kaavion. Sisältö on sama kaikissa suunnissa;
// suunta päättää vain, missä tiedosto näkyy. Kaikki nimet ja luvut ovat keksittyjä.
(() => {
  // ---------- Content ----------
  const REGIONS = ['Etelä', 'Länsi', 'Pohjoinen', 'Itä'];
  const MONTHS = ['Heinä', 'Elo', 'Syys'];
  const SALES = [[412, 388, 401], [286, 301, 322], [244, 297, 428], [198, 205, 219]]; // k€, 2026
  const LAST = [[398, 371, 380], [270, 288, 295], [231, 240, 262], [190, 201, 207]]; // k€, 2025
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const F = {
    draft: { name: 'q3-luonnos.pdf', kind: 'pdf', bytes: 421888, pages: 3, removed: '13.31' },
    png: { name: 'myynti-q3.png', kind: 'png', bytes: 151552, w: 1600, h: 900, chart: 'q3' },
    xlsx: { name: 'myynti-q3.xlsx', kind: 'xlsx', bytes: 38912 },
    pdf: { name: 'q3-raportti.pdf', kind: 'pdf', bytes: 1258291, pages: 8 },
    png2: { name: 'myynti-q3-vertailu.png', kind: 'png', bytes: 165888, w: 1600, h: 900, chart: 'cmp' },
  };
  const OFFERS = {
    draft: { title: 'Q3-raportin luonnos', files: ['draft'], at: '13.06' },
    pack: { title: 'Q3-paketti', files: ['png', 'xlsx', 'pdf'], at: '13.31' },
    cmp: { title: 'Myyntikaavio vertailulla', files: ['png2'], at: '13.36' },
  };
  for (const [k, o] of Object.entries(OFFERS)) for (const f of o.files) { F[f].offer = k; F[f].at = o.at; }

  const ws = UI.ws[0];
  Object.assign(ws, { id: 'kvartaaliraportti', path: '~/work/kvartaaliraportti' });
  ws.convs[0].title = 'Q3-myyntiraportti';
  ws.convs.splice(1, ws.convs.length - 1,
    { id: 'c2', title: 'Budjettipohjan kaavat', st: 'done' },
    { id: 'c3', title: 'Asiakaskyselyn avoimet vastaukset', st: 'done' });
  UI.titles = ['Q3-myyntiraportti']; UI.working = false;

  const offerCmd = (keys, files) => `open-habitat agent file offer --current --title "${OFFERS[keys].title}" ${files.map(f => `--source out/${F[f].name}`).join(' ')}`;
  const offerResult = (keys) => `{"ok":true,"result":{"offer":{"offer_id":"f${keys}7q2m4xk3","files":${OFFERS[keys].files.length},"target":"conversation"}}}`;
  CONVO.splice(0, CONVO.length,
    { kind: 'marker', t: 'settings', time: '13:02', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '13:02', md: 'Tee Q3-raportista ensin luonnos PDF:nä, niin katson rakenteen ennen kuin viimeistelet.' },
    { kind: 'turn', time: '13:06', blocks: [
      { t: 'think', md: '**Reading the Q3 sales export and the report template**' },
      { t: 'tool', name: 'read', target: 'data/myynti-2026-q3.csv', args: { path: 'data/myynti-2026-q3.csv' }, result: 'alue,kuukausi,myynti_eur\nEtelä,2026-07,412300\nEtelä,2026-08,388150\n…' },
      { t: 'tool', name: 'bash', target: 'python3 raportti.py --luonnos', args: { command: 'python3 raportti.py --luonnos --out out/q3-luonnos.pdf' }, result: 'Kirjoitettu out/q3-luonnos.pdf (3 sivua, 412 kt)' },
      { t: 'tool', name: 'bash', target: offerCmd('draft', ['draft']), args: { command: offerCmd('draft', ['draft']) }, result: offerResult('draft') },
      { t: 'reply', md: 'Luonnos on kolmisivuinen: yhteenveto, myynti alueittain ja avoimet kysymykset. Lukuja ei ole vielä tarkistettu kirjanpidon kanssa.\n\n{{OFFER:draft}}' },
    ] },
    { kind: 'offer', key: 'draft' },
    { kind: 'user', time: '13:20', md: 'Rakenne on hyvä. Tee nyt koko paketti: myyntikaavio kuvana, luvut Exceliin ja lopullinen PDF.' },
    { kind: 'turn', time: '13:31', blocks: [
      { t: 'think', md: '**Building the chart, the workbook and the final PDF**' },
      { t: 'tool', name: 'bash', target: 'python3 kaavio.py', args: { command: 'python3 kaavio.py --out out/myynti-q3.png' }, result: 'Kirjoitettu out/myynti-q3.png (1600×900)' },
      { t: 'tool', name: 'bash', target: 'python3 taulukko.py', args: { command: 'python3 taulukko.py --out out/myynti-q3.xlsx' }, result: 'Kirjoitettu out/myynti-q3.xlsx (3 välilehteä)' },
      { t: 'tool', name: 'bash', target: 'python3 raportti.py', args: { command: 'python3 raportti.py --out out/q3-raportti.pdf' }, result: 'Kirjoitettu out/q3-raportti.pdf (8 sivua)' },
      { t: 'tool', name: 'bash', target: offerCmd('pack', ['png', 'xlsx', 'pdf']), args: { command: offerCmd('pack', ['png', 'xlsx', 'pdf']) }, result: offerResult('pack') },
      { t: 'tool', name: 'bash', target: 'open-habitat agent file remove --offer fdraft7q2m4xk3', args: { command: 'open-habitat agent file remove --offer fdraft7q2m4xk3' }, result: '{"ok":true,"result":{"removed":1}}' },
      { t: 'reply', md: `Paketti on valmis. Q3:n myynti oli ${sum(SALES.flat()).toLocaleString('fi-FI')} k€, 6 % enemmän kuin vuotta aiemmin. Pohjoinen ohitti Etelän syyskuussa.\n\n- **Kaavio**: myynti alueittain kuukausittain.\n- **Excel**: yhteenveto, alueet ja tuotteet omilla välilehdillään.\n- **PDF**: kahdeksansivuinen raportti, jossa kaavio on sivulla 2.\n\nPoistin vanhan luonnoksen, ettei sitä ladata vahingossa.\n\n{{OFFER:pack}}` },
    ] },
    { kind: 'offer', key: 'pack' },
    { kind: 'user', time: '13:34', md: 'Lisää kaavioon edellisen vuoden Q3 katkoviivalla vertailuksi.' },
    { kind: 'turn', time: '13:36', blocks: [
      { t: 'tool', name: 'bash', target: 'python3 kaavio.py --vertailu 2025', args: { command: 'python3 kaavio.py --vertailu 2025 --out out/myynti-q3-vertailu.png' }, result: 'Kirjoitettu out/myynti-q3-vertailu.png (1600×900)' },
      { t: 'tool', name: 'bash', target: offerCmd('cmp', ['png2']), args: { command: offerCmd('cmp', ['png2']) }, result: offerResult('cmp') },
      { t: 'reply', md: 'Katkoviiva on vuoden 2025 Q3 kuukausittain. Ero näkyy selvimmin Pohjoisessa syyskuussa.\n\n{{OFFER:cmp}}' },
    ] },
    { kind: 'offer', key: 'cmp' },
  );

  // ---------- Synthetic file bytes: the PNG charts are drawn once, the rest are mock renders ----------
  const PNG = {};
  function chart(kind) {
    if (PNG[kind]) return PNG[kind];
    const c = document.createElement('canvas'); c.width = 1600; c.height = 900;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1600, 900);
    g.fillStyle = '#1d2433'; g.font = '600 44px system-ui, sans-serif';
    g.fillText(kind === 'cmp' ? 'Myynti Q3 2026 alueittain, vertailu 2025 (k€)' : 'Myynti Q3 2026 alueittain (k€)', 80, 96);
    const X0 = 140, Y0 = 760, H = 560, W = 1380, max = 450;
    g.strokeStyle = '#d5dae2'; g.lineWidth = 2; g.font = '28px system-ui, sans-serif'; g.fillStyle = '#5b6474';
    for (let v = 0; v <= max; v += 100) { const y = Y0 - v / max * H; g.beginPath(); g.moveTo(X0, y); g.lineTo(X0 + W, y); g.stroke(); g.fillText(String(v), 70, y + 10); }
    const COLORS = ['#2f6fdf', '#18a383', '#e08a1e', '#8a5cd0'];
    const groupW = W / 4, barW = 76;
    REGIONS.forEach((r, ri) => {
      const gx = X0 + ri * groupW + (groupW - barW * 3 - 24) / 2;
      MONTHS.forEach((m, mi) => {
        const v = SALES[ri][mi], x = gx + mi * (barW + 12), h = v / max * H;
        g.fillStyle = COLORS[ri]; g.globalAlpha = .55 + mi * .2; g.fillRect(x, Y0 - h, barW, h); g.globalAlpha = 1;
        if (kind === 'cmp') { const y = Y0 - LAST[ri][mi] / max * H; g.strokeStyle = '#1d2433'; g.setLineDash([14, 10]); g.lineWidth = 5; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + barW + 6, y); g.stroke(); g.setLineDash([]); }
      });
      g.fillStyle = '#1d2433'; g.font = '600 32px system-ui, sans-serif'; g.fillText(r, gx + 60, Y0 + 52);
      g.fillStyle = '#5b6474'; g.font = '24px system-ui, sans-serif'; g.fillText('heinä · elo · syys', gx + 30, Y0 + 88);
    });
    if (kind === 'cmp') { g.strokeStyle = '#1d2433'; g.setLineDash([14, 10]); g.lineWidth = 5; g.beginPath(); g.moveTo(1290, 150); g.lineTo(1370, 150); g.stroke(); g.setLineDash([]); g.fillStyle = '#1d2433'; g.font = '28px system-ui, sans-serif'; g.fillText('Q3 2025', 1386, 160); }
    return (PNG[kind] = c.toDataURL('image/png'));
  }
  const SHEETS = [
    { name: 'Yhteenveto', head: ['Alue', 'Heinä', 'Elo', 'Syys', 'Q3', 'Q3 2025', 'Muutos'], rows: REGIONS.map((r, i) => [r, ...SALES[i], sum(SALES[i]), sum(LAST[i]), `${((sum(SALES[i]) / sum(LAST[i]) - 1) * 100).toFixed(1).replace('.', ',')} %`]).concat([['Yhteensä', ...[0, 1, 2].map(m => sum(SALES.map(r => r[m]))), sum(SALES.flat()), sum(LAST.flat()), `${((sum(SALES.flat()) / sum(LAST.flat()) - 1) * 100).toFixed(1).replace('.', ',')} %`]]) },
    { name: 'Alueittain', head: ['Alue', 'Kuukausi', 'Myynti €', 'Tilauksia', 'Keskiostos €'], rows: REGIONS.flatMap((r, i) => MONTHS.map((m, j) => [r, `2026-0${7 + j}`, (SALES[i][j] * 1000 + 150 * (i + j)).toLocaleString('fi-FI'), 1180 + 37 * i + 11 * j, (SALES[i][j] * 1000 / (1180 + 37 * i + 11 * j)).toFixed(0)])) },
    { name: 'Tuotteittain', head: ['Tuote', 'Q3 €', 'Osuus'], rows: [['Peruspaketti', '1 412 300', '36 %'], ['Laajennus', '981 040', '25 %'], ['Huoltosopimus', '862 900', '22 %'], ['Koulutus', '412 760', '11 %'], ['Muut', '232 000', '6 %']] },
  ];

  // ---------- Pieces ----------
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON_DOWN = I('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>');
  const ICON_FILE = I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>');
  const ICON_FILES = I('<path d="M15 3H9a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7z"/><path d="M15 3v4h4M4 8v11a2 2 0 0 0 2 2h9"/>');
  const ICON_X = I('<path d="M6 6l12 12M18 6 6 18"/>');
  const ICON_ZIP = I('<path d="M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3"/><path d="M10 3v2m0 2v2m0 2v2"/><rect x="3" y="12" width="6" height="5" rx="1"/>');
  const size = (b) => b < 1024 ? `${b} t` : b < 1048576 ? `${Math.round(b / 1024)} kt` : `${(b / 1048576).toFixed(1).replace('.', ',')} Mt`;
  const TYPE = { png: 'PNG-kuva', xlsx: 'Excel-taulukko', pdf: 'PDF-asiakirja' };
  const detail = (f) => f.kind === 'png' ? `${f.w} × ${f.h}` : f.kind === 'pdf' ? `${f.pages} sivua` : `${SHEETS.length} välilehteä`;
  const badge = (f) => `<span class="fo-type" data-kind="${f.kind}">${f.kind.toUpperCase()}</span>`;
  const total = (o) => size(sum(o.files.map(k => F[k].bytes)));
  const btnRow = (cls, attrs, inner, label) => `<button type="button" class="${cls}" ${attrs}${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</button>`;
  const dl = (k, compact) => btnRow(compact ? 'icon-btn fo-dl' : 'secondary fo-dl', `data-fo-dl="${k}"`, compact ? ICON_DOWN : `${ICON_DOWN}Lataa`, compact ? `Lataa ${F[k].name}` : '');
  const open = (k, text = 'Avaa') => btnRow('secondary fo-open', `data-fo-open="${k}"`, text, '');
  const img = (k) => `<img src="${chart(F[k].chart)}" alt="${esc(F[k].name)}" width="${F[k].w}" height="${F[k].h}">`;
  const removedNote = (o) => `Poistettu klo ${F[o.files[0]].removed}. Tiedosto ei ole enää ladattavissa.`;
  const isRemoved = (o) => o.files.every(k => F[k].removed);

  // ---------- 1 Kortti: an offer card after the reply, like the HTML view offer ----------
  function card(key) {
    const o = OFFERS[key], many = o.files.length > 1, gone = isRemoved(o);
    const imgs = o.files.filter(k => F[k].kind === 'png');
    const first = F[o.files[0]];
    const title = many ? o.title : first.name;
    const meta = gone ? removedNote(o) : many ? `${o.files.length} tiedostoa · ${total(o)} · Vain sinulle` : `${TYPE[first.kind]} · ${detail(first)} · ${size(first.bytes)} · Vain sinulle`;
    const rows = many ? `<ul class="fo-files" aria-label="Tiedostot">${o.files.map(k => `<li class="fo-file">${badge(F[k])}<button type="button" class="fo-fname" data-fo-open="${k}" aria-label="Avaa ${esc(F[k].name)}">${esc(F[k].name)}</button><span class="fo-size">${size(F[k].bytes)}</span>${dl(k, true)}</li>`).join('')}</ul>` : '';
    const shots = gone ? '' : imgs.map(k => `<button type="button" class="fo-shot${many ? ' small' : ''}" data-fo-open="${k}" aria-label="Avaa ${esc(F[k].name)}">${img(k)}</button>`).join('');
    const actions = gone ? '' : many ? `<span class="fo-actions">${btnRow('secondary', `data-fo-zip="${key}"`, `${ICON_ZIP}Lataa kaikki (.zip)`)}</span>` : `<span class="fo-actions">${btnRow('primary fo-dl', `data-fo-dl="${o.files[0]}"`, `${ICON_DOWN}Lataa`)}${open(o.files[0], first.kind === 'png' ? 'Näytä isona' : 'Esikatsele')}</span>`;
    return `<aside class="fo-card ah-in${gone ? ' gone' : ''}" role="note" aria-label="Agentin tarjoama${many ? 't tiedostot' : ' tiedosto'}: ${esc(title)}" data-fo-offer="${key}">
<span class="fo-mark" aria-hidden="true">${ICON_FILE}</span>
<div class="fo-body"><span class="fo-label">${gone ? 'Agentti tarjosi ladattavaksi:' : 'Agentti tarjoaa ladattavaksi:'}</span><strong class="fo-title">${esc(title)}</strong><span class="fo-meta">${meta}</span>${shots}${rows}${actions}</div></aside>`;
  }

  // ---------- 2 Vastauksessa: files belong to the reply ----------
  function inlineFiles(key) {
    const o = OFFERS[key];
    const figs = o.files.filter(k => F[k].kind === 'png' && !F[k].removed).map(k => `<figure class="fo-fig"><button type="button" class="fo-img" data-fo-open="${k}" aria-label="Avaa ${esc(F[k].name)}">${img(k)}</button><figcaption><span class="fo-name">${esc(F[k].name)}</span><span class="fo-size">${size(F[k].bytes)}</span>${dl(k, true)}</figcaption></figure>`).join('');
    const chips = o.files.filter(k => F[k].kind !== 'png' || F[k].removed).map(k => F[k].removed
      ? `<li class="fo-chip gone" title="${esc(removedNote(o))}">${badge(F[k])}<span class="fo-name">${esc(F[k].name)}</span><span class="fo-size">poistettu</span></li>`
      : `<li class="fo-chip"><button type="button" class="fo-chip-open" data-fo-open="${k}" aria-label="Avaa ${esc(F[k].name)}">${badge(F[k])}<span class="fo-name">${esc(F[k].name)}</span><span class="fo-size">${size(F[k].bytes)}</span></button>${dl(k, true)}</li>`).join('');
    return `<div class="fo-inline">${figs}${chips ? `<ul class="fo-chips" aria-label="Agentin tiedostot">${chips}</ul>` : ''}</div>`;
  }

  // ---------- 3 Hylly: a line in the thread, the files in a panel ----------
  const FO = { dir: 'card', shelf: false, sel: 'png2' };
  function shelfLine(key) {
    const o = OFFERS[key], gone = isRemoved(o), n = o.files.length;
    const thumb = o.files.filter(k => F[k].kind === 'png' && !F[k].removed).map(k => `<img class="fo-mini" src="${chart(F[k].chart)}" alt="">`).join('');
    return `<div class="fo-line ah-in${gone ? ' gone' : ''}" role="note">${ICON_FILES}${thumb}<span class="fo-line-text"><strong>${n === 1 ? 'Pi jakoi tiedoston' : `Pi jakoi ${n} tiedostoa`}</strong> <span class="fo-line-names">${o.files.map(k => esc(F[k].name)).join(', ')}</span>${gone ? ' <span class="fo-line-gone">· poistettu</span>' : ''}</span><button type="button" class="quiet-btn" data-fo-shelf="${o.files[0]}">${gone ? 'Tiedot' : 'Näytä'}</button></div>`;
  }
  const panel = document.createElement('aside');
  panel.className = 'fo-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Keskustelun tiedostot');
  document.querySelector('.frame .body').appendChild(panel);
  function paintPanel() {
    panel.hidden = !(FO.dir === 'shelf' && FO.shelf);
    if (panel.hidden) return;
    const s = F[FO.sel];
    const live = Object.entries(OFFERS).filter(([, o]) => !isRemoved(o)).reverse();
    const gone = Object.entries(OFFERS).filter(([, o]) => isRemoved(o));
    const row = (k) => { const f = F[k]; return `<li><button type="button" class="fo-prow${k === FO.sel ? ' sel' : ''}" data-fo-sel="${k}" aria-current="${k === FO.sel}">${f.kind === 'png' && !f.removed ? `<img class="fo-mini" src="${chart(f.chart)}" alt="">` : badge(f)}<span class="fo-name">${esc(f.name)}</span><span class="fo-size">${f.removed ? 'poistettu' : size(f.bytes)}</span></button></li>`; };
    panel.innerHTML = `<div class="fo-phead"><strong>Tiedostot</strong><span class="fo-pcount">${Object.values(F).filter(f => !f.removed).length}</span><button type="button" class="icon-btn" data-fo-close aria-label="Sulje tiedostot" title="Sulje">${ICON_X}</button></div>
<div class="fo-pview">${s.removed ? `<div class="fo-pgone">${badge(s)}<p><strong>${esc(s.name)}</strong></p><p>${removedNote(OFFERS[s.offer])}</p></div>` : `<button type="button" class="fo-pprev" data-fo-open="${FO.sel}" aria-label="Avaa ${esc(s.name)} isona">${previewBody(FO.sel, true)}</button>
<div class="fo-pfacts"><strong class="fo-name">${esc(s.name)}</strong><span>${TYPE[s.kind]} · ${detail(s)} · ${size(s.bytes)}</span><span>Tarjottu klo ${s.at} · Vain sinulle</span></div>
<div class="fo-pactions">${btnRow('primary fo-dl', `data-fo-dl="${FO.sel}"`, `${ICON_DOWN}Lataa`)}${open(FO.sel, 'Avaa isona')}</div>`}</div>
<div class="fo-plist">${live.map(([key, o]) => `<section><h4>klo ${o.at} · ${esc(o.title)}${o.files.length > 1 ? btnRow('quiet-btn fo-pzip', `data-fo-zip="${key}"`, `${ICON_ZIP}.zip`, `Lataa ${o.title} yhtenä zip-tiedostona`) : ''}</h4><ul>${o.files.map(row).join('')}</ul></section>`).join('')}
${gone.length ? `<section class="gone"><h4>Poistetut</h4><ul>${gone.flatMap(([, o]) => o.files).map(row).join('')}</ul></section>` : ''}</div>`;
  }
  APP.painted.push(paintPanel);
  const baseActions = APP.actions;
  APP.actions = (c) => (FO.dir === 'shelf' && c.id === 'c1'
    ? `<button type="button" class="icon-btn tb-btn fo-tb${FO.shelf ? ' on' : ''}" data-fo-toggle aria-expanded="${FO.shelf}" aria-label="Tiedostot, ${Object.values(F).filter(f => !f.removed).length}" title="Keskustelun tiedostot">${ICON_FILES}<span class="fo-count">${Object.values(F).filter(f => !f.removed).length}</span></button>`
    : '') + baseActions(c);

  // ---------- Preview (production AttachmentPreview: image, PDF pages, workbook) ----------
  function previewBody(k, small) {
    const f = F[k];
    if (f.kind === 'png') return img(k);
    if (f.kind === 'xlsx') {
      const sheet = SHEETS[small ? 0 : FO.sheet || 0];
      const cols = sheet.head.length;
      const table = `<div class="fo-sheet"><table aria-label="${esc(sheet.name)}"><thead><tr><th></th>${Array.from({ length: cols }, (_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')}</tr></thead><tbody><tr><th>1</th>${sheet.head.map(h => `<td><strong>${esc(h)}</strong></td>`).join('')}</tr>${sheet.rows.map((r, i) => `<tr><th>${i + 2}</th>${r.map(v => `<td${typeof v === 'number' || /^[\d\s,%-]+$/.test(String(v)) ? ' class="num"' : ''}>${esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      if (small) return table;
      return `<div class="fo-tabs" role="tablist">${SHEETS.map((s, i) => `<button type="button" role="tab" aria-selected="${i === (FO.sheet || 0)}" data-fo-sheet="${i}">${esc(s.name)}</button>`).join('')}</div>${table}`;
    }
    const pages = small ? 1 : Math.min(3, f.pages);
    return `<div class="fo-pages">${Array.from({ length: pages }, (_, p) => `<div class="fo-page"><span class="fo-ph">${p === 0 ? 'Q3 2026 · Myyntiraportti' : p === 1 ? 'Myynti alueittain' : 'Tuotteet'}</span>${p === 1 ? `<img src="${chart('q3')}" alt="">` : ''}${Array.from({ length: p === 1 ? 5 : 11 }, (_, i) => `<span class="fo-pl" style="width:${92 - (i * 17) % 38}%"></span>`).join('')}<span class="fo-pn">${p + 1} / ${f.pages}</span></div>`).join('')}${!small && f.pages > pages ? `<p class="fo-more">Sivut ${pages + 1}–${f.pages} jatkuvat vierittämällä (prototyypissä ${pages} ensimmäistä).</p>` : ''}</div>`;
  }
  const dlg = document.createElement('dialog');
  dlg.className = 'fo-dlg'; dlg.setAttribute('aria-labelledby', 'fo-dlg-title');
  document.querySelector('.frame').appendChild(dlg);
  let opener = null;
  function openPreview(k, from) {
    const f = F[k]; opener = from; FO.dlgKey = k;
    dlg.innerHTML = `<div class="fo-dhead">${badge(f)}<h2 id="fo-dlg-title">${esc(f.name)}</h2><button type="button" class="icon-btn" data-fo-dclose aria-label="Sulje" title="Sulje">${ICON_X}</button></div>
<dl class="fo-dfacts"><dt>Tyyppi</dt><dd>${TYPE[f.kind]}</dd><dt>Koko</dt><dd>${size(f.bytes)} · ${detail(f)}</dd><dt>Tarjottu</dt><dd>klo ${f.at} · Vain sinulle</dd></dl>
<div class="fo-dbody">${previewBody(k)}</div>
<div class="fo-dactions">${btnRow('primary fo-dl', `data-fo-dl="${k}"`, `${ICON_DOWN}Lataa`)}</div>`;
    if (!dlg.open) dlg.showModal();
  }
  dlg.addEventListener('close', () => { opener?.focus?.(); opener = null; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-fo-dclose]')) return dlg.close();
    const t = e.target.closest('[data-fo-sheet]');
    if (t) { FO.sheet = +t.dataset.foSheet; const keep = opener; openPreview(FO.dlgKey, keep); dlg.querySelector(`[data-fo-sheet="${FO.sheet}"]`).focus(); }
  });

  // ---------- Actions ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fo-open], [data-fo-dl], [data-fo-zip], [data-fo-shelf], [data-fo-toggle], [data-fo-close], [data-fo-sel]');
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    const d = t.dataset;
    if (d.foDl) return toast(`Lataus alkoi: ${F[d.foDl].name} · ${size(F[d.foDl].bytes)}`);
    if (d.foZip) { const o = OFFERS[d.foZip]; return toast(`Lataus alkoi: ${o.title.toLowerCase().replace(/\s+/g, '-')}.zip · ${o.files.length} tiedostoa`); }
    if (d.foOpen) { FO.sheet = 0; return openPreview(d.foOpen, t); }
    if (d.foShelf) { FO.shelf = true; FO.sel = d.foShelf; paint(); return panel.querySelector('.fo-prow.sel')?.focus(); }
    if (d.foToggle !== undefined) { FO.shelf = !FO.shelf; paint(); return FO.shelf ? panel.querySelector('.fo-prow.sel')?.focus() : document.querySelector('[data-fo-toggle]')?.focus(); }
    if (d.foClose !== undefined) { FO.shelf = false; paint(); return document.querySelector('[data-fo-toggle]')?.focus(); }
    if (d.foSel) { FO.sel = d.foSel; paint(); return panel.querySelector(`[data-fo-sel="${d.foSel}"]`)?.focus(); }
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && FO.shelf && !dlg.open && FO.dir === 'shelf') { FO.shelf = false; paint(); document.querySelector('[data-fo-toggle]')?.focus(); }
  });

  // ---------- Directions ----------
  const baseMarker = markerR;
  markerR = (m, i) => m.t !== undefined ? baseMarker(m, i) : '';
  function view(dir) {
    FO.dir = dir; if (dir !== 'shelf') FO.shelf = false;
    UI.pop = false; UI.working = false; paint(); run++;
    // Offer entries are notices of their own (kind 'offer'); lanka knows user, marker and turn.
    const offers = CONVO.map((m, i) => m.kind === 'offer' ? i : -1).filter(i => i >= 0);
    offers.forEach(i => { CONVO[i].kind = 'marker'; });
    markerR = (m, i) => m.key ? (dir === 'card' ? card(m.key) : dir === 'shelf' ? shelfLine(m.key) : '') : baseMarker(m, i);
    let html = lanka('fo-dir-' + dir, { meta: 'top', fold: 'head', runs: 'separate' });
    offers.forEach(i => { CONVO[i].kind = 'offer'; });
    html = html.replace(/<p>\{\{OFFER:(\w+)\}\}<\/p>/g, (_, k) => dir === 'inline' ? inlineFiles(k) : '')
      .replace(/(\n|&#10;)*\{\{OFFER:\w+\}\}/g, '');
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; });
    return html;
  }
  window.foCard = () => view('card');
  window.foInline = () => view('inline');
  window.foShelf = () => view('shelf');
  window.__fo = { F, OFFERS, FO };
})();
