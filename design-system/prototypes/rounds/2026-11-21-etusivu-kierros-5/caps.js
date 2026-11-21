// The capabilities section, the same in all three variants: what an agent on
// an operating system can do. 56 capabilities in eight groups; each group is
// one story (the product's screen shows the request and the result as one
// scrolls) with a few shown in full, and the rest in a list the reader opens.
// Examples are fictional (Example Studio, invented schools, clubs and offices).
// Mock views here are also used by roles.js.

// ---------- Mock views ----------
const sw = (inner, cls = '', vb = '0 0 320 200') => `<svg class="mk ${cls}" viewBox="${vb}" role="img" aria-hidden="true">${inner}</svg>`;
const toggles = (opts, cur) => `<p class="tg">${opts.map(([v, l, label]) => `<button type="button" data-set="${v}" aria-pressed="${v === cur}"${label ? ` data-label="${esc(label)}"` : ''}>${esc(l)}</button>`).join('')}</p>`;

// 2 Speech to text: a board meeting, speakers named.
const BOARD = { Mallory: 'a', Victor: 'b', Wendy: 'c' };
// 24 One song, three tracks: press a track to hear which is which.
const stemsMock = () => `<div class="stems" data-view data-state="mix">${toggles([['mix', 'Original', 'Playing: the original recording'], ['backing', 'Backing only', 'Playing: the backing track, no voice'], ['vocal', 'Vocal only', 'Playing: the voice on its own']], 'mix')}${['backing', 'vocal'].map((k) => `<div class="stem stem-${k}"><span>${k === 'backing' ? 'Piano, bass, drums' : 'Teacher’s voice'}</span><i aria-hidden="true">${Array.from({ length: 48 }, (_, j) => `<b style="--h:${k === 'vocal' ? (j % 7 < 4 ? 20 + ((j * 29) % 70) : 6) : 30 + ((j * 53) % 60)}%"></b>`).join('')}</i></div>`).join('')}<p class="stems-n" data-label>Playing: the original recording</p></div>`;
// 3 Background removal: before and after, and the contact sheet with one flagged.
const ITEM_SHAPES = ['mug', 'tote', 'jar', 'lamp', 'mug', 'bowl', 'tote', 'jar', 'bowl', 'lamp', 'mug', 'tote'];
const item = (k, i) => `<span class="it it-${k}" style="--c:${['#b45a33', '#3e5b6e', '#31553a', '#8c6f4e', '#2f4f73'][i % 5]}"></span>`;
const cutoutMock = (n = 96, flagged = 4) => `<div class="cut" data-view data-state="after">${toggles([['before', 'As photographed'], ['after', 'For the shop']], 'after')}<div class="cut-pair"><div class="cut-ph">${item('mug', 0)}</div></div><p class="cut-h">Contact sheet · ${n} items · ${flagged} to check</p><div class="cut-grid">${ITEM_SHAPES.map((k, i) => `<span class="cut-c${i === 7 ? ' flag' : ''}">${item(k, i)}</span>`).join('')}</div></div>`;
// 11 A small blurry crest, traced into curves.
const crest = '<path d="M50 8 86 20v28c0 22-16 36-36 44C30 84 14 70 14 48V20z" fill="#2f4f73"/><path d="M28 58c8-6 14-6 22 0s14 6 22 0" stroke="#e9e1d2" stroke-width="5" fill="none"/><path d="M32 40h36M50 26v28" stroke="#e9e1d2" stroke-width="5"/>';
const pixelCrest = () => { let r = ''; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const cx = x * 8 + 4, cy = y * 8 + 4; const inS = cy > 8 && cy < 88 && Math.abs(cx - 50) < 36 - Math.max(0, cy - 52) * 0.8; if (!inS) continue; const light = (Math.abs(cy - 44) < 5 && Math.abs(cx - 50) < 20) || (Math.abs(cx - 50) < 4 && cy > 24 && cy < 56) || (cy > 54 && cy < 64 && (x + y) % 3 === 0); r += `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${light ? '#c9c3b5' : ['#2f4f73', '#36577c', '#284766'][(x * 7 + y * 3) % 3]}"/>`; } return r; };
const vectorMock = () => `<div class="vec" data-view data-state="vector">${toggles([['original', 'crest-2008.jpg · 300 px'], ['vector', 'crest.svg']], 'vector')}<div class="vec-b"><svg class="vec-o" viewBox="0 0 100 100" shape-rendering="crispEdges" aria-hidden="true">${pixelCrest()}</svg><svg class="vec-v" viewBox="0 0 100 100" aria-hidden="true">${crest}</svg></div><p class="vec-n">Sharp at two metres · SVG, PDF, transparent PNG · light and dark backgrounds</p></div>`;
// 5 A turntable render: a shelf that turns, in oak or black.
const turntableMock = () => `<div class="tt" data-view data-state="oak">${toggles([['oak', 'Oak'], ['black', 'Black']], 'oak')}<div class="tt-stage"><div class="tt-spin"><div class="tt-shelf">${['f', 'b', 'l', 'r', 't', 'm', 'd'].map((f) => `<i class="tt-${f}"></i>`).join('')}</div></div><span class="tt-floor" aria-hidden="true"></span></div><p class="tt-n"><span>shelf-oak.mp4 · 8 s · 192 frames</span><span>6 stills, 2400 × 2400</span></p></div>`;
// 14 A bracket from five numbers.
const bracketMock = () => `<div class="brk">${sw(`<g fill="none" stroke-linejoin="round"><path d="M60 150 L140 110 L260 160 L180 200 Z" fill="#dfe6dd" stroke="#4b5a4e" stroke-width="2"/><path d="M60 150 V120 L140 80 V110" fill="#c9d4c6" stroke="#4b5a4e" stroke-width="2"/><path d="M140 80 L260 130 V160" stroke="#4b5a4e" stroke-width="2"/><path d="M60 120 L180 170 V200 M180 170 L260 130" stroke="#4b5a4e" stroke-width="2"/><ellipse cx="110" cy="112" rx="9" ry="5" fill="#fff" stroke="#4b5a4e" stroke-width="2"/><ellipse cx="200" cy="166" rx="9" ry="5" fill="#fff" stroke="#4b5a4e" stroke-width="2"/></g><g font-family="ui-monospace,monospace" font-size="11" fill="#2c6e3f"><text x="20" y="140">30</text><text x="88" y="186">62 mm</text><text x="232" y="196">48</text><text x="150" y="70">Ø 5.5 · 3 mm</text></g>`, '', '0 0 300 220')}<p class="brk-n"><span>bracket.scad · 34 lines</span><span>bracket.stl · ready for the printer</span></p></div>`;
// 6 A crooked scan, and the same page found by a word on it.
const scanMock = () => `<div class="scan" data-view data-state="found">${toggles([['scan', 'Scanned'], ['found', 'Searched: “balcony”']], 'found')}<div class="scan-p"><p class="scan-h">Board minutes · 14 May 2009</p>${['§ 4 Repairs to the stairwell lighting', '§ 5 The board decided to glaze the balconies', 'of staircases A and B in spring 2010.', '§ 6 Next meeting in September'].map((l, k) => `<span class="scan-l${k === 1 ? ' hit' : ''}">${k === 1 ? 'The board decided to glaze the <mark>balconies</mark>' : esc(l)}</span>`).join('')}</div><p class="scan-n">1,400 pages · 312 files named date and subject · PDF/A</p></div>`;
// 30 Two versions of a lease.
const leaseMock = () => `<div class="lease">${diff('lease-2027.pdf vs lease-2026.pdf', ['  § 3 Rent: €1,850 a month', '- § 7 Notice period: three (3) months', '+ § 7 Notice period: six (6) months', '- § 9 Rent review each January by the index', '+ § 9 Rent review each January by the index, at least 2 %', '  § 11 The tenant may sublet with written consent', '+ § 14 Signage on the facade needs approval'])}<p class="lease-n">4 differences · 11 pages each · nothing else changed</p></div>`;
// 18 An aerial map from drone photos, with the paved area measured.
const droneMock = () => `<div class="map">${sw(`<rect width="320" height="200" fill="#9fb08a"/><g fill="#b9c4a4">${Array.from({ length: 30 }, (_, k) => `<circle cx="${(k * 53) % 320}" cy="${(k * 37) % 200}" r="${8 + (k % 4) * 3}" fill="#7f9a6a"/>`).join('')}</g><rect x="40" y="30" width="90" height="56" fill="#c9b8a0" stroke="#7d6c56"/><rect x="190" y="26" width="96" height="60" fill="#c9b8a0" stroke="#7d6c56"/><rect x="40" y="128" width="246" height="46" fill="#c9b8a0" stroke="#7d6c56"/><path d="M40 92 H286 V122 H140 V96 H40 Z" fill="#8e9196"/><path d="M40 92 H286 V122 H140 V96 H40 Z" fill="rgba(44,110,63,.28)" stroke="#2c6e3f" stroke-width="2.5" stroke-dasharray="6 4"/><g font-family="ui-monospace,monospace" font-size="12" font-weight="700"><rect x="176" y="98" width="98" height="20" rx="4" fill="#fff"/><text x="182" y="112" fill="#1f5430">1,240 m²</text></g>`)}<p class="map-n"><span>180 photos · 4 cm per pixel</span><span>orthophoto.tif · yard.obj</span></p></div>`;
// 16 Orders on a map: two districts across the river with no pick-up point.
const custMapMock = () => `<div class="map">${sw(`<rect width="320" height="200" fill="#eef1ea"/><path d="M0 120 C60 100 100 140 160 118 S260 80 320 104 V128 C260 104 200 150 160 142 S60 126 0 146 Z" fill="#b8cbd8"/><g fill="#d9dfd2">${[[20, 20, 80, 70], [120, 10, 90, 80], [230, 20, 80, 60], [20, 160, 100, 36], [140, 150, 80, 46], [240, 140, 76, 56]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`).join('')}</g><rect x="140" y="150" width="80" height="46" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/><rect x="240" y="140" width="76" height="56" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/>${Array.from({ length: 70 }, (_, k) => { const south = k % 5 === 0 || k % 7 === 0; const x = south ? 150 + ((k * 37) % 160) : 24 + ((k * 61) % 280); const y = south ? 154 + ((k * 13) % 38) : 16 + ((k * 29) % 80); return `<circle cx="${x}" cy="${y}" r="2.6" fill="${south ? '#b45a33' : '#2c6e3f'}" opacity=".8"/>`; }).join('')}<g><circle cx="150" cy="56" r="7" fill="#fff" stroke="#23432c" stroke-width="2.5"/><circle cx="150" cy="56" r="2.5" fill="#23432c"/></g><text x="162" y="60" font-size="11" font-family="system-ui" fill="#23432c">Shop</text>`)}<p class="map-n"><span>3,412 orders by postcode</span><span><b class="sw sw-o"></b>21 % across the river</span></p></div>`;
// 13 Twenty-two stops in order.
const routeMock = () => { const pts = Array.from({ length: 22 }, (_, k) => { const a = (k / 22) * Math.PI * 2; return [160 + Math.cos(a) * (110 + (k % 3) * 12), 100 + Math.sin(a) * (62 + (k % 4) * 6)]; }); return `<div class="map">${sw(`<rect width="320" height="200" fill="#eef1ea"/><g stroke="#d9dfd2" stroke-width="6">${[40, 90, 140, 190, 240, 290].map((x) => `<path d="M${x} 0 V200"/>`).join('')}${[40, 100, 160].map((y) => `<path d="M0 ${y} H320"/>`).join('')}</g><path d="M${pts.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join(' L')} Z" fill="none" stroke="#2c6e3f" stroke-width="2.5"/>${pts.map(([x, y], k) => `<g><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${k === 0 ? 8 : 6.5}" fill="${k === 0 ? '#b45a33' : '#fff'}" stroke="#2c6e3f" stroke-width="1.5"/><text x="${x.toFixed(0)}" y="${(y + 3).toFixed(0)}" text-anchor="middle" font-size="7.5" font-family="system-ui" font-weight="700" fill="${k === 0 ? '#fff' : '#1f5430'}">${k + 1}</text></g>`).join('')}<rect x="132" y="88" width="56" height="24" rx="5" fill="#23432c"/><text x="160" y="104" text-anchor="middle" font-size="11" font-family="system-ui" fill="#fff">Studio</text>`)}<p class="map-n"><span>22 stops · bakery first</span><span>41 km · last week 58 km</span></p></div>`; };
// 21 Certificates from one template.
const certMock = (names = ['Aino Berg', 'Leo Marsh', 'Sofia Nyman'], title = 'Swimming certificate', sub = 'Level 3 · 25 metres', foot = '118 certificates · sorted by class') => `<div class="cert"><div class="cert-st">${names.map((n, k) => `<div class="cert-p" style="--k:${k}"><small>Maple Lane School</small><b>${esc(title)}</b><i>${esc(n)}</i><span>${esc(sub)}</span></div>`).join('')}</div><p class="cert-n">${esc(foot)}</p></div>`;
// 23 A choir part, a whole tone lower.
const scoreMock = () => `<div class="score" data-view data-state="low">${toggles([['high', 'As written'], ['low', 'A whole tone lower']], 'low')}${sw(`<g stroke="#4b5563" stroke-width="1">${[0, 1, 2, 3, 4].map((k) => `<path d="M10 ${40 + k * 10} H310"/>`).join('')}</g><text x="14" y="78" font-size="44" font-family="serif" fill="#1d2a3a">𝄞</text><g class="score-notes">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const y = [55, 50, 45, 50, 40, 45, 50, 55][k]; return `<g transform="translate(${70 + k * 30} ${y})"><ellipse rx="6" ry="4.4" transform="rotate(-20)" fill="#1d2a3a"/><path d="M5.5 -1 V-28" stroke="#1d2a3a" stroke-width="1.4"/></g>`; }).join('')}</g><text x="12" y="120" font-size="11" font-family="system-ui" fill="#5a6b5d">Soprano · bars 9–10</text>`, '', '0 0 320 130')}<p class="score-n"><span>full score · 4 part books</span><span>4 practice tracks, one per voice</span></p></div>`;
// 15 A timetable that satisfies forty rules.
const TT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const TT = ['Ma', 'En', 'Sc', 'Hi', 'Ar', 'PE', 'Mu', 'Fi'];
const timetableMock = (title = 'Class 7B', flag = 'Ivan teaches Friday period 5: the one rule broken') => `<div class="tt5"><p class="tt5-h"><b>${esc(title)}</b><span>40 rules · 39 met</span></p><div class="tt5-g"><span></span>${TT_DAYS.map((d) => `<span class="tt5-d">${d}</span>`).join('')}${[1, 2, 3, 4, 5, 6].map((p) => `<span class="tt5-p">${p}</span>${TT_DAYS.map((d, i) => { const s = TT[(p * 3 + i * 5) % TT.length]; const f = i === 4 && p === 5; return `<span class="tt5-c s-${s}${f ? ' flag' : ''}">${s}</span>`; }).join('')}`).join('')}</div><p class="tt5-n">${esc(flag)}</p></div>`;
// 19 A forecast with a low and a high line.
const forecastMock = () => { const hist = [38, 41, 47, 62, 55, 44]; const fc = [42, 49, 70, 58]; const x = (k) => 20 + k * 28; const y = (v) => 180 - v * 2.2; return `<div class="fc">${sw(`<g stroke="#e3e7e0">${[40, 60, 80].map((v) => `<path d="M20 ${y(v)} H300"/>`).join('')}</g><path d="M${hist.map((v, k) => `${x(k)} ${y(v)}`).join(' L')}" fill="none" stroke="#6b746c" stroke-width="2"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v * 1.12)}`).join(' ')} L${x(9)} ${y(fc[3] * 0.88)} ${fc.slice().reverse().map((v, k) => `L${x(9 - k)} ${y(v * 0.88)}`).join(' ')} Z" fill="rgba(44,110,63,.16)"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v)}`).join(' ')}" fill="none" stroke="#2c6e3f" stroke-width="2.5" stroke-dasharray="5 3"/><g font-family="system-ui" font-size="10" fill="#5a6b5d">${['Oct', '', 'Nov', '', 'W1', 'W2', 'W3', 'W4', 'Jan', ''].map((l, k) => `<text x="${x(k) - 8}" y="196">${l}</text>`).join('')}</g><text x="${x(8) - 30}" y="${y(70 * 1.12) - 6}" font-size="11" font-family="system-ui" fill="#1f5430" font-weight="600">Week 2</text>`, '', '0 0 320 200')}<p class="fc-n"><span>5 years of till data</span><span>order between 1,150 and 1,420 units</span></p></div>`; };
// 35 A website check.
const siteCheckMock = () => `<ul class="chk">${[['err', '23 dead links', '18 from one renamed page; 5 to a supplier’s retired pages'], ['warn', '11 slow product pages', 'images of 4 MB each; 280 KB would do'], ['err', 'Checkout button', 'contrast 2.9 : 1, needs 4.5 : 1'], ['ok', '606 pages fine', 'titles, alt text, mobile layout']].map(([k, a, b]) => `<li class="chk-${k}"><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join('')}</ul>`;
// 34 A club website from text files.
const siteMock = (name = 'Riverside Rowing Club', nav = ['Training', 'Regattas', 'Join'], h = 'Rowing on the river since 1926', p = 'Training Tuesdays and Thursdays at 18:00, Saturdays at 9:00. Beginners welcome every first Saturday.') => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>${esc(name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, ''))}.example.org</p><div class="site"><p class="site-nav"><b>${esc(name)}</b>${nav.map((n) => `<span>${esc(n)}</span>`).join('')}</p><div class="site-hero" aria-hidden="true"></div><b class="site-h">${esc(h)}</b><p>${esc(p)}</p></div></div>`;
// A spreadsheet result.
const sheetMock = (file, head, rows, foot = '') => `<div class="sheet"><p class="sheet-h">${FILE_IC}<span>${esc(file)}</span></p><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${foot ? `<p class="sheet-n">${esc(foot)}</p>` : ''}</div>`;
// Bars: a quick chart.
const barsMock = (title, rows, unit = '', foot = '') => { const max = Math.max(...rows.map((r) => r[1])); return `<div class="bars"><p class="bars-h">${esc(title)}</p>${rows.map(([l, v, hot]) => `<p class="bar${hot ? ' hot' : ''}"><span>${esc(l)}</span><i style="--w:${((v / max) * 100).toFixed(1)}%"></i><b>${esc(String(v))}${esc(unit)}</b></p>`).join('')}${foot ? `<p class="bars-n">${esc(foot)}</p>` : ''}</div>`; };

