// Capabilities: Maps and routes. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view } from '../../engine/kit.mjs';
import { sw } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const droneMock = () => `<div class="map">${sw(`<rect width="320" height="200" fill="#9fb08a"/><g fill="#b9c4a4">${Array.from({ length: 30 }, (_, k) => `<circle cx="${(k * 53) % 320}" cy="${(k * 37) % 200}" r="${8 + (k % 4) * 3}" fill="#7f9a6a"/>`).join('')}</g><rect x="40" y="30" width="90" height="56" fill="#c9b8a0" stroke="#7d6c56"/><rect x="190" y="26" width="96" height="60" fill="#c9b8a0" stroke="#7d6c56"/><rect x="40" y="128" width="246" height="46" fill="#c9b8a0" stroke="#7d6c56"/><path d="M40 92 H286 V122 H140 V96 H40 Z" fill="#8e9196"/><path d="M40 92 H286 V122 H140 V96 H40 Z" fill="rgba(44,110,63,.28)" stroke="#2c6e3f" stroke-width="2.5" stroke-dasharray="6 4"/><g font-family="ui-monospace,monospace" font-size="12" font-weight="700"><rect x="176" y="98" width="98" height="20" rx="4" fill="#fff"/><text x="182" y="112" fill="#1f5430">1,240 m²</text></g>`)}<p class="map-n"><span>180 photos · 4 cm per pixel</span><span>orthophoto.tif · yard.obj</span></p></div>`;
const posterMapMock = () => `<div class="pm">${sw(`<rect width="200" height="280" fill="#2f4f73"/><path d="M0 190 C50 170 120 210 200 182 V214 C120 240 60 200 0 222 Z" fill="#26405e"/><g stroke="#e9e1d2" fill="none" stroke-linecap="round">${[[10, 30, 190, 60, 2.2], [0, 90, 200, 110, 3], [20, 0, 60, 280, 2.2], [120, 0, 100, 180, 3], [160, 10, 180, 170, 1.2], [0, 150, 200, 140, 1.4], [70, 40, 150, 160, 1.2], [30, 120, 110, 60, 1.2], [140, 60, 190, 120, 1]].map(([a, b, c, d, w]) => `<path d="M${a} ${b} Q${(a + c) / 2 + 12} ${(b + d) / 2 - 10} ${c} ${d}" stroke-width="${w}"/>`).join('')}</g><circle cx="104" cy="104" r="5" fill="#b45a33" stroke="#e9e1d2" stroke-width="1.5"/><text x="100" y="258" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#e9e1d2">The Old Town</text>`, 'pm-s', '0 0 200 280')}<p class="pm-n"><span>A2 poster · postcard</span><span>two colours · the shop a dot</span></p></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [13, 'maps', 'Twenty delivery stops in the best order', 'OR-Tools, VROOM, OSRM', 'Bob', 'Example Studio', 'Today’s twenty deliveries. The bakery has to be first.', 'The stops in order with arrival times and a map; 38 km against last week’s 52.'],
  [16, 'maps', 'Customers, members or deliveries on a map', 'QGIS, GDAL, Folium', 'Bob', 'Example Studio', 'Where would a pick-up point make sense?', 'Three years of orders mapped by postcode: a fifth come from two districts across the river, with no pick-up point within five kilometres.'],
  [17, 'maps', 'A map of your own neighbourhood as a poster', 'prettymaps, OSMnx', 'Alice', 'Example Studio', 'A map of the old town in our two colours, with the shop as a small dot, for regular customers.', 'A print file for A2 posters and a version sized for postcards.'],
  [18, 'maps', 'An aerial map and 3D model from drone photos', 'OpenDroneMap', 'Mallory', 'Birchwood Housing Company', 'A resident flew a drone over the yard for ten minutes. How big is the paved area?', '180 photos made into an overhead map: 1,240 square metres, ready for the request for quotes.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-maps',
  kind: 'caps',
  group: { id: 'maps', name: "Maps and routes", line: "Your own addresses on a real map, and the best way round them." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [18, 17],
  full: {
    18: () => capScreen(18, 'Yard measurements', you('17:10', capOf[18][6], att('drone/', '180 photos · 1.4 GB')) + turn({ tools: [
        tool('bash', 'odm --project-path drone/ --orthophoto-resolution 4', 'OpenDroneMap, installed by the administrator\northophoto.tif · yard.obj'),
        tool('bash', 'python3 measure.py orthophoto.tif --class paved', 'paved area 1,240 m² (± 2 %)'),
      ], reply: 'The paved area is **1,240 square metres**, give or take 2 %. The overhead map and a 3D model of the yard are in *yard/* for the request for quotes.' }), view('orthophoto.tif', droneMock())),
    17: () => capScreen(17, 'Old town poster', you('16:30', capOf[17][6]) + turn({ tools: [
        tool('bash', 'uv run --with prettymaps python3 poster.py --area "old town" --colours "#2f4f73,#e9e1d2"', 'streets, river and paths from OpenStreetMap'),
        tool('bash', 'inkscape poster.svg --export-type=pdf --export-width=4961', 'old-town-A2.pdf · old-town-postcard.pdf'),
      ], reply: 'The old town in your two colours, the shop a rust dot. **An A2 print file** and a postcard version are in *posters/*.', extra: offer('old-town-A2.pdf', 'PDF · A2') }), view('old-town-A2.pdf', posterMapMock())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 13: ['bob', 'route'], 16: ['bob', 'map'] },
};
