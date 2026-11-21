// The rest of Example Studio on the same Thursday: one company of seven, one
// Habitat, each person in their own account with their own agents. Bob, Kirsi,
// Carol, Dave, Erin and Frank each have a full day (variant 3 swaps between
// them); `pick` marks the glimpses variant 1 shows, and `hand` a file that
// passes between colleagues (variant 2 shows those beside Alice's day).
// ALICE_MORE holds three glimpses from Alice's other weeks, shown only in
// variant 3. Everything is invented (example.org).

// ---------- Mock views used only here ----------
const INKS = { 'indigo-rust': ['#2f4f73', '#b45a33', '#5a4a52', 'Indigo + rust: a warm slate'], 'indigo-yellow': ['#2f4f73', '#d9b23a', '#3f6b4a', 'Indigo + weld yellow: forest green'], 'rust-yellow': ['#b45a33', '#d9b23a', '#c47a2f', 'Rust + weld yellow: amber'] };
const inkMixMock = (url) => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>${esc(url)}</p><div class="ink" data-view data-state="indigo-rust">${toggles(Object.keys(INKS).map((k) => [k, INKS[k][3].split(':')[0], INKS[k][3]]), 'indigo-rust')}<div class="ink-row">${Object.entries(INKS).map(([k, [a, b, m]]) => `<div class="ink-set ink-${k}"><span style="--c:${a}"></span><i>+</i><span style="--c:${b}"></span><i>=</i><span class="ink-m" style="--c:${m}"></span></div>`).join('')}</div><p class="ink-n" data-label>${INKS['indigo-rust'][3]}</p></div></div>`;
const cardsMock = (q, a, n) => `<div class="cards" data-view data-state="q">${toggles([['q', 'Question'], ['a', 'Answer']], 'q')}<div class="card"><p class="card-q">${esc(q)}</p><p class="card-a">${esc(a)}</p></div><p class="cards-n">${esc(n)}</p></div>`;
const checklistMock = (title, rows) => `<div class="cl"><p class="cl-h">${esc(title)}</p><ul>${rows.map(([done, t, who]) => `<li class="${done ? 'done' : ''}"><span class="cl-b" aria-hidden="true"></span><span>${esc(t)}</span><small>${esc(who)}</small></li>`).join('')}</ul></div>`;
const posterMock = (o) => `<div class="pst"><div class="pst-a3"><small>${esc(o.small)}</small><b>${esc(o.title)}</b><span>${esc(o.by)}</span></div><div class="pst-a5"><b>${esc(o.title)}</b><span>${esc(o.a5)}</span></div><div class="pst-sq"><b>${o.sq.map(esc).join('<br>')}</b></div><p class="pst-n"><span>A3 poster · A5 brochure · square</span><span>CMYK · 3 mm bleed</span></p></div>`;
const framesMock = (texts, label, cls = '') => `<div class="frames ${cls}">${texts.map((t, k) => `<div class="frame-k" style="--k:${k}"><span class="fr-fib" aria-hidden="true"></span><span class="fr-dots" aria-hidden="true"></span><small>${k + 1}</small><p>${esc(t)}</p></div>`).join('')}<p class="frames-n">${esc(label)}</p></div>`;
// A document laid out as headed lists.
const docMock = (k, blocks) => `<div class="doc"><p class="doc-k">${esc(k)}</p>${blocks.map(([h, items]) => `<b class="doc-h">${esc(h)}</b><ul>${items.map((t) => `<li>${md(t).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>`).join('')}</div>`;
// Bob's customer list: three spellings of one shop, before and after.
const DUPES = [['Corner Books', '12 Mill Lane', '23 orders'], ['Corner Books Ltd', '12 Mill Ln.', '11 orders'], ['Cornerbooks', 'Mill Lane 12', '7 orders']];
const dedupMock = () => `<div class="dd" data-view data-state="after">${toggles([['before', 'Before'], ['after', 'After']], 'after')}<ul class="dd-l dd-before">${DUPES.map(([n, a, o]) => `<li><b>${esc(n)}</b><span>${esc(a)}</span><small>${esc(o)}</small></li>`).join('')}</ul><ul class="dd-l dd-after"><li class="dd-one"><b>Corner Books</b><span>12 Mill Lane</span><small>41 orders · 3 rows merged</small></li></ul><p class="dd-n"><span>4,100 rows → 3,800 customers</span><span>300 merged · 80 to ask</span></p></div>`;
// A quote in the studio's own template.
const quoteMock = () => `<div class="doc qt"><p class="doc-k">Quote Q-2026-118 · Example Studio · valid 30 days</p><b class="doc-h">Harbour Hotel · lobby prints</b><table><tbody>${[['6 large prints, indigo on linen', '€2,940'], ['Oak frames, 6 × 90 × 120 cm', '€1,560'], ['Hanging, one morning in January', '€480']].map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}<tr class="qt-tot"><td>Total, VAT 0 % (business)</td><td>€4,980</td></tr></tbody></table><p class="qt-n">Prices from prices/2026.csv · frames from the framer’s October invoice</p></div>`;
// Kirsi's slide for Alice: how long the cash lasts.
const slideMock = () => { const pts = [61, 58, 63, 55, 51, 47, 44, 40, 36, 31, 27, 22]; const x = (k) => 24 + k * 24; const y = (v) => 150 - v * 1.8; return `<div class="sld"><p class="sld-k">Example Studio · cash · 19 Nov</p><b class="sld-h">Cash lasts 11 months at today’s pace</b>${sw(`<path d="M24 ${y(10)} H300" stroke="#b45a33" stroke-dasharray="5 4" stroke-width="1.5"/><text x="246" y="${y(10) - 5}" font-size="10" font-family="system-ui" fill="#8a3f20">safety floor</text><path d="M${pts.map((v, k) => `${x(k)} ${y(v)}`).join(' L')}" fill="none" stroke="#2c6e3f" stroke-width="2.5"/><path d="M${x(4)} ${y(51)} L${x(5)} ${y(29)} L${x(11)} ${y(4)}" fill="none" stroke="#6b746c" stroke-width="2" stroke-dasharray="4 3"/><path d="M${x(1) + 2} ${y(20) - 3} h14" stroke="#6b746c" stroke-width="2" stroke-dasharray="4 3"/><text x="${x(1) + 20}" y="${y(20)}" font-size="10" font-family="system-ui" fill="#4b5563">with the second press</text><g font-family="system-ui" font-size="9.5" fill="#6b746c">${['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, k) => `<text x="${x(k) - 8}" y="164">${m}</text>`).join('')}</g>`, '', '0 0 320 170')}<p class="sld-n">€61,200 today · the second press in March brings it to 8 months</p></div>`; };
// Carol's raw files, flat as shot and developed with her one adjustment.
const rawMock = () => `<div class="raw" data-view data-state="dev">${toggles([['raw', 'As shot'], ['dev', 'Developed']], 'dev')}<div class="raw-g">${Array.from({ length: 8 }, (_, k) => `<span class="raw-p${k === 2 ? ' best' : ''}" style="--c:${['#2f4f73', '#b45a33', '#3f6b4a', '#2f4f73', '#c47a2f', '#5a4a52', '#2f4f73', '#b45a33'][k]}"></span>`).join('')}</div><p class="raw-n"><span>312 raw files · one adjustment</span><span>104 sharpest kept</span></p></div>`;
// Carol's tote, turning, in indigo or rust.
const toteMock = () => `<div class="tt" data-view data-state="indigo">${toggles([['indigo', 'Indigo'], ['rust', 'Rust']], 'indigo')}<div class="tt-stage"><div class="tt-spin"><div class="tt-tote">${['f', 'b', 'l', 'r', 'd'].map((f) => `<i class="tt-${f}"></i>`).join('')}</div></div><span class="tt-floor" aria-hidden="true"></span></div><p class="tt-n"><span>tote-indigo.mp4 · 8 s · 192 frames</span><span>6 stills, 2400 × 2400</span></p></div>`;
// Dave's rota: people by day; Thursday's packing highlighted.
const ROTA = [['Alice', 'S S - S S - -'], ['Bob', 'P P P P P - -'], ['Kirsi', 'O O O - - - -'], ['Carol', 'S - S S - C -'], ['Erin', '- - - - - C C'], ['Sami', '- P - P P P -'], ['+ 3 seasonal', 'P P P P P P -']];
const ROTA_K = { S: ['Shop', 'shop'], P: ['Pack', 'pack'], O: ['Office', 'off'], C: ['Course', 'crs'], '-': ['', 'free'] };
const rotaMock = () => `<div class="rota"><p class="rota-h"><b>Week 49 · 30 Nov–6 Dec</b><span>23 rules · all met</span></p><div class="rota-g"><span></span>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="rota-d">${d}</span>`).join('')}${ROTA.map(([n, row]) => `<span class="rota-p">${esc(n)}</span>${row.split(' ').map((c, i) => `<span class="rota-c r-${ROTA_K[c][1]}${i === 3 && c === 'P' && /Bob|Sami/.test(n) ? ' hot' : ''}">${ROTA_K[c][0]}</span>`).join('')}`).join('')}</div><p class="rota-n">Thursdays: Bob and Sami pack · 17 of 19 wishes kept</p></div>`;
// Dave's redaction: other people's details removed, not covered.
const redactMock = () => `<div class="doc rd"><p class="doc-k">Personnel file · page 3 of 11 · redacted copy</p><p>Shift swap agreed with <i class="rd-x">Mikael Strand</i> for 14 March; approved by Dave.</p><p>Overtime, March: 6 h. Comparison with <i class="rd-x">two colleagues</i> at <i class="rd-x">€19.40</i> an hour removed.</p><p>Home address on file: <i class="rd-x">8 Birch Road</i></p><p class="rd-n">Text under the boxes: none · searched the PDF for all 6 other names, 0 found</p></div>`;
// Frank's figure from R: colour change by recipe, with 95 % intervals.
const ciMock = (rows, foot, hi = 'B') => { const max = 9; const x = (v) => 70 + (v / max) * 230; return `<div class="ci">${sw(`<g stroke="#e3e7e0">${[0, 3, 6, 9].map((v) => `<path d="M${x(v)} 14 V${20 + rows.length * 24}"/>`).join('')}</g>${rows.map(([n, lo, m, hi2], k) => { const yy = 28 + k * 24; const on = n.startsWith(hi); return `<g><text x="8" y="${yy + 4}" font-size="11" font-family="system-ui" fill="${on ? '#1f5430' : '#4b5563'}" font-weight="${on ? 700 : 400}">${esc(n)}</text><path d="M${x(lo)} ${yy} H${x(hi2)}" stroke="${on ? '#2c6e3f' : '#6b746c'}" stroke-width="2"/><circle cx="${x(m)}" cy="${yy}" r="4.5" fill="${on ? '#2c6e3f' : '#fff'}" stroke="${on ? '#2c6e3f' : '#6b746c'}" stroke-width="2"/></g>`; }).join('')}<g font-family="ui-monospace,monospace" font-size="9.5" fill="#6b746c">${[0, 3, 6, 9].map((v) => `<text x="${x(v) - 3}" y="${34 + rows.length * 24}">${v}</text>`).join('')}</g>`, '', `0 0 320 ${44 + rows.length * 24}`)}<p class="ci-n"><span>Colour change after 20 washes, ΔE (lower holds better)</span><span>${esc(foot)}</span></p></div>`; };
const CI6 = [['A indigo', 4.1, 5.0, 5.9], ['B indigo, alum', 1.8, 2.4, 3.0], ['C weld, alum', 5.2, 6.3, 7.4], ['D weld', 5.4, 6.6, 7.8], ['E madder', 3.6, 4.4, 5.2], ['F madder, iron', 2.9, 3.7, 4.5]];
const CI7 = [['A indigo', 4.3, 5.0, 5.7], ['B indigo, alum', 1.9, 2.4, 2.9], ['C weld, alum', 6.1, 6.9, 7.7], ['D weld', 4.9, 5.6, 6.3], ['E madder', 3.8, 4.4, 5.0], ['F madder, iron', 3.1, 3.7, 4.3]];
// Alice's board report: the figures on its first page.
const kpiMock = () => `<div class="doc kpi"><p class="doc-k">Board report · Q3 2026 · page 1 of 4</p><div class="kpi-g">${[['Revenue', '€118,400', '+12 % on Q3 2025'], ['Gross margin', '46 %', 'was 44 %'], ['Cash, 30 Sep', '€58,900', '¹ bank statement'], ['Web orders', '3,140', '+18 %']].map(([a, b, c]) => `<p><small>${esc(a)}</small><b>${esc(b)}</b><span>${esc(c)}</span></p>`).join('')}</div><p class="kpi-n">Every figure has its source in a footnote · 2 changed after Kirsi’s corrections, marked</p></div>`;
// Alice's decision model: pick a scenario and the result line follows.
const modelMock = () => `<div class="mdl" data-view data-state="stay">${toggles([['stay', 'Stay', 'End of 2027: cash €52,000 · profit €21,000'], ['move', 'Move', 'End of 2027: cash €31,000 · profit €14,000'], ['courses', 'Move + courses', 'End of 2027: cash €47,000 · profit €26,000']], 'stay')}${sheetMock('studio-move.xlsx · assumptions', ['Assumption', 'Stay', 'Move', '+ courses'], [['Rent a month', '€1,850', '€3,100', '€3,100'], ['Course places a month', '24', '24', '60'], ['Second press', 'no', 'March', 'March'], ['Loan', '€0', '€18,000', '€18,000']], 'Yellow cells are hers to change · every formula checked by hand once')}<p class="mdl-n" data-label>End of 2027: cash €52,000 · profit €21,000</p></div>`;

// =====================================================================
// Bob: sales and orders
// =====================================================================
const BOB = mkDay({
  id: 'bob', name: 'Bob', role: 'Sales and orders', org: 'Example Studio', color: '#3e5b6e',
  blurb: 'Bob sells Example Studio’s linen to shops, hotels and the odd public buyer, and gets the orders out. Thursday is delivery day.',
  places: [['08:00', 'At the studio', 'studio'], ['10:15', 'Planning with Alice and Carol', 'meet'], ['11:00', 'Delivering', 'van'], ['13:40', 'Lunch', 'lunch'], ['14:10', 'At Harbour Hotel', 'meet'], ['14:40', 'At the studio', 'studio'], ['15:40', 'Packing with Alice', 'box'], ['16:40', 'At the studio', 'studio']],
  sess: [
    { id: 'clean', title: 'Customer list cleanup', segs: [['08:02', 'run', 'Comparing 4,100 rows'], ['08:20', 'turn', '300 merged · 80 to ask'], ['08:45', 'quiet', 'customers-clean.csv']] },
    { id: 'brief', title: 'Harbour Hotel briefing', segs: [['09:00', 'run', 'Reading three years of mail'], ['09:10', 'turn', 'One page for 14:10'], ['09:20', 'quiet', 'Read']] },
    { id: 'route', title: 'Thursday deliveries', segs: [['10:40', 'run', 'Ordering 20 stops'], ['10:50', 'turn', '38 km · bakery first'], ['10:58', 'quiet', 'route-19-nov.pdf']] },
    { id: 'map', title: 'Orders on a map', segs: [['12:05', 'run', 'Placing 3,412 orders'], ['12:20', 'turn', 'Two districts, no shop'], ['12:40', 'quiet', 'orders-map.html']] },
    { id: 'quote', title: 'Harbour Hotel quote', segs: [['14:40', 'run', 'Pricing six prints'], ['14:50', 'turn', 'Quote ready · send?'], ['14:53', 'quiet', 'Sent to Harbour Hotel']] },
    { id: 'tender', title: 'Library tender', segs: [['16:45', 'run', 'Reading 5 attachments'], ['16:58', 'turn', '3 questions to ask'], ['17:10', 'quiet', 'questions.docx']] },
  ],
  g: [
    {
      s: 'clean', at: '08:20', pick: 1, ask: 'Our customer list has 4,100 rows, and some shops are in it three times under different spellings. Clean it up.',
      did: 'Years of web orders, wholesale accounts and market sign-ups ended up in one file. His agent compares names, addresses and email domains, merges the 300 that are certainly the same customer with all their orders, and asks Bob about the 80 it is not sure of.',
      screen: () => screen('Customer list cleanup', you('08:02', 'Our customer list has 4,100 rows, and some shops are in it three times under different spellings. Clean it up.', att('customers.csv', '4,100 rows · 2014–2026')) + pi([
        tool('bash', 'uv run --with rapidfuzz python3 tools/match_customers.py customers.csv', '380 probable duplicates\n300 certain: same address or same email domain\n 80 unsure: similar name, different address', true),
        tool('write', 'customers-clean.csv', '3,800 customers · every order kept with its customer'),
        tool('write', 'ask-bob.csv', '80 pairs · two lines each'),
      ], reply('**300 merged**, so the list has 3,800 customers now. Corner Books was in it three times, as “Corner Books”, “Corner Books Ltd” and “Cornerbooks”, with 41 orders between them. **80 I am not sure of**; they are in *ask-bob.csv*, two lines each.'), nTools(3)), viewPane('customers-clean.csv', dedupMock()), BOB.org),
    },
    {
      s: 'brief', at: '09:10', ask: 'Brief me on Harbour Hotel before the meeting at 14:10.',
      did: 'His agent reads three years of mail with the hotel, their orders in the shop’s files, his notes from the last calls and the hotel’s own news page, and gives him one page: who he meets, what they bought, what to bring up.',
      screen: () => screen('Harbour Hotel briefing', you('09:00', 'Brief me on Harbour Hotel before the meeting at 14:10.') + pi([
        tool('read', 'sales/harbour-hotel.md', '3 calls since 2024 · last: “lobby, maybe prints”'),
        tool('bash', 'gog gmail search "from:harbourhotel.example.org"', '62 messages · 2024–2026'),
        tool('bash', 'duckdb -c "select … from orders where customer = \'Harbour Hotel\'"', '9 orders · €6,840 · last: 40 napkins, June'),
        tool('bash', 'curl -s https://harbourhotel.example.org/news', 'lobby renovation finishes in January', true),
      ], reply('The briefing is beside this. The thing to know: **their lobby reopens in January**, and on your last call they asked about oak frames.'), nTools(4)), viewPane('briefing-harbour-hotel.md', docMock('Briefing · Harbour Hotel · Thu 14:10', [['Who you meet', ['Nina Holm, operations manager; she decides on the lobby', 'The new owner may join for ten minutes']], ['What they bought', ['9 orders since 2024, €6,840 in all', 'Napkins and table runners, reordered every June']], ['What to bring up', ['The lobby reopens in January: six large prints?', 'They asked about **oak frames** in September', 'The June invoice was paid 40 days late']]])), BOB.org),
    },
    {
      s: 'route', at: '10:50', pick: 1, ask: 'Today’s twenty deliveries. The bakery has to be first.',
      did: 'From the order list and the addresses, his agent works out the best loop round town with the bakery first, and gives him the stops in order with arrival times, on his phone before he leaves.',
      screen: () => screen('Thursday deliveries', you('10:40', 'Today’s twenty deliveries. The bakery has to be first.') + pi([
        tool('read', 'orders/deliveries-2026-11-19.csv', '20 stops · 3 with a time window'),
        tool('bash', 'vroom -i stops.json', 'best loop: 38.4 km · 2 h 35 min · all time windows met', true),
      ], reply('Leave at **11:00** and you are back at 13:35. **38 km**, against 52 last Thursday. The map and the list for your phone are beside this.', offer('route-19-nov.pdf', 'PDF · map and 20 stops')), nTools(2)), viewPane('route-19-nov.pdf', routeMock(20, '38 km · last week 52 km')), BOB.org),
    },
    {
      s: 'map', at: '12:20', ask: 'Put our web orders and the shops that stock us on one map. Where are we missing a shop?',
      did: 'Between two stops he asks by voice. His agent places three years of web orders by postcode beside the twelve shops that sell Example Studio’s linen, and finds where people order a lot with no shop nearby.',
      screen: () => screen('Orders on a map', you('12:05', 'Put our web orders and the shops that stock us on one map. Where are we missing a shop?', '', `${MIC_IC}Dictated`) + pi([
        tool('bash', 'duckdb -c "select postcode, count(*) from orders where channel = \'web\' group by 1"', '3,412 orders · 61 postcodes'),
        tool('bash', 'python3 tools/map_orders.py --shops wholesale/shops.csv', 'orders-map.html · 2 districts with no shop within 5 km', true),
      ], reply('**A fifth of web orders** come from two districts across the river, and no shop there sells us. Two candidates are on the map: a bookshop and a gift shop.'), nTools(2)), viewPane('orders-map.html', custMapMock('3,412 web orders · 12 shops', '21 % across the river, no shop')), BOB.org),
    },
    {
      s: 'quote', at: '14:50', pick: 1, ask: 'Quote for Harbour Hotel, as we agreed: six large prints framed in oak, hung by us in January.',
      did: 'Back from the meeting, he says it in one sentence. His agent takes the prices from the price list, the framing from the framer’s last invoice and the hotel’s details from the customer list, lays out the quote in the studio’s template, and sends it from Bob’s mailbox when he says so.',
      screen: () => screen('Harbour Hotel quote', you('14:40', 'Quote for Harbour Hotel, as we agreed: six large prints framed in oak, hung by us in January.') + pi([
        tool('read', 'prices/2026.csv · framer invoice 2026-10.pdf', 'large print €490 · oak frame 90 × 120 €260'),
        tool('write', 'quotes/Q-2026-118.typ', 'studio template · 3 lines'),
        tool('bash', 'typst compile quotes/Q-2026-118.typ', 'Q-2026-118.pdf · 1 page', true),
      ], reply('The quote is beside this: **€4,980**, valid 30 days. Send it to Nina Holm?'), nTools(3)) + you('14:52', 'Send it.') + pi([], reply('Sent from your mailbox, with the PDF.', drafts([['sent', 'Nina Holm, Harbour Hotel', 'Quote: six prints for the lobby', 'Hi Nina, thank you for today. The quote for six framed prints is attached…']]))), viewPane('Q-2026-118.pdf', quoteMock()), BOB.org),
    },
    {
      s: 'tender', at: '16:58', ask: 'The city library wants cushion covers for its reading rooms. Read the tender and tell me what we need to ask before we bid.',
      did: 'The tender is five attachments, 46 pages. His agent reads all of them, checks each requirement against what the studio makes, and drafts the clarifying questions in the form the library asks for, a week before the question deadline.',
      screen: () => screen('Library tender', you('16:45', 'The city library wants cushion covers for its reading rooms. Read the tender and tell me what we need to ask before we bid.', att('library-tender/', '5 PDFs · 46 pages')) + pi([
        tool('bash', 'pdftotext library-tender/*.pdf', '46 pages · 24 requirements'),
        tool('read', 'products/cushion-covers.md · handbook/production.md', 'linen 240 g · 60 °C wash · made in the studio'),
        tool('write', 'tenders/library-2026/questions.docx', '3 questions in the library’s form', true),
      ], reply('We meet **21 of 24** requirements. Three need asking before 26 November; the questions are drafted in their form, beside this. Nothing is sent.'), nTools(3)), viewPane('questions.docx', docMock('Questions to the city library · deadline 26 Nov', [['Questions', ['Fire rating: is EN 1021-1 enough for loose covers?', 'Quantity: the price form says 400, the specification 40 per room. Which?', 'Can delivery be split, half in March and half in May?']], ['Where we stand', ['21 of 24 requirements met as we are', 'Linen 240 g, washable at 60 °C, made in our studio']]])), BOB.org),
    },
  ],
});

// =====================================================================
// Kirsi: finance, in-house
// =====================================================================
const KIRSI = mkDay({
  id: 'kirsi', name: 'Kirsi', role: 'Finance', org: 'Example Studio', color: '#7a5c8e',
  blurb: 'Kirsi does Example Studio’s finance in-house: the books, VAT, payroll and the budget, three days a week at the studio.',
  places: [['08:00', 'At her desk', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:40', 'At her desk', 'desk'], ['14:30', 'With Alice', 'meet'], ['15:15', 'At her desk', 'desk']],
  sess: [
    { id: 'prices', title: 'Supplier price lists', segs: [['07:55', 'run', 'Reading 3 PDF price lists'], ['08:10', 'turn', '2,600 rows · 61 up'], ['08:30', 'quiet', 'price-lists-2027.xlsx']] },
    { id: 'forecast', title: 'Christmas stock', segs: [['10:05', 'run', 'Reading five years of sales'], ['10:20', 'turn', 'Order 1,150–1,420'], ['10:40', 'quiet', 'Read']] },
    { id: 'books', title: 'October books', segs: [['12:42', 'run', 'Matching 184 payments'], ['12:50', 'turn', '181 booked · 3 questions'], ['13:20', 'quiet', 'October closed']] },
    { id: 'vat', title: 'October VAT', segs: [['13:30', 'run', 'Preparing the return'], ['13:40', 'turn', '€6,212 to pay · file it?'], ['13:44', 'run', 'Filing'], ['13:45', 'quiet', 'Filed · receipt saved']] },
    { id: 'budget', title: 'Budget and cash', segs: [['14:00', 'run', 'Updating with October'], ['14:20', 'turn', 'Cash lasts 11 months'], ['14:28', 'quiet', 'Slide for 14:30']] },
  ],
  g: [
    {
      s: 'prices', at: '08:10', ask: 'Our three main suppliers sent their 2027 price lists as PDFs. Put them in one table against this year’s.',
      did: 'Linen, dyes and packaging: three PDFs, 140 pages in all. Her agent pulls every table out, matches 2,600 rows to this year’s prices and to what the studio actually buys, and answers with a spreadsheet the budget can read.',
      screen: () => screen('Supplier price lists', you('07:55', 'Our three main suppliers sent their 2027 price lists as PDFs. Put them in one table against this year’s.', att('suppliers-2027/', '3 PDFs · 140 pages')) + pi([
        tool('bash', 'uv run --with camelot-py python3 tools/extract_tables.py suppliers-2027/*.pdf', '2,612 rows from 131 tables'),
        tool('bash', 'python3 tools/compare_prices.py --bought books/purchases-2026.csv', '318 items we buy · 61 up more than 5 % · 4 discontinued', true),
      ], reply('**61 of the 318 items we buy** go up more than 5 %; the biggest is natural indigo (+18 %). Four items are gone from the lists. The budget picks the new prices up from *price-lists-2027.xlsx*.', offer('price-lists-2027.xlsx', '318 rows · old, new, change')), nTools(2)), viewPane('price-lists-2027.xlsx', sheetMock('price-lists-2027.xlsx', ['Item', '2026', '2027', 'Change'], [['Natural indigo, 1 kg', '€84.00', '€99.10', '+18 %'], ['Linen 240 g, 50 m', '€410.00', '€451.00', '+10 %'], ['Gift box, large', '€2.10', '€2.30', '+10 %'], ['Alum, 5 kg', '€22.40', '€23.90', '+7 %']], '… 57 more up · 4 discontinued')), KIRSI.org),
    },
    {
      s: 'forecast', at: '10:20', ask: 'How much Christmas stock should we order this year?',
      did: 'Her agent reads five years of the shop’s sales week by week, fits a forecast for December, and gives her a range to order between rather than one number to trust.',
      screen: () => screen('Christmas stock', you('10:05', 'How much Christmas stock should we order this year?') + pi([
        tool('bash', 'duckdb -c "select week, units from sales where year >= 2021"', '5 years · 260 weeks'),
        tool('bash', 'uv run --with prophet python3 tools/forecast.py', 'December by week · 80 % interval', true),
      ], reply('Order **between 1,150 and 1,420 units**. The second week of December has grown every year; that is where most of the range sits.'), nTools(2)), viewPane('forecast.png', forecastMock()), KIRSI.org),
    },
    {
      s: 'books', at: '12:50', pick: 1, hand: 'From Alice: her agent filed 25 of her 26 October receipts in bookkeeping/2026-10 at 12:44, where Kirsi’s agent reads them.',
      ask: 'October’s books: here is the bank statement. The receipts are in the folder, and the market cash slips are in the photo pile.',
      did: 'Alice’s receipts came in at lunch, Bob’s and Carol’s during the week, and the market cash slips are phone photos. Kirsi’s agent matches every payment on the statement to a receipt, books them the way the studio always books them, and asks only what the papers cannot answer.',
      screen: () => screen('October books', you('12:42', 'October’s books: here is the bank statement. The receipts are in the folder, and the market cash slips are in the photo pile.', att('statement-2026-10.csv', 'Bank · 184 payments') + att('market-slips/', '38 photos')) + pi([
        tool('read', 'bookkeeping/AGENTS.md', 'Linen and dyes: 4000 · market fees: 6990 · Alice’s phone: split 50/50'),
        tool('bash', 'ls bookkeeping/2026-10/', '61 files · 25 added 12:44 by Alice’s agent'),
        tool('bash', 'python3 tools/match.py statement-2026-10.csv bookkeeping/2026-10/ market-slips/', '181 of 184 matched · 3 questions', true),
        tool('write', 'books/2026-10.journal', '184 entries · VAT split'),
      ], reply('**181 of 184** booked. Three questions:\n\n1. €86.40 at a garden centre: studio or home?\n2. €212 to an electrician: repair or new equipment?\n3. City parking, €12.60, which Alice marked *no receipt*: book it without?'), nTools(4)), viewPane('books/2026-10', sheetMock('October 2026 · by account', ['Account', 'Entries', '€'], [['4000 Linen and dyes', '41', '12,806.20'], ['4100 Packaging', '18', '2,140.00'], ['6990 Market fees', '9', '720.00'], ['3000 Sales', '68', '−38,412.60']], '181 of 184 booked · 3 open')), KIRSI.org),
    },
    {
      s: 'vat', at: '13:40', pick: 1, ask: 'October’s VAT return: show it to me before anything goes.',
      did: 'With October booked, her agent works out the return from the books, shows every line with where it came from, and waits. It goes to the tax authority only on her yes, and the receipt is saved with the month.',
      screen: () => screen('October VAT', you('13:30', 'October’s VAT return: show it to me before anything goes.') + pi([
        tool('bash', 'hledger -f books/2026-10.journal balance tag:vat', 'output VAT €9,792.10 · input VAT €3,580.10'),
        tool('write', 'vat/2026-10-preview.pdf', 'every line with its entries', true),
      ], reply('To pay **€6,212.00**, due 12 December. Each line opens to the entries behind it. File it?'), nTools(2)) + you('13:44', 'Yes, file it.') + pi([
        tool('bash', 'python3 tools/vat_file.py --period 2026-10 --submit', 'accepted · receipt saved to vat/2026-10/', true),
      ], reply('Filed. The receipt is with October’s books.'), nTools(1)), viewPane('vat/2026-10-preview.pdf', sheetMock('VAT return · October 2026', ['Line', '€'], [['Sales VAT, 25.5 %', '9,792.10'], ['VAT on purchases', '−3,580.10'], ['To pay', '6,212.00']], 'Due 12 Dec · filed 13:45 on Kirsi’s yes')), KIRSI.org),
    },
    {
      s: 'budget', at: '14:20', pick: 1, ask: 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.',
      did: 'Her agent puts October’s actual figures into the budget, runs the cash forward month by month with the bills already known and the new supplier prices, and makes one slide for her meeting with Alice: how many months, and what changes it.',
      screen: () => screen('Budget and cash', you('14:00', 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.') + pi([
        tool('bash', 'python3 tools/budget.py --actuals books/2026-10.journal --prices price-lists-2027.xlsx', 'budget 2026–27 updated · cash run forward 12 months', true),
        tool('write', 'slides/cash-2026-11.pdf', '1 slide · 2 lines'),
      ], reply('At today’s pace the cash lasts **11 months**. The second press in March would bring it to 8, unless the loan comes through. The slide is beside this.', offer('cash-2026-11.pdf', 'PDF · 1 slide')), nTools(2)), viewPane('cash-2026-11.pdf', slideMock()), KIRSI.org),
    },
  ],
});

// =====================================================================
// Carol: designer and artist
// =====================================================================
const CAROL = mkDay({
  id: 'carol', name: 'Carol', role: 'Designer and artist', org: 'Example Studio', color: '#b45a33',
  blurb: 'Carol designs Example Studio’s prints and everything the shop shows: photos, films, posters. She also makes her own linocuts.',
  places: [['08:30', 'In the studio', 'studio'], ['10:15', 'Planning with Alice and Bob', 'meet'], ['11:00', 'In the studio', 'studio'], ['12:15', 'Lunch', 'lunch'], ['12:50', 'In the studio', 'studio'], ['15:40', 'At the print table', 'box']],
  sess: [
    { id: 'raw', title: 'Winter prints, raw files', segs: [['08:35', 'run', 'Developing 312 raw files'], ['08:50', 'turn', '312 developed · 104 kept'], ['09:00', 'quiet', 'photos/winter-developed']] },
    { id: 'logo', title: 'Our first logo', segs: [['09:20', 'run', 'Tracing a 200-pixel logo'], ['09:40', 'turn', 'Vector ready'], ['09:50', 'quiet', 'logo-2016.svg']] },
    { id: 'tote', title: 'Tote product film', segs: [['11:20', 'run', 'Rendering in Blender'], ['12:52', 'turn', 'Two films ready'], ['13:00', 'quiet', 'tote-indigo.mp4']] },
    { id: 'cut', title: 'Winter prints cut-outs', segs: [['13:02', 'run', 'Cutting out 104 photos'], ['13:10', 'turn', '104 ready · 3 to check'], ['13:20', 'quiet', 'team/photos/winter']] },
    { id: 'poster', title: 'January course poster', segs: [['15:00', 'run', 'Laying out 3 formats'], ['15:10', 'turn', 'Poster, brochure, square'], ['15:30', 'quiet', 'print/january-course']] },
  ],
  g: [
    {
      s: 'raw', at: '08:50', ask: 'Yesterday’s 312 raw files of the winter prints. Develop them all like this one, and keep the sharpest of each print.',
      did: 'She adjusted one photo by hand last night. Her agent applies the same adjustment to all 312 raw files on the server, compares the shots of each print, and keeps the sharpest, so she looks at 104 instead of 312.',
      screen: () => screen('Winter prints, raw files', you('08:35', 'Yesterday’s 312 raw files of the winter prints. Develop them all like this one, and keep the sharpest of each print.', att('photos/winter-raw/', '312 raw files · 9.4 GB') + att('tote-indigo-04.pp3', 'Her adjustment')) + pi([
        tool('bash', 'rawtherapee-cli -p tote-indigo-04.pp3 -o photos/winter-developed/ -c photos/winter-raw/', '312 developed with your adjustment'),
        tool('bash', 'python3 tools/sharpest.py photos/winter-developed/ --group-by product', '104 products · the sharpest of each kept · the rest in /other', true),
      ], reply('All **312 developed** with your adjustment. The sharpest of each print, **104**, are in *winter-developed*; the others are in a folder beside them.'), nTools(2)), viewPane('winter-developed/', rawMock()), CAROL.org),
    },
    {
      s: 'logo', at: '09:40', pick: 1, ask: 'Our first logo only exists as a 200-pixel JPEG from 2016. I need it sharp for the ten-year banner.',
      did: 'Nobody has the original file. Her agent traces the small picture into clean curves, evens out the colours to the studio’s blue, and gives her files that stay sharp at any size.',
      screen: () => screen('Our first logo', you('09:20', 'Our first logo only exists as a 200-pixel JPEG from 2016. I need it sharp for the ten-year banner.', att('logo-2016.jpg', 'Image · 200 × 200 px · 14 KB')) + pi([
        tool('bash', 'vtracer --input logo-2016.jpg --output logo-2016.svg --colormode color', '3 colours · 14 paths'),
        tool('bash', 'inkscape logo-2016.svg --export-type=pdf,png --export-width=6000', 'logo-2016.pdf · logo-2016.png (6000 px, transparent)', true),
      ], reply('The logo is curves now, so it stays sharp at three metres. **SVG, PDF and a large PNG** are in *banner/*.'), nTools(2)), viewPane('logo-2016.svg', vectorMock('logo-2016.jpg · 200 px', 'logo-2016.svg', 'Sharp at three metres · SVG, PDF, transparent PNG')), CAROL.org),
    },
    {
      s: 'tote', at: '12:52', pick: 1, ask: 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.',
      did: 'After the planning she gives her agent the tote’s pattern pieces and a scan of the print. It builds the bag in Blender, puts her print on it, and renders two eight-second films and six stills on the server while she is at lunch.',
      screen: () => screen('Tote product film', you('11:20', 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.', att('tote-pattern.svg', 'Pattern pieces') + att('winter-print-scan.tif', 'Scan · 600 dpi')) + pi([
        tool('bash', 'blender --version || fetch blender into ~/apps', 'Blender 4.2 · unpacked into ~/apps/blender · no administrator needed'),
        tool('write', 'render/tote.py', 'bag from the pattern pieces · her print as the cloth · soft light · 192-frame turn'),
        tool('bash', 'blender -b -P render/tote.py -- --colour indigo,rust', 'rendered 384 frames on the server in 58 min\ntote-indigo.mp4 · tote-rust.mp4 · 6 stills', true),
      ], reply('Two eight-second films and six stills are in *render/out*. They rendered while you were at lunch.', offer('tote-indigo.mp4', 'Video · 8 s · 7 MB')), nTools(3)), viewPane('tote-indigo.mp4', toteMock()), CAROL.org),
    },
    {
      s: 'cut', at: '13:10', pick: 1, hand: 'Hands to Alice: the cut-outs go into team/photos/winter, where her newsletter picks up two of them at 14:05.',
      ask: 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.',
      did: 'Her agent cuts every product out, puts it on the shop’s white with the same margin, saves the three sizes the shop uses named by product code, and marks the three where a shadow got caught.',
      screen: () => screen('Winter prints cut-outs', you('13:02', 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.', att('photos/winter-developed/', '104 photos')) + pi([
        tool('bash', 'uv tool install "rembg[cpu,cli]"', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'rembg p photos/winter-developed/ cutouts/', '104 cut out · 3 caught a shadow'),
        tool('bash', 'magick mogrify -background white -gravity center -extent 1:1 -resize 1600x1600 …', '312 files · 3 sizes · named by product code → team/photos/winter', true),
      ], reply('**104 ready** in *team/photos/winter*, where Alice and the shop page can use them. Three caught a shadow at the edge; they are marked on the contact sheet.'), nTools(3)), viewPane('team/photos/winter', cutoutMock(104, 3)), CAROL.org),
    },
    {
      s: 'poster', at: '15:10', ask: 'Poster, A5 brochure and a square image for Erin’s January course. The text is in her course file.',
      did: 'Her agent reads the dates and the price from Erin’s course file in the team folder, lays out an A3 poster, a folded A5 brochure and a square image from one layout, and makes the print shop’s version with bleed.',
      screen: () => screen('January course poster', you('15:00', 'Poster, A5 brochure and a square image for Erin’s January course. The text is in her course file.') + pi([
        tool('read', 'team/courses/2027-01-block-printing.md', 'four Saturdays from 9 Jan · €240 · 12 places a group · Erin'),
        tool('write', 'print/january-course.typ', 'one layout · three formats'),
        tool('bash', 'typst compile print/january-course.typ', 'poster-A3.pdf (CMYK, 3 mm bleed) · brochure-A5.pdf · square.png', true),
      ], reply('Three files from one layout. The A3 has the bleed the print shop asks for; the brochure folds to A6.', offer('poster-A3.pdf', 'PDF · print-ready')), nTools(3)), viewPane('poster-A3.pdf', posterMock({ small: 'Example Studio · from 9 January', title: 'Block printing for beginners', by: 'Four Saturdays with Erin', a5: '9–30 Jan', sq: ['Print,', 'press,', 'repeat'] })), CAROL.org),
    },
  ],
});

// =====================================================================
// Dave: people and office
// =====================================================================
const DAVE = mkDay({
  id: 'dave', name: 'Dave', role: 'HR and office', org: 'Example Studio', color: '#31553a',
  blurb: 'Dave runs the office and the people side of Example Studio: contracts, rotas, the handbook, and the seasonal packers who come every December.',
  places: [['08:00', 'At the office', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:40', 'At the office', 'desk'], ['15:00', 'On the shop floor', 'box'], ['15:45', 'At the office', 'desk']],
  sess: [
    { id: 'start', title: 'New packer on Monday', segs: [['08:15', 'run', 'Building the checklist'], ['08:30', 'turn', '8 before Monday · 2 drafts'], ['08:50', 'quiet', '3 of 14 done']] },
    { id: 'rota', title: 'December rota', segs: [['09:05', 'run', 'Solving 23 rules'], ['09:40', 'turn', 'All 23 met · 2 wishes clash'], ['09:55', 'quiet', 'team/rota.md']] },
    { id: 'leave', title: 'Lena’s last day', segs: [['10:40', 'run', 'Listing what she holds'], ['11:10', 'turn', '19 hand-overs'], ['11:30', 'quiet', 'Read']] },
    { id: 'redact', title: 'Personnel file request', segs: [['13:00', 'run', 'Redacting 11 documents'], ['13:20', 'turn', '42 redactions to check'], ['13:40', 'quiet', 'Checked']] },
    { id: 'survey', title: 'Staff survey', segs: [['14:10', 'run', 'Counting 16 answers'], ['14:30', 'turn', '5 charts'], ['14:45', 'quiet', 'survey-autumn.pdf']] },
    { id: 'audio', title: 'Handbook to listen to', segs: [['15:50', 'run', 'Reading 9 chapters aloud'], ['16:10', 'turn', '9 chapters · 48 min'], ['16:20', 'quiet', 'handbook-audio/']] },
  ],
  g: [
    {
      s: 'start', at: '08:30', pick: 1, ask: 'A new packer, Sami, starts on Monday. What has to happen before then?',
      did: 'His agent builds the list from the studio’s onboarding checklist and what was forgotten last time, drafts the welcome message and the note to payroll, and ticks off each step as Dave does it.',
      screen: () => screen('New packer on Monday', you('08:15', 'A new packer, Sami, starts on Monday. What has to happen before then?') + pi([
        tool('read', 'people/onboarding.md', '14 steps · notes from the last two starts'),
        tool('write', 'people/2026-11-23-sami.md', 'before Monday: 8 · first week: 6', true),
      ], reply('**Eight things before Monday**, six in the first week. The welcome message and the payroll note are in your drafts. Last time the alarm code was forgotten; it is on the list.'), nTools(2)), viewPane('people/2026-11-23-sami.md', checklistMock('Before Monday', [[1, 'Contract signed', 'Dave'], [1, 'Payroll details form', 'payroll'], [1, 'Welcome message', 'draft'], [0, 'Keys and alarm code', 'Dave'], [0, 'Till login', 'Kirsi'], [0, 'Safety walk at the press', 'Bob'], [0, 'First-week buddy', 'Carol']])), DAVE.org),
    },
    {
      s: 'rota', at: '09:40', pick: 1, hand: 'Hands to Alice and Bob: the rota goes into team/rota.md. From 1 December Sami packs with Bob on Thursdays, so Alice’s Thursday afternoons are free.',
      ask: 'December’s rota: six of us, Sami and three seasonal packers, the Christmas rush, and everyone’s wishes. Every rule has to hold.',
      did: 'Twenty-three rules: shop hours, two packers on every delivery day, Erin’s Saturday courses, nobody more than five days in a row, everyone’s days off. His agent writes each rule as a constraint, solves it, and says which wishes could not all be kept.',
      screen: () => screen('December rota', you('09:05', 'December’s rota: six of us, Sami and three seasonal packers, the Christmas rush, and everyone’s wishes. Every rule has to hold.', att('rota-rules.md', '23 rules · 19 wishes')) + pi([
        tool('write', 'rota/model.py', 'every rule as a constraint · wishes as preferences'),
        tool('bash', 'uv run --with ortools python3 rota/model.py', 'solved in 41 s · 23 of 23 rules met · 17 of 19 wishes kept', true),
        tool('write', 'team/rota.md', 'weeks 49–52 · one line per person per day'),
      ], reply('A rota that meets **all 23 rules**. Two wishes clashed: Kirsi and Bob both asked for Friday the 18th off. I gave Bob the 18th and Kirsi the 23rd; swap them if you like.'), nTools(3)), viewPane('team/rota.md', rotaMock()), DAVE.org),
    },
    {
      s: 'leave', at: '11:10', ask: 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?',
      did: 'His agent goes through the accounts, subscriptions, shared folders and recurring tasks in Lena’s name, and makes one hand-over list, each item with a new owner and the day it moves. Her accounts close tomorrow evening, not before.',
      screen: () => screen('Lena’s last day', you('10:40', 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?') + pi([
        tool('read', 'people/accounts.csv', 'Lena: 11 accounts · 2 subscriptions on her card'),
        tool('bash', 'grep -rl "Lena" team/tasks.md handbook/ team/AGENTS.md', '6 recurring tasks name her'),
        tool('write', 'people/handover-lena.md', '19 items · each with a new owner and a day', true),
      ], reply('**19 things to hand over**: 11 accounts, 2 subscriptions on her card, and 6 recurring tasks, from the shop’s photo shoots to the market stall booking. Each has a proposed owner; nothing closes before tomorrow evening.'), nTools(3)), viewPane('people/handover-lena.md', checklistMock('Hand-over · Lena, last day Fri 20 Nov', [[1, 'Shop photo shoots', 'Carol'], [1, 'Market stall booking', 'Bob'], [0, 'Shop admin account', 'Alice'], [0, 'Photo library subscription', 'Carol'], [0, 'Social media login', 'Carol'], [0, 'Accounts closed', 'Fri 18:00']])), DAVE.org),
    },
    {
      s: 'redact', at: '13:20', pick: 1, ask: 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.',
      did: 'Black boxes drawn over text are not enough: the words are still underneath. His agent removes other people’s names, addresses and pay from the files themselves, lists every redaction for Dave to check, and proves the text is gone by searching the result.',
      screen: () => screen('Personnel file request', you('13:00', 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.', att('people/files/former-2024/', '11 documents')) + pi([
        tool('bash', 'uv run --with pymupdf python3 tools/redact.py people/files/former-2024/', '11 documents · 42 redactions · text removed, not covered'),
        tool('bash', 'pdftotext out/*.pdf - | grep -c -f other-names.txt', '0 matches for the 6 other names', true),
      ], reply('**42 redactions** in 11 documents, each listed for you to check. I searched the result for every other person’s name: none can be found or copied out.'), nTools(2)), viewPane('redacted · page 3', redactMock()), DAVE.org),
    },
    {
      s: 'survey', at: '14:30', ask: 'The autumn staff survey: sixteen answers. The results as charts, please.',
      did: 'His agent counts the answers and draws the charts, and declines to split them by team: with sixteen people, a team of three could be recognised from its answers.',
      screen: () => screen('Staff survey', you('14:10', 'The autumn staff survey: sixteen answers. The results as charts, please.', att('survey-autumn.csv', '16 answers · 12 questions')) + pi([
        tool('bash', 'uv run --with pandas,matplotlib python3 tools/survey.py survey-autumn.csv', '5 charts · averages and spread', true),
      ], reply('Five charts are beside this. The lowest is **feedback** (2.9 of 5). I did not split by team: the smallest team is three people, and their answers would be recognisable.'), nTools(1)), viewPane('survey-autumn.pdf', barsMock('Average, 1 to 5', [['I know what is expected', 4.3], ['Tools work', 4.1], ['Workload is fair', 3.4], ['I get feedback', 2.9, 1], ['I would recommend the studio', 4.4]], '', '16 answers · not split: groups under 5')), DAVE.org),
    },
    {
      s: 'audio', at: '16:10', ask: 'Make the staff handbook listenable for the seasonal packers.',
      did: 'Many of them come in by bus. His agent reads the handbook aloud on the server, one file per chapter, with product names and abbreviations said right.',
      screen: () => screen('Handbook to listen to', you('15:50', 'Make the staff handbook listenable for the seasonal packers.') + pi([
        tool('bash', 'uv tool install piper-tts', 'installed into ~/.local · voice 60 MB'),
        tool('bash', 'python3 tools/handbook_audio.py handbook/ --voice en_GB', '9 chapters · 48 min · product names from products.csv', true),
      ], reply('**Nine chapters**, 48 minutes in all, in *handbook-audio/*. Product names and “VAT”, “SKU” and “60 °C” are read as people say them.'), nTools(2)), viewPane('handbook-audio/', sheetMock('handbook-audio/', ['Chapter', 'Length'], [['1 Welcome', '3:10'], ['2 Packing an order', '8:40'], ['3 Safety at the press', '6:05'], ['4 Returns and exchanges', '4:20']], '… 5 more · 48 min in all')), DAVE.org),
    },
  ],
});

// =====================================================================
// Erin: teacher of the studio's printing courses
// =====================================================================
const ERIN = mkDay({
  id: 'erin', name: 'Erin', role: 'Teacher, printing courses', org: 'Example Studio', color: '#8c6f4e',
  blurb: 'Erin teaches Example Studio’s printing courses: evening classes, Saturday courses and school groups in the studio’s course room.',
  places: [['07:45', 'At home', 'home'], ['09:30', 'In the course room', 'class'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'In the course room', 'class'], ['14:45', 'At home', 'home']],
  sess: [
    { id: 'marks', title: 'Autumn course feedback', segs: [['07:50', 'run', 'Reading 14 final pieces'], ['08:20', 'turn', '14 notes drafted'], ['08:30', 'run', 'Sending'], ['08:31', 'quiet', 'Sent · register updated']] },
    { id: 'anim', title: 'Mirror image animation', segs: [['08:40', 'run', 'Rendering 3 scenes'], ['09:10', 'turn', '46-second animation'], ['09:20', 'quiet', 'mirror-and-register.mp4']] },
    { id: 'ink', title: 'Ink overlap page', segs: [['11:15', 'run', 'Building a small page'], ['11:50', 'turn', 'Page ready to try'], ['12:05', 'quiet', 'courses.example.org/ink-overlap']] },
    { id: 'signup', title: 'January course start', segs: [['13:10', 'run', 'Merging three lists'], ['13:30', 'turn', '34 people · 1 twice'], ['13:40', 'quiet', 'Group sizes in team/tasks.md']] },
    { id: 'cards', title: 'Printing terms cards', segs: [['15:00', 'run', 'Reading 22 slides'], ['15:10', 'turn', '40 cards'], ['15:20', 'quiet', 'printing-terms.apkg']] },
  ],
  g: [
    {
      s: 'marks', at: '08:20', ask: 'The autumn course’s final pieces: check each against the brief and draft feedback.',
      did: 'Fourteen participants sent photos of their final prints and a few lines about them. Her agent checks each against the course brief, drafts a short note per person with one strength and one thing to try, marks who completed the course in the register, and leaves the sending to her.',
      screen: () => screen('Autumn course feedback', you('07:50', 'The autumn course’s final pieces: check each against the brief and draft feedback.') + pi([
        tool('bash', 'gog gmail search "label:autumn-course has:attachment newer_than:10d"', '14 final pieces · photos and reflections'),
        tool('read', 'courses/autumn/brief.md', '3 criteria: two-colour repeat, clean registration, a short reflection'),
        tool('write', 'courses/autumn/register.csv', '13 completed · 1 missing a reflection', true),
      ], reply('**Fourteen notes drafted**, each with one strength and one thing to try. One participant has not sent a reflection yet; her note asks for it. Nothing has gone out.', drafts([['draft', 'participant, Tuesday group', 'Your final print', 'The repeat holds across the whole cloth. Next, try the rust a shade thinner…'], ['draft', 'participant, Thursday group', 'Almost there', 'Your registration is clean. One thing missing: the few lines about…']])), nTools(3)) + you('08:30', 'Send them.') + pi([], reply('Sent, fourteen notes from your mailbox.'))),
    },
    {
      s: 'anim', at: '09:10', pick: 1, ask: 'A short animation for Saturday: why the block is carved in mirror image, and how the second colour lines up with the first.',
      did: 'She describes it in three sentences. Her agent writes the animation as a short script, renders it on the server, and slows the second scene down when she asks.',
      screen: () => screen('Mirror image animation', you('08:40', 'A short animation for Saturday: why the block is carved in mirror image, and how the second colour lines up with the first.') + pi([
        tool('write', 'courses/saturday/mirror.py', '3 scenes · block, print, corner marks'),
        tool('bash', 'uv run --with manim manim -qh courses/saturday/mirror.py', 'mirror-and-register.mp4 · 46 s · 1080p', true),
      ], reply('**46 seconds**, three scenes. Say if any part is too fast.', offer('mirror-and-register.mp4', 'Video · 46 s')), nTools(2)), viewPane('mirror-and-register.mp4', framesMock(['Carved in mirror image', 'Pressed face down, it reads the right way', 'Corner marks line up the second colour'], 'mirror-and-register.mp4 · 46 s · 3 scenes', 'frames-print')), ERIN.org),
    },
    {
      s: 'ink', at: '11:50', pick: 1, ask: 'Make a little page where the course can see what two inks make when they overlap. Indigo, rust and weld yellow.',
      did: 'Between two groups she describes the idea in two sentences. Her agent builds a small page at the studio’s course address; she tries it once and shares the link with the class herself.',
      screen: () => screen('Ink overlap page', you('11:15', 'Make a little page where the course can see what two inks make when they overlap. Indigo, rust and weld yellow.') + pi([
        tool('write', 'pages/ink-overlap/index.html', 'one page · works on the course tablets'),
        tool('publish', 'courses.example.org/ink-overlap', 'published · no sign-in needed', true),
      ], reply('Try it beside this. The colours come from the inks on the studio’s list, so the page matches what the course will print.'), nTools(2)), viewPane('courses.example.org/ink-overlap', inkMixMock('courses.example.org/ink-overlap'), 'Live'), ERIN.org),
    },
    {
      s: 'signup', at: '13:30', pick: 1, hand: 'Hands to Bob and Alice: the group sizes go into team/tasks.md, so Bob cuts linen for 34 and Alice sees January is nearly full.',
      ask: 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.',
      did: 'Sign-ups came from the web form, emails and a school’s spreadsheet. Her agent merges them, notices one person signed up twice under two spellings, drafts each welcome with the group’s day and what to bring, adds everyone to the register, and writes the numbers into the team’s task list.',
      screen: () => screen('January course start', you('13:10', 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.') + pi([
        tool('bash', 'python3 tools/merge_signups.py form.csv mail/ school-group.xlsx', '35 rows → 34 people (one twice: “Aino Berg” / “Aino Bergh”)', true),
        tool('write', 'courses/2027-01/welcome/*.eml', '34 drafts · each with the group’s day and what to bring'),
        diff('team/tasks.md', ['+ Bob: cut linen for 34, three groups, by 7 Jan  [Erin, 19 Nov]']),
      ], reply('**34 people** in three groups; Saturday has two places left. The welcome messages are in your drafts, nothing sent. Bob has the linen in his tasks.'), nTools(3)), viewPane('courses/2027-01/register.csv', sheetMock('register.csv', ['Group', 'Day', 'People', 'Places'], [['A', 'Tue evening', '12', '12'], ['B', 'Thu evening', '12', '12'], ['C', 'Saturday', '10', '12']], '34 people · 1 duplicate merged')), ERIN.org),
    },
    {
      s: 'cards', at: '15:10', ask: 'Revision cards from my printing-terms slides for the beginners.',
      did: 'Her agent reads her own slides and makes forty cards in her words, with her drawings on them, as a deck the participants open on their phones.',
      screen: () => screen('Printing terms cards', you('15:00', 'Revision cards from my printing-terms slides for the beginners.', att('printing-terms.pptx', '22 slides')) + pi([
        tool('bash', 'uv run --with python-pptx,genanki python3 tools/make_deck.py printing-terms.pptx', '40 cards · 9 with your drawings', true),
      ], reply('**Forty cards**, in your own words, nine with your drawings.', offer('printing-terms.apkg', 'Card deck · 40 cards')), nTools(1)), viewPane('printing-terms.apkg', cardsMock('Why is a block print reversed?', 'The block is pressed face down, so the image comes out mirrored. Letters are carved backwards.', 'Card 7 of 40 · from Erin’s own slides')), ERIN.org),
    },
  ],
});

// =====================================================================
// Frank: researcher in the dye project with the university
// =====================================================================
const FRANK = mkDay({
  id: 'frank', name: 'Frank', role: 'Researcher, dye project', org: 'Example Studio', color: '#2f4f73',
  blurb: 'Frank runs the studio’s dye research with Riverside University’s textile lab: which natural dyes hold on linen, in light and in the wash.',
  places: [['08:15', 'At the lab', 'lab'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'At the lab', 'lab'], ['13:30', 'Seminar', 'meet'], ['14:30', 'At the lab', 'lab']],
  sess: [
    { id: 'db', title: 'Ten years of test results', segs: [['08:20', 'run', 'Loading 120 spreadsheets'], ['08:40', 'turn', 'One database · first answer'], ['09:00', 'quiet', 'dyes.duckdb']] },
    { id: 'fast', title: 'Colour-fastness in R', segs: [['09:15', 'run', 'Installing R'], ['09:50', 'turn', 'Model and 2 figures'], ['10:10', 'quiet', 'analysis/fastness.R'], ['14:32', 'run', 'Rerunning with batch 7'], ['14:40', 'turn', 'Figures updated'], ['14:44', 'run', 'Writing the care note'], ['14:46', 'quiet', 'team/products/indigo-care.md']] },
    { id: 'notes', title: 'Lab notebooks 1994–2001', segs: [['10:30', 'run', 'Reading 640 scanned pages'], ['11:30', 'turn', 'Searchable · 212 recipes'], ['11:45', 'quiet', 'notebooks/']] },
    { id: 'talk', title: 'Dyer interviews', segs: [['12:10', 'run', 'Transcribing 5 h 20 min'], ['12:55', 'turn', '6 transcripts, speakers named'], ['13:10', 'quiet', 'interviews/']] },
    { id: 'sun', title: 'Sunshine data', segs: [['15:10', 'run', 'Asking the weather service'], ['15:30', 'turn', 'Daily sun hours, 2019–2026'], ['15:40', 'quiet', 'sun-hours.csv']] },
    { id: 'papers', title: 'Lightfastness papers', segs: [['16:20', 'run', 'Indexing 40 papers'], ['16:40', 'turn', '6 papers, with pages'], ['16:50', 'quiet', 'Read']] },
  ],
  g: [
    {
      s: 'db', at: '08:40', pick: 1, ask: 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask.',
      did: 'Every few years someone changed the spreadsheet. His agent reads all four layouts, loads them once into one database file in his folder, and answers the first question with the query beside it, so the answer can be checked and asked again.',
      screen: () => screen('Ten years of test results', you('08:20', 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask. First: which dye held best on linen?', att('exports/', '120 xlsx · 2016–2026')) + pi([
        tool('bash', 'uv run --with duckdb,openpyxl python3 tools/load_exports.py exports/', '120 files · 4 layouts · 18,400 test rows → dyes.duckdb'),
        tool('bash', 'duckdb dyes.duckdb < queries/best-on-linen.sql', 'indigo · alum   212 tests   ΔE 2.6\nmadder · iron    96 tests   ΔE 3.9\nindigo · none   188 tests   ΔE 4.8', true),
      ], reply('Across ten years, **indigo with alum** held best on linen: median colour change 2.6 over 212 tests. The query is saved in *queries/*, so the next question starts from the same database.'), nTools(2)), viewPane('dyes.duckdb', sheetMock('best-on-linen.sql', ['Dye', 'Mordant', 'Tests', 'ΔE, median'], [['Indigo', 'alum', '212', '2.6'], ['Madder', 'iron', '96', '3.9'], ['Indigo', 'none', '188', '4.8'], ['Weld', 'alum', '144', '6.1']], '18,400 rows from 120 files · 4 layouts')), FRANK.org),
    },
    {
      s: 'fast', at: '09:50', pick: 1, ask: 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.',
      did: 'R is not on the server, so his agent installs it into Frank’s own account with the packages the model needs. It writes the analysis as a script in his folder, fits a model that accounts for differences between test batches, and draws the figures. The script stays, so the next batch is one sentence.',
      screen: () => screen('Colour-fastness in R', you('09:15', 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.', att('tests/', '6 batches · 432 samples')) + pi([
        tool('bash', 'Rscript --version', 'bash: Rscript: command not found'),
        tool('bash', 'micromamba create -n r -c conda-forge r-base r-lme4 r-ggplot2', 'R 4.4 and 2 packages installed into ~/micromamba\nfor frank only; no administrator needed', true),
        tool('write', 'analysis/fastness.R', '58 lines · reads every tests/batch-*.csv'),
        tool('bash', 'Rscript analysis/fastness.R', 'lmer(delta_e ~ recipe + (1 | batch))\n6 recipes · 6 batches · 432 samples\nfigures/wash.pdf · figures/light.pdf', true),
      ], reply('Recipe **B, indigo with alum**, changes least in the wash, and the difference from the others holds with the batches accounted for. **C and D cannot be told apart yet.** The figure is beside this; *fastness.R* reruns everything from the folder.'), nTools(4)), viewPane('figures/wash.pdf', ciMock(CI6, 'batches 1–6 · 432 samples')), FRANK.org),
    },
    {
      s: 'notes', at: '11:30', ask: 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.',
      did: 'Six hundred and forty pages, typed and handwritten, scanned crooked. His agent straightens and reads them, saves searchable PDFs, and pulls every recipe into one list, marking those it could not read with confidence.',
      screen: () => screen('Lab notebooks 1994–2001', you('10:30', 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.', att('notebooks-scanned/', '640 pages')) + pi([
        tool('bash', 'ocrmypdf --deskew --rotate-pages -l eng notebooks-scanned/*.pdf notebooks/', '640 pages · text added · PDF/A'),
        tool('bash', 'python3 tools/recipes.py notebooks/', '212 recipes · 19 low confidence, each linked to its page', true),
      ], reply('All 640 pages are searchable now, and **212 recipes** are in *recipes.csv*. Nineteen were hard to read; each links to its page.'), nTools(2)), viewPane('notebook 1996 · p. 41', scanMock('Lab notebook · 3 March 1996', ['Trial 41: indigo vat on scoured linen', 'Mordant: alum 12 %, overnight', '6 dips · rinsed · dried in shade', 'Wash test after 2 weeks: little change'], 1, 'alum', 'Searched: “alum”', '640 pages · 212 recipes · PDF/A')), FRANK.org),
    },
    {
      s: 'talk', at: '12:55', ask: 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.',
      did: 'The interviews are people’s own stories, so they stay on the studio’s server. His agent transcribes them there, names the speakers from his interview notes, and marks the passages about mordants.',
      screen: () => screen('Dyer interviews', you('12:10', 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.', att('interviews/', '6 recordings · 5 h 20 min')) + pi([
        tool('bash', 'uv tool install whisperx', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'whisperx interviews/*.m4a --diarize', 'transcribed on this server · nothing uploaded · 6 transcripts', true),
        tool('write', 'interviews/index.md', '6 transcripts · 23 passages about mordants marked'),
      ], reply('Six transcripts in *interviews/*, speakers named from your notes. **23 passages** about mordants are marked; the one about alum and rainwater is in interview 4 at 31:20.'), nTools(3)), viewPane('interview-4.md', transcriptMock([['02:14', 'Frank', 'When did you start at the dye house?'], ['02:20', 'Hilda', 'In 1968. My mother was there before me.'], ['31:20', 'Hilda', 'We used rainwater for the alum. Tap water made the blue go grey.'], ['31:42', 'Frank', 'Was that written down anywhere?']], { Frank: 'a', Hilda: 'b' }, '54:08')), FRANK.org),
    },
    {
      s: 'fast', at: '14:40', pick: 1, hand: 'Hands to Alice: a three-line care note for the indigo tote goes into team/products/, where the shop page reads it.',
      ask: 'Batch 7 from the lab is in. Rerun the analysis.',
      did: 'The lab sent the seventh batch during the seminar. His agent reruns the same script on all seven batches and says what changed; when Frank asks, it turns the result into a care note for the shop in plain words.',
      screen: () => screen('Colour-fastness in R', you('14:32', 'Batch 7 from the lab is in. Rerun the analysis.', att('tests/batch-07.csv', '72 samples')) + pi([
        tool('bash', 'Rscript analysis/fastness.R', '7 batches · 504 samples\nB still lowest · C now differs from D (p = 0.03)', true),
      ], reply('Rerun on all seven batches. **B still holds best.** With the new batch, C and D can be told apart: C fades faster in the wash. The figures are updated.'), nTools(1)) + you('14:44', 'Write the shop a care note for the indigo tote from this. Three lines.') + pi([
        diff('team/products/indigo-care.md', ['+ Wash at 40 °C, inside out, with mild soap.', '+ Dry in the shade; the indigo keeps its depth longer.', '+ Tested with Riverside University’s textile lab.']),
      ], reply('In *team/products/indigo-care.md*, where the shop page reads it.')), viewPane('figures/wash.pdf', ciMock(CI7, 'batches 1–7 · 504 samples')), FRANK.org),
    },
    {
      s: 'sun', at: '15:30', ask: 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.',
      did: 'The weather service publishes its observations through an open interface. His agent asks it for the nearest station day by day, saves the table, and joins it to the outdoor tests in his database.',
      screen: () => screen('Sunshine data', you('15:10', 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.') + pi([
        tool('bash', 'python3 tools/weather_api.py --station nearest --param sunshine --from 2019-01-01', '2,880 days · 14 missing, marked'),
        tool('bash', 'duckdb dyes.duckdb -c "create table sun as …; select … join outdoor_tests …"', 'sun hours joined to 1,140 outdoor tests', true),
      ], reply('**2,880 days** of sunshine hours are in *sun-hours.csv* and in the database, joined to every outdoor test. Fourteen days had no reading; they are marked, not guessed.'), nTools(2)), viewPane('sun-hours.csv', sheetMock('sun-hours.csv', ['Month', 'Sun hours', 'Outdoor tests'], [['Jun 2025', '292', '48'], ['Jul 2025', '305', '52'], ['Aug 2025', '241', '44'], ['Sep 2025', '163', '40']], '2019–2026 · weather service open data')), FRANK.org),
    },
    {
      s: 'papers', at: '16:40', ask: 'Which of these forty papers measured lightfastness of indigo on linen?',
      did: 'His agent searches every paper, the scanned ones too, by word and by meaning, so it also finds the two that call it “fading under light”. It answers with the page for each.',
      screen: () => screen('Lightfastness papers', you('16:20', 'Which of these forty papers measured lightfastness of indigo on linen?', att('literature/dyes/', '40 PDFs')) + pi([
        tool('bash', 'rga -i "lightfast|light fastness" literature/dyes/', '4 papers by word'),
        tool('bash', 'python3 tools/semantic_search.py "indigo on linen fades in light"', '2 more by meaning · “fading under light”, “photodegradation”', true),
      ], reply('**Six papers**, with the page for each:\n\n| File | Fibre | Page |\n|---|---|---|\n| lightfast-linen-2019.pdf | linen | 7 |\n| indigo-fibres-2021.pdf | linen, cotton | 12 |\n| dye-ageing-2015.pdf | linen | 4 |\n\n… and three more. Two of them never use the word “lightfastness”.'), nTools(2)), '', FRANK.org),
    },
  ],
});

// =====================================================================
// Alice's other weeks: three glimpses shown after her day in variant 3
// =====================================================================
const ALICE_MORE = mkDay({
  id: 'alice', name: 'Alice', role: 'Founder, CEO', org: 'Example Studio', color: 'var(--ah-accent)',
  places: [['09:00', 'Mon 2 Nov, at her desk', 'desk'], ['12:30', 'Tue 10 Nov, at home', 'home'], ['15:30', 'Wed 18 Nov, in the studio', 'studio']],
  sess: [
    { id: 'board', title: 'Board report, Q3', segs: [['09:05', 'run', 'Gathering the figures'], ['09:20', 'turn', '4 pages · 2 figures to check'], ['09:40', 'quiet', 'board-2026-q3.pdf']] },
    { id: 'model', title: 'Bigger studio?', segs: [['12:40', 'run', 'Building the model'], ['13:00', 'turn', '3 scenarios to try'], ['13:30', 'quiet', 'studio-move.xlsx']] },
    { id: 'loan', title: 'Loan for the second press', segs: [['15:40', 'run', 'Filling the bank’s form'], ['16:00', 'turn', 'Form and 6 attachments'], ['16:20', 'quiet', 'loan/']] },
  ],
  g: [
    {
      s: 'board', at: '09:20', ask: 'The board report for the third quarter: last quarter’s layout, this quarter’s figures.',
      did: 'Her agent takes the figures from Kirsi’s books, the shop’s orders and the bank, fills last quarter’s layout and writes the commentary in her style. Every number has its source in a footnote, and the two that changed after Kirsi’s corrections are marked for her.',
      screen: () => screen('Board report, Q3', you('09:05', 'The board report for the third quarter: last quarter’s layout, this quarter’s figures.') + pi([
        tool('read', 'board/2026-q2.pdf', 'last layout: 4 pages · 6 figures · commentary'),
        tool('bash', 'hledger -f books/2026.journal balance -Q --period Q3', 'revenue, margin and costs by month'),
        tool('bash', 'duckdb -c "select channel, count(*) from orders where quarter = 3 group by 1"', 'web 3,140 · wholesale 412 · markets 870'),
        tool('bash', 'typst compile board/2026-q3.typ', 'board-2026-q3.pdf · 4 pages · 11 footnotes', true),
      ], reply('The draft is beside this. Two figures changed after Kirsi’s September corrections and are marked. It goes to the board when you send it.', offer('board-2026-q3.pdf', 'PDF · 4 pages')), nTools(4)), viewPane('board-2026-q3.pdf', kpiMock())),
    },
    {
      s: 'model', at: '13:00', ask: 'Should we take the bigger studio next door? I want a model I can change myself: rent, more courses, a second press.',
      did: 'Her agent builds a spreadsheet with every assumption in one yellow column and three scenarios side by side; change a number and everything follows. It is a spreadsheet she can open and argue with, not an answer she has to trust.',
      screen: () => screen('Bigger studio?', you('12:40', 'Should we take the bigger studio next door? I want a model I can change myself: rent, more courses, a second press.') + pi([
        tool('read', 'books/2026.journal · slides/cash-2026-10.pdf', 'this year’s costs · Kirsi’s cash forecast'),
        tool('write', 'models/studio-move.xlsx', '3 scenarios · 14 assumptions in yellow · 2 years by month'),
        tool('bash', 'python3 tools/check_model.py models/studio-move.xlsx', 'every formula checked against a hand calculation', true),
      ], reply('Three scenarios are beside this. Moving pays only **with the courses**: twice as many places a month covers the rent and the press by the end of 2027. Change any yellow cell and the rest follows.', offer('studio-move.xlsx', 'Spreadsheet · 3 sheets')), nTools(3)), viewPane('studio-move.xlsx', modelMock())),
    },
    {
      s: 'loan', at: '16:00', ask: 'The bank’s loan form for the second press: fill it from my papers and gather the attachments they ask for.',
      did: 'The bank wants a form and six attachments. Her agent fills the form from last year’s accounts, Kirsi’s budget and the press quote, gathers the attachments from her folders, and lists the two things only she can do. Nothing goes to the bank until she sends it.',
      screen: () => screen('Loan for the second press', you('15:40', 'The bank’s loan form for the second press: fill it from my papers and gather the attachments they ask for.', att('bank-loan-form.pdf', 'PDF form · 6 pages')) + pi([
        tool('read', 'bank-loan-form.pdf', '41 fields · 6 attachments asked for'),
        tool('bash', 'uv run --with pypdf python3 tools/fill_form.py bank-loan-form.pdf', '39 of 41 fields filled · each from a named file', true),
        tool('write', 'loan/', 'form and 4 of 6 attachments · numbered as the bank lists them'),
      ], reply('The form is filled and four attachments are in *loan/*, numbered as the bank lists them. **Two are yours to do**: sign the form, and download your tax certificate, which needs your own bank login.'), nTools(3)), viewPane('loan/', checklistMock('Loan application · second press', [[1, 'Application form, filled', '39 of 41'], [1, 'Financial statements 2025', 'accounts/'], [1, 'Budget 2026–27', 'Kirsi'], [1, 'Quote for the press', 'suppliers/'], [0, 'Signature', 'Alice'], [0, 'Tax certificate', 'Alice']]))),
    },
  ],
});
const ROLES = [BOB, KIRSI, CAROL, DAVE, ERIN, FRANK];
const FULL_DAYS = [ALICE, ...ROLES];
