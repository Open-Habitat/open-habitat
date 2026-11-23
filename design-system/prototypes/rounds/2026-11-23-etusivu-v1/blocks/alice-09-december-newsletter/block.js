// Alice · 14:30 · December newsletter. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, offer, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const newsMock = () => `<div class="nl"><p class="nl-from">Example Studio <span>example.org/shop</span></p><div class="nl-img" aria-hidden="true"></div><b class="nl-h">Twelve days of linen</b><p>Our winter prints are on the shelves: indigo, rust and a new forest green, printed by hand in the studio.</p><p>Returns are now 30 days, so a gift can wait under the tree.</p><span class="nl-btn">See the winter prints</span><p class="nl-foot">You get this because you bought from us in 2026. Unsubscribe.</p></div>`;

export default {
  id: 'alice-09-december-newsletter',
  kind: 'glimpse',
  day: 'alice',
  s: 'newsletter',
  at: '14:30',
  ask: 'Draft the December newsletter for everyone who bought from us this year.',
  did: 'While the agent counts buyers, Alice changes her mind and adds a message; it takes it on board at the next step. The photos are the ones Carol’s agent cut out an hour ago. Every number comes from the order file, and the recipient list says who was left out and why. Nothing is sent until she says so.',
  screen: () => screen('December newsletter', you('14:05', 'Draft the December newsletter for everyone who bought from us this year.') + you('14:08', 'Leave out the wholesale shops, they get their own letter.', '', 'Sent while it worked · taken on board at the next step') + turn({ tools: [
        tool('bash', 'python3 newsletter/recipients.py orders/2026.csv', '512 buyers in 2026\n− 61 unsubscribed\n−  9 duplicates (same address, different case)\n− 56 wholesale shops\n= 386 → newsletter/recipients.csv'),
        tool('write', 'newsletter/2026-12.html', '1 page · 2 photos from team/photos/winter (Carol, today 13:20)'),
      ], time: '22 min 28 s', reply: 'A draft for **386 people** is open beside this. *recipients.csv* lists them, and the 126 left out with the reason for each. Nothing has been sent; say when.', extra: offer('recipients.csv', '386 recipients + 126 left out · 41 KB') }), view('2026-12.html', newsMock())),
};
