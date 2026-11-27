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
import '../../../../web/src/components/Settings.css';
import {shownSettingsSections} from '../../../../web/src/app/settingsIndex';
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

// conversation-links-prefilled-draft, round 2 (Jari 27.11.2026 on round 1):
// direction A (the marked field) only. A link opens a new conversation in a
// workspace with the message in the field; there is no conversation name and
// no source claim in the link. Links are a capability the person allows in a
// new Settings section for risky features (risky-features-settings), off by
// default. The picker's axis is the one new question this round raises: where
// a link lands while links are not allowed.
//   A · oma sivu       a page says what the link would do, shows its message
//                      read-only and leads to the setting; nothing opens.
//   A · tyhjä kenttä   the workspace's new conversation opens with an empty
//                      field and a notice; the message is not shown.
// Production, unchanged: AppShell, WorkspaceRail, WorkspaceNavRow,
// AgentNavItem, AgentHeader, ConversationFrame, ConversationTimeline,
// UserMessage, AssistantMessage, Composer (fieldQuote and beforeField slots),
// WarningBanner, LoginCard, Menu, ControlButton, Icon, Settings.css and the
// settings section list. The round's own: the link mark and card, the
// links-off page, the missing-workspace page, the risky-features section and
// its confirmation, the menu item and the link dialog. No network, no
// navigation.

setPersonalLanguage('fi');
const noop = () => {};
const NAMES = ['A · oma sivu', 'A · tyhjä kenttä'];
const LINES = [
  'A · oma sivu: kun linkit eivät ole sallittuja, mitään ei avata. Sivu kertoo, mitä linkki tekisi, näyttää sen viestin vain luettavana ja vie asetukseen.',
  'A · tyhjä kenttä: kun linkit eivät ole sallittuja, työtilan uusi keskustelu avautuu tyhjällä kentällä, ja ilmoitus kertoo, että viesti jätettiin pois ja miten linkit sallitaan.',
];
const RECOMMEND = 'Suositus: oma sivu. Pois päältä oleva linkki ei saa ohjata sovellusta mihinkään, ja juuri tässä kohdassa ihminen päättää, salliiko hän linkit lainkaan: viestin näkeminen on se tieto, jolla hän päättää.';

// ---------- Synthetic host ----------
const ORIGIN = 'https://habitat.example';
const DRAFT = 'Yöajo 27.11. epäonnistui vaiheessa `npm test` (3 testiä punaisena, loki `logs/yoajo-2711.txt`). Selvitä syy ja ehdota korjaus, mutta älä vielä commitoi.';
const OWN = 'Katso vielä, miksi välimuistin avain vaihtuu joka ajossa –';
const LIMIT = 4000;
const LONG = 12480;
const WS = ['aurinkokello', 'kotisivu', 'muistiinpanot'] as const;
const CONV = {title: 'Yöajojen valvonta', ws: 'kotisivu'};
const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, '+');
/** The message rides in the fragment, which the browser never sends to the
 * host or puts in a Referer; `n` is its length, so a link a chat app cut
 * short is refused rather than shown in part. */
const linkNew = (ws: string, draft = DRAFT) => `${ORIGIN}/new/${ws}#n=${[...draft].length}&draft=${enc(draft)}`;

// ---------- Risky features ----------
const TITLES = ['Sallitut riskit', 'Vaaralliset toiminnot', 'Erikseen sallittavat'] as const;
type Member = {id: string; name: string; desc: string; allows: string; never: string; placeholder?: boolean};
const LINKS: Member = {
  id: 'conversation-links',
  name: 'Keskustelulinkit',
  desc: 'Linkki avaa uuden keskustelun työtilaasi ja kirjoittaa kenttään valmiin viestin.',
  allows: 'Kuka tahansa, joka saa sinut painamaan linkkiä, voi kirjoittaa viestin, jonka annat agentille. Viesti voi pyytää mitä tahansa, mihin agentillasi on oikeus.',
  never: 'Linkki ei lähetä mitään: viesti lähtee vasta, kun luet sen ja painat Lähetä. Linkki toimii vain omassa Habitatissasi kirjautuneena.',
};
const PLACEHOLDERS: Member[] = [2, 3].map((n) => ({
  id: `placeholder-${n}`,
  name: `Paikkamerkki ${n}`,
  desc: 'Toiminnon nimi ja yksi rivi siitä, mitä se tekee. Oikeat jäsenet päättää erillinen selvitys.',
  allows: n === 2
    ? 'Mitä toiminto sallii ja kenelle, yhdellä tai kahdella lauseella.'
    : 'Pidempi paikkamerkki: mitä toiminto sallii, kenelle ja missä tilanteessa, kolmella lauseella. Näin näkyy, miten pidempi varoitus rivittyy kortissa ja vahvistuksessa. Kolmas lause täyttää tilan.',
  never: 'Mitä toiminto ei koskaan tee, yhdellä lauseella.',
  placeholder: true,
}));

