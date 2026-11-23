// Alice · 13:35 · Returns: 30 days. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, tool, turn, workers, diff, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const returnsView = () => `<ul class="files">${[['site/faq.md', 6, 3], ['site/terms.md', 2, 2], ['handbook/shop/returns.md', 4, 4], ['handbook/online/gifts.md', 3, 1], ['handbook/online/wholesale.md', 1, 1], ['… 12 more', 19, 14]].map(([f, a, d]) => `<li><span>${esc(f)}</span><b class="fa">+${a}</b><b class="fd">−${d}</b></li>`).join('')}</ul>${diff('site/faq.md', ['- You can return anything within 14 days.', '+ You can return anything within 30 days of delivery.', '+ Sale items too: the same 30 days apply.', '+ A gift can be returned by the person who received it.'])}`;

export default {
  id: 'alice-08-returns-workers',
  kind: 'glimpse',
  day: 'alice',
  s: 'returns',
  at: '13:35',
  ask: 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.',
  did: 'She asked just before the meeting. The agent finds 17 pages that mention returns and splits the work. One worker reads every return question customers mailed this year; three each rewrite one part, starting fresh with only their own pages; a fifth, on a different model, checks every change against the policy and the real questions and sends two back. Alice talks to one agent the whole time.',
  screen: () => screen('Returns: 30 days', you('10:10', 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.') + turn({ tools: [
        tool('bash', 'grep -ril "return" handbook/ site/', '17 files'),
        tool('read', 'workers/checker/report.md', '1. site/faq.md still says “14 days” for sale items → back to Site, fixed\n2. handbook/online/gifts.md contradicts the gift rule → back to Online orders, fixed\n3 customer questions that no page answered now have answers'),
      ], time: '3 h 25 min', summary: '2 tools · 5 workers', reply: '**17 pages updated** on the branch *returns-30-days*. The checker found two contradictions and the workers fixed them. Three questions customers kept asking (sale items, gifts, exchanges) now have answers in the FAQ.\n\nThe changes are open beside this conversation. Merge them?', panel: workers([['done', 'Mail', '212 return questions since January', '1-page report'], ['done', 'Shop floor', 'handbook/shop · 6 pages', '6 changed'], ['done', 'Online orders', 'handbook/online · 7 pages', '7 changed'], ['done', 'Site', 'site/faq, site/terms · 4 pages', '4 changed'], ['done', 'Checker', 'every change against policy and mail', '2 sent back']]) }), view('returns-30-days · 17 files', returnsView())),
};
