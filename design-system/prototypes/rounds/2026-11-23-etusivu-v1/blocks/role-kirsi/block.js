// Kirsi: Finance. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view } from '../../engine/kit.mjs';
import { sw, sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const slideMock = () => { const pts = [61, 58, 63, 55, 51, 47, 44, 40, 36, 31, 27, 22]; const x = (k) => 24 + k * 24; const y = (v) => 150 - v * 1.8; return `<div class="sld"><p class="sld-k">Example Studio · cash · 19 Nov</p><b class="sld-h">Cash lasts 11 months at today’s pace</b>${sw(`<path d="M24 ${y(10)} H300" stroke="#b45a33" stroke-dasharray="5 4" stroke-width="1.5"/><text x="246" y="${y(10) - 5}" font-size="10" font-family="system-ui" fill="#8a3f20">safety floor</text><path d="M${pts.map((v, k) => `${x(k)} ${y(v)}`).join(' L')}" fill="none" stroke="#2c6e3f" stroke-width="2.5"/><path d="M${x(4)} ${y(51)} L${x(5)} ${y(29)} L${x(11)} ${y(4)}" fill="none" stroke="#6b746c" stroke-width="2" stroke-dasharray="4 3"/><path d="M${x(1) + 2} ${y(20) - 3} h14" stroke="#6b746c" stroke-width="2" stroke-dasharray="4 3"/><text x="${x(1) + 20}" y="${y(20)}" font-size="10" font-family="system-ui" fill="#4b5563">with the second press</text><g font-family="system-ui" font-size="9.5" fill="#6b746c">${['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'].map((m, k) => `<text x="${x(k) - 8}" y="164">${m}</text>`).join('')}</g>`, '', '0 0 320 170')}<p class="sld-n">€61,200 today · the second press in March brings it to 8 months</p></div>`; };
const forecastMock = () => { const hist = [38, 41, 47, 62, 55, 44]; const fc = [42, 49, 70, 58]; const x = (k) => 20 + k * 28; const y = (v) => 180 - v * 2.2; return `<div class="fc">${sw(`<g stroke="#e3e7e0">${[40, 60, 80].map((v) => `<path d="M20 ${y(v)} H300"/>`).join('')}</g><path d="M${hist.map((v, k) => `${x(k)} ${y(v)}`).join(' L')}" fill="none" stroke="#6b746c" stroke-width="2"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v * 1.12)}`).join(' ')} L${x(9)} ${y(fc[3] * 0.88)} ${fc.slice().reverse().map((v, k) => `L${x(9 - k)} ${y(v * 0.88)}`).join(' ')} Z" fill="rgba(44,110,63,.16)"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v)}`).join(' ')}" fill="none" stroke="#2c6e3f" stroke-width="2.5" stroke-dasharray="5 3"/><g font-family="system-ui" font-size="10" fill="#5a6b5d">${['Oct', '', 'Nov', '', 'W1', 'W2', 'W3', 'W4', 'Jan', ''].map((l, k) => `<text x="${x(k) - 8}" y="196">${l}</text>`).join('')}</g><text x="${x(8) - 30}" y="${y(70 * 1.12) - 6}" font-size="11" font-family="system-ui" fill="#1f5430" font-weight="600">Week 2</text>`, '', '0 0 320 200')}<p class="fc-n"><span>5 years of till data</span><span>order between 1,150 and 1,420 units</span></p></div>`; };

