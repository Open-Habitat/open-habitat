// Capabilities: Data and numbers. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, MIC_IC, you, att, tool, turn, screen, view } from '../../engine/kit.mjs';
import { sw, item, sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const flowMock = () => { const box = (x, y, w, t, cls = '') => `<g class="fl-b ${cls}"><rect x="${x}" y="${y}" width="${w}" height="30" rx="6"/><text x="${x + w / 2}" y="${y + 19}" text-anchor="middle">${esc(t)}</text></g>`; const ar = (x1, y1, x2, y2) => `<path d="M${x1} ${y1} L${x2} ${y2}" class="fl-a" marker-end="url(#fl-h)"/>`; return `<div class="fl">${sw(`<defs><marker id="fl-h" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#6b746c"/></marker></defs>${box(100, 8, 120, 'Customer asks')}${ar(160, 38, 160, 54)}${box(90, 56, 140, 'Bob checks the order')}${ar(160, 86, 160, 102)}${box(105, 104, 110, 'Item back?')}${ar(130, 134, 75, 156)}${ar(190, 134, 245, 156)}${box(10, 158, 130, 'Under €100: Bob refunds')}${box(180, 158, 130, 'Over €100: who?', 'flag')}`, '', '0 0 320 200')}<p class="fl-n"><span>returns.svg · from two minutes of speech</span><span>nobody named for refunds over €100</span></p></div>`; };
const datasetteMock = () => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>results.riverside-rowing-club.example.org</p><div class="ds"><p class="ds-q"><span>Search races</span><b>Peggy</b></p>${sheetMock('results · 3 of 214 rows for “Peggy”', ['Year', 'Regatta', 'Boat', 'Place'], [['2004', 'Spring Head', 'W4+', '2'], ['2011', 'River Cup', 'W2x', '1'], ['2019', 'Masters', 'W1x', '3']])}</div></div>`;

// [n (number in the research list), group, title, program, who, org, ask, result]
const caps = [
  [7, 'data', 'Ten years of exports as one database you can ask', 'DuckDB, SQLite', 'Frank', 'Example Studio', 'Which customers bought every year until 2024 and then stopped?', 'Forty spreadsheets in three layouts loaded once; 31 names, their last order, and the query used.'],
  [15, 'data', 'A timetable or roster that meets every rule', 'FET, OR-Tools CP-SAT', 'Dave', 'Example Studio', 'Here are the teachers, the classes and forty rules. The timetable, please.', 'A complete timetable in half an hour; the only rule broken is Ivan’s free Friday afternoon.'],
  [19, 'data', 'Next season’s sales forecast from your own till', 'Prophet, scikit-learn', 'Kirsi', 'Example Studio', 'How much Christmas stock should I order?', 'December forecast week by week from five years of till data, with a low and a high figure to order between.'],
  [36, 'data', 'Your own data as a browsable site', 'Datasette', 'Peggy', 'Riverside Rowing Club', 'Our results since 1998 are in one member’s spreadsheet.', 'A searchable site where any member can look up their own races.'],
  [37, 'data', 'A customer list cleaned: one customer, three spellings', 'qsv, RapidFuzz', 'Bob', 'Example Studio', 'Clean up the 4,100-row mailing list.', '380 probable duplicates found; 300 certain ones merged, 80 asked about.'],
  [38, 'data', 'Survey answers into statistics and charts', 'R, pandas, Matplotlib', 'Dave', 'Example Studio', '310 parents answered about the school day’s length.', 'Six charts; the difference between year groups is real, the one between morning and afternoon classes is within chance.'],
  [39, 'data', 'A process chart, org chart or family tree from text', 'Graphviz, Mermaid', 'Bob', 'Example Studio', '(Two minutes, spoken) This is how a return goes…', 'The flow drawn, with the note that nobody is named for approving refunds over €100.'],
  [53, 'data', 'Bookkeeping as a text file: statement in, reports out', 'hledger', 'Trent', 'Harbour Singers', 'The year’s bank export, for the annual meeting.', 'The annual accounts, and the auditor reads the same text file.'],
  [56, 'data', 'Maths exercises with every answer computed', 'SymPy, GNU Octave', 'Heidi', 'Maple Lane School', 'Thirty versions of a ten-question equation test.', 'Thirty sheets and a key in which every answer was computed, not written from memory.'],
];
const capOf = Object.fromEntries(caps.map((c) => [c[0], c]));
const capScreen = (n, title, body, v) => screen(title, body, v, capOf[n][5]);

export default {
  id: 'caps-data',
  kind: 'caps',
  group: { id: 'data', name: "Data and numbers", line: "Ten years of spreadsheets in one database, and problems with forty rules." },
  caps,
  // Shown in full, in this order: a screen with the work and the result.
  show: [39, 36],
  full: {
    39: () => capScreen(39, 'How a return goes', you('11:05', 'This is how a return goes: the customer asks, I check the order, if the item comes back I refund it…', '', `${MIC_IC}Dictated · 2 min`) + turn({ tools: [
        tool('write', 'processes/returns.mmd', '7 steps · 2 branches'),
        tool('bash', 'mmdc -i processes/returns.mmd -o returns.svg', 'returns.svg'),
      ], reply: 'Here is the flow you described. **One gap**: nobody is named for refunds over €100. Who should approve them?' }), view('returns.svg', flowMock())),
    36: () => capScreen(36, 'Results site', you('20:00', capOf[36][6], att('results-1998-2026.xlsx', '214 rows · 9 sheets')) + turn({ tools: [
        tool('bash', 'uv tool install datasette && csvs-to-sqlite results.csv results.db', 'results.db · 1 table · 214 rows'),
        tool('publish', 'results.riverside-rowing-club.example.org → datasette results.db', 'published · read-only · search on name and regatta'),
      ], reply: 'Every member can look up their own races at **results.riverside-rowing-club.example.org**. Adding a regatta is one sentence to me.' }), view('results.riverside-rowing-club.example.org', datasetteMock(), 'Live')),
  },
  // Shown in someone's day above: [person, conversation]; the page draws a line that points there.
  inDay: { 7: ['frank', 'db'], 15: ['dave', 'rota'], 19: ['kirsi', 'forecast'], 37: ['bob', 'clean'], 38: ['dave', 'survey'] },
};
