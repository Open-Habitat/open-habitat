import {type ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {Dialog, Heading, Modal, ModalOverlay} from 'react-aria-components';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/ReplyQuote.css';
import {AssistantMessage, Composer, ConversationTimeline, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Icon} from '../../../../web/src/components/Icon';
import {LoginCard} from '../../../../web/src/components/LoginCard';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader, AgentNavItem, AppShell, WorkspaceNavRow, WorkspaceRail} from '../../../../web/src/components/Navigation';
import {Menu} from '../../../../web/src/components/Overlays';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {WarningBanner} from '../../../../web/src/components/WarningBanner';
import {PiModelsProvider} from '../../../../web/src/app/PiModels';
import {setPersonalLanguage} from '../../../../web/src/i18n';
import './round.css';

// conversation-links-prefilled-draft, round 1 (Jari 27.11.2026): a link in
// a chat message opens Habitat with a new conversation in a named workspace,
// or an existing conversation addressed by a stable name, and a prepared
// message in the composer. Nothing is sent by the click. The axis is how the
// link's message arrives:
//   A Merkitty kenttä   straight in; the message is in the field, its first
//                       row says it came from a link (and whom the link
//                       claims as its source).
//   B Vahvistus         a sheet before anything opens: where the link goes
//                       and what it would put in the field.
//   C Ehdotus           the field stays the person's own; the message
//                       waits above it as a card until moved in.
// Production, unchanged: AppShell, WorkspaceRail, WorkspaceNavRow,
// AgentNavItem, AgentHeader, ConversationFrame, ConversationTimeline,
// UserMessage, AssistantMessage, Composer (fieldQuote and beforeField
// slots), WarningBanner, LoginCard, Menu, ControlButton and Icon. The
// round's own: the link mark and the link card (production's reply-quote
// classes), the B sheet, the missing-workspace page, the menu's extra item
// (production's Menu, placed over the header's own trigger) and the link
// dialog. No network, no navigation.

setPersonalLanguage('fi');
const noop = () => {};
const NAMES = ['A Merkitty kenttä', 'B Vahvistus', 'C Ehdotus'];
const LINES = [
  'A Merkitty kenttä: keskustelu avautuu heti ja viesti on kentässä. Kentän ensimmäinen rivi kertoo, että viesti tuli linkistä ja kenen linkki sanoo lähettäneen sen.',
  'B Vahvistus: ennen avaamista arkki näyttää, minne linkki vie ja mitä se kirjoittaisi kenttään. Avaa ja lisää viesti, avaa ilman viestiä tai peru.',
  'C Ehdotus: kenttä pysyy omanasi. Linkin viesti odottaa kortissa kentän yllä, kunnes siirrät sen kenttään tai hylkäät.',
];
const RECOMMEND = 'Suositus: A. Yksi painallus vähemmän kuin B:ssä, ja merkki pitää lähteen näkyvissä lähettämiseen asti. Kun kentässä on jo oma luonnos, A ja B käyttävät C:n korttia, joten mitään ei kirjoiteta yli.';

// ---------- Synthetic host ----------
const ORIGIN = 'https://habitat.example';
const DRAFT = 'Yöajo 27.11. epäonnistui vaiheessa `npm test` (3 testiä punaisena, loki `logs/yoajo-2711.txt`). Selvitä syy ja ehdota korjaus, mutta älä vielä commitoi.';
const OWN = 'Katso vielä, miksi välimuistin avain vaihtuu joka ajossa –';
const FROM = 'yoajo-botti';
const LIMIT = 4000;
const LONG = 12480;
const WS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
const CONV = {title: 'Yöajojen valvonta', name: 'yoajot', ws: 'kotisivu'};
const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
/** The message rides in the fragment, which the browser never sends to the
 * host or puts in a Referer; `n` is its length, so a link a chat app cut
 * short is refused rather than shown in part. */
const frag = (draft: string, from: string) => `#${from ? `from=${enc(from)}&` : ''}n=${[...draft].length}&draft=${enc(draft)}`;
const linkNew = (ws: string, draft = DRAFT, from = FROM) => `${ORIGIN}/new/${ws}${frag(draft, from)}`;
const linkConv = (ws: string, name: string, draft = DRAFT, from = FROM) => `${ORIGIN}/c/${ws}/${name}${frag(draft, from)}`;

