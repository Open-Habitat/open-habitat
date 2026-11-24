// node blocks/caps-pictures/assets.mjs: the two showpieces of "Pictures",
// each made by the program the block names. Writes into
// $ETUSIVU_ASSETS/caps-pictures/:
//
//   regatta-scan.webp   a detail of the 400 px scan, stretched ×4 (plain bicubic)
//   regatta-x4.webp     the same detail from Real-ESRGAN ×4 (RealESRGAN_x4plus)
//   regatta-whole.webp  the whole enlarged photo, small, for the locator
//   market-ready.webp   a street-market photo with every face OpenCV found blurred
//   market-found.svg    the boxes of what OpenCV's YuNet detector found, as an overlay
//
// Programs (installed into $CAPS_PICTURES_WORK, default $TMPDIR/caps-pictures-work):
//   Real-ESRGAN 0.3.0 (pip `realesrgan`, with basicsr 1.4.2, torch 2.1.2 CPU),
//   weights RealESRGAN_x4plus.pth from the project's v0.1.0 release;
//   OpenCV 5.1.0 (pip `opencv-python-headless`), face detector YuNet
//   (face_detection_yunet_2023mar.onnx from opencv_zoo); ImageMagick `convert`.
// Needs uv, ImageMagick and network on the first run (about 2 GB of scratch,
// two minutes of CPU for the enlargement). Set TMPDIR to your scratch.
// Sources and licences of the two photos: NOTES.md beside this file.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'caps-pictures');
const work = process.env.CAPS_PICTURES_WORK || join(tmpdir(), 'caps-pictures-work');
const dl = join(work, 'dl');
for (const d of [out, dl]) mkdirSync(d, { recursive: true });
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26, ...opts }).toString();
const im = (args) => run('convert', args);
const UA = 'etusivu-assets/1.0 (landing page build)';
// Downloads are kept in the work directory, so a second run needs no network.
const fetchTo = (name, url) => { const p = join(dl, name); if (!existsSync(p)) run('curl', ['-sSfL', '--retry', '3', '-m', '600', '-A', UA, '-o', p, url]); return p; };
const venv = (name, python, pkgs, extra = []) => {
  const py = join(work, name, 'bin/python');
  if (!existsSync(py)) {
    run('uv', ['venv', '-q', '--python', python, join(work, name)]);
    run('uv', ['pip', 'install', '-q', '--python', py, ...extra, ...pkgs]);
  }
  return py;
};
const script = (name, src) => { const p = join(work, name); writeFileSync(p, src); return p; };

