// node blocks/role-kirsi/assets.mjs: Kirsi's October, made with the programs she uses.
//
// 1. A seeded generator writes Example Studio's October books in Beancount:
//    184 bank-statement lines (shop terminal, web shop, market cash, wholesale,
//    payroll, VAT and suppliers, two EU purchases on reverse charge), first
//    with the three unanswered payments on Assets:Suspense (12:50), then
//    closed with Kirsi's answers (13:20). A balance directive holds the books
//    to the statement's closing balance.
// 2. bean-check and bean-query (Beancount 3.2.3, beanquery 0.2.0, from PyPI
//    into a venv in $TMPDIR) check both ledgers and print the outputs the
//    screens quote. The script fails if they drift from OUT in block.js.
// 3. runway.py reads the closed ledger with Beancount's loader and runs the
//    bank balance forward twelve months; slide.py draws the management slide
//    with matplotlib 3.11.2 in the design system's Instrument Sans (OFL),
//    instanced from design-system/fonts with fontTools.
// 4. ImageMagick writes $ETUSIVU_ASSETS/role-kirsi/cash-2026-11.webp.
//
// block.js imports ledger() and facts() from here, so the numbers on the
// page are computed from the same books. Set TMPDIR to your scratch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------- The books ----------
export function ledger() {
  let s = 20261031;
  const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const c = (x) => Math.round(x * 100); // cents
  const f = (cents) => (cents / 100).toFixed(2);
  const between = (a, b) => c(a + rnd() * (b - a));
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const R = 0.255;
  const tx = []; // { d, payee, narr, legs: [[account, cents]], tags, meta }
  const day = (n) => `2026-10-${String(n).padStart(2, '0')}`;
  const dow = (n) => new Date(Date.UTC(2026, 9, n)).getUTCDay(); // 0 Sun
  const add = (n, payee, narr, legs, extra = {}) => tx.push({ d: day(n), payee, narr, legs, ...extra });
  // Gross purchase with domestic VAT: net to expense, VAT to input.
  const buy = (n, payee, narr, acct, grossC, extra) => { const net = Math.round(grossC / (1 + R)); add(n, payee, narr, [[acct, net], ['Assets:VAT:Input', grossC - net], ['Assets:Bank:Checking', -grossC]], extra); };
  const buyNoVat = (n, payee, narr, acct, cents, extra) => add(n, payee, narr, [[acct, cents], ['Assets:Bank:Checking', -cents]], extra);
  // EU reverse charge: VAT on both sides.
  const buyEU = (n, payee, narr, acct, netC, kind) => { const v = Math.round(netC * R); add(n, payee, narr, [[acct, netC], ['Assets:Bank:Checking', -netC], ['Assets:VAT:Input', v], [`Liabilities:VAT:Output-EU-${kind}`, -v]], { tags: [kind === 'Goods' ? 'eu-goods' : 'eu-services'] }); };
  const sell = (n, payee, narr, acct, grossC, feeAcct, feeC) => { const net = Math.round(grossC / (1 + R)); const legs = [['Assets:Bank:Checking', grossC - (feeC || 0)], [acct, -net], ['Liabilities:VAT:Output', -(grossC - net)]]; if (feeC) legs.splice(1, 0, [feeAcct, feeC]); add(n, payee, narr, legs); };

  // ---- Sales ----
  for (let n = 1; n <= 31; n++) if ([2, 3, 4, 5, 6].includes(dow(n))) { const g = between(405, 890) + (dow(n) === 6 ? c(330) : 0); sell(Math.min(n + 1, 31), 'Card terminal', `Shop takings ${n} Oct`, 'Income:Sales:Shop', g, 'Expenses:Bank:Card-Fees', Math.round(g * 0.0125)); }
  for (const n of [5, 12, 19, 26]) { const g = between(2500, 3650); sell(n, 'Web shop payouts', 'Web shop orders, previous week', 'Income:Sales:Web', g, 'Expenses:Bank:Card-Fees', Math.round(g * 0.019)); }
  const markets = [[3, 'Harbour Saturday Market'], [4, 'Harbour Saturday Market'], [10, 'Old Town Craft Fair'], [11, 'Old Town Craft Fair'], [17, 'Harbour Saturday Market'], [18, 'Linden Park Makers'], [24, 'Harbour Saturday Market'], [25, 'Linden Park Makers'], [31, 'Harbour Saturday Market']];
  markets.forEach(([n, m]) => { sell(Math.min(n + (dow(n) === 6 ? 2 : 1), 31), 'Cash deposit', `Market cash, ${m} ${n} Oct`, 'Income:Sales:Markets', between(860, 1530)); buy(n - 3 > 0 ? n - 3 : 1, m, 'Pitch fee', 'Expenses:Market-Fees', between(60, 110)); });
  const shops = ['Northside Interiors', 'Lantern & Loom', 'The Weaving Room', 'Harbour Gift Co.', 'Birchwood Living', 'Tidewater Home', 'Moss & Stone'];
  [2, 6, 9, 14, 20, 23, 28].forEach((n, k) => sell(n, shops[k], `Invoice 2026-${180 + k}`, 'Income:Sales:Wholesale', c(Math.round(990 + rnd() * 880) * 1.255)));
  add(15, 'Kvarn Hem AB', 'Invoice 2026-187 (intra-EU, 0 %)', [['Assets:Bank:Checking', between(1700, 2200)], ['Income:Sales:Wholesale-EU', 0]]);
  add(27, 'Atelier Rive', 'Invoice 2026-188 (intra-EU, 0 %)', [['Assets:Bank:Checking', between(1500, 2100)], ['Income:Sales:Wholesale-EU', 0]]);
  for (const t of tx) if (t.legs[1][0] === 'Income:Sales:Wholesale-EU') t.legs[1][1] = -t.legs[0][1];

  // ---- Staff and settlements ----
  const staff = [['Alice', 3900], ['Bob', 3350], ['Kirsi', 2280], ['Carol', 3400], ['Dave', 2950], ['Erin', 2700], ['Frank', 3250]];
  const gross = staff.reduce((a, [, g]) => a + c(g), 0);
  staff.forEach(([who, g]) => { const G = c(g); const wh = Math.round(G * 0.205); const pe = Math.round(G * 0.0815); add(30, who, 'Salary October', [['Expenses:Staff:Salaries', G], ['Liabilities:Payroll:Withholding', -wh], ['Liabilities:Payroll:Pension', -pe], ['Assets:Bank:Checking', -(G - wh - pe)]]); });
  const emp = Math.round(gross * 0.1738); const hi = Math.round(gross * 0.0187);
  add(31, 'Payroll', 'Employer contributions, October', [['Expenses:Staff:Pension', emp], ['Expenses:Staff:Social', hi], ['Liabilities:Payroll:Pension', -emp], ['Liabilities:Payroll:Withholding', -hi]]);
  const open = { wh: 0, pe: 0, vatAug: c(4688.40), vatSep: c(5412.80) };
  const sept = { wh: Math.round(gross * 0.205) + hi, pe: Math.round(gross * 0.0815) + emp };
  add(12, 'Tax authority', 'Withholding and health insurance, September', [['Liabilities:Payroll:Withholding', sept.wh], ['Assets:Bank:Checking', -sept.wh]]);
  add(20, 'Pension insurer', 'TyEL, September', [['Liabilities:Payroll:Pension', sept.pe], ['Assets:Bank:Checking', -sept.pe]]);
  add(12, 'Tax authority', 'VAT, August', [['Liabilities:VAT:Payable', open.vatAug], ['Assets:Bank:Checking', -open.vatAug]]);

  // ---- Running costs ----
  buy(1, 'Quayside Properties', 'Rent, studio and shop, October', 'Expenses:Premises:Rent', c(4267.00));
  buy(14, 'Example Energy', 'Electricity, September', 'Expenses:Premises:Electricity', between(390, 460));
  buy(8, 'Fibrenet', 'Internet', 'Expenses:Office:Phone-Internet', c(49.90));
  buy(8, 'Mobile operator', 'Phones, studio', 'Expenses:Office:Phone-Internet', c(39.80));
  add(8, 'Mobile operator', 'Alice’s phone (50 % studio)', [['Expenses:Office:Phone-Internet', 1594], ['Assets:VAT:Input', 406], ['Equity:Owner:Private', 2000], ['Assets:Bank:Checking', -4000]]);
  buyNoVat(2, 'Mutual Insurance', 'Business insurance, monthly', 'Expenses:Office:Insurance', c(212.40));
  buyNoVat(30, 'Bank', 'Account fees', 'Expenses:Bank:Fees', c(18.50));
  buyEU(3, 'Ledgerly SA', 'Accounting software', 'Expenses:Office:Software', c(39.00), 'Services');
  buyEU(6, 'Vectoria GmbH', 'Design software, 3 seats', 'Expenses:Office:Software', c(89.97), 'Services');
  buyEU(9, 'Shopframe BV', 'Web shop platform', 'Expenses:Office:Software', c(79.00), 'Services');
  buyEU(7, 'Baltic Linen Mill UAB', 'Linen 240 g, 300 m', 'Expenses:Materials:Linen-Dyes', c(2460.00), 'Goods');
  buyEU(21, 'Baltic Linen Mill UAB', 'Linen 160 g, 200 m', 'Expenses:Materials:Linen-Dyes', c(1376.00), 'Goods');
  const dyeSup = ['Indigo & Co.', 'Madder House', 'Fibre Supply', 'The Yarn Depot', 'Dye Kitchen', 'Mordant Works'];
  for (let k = 0; k < 39; k++) buy(1 + Math.floor(rnd() * 30), pick(dyeSup), pick(['Indigo', 'Madder root', 'Alum', 'Linen thread', 'Weld', 'Cochineal', 'Iron mordant', 'Cotton tape']), 'Expenses:Materials:Linen-Dyes', between(40, 480));
  for (let k = 0; k < 18; k++) buy(1 + Math.floor(rnd() * 30), pick(['BoxCraft', 'Paper & Twine', 'Packwell']), pick(['Gift boxes', 'Tissue paper', 'Mailing bags', 'Labels', 'Kraft tape']), 'Expenses:Materials:Packaging', between(30, 210));
  for (let k = 0; k < 22; k++) buy(1 + Math.floor(rnd() * 30), 'Postal service', 'Parcels', 'Expenses:Shipping', between(24, 96));
  for (let k = 0; k < 17; k++) buy(1 + Math.floor(rnd() * 30), pick(['Hardware Corner', 'CleanCo', 'Office Depot North', 'Corner Café']), pick(['Studio supplies', 'Cleaning', 'Office supplies', 'Coffee for the studio']), 'Expenses:Studio:Supplies', between(8, 140));
  for (let k = 0; k < 6; k++) buy(1 + Math.floor(rnd() * 30), pick(['Art Supply Hall', 'Fibre Supply']), 'Course materials', 'Expenses:Courses:Materials', between(40, 190));
  for (let k = 0; k < 3; k++) buy(1 + Math.floor(rnd() * 30), 'Regional Rail', 'Train to Old Town fair', 'Expenses:Travel', between(18, 46));
  // The three questions (resolved later by Kirsi).
  const q = [
    { n: 16, payee: 'Greenleaf Garden Centre', narr: '', gross: c(86.40), acct: 'Expenses:Materials:Linen-Dyes', note: 'Madder and weld plants for the dye garden' },
    { n: 22, payee: 'Volt Electric', narr: '', gross: c(212.00), acct: 'Expenses:Equipment:Repairs', note: 'Repair: dye-kitchen hob' },
    { n: 13, payee: 'City Parking', narr: '', gross: c(12.60), acct: 'Expenses:Travel', note: 'Parking, bank visit (no receipt)', noVat: true },
  ];
  // Sort and number.
  tx.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return { tx, q, f, gross, open, sept };
}