export default {
  id: 'role-kirsi',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
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
      screen: () => screen('Supplier price lists', you('07:55', 'Our three main suppliers sent their 2027 price lists as PDFs. Put them in one table against this year’s.', att('suppliers-2027/', '3 PDFs · 140 pages')) + turn({ tools: [
        tool('bash', 'uv run --with camelot-py python3 tools/extract_tables.py suppliers-2027/*.pdf', '2,612 rows from 131 tables'),
        tool('bash', 'python3 tools/compare_prices.py --bought books/purchases-2026.csv', '318 items we buy · 61 up more than 5 % · 4 discontinued'),
      ], time: '15 min 19 s', reply: '**61 of the 318 items we buy** go up more than 5 %; the biggest is natural indigo (+18 %). Four items are gone from the lists. The budget picks the new prices up from *price-lists-2027.xlsx*.', extra: offer('price-lists-2027.xlsx', '318 rows · old, new, change') }), view('price-lists-2027.xlsx', sheetMock('price-lists-2027.xlsx', ['Item', '2026', '2027', 'Change'], [['Natural indigo, 1 kg', '€84.00', '€99.10', '+18 %'], ['Linen 240 g, 50 m', '€410.00', '€451.00', '+10 %'], ['Gift box, large', '€2.10', '€2.30', '+10 %'], ['Alum, 5 kg', '€22.40', '€23.90', '+7 %']], '… 57 more up · 4 discontinued')), 'Example Studio'),
    },
    {
      s: 'forecast', at: '10:20', ask: 'How much Christmas stock should we order this year?',
      did: 'Her agent reads five years of the shop’s sales week by week, fits a forecast for December, and gives her a range to order between rather than one number to trust.',
      screen: () => screen('Christmas stock', you('10:05', 'How much Christmas stock should we order this year?') + turn({ tools: [
        tool('bash', 'duckdb -c "select week, units from sales where year >= 2021"', '5 years · 260 weeks'),
        tool('bash', 'uv run --with prophet python3 tools/forecast.py', 'December by week · 80 % interval'),
      ], time: '15 min 56 s', reply: 'Order **between 1,150 and 1,420 units**. The second week of December has grown every year; that is where most of the range sits.' }), view('forecast.png', forecastMock()), 'Example Studio'),
    },
    {
      s: 'books', at: '12:50', pick: 1, hand: 'From Alice: her agent filed 25 of her 26 October receipts in bookkeeping/2026-10 at 12:44, where Kirsi’s agent reads them.',
      ask: 'October’s books: here is the bank statement. The receipts are in the folder, and the market cash slips are in the photo pile.',
      did: 'Alice’s receipts came in at lunch, Bob’s and Carol’s during the week, and the market cash slips are phone photos. Kirsi’s agent matches every payment on the statement to a receipt, books them the way the studio always books them, and asks only what the papers cannot answer.',
      screen: () => screen('October books', you('12:42', 'October’s books: here is the bank statement. The receipts are in the folder, and the market cash slips are in the photo pile.', att('statement-2026-10.csv', 'Bank · 184 payments') + att('market-slips/', '38 photos')) + turn({ tools: [
        tool('read', 'bookkeeping/AGENTS.md', 'Linen and dyes: 4000 · market fees: 6990 · Alice’s phone: split 50/50'),
        tool('bash', 'ls bookkeeping/2026-10/', '61 files · 25 added 12:44 by Alice’s agent'),
        tool('bash', 'python3 tools/match.py statement-2026-10.csv bookkeeping/2026-10/ market-slips/', '181 of 184 matched · 3 questions'),
        tool('write', 'books/2026-10.journal', '184 entries · VAT split'),
      ], time: '8 min 41 s', reply: '**181 of 184** booked. Three questions:\n\n1. €86.40 at a garden centre: studio or home?\n2. €212 to an electrician: repair or new equipment?\n3. City parking, €12.60, which Alice marked *no receipt*: book it without?' }), view('books/2026-10', sheetMock('October 2026 · by account', ['Account', 'Entries', '€'], [['4000 Linen and dyes', '41', '12,806.20'], ['4100 Packaging', '18', '2,140.00'], ['6990 Market fees', '9', '720.00'], ['3000 Sales', '68', '−38,412.60']], '181 of 184 booked · 3 open')), 'Example Studio'),
    },
    {
      s: 'vat', at: '13:40', pick: 1, ask: 'October’s VAT return: show it to me before anything goes.',
      did: 'With October booked, her agent works out the return from the books, shows every line with where it came from, and waits. It goes to the tax authority only on her yes, and the receipt is saved with the month.',
      screen: () => screen('October VAT', you('13:30', 'October’s VAT return: show it to me before anything goes.') + turn({ tools: [
        tool('bash', 'hledger -f books/2026-10.journal balance tag:vat', 'output VAT €9,792.10 · input VAT €3,580.10'),
        tool('write', 'vat/2026-10-preview.pdf', 'every line with its entries'),
      ], time: '10 min 26 s', reply: 'To pay **€6,212.00**, due 12 December. Each line opens to the entries behind it. File it?' }) + you('13:44', 'Yes, file it.') + turn({ tools: [
        tool('bash', 'python3 tools/vat_file.py --period 2026-10 --submit', 'accepted · receipt saved to vat/2026-10/'),
      ], time: '11 s', reply: 'Filed. The receipt is with October’s books.' }), view('vat/2026-10-preview.pdf', sheetMock('VAT return · October 2026', ['Line', '€'], [['Sales VAT, 25.5 %', '9,792.10'], ['VAT on purchases', '−3,580.10'], ['To pay', '6,212.00']], 'Due 12 Dec · filed 13:45 on Kirsi’s yes')), 'Example Studio'),
    },
    {
      s: 'budget', at: '14:20', pick: 1, ask: 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.',
      did: 'Her agent puts October’s actual figures into the budget, runs the cash forward month by month with the bills already known and the new supplier prices, and makes one slide for her meeting with Alice: how many months, and what changes it.',
      screen: () => screen('Budget and cash', you('14:00', 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.') + turn({ tools: [
        tool('bash', 'python3 tools/budget.py --actuals books/2026-10.journal --prices price-lists-2027.xlsx', 'budget 2026–27 updated · cash run forward 12 months'),
        tool('write', 'slides/cash-2026-11.pdf', '1 slide · 2 lines'),
      ], time: '20 min 48 s', reply: 'At today’s pace the cash lasts **11 months**. The second press in March would bring it to 8, unless the loan comes through. The slide is beside this.', extra: offer('cash-2026-11.pdf', 'PDF · 1 slide') }), view('cash-2026-11.pdf', slideMock()), 'Example Studio'),
    },
  ],
},
};
