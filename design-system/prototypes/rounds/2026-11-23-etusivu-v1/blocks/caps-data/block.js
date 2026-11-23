// Capabilities: Data and numbers. Two capabilities drawn in full, each with a
// picture the named program made (assets.mjs): Bob's returns process as a
// Graphviz chart, and a rowing club's results as a Datasette site.
// The block contract is in ../../BLOCKS.md.
import { MIC_IC, you, att, tool, turn, screen, view, image, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);

// ---------- This block's own views ----------
// The chart as dot drew it (401 × 772 px), with the file line under it.
const chartView = () => `<figure class="cd-chart">${image(asset('returns.svg'), 'Flow chart of a return: the customer asks, Bob finds the order, within 30 days Bob sends a return label, Dave checks the item, and if it is as sold Bob refunds under €100; over €100 the box asks who approves, because nobody is named.', 401, 772)}<figcaption><span>processes/returns.svg</span><span>Graphviz · from 2 min of speech</span></figcaption></figure>`;
// The site as Chromium captured it from Datasette (380 × 600 CSS px at 2×), in a browser frame.
const siteView = () => `<div class="cd-br"><p class="cd-url"><span class="cd-lock" aria-hidden="true"></span>results.riverside-rowing.example.org</p>${image(asset('results.webp'), 'The Riverside Rowing Club results site searched for Peggy: 56 races, 9 wins, 11 seconds and 16 thirds, newest first, each with the regatta, the boat, the crew, the date and the time.', 380, 600)}</div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [7, 'data', 'Ten years of exports as one database you can ask', 'DuckDB, SQLite', 'Frank', 'Example Studio', 'Which customers bought every year until 2024 and then stopped?', 'Forty spreadsheets in three layouts loaded once; 31 names, their last order, and the query used.'],
  [15, 'data', 'A timetable or roster that meets every rule', 'FET, OR-Tools CP-SAT', 'Dave', 'Example Studio', 'Here are the teachers, the classes and forty rules. The timetable, please.', 'A complete timetable in half an hour; the only rule broken is Ivan’s free Friday afternoon.'],
  [19, 'data', 'Next season’s sales forecast from your own till', 'Prophet, scikit-learn', 'Kirsi', 'Example Studio', 'How much Christmas stock should I order?', 'December forecast week by week from five years of till data, with a low and a high figure to order between.'],
  [36, 'data', 'Your own data as a site anyone can search', 'Datasette', 'Peggy', 'Riverside Rowing Club', 'Our results since 1998 live in one member’s spreadsheet. Make it a site where everyone can find their own races.', 'Type your name and every race you rowed is there, newest first, with your medals counted.'],
  [37, 'data', 'A customer list cleaned: one customer, three spellings', 'qsv, RapidFuzz', 'Bob', 'Example Studio', 'Clean up the 4,100-row mailing list.', '380 probable duplicates found; 300 certain ones merged, 80 asked about.'],
  [38, 'data', 'Survey answers into statistics and charts', 'R, pandas, Matplotlib', 'Dave', 'Example Studio', '310 parents answered about the school day’s length.', 'Six charts; the difference between year groups is real, the one between morning and afternoon classes is within chance.'],
  [39, 'data', 'A process chart, org chart or family tree from text', 'Graphviz, Mermaid', 'Bob', 'Example Studio', 'This is how a return goes. Draw it so the new packer can follow it.', 'Two minutes of talking became a clean chart, and the chart showed what the talk had missed: nobody approves refunds over €100.'],
  [53, 'data', 'Bookkeeping as a text file: statement in, reports out', 'hledger', 'Trent', 'Harbour Singers', 'The year’s bank export, for the annual meeting.', 'The annual accounts, and the auditor reads the same text file.'],
  [56, 'data', 'Maths exercises with every answer computed', 'SymPy, GNU Octave', 'Heidi', 'Maple Lane School', 'Thirty versions of a ten-question equation test.', 'Thirty sheets and a key in which every answer was computed, not written from memory.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-data',
  kind: 'caps',
  group: { id: 'data', name: 'Data and numbers', line: 'Say how something works and get the chart. Hand over a spreadsheet and get a site people can search.' },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [39, 36],
  full: {
    39: () => capScreen(39, 'How a return goes', you('11:05', 'This is how a return goes. The customer asks, by mail or in the shop. I find the order. If it’s within 30 days I send a return label, otherwise I offer a repair. When the parcel comes, Dave checks it, and if it’s as sold I refund it, the same day if it’s under a hundred euros… Draw it so the new packer can follow it.', '', `${MIC_IC}Dictated · 2 min`) + turn({
        thoughts: ['Three decisions: 30 days, condition, the €100 line. The branch over €100 has nobody in it.'],
        tools: [
          tool('bash', 'dot -V', 'bash: dot: command not found'),
          tool('bash', 'micromamba install -y -c conda-forge graphviz', 'graphviz 14.1.2 installed'),
          tool('write', 'processes/returns.dot', '8 steps · 3 decisions · Bob, Dave, the customer', 'new · 33 lines'),
          tool('bash', 'dot -Tsvg processes/returns.dot -o processes/returns.svg', 'processes/returns.svg · 401 × 772'),
        ],
        time: '1 min 52 s',
        reply: 'Drawn as you told it, top to bottom, Dave’s step in his own colour. **One gap**: you said who refunds under €100, but nobody for refunds over €100. Who approves those? I’ll put them in the chart.',
      }), view('returns.svg', chartView())),
    36: () => capScreen(36, 'Results site', you('20:00', capOf[36][6], att('results-1998-2026.xlsx', 'Spreadsheet · 9 sheets')) + turn({
        thoughts: ['Nine sheets, and the columns change order in 2009. One table, then search on names.'],
        tools: [
          tool('write', 'results/tidy.py', '9 sheets → one table: date, regatta, boat, crew, place, time', 'new · 46 lines'),
          tool('bash', 'python3 results/tidy.py && sqlite-utils insert results.db results results.csv --csv', '214 rows · 1998-03-18 … 2026-10-12\n4 names spelled two ways, made one'),
          tool('bash', 'sqlite-utils enable-fts results.db results crew regatta event --create-triggers', 'search on crew, regatta and boat'),
          tool('write', 'results/templates/table-results-results.html', 'a members’ page: search, medals, one race per line', 'new · 36 lines'),
          tool('bash', 'datasette serve results.db -m metadata.json --template-dir templates', 'http://127.0.0.1:8001 · read-only'),
        ],
        time: '14 min 30 s',
        reply: 'Here it is, searched for you: **56 races, 9 wins**. It is read-only and only you can see it. Shall I publish it at **results.riverside-rowing.example.org** for the members?',
      }) + you('20:16', 'Yes, publish it.') + turn({
        tools: [tool('publish', 'results.riverside-rowing.example.org → datasette results.db', 'https://results.riverside-rowing.example.org · certificate ok')],
        time: '40 s',
        reply: 'Live. Each member types their name and finds their races. After a regatta, send me the results sheet and they go in.',
      }), view('results.riverside-rowing.example.org', siteView(), 'Live')),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 7: ['frank', 'db'], 15: ['dave', 'rota'], 19: ['kirsi', 'forecast'], 37: ['bob', 'clean'], 38: ['dave', 'survey'] },
};
