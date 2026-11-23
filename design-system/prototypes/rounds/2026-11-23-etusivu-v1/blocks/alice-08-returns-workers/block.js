// Alice · 13:35 · Returns: 30 days. Five workers change the returns policy across
// the site and the handbook; a checker on a second model sends two pages back.
// The block contract is in ../../BLOCKS.md; what changed and why is in NOTES.md.
import { esc, you, tool, thought, turn, workers, screen, view } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';

const ASK = 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.';

// ---------- The review view: one branch, three ways to read it ----------
// The pages each worker changed. [file, added, removed, note]; note 'back' marks
// the two pages the checker sent back (fixed on the second pass).
const BY_WORKER = [
  ['shop-floor', 'w1', [
    ['handbook/shop/returns.md', 4, 4], ['handbook/shop/till.md', 2, 2], ['handbook/shop/exchanges.md', 3, 1],
    ['handbook/shop/receipts.md', 1, 1], ['handbook/shop/gift-cards.md', 2, 1], ['handbook/shop/signs.md', 1, 1],
  ]],
  ['online-orders', 'w2', [
    ['handbook/online/returns.md', 5, 3], ['handbook/online/gifts.md', 4, 2, 'back'], ['handbook/online/wholesale.md', 1, 1],
    ['handbook/online/refunds.md', 3, 2], ['handbook/online/shipping.md', 2, 2], ['handbook/online/sale.md', 2, 1],
    ['handbook/online/emails.md', 4, 3],
  ]],
  ['site', 'w3', [
    ['site/faq.md', 11, 2, 'back'], ['site/terms.md', 2, 2], ['site/shipping.md', 1, 1], ['site/footer.md', 1, 1],
  ]],
];
const ALL = BY_WORKER.flatMap(([, , f]) => f);
const ADDED = ALL.reduce((s, f) => s + f[1], 0);
const REMOVED = ALL.reduce((s, f) => s + f[2], 0);
// Five squares, as a code review draws the size of a change.
const bar = (a, d) => { const n = a + d; const g = Math.round((a / n) * 5); return `<span class="rv-bar" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i class="${i < g ? 'a' : 'd'}"></i>`).join('')}</span>`; };

const filesPanel = () => `<div class="rv-p rv-p-files">${BY_WORKER.map(([w, c, files]) => `<section class="rv-g"><p class="rv-gh"><span class="rv-w ${c}">${esc(w)}</span><small>${files.length} pages</small></p><ul>${files.map(([f, a, d, note]) => `<li><code>${esc(f.replace(/^(handbook\/(shop|online)|site)\//, ''))}</code>${note ? '<span class="rv-back" title="Sent back by the checker, fixed">sent back · fixed</span>' : ''}<b class="rv-a">+${a}</b><b class="rv-d">−${d}</b>${bar(a, d)}</li>`).join('')}</ul></section>`).join('')}</div>`;

// The FAQ as the site worker left it after the checker's second pass. Each new
// answer carries how many customers asked it, from the mail worker's report.
// [old line no., new line no., kind, text, asked?]
const FAQ = [
  ['hunk', '@@ Returns @@'],
  [12, 12, 'ctx', '## How long do I have to return something?'],
  [13, null, 'del', 'You can return anything within <mark>14 days</mark>.'],
  [null, 13, 'add', 'You can return anything within <mark>30 days of delivery</mark>.', 71],
  [null, 14, 'add', 'This applies to every order delivered from 1 December 2026.'],
  [14, 15, 'ctx', ''],
  [null, 16, 'add', '## Can I return a sale item?'],
  [null, 17, 'add', 'Yes. Sale items have the same 30 days.', 38],
  [null, 18, 'add', ''],
  [null, 19, 'add', '## Can someone return a gift I bought them?'],
  [null, 20, 'add', 'Yes, with the gift note. They get store credit.', 27],
  [null, 21, 'add', ''],
  [null, 22, 'add', '## Can I exchange instead?'],
  [null, 23, 'add', 'Yes: another size or colour within the 30 days.', 19],
  [15, 24, 'ctx', '## Who pays the return postage?'],
];
const diffPanel = () => `<div class="rv-p rv-p-diff"><p class="rv-fh"><code>site/faq.md</code><span class="rv-w w3">site</span><b class="rv-a">+11</b><b class="rv-d">−2</b></p><div class="rv-diff" role="table" aria-label="Changes to site/faq.md">${FAQ.map(([o, n, k, t, asked]) => (o === 'hunk'
  ? `<div class="rv-l rv-hunk" role="row"><span role="cell">${esc(n)}</span><span class="rv-q" role="cell">customers asked</span></div>`
  // Text is our own literal markup (only <mark> marks the changed words), so no esc() on it.
  : `<div class="rv-l rv-${k}" role="row"><span class="rv-n" role="cell">${o ?? ''}</span><span class="rv-n" role="cell">${n ?? ''}</span><span class="rv-s" role="cell" aria-hidden="true">${k === 'add' ? '+' : k === 'del' ? '−' : ''}</span><span class="rv-t" role="cell">${t || '&nbsp;'}</span><span class="rv-q" role="cell">${asked ? `<b>${asked}</b>` : ''}</span></div>`)).join('')}</div></div>`;

const checkPanel = () => `<div class="rv-p rv-p-check"><p class="rv-ck-h"><span class="rv-w w4">checker</span><small>a second model · read every change against <code>policy/returns-2026-12.md</code> and the 212 emails</small></p><ol class="rv-ck">
  <li class="no"><b>Round 1</b><span><code>site/faq.md</code> line 24 still said sale items had 14 days.</span><em>back to <span class="rv-w w3">site</span></em></li>
  <li class="no"><span></span><span><code>handbook/online/gifts.md</code> let gifts back “within 14 days of purchase”, against the 30-day gift rule.</span><em>back to <span class="rv-w w2">online-orders</span></em></li>
  <li class="ok"><b>Round 2</b><span>Both pages fixed. All 17 pages agree with the policy, and the three questions no page answered (sale items, gifts, exchanges) now have answers.</span><em>passed</em></li>
</ol></div>`;

const reviewView = () => `<div class="rv" data-view data-state="diff"><p class="rv-top"><span class="rv-br">returns-30-days</span><span class="rv-into">into main</span><span class="rv-sum"><b>${ALL.length}</b> pages <b class="rv-a">+${ADDED}</b> <b class="rv-d">−${REMOVED}</b></span></p>${toggles([['diff', 'site/faq.md'], ['files', `${ALL.length} pages`], ['check', 'Checker']], 'diff')}${diffPanel()}${filesPanel()}${checkPanel()}</div>`;

export default {
  id: 'alice-08-returns-workers',
  kind: 'glimpse',
  day: 'alice',
  s: 'returns',
  at: '13:35',
  ask: ASK,
  did: 'She asked on her way into a meeting. The agent found 17 pages and split the work: one worker read this year’s 212 return emails, three rewrote one part each, and a checker on a second model read every change against the policy and those emails. It sent two pages back. When Alice came out, the work was waiting for her yes, with answers to the three questions customers ask most.',
  screen: () => screen('Returns: 30 days', you('10:10', ASK) + turn({
    interim: {
      thoughts: ['Finding every page that mentions returns, and the emails customers sent about them'],
      tools: [
        tool('bash', 'grep -rli "return" handbook/ site/', 'handbook/shop/      6 pages\nhandbook/online/    7 pages\nsite/               4 pages\n17 pages in all'),
        tool('bash', 'notmuch count tag:returns date:2026-01-01..', '212'),
      ],
      time: '1 min 50 s',
      text: '17 pages mention returns, and customers sent 212 emails about them this year. I’ll split the work between five workers on the branch *returns-30-days*:\n\n- one reads the emails and lists what people actually ask;\n- three rewrite the shop handbook, the online handbook and the site, each starting fresh with only its own pages;\n- a checker on a second model reads every change against the new policy and those questions.\n\nNothing goes live until you say so.',
    },
    thoughts: [thought('Gathering the workers’ results and the checker’s two rounds')],
    tools: [
      tool('read', 'workers/mail-questions/report.md', '212 emails · 14 kinds of question\n71  How long do I have?\n38  Sale items?       no page answers\n27  Gifts?            no page answers\n24  Return postage?\n19  Exchanges?        no page answers\n …  9 more, each under 10'),
      tool('read', 'workers/checker/round-1.md', '✗ site/faq.md:24\n  sale items still “14 days” → site\n✗ handbook/online/gifts.md\n  “within 14 days of purchase”\n  against the gift rule → online-orders\n✓ 15 pages agree with the policy'),
      tool('read', 'workers/checker/round-2.md', '✓ site/faq.md\n✓ handbook/online/gifts.md\nAll 17 pages agree. 3 unanswered questions now answered.'),
      tool('bash', 'git diff --stat main...returns-30-days | tail -1', ` 17 files changed, ${ADDED} insertions(+), ${REMOVED} deletions(-)`),
    ],
    time: '3 h 21 min',
    reply: '**17 pages updated** on *returns-30-days*. The checker sent two back (a sale-item line on the FAQ, a gift rule in the online handbook), and both are fixed. The FAQ now answers the three questions customers asked most and no page answered: sale items, gifts and exchanges.\n\nThe changes are open beside this conversation. Merge them?',
    panel: workers([
      ['done', 'mail-questions', '212 emails · 14 questions · Pi', '24 min'],
      ['done', 'shop-floor', 'handbook/shop · 6 pages · Pi', '52 min'],
      ['done', 'online-orders', 'handbook/online · 7 pages · Pi', '1 h 14 min'],
      ['done', 'site', 'site · 4 pages · Pi', '1 h 31 min'],
      ['done', 'checker', '17 pages · 2 sent back · second model', '1 h 46 min'],
    ]),
  }), view('returns-30-days', reviewView(), 'Changes')),
};