type Target = 'new' | 'conv';
type Scenario = {
  label: string; target: Target; ws: string; link: string;
  own?: boolean; working?: boolean; hidden?: boolean; missingWs?: boolean;
  archived?: boolean; missingConv?: boolean; signin?: boolean; tooLong?: boolean; make?: boolean;
};
const SCENARIOS = {
  uusi: {label: 'Uusi keskustelu työtilaan', target: 'new', ws: 'kotisivu', link: linkNew('kotisivu')},
  nimetty: {label: 'Nimetty keskustelu', target: 'conv', ws: 'kotisivu', link: linkConv('kotisivu', 'yoajot')},
  luonnos: {label: 'Nimetty, kentässä oma luonnos', target: 'conv', ws: 'kotisivu', link: linkConv('kotisivu', 'yoajot'), own: true},
  kesken: {label: 'Nimetty, agentti kesken vuoron', target: 'conv', ws: 'kotisivu', link: linkConv('kotisivu', 'yoajot'), working: true},
  piilotettu: {label: 'Työtila arkistoitu', target: 'new', ws: 'vanha-sivusto', link: linkNew('vanha-sivusto'), hidden: true},
  eityotilaa: {label: 'Työtilaa ei löydy', target: 'new', ws: 'asiakasportaali', link: linkNew('asiakasportaali'), missingWs: true},
  arkistoitu: {label: 'Keskustelu arkistoitu', target: 'conv', ws: 'kotisivu', link: linkConv('kotisivu', 'yoajot'), archived: true},
  eikeskustelua: {label: 'Keskustelua ei löydy', target: 'conv', ws: 'kotisivu', link: linkConv('kotisivu', 'deploy-valvonta'), missingConv: true},
  kirjaudu: {label: 'Ei kirjautunut', target: 'new', ws: 'kotisivu', link: linkNew('kotisivu'), signin: true},
  pitka: {label: 'Linkki liian pitkä', target: 'new', ws: 'kotisivu', link: `${ORIGIN}/new/kotisivu#from=${FROM}&n=${LONG}&draft=Analysoi+seuraava+loki…`, tooLong: true},
  tee: {label: 'Linkin tekeminen (valikosta)', target: 'conv', ws: 'kotisivu', link: '', make: true},
} satisfies Record<string, Scenario>;
type SId = keyof typeof SCENARIOS;
const SIDS = Object.keys(SCENARIOS) as SId[];
const param = new URLSearchParams(location.search);
let initialScenario: SId = (param.get('s') as SId) in SCENARIOS ? param.get('s') as SId : 'uusi';
const themeParam = param.get('theme');
let reviewTheme = themeParam === 'dark' || themeParam === 'contrast' ? themeParam : 'light';
let toast: (s: string) => void = () => {};

const at = (s: string) => Date.parse(`2026-11-${s}+02:00`);
const NOW = at('27T07:42:00');

// ---------- The link's message: mark, card, sheet ----------

/** Who the link says it is from. The host cannot verify it, so it is said
 * as the link's claim, never as a sender. */
const claim = (from?: string) => from ? <>linkin mukaan <code>{from}</code></> : <>lähde ei tiedossa</>;

/** A, and B after the sheet: the field's first row (production's reply-quote
 * classes, as a quote is "text from elsewhere" there too). */
function LinkMark({working, onRemove}: {working?: boolean; onRemove: () => void}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled row with one control, as production's quote.
    <div className="ah-reply-quote cl-mark" role="group" aria-label="Viesti linkistä" data-testid="link-mark">
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>Viesti linkistä · {claim(FROM)}</span>
        <span className="ah-reply-quote-tools">
          <ControlButton data-testid="link-remove" aria-label="Poista linkin viesti" variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
      <p className="cl-mark-note">Lue ennen lähettämistä. Mitään ei ole lähetetty.{working ? ' Agentti on kesken vuoron: viesti lähtee sen jälkeen, kuten kentän tila sanoo.' : ''}</p>
    </div>
  );
}

/** C, and A/B when the field already holds the person's own draft: the
 * message waits above the field. */
