// Alice · 15:30 · Returns: 30 days. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, workers, diff, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-10-undo-one-page',
  kind: 'glimpse',
  day: 'alice',
  s: 'returns',
  at: '15:30',
  ask: 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.',
  did: 'Every change the workers made is recorded with what changed, when and why. The agent puts one page back as it was and leaves the other sixteen alone, and the undo is recorded too.',
  screen: () => screen('Returns: 30 days', you('15:30', 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.') + turn({ tools: [
        tool('bash', 'git log --oneline -2 -- handbook/online/wholesale.md', 'c7e01b2  13:55  Returns: 30 days from 1 Dec (worker: Online orders)\n81aa0f4  2 Sep   Wholesale terms 2026'),
        tool('bash', 'git restore --source=81aa0f4 handbook/online/wholesale.md', 'e93b4d0  Wholesale keeps 14-day returns (Bob, 19 Nov)'),
      ], time: '13 s', reply: 'Undone. Wholesale is back to 14 days; the other 16 pages keep the new policy.', extra: diff('handbook/online/wholesale.md', ['- Wholesale orders can be returned within 30 days.', '+ Wholesale orders can be returned within 14 days.']) + `<p class="hist"><span>Recorded 15:31 · e93b4d0</span><button type="button" class="quiet-btn" data-undo>Undo this too</button></p>` })),
};
