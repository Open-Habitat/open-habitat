// Capabilities: 3D and making. The showpiece is real end to end: bracket.scad
// beside this file is the model, OpenSCAD exports it, PrusaSlicer slices it
// and Blender renders both the part and the sliced print (assets.mjs,
// scene.py). NOTES.md has the programs, versions and commands.
// The block contract is in ../../BLOCKS.md.
import { readFileSync } from 'node:fs';
import { MIC_IC, esc, you, tool, turn, offer, screen, view, assets } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';
const asset = assets(import.meta.url);

// The five sizes shown in the view are read from the model itself.
const scad = readFileSync(new URL('./bracket.scad', import.meta.url), 'utf8');
const SIZES = ['width', 'depth', 'height', 'thickness', 'hole'].map((name) => {
  const [, value, note] = scad.match(new RegExp(`^${name}\\s*=\\s*([\\d.]+);\\s*//\\s*(.*)$`, 'm'));
  return [name, value, note];
});
const scadLines = scad.trimEnd().split('\n').length;
// What PrusaSlicer reported for this model (assets.mjs prints the same lines).
const PRINT = { layers: 310, time: '1 h 18 min', grams: '18 g' };
const CUTS = [1, 34, 68, 110, 155, 200, 242, 276, 310];
const START = 4; // the frame shown before the reader moves the slider
const nnn = (n) => String(n).padStart(3, '0');

