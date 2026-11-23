// Bob: Sales and orders. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, md, MIC_IC, you, att, tool, turn, offer, drafts, screen, view, image, assets } from '../../engine/kit.mjs';
const asset = assets(import.meta.url);
import { sw, toggles } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const docMock = (k, blocks) => `<div class="doc"><p class="doc-k">${esc(k)}</p>${blocks.map(([h, items]) => `<b class="doc-h">${esc(h)}</b><ul>${items.map((t) => `<li>${md(t).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>`).join('')}</div>`;
// The dedup's real output (src/dedup.py, run by assets.mjs): Corner Books' three rows
// as the register had them, and the first pair in ask-bob.csv.
const DUPES = [['C00826', 'Corner Books', '12 Mill Lane', 'orders@cornerbooks…', 2015, 23], ['C00049', 'Corner Books Ltd', '12 Mill Ln.', 'orders@cornerbooks…', 2019, 11], ['C03598', 'Cornerbooks', 'Mill Lane 12', 'info@cornerbooks…', 2023, 7]];
const ASK = [['Leo Olsen', '27 Mill Lane', 'since 2023'], ['Leo Olesn', '3 Old Town Row', 'since 2026']];
const ddRow = ([id, n, a, e, y, o]) => `<li><span class="bdd-id">${id}</span><b>${esc(n)}</b><span class="bdd-a">${esc(a)}</span><span class="bdd-e">${esc(e)}</span><small>${y} · ${o} orders</small></li>`;
const dedupMock = () => `<div class="bdd" data-view data-state="after">
<div class="bdd-count"><p><b>4,205</b><span>rows</span></p><i aria-hidden="true">→</i><p class="bdd-big"><b>3,901</b><span>customers</span></p><p><b>304</b><span>rows merged</span></p><p class="bdd-q"><b>90</b><span>pairs to ask</span></p></div>
${toggles([['before', 'Before'], ['after', 'After']], 'after')}
<ul class="bdd-l bdd-before">${DUPES.map(ddRow).join('')}</ul>
<ul class="bdd-l bdd-after"><li class="bdd-one"><span class="bdd-id">C00826</span><b>Corner Books</b><span class="bdd-a">12 Mill Lane</span><span class="bdd-e">orders@cornerbooks…</span><small>since 2015 · <strong>41 orders</strong> · C00049 and C03598 merged in</small></li></ul>
<p class="bdd-h">In ask-bob.csv · same email, another address</p>
<ul class="bdd-l bdd-ask">${ASK.map(([n, a, y]) => `<li><b>${esc(n)}</b><span class="bdd-a">${esc(a)}</span><small>${y}</small></li>`).join('')}<li class="bdd-askq">Moved, or two people? Bob knows.</li></ul>
</div>`;
// The quote as Typst typeset it (src/quote.typ), page 1 down to the signature.
const quoteMock = () => `<figure class="bqt">${image(asset('quote.webp'), 'Quote Q-2026-118 from Example Studio to Harbour Hotel: six large indigo prints on linen at €490, six oak frames at €260, hanging in January €480; subtotal €4,980, VAT 25.5 % €1,269.90, total €6,249.90.', 1191, 1330, 'bqt-img')}<figcaption><span>Q-2026-118.pdf · A4 · typeset with Typst</span><span>page 1 of 1</span></figcaption></figure>`;
// The round OR-Tools found on OpenStreetMap roads (src/route.py), and Bob's phone list.
const STOPS = [['11:01', 'Old Town Bakery'], ['11:11', 'Granary Market'], ['11:19', 'Cedar Guesthouse'], ['11:28', 'Pine Street Kitchen'], ['11:34', 'Hillside Care Home'], ['11:41', 'Harbour Hotel'], ['11:51', 'Harbour Gifts'], ['11:58', 'Copper Kettle Tea Room'], ['12:04', 'Sauna Lodge'], ['12:10', 'Station Kiosk'], ['12:17', 'Riverside Café'], ['12:23', 'Mill Lane Deli'], ['12:28', 'Linden Florist'], ['12:37', 'Northside Hardware'], ['12:45', 'Maple Interiors'], ['12:51', 'Blue Door Gallery'], ['12:58', 'Willow Day Nursery'], ['13:05', 'Oak & Ash Furniture'], ['13:15', 'Little Loom Yarns'], ['13:22', 'Corner Books']];
const routeMock = () => `<div class="brt"><figure class="brt-map">${image(asset('route-map.webp'), 'Map of a small town with Thursday’s delivery round drawn on its streets: twenty numbered stops in one loop from the studio, the bakery first.', 1200, 900, 'brt-img')}</figure>
<p class="brt-sum"><span><b>41.5 km</b> · 69 min driving</span><span>11:00 → back <b>13:28</b></span><span>3 deliver-by times met</span></p>
<ol class="brt-l">${STOPS.map(([t, n], k) => `<li${k === 0 ? ' class="brt-first"' : ''}><span class="brt-n">${k + 1}</span><time>${t}</time><span>${esc(n)}</span></li>`).join('')}</ol>
<p class="brt-c">Map data © OpenStreetMap contributors, ODbL</p></div>`;
const custMapMock = (left = '3,412 orders by postcode', right = '21 % across the river') => `<div class="map">${sw(`<rect width="320" height="200" fill="#eef1ea"/><path d="M0 120 C60 100 100 140 160 118 S260 80 320 104 V128 C260 104 200 150 160 142 S60 126 0 146 Z" fill="#b8cbd8"/><g fill="#d9dfd2">${[[20, 20, 80, 70], [120, 10, 90, 80], [230, 20, 80, 60], [20, 160, 100, 36], [140, 150, 80, 46], [240, 140, 76, 56]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`).join('')}</g><rect x="140" y="150" width="80" height="46" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/><rect x="240" y="140" width="76" height="56" rx="3" fill="rgba(180,90,51,.22)" stroke="#b45a33" stroke-dasharray="4 3"/>${Array.from({ length: 70 }, (_, k) => { const south = k % 5 === 0 || k % 7 === 0; const x = south ? 150 + ((k * 37) % 160) : 24 + ((k * 61) % 280); const y = south ? 154 + ((k * 13) % 38) : 16 + ((k * 29) % 80); return `<circle cx="${x}" cy="${y}" r="2.6" fill="${south ? '#b45a33' : '#2c6e3f'}" opacity=".8"/>`; }).join('')}<g><circle cx="150" cy="56" r="7" fill="#fff" stroke="#23432c" stroke-width="2.5"/><circle cx="150" cy="56" r="2.5" fill="#23432c"/></g><text x="162" y="60" font-size="11" font-family="system-ui" fill="#23432c">Shop</text>`)}<p class="map-n"><span>${esc(left)}</span><span><b class="sw sw-o"></b>${esc(right)}</span></p></div>`;