type SId = 'pois' | 'uusi' | 'luonnos' | 'piilotettu' | 'eityotilaa' | 'kirjaudu' | 'pitka' | 'tee' | 'asetus' | 'asetus3' | 'paalla';
type Scenario = {
  label: string; ws: string; link: string; settings?: boolean; members?: number; allowed: boolean;
  own?: boolean; hidden?: boolean; missingWs?: boolean; signin?: boolean; tooLong?: boolean; make?: boolean;
};
const SCENARIOS: Record<SId, Scenario> = {
  pois: {label: 'Linkki, kun linkit eivät ole sallittuja', ws: 'kotisivu', link: linkNew('kotisivu'), allowed: false},
  uusi: {label: 'Linkki, linkit sallittu', ws: 'kotisivu', link: linkNew('kotisivu'), allowed: true},
  luonnos: {label: 'Linkki, uudessa keskustelussa oma luonnos', ws: 'kotisivu', link: linkNew('kotisivu'), own: true, allowed: true},
  piilotettu: {label: 'Linkki, työtila arkistoitu', ws: 'vanha-sivusto', link: linkNew('vanha-sivusto'), hidden: true, allowed: true},
  eityotilaa: {label: 'Linkki, työtilaa ei löydy', ws: 'asiakasportaali', link: linkNew('asiakasportaali'), missingWs: true, allowed: true},
  kirjaudu: {label: 'Linkki, ei kirjautunut', ws: 'kotisivu', link: linkNew('kotisivu'), signin: true, allowed: true},
  pitka: {label: 'Linkki liian pitkä', ws: 'kotisivu', link: `${ORIGIN}/new/kotisivu#n=${LONG}&draft=Analysoi+seuraava+loki…`, tooLong: true, allowed: true},
  tee: {label: 'Linkin tekeminen (valikosta)', ws: 'kotisivu', link: '', make: true, allowed: true},
  asetus: {label: 'Asetukset: osio, yksi jäsen', ws: 'kotisivu', link: '', settings: true, members: 1, allowed: false},
  asetus3: {label: 'Asetukset: osio, kolme jäsentä', ws: 'kotisivu', link: '', settings: true, members: 3, allowed: false},
  paalla: {label: 'Asetukset: linkit sallittu', ws: 'kotisivu', link: '', settings: true, members: 1, allowed: true},
};
const SIDS = Object.keys(SCENARIOS) as SId[];
const param = new URLSearchParams(location.search);
let initialScenario: SId = (param.get('s') as SId) in SCENARIOS ? param.get('s') as SId : 'pois';
const themeParam = param.get('theme');
let reviewTheme = themeParam === 'dark' || themeParam === 'contrast' ? themeParam : 'light';
const titleParam = Number(param.get('title'));
let reviewTitle = titleParam >= 0 && titleParam < TITLES.length ? titleParam : 0;
let toast: (s: string) => void = () => {};

const at = (s: string) => Date.parse(`2026-11-${s}+02:00`);
const NOW = at('27T07:42:00');

// ---------- The link's message: mark and card ----------

/** The field's first row while it holds the link's message (production's
 * reply-quote classes, as a quote is "text from elsewhere" there too). The
 * person pressed the link themself, so the row says only the two things the
 * click does not tell: the text is not theirs, and nothing has gone yet. */
function LinkMark({onRemove}: {onRemove: () => void}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled row with one control, as production's quote.
    <div className="ah-reply-quote cl-mark" role="group" aria-label="Viesti linkistä" data-testid="link-mark">
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>Viesti linkistä. Mitään ei ole lähetetty.</span>
        <span className="ah-reply-quote-tools">
          <ControlButton data-testid="link-remove" aria-label="Poista linkin viesti" variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
    </div>
  );
}

/** When the workspace's new conversation already holds an unsent draft, the
 * link's message waits above the field instead of replacing it. */
