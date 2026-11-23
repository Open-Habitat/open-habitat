// Alice · 08:41 · October receipts. Morning: the card statement against her
// mail, matched by a short program and filed for Kirsi; three questions back.
// The same conversation continues at lunch in ../alice-07-lunch-phone.
// Every output on this screen is the real output of assets.mjs, which builds
// Alice's October (statement, mail, receipts) and runs these commands on it.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, thought, turn, screen, md, esc, FILE_IC, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// The program the agent writes; assets.mjs runs exactly this text.
export const MATCHER = String.raw`
"""Match October's card charges to receipts in saved mail, and file them.

Usage: match_receipts.py [--mail DIR] [--only VENDOR]
Reads statement.txt (pdftotext -layout of the card statement) and every .eml
under DIR, finds the total and date on each PDF attachment, and pairs a
charge with a receipt of the same amount dated within three days of it.
Matches are copied to bookkeeping/2026-10/ as "date vendor amount.pdf".
"""
import argparse, email, re, shutil, subprocess, tempfile
from datetime import date, timedelta
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--mail", default="mail/raw")
ap.add_argument("--only")
args = ap.parse_args()
OUT = Path("bookkeeping/2026-10")
LINE = re.compile(r"^\s*(\d\d)\.(\d\d)\.\s+(.+?)\s{2,}(\d+\.\d\d)\s*$")
TOTAL = re.compile(r"(?:TOTAL|Total|Amount due)\D*?(\d+[.,]\d\d)")
DATED = re.compile(r"(20\d\d)-(\d\d)-(\d\d)")

charges = [(date(2026, int(m[2]), int(m[1])), m[3].strip(), m[4])
           for m in map(LINE.match, Path("statement.txt").read_text().splitlines()) if m]
if args.only:
    charges = [c for c in charges if c[1] == args.only]

receipts, seen = [], 0
tmp = Path(tempfile.mkdtemp())
for eml in sorted(Path(args.mail).expanduser().rglob("*.eml")):
    msg = email.message_from_bytes(eml.read_bytes())
    for part in msg.walk():
        if part.get_content_type() != "application/pdf":
            continue
        seen += 1
        pdf = tmp / f"{seen}.pdf"
        pdf.write_bytes(part.get_payload(decode=True))
        text = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
        total, day = TOTAL.search(text), DATED.search(text)
        if total and day:
            receipts.append((date(*map(int, day.groups())), total[1].replace(",", "."), pdf, part.get_filename()))

print(f"{len(charges)} charge(s) · {seen} PDFs read · {len(receipts)} with a total and a date")
OUT.mkdir(parents=True, exist_ok=True)
missing = []
for day, vendor, amount in charges:
    near = [r for r in receipts if r[1] == amount and abs(r[0] - day) <= timedelta(days=3)]
    if not near:
        missing.append((day, vendor, amount))
        continue
    best = min(near, key=lambda r: abs(r[0] - day))
    receipts.remove(best)
    name = f"{day} {vendor} {amount}.pdf"
    shutil.copy(best[2], OUT / name)
    print(f"  ✓ {name:<44} ← {best[3]}")
print(f"filed {len(charges) - len(missing)} of {len(charges)}")
for day, vendor, amount in missing:
    print(f"  ? {day} {vendor} {amount}: no receipt of this amount within 3 days")
`;

