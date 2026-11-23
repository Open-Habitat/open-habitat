// node blocks/caps-paper/assets.mjs: the real work behind both screens of "Paper and files".
//
// 1. Documents. Chromium (Playwright, from $PROTO_WEB) prints three fictional
//    PDFs from HTML written here: Clearline Glass's delivery terms 2019 and
//    2021 (the breakage clause of 2021 lands on page 3) and Example Studio's
//    lease for 2026 and its renewal for 2027.
// 2. Mailbox. Python (stdlib only) writes a deterministic mbox of the sales
//    inbox 2014–2024 (seeded filler plus the real Clearline threads, with the
//    terms PDFs attached), indexes it into SQLite FTS5, the attachments with
//    pdftotext page by page, and runs the agent's searches. The output the
//    screen shows is printed as JSON (block.js carries it verbatim).
// 3. Lease. pdftotext on both leases, a word-level difflib comparison per
//    clause, printed as JSON (the redline in block.js is this output).
// 4. Picture. pdftoppm renders page 3 of the 2021 terms; ImageMagick crops
//    it around § 6 and marks the sentence where pdftotext -bbox puts it.
//
// Writes into $ETUSIVU_ASSETS/caps-paper/:
//   terms-2021-p3.webp   page 3 of Clearline's 2021 terms, the clause marked
// and the inputs and JSON into $TMPDIR/caps-paper-work/ (mbox, index.sqlite,
// the PDFs, mail.json, lease.json). Set TMPDIR to your scratch first; needs
// python3 with sqlite3 FTS5, poppler-utils and ImageMagick.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ID = 'caps-paper';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const work = join(tmpdir(), `${ID}-work`);
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const font = (f) => pathToFileURL(join(root, 'design-system/fonts', f)).href;

// ---------------------------------------------------------------- documents
const termsDoc = (year) => {
  const y21 = year === 2021;
  const clauses = [
    ['1', 'Scope', 'These terms apply to every delivery of glassware, vases, jars and lamp glass from Clearline Glass Oy (“Clearline”) to Example Studio (“the buyer”) from 1 April ' + year + ' until replaced by new terms agreed in writing.'],
    ['2', 'Orders', 'Orders are placed by email to orders@clearline.example.org. An order is binding when Clearline confirms it in writing with the delivery week. Changes after confirmation are accepted when the goods have not yet been packed.'],
    ['3', 'Prices', 'Prices follow the price list in force on the day of the order, excluding VAT. Clearline announces price changes at least 60 days in advance. Orders confirmed before a change keep the old price.'],
    ['', 'BREAK', ''],
    ['4', 'Delivery', 'Goods are delivered to the buyer’s workshop at Harbour Lane 4. Delivery time is two to four weeks from confirmation, six weeks in November and December. Clearline notifies the buyer of any delay without undue delay.'],
    ['5', 'Packaging', 'Every item is packed individually in recycled paper fibre. Cartons are marked FRAGILE and THIS WAY UP. Pallets are returned to the carrier at the next delivery.'],
    ['', 'BREAK', ''],
    ['6', 'Breakage and damage in transit', y21
      ? 'Breakage in transit is credited in full when reported with photos within 7 days of delivery. The buyer keeps the broken items until Clearline confirms the credit. No replacement order is needed; the credit is deducted from the next invoice.'
      : 'Items broken in transit are credited at 50 % of their price when reported within 48 hours of delivery and returned to Clearline at the buyer’s cost. Breakage above 10 % of a delivery is credited in full.'],
    ['7', 'Defects', 'Defects in manufacture (bubbles, cracks, uneven rims) are reported within 30 days. Clearline replaces the item or credits its price at its choice.'],
    ['8', 'Returns', 'Unbroken goods in their original packaging may be returned within 14 days with Clearline’s written consent. A restocking fee of 10 % applies.'],
    ['', 'BREAK', ''],
    ['9', 'Payment', 'Payment within 21 days net from the invoice date. Late payment interest follows the Interest Act.'],
    ['10', 'Liability', 'Neither party is liable for indirect damage. Clearline’s liability is limited to the value of the delivery concerned.'],
    ['11', 'Disputes', 'Disputes are settled first by negotiation and then in the district court of the seller’s home town.'],
  ];
  let page = 1;
  const pages = [[]];
  for (const c of clauses) if (c[1] === 'BREAK') { pages.push([]); page += 1; } else pages[pages.length - 1].push(c);
  return `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: IS; src: url(${font('instrument-sans-latin.woff2')}); }
@page { size: A4; margin: 0; }
body { margin: 0; font: 9.5pt/1.5 IS, sans-serif; color: #1d2a27; }
.cols { column-count: 2; column-gap: 10mm; } .cols section { break-inside: avoid; }
.p { width: 210mm; height: 297mm; padding: 22mm 24mm; box-sizing: border-box; position: relative; page-break-after: always; }
.p:last-child { page-break-after: auto; }
.head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #2d6d8c; padding-bottom: 6mm; margin-bottom: 10mm; color: #2d6d8c; }
.head b { font-size: 15pt; letter-spacing: .02em; } .head span { font-size: 9pt; }
h1 { font-size: 20pt; margin: 0 0 4mm; } .sub { color: #5b6966; margin: 0 0 12mm; }
h2 { font-size: 10.5pt; margin: 0 0 1.5mm; } .cols section { margin-bottom: 6mm; } p { margin: 0 0 3mm; }
.foot { position: absolute; left: 24mm; right: 24mm; bottom: 14mm; font-size: 8.5pt; color: #7b8784; display: flex; justify-content: space-between; }
</style>${pages.map((cs, i) => `<section class="p"><div class="head"><b>CLEARLINE GLASS</b><span>Terms of delivery ${year}</span></div>${i === 0 ? `<h1>Terms of delivery to Example Studio</h1><p class="sub">Agreed ${y21 ? '12 March 2021' : '4 February 2019'} · replaces all earlier terms</p>` : ''}<div class="cols">${cs.map(([n, t, b]) => `<section><h2>${n} ${t}</h2><p>${b}</p></section>`).join('')}</div><div class="foot"><span>Clearline Glass Oy · clearline.example.org</span><span>Page ${i + 1} of ${pages.length}</span></div></section>`).join('')}`;
};

