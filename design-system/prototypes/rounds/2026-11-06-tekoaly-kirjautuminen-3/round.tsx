import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, useLocation, useNavigate} from 'react-router';
import {Dialog as AriaDialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/app/PiOnboarding.css';
import {AgentHeader, AgentNavItem, type AgentNavModel, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {AssistantMessage, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {Composer, type ComposerSources} from '../../../../web/src/components/composer/Composer';
import {ControlButton, ExternalLink} from '../../../../web/src/components/ControlElements';
import {Markdown} from '../../../../web/src/components/Markdown';
import {Icon} from '../../../../web/src/components/Icon';
import {Button, Checkbox} from '../../../../web/src/components/Primitives';
import {StatusMark} from '../../../../web/src/components/Status';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {type StatusItem, StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {SignInStep, SignInSteps} from '../../../../web/src/components/PiDeviceSignIn';
import {AccountShelf} from '../../../../web/src/components/Account';
import {liveText, setPersonalLanguage} from '../../../../web/src/i18n';
import {claudeSignInText} from '../../../../web/src/text/claudeSignIn';
import '../../../../web/src/components/QuietSection.css';
import './round.css';

// The page is reviewed in Finnish whatever the reviewer's browser says.
setPersonalLanguage('fi');
const claudeTxt = liveText(claudeSignInText);

// proto-ai-sign-in-expired, round 3. Jari 6.11. chose the window over the
// conversation and the short failed-turn line (round 2's B2), and found
// round 2's third question unclear: may the waiting message go by itself
// when (a) the person edited it while it waited, or (b) another
// conversation on the same provider also holds a waiting message? This
// round tells it as a story, step by step, the same in every riff: the
// message waits in the field, the person edits it, writes in a second
// Claude conversation, signs in in the window, and looks at both
// conversations afterwards. The riffs differ only in what the sign-in does
// with the two waiting messages: R1 sends both as they are, R2 asks in the
// window first, R3 sends only the one left untouched. Rail, header, bell,
// timeline, messages, composer, warning, checkbox and the Claude sign-in
// steps are production components; everything is synthetic, and only the
// Claude subscription is shown (round 2 covers the other providers).
const directions = ['R1 Lähtee itse', 'R2 Kysyy ensin', 'R3 Vain koskematon'];
const LINES = [
  'R1 Lähtee itse: kirjautumisen jälkeen kaikki odottavat viestit lähtevät heti sellaisinaan, myös muokattu ja toisen keskustelun viesti.',
  'R2 Kysyy ensin: kirjautumisen jälkeen ikkuna näyttää odottavat viestit, ja sinä valitset, mitkä lähtevät.',
  'R3 Vain koskematon: viesti, jota et ole muokannut odottaessa, lähtee itse; muokattu jää kenttään odottamaan Lähetä-painallusta.',
];
const ROUND_LINE = 'Kierros 3: kahden odottavan viestin tarina vaihe vaiheelta. Ikkuna ja lyhyt rivi on valittu.';
const R1 = 0, R2 = 1, R3 = 2;

// ---- The story, the same in every riff ----
const STEPS = ['Viesti odottaa', 'Muokkaat sitä', 'Toinen keskustelu', 'Kirjaudu uudelleen', 'Kirjautunut', 'Hetken päästä', 'Toinen keskustelu jälkeen'];
const CAPTIONS: string[][] = [
  ['Claude hylkäsi kirjautumisen. Viestisi odottaa kentässä ja lähtee itse heti, kun olet kirjautunut.',
    'Claude hylkäsi kirjautumisen. Viestisi odottaa kentässä. Kirjautumisen jälkeen sinulta kysytään, lähetetäänkö se.',
    'Claude hylkäsi kirjautumisen. Viestisi odottaa kentässä ja lähtee itse, kun olet kirjautunut, jos et muokkaa sitä.'],
  ['(a) Lisäät odottavaan viestiin ”Kiitos!”. Se lähtee yhä itse, nyt muokattuna.',
    '(a) Lisäät odottavaan viestiin ”Kiitos!”. Siitä kysytään yhä kirjautumisen jälkeen.',
    '(a) Lisäät odottavaan viestiin ”Kiitos!”. Nyt se ei lähde itse, ellet paina Lähetä.'],
  ['(b) Kesäajan virhe käyttää myös Claudea. Kirjoitat ja painat Lähetä; viesti jää odottamaan senkin kenttään.',
    '(b) Kesäajan virhe käyttää myös Claudea. Kirjoitat ja painat Lähetä; viesti jää odottamaan senkin kenttään.',
    '(b) Kesäajan virhe käyttää myös Claudea. Kirjoitat ja painat Lähetä; viesti jää odottamaan senkin kenttään.'],
  ['Palaat Viikon tunteihin ja painat Kirjaudu uudelleen. Ikkuna kertoo, että molemmat viestit lähtevät.',
    'Palaat Viikon tunteihin ja painat Kirjaudu uudelleen. Ikkuna kertoo, että viesteistä kysytään.',
    'Palaat Viikon tunteihin ja painat Kirjaudu uudelleen. Ikkuna kertoo, kumpi lähtee ja kumpi jää.'],
  ['Kirjautuminen onnistui. Ikkuna sulkeutuu, ja molemmat viestit lähtevät heti.',
    'Kirjautuminen onnistui. Ikkuna kysyy, mitkä kahdesta viestistä lähtevät.',
    'Kirjautuminen onnistui. Ikkuna sulkeutuu. Kesäajan virheen viesti lähti; muokattu viesti on kentässä.'],
  ['Claude vastasi muokattuun viestiin.',
    'Painoit Lähetä valitut. Claude vastasi muokattuun viestiin.',
    'Painoit Lähetä, kun viesti oli valmis. Claude vastasi siihen.'],
  ['Kesäajan virheen viesti lähti kirjautumisen jälkeen, ja Claude vastasi.',
    'Kesäajan virheen viesti lähti, koska valitsit sen, ja Claude vastasi.',
    'Kesäajan virheen viesti lähti itse kirjautumisen jälkeen, koska et koskenut siihen.'],
];

const S = {
  title: 'Claude-kirjautuminen on vanhentunut',
  cause: 'Claude ei enää hyväksy tilauksesi kirjautumista, eikä palvelin voi uusia sitä itse.',
  short: 'Claude-keskustelut eivät vastaa ennen uutta kirjautumista.',
  done: 'Claude-tilaus kirjautunut.',
  model: 'Claude Sonnet 5 · medium',
};

// ---- The host behind the sign-in: Claude's login answers, simulated ----
const host = {ok: false};
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
function useHost() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return host;
}
const repair = () => { if (!host.ok) { host.ok = true; notify(); } };

// Claude's page opens in a new tab in production. Here the round stands in
// for the person there: Claude hands back a code.
const CLAUDE_CODE = 'proto-7f3a9c2e';
const external = new Set<(href: string) => void>();
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a[href^="https://"]') as HTMLAnchorElement | null;
  if (!a || a.closest('.rq-bar')) return;
  e.preventDefault();
  external.forEach((f) => f(a.href));
}, true);
function useExternal(f: (href: string) => void) {
  const ref = useRef(f); ref.current = f;
  useEffect(() => { const g = (h: string) => ref.current(h); external.add(g); return () => { external.delete(g); }; }, []);
}

// ---- Conversations ----
type Item = {id: string; kind: 'user' | 'assistant'; text: string; time: string; state?: 'streaming' | 'complete' | 'failed'; node?: React.ReactNode};
type Conv = {id: string; title: string; ws: string; wsName: string; ago: number; claude: boolean; answer: string; history: Item[]};
const u = (id: string, time: string, text: string): Item => ({id, kind: 'user', time, text});
const r = (id: string, time: string, text: string): Item => ({id, kind: 'assistant', time, text, state: 'complete'});
const MESSAGE = 'Tapaaminen oli. Tästä tunnin tapaamisesta ja siihen olleesta 30 min valmistautumisesta pitää kanssa merkitä tunnit.';
const EDITED = `${MESSAGE} Kiitos!`;
const SECOND = 'Korjaa kesäajan testit.';
const CONVS: Conv[] = [
  {id: 'tunnit', title: 'Viikon tunnit', ws: 'ws_m', wsName: 'muistiinpanot', ago: 0, claude: true,
    answer: 'Merkitsin torstaille 3.11. tapaamisen 1 h ja valmistautumisen 0,5 h projektille Contoso. Viikon tunnit ovat nyt 31,5 h. Kiitos tailspin!',
    history: [
      u('t1', '9.02', 'Kirjaa tämän viikon tunnit Status.txt:n mukaan ja kerro, mitä puuttuu.'),
      r('t2', '9.05', 'Kirjasin maanantain ja tiistain, yhteensä 30 h.\n\n- **Ajankäyttöarvio ei tullut** tililistan mukana. Se on vielä auki.'),
    ]},
  {id: 'svg', title: 'Varjon piirto SVG:ksi', ws: 'ws_a', wsName: 'aurinkokello', ago: 1, claude: false, answer: '',
    history: [u('s1', '9.30', 'Piirrä varjon kulku SVG:ksi tunnin välein.')]},
  {id: 'kesa', title: 'Kesäajan virhe', ws: 'ws_a', wsName: 'aurinkokello', ago: 40, claude: true,
    answer: 'Korjasin molemmat kesäajan testit: siirtymäpäivän tunti laskettiin kahdesti. Kaikki 43 testiä menevät nyt läpi.',
    history: [
      u('k1', '8.40', 'Aja aurinkokellon testit ja kerro, mitkä epäonnistuvat.'),
      r('k2', '8.44', 'Ajoin testit: 41 läpi, 2 epäonnistui. Molemmat ovat kesäajan testejä.'),
    ]},
  {id: 'nda', title: 'NDA-viestin tarkistus', ws: 'ws_m', wsName: 'muistiinpanot', ago: 130, claude: false, answer: '',
    history: [
      u('n1', '7.02', 'Lue liitteen NDA ja kerro, mitä siinä pitää muuttaa.'),
      r('n2', '7.16', 'Kaksi kohtaa: salassapito on ikuinen (ehdota viittä vuotta), ja kohta 7 siirtää kaikki oikeudet heille.'),
    ]},
];
const byId = new Map(CONVS.map((c) => [c.id, c]));
const T0 = Date.now();
const noop = () => {};
const sources: ComposerSources = {
  commands: async () => ({answered_by: 'running', commands: []}),
  files: async () => ({files: [], truncated: false}),
  workspaceName: 'muistiinpanot',
};

type Post = {text: string; state: 'sending' | 'answered'};
type State = {
  drafts: Record<string, string>;
  /** The field's message waits for the agent to be back online. */
  waiting: Record<string, boolean>;
  /** The waiting message was changed after it began to wait. */
  edited: Record<string, boolean>;
  /** Messages that went after the failure, and their answers. */
  posts: Record<string, Post[]>;
  /** What the line above the field says after the sign-in. */
  after: Record<string, string>;
  /** R2: the conversations whose waiting messages the window asks about. */
  ask: string[];
  /** R2: which of those are ticked. */
  pick: Record<string, boolean>;
};
const empty = (): State => ({drafts: {tunnit: MESSAGE}, waiting: {tunnit: true}, edited: {}, posts: {}, after: {}, ask: [], pick: {}});

/** What a waiting message's sign-in will do, by riff. */
const armed = (d: number, st: State, id: string) => !!st.waiting[id] && !!st.drafts[id]?.trim() && !(d === R3 && st.edited[id]);
const goneLine = `${S.done} Viestisi lähti.`;
const keptLine = (d: number) => d === R3
  ? `${S.done} Muokkasit viestiä odottaessa, joten se ei lähtenyt itse. Lähetä, kun se on valmis.`
  : `${S.done} Viestisi on kentässä.`;
/** What the field says under a waiting message. */
function waitLine(d: number, edited: boolean) {
  if (d === R1) return edited ? 'Muokattu · lähtee itse tällaisenaan heti, kun olet kirjautunut.' : 'Odottaa kentässä · lähtee itse heti, kun olet kirjautunut.';
  if (d === R2) return edited ? 'Muokattu · kirjautumisen jälkeen kysytään, lähetetäänkö se.' : 'Odottaa kentässä · kirjautumisen jälkeen kysytään, lähetetäänkö se.';
  return edited ? 'Muokattu · ei lähde itse. Paina Lähetä, niin se lähtee kirjautumisen jälkeen.' : 'Odottaa kentässä · lähtee itse kirjautumisen jälkeen, jos et muokkaa sitä.';
}

/** The story's state at step k, as if the person had done steps 1..k. */
function story(d: number, k: number): {st: State; ok: boolean; at: string; win: boolean} {
  const st = empty();
  if (k >= 1) { st.drafts.tunnit = EDITED; st.edited.tunnit = true; }
  if (k >= 2) { st.drafts.kesa = SECOND; st.waiting.kesa = true; }
  const ok = k >= 4;
  if (k === 4) {
    if (d === R2) { st.ask = ['tunnit', 'kesa']; st.pick = {tunnit: true, kesa: true}; }
    else {
      for (const id of ['tunnit', 'kesa'] as const) {
        if (!armed(d, st, id)) { st.after[id] = keptLine(d); continue; }
        st.posts[id] = [{text: st.drafts[id], state: 'sending'}]; st.drafts[id] = ''; st.after[id] = goneLine;
      }
      st.waiting = {};
    }
  }
  if (k >= 5) {
    st.posts = {tunnit: [{text: EDITED, state: 'answered'}], kesa: [{text: SECOND, state: 'answered'}]};
    st.drafts = {}; st.waiting = {}; st.after = {tunnit: goneLine, kesa: goneLine};
  }
  return {st, ok, at: k === 2 || k === 6 ? 'kesa' : 'tunnit', win: k === 3 || (k === 4 && d === R2)};
}
const href = (id: string) => `/workspaces/${byId.get(id)!.ws}?conversation=${id}`;

// ---- The window: Claude's sign-in, the waiting messages and what happens to them ----
function ClaudeSteps({onDone, onCancel}: {onDone: () => void; onCancel: () => void}) {
  const [code, setCode] = useState('');
  const [waiting, setWaiting] = useState(false);
  useExternal((h) => { if (h.startsWith('https://claude.com')) setCode(CLAUDE_CODE); });
  return (
    <div className="rq-signin" data-testid="sign-in-here">
      <SignInSteps>
        <SignInStep number={1} title={claudeTxt.step1}>
          <ExternalLink data-testid="claude-sign-in-link" href="https://claude.com/cai/oauth/authorize?code=true&client_id=prototype" target="_blank" rel="noopener noreferrer">
            {claudeTxt.openNewTab}
          </ExternalLink>
        </SignInStep>
        {!waiting ? (
          <SignInStep number={2} title={claudeTxt.step2}>
            <form className="ah-inline-field" onSubmit={(e) => {
              e.preventDefault();
              setWaiting(true); setCode('');
              setTimeout(() => { repair(); onDone(); }, 1100);
            }}>
              <input type="password" data-testid="claude-code-input" aria-label={claudeTxt.codeLabel} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
              <ControlButton data-testid="claude-code-confirm" size="row" variant="primary" type="submit" isDisabled={code.trim().length < 8}>
                {claudeTxt.confirmCode}
              </ControlButton>
            </form>
          </SignInStep>
        ) : (
          <SignInStep number={2} title={claudeTxt.waitStep} status>
            <StatusMark label={claudeTxt.waiting} tone="info" animated="running" />
          </SignInStep>
        )}
      </SignInSteps>
      <div className="rq-signin-foot">
        <p className="ah-sign-in-hint">{claudeTxt.ownPage}</p>
        <Button data-testid="sign-in-cancel" label="Peruuta" variant="quiet" size="row" onPress={onCancel} />
      </div>
    </div>
  );
}

/** The waiting messages as the window lists them before the sign-in. */
function Waiting({d, st}: {d: number; st: State}) {
  const ids = CONVS.filter((c) => c.claude && st.waiting[c.id] && st.drafts[c.id]?.trim()).map((c) => c.id);
  if (!ids.length) return <p className="s-desc">Kentissä ei ole odottavia viestejä.</p>;
  const fate = (id: string) => d === R2 ? 'kysytään' : armed(d, st, id) ? 'lähtee' : 'jää kenttään';
  const head = d === R1 ? 'Kun kirjautuminen on valmis, nämä viestit lähtevät heti:'
    : d === R2 ? 'Kun kirjautuminen on valmis, sinulta kysytään, mitkä näistä lähtevät:'
    : 'Kun kirjautuminen on valmis, koskemattomat viestit lähtevät; muokatut jäävät kenttään:';
  return (
    <div className="rq-queue" data-testid="window-waiting">
      <p className="s-desc">{head}</p>
      <ul>
        {ids.map((id) => (
          <li key={id} data-conv={id} data-fate={fate(id)}>
            <span className="rq-queue-title">{byId.get(id)!.title}{st.edited[id] ? <span className="rq-queue-edited"> · muokattu</span> : null}</span>
            <span className="rq-queue-text">{st.drafts[id]}</span>
            <span className={`rq-queue-fate${fate(id) === 'jää kenttään' ? ' is-kept' : ''}`}>{fate(id)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignInWindow({d, st, open, onClose, onSendPicked, onKeepAll, onPick}: {
  d: number; st: State; open: boolean; onClose: () => void; onSendPicked: () => void; onKeepAll: () => void; onPick: (id: string, v: boolean) => void;
}) {
  const asking = st.ask.length > 0;
  const picked = st.ask.filter((id) => st.pick[id]).length;
  return (
    <ModalOverlay className="ah-overlay" isOpen={open} onOpenChange={(o) => { if (!o) { if (asking) onKeepAll(); else onClose(); } }} isDismissable>
      <Modal className="ah-modal rq-signin-modal">
        <AriaDialog className="ah-dialog" data-testid="sign-in-window" data-asking={asking ? 'true' : undefined} aria-label={asking ? S.done : 'Kirjaudu Claudeen'}>
          {asking ? (
            <>
              <Heading slot="title">{S.done}</Heading>
              <p className="s-desc">Nämä viestit odottivat kirjautumista. Valitse, mitkä lähtevät nyt; muut jäävät kenttiinsä.</p>
              <div className="rq-ask" data-testid="ask-list">
                {st.ask.map((id) => (
                  <Checkbox key={id} data-testid={`ask-${id}`} checked={!!st.pick[id]} onChange={(v) => onPick(id, v)}
                    label={`${byId.get(id)!.title}${st.edited[id] ? ' · muokattu' : ''}`} hint={st.drafts[id]} />
                ))}
              </div>
              <div className="ah-dialog-actions">
                <ControlButton data-testid="ask-keep" size="row" onPress={onKeepAll}>Jätä kenttiin</ControlButton>
                <ControlButton data-testid="ask-send" size="row" variant="primary" isDisabled={!picked} onPress={onSendPicked}>
                  {picked === st.ask.length && picked > 1 ? 'Lähetä molemmat' : 'Lähetä valitut'}
                </ControlButton>
              </div>
            </>
          ) : (
            <>
              <Heading slot="title">Kirjaudu Claudeen</Heading>
              <Waiting d={d} st={st} />
              <ClaudeSteps onDone={noop} onCancel={onClose} />
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function render(item: Item) {
  const content = item.kind === 'user'
    ? <UserMessage sourceText={item.text} onCopy={noop} time={item.time}><Markdown text={item.text} /></UserMessage>
    : <AssistantMessage streamState={item.state} time={item.time} onCopy={noop}>{item.node ?? <Markdown text={item.text} />}</AssistantMessage>;
  return {id: item.id, kind: item.kind, content: <div data-item={item.id}>{content}</div>};
}

function Main({d, step}: {d: number; step: number}) {
  const start = useRef(story(d, step)).current;
  const h = useHost();
  const [st, set] = useState(start.st);
  const [win, setWin] = useState(start.win);
  const location = useLocation();
  const navigate = useNavigate();
  const current = new URLSearchParams(location.search).get('conversation') ?? 'tunnit';
  const conv = byId.get(current)!;
  const down = !h.ok;

  // Back online: what each riff does with the waiting messages.
  const latest = useRef(st);
  latest.current = st;
  const wasDown = useRef(down);
  useEffect(() => {
    if (wasDown.current && !down) {
      const x = latest.current;
      const ids = Object.keys(x.waiting).filter((id) => x.waiting[id] && x.drafts[id]?.trim());
      if (d === R2 && ids.length) {
        set({...x, waiting: {}, ask: ids, pick: Object.fromEntries(ids.map((id) => [id, true]))});
        setWin(true);
      } else {
        const next = {...x, waiting: {}, drafts: {...x.drafts}, posts: {...x.posts}, after: {...x.after}};
        for (const id of ids) {
          if (!armed(d, x, id)) { next.after[id] = keptLine(d); continue; }
          next.posts[id] = [...(next.posts[id] ?? []), {text: x.drafts[id], state: 'sending'}];
          next.drafts[id] = ''; next.after[id] = goneLine;
        }
        set(next);
        setWin(false);
      }
    }
    wasDown.current = down;
  });
  // A sent message is answered a moment later, wherever the person is.
  const anySending = Object.values(st.posts).some((p) => p.some((x) => x.state === 'sending'));
  useEffect(() => {
    if (!anySending) return;
    const t = setTimeout(() => set((x) => ({...x, posts: Object.fromEntries(Object.entries(x.posts).map(([k, p]) => [k, p.map((y) => ({...y, state: 'answered' as const}))]))})), 1400);
    return () => clearTimeout(t);
  }, [anySending]);

  const post = (x: State, id: string, text: string): State => ({
    ...x, drafts: {...x.drafts, [id]: ''}, waiting: {...x.waiting, [id]: false}, edited: {...x.edited, [id]: false},
    posts: {...x.posts, [id]: [...(x.posts[id] ?? []), {text, state: 'sending'}]},
  });
  const send = (text: string) => {
    if (!text.trim()) return;
    // While Claude refuses, a send stays in the field and waits, untouched.
    if (down && conv.claude) { set((x) => ({...x, drafts: {...x.drafts, [current]: text}, waiting: {...x.waiting, [current]: true}, edited: {...x.edited, [current]: false}})); return; }
    set((x) => ({...post(x, current, text), after: {...x.after, [current]: ''}}));
  };
  const setDraft = (v: string) => set((x) => {
    const was = x.waiting[current];
    return {...x, drafts: {...x.drafts, [current]: v},
      waiting: {...x.waiting, [current]: was && !!v.trim()},
      edited: {...x.edited, [current]: !!(was && v !== x.drafts[current]) || !!x.edited[current]}};
  });
  const sendPicked = () => {
    set((x) => {
      let next: State = {...x, ask: [], pick: {}, after: {...x.after}};
      for (const id of x.ask) {
        if (x.pick[id]) { next = post(next, id, x.drafts[id]); next.after[id] = goneLine; }
        else next.after[id] = keptLine(R2);
      }
      return next;
    });
    setWin(false);
  };
  const keepAll = () => {
    set((x) => ({...x, after: {...x.after, ...Object.fromEntries(x.ask.map((id) => [id, keptLine(R2)]))}, ask: [], pick: {}}));
    setWin(false);
  };

  // ---- The timeline ----
  const items: Item[] = [...conv.history];
  if (current === 'tunnit') {
    items.push(u('t3', '9.38', MESSAGE));
    items.push({id: 't4', kind: 'assistant', time: '9.38', text: '', state: 'failed',
      node: <p className="rq-turn-short" data-testid="turn-short">{`${S.title}. Viestiäsi ei käsitelty.`}</p>});
  }
  (st.posts[current] ?? []).forEach((p, i) => {
    items.push(u(`p${i}`, '9.44', p.text));
    items.push(p.state === 'sending'
      ? {id: `pa${i}`, kind: 'assistant', time: '', text: 'Työssä…', state: 'streaming'}
      : {id: `pa${i}`, kind: 'assistant', time: '9.44', text: conv.answer, state: 'complete'});
  });
  const sendingIn = (id: string) => (st.posts[id] ?? []).some((p) => p.state === 'sending');
  const working = current === 'svg' || sendingIn(current);
  const draft = st.drafts[current] ?? '';
  const waitingHere = down && !!st.waiting[current] && !!draft.trim();

  // ---- The line above the field ----
  const goFix = () => setWin(true);
  let notice: React.ReactNode = null;
  if (down && conv.claude)
    notice = (
      <WarningBanner data-testid="ai-sign-in-warning" tone="danger" icon="warning" title={S.title} short={S.short}
        actions={<ControlButton data-testid="ai-sign-in-fix" size="row" variant="primary" onPress={goFix}>Kirjaudu uudelleen</ControlButton>}>
        {S.cause}
      </WarningBanner>
    );
  else if (!down && st.after[current])
    notice = <WarningBanner data-testid="ai-sign-in-ok" data-state={st.after[current] === goneLine ? 'sent' : 'kept'} tone={st.after[current] === goneLine ? 'success' : 'neutral'}>{st.after[current]}</WarningBanner>;

  const bell: StatusItem[] = down ? [{
    key: 'ai-sign-in', tone: 'danger', icon: 'warning', group: 'own', short: 'Claude poikki', title: S.title, meta: S.short,
    body: S.cause, actions: [{label: 'Kirjaudu uudelleen', testId: 'status-ai-fix', primary: true, onPress: goFix}],
  }] : [];

  // ---- Rail ----
  type Kind = 'working' | 'held' | 'draft' | 'done';
  const kindOf = (c: Conv): Kind => {
    if (c.id === 'svg' || sendingIn(c.id)) return 'working';
    if (down && (st.waiting[c.id] || c.id === 'tunnit')) return 'held';
    if (st.drafts[c.id]?.trim() && (st.after[c.id] || st.ask.includes(c.id))) return 'draft';
    return 'done';
  };
  const labelOf = (k: Kind) => k === 'working' ? 'Työssä' : k === 'held' ? 'Viesti odottaa kirjautumista' : k === 'draft' ? 'Viesti kentässä, ei lähetetty' : 'Odottaa viestiä';
  const now = Date.now();
  const model = (c: Conv): AgentNavModel => {
    const k = kindOf(c);
    return {
      agentId: c.id, href: href(c.id), title: c.title, workspaceId: c.ws, workspaceName: c.wsName,
      changedAt: T0 - c.ago * 60000, activity: k === 'working' ? 'working' : 'waiting', activityLabel: labelOf(k), controlLabel: '',
      failed: k === 'held' ? true : undefined, detail: [c.wsName, labelOf(k)].join(' · '), selected: current === c.id,
    };
  };
  const place = (c: Conv) => { const k = kindOf(c); return k === 'working' ? 'running' : k === 'held' || k === 'draft' ? 'yours' : 'quiet'; };
  const rowsIn = (p: string) => CONVS.filter((c) => place(c) === p);
  const row = (c: Conv) => <AgentNavItem key={c.id} {...model(c)} now={now} />;
  const yours = rowsIn('yours'), running = rowsIn('running'), quiet = rowsIn('quiet');
  const groups = [...new Set(running.map((c) => c.wsName))].sort();
  const attention = (ws: string) => yours.filter((c) => c.ws === ws).length;
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Synteettinen" connectionLabel="Yhdistetty" connectionTone="success"
      filterValue="" resultSummary="3 työtilaa" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf name="Jari Mustonen" onSettings={noop} onLogout={noop} />}
      now={
        <>
          <section className="ah-now" data-testid="rail-yours" aria-labelledby="ra-yours">
            <h2 className="ah-rail-section-head" id="ra-yours">Sinun vuorosi{yours.length ? <span className="ah-rail-count ah-rail-count-attention">{yours.length}</span> : null}</h2>
            {yours.length ? <ul>{yours.map(row)}</ul> : <p className="ah-now-empty">Mikään ei odota sinua.</p>}
          </section>
          <section className="ah-now" data-testid="rail-running" aria-labelledby="ra-running">
            <h2 className="ah-rail-section-head" id="ra-running">Käynnissä{running.length ? <span className="ah-rail-count">{running.length}</span> : null}</h2>
            {groups.map((g) => (
              // biome-ignore lint/a11y/useSemanticElements: a list group.
              <div key={g} className="ah-now-group" role="group">
                <h3 className="ah-now-group-head"><span className="ah-now-group-name">{g}</span><span className="ah-rail-count">{running.filter((c) => c.wsName === g).length}</span></h3>
                <ul>{running.filter((c) => c.wsName === g).map(row)}</ul>
              </div>
            ))}
          </section>
          <section className="ah-now ah-quiet" data-testid="rail-quiet" aria-labelledby="ra-quiet">
            <h2 className="ah-rail-section-head ah-quiet-head">
              <button type="button" className="ah-quiet-fold" aria-expanded="true">
                <Icon name="down" className="ah-quiet-chevron" aria-hidden="true" />
                <span id="ra-quiet">Hiljaiset</span><span className="ah-rail-count">{quiet.length}</span>
              </button>
            </h2>
            <ul>{quiet.map(row)}</ul>
          </section>
        </>
      }>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" hint={attention('ws_a') ? {kind: 'attention', count: attention('ws_a'), text: `${attention('ws_a')} odottaa sinua`} : {kind: 'working', count: 1, text: '1 työssä'}} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
      <WorkspaceNavRow name="muistiinpanot" href="/workspaces/ws_m" hint={attention('ws_m') ? {kind: 'attention', count: attention('ws_m'), text: `${attention('ws_m')} odottaa sinua`} : undefined} />
    </WorkspaceRail>
  );

  // The waiting line sits where the composer's own reason line would, as
  // the composer's last row, so it shares the field's column.
  const [composerEl, setComposerEl] = useState<Element | null>(null);
  useLayoutEffect(() => { setComposerEl(document.querySelector('.rq-composer .ah-composer')); });
  const edited = !!st.edited[current];
  const main = (
    <div className="ah-state rq-main">
      <ConversationFrame>
        <AgentHeader title={conv.title} workspaceLabel={conv.wsName} workspaceHref={`/workspaces/${conv.ws}`}
          activityLabel={working ? 'Työssä' : ''} activityAnimated={working} activityKind={working ? 'working' : 'neutral'}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop} rename={{onSave: async () => {}}} />
        <ConversationStream>
          <ConversationTimeline key={current} state="ready" items={items.map(render)} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
        </ConversationStream>
        <div className="ah-actionable-notices">{notice}</div>
        <div className="rq-composer" data-testid="rq-composer">
          <Composer value={draft} onChange={setDraft} activity={working ? 'working' : 'idle'} selectedWorkingMode="steer"
            onModeChange={noop} onSendNow={(t) => send(t ?? draft)} onSteer={(t) => send(t ?? draft)} onFollowUp={(t) => send(t ?? draft)}
            onInterrupt={noop} sources={sources} csrf="prototype"
            modelPicker={<button type="button" className="md-pill">{conv.claude ? S.model : 'GPT-6 Astra · medium'}</button>} />
          {waitingHere && composerEl ? createPortal(
            <p className={`ah-control-reason ah-composer-reason rq-wait${d === R3 && edited ? ' is-kept' : ''}`} data-testid="composer-waiting" data-edited={edited ? 'true' : undefined} role="status">
              <Icon name="clock" width={13} height={13} />{waitLine(d, edited)}
            </p>, composerEl) : null}
        </div>
      </ConversationFrame>
      <SignInWindow d={d} st={st} open={win} onClose={() => setWin(false)} onSendPicked={sendPicked} onKeepAll={keepAll}
        onPick={(id, v) => set((x) => ({...x, pick: {...x.pick, [id]: v}}))} />
    </div>
  );
  return (
    <StatusBellProvider items={bell}>
      <AppShell mobileTitle={conv.title} navigationBadge={yours.length} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

let reviewTheme = 'light';

function App({d}: {d: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [step, setStep] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [toast, setToast] = useState('');
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useExternal((h) => { if (h.startsWith('https://claude.com')) setToast(`Clauden sivu avautuisi uuteen välilehteen. Kirjautumisen jälkeen se antaa koodin: ${CLAUDE_CODE}`); });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6000); return () => clearTimeout(t); }, [toast]);
  // Each step is a fresh start in the state the story has reached there, so
  // stepping back and forth always shows the same picture; from any step the
  // view stays interactive.
  const go = (k: number) => {
    const s = story(d, k);
    host.ok = s.ok;
    setStep(k); setToast(''); setGeneration((g) => g + 1);
  };
  const s = story(d, step);
  return (
    <div className={`rq-review variant-${d}`} data-direction={d} data-step={step}>
      {/* The review bar stays usable while the window is open: react-aria leaves
          a top-layer element outside the modal's inert. */}
      <header className="rq-bar" ref={bar} data-react-aria-top-layer="true">
        <strong>Tekoälyn kirjautuminen vanhentui · kierros 3</strong>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value; setTheme(reviewTheme); }}>
          <option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
        <button type="button" data-testid="rq-reset" onClick={() => go(0)}>Alusta</button>
        <p className="rq-round" data-testid="round-line">{ROUND_LINE}</p>
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === d ? 'true' : undefined}>{l}</li>)}
        </ol>
        <nav className="rq-story" aria-label="Tarinan vaiheet" data-testid="story">
          <button type="button" data-testid="story-prev" disabled={step === 0} onClick={() => go(step - 1)} aria-label="Edellinen vaihe">←</button>
          <ol>
            {STEPS.map((t, i) => (
              <li key={t}><button type="button" data-testid={`story-${i + 1}`} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
                <span className="rq-story-n">{i + 1}</span><span className="rq-story-t">{t}</span></button></li>
            ))}
          </ol>
          <button type="button" data-testid="story-next" disabled={step === STEPS.length - 1} onClick={() => go(step + 1)} aria-label="Seuraava vaihe">→</button>
          <p className="rq-story-caption" data-testid="story-caption"><strong>{step + 1}/{STEPS.length}</strong> {CAPTIONS[step][d]}</p>
        </nav>
      </header>
      <div className="rq-stage">
        <MemoryRouter key={generation} initialEntries={[href(s.at)]}>
          <Main d={d} step={step} />
        </MemoryRouter>
      </div>
      {toast ? <p className="rq-toast" role="status" data-testid="rq-toast">{toast}</p> : null}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: React.ReactNode) { host.ok = false; flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, d) => () => <App key={d} d={d} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants'); picker.dataset.reactAriaTopLayer = 'true';
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