function LinkCard({onAppend, onReplace, onDismiss}: {onAppend: () => void; onReplace: () => void; onDismiss: () => void}) {
  return (
    <section className="ah-reply-quote cl-card" aria-label="Viesti linkistä" data-testid="link-card">
      <div className="ah-reply-quote-head">
        <Icon name="link" />
        <span>Viesti linkistä. Kentässä on keskeneräinen viestisi, joten tämä ei korvannut sitä.</span>
      </div>
      <blockquote className="cl-card-text" data-testid="link-card-text"><Markdown text={DRAFT} /></blockquote>
      <div className="cl-card-actions">
        <ControlButton data-testid="link-append" size="row" variant="secondary" onPress={onAppend}>Lisää viestisi perään</ControlButton>
        <ControlButton data-testid="link-replace" size="row" variant="quiet" onPress={onReplace}>Korvaa</ControlButton>
        <ControlButton data-testid="link-dismiss" size="row" variant="quiet" onPress={onDismiss}>Hylkää</ControlButton>
      </div>
    </section>
  );
}

// ---------- Making a link ----------

function LinkDialog({ws, onClose}: {ws: string; onClose: () => void}) {
  const [text, setText] = useState('Katso yöajon tulos ja kerro, voiko julkaisun tehdä tänään.');
  const n = [...text].length;
  const over = n > LIMIT;
  const url = linkNew(ws, text);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* the review page may not have the clipboard */ }
    toast('Linkki kopioitu.');
    onClose();
  };
  return (
    <ModalOverlay className="cl-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="cl-modal">
        <Dialog className="cl-dialog" data-testid="link-dialog" aria-labelledby="cl-link-title">
          <Heading slot="title" id="cl-link-title">Linkki uuteen keskusteluun</Heading>
          <p className="cl-mark-note">Linkki avaa uuden keskustelun työtilassa <code>{ws}</code> ja kirjoittaa kenttään alla olevan viestin. Avaajan on sallittava keskustelulinkit omissa asetuksissaan; muuten linkki vain kertoo, mitä se tekisi.</p>
          <label className="cl-field">Viesti kenttään
            <textarea data-testid="link-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={over || undefined} aria-describedby="cl-count" />
          </label>
          <p id="cl-count" className="cl-count" data-over={over || undefined}>{n.toLocaleString('fi-FI')} / {LIMIT.toLocaleString('fi-FI')} merkkiä{over ? ' – liian pitkä linkkiin' : ''}</p>
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
 * its trigger and places production's Menu, with the same two items and the
 * link item, in the same spot (shown on a desktop too, round.css). */
function HeaderMenu({onLink}: {onLink: () => void}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const own = [...document.querySelectorAll<HTMLElement>('[data-testid="conversation-menu"]')];
    const place = own.find((b) => b.offsetParent) ?? own[0];
    own.forEach((b) => { b.style.display = 'none'; });
    if (place?.parentElement) setHost(place.parentElement);
  }, []);
  if (!host) return null;
  const items = [
    {id: 'rename', label: 'Nimeä uudelleen'},
    {id: 'link', label: 'Kopioi linkki uuteen keskusteluun tässä työtilassa…', icon: <Icon name="link" />},
    {id: 'archive', label: 'Arkistoi'},
  ];
  return createPortal(
    <Menu label="Keskustelun toiminnot" trigger={<Icon name="more" />} triggerPresentation="icon" triggerClassName="ah-header-more cl-more"
      triggerTestId="round-conversation-menu" placement="bottom end" items={items}
      onAction={(id) => { if (id === 'link') setTimeout(onLink); else toast('Ei tässä vedoksessa.'); }} />,
    host,
  );
}

// ---------- The conversation ----------

const MODEL = <ControlButton size="inline" variant="quiet" className="cl-model" data-testid="model-default" onPress={() => toast('Mallin valinta ei ole tässä vedoksessa.')}>oletusmalli</ControlButton>;

function History() {
  return [
    {id: 'u0', content: <UserMessage sourceText="" time="eilen 21.04" onCopy={noop}><Markdown text="Seuraa yöajoja ja kerro aamulla, jos jokin meni rikki." /></UserMessage>},
    {id: 'a0', content: <AssistantMessage time="eilen 21.05" streamState="complete" onCopy={noop}><Markdown text="Selvä. Katson ajon tuloksen joka aamu ja kirjoitan tähän, jos jokin vaihe epäonnistuu." /></AssistantMessage>},
  ];
}

type Nav = {go: (id: SId, ws?: string) => void; settings: (fromLink: boolean) => void};

