// Capabilities: Paper and files. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { MIC_IC, you, att, tool, turn, diff, screen, view } from '../../engine/kit.mjs';
import { sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const leaseMock = () => `<div class="lease">${diff('lease-2027.pdf vs lease-2026.pdf', ['  § 3 Rent: €1,850 a month', '- § 7 Notice period: three (3) months', '+ § 7 Notice period: six (6) months', '- § 9 Rent review each January by the index', '+ § 9 Rent review each January by the index, at least 2 %', '  § 11 The tenant may sublet with written consent', '+ § 14 Signage on the facade needs approval'])}<p class="lease-n">4 differences · 11 pages each · nothing else changed</p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [6, 'paper', 'A binder of scanned papers into a searchable archive', 'OCRmyPDF, Tesseract', 'Frank', 'Example Studio', 'Thirty years of board minutes, scanned on the office copier.', '1,400 pages as searchable, dated files; the 2009 decision on balcony glazing is found by typing “balcony”.'],
  [8, 'paper', 'A whole folder searchable, by meaning too', 'ripgrep-all, SQLite FTS5, sqlite-vec', 'Frank', 'Example Studio', 'Which of these forty papers measured lightfastness of indigo on linen?', 'Six papers, with the page and paragraph in each, including two that call it “fading under light”.'],
  [26, 'paper', 'Personal details redacted so they cannot be recovered', 'PyMuPDF', 'Dave', 'Example Studio', 'A resident asks for the minutes about her flat, without other residents’ details.', 'Eleven documents with 64 redactions and a list of each; two restored that were not personal data.'],
  [27, 'paper', 'Tables out of PDF reports and scanned price lists', 'Camelot, Docling', 'Kirsi', 'Example Studio', 'Fjord Paper’s new price list is a 60-page PDF. Which of our items went up more than 5 %?', '1,900 rows extracted and matched to the old list; 43 items with old price, new price and the change.'],
  [30, 'paper', 'Two versions of a contract: what changed', 'LibreOffice, diff-pdf', 'Alice', 'Example Studio', 'The landlord sent the renewed lease. What is different from last year’s?', 'Four differences; one moves the notice period from three months to six.'],
  [42, 'paper', 'A hundred Word files to PDF, old formats brought up to date', 'LibreOffice', 'Frank', 'Example Studio', 'The grant needs nineteen attachments as PDF; I have Word, Excel and PowerPoint files from five people.', 'Nineteen PDFs, numbered and named as the application form lists them.'],
  [43, 'paper', 'Stacks of PDFs merged, split, filled and protected', 'pypdf, qpdf', 'Kirsi', 'Example Studio', 'The bank wants last year’s statements, the budget and the VAT returns as one protected file.', 'One PDF assembled from eleven files, page-numbered, bookmarked and protected with the password the bank asked for.'],
  [52, 'paper', 'PDFs signed and stamped electronically', 'pyHanko', 'Kirsi', 'Example Studio', 'Stamp this month’s approved purchase invoices with the approver and the date.', '340 invoices stamped from the approval list.'],
  [54, 'paper', 'Backups, cloud folder sync and encrypted hand-over', 'restic, rclone, age', 'Kirsi', 'Example Studio', 'The payroll data has to go to the payroll office safely.', 'The file encrypted for the payroll office’s key and placed in the shared folder.'],
  [55, 'paper', 'An old mailbox as a searchable archive', 'notmuch, Docling', 'Bob', 'Example Studio', 'What did we agree with the glass supplier about breakage? It’s somewhere in my predecessor’s mail.', '48,000 messages indexed; the answer is a 2021 email and its attached terms, page 3.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-paper',
  kind: 'caps',
  group: { id: 'paper', name: "Paper and files", line: "Binders, PDFs and old mailboxes become something you can ask." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [55, 30],
  full: {
    55: () => capScreen(55, 'Glass breakage terms', you('10:10', capOf[55][6], '', `${MIC_IC}Dictated`) + turn({ tools: [
        tool('bash', 'notmuch new  # archive/mail-2014-2024', '48,112 messages indexed'),
        tool('bash', 'notmuch search "glass AND (breakage OR broken)"', '14 threads · the 2021 terms attached as PDF'),
        tool('read', 'Clearline terms 2021.pdf, page 3', '“Breakage in transit is credited in full when reported with photos within 7 days.”'),
      ], reply: '**Full credit for breakage in transit, if reported with photos within 7 days.** That is in Clearline’s 2021 terms, page 3, attached to an email of 12 March 2021.' }), view('notmuch · glass breakage', sheetMock('14 threads', ['Date', 'From', 'Subject'], [['12 Mar 2021', 'Clearline', 'Terms 2021 (PDF)'], ['3 Feb 2021', 'Clearline', 'Re: broken vases, December'], ['18 Nov 2019', 'Clearline', 'Breakage claim #2231']], '… 11 more · 48,112 messages searched'))),
    30: () => capScreen(30, 'Lease renewal', you('09:20', capOf[30][6], att('lease-2027.pdf', 'PDF · 11 pages')) + turn({ tools: [
        tool('bash', 'pdftotext lease-2026.pdf; pdftotext lease-2027.pdf; diff …', '4 changed clauses'),
      ], reply: '**Four differences.** The one to look at: the notice period goes from **three months to six** (§ 7). The rent review now has a 2 % floor, and the facade sign needs approval. Nothing else changed.' }), view('lease-2027 vs lease-2026', leaseMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 6: ['frank', 'notes'], 8: ['frank', 'papers'], 26: ['dave', 'redact'], 27: ['kirsi', 'prices'] },
};
