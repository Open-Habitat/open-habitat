// Frank: Researcher, dye project. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, mark, you, att, tool, turn, diff, screen, view } from '../../engine/kit.mjs';
import { sw, toggles, sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const SPK = { Alice: 'a', Bob: 'b', Carol: 'c' };
const transcriptMock = (lines, people = SPK, len = '58:12') => `<div class="tr"><div class="tr-wave" aria-hidden="true">${Array.from({ length: 64 }, (_, k) => `<i style="--h:${(22 + ((k * 37) % 61)) }%" class="sp-${'abc'[Math.floor(k / 9) % 3]}"></i>`).join('')}</div><p class="tr-len">${len} · ${Object.keys(people).length} speakers · transcribed on this server</p><ol>${lines.map(([t, who, text]) => `<li><time>${t}</time><b class="sp-${people[who] || 'a'}">${esc(who)}</b><span>${esc(text)}</span></li>`).join('')}</ol></div>`;
const ciMock = (rows, foot, hi = 'B') => { const max = 9; const x = (v) => 70 + (v / max) * 230; return `<div class="ci">${sw(`<g stroke="#e3e7e0">${[0, 3, 6, 9].map((v) => `<path d="M${x(v)} 14 V${20 + rows.length * 24}"/>`).join('')}</g>${rows.map(([n, lo, m, hi2], k) => { const yy = 28 + k * 24; const on = n.startsWith(hi); return `<g><text x="8" y="${yy + 4}" font-size="11" font-family="system-ui" fill="${on ? '#1f5430' : '#4b5563'}" font-weight="${on ? 700 : 400}">${esc(n)}</text><path d="M${x(lo)} ${yy} H${x(hi2)}" stroke="${on ? '#2c6e3f' : '#6b746c'}" stroke-width="2"/><circle cx="${x(m)}" cy="${yy}" r="4.5" fill="${on ? '#2c6e3f' : '#fff'}" stroke="${on ? '#2c6e3f' : '#6b746c'}" stroke-width="2"/></g>`; }).join('')}<g font-family="ui-monospace,monospace" font-size="9.5" fill="#6b746c">${[0, 3, 6, 9].map((v) => `<text x="${x(v) - 3}" y="${34 + rows.length * 24}">${v}</text>`).join('')}</g>`, '', `0 0 320 ${44 + rows.length * 24}`)}<p class="ci-n"><span>Colour change after 20 washes, ΔE (lower holds better)</span><span>${esc(foot)}</span></p></div>`; };
const CI6 = [['A indigo', 4.1, 5.0, 5.9], ['B indigo, alum', 1.8, 2.4, 3.0], ['C weld, alum', 5.2, 6.3, 7.4], ['D weld', 5.4, 6.6, 7.8], ['E madder', 3.6, 4.4, 5.2], ['F madder, iron', 2.9, 3.7, 4.5]];
const CI7 = [['A indigo', 4.3, 5.0, 5.7], ['B indigo, alum', 1.9, 2.4, 2.9], ['C weld, alum', 6.1, 6.9, 7.7], ['D weld', 4.9, 5.6, 6.3], ['E madder', 3.8, 4.4, 5.0], ['F madder, iron', 3.1, 3.7, 4.3]];
const scanMock = (h, lines, hit, word, label, foot) => `<div class="scan" data-view data-state="found">${toggles([['scan', 'Scanned'], ['found', label]], 'found')}<div class="scan-p"><p class="scan-h">${esc(h)}</p>${lines.map((l, k) => `<span class="scan-l${k === hit ? ' hit' : ''}">${k === hit ? esc(l).replace(word, `<mark>${word}</mark>`) : esc(l)}</span>`).join('')}</div><p class="scan-n">${esc(foot)}</p></div>`;

export default {
  id: 'role-frank',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'frank', name: 'Frank', role: 'Researcher, dye project', org: 'Example Studio', color: '#2f4f73',
  blurb: 'Frank runs the studio’s dye research with Riverside University’s textile lab: which natural dyes hold on linen, in light and in the wash.',
  places: [['08:15', 'At the lab', 'lab'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'At the lab', 'lab'], ['13:30', 'Seminar', 'meet'], ['14:30', 'At the lab', 'lab']],
  sess: [
    { id: 'db', title: 'Ten years of test results', segs: [['08:20', 'run', 'Loading 120 spreadsheets'], ['08:40', 'turn', 'One database · first answer'], ['09:00', 'quiet', 'dyes.duckdb']] },
    { id: 'fast', title: 'Colour-fastness in R', segs: [['09:15', 'run', 'Installing R'], ['09:50', 'turn', 'Model and 2 figures'], ['10:10', 'quiet', 'analysis/fastness.R'], ['14:32', 'run', 'Rerunning with batch 7'], ['14:40', 'turn', 'Figures updated'], ['14:44', 'run', 'Writing the care note'], ['14:46', 'quiet', 'team/products/indigo-care.md']] },
    { id: 'notes', title: 'Lab notebooks 1994–2001', segs: [['10:30', 'run', 'Reading 640 scanned pages'], ['11:30', 'turn', 'Searchable · 212 recipes'], ['11:45', 'quiet', 'notebooks/']] },
    { id: 'talk', title: 'Dyer interviews', segs: [['12:10', 'run', 'Transcribing 5 h 20 min'], ['12:55', 'turn', '6 transcripts, speakers named'], ['13:10', 'quiet', 'interviews/']] },
    { id: 'sun', title: 'Sunshine data', segs: [['15:10', 'run', 'Asking the weather service'], ['15:30', 'turn', 'Daily sun hours, 2019–2026'], ['15:40', 'quiet', 'sun-hours.csv']] },
    { id: 'papers', title: 'Lightfastness papers', segs: [['16:20', 'run', 'Indexing 40 papers'], ['16:40', 'turn', '6 papers, with pages'], ['16:50', 'quiet', 'Read']] },
  ],
  g: [
    {
      s: 'db', at: '08:40', pick: 1, ask: 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask.',
      did: 'Every few years someone changed the spreadsheet. His agent reads all four layouts, loads them once into one database file in his folder, and answers the first question with the query beside it, so the answer can be checked and asked again.',
      screen: () => screen('Ten years of test results', you('08:20', 'Ten years of the lab’s test results are 120 Excel exports in four different layouts. Make them one database I can ask. First: which dye held best on linen?', att('exports/', '120 xlsx · 2016–2026')) + turn({ tools: [
        tool('bash', 'uv run --with duckdb,openpyxl python3 tools/load_exports.py exports/', '120 files · 4 layouts · 18,400 test rows → dyes.duckdb'),
        tool('bash', 'duckdb dyes.duckdb < queries/best-on-linen.sql', 'indigo · alum   212 tests   ΔE 2.6\nmadder · iron    96 tests   ΔE 3.9\nindigo · none   188 tests   ΔE 4.8'),
      ], time: '20 min 53 s', reply: 'Across ten years, **indigo with alum** held best on linen: median colour change 2.6 over 212 tests. The query is saved in *queries/*, so the next question starts from the same database.' }), view('dyes.duckdb', sheetMock('best-on-linen.sql', ['Dye', 'Mordant', 'Tests', 'ΔE, median'], [['Indigo', 'alum', '212', '2.6'], ['Madder', 'iron', '96', '3.9'], ['Indigo', 'none', '188', '4.8'], ['Weld', 'alum', '144', '6.1']], '18,400 rows from 120 files · 4 layouts')), 'Example Studio'),
    },
    {
      s: 'fast', at: '09:50', pick: 1, ask: 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.',
      did: 'R is not on the server, so his agent installs it into Frank’s own account with the packages the model needs. It writes the analysis as a script in his folder, fits a model that accounts for differences between test batches, and draws the figures. The script stays, so the next batch is one sentence.',
      screen: () => screen('Colour-fastness in R', you('09:15', 'Fit a model to the colour-fastness tests: six recipes, batches 1 to 6. In R, so the lab can read it and rerun it.', att('tests/', '6 batches · 432 samples')) + turn({ tools: [
        tool('bash', 'Rscript --version', 'bash: Rscript: command not found'),
        tool('bash', 'micromamba create -n r -c conda-forge r-base r-lme4 r-ggplot2', 'R 4.4 and 2 packages installed into ~/micromamba\nfor frank only; no administrator needed'),
        tool('write', 'analysis/fastness.R', '58 lines · reads every tests/batch-*.csv'),
        tool('bash', 'Rscript analysis/fastness.R', 'lmer(delta_e ~ recipe + (1 | batch))\n6 recipes · 6 batches · 432 samples\nfigures/wash.pdf · figures/light.pdf'),
      ], time: '35 min 38 s', reply: 'Recipe **B, indigo with alum**, changes least in the wash, and the difference from the others holds with the batches accounted for. **C and D cannot be told apart yet.** The figure is beside this; *fastness.R* reruns everything from the folder.' }), view('figures/wash.pdf', ciMock(CI6, 'batches 1–6 · 432 samples')), 'Example Studio'),
    },
    {
      s: 'notes', at: '11:30', ask: 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.',
      did: 'Six hundred and forty pages, typed and handwritten, scanned crooked. His agent straightens and reads them, saves searchable PDFs, and pulls every recipe into one list, marking those it could not read with confidence.',
      screen: () => screen('Lab notebooks 1994–2001', you('10:30', 'The lab notebooks from the 1990s dye trials are scanned. Make them searchable, and list the recipes.', att('notebooks-scanned/', '640 pages')) + turn({ tools: [
        tool('bash', 'ocrmypdf --deskew --rotate-pages -l eng notebooks-scanned/*.pdf notebooks/', '640 pages · text added · PDF/A'),
        tool('bash', 'python3 tools/recipes.py notebooks/', '212 recipes · 19 low confidence, each linked to its page'),
      ], time: '1 h 00 min', reply: 'All 640 pages are searchable now, and **212 recipes** are in *recipes.csv*. Nineteen were hard to read; each links to its page.' }), view('notebook 1996 · p. 41', scanMock('Lab notebook · 3 March 1996', ['Trial 41: indigo vat on scoured linen', 'Mordant: alum 12 %, overnight', '6 dips · rinsed · dried in shade', 'Wash test after 2 weeks: little change'], 1, 'alum', 'Searched: “alum”', '640 pages · 212 recipes · PDF/A')), 'Example Studio'),
    },
    {
      s: 'talk', at: '12:55', ask: 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.',
      did: 'The interviews are people’s own stories, so they stay on the studio’s server. His agent transcribes them there, names the speakers from his interview notes, and marks the passages about mordants.',
      screen: () => screen('Dyer interviews', you('12:10', 'Six interviews with retired dyers, five hours in all. Transcribe them here, speakers named.', att('interviews/', '6 recordings · 5 h 20 min')) + turn({ tools: [
        tool('bash', 'uv tool install whisperx', 'installed into ~/.local · no administrator needed'),
        tool('bash', 'whisperx interviews/*.m4a --diarize', 'transcribed on this server · nothing uploaded · 6 transcripts'),
        tool('write', 'interviews/index.md', '6 transcripts · 23 passages about mordants marked'),
      ], time: '45 min 08 s', reply: 'Six transcripts in *interviews/*, speakers named from your notes. **23 passages** about mordants are marked; the one about alum and rainwater is in interview 4 at 31:20.' }), view('interview-4.md', transcriptMock([['02:14', 'Frank', 'When did you start at the dye house?'], ['02:20', 'Hilda', 'In 1968. My mother was there before me.'], ['31:20', 'Hilda', 'We used rainwater for the alum. Tap water made the blue go grey.'], ['31:42', 'Frank', 'Was that written down anywhere?']], { Frank: 'a', Hilda: 'b' }, '54:08')), 'Example Studio'),
    },
    {
      s: 'fast', at: '14:40', pick: 1, hand: 'Hands to Alice: a three-line care note for the indigo tote goes into team/products/, where the shop page reads it.',
      ask: 'Batch 7 from the lab is in. Rerun the analysis.',
      did: 'The lab sent the seventh batch during the seminar. His agent reruns the same script on all seven batches and says what changed; when Frank asks, it turns the result into a care note for the shop in plain words.',
      screen: () => screen('Colour-fastness in R', you('14:32', 'Batch 7 from the lab is in. Rerun the analysis.', att('tests/batch-07.csv', '72 samples')) + turn({ tools: [
        tool('bash', 'Rscript analysis/fastness.R', '7 batches · 504 samples\nB still lowest · C now differs from D (p = 0.03)'),
      ], time: '8 min 45 s', reply: 'Rerun on all seven batches. **B still holds best.** With the new batch, C and D can be told apart: C fades faster in the wash. The figures are updated.' }) + you('14:44', 'Write the shop a care note for the indigo tote from this. Three lines.') + turn({ tools: [
        diff('team/products/indigo-care.md', ['+ Wash at 40 °C, inside out, with mild soap.', '+ Dry in the shade; the indigo keeps its depth longer.', '+ Tested with Riverside University’s textile lab.']),
      ], time: '30 s', reply: 'In *team/products/indigo-care.md*, where the shop page reads it.' }), view('figures/wash.pdf', ciMock(CI7, 'batches 1–7 · 504 samples')), 'Example Studio'),
    },
    {
      s: 'sun', at: '15:30', ask: 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.',
      did: 'The weather service publishes its observations through an open interface. His agent asks it for the nearest station day by day, saves the table, and joins it to the outdoor tests in his database.',
      screen: () => screen('Sunshine data', you('15:10', 'Daily sunshine hours for the test garden since 2019, from the weather service’s open data, next to our outdoor light tests.') + turn({ tools: [
        tool('bash', 'python3 tools/weather_api.py --station nearest --param sunshine --from 2019-01-01', '2,880 days · 14 missing, marked'),
        tool('bash', 'duckdb dyes.duckdb -c "create table sun as …; select … join outdoor_tests …"', 'sun hours joined to 1,140 outdoor tests'),
      ], time: '20 min 15 s', reply: '**2,880 days** of sunshine hours are in *sun-hours.csv* and in the database, joined to every outdoor test. Fourteen days had no reading; they are marked, not guessed.' }), view('sun-hours.csv', sheetMock('sun-hours.csv', ['Month', 'Sun hours', 'Outdoor tests'], [['Jun 2025', '292', '48'], ['Jul 2025', '305', '52'], ['Aug 2025', '241', '44'], ['Sep 2025', '163', '40']], '2019–2026 · weather service open data')), 'Example Studio'),
    },
    {
      s: 'papers', at: '16:40', ask: 'Which of these forty papers measured lightfastness of indigo on linen?',
      did: 'His agent searches every paper, the scanned ones too, by word and by meaning, so it also finds the two that call it “fading under light”. It answers with the page for each.',
      screen: () => screen('Lightfastness papers', you('16:20', 'Which of these forty papers measured lightfastness of indigo on linen?', att('literature/dyes/', '40 PDFs')) + turn({ tools: [
        tool('bash', 'rga -i "lightfast|light fastness" literature/dyes/', '4 papers by word'),
        tool('bash', 'python3 tools/semantic_search.py "indigo on linen fades in light"', '2 more by meaning · “fading under light”, “photodegradation”'),
      ], time: '20 min 52 s', reply: '**Six papers**, with the page for each:\n\n| File | Fibre | Page |\n|---|---|---|\n| lightfast-linen-2019.pdf | linen | 7 |\n| indigo-fibres-2021.pdf | linen, cotton | 12 |\n| dye-ageing-2015.pdf | linen | 4 |\n\n… and three more. Two of them never use the word “lightfastness”.' }), '', 'Example Studio'),
    },
  ],
},
};