// ---------- The capabilities ----------
// [n (number in the research list), group, title, program, who, org, ask, result]
const CAP_GROUPS = [
  ['av', 'Video and sound', 'Recordings become text, text becomes speech, clips become films.'],
  ['img', 'Pictures', 'A hundred photos at once, a logo from a thumbnail, old prints made sharp.'],
  ['3d', '3D and making', 'A product film without a studio, a spare part from five measurements.'],
  ['paper', 'Paper and files', 'Binders, PDFs and old mailboxes become something you can ask.'],
  ['maps', 'Maps and routes', 'Your own addresses on a real map, and the best way round them.'],
  ['print', 'Documents and print', 'One layout, every format; 118 certificates from one template.'],
  ['data', 'Data and numbers', 'Ten years of spreadsheets in one database, and problems with forty rules.'],
  ['web', 'The web', 'Sites built, checked, kept, and services used on your behalf.'],
];
const CAPS = [
  [1, 'av', 'Phone video cut and sized for every channel', 'FFmpeg', 'Lena', 'Example Studio', 'Three clips of the new aprons: a 30-second video for the product page and an upright one for social media.', 'Both files, with the shaky clip steadied, the sound evened out and the logo fading in at the end.'],
  [2, 'av', 'An hour’s recording to text, speakers named, on your own server', 'faster-whisper, WhisperX', 'Mallory', 'Birchwood Housing Company', 'Here’s the phone recording of last night’s board meeting. Minutes, please.', 'A draft with each decision, who proposed it and the minute of the recording where it was said. The recording never left the server.'],
  [4, 'av', 'Subtitles for a video, in another language too', 'whisper.cpp, ffsubsync, FFmpeg', 'Ivan', 'Maple Lane School', 'Subtitles in Finnish and English for my twelve-minute woodwork safety video.', 'The video with captions in both languages, the tool names spelled as in the school’s equipment list.'],
  [9, 'av', 'The handbook as something to listen to', 'Piper', 'Alice', 'Example Studio', 'Make the staff handbook listenable for the seasonal staff.', 'Nine audio chapters, abbreviations and product names read correctly, a short pause between sections.'],
  [22, 'av', 'Photos into a slideshow or a time-lapse', 'FFmpeg', 'Mallory', 'Birchwood Housing Company', 'One photo a day of the facade renovation: a film for the annual meeting.', 'A forty-second time-lapse of 240 aligned photos, with the month in the corner.'],
  [24, 'av', 'A song split into backing track and vocal', 'Demucs', 'Sara', 'Maple Lane School', 'The concert recording from years ago has my voice on it. The same song without the singing, please.', 'The backing track for the pupils to perform to, and the vocal separately for practising.'],
  [31, 'av', 'A podcast episode with silences removed and even sound', 'Auto-Editor, FFmpeg, SoX', 'Trent', 'Harbour Singers', 'Fifty minutes of this month’s member interview, recorded on a laptop.', 'A 38-minute episode with even sound, chapter marks and a description.'],
  [45, 'av', 'A webinar recording saved and turned into text', 'yt-dlp, faster-whisper', 'Bob', 'Example Studio', 'What did the supplier’s 90-minute product training say about the new warranty terms?', 'Three quotations, each with the minute it was said.'],
  [3, 'img', 'A hundred product photos: background off, same crop, shop sizes', 'rembg, ImageMagick', 'Ruth', 'Harbour Gifts', 'Sixty new items, photographed on the stockroom table. Make them look like the rest of the shop.', 'Sixty clean cut-outs in the shop’s three sizes, named by product code, and a contact sheet with four to check.'],
  [11, 'img', 'A blurry logo traced into a sharp vector file', 'VTracer, Inkscape', 'Peggy', 'Riverside Rowing Club', 'Our crest only exists as a 300-pixel JPEG from 2008. I need it on a two-metre banner.', 'A vector file that stays sharp at any size, and a sheet showing the crest on light and dark backgrounds.'],
  [12, 'img', 'Old small photos made larger and sharper', 'Real-ESRGAN', 'Peggy', 'Riverside Rowing Club', 'Our 1960s photos are postcard-sized scans. Versions good enough for an exhibition wall?', 'Forty enlarged images, and six marked where the restoration invented detail worth checking against the original.'],
  [28, 'img', '20,000 photos put in order: duplicates out, names by date', 'Czkawka, ExifTool', 'Peggy', 'Riverside Rowing Club', 'Eleven members’ uploads, all called IMG_something. Some order, please.', '6,300 of 19,800 files are duplicates; folders by year and regatta proposed, and everything renamed by date after her yes.'],
  [29, 'img', 'Faces and number plates blurred before publishing', 'OpenCV', 'Judy', 'Maple Lane School', 'Sports day photos for the website; six pupils have no permission.', 'Every face blurred by default, and a list of the 30 photos where it was unsure.'],
  [46, 'img', 'Camera raw files developed, the same look for the whole batch', 'RawTherapee, darktable', 'Peggy', 'Riverside Rowing Club', '900 raw files from the regatta.', 'All of them developed, and the 60 sharpest chosen for the website.'],
  [47, 'img', 'A panorama of the shop', 'Hugin', 'Alice', 'Example Studio', 'Fourteen photos turning around in the shop, for the “visit us” page.', 'One seamless wide picture.'],
  [5, '3d', 'A turning 3D film of a product', 'Blender', 'Alice', 'Example Studio', 'The new wall shelf exists only as the carpenter’s drawing. A slow spin of it in oak and in black, on a light background.', 'Two eight-second clips and six stills for the product page, rendered on the server over lunch.'],
  [10, '3d', 'An explainer animation for a lesson', 'Manim', 'Heidi', 'Maple Lane School', 'Show why the angles of a triangle add up to 180 degrees.', 'A forty-second animation in which the three corners are torn off and laid along a line.'],
  [14, '3d', 'A spare part designed from measurements, ready to print', 'OpenSCAD, CadQuery', 'Bob', 'Example Studio', 'The bracket on the display rail snapped and nobody sells it any more. Here are five measurements.', 'A picture of the part and a print file; the library’s printer has a new bracket the next day.'],
  [6, 'paper', 'A binder of scanned papers into a searchable archive', 'OCRmyPDF, Tesseract', 'Mallory', 'Birchwood Housing Company', 'Thirty years of board minutes, scanned on the office copier.', '1,400 pages as searchable, dated files; the 2009 decision on balcony glazing is found by typing “balcony”.'],
  [8, 'paper', 'A whole folder searchable, by meaning too', 'ripgrep-all, SQLite FTS5, sqlite-vec', 'Mira', 'Riverside University', 'Which of these forty papers measured lightfastness of indigo on linen?', 'Six papers, with the page and paragraph in each, including two that call it “fading under light”.'],
  [26, 'paper', 'Personal details redacted so they cannot be recovered', 'PyMuPDF', 'Mallory', 'Birchwood Housing Company', 'A resident asks for the minutes about her flat, without other residents’ details.', 'Eleven documents with 64 redactions and a list of each; two restored that were not personal data.'],
  [27, 'paper', 'Tables out of PDF reports and scanned price lists', 'Camelot, Docling', 'Bob', 'Example Studio', 'Fjord Paper’s new price list is a 60-page PDF. Which of our items went up more than 5 %?', '1,900 rows extracted and matched to the old list; 43 items with old price, new price and the change.'],
  [30, 'paper', 'Two versions of a contract: what changed', 'LibreOffice, diff-pdf', 'Alice', 'Example Studio', 'The landlord sent the renewed lease. What is different from last year’s?', 'Four differences; one moves the notice period from three months to six.'],
  [42, 'paper', 'A hundred Word files to PDF, old formats brought up to date', 'LibreOffice', 'Mira', 'Riverside University', 'The grant needs nineteen attachments as PDF; I have Word, Excel and PowerPoint files from five people.', 'Nineteen PDFs, numbered and named as the application form lists them.'],
  [43, 'paper', 'Stacks of PDFs merged, split, filled and protected', 'pypdf, qpdf', 'Kirsi', 'Ledger & Co', 'Year-end packages for our 40 clients.', 'Each assembled from five files, page-numbered and protected with the client’s agreed password.'],
  [52, 'paper', 'PDFs signed and stamped electronically', 'pyHanko', 'Kirsi', 'Ledger & Co', 'Stamp this month’s approved purchase invoices with the approver and the date.', '340 invoices stamped from the approval list.'],
  [54, 'paper', 'Backups, cloud folder sync and encrypted hand-over', 'restic, rclone, age', 'Kirsi', 'Ledger & Co', 'Payroll data has to go to a client safely.', 'The file encrypted for the client’s key and placed in the shared folder.'],
  [55, 'paper', 'An old mailbox as a searchable archive', 'notmuch, Docling', 'Bob', 'Example Studio', 'What did we agree with the glass supplier about breakage? It’s somewhere in my predecessor’s mail.', '48,000 messages indexed; the answer is a 2021 email and its attached terms, page 3.'],
  [13, 'maps', 'Twenty delivery stops in the best order', 'OR-Tools, VROOM, OSRM', 'Bob', 'Example Studio', 'Thursday’s twenty-two deliveries. The bakery has to be first.', 'The stops in order with arrival times and a map; 41 km against last week’s 58.'],
  [16, 'maps', 'Customers, members or deliveries on a map', 'QGIS, GDAL, Folium', 'Alice', 'Example Studio', 'Where would a pick-up point make sense?', 'Three years of orders mapped by postcode: a fifth come from two districts across the river, with no pick-up point within five kilometres.'],
  [17, 'maps', 'A map of your own neighbourhood as a poster', 'prettymaps, OSMnx', 'Alice', 'Example Studio', 'A map of the old town in our two colours, with the shop as a small dot, for regular customers.', 'A print file for A2 posters and a version sized for postcards.'],
  [18, 'maps', 'An aerial map and 3D model from drone photos', 'OpenDroneMap', 'Mallory', 'Birchwood Housing Company', 'A resident flew a drone over the yard for ten minutes. How big is the paved area?', '180 photos made into an overhead map: 1,240 square metres, ready for the request for quotes.'],
  [20, 'print', 'A print-ready poster, flyer and social image', 'Inkscape, Typst, Scribus', 'Peggy', 'Riverside Rowing Club', 'Open day in May: here are the date, three lines and last year’s photo.', 'An A3 poster for the print shop, an A5 flyer and a square image, all from one layout.'],
  [21, 'print', '120 certificates, invoices or name tags from one template', 'Typst, WeasyPrint', 'Judy', 'Maple Lane School', 'Swimming certificates for the end of term; here are the class lists and last year’s paper one.', '118 certificates with each pupil’s name, level and date, sorted by class.'],
  [23, 'print', 'Choir parts separated, transposed, with practice tracks', 'LilyPond, MuseScore, music21', 'Trent', 'Harbour Singers', 'The new piece sits too high for the sopranos. A whole tone lower, with separate parts.', 'The full score, four part books and four practice tracks, one for each voice.'],
  [32, 'print', 'One handbook as Word, PDF, web page and e-book', 'Pandoc, Typst', 'Alice', 'Example Studio', 'The opening hours changed. Update the handbook everywhere.', 'The printed PDF, the web version and the e-book rebuilt from the same text, so they never disagree.'],
  [33, 'print', 'A programme imposed as a folded booklet', 'pdfimpose', 'Trent', 'Harbour Singers', 'Sixteen A5 pages of concert programme.', 'One file to print double-sided on A4, fold and staple.'],
  [40, 'print', 'Documents translated without leaving the office', 'Argos Translate', 'Kirsi', 'Ledger & Co', 'A client’s employment contracts arrived in Polish.', 'Working English translations made on the office server, marked as for understanding, not for signing.'],
  [41, 'print', 'QR codes and barcodes for products, shelves and tickets', 'Zint, qrcode, zxing-cpp', 'Bob', 'Example Studio', 'Labels for the stockroom’s 300 shelf positions.', 'A label for each, and after stocktaking a list of shelves missed, read from Bob’s phone photos.'],
  [48, 'print', 'Season fixtures or shifts in everyone’s phone calendar', 'icalendar', 'Peggy', 'Riverside Rowing Club', 'The season plan is a table in a PDF.', 'One calendar file per crew; every rower has their own sessions in their phone.'],
  [49, 'print', 'Revision cards from your own teaching material', 'genanki', 'Heidi', 'Maple Lane School', 'Biology test on the cell next week.', 'A deck of 60 cards from her own slides, with her diagrams on them.'],
  [50, 'print', 'Your own material as an e-book', 'calibre, Pandoc', 'Peggy', 'Riverside Rowing Club', 'Sixty years of annual reports for the centenary.', 'One e-book with a chapter per decade.'],
  [51, 'print', 'A whole handbook proofread', 'LanguageTool', 'Alice', 'Example Studio', 'Check the handbook before it goes to print.', '112 corrections grouped by kind; she rejects the nine that are the shop’s deliberate style.'],
  [7, 'data', 'Ten years of exports as one database you can ask', 'DuckDB, SQLite', 'Alice', 'Example Studio', 'Which customers bought every year until 2024 and then stopped?', 'Forty spreadsheets in three layouts loaded once; 31 names, their last order, and the query used.'],
  [15, 'data', 'A timetable or roster that meets every rule', 'FET, OR-Tools CP-SAT', 'Judy', 'Maple Lane School', 'Here are the teachers, the classes and forty rules. The timetable, please.', 'A complete timetable in half an hour; the only rule broken is Ivan’s free Friday afternoon.'],
  [19, 'data', 'Next season’s sales forecast from your own till', 'Prophet, scikit-learn', 'Bob', 'Example Studio', 'How much Christmas stock should I order?', 'December forecast week by week from five years of till data, with a low and a high figure to order between.'],
  [36, 'data', 'Your own data as a browsable site', 'Datasette', 'Peggy', 'Riverside Rowing Club', 'Our results since 1998 are in one member’s spreadsheet.', 'A searchable site where any member can look up their own races.'],
  [37, 'data', 'A customer list cleaned: one customer, three spellings', 'qsv, RapidFuzz', 'Bob', 'Example Studio', 'Clean up the 4,100-row mailing list.', '380 probable duplicates found; 300 certain ones merged, 80 asked about.'],
  [38, 'data', 'Survey answers into statistics and charts', 'R, pandas, Matplotlib', 'Judy', 'Maple Lane School', '310 parents answered about the school day’s length.', 'Six charts; the difference between year groups is real, the one between morning and afternoon classes is within chance.'],
  [39, 'data', 'A process chart, org chart or family tree from text', 'Graphviz, Mermaid', 'Bob', 'Example Studio', '(Two minutes, spoken) This is how a return goes…', 'The flow drawn, with the note that nobody is named for approving refunds over €100.'],
  [53, 'data', 'Bookkeeping as a text file: statement in, reports out', 'hledger', 'Trent', 'Harbour Singers', 'The year’s bank export, for the annual meeting.', 'The annual accounts, and the auditor reads the same text file.'],
  [56, 'data', 'Maths exercises with every answer computed', 'SymPy, GNU Octave', 'Heidi', 'Maple Lane School', 'Thirty versions of a ten-question equation test.', 'Thirty sheets and a key in which every answer was computed, not written from memory.'],
  [25, 'web', 'The agent uses a website on your behalf', 'Playwright', 'Bob', 'Example Studio', 'The courier only offers invoices one by one behind a login. All of last year, please.', 'Twelve months of pages walked through in Bob’s own browser; 212 invoices filed by month, with a sheet of totals.'],
  [34, 'web', 'A website from plain text files', 'Hugo, MkDocs', 'Peggy', 'Riverside Rowing Club', 'The texts, the training times and forty photos: a new site, please.', 'A new site to look at by evening; adding next week’s regatta result is one sentence to the agent.'],
  [35, 'web', 'A website checked: dead links, slow pages, accessibility', 'lychee, Lighthouse, Pa11y', 'Alice', 'Example Studio', 'I think the web shop has rotted in places.', '640 pages checked: 23 dead links, eleven pages with 4 MB images, and a checkout button that fails the contrast requirement.'],
  [44, 'web', 'A website kept exactly as it is today', 'monolith, Playwright', 'Alice', 'Example Studio', 'Before the shop moves platform, keep the old one.', 'All 640 pages saved as they looked, browsable offline.'],
];
const capOf = Object.fromEntries(CAPS.map((c) => [c[0], c]));

