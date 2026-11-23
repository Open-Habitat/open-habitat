// Alice · 17:28 · Before I go. Her own three-sentence skill writes down the
// day's lessons: three lines into her own instructions, four into the team's
// shared file that Bob's agent reads tomorrow. The block contract is in ../../BLOCKS.md.
import { SKILL_IC, FILE_IC, esc, you, tool, thought, turn, screen, view } from '../../engine/kit.mjs';

// ---------- The skill: a file Alice wrote, three sentences ----------
const SKILL = [
  'Read back through today’s conversations.',
  'What only I need goes in ~/AGENTS.md; what everyone at the studio needs goes in team/AGENTS.md.',
  'Keep every line short, and ask me before you remove anything.',
];
const SKILL_FILE = `---\nname: before-i-go\ndescription: End of the day. Write down what tomorrow should know.\n---\n\n${SKILL.join('\n')}`;

const skillView = () => `<article class="b12-skill">
  <header class="b12-skill-h"><span class="b12-skill-ic">${SKILL_IC}</span><span class="b12-skill-t"><b>before-i-go</b><small>Alice wrote this · 2 Oct</small></span><span class="b12-skill-say">She says <q>Before I go.</q></span></header>
  <ol class="b12-lines">${SKILL.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  <p class="b12-skill-f">Three sentences. The whole skill.</p>
</article>`;

// ---------- The two diffs: every new line with the conversation it came from ----------
const OWN = [
  ['Receipts: name them “date vendor amount.pdf”.', 'October receipts'],
  ['The Fjord Fonts bill comes to the info inbox.', 'October receipts'],
  ['Video captions: the shop font, six words at most.', 'Market video'],
];
const TEAM = [
  ['Returns: 30 days from 1 Dec 2026. Wholesale stays at 14 days (Bob, 19 Nov).', 'Returns: 30 days'],
  ['Wholesale orders arrive in orders/wholesale.csv from wholesale.example.org.', 'Wholesale order page'],
  ['A promotion banner on the site says when it ends.', 'Shipping banner'],
  ['Supplier price lists: run tools/margin_check.py.', 'Northside prices'],
];
const lessons = (kind, file, who, reads, rows) => `<section class="b12-diff b12-${kind}">
  <header class="b12-diff-h">${FILE_IC}<code>${esc(file)}</code><span class="b12-n">+${rows.length}</span><small>${esc(who)}</small></header>
  <ol class="b12-add">${rows.map(([line, from]) => `<li><span class="b12-l">${esc(line)}</span><span class="b12-from">${esc(from)}</span></li>`).join('')}</ol>
  <p class="b12-reads">${reads}</p>
</section>`;
const twoDiffs = () => `<div class="b12-diffs">${lessons('own', '~/AGENTS.md', 'Only for you', 'Your agents read this when they start.', OWN)}${lessons('team', 'team/AGENTS.md', 'The whole team', 'Bob’s agent reads this tomorrow morning. So do Kirsi’s, Carol’s and Dave’s.', TEAM)}</div>`;
const plain = (rows) => rows.map(([l]) => `+ ${l}`).join('\n');

export default {
  id: 'alice-12-before-i-go',
  kind: 'glimpse',
  day: 'alice',
  s: 'wrapup',
  at: '17:28',
  ask: 'Before I go.',
  did: 'Three words, because in October Alice wrote down once what they should mean: a skill of her own, three sentences long. Her agent reads back through the day and keeps what is worth keeping. Three lines go into her own instructions. Four go into the team’s file, so tomorrow Bob’s agent already knows the new returns rule, and nobody has to tell it.',
  screen: () => screen('Before I go',
    you('17:25', 'Before I go.', '', `${SKILL_IC}Her own skill · <code>before-i-go</code>`) +
    turn({
      tools: [
        tool('read', 'skills/before-i-go/SKILL.md', SKILL_FILE, '8 lines'),
        tool('bash', 'python3 skills/before-i-go/today.py', '9 conversations since 08:04\n08:10  What’s waiting today\n09:14  Market video\n09:16  Northside prices\n09:50  Shipping banner\n12:44  October receipts\n13:38  Planning memo\n14:30  December newsletter      waiting for you\n15:32  Returns: 30 days\n16:58  Wholesale order page    still taking orders'),
        thought('Eleven things came up that could be written down. Four were one-offs and stay in their conversations; seven will matter again.'),
        thought('The returns rule, the wholesale file, the banner and the margin check are not only Alice’s: Bob’s agent meets all four. Team file.'),
        tool('edit', '~/AGENTS.md', plain(OWN), '+3 lines'),
        tool('edit', 'team/AGENTS.md', plain(TEAM), '+4 lines'),
      ],
      time: '3 min 20 s',
      reply: 'Seven lines from today, and nothing removed. **Three are yours alone. Four are in the team’s file**, so tomorrow Bob’s agent starts out knowing the returns rule and where the wholesale orders come in.',
      extra: twoDiffs(),
    }),
    view('skills/before-i-go/SKILL.md', skillView())),
};
