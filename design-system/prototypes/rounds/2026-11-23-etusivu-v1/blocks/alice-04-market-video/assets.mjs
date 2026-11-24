// node blocks/alice-04-market-video/assets.mjs: Alice's 30-second market video.
//
// Every frame is the block's own: the scenes are rendered with Mitsuba 3 (a
// physically based renderer, pip package `mitsuba`, version pinned below; Blender's
// official Linux build is x86-64 only, Mitsuba also runs on aarch64). The carved
// blocks, the brayer, the linen and its prints, the stacks and the market stall are
// built in the Python below (numpy meshes and procedural textures). ffmpeg then
// does what the agent in the scene does: cuts the shots to a vertical 9:16 frame,
// adds a title and an end card (drawtext, Instrument Sans from design-system/fonts),
// burns in captions.srt (libass) and encodes for the web. It writes into
// $ETUSIVU_ASSETS/alice-04-market-video/:
//   market-30s.mp4   720×1280 H.264, 25 fps, 30.0 s, no audio, +faststart, < 2 MB
//   market-30s.webp  the poster frame (the carved blocks, their caption visible)
// Set TMPDIR to your scratch first. MITSUBA_PY may name a Python that already has
// mitsuba and numpy, otherwise a venv is made under TMPDIR. SPP=112 by default
// (about 25 minutes on 8 aarch64 cores); RENDERED=<dir> reuses earlier renders.
// Needs ffmpeg with libx264, libass, libfreetype and libwebp (Ubuntu's 6.1 has them).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ID = 'alice-04-market-video';
const MITSUBA = '3.9.1';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const work = join(tmpdir(), `${ID}-work`);
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
const FONT = join(root, 'design-system/fonts/instrument-sans-latin.woff2');
const FONTDIR = join(root, 'design-system/fonts');
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env } });
const ff = (args) => run('ffmpeg', ['-v', 'error', '-y', ...args]);

const W = 720, H = 1280, FPS = 25;
// ASCII only in drawtext: ffmpeg 6.1 drops the last glyph after a multibyte character.
const esc = (t) => t.replace(/\\/g, '\\\\').replace(/'/g, '’').replace(/:/g, '\\:');
const text = (t, size, y, color = '0xf4ecdc', extra = '') => `drawtext=fontfile='${FONT}':text='${esc(t)}':fontsize=${size}:fontcolor=${color}:x=(w-tw)/2:y=${y}${extra}`;
const INK = '0x26385e'; // the studio's indigo

// 1. Render the scenes. The stall's sign is a texture drawn with the same font.
const rendered = process.env.RENDERED || join(work, 'render');
if (!existsSync(join(rendered, 'stall-evening.png'))) {
  let py = process.env.MITSUBA_PY;
  if (!py) {
    const venv = join(work, 'venv');
    py = join(venv, 'bin/python');
    if (!existsSync(py)) {
      run('python3', ['-m', 'venv', venv]);
      run(py, ['-m', 'pip', 'install', '-q', `mitsuba==${MITSUBA}`, 'numpy']);
    }
  }
  const sign = join(work, 'sign.png');
  ff(['-f', 'lavfi', '-i', `color=c=${INK}:s=900x300`, '-frames:v', '1', '-vf', [
    text('EXAMPLE STUDIO', 110, '(h-th)/2-20'), text('hand block prints', 44, 210, '0xd9b98a'),
  ].join(','), sign]);
  const script = join(work, 'render.py');
  writeFileSync(script, RENDER_PY());
  run(py, ['-I', script, rendered, sign], { SPP: process.env.SPP || '112', RW: '540', RH: '960' });
}

// 2. The cut. Animated shots are frame sequences (540×960, scaled up and lightly
// denoised over time); stills get a slow push or pan. [name, seconds, move]
const SHOTS = [
  ['stall', 3.6, 'push'],          // the stall at dusk, the sign, lights coming on
  ['block', 3.0, null],            // the carved block, slow orbit
  ['roller', 3.2, null],           // indigo rolled onto the block
  ['press', 3.6, null],            // pressed onto the linen, lifted: a fresh print
  ['repeat', 3.8, null],           // the repeat, print by print, from above
  ['blocks', 3.4, 'pan'],          // a carved block for every pattern
  ['stack', 2.8, 'push'],          // finished pieces, folded
  ['stall-evening', 1.8, 'push'],  // the stall in the evening
];
const TITLE = 2.4, END = 30 - TITLE - SHOTS.reduce((s, x) => s + x[1], 0);
const segs = [];
const seg = (name) => { const f = join(work, `${String(segs.length).padStart(2, '0')}-${name}.mp4`); segs.push(f); return f; };
const mezz = ['-an', '-r', String(FPS), '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '10'];
const grade = 'eq=contrast=1.04:saturation=1.06,vignette=angle=PI/6';

ff(['-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${TITLE}`, '-vf', [
  text('EXAMPLE STUDIO', 30, 420, '0xd9b98a'),
  text('Printed', 128, 500), text('by hand.', 128, 640),
  text('Saturday 21 November', 34, 830, '0xd9cdb6'),
  `fade=t=out:st=${TITLE - 0.35}:d=0.35`,
].join(','), ...mezz, seg('title')]);

for (const [name, d, move] of SHOTS) {
  const n = Math.round(d * FPS);
  if (!move) {
    ff(['-framerate', String(FPS), '-i', join(rendered, name, '%03d.png'), '-frames:v', String(n), '-vf',
      `hqdn3d=1.5:1.5:6:6,scale=${W}:${H}:flags=lanczos,${grade}`, ...mezz, seg(name)]);
    continue;
  }
  // zoompan on a 4× upscale, so the slow move does not step from pixel to pixel
  const z = move === 'push' ? `zoom='1+0.10*on/${n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2'`
    : `zoom='1.12':x='iw/2-iw/zoom/2':y='(ih-ih/zoom)*(0.15+0.7*on/${n})'`;
  ff(['-loop', '1', '-i', join(rendered, `${name}.png`), '-frames:v', String(n), '-vf',
    `scale=iw*4:ih*4:flags=lanczos,zoompan=${z}:d=${n}:s=${W}x${H}:fps=${FPS},hqdn3d=1:1:3:3,${grade}`, ...mezz, seg(name)]);
}

ff(['-f', 'lavfi', '-i', `color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${END.toFixed(2)}`, '-vf', [
  text('Come and say hello', 58, 470), text('every Saturday', 58, 545),
  'drawbox=x=310:y=660:w=100:h=3:color=0xd9b98a:t=fill',
  text('example.org/shop', 62, 720, '0xd9b98a'),
  'fade=t=in:st=0:d=0.4',
].join(','), ...mezz, seg('end')]);

// 3. Captions: the SRT the agent writes, timed against the cut.
const starts = [TITLE];
for (const s of SHOTS) starts.push(starts.at(-1) + s[1]);
const at = (i) => starts[i];
const CAPS = [
  [at(0), at(1), 'Saturday at the winter market'],
  [at(1), at(3), 'Every piece printed by hand'],
  [at(3), at(5), 'One block, one colour at a time'],
  [at(5), at(6), 'A carved block for every pattern'],
  [at(6), at(8), 'New prints for winter'],
];
const ts = (t, sep) => { const ms = Math.round(t * 1000); const s = Math.floor(ms / 1000); return `00:00:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
const srt = join(work, 'captions.srt');
writeFileSync(srt, CAPS.map(([a, b, t], i) => `${i + 1}\n${ts(a, ',')} --> ${ts(b, ',')}\n${t}\n`).join('\n'));
console.log(CAPS.map(([a, b, t]) => `${ts(a, ',')} --> ${ts(b, ',')}  ${t}`).join('\n'));

// 4. Join, burn in the captions and encode for the web: two-pass H.264 to fit 2 MB.
const list = join(work, 'concat.txt');
writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n') + '\n');
const style = 'FontName=Instrument Sans,Fontsize=15.5,Bold=0,Spacing=0.3,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BackColour=&H66000000,BorderStyle=1,Outline=1.0,Shadow=1.2,MarginV=62';
const vf = `subtitles='${srt}':fontsdir='${FONTDIR}':force_style='${style}',format=yuv420p`;
const mp4 = join(out, 'market-30s.mp4');
const BITRATE = process.env.BITRATE || '480k';
const enc = ['-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-b:v', BITRATE, '-maxrate', '950k', '-bufsize', '1900k', '-g', '50', '-passlogfile', join(work, 'x264')];
ff([...enc, '-pass', '1', '-f', 'mp4', '/dev/null']);
ff([...enc, '-pass', '2', '-t', '30', '-movflags', '+faststart', mp4]);

// 5. Poster: the six carved blocks, mid-pan, with their caption, as WebP.
const POSTER = at(5) + 1.4;
ff(['-ss', POSTER.toFixed(2), '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', join(out, 'market-30s.webp')]);

for (const f of ['market-30s.mp4', 'market-30s.webp']) console.log(f, Math.round(statSync(join(out, f)).size / 1024), 'KB');

function RENDER_PY() {
  return String.raw`
import sys, os, math, time
import numpy as np
import mitsuba as mi
mi.set_variant(os.environ.get('MI_VARIANT', 'llvm_ad_rgb'))
from mitsuba import ScalarTransform4f as T

OUT = sys.argv[1]
SIGN = sys.argv[2] if len(sys.argv) > 2 else None
SPP = int(os.environ.get('SPP', '48'))
W, H = int(os.environ.get('RW', '540')), int(os.environ.get('RH', '960'))
FPS = 25
ONLY = os.environ.get('ONLY', '').split(',') if os.environ.get('ONLY') else None
FRAMES = os.environ.get('FRAMES')  # "a:b" for tests
os.makedirs(OUT, exist_ok=True)

def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float) / 255.0
def lin(h):
    c = hexrgb(h); return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def smooth(t):
    t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)

