// Round 3b (research-workmux-sidebar): Lopussa in the conversation the person is in. Jari
// 2026-10-28 chose Lopussa from round 2 and asked: once you have replied to one agent, does the
// next waiting one show up there? Here you answer Iltakierros, the agent starts working and
// streams its reply, and the next conversation that needs you is offered in this chat.
//
// The directions differ on one axis: when the offer appears, which decides where it can sit.
//   1 Heti      — the moment you send, a card at the end of the conversation, under your
//                 message; the reply streams in above it and pushes it down.
//   2 Työssä    — when the host confirms the agent started working (run active), a slim line
//                 docked above the composer, outside the stream, so the reply never moves it;
//                 it stays when the agent finishes.
//   3 Valmiina  — nothing while the agent works; when it finishes, a card after its reply.
// The same in all three: nothing is offered while this conversation itself needs you (a
// question, an unread reply) or when nothing else does; the offer is the next one in Sinun
// vuorosi, most recent change first, like round 2; when that one is handled elsewhere (another
// tab, the phone) the offer moves to the following one and says so once; Alt+↓ opens what is
// offered and Alt+↑ steps back; answering the opened one starts the loop again.
const { IC, esc, S, ago, yours, isYours, mark, byId, LABEL } = F;
const NAMES = ['Heti', 'Työssä', 'Valmiina'];
F.fixture({ cur: 'c1' });

// The live turn per conversation: sent (the browser sent it, the host has not confirmed a run),
// working (run active, the reply streams), done. A conversation that finishes while the person
// is elsewhere comes back to Sinun vuorosi as a new reply.
const SENT_MS = 900, TICK_MS = 260;
const REPLY = {
  c1: 'Selvä, odotetaan valintaasi. Käyn sillä aikaa workerit läpi. Kuusi työskentelee ja kaksi odottaa viestiä. Kastelun ajastus on testivaiheessa, ja Lomakkeen saavutettavuus odottaa katselmointia. Kirjoitan yhteenvedon, kun kaikki ovat valmiita.',
  c2: 'Hyvä. Otan seuraavaksi WebP-muunnoksen ja ajan testit uudelleen. Kerron, jos koko ei pienene ainakin viidenneksellä.',
  c3: 'Lisään vientiin otsikkorivin ja päivämäärän ISO-muodossa. Ajan vanhat tiedostot läpi samalla kertaa.',
};
const live = new Map();
let timers = [];
let note = '', noteTimer;
function send(c, text) {
  if (!c) return false;
  if (c.kind === 'question') S.answered.add(c.id);
  const words = (REPLY[c.id] ?? 'Selvä. Jatkan tästä ja kerron, kun olen valmis.').split(' ');
  const L = { phase: 'sent', text, words, n: 0, seen: false };
  live.set(c.id, L);
  const at = (ms, f) => timers.push(setTimeout(f, ms));
  at(SENT_MS, () => { L.phase = 'working'; F.repaint(); });
  const ticks = Math.ceil(words.length / 3);
  for (let i = 1; i <= ticks; i++) at(SENT_MS + i * TICK_MS, () => {
    L.n = Math.min(words.length, i * 3);
    if (i === ticks) {
      L.phase = 'done'; L.seen = S.cur === c.id;
      // A reply that lands after the visit is a new change: it re-enters the walk.
      if (!L.seen) visited = visited.filter(id => id !== c.id);
      F.repaint(); return;
    }
    paintStream(c.id);
  });
  S.toast = '';
  F.repaint();
  return true;
}
// One streamed chunk changes only the reply text, so the composer and the offer keep focus.
function paintStream(id) {
  if (S.cur !== id) return;
  const el = document.querySelector('[data-testid="live-text"]');
  const st = document.querySelector('[data-testid="stream"]');
  if (!el || !st) return;
  const follow = st.scrollHeight - st.scrollTop - st.clientHeight < 24;
  el.textContent = live.get(id).words.slice(0, live.get(id).n).join(' ');
  if (follow) st.scrollTop = st.scrollHeight;
}
function reset() { timers.forEach(clearTimeout); timers = []; live.clear(); visited = []; note = ''; }

// The walk is round 2's: most recent first, skipping the ones visited in this walk.
let visited = [];
const others = () => yours().filter(c => c.id !== S.cur);
function nextOne() {
  const list = others();
  return list.find(c => !visited.includes(c.id)) ?? list[0] ?? null;
}
function go(dir = 1) {
  if (dir < 0) {
    const back = visited.slice(0, -1).reverse().find(id => id !== S.cur && byId(id));
    if (!back) { S.toast = 'Ei edellistä tällä kierroksella.'; F.repaint(); return; }
    visited = visited.slice(0, visited.lastIndexOf(back));
    F.open(back);
    return;
  }
  const n = nextOne();
  if (!n) { S.toast = 'Mikään muu ei odota sinua.'; F.repaint(); return; }
  if (!others().some(c => !visited.includes(c.id))) visited = [];
  F.open(n.id);
}
// Lab: the offered one is handled on another device. A question gets answered there and starts
// working; a reply gets read there.
function elsewhere() {
  const n = nextOne();
  if (!n) { S.toast = 'Mikään ei odota sinua toisaalla.'; F.repaint(); return; }
  if (n.kind === 'question') S.answered.add(n.id); else S.seen.add(n.id);
  note = `${n.title} hoidettiin toisaalla.`;
  clearTimeout(noteTimer); noteTimer = setTimeout(() => { note = ''; F.repaint(); }, 5000);
  F.repaint();
}

