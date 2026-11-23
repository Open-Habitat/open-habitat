// Erin: Teacher, printing courses. Ported from round 6 (2026-11-22-etusivu-kierros-6), content unchanged.
// The block contract is in ../../BLOCKS.md.
import { esc, you, att, tool, turn, offer, drafts, diff, screen, view } from '../../engine/kit.mjs';
import { toggles, sheetMock } from '../../engine/views.mjs';

// ---------- This block's own views ----------
const INKS = { 'indigo-rust': ['#2f4f73', '#b45a33', '#5a4a52', 'Indigo + rust: a warm slate'], 'indigo-yellow': ['#2f4f73', '#d9b23a', '#3f6b4a', 'Indigo + weld yellow: forest green'], 'rust-yellow': ['#b45a33', '#d9b23a', '#c47a2f', 'Rust + weld yellow: amber'] };
const inkMixMock = (url) => `<div class="br"><p class="br-url"><span class="br-lock" aria-hidden="true"></span>${esc(url)}</p><div class="ink" data-view data-state="indigo-rust">${toggles(Object.keys(INKS).map((k) => [k, INKS[k][3].split(':')[0], INKS[k][3]]), 'indigo-rust')}<div class="ink-row">${Object.entries(INKS).map(([k, [a, b, m]]) => `<div class="ink-set ink-${k}"><span style="--c:${a}"></span><i>+</i><span style="--c:${b}"></span><i>=</i><span class="ink-m" style="--c:${m}"></span></div>`).join('')}</div><p class="ink-n" data-label>${INKS['indigo-rust'][3]}</p></div></div>`;
const cardsMock = (q, a, n) => `<div class="cards" data-view data-state="q">${toggles([['q', 'Question'], ['a', 'Answer']], 'q')}<div class="card"><p class="card-q">${esc(q)}</p><p class="card-a">${esc(a)}</p></div><p class="cards-n">${esc(n)}</p></div>`;
const framesMock = (texts, label, cls = '') => `<div class="frames ${cls}">${texts.map((t, k) => `<div class="frame-k" style="--k:${k}"><span class="fr-fib" aria-hidden="true"></span><span class="fr-dots" aria-hidden="true"></span><small>${k + 1}</small><p>${esc(t)}</p></div>`).join('')}<p class="frames-n">${esc(label)}</p></div>`;

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
    { id: 'anim', title: 'Mirror image animation', segs: [['08:40', 'run', 'Rendering 3 scenes'], ['09:10', 'turn', '46-second animation'], ['09:20', 'quiet', 'mirror-and-register.mp4']] },
    { id: 'ink', title: 'Ink overlap page', segs: [['11:15', 'run', 'Building a small page'], ['11:50', 'turn', 'Page ready to try'], ['12:05', 'quiet', 'courses.example.org/ink-overlap']] },
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
      s: 'anim', at: '09:10', pick: 1, ask: 'A short animation for Saturday: why the block is carved in mirror image, and how the second colour lines up with the first.',
      did: 'She describes it in three sentences. Her agent writes the animation as a short script, renders it on the server, and slows the second scene down when she asks.',
      screen: () => screen('Mirror image animation', you('08:40', 'A short animation for Saturday: why the block is carved in mirror image, and how the second colour lines up with the first.') + turn({ tools: [
        tool('write', 'courses/saturday/mirror.py', '3 scenes · block, print, corner marks'),
        tool('bash', 'uv run --with manim manim -qh courses/saturday/mirror.py', 'mirror-and-register.mp4 · 46 s · 1080p'),
      ], time: '30 min 09 s', reply: '**46 seconds**, three scenes. Say if any part is too fast.', extra: offer('mirror-and-register.mp4', 'Video · 46 s') }), view('mirror-and-register.mp4', framesMock(['Carved in mirror image', 'Pressed face down, it reads the right way', 'Corner marks line up the second colour'], 'mirror-and-register.mp4 · 46 s · 3 scenes', 'frames-print')), 'Example Studio'),
    },
    {
      s: 'ink', at: '11:50', pick: 1, ask: 'Make a little page where the course can see what two inks make when they overlap. Indigo, rust and weld yellow.',
      did: 'Between two groups she describes the idea in two sentences. Her agent builds a small page at the studio’s course address; she tries it once and shares the link with the class herself.',
      screen: () => screen('Ink overlap page', you('11:15', 'Make a little page where the course can see what two inks make when they overlap. Indigo, rust and weld yellow.') + turn({ tools: [
        tool('write', 'pages/ink-overlap/index.html', 'one page · works on the course tablets'),
        tool('publish', 'courses.example.org/ink-overlap', 'published · no sign-in needed'),
      ], time: '35 min 46 s', reply: 'Try it beside this. The colours come from the inks on the studio’s list, so the page matches what the course will print.' }), view('courses.example.org/ink-overlap', inkMixMock('courses.example.org/ink-overlap'), 'Live'), 'Example Studio'),
    },
    {
      s: 'signup', at: '13:30', pick: 1, hand: 'Hands to Bob and Alice: the group sizes go into team/tasks.md, so Bob cuts linen for 34 and Alice sees January is nearly full.',
      ask: 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.',
      did: 'Sign-ups came from the web form, emails and a school’s spreadsheet. Her agent merges them, notices one person signed up twice under two spellings, drafts each welcome with the group’s day and what to bring, adds everyone to the register, and writes the numbers into the team’s task list.',
      screen: () => screen('January course start', you('13:10', 'January course: merge the sign-ups, draft the welcome messages, and put the group sizes where Bob sees them.') + turn({ tools: [
        tool('bash', 'python3 tools/merge_signups.py form.csv mail/ school-group.xlsx', '35 rows → 34 people (one twice: “Aino Berg” / “Aino Bergh”)'),
        tool('write', 'courses/2027-01/welcome/*.eml', '34 drafts · each with the group’s day and what to bring'),
        diff('team/tasks.md', ['+ Bob: cut linen for 34, three groups, by 7 Jan  [Erin, 19 Nov]']),
      ], time: '20 min 31 s', reply: '**34 people** in three groups; Saturday has two places left. The welcome messages are in your drafts, nothing sent. Bob has the linen in his tasks.' }), view('courses/2027-01/register.csv', sheetMock('register.csv', ['Group', 'Day', 'People', 'Places'], [['A', 'Tue evening', '12', '12'], ['B', 'Thu evening', '12', '12'], ['C', 'Saturday', '10', '12']], '34 people · 1 duplicate merged')), 'Example Studio'),
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
