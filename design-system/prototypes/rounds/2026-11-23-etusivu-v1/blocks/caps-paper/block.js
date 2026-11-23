// Capabilities: Paper and files. The two screens show real work: assets.mjs
// builds the mailbox, its SQLite FTS5 index and the two leases, runs the
// searches and the comparison, and prints the output that HITS, LEASE and the
// tool rows below carry verbatim. The block contract is in ../../BLOCKS.md.
import { MIC_IC, esc, you, att, tool, thought, turn, screen, view, image, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// ---------- The mailbox search (assets.mjs: mailindex search, one row per message, newest first)
const QUERY = '(glass OR clearline) AND (breakage OR broken OR damaged)';
const HITS = [
  ['2023-05-09', 'Clearline Glass', 'Re: Two jars broken in delivery 5/2023', 'mail', 'Credited on the next invoice. Thank you for the photos.'],
  ['2021-03-12', 'Clearline Glass', 'Terms 2021 (PDF)', 'Clearline terms 2021.pdf, page 3', '[CLEARLINE] [GLASS] Terms of delivery 2021 6 [Breakage] and [damage] in transit [Breakage] in transit is…'],
  ['2021-02-03', 'Clearline Glass', 'Re: broken vases, December', 'mail', '…From the new terms on we credit [breakage] in transit in full when you report it…'],
  ['2021-01-11', 'Sales', 'Broken vases, December', 'mail', '…Returning [broken] [glass] at our own cost makes no sense. Can we agree on something better…'],
  ['2019-11-20', 'Clearline Glass', 'Re: Breakage claim #2231', 'mail', 'Hello, under our terms [breakage] is credited at 50 % when the items are returned. We will…'],
  ['2019-02-04', 'Clearline Glass', 'Terms 2019', 'Clearline terms 2019.pdf, page 3', '[CLEARLINE] [GLASS] Terms of delivery 2019 6 [Breakage] and [damage] in transit Items [broken] in transit…'],
];
const ANSWER = 1;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MON[m - 1]} ${y}`; };
const snip = (s) => esc(s).replace(/\[([^\]]+)\]/g, '<mark>$1</mark>');
const CLIP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 4.5 5.3 9.7a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a3 3 0 0 0-4.3-4.3L3.3 7.7a4.4 4.4 0 0 0 6.2 6.2l4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

const mailView = () => `<div class="cp-mail">
  <div class="cp-q"><span class="cp-q-k">Search</span><code>${esc(QUERY)}</code></div>
  <p class="cp-q-n"><b>6 messages</b> of 18,023 · sales@example.org, 2014–2024</p>
  <ol class="cp-hits">${HITS.map(([d, from, subj, src, s], i) => `<li${i === ANSWER ? ' class="is-answer"' : ''}>
    <p class="cp-hit-h"><time datetime="${d}">${day(d)}</time><b>${esc(from)}</b><span>${esc(subj)}</span></p>
    <p class="cp-hit-x">${src === 'mail' ? snip(s) : `<span class="cp-hit-a">${CLIP}${esc(src)}</span>`}</p></li>`).join('')}
  </ol>
  <figure class="cp-page">${image(asset('terms-2021-p3.webp'), 'Clause 6 of Clearline’s 2021 terms of delivery, page 3: breakage in transit is credited in full when reported with photos within 7 days of delivery', 676, 355)}
    <figcaption><b>Clearline terms 2021.pdf</b> · page 3</figcaption></figure>
