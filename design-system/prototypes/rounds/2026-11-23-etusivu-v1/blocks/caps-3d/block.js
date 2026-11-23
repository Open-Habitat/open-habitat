// Capabilities: 3D and making. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { MIC_IC, you, tool, turn, offer, screen, view } from '../../engine/kit.mjs';
import { sw } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const bracketMock = () => `<div class="brk">${sw(`<g fill="none" stroke-linejoin="round"><path d="M60 150 L140 110 L260 160 L180 200 Z" fill="#dfe6dd" stroke="#4b5a4e" stroke-width="2"/><path d="M60 150 V120 L140 80 V110" fill="#c9d4c6" stroke="#4b5a4e" stroke-width="2"/><path d="M140 80 L260 130 V160" stroke="#4b5a4e" stroke-width="2"/><path d="M60 120 L180 170 V200 M180 170 L260 130" stroke="#4b5a4e" stroke-width="2"/><ellipse cx="110" cy="112" rx="9" ry="5" fill="#fff" stroke="#4b5a4e" stroke-width="2"/><ellipse cx="200" cy="166" rx="9" ry="5" fill="#fff" stroke="#4b5a4e" stroke-width="2"/></g><g font-family="ui-monospace,monospace" font-size="11" fill="#2c6e3f"><text x="20" y="140">30</text><text x="88" y="186">62 mm</text><text x="232" y="196">48</text><text x="150" y="70">Ø 5.5 · 3 mm</text></g>`, '', '0 0 300 220')}<p class="brk-n"><span>bracket.scad · 34 lines</span><span>bracket.stl · ready for the printer</span></p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [5, '3d', 'A turning 3D film of a product', 'Blender', 'Carol', 'Example Studio', 'The new wall shelf exists only as the carpenter’s drawing. A slow spin of it in oak and in black, on a light background.', 'Two eight-second clips and six stills for the product page, rendered on the server over lunch.'],
  [10, '3d', 'An explainer animation for a lesson', 'Manim', 'Erin', 'Example Studio', 'Show why the angles of a triangle add up to 180 degrees.', 'A forty-second animation in which the three corners are torn off and laid along a line.'],
  [14, '3d', 'A spare part designed from measurements, ready to print', 'OpenSCAD, CadQuery', 'Bob', 'Example Studio', 'The bracket on the display rail snapped and nobody sells it any more. Here are five measurements.', 'A picture of the part and a print file; the library’s printer has a new bracket the next day.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-3d',
  kind: 'caps',
  group: { id: '3d', name: "3D and making", line: "A product film without a studio, a spare part from five measurements." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [14],
  full: {
    14: () => capScreen(14, 'Display rail bracket', you('08:55', 'Bracket for the display rail: 62 by 48 millimetres, 30 high, 3 thick, two 5.5 mm holes.', '', `${MIC_IC}Dictated`) + turn({ tools: [
        tool('write', 'parts/bracket.scad', '34 lines · every size a named number'),
        tool('bash', 'openscad -o bracket.stl parts/bracket.scad', 'bracket.stl · 1 part · printable without supports'),
      ], reply: 'Here is the bracket. The sizes are named in *bracket.scad*, so a thicker one is one number away.', extra: offer('bracket.stl', '3D print file · 84 KB') }), view('bracket.stl', bracketMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 5: ['carol', 'tote'], 10: ['erin', 'anim'] },
};
