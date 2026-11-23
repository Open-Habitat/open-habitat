// Capabilities: Maps and routes. Two showpieces, both real: a park stitched
// from 77 drone photos by OpenDroneMap, with its paved surfaces measured and a
// flight around the 3D model, and an old town drawn from OpenStreetMap as an
// A2 poster. assets.mjs makes the pictures; NOTES.md has the programs,
// commands and licences. The block contract is in ../../BLOCKS.md.
import { you, att, tool, turn, offer, screen, view, video, assets } from '../../engine/kit.mjs';
import { toggles } from '../../engine/views.mjs';
const asset = assets(import.meta.url);

// What src/measure.py measured on the orthophoto (assets.mjs prints these).
const PARK = { photos: 77, carPark: '1,283', paths: '744', total: '2,027', road: '3,022', bar: 50, barPct: 18.9, cm: '4.0' };

// ---------- This block's own views ----------
// The orthophoto with the measured surfaces laid over it, and the flight
// around the model. Without JavaScript the measured map shows.
const parkView = () => `<div class="cm-park" data-view data-state="paved">${toggles([['map', 'Map'], ['paved', 'Paved area'], ['model', '3D model']], 'paved')}
<div class="cm-frame cm-map">
<img class="cm-pic" src="${asset('park-ortho.webp')}" alt="A park seen straight from above: a car park beside a road, a shelter, pale paths winding through meadow, a pond among trees" width="1000" height="800" loading="lazy" decoding="async">
<img class="cm-pic cm-paved" src="${asset('park-paved.webp')}" alt="" width="1000" height="800" loading="lazy" decoding="async">
<span class="cm-tag" style="left:36%;top:63%">Car park<b>${PARK.carPark} m²</b></span><span class="cm-tag" style="left:57%;top:48%">Paths<b>${PARK.paths} m²</b></span>
<span class="cm-scale" style="width:${PARK.barPct}%" aria-hidden="true">${PARK.bar} m<i></i></span>
</div>
<div class="cm-frame cm-model">${video(asset('park-model.mp4'), { poster: asset('park-model.webp'), w: 960, h: 600, label: 'A flight around the 3D model of the park' })}</div>
<ul class="cm-key"><li style="--c:#ffb020"><i></i>Car park and its drive<b>${PARK.carPark} m²</b></li><li style="--c:#40d6ff"><i></i>Paths<b>${PARK.paths} m²</b></li><li class="cm-sum"><i style="background:none"></i>To resurface<b>${PARK.total} m²</b></li><li class="cm-out"><i></i>The public road, left out<b>${PARK.road} m²</b></li></ul>
<p class="cm-n"><span>${PARK.photos} photos · ${PARK.cm} cm per pixel</span><span>orthophoto.tif · model.obj</span></p>
</div>`;
// The sheet and the postcard on a wall; "Up close" is a part of the A2 sheet
// at print size, where the lanes and houses show.
const posterView = () => `<div class="cm-poster" data-view data-state="wall">${toggles([['wall', 'Poster and postcard'], ['close', 'Up close']], 'wall')}
<div class="cm-wall">
<img class="cm-a2" src="${asset('old-town-a2.webp')}" alt="A poster map in navy and cream: a river winds in two tight bends around an old town, the streets in cream, a small rust dot on a lane in the middle, and “The Old Town” in spaced capitals at the foot" width="840" height="1188" loading="lazy" decoding="async">
<img class="cm-card" src="${asset('old-town-postcard.webp')}" alt="The same map as a postcard, cropped closer to the river bend" width="640" height="454" loading="lazy" decoding="async">
</div>
<div class="cm-close"><img class="cm-pic" src="${asset('old-town-detail.webp')}" alt="A part of the poster at print size: lanes, footpaths and single houses on the island in the river bend, the rust dot where two lanes meet" width="840" height="1050" loading="lazy" decoding="async"></div>
<p class="cm-n"><span>A2 · 420 × 594 mm · vector</span><span>© OpenStreetMap contributors</span></p>
</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [13, 'maps', 'Twenty delivery stops in the best order', 'OR-Tools, VROOM, OSRM', 'Bob', 'Example Studio', 'Today’s twenty deliveries. The bakery has to be first.', 'The stops in order with arrival times and a map; 38 km against last week’s 52.'],
  [16, 'maps', 'Customers, members or deliveries on a map', 'QGIS, GDAL, Folium', 'Bob', 'Example Studio', 'Where would a pick-up point make sense?', 'Three years of orders mapped by postcode: a fifth come from two districts across the river, with no pick-up point within five kilometres.'],
  [17, 'maps', 'A map of your own neighbourhood as a poster', 'OSMnx, Matplotlib', 'Alice', 'Example Studio', 'A map of the old town in our two colours, the shop a small dot. Something our regulars would hang on a wall.', 'The old town drawn street by street from OpenStreetMap: an A2 poster ready for the printer, and the same map as a postcard.'],
  [18, 'maps', 'An aerial map and 3D model from drone photos', 'OpenDroneMap', 'Mallory', 'Birchwood Park Association', 'A member flew her drone over our park. How much asphalt do the car park and the paths need? I have to ask for quotes.', `${PARK.photos} photos stitched into one map she can measure on: ${PARK.total} square metres to resurface, and a 3D model of the park to go with the request.`],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-maps',
  kind: 'caps',
  group: { id: 'maps', name: "Maps and routes", line: "Your own places on a real map: measured from the air, drawn for the wall, driven in the best order." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [18, 17],
  full: {
    18: () => capScreen(18, 'Park from the air', you('17:10', capOf[18][6], att('drone/', `${PARK.photos} photos · 518 MB`)) + turn({
      thoughts: ['Single photos cannot be measured: each is tilted and overlaps the next. OpenDroneMap stitches them into one map where every pixel is the same size on the ground.', 'The photos also show the public road beside the park. That is not the association’s to resurface, so it is measured and left out of the total.'],
      tools: [
        tool('bash', 'odm --project-path ~/park drone --orthophoto-resolution 4 --dsm', '[INFO]    Initializing ODM 3.6.2\n[INFO]    Found 77 usable images\n…\n[INFO]    ODM app finished\n77 of 77 photos placed · 16.1 million points\n15 min 26 s\nodm_orthophoto.tif · dsm.tif\nodm_textured_model_geo.obj'),
        tool('write', 'measure.py', 'pale, colourless ground is paving\nwhat stands above the ground is a roof\npixels × area of one pixel = square metres', 'new · 107 lines'),
        tool('bash', 'python3 measure.py odm_orthophoto/odm_orthophoto.tif odm_dem/dsm.tif park/', '9272 x 7380 px · 4.0 cm per pixel · 8.8 ha\ncar park and drive    1,283 m²\npaths                   744 m²\nto resurface          2,027 m²\nroad, left out        3,022 m²'),
        tool('read', 'park/paved.png over the orthophoto', 'car park: parked cars count as paved,\n  the shelter’s roof does not\npaths: the concrete walk to the meadow;\n  the mown grass trails are not paved\nthe first pass also marked sky reflected\n  in the pond: pond left out, measured again'),
      ],
      time: '19 min 40 s',
      reply: `**${PARK.total} square metres to resurface:** the car park with its drive is ${PARK.carPark} m², the paths ${PARK.paths} m². The public road along the edge is not in the total.\n\nThe overhead map is true to scale, so a contractor can measure on it too. It and a 3D model of the park are in *park/* for the request for quotes. Tree crowns hide a few metres of path, so read the path figure as a minimum.`,
      extra: offer('park-map.zip', 'Map, 3D model, areas · 96 MB'),
    }), view('orthophoto.tif', parkView())),
    17: () => capScreen(17, 'Old town poster', you('16:30', capOf[17][6]) + turn({
      thoughts: ['A poster map needs only streets, water and houses. OpenStreetMap has them for the old town, and OSMnx fetches exactly that area.', 'Two colours: navy for the paper, cream for the streets. Water and houses get tints of the navy, so the dot is the only other colour on the sheet.'],
      tools: [
        tool('write', 'poster.py', 'streets by class and width, river, houses\nthe shop’s address as a rust dot\ntitle and credit line at the foot', 'new · 136 lines'),
        tool('bash', 'uv run --with osmnx python3 poster.py', 'old-town-A2 · 420 x 594 mm · 1280 m across\n  2202 street segments · 2598 buildings\nold-town-postcard · 148 x 105 mm · 940 m across\n  844 street segments · 922 buildings'),
        tool('bash', 'pdfinfo posters/old-town-A2.pdf', 'Producer:        Matplotlib pdf backend v3.11.2\nPage size:       1190.55 x 1683.78 pts (A2)\nFile size:       542559 bytes'),
      ],
      time: '4 min 10 s',
      reply: 'The old town in your navy and cream, the shop a rust dot where the two lanes meet. **The A2 file is vector**, so it prints sharp at any size; the postcard is the same map cropped closer.\n\nThe map data is OpenStreetMap’s, and the credit it asks for is at the foot of both. Nothing has gone to a printer.',
      extra: offer('old-town-A2.pdf', 'PDF · A2 · 542 KB'),
    }), view('old-town-A2.pdf', posterView())),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 13: ['bob', 'route'], 16: ['bob', 'map'] },
};
