// Kirsi: Finance. October's books, the VAT return on her yes, the cash slide.
// The numbers come from assets.mjs: the same seeded October ledger that
// Beancount checks and queries there, and the slide matplotlib draws from it.
// OUT holds what the programs print; assets.mjs fails if it drifts.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view, image, esc, FILE_IC, assets } from '../../engine/kit.mjs';
import { sw, sheetMock } from '../../engine/views.mjs';
import { facts } from './assets.mjs';

const asset = assets(import.meta.url);
const F = facts();
const eur = (cents) => F.eur(cents);

// What bean-query and runway.py print (verified by assets.mjs).
export const OUT = {
  booksQuery: "SELECT root(account, 2) AS account, sum(position) AS total WHERE account ~ '^(Income|Expenses|Assets:Suspense)' GROUP BY 1 ORDER BY 1",
  books: `account             total
--------------------  -------------
Assets:Suspense          311.00 EUR
Expenses:Bank            449.03 EUR
Expenses:Courses         553.50 EUR
Expenses:Market-Fees     582.82 EUR
Expenses:Materials     12618.46 EUR
Expenses:Office          507.78 EUR
Expenses:Premises       3758.88 EUR
Expenses:Shipping       1028.84 EUR
Expenses:Staff         26032.27 EUR
Expenses:Studio         1225.02 EUR
Expenses:Travel           63.24 EUR
Income:Sales          -45682.92 EUR`,
  vatQuery: "SELECT account, sum(position) AS total WHERE account ~ 'VAT:(Input|Output)' AND month = 10 GROUP BY account ORDER BY account",
  vat: `account                    total
----------------------------------  -------------
Assets:VAT:Input                      5192.78 EUR
Liabilities:VAT:Output              -10642.41 EUR
Liabilities:VAT:Output-EU-Goods       -978.18 EUR
Liabilities:VAT:Output-EU-Services     -53.04 EUR`,
  runway: `cash 31 Oct  52,548.58   floor 15,000
month          base  with press
2026-11      52,399      52,399
2026-12      82,531      82,531
2027-01      64,117      64,117
2027-02      44,806      44,806
2027-03      40,150      23,333
2027-04      37,167      20,350
2027-05      36,790      23,390
2027-06      25,204      11,804
2027-07      17,095       3,695
2027-08      12,271      -1,129
2027-09      11,291      -2,109
2027-10       9,633      -3,767
above €15,000 until 2027-07 · with the press until 2027-05`,
};
// bean-query pads its header; the trimmed form above is what assets.mjs compares.
const pad = (s) => s.replace(/^account/, '      account');

// ---------- Views ----------
const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const sumOf = (rows) => rows.reduce((a, [, v]) => a + v, 0);

// October as the books stand at 12:50: a small income statement, the bank
// check and the three payments still waiting on Suspense.
function booksView() {
  const sales = sumOf(F.sales), costs = sumOf(F.costs), max = Math.max(...F.sales.map(([, v]) => v), ...F.costs.map(([, v]) => v));
  const row = (cls) => ([k, v]) => `<li class="kb-r ${cls}"><span class="kb-k">${esc(k)}</span><span class="kb-bar"><i style="width:${(100 * v / max).toFixed(1)}%"></i></span><span class="kb-v">${eur(v)}</span></li>`;
  return `<div class="kb">
<p class="kb-top"><span>Example Studio · October 2026</span><span class="kb-draft">Draft</span></p>
<div class="kb-sec"><p class="kb-h"><b>Sales</b><span>${eur(sales)}</span></p><ul>${F.sales.map(row('kb-in')).join('')}</ul></div>
<div class="kb-sec"><p class="kb-h"><b>Costs</b><span>${eur(costs)}</span></p><ul>${F.costs.map(row('kb-out')).join('')}</ul></div>
<p class="kb-res"><b>Result for October</b><span>${sales - costs < 0 ? '−' : ''}€${eur(Math.abs(sales - costs))}</span></p>
<ul class="kb-checks">
<li class="ok">${CHECK}<span>Bank on 31 Oct <b>€${F.bank}</b>, to the cent of the statement</span></li>
<li class="wait"><span class="kb-n">3</span><span>On Suspense <b>€${F.suspense}</b>, waiting for Kirsi</span></li>
</ul>
<p class="kb-src">books/2026-10.beancount · ${F.bankLines} bank lines · bean-check passed</p>
</div>`;
}

