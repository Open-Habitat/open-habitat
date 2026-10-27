// Agentin tiedosto ihmiselle, kierros 3: monta tiedostoa (proto-file-offer-many). Kortti on
// valittu (kierros 1) ja yksittäisen tiedoston oletus on Kurkistus (kierros 2). Tämä kierros
// riffaa, miten kortti kantaa kymmeniä tiedostoja, kansiorakenteen ja saman keskustelun useat
// tarjoukset, ja miten tiedosto löytyy myöhemmin. Sisältö on sama kaikissa suunnissa: juliste,
// 32 tiedoston kumppanipaketti kansioittain, 12 somekuvaa ja korjattu paketti, joka korvaa
// ensimmäisen. Suunta päättää, mikä jäsentää paljon tiedostoja: tyyppi, kansio vai hylly.
(() => {
  // ---------- Content ----------
  const MB = 1048576;
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const STAGES = [
    ['etappi-1-turku-nauvo', ['lahto-aurajoki', 'pargas-lautta', 'nauvo-satama', 'nauvo-kirkko', 'saariston-rengastie', 'huoltopiste-1'], 54],
    ['etappi-2-nauvo-korppoo', ['retais-lautta', 'korppoo-kirkko', 'kallioranta', 'lammaslaidun', 'huoltopiste-2'], 38],
    ['etappi-3-korppoo-houtskari', ['galtby-laituri', 'houtskari-silta', 'pyorailijat-auringonlasku', 'kalastajakyla', 'huoltopiste-3'], 41],
    ['etappi-4-houtskari-turku', ['inio-lautta', 'askainen-pellot', 'louhisaari', 'maali-kauppatori', 'huoltopiste-4'], 67],
  ];
  const F = {}, O = {};
  const add = (offer, dir, name, kind, extra = {}) => {
    const id = `${offer}:${dir ? dir + '/' : ''}${name}`;
    F[id] = { id, offer, dir, name, path: (dir ? dir + '/' : '') + name, kind, ...extra };
    O[offer].files.push(id);
    return F[id];
  };
  O.juliste = { key: 'juliste', at: '13.06', title: 'juliste-a2.png', files: [] };
  add('juliste', '', 'juliste-a2.png', 'poster', { bytes: 8.4 * MB, w: 3000, h: 4500 });
  function pakettiFiles(key, v2) {
    for (const [dir, photos, km] of STAGES) {
      for (const p of photos) {
        const changed = v2 && (p === 'kallioranta' || p === 'pyorailijat-auringonlasku');
        add(key, dir, p + '.jpg', 'jpg', { bytes: (2.6 + (hash(p) % 300) / 100) * MB * (changed && p === 'kallioranta' ? 0.82 : 1), w: changed && p === 'kallioranta' ? 3200 : 4000, h: changed && p === 'kallioranta' ? 2400 : 3000, ver: changed ? 1 : 0, state: changed ? 'changed' : undefined });
      }
      add(key, dir, `reitti-${dir[7]}.gpx`, 'gpx', { bytes: (160 + km * 2.2) * 1024, km });
    }
    add(key, 'logot', 'logo.svg', 'svg', { bytes: 3277, logo: 'blue' });
    add(key, 'logot', 'logo-valkoinen.svg', 'svg', { bytes: 3311, logo: 'white' });
    add(key, 'logot', 'logo-1200.png', 'png', { bytes: 190464, w: 1200, h: 400, logo: 'png' });
    if (v2) add(key, 'logot', 'saaristolinja-kumppani.svg', 'svg', { bytes: 5222, logo: 'partner', state: 'new' });
    add(key, '', 'LUE-MINUT.md', 'md', { bytes: 1946 });
    add(key, '', 'tiedote.pdf', 'pdf', { bytes: 1.2 * MB, pages: 2 });
    add(key, '', 'kartta-koko-reitti.pdf', 'pdf', { bytes: 3.4 * MB, pages: 1 });
    add(key, '', 'tekijanoikeudet.txt', 'txt', { bytes: 612 });
  }
  O.paketti = { key: 'paketti', at: '13.19', title: 'Kumppanipaketti', root: 'kumppanipaketti', files: [], by: 'paketti2' };
  pakettiFiles('paketti', false);
  O.some = { key: 'some', at: '13.33', title: 'Somekuvat', root: 'somekuvat', files: [] };
  const SOME = { nelio: [1080, 1080, 1.4], tarina: [1080, 1920, 2.1], banneri: [1500, 500, 1.1] };
  for (let n = 1; n <= 4; n++) for (const [s, [w, h, mb]] of Object.entries(SOME)) add('some', '', `etappi-${n}-${s}.png`, 'png', { bytes: (mb + n * 0.07) * MB, w, h, some: n });
  O.paketti2 = { key: 'paketti2', at: '13.47', title: 'Kumppanipaketti', root: 'kumppanipaketti', files: [], replaces: 'paketti' };
  pakettiFiles('paketti2', true);
  const ORDER = ['juliste', 'paketti', 'some', 'paketti2'];
  const LIVE_OFFERS = ORDER.filter(k => !O[k].by);
  const liveCount = LIVE_OFFERS.reduce((n, k) => n + O[k].files.length, 0);

  const TYPE = { poster: 'PNG-kuva', jpg: 'JPG-kuva', png: 'PNG-kuva', svg: 'SVG-kuva', gpx: 'GPX-reitti', pdf: 'PDF-asiakirja', md: 'Markdown', txt: 'Tekstitiedosto' };
  const BADGE = { poster: 'PNG', jpg: 'JPG', png: 'PNG', svg: 'SVG', gpx: 'GPX', pdf: 'PDF', md: 'MD', txt: 'TXT' };
  const isImg = (f) => ['poster', 'jpg', 'png', 'svg'].includes(f.kind);
  const isPhoto = (f) => f.kind === 'jpg' || (f.kind === 'png' && !f.logo);
  const nf = (n) => n.toLocaleString('fi-FI');
  const size = (b) => b < 1024 ? `${b} t` : b < MB ? `${Math.round(b / 1024)} kt` : `${(b / MB).toFixed(1).replace('.', ',')} Mt`;
  const oBytes = (o) => o.files.reduce((n, id) => n + F[id].bytes, 0);
  const DETAIL = { poster: (f) => `${f.w} × ${f.h}`, jpg: (f) => `${f.w} × ${f.h}`, png: (f) => `${f.w} × ${f.h}`, svg: () => 'vektori', gpx: (f) => `${f.km} km`, pdf: (f) => `${f.pages} ${f.pages === 1 ? 'sivu' : 'sivua'}`, md: () => '24 riviä', txt: () => '9 riviä' };
  const detail = (f) => DETAIL[f.kind](f);
  const STATE = { changed: 'muuttunut', new: 'uusi' };
  const stateTag = (f) => f.state ? `<span class="mf-state" data-state="${f.state}">${STATE[f.state]}</span>` : '';
  // An offer's folders in the order the agent made them; files at the root come last.
  const folders = (o) => { const m = new Map(); o.files.forEach(id => { const d = F[id].dir; if (!m.has(d)) m.set(d, []); m.get(d).push(id); }); const root = m.get('') || []; m.delete(''); return { dirs: [...m.entries()], root }; };
  const diff = (o) => { const ch = o.files.filter(id => F[id].state === 'changed').length, nw = o.files.filter(id => F[id].state === 'new').length; return { ch, nw }; };

  const ws = UI.ws[0];
  Object.assign(ws, { id: 'kevatkampanja', path: '~/work/kevatkampanja' });
  ws.convs[0].title = 'Kumppanipaketti ja somekuvat';
  ws.convs.splice(1, ws.convs.length - 1,
    { id: 'c2', title: 'Kevätkampanjan aineisto', st: 'done' },
    { id: 'c3', title: 'Kumppanisopimusten luonnokset', st: 'done' });
  UI.titles = ['Kumppanipaketti ja somekuvat']; UI.working = false;

  const run1 = (cmd, out) => ({ t: 'tool', name: 'bash', target: cmd, args: { command: cmd }, result: out });
  const offerTool = (k, src, title) => run1(`open-habitat agent file offer --current --source ${src}${title ? ` --title "${title}"` : ''}`, `{"ok":true,"result":{"offer":{"offer_id":"f${k}7m2q","files":${O[k].files.length},"target":"conversation"${O[k].replaces ? ',"replaces":"fpaketti7m2q"' : ''}}}}`);
  CONVO.splice(0, CONVO.length,
    { kind: 'marker', t: 'settings', time: '13:00', model: MODEL_ID, thinking: 'medium' },
    { kind: 'user', time: '13:00', md: 'Tee kampanjan juliste A2-kokoon.' },
    { kind: 'turn', time: '13:06', blocks: [
      run1('python3 juliste.py --koko A2 --dpi 180', 'Kirjoitettu out/juliste-a2.png (3000×4500, 8,4 Mt)'),
      offerTool('juliste', 'out/juliste-a2.png'),
      { t: 'reply', md: 'Juliste on A2-pystykoossa painolaatuisena.' },
    ] },
    { kind: 'offer', key: 'juliste' },
    { kind: 'user', time: '13:10', md: 'Kokoa kumppaneille paketti: reittikuvat etapeittain, GPX-reitit, logot ja tiedote. Pidä kansiorakenne, niin jokainen löytää oman etappinsa kuvat.' },
    { kind: 'turn', time: '13:19', blocks: [
      { t: 'think', md: '**Collecting the partner package by stage**' },
      run1('python3 kokoa.py --kuvat kuvat/ --reitit gpx/ --out out/kumppanipaketti', 'Kirjoitettu 32 tiedostoa, 5 kansiota'),
      offerTool('paketti', 'out/kumppanipaketti', 'Kumppanipaketti'),
      { t: 'reply', md: 'Paketissa on neljä etappikansiota, joissa kussakin on kuvat ja reitin GPX-tiedosto, sekä logot ja tiedote. Kuvat ovat täysikokoisia, joten paketti on noin sata megatavua.' },
    ] },
    { kind: 'offer', key: 'paketti' },
    { kind: 'user', time: '13:25', md: 'Tee jokaisesta etapista somekuvat kolmeen kokoon.' },
    { kind: 'turn', time: '13:33', blocks: [
      run1('python3 some.py --koot nelio,tarina,banneri --out out/somekuvat', 'Kirjoitettu 12 kuvaa'),
      offerTool('some', 'out/somekuvat', 'Somekuvat'),
      { t: 'reply', md: 'Jokaisesta etapista on neliö syötteeseen, pystykuva tarinoihin ja banneri Facebookin kansikuvaksi.' },
    ] },
    { kind: 'offer', key: 'some' },
    { kind: 'user', time: '13:40', md: 'Kallioranta-kuvassa näkyy ohikulkijan kasvot, rajaa ne pois. Auringonlaskukuva on liian tumma. Lisää pakettiin Saaristolinjan logo kumppanilogoksi.' },
    { kind: 'turn', time: '13:47', blocks: [
      run1('python3 rajaa.py kuvat/etappi-2/kallioranta.jpg --pois 0.62,0.18,0.9,0.7', 'Rajattu 3200×2400'),
      run1('python3 saato.py kuvat/etappi-3/pyorailijat-auringonlasku.jpg --valotus +0.7', ''),
      run1('python3 kokoa.py --kuvat kuvat/ --reitit gpx/ --out out/kumppanipaketti', 'Kirjoitettu 33 tiedostoa, 5 kansiota'),
      offerTool('paketti2', 'out/kumppanipaketti', 'Kumppanipaketti'),
      { t: 'reply', md: 'Tarjosin paketin uudelleen samasta kansiosta. Kaksi kuvaa vaihtui ja Saaristolinjan logo tuli lisää. Aiempi versio jää keskusteluun, mutta lähetä kumppaneille tämä.' },
    ] },
    { kind: 'offer', key: 'paketti2' },
  );

  // ---------- Synthetic pictures ----------
  const CACHE = new Map();
  const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL('image/jpeg', 0.86); };
  function scene(g, w, h, name, ver) {
    const r = hash(name), rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(r % 2147483646 + 1);
    const dusk = /auringonlasku|louhisaari/.test(name), bright = ver === 1;
    const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
    if (dusk) { sky.addColorStop(0, bright ? '#5b6fb8' : '#2a2f5c'); sky.addColorStop(1, bright ? '#ffb36b' : '#b4583a'); } else { const hue = 196 + (r % 22); sky.addColorStop(0, `hsl(${hue} 62% ${44 + (r % 10)}%)`); sky.addColorStop(1, `hsl(${hue + 8} 55% 84%)`); }
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = dusk ? (bright ? '#ffe08a' : '#f19a4a') : '#fff6cf'; g.beginPath(); g.arc(w * (0.18 + rnd() * 0.64), h * (0.16 + rnd() * 0.22), h * 0.08, 0, 7); g.fill();
    const sea = h * (0.55 + rnd() * 0.08);
    g.fillStyle = dusk ? (bright ? '#3e5a8a' : '#1d2a48') : `hsl(${200 + (r % 14)} 52% 36%)`; g.fillRect(0, sea, w, h - sea);
    for (let i = 0; i < 3; i++) { const x = rnd() * w, iw = w * (0.2 + rnd() * 0.35), ih = h * (0.06 + rnd() * 0.08); g.fillStyle = dusk ? (bright ? '#2b3a2c' : '#141c18') : `hsl(${120 + (r % 30)} 30% ${20 + i * 6}%)`; g.beginPath(); g.moveTo(x - iw / 2, sea + 1); g.quadraticCurveTo(x, sea - ih * 2, x + iw / 2, sea + 1); g.fill(); }
    if (/lautta/.test(name)) { g.fillStyle = '#f4f4f0'; g.fillRect(w * 0.3, sea - h * 0.06, w * 0.38, h * 0.07); g.fillStyle = '#c7372f'; g.fillRect(w * 0.3, sea - h * 0.012, w * 0.38, h * 0.02); g.fillStyle = '#f4f4f0'; g.fillRect(w * 0.42, sea - h * 0.11, w * 0.1, h * 0.05); }
    if (/kirkko/.test(name)) { g.fillStyle = '#e8e2d6'; g.fillRect(w * 0.55, sea - h * 0.18, w * 0.16, h * 0.18); g.fillStyle = '#8c2f28'; g.beginPath(); g.moveTo(w * 0.53, sea - h * 0.18); g.lineTo(w * 0.63, sea - h * 0.3); g.lineTo(w * 0.73, sea - h * 0.18); g.fill(); g.fillRect(w * 0.6, sea - h * 0.42, w * 0.04, h * 0.14); }
    if (/silta/.test(name)) { g.strokeStyle = '#d8dde4'; g.lineWidth = h * 0.025; g.beginPath(); g.moveTo(0, sea - h * 0.04); g.quadraticCurveTo(w / 2, sea - h * 0.24, w, sea - h * 0.04); g.stroke(); }
    if (/satama|kalastaja|laituri/.test(name)) for (let i = 0; i < 4; i++) { const x = w * (0.15 + i * 0.19); g.fillStyle = i % 2 ? '#f5f1e8' : '#c34a36'; g.beginPath(); g.moveTo(x, sea + h * 0.05); g.lineTo(x + w * 0.1, sea + h * 0.05); g.lineTo(x + w * 0.085, sea + h * 0.09); g.lineTo(x + w * 0.015, sea + h * 0.09); g.fill(); g.fillStyle = '#f5f1e8'; g.beginPath(); g.moveTo(x + w * 0.05, sea + h * 0.05); g.lineTo(x + w * 0.05, sea - h * 0.1); g.lineTo(x + w * 0.09, sea + h * 0.04); g.fill(); }
    if (/pellot|laidun|rengastie/.test(name)) { g.fillStyle = /pellot/.test(name) ? '#d8b84a' : '#6d9a45'; g.fillRect(0, sea, w, h - sea); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.1)'; g.fillRect(0, sea + i * (h - sea) / 6, w, (h - sea) / 12); } }
    if (/rengastie|aurajoki|pyorailijat/.test(name)) { g.fillStyle = '#4a4d52'; g.beginPath(); g.moveTo(w * 0.42, sea); g.lineTo(w * 0.58, sea); g.lineTo(w * 0.86, h); g.lineTo(w * 0.14, h); g.fill(); g.fillStyle = '#f0d34a'; for (let i = 0; i < 4; i++) g.fillRect(w * 0.495, sea + (h - sea) * (i / 4 + 0.05), w * 0.01, (h - sea) / 9); }
    if (/huoltopiste/.test(name)) { g.fillStyle = '#1e4fb0'; g.beginPath(); g.moveTo(w * 0.3, sea + h * 0.2); g.lineTo(w * 0.5, sea - h * 0.12); g.lineTo(w * 0.7, sea + h * 0.2); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${Math.round(h * 0.06)}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(name.slice(-1), w * 0.5, sea + h * 0.13); }
    if (/kauppatori/.test(name)) for (let i = 0; i < 6; i++) { g.fillStyle = ['#e3c79c', '#c96f4a', '#e9e2cf', '#8fa5b8', '#d9a84c', '#b8b2a4'][i]; const bh = h * (0.14 + (i % 3) * 0.05); g.fillRect(i * w / 6, sea - bh, w / 6 - 2, bh); }
    if (/kallioranta/.test(name)) { g.fillStyle = '#8b8178'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, sea - h * 0.02); g.quadraticCurveTo(w * 0.4, sea - h * 0.12, w * 0.75, sea + h * 0.1); g.lineTo(w, h); g.fill(); if (!ver) { g.fillStyle = '#e1a77d'; g.beginPath(); g.arc(w * 0.82, sea - h * 0.02, h * 0.05, 0, 7); g.fill(); g.fillStyle = '#3c4a6b'; g.fillRect(w * 0.77, sea + h * 0.03, w * 0.1, h * 0.2); } }
  }
  function photo(f, w) {
    const k = `${f.offer === 'paketti2' && !f.ver ? 'paketti' : f.offer}:${f.path}:${w}`;
    if (CACHE.has(k)) return CACHE.get(k);
    let url;
    if (f.kind === 'svg') url = logoSvg(f.logo);
    else if (f.logo === 'png') url = canvas(w, Math.round(w / 3), (g, W, H) => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); drawLogo(g, W, H); });
    else if (f.kind === 'poster') url = canvas(w, Math.round(w * 1.5), (g, W, H) => { scene(g, W, H, 'juliste-saaristo-rengastie', 0); g.fillStyle = 'rgba(11,30,70,.45)'; g.fillRect(0, H * 0.36, W, H * 0.22); g.fillStyle = '#fff'; g.font = `700 ${Math.round(W * 0.1)}px system-ui, sans-serif`; g.fillText('Saaristo', W * 0.08, H * 0.45); g.fillText('pyöräillen', W * 0.08, H * 0.53); g.font = `${Math.round(W * 0.045)}px system-ui, sans-serif`; g.fillText('12.4.–31.5.2027', W * 0.08, H * 0.94); });
    else if (f.some) {
      const H = Math.round(w * f.h / f.w), src = STAGES[f.some - 1][1][0];
      url = canvas(w, H, (g, W, Hh) => { scene(g, W, Hh, src, 0); g.fillStyle = 'rgba(11,30,70,.5)'; g.fillRect(0, Hh * 0.62, W, Hh * 0.38); g.fillStyle = '#fff'; const fs = Math.min(W, Hh) * 0.12; g.font = `700 ${fs}px system-ui, sans-serif`; g.fillText(`Etappi ${f.some}`, W * 0.06, Hh * 0.62 + fs * 1.2); g.font = `${fs * 0.5}px system-ui, sans-serif`; g.fillText(STAGES[f.some - 1][0].slice(9).replace('-', '–').replace(/(^|–)(\w)/g, (m, a, b) => a + b.toUpperCase()), W * 0.06, Hh * 0.62 + fs * 2); });
    } else url = canvas(w, Math.round(w * f.h / f.w), (g, W, H) => { if (f.ver && /kallioranta/.test(f.name)) { g.scale(1.25, 1.25); } scene(g, W, H, f.name, f.ver); });
    CACHE.set(k, url); return url;
  }
  function drawLogo(g, W, H) { g.strokeStyle = '#1e4fb0'; g.lineWidth = H * 0.09; g.beginPath(); g.arc(H * 0.5, H * 0.5, H * 0.32, 0, 7); g.stroke(); g.fillStyle = '#18a383'; g.beginPath(); g.arc(H * 0.5, H * 0.5, H * 0.14, 0, 7); g.fill(); g.fillStyle = '#1e4fb0'; g.font = `700 ${H * 0.34}px system-ui, sans-serif`; g.fillText('Saaristo', H * 1.0, H * 0.62); }
  function logoSvg(kind) {
    if (CACHE.has('logo:' + kind)) return CACHE.get('logo:' + kind);
    const ink = kind === 'white' ? '#ffffff' : '#1e4fb0', bg = kind === 'white' ? '<rect width="240" height="80" fill="#1e4fb0"/>' : '';
    const body = kind === 'partner'
      ? '<path d="M18 52h70l-10 12H28z" fill="#0b6aa8"/><path d="M40 52V20l30 32z" fill="#e4572e"/><text x="100" y="50" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0b6aa8">Saaristolinja</text>'
      : `<circle cx="40" cy="40" r="26" fill="none" stroke="${ink}" stroke-width="7"/><circle cx="40" cy="40" r="11" fill="${kind === 'white' ? '#fff' : '#18a383'}"/><text x="80" y="50" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="${ink}">Saaristo</text>`;
    const url = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80">${bg}${body}</svg>`);
    CACHE.set('logo:' + kind, url); return url;
  }
  const thumb = (f) => photo(f, f.kind === 'poster' ? 400 : 320);

  // ---------- Pieces ----------
  const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    down: I('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    prev: I('<path d="m15 6-6 6 6 6"/>'), next: I('<path d="m9 6 6 6-6 6"/>'),
    file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    files: I('<path d="M9 3h6l4 4v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M15 3v4h4M5 7v12a2 2 0 0 0 2 2h8"/>'),
    folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    zip: I('<path d="M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3"/><path d="M10 3v2m0 2v2m0 2v2"/><rect x="3" y="12" width="6" height="5" rx="1"/>'),
    search: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
    filter: I('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>'),
    image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>'),
    route: I('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/>'),
    doc: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 12h7M8.5 15.5h7"/>'),
    chev: I('<path d="m9 6 6 6-6 6"/>'),
    up: I('<path d="m15 6-6 6 6 6"/>'),
    history: I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  };
  const btn = (cls, attrs, inner, label) => `<button type="button" class="${cls}" ${attrs}${label ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}>${inner}</button>`;
  const badge = (f) => `<span class="mf-type" data-kind="${f.kind}">${BADGE[f.kind]}</span>`;
  const mini = (f) => isImg(f) ? `<img class="mf-mini${f.kind === 'svg' || f.logo ? ' logo' : ''}" src="${thumb(f)}" alt="">` : badge(f);
  const dlBtn = (id) => btn('icon-btn mf-dlicon', `data-mf-dl="${id}"`, ICON.down, `Lataa ${F[id].name}`);
  const zipName = (o) => `${o.root}.zip`;
  const metaLine = (o) => {
    if (o.files.length === 1) { const f = F[o.files[0]]; return `${TYPE[f.kind]} · ${detail(f)} · ${size(f.bytes)} · Vain sinulle`; }
    const { dirs } = folders(o);
    return `${o.files.length} tiedostoa${dirs.length ? ` · ${dirs.length} kansiota` : ''} · ${size(oBytes(o))} · Vain sinulle`;
  };
  // Shared across directions: the newer offer of the same folder says what changed, the older one points to it.
  function versionNote(o) {
    if (o.by) { const n = O[o.by], { ch, nw } = diff(n); return `<p class="mf-note old">${ICON.history}<span>Uudempi versio klo ${n.at}: ${ch} kuvaa vaihtui, ${nw} tiedosto lisättiin.</span>${btn('quiet-btn', `data-mf-jump="${o.by}"`, 'Siirry uudempaan')}</p>`; }
    if (o.replaces) { const { ch, nw } = diff(o); return `<p class="mf-note">${ICON.history}<span>Korvaa klo ${O[o.replaces].at} tarjotun version: ${ch} muuttunutta, ${nw} uusi.</span>${btn('quiet-btn', `data-mf-jump="${o.replaces}"`, 'Näytä aiempi')}</p>`; }
    return '';
  }
  function shell(o, body, actions, cls = '') {
    const many = o.files.length > 1;
    return `<aside class="mf-card ah-in ${cls}" role="note" tabindex="-1" aria-label="Agentin tarjoama ${many ? 'paketti' : 'tiedosto'}: ${esc(o.title)}, klo ${o.at}" data-mf-offer="${o.key}">
<span class="mf-mark" aria-hidden="true">${many ? ICON.files : ICON.file}</span>
<div class="mf-body"><span class="mf-label"><span class="mf-at">klo ${o.at} · </span>Agentti tarjoaa ladattavaksi${many ? ' kansion' : ''}:</span><strong class="mf-title">${esc(o.title)}${many ? ` <span class="mf-root">${esc(o.root)}/</span>` : ''}</strong><span class="mf-meta">${metaLine(o)}</span>${versionNote(o)}${body}
<span class="mf-actions">${actions}</span></div></aside>`;
  }
  // One file: the Kurkistus card from round 2, the same in every direction.
  function singleCard(o) {
    const id = o.files[0], f = F[id];
    return shell(o, `<button type="button" class="mf-peek" data-mf-open="${id}" aria-label="Näytä isona: ${esc(f.name)}"><img src="${thumb(f)}" alt=""></button>`,
      btn('primary', `data-mf-dl="${id}"`, `${ICON.down}Lataa`) + btn('secondary', `data-mf-open="${id}"`, 'Näytä isona'));
  }
  const zipBtn = (o) => btn('primary', `data-mf-zip="${o.key}"`, `${ICON.zip}Lataa kaikki (.zip)`);
  function fileRow(id, opts = {}) {
    const f = F[id];
    return `<li class="mf-row" data-name="${esc(f.path.toLowerCase())}"><button type="button" class="mf-rowopen" data-mf-open="${id}">${mini(f)}<span class="mf-rname"><span class="mf-fname">${esc(f.name)}</span>${opts.path && f.dir ? `<span class="mf-rpath">${esc(f.dir)}/</span>` : ''}</span>${stateTag(f)}<span class="mf-rsize">${size(f.bytes)}</span></button>${dlBtn(id)}</li>`;
  }
  const tile = (id, extra = '') => { const f = F[id]; return `<button type="button" class="mf-tile${f.kind === 'svg' || f.logo ? ' logo' : ''}" data-mf-open="${id}" aria-label="Avaa ${esc(f.name)}"><img src="${thumb(f)}" alt="">${extra}${f.state ? `<span class="mf-tstate" data-state="${f.state}">${STATE[f.state]}</span>` : ''}</button>`; };

  // ---------- 1 Ryhmät: by type; the conversation filters to its files ----------
  const GROUPS = [
    ['Valokuvat', (f) => f.kind === 'jpg' || (f.kind === 'png' && !f.logo), ICON.image],
    ['Logot', (f) => f.kind === 'svg' || f.logo, ICON.image],
    ['Reitit', (f) => f.kind === 'gpx', ICON.route],
    ['Asiakirjat', (f) => ['pdf', 'md', 'txt'].includes(f.kind), ICON.doc],
  ];
  function typeCard(o) {
    if (o.files.length === 1) return singleCard(o);
    const photos = o.files.filter(id => isPhoto(F[id]));
    const shown = photos.slice(0, 5), rest = photos.length - shown.length;
    const mosaic = `<div class="mf-mosaic" aria-label="Kuvat">${shown.map(id => tile(id)).join('')}${rest > 0 ? tile(photos[5], `<span class="mf-more">+${rest}</span>`).replace(/aria-label="[^"]*"/, `aria-label="Näytä kaikki ${photos.length} kuvaa"`) : ''}</div>`;
    const groups = GROUPS.map(([name, test, icon]) => {
      const ids = o.files.filter(id => test(F[id])); if (!ids.length) return '';
      const kinds = [...new Set(ids.map(id => BADGE[F[id].kind]))].join(', ');
      const ch = ids.filter(id => F[id].state === 'changed').length, nw = ids.filter(id => F[id].state === 'new').length;
      const st = [ch && `${ch} muuttunut${ch > 1 ? 'ta' : ''}`, nw && `${nw} uusi`].filter(Boolean).join(', ');
      return `<details class="mf-group"><summary>${icon}<span class="mf-gname">${name}</span><span class="mf-gcount">${ids.length}</span><span class="mf-gkinds">${kinds}${st ? ` · ${st}` : ''}</span><span class="mf-rsize">${size(ids.reduce((n, id) => n + F[id].bytes, 0))}</span></summary><ul class="mf-rows">${ids.map(id => fileRow(id, { path: true })).join('')}</ul></details>`;
    }).join('');
    return shell(o, `${mosaic}<div class="mf-groups">${groups}</div><p class="mf-nohit" hidden>Ei osumia tässä tarjouksessa.</p>`, zipBtn(o) + btn('secondary', `data-mf-open="${photos[0]}"`, `Selaa kuvia (${photos.length})`));
  }
  const TY = { only: false, q: '' };
  let VIEW = 'type', SH_DIR = false;
  function filterBar() {
    return `<div class="mf-filter" role="search"><label class="mf-search">${ICON.search}<input type="search" data-mf-tq placeholder="Etsi tiedostoa nimellä" aria-label="Etsi keskustelun tiedostoista" value="${esc(TY.q)}"></label><span class="mf-fcount" aria-live="polite"></span>${btn('quiet-btn', 'data-mf-only', 'Näytä koko keskustelu')}</div>`;
  }
  function applyTypeFilter() {
    const wrap = document.querySelector('.mf-dir-type'); if (!wrap) return;
    wrap.classList.toggle('mf-only', TY.only);
    const q = TY.only ? TY.q.trim().toLowerCase() : '';
    let hits = 0, offers = 0;
    wrap.querySelectorAll('.mf-card').forEach(card => {
      const key = card.dataset.mfOffer, o = O[key];
      if (o.files.length === 1) { const hit = !q || F[o.files[0]].name.toLowerCase().includes(q); card.hidden = !hit; if (hit) { hits++; offers++; } return; }
      let n = 0;
      card.querySelectorAll('.mf-group').forEach(g => {
        let gn = 0;
        g.querySelectorAll('.mf-row').forEach(r => { const hit = !q || r.dataset.name.includes(q); r.hidden = !hit; if (hit) gn++; });
        g.hidden = !!q && !gn; if (q) g.open = gn > 0; n += gn;
      });
      card.querySelector('.mf-mosaic').hidden = !!q;
      card.hidden = !!q && !n; hits += n; if (n) offers++;
    });
    const c = wrap.querySelector('.mf-fcount');
    if (c) c.textContent = q ? (hits ? `${hits} osumaa, ${offers} tarjouksessa` : 'Ei osumia') : `${ORDER.reduce((n, k) => n + O[k].files.length, 0)} tiedostoa, ${ORDER.length} tarjousta`;
  }

  // ---------- 2 Kansio: the card is the folder ----------
  const FS = { dir: {}, q: {}, open: {} };
  function folderView(o) {
    const key = o.key, q = (FS.q[key] || '').trim().toLowerCase(), cur = FS.dir[key] || '';
    const { dirs, root } = folders(o);
    if (q) {
      const ids = o.files.filter(id => F[id].path.toLowerCase().includes(q));
      return ids.length ? `<p class="mf-fhint">${ids.length} osumaa</p><ul class="mf-rows">${ids.map(id => fileRow(id, { path: true })).join('')}</ul>` : `<p class="mf-fhint">Ei osumia: ”${esc(q)}”</p>`;
    }
    const grid = (ids) => { const im = ids.filter(id => isImg(F[id])), other = ids.filter(id => !isImg(F[id])); return `${im.length ? `<div class="mf-grid">${im.map(id => `<figure>${tile(id)}<figcaption>${esc(F[id].name)}</figcaption></figure>`).join('')}</div>` : ''}${other.length ? `<ul class="mf-rows">${other.map(id => fileRow(id)).join('')}</ul>` : ''}`; };
    if (!cur) {
      const rows = dirs.map(([d, ids]) => {
        const pics = ids.filter(id => isPhoto(F[id])).slice(0, 3), st = ids.filter(id => F[id].state).length;
        return `<li><button type="button" class="mf-dirrow" data-mf-cd="${esc(d)}">${ICON.folder}<span class="mf-rname"><span class="mf-fname">${esc(d)}/</span><span class="mf-rpath">${ids.length} tiedostoa · ${size(ids.reduce((n, id) => n + F[id].bytes, 0))}${st ? ` · ${st} ${F[ids.find(id => F[id].state)].state === 'new' ? 'uusi' : 'muuttunut'}` : ''}</span></span><span class="mf-dthumbs">${pics.map(id => `<img src="${thumb(F[id])}" alt="">`).join('')}</span>${ICON.chev}</button></li>`;
      }).join('');
      return `${rows ? `<ul class="mf-rows mf-dirs">${rows}</ul>` : ''}${grid(root)}`;
    }
    const ids = (dirs.find(([d]) => d === cur) || [, []])[1];
    return grid(ids);
  }
  function crumbs(o) {
    const cur = FS.dir[o.key] || '';
    return `<nav class="mf-crumbs" aria-label="Kansiopolku">${cur ? btn('mf-crumb', 'data-mf-cd=""', `${ICON.up}${esc(o.root)}`, `Takaisin kansioon ${o.root}`) + `<span class="mf-sep">/</span><span class="mf-crumb cur" aria-current="location">${esc(cur)}</span>` : `<span class="mf-crumb cur" aria-current="location">${ICON.folder}${esc(o.root)}/</span>`}</nav>${cur ? btn('quiet-btn mf-zipdir', `data-mf-zipdir="${o.key}"`, `${ICON.zip}Lataa kansio`) : ''}`;
  }
  function folderCard(o) {
    if (o.files.length === 1) return singleCard(o);
    // The superseded version folds to one line until asked for.
    if (o.by && !FS.open[o.key]) {
      const n = O[o.by];
      return `<aside class="mf-card mf-folded ah-in" role="note" tabindex="-1" aria-label="Aiempi versio: ${esc(o.title)}, klo ${o.at}" data-mf-offer="${o.key}"><span class="mf-mark" aria-hidden="true">${ICON.history}</span><div class="mf-body"><span class="mf-fold-line"><strong class="mf-title">${esc(o.title)} <span class="mf-root">${esc(o.root)}/</span></strong><span class="mf-meta">${o.files.length} tiedostoa · korvattu klo ${n.at} uudemmalla versiolla</span></span><span class="mf-actions">${btn('quiet-btn', `data-mf-unfold="${o.key}"`, 'Näytä tämä versio')}${btn('quiet-btn', `data-mf-jump="${o.by}"`, 'Siirry uudempaan')}</span></div></aside>`;
    }
    const search = o.files.length > 12 ? `<label class="mf-search">${ICON.search}<input type="search" data-mf-fq="${o.key}" placeholder="Etsi paketista" aria-label="Etsi paketista ${esc(o.title)}" value="${esc(FS.q[o.key] || '')}"></label>` : '';
    return shell(o, `<div class="mf-fb" data-mf-fb="${o.key}"><div class="mf-fbar">${crumbs(o)}</div>${search}<div class="mf-fview">${folderView(o)}</div></div>`,
      zipBtn(o) + (o.by ? btn('quiet-btn', `data-mf-unfold="${o.key}"`, 'Pienennä') : ''), o.by ? 'mf-oldver' : '');
  }
  function refreshFolder(key) {
    const fb = document.querySelector(`[data-mf-fb="${key}"]`); if (!fb) return;
    fb.querySelector('.mf-fbar').innerHTML = crumbs(O[key]);
    fb.querySelector('.mf-fview').innerHTML = folderView(O[key]);
  }

  // ---------- 3 Hylly: a compact card; every file of the conversation in one panel ----------
  const SH = { open: false, sel: null, q: '', focus: null };
  function shelfCard(o) {
    if (o.files.length === 1) return singleCard(o);
    const pics = o.files.filter(id => isPhoto(F[id])), shown = pics.slice(0, 8);
    const strip = `<button type="button" class="mf-strip" data-mf-shelf="${o.key}" aria-label="Näytä ${o.files.length} tiedostoa tiedostopaneelissa">${shown.map(id => `<img src="${thumb(F[id])}" alt="">`).join('')}${o.files.length > shown.length ? `<span class="mf-more">+${o.files.length - shown.length}</span>` : ''}</button>`;
    const { dirs } = folders(o);
    const tree = dirs.length ? `<p class="mf-dirsum">${dirs.map(([d, ids]) => `<span>${ICON.folder}${esc(d)} <span class="mf-rsize">${ids.length}</span></span>`).join('')}</p>` : '';
    return shell(o, strip + tree, zipBtn(o) + btn('secondary', `data-mf-shelf="${o.key}"`, `${ICON.files}Näytä tiedostot`), o.by ? 'mf-oldver' : '');
  }
  const panel = document.createElement('aside');
  panel.className = 'mf-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Keskustelun tiedostot');
  panel.innerHTML = `<div class="mf-phead"><strong>Tiedostot</strong><span class="mf-pcount">${liveCount}</span>${btn('icon-btn', 'data-mf-pclose', ICON.x, 'Sulje tiedostot')}</div>
<label class="mf-search mf-psearch">${ICON.search}<input type="search" data-mf-sq placeholder="Etsi kaikista tarjouksista" aria-label="Etsi keskustelun tiedostoista"></label>
<div class="mf-pview"></div><div class="mf-plist"></div>`;
  document.querySelector('.frame .body').appendChild(panel);
  function shelfPreview() {
    const f = F[SH.sel]; if (!f) return '';
    const o = O[f.offer];
    const look = isImg(f) ? `<button type="button" class="mf-pprev${f.kind === 'svg' || f.logo ? ' logo' : ''}" data-mf-open="${f.id}" aria-label="Avaa ${esc(f.name)} isona"><img src="${photo(f, 640)}" alt=""></button>` : `<button type="button" class="mf-pprev doc" data-mf-open="${f.id}" aria-label="Avaa ${esc(f.name)} isona">${docBody(f, true)}</button>`;
    return `${look}<div class="mf-pfacts"><strong class="mf-fname">${esc(f.name)}</strong>${stateTag(f)}<span>${o.root ? `${esc(o.root)}/${f.dir ? esc(f.dir) + '/' : ''}` : ''}</span><span>${TYPE[f.kind]} · ${detail(f)} · ${size(f.bytes)}</span><span>Tarjottu klo ${o.at}${o.by ? ` · aiempi versio` : ''} · Vain sinulle</span></div><div class="mf-pactions">${btn('primary', `data-mf-dl="${f.id}"`, `${ICON.down}Lataa`)}${btn('secondary', `data-mf-open="${f.id}"`, 'Avaa isona')}</div>`;
  }
  function shelfRow(id, path) {
    const f = F[id];
    return `<li><button type="button" class="mf-prow${id === SH.sel ? ' sel' : ''}" data-mf-sel="${id}" aria-current="${id === SH.sel}">${mini(f)}<span class="mf-rname"><span class="mf-fname">${esc(f.name)}</span>${path && f.dir ? `<span class="mf-rpath">${esc(f.dir)}/</span>` : ''}</span>${stateTag(f)}<span class="mf-rsize">${size(f.bytes)}</span></button></li>`;
  }
  function shelfSection(key, q) {
    const o = O[key];
    const head = `<h4>klo ${o.at} · ${esc(o.title)}<span class="mf-rsize">${o.files.length}</span>${o.files.length > 1 ? btn('quiet-btn mf-pzip', `data-mf-zip="${key}"`, `${ICON.zip}.zip`, `Lataa ${o.title} yhtenä zip-tiedostona`) : ''}</h4>`;
    if (q) { const ids = o.files.filter(id => F[id].path.toLowerCase().includes(q)); return ids.length ? `<section data-mf-sec="${key}">${head}<ul>${ids.map(id => shelfRow(id, true)).join('')}</ul></section>` : ''; }
    const { dirs, root } = folders(o);
    const openDir = (d, ids) => ids.includes(SH.sel) || (SH.focus === key && dirs[0][0] === d);
    return `<section data-mf-sec="${key}">${head}${dirs.map(([d, ids]) => `<details${openDir(d, ids) ? ' open' : ''}><summary>${ICON.folder}<span class="mf-fname">${esc(d)}/</span><span class="mf-rsize">${ids.length}</span></summary><ul>${ids.map(id => shelfRow(id)).join('')}</ul></details>`).join('')}<ul>${root.map(id => shelfRow(id)).join('')}</ul></section>`;
  }
  function paintPanel() {
    panel.hidden = !(SH_DIR && SH.open);
    if (panel.hidden) return;
    const q = SH.q.trim().toLowerCase();
    panel.querySelector('.mf-pview').innerHTML = shelfPreview();
    panel.querySelector('.mf-pview').hidden = !SH.sel;
    const live = [...LIVE_OFFERS].reverse().map(k => shelfSection(k, q)).join('');
    const old = ORDER.filter(k => O[k].by).map(k => shelfSection(k, q)).join('');
    panel.querySelector('.mf-plist').innerHTML = (live || old) ? `${live}${old ? `<details class="mf-older"${q ? ' open' : ''}><summary>${ICON.history}Aiemmat versiot</summary>${old}</details>` : ''}` : `<p class="mf-fhint">Ei osumia: ”${esc(q)}”</p>`;
  }
  APP.painted.push(paintPanel);
  const baseActions = APP.actions;
  APP.actions = (c) => {
    if (c.id !== 'c1') return baseActions(c);
    if (VIEW === 'shelf') return btn(`icon-btn tb-btn mf-tb${SH.open ? ' on' : ''}`, `data-mf-ptoggle aria-expanded="${SH.open}" aria-label="Tiedostot, ${liveCount}" title="Keskustelun tiedostot"`, `${ICON.files}<span class="mf-count">${liveCount}</span>`) + baseActions(c);
    if (VIEW === 'type') return btn(`icon-btn tb-btn mf-tb${TY.only ? ' on' : ''}`, `data-mf-only aria-pressed="${TY.only}" aria-label="Vain tiedostot" title="Näytä keskustelusta vain tiedostot"`, `${ICON.filter}<span class="mf-count">Tiedostot</span>`) + baseActions(c);
    return baseActions(c);
  };

  // ---------- Preview dialog (AttachmentPreview with a gallery inside one offer) ----------
  const LUE = `# Kumppanipaketti · Saaristo pyöräillen 2027

Tässä paketissa on kaikki, mitä tarvitset kampanjan esittelyyn.

- **etappi-1 … etappi-4**: kuvat ja reitin GPX-tiedosto etapeittain
- **logot**: kampanjan logo sinisenä ja valkoisena, PNG verkkoon
- **tiedote.pdf**: lehdistötiedote 3.3.2027
- **kartta-koko-reitti.pdf**: koko reitti yhdellä sivulla

Kuvia saa käyttää kampanjan viestinnässä 31.8.2027 asti. Kuvaajat on mainittu tiedostossa \`tekijanoikeudet.txt\`.`;
  const TXT = 'Kuvat: Aino Lehtinen, Juho Salonen (etapit 1–2)\nKuvat: Kaisa Niemi (etapit 3–4)\nLogot: Saariston Matkailu ry\n\nKäyttöoikeus: kampanjaviestintä 31.8.2027 asti.\nMainitse kuvaaja, kun kuva julkaistaan.';
  function route(f) { const r = hash(f.name); let x = 30, y = 120, d = `M${x} ${y}`; for (let i = 0; i < 18; i++) { x += 14 + (hash(f.name + i) % 9); y += ((hash(f.name + 'y' + i) % 41) - 20) * 1.4; y = Math.max(30, Math.min(210, y)); d += ` L${x} ${y.toFixed(0)}`; } return `<svg class="mf-route" viewBox="0 0 ${x + 30} 240" role="img" aria-label="Reitti ${f.km} km"><rect width="100%" height="100%" fill="#dfeaf2"/><path d="M0 ${150 + r % 40} Q 120 ${90 + r % 30} 260 ${170} T ${x + 30} 140 V240 H0Z" fill="#cfe3c8"/><path d="${d}" fill="none" stroke="#1e4fb0" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="120" r="7" fill="#18a383"/><circle cx="${x}" cy="${y.toFixed(0)}" r="7" fill="#c7372f"/></svg>`; }
  function docBody(f, small) {
    if (f.kind === 'gpx') return route(f);
    if (f.kind === 'md') return `<div class="mf-md prose">${md(small ? LUE.split('\n').slice(0, 5).join('\n') : LUE)}</div>`;
    if (f.kind === 'txt') return `<pre class="mf-txt">${esc(TXT)}</pre>`;
    if (f.kind === 'pdf') return `<div class="mf-pages">${Array.from({ length: small ? 1 : f.pages }, (_, p) => `<div class="mf-page"><span class="mf-ph">${f.name === 'tiedote.pdf' ? (p ? 'Aikataulu' : 'Saariston pyöräreitti avautuu 12. huhtikuuta') : 'Saaristo pyöräillen · koko reitti'}</span>${f.name !== 'tiedote.pdf' ? route({ name: 'kartta', km: 200 }) : ''}${Array.from({ length: f.name === 'tiedote.pdf' ? 12 : 3 }, (_, i) => `<span class="mf-pl" style="width:${94 - (i * 17) % 40}%"></span>`).join('')}</div>`).join('')}</div>`;
    return '';
  }
  const dlg = document.createElement('dialog');
  dlg.className = 'mf-dlg'; dlg.setAttribute('aria-labelledby', 'mf-dlg-title');
  document.querySelector('.frame').appendChild(dlg);
  let opener = null, cur = null;
  function openPreview(id, from) {
    const f = F[id], o = O[f.offer]; if (from) opener = from; cur = id;
    const sibs = isImg(f) ? o.files.filter(x => isImg(F[x])) : [], at = sibs.indexOf(id);
    const nav = sibs.length > 1 ? `<div class="mf-gnav">${btn('icon-btn', `data-mf-step="-1"${at === 0 ? ' disabled' : ''}`, ICON.prev, 'Edellinen kuva')}<span class="mf-gpos">${at + 1} / ${sibs.length}</span>${btn('icon-btn', `data-mf-step="1"${at === sibs.length - 1 ? ' disabled' : ''}`, ICON.next, 'Seuraava kuva')}</div>` : '';
    const body = isImg(f) ? `<div class="mf-dimg${f.kind === 'svg' || f.logo ? ' logo' : ''}"><img src="${photo(f, f.kind === 'poster' ? 900 : 1400)}" alt="${esc(f.name)}"></div>` : docBody(f);
    dlg.dataset.kind = f.kind;
    dlg.innerHTML = `<div class="mf-dhead">${badge(f)}<h2 id="mf-dlg-title">${esc(f.name)}</h2>${stateTag(f)}${btn('icon-btn', 'data-mf-dclose', ICON.x, 'Sulje')}</div>
<dl class="mf-dfacts">${o.root ? `<dt>Kansio</dt><dd>${esc(o.root)}/${f.dir ? esc(f.dir) + '/' : ''}</dd>` : ''}<dt>Koko</dt><dd>${size(f.bytes)} · ${detail(f)}</dd><dt>Tarjottu</dt><dd>klo ${o.at}${o.by ? ' · aiempi versio' : ''} · Vain sinulle</dd></dl>
<div class="mf-dbody">${body}</div>
<div class="mf-dactions">${nav}${btn('primary', `data-mf-dl="${id}"`, `${ICON.down}Lataa`)}</div>`;
    if (!dlg.open) dlg.showModal();
  }
  function step(d) {
    const f = F[cur], sibs = O[f.offer].files.filter(x => isImg(F[x])), at = sibs.indexOf(cur) + d;
    if (at < 0 || at >= sibs.length) return;
    openPreview(sibs[at]);
    const b = dlg.querySelector(`[data-mf-step="${d}"]`); (b && !b.disabled ? b : dlg.querySelector(`[data-mf-step="${-d}"]`))?.focus();
  }
  dlg.addEventListener('close', () => { dlg.innerHTML = ''; opener?.isConnected && opener.focus(); opener = null; cur = null; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-mf-dclose]')) return dlg.close();
    const s = e.target.closest('[data-mf-step]'); if (s) { e.stopPropagation(); step(+s.dataset.mfStep); }
  });
  dlg.addEventListener('keydown', (e) => { if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input')) { e.preventDefault(); e.stopPropagation(); step(e.key === 'ArrowRight' ? 1 : -1); } });

  // ---------- Actions ----------
  function jump(key) {
    if (VIEW === 'folder' && O[key].by) { FS.open[key] = true; rerenderCard(key); }
    const el = document.querySelector(`[data-mf-offer="${key}"]`); if (!el) return;
    following = false; el.scrollIntoView({ block: 'start', behavior: 'instant' }); el.focus({ preventScroll: true });
  }
  function rerenderCard(key) { const el = document.querySelector(`[data-mf-offer="${key}"]`); if (el) el.outerHTML = folderCard(O[key]).replace(' ah-in', ''); }
  function openShelf(key) {
    SH.open = true; SH.focus = key || null; SH.q = ''; panel.querySelector('[data-mf-sq]').value = '';
    if (key) SH.sel = O[key].files[0]; else if (!SH.sel) SH.sel = O[LIVE_OFFERS[LIVE_OFFERS.length - 1]].files[0];
    paint();
    const sec = key && panel.querySelector(`[data-mf-sec="${key}"]`); if (sec) sec.scrollIntoView({ block: 'start', behavior: 'instant' });
    panel.querySelector('.mf-prow.sel')?.focus();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mf-open], [data-mf-dl], [data-mf-zip], [data-mf-zipdir], [data-mf-jump], [data-mf-only], [data-mf-cd], [data-mf-unfold], [data-mf-shelf], [data-mf-ptoggle], [data-mf-pclose], [data-mf-sel]');
    if (!t || t.closest('.mf-dlg') && !t.matches('[data-mf-dl]')) return;
    e.preventDefault(); e.stopPropagation();
    const d = t.dataset;
    if (d.mfDl) return toast(`Lataus alkoi: ${F[d.mfDl].name} · ${size(F[d.mfDl].bytes)}`);
    if (d.mfZip) { const o = O[d.mfZip]; return toast(`Lataus alkoi: ${zipName(o)} · ${o.files.length} tiedostoa · ${size(oBytes(o))}`); }
    if (d.mfZipdir) { const o = O[d.mfZipdir], dir = FS.dir[o.key], ids = o.files.filter(id => F[id].dir === dir); return toast(`Lataus alkoi: ${dir}.zip · ${ids.length} tiedostoa · ${size(ids.reduce((n, id) => n + F[id].bytes, 0))}`); }
    if (d.mfOpen) return openPreview(d.mfOpen, t);
    if (d.mfJump) return jump(d.mfJump);
    if (d.mfOnly !== undefined) { TY.only = !TY.only; if (!TY.only) TY.q = ''; paint(); const wrap = document.querySelector('.mf-dir-type'); wrap.querySelector('[data-mf-tq]').value = TY.q; applyTypeFilter(); following = false; stage.scrollTop = 0; if (TY.only) wrap.querySelector('[data-mf-tq]').focus(); else document.querySelector('[data-mf-only].mf-tb')?.focus(); return; }
    if (d.mfCd !== undefined) { const key = t.closest('[data-mf-fb]').dataset.mfFb; FS.dir[key] = d.mfCd; refreshFolder(key); const fb = document.querySelector(`[data-mf-fb="${key}"]`); (d.mfCd ? fb.querySelector('.mf-crumb[data-mf-cd]') : fb.querySelector(`[data-mf-cd]`))?.focus(); return; }
    if (d.mfUnfold) { const k = d.mfUnfold; FS.open[k] = !FS.open[k]; rerenderCard(k); document.querySelector(`[data-mf-offer="${k}"] [data-mf-unfold]`)?.focus(); return; }
    if (d.mfShelf) return openShelf(d.mfShelf);
    if (d.mfPtoggle !== undefined) { if (SH.open) { SH.open = false; paint(); document.querySelector('[data-mf-ptoggle]')?.focus(); } else openShelf(null); return; }
    if (d.mfPclose !== undefined) { SH.open = false; paint(); return document.querySelector('[data-mf-ptoggle]')?.focus(); }
    if (d.mfSel) { SH.sel = d.mfSel; paintPanel(); return panel.querySelector(`[data-mf-sel="${CSS.escape(d.mfSel)}"]`)?.focus(); }
  }, true);
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-mf-tq]')) { TY.q = t.value; applyTypeFilter(); }
    if (t.matches('[data-mf-fq]')) { const k = t.dataset.mfFq; FS.q[k] = t.value; t.closest('[data-mf-fb]').querySelector('.mf-fview').innerHTML = folderView(O[k]); }
    if (t.matches('[data-mf-sq]')) { SH.q = t.value; paintPanel(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && SH.open && !dlg.open && VIEW === 'shelf') { SH.open = false; paint(); document.querySelector('[data-mf-ptoggle]')?.focus(); }
  });

  // ---------- Directions ----------
  const baseMarker = markerR;
  function view(dir) {
    VIEW = dir; SH_DIR = dir === 'shelf';
    TY.only = false; TY.q = ''; FS.dir = {}; FS.q = {}; FS.open = {}; SH.open = false; SH.sel = null; SH.q = ''; panel.querySelector('[data-mf-sq]').value = '';
    UI.pop = false; UI.working = false; paint(); run++;
    const at = CONVO.map((m, i) => m.kind === 'offer' ? i : -1).filter(i => i >= 0);
    at.forEach(i => { CONVO[i].kind = 'marker'; });
    const draw = dir === 'type' ? typeCard : dir === 'folder' ? folderCard : shelfCard;
    markerR = (m, i) => m.key ? draw(O[m.key]) : baseMarker(m, i);
    let html = lanka('mf-dir-' + dir, { meta: 'top', fold: 'head', runs: 'separate' });
    at.forEach(i => { CONVO[i].kind = 'offer'; });
    if (dir === 'type') html = html.replace(/^<div class="vwrap ([^"]*)">/, (m) => m + filterBar());
    requestAnimationFrame(() => { following = true; stage.scrollTop = stage.scrollHeight; if (dir === 'type') applyTypeFilter(); });
    return html;
  }
  window.mfType = () => view('type');
  window.mfFolder = () => view('folder');
  window.mfShelf = () => view('shelf');
  window.__mf = { F, O, TY, FS, SH };
})();