function LinkCard({occupied, onPlace, onAppend, onDismiss}: {occupied: boolean; onPlace: () => void; onAppend: () => void; onDismiss: () => void}) {
  return (
    <section className="ah-reply-quote cl-card" aria-label="Linkin ehdottama viesti" data-testid="link-card">
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>Linkin ehdottama viesti · {claim(FROM)}</span>
      </div>
      {occupied ? <p className="cl-mark-note">Kentässä on keskeneräinen viestisi, joten linkin viesti ei korvannut sitä.</p> : null}
      <blockquote className="cl-card-text" data-testid="link-card-text"><Markdown text={DRAFT} /></blockquote>
      <div className="cl-card-actions">
        {occupied ? (
          <>
            <ControlButton data-testid="link-append" size="row" variant="secondary" onPress={onAppend}>Lisää viestisi perään</ControlButton>
            <ControlButton data-testid="link-replace" size="row" variant="quiet" onPress={onPlace}>Korvaa</ControlButton>
          </>
        ) : (
          <ControlButton data-testid="link-place" size="row" variant="secondary" onPress={onPlace}>Siirrä kenttään</ControlButton>
        )}
        <ControlButton data-testid="link-dismiss" size="row" variant="quiet" onPress={onDismiss}>Hylkää</ControlButton>
      </div>
    </section>
  );
}

function ConfirmSheet({s, onOpen, onPlain, onCancel}: {s: Scenario; onOpen: () => void; onPlain: () => void; onCancel: () => void}) {
  return (
    <ModalOverlay className="cl-overlay" isOpen isDismissable={false}>
      <Modal className="cl-modal cl-sheet">
        <Dialog className="cl-dialog" data-testid="confirm-sheet" aria-labelledby="cl-confirm-title">
          <Heading slot="title" id="cl-confirm-title">Avataanko linkki?</Heading>
          <dl className="cl-facts">
            <dt>Avautuu</dt>
            <dd>{s.target === 'new' ? <>Uusi keskustelu työtilassa <code>{s.ws}</code></> : <>Keskustelu <b>{CONV.title}</b> (<code>{CONV.name}</code>) työtilassa <code>{s.ws}</code></>}</dd>
            <dt>Lähde</dt>
            <dd>{claim(FROM)}. Habitat ei voi varmistaa linkin tekijää.</dd>
          </dl>
          <p className="cl-sheet-label">Viesti, joka tulee kenttään</p>
          <blockquote className="cl-card-text"><Markdown text={DRAFT} /></blockquote>
          <p className="cl-mark-note">Mitään ei lähetetä. Viesti lähtee vasta, kun painat Lähetä keskustelussa.</p>
          <div className="cl-dialog-actions">
            <ControlButton data-testid="confirm-open" size="page" variant="primary" onPress={onOpen}>Avaa ja lisää viesti</ControlButton>
            <ControlButton data-testid="confirm-plain" size="page" variant="secondary" onPress={onPlain}>Avaa ilman viestiä</ControlButton>
            <ControlButton data-testid="confirm-cancel" size="page" variant="quiet" onPress={onCancel}>Peru</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- Making a link ----------

function LinkDialog({onClose}: {onClose: () => void}) {
  const [kind, setKind] = useState<Target>('conv');
  const [text, setText] = useState('Katso yöajon tulos ja kerro, voiko julkaisun tehdä tänään.');
  const [from, setFrom] = useState('');
  const n = [...text].length;
  const over = n > LIMIT;
  const url = kind === 'conv' ? linkConv(CONV.ws, CONV.name, text, from) : linkNew(CONV.ws, text, from);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* the review page may not have the clipboard */ }
    toast('Linkki kopioitu. Se avaa luonnoksen vain kirjautuneelle omistajalle omassa Habitatissaan.');
    onClose();
  };
  return (
    <ModalOverlay className="cl-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="cl-modal">
        <Dialog className="cl-dialog" data-testid="link-dialog" aria-labelledby="cl-link-title">
          <Heading slot="title" id="cl-link-title">Linkki, joka avaa keskustelun viestillä</Heading>
          <fieldset className="cl-kind">
            <legend>Linkki avaa</legend>
            <label><input type="radio" name="cl-kind" checked={kind === 'conv'} onChange={() => setKind('conv')} data-testid="kind-conv" />
              Tämän keskustelun <code>{CONV.name}</code></label>
            <label><input type="radio" name="cl-kind" checked={kind === 'new'} onChange={() => setKind('new')} data-testid="kind-new" />
              Uuden keskustelun työtilassa <code>{CONV.ws}</code></label>
          </fieldset>
          <p className="cl-mark-note">Nimi <code>{CONV.name}</code> on keskustelun pysyvä nimi linkeissä. Nimen vaihto katkaisee vanhat linkit.</p>
          <label className="cl-field">Viesti kenttään
            <textarea data-testid="link-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={over || undefined} aria-describedby="cl-count" />
          </label>
          <p id="cl-count" className="cl-count" data-over={over || undefined}>{n.toLocaleString('fi-FI')} / {LIMIT.toLocaleString('fi-FI')} merkkiä{over ? ' – liian pitkä linkkiin' : ''}</p>
          <label className="cl-field">Lähde (vapaaehtoinen, näkyy avaajalle linkin omana tietona)
            <input data-testid="link-from" value={from} placeholder="esim. viikkokatsaus" onChange={(e) => setFrom(e.target.value)} />
          </label>
          <p className="cl-sheet-label">Linkki</p>
          <code className="cl-url" data-testid="link-url">{url}</code>
          <div className="cl-dialog-actions">
            <ControlButton data-testid="link-copy" size="page" variant="primary" isDisabled={over || !text.trim()} onPress={copy}><Icon name="copy" />Kopioi linkki</ControlButton>
            <ControlButton data-testid="link-close" size="page" variant="quiet" onPress={onClose}>Sulje</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Production's header menu has no slot for another item: the round hides
 * its trigger and places production's Menu, with the same two items and
 * the link item, in the same spot. On a desktop production shows ⋯ only
 * once the row shortens; the round shows it always (round.css), since the
 * link item has no icon of its own in the row. */
function HeaderMenu({onLink}: {onLink: () => void}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // The phone header draws its own trigger too: take the visible one's place.
    const own = [...document.querySelectorAll<HTMLElement>('[data-testid="conversation-menu"]')];
    const place = own.find((b) => b.offsetParent) ?? own[0];
    own.forEach((b) => { b.style.display = 'none'; });
    if (place?.parentElement) setHost(place.parentElement);
  }, []);
  if (!host) return null;
  const items = [
    {id: 'rename', label: 'Nimeä uudelleen'},
    {id: 'link', label: 'Kopioi linkki, joka avaa tämän keskustelun viestillä…', icon: <Icon name="link" />},
    {id: 'archive', label: 'Arkistoi'},
  ];
  return createPortal(
    <Menu label="Keskustelun toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="ah-header-more cl-more"
      triggerTestId="round-conversation-menu" placement="bottom end" items={items}
      onAction={(id) => { if (id === 'link') setTimeout(onLink); else toast('Ei tässä vedoksessa.'); }} />,
    host,
  );
}

