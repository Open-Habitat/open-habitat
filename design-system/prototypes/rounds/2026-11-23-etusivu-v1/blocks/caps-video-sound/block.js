// Capabilities: Video and sound. The two showpieces are real: a slideshow
// FFmpeg made from ten CC0 photos, and a CC BY song Demucs split into backing
// and vocal (assets.mjs). The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view, video, esc, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// ---------- The film: FFmpeg's slideshow, played in the view ----------
const filmView = () => `<figure class="vs-film">
  <div class="vs-frame">${video(asset('street-year.mp4'), { poster: asset('street-year.webp'), w: 960, h: 540, label: 'The film: ten photos of the street, January to October' })}</div>
  <figcaption class="vs-n"><span>10 photos · 27 s · cross-fades</span><span>the month in the corner</span></figcaption>
</figure>`;

// ---------- The stems: the same 14 seconds three ways, with their waveforms ----------
// Each waveform is an SVG drawn from that clip's samples (assets.mjs): a pale
// copy underneath, a full one clipped to --p, how far it has played.
const PLAY_IC = '<svg class="vs-ic-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z"/></svg><svg class="vs-ic-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3.2" height="10" rx=".8"/><rect x="9.3" y="3" width="3.2" height="10" rx=".8"/></svg>';
const STEMS = [
  ['mix', 'Original', 'The song as released'],
  ['backing', 'Backing track', 'Guitar, bass, drums, piano'],
  ['vocal', 'Vocal only', 'The voice on its own'],
];
const stemsView = () => `<div class="vs-stems">
  <p class="vs-song"><b>The Delicacy Of Gratitude</b><span>Radioontheshelf, vocals by SackJo22 · CC BY 3.0</span></p>
  <ul>${STEMS.map(([k, name, sub]) => `<li class="vs-stem vs-${k}">
    <button type="button" class="vs-play" data-vs-play aria-label="Play: ${name}">${PLAY_IC}</button>
    <span class="vs-name"><b>${name}</b><small>${sub}</small></span>
    <span class="vs-t" data-vs-t>0:14</span>
    <span class="vs-wave" aria-hidden="true">${[0, 1].map((d) => `<img${d ? ' class="vs-done"' : ''} src="${esc(asset(`wave-${k}.svg`))}" alt="" width="558" height="48">`).join('')}</span>
    <audio src="${esc(asset(`song-${k}.mp4`))}" preload="none"></audio>
  </li>`).join('')}</ul>
  <p class="vs-n"><span>The same 14 seconds of each</span><span>separated by Demucs on the processor</span></p>
</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [1, 'av', 'Phone video cut and sized for every channel', 'FFmpeg', 'Carol', 'Example Studio', 'Three clips of the new aprons: a 30-second video for the product page and an upright one for social media.', 'Both files, with the shaky clip steadied, the sound evened out and the logo fading in at the end.'],
  [2, 'av', 'An hour’s recording to text, speakers named, on your own server', 'faster-whisper, WhisperX', 'Frank', 'Example Studio', 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.', 'Six transcripts with the speakers named; the recordings never left the server.'],
  [4, 'av', 'Subtitles for a video, in another language too', 'whisper.cpp, ffsubsync, FFmpeg', 'Ivan', 'Maple Lane School', 'Subtitles in Finnish and English for my twelve-minute woodwork safety video.', 'The video with captions in both languages, the tool names spelled as in the school’s equipment list.'],
  [9, 'av', 'The handbook as something to listen to', 'Piper', 'Dave', 'Example Studio', 'Make the staff handbook listenable for the seasonal staff.', 'Nine audio chapters, abbreviations and product names read correctly, a short pause between sections.'],
  [22, 'av', 'Photos into a slideshow or a time-lapse', 'FFmpeg', 'Mallory', 'Birchwood Housing Company', 'Residents have sent photos of our street all year. Make them into a short film for the annual meeting, January to October.', 'A 27-second film of the ten best, each slowly moving, fading into the next, with the month in the corner.'],
  [24, 'av', 'A song split into backing track and vocal', 'Demucs', 'Sara', 'Maple Lane School', 'The pupils want to sing this song at the spring concert. I need it without the singing, and the voice alone for practising.', 'The backing track to perform to and the vocal on its own, split from the one recording.'],
  [31, 'av', 'A podcast episode with silences removed and even sound', 'Auto-Editor, FFmpeg, SoX', 'Trent', 'Harbour Singers', 'Fifty minutes of this month’s member interview, recorded on a laptop.', 'A 38-minute episode with even sound, chapter marks and a description.'],
  [45, 'av', 'A webinar recording saved and turned into text', 'yt-dlp, faster-whisper', 'Bob', 'Example Studio', 'What did the supplier’s 90-minute product training say about the new warranty terms?', 'Three quotations, each with the minute it was said.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-video-sound',
  kind: 'caps',
  group: { id: 'av', name: 'Video and sound', line: 'Photos become a film, a song comes apart, recordings become text and text becomes speech.' },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [22, 24],
  full: {
    22: () => capScreen(22, 'Street film', you('20:30', capOf[22][6], att('street-photos/', '63 photos · Jan–Oct')) + turn({
      thoughts: ['A meeting audience: short beats long. One or two photos a month, landscape, no faces close up, so nobody has to be asked.'],
      tools: [
        tool('bash', 'exiftool -T -DateTimeOriginal -ImageSize -FileName street-photos/ | sort', '2026:01:09 21:14:05  4032x3024  IMG_0412.jpg\n2026:03:02 12:40:51  4032x3024  IMG_0587.jpg\n… 60 more …\n2026:10:14 15:22:10  3024x4032  IMG_2290.jpg'),
        tool('read', 'street-photos/ (63 photos)', '41 landscape · 4 duplicates · 2 blurred\npicked 10: at least one a month from January to October\nleft out 6 with a resident’s face close up'),
        tool('bash', 'ffmpeg -i 01.jpg … -i 10.jpg -filter_complex "[0]zoompan=…,drawtext=text=January…[s0];…;[s0][s1]xfade=fade:duration=0.8:offset=2.6…" street-year.mp4', 'street-year.mp4 · 27 s · 1920×1080 · H.264'),
        tool('write', 'street-year.txt', 'the ten photos in order, with who sent each', 'new · 12 lines'),
      ],
      time: '6 min 40 s',
      reply: '**A 27-second film of ten photos,** January to October. Each one slowly pans or zooms, fades into the next, and its month sits in the corner. It is open beside this conversation.\n\nI left out photos with a resident’s face close up. `street-year.txt` lists the ten and who sent them, if you want to swap one.',
      extra: offer('street-year.mp4', 'Video · 27 s · 1080p · 18 MB'),
    }), view('street-year.mp4', filmView())),
    24: () => capScreen(24, 'Concert backing track', you('15:05', capOf[24][6], att('the-delicacy-of-gratitude.mp3', 'Audio · 5 min 06 s · CC BY')) + turn({
      tools: [
        tool('bash', 'uv tool install demucs', 'Installed 1 executable: demucs'),
        tool('bash', 'demucs --two-stems=vocals -d cpu the-delicacy-of-gratitude.mp3', 'Downloading: "…/hybrid_transformer/955717e8-8726e21a.th" 80.2M\nSelected model is a bag of 1 models.\nSeparated tracks will be stored in separated/htdemucs\nSeparating track the-delicacy-of-gratitude.mp3\n100%|██████████| 310.05/310.05 [03:21<00:00, 1.54seconds/s]'),
        tool('bash', 'ffmpeg -i no_vocals.wav -b:a 192k concert-backing.mp3 && ffmpeg -i vocals.wav -b:a 192k concert-vocal.mp3', 'concert-backing.mp3 · 5 min 06 s · 7.1 MB\nconcert-vocal.mp3 · 5 min 06 s · 7.1 MB'),
      ],
      time: '4 min 50 s',
      reply: 'Here are both. **The backing track** is for the pupils to sing to; **the vocal on its own** is for practising the melody. Listen beside this conversation: the same fourteen seconds as the original, the backing and the voice.\n\nThe song is CC BY, so the concert programme should name Radioontheshelf and SackJo22.',
      extra: offer('concert-backing.mp3', 'Audio · 5 min 06 s · 7.1 MB'),
    }), view('the-delicacy-of-gratitude', stemsView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 2: ['frank', 'talk'], 9: ['dave', 'audio'] },
};