// The ones shown in full: a screen with the work and the result beside it.
const capScreen = (n, title, body, view) => { const c = capOf[n]; return screen(title, body, view, c[5]); };
const FULL = {
  2: () => capScreen(2, 'Board minutes', you('21:40', capOf[2][6], att('board-2026-11-18.m4a', 'Recording · 1 h 31 min')) + pi([
    tool('bash', 'uv tool install whisperx', 'installed into ~/.local · no administrator needed'),
    tool('bash', 'whisperx board-2026-11-18.m4a --diarize', 'transcribed on this server · 3 speakers · nothing uploaded', true),
    tool('write', 'board/2026-11-18-minutes.md', '6 decisions · each with who proposed it and the minute'),
  ], reply('Draft minutes are in *board/2026-11-18-minutes.md*. **Six decisions**, each with who proposed it and where in the recording it was said. One name was unclear at 47:12; I marked it.'), nTools(3)), viewPane('transcript', transcriptMock([['04:12', 'Mallory', 'First, the yard. We have one quote, we need three.'], ['05:40', 'Victor', 'I can ask the drone club to fly it, then we know the area.'], ['21:03', 'Wendy', 'The roof report says ten years, not five.'], ['47:12', 'Mallory', 'So we decide: three quotes for the yard by January.']], BOARD, '1:31:06'))),
  24: () => capScreen(24, 'Concert backing track', you('15:05', capOf[24][6], att('spring-song-2019.wav', 'Audio · 3 min 40 s')) + pi([
    tool('bash', 'uv tool install demucs', 'installed into ~/.local · model 80 MB'),
    tool('bash', 'demucs --two-stems=vocals spring-song-2019.wav', 'separated in 4 min on the processor\nno_vocals.wav · vocals.wav', true),
  ], reply('Here are both. The backing track is for the concert; the vocal on its own is for practising.', offer('spring-song-backing.wav', 'Audio · 3 min 40 s · 38 MB')), nTools(2)), viewPane('spring-song', stemsMock())),
  3: () => capScreen(3, 'New stock photos', you('10:20', capOf[3][6], att('photos/new-stock/', '60 photos · 412 MB')) + pi([
    tool('bash', 'uv tool install "rembg[cpu,cli]"', 'installed into ~/.local'),
    tool('bash', 'rembg p photos/new-stock/ cutouts/', '60 cut out · 4 caught a shadow'),
    tool('bash', 'magick mogrify -gravity center -extent 1:1 -resize 1600x1600 …', '180 files · 3 sizes · named by product code', true),
  ], reply('**60 cut-outs** in the shop’s three sizes, named by product code. Four caught a shadow; they are marked on the contact sheet.'), nTools(3)), viewPane('contact-sheet.png', cutoutMock(60, 4))),
  11: () => capScreen(11, 'Crest for the banner', you('19:30', capOf[11][6], att('crest-2008.jpg', 'Image · 300 × 300 px · 18 KB')) + pi([
    tool('bash', 'vtracer --input crest-2008.jpg --output crest.svg --colormode color', '3 colours · 14 paths'),
    tool('bash', 'inkscape crest.svg --export-type=pdf,png --export-width=6000', 'crest.pdf · crest.png (6000 px, transparent)'),
  ], reply('The crest is now curves, so it stays sharp at two metres. I evened out the colours to the club’s blue. **SVG, PDF and a large PNG** are in *banner/*.'), nTools(2)), viewPane('crest.svg', vectorMock())),
  5: () => capScreen(5, 'Shelf product film', you('11:50', capOf[5][6], att('shelf-drawing.step', 'CAD drawing · 2.1 MB')) + pi([
    tool('bash', 'blender --version || fetch blender into ~/apps', 'Blender 4.2 · unpacked into ~/apps/blender · no administrator needed'),
    tool('write', 'render/turntable.py', 'scene, two materials, soft light, 192-frame turntable'),
    tool('bash', 'blender -b -P render/turntable.py -- --material oak,black', 'rendered 384 frames on the server in 52 min\nshelf-oak.mp4 · shelf-black.mp4 · 6 stills', true),
  ], reply('Two eight-second clips and six stills are in *render/out*. They rendered while you were at lunch.', offer('shelf-oak.mp4', 'Video · 8 s · 6 MB')), nTools(3)), viewPane('shelf-oak.mp4', turntableMock())),
  14: () => capScreen(14, 'Display rail bracket', you('08:55', 'Bracket for the display rail: 62 by 48 millimetres, 30 high, 3 thick, two 5.5 mm holes.', '', `${MIC_IC}Dictated`) + pi([
    tool('write', 'parts/bracket.scad', '34 lines · every size a named number'),
    tool('bash', 'openscad -o bracket.stl parts/bracket.scad', 'bracket.stl · 1 part · printable without supports', true),
  ], reply('Here is the bracket. The sizes are named in *bracket.scad*, so a thicker one is one number away.', offer('bracket.stl', '3D print file · 84 KB')), nTools(2)), viewPane('bracket.stl', bracketMock())),
  6: () => capScreen(6, 'Board minutes archive', you('20:15', capOf[6][6], att('scans/', '212 PDFs from the copier')) + pi([
    tool('bash', 'ocrmypdf --deskew --rotate-pages -l eng scans/*.pdf archive/', '1,400 pages · text added · PDF/A · 40 % smaller'),
    tool('write', 'archive/register.csv', '312 documents · date, subject, pages'),
    tool('bash', 'rga -i "balcon" archive/', 'archive/2009-05-14 Board minutes.pdf: page 2\n  § 5 The board decided to glaze the balconies…', true),
  ], reply('Thirty years are searchable now. The **balcony glazing** was decided on 14 May 2009, § 5, page 2.'), nTools(3)), viewPane('2009-05-14 Board minutes.pdf', scanMock())),
  30: () => capScreen(30, 'Lease renewal', you('09:20', capOf[30][6], att('lease-2027.pdf', 'PDF · 11 pages')) + pi([
    tool('bash', 'pdftotext lease-2026.pdf; pdftotext lease-2027.pdf; diff …', '4 changed clauses', true),
  ], reply('**Four differences.** The one to look at: the notice period goes from **three months to six** (§ 7). The rent review now has a 2 % floor, and the facade sign needs approval. Nothing else changed.'), nTools(1)), viewPane('lease-2027 vs lease-2026', leaseMock())),
  18: () => capScreen(18, 'Yard measurements', you('17:10', capOf[18][6], att('drone/', '180 photos · 1.4 GB')) + pi([
    tool('bash', 'odm --project-path drone/ --orthophoto-resolution 4', 'OpenDroneMap, installed by the administrator\northophoto.tif · yard.obj', true),
    tool('bash', 'python3 measure.py orthophoto.tif --class paved', 'paved area 1,240 m² (± 2 %)'),
  ], reply('The paved area is **1,240 square metres**, give or take 2 %. The overhead map and a 3D model of the yard are in *yard/* for the request for quotes.'), nTools(2)), viewPane('orthophoto.tif', droneMock())),
  16: () => capScreen(16, 'Pick-up point', you('14:00', capOf[16][6]) + pi([
    tool('bash', 'duckdb -c "select postcode, count(*) from orders group by 1"', '3,412 orders · 61 postcodes'),
    tool('bash', 'python3 map_orders.py --geocode postcodes.csv', 'map.html · 2 districts with no pick-up point within 5 km', true),
  ], reply('**A fifth of your orders** come from two districts across the river, and neither has a pick-up point within five kilometres. The map is beside this.'), nTools(2)), viewPane('orders-map.html', custMapMock())),
  21: () => capScreen(21, 'Swimming certificates', you('13:10', capOf[21][6], att('classes-2026.xlsx', '6 classes · 118 pupils')) + pi([
    tool('write', 'certificates/template.typ', 'the old certificate, redrawn'),
    tool('bash', 'typst compile certificates/all.typ', '118 pages · sorted by class · one PDF per class', true),
  ], reply('**118 certificates**, one PDF per class so each teacher prints their own.', offer('certificates-7B.pdf', 'PDF · 21 pages')), nTools(2)), viewPane('certificates-7B.pdf', certMock())),
  23: () => capScreen(23, 'New piece, lower', you('18:45', capOf[23][6], att('winter-carol.musicxml', 'Score · 4 voices')) + pi([
    tool('bash', 'python3 -c "music21 … transpose(\'M-2\')"', 'a whole tone lower · range checked for every voice'),
    tool('bash', 'lilypond parts/*.ly', 'score.pdf · soprano.pdf · alto.pdf · tenor.pdf · bass.pdf'),
    tool('bash', 'fluidsynth … practice-*.wav', '4 practice tracks · own voice loud, others soft', true),
  ], reply('Done: **a whole tone lower**, so the top note is now a G. Four part books and four practice tracks are in *winter-carol/*.'), nTools(3)), viewPane('soprano.pdf', scoreMock())),
  15: () => capScreen(15, 'Timetable', you('09:00', capOf[15][6], att('timetable-rules.xlsx', '34 teachers · 18 classes · 40 rules')) + pi([
    tool('write', 'timetable/model.py', 'every rule as a constraint'),
    tool('bash', 'python3 timetable/model.py', 'solved in 27 min · 39 of 40 rules met\nbroken: Ivan free Friday afternoon (no solution keeps both his and the lab rule)', true),
  ], reply('A **complete timetable**. The only rule it had to break is Ivan’s free Friday afternoon; keeping it would break the science lab rule. Your call.'), nTools(2)), viewPane('timetable-7B.pdf', timetableMock())),
  19: () => capScreen(19, 'Christmas stock', you('11:30', capOf[19][6]) + pi([
    tool('bash', 'duckdb -c "select week, units from till where year >= 2021"', '5 years · 260 weeks'),
    tool('bash', 'python3 forecast.py --model prophet', 'December by week · 80 % interval', true),
  ], reply('Order **between 1,150 and 1,420 units**. The second week of December has grown every year; that is where most of the range sits.'), nTools(2)), viewPane('forecast.png', forecastMock())),
  35: () => capScreen(35, 'Shop check', you('16:10', capOf[35][6]) + pi([
    tool('bash', 'lychee --base https://shop.example.org .', '640 pages · 23 dead links'),
    tool('bash', 'npx pa11y-ci --sitemap https://shop.example.org/sitemap.xml', '1 contrast failure: checkout button', true),
  ], reply('Four things, in order of harm: the **checkout button** fails contrast, 23 links are dead (18 from one renamed page), and eleven product pages are slow because of 4 MB images. I can fix the links and the images; publishing waits for your yes.'), nTools(2)), viewPane('check-report', siteCheckMock())),
  34: () => capScreen(34, 'New club website', you('10:00', capOf[34][6], att('site-texts/', '9 texts · 40 photos')) + pi([
    tool('bash', 'hugo new site club && …', 'site built from 9 text files'),
    tool('publish', 'riverside-rowing-club.example.org', 'preview published · the old site untouched', true),
  ], reply('A new site is at the preview address. Adding a regatta result is one sentence to me; I change the text file and the site rebuilds.'), nTools(2)), viewPane('riverside-rowing-club.example.org', siteMock())),
};
const CAP_FULL = { av: [2, 24], img: [3, 11], '3d': [5, 14], paper: [6, 30], maps: [18, 16], print: [21, 23], data: [15, 19], web: [35, 34] };

