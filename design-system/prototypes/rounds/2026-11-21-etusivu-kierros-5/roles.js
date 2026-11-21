// Other people's days on the same Thursday: the same product, other work.
// Bob, Kirsi, Grace and Mira have full days (variant 3 swaps between them);
// Nora and Theo have three glimpses each (variant 1's section only). Each
// glimpse has `pick` when variant 1 shows it and `hand` when it hands a file
// to Alice (variant 2 shows those beside her day). All invented.

// ---------- Mock views used only here ----------
const INKS = { 'indigo-rust': ['#2f4f73', '#b45a33', '#5a4a52', 'Indigo + rust: a warm slate'], 'indigo-yellow': ['#2f4f73', '#d9b23a', '#3f6b4a', 'Indigo + weld yellow: forest green'], 'rust-yellow': ['#b45a33', '#d9b23a', '#c47a2f', 'Rust + weld yellow: amber'] };
const inkMixMock = () => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>maple-lane.example.org/ink-mixing</p><div class="ink" data-view data-state="indigo-rust">${toggles(Object.keys(INKS).map((k) => [k, INKS[k][3].split(':')[0], INKS[k][3]]), 'indigo-rust')}<div class="ink-row">${Object.entries(INKS).map(([k, [a, b, m]]) => `<div class="ink-set ink-${k}"><span style="--c:${a}"></span><i>+</i><span style="--c:${b}"></span><i>=</i><span class="ink-m" style="--c:${m}"></span></div>`).join('')}</div><p class="ink-n" data-label>${INKS['indigo-rust'][3]}</p></div></div>`;
const blurMock = () => `<div class="blur"><div class="blur-g">${[0, 1, 2, 3, 4, 5].map((k) => `<span class="blur-p" style="--k:${k}">${[0, 1, 2].slice(0, 1 + (k % 3)).map((j) => `<i class="${(k + j) % 4 === 1 ? 'b' : ''}" style="--x:${20 + j * 28}%"></i>`).join('')}</span>`).join('')}</div><p class="blur-n">142 photos · 6 pupils without permission blurred everywhere · 9 to check</p></div>`;
const cardsMock = () => `<div class="cards" data-view data-state="q">${toggles([['q', 'Question'], ['a', 'Answer']], 'q')}<div class="card"><p class="card-q">Why is a woodblock print reversed?</p><p class="card-a">The block is pressed face down, so the image comes out mirrored. Letters are carved backwards.</p></div><p class="cards-n">Card 7 of 40 · from Grace’s own slides</p></div>`;
const captionMock = () => `<div class="capf" data-view data-state="en">${toggles([['en', 'English'], ['fi', 'Suomi']], 'en')}<div class="capf-frame"><span class="capf-pic" aria-hidden="true"></span><span class="capf-en">Roll the ink thin. Thick ink fills the cuts.</span><span class="capf-fi" lang="fi">Levitä muste ohueksi. Paksu muste täyttää urat.</span></div><p class="capf-n">safety-printing.mp4 · 6:40 · 2 subtitle files</p></div>`;
const checklistMock = (title, rows) => `<div class="cl"><p class="cl-h">${esc(title)}</p><ul>${rows.map(([done, t, who]) => `<li class="${done ? 'done' : ''}"><span class="cl-b" aria-hidden="true"></span><span>${esc(t)}</span><small>${esc(who)}</small></li>`).join('')}</ul></div>`;
const posterMock = () => `<div class="pst"><div class="pst-a3"><small>Riverside Gallery · 4–20 Dec</small><b>Cut, Ink, Press</b><span>Linocuts by Theo Lind</span></div><div class="pst-a5"><b>Cut, Ink, Press</b><span>4–20 Dec</span></div><div class="pst-sq"><b>Cut,<br>Ink,<br>Press</b></div><p class="pst-n"><span>A3 poster · A5 flyer · square</span><span>CMYK · 3 mm bleed</span></p></div>`;
const framesMock = () => `<div class="frames">${['Indigo is not soluble in water', 'Reduced, it turns yellow-green and soaks in', 'In the air it oxidises back to blue, inside the fibre'].map((t, k) => `<div class="frame-k" style="--k:${k}"><span class="fr-fib" aria-hidden="true"></span><span class="fr-dots" aria-hidden="true"></span><small>${k + 1}</small><p>${esc(t)}</p></div>`).join('')}<p class="frames-n">indigo-binding.mp4 · 48 s · 3 scenes</p></div>`;

// =====================================================================
// Bob: orders, suppliers and sales at Example Studio
// =====================================================================
const BOB = mkDay({
  id: 'bob', name: 'Bob', role: 'Orders and sales', org: 'Example Studio', color: '#3e5b6e',
  blurb: 'Bob handles Example Studio’s orders, suppliers and wholesale customers. Thursday is delivery day.',
  places: [['08:00', 'At the studio', 'studio'], ['09:40', 'Delivering', 'van'], ['12:00', 'At the studio', 'studio'], ['12:30', 'Lunch', 'lunch'], ['13:00', 'At the studio', 'studio'], ['15:40', 'Packing with Alice', 'box'], ['16:40', 'At the studio', 'studio']],
  sess: [
    { id: 'fjord', title: 'Fjord Paper prices', segs: [['08:05', 'run', 'Reading a 60-page PDF'], ['08:20', 'turn', '43 items up more than 5 %'], ['08:31', 'quiet', 'fjord-changes.xlsx']] },
    { id: 'route', title: 'Thursday deliveries', segs: [['09:05', 'run', 'Ordering 22 stops'], ['09:30', 'turn', '41 km · bakery first'], ['09:38', 'quiet', 'route-19-nov.pdf']] },
    { id: 'breakage', title: 'Glass breakage terms', segs: [['10:10', 'run', 'Indexing 48,000 messages'], ['10:40', 'turn', 'Found: 2021 terms, p. 3'], ['12:05', 'quiet', 'Read']] },
    { id: 'hotel', title: 'Harbour Hotel follow-up', segs: [['11:20', 'run', 'Building a one-page site'], ['11:50', 'turn', 'Page ready to share'], ['12:02', 'quiet', 'Link copied']] },
    { id: 'photos', title: 'Winter prints photos', segs: [['12:55', 'run', 'Cutting out 38 photos'], ['13:10', 'turn', '38 ready · 2 to check'], ['13:20', 'quiet', 'team/photos/winter']] },
    { id: 'courier', title: 'Courier invoices', segs: [['13:40', 'run', 'Walking through 12 months'], ['14:20', 'turn', '212 invoices filed'], ['14:30', 'quiet', 'Filed']] },
    { id: 'notes', title: 'Wholesale notes', segs: [['16:00', 'run', 'Drafting 12 notes'], ['16:10', 'turn', '12 drafts, your style'], ['16:25', 'quiet', 'In your drafts']] },
  ],
  g: [
    {
      s: 'fjord', at: '08:20', pick: 1, ask: 'Fjord Paper’s new price list is a 60-page PDF. Which of our items went up more than 5 %?',
      did: 'His agent pulls every table out of the PDF, matches 1,900 rows to last year’s list and to what the shop actually stocks, and answers with a spreadsheet he can forward.',
      screen: () => screen('Fjord Paper prices', you('08:05', 'Fjord Paper’s new price list is a 60-page PDF. Which of our items went up more than 5 %?', att('fjord-paper-2027.pdf', 'PDF · 60 pages')) + pi([
        tool('bash', 'uv run --with camelot-py python3 tools/extract_tables.py fjord-paper-2027.pdf', '1,912 rows from 58 tables'),
        tool('bash', 'python3 tools/compare_prices.py --stocked stock/items.csv', '214 items we stock · 43 up more than 5 % · 3 discontinued', true),
      ], reply('**43 of the 214 items we stock** went up more than 5 %; the biggest are the gift boxes (+14 %). Three items are no longer in the list at all.', offer('fjord-changes.xlsx', '43 rows · old, new, change'))), viewPane('fjord-changes.xlsx', sheetMock('fjord-changes.xlsx', ['Item', 'Old', 'New', 'Change'], [['Gift box, large', '€2.10', '€2.40', '+14 %'], ['Kraft paper, 50 m', '€18.00', '€19.90', '+11 %'], ['Tissue, natural', '€6.20', '€6.80', '+10 %'], ['Labels, 500', '€9.40', '€10.10', '+7 %']], '… 39 more · 3 discontinued')), BOB.org),
    },
    {
      s: 'route', at: '09:30', pick: 1, ask: 'Thursday’s twenty-two deliveries. The bakery has to be first.',
      did: 'From the order list and the addresses, his agent works out the best loop round town with the bakery first, and gives him the stops in order with arrival times.',
      screen: () => screen('Thursday deliveries', you('09:05', 'Thursday’s twenty-two deliveries. The bakery has to be first.') + pi([
        tool('read', 'orders/deliveries-2026-11-19.csv', '22 stops · 3 with a time window'),
        tool('bash', 'vroom -i stops.json', 'best loop: 41.2 km · 3 h 10 min · all time windows met', true),
      ], reply('Leave at **9:40** and you are back at 12:50. **41 km**, against 58 last Thursday. The map and the list for your phone are beside this.', offer('route-19-nov.pdf', 'PDF · map and 22 stops'))), viewPane('route-19-nov.pdf', routeMock()), BOB.org),
    },
    {
      s: 'breakage', at: '10:40', ask: 'What did we agree with the glass supplier about breakage? It’s somewhere in my predecessor’s mail.',
      did: 'From the van, between two stops. Ten years of his predecessor’s mail are an export file in the shop’s folder. The agent indexes all of it, finds the agreement and quotes it with the page.',
      screen: () => screen('Glass breakage terms', you('10:10', 'What did we agree with the glass supplier about breakage? It’s somewhere in my predecessor’s mail.', '', `${MIC_IC}Dictated`) + pi([
        tool('bash', 'notmuch new  # archive/mail-2014-2024', '48,112 messages indexed'),
        tool('bash', 'notmuch search "glass AND (breakage OR broken)" | head', '14 threads · the 2021 terms attached as PDF', true),
        tool('read', 'Clearline terms 2021.pdf, page 3', '“Breakage in transit is credited in full when reported with photos within 7 days.”'),
      ], reply('**Full credit for breakage in transit, if reported with photos within 7 days.** That is in Clearline’s 2021 terms, page 3, attached to an email of 12 March 2021.')), '', BOB.org),
    },
    {
      s: 'hotel', at: '11:50', ask: 'The Harbour Hotel liked the indigo prints for their lobby. Make them a page they can look at.',
      did: 'After a good call, his agent makes a one-page site with prints that suit the lobby, the framing options and a booking link, checks it on a phone, and gives Bob the link to send himself.',
      screen: () => screen('Harbour Hotel follow-up', you('11:20', 'The Harbour Hotel liked the indigo prints for their lobby. Make them a page they can look at.') + pi([
        tool('read', 'sales/harbour-hotel.md', 'call 19 Nov: lobby, 6 large prints, blue and sand'),
        tool('write', 'pages/harbour-hotel/index.html', '6 prints · 3 framing options · booking link'),
        tool('publish', 'pages.example.org/harbour-hotel', 'published · checked at phone and desktop width', true),
      ], reply('The page is at **pages.example.org/harbour-hotel**. I have not sent it; the link is ready for your email.')), viewPane('pages.example.org/harbour-hotel', siteMock('Example Studio for Harbour Hotel', ['Prints', 'Framing', 'Book a visit'], 'Six indigo prints for your lobby', 'Hand-printed on heavy linen, framed in oak or black, hung by us in one morning.')), BOB.org),
    },
    {
      s: 'photos', at: '13:10', pick: 1, hand: 'Hands to Alice: the photos go into team/photos/winter, where her newsletter picks up two of them at 14:05.',
      ask: 'Lena’s photos of the winter prints. Make them look like the rest of the shop.',
      did: 'Lena photographed the new prints this morning against the studio wall. Bob’s agent cuts every one out, puts it on the shop’s white with the same margin, and marks the two where a shadow got caught.',
      screen: () => screen('Winter prints photos', you('12:55', 'Lena’s photos of the winter prints. Make them look like the rest of the shop.', att('photos/lena-winter/', '38 photos · 290 MB')) + pi([
        tool('bash', 'rembg p photos/lena-winter/ team/photos/winter/', '38 cut out · 2 caught a shadow'),
        tool('bash', 'magick mogrify -background white -gravity center -extent 1600x1600 …', 'shop sizes · named by product code', true),
      ], reply('**38 ready** in *team/photos/winter*, where Alice and the shop page can use them. Two have a shadow at the edge; they are marked.')), viewPane('team/photos/winter', cutoutMock(38, 2)), BOB.org),
    },
    {
      s: 'courier', at: '14:20', ask: 'The courier only offers invoices one by one behind a login. All of last year, please.',
      did: 'Bob is logged in to the courier’s site on his own laptop. His agent uses that browser to walk through twelve months of pages, saves every invoice and files it by month; his password stays with him.',
      screen: () => screen('Courier invoices', you('13:40', 'The courier only offers invoices one by one behind a login. All of last year, please.') + pi([
        tool('computer', 'Bob’s laptop › browser › courier account', 'signed in as Bob · using his session, no password stored'),
        tool('bash', 'python3 tools/courier_invoices.py --months 2025-11..2026-10', '12 months · 212 invoices saved', true),
      ], reply('**212 invoices** are in *bookkeeping/courier/* by month, with a sheet of the totals: €18,406.20 for the year.')), viewPane('courier-totals.xlsx', barsMock('Courier per month, €', [['Nov', 1340], ['Dec', 2980, 1], ['Jan', 1120], ['Feb', 1010], ['Mar', 1290], ['Apr', 1380], ['May', 1460], ['Jun', 1210], ['Jul', 990], ['Aug', 1150], ['Sep', 1630], ['Oct', 1846]], '', '212 invoices · €18,406.20')), BOB.org),
    },
    {
      s: 'notes', at: '16:10', ask: 'Draft this month’s notes to the wholesale shops.',
      did: 'Bob used to rewrite half of every draft. A few rounds ago his agent compared its drafts with what he actually sent and wrote down the difference: short subject, price in the first line, no pleasantries. Now the drafts need a glance.',
      screen: () => screen('Wholesale notes', you('16:00', 'Draft this month’s notes to the wholesale shops.') + pi([
        tool('read', '~/AGENTS.md › How I write', '- Subject: five words at most\n- Price or date in the first line\n- No “I hope this finds you well”\n- Sign off “Bob”', true),
        tool('write', 'drafts/wholesale-2026-12/*.eml', '12 notes · each with that shop’s last order and the new order page'),
      ], reply('Twelve drafts are in your mailbox, in your style. Each mentions the shop’s last order and the new order page. Nothing is sent.', drafts([['draft', 'orders@cornerbooks.example.org', 'Winter prints, from €9.50', 'Winter prints are in, from €9.50. You can now order at wholesale.example.org…'], ['draft', 'shop@harbourgifts.example.org', 'Restock before 12 Dec?', 'Your aprons sold out in October. Last order date for Christmas is 12 Dec…']]))), '', BOB.org),
    },
  ],
});

// =====================================================================
// Kirsi: bookkeeper at Ledger & Co, the office that does Example Studio's books
// =====================================================================
const KIRSI = mkDay({
  id: 'kirsi', name: 'Kirsi', role: 'Bookkeeper', org: 'Ledger & Co', color: '#7a5c8e',
  blurb: 'Kirsi keeps the books for forty small companies at Ledger & Co, a two-partner accounting office with its own server. Example Studio is one of her clients.',
  places: [['08:00', 'At the office', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'At the office', 'desk'], ['15:30', 'Client meeting', 'meet'], ['16:15', 'At the office', 'desk']],
  sess: [
    { id: 'cafe', title: 'Corner Café, October', segs: [['07:55', 'run', 'Matching 184 payments'], ['08:10', 'turn', '3 questions, 1 page to approve'], ['08:40', 'quiet', 'October closed']] },
    { id: 'rules', title: 'Rule changes', segs: [['09:05', 'run', 'Comparing with October’s copy'], ['09:20', 'turn', '2 deadlines moved'], ['09:30', 'quiet', 'Read']] },
    { id: 'subs', title: 'Our own subscriptions', segs: [['10:10', 'run', 'Grouping 300 lines'], ['10:30', 'turn', '31 vendors · 3 overlap'], ['10:50', 'quiet', 'subscriptions.xlsx']] },
    { id: 'polish', title: 'Polish contracts', segs: [['11:15', 'run', 'Translating 7 contracts'], ['11:40', 'turn', '7 working translations'], ['11:55', 'quiet', 'Read']] },
    { id: 'studio', title: 'Example Studio, October', segs: [['12:46', 'run', 'Checking 26 receipts'], ['12:50', 'turn', '25 in · 1 without receipt'], ['13:05', 'quiet', 'October ready']] },
    { id: 'stamp', title: 'Invoice stamps', segs: [['14:10', 'run', 'Stamping 340 invoices'], ['14:30', 'turn', '340 stamped · 2 not approved'], ['14:40', 'quiet', 'Stamped']] },
  ],
  g: [
    {
      s: 'cafe', at: '08:10', pick: 1, ask: 'October for the Corner Café: here’s the bank export and the owner’s receipt photos.',
      did: 'Her agent matches every payment to a receipt, books them the way this client is always booked, and comes back with three questions it cannot answer from the papers and one page for her to approve.',
      screen: () => screen('Corner Café, October', you('07:55', 'October for the Corner Café: here’s the bank export and the owner’s receipt photos.', att('cafe-2026-10.csv', 'Bank export · 184 payments') + att('cafe-receipts/', '171 photos')) + pi([
        tool('read', 'clients/corner-cafe/AGENTS.md', 'Milk and bread: account 4000 · the owner’s phone bill is split 50/50 · rent on the 1st'),
        tool('bash', 'python3 tools/match.py cafe-2026-10.csv cafe-receipts/', '181 of 184 matched · 3 questions', true),
        tool('write', 'clients/corner-cafe/2026-10/summary.pdf', '1 page · VAT, result, the 3 open items'),
      ], reply('**181 of 184** booked. Three questions for the owner:\n\n1. €86.40 at a garden centre: café or home?\n2. €212 to an electrician: repair or new equipment?\n3. A €39 subscription with no receipt.\n\nThe one-page summary is ready to approve once she answers.', offer('summary.pdf', '1 page'))), '', KIRSI.org),
    },
    {
      s: 'rules', at: '09:20', ask: 'What changed on the tax authority’s upcoming-changes pages since last month?',
      did: 'Last month her agent saved a copy of those pages in her folder. Today it fetches them again, compares, and tells her only what is new.',
      screen: () => screen('Rule changes', you('09:05', 'What changed on the tax authority’s upcoming-changes pages since last month?') + pi([
        tool('bash', 'python3 tools/fetch_pages.py sources/tax-upcoming.txt', '9 pages fetched'),
        tool('bash', 'git diff --stat -- watch/tax-upcoming/', '3 files changed · last copy 21 Oct', true),
      ], reply('Three things are new since 21 October:\n\n- The January VAT deadline moves from the 12th to the 15th.\n- Payroll reports for December are due a week earlier.\n- A consultation on receipt archiving closes on 4 December.\n\nThe pages are saved again, so next month starts from today.')), '', KIRSI.org),
    },
    {
      s: 'subs', at: '10:30', pick: 1, ask: 'What do we pay for software here at the office? I suspect half of it is unused.',
      did: 'Her agent goes through the office’s own expenses for the year, groups 300 lines into vendors, and finds what overlaps and what has been billing since a project ended.',
      screen: () => screen('Our own subscriptions', you('10:10', 'What do we pay for software here at the office? I suspect half of it is unused.', att('ledger-expenses-2026.xlsx', '3,140 lines')) + pi([
        tool('bash', 'duckdb -c "select vendor, sum(eur) from expenses where account in (6810, 6820) group by 1"', '300 lines · 31 vendors · €14,880 a year', true),
      ], reply('**€14,880 a year across 31 vendors.** Three video-call tools do the same job (€1,020 together), and a cloud account has billed **€40 every month** since the payroll project ended in 2024.', offer('subscriptions.xlsx', '31 vendors · what each costs and who uses it'))), viewPane('subscriptions.xlsx', barsMock('Per year, €', [['Accounting suite', 6200], ['Office suite', 2400], ['Video calls ×3', 1020, 1], ['Payroll', 1800], ['Cloud account (unused)', 480, 1], ['Scanning', 690], ['Other 25', 2290]], '', '31 vendors · 2 to cut')), KIRSI.org),
    },
    {
      s: 'polish', at: '11:40', ask: 'A client sent seven employment contracts in Polish. I need to understand them.',
      did: 'The contracts are about real people’s pay, so they stay in the office. Her agent translates them on the office server and marks each as a working translation, for understanding, not for signing.',
      screen: () => screen('Polish contracts', you('11:15', 'A client sent seven employment contracts in Polish. I need to understand them.', att('contracts-pl/', '7 PDFs')) + pi([
        tool('bash', 'argos-translate --from pl --to en contracts-pl/*.txt', 'translated on this server · nothing sent out', true),
        tool('write', 'clients/mill-lane/contracts-en/', '7 files · each headed “Working translation”'),
      ], reply('Seven working translations are in *contracts-en*. Two contracts have a **probation period of six months**, which is longer than the client said. Each file says it is a machine translation for understanding only.')), '', KIRSI.org),
    },
    {
      s: 'studio', at: '12:50', pick: 1, hand: 'From Alice: her agent filed 25 of the 26 October receipts in the folder Kirsi reads, at 12:44.',
      ask: 'Have Example Studio’s October receipts come in?',
      did: 'Alice’s agent filed them at lunch in the folder the two offices share. Kirsi’s agent checks every one against the card statement, and October is ready to book.',
      screen: () => screen('Example Studio, October', you('12:46', 'Have Example Studio’s October receipts come in?') + pi([
        tool('bash', 'rclone ls shared:example-studio/bookkeeping/2026-10', '25 files · added 12:44 by Alice'),
        tool('bash', 'python3 tools/check_receipts.py --statement statement-2026-10.pdf', '25 of 26 match · 1 marked “no receipt”: city parking €12.60', true),
      ], reply('**25 of 26 are in**, each matching the statement. The missing one is city parking, €12.60, which Alice marked as having no receipt. October is ready to book.')), viewPane('2026-10 · Example Studio', sheetMock('bookkeeping/2026-10', ['Date', 'Vendor', 'Amount', ''], [['3 Oct', 'Paper Mill Supply', '€184.20', '✓'], ['6 Oct', 'Northside Packaging', '€230.00', '✓'], ['14 Oct', 'City parking', '€12.60', 'no receipt'], ['28 Oct', 'Fjord Fonts', '€49.00', '✓']], '… 22 more · all match')), KIRSI.org),
    },
    {
      s: 'stamp', at: '14:30', ask: 'Stamp this month’s approved purchase invoices with the approver and the date.',
      did: 'From the approval list, her agent stamps each PDF electronically with who approved it and when, and leaves out the two nobody has approved yet.',
      screen: () => screen('Invoice stamps', you('14:10', 'Stamp this month’s approved purchase invoices with the approver and the date.') + pi([
        tool('read', 'approvals/2026-11.csv', '342 invoices · 340 approved'),
        tool('bash', 'pyhanko sign addsig … --stamp "Approved {approver} {date}"', '340 stamped · originals kept', true),
      ], reply('**340 stamped.** Two are not approved yet, both from the same client; I left them as they were.')), '', KIRSI.org),
    },
  ],
});

// =====================================================================
// Grace: art teacher at Maple Lane School, running a printing workshop with Alice
// =====================================================================
const GRACE = mkDay({
  id: 'grace', name: 'Grace', role: 'Art teacher', org: 'Maple Lane School', color: '#b45a33',
  blurb: 'Grace teaches art at Maple Lane School. In December her Year 8 classes print linen with Example Studio.',
  places: [['07:40', 'Staff room', 'desk'], ['08:15', 'Teaching', 'class'], ['11:45', 'Lunch break', 'lunch'], ['12:30', 'Teaching', 'class'], ['14:45', 'Staff room', 'desk'], ['16:00', 'Cycling home', 'bike'], ['16:20', 'At home', 'home']],
  sess: [
    { id: 'folders', title: 'Year 8 portfolios', segs: [['07:40', 'run', 'Checking 28 portfolios'], ['07:52', 'turn', '28 drafts · 3 borderline'], ['08:10', 'quiet', 'Feedback queued for you']] },
    { id: 'subs', title: 'Safety video subtitles', segs: [['08:30', 'run', 'Transcribing 6 min 40 s'], ['09:10', 'turn', 'Two subtitle files ready'], ['09:20', 'quiet', 'safety-printing.mp4']] },
    { id: 'ink', title: 'Ink mixing page', segs: [['09:45', 'run', 'Building a small page'], ['10:20', 'turn', 'Page ready to try'], ['10:40', 'quiet', 'maple-lane.example.org/ink-mixing']] },
    { id: 'blur', title: 'Workshop photos', segs: [['11:50', 'run', 'Finding faces in 142 photos'], ['12:00', 'turn', '9 photos to check'], ['12:25', 'quiet', 'Ready for the website']] },
    { id: 'signup', title: 'Workshop sign-ups', segs: [['13:10', 'run', 'Merging three lists'], ['13:30', 'turn', '56 pupils · 1 twice'], ['13:40', 'run', 'Writing to Alice'], ['13:42', 'quiet', 'Group sizes sent to Alice']] },
    { id: 'cards', title: 'Revision cards', segs: [['15:00', 'run', 'Reading 22 slides'], ['15:10', 'turn', '40 cards'], ['15:20', 'quiet', 'printmaking.apkg']] },
  ],
  g: [
    {
      s: 'folders', at: '07:52', pick: 1, ask: 'Check this week’s Year 8 portfolios against the brief and draft feedback for each.',
      did: 'Twenty-eight pupils sent their portfolios by email. Before the first lesson, her agent checks each against the brief, drafts a short note for each pupil saying exactly what to fix, notes who passed in the class register, and leaves the three borderline cases for her.',
      screen: () => screen('Year 8 portfolios', you('07:40', 'Check this week’s Year 8 portfolios against the brief and draft feedback for each.') + pi([
        tool('bash', 'gog gmail search "label:year8 has:attachment newer_than:7d"', '28 portfolios · 2 identical files'),
        tool('read', 'courses/year8/brief-pattern.md', '4 criteria: repeat, two colours, sketchbook pages, reflection'),
        tool('write', 'courses/year8/register.csv', '23 passed · 3 borderline · 2 to redo', true),
      ], reply('**Twenty-eight notes are drafted**, each naming what to fix. Two pupils sent the same file; I flagged it rather than guessing. Three are borderline and need your eye. Nothing has gone to the pupils.', drafts([['draft', 'pupil, 8B', 'Your pattern: one thing to fix', 'Your repeat works across, but not down: the third row shifts…'], ['draft', 'pupil, 8A', 'Portfolio: well done', 'All four parts are there. Your reflection on the rust colour…']]))), '', GRACE.org),
    },
    {
      s: 'subs', at: '09:10', ask: 'Subtitles in English and Finnish for the printing safety video, please.',
      did: 'Half the workshop’s families read Finnish first. Her agent transcribes the video on the school’s server, spells the tool names as in the equipment list, translates, and gives her both subtitle files and a copy with the captions burned in.',
      screen: () => screen('Safety video subtitles', you('08:30', 'Subtitles in English and Finnish for the printing safety video, please.', att('safety-printing.mp4', 'Video · 6:40')) + pi([
        tool('bash', 'whisper-cli -m base.en -osrt safety-printing.wav', '74 captions · timed'),
        tool('read', 'workshop/equipment.md', 'brayer, baren, gouge, bench hook'),
        tool('bash', 'ffmpeg -i safety-printing.mp4 -vf subtitles=en.srt …', 'safety-printing-en.mp4 · en.srt · fi.srt', true),
      ], reply('Both subtitle files are ready, and a copy with English captions burned in. The tool names are spelled as in the equipment list.')), viewPane('safety-printing.mp4', captionMock()), GRACE.org),
    },
    {
      s: 'ink', at: '10:20', pick: 1, ask: 'Make a little page where the class can see what two inks make when they overlap.',
      did: 'Between lessons she describes the idea in two sentences. Her agent builds a small page at the school’s address; she tries it once and shares the link with the class herself.',
      screen: () => screen('Ink mixing page', you('09:45', 'Make a little page where the class can see what two inks make when they overlap. Indigo, rust and weld yellow.') + pi([
        tool('write', 'pages/ink-mixing/index.html', 'one page · works on the class tablets'),
        tool('publish', 'maple-lane.example.org/ink-mixing', 'published for the school · no sign-in needed', true),
      ], reply('Try it beside this. The colours come from the inks on Example Studio’s list, so the page matches what the class will print.')), viewPane('maple-lane.example.org/ink-mixing', inkMixMock(), 'Live'), GRACE.org),
    },
    {
      s: 'blur', at: '12:00', ask: 'Last year’s workshop photos for the school website. Six pupils have no permission.',
      did: 'Her agent blurs every face of the pupils without permission, in every photo, and lists the nine photos where it was not sure, so Grace checks nine instead of 142.',
      screen: () => screen('Workshop photos', you('11:50', 'Last year’s workshop photos for the school website. Six pupils have no permission.', att('workshop-2025/', '142 photos')) + pi([
        tool('read', 'office/permissions-2026.csv', '6 pupils without publication permission'),
        tool('bash', 'python3 tools/blur_faces.py workshop-2025/ --strict', '142 photos · faces blurred by default · 9 uncertain', true),
      ], reply('All 142 are ready; every face is blurred unless I was sure it was a pupil with permission. **Nine photos** need your eye.')), viewPane('workshop-2025 · ready', blurMock()), GRACE.org),
    },
    {
      s: 'signup', at: '13:30', pick: 1, hand: 'Hands to Alice: the group sizes, by email at Grace’s word, so Example Studio cuts the right amount of linen.',
      ask: 'Merge the workshop sign-ups, draft the welcome letters, and tell Alice how many are in each group.',
      did: 'Sign-ups came from a web form, two colleagues’ emails and a parent’s spreadsheet. Her agent merges them, notices one pupil signed up twice under two spellings, drafts each family’s letter with their group’s day, and writes to Alice when Grace says so.',
      screen: () => screen('Workshop sign-ups', you('13:10', 'Merge the workshop sign-ups, draft the welcome letters, and tell Alice how many are in each group.') + pi([
        tool('bash', 'python3 tools/merge_signups.py form.csv mail/ parents.xlsx', '57 rows → 56 pupils (one twice: “Aino Berg” / “Aino Bergh”)', true),
        tool('write', 'workshop/letters/*.eml', '56 drafts · each with the group’s day'),
      ], reply('**56 pupils** in four groups of 14. The letters are in your drafts. Shall I send Alice the group sizes?')) + you('13:40', 'Yes, send it.') + pi([], reply('Sent.', drafts([['sent', 'alice@example.org', 'Workshop: 4 groups of 14', 'Hi Alice, 56 pupils in four groups of 14, on 2, 3, 9 and 10 December…']]))), '', GRACE.org),
    },
    {
      s: 'cards', at: '15:10', ask: 'Revision cards from my printmaking slides for next week’s quiz.',
      did: 'Her agent reads her own slides and makes forty cards in her words, with her diagrams on them, as a deck the pupils open on their phones.',
      screen: () => screen('Revision cards', you('15:00', 'Revision cards from my printmaking slides for next week’s quiz.', att('printmaking-history.pptx', '22 slides')) + pi([
        tool('bash', 'python3 -c "pptx → cards" && uv run --with genanki make_deck.py', '40 cards · 9 with your diagrams', true),
      ], reply('**Forty cards**, in your own words, nine with your diagrams.', offer('printmaking.apkg', 'Card deck · 40 cards'))), viewPane('printmaking.apkg', cardsMock()), GRACE.org),
    },
  ],
});

// =====================================================================
// Mira: researcher at Riverside University, natural dyes on linen
// =====================================================================
const MIRA = mkDay({
  id: 'mira', name: 'Mira', role: 'Researcher', org: 'Riverside University', color: '#2f4f73',
  blurb: 'Mira studies natural dyes on linen at Riverside University’s textile lab. Example Studio sent her three indigo samples to test.',
  places: [['08:15', 'At the lab', 'lab'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'At the lab', 'lab'], ['14:00', 'Seminar', 'meet'], ['15:00', 'At the lab', 'lab']],
  sess: [
    { id: 'papers', title: 'Lightfastness papers', segs: [['08:20', 'run', 'Indexing 40 papers'], ['08:40', 'turn', '6 papers, with pages'], ['09:00', 'quiet', 'Read']] },
    { id: 'fade', title: 'Fade test results', segs: [['09:30', 'run', 'Reading 1,080 measurements'], ['10:00', 'turn', 'Chart and statistics'], ['10:30', 'quiet', 'fade-results.pdf']] },
    { id: 'ledgers', title: '1970s dye-house ledgers', segs: [['11:00', 'run', 'Reading 380 scanned pages'], ['11:45', 'turn', '214 recipes as a table'], ['12:45', 'quiet', 'recipes.csv']] },
    { id: 'alice', title: 'Results for Example Studio', segs: [['14:30', 'run', 'Drafting to Alice'], ['14:40', 'turn', 'Draft ready'], ['14:42', 'quiet', 'Sent to Alice']] },
    { id: 'grant', title: 'Grant attachments', segs: [['15:20', 'run', 'Converting 19 files'], ['15:50', 'turn', '19 PDFs, numbered'], ['16:00', 'quiet', 'Ready to upload']] },
    { id: 'anim', title: 'Lecture animation', segs: [['16:05', 'run', 'Rendering 3 scenes'], ['16:40', 'turn', '48-second animation'], ['16:50', 'quiet', 'indigo-binding.mp4']] },
  ],
  g: [
    {
      s: 'papers', at: '08:40', pick: 1, ask: 'Which of these forty papers measured lightfastness of indigo on linen?',
      did: 'Her agent searches every paper, including the scanned ones, by word and by meaning, so it also finds the two that call it “fading under light”. It answers with the page and paragraph.',
      screen: () => screen('Lightfastness papers', you('08:20', 'Which of these forty papers measured lightfastness of indigo on linen?', att('literature/dyes/', '40 PDFs')) + pi([
        tool('bash', 'rga -i "lightfast|light fastness" literature/dyes/', '4 papers by word'),
        tool('bash', 'python3 tools/semantic_search.py "indigo on linen fades in light"', '2 more by meaning · “fading under light”, “photodegradation”', true),
      ], reply('**Six papers**, with the page for each:\n\n| File | Fibre | Page |\n|---|---|---|\n| lightfast-linen-2019.pdf | linen | 7 |\n| indigo-fibres-2021.pdf | linen, cotton | 12 |\n| dye-ageing-2015.pdf | linen | 4 |\n\n… and three more. Two of them never use the word “lightfastness”.')), '', MIRA.org),
    },
    {
      s: 'fade', at: '10:00', pick: 1, ask: 'Analyse the fade test: three dyes, six weeks under the lamp. Is the difference real?',
      did: 'The spectrometer wrote a file per sample per day. Her agent loads all 1,080 measurements, runs the statistics in code, and draws the chart; every number can be rerun from the folder.',
      screen: () => screen('Fade test results', you('09:30', 'Analyse the fade test: three dyes, six weeks under the lamp. Is the difference real?', att('spectro/', '1,080 CSV files')) + pi([
        tool('bash', 'Rscript analysis/fade.R spectro/', 'colour change ΔE after 6 weeks · 3 dyes · 12 samples each', true),
        tool('write', 'analysis/fade-results.pdf', '2 charts · the test and its numbers'),
      ], reply('Yes. **Indigo on mordanted linen faded least** (ΔE 3.1 against 5.8 and 7.4), and the difference holds (p < 0.01). Chart and numbers are beside this; *fade.R* reproduces them.')), viewPane('fade-results.pdf', barsMock('Colour change after 6 weeks (ΔE, lower is better)', [['Indigo, mordanted', 3.1, 1], ['Indigo, plain', 5.8], ['Weld yellow', 7.4]], '', '12 samples each · p < 0.01')), MIRA.org),
    },
    {
      s: 'ledgers', at: '11:45', ask: 'The scanned dye-house ledgers from the 1970s: get the recipes out as a table.',
      did: 'Three hundred and eighty handwritten-and-typed pages. Her agent straightens and reads them, pulls every recipe into one table, and marks the ones it could not read with confidence.',
      screen: () => screen('1970s dye-house ledgers', you('11:00', 'The scanned dye-house ledgers from the 1970s: get the recipes out as a table.', att('ledgers-1971-1979/', '380 scanned pages')) + pi([
        tool('bash', 'ocrmypdf --deskew -l eng ledgers/*.pdf ocr/', '380 pages · text layer added'),
        tool('bash', 'python3 tools/recipes.py ocr/', '214 recipes · 17 low confidence', true),
      ], reply('**214 recipes** are in *recipes.csv*: date, fibre, dye, mordant, quantities. Seventeen were hard to read; each links to its page.')), viewPane('recipes.csv', sheetMock('recipes.csv', ['Year', 'Fibre', 'Dye', 'Mordant'], [['1972', 'linen', 'indigo', 'none'], ['1972', 'linen', 'weld', 'alum'], ['1974', 'wool', 'madder', 'alum'], ['1977', 'linen', 'indigo', 'iron']], '… 210 more · 17 to check')), MIRA.org),
    },
    {
      s: 'alice', at: '14:40', pick: 1, hand: 'Hands to Alice: the fade results for her three samples, by email when Mira says yes.',
      ask: 'Write Alice at Example Studio what we found for her three samples. Plain words.',
      did: 'Her agent writes to Alice in plain words, with the one chart that matters, and waits. It goes when Mira says so.',
      screen: () => screen('Results for Example Studio', you('14:30', 'Write Alice at Example Studio what we found for her three samples. Plain words.') + pi([
        tool('read', 'analysis/fade-results.pdf', 'samples ES-1, ES-2, ES-3'),
      ], reply('Here is a draft. It says the mordanted indigo held best and suggests it for anything sold for windows.', drafts([['draft', 'alice@example.org', 'Your three indigo samples', 'Hi Alice, after six weeks under the lamp, sample 2 (mordanted) changed least…']]))) + you('14:42', 'Send it.') + pi([], reply('Sent, with the chart attached.')), '', MIRA.org),
    },
    {
      s: 'grant', at: '15:50', ask: 'The grant needs nineteen attachments as PDF. Here’s what five people sent me.',
      did: 'Word, Excel and slides from five colleagues become nineteen PDFs, numbered and named exactly as the application form lists them.',
      screen: () => screen('Grant attachments', you('15:20', 'The grant needs nineteen attachments as PDF. Here’s what five people sent me.', att('grant/incoming/', '23 files · docx, xlsx, pptx')) + pi([
        tool('bash', 'soffice --headless --convert-to pdf grant/incoming/*', '23 converted'),
        tool('bash', 'python3 tools/name_as_form.py form-attachments.txt', '19 named as the form lists them · 4 duplicates left out', true),
      ], reply('**Nineteen PDFs**, named “Attachment 01 Budget.pdf” and so on, in the form’s order. Four files were older versions of others; I left them out and listed them.')), '', MIRA.org),
    },
    {
      s: 'anim', at: '16:40', ask: 'A short animation for my lecture: how indigo gets into the fibre.',
      did: 'She describes it in three sentences. Her agent writes the animation as a script, renders it, and adjusts the pace when she asks.',
      screen: () => screen('Lecture animation', you('16:05', 'A short animation for my lecture: how indigo gets into the fibre. Insoluble, then reduced and yellow-green, then blue again in the air.') + pi([
        tool('write', 'lectures/indigo/scene.py', '3 scenes · molecules, fibre, air'),
        tool('bash', 'manim -qh lectures/indigo/scene.py', 'indigo-binding.mp4 · 48 s · 1080p', true),
      ], reply('**48 seconds**, three scenes. Say if any part is too fast.', offer('indigo-binding.mp4', 'Video · 48 s'))), viewPane('indigo-binding.mp4', framesMock()), MIRA.org),
    },
  ],
});

// =====================================================================
// Nora (people, at a clinic) and Theo (an artist): three glimpses each
// =====================================================================
const NORA = mkDay({
  id: 'nora', name: 'Nora', role: 'Office manager, people', org: 'Brightwater Clinic', color: '#31553a',
  blurb: 'Nora runs the office and the people side of Brightwater Clinic, twelve staff.',
  places: [['08:00', 'At the clinic', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:40', 'At the clinic', 'desk']],
  sess: [
    { id: 'new', title: 'New receptionist', segs: [['08:30', 'run', 'Building the checklist'], ['08:45', 'turn', '14 steps · 3 messages drafted'], ['09:10', 'quiet', '6 of 14 done']] },
    { id: 'handover', title: 'Handover from Pia', segs: [['10:30', 'run', 'Transcribing the walk-through'], ['11:10', 'turn', 'Guide and 22 hand-overs'], ['11:30', 'quiet', 'Read']] },
    { id: 'mileage', title: 'November mileage', segs: [['14:00', 'run', 'Reading 3 people’s notes'], ['14:20', 'turn', '3 claims to approve'], ['14:30', 'quiet', 'Approved']] },
  ],
  g: [
    {
      s: 'new', at: '08:45', pick: 1, ask: 'A new receptionist starts on Monday and I only heard yesterday. What has to happen before then?',
      did: 'Her agent builds the list from the clinic’s own onboarding notes and what was forgotten last time, drafts the welcome message and the note to payroll, and ticks off each step as Nora does it.',
      screen: () => screen('New receptionist', you('08:30', 'A new receptionist starts on Monday and I only heard yesterday. What has to happen before then?') + pi([
        tool('read', 'people/onboarding.md', '14 steps · notes from the last two starts'),
        tool('write', 'people/2026-11-23-receptionist.md', 'before Monday: 8 · first week: 6'),
      ], reply('**Eight things before Monday**, six in the first week. The welcome message and the payroll note are in your drafts. Last time the door code was forgotten; it is on the list.')), viewPane('people/2026-11-23-receptionist.md', checklistMock('Before Monday', [[1, 'Account and email', 'Nora'], [1, 'Payroll details form', 'payroll'], [1, 'Welcome message', 'draft'], [0, 'Door code and keys', 'Nora'], [0, 'Booking system login', 'IT partner'], [0, 'Uniform size', 'ask'], [0, 'First-day buddy', 'Ella']])), NORA.org),
    },
    {
      s: 'handover', at: '11:10', pick: 1, ask: 'Pia leaves after six years. Here’s her hour-long walk-through. What does she hold, and who takes it over?',
      did: 'The recording is transcribed on the clinic’s own server. Her agent turns it into a handover guide and one list of everything Pia holds, from the supply order to the door system, each with who takes it.',
      screen: () => screen('Handover from Pia', you('10:30', 'Pia leaves after six years. Here’s her hour-long walk-through. What does she hold, and who takes it over?', att('pia-walkthrough.m4a', 'Recording · 1 h 4 min')) + pi([
        tool('bash', 'whisperx pia-walkthrough.m4a', 'transcribed on this server · 1 h 4 min', true),
        tool('write', 'people/handover-pia.md', 'weekly, monthly, yearly tasks · 22 hand-overs'),
      ], reply('**22 things to hand over**: 9 accounts, 4 subscriptions on her card, the weekly supply order and the door system. Each has a proposed new owner and is on one list you can tick off.')), '', NORA.org),
    },
    {
      s: 'mileage', at: '14:20', pick: 1, ask: 'November mileage for the home-visit physios.',
      did: 'Three physiotherapists told their agents where they drove. Nora’s agent reads their notes from the shared folder, computes each claim at the official rate, and gives her one page per person to approve.',
      screen: () => screen('November mileage', you('14:00', 'November mileage for the home-visit physios.') + pi([
        tool('read', 'shared/home-visits/2026-11/*.md', '3 people · 41 visits · 6 parking receipts'),
        tool('bash', 'python3 tools/mileage.py --rate 0.59', '3 claims · 1,214 km · €716.26 + €38.40 parking', true),
      ], reply('Three claims, **1,214 km in all**, at the official rate. One page each, ready for your approval.')), viewPane('mileage-2026-11.xlsx', sheetMock('mileage-2026-11.xlsx', ['Physio', 'Visits', 'km', '€'], [['Ella', '16', '482', '€296.78'], ['Jon', '14', '401', '€248.99'], ['Sami', '11', '331', '€208.89']], 'incl. parking €38.40')), NORA.org),
    },
  ],
});
const THEO = mkDay({
  id: 'theo', name: 'Theo', role: 'Printmaker', org: 'Theo Lind Prints', color: '#8c6f4e',
  blurb: 'Theo makes linocuts and sells them from his own small shop. His first solo show opens in December.',
  places: [['09:00', 'In his studio', 'studio'], ['13:00', 'At the print shop', 'box'], ['14:00', 'In his studio', 'studio']],
  sess: [
    { id: 'poster', title: 'Exhibition poster', segs: [['09:20', 'run', 'Laying out 3 formats'], ['09:50', 'turn', 'Poster, flyer, square'], ['10:30', 'quiet', 'Sent to the print shop']] },
    { id: 'vector', title: 'Linocut to vector', segs: [['11:00', 'run', 'Tracing the scan'], ['11:15', 'turn', 'Clean vector ready'], ['11:30', 'quiet', 'heron.svg']] },
    { id: 'catalogue', title: 'Print catalogue', segs: [['14:20', 'run', 'Laying out 40 prints'], ['14:50', 'turn', '24-page catalogue'], ['15:00', 'quiet', 'catalogue.pdf']] },
  ],
  g: [
    {
      s: 'poster', at: '09:50', pick: 1, ask: 'Poster, flyer and a square image for the show. Date, title, and the heron print.',
      did: 'From three lines and one print, his agent lays out an A3 poster for the print shop, an A5 flyer and a square image, all from one layout, print-ready.',
      screen: () => screen('Exhibition poster', you('09:20', 'Poster, flyer and a square image for the show: “Cut, Ink, Press”, Riverside Gallery, 4–20 December. Use the heron print.', att('heron-scan.tif', 'Scan · 600 dpi')) + pi([
        tool('write', 'show/poster.typ', 'one layout · three formats'),
        tool('bash', 'typst compile show/poster.typ --format pdf', 'poster-A3.pdf (CMYK, 3 mm bleed) · flyer-A5.pdf · square.png', true),
      ], reply('Three files, one layout. The A3 has the bleed the print shop asked for.', offer('poster-A3.pdf', 'PDF · print-ready'))), viewPane('poster-A3.pdf', posterMock()), THEO.org),
    },
    {
      s: 'vector', at: '11:15', pick: 1, ask: 'Turn the scan of my new linocut into a clean vector for the screen printer.',
      did: 'The scan has paper grain and ink spatter. His agent traces it into clean shapes, keeps the cut marks that are part of the print, and delivers what the screen printer asks for.',
      screen: () => screen('Linocut to vector', you('11:00', 'Turn the scan of my new linocut into a clean vector for the screen printer.', att('heron-scan.tif', 'Scan · 600 dpi')) + pi([
        tool('bash', 'vtracer --input heron-scan.tif --colormode binary --filter_speckle 6', '1 colour · 212 paths · grain removed'),
      ], reply('Clean vector, one colour. I kept the gouge marks in the water; the paper grain is gone.', offer('heron.svg', 'Vector · 180 KB'))), viewPane('heron.svg', vectorMock()), THEO.org),
    },
    {
      s: 'catalogue', at: '14:50', pick: 1, ask: 'A catalogue of all forty prints for the show, with prices and a code to buy each.',
      did: 'His agent lays out forty prints from his shop’s product list, with sizes, editions, prices and a QR code per print that opens its page in his shop.',
      screen: () => screen('Print catalogue', you('14:20', 'A catalogue of all forty prints for the show, with prices and a code to buy each.') + pi([
        tool('read', 'shop/products.csv', '40 prints · size, edition, price'),
        tool('bash', 'typst compile show/catalogue.typ', '24 pages · 40 QR codes, each checked by scanning', true),
      ], reply('**24 pages**, a QR code under every print. I scanned each code from the PDF to check it opens the right page.', offer('catalogue.pdf', 'PDF · 24 pages'))), '', THEO.org),
    },
  ],
});
const ROLES = [BOB, KIRSI, GRACE, MIRA, NORA, THEO];
const FULL_DAYS = [ALICE, BOB, KIRSI, GRACE, MIRA];