// ---------- The views ----------

type Arrival = {field: string; link: 'mark' | 'card' | 'none'; sheet: boolean};
function arrivalOf(d: number, s: Scenario): Arrival {
  const own = s.own ? OWN : '';
  if (s.tooLong || s.make || s.missingWs) return {field: own, link: 'none', sheet: false};
  if (d === 1) return {field: own, link: 'none', sheet: true};
  if (d === 2 || s.own) return {field: own, link: 'card', sheet: false};
  return {field: DRAFT, link: 'mark', sheet: false};
}

const MODEL = <ControlButton size="inline" variant="quiet" className="cl-model" data-testid="model-default" onPress={() => toast('Mallin valinta ei ole tässä vedoksessa.')}>oletusmalli</ControlButton>;

function History() {
  return [
    {id: 'u0', content: <UserMessage sourceText="" time="eilen 21.04" onCopy={noop}><Markdown text="Seuraa yöajoja ja kerro aamulla, jos jokin meni rikki." /></UserMessage>},
    {id: 'a0', content: <AssistantMessage time="eilen 21.05" streamState="complete" onCopy={noop}><Markdown text="Selvä. Katson ajon tuloksen joka aamu ja kirjoitan tähän, jos jokin vaihe epäonnistuu." /></AssistantMessage>},
  ];
}