function ConversationView({s, allowed, nav}: {s: Scenario; allowed: boolean; nav: Nav}) {
  const linkOn = allowed && !s.make && !s.tooLong;
  const first = s.own ? {field: OWN, link: linkOn ? 'card' : 'none'} : {field: linkOn ? DRAFT : '', link: linkOn ? 'mark' : 'none'};
  const [field, setField] = useState(first.field);
  const [link, setLink] = useState(first.link as 'mark' | 'card' | 'none');
  const [sent, setSent] = useState<string[]>([]);
  const [making, setMaking] = useState(!!s.make);
  const existing = !!s.make;
  const send = (text?: string) => {
    const t = (text ?? field).trim();
    if (!t) return;
    setSent((x) => [...x, t]);
    setField(''); setLink('none');
  };
  const items = [
    ...(existing ? History() : []),
    ...sent.map((m, i) => ({id: `s${i}`, content: <UserMessage sourceText={m} time="7.42" delivery="pending" onCopy={noop}><Markdown text={m} /></UserMessage>})),
  ];
  const banners: ReactNode[] = [];
  if (!allowed && !s.make) banners.push(
    <WarningBanner key="o" data-testid="banner-links-off" tone="neutral" title="Linkin viestiä ei kirjoitettu kenttään"
      actions={<ControlButton data-testid="off-open-settings" size="row" variant="secondary" onPress={() => nav.settings(true)}>Avaa asetus</ControlButton>}>
      Keskustelulinkit eivät ole sallittuja, joten linkki avasi vain uuden keskustelun työtilassa <code>{s.ws}</code>. Jos haluat linkkien kirjoittavan viestin kenttään, salli ne asetuksissa.
    </WarningBanner>);
  if (s.hidden) banners.push(
    <WarningBanner key="h" data-testid="banner-hidden" tone="neutral" title="Työtila on arkistoitu"
      actions={<ControlButton size="row" variant="secondary" onPress={() => toast('Työtila palautettu näkyviin.')}>Palauta työtila</ControlButton>}>
      Linkki osoittaa arkistoituun työtilaan <code>{s.ws}</code>. Voit silti aloittaa keskustelun; työtila pysyy arkistoituna, ellet palauta sitä.
    </WarningBanner>);
  if (s.tooLong && allowed) banners.push(
    <WarningBanner key="l" data-testid="banner-too-long" tone="neutral" title="Linkin viesti jätettiin pois">
      Viesti oli {LONG.toLocaleString('fi-FI')} merkkiä, ja linkin viestin raja on {LIMIT.toLocaleString('fi-FI')}. Osaakaan ei näytetä, koska katkaistu ohje voi tarkoittaa muuta kuin koko ohje.
    </WarningBanner>);
  const card = link === 'card'
    ? <LinkCard onAppend={() => { setField(`${field.trim()}\n\n${DRAFT}`); setLink('none'); }}
        onReplace={() => { setField(DRAFT); setLink('mark'); }} onDismiss={() => setLink('none')} />
    : null;
  return (
    <div className="cl-frame" data-testid="conversation-view" data-link={link}>
      <ConversationFrame>
        <AgentHeader title={existing ? CONV.title : 'Uusi keskustelu'} workspaceLabel={s.ws} workspaceHref={`/workspaces/ws_${s.ws}`}
          activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop}
          detailsFacts={[{label: 'Työtila', value: `~/src/${s.ws}`}]} />
        {existing && allowed ? <HeaderMenu onLink={() => setMaking(true)} /> : null}
        <ConversationStream>
          <ConversationTimeline state={items.length ? 'ready' : 'empty'} items={items} onJumpToLatest={noop}
            emptyLabel={<p className="cl-empty">Uusi keskustelu työtilassa <code>{s.ws}</code>. Malli on oletusmalli.</p>} />
        </ConversationStream>
        <Composer value={field} onChange={setField} activity="idle" selectedWorkingMode="follow_up" onModeChange={noop}
          onSendNow={send} onSteer={send} onFollowUp={send} onInterrupt={noop} csrf="prototype" modelPicker={MODEL}
          beforeField={banners.length || card ? <div className="cl-before">{banners}{card}</div> : undefined}
          fieldQuote={link === 'mark' ? <LinkMark onRemove={() => { setField(''); setLink('none'); }} /> : undefined} />
      </ConversationFrame>
      {making ? <LinkDialog ws={s.ws} onClose={() => setMaking(false)} /> : null}
    </div>
  );
}

