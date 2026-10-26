(() => {
  // Synthetic context of the open conversation, built the way the host could build it from
  // Pi's session file: the leading system message (prompt sections and tool declarations),
  // the messages of each turn, compaction entries (tokensBefore, summary, firstKeptEntryId,
  // details.readFiles/modifiedFiles) and each reply's measured usage. Category sizes are Pi's
  // own chars/4 estimate (estimateTokens); only the total is measured. The next compaction
  // follows Pi's prepareCompaction: keep the newest ~keepRecentTokens (20 000) from a turn
  // start, summarise everything from the previous kept boundary up to that cut.
  const RESERVE = 16384, KEEP = 20000;
  const MODEL = 'gpt-5.5';
  const SYS = [['Skillit', 10700], ['AGENTS.md ja projektin ohjeet', 4800], ['Habitatin ohje', 2100], ['Pi:n perusohje ja säännöt', 1300]];
  const TOOLS = [['bash', 520], ['read', 430], ['edit', 480], ['write', 310], ['process', 360]];
  const SYS_T = SYS.reduce((a, [, t]) => a + t, 0), TOOLS_T = TOOLS.reduce((a, [, t]) => a + t, 0), BASE = SYS_T + TOOLS_T;
  // [time, ask, user, reply, thinking, tool output, attachments, largest output]
  const T = [
    ['14.28', 'Tee status-skripti, joka kokoaa työtilan tilan yhdelle riville', 420, 900, 1600, 14200, 0, 'read src/status.ts'],
    ['14.31', 'Lisää git-haara ja likaisten tiedostojen määrä', 160, 700, 1100, 18800, 0, 'bash git log --stat -20'],
    ['14.36', 'Tässä kuvakaappaus terminaalista, rivi katkeaa väärin', 120, 800, 1300, 9200, 2400, 'read src/format.ts'],
    ['14.40', 'Aja testit', 40, 500, 600, 21600, 0, 'bash npm test'],
    ['14.43', 'Korjaa kaksi kaatuvaa testiä', 90, 1100, 2100, 16900, 0, 'bash npm test -- --reporter=verbose'],
    ['14.46', 'Lue CI:n loki ja kerro miksi maanantaina aikakatkaisu', 140, 1200, 1800, 26400, 0, 'read logs/ci-2026-10-19.txt'],
    ['14.48', 'Lisää aikavyöhyke tulosteeseen', 70, 900, 1400, 12100, 0, 'read src/time.ts'],
    ['14.49', 'Päivitä README:n esimerkit', 60, 1300, 700, 8800, 0, 'read README.md'],
    ['14.50', 'Aja koko testisarja uudelleen', 30, 400, 500, 22500, 0, 'bash npm test'],
    ['14.51', 'Tee JSON-tuloste --json-lipulla', 110, 1500, 2300, 7400, 0, 'read src/cli.ts'],
    ['14.52', 'Lisää skeema JSON-tulosteelle', 80, 1200, 1700, 7300, 0, 'write schema/status.json'],
    ['15.03', 'Testaa JSON-tuloste jq:lla', 50, 600, 800, 9700, 0, 'bash ./status --json | jq'],
    ['15.06', 'Viime viikon statusrivit JSONiksi', 90, 900, 1500, 18300, 0, 'bash ./status --since 7d --json'],
    ['15.10', 'Miksi välimuisti ei osu?', 50, 1400, 2600, 11200, 0, 'read src/cache.ts'],
    ['15.14', 'Korjaa välimuistin avain', 40, 800, 1300, 6900, 0, 'edit src/cache.ts'],
    ['15.17', 'Tässä toinen kuva, väri puuttuu tummassa teemassa', 110, 700, 1000, 5200, 2400, 'read src/color.ts'],
    ['15.21', 'Aja testit ja lint', 30, 500, 600, 19800, 0, 'bash npm test && npm run lint'],
    ['15.25', 'Lisää valinta --no-color', 60, 900, 1200, 7600, 0, 'edit src/cli.ts'],
    ['15.29', 'Käy läpi git diff ja siisti', 40, 1200, 1400, 14900, 0, 'bash git diff'],
    ['15.34', 'Lue issuen #42 kommentit', 50, 800, 900, 8800, 0, 'bash gh issue view 42 --comments'],
    ['15.38', 'Tee issuen pyytämä --quiet-tila', 70, 1100, 1700, 9600, 0, 'read src/cli.ts'],
    ['15.42', 'Aja koko testisarja', 30, 400, 500, 13300, 0, 'bash npm test'],
    ['15.45', 'Kirjoita muutoslokiin rivit', 50, 1300, 900, 4100, 0, 'read CHANGELOG.md'],
    ['15.48', 'Tee commit ja kerro mitä jäi auki', 60, 1600, 1200, 9000, 0, 'bash git commit'],
    ['15.53', 'Lisää vielä --since-lipulle ohjeteksti', 50, 900, 1100, 18800, 0, 'bash ./status --help'],
    ['15.57', 'Aja testit viimeisen kerran', 30, 500, 600, 25400, 0, 'bash npm test'],
  ].map(([time, ask, user, reply, think, out0, att, top], i) => {
    // Tuning: the first eleven turns cross Pi's threshold, the next thirteen settle near 75 %.
    const out = out0 + (i < 11 ? 4000 : i < 24 ? -1700 : 0);
    return {n: i + 1, time, ask, user, reply, think, out, att, top, talk: user + reply + think, size: user + reply + think + out + att};
  });

  const SUMMARY1 = {tokens: 6400, text: [
    ['Tavoite', 'Status-skripti, joka kokoaa työtilan tilan yhdelle riville ja JSONiksi.'],
    ['Tehty', 'Haara ja likaiset tiedostot riville; rivinkatkaisu korjattu; kaksi kaatuvaa testiä korjattu; aikavyöhyke tulosteeseen; README:n esimerkit päivitetty.'],
    ['Päätökset', 'CI:n maanantain aikakatkaisu johtuu viikon lokin kokoamisesta; jätetään issueksi. JSON-tuloste tulee --json-lipulla.'],
    ['Seuraavaksi', 'JSON-tulosteen skeema ja testaus jq:lla.'],
  ], read: ['src/status.ts', 'src/format.ts', 'src/time.ts', 'src/cli.ts', 'README.md', 'logs/ci-2026-10-19.txt', 'package.json'], modified: ['src/status.ts', 'src/format.ts', 'src/time.ts', 'README.md', 'test/status.test.ts']};
  const SUMMARY2 = {tokens: 7900, text: [
    ['Tavoite', 'Status-skripti, joka kokoaa työtilan tilan yhdelle riville ja JSONiksi.'],
    ['Tehty', 'Aiemman lisäksi: JSON-skeema, välimuistin avain korjattu, --no-color ja --quiet, tumman teeman väri, muutosloki ja commit.'],
    ['Päätökset', 'Issue #42 toteutetaan --quiet-tilana. Välimuistin avain sisältää nyt haaran.'],
    ['Seuraavaksi', '--since-lipun ohjeteksti.'],
  ], read: [...SUMMARY1.read, 'src/cache.ts', 'src/color.ts', 'schema/status.json', 'CHANGELOG.md'], modified: [...SUMMARY1.modified, 'src/cache.ts', 'src/color.ts', 'src/cli.ts', 'schema/status.json', 'CHANGELOG.md']};

  const sumSize = (from, to) => T.slice(from - 1, to).reduce((a, t) => a + t.size, 0);
  // Context after a turn, given the compactions so far: base + summary + turns since the kept boundary.
  function ctxAfter(n, comps) {
    const c = [...comps].reverse().find(x => x.after < n);
    return BASE + (c ? c.summary.tokens + sumSize(c.keep, n) : sumSize(1, n));
  }
  // Pi's cut: walk back from the newest turn until KEEP is reached, cut at that turn start.
  function cut(from, last) { let acc = 0; for (let n = last; n >= from; n--) { acc += T[n - 1].size; if (acc >= KEEP) return n; } return from; }

  const C1 = {n: 1, after: 11, keep: cut(1, 11), time: '14.52', summary: SUMMARY1, reason: 'Automaattinen: raja ylittyi'};
  C1.before = ctxAfter(11, []);
  const C2 = {n: 2, after: 24, time: '15.49', summary: SUMMARY2, reason: 'Käsin: /compact'};
  C2.keep = cut(C1.keep, 24); C2.before = ctxAfter(24, [C1]);

  const SCENES = {
    near: ['Keskellä työtä (yksi tiivistys takana)', {last: 24, comps: [C1]}],
    limit: ['Lähellä tiivistysrajaa', {last: 26, comps: [C1]}],
    early: ['Alussa, ei tiivistyksiä', {last: 3, comps: []}],
    after: ['Juuri tiivistetty (koko ”?”)', {last: 24, comps: [C1, C2], after: true}],
    nowindow: ['Ikkunan koko ei tiedossa', {last: 24, comps: [C1], window: 0}],
  };
  let D = null, scene = 'near', variant = 'pop', open = false;

  // ---------- The context the host would derive ----------
  function derive(name) {
    const s = SCENES[name][1];
    const last = s.last, comps = s.comps;
    const turns = T.slice(0, last);
    const window = s.window ?? 272000;
    const lastC = comps[comps.length - 1];
    const keepFrom = lastC ? lastC.keep : 1;
    const live = turns.filter(t => t.n >= keepFrom);
    const total = ctxAfter(last, comps);
    const cats = [
      {k: 'sys', name: 'Ohjeet ja järjestelmäkehote', t: SYS_T, parts: SYS, note: 'Pi:n kehoteosiot sessiotiedoston system-viestistä'},
      {k: 'tools', name: 'Työkalujen kuvaukset', t: TOOLS_T, parts: TOOLS, note: `${TOOLS.length} työkalua: ${TOOLS.map(([n]) => n).join(', ')}`},
      ...(lastC ? [{k: 'sum', name: 'Tiivistelmä', t: lastC.summary.tokens, note: `Tiivistys ${lastC.n} klo ${lastC.time}, vuorot 1–${lastC.keep - 1}`}] : []),
      {k: 'talk', name: 'Keskustelu', t: live.reduce((a, x) => a + x.talk, 0), parts: [['Viestisi', live.reduce((a, x) => a + x.user, 0)], ['Vastaukset', live.reduce((a, x) => a + x.reply, 0)], ['Ajattelu', live.reduce((a, x) => a + x.think, 0)]]},
      {k: 'out', name: 'Työkalujen tulosteet', t: live.reduce((a, x) => a + x.out, 0), parts: [...live].sort((a, b) => b.out - a.out).slice(0, 4).map(x => [`${x.top} · vuoro ${x.n}`, x.out]), mono: true},
      {k: 'att', name: 'Liitteet', t: live.reduce((a, x) => a + x.att, 0), note: live.some(x => x.att) ? `${live.filter(x => x.att).length} kuvakaappausta` : 'ei liitteitä'},
    ];
    const at = window > 0 ? window - RESERVE : null;
    // Per-turn context history: measured after each reply; compaction drops it.
    const hist = turns.map(t => ({...t, ctx: ctxAfter(t.n, comps.filter(c => c.after < t.n))}));
    hist.forEach((h, i) => { const prev = i ? hist[i - 1].ctx : BASE; h.cached = Math.round(Math.min(prev, h.ctx) * .94); h.fresh = h.ctx - h.cached - (h.reply + h.think); h.output = h.reply + h.think; h.grow = h.ctx - (i ? hist[i - 1].ctx : 0); });
    // Next compaction: from the kept boundary to Pi's cut point.
    const nextCut = cut(keepFrom, last);
    const next = {from: keepFrom, to: nextCut - 1, keep: nextCut, dropped: sumSize(keepFrom, nextCut - 1), kept: sumSize(nextCut, last)};
    next.after = BASE + (lastC ? lastC.summary.tokens : 0) + 1500 + next.kept;
    return {name, last, window, total: s.after ? null : total, estimate: s.after ? BASE + C2.summary.tokens + sumSize(C2.keep, 24) : null, cats, at, hist, comps, next, after: !!s.after};
  }
  const nb = ' ';
  const full = (n) => Math.round(n).toLocaleString('fi-FI');
  const kt = (n) => n >= 1000 ? `${(n / 1000).toLocaleString('fi-FI', {maximumFractionDigits: n >= 100000 ? 0 : 1})}k` : String(n);
  const pc = (p) => `${p > 0 && p < 1 ? '<1' : Math.round(p)}${nb}%`;
  function info() {
    const d = D, t = d.total, w = d.window;
    const pct = w > 0 && t != null ? t / w * 100 : null;
    const atPct = d.at ? d.at / w * 100 : null;
    const level = d.after ? 'after' : !(w > 0) ? 'nowindow' : pct >= 90 ? 'critical' : pct >= 70 ? 'near' : 'ok';
    return {t, w, pct, atPct, level};
  }
  function sentence(i) {
    if (i.level === 'after') return 'Historia tiivistettiin juuri. Pi mittaa uuden koon seuraavasta vastauksesta.';
    if (i.level === 'nowindow') return `${full(i.t)} tokenia käytössä. Mallin kontekstin kokoa ei tiedetä.`;
    return `Konteksti ${pc(i.pct)}: ${full(i.t)} / ${full(i.w)} tokenia. Pi tiivistää vanhemman historian, kun noin ${pc(i.atPct)} täyttyy.`;
  }

  // ---------- Ring (accepted basic level, Rengas) ----------
  function ringSvg(i) {
    const p = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [(10 + r * Math.cos(a)).toFixed(2), (10 + r * Math.sin(a)).toFixed(2)]; };
    const arc = i.pct != null ? `<circle class="arc" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${Math.min(100, i.pct).toFixed(1)} 100" transform="rotate(-90 10 10)"/>` : '';
    let tick = '';
    if (i.atPct != null && i.level !== 'after') { const [x1, y1] = p(4.6, i.atPct * 3.6), [x2, y2] = p(9.4, i.atPct * 3.6); tick = `<line class="tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
    return `<svg class="ctx-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="trk" cx="10" cy="10" r="7"/>${arc}${tick}</svg>`;
  }
  const ringText = (i) => i.level === 'after' ? '?' : i.level === 'nowindow' ? kt(i.t) : pc(i.pct);
  const ringBtn = (i) => `<button type="button" class="ctx-ringbtn" data-ctx data-level="${i.level}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${sentence(i)} Avaa kontekstin erittely." title="${sentence(i)}">${ringSvg(i)}<span class="ctx-val">${ringText(i)}</span></button>`;

  // ---------- Shared pieces ----------
  const cats = () => D.cats;
  const catTotal = () => cats().reduce((a, c) => a + c.t, 0);
  // The bar's scale is the window when known; otherwise the content itself.
  function bar(opts = {}) {
    const i = info(), cs = cats(), scale = i.w > 0 ? i.w : catTotal();
    const segs = cs.filter(c => c.t > 0).map(c => `<i class="seg" data-k="${c.k}" style="width:${(c.t / scale * 100).toFixed(2)}%"></i>`).join('');
    const reserve = i.w > 0 ? `<i class="reserve" style="width:${(RESERVE / i.w * 100).toFixed(2)}%"></i>` : '';
    const tick = i.atPct != null ? `<b class="at" style="left:${i.atPct.toFixed(2)}%"></b>` : '';
    const next = opts.next && i.w > 0 && !D.after ? `<i class="next-after" style="left:${(D.next.after / i.w * 100).toFixed(2)}%"></i>` : '';
    return `<div class="cd-bar${D.after ? ' est' : ''}" role="img" aria-label="${barLabel()}"><span class="segs">${segs}</span>${reserve}${tick}${next}</div>`;
  }
  const barLabel = () => cats().filter(c => c.t > 0).map(c => `${c.name} ${D.after ? 'noin ' : ''}${full(c.t)}`).join(', ') + ' tokenia';
  const sw = (k) => `<span class="sw" data-k="${k}" aria-hidden="true"></span>`;
  function head(opts = {}) {
    const i = info();
    const big = i.level === 'after' ? `? <span>arvio noin ${full(D.estimate)} tokenia</span>` : i.level === 'nowindow' ? `${full(i.t)} <span>tokenia · ikkuna ei tiedossa</span>` : `${pc(i.pct)} <span>${full(i.t)} / ${full(i.w)} tokenia</span>`;
    const tail = i.level === 'after' ? 'Pi mittaa koon seuraavasta vastauksesta; osuudet ovat arvioita.' : i.level === 'nowindow' ? 'Tiivistysrajaa ei voi laskea ilman ikkunan kokoa.' : `${full(D.at - i.t)} tokenia tilaa ennen tiivistystä (raja ${full(D.at)}).`;
    return `<p class="cd-big" data-level="${i.level}">${big}</p>${opts.bar === false ? '' : bar(opts)}<p class="cd-lead">${tail}</p>`;
  }
  function legend(opts = {}) {
    const cs = cats(), tot = catTotal();
    return `<ul class="cd-legend${opts.compact ? ' compact' : ''}">${cs.map((c, ix) => {
      const id = `cd-cat-${variant}-${c.k}`;
      const sub = opts.expand && (c.parts || c.note) ? `<div class="cd-sub" id="${id}" hidden>${c.note ? `<p>${c.note}</p>` : ''}${c.parts ? `<ul>${c.parts.map(([n, t]) => `<li><span class="${c.mono ? 'mono' : ''}">${esc(n)}</span><span class="num">${full(t)}</span></li>`).join('')}</ul>` : ''}</div>` : '';
      const label = `${sw(c.k)}<span class="nm">${c.name}</span><span class="num">${D.after ? '≈ ' : ''}${opts.compact ? kt(c.t) : full(c.t)}</span><span class="pct">${tot ? pc(c.t / tot * 100) : ''}</span>`;
      return `<li data-k="${c.k}">${sub ? `<button type="button" class="cd-row" aria-expanded="false" aria-controls="${id}">${label}${CHEV}</button>${sub}` : `<div class="cd-row">${label}</div>`}</li>`;
    }).join('')}</ul>`;
  }
  const CHEV = '<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function nextSentence(short) {
    const i = info(), n = D.next;
    if (D.after) return 'Juuri tiivistetty: vuorot ' + `1–${C2.keep - 1} ovat nyt tiivistelmässä ja vuorot ${C2.keep}–24 sellaisinaan.`;
    const range = n.to >= n.from ? `vuorot ${n.from}–${n.to} (${kt(n.dropped)})` : 'ei vielä mitään';
    const when = i.level === 'nowindow' ? 'Tiivistyksen hetkeä ei tiedetä.' : i.level === 'critical' ? 'Pi tiivistää todennäköisesti seuraavan vuoron jälkeen.' : `Pi tiivistää, kun käyttö ylittää ${full(D.at)} tokenia.`;
    if (short) return `Seuraava tiivistys korvaa ${range} yhteenvedolla ja säilyttää vuorot ${n.keep}–${D.last}.`;
    return `${when} Silloin ${range} korvautuvat yhteenvedolla${D.comps.length ? ', joka päivittää edellisen tiivistelmän' : ''}. Vuorot ${n.keep}–${D.last} (${kt(n.kept)}) säilyvät sellaisinaan. Tiivistyksen jälkeen kooksi arvioidaan noin ${kt(n.after)}.`;
  }
  // Turns as a strip: summarised (in a summary), to be summarised next, kept.
  function strip() {
    const lastC = D.comps[D.comps.length - 1], keepFrom = lastC ? lastC.keep : 1;
    const cells = D.hist.map(h => {
      const st = h.n < keepFrom ? 'gone' : D.after ? 'kept' : h.n < D.next.keep ? 'next' : 'kept';
      return `<i data-st="${st}" title="Vuoro ${h.n} · ${kt(h.size)}" style="flex-grow:${Math.max(1, Math.round(h.size / 1000))}"></i>`;
    }).join('');
    return `<div class="cd-strip" aria-hidden="true">${cells}</div><p class="cd-keys"><span><i data-st="gone"></i>Jo tiivistelmässä</span>${D.after ? '' : '<span><i data-st="next"></i>Tiivistyy seuraavaksi</span>'}<span><i data-st="kept"></i>Säilyy</span></p>`;
  }
  // Context size after each reply; compaction shows as a drop. The threshold is the dashed line.
  function chart(opts = {}) {
    const i = info(), h = D.hist, W = opts.w ?? 320, H = opts.h ?? 92, top = Math.max(i.w || 0, ...h.map(x => x.ctx)) * 1.02;
    const bw = W / h.length;
    const bars = h.map((x, k) => {
      const bh = x.ctx / top * (H - 4), y = H - bh;
      const comp = D.comps.find(c => c.after === x.n);
      return `<rect class="b${comp ? ' c' : ''}" x="${(k * bw + 1).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}"><title>Vuoro ${x.n} klo ${x.time}: ${full(x.ctx)} tokenia${comp ? ', tämän jälkeen tiivistys' : ''}</title></rect>`;
    }).join('');
    const line = i.atPct != null ? `<line class="at" x1="0" x2="${W}" y1="${(H - D.at / top * (H - 4)).toFixed(1)}" y2="${(H - D.at / top * (H - 4)).toFixed(1)}"/>` : '';
    const marks = D.comps.map(c => { const k = h.findIndex(x => x.n === c.after); return k < 0 ? '' : `<line class="cmp" x1="${((k + 1) * bw).toFixed(1)}" x2="${((k + 1) * bw).toFixed(1)}" y1="0" y2="${H}"/>`; }).join('');
    const label = `Kontekstin koko vuoroittain: ${h.map(x => `${x.n}: ${kt(x.ctx)}`).join(', ')}.`;
    return `<svg class="cd-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${label}">${bars}${line}${marks}</svg>`;
  }
  function compList(opts = {}) {
    if (!D.comps.length) return `<p class="cd-empty">Ei tiivistyksiä tässä keskustelussa.</p>`;
    return `<ol class="cd-comps">${[...D.comps].reverse().map(c => {
      const after = D.hist.find(x => x.n === c.after + 1);
      const afterTxt = after ? `${kt(after.ctx)} seuraavassa vastauksessa` : 'koko seuraavasta vastauksesta';
      const id = `cd-sum-${variant}-${c.n}`;
      const body = `<dl class="cd-sumtext">${c.summary.text.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="cd-files"><span>Luetut ${c.summary.read.length}</span> <span class="mono">${c.summary.read.slice(0, 4).join(', ')}${c.summary.read.length > 4 ? ' …' : ''}</span></p><p class="cd-files"><span>Muutetut ${c.summary.modified.length}</span> <span class="mono">${c.summary.modified.slice(0, 4).join(', ')}${c.summary.modified.length > 4 ? ' …' : ''}</span></p>`;
      return `<li><div class="cd-comp-h"><strong>Tiivistys ${c.n}</strong><span>klo ${c.time} · vuorot 1–${c.keep - 1}</span></div><p class="cd-comp-n"><span class="num">${kt(c.before)} → ${afterTxt}</span></p><p class="cd-comp-r">${c.reason} · yhteenveto ${full(c.summary.tokens)} tokenia</p>${opts.full ? body : opts.short ? '' : `<button type="button" class="cd-more" aria-expanded="false" aria-controls="${id}">Näytä tiivistelmä</button><div id="${id}" hidden>${body}</div>`}</li>`;
    }).join('')}</ol>`;
  }
  function turnRows(n) {
    return `<ol class="cd-turns">${D.hist.slice(-n).reverse().map(h => `<li><span class="t">${h.n}</span><span class="a">${esc(h.ask)}</span><span class="num">+${kt(Math.max(0, h.size))}</span></li>`).join('')}</ol>`;
  }
  const meta = () => `<p class="cd-meta"><span class="mono">${MODEL}</span> · ikkuna ${D.window > 0 ? full(D.window) : 'ei tiedossa'} · vara ${full(RESERVE)} · säilytettävä ${full(KEEP)}</p>`;

  // ---------- 1 Ponnahdus ----------
  function popHtml() {
    return `<div class="cd-pop-h"><h3 id="cd-title" tabindex="-1">Konteksti</h3><button type="button" class="icon-btn cd-close" data-cd-close aria-label="Sulje">${ICON_CLOSE}</button></div>
${head()}${legend({compact: true})}
<h4>Seuraava tiivistys</h4><p class="cd-text">${nextSentence(true)}</p>
<h4>Koko vuoroittain</h4>${chart({h: 56})}
<p class="cd-text sub">${D.comps.length ? `${D.comps.length} tiivistys${D.comps.length > 1 ? 'tä' : ''}, viimeksi klo ${D.comps[D.comps.length - 1].time} (${kt(D.comps[D.comps.length - 1].before)} → yhteenveto).` : 'Ei tiivistyksiä vielä.'} ${D.hist.length} vuoroa.</p>`;
  }
  // ---------- 2 Paneeli ----------
  function panelHtml() {
    return `<div class="cd-panel-h"><h3 id="cd-title" tabindex="-1">Konteksti</h3><button type="button" class="icon-btn cd-close" data-cd-close aria-label="Sulje paneeli">${ICON_CLOSE}</button></div>
<div class="cd-scroll">${head({next: true})}${meta()}
<section><h4>Mistä se koostuu</h4>${legend({expand: true})}<p class="cd-fine">${D.after ? 'Tiivistyksen jälkeen kokonaismääräkin on arvio, kunnes Pi mittaa sen seuraavasta vastauksesta.' : 'Kokonaismäärä on Pi:n mittaama, osuudet merkkimäärästä arvioituja.'}</p></section>
<section><h4>Seuraava tiivistys</h4>${strip()}<p class="cd-text">${nextSentence()}</p></section>
<section><h4>Koko vuoroittain</h4>${chart()}<p class="cd-fine">Pystyviiva on tiivistys, katkoviiva tiivistysraja.</p>${turnRows(5)}</section>
<section><h4>Tiivistykset</h4>${compList()}</section></div>`;
  }
  // ---------- 3 Kartta ----------
  function mapHtml() {
    const lastC = D.after ? C2 : D.comps[D.comps.length - 1], keepFrom = lastC ? lastC.keep : 1, i = info();
    const max = Math.max(...D.hist.map(h => h.size), SYS_T);
    const w = (t) => `${Math.max(1.5, t / max * 100).toFixed(1)}%`;
    const turn = (h) => `<li class="cd-mrow" data-st="${h.n < keepFrom ? 'gone' : !D.after && h.n < D.next.keep ? 'next' : 'kept'}"><button type="button" class="cd-mbtn" data-turn="${h.n}"><span class="t">${h.n}</span><span class="a"><span class="tm">${h.time}</span>${esc(h.ask)}</span><span class="mbar" aria-hidden="true"><i data-k="talk" style="width:${w(h.talk)}"></i><i data-k="out" style="width:${w(h.out)}"></i>${h.att ? `<i data-k="att" style="width:${w(h.att)}"></i>` : ''}</span><span class="num">${kt(h.size)}</span></button></li>`;
    const live = D.hist.filter(h => h.n >= keepFrom);
    const nextT = D.after ? [] : live.filter(h => h.n < D.next.keep), kept = D.after ? live : live.filter(h => h.n >= D.next.keep);
    const fixed = `<li class="cd-mrow" data-st="fixed"><div class="cd-mbtn"><span class="t">${sw('sys')}</span><span class="a">Ohjeet ja järjestelmäkehote<span class="tm">skillit, AGENTS.md, Habitat, Pi</span></span><span class="mbar" aria-hidden="true"><i data-k="sys" style="width:${w(SYS_T)}"></i></span><span class="num">${kt(SYS_T)}</span></div></li>
<li class="cd-mrow" data-st="fixed"><div class="cd-mbtn"><span class="t">${sw('tools')}</span><span class="a">Työkalujen kuvaukset<span class="tm">${TOOLS.length} työkalua</span></span><span class="mbar" aria-hidden="true"><i data-k="tools" style="width:${w(TOOLS_T)}"></i></span><span class="num">${kt(TOOLS_T)}</span></div></li>`;
    const sum = lastC ? `<li class="cd-mrow" data-st="sum"><button type="button" class="cd-mbtn" aria-expanded="false" aria-controls="cd-map-sum"><span class="t">${sw('sum')}</span><span class="a">Tiivistelmä ${lastC.n} · vuorot 1–${lastC.keep - 1}<span class="tm">klo ${lastC.time} · ${kt(lastC.before)} tiivistettiin</span></span><span class="mbar" aria-hidden="true"><i data-k="sum" style="width:${w(lastC.summary.tokens)}"></i></span><span class="num">${kt(lastC.summary.tokens)}</span></button><div class="cd-mpanel" id="cd-map-sum" hidden><dl class="cd-sumtext">${lastC.summary.text.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div></li>` : '';
    const room = i.w > 0 && !D.after ? `<li class="cd-mrow" data-st="room"><div class="cd-mbtn"><span class="t"></span><span class="a">Tilaa ennen tiivistystä<span class="tm">ja ${full(RESERVE)} tokenin vara vastaukselle</span></span><span class="mbar" aria-hidden="true"></span><span class="num">${kt(D.at - i.t)}</span></div></li>` : '';
    return `<div class="cd-map" role="region" aria-labelledby="cd-title">
<div class="cd-map-h"><div><h3 id="cd-title" tabindex="-1">Konteksti vuoroittain</h3>${head({bar: false})}</div><button type="button" class="secondary" data-cd-close>Takaisin keskusteluun</button></div>
${bar({next: true})}
<p class="cd-legend-inline">${cats().filter(c => c.t > 0).map(c => `<span>${sw(c.k)}${c.name} ${kt(c.t)}</span>`).join('')}</p>
<h4>Aina mukana</h4><ul class="cd-mlist">${fixed}</ul>
${sum ? `<h4>Aiemmin tiivistetty</h4><ul class="cd-mlist">${sum}</ul>` : ''}
${nextT.length ? `<div class="cd-group" data-st="next"><h4>Tiivistyy seuraavaksi <span>${kt(D.next.dropped)} · ${nextT.length} vuoroa</span></h4><p class="cd-text">${info().level === 'nowindow' ? 'Kun Pi tiivistää' : 'Kun käyttö ylittää rajan'}, nämä vuorot korvautuvat yhteenvedolla. Ne jäävät sessiotiedostoon ja näkyvät keskustelussa, mutta malli ei enää näe niitä sellaisinaan.</p><ol class="cd-mlist">${nextT.map(turn).join('')}</ol></div>` : ''}
<div class="cd-group" data-st="kept"><h4>Säilyy sellaisenaan <span>${kt(kept.reduce((a, h) => a + h.size, 0))} · ${kept.length} vuoroa</span></h4><ol class="cd-mlist">${kept.map(turn).join('')}</ol></div>
${room ? `<ul class="cd-mlist">${room}</ul>` : ''}
<p class="cd-fine">Rivin palkki: keskustelu, työkalujen tulosteet ja liitteet. Rivin painallus vie vuoroon keskustelussa.</p></div>`;
  }
  // ---------- 4 Sivu ----------
  function pageHtml() {
    const cs = cats(), tot = catTotal();
    const rows = cs.map(c => `<tr class="cat"><th scope="row">${sw(c.k)}${c.name}</th><td class="num">${D.after ? '≈ ' : ''}${full(c.t)}</td><td class="num">${tot ? pc(c.t / tot * 100) : ''}</td></tr>${(c.parts || []).map(([n, t]) => `<tr class="part"><th scope="row"><span class="${c.mono ? 'mono' : ''}">${esc(n)}</span></th><td class="num">${full(t)}</td><td></td></tr>`).join('')}${c.note && !c.parts ? `<tr class="part"><th scope="row" colspan="3"><span class="sub">${c.note}</span></th></tr>` : ''}`).join('');
    const turns = D.hist.map(h => {
      const c = D.comps.find(x => x.after === h.n);
      return `<tr><th scope="row" class="num">${h.n}</th><td>${h.time}</td><td class="ask">${esc(h.ask)}</td><td class="num">${full(h.ctx)}</td><td class="num">${h.n === 1 ? '' : (h.grow >= 0 ? '+' : '−') + kt(Math.abs(h.grow))}</td><td class="num opt">${full(Math.max(0, h.fresh))}</td><td class="num opt">${full(h.cached)}</td><td class="num opt">${full(h.output)}</td></tr>${c ? `<tr class="cmp"><td colspan="8">Tiivistys ${c.n} klo ${c.time}: ${full(c.before)} tokenia → yhteenveto ${full(c.summary.tokens)} ja vuorot ${c.keep}–${c.after}</td></tr>` : ''}`;
    }).join('');
    return `<div class="cd-page" role="region" aria-labelledby="cd-title">
<div class="cd-page-h"><button type="button" class="cd-back" data-cd-close>‹ Status-skripti</button><h3 id="cd-title" tabindex="-1">Konteksti</h3></div>
<div class="cd-page-top">${head({next: true})}${meta()}</div>
<div class="cd-grid">
<section><h4>Mistä se koostuu</h4><table class="cd-table"><thead><tr><th scope="col">Osa</th><th scope="col" class="num">Tokenia</th><th scope="col" class="num">Osuus</th></tr></thead><tbody>${rows}</tbody></table><p class="cd-fine">${D.after ? 'Tiivistyksen jälkeen kokonaismääräkin on arvio, kunnes Pi mittaa sen seuraavasta vastauksesta.' : 'Kokonaismäärä on Pi:n mittaama viimeisestä vastauksesta.'} Osuudet ovat Pi:n omaa arviota (merkit / 4) sessiotiedoston sisällöstä, skaalattuna mitattuun summaan.</p></section>
<section><h4>Seuraava tiivistys</h4>${strip()}<p class="cd-text">${nextSentence()}</p><h4>Tiivistykset</h4>${compList({full: true})}</section>
</div>
<section><h4>Vuorot</h4>${chart({w: 900, h: 110})}<div class="cd-tablewrap"><table class="cd-table turns"><thead><tr><th scope="col" class="num">#</th><th scope="col">Aika</th><th scope="col">Pyyntö</th><th scope="col" class="num">Konteksti</th><th scope="col" class="num">Muutos</th><th scope="col" class="num opt">Uusi syöte</th><th scope="col" class="num opt">Välimuistista</th><th scope="col" class="num opt">Tuotos</th></tr></thead><tbody>${turns}</tbody></table></div>
<p class="cd-fine">Kustannus: ${MODEL} tilauksen kautta, Pi kirjaa vuorokohtaiseksi hinnaksi 0. API-avaimella sama sarake näyttäisi Pi:n hinnan.</p></section></div>`;
  }

  // ---------- Placement ----------
  APP.actions = (c) => {
    let html = topActions(c).replace('>gpt-5.5<', `>${MODEL}<`);
    if (c.id === 'c1' && UI.sel === 'c1') html = ringBtn(info()) + html;
    return html;
  };
  const host = document.createElement('div'); host.className = 'cd-host'; host.hidden = true;
  host.setAttribute('role', 'dialog'); host.setAttribute('aria-labelledby', 'cd-title');
  uiMain.appendChild(host);
  const side = document.createElement('aside'); side.className = 'cd-side'; side.hidden = true; side.setAttribute('aria-labelledby', 'cd-title');
  uiBody.appendChild(side);
  const page = document.createElement('div'); page.className = 'cd-pagehost'; page.hidden = true;
  uiBody.appendChild(page);
  let mapShown = false;
  function paintDetail() {
    host.hidden = !(open && variant === 'pop'); side.hidden = !(open && variant === 'panel'); page.hidden = !(open && variant === 'page');
    uiCol.hidden = open && variant === 'page';
    uiFrame.classList.toggle('cd-panel-open', open && variant === 'panel');
    uiFrame.classList.toggle('cd-map-open', open && variant === 'map');
    // Other repaints (menus closing on any click) must not reset open disclosures.
    const key = `${variant}|${scene}`;
    const fill = (el, html) => { if (el.dataset.key !== key) { el.innerHTML = html(); el.dataset.key = key; } };
    for (const el of [host, side, page]) if (el.hidden && el.dataset.key) { el.dataset.key = ''; el.innerHTML = ''; }
    if (!host.hidden) { host.className = 'cd-host popover'; fill(host, popHtml); }
    if (!side.hidden) fill(side, panelHtml);
    if (!page.hidden) fill(page, pageHtml);
    const wantMap = open && variant === 'map';
    // The map is read from the top; the stage would otherwise keep following the bottom.
    if (wantMap && (!mapShown || stage.dataset.key !== `${scene}`)) { stage.innerHTML = mapHtml(); stage.dataset.key = scene; mapShown = true; following = false; stage.scrollTop = 0; }
    else if (!wantMap && mapShown) { mapShown = false; stage.dataset.key = ''; following = true; stage.innerHTML = content(); }
  }
  // Restoring the thread restarts its live turn, which repaints the top bar and drops the
  // focus just returned to the ring; repaints shortly after closing put it back.
  let refocusUntil = 0;
  const refocus = () => { if (performance.now() < refocusUntil && (document.activeElement === document.body || !document.activeElement)) document.querySelector('[data-ctx]')?.focus(); };
  APP.painted.push(paintDetail, refocus);
  function setOpen(v, back) {
    open = v; refocusUntil = !v && back ? performance.now() + 1500 : 0; paint();
    if (open) {
      const take = () => { const t = document.getElementById('cd-title'); if (open && t && document.activeElement !== t && !t.contains(document.activeElement) && !document.activeElement?.closest('.cd-host, .cd-side, .cd-map, .cd-page')) t.focus(); };
      requestAnimationFrame(take); setTimeout(take, 120); setTimeout(take, 400);
    }
    else if (back) document.querySelector('[data-ctx]')?.focus();
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.proto-picker')) return;
    if (e.target.closest('[data-ctx]')) { e.preventDefault(); e.stopPropagation(); UI.pop = false; setOpen(!open, !open ? false : true); return; }
    if (e.target.closest('[data-cd-close]')) { e.preventDefault(); setOpen(false, true); return; }
    const turn = e.target.closest('[data-turn]');
    if (turn) { toast(`Prototyypissä ei hypätä: tuotannossa tämä vie vuoroon ${turn.dataset.turn} keskustelussa.`); return; }
    const disc = e.target.closest('.cd-host [aria-expanded][aria-controls], .cd-side [aria-expanded][aria-controls], .cd-pagehost [aria-expanded][aria-controls]');
    if (disc) { e.stopPropagation(); const o = disc.getAttribute('aria-expanded') === 'true'; disc.setAttribute('aria-expanded', String(!o)); document.getElementById(disc.getAttribute('aria-controls')).hidden = o; if (disc.classList.contains('cd-more')) disc.textContent = o ? 'Näytä tiivistelmä' : 'Piilota tiivistelmä'; return; }
    if (open && variant === 'pop' && !e.target.closest('.cd-host')) setOpen(false, false);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.stopImmediatePropagation(); setOpen(false, true); } }, true);

  // ---------- Lab controls ----------
  const controls = document.createElement('section');
  controls.className = 'ctx-controls'; controls.setAttribute('aria-label', 'Prototyypin tilanteet');
  controls.innerHTML = `<label>Tilanne <select id="ctx-scene">${Object.entries(SCENES).map(([k, [l]]) => `<option value="${k}"${k === scene ? ' selected' : ''}>${l}</option>`).join('')}</select></label><button type="button" id="ctx-open">Avaa erittely</button><p>Synteettinen keskustelu, ${MODEL} (272 000 tokenia). Pi:n omat säännöt: tiivistys, kun ikkunasta on jäljellä alle ${full(RESERVE)} tokenia; tiivistys säilyttää uusimmat noin ${full(KEEP)} tokenia vuoron alusta.</p>`;
  document.querySelector('.frame-wrap').before(controls);
  controls.querySelector('#ctx-scene').addEventListener('change', (e) => { scene = e.target.value; D = derive(scene); paint(); });
  controls.querySelector('#ctx-open').addEventListener('click', () => { if (!open) setOpen(true); });

  function start(v) { variant = v; open = false; mapShown = false; UI.sel = 'c1'; D = derive(scene); return appView(); }
  window.cdPop = () => start('pop');
  window.cdPanel = () => start('panel');
  window.cdMap = () => start('map');
  window.cdPage = () => start('page');
  window.__cd = {derive: (n) => derive(n), T, C1, C2};
  D = derive(scene);
})();