// The lease: the 2027 renewal differs from 2026 in dates and in four clauses.
const leaseDoc = (year) => {
  const r = year === 2027;
  const cl = [
    ['1', 'Parties', 'Harbour Lane Properties Ltd (“the landlord”) and Example Studio (“the tenant”).'],
    ['2', 'Premises', 'The workshop and shop on the ground floor of Harbour Lane 4, 186 square metres, with the storage room in the basement and two parking spaces in the yard.'],
    ['3', 'Rent', 'The rent is €1,850 a month, paid in advance by the second weekday of each month.'],
    ['4', 'Term', `The lease runs from 1 January ${year} to 31 December ${year} and continues for one year at a time unless either party gives notice under clause 7.`],
    ['5', 'Security deposit', `The tenant pays a security deposit equal to ${r ? 'three' : 'two'} months’ rent before the keys are handed over.`],
    ['6', 'Use of the premises', 'The premises are used as a design workshop, print studio and shop. Printing with water-based inks is permitted; solvent-based inks need the landlord’s consent.'],
    ['7', 'Notice period', `The notice period is ${r ? 'six (6)' : 'three (3)'} months for both parties. Notice is given in writing.`],
    ['8', 'Maintenance', 'The landlord maintains the building, its roof, facade and shared systems. The tenant maintains the interior and its own fixtures.'],
    ['9', 'Rent review', `The rent is reviewed each January by the change in the cost-of-living index${r ? ', and rises by at least 2 %' : ''}.`],
    ['10', 'Alterations', 'Alterations to the premises need the landlord’s written consent. On leaving, the tenant restores the premises unless agreed otherwise.'],
    ['11', 'Subletting', 'The tenant may sublet part of the premises with the landlord’s written consent, which is not unreasonably withheld.'],
    ['12', 'Insurance', 'The tenant insures its own property and holds liability insurance for its business.'],
    ['13', 'Keys', 'The landlord hands over six keys. Additional keys are ordered through the landlord at the tenant’s cost.'],
  ];
  if (r) cl.push(['14', 'Signage', 'Signs, banners and window lettering on the facade need the landlord’s written approval.']);
  const sig = r ? '14 November 2026' : '20 November 2025';
  return `<!doctype html><meta charset="utf-8"><style>
@page { size: A4; margin: 24mm 26mm 22mm; }
body { margin: 0; font: 11pt/1.55 'Bitstream Charter', 'DejaVu Serif', serif; color: #1b1b1b; }
h1 { font-size: 18pt; text-align: center; margin: 0 0 2mm; letter-spacing: .04em; } .sub { text-align: center; margin: 0 0 10mm; color: #555; }
h2 { font-size: 11pt; margin: 6mm 0 1mm; } p { margin: 0 0 2mm; text-align: justify; }
.sig { margin-top: 14mm; display: grid; grid-template-columns: 1fr 1fr; gap: 12mm; } .sig div { border-top: 1px solid #333; padding-top: 2mm; font-size: 9.5pt; }
</style><h1>COMMERCIAL LEASE</h1><p class="sub">Harbour Lane 4 · ${year}</p>${cl.map(([n, t, b]) => `<h2>${n}. ${t}</h2><p>${b}</p>`).join('')}<p style="margin-top:8mm">Signed on ${sig}.</p><div class="sig"><div>For Harbour Lane Properties Ltd</div><div>For Example Studio</div></div>`;
};

