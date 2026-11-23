// Erin: Teacher, printing courses. Polished for landing page v1: Manim animation, ink overlap page, welcome drafts (see NOTES.md).
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, drafts, diff, screen, view, video, assets } from '../../engine/kit.mjs';
import { toggles, sheetMock } from '../../engine/views.mjs';

const asset = assets(import.meta.url);

// ---------- The ink overlap page (client.js makes it move) ----------
// Transparent inks print like a multiply blend: where two overlap, the cloth
// shows through both. With ink strength o, each channel is
// cloth * (1 - o + o * a) * (1 - o + o * b). client.js uses the same numbers.
const CLOTH = '#f7f2e7';
const INKS = { indigo: ['Indigo', '#2f4f73'], rust: ['Rust', '#b45a33'], weld: ['Weld yellow', '#d9b23a'] };
const NAMES = { 'indigo+rust': 'a warm slate', 'indigo+weld': 'a deep green', 'rust+weld': 'a burnt orange', 'indigo+indigo': 'a deeper indigo', 'rust+rust': 'a deeper rust', 'weld+weld': 'a deeper gold' };
const STRENGTH = { thin: 0.55, full: 0.85 };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, o) => '#' + rgb(CLOTH).map((c, i) => Math.round(c * (1 - o + o * rgb(a)[i] / 255) * (1 - o + o * rgb(b)[i] / 255)).toString(16).padStart(2, '0')).join('');
const pairName = (a, b) => NAMES[[a, b].sort().join('+')];
const swatches = (role, cur) => `<p class="ip-sw" role="group" aria-label="${role === 'a' ? 'First ink' : 'Second ink'}"><span class="ip-l">${role === 'a' ? 'First ink' : 'Second ink'}</span>${Object.entries(INKS).map(([k, [n, c]]) => `<button type="button" class="ip-ink" data-ink-${role}="${k}" aria-pressed="${k === cur}" style="--c:${c}"><i aria-hidden="true"></i>${esc(n)}</button>`).join('')}</p>`;
const inkPage = (url, a = 'indigo', b = 'rust', st = 'full', x = 38) => {
  const o = STRENGTH[st];
  return `<div class="br ip-br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>${esc(url)}</p><div class="ip" data-a="${a}" data-b="${b}" data-st="${st}" style="--a:${INKS[a][1]};--b:${INKS[b][1]};--o:${o};--x:${x}">
<header class="ip-h"><small>Example Studio · Printing course</small><b>Two inks, one cloth</b><span>Pick two inks, then drag the second print across the first.</span></header>
<div class="ip-cloth"><span class="ip-p ip-pa" aria-hidden="true"></span><span class="ip-p ip-pb" aria-hidden="true" title="Drag me"></span></div>
<div class="ip-c">${swatches('a', a)}${swatches('b', b)}
<p class="ip-sw" role="group" aria-label="Ink"><span class="ip-l">Ink</span><button type="button" class="ip-st" data-st="thin" aria-pressed="${st === 'thin'}">Thin</button><button type="button" class="ip-st" data-st="full" aria-pressed="${st === 'full'}">Full</button></p>
<label class="ip-sw ip-x"><span class="ip-l">Overlap</span><input type="range" min="0" max="100" value="${x}" aria-label="How far the second print overlaps the first"></label></div>
<p class="ip-r" aria-live="polite"><span class="ip-m" style="--m:${mix(INKS[a][1], INKS[b][1], o)}" aria-hidden="true"></span><span class="ip-rt"><b>${esc(INKS[a][0])}, then ${esc(INKS[b][0].toLowerCase())}</b> make ${esc(pairName(a, b))}</span></p>
</div></div>`;
};

const cardsMock = (q, a, n) => `<div class="cards" data-view data-state="q">${toggles([['q', 'Question'], ['a', 'Answer']], 'q')}<div class="card"><p class="card-q">${esc(q)}</p><p class="card-a">${esc(a)}</p></div><p class="cards-n">${esc(n)}</p></div>`;

