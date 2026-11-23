// Dave: HR and office. The rota grid and every tool output in the rota and
// redaction scenes are read from data.json, which assets.mjs writes from what
// the programs really printed (OR-Tools CP-SAT, PyMuPDF, pdftotext).
// The block contract is in ../../BLOCKS.md.
import { readFileSync } from 'node:fs';
import { esc, you, att, tool, turn, drafts, screen, view, image, assets, FILE_IC } from '../../engine/kit.mjs';
import { sheetMock, toggles } from '../../engine/views.mjs';

const asset = assets(import.meta.url);
const here = new URL('.', import.meta.url);
const DATA = JSON.parse(readFileSync(new URL('data.json', here), 'utf8'));
const src = (name) => readFileSync(new URL(`tools/${name}`, here), 'utf8');

// ---------- The onboarding checklist ----------
const BEFORE = [
  [1, 'Contract signed', 'Dave'],
  [1, 'Payroll details form', 'Sami'],
  [0, 'Welcome message', 'draft ready'],
  [0, 'Start date and hours to payroll', 'draft ready'],
  [0, 'Key 7 and the alarm code', 'Dave', 'Forgotten last time'],
  [0, 'Work shoes, size 43', 'Dave', 'Forgotten last time'],
  [0, 'Safety walk at the press', 'Bob'],
  [0, 'On the December rota, beside Bob', 'Dave'],
];
const onboardView = () => {
  const done = BEFORE.filter((r) => r[0]).length;
  return `<div class="ob"><p class="ob-h"><b>Sami, packer</b><span>starts Mon 23 Nov · 08:30</span></p>
<p class="ob-s"><span>Before Monday</span><i style="--p:${(done / BEFORE.length) * 100}%"></i><b>${done} of ${BEFORE.length}</b></p>
<ul>${BEFORE.map(([d, t, who, flag]) => `<li class="${d ? 'done' : ''}"><span class="ob-b" aria-hidden="true"></span><span class="ob-t">${esc(t)}${flag ? `<em>${esc(flag)}</em>` : ''}</span><small>${d ? 'Done · ' : ''}${esc(who)}</small></li>`).join('')}</ul>
<p class="ob-s ob-next"><span>First week</span><b>6 steps</b></p><p class="ob-n">Packing bench with Bob · returns · handbook chapters 2 and 3 · first Thursday wholesale run · till, read only · a word with Dave on Friday</p></div>`;
};
const checklistMock = (title, rows) => `<div class="cl"><p class="cl-h">${esc(title)}</p><ul>${rows.map(([done, t, who]) => `<li class="${done ? 'done' : ''}"><span class="cl-b" aria-hidden="true"></span><span>${esc(t)}</span><small>${esc(who)}</small></li>`).join('')}</ul></div>`;