/** A · oma sivu: links are not allowed, so nothing opens. The page says what
 * the link would have done and shows its message read-only, without a copy
 * button, because a copy button would be the capability by another route. */
function LinksOff({s, title, nav}: {s: Scenario; title: string; nav: Nav}) {
  return (
    <section className="cl-missing" data-testid="links-off" aria-labelledby="cl-off-title">
      <h1 id="cl-off-title">Keskustelulinkit eivät ole sallittuja</h1>
      <p>Tämä linkki avaisi uuden keskustelun työtilassa <code>{s.ws}</code> ja kirjoittaisi kenttään alla olevan viestin. Mitään ei avattu eikä lähetetty.</p>
      <section className="ah-reply-quote cl-card cl-readonly" aria-label="Linkin viesti, vain luettavana">
        <div className="ah-reply-quote-head"><Icon name="link" /><span>Linkin viesti</span></div>
        <blockquote className="cl-card-text" data-testid="links-off-text"><Markdown text={DRAFT} /></blockquote>
      </section>
      <p className="cl-mark-note">Voit sallia keskustelulinkit kohdassa Asetukset › {title}. Sen jälkeen voit palata tähän linkkiin.</p>
      <div className="cl-card-actions">
        <ControlButton data-testid="off-open-settings" size="row" variant="primary" onPress={() => nav.settings(true)}><Icon name="gear" />Avaa asetus</ControlButton>
        <ControlButton data-testid="off-open-workspace" size="row" variant="secondary" onPress={() => toast(`Työtila ${s.ws} avautuisi ilman linkin viestiä.`)}><Icon name="folder" />Avaa työtila <code>{s.ws}</code></ControlButton>
      </div>
    </section>
  );
}

function MissingWorkspace({s, nav}: {s: Scenario; nav: Nav}) {
  return (
    <section className="cl-missing" data-testid="missing-workspace" aria-labelledby="cl-missing-title">
      <h1 id="cl-missing-title">Työtilaa ei löydy</h1>
      <p>Linkki avaisi uuden keskustelun työtilassa <code>{s.ws}</code>, mutta sinulla ei ole sen nimistä työtilaa. Linkin viesti on tallessa alla.</p>
      <section className="ah-reply-quote cl-card" aria-label="Linkin viesti">
        <div className="ah-reply-quote-head"><Icon name="link" /><span>Viesti linkistä</span></div>
        <blockquote className="cl-card-text"><Markdown text={DRAFT} /></blockquote>
        <div className="cl-card-actions">
          <ControlButton data-testid="missing-copy" size="row" variant="quiet" onPress={() => toast('Viesti kopioitu.')}><Icon name="copy" />Kopioi viesti</ControlButton>
        </div>
      </section>
      <h2>Aloita viestillä toisessa työtilassa</h2>
      <ul className="cl-ws-list">
        {WS.map((w) => (
          <li key={w}><ControlButton data-testid={`missing-ws-${w}`} size="row" variant="secondary" onPress={() => nav.go('uusi', w)}><Icon name="folder" /><code>{w}</code></ControlButton></li>
        ))}
      </ul>
    </section>
  );
}

function Rail({s, nothingOpen}: {s: Scenario; nothingOpen?: boolean}) {
  const base = {controlLabel: '', activityLabel: 'Vapaa', activity: 'idle'};
  const rows = [
    {agentId: 'pi:1', href: '/c/1', title: CONV.title, workspaceName: 'kotisivu', changedAt: at('26T21:05:00'), selected: !!s.make},
    {agentId: 'pi:2', href: '/c/2', title: 'Julkaisun tarkistus', workspaceName: 'aurinkokello', changedAt: at('26T16:20:00')},
    {agentId: 'pi:3', href: '/c/3', title: 'Muistiinpanojen haku', workspaceName: 'muistiinpanot', changedAt: at('25T10:00:00')},
  ];
  const now = (
    <section className="ah-now">
      <h2 className="ah-rail-section-head">Käynnissä</h2>
      {/* biome-ignore lint/suspicious/noExplicitAny: synthetic models. */}
      <ul>{rows.map((m) => <AgentNavItem key={m.agentId} {...base} {...(m as any)} now={NOW} />)}</ul>
    </section>
  );
  const wsSel = !s.make && !s.missingWs && !nothingOpen ? s.ws : '';
  return (
    // biome-ignore lint/suspicious/noExplicitAny: the round passes only what the rail draws here.
    <WorkspaceRail {...({serverLabel: 'habitat.example', connectionLabel: 'Yhteydessä'} as any)} now={now}>
      {WS.map((w) => <WorkspaceNavRow key={w} name={w} href={`/workspaces/ws_${w}`} selected={w === wsSel} />)}
    </WorkspaceRail>
  );
}

