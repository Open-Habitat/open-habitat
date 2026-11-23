// Alice · 09:44 · Shipping banner. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, diff, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-05-shipping-banner',
  kind: 'glimpse',
  day: 'alice',
  s: 'banner',
  at: '09:44',
  ask: 'Our site says “Free shipping over €30”. Who put that there, and why?',
  did: 'The website lives in a shared folder where every change has an author, a time and a reason. Her agent looks up the change that added the line: it was Bob’s agent, on Bob’s word. She adds an end date, and it publishes when she says yes.',
  screen: () => screen('Shipping banner', you('09:40', 'Our site says “Free shipping over €30”. Who put that there, and why?') + turn({ tools: [
        tool('bash', 'git log -S "Free shipping" -- site/', 'a41c9e2  Tue 17 Nov 16:42  Bob (agent)\n    Add free-shipping banner for Northside week\n    Bob: Northside pays the postage on orders over €30\n    until Sunday 22 Nov. Take it down on Monday.'),
      ], time: '4 min 51 s', reply: '**Bob’s agent added it on Tuesday at 16:42**, at Bob’s request: Northside pays the postage on orders over €30 until Sunday, and Bob wants it down on Monday. The banner itself does not say that it ends.' }) + you('09:47', 'Add “until Sunday” to it.') + turn({ tools: [
        diff('site/_includes/banner.html', ['- Free shipping over €30', '+ Free shipping over €30 until Sunday 22 November']),
      ], time: '2 min 36 s', reply: 'Changed. Publishing pushes it to the shop’s repository on Gitea, and the site updates from there. Publish?' }) + you('09:49', 'Yes.') + turn({ tools: [
        tool('bash', 'git push origin main', 'a41c9e2..5be07d1  main -> main'),
      ], time: '21 s', reply: 'Published.' })),
};