def blur(a, k):
    # box blur, both axes, wrapping (cheap, via cumulative sums)
    for ax in (0, 1):
        c = np.cumsum(np.concatenate([a.take(range(-k, 0), ax), a, a.take(range(0, k), ax)], ax), ax)
        n = a.shape[ax]
        a = (c.take(range(2 * k, 2 * k + n), ax) - c.take(range(0, n), ax)) / (2 * k)
    return a
def norm(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)

OAT = '#ddd2bf'; INDIGO = '#26385e'; RUST = '#a5502f'; OCHRE = '#c08a2e'; SAGE = '#8d9a7b'

# ---------------- Textures ----------------
def weave(n, threads, seed=1):
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    xi = (x * threads).astype(int) % threads; yi = (y * threads).astype(int) % threads
    slub_w = norm(blur(r.random((threads, n)), 12)) - 0.5
    slub_f = norm(blur(r.random((threads, n)), 12)) - 0.5
    tw = r.normal(0, 1, threads); tf = r.normal(0, 1, threads)
    px = np.arange(n)
    warp = 0.5 + 0.5 * np.cos(2 * np.pi * x * threads) ** 2
    weft = 0.5 + 0.5 * np.cos(2 * np.pi * y * threads) ** 2
    checker = (xi + yi) % 2
    tone_w = tw[xi] * 0.05 + slub_w[xi, px[:, None]] * 0.2
    tone_f = tf[yi] * 0.05 + slub_f[yi, px[None, :]] * 0.2
    return norm(np.where(checker > 0, warp * (1 + tone_w), weft * (1 + tone_f))).astype(np.float32)

# Motifs on the block face, in [0,1]^2 block coordinates (True = raised = prints).
def m_rosette(x, y):
    cx, cy = x - 0.5, y - 0.5
    d = np.hypot(cx, cy); a = np.arctan2(cy, cx)
    m = d < 0.07
    rr = np.clip((d - 0.09) / 0.2, 0, 1)
    da = np.abs(((a * 8 / (2 * np.pi)) % 1) - 0.5) * (2 * np.pi / 8)
    petal = (d > 0.09) & (d < 0.30) & (da < 0.36 * np.sin(np.pi * rr) ** 0.8 * (1 + 0.0 * rr))
    petal &= ~((d > 0.15) & (d < 0.23) & (da < 0.06))
    m |= petal
    ring = np.abs(d - 0.35) < 0.024
    m |= ring
    edge = np.maximum(np.abs(cx), np.abs(cy))
    for k in range(4):
        ang = k * np.pi / 2 + np.pi / 4
        m |= np.hypot(cx - 0.40 * math.cos(ang), cy - 0.40 * math.sin(ang)) < 0.05
    m |= (edge > 0.448) & (edge < 0.478)
    return m
def m_sprigs(x, y):
    m = np.zeros(x.shape, bool)
    for (cx, cy, ang) in ((0.3, 0.3, 0.7), (0.7, 0.7, 0.7), (0.7, 0.3, -0.7), (0.3, 0.7, -0.7)):
        dx, dy = x - cx, y - cy
        u = dx * math.cos(ang) + dy * math.sin(ang); v = -dx * math.sin(ang) + dy * math.cos(ang)
        m |= (np.abs(v) < 0.018) & (np.abs(u) < 0.21)
        for t, s in ((-0.12, 1), (-0.04, -1), (0.04, 1), (0.12, -1)):
            lu = u - t; lv = v - s * 0.065
            m |= (np.abs(lu) / 0.07) ** 1.3 + (np.abs(lv) / 0.04) < 1
    return m