// When the offer shows. Never while this conversation needs the person.
const phaseOf = (c) => live.get(c?.id)?.phase ?? (c && (c.kind === 'working' || c.kind === 'background') ? 'working' : 'done');
function offered(c) {
  if (!c || isYours(c)) return null;
  const n = nextOne();
  const ph = phaseOf(c);
  if (S.v === 1 && ph === 'sent') return null;
  if (S.v === 2 && ph !== 'done') return null;
  return n ?? 'none';
}
const EXCERPT = { c1: 'Mergetäänkö satokalenterin prototyyppi nyt vai odotetaanko valintaasi?', c2: 'Pakkaus on nyt build-vaiheessa ja testit ovat vihreinä.', c3: 'Vienti kirjoittaa nyt yhden tiedoston vuorokautta kohden.' };
const what = (n) => n.kind === 'question' ? 'kysyy' : 'uusi vastaus';
function card(c) {
  const n = offered(c);
  if (!n) return '';
  const msg = note ? `<p class="lnote" role="status" data-testid="offer-note">${esc(note)}</p>` : '';
  if (n === 'none') return `<div class="lend">${msg}<p class="lnone" data-testid="offer-none">Mikään muu ei odota sinua.</p></div>`;
  const more = others().length - 1;
  return `<aside class="lcard" aria-label="Seuraavaksi sinun vuorosi" data-testid="offer" data-offer="${n.id}">
    ${msg}<p class="lh">${S.v === 0 && phaseOf(c) !== 'done' ? 'Sillä aikaa sinun vuorosi' : 'Seuraavaksi sinun vuorosi'}${more > 0 ? ` <span class="count">+${more} muuta</span>` : ''}</p>
    <button type="button" class="lb" data-act="next" data-testid="offer-open" title="Avaa ${esc(n.title)} (Alt+↓)">
      ${mark(n.kind)}<span class="txt"><span class="ttl">${esc(n.title)}</span><span class="det">${esc(n.ws)} · ${what(n)} · ${ago(n.t)}</span>${EXCERPT[n.id] ? `<span class="ex">${esc(EXCERPT[n.id])}</span>` : ''}</span>
      <span class="go">Avaa ${IC.arrow}</span></button></aside>`;
}
function dock(c) {
  const n = offered(c);
  if (!n) return '';
  const msg = note ? `<span class="dnote" role="status" data-testid="offer-note">${esc(note)}</span>` : '';
  if (n === 'none') return msg ? `<div class="dock quiet" data-testid="offer-none">${msg}</div>` : '';
  const more = others().length - 1;
  return `<div class="dock" data-testid="offer" data-offer="${n.id}">${msg}
    <button type="button" class="db" data-act="next" data-testid="offer-open" title="Avaa ${esc(n.title)} (Alt+↓)">
      <span class="dl">Sillä aikaa</span>${mark(n.kind)}<span class="ttl">${esc(n.title)}</span><span class="det">${esc(what(n))} · ${ago(n.t)}</span>${more > 0 ? `<span class="count">+${more}</span>` : ''}<span class="go">Avaa <kbd>Alt+↓</kbd></span></button></div>`;
}

// The conversation: the history as before, then the person's message and the live reply.
function body(c) {
  const L = c && live.get(c.id);
  if (!L) return F.baseBody(c);
  // The history before this turn: the question with its options spent, or the earlier reply.
  const orig = F.baseBody({ ...c, kind: c.id === 'c1' ? 'question' : 'waiting' })
    .replace(/<div class="opts">[\s\S]*?<\/div>/, '<p class="answered">Vastattu</p>');
  const words = L.words.slice(0, L.n).join(' ');
  const working = L.phase !== 'done';
  return `${orig}<div class="msg-user">${esc(L.text)}</div>
    <div class="msg-agent" data-testid="live" data-phase="${L.phase}"><span class="who">Pi</span><p data-testid="live-text">${esc(words)}</p></div>
    ${working ? `<p class="working-line">${mark('working')}${L.phase === 'sent' ? 'Lähetetty · odottaa työn alkua' : 'Työskentelee'}</p>` : ''}`;
}

F.hooks = {
  body,
  send,
  streamEnd: (c) => S.v === 1 ? '' : card(c),
  dock: (c) => S.v === 1 ? dock(c) : '',
  adjust: (x) => {
    const L = live.get(x.id);
    if (!L) return;
    if (L.phase !== 'done') { x.kind = 'working'; x.t = 0.1; return; }
    x.kind = L.seen || S.seen.has(x.id) ? 'waiting' : 'new';
    x.t = 0.1;
    x.reply = L.words.join(' ');
  },
  // Any route into a conversation (rail, offer, key) counts as a visit in this walk.
  after: () => { if (visited[visited.length - 1] !== S.cur) visited.push(S.cur); },
  click: (t, a) => { if (a === 'next') go(1); },
  onKey: (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
  },
};
document.getElementById('elsewhere').addEventListener('click', elsewhere);
for (const id of ['reset', 'scene']) document.getElementById(id).addEventListener(id === 'scene' ? 'change' : 'click', () => { reset(); F.repaint(); });
const variants = F.setup(NAMES).map(fn => () => { reset(); return fn(); });
