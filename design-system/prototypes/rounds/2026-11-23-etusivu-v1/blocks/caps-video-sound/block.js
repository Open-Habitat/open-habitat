// Capabilities: Video and sound. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const stemsMock = () => `<div class="stems" data-view data-state="mix">${toggles([['mix', 'Original', 'Playing: the original recording'], ['backing', 'Backing only', 'Playing: the backing track, no voice'], ['vocal', 'Vocal only', 'Playing: the voice on its own']], 'mix')}${['backing', 'vocal'].map((k) => `<div class="stem stem-${k}"><span>${k === 'backing' ? 'Piano, bass, drums' : 'Teacher’s voice'}</span><i aria-hidden="true">${Array.from({ length: 48 }, (_, j) => `<b style="--h:${k === 'vocal' ? (j % 7 < 4 ? 20 + ((j * 29) % 70) : 6) : 30 + ((j * 53) % 60)}%"></b>`).join('')}</i></div>`).join('')}<p class="stems-n" data-label>Playing: the original recording</p></div>`;
const timelapseMock = () => `<div class="tl"><div class="tl-g">${['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map((m, k) => `<span class="tl-f" style="--k:${k}"><i class="tl-scaf" aria-hidden="true"></i><small>${m}</small></span>`).join('')}</div><p class="tl-n"><span>240 photos aligned · 40 s</span><span>the month in the corner</span></p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [1, 'av', 'Phone video cut and sized for every channel', 'FFmpeg', 'Carol', 'Example Studio', 'Three clips of the new aprons: a 30-second video for the product page and an upright one for social media.', 'Both files, with the shaky clip steadied, the sound evened out and the logo fading in at the end.'],
  [2, 'av', 'An hour’s recording to text, speakers named, on your own server', 'faster-whisper, WhisperX', 'Frank', 'Example Studio', 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.', 'Six transcripts with the speakers named; the recordings never left the server.'],
  [4, 'av', 'Subtitles for a video, in another language too', 'whisper.cpp, ffsubsync, FFmpeg', 'Ivan', 'Maple Lane School', 'Subtitles in Finnish and English for my twelve-minute woodwork safety video.', 'The video with captions in both languages, the tool names spelled as in the school’s equipment list.'],
  [9, 'av', 'The handbook as something to listen to', 'Piper', 'Dave', 'Example Studio', 'Make the staff handbook listenable for the seasonal staff.', 'Nine audio chapters, abbreviations and product names read correctly, a short pause between sections.'],
  [22, 'av', 'Photos into a slideshow or a time-lapse', 'FFmpeg', 'Mallory', 'Birchwood Housing Company', 'One photo a day of the facade renovation: a film for the annual meeting.', 'A forty-second time-lapse of 240 aligned photos, with the month in the corner.'],
  [24, 'av', 'A song split into backing track and vocal', 'Demucs', 'Sara', 'Maple Lane School', 'The concert recording from years ago has my voice on it. The same song without the singing, please.', 'The backing track for the pupils to perform to, and the vocal separately for practising.'],
  [31, 'av', 'A podcast episode with silences removed and even sound', 'Auto-Editor, FFmpeg, SoX', 'Trent', 'Harbour Singers', 'Fifty minutes of this month’s member interview, recorded on a laptop.', 'A 38-minute episode with even sound, chapter marks and a description.'],
  [45, 'av', 'A webinar recording saved and turned into text', 'yt-dlp, faster-whisper', 'Bob', 'Example Studio', 'What did the supplier’s 90-minute product training say about the new warranty terms?', 'Three quotations, each with the minute it was said.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-video-sound',
  kind: 'caps',
  group: { id: 'av', name: "Video and sound", line: "Recordings become text, text becomes speech, clips become films." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [22, 24],
  full: {
    22: () => capScreen(22, 'Facade time-lapse', you('20:30', capOf[22][6], att('facade-daily/', '240 photos · Apr–Sep')) + turn({ tools: [
        tool('bash', 'align_image_stack -a aligned/ facade-daily/*.jpg', '240 photos aligned to the first'),
        tool('bash', 'ffmpeg -framerate 6 -i aligned/%04d.jpg -vf "drawtext=text=\'%{metadata\\:month}\'" facade.mp4', 'facade.mp4 · 40 s · 1080p'),
      ], reply: 'A **forty-second time-lapse**: the scaffolding goes up in April and comes down in September. The month is in the corner.', extra: offer('facade.mp4', 'Video · 40 s · 31 MB') }), view('facade.mp4', timelapseMock())),
    24: () => capScreen(24, 'Concert backing track', you('15:05', capOf[24][6], att('spring-song-2019.wav', 'Audio · 3 min 40 s')) + turn({ tools: [
        tool('bash', 'uv tool install demucs', 'installed into ~/.local · model 80 MB'),
        tool('bash', 'demucs --two-stems=vocals spring-song-2019.wav', 'separated in 4 min on the processor\nno_vocals.wav · vocals.wav'),
      ], reply: 'Here are both. The backing track is for the concert; the vocal on its own is for practising.', extra: offer('spring-song-backing.wav', 'Audio · 3 min 40 s · 38 MB') }), view('spring-song', stemsMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 2: ['frank', 'talk'], 9: ['dave', 'audio'] },
};
