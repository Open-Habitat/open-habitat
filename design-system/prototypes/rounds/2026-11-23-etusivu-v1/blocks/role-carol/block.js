// Carol: Designer and artist. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, screen, view } from '../../engine/kit.mjs';
import { toggles, item, crest } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const posterMock = (o) => `<div class="pst"><div class="pst-a3"><small>${esc(o.small)}</small><b>${esc(o.title)}</b><span>${esc(o.by)}</span></div><div class="pst-a5"><b>${esc(o.title)}</b><span>${esc(o.a5)}</span></div><div class="pst-sq"><b>${o.sq.map(esc).join('<br>')}</b></div><p class="pst-n"><span>A3 poster · A5 brochure · square</span><span>CMYK · 3 mm bleed</span></p></div>`;
const rawMock = () => `<div class="raw" data-view data-state="dev">${toggles([['raw', 'As shot'], ['dev', 'Developed']], 'dev')}<div class="raw-g">${Array.from({ length: 8 }, (_, k) => `<span class="raw-p${k === 2 ? ' best' : ''}" style="--c:${['#2f4f73', '#b45a33', '#3f6b4a', '#2f4f73', '#c47a2f', '#5a4a52', '#2f4f73', '#b45a33'][k]}"></span>`).join('')}</div><p class="raw-n"><span>312 raw files · one adjustment</span><span>104 sharpest kept</span></p></div>`;
const toteMock = () => `<div class="tt" data-view data-state="indigo">${toggles([['indigo', 'Indigo'], ['rust', 'Rust']], 'indigo')}<div class="tt-stage"><div class="tt-spin"><div class="tt-tote">${['f', 'b', 'l', 'r', 'd'].map((f) => `<i class="tt-${f}"></i>`).join('')}</div></div><span class="tt-floor" aria-hidden="true"></span></div><p class="tt-n"><span>tote-indigo.mp4 · 8 s · 192 frames</span><span>6 stills, 2400 × 2400</span></p></div>`;
const ITEM_SHAPES = ['tote', 'towel', 'apron', 'napkin', 'cushion', 'tote', 'apron', 'towel', 'napkin', 'cushion', 'tote', 'apron'];
const cutoutMock = (n = 96, flagged = 4) => `<div class="cut" data-view data-state="after">${toggles([['before', 'As photographed'], ['after', 'For the shop']], 'after')}<div class="cut-pair"><div class="cut-ph">${item('tote', 1)}</div></div><p class="cut-h">Contact sheet · ${n} items · ${flagged} to check</p><div class="cut-grid">${ITEM_SHAPES.map((k, i) => `<span class="cut-c${i === 7 ? ' flag' : ''}">${item(k, i)}</span>`).join('')}</div></div>`;
const pixelCrest = () => { let r = ''; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const cx = x * 8 + 4, cy = y * 8 + 4; const inS = cy > 8 && cy < 88 && Math.abs(cx - 50) < 36 - Math.max(0, cy - 52) * 0.8; if (!inS) continue; const light = (Math.abs(cy - 44) < 5 && Math.abs(cx - 50) < 20) || (Math.abs(cx - 50) < 4 && cy > 24 && cy < 56) || (cy > 54 && cy < 64 && (x + y) % 3 === 0); r += `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${light ? '#c9c3b5' : ['#2f4f73', '#36577c', '#284766'][(x * 7 + y * 3) % 3]}"/>`; } return r; };
const vectorMock = (orig = 'crest-2008.jpg · 300 px', vec = 'crest.svg', note = 'Sharp at two metres · SVG, PDF, transparent PNG · light and dark backgrounds') => `<div class="vec" data-view data-state="vector">${toggles([['original', orig], ['vector', vec]], 'vector')}<div class="vec-b"><svg class="vec-o" viewBox="0 0 100 100" shape-rendering="crispEdges" aria-hidden="true">${pixelCrest()}</svg><svg class="vec-v" viewBox="0 0 100 100" aria-hidden="true">${crest}</svg></div><p class="vec-n">${esc(note)}</p></div>`;

