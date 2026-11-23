// Alice · 09:02 · Market video. The view plays the real cut that assets.mjs
// makes with ffmpeg: vertical 9:16, title and end card, captions burned in.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, offer, screen, view, thought, assets, esc, PLAY_SVG } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);
const CAPTIONS = ['Saturday at the winter market', 'Every piece printed by hand', 'One block, one colour at a time', 'A carved block for every pattern', 'New prints for winter'];

const SRT = `1
00:00:02,400 --> 00:00:06,400
Saturday at the winter market

2
00:00:06,400 --> 00:00:10,200
Every piece printed by hand

3
00:00:10,200 --> 00:00:16,900
One block, one colour at a time

4
00:00:16,900 --> 00:00:22,200
A carved block for every pattern

5
00:00:22,200 --> 00:00:26,700
New prints for winter`;

// The clip shows its poster with the captions readable, no native controls on
// top; client.js adds the controls and plays it on the first click. Muted, never
// autoplayed, nothing loads before the click (kit video() always draws controls).
const LABEL = `Market video, 30 seconds, muted. Captions: ${CAPTIONS.join('; ')}; ends on “Come and say hello every Saturday, example.org/shop”.`;
const clip = () => `<video class="mv-video" src="${esc(asset('market-30s.mp4'))}" poster="${esc(asset('market-30s.webp'))}" width="720" height="1280" muted playsinline preload="none" aria-label="${esc(LABEL)}"></video>`;

// The player: a phone-shaped frame around the real clip, its facts and credit.
const player = () => `<figure class="mv">
  <div class="mv-phone">${clip()}<button type="button" class="mv-play" aria-label="Play the market video, 30 seconds">${PLAY_SVG}<span>0:30</span></button></div>
  <figcaption class="mv-side">
    <p class="mv-k">Ready for the shop page and phones</p>
    <dl class="mv-facts">
      <div><dt>Length</dt><dd>0:30</dd></div>
      <div><dt>Frame</dt><dd>9:16 · 720 × 1280</dd></div>
      <div><dt>Captions</dt><dd>5, burned in</dd></div>
      <div><dt>Size</dt><dd>1.7 MB · H.264</dd></div>
    </dl>
    <ol class="mv-caps">${CAPTIONS.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
    <p class="mv-credit">Footage: “Blockprinting in Bagru” by Incredible India and “Tampere Christmas Market” by Sounds of Changes / Työväenmuseo Werstas, CC BY 3.0, via Wikimedia Commons; cut, cropped, graded and captioned.</p>
  </figcaption>
</figure>`;

export default {
  id: 'alice-04-market-video',
  kind: 'glimpse',
  day: 'alice',
  s: 'video',
  at: '09:02',
  ask: 'Cut Saturday’s market clips into a 30-second video for the shop page and our phone posts, with captions.',
  did: 'Her clips are still on her laptop. The agent copies them over, finds no video program on the server, installs ffmpeg into her own account and makes the cut: a title, the printing up close, captions people can read with the sound off. She watches it on the tram and posts it herself.',
  screen: () => screen('Market video',
    you('08:20', 'Cut Saturday’s market clips into a 30-second video for the shop page and our phone posts, with captions.') +
    turn({
      thoughts: [
        thought('Vertical 9:16 so it fills a phone; captions burned in because most people watch muted'),
        thought('Open on the stalls, then the printing up close, end on the shop address'),
      ],
      tools: [
        tool('computer', 'Alice’s laptop › Pictures › Market 21 Nov', '3 clips · 4K · 6 min 12 s in all\ncopied to video/market-2026-11-21/'),
        tool('bash', 'ffmpeg -version', 'bash: ffmpeg: command not found'),
        tool('bash', 'install ffmpeg into ~/.local/bin', 'downloaded ffmpeg 7.1, static build, 79 MB\ninstalled for alice only; no administrator rights needed'),
        tool('bash', 'ffmpeg -i stall.mov -vf scdet,metadata=print -f null -', '41 shot changes in 6 min 12 s\npicked 12 shots: stalls, inking, printing, the blocks, indigo'),
        tool('write', 'video/market-2026-11-21/captions.srt', SRT, 'new · 5 captions'),
        tool('bash', 'ffmpeg -f concat -i shots.txt -vf "subtitles=captions.srt:force_style=\'FontName=Instrument Sans\'" -c:v libx264 -b:v 470k -an -movflags +faststart market-30s.mp4', 'pass 1/2 … pass 2/2\nmarket-30s.mp4  30.0 s · 720×1280 · 25 fps · 1.7 MB'),
        tool('bash', 'ffmpeg -ss 7.6 -i market-30s.mp4 -frames:v 1 market-30s.webp', 'poster: the block going down, with its caption'),
      ],
      time: '42 min 14 s',
      reply: 'A 30-second vertical cut: the stalls in the snow, the printing up close, an armful of indigo, and your shop address at the end. Five captions, readable with the sound off. It is open beside this conversation; nothing is posted until you post it.',
      extra: offer('market-30s.mp4', 'Video · 30 s · 9:16 · 1.7 MB'),
    }),
    view('market-30s.mp4', player())),
};
