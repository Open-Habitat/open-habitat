// Alice · 09:02 · Market video. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { PLAY_SVG, you, tool, turn, offer, screen, view } from '../../engine/kit.mjs';

// ---------- This block's own views ----------
const CAPTIONS = ['Saturday at the market', 'Printed by hand in our studio', 'One block, one colour at a time', 'Wrapped while you wait', 'example.org/shop'];
const videoMock = () => `<div class="vid" data-vid><div class="vid-frame" data-k="0"><span class="vid-cloth" aria-hidden="true"></span><span class="vid-cap">${CAPTIONS[0]}</span><button type="button" class="vid-play" aria-label="Play">${PLAY_SVG}</button></div><div class="vid-bar"><span class="vid-prog"></span></div><p class="vid-meta"><span class="vid-t">0:00</span><span>0:30 · 5 captions</span></p></div>`;

export default {
  id: 'alice-04-market-video',
  kind: 'glimpse',
  day: 'alice',
  s: 'video',
  at: '09:02',
  ask: 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.',
  did: 'The clips are on her laptop. The agent copies them over, finds that the server has no video program, installs one into her own account, and cuts and captions the video. She watches it on the tram.',
  screen: () => screen('Market video', you('08:20', 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.') + turn({ tools: [
        tool('computer', 'Alice’s laptop › Pictures › Market 14 Nov', '3 clips · 4K · 6 min 12 s in all\ncopied to video/market-2026-11-14/'),
        tool('bash', 'ffmpeg -version', 'bash: ffmpeg: command not found'),
        tool('bash', 'install ffmpeg into ~/.local/bin', 'downloaded ffmpeg 7.1, static build, 79 MB\ninstalled for alice only; no administrator rights needed'),
        tool('write', 'video/market-2026-11-14/captions.srt', '5 captions'),
        tool('bash', 'ffmpeg -i stall.mov -i print.mov -i wrap.mov -filter_complex … market-30s.mp4', '30.0 s · 1080p · 14 MB'),
      ], time: '42 min 14 s', reply: 'A 30-second cut with five captions: the stall, printing, wrapping. It is open beside this conversation.', extra: offer('market-30s.mp4', 'Video · 30 s · 14 MB') }), view('market-30s.mp4', videoMock())),
};
