// node blocks/alice-03-october-receipts/assets.mjs [--print]
//
// Makes Alice's October for real and checks the screen against it:
//  1. generate.py (below) writes a card statement PDF, the 1,284-message mail
//     index, the 212 saved messages with attachments (.eml; receipts, decoys,
//     invoices, newsletters and photos, PDFs drawn as SVG and converted with
//     rsvg-convert) and the shop's info@ Maildir. Seeded, so every run is the same.
//  2. Every command block.js shows (RUNS) runs in that directory, with the
//     matcher block.js shows (MATCHER) as bookkeeping/match_receipts.py, and its
//     output must equal what the screen prints. `gog` and `himalaya` stand for
//     Alice's mail accounts, which the generator replaces, so each RUN carries
//     the local command that reads the same data (`run`). --print prints the
//     actual outputs as JSON instead of failing, to update block.js.
//  3. The 23 receipts the matcher filed become WebP thumbnails (pdftoppm,
//     ImageMagick) in $ETUSIVU_ASSETS/alice-03-october-receipts/.
// Needs python3, rsvg-convert, pdftotext/pdftoppm (poppler), jq, convert.
// Set TMPDIR to your scratch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { MATCHER, RUNS, filed } from './block.js';

const ID = 'alice-03-october-receipts';
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const work = mkdtempSync(join(tmpdir(), 'receipts-'));
const sh = (cmd) => execFileSync('bash', ['-o', 'pipefail', '-c', cmd], { cwd: join(work, 'alice'), encoding: 'utf8', env: { ...process.env, PYTHONSAFEPATH: '1' } }).replace(/\n$/, '');

writeFileSync(join(work, 'generate.py'), GENERATE());
execFileSync('python3', ['-I', join(work, 'generate.py'), join(work, 'alice')], { stdio: 'inherit' });
mkdirSync(join(work, 'alice/bookkeeping'), { recursive: true });
writeFileSync(join(work, 'alice/bookkeeping/match_receipts.py'), MATCHER);

const actual = {};
let bad = 0;
for (const [key, r] of Object.entries(RUNS)) {
  actual[key] = sh(r.run || r.cmd);
  if (actual[key] !== r.out) { bad++; console.error(`RUNS.${key} differs from the real output:\n${actual[key]}\n`); }
}
if (process.argv.includes('--print')) { console.log(JSON.stringify(actual, null, 1)); process.exit(0); }
if (bad) process.exit(1);

// Thumbnails of the filed receipts, in the order the screen lists them.
const names = readdirSync(join(work, 'alice/bookkeeping/2026-10')).filter((f) => f.endsWith('.pdf')).sort();
const want = filed().map((f) => f.name);
if (JSON.stringify(names.filter((n) => want.includes(n))) !== JSON.stringify(want)) { console.error('filed receipts differ from the screen'); process.exit(1); }
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
filed().forEach((f, i) => {
  const png = join(work, `t${i}`);
  // The top of the first page, where the vendor's name and colour are, at 2x the 36 x 46 px tile.
  execFileSync('pdftoppm', ['-r', '72', '-png', '-singlefile', join(work, 'alice/bookkeeping/2026-10', f.name), png]);
  const [w, h] = execFileSync('identify', ['-format', '%w %h', `${png}.png`]).toString().split(' ').map(Number);
  const cw = Math.round(w > h ? h * 36 / 46 : w * 0.46); // a wide e-ticket: its full height
  execFileSync('convert', [`${png}.png`, '-gravity', 'northwest', '-crop', `${cw}x${Math.round(cw * 46 / 36)}+0+0`, '+repage', '-resize', '72x92!', '-quality', '84', '-define', 'webp:method=6', join(out, f.thumb)]);
});
console.log(execFileSync('du', ['-sh', out]).toString().trim());