// ---------- 1. An old small photo, enlarged four times: Real-ESRGAN ----------
// The "scan" is a 1964 press photograph from the Dutch National Archives (CC0),
// cut to the picture and reduced to 400 px wide: the size of a quick scan of a
// small print. Real-ESRGAN gets only those 400 pixels.
const regatta = fetchTo('regatta-960.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Roeien%20in%20Duisburg%20op%20de%20Wedaubaan%2C%20overzicht%2C%20Bestanddeelnr%20916-5600.jpg?width=960');
const weights = fetchTo('RealESRGAN_x4plus.pth', 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth');
const scan = join(work, 'regatta-scan.jpg');
im([regatta, '-crop', '960x744+0+60', '+repage', '-resize', '400x', '-quality', '82', scan]);
const pyEsr = venv('venv-esr', '3.11', ['torch==2.1.2', 'torchvision==0.16.2', 'numpy<2', 'realesrgan==0.3.0', 'basicsr==1.4.2'], ['--extra-index-url', 'https://download.pytorch.org/whl/cpu']);
// The project's own inference path (RealESRGANer, as inference_realesrgan.py
// uses it), on the CPU. Tiles of 200 px: untiled, torch 2.1.2 on arm64 returned
// a picture with a dark band at the top, so the tiling the tool offers is used.
const esr = script('esr.py', `import sys, cv2
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
weights, src, dst = sys.argv[1:4]
model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
up = RealESRGANer(scale=4, model_path=weights, model=model, tile=200, tile_pad=16, pre_pad=0, half=False, device='cpu')
out, _ = up.enhance(cv2.imread(src, cv2.IMREAD_COLOR), outscale=4)
cv2.imwrite(dst, out)
print(dst, out.shape[1], 'x', out.shape[0])
`);
const x4 = join(work, 'regatta-x4.png');
if (!existsSync(x4) || process.env.CAPS_PICTURES_FORCE) console.log(run(pyEsr, ['-W', 'ignore', esr, weights, scan, x4]).trim().split('\n').pop());
// What the reader compares: the same 720 × 540 detail of the scan stretched
// with ordinary bicubic interpolation, and of Real-ESRGAN's picture.
const DETAIL = '720x540+760+700';
const webp = ['-quality', '84', '-define', 'webp:method=6'];
im([scan, '-filter', 'Catrom', '-resize', '400%', '-crop', DETAIL, '+repage', ...webp, join(out, 'regatta-scan.webp')]);
im([x4, '-crop', DETAIL, '+repage', ...webp, join(out, 'regatta-x4.webp')]);
im([x4, '-resize', '480x', ...webp, join(out, 'regatta-whole.webp')]);

// ---------- 2. Faces blurred before publishing: OpenCV ----------
// A CC0 photograph of a street market in Normandy from Wikimedia Commons
// (NOTES.md has the licence as read on the file page). Only the blurred picture
// is written: the block is about not publishing faces, so the original never
// ships. The view shows the lower middle of the photo, where the people are;
// the detector gets that part at 1280 × 960.
const market = fetchTo('market-3840.jpg', 'https://commons.wikimedia.org/wiki/Special:FilePath/Market%20on%20Avenue%20de%20la%20Gare%2C%20Houlgate%2C%202024.jpg?width=3840');
const yunet = fetchTo('face_detection_yunet_2023mar.onnx', 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx');
const marketPng = join(work, 'market.png');
im([market, '-crop', '1840x1380+660+1173', '+repage', '-resize', '1280x960', marketPng]);
const pyCv = venv('venv-cv', '3.12', ['opencv-python-headless==5.1.0.95', 'numpy']);
// Every detection down to a score of 0.30 is blurred, sure or not: a blurred
// lamp post costs nothing, a missed face does. The one exception is a box
// wider than a fifth of the picture with a low score, which is not a face in a
// crowd photo; it is left alone and listed.
// PRINTS are not detections: two T-shirt prints with a clothing brand on them,
// softened by hand-set boxes so that the page shows no real brand. They are
// not counted and not drawn in the overlay.
const PRINTS = [[596, 328, 56, 30], [548, 578, 32, 32]];
const blur = script('blur_faces.py', `import sys, json, cv2, numpy as np
model, src, dst, report = sys.argv[1:5]
prints = json.loads(sys.argv[5])
SURE, FLOOR, UP = 0.80, 0.30, 2
img = cv2.imread(src); h, w = img.shape[:2]
big = cv2.resize(img, (w * UP, h * UP), interpolation=cv2.INTER_CUBIC)  # small faces: look at twice the size
det = cv2.FaceDetectorYN.create(model, '', (w * UP, h * UP), FLOOR, 0.3, 5000)
_, faces = det.detect(big)
found, out = [], img.copy()
for f in (faces if faces is not None else []):
    x, y, fw, fh = [float(v) / UP for v in f[:4]]; score = float(f[14])
    state = 'sure' if score >= SURE else ('skipped' if fw > w / 5 else 'unsure')
    found.append({'x': round(x, 1), 'y': round(y, 1), 'w': round(fw, 1), 'h': round(fh, 1), 'score': round(score, 2), 'state': state})
    if state == 'skipped': continue
    cx, cy, rx, ry = x + fw / 2, y + fh / 2, fw * 0.95, fh * 0.95  # hair and chin go too
    x0, y0, x1, y1 = [int(round(v)) for v in (max(cx - rx, 0), max(cy - ry, 0), min(cx + rx, w), min(cy + ry, h))]
    if x1 - x0 < 3 or y1 - y0 < 3: continue
    roi = out[y0:y1, x0:x1]
    soft = cv2.GaussianBlur(roi, (0, 0), max(fw, fh) * 0.45)
    mask = np.zeros(roi.shape[:2], np.float32)
    cv2.ellipse(mask, (int(cx - x0), int(cy - y0)), (max(1, int(fw * 0.62)), max(1, int(fh * 0.66))), 0, 0, 360, 1, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), max(1.0, fw * 0.12))[..., None]
    out[y0:y1, x0:x1] = (soft * mask + roi * (1 - mask)).astype(np.uint8)
for px, py, pw, ph in prints:
    out[py:py + ph, px:px + pw] = cv2.GaussianBlur(out[py:py + ph, px:px + pw], (0, 0), 5)
found.sort(key=lambda d: (d['y'], d['x']))
cv2.imwrite(dst, out)
json.dump({'width': w, 'height': h, 'faces': found}, open(report, 'w'), indent=1)
`);
const blurred = join(work, 'market-blurred.png');
const report = join(work, 'market-faces.json');
run(pyCv, ['-I', blur, yunet, marketPng, blurred, report, JSON.stringify(PRINTS)]);
const VIEW = { w: 1280, h: 960 };
im([blurred, '-resize', '960x720', '-quality', '84', '-define', 'webp:method=6', join(out, 'market-ready.webp')]);
const { faces } = JSON.parse(readFileSync(report, 'utf8'));
const INK = { sure: '#2c6e3f', unsure: '#c2410c', skipped: '#3a453c' };
const boxes = faces.map((f) => {
  // A blurred face is outlined a little outside its box, where the blur ends.
  const g = f.state === 'skipped' ? 0 : 0.18;
  const x = f.x - f.w * g, y = f.y - f.h * g, w = f.w * (1 + 2 * g), h = f.h * (1 + 2 * g);
  if (x + w < 2 || y + h < 2 || x > VIEW.w - 2 || y > VIEW.h - 2) return '';
  const r = (v) => Math.round(v * 10) / 10;
  const box = `x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${f.state === 'skipped' ? 12 : r(Math.min(w, h) * 0.3)}"`;
  return `<rect ${box} fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="8"/><rect ${box} fill="none" stroke="${INK[f.state]}" stroke-width="4"${f.state === 'skipped' ? ' stroke-dasharray="14 10"' : ''}/>`;
}).join('');
writeFileSync(join(out, 'market-found.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW.w} ${VIEW.h}">${boxes}</svg>\n`);

const n = (s) => faces.filter((f) => f.state === s).length;
// block.js quotes these numbers; if they change, change them there.
console.log(`market: ${faces.length} detections · ${n('sure')} sure · ${n('unsure')} unsure, blurred anyway · ${n('skipped')} skipped (too large to be a face)`);
console.log(run('identify', ['-format', '%f %wx%h %b\n', ...['regatta-scan.webp', 'regatta-x4.webp', 'regatta-whole.webp', 'market-ready.webp'].map((f) => join(out, f))]).trim());