</div>`;

// ---------- The lease redline (assets.mjs: pdftotext, then a word diff per clause; same changes as git diff --word-diff)
// [clause, title, segments]; a segment is text, ['-', removed] or ['+', added]. kind: 'same' | 'date' | 'change' | 'new'.
const LEASE = [
  ['1', 'Parties', 'same'], ['2', 'Premises', 'same'], ['3', 'Rent', 'same'],
  ['4', 'Term', 'date', ['The lease runs from 1 January ', ['-', '2026'], ['+', '2027'], ' to 31 December ', ['-', '2026'], ['+', '2027'], ' and continues for one year at a time unless either party gives notice under clause 7.']],
  ['5', 'Security deposit', 'change', ['The tenant pays a security deposit equal to ', ['-', 'two'], ['+', 'three'], ' months’ rent before the keys are handed over.']],
  ['6', 'Use of the premises', 'same'],
  ['7', 'Notice period', 'change', ['The notice period is ', ['-', 'three (3)'], ['+', 'six (6)'], ' months for both parties. Notice is given in writing.']],
  ['8', 'Maintenance', 'same'],
  ['9', 'Rent review', 'change', ['The rent is reviewed each January by the change in the cost-of-living ', ['-', 'index.'], ['+', 'index, and rises by at least 2 %.']]],
  ['10', 'Alterations', 'same'], ['11', 'Subletting', 'same'], ['12', 'Insurance', 'same'], ['13', 'Keys', 'same'],
  ['14', 'Signage', 'new', [['+', 'Signs, banners and window lettering on the facade need the landlord’s written approval.']]],
  ['', 'Signed', 'date', ['Signed on ', ['-', '20'], ['+', '14'], ' November ', ['-', '2025.'], ['+', '2026.']]],
];
const segs = (xs) => xs.map((x) => (typeof x === 'string' ? esc(x) : x[0] === '-' ? `<del>${esc(x[1])}</del>` : `<ins>${esc(x[1])}</ins>`)).join('');
const leaseView = () => {
  let n = 0;
  const out = [];
  for (let i = 0; i < LEASE.length; i += 1) {
    const [no, title, kind, body] = LEASE[i];
    if (kind === 'same') {
      const run = [];
      while (i < LEASE.length && LEASE[i][2] === 'same') { run.push(LEASE[i]); i += 1; }
      i -= 1;
      out.push(`<p class="cp-same">${run.map(([c, t]) => `<span>${c}. ${esc(t)}</span>`).join('')}<small>unchanged</small></p>`);
    } else if (kind === 'date') {
      // Dates only (§ 4 term, the signing line): one quiet line; the full redline is in the work.
      const dates = LEASE.filter((c) => c[2] === 'date');
      if (LEASE.indexOf(dates[0]) === i) out.push(`<p class="cp-same is-date">${dates.map(([c, t]) => `<span>${c ? `${c}. ` : ''}${esc(t)}</span>`).join('')}<small>dates: <del>2026</del> <ins>2027</ins></small></p>`);
    } else {
      n += 1;
      out.push(`<section class="cp-cl is-${kind}"><span class="cp-n" aria-label="Change ${n}">${n}</span><h5>${no}. ${esc(title)}${kind === 'new' ? '<small>new clause</small>' : ''}</h5><p>${segs(body)}</p></section>`);
    }
  }
  return `<div class="cp-lease">
  <p class="cp-lease-h"><span><b>lease-2027.pdf</b> against <b>lease-2026.pdf</b></span><span class="cp-key"><del>removed</del><ins>added</ins></span></p>
  <div class="cp-doc"><p class="cp-doc-t">Commercial lease <span>Harbour Lane 4 · <del>2026</del> <ins>2027</ins></span></p>${out.join('')}</div>
  <p class="cp-lease-n">4 changes and the dates · 2 pages each · the rent, €1,850, is unchanged</p>
