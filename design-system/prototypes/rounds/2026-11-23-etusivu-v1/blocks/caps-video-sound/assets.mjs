// node blocks/caps-video-sound/assets.mjs: the two showpieces of "Video and
// sound", each made by the program the block names. Writes into
// $ETUSIVU_ASSETS/caps-video-sound/:
//
//   street-year.mp4    ten CC0 street photos made into a slideshow by FFmpeg
//                      (slow pan and zoom, cross-fades, the month in the corner)
//   street-year.webp   its poster, a frame of the film
//   song-mix.mp4       14 s of a CC BY song, as released (AAC in MP4, no video)
//   song-backing.mp4   the same 14 s of Demucs' "no_vocals" stem
//   song-vocal.mp4     the same 14 s of Demucs' "vocals" stem
//   wave-*.svg         the waveform of each clip, drawn from its own samples
//
// Programs: FFmpeg (the system's, 6.1.1 when this was written) with libx264
// and the native AAC encoder; Demucs 4.0.1 (htdemucs, torch 2.5.1 CPU) in a uv
// venv; fontTools to turn the design system's Instrument Sans into a TTF for
// FFmpeg's drawtext. Installed into $CAPS_VIDEO_SOUND_WORK (default
// $TMPDIR/caps-video-sound-work); needs uv and network on the first run
// (about 1.5 GB of scratch, a few minutes of CPU). Set TMPDIR to your scratch.
// Sources and licences of the photos and the song: NOTES.md beside this file.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ds = resolve(here, '../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-video-sound');
const work = process.env.CAPS_VIDEO_SOUND_WORK || join(tmpdir(), 'caps-video-sound-work');
const dl = join(work, 'dl');
const photos = join(work, 'photos');
for (const d of [out, dl, photos]) mkdirSync(d, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 28, ...opts });
const ff = (args) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const UA = 'etusivu-assets/1.0 (landing page build)';
// Downloads are kept in the work directory, so a second run needs no network.
const fetchTo = (path, url, extra = []) => { if (!existsSync(path)) run('curl', ['-sSfL', '--retry', '3', '-m', '600', '-A', UA, ...extra, '-o', path, url]); return path; };
const venv = (name, pkgs, extra = []) => {
  const bin = join(work, name, 'bin');
  if (!existsSync(join(bin, 'python'))) {
    run('uv', ['venv', '-q', '--python', '3.11', join(work, name)]);
    run('uv', ['pip', 'install', '-q', '--python', join(bin, 'python'), ...extra, ...pkgs]);
  }
  return bin;
};

// ---------- 1. A year of street photos into a slideshow: FFmpeg ----------
// Ten CC0 photographs by Fons Heijnsbroek from Wikimedia Commons, in the order
// of the months the film gives them (the season each photo shows). The
// captions are the film's own; no place names.
const SHOTS = [
  ['January', 'Amsterdam by night in snow evening - at the street Kattenburgergracht.jpg'],
  ['March', 'Urban nature at Bellamyplein, Amsterdam-W.jpg'],
  ['April', '2015 Facade garden in the neighbourhood Kadijken in early Spring in Amsterdam city - free download photo by Fons Heijnsbroek.jpg'],
  ['April', '2015 Free photo of a pot garden in the street Plantage Kerklaan on a sunny day in Spring of Amsterdam, with partly the house facades. Street photography in high resolutions by Fons Heijnsbroek.jpg'],
  ['May', 'Sunlight and shadows on the leaves in Fall, Amsterdam city, along the street Sarhpatistraat; on the border of the old city center of Amsterdam; urban photography, Fons Heijnsbroek 2013 (11132096545).jpg'],
  ['June', 'A view on back-gardens in full spring between HoogteKadijk and Laagtekadijk, Amsterdam; FotoDutch, May 2013.jpg'],
  ['June', 'A view on urban hollyhocks in front of the brick house-facades, Hoogte Kadijk, Amsterdam; high resolution image by FotoDutch, June 2013.jpg'],
  ['July', 'A red bicycle is parked in front of a brick house facade under the windows, and flowering hollyhocks; free photo of Amsterdam city by Fons Heijnsbroek, Summer 2009.tif'],
  ['September', 'Photo of Amsterdam nature, free download; small facade garden with flowering butterfly bush and fig tree with ripe figs in front of the brick house front. Photo Fons Heijnsbroek, street photography of The Netherlands in high resolution.tif'],
  ['October', 'A photo of a playground square in Amsterdam city with plane trees in Autumn; location Herenmarkt, old town - free download; Fons Heijnsbroek, street photography of The Netherlands in high resolution; free image CC0.tif'],
];
const files = SHOTS.map(([, title], k) => fetchTo(join(photos, `${String(k + 1).padStart(2, '0')}.jpg`), `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=2560`));

