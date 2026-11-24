// Capabilities: Pictures. Two showpieces, both real: an old small photo
// enlarged by Real-ESRGAN (drag the line to compare) and a market photo with
// the faces OpenCV found blurred. assets.mjs makes the pictures; NOTES.md has
// the programs, commands and licences. The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, screen, view, offer, assets } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';
const asset = assets(import.meta.url);

// ---------- This block's own views ----------
// The before/after: two pictures of the same detail on top of each other, the
// upper one clipped at --p. The range input over them moves --p (client.js);
// without JavaScript the line rests in the middle and both halves show.
const upscaleView = () => `<div class="cp-up" style="--p:50%">
<div class="cp-cmp">
<img class="cp-pic" src="${asset('regatta-scan.webp')}" alt="A detail of the scan stretched four times: spectators on a river bank, soft and blocky" width="720" height="540" loading="lazy" decoding="async">
<img class="cp-pic cp-after" src="${asset('regatta-x4.webp')}" alt="The same detail enlarged by Real-ESRGAN: coats, hats and a handbag with clean edges" width="720" height="540" loading="lazy" decoding="async">
<span class="cp-tag cp-tag-a">Scan, stretched</span><span class="cp-tag cp-tag-b">Real-ESRGAN ×4</span>
<span class="cp-line" aria-hidden="true"><i></i></span>
<input class="cp-range" type="range" min="0" max="100" value="50" step="1" aria-label="Compare the stretched scan with the enlargement">
</div>
<div class="cp-loc"><span class="cp-thumb"><img src="${asset('regatta-whole.webp')}" alt="The whole photograph: a regatta course, a boathouse and spectators on the bank" width="480" height="372" loading="lazy" decoding="async"><i></i></span><p><b>regatta-1964-07</b><span>400 × 310 px → 1,600 × 1,240 px</span><span>The marked part, at print size</span></p></div>
<p class="cp-n"><span>40 photos · 1962–1969</span><span>6 marked to check</span></p>
</div>`;
// The blurred photo and, on request, what the detector found. The original is
// not shipped: the point of the block is that those faces are not published.
const blurView = () => `<div class="cp-blur" data-view data-state="ready">${toggles([['ready', 'Ready to publish'], ['found', 'What it found']], 'ready')}
<div class="cp-photo">
<img class="cp-pic" src="${asset('market-ready.webp')}" alt="A busy street market in the sun, stalls under white awnings on both sides; every face is blurred" width="960" height="720" loading="lazy" decoding="async">
<img class="cp-pic cp-found" src="${asset('market-found.svg')}" alt="" width="1280" height="960" loading="lazy" decoding="async">
</div>
<ul class="cp-key"><li class="cp-k-sure"><i></i><b>11</b> sure</li><li class="cp-k-unsure"><i></i><b>19</b> unsure, blurred anyway</li><li>nothing left alone in this one</li></ul>
<p class="cp-n"><span>market-014.jpg · 1 of 64</span><span>originals untouched</span></p>
</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [3, 'img', 'A hundred product photos: background off, same crop, shop sizes', 'rembg, ImageMagick', 'Carol', 'Example Studio', 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.', '104 clean cut-outs in three sizes, named by product code, and three marked to check.'],
  [11, 'img', 'A blurry logo traced into a sharp vector file', 'VTracer, Inkscape', 'Carol', 'Example Studio', 'Our crest only exists as a 300-pixel JPEG from 2008. I need it on a two-metre banner.', 'A vector file that stays sharp at any size, and a sheet showing the crest on light and dark backgrounds.'],
  [12, 'img', 'Old small photos made larger and sharper', 'Real-ESRGAN', 'Peggy', 'Riverside Rowing Club', 'Our 1960s photos only exist as small scans. Can they be good enough for the exhibition wall?', 'Forty photos at four times the size, sharp enough to print. Six are marked: there the enlargement had to invent detail, so she checks them against the prints first.'],
  [28, 'img', '20,000 photos put in order: duplicates out, names by date', 'Czkawka, ExifTool', 'Peggy', 'Riverside Rowing Club', 'Eleven members’ uploads, all called IMG_something. Some order, please.', '6,300 of 19,800 files are duplicates; folders by year and regatta proposed, and everything renamed by date after her yes.'],
  [29, 'img', 'Faces blurred before the photos go online', 'OpenCV', 'Judy', 'Maple Lane Market', 'Saturday’s market photos for our website. We asked nobody’s permission, so no faces, please.', 'All 64 photos with every face blurred, also the ones the detector was unsure of. The originals stay untouched, and seven photos wait for her eye.'],
  [46, 'img', 'Camera raw files developed, the same look for the whole batch', 'RawTherapee, darktable', 'Carol', 'Example Studio', '900 raw files from the regatta.', 'All of them developed, and the 60 sharpest chosen for the website.'],
  [47, 'img', 'A panorama of the shop', 'Hugin', 'Alice', 'Example Studio', 'Fourteen photos turning around in the shop, for the “visit us” page.', 'One seamless wide picture.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-pictures',
  kind: 'caps',
  group: { id: 'img', name: "Pictures", line: "Old prints made sharp, faces blurred before anything goes online, a hundred photos at once." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [12, 29],
  full: {
    12: () => capScreen(12, 'Old photos, larger', you('19:10', capOf[12][6], att('scans-1960s/', '40 scans · 400 px wide')) + turn({
      thoughts: ['A plain resize only stretches the pixels. Real-ESRGAN is made for this; it is not installed, and it installs into her own folder.', 'Enlargers invent what they cannot see. Faces and lettering are where that matters, so I look at every result beside its scan.'],
      tools: [
        tool('bash', 'git clone --depth 1 https://github.com/xinntao/Real-ESRGAN && uv pip install -e Real-ESRGAN', 'Cloning into \'Real-ESRGAN\'...\nInstalled 43 packages in 1 min 12 s\n + realesrgan==0.3.0\n + torch==2.1.2+cpu\ninto ~/photos/.venv · no administrator needed'),
        tool('bash', 'python Real-ESRGAN/inference_realesrgan.py -n RealESRGAN_x4plus -i scans-1960s -o enlarged --tile 200', 'Testing 0 regatta-1964-01\n\tTile 4/4\n…\nTesting 39 boathouse-1969-03\n\tTile 4/4\n40 images · 400 px → 1600 px wide · 1 h 06 min on the CPU'),
        tool('read', 'enlarged/ (40 images, each beside its scan)', '34 hold up: water, boats, coats, buildings\n6 to check: close-up faces (4), lettering on a blade and a banner (2)'),
        tool('write', 'enlarged/CHECK-THESE.md', '6 photos, what to compare in each', 'new · 14 lines'),
      ],
      time: '1 h 14 min',
      reply: '**Forty photos, four times the size:** the 400 px scans are now 1,600 px wide, enough for a sharp 20 cm print. Drag the line across `regatta-1964-07` to compare.\n\n**Six are marked.** In close-up faces and lettering the enlargement invents detail it cannot know. Check those against the prints before they go on the wall.',
      extra: offer('enlarged.zip', '40 images · 58 MB'),
    }), view('regatta-1964-07.png', upscaleView())),
    29: () => capScreen(29, 'Market photos', you('15:40', capOf[29][6], att('market/', '64 photos')) + turn({
      thoughts: ['A blurred lamp post costs nothing, a missed face does. So everything the detector finds is blurred, also on a low score.'],
      tools: [
        tool('write', 'blur_faces.py', 'OpenCV’s YuNet face detector · score ≥ 0.30 is blurred · ≥ 0.80 counts as sure\na low-score box wider than a fifth of the picture is skipped and listed', 'new · 34 lines'),
        tool('bash', 'python3 blur_faces.py market/ --out market/ready/', '64 photos · 1 min 48 s\n412 faces blurred · 131 of them on a low score\n3 boxes skipped as too large\noriginals not modified'),
        tool('read', 'market/ready/ (the 3 skipped boxes, 20 photos at random)', 'skipped: the back of a head, a poster, a mannequin: correct\n7 photos have a face the detector missed or half covered: side-on, sunglasses and mask'),
        tool('write', 'market/ready/TO-CHECK.md', '7 photos, where to look in each', 'new · 9 lines'),
      ],
      time: '4 min 20 s',
      reply: '**All 64 are in `market/ready/`**, every face blurred, also the 131 the detector was unsure of. Your originals are untouched.\n\n**Seven photos need your eye:** in each, a face turned away or half covered that the detector missed. They are listed with where to look. Nothing goes online from here; that step is yours.',
      extra: offer('market-ready.zip', '64 photos · 41 MB'),
    }), view('market-014.jpg', blurView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 3: ['carol', 'cut'], 11: ['carol', 'logo'], 46: ['carol', 'raw'] },
};
