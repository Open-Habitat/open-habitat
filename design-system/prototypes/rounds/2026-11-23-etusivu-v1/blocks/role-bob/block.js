// Bob: Sales and orders. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, md, MIC_IC, you, att, tool, turn, offer, drafts, screen, view } from '../../engine/kit.mjs';
import { sw, toggles } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const docMock = (k, blocks) => `<div class="doc"><p class="doc-k">${esc(k)}</p>${blocks.map(([h, items]) => `<b class="doc-h">${esc(h)}</b><ul>${items.map((t) => `<li>${md(t).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>`).join('')}</div>`;
const DUPES = [['Corner Books', '12 Mill Lane', '23 orders'], ['Corner Books Ltd', '12 Mill Ln.', '11 orders'], ['Cornerbooks', 'Mill Lane 12', '7 orders']];
const dedupMock = () => `<div class="dd" data-view data-state="after">${toggles([['before', 'Before'], ['after', 'After']], 'after')}<ul class="dd-l dd-before">${DUPES.map(([n, a, o]) => `<li><b>${esc(n)}</b><span>${esc(a)}</span><small>${esc(o)}</small></li>`).join('')}</ul><ul class="dd-l dd-after"><li class="dd-one"><b>Corner Books</b><span>12 Mill Lane</span><small>41 orders · 3 rows merged</small></li></ul><p class="dd-n"><span>4,100 rows → 3,800 customers</span><span>300 merged · 80 to ask</span></p></div>`;
const quoteMock = () => `<div class="doc qt"><p class="doc-k">Quote Q-2026-118 · Example Studio · valid 30 days</p><b class="doc-h">Harbour Hotel · lobby prints</b><table><tbody>${[['6 large prints, indigo on linen', '€2,940'], ['Oak frames, 6 × 90 × 120 cm', '€1,560'], ['Hanging, one morning in January', '€480']].map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}<tr class="qt-tot"><td>Total, VAT 0 % (business)</td><td>€4,980</td></tr></tbody></table><p class="qt-n">Prices from prices/2026.csv · frames from the framer’s October invoice</p></div>`;
const custMapMock = (left = '3,412 orders by postcode', right = '21 % across the river') => `<div class="map">${sw(`<rect width="320" height="200" fill="#eef1ea"/><path d="M0 120 C60 100 100 140 160 118 S260 80 320 104 V128 C260 104 200 150 160 142 S60 126 0 146 Z" fill="#b8cbd8"/><g fill="#d9dfd2">${[[20, 20, 80, 70], [120, 10, 90, 80], [230, 20, 80, 60], [20, 160, 100, 36], [140, 150, 80, 46], [240, 140, 76, 56]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`).join('')}</g><rect x="140" y="150" width="80" height="46" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/><rect x="240" y="140" width="76" height="56" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/>${Array.from({ length: 70 }, (_, k) => { const south = k % 5 === 0 || k % 7 === 0; const x = south ? 150 + ((k * 37) % 160) : 24 + ((k * 61) % 280); const y = south ? 154 + ((k * 13) % 38) : 16 + ((k * 29) % 80); return `<circle cx="${x}" cy="${y}" r="2.6" fill="${south ? '#b45a33' : '#2c6e3f'}" opacity=".8"/>`; }).join('')}<g><circle cx="150" cy="56" r="7" fill="#fff" stroke="#23432c" stroke-width="2.5"/><circle cx="150" cy="56" r="2.5" fill="#23432c"/></g><text x="162" y="60" font-size="11" font-family="system-ui" fill="#23432c">Shop</text>`)}<p class="map-n"><span>${esc(left)}</span><span><b class="sw sw-o"></b>${esc(right)}</span></p></div>`;
const routeMock = (n = 22, right = '41 km · last week 58 km') => { const pts = Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return [160 + Math.cos(a) * (110 + (k % 3) * 12), 100 + Math.sin(a) * (62 + (k % 4) * 6)]; }); return `<div class="map">${sw(`<rect width="320" height="200" fill="#eef1ea"/><g stroke="#d9dfd2" stroke-width="6">${[40, 90, 140, 190, 240, 290].map((x) => `<path d="M${x} 0 V200"/>`).join('')}${[40, 100, 160].map((y) => `<path d="M0 ${y} H320"/>`).join('')}</g><path d="M${pts.map((p) => p.map((v) => v.toFixed(0)).join(' ')).join(' L')} Z" fill="none" stroke="#2c6e3f" stroke-width="2.5"/>${pts.map(([x, y], k) => `<g><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${k === 0 ? 8 : 6.5}" fill="${k === 0 ? '#b45a33' : '#fff'}" stroke="#2c6e3f" stroke-width="1.5"/><text x="${x.toFixed(0)}" y="${(y + 3).toFixed(0)}" text-anchor="middle" font-size="7.5" font-family="system-ui" font-weight="700" fill="${k === 0 ? '#fff' : '#1f5430'}">${k + 1}</text></g>`).join('')}<rect x="132" y="88" width="56" height="24" rx="5" fill="#23432c"/><text x="160" y="104" text-anchor="middle" font-size="11" font-family="system-ui" fill="#fff">Studio</text>`)}<p class="map-n"><span>${n} stops · bakery first</span><span>${esc(right)}</span></p></div>`; };