// drawtext needs a TTF: the design system's Instrument Sans (OFL), unpacked.
const font = join(work, 'InstrumentSans.ttf');
if (!existsSync(font)) {
  const bin = venv('venv-fonttools', ['fonttools==4.55.3', 'brotli==1.1.0']);
  run(join(bin, 'python'), ['-I', '-c', 'import sys\nfrom fontTools.ttLib import TTFont\nf = TTFont(sys.argv[1]); f.flavor = None; f.save(sys.argv[2])', join(ds, 'fonts/instrument-sans-latin.woff2'), font]);
}

// Each photo: cropped to 16:9, scaled up twice the output so zoompan moves
// smoothly, then a slow push in or pull out (alternating) over SEG seconds,
// with its month in the lower left. The segments are joined with xfade.
const W = 960, H = 540, FPS = 30, SEG = 3.4, FADE = 0.8, KBPS = 520;
const frames = Math.round(SEG * FPS);
const seg = (k, month) => {
  const z = k % 2 ? `1.12-0.12*on/${frames}` : `1+0.12*on/${frames}`;
  const pan = [`iw/2-(iw/zoom/2)`, `ih/2-(ih/zoom/2)`];
  if (k % 3 === 1) pan[0] = `(iw-iw/zoom)*on/${frames}`;
  if (k % 3 === 2) pan[0] = `(iw-iw/zoom)*(1-on/${frames})`;
  const title = k === 0 ? `,drawtext=fontfile='${font}':text='Our street, one year':fontsize=44:fontcolor=white:x=40:y=h-128:shadowcolor=black@0.45:shadowx=0:shadowy=2:alpha='if(lt(t,0.4),t/0.4,1)'` : '';
  return `[${k}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},setsar=1,`
    + `zoompan=z='${z}':x='${pan[0]}':y='${pan[1]}':d=${frames}:s=${W}x${H}:fps=${FPS},`
    + `drawtext=fontfile='${font}':text='${month}':fontsize=24:fontcolor=white:x=40:y=h-64:box=1:boxcolor=black@0.5:boxborderw=8|12${title},format=yuv420p[s${k}]`;
};
let chain = SHOTS.map(([m], k) => seg(k, m)).join(';');
let last = 's0';
for (let k = 1; k < SHOTS.length; k++) {
  chain += `;[${last}][s${k}]xfade=transition=fade:duration=${FADE}:offset=${(k * (SEG - FADE)).toFixed(2)}[x${k}]`;
  last = `x${k}`;
}
const total = SHOTS.length * SEG - (SHOTS.length - 1) * FADE;
chain += `;[${last}]fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6[v]`;
const film = join(out, 'street-year.mp4');
// One still per input: zoompan makes the whole segment from it. Two passes at
// a set bitrate, so the film lands under the page's 2 MB video budget.
const enc = (pass, dst) => ff([...files.flatMap((f) => ['-i', f]), '-filter_complex', chain, '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${KBPS}k`, '-pass', String(pass), '-passlogfile', join(work, 'x264-street'), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', ...(pass === 1 ? ['-f', 'mp4', '/dev/null'] : [dst])]);
enc(1); enc(2, film);
// The poster: the red bicycle (July), halfway through its segment.
ff(['-ss', (7 * (SEG - FADE) + SEG / 2).toFixed(2), '-i', film, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', join(out, 'street-year.webp')]);

// ---------- 2. A song split into backing track and vocal: Demucs ----------
// "The Delicacy Of Gratitude" by Radioontheshelf, vocals by SackJo22, from
// ccMixter, CC BY 3.0. ccMixter answers 403 without a referer.
const songPage = 'https://ccmixter.org/files/Radioontheshelf/68570';
const song = fetchTo(join(dl, 'delicacy-of-gratitude.mp3'), 'https://ccmixter.org/content/Radioontheshelf/Radioontheshelf_-_The_Delicacy_Of_Gratitude_1.mp3', ['-e', songPage]);
const sep = join(work, 'sep/htdemucs/delicacy-of-gratitude');
if (!existsSync(join(sep, 'vocals.wav'))) {
  const bin = venv('venv-demucs', ['torch==2.5.1', 'torchaudio==2.5.1', 'numpy<2', 'demucs==4.0.1', 'soundfile==0.12.1'], ['--extra-index-url', 'https://download.pytorch.org/whl/cpu']);
  // The whole song, as the person would run it; the model weights download on first use.
  // TORCH_HOME keeps the model weights in the work directory, not in ~/.cache.
  run(join(bin, 'demucs'), ['--two-stems=vocals', '-d', 'cpu', '-o', join(work, 'sep'), song], { stdio: 'inherit', env: { ...process.env, TORCH_HOME: join(work, 'torch') } });
}

// Mono samples at a low rate are enough to find the clip and draw waveforms.
const pcm = (file, rate, extra = []) => {
  const b = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...extra, '-i', file, '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-']);
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
};
// The clip: the 14 s window where the voice is strongest, on whole seconds.
const CLIP = 14;
const voc = pcm(join(sep, 'vocals.wav'), 1000);
const sec = Array.from({ length: Math.floor(voc.length / 1000) }, (_, s) => { let e = 0; for (let i = s * 1000; i < (s + 1) * 1000; i++) e += voc[i] * voc[i]; return e; });
let start = 0, best = -1;
for (let s = 0; s + CLIP <= sec.length; s++) { const e = sec.slice(s, s + CLIP).reduce((a, b) => a + b, 0); if (e > best) { best = e; start = s; } }
console.log(`clip ${start}–${start + CLIP} s of ${sec.length} s`);
const clips = { mix: song, backing: join(sep, 'no_vocals.wav'), vocal: join(sep, 'vocals.wav') };
for (const [k, src] of Object.entries(clips)) {
  ff(['-ss', String(start), '-t', String(CLIP), '-i', src, '-af', `afade=t=in:d=0.25,afade=t=out:st=${CLIP - 0.8}:d=0.8`, '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', '-vn', join(out, `song-${k}.mp4`)]);
}
// Waveforms: 112 bars of peak level per clip, all three on the original's
// scale, so the quiet gaps in the vocal show as quiet. The colours are the
// design system's (--ah-ink-2, --ah-accent, --ah-glyph-5): an <img> cannot
// read the page's custom properties, and a CSS mask is refused under file://.
const BARS = 112;
const peaks = Object.fromEntries(Object.keys(clips).map((k) => {
  const s = pcm(join(out, `song-${k}.mp4`), 8000);
  const n = Math.floor(s.length / BARS);
  return [k, Array.from({ length: BARS }, (_, b) => { let p = 0; for (let i = b * n; i < (b + 1) * n; i++) p = Math.max(p, Math.abs(s[i])); return p; })];
}));
const top = Math.max(...peaks.mix);
const COLOUR = { mix: '#3a453c', backing: '#2c6e3f', vocal: '#9b3d73' };
for (const [k, p] of Object.entries(peaks)) {
  const bars = p.map((v, b) => { const h = Math.max(1.5, Math.min(1, v / top) * 46); return `<rect x="${b * 5}" y="${(24 - h / 2).toFixed(1)}" width="3" height="${h.toFixed(1)}" rx="1.5"/>`; }).join('');
  writeFileSync(join(out, `wave-${k}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BARS * 5 - 2} 48" preserveAspectRatio="none" fill="${COLOUR[k]}">${bars}</svg>\n`);
}

for (const f of readdirSync(out)) if (!/^(street-year\.(mp4|webp)|song-(mix|backing|vocal)\.mp4|wave-(mix|backing|vocal)\.svg)$/.test(f)) rmSync(join(out, f));
console.log(run('sh', ['-c', 'cd "$1" && ls -l | tail -n +2 | awk \'{print $5, $9}\'', 'sh', out]).toString().trim());