export default {
  id: 'role-erin',
  kind: 'role',
  // pick: 1 marks the glimpses the page shows; the others are reached from the sidebar.
  day: {
  id: 'erin', name: 'Erin', role: 'Teacher, printing courses', org: 'Example Studio', color: '#8c6f4e',
  blurb: 'Erin teaches Example Studio’s printing courses: evening classes, Saturday courses and school groups in the studio’s course room.',
  places: [['07:45', 'At home', 'home'], ['09:30', 'In the course room', 'class'], ['12:00', 'Lunch', 'lunch'], ['12:45', 'In the course room', 'class'], ['14:45', 'At home', 'home']],
  sess: [
    { id: 'marks', title: 'Autumn course feedback', segs: [['07:50', 'run', 'Reading 14 final pieces'], ['08:20', 'turn', '14 notes drafted'], ['08:30', 'run', 'Sending'], ['08:31', 'quiet', 'Sent · register updated']] },
    { id: 'anim', title: 'Block printing animation', segs: [['08:40', 'run', 'Rendering 5 steps'], ['09:10', 'turn', '20-second animation'], ['09:20', 'quiet', 'block-print.mp4']] },
    { id: 'ink', title: 'Ink overlap page', segs: [['11:15', 'run', 'Building a small page'], ['11:50', 'turn', 'Page ready to try'], ['11:56', 'run', 'Publishing'], ['11:57', 'quiet', 'Live at courses.example.org/ink-overlap']] },
    { id: 'signup', title: 'January course start', segs: [['13:10', 'run', 'Merging three lists'], ['13:30', 'turn', '34 people · 1 twice'], ['13:40', 'quiet', 'Group sizes in team/tasks.md']] },
    { id: 'cards', title: 'Printing terms cards', segs: [['15:00', 'run', 'Reading 22 slides'], ['15:10', 'turn', '40 cards'], ['15:20', 'quiet', 'printing-terms.apkg']] },
  ],
  g: [
    {
      s: 'marks', at: '08:20', ask: 'The autumn course’s final pieces: check each against the brief and draft feedback.',
      did: 'Fourteen participants sent photos of their final prints and a few lines about them. Her agent checks each against the course brief, drafts a short note per person with one strength and one thing to try, marks who completed the course in the register, and leaves the sending to her.',
      screen: () => screen('Autumn course feedback', you('07:50', 'The autumn course’s final pieces: check each against the brief and draft feedback.') + turn({ tools: [
        tool('bash', 'gog gmail search "label:autumn-course has:attachment newer_than:10d"', '14 final pieces · photos and reflections'),
        tool('read', 'courses/autumn/brief.md', '3 criteria: two-colour repeat, clean registration, a short reflection'),
        tool('write', 'courses/autumn/register.csv', '13 completed · 1 missing a reflection'),
      ], time: '30 min 24 s', reply: '**Fourteen notes drafted**, each with one strength and one thing to try. One participant has not sent a reflection yet; her note asks for it. Nothing has gone out.', extra: drafts([['draft', 'participant, Tuesday group', 'Your final print', 'The repeat holds across the whole cloth. Next, try the rust a shade thinner…'], ['draft', 'participant, Thursday group', 'Almost there', 'Your registration is clean. One thing missing: the few lines about…']]) }) + you('08:30', 'Send them.') + turn({ reply: 'Sent, fourteen notes from your mailbox.' })),
    },
    {
      s: 'anim', at: '09:10', pick: 1, ask: 'A short animation for Saturday’s beginners: how a block print is made, from the carving to the second colour.',
      did: 'Every new group asks why the block is carved backwards, and how the second colour finds its place. She lists the five steps she draws on the whiteboard; her agent writes them as a Manim script, renders the animation on the server and hands her twenty seconds she can play on the course room screen.',
      screen: () => screen('Block printing animation', you('08:40', 'A short animation for Saturday’s beginners: how a block print is made, from the carving to the second colour.') + turn({ thoughts: ['A lopsided motif shows the mirror best: a sprig leaning right, berries low on the left'], tools: [
        tool('write', 'courses/saturday/block_print.py', 'class BlockPrint(Scene): 5 steps\n  1 the drawing turns over onto the block\n  2 a roller inks the raised wood\n  3 face down onto linen: prints the right way round\n  4 eight repeats along the register marks\n  5 rust block on the same marks; overlaps go slate', 'new · 268 lines'),
        tool('bash', 'manim render -r 1280,720 --fps 30 courses/saturday/block_print.py BlockPrint', 'Manim Community v0.22.1\nPlayed 69 animations\nFile ready at media/videos/block_print/720p30/BlockPrint.mp4'),
        tool('bash', 'ffmpeg -i BlockPrint.mp4 -an -crf 24 -movflags +faststart courses/saturday/block-print.mp4', 'block-print.mp4 · 19.8 s · 1280×720 · 789 KB'),
      ], time: '14 min 22 s', reply: '**Twenty seconds**, the five steps from your whiteboard, ending where rust lands on indigo. Say if any step is too quick.' }), view('block-print.mp4', video(asset('block-print.mp4'), { poster: asset('block-print.webp'), w: 1280, h: 720, label: 'Block printing in five steps: the block, the ink, the press, the repeat, the second colour' })), 'Example Studio'),
    },
    {
      s: 'ink', at: '11:50', pick: 1, ask: 'A little page where the course can try what two of our inks make when they overlap. Indigo, rust and weld yellow.',
      did: 'Between two groups she describes the idea in two sentences. Her agent builds a small page with the studio’s three inks, where the second print slides across the first and the overlap shows what the cloth will really get. She tries it on a course tablet, says yes, and the class has the link before the afternoon group arrives.',
      screen: () => screen('Ink overlap page', you('11:15', 'A little page where the course can try what two of our inks make when they overlap. Indigo, rust and weld yellow.') + turn({ tools: [
        tool('read', 'studio/inks.md', '3 inks for linen: indigo #2f4f73, rust #b45a33, weld yellow #d9b23a'),
        tool('write', 'pages/ink-overlap/index.html', 'one file · no sign-in · inks overprint like transparent ink (multiply)', 'new · 184 lines'),
        tool('bash', 'npx playwright screenshot --viewport-size 1024,768 pages/ink-overlap/index.html check.png', 'swatches and drag work at tablet size · no console errors'),
      ], time: '35 min 12 s', reply: 'Try it beside this: pick two inks, drag the second print. Say yes and it goes up at **courses.example.org/ink-overlap**.' }), view('pages/ink-overlap/index.html', inkPage('preview · pages/ink-overlap/index.html'), 'Preview'), 'Example Studio'),
    },
    {
      s: 'signup', at: '13:30', pick: 1, hand: 'Hands to Bob and Alice: the group sizes go into team/tasks.md, so Bob cuts linen for 34 and Alice sees January is nearly full.',
      ask: 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.',
      did: 'Sign-ups came from the web form, emails and a school’s spreadsheet. Her agent merges them, notices one person signed up twice under two spellings, drafts each welcome with the group’s day and what to bring, adds everyone to the register, and writes the numbers into the team’s task list.',
      screen: () => screen('January course start', you('13:10', 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.') + turn({ tools: [
        tool('bash', 'python3 tools/merge_signups.py form.csv mail/ school-group.xlsx', '35 rows → 34 people (one twice: “Aino Berg” / “Aino Bergh”)'),
        tool('write', 'courses/2027-01/welcome/*.eml', '34 drafts · each with the group’s day and what to bring'),
        diff('team/tasks.md', ['+ Bob: cut linen for 34, three groups, by 7 Jan  [Erin, 19 Nov]']),
      ], time: '20 min 31 s', reply: '**34 people** in three groups; Saturday has two places left. The welcome messages are in your drafts, nothing sent. Bob has the linen in his tasks.', extra: drafts([['draft', 'Aino Berg', 'Welcome to Saturday block printing', 'Saturdays 10–13 from 9 January, in the course room. Bring an apron; the linen and inks are ready for you…'], ['draft', 'Tom Lind, Thursday group', 'Welcome to Thursday evenings', 'Thursdays 18–20:30 from 7 January. Your first evening: carve a small block…']]) }), view('courses/2027-01/register.csv', sheetMock('register.csv', ['Group', 'Day', 'People', 'Places'], [['A', 'Tue evening', '12', '12'], ['B', 'Thu evening', '12', '12'], ['C', 'Saturday', '10', '12']], '34 people · 1 duplicate merged')), 'Example Studio'),
    },
    {
      s: 'cards', at: '15:10', ask: 'Revision cards from my printing-terms slides for the beginners.',
      did: 'Her agent reads her own slides and makes forty cards in her words, with her drawings on them, as a deck the participants open on their phones.',
      screen: () => screen('Printing terms cards', you('15:00', 'Revision cards from my printing-terms slides for the beginners.', att('printing-terms.pptx', '22 slides')) + turn({ tools: [
        tool('bash', 'uv run --with python-pptx,genanki python3 tools/make_deck.py printing-terms.pptx', '40 cards · 9 with your drawings'),
      ], time: '10 min 16 s', reply: '**Forty cards**, in your own words, nine with your drawings.', extra: offer('printing-terms.apkg', 'Card deck · 40 cards') }), view('printing-terms.apkg', cardsMock('Why is a block print reversed?', 'The block is pressed face down, so the image comes out mirrored. Letters are carved backwards.', 'Card 7 of 40 · from Erin’s own slides')), 'Example Studio'),
    },
  ],
},
};