def m_sun(x, y):
    cx, cy = x - 0.5, y - 0.5
    d = np.hypot(cx, cy); a = np.arctan2(cy, cx)
    return (d < 0.13) | ((d > 0.18) & (d < 0.23)) | ((d > 0.28) & (d < 0.42) & (np.cos(a * 12) > 0.45 + (d - 0.28) * 2))
def m_chevron(x, y):
    xx = np.abs(x - 0.5)
    yy = (y * 3 + xx * 1.6) % 1
    return (np.abs(yy - 0.5) < 0.17) & (xx < 0.46)
def m_dots(x, y):
    m = np.zeros(x.shape, bool)
    for i in range(4):
        for j in range(4):
            m |= np.hypot(x - (i + 0.5) / 4, y - (j + 0.5) / 4) < 0.07 + 0.02 * ((i + j) % 2)
    return m
def m_waves(x, y):
    return (np.abs(((y * 5 + 0.08 * np.sin(x * 2 * np.pi * 2)) % 1) - 0.5) < 0.16) & (np.abs(x - 0.5) < 0.46)

MOTIFS = {'rosette': m_rosette, 'sprigs': m_sprigs, 'sun': m_sun, 'chevron': m_chevron, 'dots': m_dots, 'waves': m_waves}

def motif_raster(fn, n, inset=0.06, soft=1):
    # the carved face: motif inside a margin, rounded by a small blur
    t = (np.arange(n) + 0.5) / n
    y, x = np.meshgrid(t, t, indexing='ij')
    xs, ys = (x - inset) / (1 - 2 * inset), (y - inset) / (1 - 2 * inset)
    inside = (xs > 0) & (xs < 1) & (ys > 0) & (ys < 1)
    m = (fn(xs, ys) & inside).astype(np.float32)
    if soft: m = blur(m, soft)
    return m

def blur_ax(a, k, ax):
    c = np.cumsum(np.concatenate([a.take(range(-k, 0), ax), a, a.take(range(0, k), ax)], ax), ax)
    n = a.shape[ax]
    return (c.take(range(2 * k, 2 * k + n), ax) - c.take(range(0, n), ax)) / (2 * k)

