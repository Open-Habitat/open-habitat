// Alice · 11:24 · Planning memo.
// The minute of the meeting in the view is real audio, and its transcript and
// speaker labels are the programs' own output: assets.mjs speaks the passage
// with three voices, transcribes it with faster-whisper, tells the speakers
// apart with sherpa-onnx and prints the TRANSCRIPT literal below. See NOTES.md.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view, assets, esc, PLAY_SVG } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// ---------- The programs' output (pasted from assets.mjs) ----------
// diarization: [start s, end s, speaker]; turns: [speaker, start s, end s, text].
const TRANSCRIPT = {"duration":55.89,"model":"large-v3-turbo","speakers":3,
  "diarization":[
  [0.66,5.03,1],
  [5.7,10.95,0],
  [11.64,14.16,2],
  [14.68,18.31,1],
  [18.69,24.23,0],
  [24.69,29.11,1],
  [29.8,33.63,2],
  [34.25,37.49,0],
  [37.95,39.74,0],
  [40.24,45.21,1],
  [45.69,47.79,0],
  [48.45,51.16,2],
  [51.97,55.28,1]],
  "turns":[
  [1,0.37,4.83,"Okay, next on the list is the winter prints. Carol, where are we with those?"],
  [0,5.43,10.77,"All six designs are printed and photographed. I finished the last two yesterday."],
  [2,11.35,14.11,"Two shops have already asked me when they can order them."],
  [1,14.47,18.05,"Then let's not wait. Could we put them on the shop page on Monday?"],
  [0,18.49,23.97,"Monday works for me. I still need Friday to write the descriptions and choose the photographs."],
  [1,24.45,28.89,"Great, so that's decided. The winter prints go on the shop page on Monday."],
  [2,29.43,33.49,"What about the new tote bag? People want to see it from every side before they buy."],
  [0,33.87,39.51,"I could make a short-turning film of it. Ten seconds. The bag going around once."],
  [1,39.97,44.93,"I like that. Carol, that one is yours. Could you have it ready by Wednesday?"],
  [0,45.57,47.65,"Yes, Wednesday is fine."],
  [2,48.05,51.07,"And I'll tell the two shops today that the Winter Prince are coming."],
  [1,51.77,55.05,"Perfect. The next thing on my list is wholesale orders."]]};

// The passage starts 12 min 31 s into the 58-minute recording of the story.
const OFFSET = 12 * 60 + 31;
const clock = (s) => `${Math.floor((s + OFFSET) / 60)}:${String(Math.floor((s + OFFSET) % 60)).padStart(2, '0')}`;
// Who is who: the agent's step, from the invite and from who answers to which name.
const WHO = { 0: ['Carol', 'c'], 1: ['Alice', 'a'], 2: ['Bob', 'b'] };
const turnAt = (re) => TRANSCRIPT.turns.find((t) => re.test(t[3]));
const at = (re) => { const t = turnAt(re); return t ? clock(t[1]) : '–'; };

