// Alice · 08:41 · October receipts. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-03-october-receipts',
  kind: 'glimpse',
  day: 'alice',
  s: 'receipts',
  at: '08:41',
  ask: 'Find the receipts for October’s card charges and file them for Kirsi.',
  did: 'It reads the card statement, searches every email since late September for attachments, matches each charge by amount and date in a short program, and files the receipts under one naming rule. Three it cannot find, so it asks.',
  screen: () => screen('October receipts', you('08:12', 'Find the receipts for October’s card charges and file them for Kirsi.', att('statement-2026-10.pdf', 'Card statement · 2 pages')) + turn({ tools: [
        tool('bash', 'pdftotext statement-2026-10.pdf -', '26 charges · €2,914.60'),
        tool('bash', 'gog gmail search "has:attachment after:2026/09/25" --all', '1,284 messages · 212 with a PDF or image attached'),
        tool('write', 'bookkeeping/match_receipts.py', '48 lines'),
        tool('bash', 'python3 bookkeeping/match_receipts.py', 'matched 23 of 26 (amount, and date within 3 days)\nsaved bookkeeping/2026-10/2026-10-03 Paper Mill Supply 184.20.pdf\n… 22 more\nnot found: 3'),
      ], time: '29 min 29 s', reply: '**23 of 26** are in *bookkeeping/2026-10*, named date, vendor, amount. Not in your mail:\n\n| Date | Charge | Amount |\n|---|---|---|\n| 6 Oct | Northside Packaging | €230.00 |\n| 14 Oct | City parking | €12.60 |\n| 28 Oct | Fjord Fonts | €49.00 |\n\nDo you know where these are?' })),
};
