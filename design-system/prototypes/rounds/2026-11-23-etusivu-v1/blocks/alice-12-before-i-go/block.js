// Alice · 17:28 · Before I go. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { SKILL_IC, you, tool, turn, diff, screen } from '../../engine/kit.mjs';

export default {
  id: 'alice-12-before-i-go',
  kind: 'glimpse',
  day: 'alice',
  s: 'wrapup',
  at: '17:28',
  ask: 'Before I go.',
  did: 'In October Alice wrote herself a small skill for the end of the day, three sentences long. Her agent follows it: it reads back through the day’s conversations and writes down what the next agent should know. What concerns only Alice goes into her own notes; what concerns everyone goes into the team’s folder, where Bob’s agent will read it tomorrow.',
  screen: () => screen('Before I go', you('17:25', 'Before I go.', '', `${SKILL_IC}Her own skill · <code>before-i-go</code>`) + turn({ tools: [
        tool('read', 'skills/before-i-go/SKILL.md', 'Written by Alice, 2 Oct.\nRead back through today’s conversations. What only I need goes in ~/AGENTS.md;\nwhat everyone needs goes in team/AGENTS.md. Short lines. Ask before removing anything.'),
        tool('read', 'today’s 9 conversations', 'What’s waiting today · Northside prices · October receipts · Market video · Shipping banner · Planning memo · Wholesale order page · Returns: 30 days · December newsletter'),
        diff('~/AGENTS.md', ['+ Receipts: name them “date vendor amount.pdf”.', '+ The Fjord Fonts bill comes to the info inbox.', '+ Video captions: the shop font, six words at most.'], 'Only for you'),
        diff('team/AGENTS.md', ['+ Returns: 30 days from 1 Dec 2026. Wholesale stays', '+   at 14 days (Bob, 19 Nov).', '+ Wholesale orders arrive in orders/wholesale.csv', '+   from wholesale.example.org.', '+ A promotion banner on the site says when it ends.', '+ Supplier price lists: run tools/margin_check.py.'], 'For everyone at Example Studio'),
      ], time: '3 min 20 s', summary: '2 tools · 2 files', reply: 'Written down. Your own notes stay yours. The team notes are in the shared folder, so tomorrow Bob’s agent knows the returns rule and where the wholesale orders come in.' })),
};