// ---------- This block's own view ----------
// One picture area with three states: the part with its measurements drawn
// over it, the part alone, and the sliced print with a slider through its
// layers (client.js; without JavaScript the middle frame shows).
const bracketView = () => `<div class="c3" data-view data-state="sizes">${toggles([['sizes', 'Measured'], ['part', 'The part'], ['print', 'On the printer']], 'sizes')}
<div class="c3-stage">
<img class="c3-pic c3-part" src="${asset('bracket.webp')}" alt="The bracket rendered in dark green plastic: a wall plate with two countersunk screw holes, a shelf and a low lip at the front, the inside of the bend rounded" width="1200" height="900" loading="lazy" decoding="async">
<img class="c3-pic c3-sizes" src="${asset('bracket-sizes.svg')}" alt="Its measurements drawn on it: 62 wide, 48 deep, 30 high, 3 thick, two 5.5 millimetre holes" width="1200" height="900" loading="lazy" decoding="async">
<div class="c3-print">${CUTS.map((c, i) => `<img class="c3-pic c3-layer${i === START ? ' on' : ''}" data-layer="${c}" src="${asset(`layer-${nnn(c)}.webp`)}" alt="${i === START ? `The sliced print at layer ${c} of ${PRINT.layers}: the bracket stands on its end on the print bed, orange outer walls, yellow inner walls, red infill inside the bend` : ''}" width="1000" height="750" loading="lazy" decoding="async">`).join('')}</div>
</div>
<div class="c3-under c3-under-part">
<ul class="c3-sz">${SIZES.map(([name, value, note]) => `<li><code>${esc(name)} = <b>${esc(value)}</b>;</code><span>${esc(note)}</span></li>`).join('')}</ul>
</div>
<div class="c3-under c3-under-print">
<label class="c3-scrub"><span>Layer <b class="c3-at">${CUTS[START]}</b> of ${PRINT.layers}</span><input class="c3-range" type="range" min="0" max="${CUTS.length - 1}" value="${START}" step="1" aria-label="Move through the layers of the print"></label>
<ul class="c3-facts"><li><b>${PRINT.time}</b>to print</li><li><b>${PRINT.grams}</b>of PETG</li><li><b>0</b>supports</li></ul>
<p class="c3-key"><span><i class="k-out"></i>outer wall</span><span><i class="k-in"></i>inner walls</span><span><i class="k-fill"></i>infill</span><span><i class="k-solid"></i>solid layer</span></p>
</div>
<p class="c3-n"><span>bracket.scad · ${scadLines} lines</span><span>bracket.stl · 362 KB</span></p>
</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [5, '3d', 'A turning 3D film of a product', 'Blender', 'Carol', 'Example Studio', 'The new wall shelf exists only as the carpenter’s drawing. A slow spin of it in oak and in black, on a light background.', 'Two eight-second clips and six stills for the product page, rendered on the server over lunch.'],
  [10, '3d', 'An explainer animation for a lesson', 'Manim', 'Erin', 'Example Studio', 'Show why the angles of a triangle add up to 180 degrees.', 'A forty-second animation in which the three corners are torn off and laid along a line.'],
  [14, '3d', 'A spare part from five measurements, ready for the printer', 'OpenSCAD, PrusaSlicer, Blender', 'Bob', 'Example Studio', 'The bracket on the display rail snapped, and nobody sells it any more. I measured the old one.', 'A picture with the measurements on it and a print file already tried in a slicer. The library’s printer has a new bracket the next day.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-3d',
  kind: 'caps',
  group: { id: '3d', name: "3D and making", line: "A spare part from five measurements, on the printer the same day." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [14],
  full: {
    14: () => capScreen(14, 'Display rail bracket', you('08:55', 'The bracket on the display rail snapped at the bend, and nobody sells it any more. I measured the old one: 62 wide, 48 deep, 30 high, 3 thick, and two screw holes of 5.5 millimetres.', '', `${MIC_IC}Dictated`) + turn({
      thoughts: [
        'Five measurements describe an L with a lip at the front. I write it as a model in which each of them is a named number.',
        'It snapped at the bend. A printed part is weakest between its layers, so this one prints standing on its end, the layers running around the bend, and the inside corner is rounded.',
      ],
      tools: [
        tool('write', 'parts/bracket.scad', SIZES.map(([name, value, note]) => `${`${name}`.padEnd(9)} = ${`${value};`.padEnd(5)} // ${note}`).join('\n') + '\n\n// Not measured, chosen: the old one snapped at the bend.\nbend      = 9;    // rounding inside the bend\n…', `new · ${scadLines} lines`),
        tool('bash', 'openscad -o bracket.stl parts/bracket.scad', 'ECHO: "bracket 62 x 48 x 30 mm, 3 mm thick, 2 holes of 5.5 mm"\nTotal rendering time: 0:00:00.835\n   Top level object is a 3D object:\n   Simple:        yes\n   Vertices:     1142\n   Facets:        765'),
        tool('bash', 'prusa-slicer --export-gcode --layer-height 0.2 --perimeters 3 --filament-type PETG -o bracket.gcode bracket.stl', '65 => Searching support spots\n69 => Alert if supports needed\n89 => Calculating overhanging perimeters\n88 => Generating skirt and brim\n90 => Exporting G-code to bracket.gcode\nSlicing result exported to bracket.gcode'),
        tool('bash', 'grep -E "printing time|used \\[g\\]|^; support_material =" bracket.gcode', '; filament used [g] = 17.69\n; estimated printing time (normal mode) = 1h 17m 40s\n; support_material = 0'),
        tool('bash', 'blender -b -P parts/pictures.py -- bracket.stl bracket.gcode', 'Saved: \'bracket.png\'\n87942 extrusion moves, 310 layers\nSaved: \'layers/layer-001.png\'\n…\nSaved: \'layers/layer-310.png\''),
      ],
      time: '9 min 40 s',
      reply: '**Here is your bracket**, to the five measurements, ready for the printer: about 1 h 18 min and 18 g of PETG, no supports.\n\n**Two things I chose.** The inside of the bend is rounded, and the part prints standing on its end, so the layers run around the bend instead of across it. That is where the old one gave way.\n\nEvery size is a named number in `bracket.scad`: a thicker one is one number away.',
      extra: offer('bracket.stl', '3D print file · 362 KB'),
    }), view('bracket.stl', bracketView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 5: ['carol', 'tote'], 10: ['erin', 'anim'] },
};