// What the screen shows each command printing. `run` is the local command
// assets.mjs runs when the shown one reads Alice's mail account.
export const RUNS = {
  statement: { cmd: 'pdftotext -layout statement-2026-10.pdf statement.txt && cat -s statement.txt | head -9', out: "Harbour Savings Bank\nBusiness card statement · October 2026\nExample Studio · card **** 4417\n\nDate        Merchant                         EUR\n\n02.10.      Paper Mill Supply              184.20\n02.10.      Parcel Post                     36.40\n03.10.      Hostbay                         19.00" },
  search: { cmd: "gog gmail search --all --json -- 'after:2026/09/25' > mail/index.json && jq -r '\"\\(length) messages, \\(map(select(.attachments > 0)) | length) with attachments\"' mail/index.json", run: "jq -r '\"\\(length) messages, \\(map(select(.attachments > 0)) | length) with attachments\"' mail/index.json", out: "1284 messages, 212 with attachments" },
  fetch: { cmd: 'jq -r \'.[] | select(.attachments > 0) | .id\' mail/index.json | while read -r id; do gog gmail get "$id" --format raw > "mail/raw/$id.eml"; done; ls mail/raw | wc -l', run: 'ls mail/raw | wc -l', out: "212" },
  match: { cmd: 'python3 bookkeeping/match_receipts.py', out: "26 charge(s) · 128 PDFs read · 91 with a total and a date\n  ✓ 2026-10-02 Paper Mill Supply 184.20.pdf      ← invoice-PA-13352.pdf\n  ✓ 2026-10-02 Parcel Post 36.40.pdf             ← receipt-960276.pdf\n  ✓ 2026-10-03 Hostbay 19.00.pdf                 ← invoice-HO-80779.pdf\n  ✓ 2026-10-05 Inkwell Print Co. 412.80.pdf      ← invoice-IN-80732.pdf\n  ✓ 2026-10-07 Mailtide 29.00.pdf                ← invoice-MA-23111.pdf\n  ✓ 2026-10-08 Harbour Market 45.00.pdf          ← receipt-844181.pdf\n  ✓ 2026-10-09 Parcel Post 52.10.pdf             ← receipt-938715.pdf\n  ✓ 2026-10-10 Brightline Rail 38.60.pdf         ← ticket-BR-89408.pdf\n  ✓ 2026-10-12 Kettle & Crumb 23.40.pdf          ← receipt-495567.pdf\n  ✓ 2026-10-13 Ribbon & Reel 67.90.pdf           ← invoice-RI-61337.pdf\n  ✓ 2026-10-15 Cloudnote 9.99.pdf                ← invoice-CL-53717.pdf\n  ✓ 2026-10-16 Inkwell Print Co. 96.00.pdf       ← invoice-IN-60787.pdf\n  ✓ 2026-10-17 Parcel Post 41.75.pdf             ← receipt-474553.pdf\n  ✓ 2026-10-19 Linen & Loom 318.00.pdf           ← invoice-LI-91860.pdf\n  ✓ 2026-10-20 Hostbay 14.00.pdf                 ← invoice-HO-21542.pdf\n  ✓ 2026-10-21 Studio Lightworks 129.00.pdf      ← invoice-ST-80421.pdf\n  ✓ 2026-10-22 Parcel Post 47.30.pdf             ← receipt-928653.pdf\n  ✓ 2026-10-23 Brightline Rail 38.60.pdf         ← ticket-BR-69252.pdf\n  ✓ 2026-10-24 Harbour Market 45.00.pdf          ← receipt-878558.pdf\n  ✓ 2026-10-26 Desk & Drawer 58.45.pdf           ← invoice-DE-48540.pdf\n  ✓ 2026-10-27 Parcel Post 63.20.pdf             ← receipt-199550.pdf\n  ✓ 2026-10-29 Sunday Bakery 31.80.pdf           ← receipt-698201.pdf\n  ✓ 2026-10-30 Kiln Street Frames 154.00.pdf     ← invoice-KI-43685.pdf\nfiled 23 of 26\n  ? 2026-10-06 Northside Packaging 230.00: no receipt of this amount within 3 days\n  ? 2026-10-14 City parking 12.60: no receipt of this amount within 3 days\n  ? 2026-10-28 Fjord Fonts 49.00: no receipt of this amount within 3 days" },
  vendors: { cmd: 'jq -r \'.[] | select(.from | test("northside|fjordfonts|parking")) | "\\(.date)  \\(.from)  \\(.subject)"\' mail/index.json | sort', out: "2026-10-01  news@fjordfonts.example.org  New from Fjord Fonts\n2026-10-09  sales@northside.example.org  Price list 2027\n2026-10-15  news@fjordfonts.example.org  New from Fjord Fonts\n2026-10-29  news@fjordfonts.example.org  New from Fjord Fonts\n2026-11-12  news@fjordfonts.example.org  New from Fjord Fonts" },
  fjord: { cmd: 'python3 bookkeeping/match_receipts.py --mail ~/Mail/info --only "Fjord Fonts"', run: 'python3 bookkeeping/match_receipts.py --mail Mail/info --only "Fjord Fonts"', out: "1 charge(s) · 1 PDFs read · 1 with a total and a date\n  ✓ 2026-10-28 Fjord Fonts 49.00.pdf             ← FF-10291.pdf\nfiled 1 of 1" },
};