// ---------- Settings: the risky-features section ----------

const RISKY = 'riskit';
/** The section sits with the account's security sections (Tili, Laitteet,
 * Avaimet), far from Kokeelliset ominaisuudet near the end of the list: the
 * two answer different questions (is it risky / is it finished). */
function sectionList(title: string) {
  const own = shownSettingsSections('fi').filter((x) => !x.admin);
  const i = own.findIndex((x) => x.id === 'avaimet');
  const risky = {id: RISKY, label: title, icon: 'shield' as const};
  return [...own.slice(0, i + 1), risky, ...own.slice(i + 1)].map(({id, label, icon}) => ({id, label, icon}));
}

function AllowDialog({m, onConfirm, onCancel}: {m: Member; onConfirm: () => void; onCancel: () => void}) {
  return (
    <ModalOverlay className="cl-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onCancel(); }}>
      <Modal className="cl-modal">
        <Dialog className="cl-dialog" data-testid="allow-dialog" aria-labelledby="rk-allow-title">
          <Heading slot="title" id="rk-allow-title">Sallitaanko {m.placeholder ? m.name : 'keskustelulinkit'}?</Heading>
          <div className="rk-warn" data-testid="allow-warning">
            <Icon name="warning" />
            <div>
              <p><b>Kun tämä on päällä:</b> {m.desc}</p>
              <p>{m.allows}</p>
            </div>
          </div>
          <p className="cl-mark-note"><b>Ei koskaan:</b> {m.never}</p>
          <p className="cl-mark-note">Asetus koskee tiliäsi kaikilla laitteilla. Voit poistaa sen käytöstä täältä milloin tahansa.</p>
          <div className="cl-dialog-actions">
            <ControlButton data-testid="allow-confirm" size="page" variant="primary" onPress={onConfirm}>Salli {m.placeholder ? m.name : 'keskustelulinkit'}</ControlButton>
            <ControlButton data-testid="allow-cancel" size="page" variant="quiet" onPress={onCancel}>Peru</ControlButton>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function MemberRow({m, on, onAllow, onDisable}: {m: Member; on: boolean; onAllow: () => void; onDisable: () => void}) {
  return (
    <section className="rk-member" data-settings-row={m.id} data-testid={`risky-${m.id}`} data-on={on || undefined} aria-label={m.name} tabIndex={-1}>
      <div className="s-row">
        <div className="s-lbl">
          <strong>{m.name}</strong>
          <span className="s-desc">{m.desc}</span>
        </div>
        <div className="s-val">
          <span className="rk-state" data-testid={`risky-${m.id}-state`} data-on={on || undefined}>
            {on ? <><Icon name="warning" />Sallittu</> : 'Ei sallittu'}
          </span>
          {on
            ? <ControlButton data-testid={`disable-${m.id}`} size="row" variant="secondary" onPress={onDisable}>Poista käytöstä</ControlButton>
            : <ControlButton data-testid={`allow-${m.id}`} size="row" variant="secondary" onPress={onAllow}>Salli…</ControlButton>}
        </div>
      </div>
      <p className="rk-allows"><span>Sallii:</span> {m.allows}</p>
      {on ? <p className="rk-since" data-testid={`risky-${m.id}-since`}>Sallit tämän 27.11.2026 klo 7.43. Koskee tiliäsi kaikilla laitteilla.</p> : null}
    </section>
  );
}

function SettingsPage({title, members, allowed, setAllowed, fromLink, onBackToLink, onClose}: {
  title: string; members: number; allowed: boolean; setAllowed: (on: boolean) => void;
  fromLink: boolean; onBackToLink: () => void; onClose: () => void;
}) {
  const list = [LINKS, ...PLACEHOLDERS.slice(0, members - 1)];
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState<Member>();
  const isOn = (m: Member) => m.id === LINKS.id ? allowed : !!on[m.id];
  const set = (m: Member, v: boolean) => { if (m.id === LINKS.id) setAllowed(v); else setOn((x) => ({...x, [m.id]: v})); };
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fromLink) row.current?.querySelector<HTMLElement>(`[data-settings-row="${LINKS.id}"]`)?.focus();
  }, [fromLink]);
  return (
    <div className="rk-scroll">
    <section className="ah-account-settings s-page detail" data-testid="settings-page">
      <ControlButton data-testid="settings-close" className="s-close" size="row" variant="quiet" presentation="icon" aria-label="Sulje asetukset" onPress={onClose}>
        <Icon name="cross" />
      </ControlButton>
      <nav data-testid="settings-navigation" className="s-nav" aria-label="Asetusten osiot">
        <h1 data-testid="settings-title">Asetukset</h1>
        {sectionList(title).map((x) => (
          <button type="button" key={x.id} className="s-nav-i" data-testid={`settings-${x.id}`} aria-current={x.id === RISKY ? 'page' : undefined}
            aria-disabled={x.id === RISKY ? undefined : 'true'} onClick={() => { if (x.id !== RISKY) toast('Muut osiot eivät ole tässä vedoksessa.'); }}>
            <Icon name={x.icon} />
            {x.label}
          </button>
        ))}
      </nav>
      <div className="s-main" data-settings-page={RISKY} ref={row}>
        <ControlButton className="s-back" variant="quiet" size="row" presentation="back" onPress={() => toast('Osioiden lista ei ole tässä vedoksessa.')}>
          Asetukset
        </ControlButton>
        <h2 data-testid={`settings-section-${RISKY}`}>{title}</h2>
        <div className="s-stack">
          {fromLink ? (
            <WarningBanner data-testid="from-link" tone="neutral" title="Tulit linkistä"
              actions={<ControlButton data-testid="back-to-link" size="row" variant={allowed ? 'primary' : 'secondary'} onPress={onBackToLink}>Palaa linkkiin</ControlButton>}>
              {allowed ? 'Keskustelulinkit ovat nyt sallittuja. Palaa linkkiin, niin sen viesti tulee kenttään.' : 'Linkki tarvitsee keskustelulinkit. Lue ensin, mitä ne sallivat.'}
            </WarningBanner>
          ) : null}
          <p className="s-intro">Nämä ovat oletuksena pois. Jokainen antaa jonkin Habitatin ulkopuolisen vaikuttaa siihen, mitä agenttisi tekee, joten salli vain se, mitä käytät. Käytöstä poistaminen on aina turvallista ja tapahtuu heti.</p>
          <div className="s-card rk-card">
            {list.map((m) => (
              <MemberRow key={m.id} m={m} on={isOn(m)} onAllow={() => setAsking(m)}
                onDisable={() => { set(m, false); toast(m.id === LINKS.id ? 'Keskustelulinkit poistettu käytöstä. Linkit eivät enää kirjoita kenttään.' : `${m.name} poistettu käytöstä.`); }} />
            ))}
          </div>
        </div>
      </div>
      {asking ? <AllowDialog m={asking} onCancel={() => setAsking(undefined)}
        onConfirm={() => { set(asking, true); setAsking(undefined); toast(asking.id === LINKS.id ? 'Keskustelulinkit sallittu.' : `${asking.name} sallittu.`); }} /> : null}
    </section>
    </div>
  );
}