// ---------- The memo ----------
const MEMO = {
  title: 'Planning meeting',
  date: 'Thursday 19 November 2026, 10:15–11:13',
  present: 'Alice, Bob, Carol',
  source: 'planning-2026-11-19.m4a, 58 min',
  decisions: [
    ['The winter prints go on the shop page on Monday 23 November.', at(/that's decided/i)],
    ['Wholesale shops get an order page of their own instead of phoning Bob.', '31:05'],
    ['Markets stop for the winter after Saturday 12 December.', '44:18'],
  ],
  tasks: [
    ['Carol', 'c', 'Write the descriptions for the winter prints', 'Fri 20 Nov', at(/need Friday/i)],
    ['Carol', 'c', 'A ten-second turning film of the new tote', 'Wed 25 Nov', at(/turning film/i)],
    ['Bob', 'b', 'Tell the two shops that the winter prints are coming', 'today', at(/tell the two shops/i)],
    ['Bob', 'b', 'Ask Northside about the four prices', 'Mon 23 Nov', '22:10'],
    ['Bob', 'b', 'Book the van for 12 December', 'Fri 27 Nov', '44:30'],
    ['Alice', 'a', 'Order page for the wholesale shops', 'today', '31:40'],
    ['Alice', 'a', 'Reply to the market organiser', 'Fri 20 Nov', '45:02'],
  ],
};
// The same memo as Markdown: what the agent writes to meetings/ and pandoc turns into the Word file.
export const memoMarkdown = () => `---
title: ${MEMO.title}
subtitle: Example Studio · memo
---

**Date:** ${MEMO.date}\\
**Present:** ${MEMO.present}\\
**Recording:** ${MEMO.source} (times below are minutes into it)

## Decisions

${MEMO.decisions.map(([d, t], i) => `${i + 1}. ${d} [${t}]`).join('\n')}

## Tasks

| Who | What | By | Agreed at |
|:----|:-----|:---|:----------|
${MEMO.tasks.map(([who, , what, by, t]) => `| ${who} | ${what} | ${by} | ${t} |`).join('\n')}

Written from the recording's transcript. Speakers were named from the calendar invite; check any line against its minute.
`;

const memoSheet = () => `<article class="pm-memo" aria-label="The memo">
  <header><span class="pm-brand"><i aria-hidden="true"></i>Example Studio</span><span class="pm-kind">Memo</span></header>
  <h3>${MEMO.title}</h3>
  <dl><dt>Date</dt><dd>${MEMO.date}</dd><dt>Present</dt><dd>${MEMO.present}</dd><dt>Recording</dt><dd>${MEMO.source}</dd></dl>
  <h4>Decisions</h4>
  <ol class="pm-dec">${MEMO.decisions.map(([d, t]) => `<li><span>${esc(d)}</span><time>${t}</time></li>`).join('')}</ol>
  <h4>Tasks</h4>
  <table><thead><tr><th>Who</th><th>What</th><th>By</th><th>At</th></tr></thead><tbody>${MEMO.tasks.map(([who, c, what, by, t]) => `<tr><td><b class="pm-${c}">${who}</b></td><td>${esc(what)}</td><td>${by}</td><td><time>${t}</time></td></tr>`).join('')}</tbody></table>
  <footer><span>Times are minutes into the recording.</span><span>1 / 1</span></footer>
</article>`;

// ---------- The recording ----------
// The waveform is ffmpeg's picture of the audio, cut out of a white sheet;
// under it lies a band of colour per speaker from the diarization.
const COLOR = { a: 'var(--pm-a)', b: 'var(--pm-b)', c: 'var(--pm-c)' };
const pct = (s) => `${((s / TRANSCRIPT.duration) * 100).toFixed(2)}%`;
const bands = () => {
  const stops = ['transparent 0'];
  for (const [s, e, k] of TRANSCRIPT.diarization) { const c = COLOR[WHO[k][1]]; stops.push(`transparent ${pct(s)}`, `${c} ${pct(s)}`, `${c} ${pct(e)}`, `transparent ${pct(e)}`); }
  return `linear-gradient(90deg, ${stops.join(', ')}, transparent 100%)`;
};
const recording = () => `<div class="pm-rec" style="--pm-bands: ${bands()}">
  <button type="button" class="pm-play" aria-label="Play this minute of the meeting" data-play="Play this minute of the meeting" data-pause="Pause">${PLAY_SVG}<svg class="pm-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg></button>
  <div class="pm-wave"><i class="pm-w0"></i><i class="pm-w1"></i><img src="${asset('wave.webp')}" width="1600" height="160" loading="lazy" decoding="async" alt="The sound of the passage as a waveform, coloured by who is speaking"><i class="pm-head"></i></div>
  <p class="pm-meta"><span class="pm-t">${clock(0)}–${clock(TRANSCRIPT.duration)} <small>of 58:12</small></span><span class="pm-leg"><i class="pm-a"></i>Alice<i class="pm-b"></i>Bob<i class="pm-c"></i>Carol</span></p>
  <audio preload="none" src="${asset('meeting.mp4')}"></audio>
</div>`;
const transcript = () => `<div class="pm-tr" aria-label="Transcript of the passage">
  <ol>${TRANSCRIPT.turns.map(([k, s, e, text]) => `<li data-s="${s}" data-e="${e}"><time>${clock(s)}</time><b class="pm-${WHO[k][1]}">${WHO[k][0]}</b><span>${esc(text)}</span></li>`).join('')}</ol>
  <p class="pm-note">Synthetic voices stand in for the three of them. The words and the speaker changes are what Whisper and the diarizer made of the sound, untouched.</p>
</div>`;
const memoView = () => `<div class="pm" data-view data-state="memo">
  ${recording()}
  <p class="tg pm-tabs"><button type="button" data-set="memo" aria-pressed="true">Memo</button><button type="button" data-set="tr" aria-pressed="false">Transcript</button></p>
  ${memoSheet()}
  ${transcript()}
</div>`;

// The first lines as the transcriber prints them, before anyone has a name.
const RAW = () => `${TRANSCRIPT.turns.slice(0, 5).map(([k, s, , text]) => `[${clock(s)}] SPEAKER_${String(k).padStart(2, '0')}  ${text}`).join('\n')}`;

export default {
  id: 'alice-06-planning-memo',
  kind: 'glimpse',
  day: 'alice',
  s: 'memo',
  at: '11:24',
  ask: 'Here’s this morning’s planning. A memo and the tasks, please.',
  did: 'She recorded the planning meeting on her phone. Back at her desk she drops in the hour of talk. It is transcribed on the studio’s own server, each voice gets its name, and the memo comes back with every decision tied to its minute. Each task lands in its owner’s list. Nothing is sent: Bob and Carol find theirs in the team folder.',
  screen: () => screen('Planning memo',
    you('11:05', 'Here’s this morning’s planning. A memo and the tasks, please.', att('planning-2026-11-19.m4a', 'Recording · 58 min · 54 MB')) +
    turn({
      thoughts: [
        'An hour of speech. Transcribing it here on the server, then telling the voices apart.',
        'Three voices, three people on the invite. SPEAKER_01 asks “Carol, where are we with those?” and SPEAKER_00 answers, so 00 is Carol. 01 runs the meeting: Alice. 02 is Bob.',
      ],
      tools: [
        tool('bash', 'ffmpeg -i planning-2026-11-19.m4a -ac 1 -ar 16000 planning.wav', 'Input #0, mov,mp4,m4a,3gp,3g2,mj2, from \'planning-2026-11-19.m4a\':\n  Duration: 00:58:12.44, start: 0.000000, bitrate: 124 kb/s\nOutput #0, wav, to \'planning.wav\':\n  Stream #0:0: Audio: pcm_s16le, 16000 Hz, mono, s16, 256 kb/s'),
        tool('bash', 'python tools/transcribe.py planning.wav --model large-v3-turbo --speakers', `58:12 of audio · whisper large-v3-turbo on 8 CPU threads · 3 speakers\n…\n${RAW()}\n… 642 more lines → meetings/2026-11-19-planning.transcript.txt`),
        tool('read', 'calendar › Planning, Thu 10:15', 'Planning · Thu 19 Nov 10:15–11:15 · Studio\nAlice (organiser), Bob, Carol'),
        tool('write', 'meetings/2026-11-19-planning.md', memoMarkdown().split('\n').slice(5, 16).join('\n').replace(/\\$/gm, ''), 'new · 27 lines'),
        tool('bash', 'pandoc meetings/2026-11-19-planning.md -o memo-2026-11-19.docx', ''),
        tool('edit', 'team/tasks.md', MEMO.tasks.filter((t) => t[0] !== 'Alice').map(([who, , what, by, t]) => `+ - [ ] ${who}: ${what} (by ${by})  [planning 19 Nov, ${t}]`).join('\n'), '+5'),
        tool('edit', 'notes/open.md', MEMO.tasks.filter((t) => t[0] === 'Alice').map(([, , what, by, t]) => `+ - [ ] ${what} (by ${by})  [planning 19 Nov, ${t}]`).join('\n'), '+2'),
      ],
      time: '19 min 04 s',
      reply: 'The memo is beside this, and as a Word file. **Three decisions and seven tasks**, each with the minute it was agreed, so you can listen to that spot.\n\nTwo tasks are yours and went into *notes/open.md*; three for Bob and two for Carol are in *team/tasks.md*. I named the voices from the invite and from who answers to which name. Nothing was sent.',
      extra: offer('memo-2026-11-19.docx', 'Word · 1 page · 11 KB'),
    }),
    view('meetings/2026-11-19-planning.md', memoView())),
};
