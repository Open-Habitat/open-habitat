// Capabilities: Pictures. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, screen, view } from '../../engine/kit.mjs';
import { sw, toggles, crest } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const upscaleMock = () => `<div class="up" data-view data-state="after">${toggles([['before', 'Scan, 300 px'], ['after', 'Enlarged ×4']], 'after')}<div class="up-b">${sw('<rect width="320" height="200" fill="#e8dcc3"/><path d="M0 128 H320 V200 H0 Z" fill="#9fae9a"/><path d="M0 128 C80 120 240 136 320 126" stroke="#7d8f7a" stroke-width="3" fill="none"/><path d="M60 136 L250 128 L238 142 L74 148 Z" fill="#5a3e2b"/>' + [0, 1, 2, 3].map((k) => `<circle cx="${100 + k * 38}" cy="${122 - (k % 2) * 2}" r="7" fill="#3b2f2a"/><path d="M${100 + k * 38} 130 l26 -30" stroke="#6b5a48" stroke-width="3"/>`).join('') + '<rect x="30" y="40" width="70" height="60" fill="#cdbf9f"/><path d="M30 40 L65 20 L100 40" fill="#b9a982"/>', 'up-s')}</div><p class="up-n"><span>40 photos · 1962–1969</span><span>6 marked: invented detail to check</span></p></div>`;
const blurMock = (note) => `<div class="blur"><div class="blur-g">${[0, 1, 2, 3, 4, 5].map((k) => `<span class="blur-p" style="--k:${k}">${[0, 1, 2].slice(0, 1 + (k % 3)).map((j) => `<i class="${(k + j) % 4 === 1 ? '' : 'b'}" style="--x:${20 + j * 28}%"></i>`).join('')}</span>`).join('')}</div><p class="blur-n">${esc(note)}</p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [3, 'img', 'A hundred product photos: background off, same crop, shop sizes', 'rembg, ImageMagick', 'Carol', 'Example Studio', 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.', '104 clean cut-outs in three sizes, named by product code, and three marked to check.'],
  [11, 'img', 'A blurry logo traced into a sharp vector file', 'VTracer, Inkscape', 'Carol', 'Example Studio', 'Our crest only exists as a 300-pixel JPEG from 2008. I need it on a two-metre banner.', 'A vector file that stays sharp at any size, and a sheet showing the crest on light and dark backgrounds.'],
  [12, 'img', 'Old small photos made larger and sharper', 'Real-ESRGAN', 'Peggy', 'Riverside Rowing Club', 'Our 1960s photos are postcard-sized scans. Versions good enough for an exhibition wall?', 'Forty enlarged images, and six marked where the restoration invented detail worth checking against the original.'],
  [28, 'img', '20,000 photos put in order: duplicates out, names by date', 'Czkawka, ExifTool', 'Peggy', 'Riverside Rowing Club', 'Eleven members’ uploads, all called IMG_something. Some order, please.', '6,300 of 19,800 files are duplicates; folders by year and regatta proposed, and everything renamed by date after her yes.'],
  [29, 'img', 'Faces and number plates blurred before publishing', 'OpenCV', 'Judy', 'Maple Lane School', 'Sports day photos for the website; six pupils have no permission.', 'Every face blurred by default, and a list of the 30 photos where it was unsure.'],
  [46, 'img', 'Camera raw files developed, the same look for the whole batch', 'RawTherapee, darktable', 'Carol', 'Example Studio', '900 raw files from the regatta.', 'All of them developed, and the 60 sharpest chosen for the website.'],
  [47, 'img', 'A panorama of the shop', 'Hugin', 'Alice', 'Example Studio', 'Fourteen photos turning around in the shop, for the “visit us” page.', 'One seamless wide picture.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-pictures',
  kind: 'caps',
  group: { id: 'img', name: "Pictures", line: "A hundred photos at once, a logo from a thumbnail, old prints made sharp." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [12, 29],
  full: {
    12: () => capScreen(12, 'Old photos, larger', you('19:10', capOf[12][6], att('scans-1960s/', '40 scans · 300 px')) + turn({ tools: [
        tool('bash', 'uv tool install realesrgan-ncnn-py', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'python3 upscale.py scans-1960s/ --scale 4 --flag-invented', '40 enlarged ×4 · 6 where faces or text were invented'),
      ], reply: '**Forty photos** enlarged four times. Six are marked: in those the restoration made up detail, mostly faces in the back row, so check them against the originals before they go on the wall.' }), view('crew-1964.png', upscaleMock())),
    29: () => capScreen(29, 'Sports day photos', you('15:40', capOf[29][6], att('sports-day/', '210 photos')) + turn({ tools: [
        tool('read', 'office/permissions-2026.csv', '6 pupils without publication permission'),
        tool('bash', 'python3 blur_faces.py sports-day/ --strict', '210 photos · faces blurred by default · 30 uncertain'),
      ], reply: 'All 210 are ready; every face is blurred unless I was sure it was a pupil with permission. **Thirty photos** need your eye.' }), view('sports-day · ready', blurMock('210 photos · blurred by default · 30 to check'))),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 3: ['carol', 'cut'], 11: ['carol', 'logo'], 46: ['carol', 'raw'] },
};
