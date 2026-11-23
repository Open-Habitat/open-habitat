// node blocks/alice-04-market-video/assets.mjs: Alice's 30-second market video,
// cut, captioned and encoded with ffmpeg exactly as the agent in the scene does.
//
// Source footage is CC BY 3.0 from Wikimedia Commons (see NOTES.md for credits):
// block printing in Bagru and a snowy winter market. The script downloads both
// into $TMPDIR (cached between runs), cuts eleven shots to a vertical 9:16 frame,
// adds a title and an end card (drawtext, Instrument Sans from design-system/fonts),
// burns in captions.srt (libass), and writes into $ETUSIVU_ASSETS/alice-04-market-video/:
//   market-30s.mp4   720×1280 H.264, 25 fps, 30.0 s, no audio, +faststart, < 2 MB
//   market-30s.webp  the poster frame (the stamping shot with its caption)
// Set TMPDIR to your scratch directory first. Needs ffmpeg with libx264, libass,
// libfreetype and libwebp (Ubuntu's ffmpeg 6.1 has them).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = 'alice-04-market-video';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const work = join(tmpdir(), `${ID}-work`);
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
const FONT = join(root, 'design-system/fonts/instrument-sans-latin.woff2');
const FONTDIR = join(root, 'design-system/fonts');

const SOURCES = {
  bagru: 'https://upload.wikimedia.org/wikipedia/commons/0/04/Blockprinting_in_Bagru_-_India.webm',
  market: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Tampere_Christmas_Market.webm',
};
const src = {};
for (const [k, url] of Object.entries(SOURCES)) {
  src[k] = join(work, `${k}.webm`);
  if (!existsSync(src[k])) execFileSync('curl', ['-sSfL', '-A', 'etusivu-assets/1.0', '-o', src[k], url], { stdio: 'inherit' });
}

const W = 720, H = 1280, FPS = 25;
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// The cut: [source, start, duration, horizontal centre of the 9:16 crop (0–1), zoom].
// Shot boundaries come from ffmpeg's scdet; faces are left out, hands kept in.
const SHOTS = [
  ['market', 20.6, 4.0, 0.62, 1.0], // stalls in the snow, people walking in
  ['bagru', 14.75, 2.2, 0.27, 1.0], // the block goes down on the cloth
  ['bagru', 25.25, 1.6, 0.42, 1.0], // dipped in the colour tray
  ['bagru', 36.45, 1.3, 0.20, 1.0], // pressed, close (before the camera pans away)
  ['bagru', 62.4, 1.9, 0.45, 1.0], // fingers on the block
  ['bagru', 64.45, 1.9, 0.50, 1.0], // the next repeat on the stripes
  ['bagru', 48.6, 1.6, 0.55, 1.0], // hands lining up the next repeat
  ['bagru', 69.8, 1.5, 0.50, 1.0], // shelves of carved blocks
  ['bagru', 71.4, 1.4, 0.40, 1.0], // a printed pattern
  ['bagru', 58.15, 2.4, 0.72, 1.0], // hand along the stripes
  ['bagru', 93.95, 3.1, 0.66, 1.1], // an armful of indigo prints (the carrier's face cropped out)
  ['market', 78.65, 1.4, 0.62, 1.0], // the lights in the evening (no shop signs or landmarks)
];
const TITLE = 2.4, END = 30 - TITLE - SHOTS.reduce((s, x) => s + x[2], 0);

const segs = [];
const seg = (name) => { const f = join(work, `${String(segs.length).padStart(2, '0')}-${name}.mp4`); segs.push(f); return f; };
const mezz = ['-an', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '10'];
// ASCII only in drawtext: ffmpeg 6.1 drops the last glyph after a multibyte character.
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/'/g, "’").replace(/:/g, '\\:');
const text = (t, size, y, color = '0xf4ecdc', extra = '') => `drawtext=fontfile='${FONT}':text='${esc(t)}':fontsize=${size}:fontcolor=${color}:x=(w-tw)/2:y=${y}${extra}`;
const INK = '0x1d2b42'; // indigo, the colour of the last prints