// ---------- The page ----------

function Page({d, sid, ws, allowed, setAllowed, view, title, nav, closeSettings}: {
  d: number; sid: SId; ws?: string; allowed: boolean; setAllowed: (on: boolean) => void;
  view: 'app' | 'settings' | 'settings-link'; title: string; nav: Nav & {backToLink: () => void}; closeSettings: () => void;
}) {
  const s: Scenario = {...SCENARIOS[sid], ...(ws ? {ws, link: linkNew(ws), missingWs: false} : {})};
  if (view !== 'app' || s.settings) {
    return <SettingsPage title={title} members={s.members ?? 1} allowed={allowed} setAllowed={setAllowed}
      fromLink={view === 'settings-link'} onBackToLink={nav.backToLink} onClose={closeSettings} />;
  }
  if (s.signin) {
    return (
      <div className="cl-signin" data-testid="signin">
        <LoginCard onLogin={() => nav.go('uusi')} notice={
          <WarningBanner tone="neutral" data-testid="signin-continue" title="Kirjautumisen jälkeen jatkat linkin kohteeseen">
            Uusi keskustelu työtilassa <code>{s.ws}</code>. Linkin viesti säilyy tässä selaimessa kirjautumisen ajan eikä kulje kirjautumispalvelun kautta.
          </WarningBanner>} />
      </div>
    );
  }
  const off = !allowed && !s.make;
  const ownPage = off && d === 0;
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={s.missingWs ? 'Työtilaa ei löydy' : ownPage ? 'Keskustelulinkit' : s.make ? CONV.title : 'Uusi keskustelu'}
        rail={<Rail s={s} nothingOpen={ownPage} />}
        main={ownPage ? <LinksOff s={s} title={title} nav={nav} />
          : s.missingWs && !off ? <MissingWorkspace s={s} nav={nav} />
          : <ConversationView key={`${d}-${sid}-${ws}-${allowed}`} s={s} allowed={allowed} nav={nav} />} />
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

// The setting is the account's, so it survives switching directions.
let reviewAllowed = SCENARIOS[initialScenario].allowed;

function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme);
  const [title, setTitle] = useState(reviewTitle);
  const [sid, setSid] = useState<SId>(initialScenario);
  const [ws, setWs] = useState<string>();
  const [allowed, setAllowedState] = useState(reviewAllowed);
  const [view, setView] = useState<'app' | 'settings' | 'settings-link'>('app');
  const [gen, setGen] = useState(0);
  const [note, setNote] = useState('');
  const bar = useRef<HTMLElement>(null);
  toast = setNote;
  const setAllowed = (on: boolean) => { reviewAllowed = on; setAllowedState(on); };
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
  const remount = () => { setNote(''); setGen((g) => g + 1); };
  /** Picking a situation sets the setting it is about; following a link
   * inside the page keeps the setting the person chose. */
  const choose = (next: SId) => {
    initialScenario = next; setSid(next); setWs(undefined); setView('app'); setAllowed(SCENARIOS[next].allowed); remount();
    const url = new URL(location.href); url.searchParams.set('s', next); history.replaceState(null, '', url);
  };
  const nav = {
    go: (next: SId, w?: string) => { setSid(next); setWs(w); setView('app'); remount(); },
    settings: (fromLink: boolean) => { setView(fromLink ? 'settings-link' : 'settings'); remount(); },
    backToLink: () => { setView('app'); remount(); },
  };
  const s = SCENARIOS[sid];
  const link = ws ? linkNew(ws) : s.link;
  return (
    <div className={`rq-review variant-${direction}`} data-direction={direction} data-scenario={sid} data-view={view} data-allowed={allowed}>
      <header className="rq-bar" ref={bar}>
        <strong>Keskustelulinkit 2</strong>
        <label>Tilanne <select id="scenario" value={sid} onChange={(e) => choose(e.target.value as SId)}>
          {SIDS.map((id) => <option key={id} value={id}>{SCENARIOS[id].label}</option>)}</select></label>
        <label>Osion nimi <select id="section-title" data-testid="rq-title" value={title} onChange={(e) => { reviewTitle = Number(e.target.value); setTitle(reviewTitle); }}>
          {TITLES.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></label>
        <label>Teema <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
          <option value="light">Päivä</option><option value="dark">Yö</option><option value="contrast">Korkea kontrasti</option></select></label>
        <span className="rq-state" data-testid="rq-allowed">Keskustelulinkit: {allowed ? 'sallittu' : 'ei sallittu'}</span>
        {link ? <button type="button" data-testid="rq-reopen" onClick={() => nav.go(sid, ws)}>Avaa linkki uudelleen</button> : null}
        {view === 'app' && !s.settings
          ? link ? <p className="rq-link" data-testid="rq-link"><span>Painettu linkki (viesti chat-sovelluksessa):</span> <code>{link}</code></p>
            : <p className="rq-link"><span>Avaa keskustelun valikko ⋯ yläpalkista.</span></p>
          : null}
        <ol className="rq-lines" data-testid="direction-lines">
          {LINES.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}
        </ol>
        <p className="rq-recommend" data-testid="recommendation">{RECOMMEND}</p>
      </header>
      <div className="rq-stage">
        <PiModelsProvider key={`${gen}-${sid}`} enabled={false}>
          <MemoryRouter key={`${gen}-${sid}`} initialEntries={['/']}>
            <Page d={direction} sid={sid} ws={ws} allowed={allowed} setAllowed={setAllowed} view={view} title={TITLES[title]}
              nav={nav} closeSettings={() => (s.settings ? toast('Asetukset sulkeutuisivat edelliseen näkymään.') : nav.backToLink())} />
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
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', '\u00a0');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