function ConversationView({d, s, onScenario}: {d: number; s: Scenario; onScenario: (id: SId, ws?: string) => void}) {
  const first = arrivalOf(d, s);
  const [field, setField] = useState(first.field);
  const [link, setLink] = useState(first.link);
  const [sheet, setSheet] = useState(first.sheet);
  const [sent, setSent] = useState<{text: string; linked: boolean}[]>([]);
  const [archived, setArchived] = useState(!!s.archived);
  const [making, setMaking] = useState(!!s.make);
  const isNew = s.target === 'new' || s.missingConv;
  const existing = !isNew;
  const placeFromSheet = () => { setSheet(false); if (s.own) setLink('card'); else { setField(DRAFT); setLink('mark'); } };
  const send = (text?: string) => {
    const t = (text ?? field).trim();
    if (!t) return;
    setSent((x) => [...x, {text: t, linked: link === 'mark'}]);
    setField(''); setLink('none');
  };
  const items = [
    ...(existing ? History() : []),
    ...sent.map((m, i) => ({id: `s${i}`, content: <UserMessage sourceText={m.text} time="7.42" delivery="pending" onCopy={noop}><Markdown text={m.text} /></UserMessage>})),
  ];
  const banners: ReactNode[] = [];
  if (s.hidden) banners.push(
    <WarningBanner key="h" data-testid="banner-hidden" tone="neutral" title="Työtila on arkistoitu"
      actions={<ControlButton size="row" variant="secondary" onPress={() => toast('Työtila palautettu näkyviin.')}>Palauta työtila</ControlButton>}>
      Linkki osoittaa arkistoituun työtilaan <code>{s.ws}</code>. Voit silti aloittaa keskustelun; työtila pysyy arkistoituna, ellet palauta sitä.
    </WarningBanner>);
  if (s.missingConv) banners.push(
    <WarningBanner key="m" data-testid="banner-missing-conv" tone="neutral" title="Keskustelua ei löytynyt">
      Työtilassa <code>{s.ws}</code> ei ole keskustelua nimeltä <code>deploy-valvonta</code>, joten tämä on uusi keskustelu. Se saa nimen <code>deploy-valvonta</code>, kun lähetät, ja linkki avaa sen jatkossa.
    </WarningBanner>);
  if (s.tooLong) banners.push(
    <WarningBanner key="l" data-testid="banner-too-long" tone="neutral" title="Linkin viesti jätettiin pois">
      Viesti oli {LONG.toLocaleString('fi-FI')} merkkiä, ja linkin viestin raja on {LIMIT.toLocaleString('fi-FI')}. Osaakaan ei näytetä, koska katkaistu ohje voi tarkoittaa muuta kuin koko ohje. Pyydä lähettäjää jakamaan viesti tiedostona.
    </WarningBanner>);
  if (archived) banners.push(
    <WarningBanner key="a" data-testid="banner-archived" tone="neutral" title="Keskustelu on arkistoitu"
      actions={<>
        <ControlButton data-testid="restore-conv" size="row" variant="secondary" onPress={() => { setArchived(false); toast('Keskustelu palautettu.'); }}>Palauta ja jatka</ControlButton>
        <ControlButton data-testid="new-instead" size="row" variant="quiet" onPress={() => onScenario('uusi')}>Uusi keskustelu tällä viestillä</ControlButton>
      </>}>
      Linkin viesti odottaa kentässä. Palauta keskustelu lähettääksesi sen, tai aloita uusi keskustelu työtilassa <code>{s.ws}</code>.
    </WarningBanner>);
  const card = link === 'card'
    ? <LinkCard occupied={!!field.trim()} onPlace={() => { setField(DRAFT); setLink(d === 2 ? 'none' : 'mark'); }}
        onAppend={() => { setField(`${field.trim()}\n\n${DRAFT}`); setLink('none'); }} onDismiss={() => setLink('none')} />
    : null;
  const working = !!s.working;
  return (
    <div className="cl-frame" data-testid="conversation-view" data-link={link} data-new={isNew || undefined}>
      <ConversationFrame>
        <AgentHeader title={isNew ? 'Uusi keskustelu' : CONV.title} workspaceLabel={s.ws} workspaceHref={`/workspaces/ws_${s.ws}`}
          activityLabel={working ? 'Työskentelee' : archived ? 'Arkistoitu' : ''} activityKind={working ? 'working' : undefined} activityAnimated={working}
          controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          detailsFacts={[{label: 'Työtila', value: `~/src/${s.ws}`}, ...(existing ? [{label: 'Nimi linkeissä', value: CONV.name}] : [])]} />
        {existing ? <HeaderMenu onLink={() => setMaking(true)} /> : null}
        <ConversationStream>
          <ConversationTimeline state={items.length ? 'ready' : 'empty'} items={items} onJumpToLatest={noop}
            emptyLabel={<p className="cl-empty">Uusi keskustelu työtilassa <code>{s.ws}</code>. Malli on oletusmalli.</p>} />
        </ConversationStream>
        <Composer value={field} onChange={setField} activity={working ? 'working' : 'idle'} selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={send} onSteer={send} onFollowUp={send} onInterrupt={noop} csrf="prototype" modelPicker={MODEL}
          availability={archived ? {state: 'disabled', reason: 'Keskustelu on arkistoitu. Palauta se lähettääksesi.'} : undefined} suppressAvailabilityReason={archived}
          beforeField={banners.length || card ? <div className="cl-before">{banners}{card}</div> : undefined}
          fieldQuote={link === 'mark' ? <LinkMark working={working} onRemove={() => { setField(''); setLink('none'); }} /> : undefined} />
      </ConversationFrame>
      {sheet ? <ConfirmSheet s={s} onOpen={placeFromSheet} onPlain={() => { setSheet(false); }} onCancel={() => { setSheet(false); toast('Linkki peruttiin. Habitat avautui etusivulle.'); }} /> : null}
      {making ? <LinkDialog onClose={() => setMaking(false)} /> : null}
    </div>
  );
}

