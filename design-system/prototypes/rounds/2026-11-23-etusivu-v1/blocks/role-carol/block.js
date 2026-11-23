// Carol: Designer and artist. The logo, the tote films and the cut-outs are real files made by assets.mjs.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, screen, view, image, video, assets } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';

const asset = assets(import.meta.url);

// ---------- This block's own views ----------
const posterMock = (o) => `<div class="pst"><div class="pst-a3"><small>${esc(o.small)}</small><b>${esc(o.title)}</b><span>${esc(o.by)}</span></div><div class="pst-a5"><b>${esc(o.title)}</b><span>${esc(o.a5)}</span></div><div class="pst-sq"><b>${o.sq.map(esc).join('<br>')}</b></div><p class="pst-n"><span>A3 poster · A5 brochure · square</span><span>CMYK · 3 mm bleed</span></p></div>`;
const rawMock = () => `<div class="raw" data-view data-state="dev">${toggles([['raw', 'As shot'], ['dev', 'Developed']], 'dev')}<div class="raw-g">${Array.from({ length: 8 }, (_, k) => `<span class="raw-p${k === 2 ? ' best' : ''}" style="--c:${['#2f4f73', '#b45a33', '#3f6b4a', '#2f4f73', '#c47a2f', '#5a4a52', '#2f4f73', '#b45a33'][k]}"></span>`).join('')}</div><p class="raw-n"><span>312 raw files · one adjustment</span><span>104 sharpest kept</span></p></div>`;
// The tote: the two films Blender rendered (assets.mjs, scene.py), one per ink.
const INKS = [['indigo', 'Indigo'], ['rust', 'Rust']];
const toteView = () => `<div class="cr-tt" data-view data-state="indigo">${toggles(INKS, 'indigo')}<div class="cr-tt-stage">${INKS.map(([k, l]) => `<div class="cr-tt-film cr-tt-${k}">${video(asset(`tote-${k}.mp4`), { poster: asset(`tote-${k}.webp`), w: 800, h: 600, label: `The linen tote in ${l.toLowerCase()}, turning once` }).replace(' controls ', ' loop ')}<button type="button" class="cr-play" aria-label="Play the ${l.toLowerCase()} film" data-play="Play the ${l.toLowerCase()} film" data-pause="Pause the ${l.toLowerCase()} film"></button></div>`).join('')}</div><p class="cr-n"><span>${INKS.map(([k]) => `<span class="cr-tt-${k}">tote-${k}.mp4</span>`).join('')} · 5 s · one full turn</span><span>Blender 4.5 · Cycles</span></p></div>`;

// The cut-outs: twelve of the photographs, cut out by rembg and set on white (assets.mjs).
const nn = (k) => String(k + 1).padStart(2, '0');
const CODES = ['TB-01 indigo', 'TB-01 rust', 'CU-03 indigo', 'PO-02 rust', 'CU-01 rust', 'TB-02 moss', 'PO-01 indigo', 'CU-04 ochre', 'TB-04 indigo', 'PO-03 moss', 'CU-01 moss', 'TB-02 ochre'];
const cutView = (n, flagged) => `<div class="cr-cut"><div class="cr-pair"><figure class="cr-before">${image(asset('photo-01.webp'), 'The indigo tote as Carol photographed it, on the print table among tins, books and pinned proofs', 960, 720)}<figcaption>As photographed</figcaption></figure><figure class="cr-after">${image(asset('shop-01.webp'), 'The same tote cut out, centred on white', 900, 900)}<figcaption>For the shop</figcaption></figure></div><p class="cr-h"><span>Contact sheet · 12 of ${n}</span><span>${flagged.length} to check</span></p><ul class="cr-sheet">${CODES.map((c, k) => `<li${flagged.includes(k) ? ' class="cr-flag"' : ''}>${image(asset(`cut-${nn(k)}.webp`), `${c}, cut out on white${flagged.includes(k) ? ', marked to check' : ''}`, 320, 320)}<span>${esc(c.split(' ')[0])}</span></li>`).join('')}</ul></div>`;

