// Dave: HR and office. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, drafts, screen, view } from '../../engine/kit.mjs';
import { item, sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const checklistMock = (title, rows) => `<div class="cl"><p class="cl-h">${esc(title)}</p><ul>${rows.map(([done, t, who]) => `<li class="${done ? 'done' : ''}"><span class="cl-b" aria-hidden="true"></span><span>${esc(t)}</span><small>${esc(who)}</small></li>`).join('')}</ul></div>`;
const ROTA = [['Alice', 'S S - S S - -'], ['Bob', 'P P P P P - -'], ['Kirsi', 'O O O - - - -'], ['Carol', 'S - S S - C -'], ['Erin', '- - - - - C C'], ['Sami', '- P - P P P -'], ['+ 3 seasonal', 'P P P P P P -']];
const ROTA_K = { S: ['Shop', 'shop'], P: ['Pack', 'pack'], O: ['Office', 'off'], C: ['Course', 'crs'], '-': ['', 'free'] };
const rotaMock = () => `<div class="rota"><p class="rota-h"><b>Week 49 · 30 Nov–6 Dec</b><span>23 rules · all met</span></p><div class="rota-g"><span></span>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span class="rota-d">${d}</span>`).join('')}${ROTA.map(([n, row]) => `<span class="rota-p">${esc(n)}</span>${row.split(' ').map((c, i) => `<span class="rota-c r-${ROTA_K[c][1]}${i === 3 && c === 'P' && /Bob|Sami/.test(n) ? ' hot' : ''}">${ROTA_K[c][0]}</span>`).join('')}`).join('')}</div><p class="rota-n">Thursdays: Bob and Sami pack · 17 of 19 wishes kept</p></div>`;
const redactMock = () => `<div class="doc rd"><p class="doc-k">Personnel file · page 3 of 11 · redacted copy</p><p>Shift swap agreed with <i class="rd-x">Mikael Strand</i> for 14 March; approved by Dave.</p><p>Overtime, March: 6 h. Comparison with <i class="rd-x">two colleagues</i> at <i class="rd-x">€19.40</i> an hour removed.</p><p>Home address on file: <i class="rd-x">8 Birch Road</i></p><p class="rd-n">Text under the boxes: none · searched the PDF for all 6 other names, 0 found</p></div>`;
const barsMock = (title, rows, unit = '', foot = '') => { const max = Math.max(...rows.map((r) => r[1])); return `<div class="bars"><p class="bars-h">${esc(title)}</p>${rows.map(([l, v, hot]) => `<p class="bar${hot ? ' hot' : ''}"><span>${esc(l)}</span><i style="--w:${((v / max) * 100).toFixed(1)}%"></i><b>${esc(String(v))}${esc(unit)}</b></p>`).join('')}${foot ? `<p class="bars-n">${esc(foot)}</p>` : ''}</div>`; };

export default {
  id: 'role-dave',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'dave', name: 'Dave', role: 'HR and office', org: 'Example Studio', color: '#31553a',
  blurb: 'Dave runs the office and the people side of Example Studio: contracts, rotas, the handbook, and the seasonal packers who come every December.',
  places: [['08:00', 'At the office', 'desk'], ['12:00', 'Lunch', 'lunch'], ['12:40', 'At the office', 'desk'], ['15:00', 'On the shop floor', 'box'], ['15:45', 'At the office', 'desk']],
  sess: [
    { id: 'start', title: 'New packer on Monday', segs: [['08:15', 'run', 'Building the checklist'], ['08:30', 'turn', '8 before Monday · 2 drafts'], ['08:50', 'quiet', '3 of 14 done']] },
    { id: 'rota', title: 'December rota', segs: [['09:05', 'run', 'Solving 23 rules'], ['09:40', 'turn', 'All 23 met · 2 wishes clash'], ['09:55', 'quiet', 'team/rota.md']] },
    { id: 'leave', title: 'Lena’s last day', segs: [['10:40', 'run', 'Listing what she holds'], ['11:10', 'turn', '19 hand-overs'], ['11:30', 'quiet', 'Read']] },
    { id: 'redact', title: 'Personnel file request', segs: [['13:00', 'run', 'Redacting 11 documents'], ['13:20', 'turn', '42 redactions to check'], ['13:40', 'quiet', 'Checked']] },
    { id: 'survey', title: 'Staff survey', segs: [['14:10', 'run', 'Counting 16 answers'], ['14:30', 'turn', '5 charts'], ['14:45', 'quiet', 'survey-autumn.pdf']] },
    { id: 'audio', title: 'Handbook to listen to', segs: [['15:50', 'run', 'Reading 9 chapters aloud'], ['16:10', 'turn', '9 chapters · 48 min'], ['16:20', 'quiet', 'handbook-audio/']] },
  ],
  g: [
    {
      s: 'start', at: '08:30', pick: 1, ask: 'A new packer, Sami, starts on Monday. What has to happen before then?',
      did: 'His agent builds the list from the studio’s onboarding checklist and what was forgotten last time, drafts the welcome message and the note to payroll, and ticks off each step as Dave does it.',
      screen: () => screen('New packer on Monday', you('08:15', 'A new packer, Sami, starts on Monday. What has to happen before then?') + turn({ tools: [
        tool('read', 'people/onboarding.md', '14 steps · notes from the last two starts'),
        tool('write', 'people/2026-11-23-sami.md', 'before Monday: 8 · first week: 6'),
      ], time: '15 min 10 s', reply: '**Eight things before Monday**, six in the first week. The welcome message and the payroll note are in your drafts. Last time the alarm code was forgotten; it is on the list.' }), view('people/2026-11-23-sami.md', checklistMock('Before Monday', [[1, 'Contract signed', 'Dave'], [1, 'Payroll details form', 'payroll'], [1, 'Welcome message', 'draft'], [0, 'Keys and alarm code', 'Dave'], [0, 'Till login', 'Kirsi'], [0, 'Safety walk at the press', 'Bob'], [0, 'First-week buddy', 'Carol']])), 'Example Studio'),
    },
    {
      s: 'rota', at: '09:40', pick: 1, hand: 'Hands to Alice and Bob: the rota goes into team/rota.md. From 1 December Sami packs with Bob on Thursdays, so Alice’s Thursday afternoons are free.',
      ask: 'December’s rota: six of us, Sami and three seasonal packers, the Christmas rush, and everyone’s wishes. Every rule has to hold.',
      did: 'Twenty-three rules: shop hours, two packers on every delivery day, Erin’s Saturday courses, nobody more than five days in a row, everyone’s days off. His agent writes each rule as a constraint, solves it, and says which wishes could not all be kept.',
      screen: () => screen('December rota', you('09:05', 'December’s rota: six of us, Sami and three seasonal packers, the Christmas rush, and everyone’s wishes. Every rule has to hold.', att('rota-rules.md', '23 rules · 19 wishes')) + turn({ tools: [
        tool('write', 'rota/model.py', 'every rule as a constraint · wishes as preferences'),
        tool('bash', 'uv run --with ortools python3 rota/model.py', 'solved in 41 s · 23 of 23 rules met · 17 of 19 wishes kept'),
        tool('write', 'team/rota.md', 'weeks 49–52 · one line per person per day'),
      ], time: '35 min 47 s', reply: 'A rota that meets **all 23 rules**. Two wishes clashed: Kirsi and Bob both asked for Friday the 18th off. I gave Bob the 18th and Kirsi the 23rd; swap them if you like.' }), view('team/rota.md', rotaMock()), 'Example Studio'),
    },
    {
      s: 'leave', at: '11:10', ask: 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?',
      did: 'His agent goes through the accounts, subscriptions, shared folders and recurring tasks in Lena’s name, and makes one hand-over list, each item with a new owner and the day it moves. Her accounts close tomorrow evening, not before.',
      screen: () => screen('Lena’s last day', you('10:40', 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?') + turn({ tools: [
        tool('read', 'people/accounts.csv', 'Lena: 11 accounts · 2 subscriptions on her card'),
        tool('bash', 'grep -rl "Lena" team/tasks.md handbook/ team/AGENTS.md', '6 recurring tasks name her'),
        tool('write', 'people/handover-lena.md', '19 items · each with a new owner and a day'),
      ], time: '30 min 32 s', reply: '**19 things to hand over**: 11 accounts, 2 subscriptions on her card, and 6 recurring tasks, from the shop’s photo shoots to the market stall booking. Each has a proposed owner; nothing closes before tomorrow evening.' }), view('people/handover-lena.md', checklistMock('Hand-over · Lena, last day Fri 20 Nov', [[1, 'Shop photo shoots', 'Carol'], [1, 'Market stall booking', 'Bob'], [0, 'Shop admin account', 'Alice'], [0, 'Photo library subscription', 'Carol'], [0, 'Social media login', 'Carol'], [0, 'Accounts closed', 'Fri 18:00']])), 'Example Studio'),
    },
    {
      s: 'redact', at: '13:20', pick: 1, ask: 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.',
      did: 'Black boxes drawn over text are not enough: the words are still underneath. His agent removes other people’s names, addresses and pay from the files themselves, lists every redaction for Dave to check, and proves the text is gone by searching the result.',
      screen: () => screen('Personnel file request', you('13:00', 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.', att('people/files/former-2024/', '11 documents')) + turn({ tools: [
        tool('bash', 'uv run --with pymupdf python3 tools/redact.py people/files/former-2024/', '11 documents · 42 redactions · text removed, not covered'),
        tool('bash', 'pdftotext out/*.pdf - | grep -c -f other-names.txt', '0 matches for the 6 other names'),
      ], time: '20 min 17 s', reply: '**42 redactions** in 11 documents, each listed for you to check. I searched the result for every other person’s name: none can be found or copied out.' }), view('redacted · page 3', redactMock()), 'Example Studio'),
    },
    {
      s: 'survey', at: '14:30', ask: 'The autumn staff survey: sixteen answers. The results as charts, please.',
      did: 'His agent counts the answers and draws the charts, and declines to split them by team: with sixteen people, a team of three could be recognised from its answers.',
      screen: () => screen('Staff survey', you('14:10', 'The autumn staff survey: sixteen answers. The results as charts, please.', att('survey-autumn.csv', '16 answers · 12 questions')) + turn({ tools: [
        tool('bash', 'uv run --with pandas,matplotlib python3 tools/survey.py survey-autumn.csv', '5 charts · averages and spread'),
      ], time: '20 min 54 s', reply: 'Five charts are beside this. The lowest is **feedback** (2.9 of 5). I did not split by team: the smallest team is three people, and their answers would be recognisable.' }), view('survey-autumn.pdf', barsMock('Average, 1 to 5', [['I know what is expected', 4.3], ['Tools work', 4.1], ['Workload is fair', 3.4], ['I get feedback', 2.9, 1], ['I would recommend the studio', 4.4]], '', '16 answers · not split: groups under 5')), 'Example Studio'),
    },
    {
      s: 'audio', at: '16:10', ask: 'Make the staff handbook listenable for the seasonal packers.',
      did: 'Many of them come in by bus. His agent reads the handbook aloud on the server, one file per chapter, with product names and abbreviations said right.',
      screen: () => screen('Handbook to listen to', you('15:50', 'Make the staff handbook listenable for the seasonal packers.') + turn({ tools: [
        tool('bash', 'uv tool install piper-tts', 'installed into ~/.local · voice 60 MB'),
        tool('bash', 'python3 tools/handbook_audio.py handbook/ --voice en_GB', '9 chapters · 48 min · product names from products.csv'),
      ], time: '20 min 39 s', reply: '**Nine chapters**, 48 minutes in all, in *handbook-audio/*. Product names and “VAT”, “SKU” and “60 °C” are read as people say them.' }), view('handbook-audio/', sheetMock('handbook-audio/', ['Chapter', 'Length'], [['1 Welcome', '3:10'], ['2 Packing an order', '8:40'], ['3 Safety at the press', '6:05'], ['4 Returns and exchanges', '4:20']], '… 5 more · 48 min in all')), 'Example Studio'),
    },
  ],
},
};