// Title card.
ff(['-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${TITLE}`, '-vf', [
  text('EXAMPLE STUDIO', 30, 420, '0xd9b98a', ':borderw=0'),
  text('Printed', 128, 500), text('by hand.', 128, 640),
  text('Saturday 21 November', 34, 830, '0xd9cdb6'),
  `fade=t=out:st=${TITLE - 0.35}:d=0.35`,
].join(','), ...mezz, seg('title')]);

// Footage: crop 9:16 around the chosen centre, scale to 720×1280, a gentle grade.
for (const [k, ss, d, cx, z] of SHOTS) {
  const ch = Math.round(1080 / z), cw = Math.round(ch * 9 / 16);
  const x = Math.max(0, Math.min(1920 - cw, Math.round(cx * 1920 - cw / 2)));
  const y = Math.round((1080 - ch) / 2);
  const grade = k === 'market' ? 'eq=contrast=1.06:saturation=1.08:gamma=0.97,unsharp=5:5:0.4' : 'eq=contrast=1.04:saturation=1.05';
  ff(['-ss', String(ss), '-i', src[k], '-t', String(d), '-vf', `crop=${cw}:${ch}:${x}:${y},scale=${W}:${H}:flags=lanczos,${grade},fps=${FPS}`, ...mezz, seg(k)]);
}

// End card.
ff(['-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${END.toFixed(2)}`, '-vf', [
  text('Come and say hello', 58, 470), text('every Saturday', 58, 545),
  `drawbox=x=310:y=660:w=100:h=3:color=0xd9b98a:t=fill`,
  text('example.org/shop', 62, 720, '0xd9b98a'),
  'fade=t=in:st=0:d=0.4',
].join(','), ...mezz, seg('end')]);

// Captions: the SRT the agent writes, timed against the cut.
const starts = [TITLE];
for (const s of SHOTS) starts.push(starts.at(-1) + s[2]);
const at = (i) => starts[i];
const CAPS = [
  [at(0), at(1), 'Saturday at the winter market'],
  [at(1), at(3), 'Every piece printed by hand'],
  [at(3), at(7), 'One block, one colour at a time'],
  [at(7), at(10), 'A carved block for every pattern'],
  [at(10), at(12), 'New prints for winter'],
];
const ts = (t, sep) => { const ms = Math.round(t * 1000); const s = Math.floor(ms / 1000); return `00:00:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
const srt = join(work, 'captions.srt');
writeFileSync(srt, CAPS.map(([a, b, t], i) => `${i + 1}\n${ts(a, ',')} --> ${ts(b, ',')}\n${t}\n`).join('\n'));

// Join, burn in the captions and encode for the web: two-pass H.264 to fit 2 MB.
const list = join(work, 'concat.txt');
writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n') + '\n');
const style = 'FontName=Instrument Sans,Fontsize=15.5,Bold=0,Spacing=0.3,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BackColour=&H66000000,BorderStyle=1,Outline=1.0,Shadow=1.2,MarginV=62';
const vf = `subtitles='${srt}':fontsdir='${FONTDIR}':force_style='${style}',format=yuv420p`;
const mp4 = join(out, 'market-30s.mp4');
const enc = ['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-b:v', '470k', '-maxrate', '900k', '-bufsize', '1800k', '-g', '50', '-passlogfile', join(work, 'x264')];
ff([...enc, '-pass', '1', '-f', 'mp4', '/dev/null']);
ff([...enc, '-pass', '2', '-t', '30', '-movflags', '+faststart', mp4]);

// Poster: the first stamping shot with its caption, as WebP.
ff(['-ss', (at(1) + 1.2).toFixed(2), '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', join(out, 'market-30s.webp')]);

for (const f of ['market-30s.mp4', 'market-30s.webp']) console.log(f, Math.round(statSync(join(out, f)).size / 1024), 'KB');