// The logo: the 200-pixel JPEG and what vtracer traced from it (assets.mjs), each with the same spot enlarged five times.
const logoPane = (file, name, meta, alt) => `<figure class="cr-lg"><div class="cr-lg-art"><img src="${asset(file)}" alt="${esc(alt)}" width="200" height="200" loading="lazy" decoding="async"><span class="cr-lg-spot" aria-hidden="true"></span><span class="cr-lg-lens" aria-hidden="true"><img src="${asset(file)}" alt="" width="200" height="200" loading="lazy" decoding="async"></span></div><figcaption><b>${esc(name)}</b><span>${esc(meta)}</span></figcaption></figure>`;
const logoView = () => `<div class="cr-logo">${logoPane('logo-2016.webp', 'logo-2016.jpg', '200 × 200 px · 5 KB', 'Example Studio’s first logo as a small, soft JPEG: a cream sprig in an indigo circle')}${logoPane('logo-2016.svg', 'logo-2016.svg', '6 paths · 3 colours', 'The same logo traced into clean curves')}<p class="cr-n"><span>In the lens: the same spot, five times larger</span><span>vtracer</span></p></div>`;

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
    { id: 'logo', title: 'Our first logo', segs: [['09:20', 'run', 'Tracing a 200-pixel logo'], ['09:40', 'turn', 'Traced: 6 paths'], ['09:50', 'quiet', 'logo-2016.svg']] },
    { id: 'tote', title: 'Tote product film', segs: [['11:20', 'run', 'Rendering in Blender'], ['12:52', 'turn', 'Two spins ready'], ['13:00', 'quiet', 'render/out']] },
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
      did: 'Nobody kept the original. Her agent enlarges the little picture, settles every pixel on the studio’s three colours and traces the shapes into curves. The file she gets back is sharp at any size, a three-metre banner included.',
      screen: () => screen('Our first logo', you('09:20', 'Our first logo only exists as a 200-pixel JPEG from 2016. I need it sharp for the ten-year banner.', att('logo-2016.jpg', 'Image · 200 × 200 px · 5 KB')) + turn({ thoughts: ['Tracing the JPEG as it is would trace its blur and blocks too. Enlarging it and settling it on three flat colours first'], tools: [
        tool('bash', 'magick logo-2016.jpg -resize 800% -blur 0x5 +dither -remap banner/studio-colours.png -median 11 banner/logo-big.png', '1600 × 1600 px · 3 colours: indigo, cream, rust'),
        tool('bash', 'vtracer --input banner/logo-big.png --output banner/logo-2016.svg --mode spline --filter_speckle 100', '6 paths · 3 colours · 47 KB'),
        tool('bash', 'inkscape banner/logo-2016.svg --export-type=pdf,png --export-width=6000', 'banner/logo-2016.pdf\nbanner/logo-2016.png · 6000 × 6000 px'),
      ], time: '3 min 12 s', reply: 'The logo is curves now: **six paths in your three colours**, sharp at three metres. The SVG, a PDF for the printer and a large PNG are in *banner/*. The JPEG had smeared the two rust dots; say the word and I redraw them as circles.' }), view('logo-2016.svg', logoView()), 'Example Studio'),
    },
    {
      s: 'tote', at: '12:52', pick: 1, ask: 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.',
      did: 'The tote does not exist yet: there are pattern pieces and a scan of her print. Her agent sews it in Blender, presses the print onto linen, lights it like a studio and renders the spin in both inks on the server while she is at lunch.',
      screen: () => screen('Tote product film', you('11:20', 'A slow spin of the new tote for the product page, in indigo and in rust, on a light background.', att('tote-pattern.svg', 'Pattern pieces') + att('winter-print-scan.tif', 'Scan · 600 dpi')) + turn({ thoughts: ['A spin of a bag that is not sewn yet is a 3D render. Blender can do it without a screen'], tools: [
        tool('bash', 'blender --version', 'bash: blender: command not found'),
        tool('bash', 'tar -xJf blender-4.5.16-linux-x64.tar.xz -C ~/apps && ~/apps/blender/blender --version', 'Blender 4.5.16 LTS\nunpacked into ~/apps · no administrator needed'),
        tool('write', 'render/tote.py', 'bag from the pattern pieces: 38 × 42 cm, 8.5 cm gusset, two handles\nlinen: woven, slubbed, a little sheen · the scan as the ink, pressed on unevenly\npaper sweep, three soft lights · one full turn in 120 frames', 'new · 418 lines'),
        tool('bash', 'blender -b -P render/tote.py -- --ink indigo,rust', 'Cycles on the CPU · 800 × 600 · 32 samples, denoised\nindigo  120 frames\nrust    120 frames\nffmpeg: render/out/tote-indigo.mp4 · tote-rust.mp4 · one still each'),
      ], time: '48 min 30 s', reply: 'Both spins are in *render/out*: **one full turn in five seconds, in indigo and in rust**, on a paper-white sweep, with a still of each. They rendered while you were at lunch.', extra: offer('tote-indigo.mp4', 'Video · 5 s · 0.4 MB') }), view('render/out', toteView()), 'Example Studio'),
    },
    {
      s: 'cut', at: '13:10', pick: 1, hand: 'Hands to Alice: the cut-outs go into team/photos/winter, where her newsletter picks up two of them at 14:05.',
      ask: 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.',
      did: 'She photographed them on the print table, tins and proofs and all. Her agent cuts every product out, centres it on white with the same margin, saves the shop’s three sizes named by product code, and marks the three it is not sure of.',
      screen: () => screen('Winter prints cut-outs', you('13:02', 'The 104 winter photos: background off, on the shop’s white, in the shop’s three sizes.', att('photos/winter-developed/', '104 photos')) + turn({ tools: [
        tool('bash', 'uv tool install "rembg[cpu,cli]"', 'Installed 1 executable: rembg\ninto ~/.local · no administrator needed'),
        tool('bash', 'rembg p -m isnet-general-use photos/winter-developed/ cutouts/', '104 of 104 cut out'),
        tool('bash', 'magick mogrify -path team/photos/winter -trim +repage -resize 1280x1280 -background white -gravity center -extent 1600x1600 -flatten cutouts/*.png', '104 on white · every product fills 80 % of its square'),
        tool('bash', 'python3 tools/shop-sizes.py team/photos/winter --sizes 1600,800,320 --name-by code', '312 files · 3 sizes · named by product code\n3 to check: TB-01 rust and CU-01 moss kept a piece of the roller · PO-01 indigo lost its tab'),
      ], time: '7 min 50 s', reply: '**104 ready** in *team/photos/winter*, where Alice and the shop page can use them. Three need your eye, marked on the contact sheet: the ink roller got into two, and one pouch lost its tab.' }), view('team/photos/winter', cutView(104, [1, 6, 10])), 'Example Studio'),
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