function GENERATE() {
  return String.raw`
"""Generate Alice's October: a card statement PDF, her saved mail (.eml with
PDF receipts and decoys), and the shop's info@ mailbox. Deterministic."""
import json, random, re, subprocess, sys
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from email.utils import format_datetime
from pathlib import Path

root = Path(sys.argv[1]); root.mkdir(parents=True, exist_ok=True)
svgdir = root / "svg"; svgdir.mkdir(exist_ok=True)
rnd = random.Random(1026)

# date, vendor on statement, amount, receipt delay in days (None: no receipt in Alice's mail), style, sender
CHARGES = [
    ("02", "Paper Mill Supply", "184.20", 1, "invoice", "orders@papermill.example.org", "#7a4b2a"),
    ("02", "Parcel Post", "36.40", 0, "till", "receipts@parcelpost.example.org", None),
    ("03", "Hostbay", "19.00", 0, "invoice", "billing@hostbay.example.org", "#3b5bdb"),
    ("05", "Inkwell Print Co.", "412.80", 2, "invoice", "accounts@inkwell.example.org", "#1f2a44"),
    ("06", "Northside Packaging", "230.00", None, None, None, None),
    ("07", "Mailtide", "29.00", 0, "invoice", "billing@mailtide.example.org", "#0b7285"),
    ("08", "Harbour Market", "45.00", 1, "till", "office@harbourmarket.example.org", None),
    ("09", "Parcel Post", "52.10", 0, "till", "receipts@parcelpost.example.org", None),
    ("10", "Brightline Rail", "38.60", 0, "ticket", "tickets@brightline.example.org", "#c2255c"),
    ("12", "Kettle & Crumb", "23.40", 0, "till", "hello@kettlecrumb.example.org", None),
    ("13", "Ribbon & Reel", "67.90", 2, "invoice", "shop@ribbonreel.example.org", "#a61e4d"),
    ("14", "City parking", "12.60", None, None, None, None),
    ("15", "Cloudnote", "9.99", 0, "invoice", "billing@cloudnote.example.org", "#5f3dc4"),
    ("16", "Inkwell Print Co.", "96.00", 1, "invoice", "accounts@inkwell.example.org", "#1f2a44"),
    ("17", "Parcel Post", "41.75", 0, "till", "receipts@parcelpost.example.org", None),
    ("19", "Linen & Loom", "318.00", 3, "invoice", "sales@linenloom.example.org", "#2b8a3e"),
    ("20", "Hostbay", "14.00", 0, "invoice", "billing@hostbay.example.org", "#3b5bdb"),
    ("21", "Studio Lightworks", "129.00", 1, "invoice", "store@lightworks.example.org", "#e8590c"),
    ("22", "Parcel Post", "47.30", -1, "till", "receipts@parcelpost.example.org", None),
    ("23", "Brightline Rail", "38.60", 0, "ticket", "tickets@brightline.example.org", "#c2255c"),
    ("24", "Harbour Market", "45.00", 1, "till", "office@harbourmarket.example.org", None),
    ("26", "Desk & Drawer", "58.45", 2, "invoice", "orders@deskdrawer.example.org", "#495057"),
    ("27", "Parcel Post", "63.20", 0, "till", "receipts@parcelpost.example.org", None),
    ("28", "Fjord Fonts", "49.00", None, None, None, None),
    ("29", "Sunday Bakery", "31.80", 0, "till", "hello@sundaybakery.example.org", None),
    ("30", "Kiln Street Frames", "154.00", 2, "invoice", "frames@kilnstreet.example.org", "#862e9c"),
]
assert len(CHARGES) == 26

def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")
def pdf(svg, name):
    p = svgdir / (name + ".svg"); p.write_text(svg)
    out = svgdir / (name + ".pdf")
    subprocess.run(["rsvg-convert", "-f", "pdf", "-o", out, p], check=True)
    return out.read_bytes()

def invoice(vendor, d, amount, color, number, lines):
    rows = "".join(f'<text x="60" y="{330 + i*26}" font-size="12">{esc(t)}</text><text x="535" y="{330 + i*26}" font-size="12" text-anchor="end">{a}</text>' for i, (t, a) in enumerate(lines))
    y = 330 + len(lines) * 26 + 20
    net = f"{float(amount)/1.255:.2f}"; vat = f"{float(amount)-float(net):.2f}"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" font-family="Bitstream Charter, DejaVu Serif">
<rect width="595" height="842" fill="#fff"/><rect width="595" height="120" fill="{color}"/>
<text x="60" y="72" font-size="28" fill="#fff" font-weight="bold">{esc(vendor)}</text>
<text x="60" y="98" font-size="11" fill="#fff" opacity=".8">{re.sub(r"[^a-z]", "", vendor.lower())}.example.org</text>
<text x="60" y="180" font-size="20" fill="#222">Invoice {number}</text>
<text x="60" y="210" font-size="12" fill="#555">Date: {d.isoformat()}</text>
<text x="60" y="228" font-size="12" fill="#555">Customer: Example Studio, Alice</text>
<text x="400" y="210" font-size="12" fill="#555">Paid by card</text>
<line x1="60" y1="300" x2="535" y2="300" stroke="#ccc"/>
<text x="60" y="290" font-size="10" fill="#888">DESCRIPTION</text><text x="535" y="290" font-size="10" fill="#888" text-anchor="end">EUR</text>
{rows}
<line x1="60" y1="{y}" x2="535" y2="{y}" stroke="#ccc"/>
<text x="380" y="{y+24}" font-size="11" fill="#555">Net</text><text x="535" y="{y+24}" font-size="11" text-anchor="end" fill="#555">{net}</text>
<text x="380" y="{y+42}" font-size="11" fill="#555">VAT 25.5 %</text><text x="535" y="{y+42}" font-size="11" text-anchor="end" fill="#555">{vat}</text>
<rect x="370" y="{y+56}" width="175" height="34" fill="{color}" opacity=".12"/>
<text x="380" y="{y+79}" font-size="15" font-weight="bold">Total EUR</text><text x="535" y="{y+79}" font-size="15" font-weight="bold" text-anchor="end">{amount}</text>
<text x="60" y="790" font-size="9" fill="#999">Thank you for your order. Questions: reply to this email.</text>
</svg>'''

def till(vendor, d, amount, lines):
    h = 380 + len(lines) * 18
    rows = "".join(f'<text x="20" y="{150 + i*18}">{esc(t)}</text><text x="260" y="{150 + i*18}" text-anchor="end">{a.replace(".", ",")}</text>' for i, (t, a) in enumerate(lines))
    y = 150 + len(lines) * 18
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="280" height="{h}" font-family="DejaVu Sans Mono" font-size="11">
<rect width="280" height="{h}" fill="#fbfaf6"/>
<text x="140" y="44" font-size="15" font-weight="bold" text-anchor="middle">{esc(vendor.upper())}</text>
<text x="140" y="64" text-anchor="middle" fill="#555">Receipt</text>
<text x="20" y="100">{d.isoformat()}  {rnd.randint(8,17):02d}:{rnd.randint(0,59):02d}</text>
<text x="20" y="118">No. {rnd.randint(10000, 99999)}</text>
<line x1="20" y1="130" x2="260" y2="130" stroke="#333" stroke-dasharray="3 3"/>
{rows}
<line x1="20" y1="{y+4}" x2="260" y2="{y+4}" stroke="#333" stroke-dasharray="3 3"/>
<text x="20" y="{y+28}" font-size="14" font-weight="bold">TOTAL</text><text x="260" y="{y+28}" font-size="14" font-weight="bold" text-anchor="end">{amount.replace(".", ",")}</text>
<text x="20" y="{y+50}" fill="#555">CARD  **** 4417</text>
<text x="140" y="{y+90}" text-anchor="middle" fill="#555">Thank you!</text>
</svg>'''

def ticket(vendor, d, amount, color):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="595" height="300" font-family="DejaVu Sans">
<rect width="595" height="300" rx="14" fill="#fff"/><rect width="150" height="300" fill="{color}"/>
<text x="75" y="160" font-size="20" fill="#fff" text-anchor="middle" font-weight="bold">{esc(vendor.split()[0])}</text>
<text x="180" y="60" font-size="11" fill="#888">E-TICKET AND RECEIPT</text>
<text x="180" y="100" font-size="24" fill="#222">Harbour St. → Old Town</text>
<text x="180" y="130" font-size="13" fill="#555">Date: {d.isoformat()} · Return · 2 adults</text>
<text x="180" y="230" font-size="16" font-weight="bold">Total EUR {amount}</text>
<text x="180" y="256" font-size="10" fill="#888">Paid by card **** 4417</text>
</svg>'''

def detail(vendor, amount):
    a = float(amount)
    table = {
        "Paper Mill Supply": [("Kraft paper 120 g, 500 sh", 112.40), ("Tissue paper, ivory", 71.80)],
        "Inkwell Print Co.": [("Risograph prints, A3 × 400", a * 0.8), ("Paper surcharge", a * 0.2)],
        "Mailtide": [("Newsletter plan, October", a)],
        "Hostbay": [("Web hosting, October" if a > 15 else "Domain renewal, example.org", a)],
        "Ribbon & Reel": [("Cotton ribbon 15 mm × 50 m", 39.90), ("Paper tape, 6 rolls", 28.00)],
        "Cloudnote": [("Team storage, 200 GB", a)],
        "Linen & Loom": [("Natural canvas, 20 m", 268.00), ("Freight", 50.00)],
        "Studio Lightworks": [("LED panel, 30 W", 129.00)],
        "Desk & Drawer": [("Label printer rolls × 6", 41.95), ("Box files", 16.50)],
        "Kiln Street Frames": [("Oak frame A3 × 4", 154.00)],
        "Parcel Post": [(f"Parcels × {max(2, int(a // 8))}", a)],
        "Harbour Market": [("Stall fee, Saturday", a)],
        "Kettle & Crumb": [("Coffee × 3", 11.40), ("Cardamom buns × 4", 12.00)],
        "Sunday Bakery": [("Rye loaves × 4", 19.80), ("Buns, box", 12.00)],
    }[vendor]
    return [(t, f"{v:.2f}") for t, v in table]

def mail(frm, to, subj, d, body, parts=()):
    m = EmailMessage(); m["From"] = frm; m["To"] = to; m["Subject"] = subj
    m["Date"] = format_datetime(datetime(d.year, d.month, d.day, rnd.randint(6, 22), rnd.randint(0, 59)))
    m.set_content(body)
    for name, ctype, data in parts:
        maj, sub = ctype.split("/"); m.add_attachment(data, maintype=maj, subtype=sub, filename=name)
    return m.as_bytes()

raw = root / "mail/raw"; raw.mkdir(parents=True, exist_ok=True)
msgs = []  # (date, from, subject, attachment count)
def save(m_bytes, d, frm, subj, n):
    i = len(msgs) + 1
    msgs.append({"id": f"19a{i:05x}", "date": d.isoformat(), "from": frm, "subject": subj, "attachments": n})
    if n: (raw / f"19a{i:05x}.eml").write_bytes(m_bytes)

# The receipts.
for dd, vendor, amount, delay, style, frm, color in CHARGES:
    if delay is None: continue
    d = date(2026, 10, int(dd)) + timedelta(days=delay)
    no = f"{vendor[:2].upper()}-{rnd.randint(10000, 99999)}"
    if style == "invoice": svg = invoice(vendor, d, amount, color, no, detail(vendor, amount)); fname = f"invoice-{no}.pdf"
    elif style == "till": svg = till(vendor, d, amount, detail(vendor, amount)); fname = f"receipt-{rnd.randint(100000, 999999)}.pdf"
    else: svg = ticket(vendor, d, amount, color); fname = f"ticket-{no}.pdf"
    subj = {"invoice": f"Your invoice {no}", "till": "Your receipt", "ticket": "Your e-ticket and receipt"}[style]
    save(mail(f"{vendor} <{frm}>", "alice@example.org", subj, d, "Thank you. Your receipt is attached.", [(fname, "application/pdf", pdf(svg, fname[:-4]))]), d, frm, subj, 1)

# Decoys that look like receipts but are not October's.
sep = invoice("Paper Mill Supply", date(2026, 9, 27), "184.20", "#7a4b2a", "PA-55120", [("Kraft paper 120 g, 500 sh", "112.40"), ("Tissue paper, ivory", "71.80")])
save(mail("Paper Mill Supply <orders@papermill.example.org>", "alice@example.org", "Your invoice PA-55120", date(2026, 9, 27), "Attached.", [("invoice-PA-55120.pdf", "application/pdf", pdf(sep, "decoy-sep"))]), date(2026, 9, 27), "orders@papermill.example.org", "Your invoice PA-55120", 1)
plist = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" font-family="DejaVu Sans"><rect width="595" height="842" fill="#fff"/><text x="60" y="90" font-size="24">Northside Packaging</text><text x="60" y="130" font-size="14">Price list 2027 (valid from 1 January)</text>' + "".join(f'<text x="60" y="{180+i*22}" font-size="12">Mailer box size {i+1}</text><text x="535" y="{180+i*22}" font-size="12" text-anchor="end">{0.42+i*0.11:.2f} / pc</text>' for i in range(16)) + "</svg>"
save(mail("Northside Packaging <sales@northside.example.org>", "alice@example.org", "Price list 2027", date(2026, 10, 9), "New prices attached.", [("northside-prices-2027.pdf", "application/pdf", pdf(plist, "decoy-plist"))]), date(2026, 10, 9), "sales@northside.example.org", "Price list 2027", 1)

# Everything else with an attachment: wholesale invoices Example Studio sent, newsletters, photos.
png = subprocess.run(["convert", "-size", "64x48", "plasma:fractal", "-seed", "7", "jpg:-"], capture_output=True, check=True).stdout
shops = ["Corner Gift Shop", "Lakeside Books", "Maple & Co.", "The Paper Nook", "Old Town Gallery", "Harbour Deli"]
fill_pdf = {}
def filler_pdf(kind, k):
    if kind not in fill_pdf or kind == "sales":
        if kind == "sales":
            amt = f"{rnd.randint(60, 900)}.{rnd.randint(0, 99):02d}"
            fill_pdf[kind] = pdf(invoice("Example Studio", date(2026, 10, rnd.randint(1, 31)), amt, "#2f6b45", f"ES-{2400+k}", [("Wholesale order", amt)]), f"sales-{k}")
        else:
            fill_pdf[kind] = pdf('<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" font-family="DejaVu Sans"><rect width="595" height="842" fill="#fff"/><text x="60" y="90" font-size="22">Makers’ Newsletter</text><text x="60" y="130" font-size="12">Autumn fairs, new suppliers and a recipe.</text></svg>', "newsletter")
    return fill_pdf[kind]
start = date(2026, 9, 25)
total_with = 212
k = 0
while len([m for m in msgs if m["attachments"]]) < total_with:
    k += 1
    d = start + timedelta(days=rnd.randint(0, 58))
    r = rnd.random()
    if r < 0.33:
        shop = rnd.choice(shops); subj = f"Invoice ES-{2400+k} for {shop}"
        save(mail("Alice <alice@example.org>", f"orders@{shop.split()[0].lower()}.example.org", subj, d, "Invoice attached.", [(f"ES-{2400+k}.pdf", "application/pdf", filler_pdf("sales", k))]), d, "alice@example.org", subj, 1)
    elif r < 0.55:
        subj = "Makers’ Newsletter"
        save(mail("Makers <news@makers.example.org>", "alice@example.org", subj, d, "This month.", [("newsletter.pdf", "application/pdf", filler_pdf("news", k))]), d, "news@makers.example.org", subj, 1)
    else:
        who = rnd.choice(["bob", "carol", "kirsi", "dave", "erin"]); subj = rnd.choice(["Photos from the stall", "New tote samples", "Shelf photo", "Packing table"])
        save(mail(f"{who.title()} <{who}@example.org>", "alice@example.org", subj, d, "See attached.", [(f"IMG_{4000+k}.jpg", "image/jpeg", png)]), d, f"{who}@example.org", subj, 1)
# Mail without attachments, to 1,284; Fjord Fonts only ever sent its newsletter here.
for d in (date(2026, 10, 1), date(2026, 10, 15), date(2026, 10, 29), date(2026, 11, 12)):
    save(b"", d, "news@fjordfonts.example.org", "New from Fjord Fonts", 0)
while len(msgs) < 1284:
    d = start + timedelta(days=rnd.randint(0, 58))
    frm, subj = rnd.choice([("bob@example.org", "Re: deliveries"), ("kirsi@example.org", "October books"), ("orders@cornergift.example.org", "Reorder"), ("news@makers.example.org", "Makers’ week"), ("noreply@shop.example.org", "New order")])
    save(b"", d, frm, subj, 0)
(root / "mail/index.json").write_text(json.dumps(msgs, indent=1))

# The statement.
stmt_rows = "".join(f'<text x="60" y="{230 + i*20}">{dd}.10.</text><text x="130" y="{230 + i*20}">{esc(v)}</text><text x="535" y="{230 + i*20}" text-anchor="end">{a}</text>' for i, (dd, v, a, *_) in enumerate(CHARGES))
total = sum(float(c[2]) for c in CHARGES)
y = 230 + 26 * 20 + 20
stmt = f'''<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" font-family="DejaVu Sans" font-size="11">
<rect width="595" height="842" fill="#fff"/>
<text x="60" y="70" font-size="18" font-weight="bold">Harbour Savings Bank</text>
<text x="60" y="100">Business card statement · October 2026</text>
<text x="60" y="118">Example Studio · card **** 4417</text>
<text x="60" y="200" fill="#666">Date</text><text x="130" y="200" fill="#666">Merchant</text><text x="535" y="200" fill="#666" text-anchor="end">EUR</text>
{stmt_rows}
<text x="130" y="{y}" font-weight="bold">Total</text><text x="535" y="{y}" font-weight="bold" text-anchor="end">{total:,.2f}</text>
</svg>'''
(root / "statement-2026-10.pdf").write_bytes(pdf(stmt, "statement"))

# The shop's info@ mailbox (Maildir), where Fjord Fonts sends its invoices.
for sub in ("cur", "new", "tmp"): (root / "Mail/info" / sub).mkdir(parents=True, exist_ok=True)
ff = invoice("Fjord Fonts", date(2026, 10, 28), "49.00", "#1c7ed6", "FF-10291", [("Desktop licence, Harbour Serif", "49.00")])
infos = [("Fjord Fonts <billing@fjordfonts.example.org>", "Invoice FF-10291", date(2026, 10, 28), [("FF-10291.pdf", "application/pdf", pdf(ff, "fjord"))])]
for i in range(40):
    infos.append((f"{rnd.choice(['A customer', 'Shop visitor', 'Lakeside Books'])} <hello{i}@example.org>", rnd.choice(["Opening hours?", "Wholesale question", "Order #10{0}".format(rnd.randint(10, 99))]), start + timedelta(days=rnd.randint(0, 58)), []))
for i, (frm, subj, d, parts) in enumerate(infos):
    (root / "Mail/info/cur" / f"{1760000000 + i}.{i}.info:2,S.eml").write_bytes(mail(frm, "info@example.org", subj, d, "Hello.", parts))
print(f"total {total:.2f}, messages {len(msgs)}, with attachments {sum(1 for m in msgs if m['attachments'])}")
`;
}