// ---------- The rota, drawn from the solver's grid ----------
const R = DATA.rota;
const DUTY = { S: ['Shop', 's'], P: ['Pack', 'p'], O: ['Office', 'o'], C: ['Course', 'k'], '-': ['', 'f'] };
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dateOf = (d) => new Date(Date.UTC(2026, 10, 30 + d));
const dom = (d) => dateOf(d).getUTCDate();
const CLOSED = (d) => d >= 24;
const RUSH = (d) => d >= 7 && d <= 22;
// A wish about one day: kept (the free day they asked for) or not.
const wishAt = (p, d) => R.wishes.find((w) => w.who === p && w.days.includes(d));
const count = (k, d) => R.people.filter((p) => R.grid[p][d] === k).length;
const nKept = R.wishes.filter((w) => w.kept).length;
const cell = (p, d, words) => {
  const k = R.grid[p][d];
  const w = wishAt(p, d);
  return `<span class="rt-c rt-${CLOSED(d) ? 'x' : DUTY[k][1]}${w ? (w.kept ? ' rt-kept' : ' rt-lost') : ''}"${w ? ` title="${esc(`Wish ${w.kept ? 'kept' : 'not kept'}: ${p}, ${w.text}`)}"` : ''}>${words ? DUTY[k][0] : k === '-' ? '' : k}</span>`;
};
const week = (w) => [0, 1, 2, 3, 4, 5, 6].map((i) => w * 7 + i);
const monthGrid = () => `<div class="rt-m" role="img" aria-label="December rota, four weeks, ten people: every day has its shop, packing and office cover.">
<div class="rt-r rt-hd"><span></span>${[0, 1, 2, 3].map((w) => `<span class="rt-w"><b>Week ${49 + w}</b><small>${dom(w * 7)} ${w === 0 ? 'Nov' : 'Dec'}</small></span>`).join('')}</div>
<div class="rt-r rt-dw"><span></span>${[0, 1, 2, 3].map((w) => `<span class="rt-w">${week(w).map((d) => `<i>${DOW[d % 7][0]}</i>`).join('')}</span>`).join('')}</div>
${R.people.map((p, i) => `<div class="rt-r${i === 6 ? ' rt-sep' : ''}"><span class="rt-n">${esc(p)}</span>${[0, 1, 2, 3].map((w) => `<span class="rt-w">${week(w).map((d) => cell(p, d, false)).join('')}</span>`).join('')}</div>`).join('\n')}
<div class="rt-r rt-ct"><span class="rt-n">Packers</span>${[0, 1, 2, 3].map((w) => `<span class="rt-w">${week(w).map((d) => `<i class="${RUSH(d) && count('P', d) ? 'rush' : ''}">${count('P', d) || ''}</i>`).join('')}</span>`).join('')}</div>
</div>`;
const weekGrid = (w) => `<div class="rt-wk rt-wk${w}">
<div class="rt-kr rt-hd"><span></span>${week(w).map((d) => `<span><b>${DOW[d % 7]}</b><small>${dom(d)}</small></span>`).join('')}</div>
${R.people.map((p, i) => `<div class="rt-kr${i === 6 ? ' rt-sep' : ''}"><span class="rt-n">${esc(p)}</span>${week(w).map((d) => cell(p, d, true)).join('')}</div>`).join('\n')}
<div class="rt-kr rt-ct"><span class="rt-n">Packers</span>${week(w).map((d) => `<i class="${RUSH(d) && count('P', d) ? 'rush' : ''}">${count('P', d) || ''}</i>`).join('')}</div>
</div>`;
const rotaView = () => `<div class="rt" data-view data-state="m">
<p class="rt-top"><span class="rt-ok"><b>${R.rules.length - R.failed.length} of ${R.rules.length}</b> rules hold</span><span class="rt-ok"><b>${nKept} of ${R.wishes.length}</b> wishes kept</span></p>
${toggles([['m', 'December'], ...[0, 1, 2, 3].map((w) => [`w${w}`, `Week ${49 + w}`])], 'm')}
${monthGrid()}${[0, 1, 2, 3].map(weekGrid).join('')}
<p class="rt-lg"><span><i class="rt-c rt-s"></i>Shop</span><span><i class="rt-c rt-p"></i>Pack</span><span><i class="rt-c rt-o"></i>Office</span><span><i class="rt-c rt-k"></i>Course</span><span><i class="rt-c rt-f rt-kept"></i>Wish kept</span><span><i class="rt-c rt-s rt-lost"></i>Not kept</span><span><i class="rt-c rt-x"></i>Closed</span></p>
</div>`;
// What the conversation quotes from the model: its rules, a few of its lines, the rota file.
const rulesFile = () => `# December rota: rules\n${R.rules.map((r, i) => `${String(i + 1).padStart(2)}. ${r}`).join('\n')}\n\n# Wishes, in the order they came in\n${R.wishes.map((w, i) => `${String(i + 1).padStart(2)}. ${w.who}: ${w.text}`).join('\n')}`;
const MODEL = src('rota_model.py');
const modelLines = MODEL.trimEnd().split('\n');
const excerpt = (from, to) => { const a = modelLines.findIndex((l) => l.includes(from)); const b = modelLines.findIndex((l, i) => i > a && l.includes(to)); return modelLines.slice(a, b + 1).map((l) => l.replace(/^ {4}/, '')).join('\n'); };
const rotaFile = () => `# Rota, weeks 49 to 52\n\n## Week 49 · 30 Nov to 6 Dec\n| | ${DOW.join(' | ')} |\n${R.people.slice(0, 4).map((p) => `| ${p} | ${week(0).map((d) => DUTY[R.grid[p][d]][0] || '·').join(' | ')} |`).join('\n')}\n…`;

