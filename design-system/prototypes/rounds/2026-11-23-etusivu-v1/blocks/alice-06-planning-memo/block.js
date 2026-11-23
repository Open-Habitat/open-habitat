// Alice · 11:24 · Planning memo. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, diff, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const memoMock = () => `<div class="doc"><p class="doc-k">Memo · Planning, Thu 19 Nov · Alice, Bob, Carol</p><b class="doc-h">Decisions</b><ol><li>Winter prints go on the shop page on Monday. <time>12:40</time></li><li>Wholesale shops get an order page instead of phoning Bob. <time>31:05</time></li><li>Markets stop after 12 December. <time>44:18</time></li></ol><b class="doc-h">Tasks</b><ul class="doc-tasks"><li><i class="sp-a">Alice</i>Order page for wholesale shops <small>notes/open.md</small></li><li><i class="sp-a">Alice</i>Reply to the market organiser <small>notes/open.md</small></li><li><i class="sp-b">Bob</i>Ask Northside about the four prices, by Monday <small>team/tasks.md</small></li><li><i class="sp-b">Bob</i>Book the van for the 12th <small>team/tasks.md</small></li><li><i class="sp-c">Carol</i>A turning film of the new tote <small>team/tasks.md</small></li><li class="more">+ 2 more</li></ul></div>`;

export default {
  id: 'alice-06-planning-memo',
  kind: 'glimpse',
  day: 'alice',
  s: 'memo',
  at: '11:24',
  ask: 'Here’s this morning’s planning. A memo and the tasks, please.',
  did: 'The planning meeting was recorded on her phone. Back at her desk she drops in the hour’s recording. It is transcribed on the server with each speaker named, the memo is written, and each task lands in the list of the person who owns it. Nothing is sent: Bob and Carol find theirs in the team folder.',
  screen: () => screen('Planning memo', you('11:05', 'Here’s this morning’s planning. A memo and the tasks, please.', att('planning-2026-11-19.m4a', 'Recording · 58 min · 54 MB')) + turn({ tools: [
        tool('bash', 'ffmpeg -i planning-2026-11-19.m4a -ac 1 -ar 16000 planning.wav', '58:12 · mono · 16 kHz'),
        tool('bash', 'whisperx planning.wav --diarize --language en', 'transcribed on this server in 9 min · nothing uploaded\n3 speakers: SPEAKER_00 41 % · SPEAKER_01 35 % · SPEAKER_02 24 %'),
        tool('read', 'calendar › Planning 10:15', 'Alice, Bob, Carol · speakers named from the invite; check the memo'),
        tool('write', 'meetings/2026-11-19-planning.md', '3 decisions · 7 tasks · each with its minute in the recording'),
        diff('team/tasks.md', ['+ Bob: ask Northside about the four prices (by Mon)  [planning 19 Nov, 22:10]', '+ Bob: book the van for 12 Dec  [44:30]', '+ Carol: a turning film of the new tote  [12:55]']),
      ], time: '19 min 58 s', reply: 'The memo is open beside this, and as a Word file. **Seven tasks**: three for you in *notes/open.md*, two for Bob and two for Carol in *team/tasks.md*, each with the minute it was agreed. Nothing was sent; they will find theirs in the team folder.', extra: offer('memo-2026-11-19.docx', 'Word · 2 pages · 18 KB') }), view('meetings/2026-11-19-planning.md', memoMock())),
};