const browser = await chromium.launch();
const page = await browser.newPage();
// Loaded from a file (not setContent) so the file:// font URLs resolve.
const pdf = async (name, html) => { const f = join(work, name.replace('.pdf', '.html')); writeFileSync(f, html); await page.goto(pathToFileURL(f).href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.pdf({ path: join(work, name), preferCSSPageSize: true, printBackground: true }); };
await pdf('clearline-terms-2019.pdf', termsDoc(2019));
await pdf('clearline-terms-2021.pdf', termsDoc(2021));
await pdf('lease-2026.pdf', leaseDoc(2026));
await pdf('lease-2027.pdf', leaseDoc(2027));
await browser.close();

// ---------------------------------------------------------------- mailbox + index + lease diff (Python)
const py = String.raw`
import mailbox, random, sqlite3, subprocess, json, os, sys, time, re, difflib
from email.message import EmailMessage
from email.utils import format_datetime, parsedate_to_datetime
from datetime import datetime, timedelta, timezone
W = sys.argv[1]
rnd = random.Random(2014)
ME = 'sales@example.org'
tz = timezone(timedelta(hours=2))

people = [
  ('Northside Gifts', 'orders@northside.example.org'), ('Linden Ceramics', 'hello@linden.example.org'),
  ('Mill Street Books', 'shop@millstreet.example.org'), ('Pine & Thread', 'info@pinethread.example.org'),
  ('Fjord Paper', 'sales@fjordpaper.example.org'), ('Harbour Café', 'cafe@harbour.example.org'),
  ('Lakeside Hotel', 'events@lakeside.example.org'), ('City Craft Fair', 'stands@craftfair.example.org'),
  ('Parcelway', 'noreply@parcelway.example.org'), ('Kirsi (books)', 'kirsi@example.org'),
  ('Alice', 'alice@example.org'), ('Dave', 'dave@example.org'), ('Clearline Glass', 'orders@clearline.example.org'),
]
topics = [
  ('Order {n}', 'Thank you for the order. We will pack it this week and send the tracking code when it leaves.'),
  ('Re: Order {n}', 'Could you add two more of the tea towels in rust? Same delivery is fine.'),
  ('Invoice {n}', 'Attached is invoice {n}. Payment within 14 days, reference on the invoice.'),
  ('Price list {y}', 'Our price list for {y} is attached. Prices change from 1 March.'),
  ('Stand at the fair', 'Your stand is confirmed for the weekend. Setup from 7:00 on Friday.'),
  ('Re: Christmas stock', 'We would like the same as last year, and the new calendars if they are ready.'),
  ('Delivery delayed', 'The shipment is delayed by two days because of the holiday. Sorry for the trouble.'),
  ('Your parcel is on its way', 'Parcel {n} has left the terminal and will be delivered tomorrow.'),
  ('Re: samples', 'The samples arrived. The linen is lovely; the blue is a bit darker than on screen.'),
  ('Wholesale terms', 'For orders over 300 euros shipping is free. Payment 30 days for returning customers.'),
  ('Meeting on Tuesday?', 'Shall we meet on Tuesday at ten to go through the spring range?'),
  ('Re: website', 'There is a broken link on the contact page, the map does not open.'),
  ('Lunch at the fair', 'A glass of wine after the fair on Saturday? We are at the corner table.'),
]
msgs = []
def add(dt, frm, to, subj, body, att=None, mid=None, reply=None):
    m = EmailMessage()
    m['From'] = '%s <%s>' % frm if isinstance(frm, tuple) else frm
    m['To'] = to; m['Subject'] = subj; m['Date'] = format_datetime(dt)
    m['Message-ID'] = mid or '<%d.%d@example.org>' % (int(dt.timestamp()), len(msgs))
    if reply: m['In-Reply-To'] = reply
    m.set_content(body)
    if att:
        with open(os.path.join(W, att[0]), 'rb') as f:
            m.add_attachment(f.read(), maintype='application', subtype='pdf', filename=att[1])
    msgs.append((dt, m))

start = datetime(2014, 1, 7, 8, 0, tzinfo=tz)
d = start
while d < datetime(2024, 12, 20, tzinfo=tz):
    for _ in range(rnd.randint(2, 7)):
        p = rnd.choice(people[:-1]); s, b = rnd.choice(topics)
        n = rnd.randint(1000, 9999); fill = dict(n=n, y=d.year)
        dt = d + timedelta(hours=rnd.randint(0, 9), minutes=rnd.randint(0, 59))
        if rnd.random() < .5: add(dt, p, ME, s.format(**fill), b.format(**fill))
        else: add(dt, ('Sales', ME), p[1], s.format(**fill), b.format(**fill))
    d += timedelta(days=1)

CL = ('Clearline Glass', 'orders@clearline.example.org')
T = lambda *a: datetime(*a, tzinfo=tz)
add(T(2019,2,4,10,12), CL, ME, 'Terms 2019', 'Hello,\n\nattached are our terms of delivery for 2019 as agreed on the phone.\n\nBest regards,\nClearline Glass', att=('clearline-terms-2019.pdf', 'Clearline terms 2019.pdf'))
add(T(2019,11,18,9,40), ('Sales', ME), CL[1], 'Breakage claim #2231', 'Hello,\n\nsix of the 40 vases in Friday’s delivery arrived broken. Photos attached to the parcel report. Please credit them.\n')
add(T(2019,11,20,14,5), CL, ME, 'Re: Breakage claim #2231', 'Hello,\n\nunder our terms breakage is credited at 50 % when the items are returned. We will send a return label.\n')
add(T(2021,1,11,8,55), ('Sales', ME), CL[1], 'Broken vases, December', 'Hello,\n\nonce again a carton of vases came broken in December, 9 of 36. Returning broken glass at our own cost makes no sense. Can we agree on something better for this year’s terms?\n', mid='<vases2021@example.org>')
add(T(2021,2,3,16,20), CL, ME, 'Re: broken vases, December', 'Hello,\n\nwe agree. From the new terms on we credit breakage in transit in full when you report it with photos within a week. You keep the broken items until we confirm. I will send the new terms in March.\n', reply='<vases2021@example.org>')
add(T(2021,3,12,11,2), CL, ME, 'Terms 2021 (PDF)', 'Hello,\n\nattached are the new terms of delivery from 1 April 2021, as we discussed in February. Clause 6 covers breakage.\n\nBest regards,\nClearline Glass', att=('clearline-terms-2021.pdf', 'Clearline terms 2021.pdf'))
add(T(2023,5,8,13,30), ('Sales', ME), CL[1], 'Two jars broken in delivery 5/2023', 'Hello,\n\ntwo jars came broken today, photos attached. Credit as per our terms, please.\n')
add(T(2023,5,9,9,15), CL, ME, 'Re: Two jars broken in delivery 5/2023', 'Credited on the next invoice. Thank you for the photos.\n')
msgs.sort(key=lambda x: x[0])
mbp = os.path.join(W, 'sales-2014-2024.mbox')
if os.path.exists(mbp): os.remove(mbp)
mb = mailbox.mbox(mbp); mb.lock()
for _, m in msgs: mb.add(m)
mb.flush(); mb.unlock()

# ---- the index, as the agent's script builds it
db = os.path.join(W, 'index.sqlite')
if os.path.exists(db): os.remove(db)
con = sqlite3.connect(db)
con.execute("create virtual table mail using fts5(mid unindexed, date unindexed, sender, subject, body, source unindexed, tokenize='porter unicode61')")
t0 = time.time(); n = 0; npdf = 0; pages = 0
for key, m in mailbox.mbox(mbp).iteritems():
    dt = parsedate_to_datetime(m['Date']).strftime('%Y-%m-%d')
    body = ''
    for part in m.walk():
        if part.get_content_type() == 'text/plain' and not part.get_filename(): body += part.get_payload(decode=True).decode()
        elif part.get_content_type() == 'application/pdf':
            npdf += 1; fn = part.get_filename()
            txt = subprocess.run(['pdftotext', '-layout', '-', '-'], input=part.get_payload(decode=True), capture_output=True).stdout.decode()
            for i, pg in enumerate(txt.split('\f')):
                if pg.strip():
                    pages += 1
                    con.execute('insert into mail values (?,?,?,?,?,?)', (key, dt, m['From'], m['Subject'], re.sub(r'\s+', ' ', pg), '%s, page %d' % (fn, i + 1)))
    con.execute('insert into mail values (?,?,?,?,?,?)', (key, dt, m['From'], m['Subject'], body, 'mail'))
    n += 1
con.commit()
idx = dict(messages=n, pdfs=npdf, pages=pages, seconds=round(time.time() - t0, 1), mbox_mb=round(os.path.getsize(mbp) / 1e6, 1))

q = '(glass OR clearline) AND (breakage OR broken OR damaged)'
# one row per message: its best-ranked hit (the mail itself or a page of an attachment), newest first
rows = con.execute("select mid, date, sender, subject, source, snippet(mail, 4, '[', ']', '…', 16), bm25(mail) b from mail where mail match ? order by b", (q,)).fetchall()
best = {}
for r in rows: best.setdefault(r[0], r)
res = [dict(date=r[1], sender=re.sub(r' <.*', '', r[2]), subject=r[3], source=r[4], snippet=r[5]) for r in sorted(best.values(), key=lambda r: r[1], reverse=True)]
hits = len(rows)
p3 = subprocess.run(['pdftotext', '-f', '3', '-l', '3', os.path.join(W, 'clearline-terms-2021.pdf'), '-'], capture_output=True).stdout.decode()

# ---- the lease comparison
def clauses(pdf):
    t = subprocess.run(['pdftotext', pdf, '-'], capture_output=True).stdout.decode()
    t = re.sub(r'\s+', ' ', t.replace('\f', ' '))
    parts = re.split(r' (?=\d{1,2}\. [A-Z][a-z]+(?: [a-z]+)* |Signed on )', t)
    return parts
a = clauses(os.path.join(W, 'lease-2026.pdf')); b = clauses(os.path.join(W, 'lease-2027.pdf'))
for name, cs in (('lease-2026.txt', a), ('lease-2027.txt', b)): open(os.path.join(W, name), 'w').write('\n'.join(c.strip() for c in cs) + '\n')
gd = subprocess.run(['git', 'diff', '--no-index', '--word-diff=plain', '-U0', 'lease-2026.txt', 'lease-2027.txt'], cwd=W, capture_output=True).stdout.decode()
sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
out = []
def words(x, y):
    xs, ys = x.split(' '), y.split(' ')
    segs = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, xs, ys, autojunk=False).get_opcodes():
        if op == 'equal': segs.append(['=', ' '.join(xs[i1:i2])])
        else:
            if i2 > i1: segs.append(['-', ' '.join(xs[i1:i2])])
            if j2 > j1: segs.append(['+', ' '.join(ys[j1:j2])])
    return segs
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op == 'equal':
        for x in a[i1:i2]: out.append([['=', x]])
    elif op == 'replace' and i2 - i1 == j2 - j1:
        for x, y in zip(a[i1:i2], b[j1:j2]): out.append(words(x, y))
    else:
        for x in a[i1:i2]: out.append([['-', x]])
        for y in b[j1:j2]: out.append([['+', y]])
pages = lambda f: subprocess.run(['pdfinfo', f], capture_output=True).stdout.decode().split('Pages:')[1].split()[0]
json.dump(dict(index=idx, query=q, hits=hits, results=res, worddiff=gd, page3=p3, lease=out, pages=[pages(os.path.join(W, 'lease-2026.pdf')), pages(os.path.join(W, 'lease-2027.pdf'))]), open(os.path.join(W, 'out.json'), 'w'), indent=1, ensure_ascii=False)
`;
writeFileSync(join(work, 'work.py'), py);
execFileSync('python3', ['-I', join(work, 'work.py'), work], { stdio: 'inherit' });

// ---------------------------------------------------------------- picture: page 3 of the 2021 terms, the sentence marked
const terms = join(work, 'clearline-terms-2021.pdf');
const DPI = 200; // A4 at 200 dpi = 1654 x 2339 px
execFileSync('pdftoppm', ['-f', '3', '-l', '3', '-r', String(DPI), '-png', '-singlefile', terms, join(work, 'p3')]);
const bbox = execFileSync('pdftotext', ['-f', '3', '-l', '3', '-bbox', terms, '-']).toString();
const words = [...bbox.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</g)].map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4], w: m[5] }));
const seq = 'Breakage in transit is credited in full when reported with photos within 7 days of delivery.'.split(' ');
const at = words.findIndex((w, i) => seq.every((s, k) => words[i + k]?.w === s));
if (at < 0) throw new Error('clause sentence not found on page 3');
const hit = words.slice(at, at + seq.length);
const k = DPI / 72;
// one marker rectangle per text line of the sentence
const lines = [];
for (const w of hit) { const l = lines.find((L) => Math.abs(L.y0 - w.y0) < 2); if (l) { l.x1 = Math.max(l.x1, w.x1); l.x0 = Math.min(l.x0, w.x0); } else lines.push({ ...w }); }
const draw = lines.map((l) => `rectangle ${Math.round(l.x0 * k) - 6},${Math.round(l.y0 * k) - 3} ${Math.round(l.x1 * k) + 6},${Math.round(l.y1 * k) + 3}`).join(' ');
// Crop to clause 6 alone, margin to margin, so the page reads at the size of the view.
const hi = words.findIndex((w) => w.w === '6');
const end = words.findIndex((w, i) => i > hi && w.w === 'invoice.');
const col = words.slice(hi, end + 1).filter((w) => w.x0 < words[hi].x0 + 230); // the left column only
const textX0 = Math.min(...col.map((w) => w.x0));
const textX1 = Math.max(...col.map((w) => w.x1));
const cx = Math.round(textX0 * k) - 40, cy = Math.round(words[hi].y0 * k) - 26;
const cw = Math.round(textX1 * k) + 40 - cx, ch = Math.round(words[end].y1 * k) + 30 - cy;
execFileSync('convert', [join(work, 'p3.png'),
  '(', '+clone', '-fill', 'white', '-colorize', '100', '-fill', 'rgb(255,226,128)', '-stroke', 'none', '-draw', draw, ')', '-compose', 'multiply', '-composite',
  '-crop', `${cw}x${ch}+${cx}+${cy}`, '+repage', '-resize', '1200x>', '-quality', '82', '-define', 'webp:method=6', join(out, 'terms-2021-p3.webp')]);
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', join(out, 'terms-2021-p3.webp')]).toString().trim());
const res = JSON.parse(readFileSync(join(work, 'out.json')));
console.log(JSON.stringify({ index: res.index, results: res.results.length, pages: res.pages }));