function MissingWorkspace({s, onScenario}: {s: Scenario; onScenario: (id: SId, ws?: string) => void}) {
  return (
    <section className="cl-missing" data-testid="missing-workspace" aria-labelledby="cl-missing-title">
      <h1 id="cl-missing-title">Työtilaa ei löydy</h1>
      <p>Linkki avaisi uuden keskustelun työtilassa <code>{s.ws}</code>, mutta sinulla ei ole sen nimistä työtilaa. Linkin viesti on tallessa alla.</p>
      <section className="ah-reply-quote cl-card" aria-label="Linkin viesti">
        <div className="ah-reply-quote-head"><Icon name="link" /><span>Viesti linkistä · {claim(FROM)}</span></div>
        <blockquote className="cl-card-text"><Markdown text={DRAFT} /></blockquote>
        <div className="cl-card-actions">
          <ControlButton data-testid="missing-copy" size="row" variant="quiet" onPress={() => toast('Viesti kopioitu.')}><Icon name="copy" />Kopioi viesti</ControlButton>
        </div>
      </section>
      <h2>Aloita viestillä toisessa työtilassa</h2>
      <ul className="cl-ws-list">
        {WS.map((w) => (
          <li key={w}><ControlButton data-testid={`missing-ws-${w}`} size="row" variant="secondary" onPress={() => onScenario('uusi', w)}><Icon name="folder" /><code>{w}</code></ControlButton></li>
        ))}
      </ul>
    </section>
  );
}

function Rail({s, selectedConv}: {s: Scenario; selectedConv: boolean}) {
  const base = {controlLabel: '', activityLabel: 'Vapaa', activity: 'idle'};
  const rows = [
    {agentId: 'pi:1', href: '/c/1', title: CONV.title, workspaceName: 'kotisivu', changedAt: at('26T21:05:00'), selected: selectedConv,
      ...(s.working ? {activity: 'working', activityLabel: 'Työskentelee'} : {})},
    {agentId: 'pi:2', href: '/c/2', title: 'Julkaisun tarkistus', workspaceName: 'aurinkokello', changedAt: at('26T16:20:00')},
    {agentId: 'pi:3', href: '/c/3', title: 'Muistiinpanojen haku', workspaceName: 'muistiinpanot', changedAt: at('25T10:00:00')},
  ].filter((r) => !(s.archived && r.agentId === 'pi:1'));
  const now = (
    <section className="ah-now">
      <h2 className="ah-rail-section-head">Käynnissä</h2>
      {/* biome-ignore lint/suspicious/noExplicitAny: synthetic models. */}
      <ul>{rows.map((m) => <AgentNavItem key={m.agentId} {...base} {...(m as any)} now={NOW} />)}</ul>
    </section>
  );
  const wsSel = !selectedConv && !s.missingWs ? s.ws : '';
  return (
    // biome-ignore lint/suspicious/noExplicitAny: the round passes only what the rail draws here.
    <WorkspaceRail {...({serverLabel: 'habitat.example', connectionLabel: 'Yhteydessä'} as any)} now={now}>
      {WS.map((w) => <WorkspaceNavRow key={w} name={w} href={`/workspaces/ws_${w}`} selected={w === wsSel} />)}
    </WorkspaceRail>
  );
}

