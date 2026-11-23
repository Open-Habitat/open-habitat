// node blocks/alice-11-wholesale-order-page/assets.mjs: the four product photos
// on Alice's wholesale order page, rendered with Mitsuba 3 (a physically based
// renderer, pip package `mitsuba`, version pinned below). The linen weave and
// the block prints are procedural (numpy), the meshes are built in the script,
// and ImageMagick crops each render to 4:3 and writes a 600 × 450 WebP into
// $ETUSIVU_ASSETS/alice-11-wholesale-order-page/. Blender's official Linux
// build is x86-64 only, so Mitsuba also runs on an aarch64 host.
// Set TMPDIR to your scratch; MITSUBA_PY may name a Python that already has
// mitsuba and numpy, otherwise a venv is made under TMPDIR. SPP=256 by default.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const ID = 'alice-11-wholesale-order-page';
const MITSUBA = '3.9.1';
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), ID);
const work = join(tmpdir(), `${ID}-render`);
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...env } });

let py = process.env.MITSUBA_PY;
if (!py) {
  const venv = join(work, 'venv');
  py = join(venv, 'bin/python');
  if (!existsSync(py)) {
    run('python3', ['-m', 'venv', venv]);
    run(py, ['-m', 'pip', 'install', '-q', `mitsuba==${MITSUBA}`, 'numpy']);
  }
}
const script = join(work, 'render.py');
writeFileSync(script, RENDER_PY());
run(py, ['-I', script, join(work, 'png')], { RES: '720', SPP: process.env.SPP || '256' });

// 4:3 bands of the 720 px squares, placed per product so each sits in the middle of its card.
const CROPS = {
  'tea-towel-indigo': '720x540+0+125',
  'napkins-set-of-4': '720x540+0+105',
  'cushion-cover-ochre': '720x540+0+100',
  'table-runner-rust': '720x540+0+150',
};
for (const [name, crop] of Object.entries(CROPS)) {
  run('convert', [join(work, 'png', `${name}.png`), '-crop', crop, '+repage', '-resize', '600x450', '-modulate', '102,104', '-quality', '82', '-define', 'webp:method=6', join(out, `${name}.webp`)]);
}
console.log(execFileSync('identify', ['-format', '%f %wx%h %b\n', ...Object.keys(CROPS).map((n) => join(out, `${n}.webp`))]).toString().trim());