// The return as a clean form. Each tax line opens to the entries behind it
// (engine toggle: data-view / data-set).
function vatView() {
  const lines = F.vat.map((l, k) => `<li class="vf-l vf-l${k + 1}"><button type="button" data-set="l${k + 1}" aria-pressed="false"><span class="vf-t">${esc(l.label)}</span><span class="vf-v">${l.cents < 0 ? '−' : ''}${eur(Math.abs(l.cents))}</span></button>
<div class="vf-e"><p>${l.n} ${l.n === 1 ? 'entry' : 'entries'}${l.base ? ` · sales €${l.base} before VAT` : ''}</p><ul>${l.top.map(([d, p, v]) => `<li><span>${esc(d)}</span><span>${esc(p)}</span><span>${esc(v)}</span></li>`).join('')}</ul>${l.n > 3 ? `<p class="vf-more">… ${l.n - 3} more in books/2026-10</p>` : ''}</div></li>`);
  const zero = (t) => `<li class="vf-l vf-z"><span class="vf-t">${esc(t)}</span><span class="vf-v">0.00</span></li>`;
  const info = (t, v) => `<li><span>${esc(t)}</span><span>${esc(v)}</span></li>`;
  return `<div class="vf" data-view data-state="none">
<header class="vf-head"><div><p class="vf-k">Periodic tax return · VAT</p><b>October 2026</b><p class="vf-who">Example Studio · monthly · due 12 Dec 2026</p></div><span class="vf-stamp">${CHECK}Filed 13:45</span></header>
<ul class="vf-lines">${lines.slice(0, 1).join('')}${zero('Tax on domestic sales, 14 %')}${zero('Tax on domestic sales, 10 %')}${lines.slice(1).join('')}</ul>
<p class="vf-pay"><b>Tax to pay</b><span>€${F.pay}</span></p>
<ul class="vf-info">${info('Sales of goods to other EU countries', F.euSales)}${info('Goods bought from other EU countries', F.euGoods)}${info('Services bought from other EU countries', F.euServices)}</ul>
<p class="vf-foot">Sent on Kirsi’s yes · receipt in vat/2026-10/</p>
</div>`;
}

const slideView = () => `<figure class="ks">${image(asset('cash-2026-11.webp'), 'Slide: Cash stays above our floor until July. Month-end bank balance from €52,549 on 31 October, up to €83k at Christmas, down to the €15,000 floor in July at today’s pace and in May with the second press in March.', 1200, 675)}</figure>`;