// ---------- The redacted file ----------
const X = DATA.redact;
const total = Number(X.log.at(-1).match(/(\d+) redactions/)[1]);
const entries = Number(X.made.match(/(\d+) entries/)[1]);
// The page's text as pdftotext prints it, from the title on, without the form feed.
const pageText = X.text.replace(/\f/g, '').split('\n').slice(4).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
const redactView = () => `<div class="rx" data-view data-state="red">
${toggles([['red', 'Redacted'], ['orig', 'Original'], ['text', 'Text left in the file']], 'red')}
<div class="rx-p rx-red">${image(asset('page-redacted.webp'), 'The shift and overtime record after redaction: other people’s names, pay, address and telephone number are black boxes.', 1090, 930)}</div>
<div class="rx-p rx-orig">${image(asset('page-original.webp'), 'The same page before redaction, with a colleague’s name in the shift swap, two others’ overtime and pay, and a key holder’s address.', 1090, 930)}</div>
<div class="rx-p rx-text"><p class="rx-cmd">$ pdftotext -layout out/${esc(X.shown)} -</p><pre>${esc(pageText)}</pre></div>
<p class="rx-f"><span class="rx-ok"><b>${X.after} of ${X.names}</b> other names left in ${X.documents} files</span><a class="rx-a" href="${asset('shift-record-redacted.pdf')}" download>${FILE_IC}<span>Open the PDF and try to select a name</span></a></p>
</div>`;
const fileList = ['01-employment-contract', '02-contract-amendment', '03-pay-summary-2023', '04-shift-record-2024-03', '05-review-2023', '06-training-record', '07-sick-leave', '08-incident-note', '09-email-holiday-2024', '10-leaving-checklist', '11-reference'].map((n) => `${n}.pdf`).join('\n');
const listCsv = `document,text,reason\n04-shift-record-2024-03.pdf,Mikael Strand,name\n04-shift-record-2024-03.pdf,Tessa Rowe,name\n04-shift-record-2024-03.pdf,sick leave,health\n04-shift-record-2024-03.pdf,€19.40,pay\n04-shift-record-2024-03.pdf,8 Birch Road,address\n… ${entries - 5} more`;
const NAMES_CMD = 'for f in $DIR/*.pdf; do pdftotext "$f" -; done | grep -c -w -f people/other-names.txt';

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
    { id: 'start', title: 'New packer on Monday', segs: [['08:26', 'run', 'Building the checklist'], ['08:30', 'turn', '8 before Monday · 2 drafts'], ['08:50', 'quiet', '4 of 14 done']] },
    { id: 'rota', title: 'December rota', segs: [['09:31', 'run', 'Solving 23 rules'], ['09:40', 'turn', 'All 23 hold · 2 wishes lost'], ['09:55', 'quiet', 'team/rota.md']] },
    { id: 'leave', title: 'Lena’s last day', segs: [['11:02', 'run', 'Listing what she holds'], ['11:10', 'turn', '19 hand-overs'], ['11:30', 'quiet', 'Read']] },
    { id: 'redact', title: 'Personnel file request', segs: [['13:12', 'run', 'Redacting 11 documents'], ['13:20', 'turn', `${total} redactions to check`], ['13:40', 'quiet', 'Checked']] },
    { id: 'survey', title: 'Staff survey', segs: [['14:24', 'run', 'Counting 16 answers'], ['14:30', 'turn', '5 charts'], ['14:45', 'quiet', 'survey-autumn.pdf']] },
    { id: 'audio', title: 'Handbook to listen to', segs: [['15:50', 'run', 'Reading 9 chapters aloud'], ['16:10', 'turn', '9 chapters · 48 min'], ['16:20', 'quiet', 'handbook-audio/']] },
  ],
  g: [
    {
      s: 'start', at: '08:30', pick: 1, ask: 'Sami starts packing on Monday. What has to happen before then?',
      did: 'His agent builds the list from the studio’s onboarding checklist and the notes from the last two starts, when the alarm code and the work shoes were forgotten. The welcome message and the note to payroll wait in Dave’s drafts, and each step is ticked off as he does it.',
      screen: () => screen('New packer on Monday', you('08:26', 'Sami starts packing on Monday. What has to happen before then?') + turn({ tools: [
        tool('read', 'people/onboarding.md', '# Onboarding\n14 steps: 8 before the first day, 6 in the first week\n\n## Notes from earlier starts\n- September: no alarm code until the third day\n- September: no work shoes in the right size\n- May: payroll heard about the start a week late'),
        tool('read', 'people/contracts/2026-11-sami.md', 'Packer · 30 hours a week · starts Mon 23 Nov, 08:30\nSigned by both on 17 Nov · payroll form attached'),
        tool('write', 'people/2026-11-23-sami.md', 'Before Monday: 8 steps, 2 already done\nFirst week: 6 steps\nThe three things missed before are on the list, each with an owner', 'new · 34 lines'),
      ], time: '3 min 48 s', reply: '**Eight things before Monday**, two already done; what was missed at earlier starts is on the list. Two messages wait in your drafts, unsent.', extra: drafts([['draft', 'Sami', 'Welcome to Example Studio', 'Monday at 08:30, the back door on Mill Lane. Bob meets you and you pack beside him all week.'], ['draft', 'payroll@example.org', 'New starter on Monday 23 November', 'Sami, packer, 30 hours a week. Contract and payroll form attached.']]) }), view('people/2026-11-23-sami.md', onboardView()), 'Example Studio'),
    },
    {
      s: 'rota', at: '09:40', pick: 1, hand: 'Hands to Alice and Bob: the rota goes into team/rota.md. Sami packs beside Bob every Thursday, so Alice is off the packing bench on Thursdays.',
      ask: 'December’s rota: the six of us, Sami and three seasonal packers, the Christmas rush and everyone’s wishes. Every rule has to hold.',
      did: 'Twenty-three rules: shop hours, four packers on every courier day of the rush, Erin’s courses, nobody more than five days in a row, two days off together for everyone. His agent writes each rule as a constraint, lets a solver find the rota, checks the finished grid against every rule again, and says which two wishes lost and to whom.',
      screen: () => screen('December rota', you('09:31', 'December’s rota: the six of us, Sami and three seasonal packers, the Christmas rush and everyone’s wishes. Every rule has to hold.', att('rota-rules.md', `${R.rules.length} rules · ${R.wishes.length} wishes`)) + turn({ thoughts: ['Ten people, 28 days and 23 rules that all touch each other: this is a job for a constraint solver, with the rules checked again on the result by separate code.'], tools: [
        tool('read', 'rota-rules.md', rulesFile()),
        tool('write', 'rota/model.py', excerpt('for d in WEEKDAYS:', '# 13') + '\n…\n' + excerpt('# Objective.', 'm.Maximize'), `new · ${modelLines.length} lines`),
        tool('bash', 'uv run --with ortools python3 rota/model.py', R.log.join('\n')),
        tool('write', 'team/rota.md', rotaFile(), 'new · 4 weeks'),
      ], time: '8 min 52 s', reply: `A rota for all four weeks that meets **all ${R.rules.length} rules**, each checked again on the finished grid, and keeps **${nKept} of ${R.wishes.length} wishes**. Bob’s Saturday the 19th lost to Carol, who asked first; your own Friday the 4th lost to Kirsi’s Monday to Wednesday. Say the word and I solve either the other way.` }), view('team/rota.md', rotaView()), 'Example Studio'),
    },
    {
      s: 'leave', at: '11:10', ask: 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?',
      did: 'His agent goes through the accounts, subscriptions, shared folders and recurring tasks in Lena’s name, and makes one hand-over list, each item with a new owner and the day it moves. Her accounts close tomorrow evening, not before.',
      screen: () => screen('Lena’s last day', you('11:02', 'Lena leaves tomorrow after four years. What does she hold, and who takes it over?') + turn({ tools: [
        tool('read', 'people/accounts.csv', 'Lena: 11 accounts · 2 subscriptions on her card'),
        tool('bash', 'grep -rl "Lena" team/tasks.md handbook/ team/AGENTS.md', '6 recurring tasks name her'),
        tool('write', 'people/handover-lena.md', '19 items · each with a new owner and a day'),
      ], time: '7 min 32 s', reply: '**19 things to hand over**: 11 accounts, 2 subscriptions on her card, and 6 recurring tasks, from the shop’s photo shoots to the market stall booking. Each has a proposed owner; nothing closes before tomorrow evening.' }), view('people/handover-lena.md', checklistMock('Hand-over · Lena, last day Fri 20 Nov', [[1, 'Shop photo shoots', 'Carol'], [1, 'Market stall booking', 'Bob'], [0, 'Shop admin account', 'Alice'], [0, 'Photo library subscription', 'Carol'], [0, 'Social media login', 'Carol'], [0, 'Accounts closed', 'Fri 18:00']])), 'Example Studio'),
    },
    {
      s: 'redact', at: '13:20', pick: 1, ask: 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.',
      did: 'A black box drawn over a name hides nothing: the name is still in the file. His agent takes other people’s names, addresses, pay and health details out of the PDFs themselves, lists every redaction with its reason for Dave to check, and proves it by reading the text back out with a second program.',
      screen: () => screen('Personnel file request', you('13:12', 'A former employee asked for her personnel file. Remove everyone else’s details so they cannot be recovered.', att('people/files/former-2024/', `${X.documents} documents`)) + turn({ thoughts: ['A box drawn over a name leaves the name in the file. The text has to be deleted from the page, and the proof should come from a different program than the one that deleted it.'], tools: [
        tool('bash', 'ls people/files/former-2024/', fileList),
        tool('write', 'people/files/former-2024/redactions.csv', listCsv, `new · ${entries} rows`),
        tool('bash', 'uv run --with pymupdf python3 tools/redact.py people/files/former-2024/ out/', X.log.join('\n')),
        tool('bash', `DIR=people/files/former-2024; ${NAMES_CMD}`, `${X.before}`),
        tool('bash', `DIR=out; ${NAMES_CMD}`, `${X.after}`),
      ], time: '7 min 05 s', reply: `**${total} redactions** in ${X.documents} documents: six other people’s names, with their addresses, pay, health and family details. The text is deleted from the files, not covered. I read all ${X.documents} back with a second program: the names were on ${X.before} lines before and are on **${X.after === 0 ? 'none' : X.after}** now. Nothing has gone to her; the copies and the list of redactions wait for your check.` }), view(`out/${X.shown}`, redactView()), 'Example Studio'),
    },
    {
      s: 'survey', at: '14:30', ask: 'The autumn staff survey: sixteen answers. The results as charts, please.',
      did: 'His agent counts the answers and draws the charts, and declines to split them by team: with sixteen people, a team of three could be recognised from its answers.',
      screen: () => screen('Staff survey', you('14:24', 'The autumn staff survey: sixteen answers. The results as charts, please.', att('survey-autumn.csv', '16 answers · 12 questions')) + turn({ tools: [
        tool('bash', 'uv run --with pandas,matplotlib python3 tools/survey.py survey-autumn.csv', '5 charts · averages and spread'),
      ], time: '5 min 54 s', reply: 'Five charts are beside this. The lowest is **feedback** (2.9 of 5). I did not split by team: the smallest team is three people, and their answers would be recognisable.' }), view('survey-autumn.pdf', barsMock('Average, 1 to 5', [['I know what is expected', 4.3], ['Tools work', 4.1], ['Workload is fair', 3.4], ['I get feedback', 2.9, 1], ['I would recommend the studio', 4.4]], '', '16 answers · not split: groups under 5')), 'Example Studio'),
    },
    {
      s: 'audio', at: '16:10', ask: 'Make the staff handbook listenable for the seasonal packers.',
      did: 'Many of them come in by bus. His agent reads the handbook aloud on the server, one file per chapter, with product names and abbreviations said right.',
      screen: () => screen('Handbook to listen to', you('15:50', 'Make the staff handbook listenable for the seasonal packers.') + turn({ tools: [
        tool('bash', 'uv tool install piper-tts', 'installed into ~/.local · voice 60 MB'),
        tool('bash', 'python3 tools/handbook_audio.py handbook/ --voice en_GB', '9 chapters · 48 min · product names from products.csv'),
      ], time: '19 min 40 s', reply: '**Nine chapters**, 48 minutes in all, in *handbook-audio/*. Product names and “VAT”, “SKU” and “60 °C” are read as people say them.' }), view('handbook-audio/', sheetMock('handbook-audio/', ['Chapter', 'Length'], [['1 Welcome', '3:10'], ['2 Packing an order', '8:40'], ['3 Safety at the press', '6:05'], ['4 Returns and exchanges', '4:20']], '… 5 more · 48 min in all')), 'Example Studio'),
    },
  ],
},
};