export default {
  id: 'role-carol',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'carol', name: 'Carol', role: 'Designer and artist', org: 'Example Studio', color: '#b45a33',
  blurb: 'Carol designs Example Studio’s prints and everything the shop shows: photos, films, posters. She also makes her own linocuts.',
  places: [['08:30', 'In the studio', 'studio'], ['10:15', 'Planning with Alice and Bob', 'meet'], ['11:00', 'In the studio', 'studio'], ['12:15', 'Lunch', 'lunch'], ['12:50', 'In the studio', 'studio'], ['15:40', 'At the print table', 'box']],
  sess: [
    { id: 'raw', title: 'Winter prints, raw files', segs: [['08:35', 'run', 'Developing 312 raw files'], ['08:50', 'turn', '312 developed · 104 kept'], ['09:00', 'quiet', 'photos/winter-developed']] },
    { id: 'logo', title: 'Our first logo', segs: [['09:20', 'run', 'Tracing a 200-pixel logo'], ['09:40', 'turn', 'Vector ready'], ['09:50', 'quiet', 'logo-2016.svg']] },
    { id: 'tote', title: 'Tote product film', segs: [['11:20', 'run', 'Rendering in Blender'], ['12:52', 'turn', 'Two films ready'], ['13:00', 'quiet', 'tote-indigo.mp4']] },
    { id: 'cut', title: 'Winter prints cut-outs', segs: [['13:02', 'run', 'Cutting out 104 photos'], ['13:10', 'turn', '104 ready · 3 to check'], ['13:20', 'quiet', 'team/photos/winter']] },
    { id: 'poster', title: 'January course poster', segs: [['15:00', 'run', 'Laying out 3 formats'], ['15:10', 'turn', 'Poster, brochure, square'], ['15:30', 'quiet', 'print/january-course']] },
  ],
  g: [
    {
      s: 'raw', at: '08:50', ask: 'Yesterday’s 312 raw files of the winter prints. Develop them all like this one, and keep the sharpest of each print.',
      did: 'She adjusted one photo by hand last night. Her agent applies the same adjustment to all 312 raw files on the server, compares the shots of each print, and keeps the sharpest, so she looks at 104 instead of 312.',
      screen: () => screen('Winter prints, raw files', you('08:35', 'Yesterday’s 312 raw files of the winter prints. Develop them all like this one, and keep the sharpest of each print.', att('photos/winter-raw/', '312 raw files · 9.4 GB') + att('tote-indigo-04.pp3', 'Her adjustment')) + turn({ tools: [
        tool('bash', 'rawtherapee-cli -p tote-indigo-04.pp3 -o photos/winter-developed/ -c photos/winter-raw/', '312 developed with your adjustment'),
        tool('bash', 'python3 tools/sharpest.py photos/winter-developed/ --group-by product', '104 products · the sharpest of each kept · the rest in /other'),
      ], time: '15 min 33 s', reply: 'All **312 developed** with your adjustment. The sharpest of each print, **104**, are in *winter-developed*; the others are in a folder beside them.' }), view('winter-developed/', rawMock()), 'Example Studio'),
    },
    {
      s: 'logo', at: '09:40', pick: 1, ask: 'Our first logo only exists as a 200-pixel JPEG from 2016. I need it sharp for the ten-year banner.',
      did: 'Nobody has the original file. Her agent traces the small picture into clean curves, evens out the colours to the studio’s blue, and gives her files that stay sharp at any size.',
      screen: () => screen('Our first logo', you('09:20', 'Our first logo only exists as a 200-pixel JPEG from 2016. I need it sharp for the ten-year banner.', att('logo-2016.jpg', 'Image · 200 × 200 px · 14 KB')) + turn({ tools: [
        tool('bash', 'vtracer --input logo-2016.jpg --output logo-2016.svg --colormode color', '3 colours · 14 paths'),
        tool('bash', 'inkscape logo-2016.svg --export-type=pdf,png --export-width=6000', 'logo-2016.pdf · logo-2016.png (6000 px, transparent)'),
      ], time: '20 min 18 s', reply: 'The logo is curves now, so it stays sharp at three metres. **SVG, PDF and a large PNG** are in *banner/*.' }), view('logo-2016.svg', vectorMock('logo-2016.jpg · 200 px', 'logo-2016.svg', 'Sharp at three metres · SVG, PDF, transparent PNG')), 'Example Studio'),
    },
    {
      s: 'tote', at: '12:52', pick: 1, ask: 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.',
      did: 'After the planning she gives her agent the tote’s pattern pieces and a scan of the print. It builds the bag in Blender, puts her print on it, and renders two eight-second films and six stills on the server while she is at lunch.',
      screen: () => screen('Tote product film', you('11:20', 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.', att('tote-pattern.svg', 'Pattern pieces') + att('winter-print-scan.tif', 'Scan · 600 dpi')) + turn({ tools: [
        tool('bash', 'blender --version || fetch blender into ~/apps', 'Blender 4.2 · unpacked into ~/apps/blender · no administrator needed'),
        tool('write', 'render/tote.py', 'bag from the pattern pieces · her print as the cloth · soft light · 192-frame turn'),
        tool('bash', 'blender -b -P render/tote.py -- --colour indigo,rust', 'rendered 384 frames on the server in 58 min\ntote-indigo.mp4 · tote-rust.mp4 · 6 stills'),
      ], time: '1 h 32 min', reply: 'Two eight-second films and six stills are in *render/out*. They rendered while you were at lunch.', extra: offer('tote-indigo.mp4', 'Video · 8 s · 7 MB') }), view('tote-indigo.mp4', toteMock()), 'Example Studio'),
    },
    {
      s: 'cut', at: '13:10', pick: 1, hand: 'Hands to Alice: the cut-outs go into team/photos/winter, where her newsletter picks up two of them at 14:05.',
      ask: 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.',
      did: 'Her agent cuts every product out, puts it on the shop’s white with the same margin, saves the three sizes the shop uses named by product code, and marks the three where a shadow got caught.',
      screen: () => screen('Winter prints cut-outs', you('13:02', 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.', att('photos/winter-developed/', '104 photos')) + turn({ tools: [
        tool('bash', 'uv tool install "rembg[cpu,cli]"', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'rembg p photos/winter-developed/ cutouts/', '104 cut out · 3 caught a shadow'),
        tool('bash', 'magick mogrify -background white -gravity center -extent 1:1 -resize 1600x1600 …', '312 files · 3 sizes · named by product code → team/photos/winter'),
      ], time: '8 min 40 s', reply: '**104 ready** in *team/photos/winter*, where Alice and the shop page can use them. Three caught a shadow at the edge; they are marked on the contact sheet.' }), view('team/photos/winter', cutoutMock(104, 3)), 'Example Studio'),
    },
    {
      s: 'poster', at: '15:10', ask: 'Poster, A5 brochure and a square image for Erin’s January course. The text is in her course file.',
      did: 'Her agent reads the dates and the price from Erin’s course file in the team folder, lays out an A3 poster, a folded A5 brochure and a square image from one layout, and makes the print shop’s version with bleed.',
      screen: () => screen('January course poster', you('15:00', 'Poster, A5 brochure and a square image for Erin’s January course. The text is in her course file.') + turn({ tools: [
        tool('read', 'team/courses/2027-01-block-printing.md', 'four Saturdays from 9 Jan · €240 · 12 places a group · Erin'),
        tool('write', 'print/january-course.typ', 'one layout · three formats'),
        tool('bash', 'typst compile print/january-course.typ', 'poster-A3.pdf (CMYK, 3 mm bleed) · brochure-A5.pdf · square.png'),
      ], time: '10 min 25 s', reply: 'Three files from one layout. The A3 has the bleed the print shop asks for; the brochure folds to A6.', extra: offer('poster-A3.pdf', 'PDF · print-ready') }), view('poster-A3.pdf', posterMock({ small: 'Example Studio · from 9 January', title: 'Block printing for beginners', by: 'Four Saturdays with Erin', a5: '9–30 Jan', sq: ['Print,', 'press,', 'repeat'] })), 'Example Studio'),
    },
  ],
},
};