</div>`;
};

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [6, 'paper', 'A binder of scanned papers into a searchable archive', 'OCRmyPDF, Tesseract', 'Frank', 'Example Studio', 'Thirty years of board minutes, scanned on the office copier.', '1,400 pages as searchable, dated files; the 2009 decision on balcony glazing is found by typing “balcony”.'],
  [8, 'paper', 'A whole folder searchable, by meaning too', 'ripgrep-all, SQLite FTS5, sqlite-vec', 'Frank', 'Example Studio', 'Which of these forty papers measured lightfastness of indigo on linen?', 'Six papers, with the page and paragraph in each, including two that call it “fading under light”.'],
  [26, 'paper', 'Personal details redacted so they cannot be recovered', 'PyMuPDF', 'Dave', 'Example Studio', 'A resident asks for the minutes about her flat, without other residents’ details.', 'Eleven documents with 64 redactions and a list of each; two restored that were not personal data.'],
  [27, 'paper', 'Tables out of PDF reports and scanned price lists', 'Camelot, Docling', 'Kirsi', 'Example Studio', 'Fjord Paper’s new price list is a 60-page PDF. Which of our items went up more than 5 %?', '1,900 rows extracted and matched to the old list; 43 items with old price, new price and the change.'],
  [30, 'paper', 'Two versions of a contract: what changed', 'pdftotext, git diff', 'Alice', 'Example Studio', 'The landlord sent the renewed lease. What is different from last year’s?', 'Every change marked in the lease itself. Four besides the dates, and one doubles the notice period to six months.'],
  [42, 'paper', 'A hundred Word files to PDF, old formats brought up to date', 'LibreOffice', 'Frank', 'Example Studio', 'The grant needs nineteen attachments as PDF; I have Word, Excel and PowerPoint files from five people.', 'Nineteen PDFs, numbered and named as the application form lists them.'],
  [43, 'paper', 'Stacks of PDFs merged, split, filled and protected', 'pypdf, qpdf', 'Kirsi', 'Example Studio', 'The bank wants last year’s statements, the budget and the VAT returns as one protected file.', 'One PDF assembled from eleven files, page-numbered, bookmarked and protected with the password the bank asked for.'],
  [52, 'paper', 'PDFs signed and stamped electronically', 'pyHanko', 'Kirsi', 'Example Studio', 'Stamp this month’s approved purchase invoices with the approver and the date.', '340 invoices stamped from the approval list.'],
  [54, 'paper', 'Backups, cloud folder sync and encrypted hand-over', 'restic, rclone, age', 'Kirsi', 'Example Studio', 'The payroll data has to go to the payroll office safely.', 'The file encrypted for the payroll office’s key and placed in the shared folder.'],
  [55, 'paper', 'An old mailbox as a searchable archive', 'SQLite FTS5, pdftotext', 'Bob', 'Example Studio', 'What did we agree with the glass supplier about breakage? It’s somewhere in my predecessor’s mail.', 'Ten years of mail, 18,023 messages, searched at once. The answer is page 3 of a 2021 attachment, and the history shows how it was agreed.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

const SEARCH_OUT = `${HITS.map(([d, f, s, src]) => `${d}  ${f.padEnd(15)}  ${s}${src === 'mail' ? '' : `  [${src}]`}`).join('\n')}\n\n6 messages (9 hits) of 18,023`;
const P3 = `6 Breakage and damage in transit
Breakage in transit is credited in full when reported with photos within 7 days of delivery. The
buyer keeps the broken items until Clearline confirms the credit. No replacement order is
needed; the credit is deducted from the next invoice.`;
const WORDDIFF = `@@ -5,2 +5,2 @@
4. Term The lease runs from 1 January [-2026-]{+2027+} to 31 December [-2026-]{+2027+} …
5. Security deposit The tenant pays a security deposit equal to [-two-]{+three+} months’ rent …
@@ -8 +8 @@
7. Notice period The notice period is [-three (3)-]{+six (6)+} months for both parties. …
@@ -10 +10 @@
9. Rent review … by the change in the cost-of-living [-index.-]{+index, and rises by at least 2 %.+}
@@ -15 +15,2 @@
{+14. Signage Signs, banners and window lettering on the facade need the landlord’s written approval.+}
Signed on [-20-]{+14+} November [-2025.-]{+2026.+} …`;

export default {
  id: 'caps-paper',
  kind: 'caps',
  group: { id: 'paper', name: 'Paper and files', line: 'Binders, PDFs and old mailboxes become something you can ask.' },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [55, 30],
  full: {
    55: () => capScreen(55, 'Glass breakage terms', you('10:10', capOf[55][6], '', `${MIC_IC}Dictated`) + turn({
      thoughts: [thought('The old mail is one mbox file, ten years of it. A full-text index that also reads the PDF attachments page by page will find an agreement wherever it was written.')],
      tools: [
        tool('write', 'mail/mailindex.py', 'mbox → SQLite FTS5 (porter stemming); PDF attachments through pdftotext, one row per page', 'new'),
        tool('bash', 'python3 mailindex.py index sales-2014-2024.mbox', '18,023 messages · 2 PDF attachments, 8 pages\nindex.sqlite written'),
        tool('bash', `python3 mailindex.py search '${QUERY}'`, SEARCH_OUT),
        tool('bash', "pdftotext -f 3 -l 3 'Clearline terms 2021.pdf' -", P3),
      ],
      time: '1 min 12 s',
      reply: '**Full credit for breakage in transit, reported with photos within 7 days.** No need to send the broken pieces back: keep them until Clearline confirms, and the credit comes off the next invoice. It is clause 6 of Clearline’s 2021 terms, page 3, attached to their email of 12 March 2021.\n\nIt replaced the 2019 terms, which credited only half and only if the glass was returned. Your predecessor negotiated the change after a broken December delivery, and the last claim, in May 2023, was credited that way.',
    }), view('Search · glass breakage', mailView())),
    30: () => capScreen(30, 'Lease renewal', you('09:20', capOf[30][6], att('lease-2027.pdf', 'PDF · 2 pages')) + turn({
      thoughts: [thought('Last year’s signed lease is lease-2026.pdf in Contracts. Comparing the text clause by clause, word by word, shows every change, however small.')],
      tools: [
        tool('bash', 'pdftotext lease-2026.pdf; pdftotext lease-2027.pdf', '2 pages each · 13 and 14 clauses'),
        tool('bash', 'git diff --no-index --word-diff -U0 lease-2026.txt lease-2027.txt', WORDDIFF),
      ],
      time: '38 s',
      reply: '**Four changes besides the dates.** The one to look at is § 7: the notice period goes from **three months to six**. To leave at the end of 2027 you would have to give notice by the end of June.\n\n- § 5: the deposit rises from two months’ rent to three.\n- § 9: the yearly rent review now rises by at least 2 %.\n- § 14 is new: signs on the facade need their written approval.\n\nThe rent, €1,850 a month, and everything else are word for word the same.',
    }), view('lease-2027 against lease-2026', leaseView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 6: ['frank', 'notes'], 8: ['frank', 'papers'], 26: ['dave', 'redact'], 27: ['kirsi', 'prices'] },
};