const capStep = (n) => { const c = capOf[n]; return { who: c[4], org: c[5], clock: `<span class="cap-prog">${esc(c[3])}</span>`, head: `<span class="cap-tag">${esc(c[3])}</span><span class="cap-who">${esc(c[4])}, ${esc(c[5])}</span>`, ask: c[6], did: c[7], screen: FULL[n] }; };
// A capability in the list: closed, it is one line; open, the request and the result.
const capItem = (c) => `<li><details class="cap-it"><summary><span class="cap-t">${esc(c[2])}</span><span class="cap-p">${esc(c[3])}</span></summary><div class="cap-b">${screen(c[2], you('', c[6]) + reply(c[7]), '', c[5])}<p class="cap-by">${esc(c[4])}, ${esc(c[5])}</p></div></details></li>`;

// ---------- The library intro: claims only with their source ----------
const LIBRARY = [
  ['FFmpeg', 'Video and sound', '“FFmpeg is the leading multimedia framework”', 'ffmpeg.org', 'https://ffmpeg.org/about.html'],
  ['SQLite', 'Databases', '“SQLite is the most widely deployed database in the world”', 'sqlite.org', 'https://sqlite.org/about.html'],
  ['QGIS', 'Maps', '“QGIS is the leading Free and Open Source Desktop GIS.”', 'osgeo.org', 'https://www.osgeo.org/projects/qgis/'],
  ['Git', 'Version history', '“Git is widely used”', 'git-scm.com', 'https://git-scm.com/about'],
];
// Checked with apt-cache show on Ubuntu 24.04: all of these are in the archive.
const ALSO = ['Blender', 'LibreOffice', 'Pandoc', 'ImageMagick', 'Tesseract', 'OCRmyPDF', 'Inkscape', 'Scribus', 'LilyPond', 'MuseScore', 'darktable', 'Hugin', 'GDAL', 'R', 'OpenSCAD', 'Graphviz', 'calibre', 'Hugo'];
function capsSection(o = {}) {
  return `<section class="caps" id="can">
  <div class="caps-intro">
    <p class="kicker">What an agent on a real computer can do</p>
    <h2>Tens of thousands of programs, a sentence away.</h2>
    <p>Every agent here works on Ubuntu, and Ubuntu offers tens of thousands of packages. Some of them lead their field. An administrator can install any of them for everyone, and an agent fetches many of them into its own account the moment a job needs one.</p>
    <ul class="lib">${LIBRARY.map(([n, f, q, src, url]) => `<li><b>${esc(n)}</b><small>${esc(f)}</small><q>${esc(q.replace(/^“|”$/g, ''))}</q><a href="${url}">${esc(src)}</a></li>`).join('')}</ul>
    <p class="lib-also">Also in the archive: ${ALSO.map(esc).join(', ')}. Others, like Whisper for speech or DuckDB for data, an agent fetches from the project itself.</p>
    <nav class="cap-nav" aria-label="Capability groups">${CAP_GROUPS.map(([id, name]) => `<a href="#cap-${id}">${esc(name)} <b>${CAPS.filter((c) => c[1] === id).length}</b></a>`).join('')}</nav>
  </div>
${CAP_GROUPS.map(([id, name, line]) => { const all = CAPS.filter((c) => c[1] === id); const rest = all.filter((c) => !CAP_FULL[id].includes(c[0])); return `<div class="cap-g" id="cap-${id}">
  <header class="cap-gh"><h3>${esc(name)}</h3><p>${esc(line)}</p></header>
  ${storySection(`${o.key || 'cap'}-${id}`, CAP_FULL[id].map(capStep), { cls: 's1-cap' })}
  ${rest.length ? `<details class="cap-more"><summary>${rest.length} more: ${esc(name.toLowerCase())}</summary><ul>${rest.map(capItem).join('')}</ul></details>` : ''}
</div>`; }).join('\n')}
</section>`;
}