def wood(n, seed, tone='#7a4f2e', planks=4, contrast=1.0):
    """Planks running along x: long streaky grain, growth lines that wander, a seam between planks."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    pl = np.floor(y * planks)
    py = (y * planks) % 1
    wander = norm(blur_ax(blur_ax(r.random((n, n)), n // 6, 1), n // 64 + 1, 0))
    lines = np.sin((py * 9 + pl * 0.37 + wander * 2.4) * 2 * np.pi)
    lines = np.sign(lines) * np.abs(lines) ** 0.6
    streak = norm(blur_ax(blur_ax(r.random((n, n)), n // 10, 1), 1, 0))
    tonepl = r.normal(0, 0.06, planks + 1)[pl.astype(int)]
    seam = 1 - 0.45 * np.exp(-((np.minimum(py, 1 - py) * n / planks) / 1.2) ** 2)
    g = (0.80 + contrast * (0.09 * lines + 0.16 * (streak - 0.5)) + tonepl) * seam
    return (lin(tone)[None, None, :] * g[..., None]).astype(np.float32)

def bmp(arr):
    return mi.Bitmap(np.ascontiguousarray(arr, dtype=np.float32))
def tex(arr, su=1.0, sv=1.0):
    return {'type': 'bitmap', 'bitmap': bmp(arr), 'raw': True, 'filter_type': 'bilinear',
            'to_uv': T().scale([su, sv, 1])}

# Linen: a weave height map, a ground colour, and prints composited into it.
class Linen:
    def __init__(self, n, size, ground, threads, seed, wc=0.2):
        self.n, self.size = n, size
        self.w = weave(n, n // 3, seed)
        g = lin(ground)
        self.base = (g[None, None, :] * (0.96 - wc / 2 + wc * self.w[..., None])).astype(np.float32)
        self.ink = np.zeros((n, n), np.float32)
        self.r = np.random.default_rng(seed + 100)
    def press(self, raster, cx, cy, bs, strength=1.0, rot=0):
        # print a block raster centred at (cx, cy) metres, block side bs metres
        k = int(round(bs / self.size * self.n))
        src = np.rot90(raster, rot)
        idx = (np.arange(k) * src.shape[0] / k).astype(int)
        s = src[np.ix_(idx, idx)]
        blot = norm(blur(self.r.random((k, k)), max(2, k // 10)))
        grain = blur(self.r.random((k, k)), 1)
        s = s * (0.8 + 0.22 * blot) * (1 - 0.3 * (grain > 0.66)) * strength
        x0 = int(round((cx / self.size + 0.5) * self.n - k / 2)); y0 = int(round((cy / self.size + 0.5) * self.n - k / 2))
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(self.n, x0 + k), min(self.n, y0 + k)
        if xb <= xa or yb <= ya: return
        sub = s[ya - y0:yb - y0, xa - x0:xb - x0]
        self.ink[ya:yb, xa:xb] = np.maximum(self.ink[ya:yb, xa:xb], sub)
    def bsdf(self, ink_col, opacity=0.95):
        a = (np.clip(self.ink, 0, 1) * opacity * (0.85 + 0.15 * (1 - self.w)))[..., None]
        ic = lin(ink_col)[None, None, :] * (0.85 + 0.2 * self.w[..., None])
        col = self.base * (1 - a) + ic * a
        # (no bump map: Mitsuba's bump on this fine a weave shades whole quadrants of the cloth)
        return {'type': 'principled', 'base_color': tex(np.clip(col, 0, 1)), 'roughness': 0.95, 'sheen': 0.4, 'specular': 0.1}

# ---------------- Meshes ----------------
def write_ply(name, P, F, UV):
    path = os.path.join(OUT, '_mesh', name + '.ply')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(('ply\nformat binary_little_endian 1.0\nelement vertex %d\nproperty float x\nproperty float y\nproperty float z\nproperty float u\nproperty float v\nelement face %d\nproperty list uchar int vertex_indices\nend_header\n' % (len(P), len(F))).encode())
        f.write(np.concatenate([P, UV], 1).astype('<f4').tobytes())
        ff = np.empty(len(F), dtype=[('n', 'u1'), ('i', '<i4', 3)]); ff['n'] = 3; ff['i'] = F
        f.write(ff.tobytes())
    return path

def grid_faces(nu, nv):
    i, j = np.meshgrid(np.arange(nu - 1), np.arange(nv - 1), indexing='ij')
    a = (i * nv + j).ravel(); b = a + 1; c = a + nv + 1; d = a + nv
    return np.concatenate([np.stack([a, b, c], 1), np.stack([a, c, d], 1)])

def heightfield(hmap, sx, sy, depth, n=None):
    # a grid over [-sx/2, sx/2] x [-sy/2, sy/2], z = depth * h, facing +z
    if n:
        idx = (np.arange(n) * hmap.shape[0] / n).astype(int)
        hmap = hmap[np.ix_(idx, idx)]
    nu, nv = hmap.shape
    # rows = y, cols = x
    yy, xx = np.meshgrid(np.linspace(0, 1, nu), np.linspace(0, 1, nv), indexing='ij')
    P = np.stack([(xx - 0.5) * sx, (yy - 0.5) * sy, hmap * depth], -1).reshape(-1, 3)
    UV = np.stack([xx, yy], -1).reshape(-1, 2)
    F = grid_faces(nu, nv)
    return P, F, UV

def box(sx, sy, sz, r=0.0):
    # an axis-aligned box from z=0 to z=sz, centred in x,y; UV from planar xz/yz projection
    v = np.array([[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], float)
    P = []; F = []; UV = []
    faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7), (3, 2, 1, 0)]
    for q in faces:
        base = len(P)
        for k, idx in enumerate(q):
            p = v[idx] * [sx / 2, sy / 2, sz]
            P.append(p); UV.append([(k in (1, 2)) * 1.0, (k in (2, 3)) * 1.0])
        F += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return np.array(P), np.array(F), np.array(UV)

def cylinder(r, length, n=64, axis='x'):
    t = np.linspace(0, 2 * np.pi, n + 1)
    x = np.array([-length / 2, length / 2])
    X, Tt = np.meshgrid(x, t, indexing='ij')
    P = np.stack([X, r * np.cos(Tt), r * np.sin(Tt)], -1).reshape(-1, 3)
    UV = np.stack([X / length + 0.5, Tt / (2 * np.pi)], -1).reshape(-1, 2)
    F = grid_faces(2, n + 1)
    # caps
    c0 = len(P); P = np.vstack([P, [[-length / 2, 0, 0], [length / 2, 0, 0]]]); UV = np.vstack([UV, [[0, 0], [1, 0]]])
    caps = [(c0, j, j + 1) for j in range(n)] + [(c0 + 1, (n + 1) + j + 1, (n + 1) + j) for j in range(n)]
    F = np.vstack([F, caps])
    if axis == 'z':
        P = P[:, [1, 2, 0]]
    elif axis == 'y':
        P = P[:, [2, 0, 1]]
    return P, F, UV

def xf(P, rx=0.0, ry=0.0, rz=0.0, t=(0, 0, 0)):
    cx, sx_ = math.cos(rx), math.sin(rx); cy, sy_ = math.cos(ry), math.sin(ry); cz, sz_ = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx_], [0, sx_, cx]]); Ry = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]]); Rz = np.array([[cz, -sz_, 0], [sz_, cz, 0], [0, 0, 1]])
    return P @ (Rz @ Ry @ Rx).T + np.array(t)

def cloth_slab(a, b, c, n=120, wr=0.0006, seed=0):
    t = np.linspace(-1, 1, n)
    y, x = np.meshgrid(t, t, indexing='ij')
    h = c * np.clip((1 - np.abs(x) ** 14) * (1 - np.abs(y) ** 14), 0, 1) ** 0.35
    r = np.random.default_rng(seed); ph = r.random(4) * 6.28
    w = wr * (np.sin(x * 9 + ph[0]) * np.sin(y * 7 + ph[1]) + 0.4 * np.sin(x * 21 + y * 17 + ph[2]))
    top = np.stack([a * x, b * y, c + h + w], -1).reshape(-1, 3)
    bot = np.stack([a * x, b * y, c - h + w * 0.5], -1).reshape(-1, 3)
    uv = np.stack([x * 0.5 + 0.5, y * 0.5 + 0.5], -1).reshape(-1, 2)
    F = grid_faces(n, n)
    return np.concatenate([top, bot]), np.concatenate([F, F[:, ::-1] + n * n]), np.concatenate([uv, uv])

def hanging(wd, ht, n=80, amp=0.006, seed=0):
    # a towel hanging from a rail at z=0 down to -ht, gentle folds, in the xz plane facing -y
    t = np.linspace(0, 1, n)
    zz, xx = np.meshgrid(t, t, indexing='ij')
    r = np.random.default_rng(seed); ph = r.random(3) * 6.28
    yv = amp * (np.sin(xx * 9 + ph[0]) * (0.4 + 0.6 * zz) + 0.4 * np.sin(xx * 17 + ph[1]))
    P = np.stack([(xx - 0.5) * wd, yv, -zz * ht], -1).reshape(-1, 3)
    UV = np.stack([xx, zz], -1).reshape(-1, 2)
    return P, grid_faces(n, n)[:, ::-1], UV

# ---------------- Scene assembly ----------------
class Scene:
    def __init__(self):
        self.d = {'type': 'scene', 'integrator': {'type': 'path', 'max_depth': 6}}
        self.k = 0
    def mesh(self, P, F, UV, bsdf, name=None):
        name = name or 'm%d' % self.k; self.k += 1
        self.d[name] = {'type': 'ply', 'filename': write_ply(name, P, F, UV), 'bsdf': bsdf, 'face_normals': False}
        return name
    def add(self, name, obj):
        self.d[name] = obj
    def camera(self, origin, target, fov, up=(0, 0, 1), w=None, h=None):
        self.d['sensor'] = {'type': 'perspective', 'fov': fov, 'fov_axis': 'x',
                            'to_world': T().look_at(origin=list(origin), target=list(target), up=list(up)),
                            'film': {'type': 'hdrfilm', 'width': w or W, 'height': h or H, 'rfilter': {'type': 'gaussian'}},
                            'sampler': {'type': 'independent', 'sample_count': SPP}}
    def light(self, name, origin, target, size, radiance):
        self.d[name] = {'type': 'rectangle', 'to_world': T().look_at(origin=list(origin), target=list(target), up=[0, 0, 1]).scale([size, size, 1]),
                        'emitter': {'type': 'area', 'radiance': {'type': 'rgb', 'value': list(radiance)}}}
    def env(self, rgb):
        self.d['env'] = {'type': 'constant', 'radiance': {'type': 'rgb', 'value': list(rgb)}}
    def render(self, path, seed=0, spp=None):
        sc = mi.load_dict(self.d)
        img = mi.render(sc, seed=seed, spp=spp or SPP)
        mi.Bitmap(img).convert(mi.Bitmap.PixelFormat.RGB, mi.Struct.Type.UInt8, srgb_gamma=True).write(path)

def plain(col, rough=0.8, spec=0.3, **kw):
    return {'type': 'principled', 'base_color': {'type': 'rgb', 'value': list(lin(col) if isinstance(col, str) else col)}, 'roughness': rough, 'specular': spec, **kw}

# Studio lighting for the table shots: a big soft window key, a warm fill.
def studio(sc, key=(-0.6, -0.5, 0.9), k=(9.0, 8.8, 8.2)):
    sc.light('key', key, (0, 0, 0), 0.45, k)
    sc.light('fill', (0.8, -0.6, 0.5), (0, 0, 0), 0.5, (1.1, 1.0, 0.9))
    sc.env((0.035, 0.032, 0.03))

TABLE_WOOD = wood(1024, 5, '#7d5b3e', planks=3)
BLOCK_WOOD = wood(512, 9, '#5e3a22', planks=1, contrast=0.7)
BS = 0.09    # block side, metres
BH = 0.035   # block body height
RELIEF = 0.005
RAS = {k: motif_raster(fn, 360) for k, fn in MOTIFS.items()}

def table(sc, size=3.0, z=0.0):
    P, F, UV = heightfield(np.zeros((2, 2)), size, size, 0)
    sc.mesh(P + [0, 0, z], F, UV, {'type': 'principled', 'base_color': tex(TABLE_WOOD, 4, 4), 'roughness': 0.55, 'specular': 0.35}, 'table')

def block(sc, name, motif, ink=None, face_up=True, t=(0, 0, 0), rz=0.0, lift=0.0, ink_col=INDIGO, handle=True):
    """A carved printing block. face_up: relief on top (z up); else relief facing down (printing)."""
    ras = RAS[motif]
    ink = np.zeros_like(ras) if ink is None else ink
    wc = BLOCK_WOOD.copy()
    n = ras.shape[0]
    idx = (np.arange(n) * wc.shape[0] / n).astype(int)
    wc = wc[np.ix_(idx, idx)]
    # carved-away floor is a little darker and rougher-looking; inked tops take the colour
    col = wc * (0.62 + 0.38 * ras[..., None])
    a = (ink * ras)[..., None] * 0.95
    col = col * (1 - a) + lin(ink_col)[None, None, :] * 0.6 * a
    rough = np.clip(0.75 - 0.5 * ink * ras, 0.2, 0.9)
    face_bsdf = {'type': 'principled', 'base_color': tex(col.astype(np.float32)), 'roughness': {'type': 'bitmap', 'bitmap': bmp(rough), 'raw': True}, 'specular': 0.45}
    side_bsdf = {'type': 'principled', 'base_color': tex(BLOCK_WOOD, 1, 0.4), 'roughness': 0.6, 'specular': 0.3}
    P, F, UV = heightfield(ras, BS, BS, RELIEF, n=240)
    Pb, Fb, UVb = box(BS, BS, BH)
    if face_up:
        Pf = P + [0, 0, BH]; Pbody = Pb
    else:
        Pf = xf(P, rx=math.pi) + [0, 0, 0]  # relief points down from z=0
        Pf = Pf + [0, 0, RELIEF]
        Pbody = Pb + [0, 0, RELIEF]
        Ph, Fh, UVh = cylinder(0.016, 0.055, axis='z')
        Ph = Ph + [0, 0, RELIEF + BH + 0.0275]
    off = np.array(t) + [0, 0, lift]
    sc.mesh(xf(Pf, rz=rz) + off, F, UV, face_bsdf, name + '_face')
    sc.mesh(xf(Pbody, rz=rz) + off, Fb, UVb, side_bsdf, name + '_body')
    if handle and not face_up:
        sc.mesh(xf(Ph, rz=rz) + off, Fh, UVh, side_bsdf, name + '_handle')
        sc.add(name + '_knob', {'type': 'sphere', 'center': list(np.array([0, 0, RELIEF + BH + 0.058]) + off), 'radius': 0.021, 'bsdf': side_bsdf})

def frames_of(n):
    if FRAMES:
        a, b = map(int, FRAMES.split(':')); return range(a, min(b, n))
    return range(n)

def want(name):
    return ONLY is None or name in ONLY

def done(name, t0):
    print('rendered', name, '%.0f s' % (time.time() - t0), flush=True)

# ---------- 1. The carved block, slow orbit ----------
def shot_block():
    n = int(3.0 * FPS); d = os.path.join(OUT, 'block'); os.makedirs(d, exist_ok=True); t0 = time.time()
    for f in frames_of(n):
        u = f / (n - 1)
        sc = Scene(); studio(sc, key=(-0.5, 0.2, 0.7)); table(sc)
        block(sc, 'b', 'rosette', rz=0.12)
        block(sc, 'b2', 'sprigs', t=(0.13, 0.11, 0), rz=-0.3)
        az = math.radians(-125 + 24 * smooth(u)); el = math.radians(48 - 5 * u); r = 0.25 - 0.03 * smooth(u)
        tgt = (0.01, 0.015, BH)
        sc.camera((tgt[0] + r * math.cos(el) * math.cos(az), tgt[1] + r * math.cos(el) * math.sin(az), tgt[2] + r * math.sin(el)), tgt, 34)
        sc.render(os.path.join(d, '%03d.png' % f), seed=f)
    done('block', t0)

# ---------- 2. Ink rolled onto the block ----------
def shot_roller():
    n = int(3.2 * FPS); d = os.path.join(OUT, 'roller'); os.makedirs(d, exist_ok=True); t0 = time.time()
    ras = RAS['rosette']; nn = ras.shape[0]
    xs = (np.arange(nn) + 0.5) / nn
    slab_ink = norm(blur(np.random.default_rng(3).random((256, 256)), 6))
    for f in frames_of(n):
        u = f / (n - 1)
        # the roller passes over twice: left->right, then back
        p = smooth(u / 0.55) if u < 0.55 else 1 - 0.85 * smooth((u - 0.55) / 0.45)
        rx = -0.075 + 0.15 * p                                  # roller x, block from -0.045..0.045
        cover = max(min(1.0, (rx + 0.045 + 0.015) / BS), 0.0)
        if u >= 0.55: cover = 1.0
        ink = np.broadcast_to((xs < cover).astype(np.float32)[None, :], ras.shape).copy()
        if u >= 0.55: ink = np.clip(ink * (0.85 + 0.15 * smooth((u - 0.55) / 0.45)), 0, 1)
        sc = Scene(); studio(sc, key=(-0.4, -0.6, 0.8)); table(sc)
        block(sc, 'b', 'rosette', ink=ink)
        # a slate inking tile with a rolled-out layer of indigo behind
        Pg, Fg, UVg = box(0.16, 0.12, 0.006)
        sc.mesh(Pg + [0.02, 0.15, 0], Fg, UVg, plain('#3a3d40', rough=0.6, spec=0.3), 'slate')
        Pi, Fi, UVi = heightfield(slab_ink * 0.3, 0.12, 0.08, 0.0008, n=64)
        sc.mesh(Pi + [0.02, 0.15, 0.0062], Fi, UVi, plain(INDIGO, rough=0.25, spec=0.6), 'slabink')
        # the brayer: rubber roller, steel frame, wooden handle
        rz_ = BH + RELIEF + 0.016
        Pr, Fr, UVr = cylinder(0.016, 0.11, axis='y')
        sc.mesh(Pr + [rx, 0, rz_], Fr, UVr, plain('#151c2e', rough=0.22, spec=0.7), 'roller')
        steel = plain('#b9bcc2', rough=0.25, spec=0.8, metallic=1.0)
        for s in (-1, 1):
            Pa, Fa, UVa = cylinder(0.0022, 0.05, n=16, axis='x')
            sc.mesh(xf(Pa, ry=0.64) + [rx - 0.02, s * 0.058, rz_ + 0.015], Fa, UVa, steel, 'arm%d' % (s > 0))
        Pa, Fa, UVa = cylinder(0.0022, 0.118, n=16, axis='y')
        sc.mesh(Pa + [rx - 0.04, 0, rz_ + 0.03], Fa, UVa, steel, 'bar')
        Ph, Fh, UVh = cylinder(0.011, 0.13, axis='x')
        sc.mesh(xf(Ph, ry=0.5) + [rx - 0.10, 0, rz_ + 0.064], Fh, UVh, {'type': 'principled', 'base_color': tex(TABLE_WOOD, 0.3, 1), 'roughness': 0.5}, 'handle')
        sc.camera((0.13, -0.21, 0.27), (-0.01, 0.035, BH), 38)
        sc.render(os.path.join(d, '%03d.png' % f), seed=f)
    done('roller', t0)

# ---------- 3. The print pressed onto linen ----------
def press_linen(nprev):
    L = Linen(2048, 0.96, OAT, 300, seed=4)
    rows = []
    for j in range(nprev):
        rows.append((-0.09 * (j + 1), 0.0))
    for (cx, cy) in rows:
        L.press(RAS['rosette'], cx, cy, BS, rot=0)
    for i in range(-3, 2):  # the row above, done earlier
        L.press(RAS['rosette'], -0.09 * i - 0.045 * 0, 0.09, BS)
    return L

def shot_press():
    n = int(3.6 * FPS); d = os.path.join(OUT, 'press'); os.makedirs(d, exist_ok=True); t0 = time.time()
    base = press_linen(2)
    after = press_linen(2); after.press(RAS['rosette'], 0, 0, BS, strength=1.0)
    for f in frames_of(n):
        tsec = f / FPS
        # descend 0..1.1 s, pressed 1.1..1.9, lift 1.9..3.6
        if tsec < 1.1: z = 0.11 * (1 - smooth(tsec / 1.1)); x = 0.03 * (1 - smooth(tsec / 1.1))
        elif tsec < 1.9: z = 0.0; x = 0.0
        else:
            v = smooth((tsec - 1.9) / 1.4); z = 0.16 * v; x = 0.10 * v
        L = after if tsec >= 1.9 else base
        sc = Scene(); studio(sc, key=(-0.5, -0.4, 0.9)); table(sc)
        P, F, UV = cloth_slab(0.3, 0.3, 0.0015, n=60, wr=0.0003)
        P = P * [1.6, 1.6, 1]
        sc.mesh(P, F, UV, L.bsdf(INDIGO), 'linen')
        block(sc, 'b', 'rosette', ink=np.ones_like(RAS['rosette']), face_up=False, t=(x, 0, 0.003), lift=z, rz=0.0)
        sc.camera((0.05, -0.17, 0.29), (-0.035, 0.03, 0.02), 44)
        sc.render(os.path.join(d, '%03d.png' % f), seed=f)
    done('press', t0)

# ---------- 4. The repeat, from above ----------
def shot_repeat():
    n = int(3.8 * FPS); d = os.path.join(OUT, 'repeat'); os.makedirs(d, exist_ok=True); t0 = time.time()
    L = Linen(2048, 0.7, OAT, 360, seed=8)
    # finished rows below; half-drop repeat
    pos = []
    for row in range(-3, 4):
        for col in range(-3, 4):
            pos.append((col * BS, row * BS + (BS / 2 if col % 2 else 0)))
    done_rows = [p for p in pos if p[1] < -0.01]
    for p in done_rows: L.press(RAS['sprigs'], p[0], p[1], BS)
    todo = sorted([p for p in pos if -0.01 <= p[1] < 0.06], key=lambda p: p[0])
    period = 0.52  # seconds per print
    for f in frames_of(n):
        tsec = f / FPS
        k = int(tsec / period); ph = (tsec % period) / period
        Lf = Linen.__new__(Linen); Lf.__dict__ = dict(L.__dict__); Lf.ink = L.ink.copy(); Lf.r = np.random.default_rng(77)
        for i in range(min(k, len(todo))):
            Lf.press(RAS['sprigs'], todo[i][0], todo[i][1], BS)
        cur = todo[min(k, len(todo) - 1)]; nxt = todo[min(k + 1, len(todo) - 1)]
        # block: down on cur during ph<0.35, then an arc to next
        if ph < 0.35: bx, by, bz = cur[0], cur[1], 0.0
        else:
            v = smooth((ph - 0.35) / 0.65); bx = cur[0] + (nxt[0] - cur[0]) * v; by = cur[1] + (nxt[1] - cur[1]) * v; bz = 0.05 * math.sin(math.pi * v)
        if ph >= 0.35 and k < len(todo):
            Lf.press(RAS['sprigs'], cur[0], cur[1], BS)
        sc = Scene(); studio(sc, key=(-0.4, 0.3, 1.0)); table(sc)
        P, F, UV = cloth_slab(0.35, 0.35, 0.0015, n=40, wr=0.0002)
        sc.mesh(P, F, UV, Lf.bsdf(RUST), 'linen')
        block(sc, 'b', 'sprigs', ink=np.ones_like(RAS['sprigs']), face_up=False, t=(bx, by, 0.003), lift=bz, ink_col=RUST)
        cx = -0.12 + 0.20 * (tsec / 3.8)
        sc.camera((cx, -0.06, 0.5), (cx, 0.01, 0.0), 32, up=(0, 1, 0))
        sc.render(os.path.join(d, '%03d.png' % f), seed=f)
    done('repeat', t0)

# ---------- 5. A carved block for every pattern (a still to pan over) ----------
def shot_blocks():
    t0 = time.time()
    sc = Scene(); studio(sc, key=(-0.5, 0.4, 0.9)); table(sc)
    cols = [INDIGO, RUST, OCHRE, SAGE, INDIGO, RUST]
    names = ['rosette', 'sprigs', 'sun', 'chevron', 'dots', 'waves']
    r = np.random.default_rng(2)
    for i, m in enumerate(names):
        cx = (i % 2 - 0.5) * 0.115; cy = (1 - i // 2) * 0.12
        ink = np.ones_like(RAS[m]) * (0.55 if i % 3 else 0.0)  # some used, some clean
        block(sc, 'b%d' % i, m, ink=ink, t=(cx + r.normal(0, 0.004), cy + r.normal(0, 0.004), 0), rz=r.normal(0, 0.06), ink_col=cols[i])
    sc.camera((0.0, -0.04, 0.56), (0.0, 0.0, 0.0), 32, up=(0, 1, 0), w=int(W * 1.5), h=int(H * 1.5))
    sc.render(os.path.join(OUT, 'blocks.png'), seed=1, spp=SPP * 2)
    done('blocks', t0)

# ---------- 6. The stack of finished pieces (a still to push in on) ----------
def printed(ground, ink, motif, seed, n=768, size=0.3, bs=0.045, wc=0.2, two=False):
    L = Linen(n, size, ground, 160, seed, wc=wc)
    for row in range(-4, 5):
        for col in range(-4, 5):
            L.press(RAS[motif], col * bs, row * bs + (bs / 2 if col % 2 else 0), bs)
    b = L.bsdf(ink, 0.85)
    return {'type': 'twosided', 'bsdf': b} if two else b

def stack(sc, base=(0, 0, 0), rz=0.0, spec=None, sc_=1.0, tag=True, wc=0.2, n=768):
    spec = spec or [(INDIGO, OAT, 'sprigs'), (OAT, RUST, 'chevron'), (SAGE, OAT, 'dots'), (OAT, INDIGO, 'rosette'), (RUST, OAT, 'waves'), (OAT, OCHRE, 'sun')]
    z = 0.0
    for i, (g, ink, m) in enumerate(spec):
        P, F, UV = cloth_slab(0.15 * sc_, 0.10 * sc_, 0.008 * sc_, n=60, seed=i, wr=0.0008)
        jit = [(0.004, -0.003), (-0.005, 0.002), (0.003, 0.004), (-0.002, -0.004), (0.005, 0.001), (-0.003, 0.003)][i % 6]
        sc.mesh(xf(P, rz=rz + 0.03 * ((i % 3) - 1)) + [base[0] + jit[0], base[1] + jit[1], base[2] + z], F, UV, printed(g, ink, m, 20 + i, wc=wc, n=n), 'pc%d_%d' % (len(sc.d), i))
        z += 0.0165 * sc_

def shot_stack():
    t0 = time.time()
    sc = Scene(); studio(sc, key=(-0.6, -0.2, 0.7), k=(8.0, 7.4, 6.6)); table(sc)
    stack(sc, rz=0.15)
    stack(sc, base=(0.26, 0.16, 0), rz=-0.2, spec=[(RUST, OAT, 'waves'), (OAT, INDIGO, 'sprigs'), (INDIGO, OAT, 'dots'), (OAT, RUST, 'rosette')])
    sc.camera((-0.08, -0.25, 0.40), (0.05, 0.03, 0.03), 40, w=int(W * 1.4), h=int(H * 1.4))
    sc.render(os.path.join(OUT, 'stack.png'), seed=2, spp=SPP * 2)
    done('stack', t0)

# ---------- 7. The market stall, dusk and evening ----------
def cone(r, h, n=24):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    P = np.vstack([np.stack([r * np.cos(t), r * np.sin(t), np.zeros(n)], 1), [[0, 0, h]]])
    F = np.array([(i, (i + 1) % n, n) for i in range(n)])
    UV = np.zeros((n + 1, 2))
    return P, F, UV

def valance_tex(wm, hm, bg, sign=None):
    px = 300
    w = int(round(wm / hm * px))
    a = np.broadcast_to(lin(bg).astype(np.float32), (px, w, 3)).copy()
    if sign is not None:
        sh_, sw_ = sign.shape[:2]
        k = px / sh_
        idx_y = (np.arange(px) / k).astype(int); nw = int(sw_ * k); idx_x = (np.arange(nw) / k).astype(int)
        s2 = sign[np.ix_(idx_y, idx_x)]
        x0 = (w - nw) // 2
        a[:, x0:x0 + nw] = s2
    # a gold piping along the bottom edge
    a[-10:-4] = lin('#d9b98a')
    return a

def booth(sc, pre, origin, rz, evening, stripe=('#efe6d6', '#2c3e63'), goods=False, sign=None, drape=None, bulbs=14):
    o = np.array(origin, float)
    put = lambda P: xf(P, rz=rz) + o
    tw, td, th = 1.8, 0.7, 0.78
    wood_b = {'type': 'principled', 'base_color': tex(TABLE_WOOD, 1, 0.3), 'roughness': 0.6}
    Pb, Fb, UVb = box(tw, td, 0.04)
    sc.mesh(put(Pb + [0, 0, th - 0.04]), Fb, UVb, wood_b, pre + 'top')
    Pc, Fc, UVc = box(tw + 0.04, 0.01, th - 0.04)
    sc.mesh(put(Pc + [0, -td / 2 - 0.012, 0]), Fc, UVc, drape or plain(stripe[1], rough=0.9, spec=0.1), pre + 'drape')
    post = plain('#5a3e28', rough=0.7)
    Pp, Fp, UVp = cylinder(0.035, 2.3, axis='z')
    for sx in (-1, 1):
        for sy in (-1, 1):
            sc.mesh(put(Pp + [sx * (tw / 2 + 0.05), sy * (td / 2 + 0.05), 1.15]), Fp, UVp, post, pre + 'post%d%d' % (sx > 0, sy > 0))
    st = np.zeros((64, 512, 3), np.float32)
    xs = np.arange(512)
    band = ((xs // 48) % 2).astype(bool)
    st[:, band] = lin(stripe[0]); st[:, ~band] = lin(stripe[1])
    cw, cd, tilt = tw + 0.3, td + 0.5, 0.28
    Pv, Fv, UVv = heightfield(np.zeros((2, 2)), cw, cd, 0)
    sc.mesh(put(xf(Pv, rx=-tilt) + [0, 0, 2.28]), Fv, UVv, {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': tex(st), 'roughness': 0.9}}, pre + 'canopy')
    front_y = -cd / 2 * math.cos(tilt); front_z = 2.28 - cd / 2 * math.sin(tilt)
    vh = 0.24
    Pval, Fval, UVval = hanging(cw, vh, n=8, amp=0.0)
    vt = valance_tex(cw, vh, stripe[1], sign)
    sc.mesh(put(Pval + [0, front_y - 0.005, front_z + 0.01]), Fval, UVval, {'type': 'twosided', 'bsdf': {'type': 'principled', 'base_color': tex(vt), 'roughness': 0.85}}, pre + 'valance')
    # a string of warm bulbs sagging between the front posts
    rad = [70, 44, 18] if evening else [36, 23, 9]
    for i in range(bulbs):
        u = i / (bulbs - 1)
        x = -tw / 2 - 0.05 + (tw + 0.1) * u
        z = front_z - vh - 0.05 - 0.13 * math.sin(math.pi * ((u * 2) % 1)) - 0.0 * u
        sc.add(pre + 'bulb%d' % i, {'type': 'sphere', 'center': list(put(np.array([[x, front_y + 0.03, z]]))[0]), 'radius': 0.02,
                                   'emitter': {'type': 'area', 'radiance': {'type': 'rgb', 'value': rad}}})
    # an invisible warm spot over the goods
    lamp = put(np.array([[0, -0.05, 2.0], [0, 0.05, th]]))
    sc.add(pre + 'lamp', {'type': 'spot', 'to_world': T().look_at(origin=list(lamp[0]), target=list(lamp[1]), up=[0, 1, 0]),
                          'intensity': {'type': 'rgb', 'value': [7.5, 5.6, 3.6] if evening else [5.0, 4.0, 2.8]}, 'cutoff_angle': 60, 'beam_width': 45})
    if not goods:
        return
    # rail of hanging tea towels at the back
    Pr, Fr, UVr = cylinder(0.012, tw, axis='x')
    sc.mesh(put(Pr + [0, td / 2 + 0.02, 1.72]), Fr, UVr, post, pre + 'rail')
    hang = [(INDIGO, OAT, 'sprigs'), (OAT, RUST, 'chevron'), (SAGE, OAT, 'dots'), (OAT, INDIGO, 'rosette'), (RUST, OAT, 'waves')]
    for i, (g, ink, m) in enumerate(hang):
        Ph, Fh, UVh = hanging(0.33, 0.6, amp=0.012, seed=i)
        sc.mesh(put(Ph + [-0.72 + i * 0.36, td / 2 + 0.035, 1.72]), Fh, UVh, printed(g, ink, m, 60 + i, n=384, size=0.33, bs=0.066, wc=0.05, two=True), pre + 'towel%d' % i)
    # stacks on the table
    specs = [[(INDIGO, OAT, 'sprigs'), (OAT, RUST, 'chevron'), (SAGE, OAT, 'dots'), (OAT, INDIGO, 'rosette'), (RUST, OAT, 'waves')],
             [(OAT, OCHRE, 'sun'), (INDIGO, OAT, 'dots'), (OAT, RUST, 'waves'), (SAGE, OAT, 'sprigs')],
             [(RUST, OAT, 'rosette'), (OAT, INDIGO, 'sprigs'), (OAT, OCHRE, 'sun'), (INDIGO, OAT, 'chevron'), (OAT, RUST, 'dots'), (SAGE, OAT, 'waves')]]
    for j, (x, rz2) in enumerate(((-0.56, 0.1), (0.0, -0.06), (0.56, 0.12))):
        stack(sc, base=tuple(put(np.array([[x, -0.04, th]]))[0]), rz=rz + rz2, spec=specs[j], sc_=1.35, wc=0.05, n=384)

def stall(evening):
    sc = Scene()
    P, F, UV = heightfield(np.zeros((2, 2)), 40, 40, 0)
    sc.mesh(P, F, UV, plain('#e8edf4', rough=0.85, spec=0.25), 'snow')
    sc.env((0.022, 0.034, 0.08) if evening else (0.07, 0.095, 0.18))
    sc.add('moon', {'type': 'directional', 'direction': [-0.3, -0.6, -0.75], 'irradiance': {'type': 'rgb', 'value': [0.05, 0.065, 0.1] if evening else [0.16, 0.2, 0.3]}})
    sign = None
    if SIGN and os.path.exists(SIGN):
        sign = np.asarray(mi.Bitmap(SIGN).convert(mi.Bitmap.PixelFormat.RGB, mi.Struct.Type.Float32, srgb_gamma=False))
    drape = printed(OAT, INDIGO, 'waves', 50, n=768, size=0.6, bs=0.15, wc=0.05)
    booth(sc, 'a_', (0, 0, 0), 0.0, evening, goods=True, sign=sign, drape=drape)
    booth(sc, 'b_', (-2.9, 2.6, 0), 0.22, evening, stripe=('#efe6d6', '#a5502f'))
    booth(sc, 'c_', (2.8, 3.4, 0), -0.18, evening, stripe=('#efe6d6', '#6f7f5f'))
    booth(sc, 'd_', (-0.4, 6.5, 0), 0.05, evening, stripe=('#efe6d6', '#c08a2e'))
    rr = np.random.default_rng(5)
    fir = plain('#1f3328', rough=0.9, spec=0.1)
    for i in range(9):
        P, F, UV = cone(rr.uniform(0.7, 1.1), rr.uniform(3.2, 4.6))
        sc.mesh(P + [rr.uniform(-7, 7), rr.uniform(9, 13), 0], F, UV, fir, 'fir%d' % i)
    # strings of lights between the far stalls
    for i in range(40):
        x = -6 + 12 * i / 39
        sc.add('far%d' % i, {'type': 'sphere', 'center': [x, 8.5 + 0.6 * math.sin(i), 3.0 - 0.35 * math.sin(math.pi * ((i / 8) % 1))], 'radius': 0.035,
                             'emitter': {'type': 'area', 'radiance': {'type': 'rgb', 'value': [80, 52, 22]}}})
    return sc

def shot_stall(evening):
    t0 = time.time(); name = 'stall-evening' if evening else 'stall'
    sc = stall(evening)
    o = (0.75, -3.1, 1.5) if not evening else (-0.55, -1.75, 1.3)
    tg = (0.0, 0.0, 1.2) if not evening else (0.15, 0.0, 1.08)
    sc.camera(o, tg, 42 if not evening else 46, w=int(W * 1.4), h=int(H * 1.4))
    sc.d['sensor']['type'] = 'thinlens'
    sc.d['sensor']['aperture_radius'] = 0.02
    sc.d['sensor']['focus_distance'] = float(np.linalg.norm(np.array(o) - np.array((0, -0.2, 1.0))))
    sc.render(os.path.join(OUT, name + '.png'), seed=3, spp=SPP * 4)
    done(name, t0)

SHOTS = {'block': shot_block, 'roller': shot_roller, 'press': shot_press, 'repeat': shot_repeat,
         'blocks': shot_blocks, 'stack': shot_stack, 'stall': lambda: shot_stall(False), 'stall-evening': lambda: shot_stall(True)}
for k, fn in SHOTS.items():
    if want(k): fn()
`;
}
