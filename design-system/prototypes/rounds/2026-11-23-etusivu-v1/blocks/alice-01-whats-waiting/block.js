// Alice · 08:04 · What’s waiting today. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-01-whats-waiting',
  kind: 'glimpse',
  day: 'alice',
  s: 'today',
  at: '08:04',
  ask: 'What’s waiting for me today?',
  did: 'Her agent reads the notes she left in her folder yesterday, her mail since then and today’s calendar, and puts them on one screen.',
  screen: () => screen('What’s waiting today', you('08:02', 'What’s waiting for me today?') + turn({ tools: [
        tool('read', 'notes/open.md', '- [ ] December newsletter: everyone who bought this year\n- [ ] Market video from Saturday’s clips\n- [ ] Returns go to 30 days on 1 Dec: handbook and site'),
        tool('bash', 'gog gmail search "newer_than:1d"', '14 messages\n07:31  Bob     Northside price list 2027 (xlsx)\n06:50  Kirsi   October: receipts missing for 26 card charges\n…'),
        tool('bash', 'gog calendar events --today', '10:15 Planning with Bob and Carol (record it)\n15:40 Packing with Bob'),
      ], time: '2 min 07 s', reply: 'Five things today:\n\n1. **Receipts.** Kirsi needs them for 26 October card charges by Friday.\n2. **Northside’s new price list** from Bob, 07:31.\n3. **The market video** from Saturday’s clips.\n4. **Returns go to 30 days** on 1 December; the handbook and the site still say 14.\n5. **Planning at 10:15** with Bob and Carol.\n\nThe December newsletter is still open from yesterday.' })),
};