export default {
  id: 'role-bob',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
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
      screen: () => screen('Customer list cleanup', you('08:02', 'Our customer list has 4,100 rows, and some shops are in it three times under different spellings. Clean it up.', att('customers.csv', '4,100 rows · 2014–2026')) + turn({ tools: [
        tool('bash', 'uv run --with rapidfuzz python3 tools/match_customers.py customers.csv', '380 probable duplicates\n300 certain: same address or same email domain\n 80 unsure: similar name, different address'),
        tool('write', 'customers-clean.csv', '3,800 customers · every order kept with its customer'),
        tool('write', 'ask-bob.csv', '80 pairs · two lines each'),
      ], time: '18 min 57 s', reply: '**300 merged**, so the list has 3,800 customers now. Corner Books was in it three times, as “Corner Books”, “Corner Books Ltd” and “Cornerbooks”, with 41 orders between them. **80 I am not sure of**; they are in *ask-bob.csv*, two lines each.' }), view('customers-clean.csv', dedupMock()), 'Example Studio'),
    },
    {
      s: 'brief', at: '09:10', ask: 'Brief me on Harbour Hotel before the meeting at 14:10.',
      did: 'His agent reads three years of mail with the hotel, their orders in the shop’s files, his notes from the last calls and the hotel’s own news page, and gives him one page: who he meets, what they bought, what to bring up.',
      screen: () => screen('Harbour Hotel briefing', you('09:00', 'Brief me on Harbour Hotel before the meeting at 14:10.') + turn({ tools: [
        tool('read', 'sales/harbour-hotel.md', '3 calls since 2024 · last: “lobby, maybe prints”'),
        tool('bash', 'gog gmail search "from:harbourhotel.example.org"', '62 messages · 2024–2026'),
        tool('bash', 'duckdb -c "select … from orders where customer = \'Harbour Hotel\'"', '9 orders · €6,840 · last: 40 napkins, June'),
        tool('bash', 'curl -s https://harbourhotel.example.org/news', 'lobby renovation finishes in January'),
      ], time: '10 min 42 s', reply: 'The briefing is beside this. The thing to know: **their lobby reopens in January**, and on your last call they asked about oak frames.' }), view('briefing-harbour-hotel.md', docMock('Briefing · Harbour Hotel · Thu 14:10', [['Who you meet', ['Nina Holm, operations manager; she decides on the lobby', 'The new owner may join for ten minutes']], ['What they bought', ['9 orders since 2024, €6,840 in all', 'Napkins and table runners, reordered every June']], ['What to bring up', ['The lobby reopens in January: six large prints?', 'They asked about **oak frames** in September', 'The June invoice was paid 40 days late']]])), 'Example Studio'),
    },
    {
      s: 'route', at: '10:50', pick: 1, ask: 'Today’s twenty deliveries. The bakery has to be first.',
      did: 'From the order list and the addresses, his agent works out the best loop round town with the bakery first, and gives him the stops in order with arrival times, on his phone before he leaves.',
      screen: () => screen('Thursday deliveries', you('10:40', 'Today’s twenty deliveries. The bakery has to be first.') + turn({ tools: [
        tool('read', 'orders/deliveries-2026-11-19.csv', '20 stops · 3 with a time window'),
        tool('bash', 'vroom -i stops.json', 'best loop: 38.4 km · 2 h 35 min · all time windows met'),
      ], time: '10 min 27 s', reply: 'Leave at **11:00** and you are back at 13:35. **38 km**, against 52 last Thursday. The map and the list for your phone are beside this.', extra: offer('route-19-nov.pdf', 'PDF · map and 20 stops') }), view('route-19-nov.pdf', routeMock(20, '38 km · last week 52 km')), 'Example Studio'),
    },
    {
      s: 'map', at: '12:20', ask: 'Put our web orders and the shops that stock us on one map. Where are we missing a shop?',
      did: 'Between two stops he asks by voice. His agent places three years of web orders by postcode beside the twelve shops that sell Example Studio’s linen, and finds where people order a lot with no shop nearby.',
      screen: () => screen('Orders on a map', you('12:05', 'Put our web orders and the shops that stock us on one map. Where are we missing a shop?', '', `${MIC_IC}Dictated`) + turn({ tools: [
        tool('bash', 'duckdb -c "select postcode, count(*) from orders where channel = \'web\' group by 1"', '3,412 orders · 61 postcodes'),
        tool('bash', 'python3 tools/map_orders.py --shops wholesale/shops.csv', 'orders-map.html · 2 districts with no shop within 5 km'),
      ], time: '15 min 12 s', reply: '**A fifth of web orders** come from two districts across the river, and no shop there sells us. Two candidates are on the map: a bookshop and a gift shop.' }), view('orders-map.html', custMapMock('3,412 web orders · 12 shops', '21 % across the river, no shop')), 'Example Studio'),
    },
    {
      s: 'quote', at: '14:50', pick: 1, ask: 'Quote for Harbour Hotel, as we agreed: six large prints framed in oak, hung by us in January.',
      did: 'Back from the meeting, he says it in one sentence. His agent takes the prices from the price list, the framing from the framer’s last invoice and the hotel’s details from the customer list, lays out the quote in the studio’s template, and sends it from Bob’s mailbox when he says so.',
      screen: () => screen('Harbour Hotel quote', you('14:40', 'Quote for Harbour Hotel, as we agreed: six large prints framed in oak, hung by us in January.') + turn({ tools: [
        tool('read', 'prices/2026.csv · framer invoice 2026-10.pdf', 'large print €490 · oak frame 90 × 120 €260'),
        tool('write', 'quotes/Q-2026-118.typ', 'studio template · 3 lines'),
        tool('bash', 'typst compile quotes/Q-2026-118.typ', 'Q-2026-118.pdf · 1 page'),
      ], time: '10 min 49 s', reply: 'The quote is beside this: **€4,980**, valid 30 days. Send it to Nina Holm?' }) + you('14:52', 'Send it.') + turn({ reply: 'Sent from your mailbox, with the PDF.', extra: drafts([['sent', 'Nina Holm, Harbour Hotel', 'Quote: six prints for the lobby', 'Hi Nina, thank you for today. The quote for six framed prints is attached…']]) }), view('Q-2026-118.pdf', quoteMock()), 'Example Studio'),
    },
    {
      s: 'tender', at: '16:58', ask: 'The city library wants cushion covers for its reading rooms. Read the tender and tell me what we need to ask before we bid.',
      did: 'The tender is five attachments, 46 pages. His agent reads all of them, checks each requirement against what the studio makes, and drafts the clarifying questions in the form the library asks for, a week before the question deadline.',
      screen: () => screen('Library tender', you('16:45', 'The city library wants cushion covers for its reading rooms. Read the tender and tell me what we need to ask before we bid.', att('library-tender/', '5 PDFs · 46 pages')) + turn({ tools: [
        tool('bash', 'pdftotext library-tender/*.pdf', '46 pages · 24 requirements'),
        tool('read', 'products/cushion-covers.md · handbook/production.md', 'linen 240 g · 60 °C wash · made in the studio'),
        tool('write', 'tenders/library-2026/questions.docx', '3 questions in the library’s form'),
      ], time: '13 min 34 s', reply: 'We meet **21 of 24** requirements. Three need asking before 26 November; the questions are drafted in their form, beside this. Nothing is sent.' }), view('questions.docx', docMock('Questions to the city library · deadline 26 Nov', [['Questions', ['Fire rating: is EN 1021-1 enough for loose covers?', 'Quantity: the price form says 400, the specification 40 per room. Which?', 'Can delivery be split, half in March and half in May?']], ['Where we stand', ['21 of 24 requirements met as we are', 'Linen 240 g, washable at 60 °C, made in our studio']]])), 'Example Studio'),
    },
  ],
},
};
