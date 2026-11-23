// Alice · 08:34 · Northside prices. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, drafts, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-02-northside-prices',
  kind: 'glimpse',
  day: 'alice',
  s: 'prices',
  at: '08:34',
  ask: 'Run last week’s margin check on Bob’s new price list.',
  did: 'Last week Alice and her agent wrote a small program that checks a supplier’s prices against the shop’s own. It is still in her folder, and today it runs on the new list from the tram.',
  screen: () => screen('Northside prices', you('08:30', 'Run last week’s margin check on Bob’s new price list.') + turn({ tools: [
        tool('bash', 'git log --oneline -- tools/margin_check.py', '3f2d1aa  12 Nov  Add margin check for supplier price lists'),
        tool('bash', 'gog gmail attachment "Northside price list 2027"', 'saved inbox/northside-prices-2027.xlsx · 148 rows'),
        tool('bash', 'python3 tools/margin_check.py inbox/northside-prices-2027.xlsx', '148 products · 144 at 40 % or more\nunder 40 %: 4'),
      ], time: '4 min 44 s', reply: 'Four products fall under your 40 % margin at Northside’s new prices:\n\n| Product | Cost | Price | Margin |\n|---|---|---|---|\n| Linen tote | €14.20 | €22 | 35 % |\n| Apron, indigo | €24.50 | €39 | 37 % |\n| Tea towels, 2 | €11.80 | €19 | 38 % |\n| Napkins, 4 | €17.10 | €28 | 39 % |' }) + you('09:15', 'Send Bob that table and ask what Northside says.') + turn({ reply: 'Sent from your mailbox.', extra: drafts([['sent', 'Bob', 'Northside 2027: four products under 40 %', 'Hi Bob, the margin check flags four products…']]) })),
};