export function render({ tx, q, f, open, sept }, resolved) {
  const lines = [];
  const L = (s = '') => lines.push(s);
  L('; Example Studio · books · October 2026');
  L('option "title" "Example Studio"');
  L('option "operating_currency" "EUR"');
  L('');
  const accts = new Set(['Equity:Opening', 'Assets:Suspense', 'Liabilities:VAT:Payable']);
  const all = [...tx];
  for (const x of q) {
    if (!resolved) all.push({ d: `2026-10-${x.n}`, payee: x.payee, narr: 'Unmatched: ask Kirsi', legs: [['Assets:Suspense', x.gross], ['Assets:Bank:Checking', -x.gross]] });
    else if (x.noVat) all.push({ d: `2026-10-${x.n}`, payee: x.payee, narr: x.note, legs: [[x.acct, x.gross], ['Assets:Bank:Checking', -x.gross]] });
    else { const net = Math.round(x.gross / 1.255); all.push({ d: `2026-10-${x.n}`, payee: x.payee, narr: x.note, legs: [[x.acct, net], ['Assets:VAT:Input', x.gross - net], ['Assets:Bank:Checking', -x.gross]] }); }
  }
  all.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  for (const t of all) for (const [a] of t.legs) accts.add(a);
  [...accts].sort().forEach((a) => L(`2026-01-01 open ${a} EUR`));
  L('');
  const bank0 = 5216340;
  L('2026-09-30 * "Opening balances, from September"');
  L(`  Assets:Bank:Checking              ${f(bank0).padStart(12)} EUR`);
  L(`  Liabilities:VAT:Payable           ${f(-(open.vatAug + open.vatSep)).padStart(12)} EUR`);
  L(`  Liabilities:Payroll:Withholding   ${f(-sept.wh).padStart(12)} EUR`);
  L(`  Liabilities:Payroll:Pension       ${f(-sept.pe).padStart(12)} EUR`);
  L('  Equity:Opening');
  L('');
  let bank = bank0;
  for (const t of all) {
    L(`${t.d} * "${t.payee}" "${t.narr}"${(t.tags || []).map((x) => ` #${x}`).join('')}`);
    for (const [a, v] of t.legs) { L(`  ${a.padEnd(34)}${f(v).padStart(12)} EUR`); if (a === 'Assets:Bank:Checking') bank += v; }
    L('');
  }
  L('; The statement’s closing balance: bean-check fails if the books do not reach it.');
  L(`2026-11-01 balance Assets:Bank:Checking ${f(bank)} EUR`);
  return { all, text: lines.join('\n') + '\n', bankLines: all.filter((t) => t.legs.some(([a]) => a === 'Assets:Bank:Checking')).length, bank };
}

// ---------- The Python the programs run ----------
const PY = {
'runway.py': String.raw`"""Cash runway: October's actuals from the books, run forward twelve months.

python3 runway.py books.beancount out.json
Reads the closed ledger with Beancount's own loader, takes October's actual
sales and costs, and runs the bank balance forward month by month with the
studio's seasonal pattern, the 2027 supplier prices, VAT and payroll paid on
their real lags, and June's holiday pay. A second run adds the second press
in March. Prints the table; writes the numbers the slide draws.
"""
import json
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal

from beancount import loader

path, out = sys.argv[1], sys.argv[2]
entries, errors, _ = loader.load_file(path)
if errors:
    sys.exit(f"{len(errors)} errors in {path}")

oct_ = defaultdict(Decimal)
bank = Decimal(0)
liab = defaultdict(Decimal)
for e in entries:
    for p in getattr(e, "postings", []) or []:
        n = p.units.number
        if p.account == "Assets:Bank:Checking":
            bank += n
        if p.account.startswith("Liabilities:"):
            liab[p.account] += n
        if date(2026, 10, 1) <= e.date <= date(2026, 10, 31):
            oct_[p.account] += n

f = lambda a: float(oct_[a])
sales = {k: -f(f"Income:Sales:{k}") for k in ("Shop", "Web", "Markets", "Wholesale", "Wholesale-EU")}
domestic = sum(v for k, v in sales.items() if k != "Wholesale-EU")
materials = f("Expenses:Materials:Linen-Dyes") + f("Expenses:Materials:Packaging") + f("Expenses:Courses:Materials")
mat_ratio = materials / sum(sales.values())
ship_ratio = f("Expenses:Shipping") / sales["Web"]
fee_ratio = f("Expenses:Bank:Card-Fees") / (sales["Shop"] + sales["Web"])
salaries = f("Expenses:Staff:Salaries")
contrib = f("Expenses:Staff:Pension") + f("Expenses:Staff:Social")
net_pay = salaries - float(-oct_["Liabilities:Payroll:Withholding"] - oct_["Liabilities:Payroll:Pension"]) + contrib
payroll_due = salaries + contrib - net_pay  # withholding and pension, paid the next month
fixed_vat = f("Expenses:Premises:Rent") + f("Expenses:Premises:Electricity") + f("Expenses:Office:Phone-Internet") + f("Expenses:Studio:Supplies") + f("Expenses:Market-Fees") + f("Expenses:Travel")
fixed_novat = f("Expenses:Office:Insurance") + f("Expenses:Bank:Fees") + f("Expenses:Office:Software")

# The shop's months against October, from the last three years' sales.
SEASON = {11: 1.30, 12: 1.85, 1: 0.62, 2: 0.70, 3: 0.86, 4: 0.92, 5: 1.02, 6: 1.08, 7: 0.84, 8: 0.94, 9: 1.00, 10: 1.00}
PRICES_2027 = 1.064  # weighted change on what we buy, price-lists-2027.xlsx
FLOOR = 15000.0
VAT = 0.255
months = [(2026 + (9 + k) // 12, (9 + k) % 12 + 1) for k in range(1, 13)]


def run(press=None):
    cash = float(bank)
    vat_due = {months[0]: float(-liab["Liabilities:VAT:Payable"])}  # September's, due in November
    oct_vat = float(-(oct_["Liabilities:VAT:Output"] + oct_["Liabilities:VAT:Output-EU-Goods"] + oct_["Liabilities:VAT:Output-EU-Services"]) - oct_["Assets:VAT:Input"])
    vat_due[months[1]] = oct_vat  # October's, due in December
    pay_due = float(-(liab["Liabilities:Payroll:Withholding"] + liab["Liabilities:Payroll:Pension"]))
    rows = []
    for k, (y, m) in enumerate(months):
        s = SEASON[m]
        price = PRICES_2027 if y == 2027 else 1.0
        dom = domestic * s
        eu = sales["Wholesale-EU"] * s
        mat = sum(sales.values()) * s * mat_ratio * price
        ship = sales["Web"] * s * ship_ratio
        fees = (sales["Shop"] + sales["Web"]) * s * fee_ratio
        out_vat = dom * VAT
        in_vat = (mat + ship + fixed_vat) * VAT
        inflow = dom * (1 + VAT) + eu
        outflow = (mat + ship + fixed_vat) * (1 + VAT) + fixed_novat + fees + net_pay * (1.5 if m == 6 else 1.0)
        if press and (y, m) == press[0]:
            outflow += press[1] * (1 + VAT)
            in_vat += press[1] * VAT
        outflow += pay_due + (vat_due.get((y, m)) or 0.0)
        pay_due = (salaries + contrib - net_pay) * (1.5 if m == 6 else 1.0)
        due = months[k + 2] if k + 2 < len(months) else None
        if due:
            vat_due[due] = out_vat - in_vat
        cash += inflow - outflow
        rows.append({"month": f"{y}-{m:02d}", "cash": round(cash, 2)})
    below = next((r["month"] for r in rows if r["cash"] < FLOOR), None)
    return rows, below


base, base_below = run()
press, press_below = run(press=((2027, 3), 13400.0))
res = {
    "today": round(float(bank), 2), "floor": FLOOR, "start": "2026-10",
    "base": base, "base_below": base_below, "press": press, "press_below": press_below,
    "october": {"sales": round(sum(sales.values()), 2), "costs": round(materials + salaries + contrib + fixed_vat + fixed_novat + f('Expenses:Shipping') + f('Expenses:Bank:Card-Fees') + f('Expenses:Equipment:Repairs'), 2)},
}
json.dump(res, open(out, "w"), indent=1)
print(f"cash 31 Oct {res['today']:>10,.2f}   floor {FLOOR:,.0f}")
print(f"{'month':<8} {'base':>10} {'with press':>11}")
for a, b in zip(base, press):
    print(f"{a['month']:<8} {a['cash']:>10,.0f} {b['cash']:>11,.0f}")
last = lambda rows, below: [r["month"] for r in rows if not below or r["month"] < below][-1]
print(f"above €{FLOOR:,.0f} until {last(base, base_below)} · with the press until {last(press, press_below)}")
`,
'slide.py': String.raw`"""One management slide from runway.json, drawn with matplotlib.

python3 slide.py runway.json fonts-dir out.png
"""
import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager

data, fonts, out = json.load(open(sys.argv[1])), Path(sys.argv[2]), sys.argv[3]
for f in fonts.glob("*.ttf"):
    font_manager.fontManager.addfont(str(f))
plt.rcParams.update({"font.family": "Instrument Sans", "font.size": 13, "svg.fonttype": "none"})

PAPER, INK, MUTED, LINE = "#fbf8f3", "#1d2433", "#6b6f7a", "#e6e0d6"
INDIGO, MADDER, FLOOR_C = "#2b4a78", "#b4532a", "#f3e1d6"
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def month_name(ym, long=False):
    y, m = map(int, ym.split("-"))
    names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return names[m - 1] if long else MON[m - 1]


def last_above(rows, below):
    keep = [r["month"] for r in rows if r["month"] < below] if below else [rows[-1]["month"]]
    return keep[-1]


months = [data["start"]] + [r["month"] for r in data["base"]]
base = [data["today"]] + [r["cash"] for r in data["base"]]
press = [data["today"]] + [r["cash"] for r in data["press"]]
xs = list(range(len(months)))
floor = data["floor"]
b_last, p_last = last_above(data["base"], data["base_below"]), last_above(data["press"], data["press_below"])
n_base = months.index(b_last)
n_press = months.index(p_last)

fig = plt.figure(figsize=(11, 6.1875), dpi=1600 / 11, facecolor=PAPER)  # drawn for a ~600 px view
fig.text(0.055, 0.91, "EXAMPLE STUDIO  ·  CASH  ·  NOVEMBER 2026", color=MUTED, fontsize=11, fontweight="semibold")
fig.text(0.055, 0.81, f"Cash stays above our floor until {month_name(b_last, True)}", color=INK, fontsize=34, fontweight="bold")
fig.text(0.055, 0.745, f"{n_base} months at today’s pace. The second press in March shortens that to {n_press}, until {month_name(p_last, True)}.",
         color="#3a3f4b", fontsize=16)

ax = fig.add_axes([0.085, 0.165, 0.85, 0.52], facecolor=PAPER)
top = max(base) * 1.12
ax.axhspan(-20000, floor, color=FLOOR_C, zorder=0)
ax.axhline(floor, color=MADDER, lw=1.2, ls=(0, (2, 3)), zorder=1)
ax.text(-0.25, floor + 1500, f"Floor €{floor/1000:.0f}k", color=MADDER, fontsize=12, ha="left", va="bottom", fontweight="semibold")
ax.fill_between(xs, base, floor, where=[v >= floor for v in base], color="#7d97c2", alpha=0.16, interpolate=True, zorder=1, lw=0)
ax.plot(xs, press, color=MADDER, lw=2.6, ls=(0, (6, 4)), zorder=3, solid_capstyle="round")
ax.plot(xs, base, color=INDIGO, lw=3.6, zorder=4, solid_capstyle="round", solid_joinstyle="round")
ax.scatter([0], [base[0]], s=110, color=INDIGO, zorder=5, edgecolor=PAPER, linewidth=2.5)
ax.annotate(f"€{base[0]:,.0f}\n31 Oct, from the books", (0, base[0]), xytext=(14, -6), textcoords="offset points",
            color=INK, fontsize=12, va="top", linespacing=1.3)
peak = max(range(len(base)), key=lambda k: base[k])
ax.annotate(f"Christmas  €{base[peak]/1000:.0f}k", (peak, base[peak]), xytext=(0, 14), textcoords="offset points",
            color=INDIGO, fontsize=12, ha="center", fontweight="semibold")
for k, colr, label in ((n_base, INDIGO, "Today’s pace"), (n_press, MADDER, "With the second press")):
    v = (base if colr == INDIGO else press)[k]
    ax.scatter([k], [v], s=70, color=colr, zorder=6, edgecolor=PAPER, linewidth=2)
ax.text(10.6, base[11] + 7200, "Today’s pace", color=INDIGO, fontsize=12.5, fontweight="semibold", ha="center", va="bottom")
ax.text(2.6, 7000, "With the second press in March, €13.4k", color=MADDER, fontsize=12.5, fontweight="semibold", ha="left", va="center")
m3 = months.index("2027-03")

ax.set_xlim(-0.35, len(xs) - 0.6)
ax.set_ylim(min(min(press), 0) - 4000, top)
ax.set_xticks(xs, [month_name(m) + (f"\n{m[:4]}" if m.endswith("-01") or k == 0 else "") for k, m in enumerate(months)], color=MUTED, fontsize=12)
yt = [0, 20000, 40000, 60000, 80000]
ax.set_yticks(yt, [f"€{v//1000}k" if v else "€0" for v in yt], color=MUTED, fontsize=12)
ax.grid(axis="y", color=LINE, lw=1)
ax.tick_params(length=0, pad=8)
for s in ax.spines.values():
    s.set_visible(False)
ax.axhline(0, color="#c9c2b6", lw=1)

fig.text(0.055, 0.04, "Month-end bank balance. October from the closed books; then the usual season, 2027 supplier prices, VAT and payroll on their due dates, June holiday pay.",
         color=MUTED, fontsize=9.5)
fig.savefig(out, facecolor=PAPER)
`,
'mkfonts.py': String.raw`import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
src, outdir = sys.argv[1], sys.argv[2]
for w, name in ((400, "Regular"), (600, "SemiBold"), (700, "Bold")):
    f = TTFont(src); f.flavor = None
    loc = {a.axisTag: (w if a.axisTag == "wght" else a.defaultValue) for a in f["fvar"].axes}
    i = instancer.instantiateVariableFont(f, loc)
    i["OS/2"].usWeightClass = w
    for n in i["name"].names:
        if n.nameID == 1: n.string = "Instrument Sans"
        if n.nameID in (2, 17): n.string = name
        if n.nameID == 4: n.string = f"Instrument Sans {name}"
        if n.nameID == 6: n.string = f"InstrumentSans-{name}"
    i.save(f"{outdir}/InstrumentSans-{name}.ttf")
`,
};

// ---------- What the page quotes, computed from the same transactions ----------
export function facts() {
  const L = ledger();
  const open = render(L, false), closed = render(L, true);
  const sum = (txs, re) => txs.reduce((a, t) => a + t.legs.filter(([x]) => re.test(x)).reduce((b, [, v]) => b + v, 0), 0);
  const count = (txs, re) => txs.filter((t) => t.legs.some(([x]) => re.test(x))).length;
  const eur = (cents) => (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const top = (txs, re, n = 3) => txs.filter((t) => t.legs.some(([x]) => re.test(x))).map((t) => [t.d.slice(5).split('-').reverse().map(Number).join('.'), t.payee, Math.abs(t.legs.filter(([x]) => re.test(x)).reduce((b, [, v]) => b + v, 0))]).sort((a, b) => b[2] - a[2]).slice(0, n).map(([d, p, v]) => [d, p, eur(v)]);
  const C = closed.all, O = open.all;
  const line = (label, re, sign, baseRe) => ({ label, cents: sign * sum(C, re), n: count(C, re), top: top(C, re), base: baseRe ? eur(Math.abs(sum(C, baseRe))) : '' });
  const vat = [
    line('Tax on domestic sales, 25.5 %', /^Liabilities:VAT:Output$/, -1, /^Income:Sales:(Shop|Web|Markets|Wholesale)$/),
    line('Tax on goods bought from other EU countries', /^Liabilities:VAT:Output-EU-Goods$/, -1),
    line('Tax on services bought from other EU countries', /^Liabilities:VAT:Output-EU-Services$/, -1),
    line('Deductible tax', /^Assets:VAT:Input$/, -1),
  ];
  const pay = vat.reduce((a, l) => a + l.cents, 0);
  const euBase = (tag) => eur(C.filter((t) => (t.tags || []).includes(tag)).reduce((a, t) => a + t.legs.filter(([x]) => x.startsWith('Expenses:')).reduce((b, [, v]) => b + v, 0), 0));
  const acct = (txs, re) => -sum(txs, re);
  return {
    eur,
    bankLines: open.bankLines, bank: eur(closed.bank), bankCents: closed.bank, journalLines: open.text.split('\n').length - 1,
    questions: L.q.map((q) => ({ payee: q.payee, eur: eur(q.gross) })),
    suspense: eur(sum(O, /^Assets:Suspense$/)),
    sales: [['Shop', acct(O, /^Income:Sales:Shop$/)], ['Web shop', acct(O, /^Income:Sales:Web$/)], ['Wholesale', acct(O, /^Income:Sales:Wholesale(-EU)?$/)], ['Markets', acct(O, /^Income:Sales:Markets$/)]],
    costs: [['Staff', -acct(O, /^Expenses:Staff:/)], ['Linen, dyes, boxes', -acct(O, /^Expenses:(Materials|Courses):/)], ['Rent and energy', -acct(O, /^Expenses:Premises:/)], ['Everything else', -acct(O, /^Expenses:(?!Staff:|Materials:|Courses:|Premises:)/)]],
    vat: vat.map((l) => ({ ...l, eur: eur(l.cents) })), pay: eur(pay), payCents: pay,
    euSales: eur(acct(C, /^Income:Sales:Wholesale-EU$/)), euGoods: euBase('eu-goods'), euServices: euBase('eu-services'),
    texts: { open: open.text, closed: closed.text },
  };
}

// ---------- The real programs ----------
async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '../../../../../..');
  const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-kirsi');
  const S = mkdtempSync(join(tmpdir(), 'role-kirsi-'));
  const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: S, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  const venv = join(tmpdir(), 'role-kirsi-venv');
  const py = join(venv, 'bin/python');
  if (!existsSync(py)) {
    run('uv', ['venv', '-q', venv]);
    run('uv', ['pip', 'install', '-q', '--python', py, 'beancount==3.2.3', 'beanquery==0.2.0', 'matplotlib==3.11.2', 'fonttools==4.60.1', 'brotli==1.1.0']);
  }
  const bin = (n) => join(venv, 'bin', n);
  const F = facts();
  writeFileSync(join(S, 'open.beancount'), F.texts.open);
  writeFileSync(join(S, 'main.beancount'), F.texts.closed);
  for (const n of ['runway.py', 'slide.py', 'mkfonts.py']) writeFileSync(join(S, n), PY[n]);
  run(bin('bean-check'), ['open.beancount']);
  run(bin('bean-check'), ['main.beancount']);
  const q = (file, sql) => run(bin('bean-query'), [file, sql]).replace(/\s+$/gm, '').trim();
  const { OUT } = await import(pathToFileURL(join(here, 'block.js')));
  const got = {
    books: q('open.beancount', OUT.booksQuery),
    vat: q('main.beancount', OUT.vatQuery),
    runway: run(py, ['-I', 'runway.py', 'main.beancount', 'runway.json']).replace(/\s+$/gm, '').trim(),
  };
  const drift = Object.keys(got).filter((k) => got[k] !== OUT[k]);
  if (drift.length) {
    for (const k of drift) console.error(`--- OUT.${k} in block.js is stale; the program now prints:\n${got[k]}\n`);
    process.exit(1);
  }
  const R = JSON.parse(readFileSync(join(S, 'runway.json'), 'utf8'));
  mkdirSync(join(S, 'fonts'));
  run(py, ['-I', 'mkfonts.py', join(root, 'design-system/fonts/instrument-sans-latin.woff2'), 'fonts']);
  run(py, ['-I', 'slide.py', 'runway.json', 'fonts', 'slide.png']);
  mkdirSync(out, { recursive: true });
  run('convert', [join(S, 'slide.png'), '-resize', '1200x', '-quality', '86', '-define', 'webp:method=6', join(out, 'cash-2026-11.webp')]);
  console.log(`books: ${F.bankLines} bank lines, closing ${F.bank} · VAT to pay ${F.pay} · cash ${R.today} on 31 Oct`);
  console.log(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'cash-2026-11.webp')]).trim());
}

// Not top-level await: main() imports block.js, which imports this module.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((e) => { console.error(e.stderr || e); process.exit(1); });