// ---------- The two glimpses only the sidebar opens (round 6, unchanged) ----------
const forecastMock = () => { const hist = [38, 41, 47, 62, 55, 44]; const fc = [42, 49, 70, 58]; const x = (k) => 20 + k * 28; const y = (v) => 180 - v * 2.2; return `<div class="fc">${sw(`<g stroke="#e3e7e0">${[40, 60, 80].map((v) => `<path d="M20 ${y(v)} H300"/>`).join('')}</g><path d="M${hist.map((v, k) => `${x(k)} ${y(v)}`).join(' L')}" fill="none" stroke="#6b746c" stroke-width="2"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v * 1.12)}`).join(' ')} L${x(9)} ${y(fc[3] * 0.88)} ${fc.slice().reverse().map((v, k) => `L${x(9 - k)} ${y(v * 0.88)}`).join(' ')} Z" fill="rgba(44,110,63,.16)"/><path d="M${x(5)} ${y(44)} ${fc.map((v, k) => `L${x(6 + k)} ${y(v)}`).join(' ')}" fill="none" stroke="#2c6e3f" stroke-width="2.5" stroke-dasharray="5 3"/><g font-family="system-ui" font-size="10" fill="#5a6b5d">${['Oct', '', 'Nov', '', 'W1', 'W2', 'W3', 'W4', 'Jan', ''].map((l, k) => `<text x="${x(k) - 8}" y="196">${l}</text>`).join('')}</g><text x="${x(8) - 30}" y="${y(70 * 1.12) - 6}" font-size="11" font-family="system-ui" fill="#1f5430" font-weight="600">Week 2</text>`, '', '0 0 320 200')}<p class="fc-n"><span>5 years of till data</span><span>order between 1,150 and 1,420 units</span></p></div>`; };

const [q1, q2, q3] = F.questions;

export default {
  id: 'role-kirsi',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'kirsi', name: 'Kirsi', role: 'Finance', org: 'Example Studio', color: '#7a5c8e',
  blurb: 'Kirsi keeps Example Studio’s books in-house, three days a week: the month’s close, VAT, payroll and the budget. Her rules for booking live in a file her agent reads.',
  places: [['08:00', 'At her desk', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:40', 'At her desk', 'desk'], ['14:30', 'With Alice', 'meet'], ['15:15', 'At her desk', 'desk']],
  sess: [
    { id: 'prices', title: 'Supplier price lists', segs: [['07:55', 'run', 'Reading 3 PDF price lists'], ['08:10', 'turn', '2,600 rows · 61 up'], ['08:30', 'quiet', 'price-lists-2027.xlsx']] },
    { id: 'forecast', title: 'Christmas stock', segs: [['10:05', 'run', 'Reading five years of sales'], ['10:20', 'turn', 'Order 1,150–1,420'], ['10:40', 'quiet', 'Read']] },
    { id: 'books', title: 'October books', segs: [['12:42', 'run', `Matching ${F.bankLines} bank lines`], ['12:50', 'turn', `${F.bankLines - 3} booked · 3 questions`], ['13:20', 'quiet', 'October closed']] },
    { id: 'vat', title: 'October VAT', segs: [['13:30', 'run', 'Preparing the return'], ['13:40', 'turn', `€${F.pay} to pay · file it?`], ['13:44', 'run', 'Filing'], ['13:45', 'quiet', 'Filed · receipt saved']] },
    { id: 'budget', title: 'Budget and cash', segs: [['14:00', 'run', 'Running cash forward'], ['14:20', 'turn', 'Above the floor until July'], ['14:28', 'quiet', 'Slide for 14:30']] },
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
      did: `Alice’s receipts came in at lunch, Bob’s and Carol’s during the week; the market cash slips are phone photos. Kirsi’s agent matches all ${F.bankLines} bank lines, books them the way the studio always does, and proves the books land on the bank’s closing balance to the cent. It asks only what the papers cannot answer.`,
      screen: () => screen('October books', you('12:42', 'October’s books: here is the bank statement. The receipts are in the folder, and the market cash slips are in the photo pile.', att('statement-2026-10.csv', `Bank · ${F.bankLines} lines`) + att('market-slips/', '38 photos')) + turn({ tools: [
        tool('read', 'bookkeeping/AGENTS.md', 'Linen and dyes → Expenses:Materials:Linen-Dyes\nMarket pitch fees → Expenses:Market-Fees\nAlice’s phone: 50 % studio, 50 % private\nEU suppliers: reverse charge, tag #eu-goods or #eu-services\nNo receipt and no answer: Assets:Suspense, ask Kirsi'),
        tool('bash', 'ls bookkeeping/2026-10/ | wc -l', '143\n(25 added 12:44 by Alice’s agent)'),
        tool('bash', 'python3 tools/match.py statement-2026-10.csv bookkeeping/2026-10/ market-slips/', `${F.bankLines} bank lines\n  145 matched to a receipt or invoice\n   36 matched to a sales report or payslip\n    3 no match: on Assets:Suspense`),
        tool('write', 'books/2026-10.beancount', `${F.bankLines} transactions · VAT split · balance assertion ${F.bank} EUR`, `new · ${F.journalLines.toLocaleString('en-GB')} lines`),
        tool('bash', 'bean-check books/main.beancount && echo balanced', 'balanced'),
        tool('bash', `bean-query books/main.beancount "${OUT.booksQuery}"`, pad(OUT.books)),
      ], time: '8 min 41 s', reply: `**${F.bankLines - 3} of ${F.bankLines}** booked, and the books end on the statement’s **€${F.bank}**. Three questions:\n\n1. €${q1.eur} at ${q1.payee}: studio or home?\n2. €${q2.eur} to ${q2.payee}: a repair or new equipment?\n3. ${q3.payee}, €${q3.eur}, which Alice marked *no receipt*: book it without?` }), view('books/2026-10.beancount', booksView()), 'Example Studio'),
    },
    {
      s: 'vat', at: '13:40', pick: 1, ask: 'October’s VAT return: show it to me before anything goes.',
      did: 'With October closed, her agent works the return out of the books, every line with the entries behind it, and waits. Nothing goes to the tax authority until she says yes; the receipt is filed with the month.',
      screen: () => screen('October VAT', you('13:30', 'October’s VAT return: show it to me before anything goes.') + turn({ tools: [
        tool('bash', `bean-query books/main.beancount "${OUT.vatQuery}"`, pad(OUT.vat).replace(/^      account/, '             account')),
        tool('write', 'vat/2026-10-return.html', `${F.vat.length + 2} tax lines · each with its entries · to pay ${F.pay}`, 'new'),
      ], time: '10 min 26 s', reply: `To pay **€${F.pay}**, due 12 December. Each line opens to its entries. File it?` }) + you('13:44', 'Yes, file it.') + turn({ tools: [
        tool('bash', 'python3 tools/vat_file.py --period 2026-10 --submit', `period 2026-10 · tax to pay ${F.pay} EUR\naccepted 13:45:08\nreceipt saved: vat/2026-10/receipt.pdf`),
      ], time: '11 s', reply: 'Filed at 13:45. The receipt is with October’s books.' }), view('vat/2026-10-return.html', vatView()), 'Example Studio'),
    },
    {
      s: 'budget', at: '14:20', pick: 1, ask: 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.',
      did: 'Her agent puts October’s actuals into the budget and runs the bank balance forward month by month: Christmas, the new supplier prices, VAT and payroll on their due dates. Then one slide for her meeting with Alice: how long, and what changes it.',
      screen: () => screen('Budget and cash', you('14:00', 'Update the budget with October, and tell me how long the cash lasts. One slide for Alice at 14:30.') + turn({ tools: [
        tool('bash', 'python3 tools/runway.py --actuals books/main.beancount --prices price-lists-2027.xlsx', OUT.runway),
        tool('bash', 'python3 tools/slide.py runway.json slides/cash-2026-11.pdf', 'matplotlib 3.11.2 · 1 slide · 16:9'),
      ], time: '20 min 48 s', reply: 'At today’s pace the cash stays above our €15,000 floor **until July**, nine months. The second press in March would bring that to May. The slide is beside this.', extra: offer('cash-2026-11.pdf', 'PDF · 1 slide') }), view('cash-2026-11.pdf', slideView()), 'Example Studio'),
    },
  ],
},
};