function RENDER_PY() {
  return String.raw`
import sys, os, math
import numpy as np
import mitsuba as mi
mi.set_variant(os.environ.get('MI_VARIANT', 'llvm_ad_rgb'))
from mitsuba import ScalarTransform4f as T

OUT = sys.argv[1]
SPP = int(os.environ.get('SPP', '256'))
RES = int(os.environ.get('RES', '720'))
ONLY = os.environ.get('ONLY')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)
N = 1024

def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], float) / 255.0

def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

# ---------- Textures (procedural linen and block prints) ----------
def blur1d(a, k, axis):
    ker = np.ones(k) / k
    return np.apply_along_axis(lambda m: np.convolve(np.concatenate([m[-k:], m, m[:k]]), ker, 'same')[k:-k], axis, a)

def weave(n=N, threads=256, seed=1):
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    # warp and weft: each thread has its own thickness and tone (slubs)
    tw = r.normal(0, 1, threads); tf = r.normal(0, 1, threads)
    slub_w = blur1d(r.normal(0, 1, (threads, n)), 25, 1)
    slub_f = blur1d(r.normal(0, 1, (threads, n)), 25, 1)
    xi = (x * threads).astype(int) % threads; yi = (y * threads).astype(int) % threads
    px = np.arange(n)
    warp = 0.5 + 0.5 * np.cos(2 * np.pi * x * threads) ** 2
    weft = 0.5 + 0.5 * np.cos(2 * np.pi * y * threads) ** 2
    checker = ((xi + yi) % 2).astype(float)
    tone_w = tw[xi] * 0.05 + slub_w[xi, px[:, None].repeat(n, 1)] * 0.10
    tone_f = tf[yi] * 0.05 + slub_f[yi, px[None, :].repeat(n, 0)] * 0.10
    w = np.where(checker > 0, warp * (1 + tone_w), weft * (1 + tone_f))
    w = (w - w.min()) / (w.max() - w.min())
    return w  # 0..1, height and tone

def stamp(mask_fn, n=N, seed=3, rough=0.35):
    """Ink coverage of a hand block print: the shape, uneven inking, soft edge."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    m = mask_fn(x, y)
    grain = blur1d(blur1d(r.random((n, n)), 3, 0), 3, 1)
    blot = blur1d(blur1d(r.random((n, n)), 60, 0), 60, 1)
    blot = (blot - blot.min()) / (blot.max() - blot.min())
    ink = np.clip(m * (1 - rough * (grain > 0.62)) * (0.78 + 0.3 * blot), 0, 1)
    return ink

def leaf_sprigs(x, y):
    m = np.zeros_like(x)
    cols, rows = 4, 6
    jr = np.random.default_rng(11)
    for i in range(cols):
        for j in range(rows):
            cx = (i + 0.5 + (j % 2) * 0.5) / cols; cy = (j + 0.5) / rows
            cx += jr.normal(0, 0.006); cy += jr.normal(0, 0.006)
            ang = jr.normal(0.6, 0.15) * (1 if (i + j) % 2 else -1)
            dx, dy = x - cx, y - cy
            dx = (dx + 0.5) % 1 - 0.5
            u = dx * math.cos(ang) + dy * math.sin(ang); v = -dx * math.sin(ang) + dy * math.cos(ang)
            stem = (np.abs(v) < 0.0032) & (np.abs(u) < 0.05)
            m = np.maximum(m, stem)
            for t, side in ((-0.027, 1), (0.0, -1), (0.024, 1), (0.045, 0)):
                lu = u - t; lv = v - side * 0.0165
                if side == 0: lv = v
                a = 0.018 if side else 0.015
                leaf = (np.abs(lu) / a) ** 1.3 + (np.abs(lv) / 0.0085) ** 1.0 < 1
                m = np.maximum(m, leaf)
    return m.astype(float)

def border_stripes(x, y, w=(0.04, 0.012, 0.06, 0.006)):
    a = (np.abs(x - w[0]) < w[1]) | (np.abs(x - (1 - w[0])) < w[1])
    b = (np.abs(x - w[2]) < w[3]) | (np.abs(x - (1 - w[2])) < w[3])
    return (a | b).astype(float)

def suns(x, y):
    m = np.zeros_like(x)
    for i in range(3):
        for j in range(3):
            cx, cy = (i + 0.5) / 3, (j + 0.5) / 3
            d = np.hypot(x - cx, y - cy)
            ring = (d < 0.105) & (d > 0.072)
            dot = d < 0.042
            ang = np.arctan2(y - cy, x - cx)
            rays = (d > 0.12) & (d < 0.148) & (np.cos(ang * 12) > 0.55)
            m = np.maximum(m, ring | dot | rays)
    return m.astype(float)

def chevrons(x, y):
    yy = (y * 10) % 1
    xx = np.abs(((x * 3) % 1) - 0.5)
    band = np.abs(yy - 0.5 - xx * 0.9 + 0.2) < 0.09
    return band.astype(float)

def dots_border(x, y):
    m = np.zeros_like(x)
    edge = np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y))
    ring = (edge > 0.05) & (edge < 0.058)
    return ring.astype(float)

def cloth(ground, ink_col, ink, seed, inkopacity=0.9):
    w = weave(seed=seed)
    g = srgb_to_lin(hexrgb(ground))
    ic = srgb_to_lin(hexrgb(ink_col))
    base = g[None, None, :] * (0.80 + 0.32 * w[..., None])
    a = (ink * inkopacity)[..., None]
    # ink sits in the weave: thinner on the high threads
    a = a * (0.85 + 0.15 * (1 - w[..., None]))
    col = base * (1 - a) + ic[None, None, :] * (0.82 + 0.25 * w[..., None]) * a
    return np.clip(col, 0, 1).astype(np.float32), w.astype(np.float32)

def bmp(arr, lin=True):
    return mi.Bitmap(arr, pixel_format=mi.Bitmap.PixelFormat.RGB if arr.ndim == 3 else mi.Bitmap.PixelFormat.Y)

def tex(arr, scale=1.0):
    return {'type': 'bitmap', 'bitmap': bmp(arr), 'raw': True, 'filter_type': 'bilinear',
            'to_uv': mi.ScalarTransform4f().scale([scale, scale, 1])}

def linen(col, height, scale=1.0, sheen=0.35):
    return {'type': 'bumpmap',
            'arbitrary': {'type': 'bitmap', 'bitmap': bmp(height), 'raw': True, 'to_uv': mi.ScalarTransform4f().scale([scale, scale, 1])},
            'scale': 0.22,
            'bsdf': {'type': 'principled', 'base_color': tex(col, scale), 'roughness': 0.95, 'sheen': sheen, 'specular': 0.08}}

# ---------- Meshes ----------
def spow(v, e):
    return np.sign(v) * np.abs(v) ** e

def mesh(name, P, F, UV):
    m = mi.Mesh(name, len(P), len(F), has_vertex_normals=True, has_vertex_texcoords=True)
    p = mi.traverse(m)
    p['vertex_positions'] = mi.Float(P.astype(np.float32).ravel())
    p['faces'] = mi.UInt32(F.astype(np.uint32).ravel())
    p['vertex_texcoords'] = mi.Float(UV.astype(np.float32).ravel())
    p.update()
    m.recompute_vertex_normals()
    return m

def grid_faces(nu, nv, wrap_v=True):
    F = []
    for i in range(nu - 1):
        for j in range(nv if wrap_v else nv - 1):
            a = i * nv + j; b = i * nv + (j + 1) % nv; c = (i + 1) * nv + (j + 1) % nv; d = (i + 1) * nv + j
            F.append((a, b, c)); F.append((a, c, d))
    return np.array(F)

def superslab(a, b, c, e1, e2, nu=160, nv=320, puff=None, wrinkle=0.0, seed=0):
    u = np.linspace(-np.pi / 2, np.pi / 2, nu)
    v = np.linspace(-np.pi, np.pi, nv, endpoint=False)
    U, V = np.meshgrid(u, v, indexing='ij')
    cu = spow(np.cos(U), e1)
    X = a * cu * spow(np.cos(V), e2)
    Y = b * cu * spow(np.sin(V), e2)
    Z = c * spow(np.sin(U), e1)
    if puff is not None:
        Z = Z * puff(X / a, Y / b)
    if wrinkle:
        r = np.random.default_rng(seed)
        ph = r.random(6) * 6.28
        Z = Z + wrinkle * np.sign(Z) * (np.sin(X * 31 + ph[0]) * np.sin(Y * 23 + ph[1]) + 0.5 * np.sin(X * 57 + Y * 41 + ph[2])) * (np.abs(Z) / c)
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    UV = np.stack([X / (2 * a) + 0.5, Y / (2 * b) + 0.5], -1).reshape(-1, 2)
    return P, grid_faces(nu, nv), UV

def place(P, rz=0.0, t=(0, 0, 0)):
    c, s = math.cos(rz), math.sin(rz)
    R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return P @ R.T + np.array(t)

def roll(radius, length, nl=120, na=240):
    x = np.linspace(-length / 2, length / 2, nl)
    t = np.linspace(0, 2 * np.pi, na, endpoint=False)
    X, Tt = np.meshgrid(x, t, indexing='ij')
    Y = radius * np.cos(Tt); Z = radius * np.sin(Tt) + radius
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    UV = np.stack([X / length + 0.5, Tt / (2 * np.pi) * 2.2], -1).reshape(-1, 2)
    return P, grid_faces(nl, na), UV

def cap(radius, xpos, sign, n=240):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False)
    rr = np.linspace(0, 1, 40)
    R, Tt = np.meshgrid(rr, t, indexing='ij')
    Y = radius * R * np.cos(Tt); Z = radius * R * np.sin(Tt) + radius
    X = np.full_like(Y, xpos) - sign * 0.004 * (1 - R) ** 2
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    UV = np.stack([R * np.cos(Tt) * 0.5 + 0.5, R * np.sin(Tt) * 0.5 + 0.5], -1).reshape(-1, 2)
    F = grid_faces(40, n)
    if sign < 0: F = F[:, ::-1]
    return P, F, UV

# ---------- Scene ----------
def scene(shapes, cam_dist=1.0, target=(0, 0, 0.02), elev=38, azim=-90, fov=26):
    el, az = math.radians(elev), math.radians(azim)
    tx, ty, tz = target
    origin = [tx + cam_dist * math.cos(el) * math.cos(az), ty + cam_dist * math.cos(el) * math.sin(az), tz + cam_dist * math.sin(el)]
    d = {
        'type': 'scene',
        'integrator': {'type': 'path', 'max_depth': 8},
        'sensor': {'type': 'perspective', 'fov': fov, 'to_world': T().look_at(origin=origin, target=list(target), up=[0, 0, 1]),
                   'film': {'type': 'hdrfilm', 'width': RES, 'height': RES, 'rfilter': {'type': 'gaussian'}},
                   'sampler': {'type': 'independent', 'sample_count': SPP}},
        'key': {'type': 'rectangle', 'to_world': T().look_at(origin=[-1.1, -0.9, 1.6], target=[0, 0, 0], up=[0, 0, 1]).scale([0.55, 0.55, 1]),
                'emitter': {'type': 'area', 'radiance': {'type': 'rgb', 'value': [11.5, 10.6, 9.1]}}},
        'fill': {'type': 'rectangle', 'to_world': T().look_at(origin=[1.4, -0.6, 0.7], target=[0, 0, 0], up=[0, 0, 1]).scale([0.6, 0.6, 1]),
                 'emitter': {'type': 'area', 'radiance': {'type': 'rgb', 'value': [1.6, 1.65, 1.75]}}},
        'env': {'type': 'constant', 'radiance': {'type': 'rgb', 'value': [0.34, 0.33, 0.33]}},
        'table': {'type': 'rectangle', 'to_world': T().scale([3, 3, 1]),
                  'bsdf': {'type': 'principled', 'base_color': tex(TABLE, 0.6), 'roughness': 0.8, 'specular': 0.2}},
    }
    for k, s in shapes.items():
        d[k] = s
    return d

def sh(m, bsdf):
    return {'type': 'ply', 'filename': m} if isinstance(m, str) else m

def shape(name, P, F, UV, bsdf):
    m = mesh(name, P, F, UV)
    return m, bsdf

# warm plaster backdrop: soft mottling
yy, xx = np.mgrid[0:512, 0:512] / 512
mott = blur1d(blur1d(rng.random((512, 512)), 40, 0), 40, 1)
mott = (mott - mott.min()) / (mott.max() - mott.min())
TABLE = (srgb_to_lin(hexrgb('#eee6d9'))[None, None, :] * (0.94 + 0.08 * mott[..., None])).astype(np.float32)

def render(name, shapes, **cam):
    if ONLY and ONLY != name:
        return
    d = scene({}, **cam)
    d2 = dict(d)
    for k, (P, F, UV, bsdf) in shapes.items():
        d2[k] = {'type': 'ply', 'filename': write_ply(k, P, F, UV), 'bsdf': bsdf}
    sc = mi.load_dict(d2)
    img = mi.render(sc)
    mi.Bitmap(img).convert(mi.Bitmap.PixelFormat.RGB, mi.Struct.Type.UInt8, srgb_gamma=True).write(os.path.join(OUT, name + '.png'))
    print('rendered', name, flush=True)

def write_ply(name, P, F, UV):
    path = os.path.join(OUT, '_' + name + '.ply')
    with open(path, 'wb') as f:
        f.write(('ply\nformat binary_little_endian 1.0\nelement vertex %d\nproperty float x\nproperty float y\nproperty float z\nproperty float u\nproperty float v\nelement face %d\nproperty list uchar int vertex_indices\nend_header\n' % (len(P), len(F))).encode())
        v = np.concatenate([P, UV], 1).astype('<f4')
        f.write(v.tobytes())
        ff = np.empty(len(F), dtype=[('n', 'u1'), ('i', '<i4', 3)])
        ff['n'] = 3; ff['i'] = F
        f.write(ff.tobytes())
    return path

def cloth_slab(a, b, c, n=240, wr=0.0006, seed=0):
    t = np.linspace(-1, 1, n)
    x, y = np.meshgrid(t, t, indexing='ij')
    h = c * np.clip((1 - np.abs(x) ** 14) * (1 - np.abs(y) ** 14), 0, 1) ** 0.35
    r = np.random.default_rng(seed); ph = r.random(4) * 6.28
    w = wr * (np.sin(x * 9 + ph[0]) * np.sin(y * 7 + ph[1]) + 0.4 * np.sin(x * 21 + y * 17 + ph[2]))
    X, Y = a * x, b * y
    top = np.stack([X, Y, c + h + w], -1).reshape(-1, 3)
    bot = np.stack([X, Y, c - h + w * 0.5], -1).reshape(-1, 3)
    uv = np.stack([x * 0.5 + 0.5, y * 0.5 + 0.5], -1).reshape(-1, 2)
    F = grid_faces(n, n, wrap_v=False)
    return np.concatenate([top, bot]), np.concatenate([F[:, ::-1], F + n * n]), np.concatenate([uv, uv])

def loop_mesh(R, rt, n=160, m=24):
    u = np.linspace(0, 2 * np.pi, n, endpoint=False); v = np.linspace(0, 2 * np.pi, m, endpoint=False)
    U, V = np.meshgrid(u, v, indexing='ij')
    X = (R + rt * 2.2 * np.cos(V)) * np.cos(U); Y = (R + rt * 2.2 * np.cos(V)) * np.sin(U) * 1.6; Z = rt * 0.5 * np.sin(V)
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    UV = np.stack([U / 6.28, V / 6.28], -1).reshape(-1, 2)
    F = []
    for i in range(n):
        for j in range(m):
            a_ = i * m + j; b_ = i * m + (j + 1) % m; c_ = ((i + 1) % n) * m + (j + 1) % m; d_ = ((i + 1) % n) * m + j
            F.append((a_, c_, b_)); F.append((a_, d_, c_))
    return P, np.array(F), UV

# ---------- The four products ----------
OAT = '#ddd2bf'; INDIGO = '#2c3e63'; RUST = '#a5502f'; OCHRE = '#c08a2e'; SAGE = '#8d9a7b'

# 1. Tea towel, indigo: folded in three, leaf sprigs and border stripes
col, h = cloth(INDIGO, OAT, np.maximum(stamp(leaf_sprigs, seed=4), stamp(lambda x, y: border_stripes(y, x), seed=5, rough=0.15)), seed=21, inkopacity=0.85)
towel = {}
for i in range(2):
    P, F, UV = cloth_slab(0.15 - 0.002 * (1 - i), 0.10, 0.0075, seed=i, wr=0.0009)
    P = place(P, rz=0.18 + i * 0.012, t=(i * 0.002, -i * 0.002, 0.0145 * i))
    towel['towel%d' % i] = (P, F, UV, linen(col, h, 1.0))
render("tea-towel-indigo", towel, cam_dist=0.9, target=(0, 0.005, 0.02))

# 2. Napkins, set of 4: four colours stacked, a dotted border print
napk = {}
for i, (g, ink) in enumerate([(SAGE, OAT), (RUST, OAT), (OAT, RUST), (INDIGO, OAT)]):
    col, h = cloth(g, ink, stamp(dots_border, seed=30 + i, rough=0.25), seed=31 + i, inkopacity=0.75)
    P, F, UV = superslab(0.12, 0.12, 0.005, 0.2, 0.08, wrinkle=0.0005, seed=10 + i)
    P = place(P, rz=[0.22, 0.08, 0.30, 0.15][i], t=([0.02, -0.01, 0.015, -0.005][i], [0.01, -0.012, 0.0, 0.006][i], 0.005 + i * 0.0098))
    napk['napkin%d' % i] = (P, F, UV, linen(col, h, 1.0))
render("napkins-set-of-4", napk, cam_dist=0.8, target=(0.005, 0.0, 0.02))

def pillow(a, c, n=220, sag=0.07):
    t = np.linspace(-1, 1, n)
    x, y = np.meshgrid(t, t, indexing='ij')
    h = c * np.clip((1 - np.abs(x) ** 4) * (1 - np.abs(y) ** 4), 0, 1) ** 0.42
    r = np.random.default_rng(3)
    ph = r.random(4) * 6.28
    edge = 1 - np.clip((1 - np.abs(x) ** 6) * (1 - np.abs(y) ** 6), 0, 1)
    h = h * (1 + 0.05 * edge * np.sin(x * 23 + ph[0]) * np.sin(y * 19 + ph[1]))
    X = a * x * (1 - sag * (1 - y ** 2)); Y = a * y * (1 - sag * (1 - x ** 2))
    top = np.stack([X, Y, c + h], -1).reshape(-1, 3)
    bot = np.stack([X, Y, c - h * 0.92], -1).reshape(-1, 3)
    uv = np.stack([x * 0.5 + 0.5, y * 0.5 + 0.5], -1).reshape(-1, 2)
    F = grid_faces(n, n, wrap_v=False)
    P = np.concatenate([top, bot]); UV = np.concatenate([uv, uv])
    F = np.concatenate([F[:, ::-1], F + n * n])
    return P, F, UV

# 3. Cushion cover, ochre suns on oat
col, h = cloth(OAT, OCHRE, stamp(suns, seed=40, rough=0.3), seed=41)
P, F, UV = pillow(0.16, 0.05)
P = place(P, rz=0.2)
render('cushion-cover-ochre', {'cushion': (P, F, UV, linen(col, h, 1.0))}, cam_dist=1.0, target=(0, 0, 0.04), elev=36)

# 4. Table runner, rust chevrons: partly unrolled, the roll behind
col, h = cloth(OAT, RUST, np.maximum(stamp(lambda x, y: chevrons(x, y * 0.6), seed=50, rough=0.3), stamp(border_stripes, seed=52, rough=0.15)), seed=51)
R0, W, L = 0.032, 0.20, 0.36
P, F, UV = roll(R0, W)
UV[:, 1] = UV[:, 1] / 2.2 * (2 * np.pi * R0 / L)
UV[:, 0] = P[:, 0] / W + 0.5
P0, F0, UV0 = superslab(W / 2, L / 2, 0.0022, 0.2, 0.05)
UV0 = UV0.copy()
P0 = P0 + np.array([0, -L / 2, 0.0022])
yy, xx = np.mgrid[0:N, 0:N] / N
r = np.hypot(xx - 0.5, yy - 0.5) * 2; th = np.arctan2(yy - 0.5, xx - 0.5)
spiral = np.cos((r * 9 - th / np.pi) * np.pi) ** 10
ccol = (srgb_to_lin(hexrgb(OAT)) * (0.62 + 0.38 * (1 - spiral[..., None]))).astype(np.float32)
ch = (1 - spiral).astype(np.float32)
P1, F1, UV1 = cap(R0, W / 2, 1)
P2, F2, UV2 = cap(R0, -W / 2, -1)
capb = {'type': 'bumpmap', 'arbitrary': {'type': 'bitmap', 'bitmap': bmp(ch), 'raw': True}, 'scale': 1.0,
        'bsdf': {'type': 'principled', 'base_color': tex(ccol), 'roughness': 0.9, 'sheen': 0.3}}
rot = lambda Q: place(Q, rz=0.35, t=(0.0, 0.08, 0))
render('table-runner-rust', {'runner': (rot(P), F, UV, linen(col, h, 1.0)), 'flat': (rot(P0), F0, UV0, linen(col, h, 1.0)),
                             'capa': (rot(P1), F1, UV1, capb), 'capb': (rot(P2), F2, UV2, capb)},
       cam_dist=1.0, target=(0.02, -0.02, 0.02), elev=40, azim=-80)
`;
}