function Page({d, sid, ws, onScenario}: {d: number; sid: SId; ws?: string; onScenario: (id: SId, ws?: string) => void}) {
  const s: Scenario = {...SCENARIOS[sid], ...(ws ? {ws, link: linkNew(ws)} : {})};
  if (s.signin) {
    return (
      <div className="cl-signin" data-testid="signin">
        <LoginCard onLogin={() => onScenario('uusi')} notice={
          <WarningBanner tone="neutral" data-testid="signin-continue" title="Kirjautumisen jälkeen jatkat linkin kohteeseen">
            Uusi keskustelu työtilassa <code>{s.ws}</code>, viesti linkistä valmiina kentässä. Viesti säilyy tässä selaimessa kirjautumisen ajan eikä kulje kirjautumispalvelun kautta.
          </WarningBanner>} />
      </div>
    );
  }
  const selectedConv = s.target === 'conv' && !s.missingConv && !s.archived;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={s.missingWs ? 'Työtilaa ei löydy' : s.target === 'conv' && !s.missingConv ? CONV.title : 'Uusi keskustelu'}
        rail={<Rail s={s} selectedConv={selectedConv} />}
        main={s.missingWs ? <MissingWorkspace s={s} onScenario={onScenario} /> : <ConversationView key={`${d}-${sid}-${ws}`} d={d} s={s} onScenario={onScenario} />} />
    </StatusBellProvider>
  );
}

// ---------- Review chrome ----------

const json = (value: unknown) => new Response(JSON.stringify(value), {headers: {'content-type': 'application/json'}});
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, 'http://prototype.test/').pathname;
  if (!path.startsWith('/api/')) return realFetch(input, init);
  if (path === '/api/v1/pi/models') return json({schema_version: 1, catalog_status: 'native_cached', models: []});
  return new Response('', {status: 404});
};

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [sid, setSid] = useState<SId>(initialScenario);
  const [ws, setWs] = useState<string>();
  const [gen, setGen] = useState(0);
  const [note, setNote] = useState('');
  const bar = useRef<HTMLElement>(null);
  toast = setNote;
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty('--review-h', `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  }, [theme]);
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(''), 3200); return () => clearTimeout(id); }, [note]);
  const go = (next: SId, w?: string) => {
    initialScenario = next; setSid(next); setWs(w); setNote(''); setGen((g) => g + 1);
    const url = new URL(location.href); url.searchParams.set('s', next); history.replaceState(null, '', url);
  };
  const s = SCENARIOS[sid];
  const link = ws ? linkNew(ws) : s.link;
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={sid}>
      <header className="rq-bar" ref={bar}>
        <strong>Keskustelulinkit 1</strong>
        <label>Tilanne <select id="scenario" value={sid} onChange={(e) => go(e.target.value as SId)}>
          {SIDS.map((id) => <option key={id} value={id}>{SCENARIOS[id].label}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
        <button type="button" data-testid="rq-reopen" onClick={() => go(sid, ws)}>Avaa linkki uudelleen</button>
        {link ? <p className="rq-link" data-testid="rq-link"><span>Painettu linkki (viesti Telegramissa, {FROM}):</span> <code>{link}</code></p>
          : <p className="rq-link"><span>Avaa keskustelun valikko ⋯ yläpalkista.</span></p>}
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${gen}-${sid}`} enabled={false}>
          <MemoryRouter key={`${gen}-${sid}`} initialEntries={['/']}>
            <Page d={direction} sid={sid} ws={ws} onScenario={go} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
      {note ? <p className="rq-toast" role="status" data-testid="rq-toast">{note}</p> : null}
    </div>
  );
}

const reactRoot = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {set innerHTML(view: ReactNode) { flushSync(() => reactRoot.render(view === '' ? null : view)); }};
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