// The receipts the matcher filed, read from its own output.
export const filed = () => RUNS.match.out.split('\n').filter((l) => l.includes('✓')).map((l, i) => {
  const [, name, from] = l.match(/✓ (.+?\.pdf)\s+← (.+)$/);
  const [, d, vendor, amount] = name.match(/^(\S+) (.+) (\d+\.\d\d)\.pdf$/);
  return { name, d, vendor, amount, from, thumb: `r${String(i + 1).padStart(2, '0')}.webp` };
});

const eur = (n) => `€${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;

// The folder the receipts went into, as a file list with each receipt's first page.
const FOLDER_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>';
export function folder({ rows = 6, compact = false } = {}) {
  const f = filed();
  const sum = f.reduce((a, r) => a + Number(r.amount), 0);
  const row = (r) => `<li><img src="${asset(r.thumb)}" alt="" width="36" height="46" loading="lazy" decoding="async"><span class="rc-n"><span class="rc-f">${esc(r.d)} <b>${esc(r.vendor)}</b> ${esc(r.amount)}.pdf</span><small>from ${esc(r.from)}</small></span><span class="rc-a">${eur(r.amount)}</span></li>`;
  return `<div class="rc-folder${compact ? ' rc-compact' : ''}" data-rc-folder><p class="rc-h">${FOLDER_IC}<span class="rc-path"><span class="rc-pre">bookkeeping/</span><b>2026-10</b></span><span class="rc-meta">${f.length} receipts · ${eur(sum.toFixed(2))}</span></p><ul class="rc-list">${f.slice(0, rows).map(row).join('')}</ul>${f.length > rows ? `<ul class="rc-list rc-more" hidden>${f.slice(rows).map(row).join('')}</ul><button type="button" class="rc-toggle" aria-expanded="false" data-show="Show all ${f.length}" data-hide="Show fewer">Show all ${f.length}</button>` : ''}</div>`;
}

const QUESTIONS = `Three charges have no receipt anywhere in your mail:

1. **Northside Packaging, €230.00, 6 Oct.** The only mail from them is next year’s price list. Did someone else order this?
2. **City parking, €12.60, 14 Oct.** Nothing from the parking company at all. File it without a receipt?
3. **Fjord Fonts, €49.00, 28 Oct.** Only their newsletter reaches you. Do their invoices go to another address?`;

export default {
  id: 'alice-03-october-receipts',
  kind: 'glimpse',
  day: 'alice',
  s: 'receipts',
  at: '08:41',
  ask: 'Find the receipts for October’s card charges and file them for Kirsi.',
  did: 'Twenty-six charges, a month of mail. It writes a short program that pairs each charge with a receipt of the same amount from the same few days, and runs it. Twenty-three receipts land in Kirsi’s folder, each named by date, vendor and amount. For the last three it asks Alice exactly what it needs.',
  screen: () => screen('October receipts',
    you('08:12', 'Find the receipts for October’s card charges and file them for Kirsi.', att('statement-2026-10.pdf', 'Card statement · 1 page')) +
    turn({
      thoughts: [thought('Shop names on a card statement rarely match the sender of the receipt. Match on amount and date, and keep the vendor from the statement.')],
      tools: [
        tool('bash', RUNS.statement.cmd, RUNS.statement.out),
        tool('bash', RUNS.search.cmd, RUNS.search.out),
        tool('bash', RUNS.fetch.cmd, RUNS.fetch.out),
        tool('write', 'bookkeeping/match_receipts.py', MATCHER.trim(), `new · ${MATCHER.trim().split('\n').length} lines`),
        tool('bash', RUNS.match.cmd, RUNS.match.out),
        tool('bash', RUNS.vendors.cmd, RUNS.vendors.out),
      ],
      time: '29 min 29 s',
      reply: `**${filed().length} of 26** receipts are in Kirsi’s folder, each named date, vendor, amount.`,
      extra: folder() + `<div class="ah-prose rc-q">${md(QUESTIONS)}</div>`,
    })),
};