export default {
  id: 'role-bob',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'bob', name: 'Bob', role: 'Sales and orders', org: 'Example Studio', color: '#3e5b6e',
  blurb: 'Bob sells Example Studio’s linen to shops, hotels and the odd public buyer, and gets the orders out. Thursday is delivery day.',
  places: [['08:00', 'At the studio', 'studio'], ['10:15', 'Planning with Alice and Carol', 'meet'], ['11:00', 'Delivering', 'van'], ['13:40', 'Lunch', 'lunch'], ['14:10', 'At Harbour Hotel', 'meet'], ['14:40', 'At the studio', 'studio'], ['15:40', 'Packing with Alice', 'box'], ['16:40', 'At the studio', 'studio']],
  sess: [
    { id: 'clean', title: 'Customer list cleanup', segs: [['08:02', 'run', 'Comparing 4,205 rows'], ['08:20', 'turn', '3,901 customers · 90 to ask'], ['08:45', 'quiet', 'customers-clean.csv']] },
    { id: 'brief', title: 'Harbour Hotel briefing', segs: [['09:00', 'run', 'Reading three years of mail'], ['09:10', 'turn', 'One page for 14:10'], ['09:20', 'quiet', 'Read']] },
    { id: 'route', title: 'Thursday deliveries', segs: [['10:40', 'run', 'Ordering 20 stops'], ['10:50', 'turn', '41.5 km · bakery first'], ['10:58', 'quiet', 'route-19-nov.pdf']] },
    { id: 'map', title: 'Orders on a map', segs: [['12:05', 'run', 'Placing 3,412 orders'], ['12:20', 'turn', 'Two districts, no shop'], ['12:40', 'quiet', 'orders-map.html']] },
    { id: 'quote', title: 'Harbour Hotel quote', segs: [['14:40', 'run', 'Pricing six prints'], ['14:50', 'turn', 'Quote ready · send?'], ['14:53', 'quiet', 'Sent to Harbour Hotel']] },
    { id: 'tender', title: 'Library tender', segs: [['16:45', 'run', 'Reading 5 attachments'], ['16:58', 'turn', '3 questions to ask'], ['17:10', 'quiet', 'questions.docx']] },
  ],
  g: [
    {
      s: 'clean', at: '08:20', pick: 1, ask: 'Our customer list has over 4,000 rows and some shops are in it three times. Clean it up without losing an order.',
      did: 'Twelve years of web orders, wholesale accounts and market sign-ups ended up in one file. His agent compares every name within each postcode, merges a row only when the address or the company’s email domain agrees too, carries the orders across, and puts the 90 it cannot be sure of in front of Bob.',
      screen: () => screen('Customer list cleanup', you('08:02', 'Our customer list has over 4,000 rows and some shops are in it three times. Clean it up without losing an order.', att('customers.csv', '4,205 rows · 2014–2026')) + turn({
        thoughts: ['Names alone are not enough: two Leo Olsens can be two people. A merge needs the address or a company email domain to agree as well.'],
        tools: [
          tool('read', 'customers.csv', 'id,name,address,postcode,email,orders,year\nC00001,…\n4,205 rows · 16 postcodes'),
          tool('write', 'tools/match_customers.py', 'normalise names (Ltd, Oy, case, spaces) and addresses (Ln. → Lane, number order)\ncompare names within each postcode: rapidfuzz ratio ≥ 85\nmerge only if same address or same company email domain', 'new · 64 lines'),
          tool('bash', 'uv run --with rapidfuzz python3 tools/match_customers.py customers.csv', '4205 rows · 552975 pairs compared in 16 postcodes\n304 rows merged into 270 customers: same name and same address or company email domain\n90 unsure: similar name, different address\n3901 customers in customers-clean.csv'),
          tool('bash', 'python3 -c "…sum(orders) before and after…"', 'orders before: 21733 · after: 21733'),
        ],
        time: '18 min 57 s',
        reply: '**3,901 customers**, from 4,205 rows, and every order is still there. 304 rows were a customer written another way: Corner Books alone was “Corner Books”, “Corner Books Ltd” and “Cornerbooks”, 41 orders between them. **90 pairs I left to you**: same name or email at another address. They are in *ask-bob.csv*, two lines each.',
        extra: offer('customers-clean.csv', 'CSV · 3,901 customers'),
      }), view('customers-clean.csv', dedupMock()), 'Example Studio'),
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
      s: 'route', at: '10:50', pick: 1, ask: 'Today’s twenty deliveries. The bakery has to be first, and the market and the hotel have their times on the orders.',
      did: 'From the order list and the town’s real streets, his agent works out the shortest loop that keeps every promise, and puts the stops on his phone with arrival times before he starts the van.',
      screen: () => screen('Thursday deliveries', you('10:40', 'Today’s twenty deliveries. The bakery has to be first, and the market and the hotel have their times on the orders.') + turn({
        tools: [
          tool('read', 'orders/deliveries-2026-11-19.csv', '20 stops · 3 with a deliver-by time\nOld Town Bakery     by 11:20\nGranary Market      by 12:00\nHarbour Hotel       by 12:30'),
          tool('bash', 'python3 tools/road_graph.py maps/town.osm.json', 'road graph: 9423 nodes, 18596 edges · one-way streets kept\n21 × 21 drive times and distances'),
          tool('bash', 'uv run --with ortools python3 tools/route.py --first "Old Town Bakery" --service 4min', 'best loop: 41.5 km · drive 69 min · back 13:28 · windows met: True\nnearest stop each time instead: 48.8 km'),
          tool('write', 'deliveries/route-19-nov.pdf', 'map and 20 stops with times', 'new · 2 pages'),
        ],
        time: '10 min 27 s',
        reply: 'Leave at **11:00** and you are back at **13:28**: **41.5 km**, the bakery first and every deliver-by time met. The map and the list for your phone are beside this.',
        extra: offer('route-19-nov.pdf', 'PDF · map and 20 stops'),
      }), view('route-19-nov.pdf', routeMock()), 'Example Studio'),
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
      did: 'Back from the meeting, he says it in one sentence. His agent takes the prices from the price list, the frames from the framer’s last invoice and the hotel’s details from the customer list, typesets the quote in the studio’s own template, and sends it from Bob’s mailbox only when he says so.',
      screen: () => screen('Harbour Hotel quote', you('14:40', 'Quote for Harbour Hotel, as we agreed: six large prints framed in oak, hung by us in January.') + turn({
        tools: [
          tool('read', 'prices/2026.csv · framer invoice 2026-10.pdf', 'large print 90 × 120 · €490.00\noak frame 90 × 120, non-reflective glazing · €260.00\nhanging, two people, half a day · €480.00'),
          tool('read', 'customers-clean.csv', 'C01208 Harbour Hotel · Nina Holm, operations manager · 1 Harbour Road'),
          tool('write', 'quotes/Q-2026-118.typ', '#import "../templates/quote.typ": quote\n#show: quote.with(number: "Q-2026-118", to: "Harbour Hotel", …)', 'new · 9 lines'),
          tool('bash', 'typst compile quotes/Q-2026-118.typ', 'Q-2026-118.pdf · 1 page · A4'),
        ],
        time: '10 min 49 s',
        reply: 'The quote is beside this: **€4,980 + VAT**, €6,249.90 in all, valid until 19 December. Send it to Nina Holm?',
        extra: offer('Q-2026-118.pdf', 'PDF · 1 page · A4'),
      }) + you('14:52', 'Send it.') + turn({ reply: 'Sent from your mailbox, with the PDF.', extra: drafts([['sent', 'Nina Holm, Harbour Hotel', 'Quote: six prints for the lobby', 'Hi Nina, thank you for today. The quote for the six framed prints is attached, valid until 19 December…']]) }), view('Q-2026-118.pdf', quoteMock()), 'Example Studio'),
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
