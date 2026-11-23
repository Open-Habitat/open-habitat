// Alice · 15:30 · Returns: 30 days. One page of the workers' change is undone
// on Bob's word; the undo is its own entry in the page's history.
// The block contract is in ../../BLOCKS.md; what changed and why is in NOTES.md.
import { esc, you, tool, turn, diff, screen, view, mark } from '../../engine/kit.mjs';

const FILE = 'handbook/online/wholesale.md';
const ASK = 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.';

// ---------- The page's history, newest first ----------
// [hash, when, title, who, whoKind, tag, body, change]; whoKind picks the
// avatar (a person's initial or the agent's mark), change is [from, to].
const HISTORY = [
  ['e93b4d0', 'Today 15:31', 'Wholesale keeps 14-day returns', 'Alice, by her agent', 'agent', 'Undo', 'Bob agreed on 19 Nov that wholesale stays at 14 days. Puts this page back as it was in 81aa0f4; the other 16 pages keep 30 days.', ['30 days', '14 days']],
  ['a41c9e7', 'Today 13:55', 'Merge returns-30-days', 'Alice', 'A', 'Merge', '17 pages, checked against the policy by a second model.'],
  ['c7e01b2', 'Today 11:02', 'Returns: 14 → 30 days', 'worker online-orders', 'agent', '', 'Part of the 30-day policy from 1 December.', ['14 days', '30 days']],
  ['81aa0f4', '2 Sep', 'Wholesale terms 2026', 'Bob', 'B', '', 'Prices, minimum order and 14-day returns for the shops.'],
];
const avatar = (k) => (k === 'agent' ? `<span class="hi-av hi-av-agent">${mark(14)}</span>` : `<span class="hi-av hi-av-${k}">${k}</span>`);
const change = ([a, b]) => `<p class="hi-ch"><span class="hi-from">${esc(a)}</span><span aria-hidden="true">→</span><span class="hi-to">${esc(b)}</span></p>`;
const entry = ([h, when, title, who, k, tag, body, ch], i) => `<li class="hi-e${i === 0 ? ' hi-now' : ''}"><span class="hi-node" aria-hidden="true"></span><div class="hi-card"><p class="hi-top"><b>${esc(title)}</b>${tag ? `<span class="hi-tag hi-tag-${tag.toLowerCase()}">${esc(tag)}</span>` : ''}</p><p class="hi-meta">${avatar(k)}<span>${esc(who)}</span><span>${esc(when)}</span><code>${esc(h)}</code></p><p class="hi-body">${esc(body)}</p>${ch ? change(ch) : ''}${i === 0 ? '<p class="hi-act"><button type="button" class="quiet-btn" data-undo>Undo this too</button><small>It would be recorded the same way.</small></p>' : ''}</div></li>`;
const historyView = () => `<div class="hi"><p class="hi-file"><code>${esc(FILE)}</code><span>${HISTORY.length} changes</span></p><ol class="hi-list" data-hist>${HISTORY.map(entry).join('')}</ol><p class="hi-now-line"><span>Now:</span> “Wholesale orders can be returned within <b data-days>14 days</b> of delivery.”</p></div>`;

export default {
  id: 'alice-10-undo-one-page',
  kind: 'glimpse',
  day: 'alice',
  s: 'returns',
  at: '15:30',
  ask: ASK,
  did: 'Every change the workers made is in the history: what changed, when, by whom and why. The agent puts one page back as it was and leaves the other sixteen alone. The undo goes into the history too, with Bob’s reason, so it can be undone in turn.',
  screen: () => screen('Returns: 30 days', you('15:30', ASK) + turn({
    tools: [
      tool('bash', `git log --full-history --format='%h %ad %an: %s' --date=format:'%d %b' -- ${FILE}`, 'a41c9e7 23 Nov Alice: Merge returns-30-days\nc7e01b2 23 Nov online-orders: Returns: 14 → 30 days\n81aa0f4 02 Sep Bob: Wholesale terms 2026'),
      tool('bash', `git restore --source=81aa0f4 -- ${FILE} && git diff --stat`, ` ${FILE} | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)`),
      tool('bash', 'git commit -m "Wholesale keeps 14-day returns" -m "Bob agreed on 19 Nov …"', '[main e93b4d0] Wholesale keeps 14-day returns\n 1 file changed, 1 insertion(+), 1 deletion(-)'),
      tool('bash', 'grep -rl "30 days" handbook/ site/ | wc -l', '16'),
    ],
    time: '21 s',
    reply: 'Undone. The wholesale page is back to 14 days; the other 16 pages keep 30. The undo is its own entry in the page’s history, with Bob’s reason.',
    extra: diff(FILE, ['- Wholesale orders can be returned within 30 days of delivery.', '+ Wholesale orders can be returned within 14 days of delivery.']),
  }), view(`History · ${FILE.split('/').pop()}`, historyView(), 'History')),
};
