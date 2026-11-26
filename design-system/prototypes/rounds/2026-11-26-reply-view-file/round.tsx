import React, {type ReactNode, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createPortal, flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import '../../../../design-system/styles.css';
import '../../../../web/src/app.css';
import '../../../../web/src/components/components.css';
// The panel's header (ViewHeader) uses the editor split's header rules.
import '../../../../web/src/components/EditorSplit.css';
import type {FileOfferItem, FileOfferSummary, OfferState} from '../../../../web/src/app/fileOffers';
import {AgentTurn, type TurnStep} from '../../../../web/src/components/AgentTurn';
import {ControlButton} from '../../../../web/src/components/ControlElements';
import {Composer, ConversationTimeline, ToolRow, UserMessage} from '../../../../web/src/components/Conversation';
import {ConversationFrame, ConversationStream} from '../../../../web/src/components/ConversationFrame';
import {FileOfferCard, fileFacts, offerDownload, offerFacts, offerKind} from '../../../../web/src/components/FileOffer';
import {Icon} from '../../../../web/src/components/Icon';
import {Markdown} from '../../../../web/src/components/Markdown';
import {AgentHeader} from '../../../../web/src/components/Navigation';
import {OfferActions, OfferCard, OfferMark, type OfferKind} from '../../../../web/src/components/OfferCard';
import {OfferPanel} from '../../../../web/src/components/OfferPanel';
import {ComposerQuote, ReplyContext, type ReplyControl, SentQuote} from '../../../../web/src/components/ReplyQuote';
import {StatusBellProvider} from '../../../../web/src/components/StatusBell';
import {type ViewSummary, type ViewVisibility, ViewOfferCard, viewDownload, viewFacts} from '../../../../web/src/components/ViewOffer';
import {ViewHeader} from '../../../../web/src/components/ViewPanel';
import {formatDate, setPersonalLanguage} from '../../../../web/src/i18n';
import {conversationEventsText} from '../../../../web/src/text/conversationEvents';
import {replyQuoteText} from '../../../../web/src/text/replyQuote';
import {type Lang, type OfferType, TEXT, type Text} from './text';
import './round.css';

// reply-view-file, round 1. Jari 26.11.2026: the reply control of the
// experimental reply-to-message (↩ in an agent message's corner, a quote in
// the field, a <reply-to> block the daemon writes) should exist on view and
// file offer cards too; replying to a prototype card is how he answers its
// questions. Now (production today), A Corner, B Row, C To the file.
//
// Production, unchanged: ConversationFrame, AgentHeader, ConversationTimeline,
// UserMessage (quote slot), AgentTurn with the messages' own ↩
// (ReplyCornerButton through ReplyContext), ToolRow, Markdown, Composer
// (fieldQuote slot), ViewOfferCard, FileOfferCard, OfferCard, OfferActions
// (children slot), OfferMark, OfferPanel, ViewHeader, ComposerQuote and
// SentQuote for message replies. The round's own: the card's ↩ (A and C
// over the card's corner, B in OfferActions' children, C also on the
// package panel's rows through a portal), the offer quotes in the field and
// on the sent message (production's quote classes), the jump to a card and
// the side column with the literal <reply-to> blocks. No network: no image
// thumbnails, and nothing that previews a file's bytes.

type Review = {theme: string; lang: Lang};
let review: Review = {theme: 'light', lang: 'fi'};
const listeners = new Set<() => void>();
const setReview = (r: Partial<Review>) => { review = {...review, ...r}; listeners.forEach((l) => l()); };
const useReview = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => review);
const noop = () => {};
setPersonalLanguage('fi');

const NOW_D = 0, A = 1, B = 2, C = 3;
const at = (s: string) => Date.parse(`2026-11-26T${s}+02:00`);
const clock = (ms: number) => formatDate(new Date(ms), {hour: '2-digit', minute: '2-digit'});
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- The synthetic offers, as their native notices carry them ----------

/** Native entry ids of the three notices and the agent's three messages. */
const KEY = {view: '4c1e9a07', pdf: '9b20d4e1', pkg: 'd71f0c3a', r0: 'a3f0b812', r1: '5e6d7c90', r2: 'c2b4e6f8'};
type CardId = 'view' | 'pdf' | 'pkg';
const AT = {u0: at('09:12:00'), view: at('09:20:10'), r0: at('09:20:30'), u1: at('09:25:00'), pdf: at('09:31:00'), pkg: at('09:31:20'), r1: at('09:31:40'), u2: at('09:40:00'), r2: at('09:42:00')};

const view = (t: Text): ViewSummary => ({view_id: 'vk3qzm7d2xw4a6b5c7e2f3g4h5j', title: t.viewTitle, entry: 'index.html', files: 12, bytes: 7864320, created_at: new Date(AT.view).toISOString()});
const pdfItem: FileOfferItem = {path: 'vuosikertomus-2026.pdf', bytes: 2516582, kind: 'pdf'};
const pdf: FileOfferSummary = {offer_id: 'fq7r2s3t4u5v6w7x2y3z4a5b6c7', title: 'vuosikertomus-2026.pdf', files: 1, bytes: 2516582, created_at: new Date(AT.pdf).toISOString(), conversation_id: 'pi:00000000-0000-4000-8000-000000000001'} as FileOfferSummary;
const pkgItems: FileOfferItem[] = [
  {path: 'tase-2026.xlsx', bytes: 1132462, kind: 'xlsx'},
  {path: 'henkilosto.csv', bytes: 18432, kind: 'csv', lines: 143, columns: 6},
  {path: 'tilintarkastus.md', bytes: 9216, kind: 'markdown', lines: 120},
];
const pkg = (t: Text): FileOfferSummary => ({offer_id: 'fm2n3o4p5q6r7s2t3u4v5w6x7y2', title: t.packageTitle, folder: 'liitteet', files: 3, bytes: 1160110, created_at: new Date(AT.pkg).toISOString(), conversation_id: 'pi:00000000-0000-4000-8000-000000000001'} as FileOfferSummary);
const ready = (items: FileOfferItem[], s: FileOfferSummary): OfferState => ({state: 'ready', manifest: {...s, items} as never});
const stateOf = (id: 'pdf' | 'pkg', t: Text) => id === 'pdf' ? ready([pdfItem], pdf) : ready(pkgItems, pkg(t));

// The host's English words for the block (sizes as the daemon would write them).
const hostSize: Record<string, string> = {view: '7.5 MB', pdf: '2.4 MB', pkg: '1.1 MB', 'tase-2026.xlsx': '1.1 MB', 'henkilosto.csv': '18 KB', 'tilintarkastus.md': '9 KB'};
const hostKind: Record<string, string> = {xlsx: 'Excel spreadsheet', csv: 'CSV table', markdown: 'Markdown', pdf: 'PDF'};

// ---------- What a reply points at ----------

type Target =
  | {type: 'message'; key: string; text: string; at: number}
  | {type: 'offer'; card: CardId; path?: string};

const offerType = (card: CardId): OfferType => card === 'view' ? 'view' : card === 'pdf' ? 'file' : 'package';
const targetKey = (x: Target) => x.type === 'message' ? x.key : KEY[x.card];

/** The excerpt production's daemon writes for an agent message (shortened:
 * first sentence, at most 160 characters with " …"). */
function messageExcerpt(text: string) {
  const m = /^(.+?[.!?])(\s|$)/.exec(text);
  const s = m ? m[1] : text;
  const more = s.length < text.length;
  return s.length > 158 ? `${s.slice(0, 156).replace(/\s+\S*$/, '')} …` : more ? `${s} …` : s;
}

/**
 * The block's body for an offer, written by the daemon from the notice it
 * finds on the current branch (and, for one file of a package, from the
 * offer's manifest). The agent never saw the notice itself (a custom entry
 * outside its context); it knows the offer from the id and the paths its own
 * `oh agent … offer` call printed, so the block names those.
 */
function offerBody(card: CardId, path: string | undefined, t: Text) {
  if (card === 'view') return `View you offered: "${t.viewTitle}" (view_id ${view(t).view_id})\nSource: dist/ajat-3/ · opens index.html · 12 files · ${hostSize.view}`;
  if (card === 'pdf') return `File you offered: "${pdf.title}" (offer_id ${pdf.offer_id})\nSource: out/vuosikertomus-2026.pdf · PDF · ${hostSize.pdf}`;
  const p = pkg(t);
  if (path) {
    const item = pkgItems.find((i) => i.path === path)!;
    return `File ${path} in the files you offered as "${p.title}" (offer_id ${p.offer_id})\nSource: liitteet/${path} · ${hostKind[item.kind]} · ${hostSize[path]}`;
  }
  return `Files you offered: "${p.title}" (offer_id ${p.offer_id})\nSource: liitteet/ · 3 files · ${hostSize.pkg}`;
}

function block(x: Target | undefined, text: string, t: Text) {
  if (!x) return text;
  const body = x.type === 'message' ? messageExcerpt(x.text) : offerBody(x.card, x.path, t);
  return `<reply-to entry="${targetKey(x)}">\n${body}\n</reply-to>\n\n${text}`;
}

/** What the quote shows of an offer: mark, title, facts, the time offered. */
function quoteFacts(card: CardId, path: string | undefined, t: Text): {mark: OfferKind; title: string; facts: string; time: string} {
  if (card === 'view') { const v = view(t); return {mark: 'view', title: v.title, facts: viewFacts(v).join(' · '), time: clock(AT.view)}; }
  if (card === 'pdf') return {mark: offerKind(pdf, stateOf('pdf', t)), title: pdf.title, facts: offerFacts(pdf, stateOf('pdf', t)).join(' · '), time: clock(AT.pdf)};
  const p = pkg(t);
  if (path) { const item = pkgItems.find((i) => i.path === path)!; return {mark: item.kind, title: path, facts: [...fileFacts(item), t.inPackage(p.title)].join(' · '), time: clock(AT.pkg)}; }
  return {mark: offerKind(p, stateOf('pkg', t)), title: p.title, facts: offerFacts(p, stateOf('pkg', t)).join(' · '), time: clock(AT.pkg)};
}

// ---------- This round's pieces ----------

/** The offer's quote as the field box's first row (production's quote
 * classes). A: head and title, as a message's quote. B and C: a small card,
 * mark, title and the card's facts. */
function OfferQuote({d, card, path, t, onJump, onRemove}: {d: number; card: CardId; path?: string; t: Text; onJump: () => void; onRemove: () => void}) {
  const q = quoteFacts(card, path, t);
  return (
    // biome-ignore lint/a11y/useSemanticElements: the quote's two controls, as production's.
    <div className="ah-reply-quote or-quote" data-testid="composer-quote" data-card={card} data-path={path} role="group" aria-label={t.replying[path ? 'file' : offerType(card)]}>
      <div className="ah-reply-quote-head">
        <Icon name="reply" />
        <span data-testid="quote-head">{t.replying[path ? 'file' : offerType(card)]}</span>
        <time>{q.time}</time>
        <span className="ah-reply-quote-tools">
          <ControlButton data-testid="quote-remove" aria-label={replyQuoteText[t.lang].remove} variant="quiet" size="row" presentation="messageIcon" onPress={onRemove}>
            <Icon name="cross" />
          </ControlButton>
        </span>
      </div>
      <button type="button" className="ah-reply-jump" data-testid="quote-jump" aria-label={t.jump(q.title)} onClick={onJump}>
        <QuoteBody d={d} q={q} />
      </button>
    </div>
  );
}

function QuoteBody({d, q}: {d: number; q: ReturnType<typeof quoteFacts>}) {
  if (d === A) return <span className="ah-reply-body or-qtitle" data-testid="quote-title">{q.title}</span>;
  return (
    <span className="or-qcard">
      <OfferMark kind={q.mark} size="s" />
      <span className="or-qtext">
        <span className="ah-reply-body or-qtitle" data-testid="quote-title">{q.title}</span>
        <span className="or-qfacts" data-testid="quote-facts">{q.facts}</span>
      </span>
    </span>
  );
}

/** The quote on the person's sent reply to an offer. */
function SentOfferQuote({d, card, path, t, onJump}: {d: number; card: CardId; path?: string; t: Text; onJump: () => void}) {
  const q = quoteFacts(card, path, t);
  return (
    <button type="button" className="ah-reply-sent or-sent" data-testid="sent-quote" data-card={card} data-path={path} aria-label={t.jump(q.title)} onClick={onJump}>
      <span className="ah-reply-quote-head"><Icon name="reply" /><span>{t.replied[path ? 'file' : offerType(card)]}</span></span>
      <QuoteBody d={d} q={q} />
    </button>
  );
}

/** The card's ↩. A and C: Kopioi's pair (production's message corner
 * presentation) over the card's top-right corner, always shown. B: one more
 * icon of the card's own row. */
function CardReply({d, label, active, onReply, path}: {d: number; label: string; active: boolean; onReply: () => void; path?: string}) {
  return (
    <ControlButton data-testid={path ? 'row-reply' : 'card-reply'} data-path={path}
      className={d === B ? 'ah-offer-ib or-reply-ib' : 'ah-reply-corner or-reply-corner'}
      aria-label={label} title={label} aria-pressed={active}
      variant="quiet" size="row" presentation={d === B ? 'icon' : 'messageIcon'} onPress={onReply}>
      <Icon name="reply" />
    </ControlButton>
  );
}

const privateVisibility: ViewVisibility = {public: false, maxDays: 30, onPublic: noop, onDuration: noop};

type CardProps = {d: number; card: CardId; t: Text; open: boolean; onToggle: () => void; active?: Target; onReply: (x: Target) => void};

/** One offer card. Now and A, C: the production card unchanged (A and C
 * add the corner ↩ beside it). B: production's OfferCard and OfferActions
 * with ↩ in the actions' children, otherwise as FileOfferCard and
 * ViewOfferCard draw them. */
function Card({d, card, t, open, onToggle, active, onReply}: CardProps) {
  const isActive = active?.type === 'offer' && active.card === card && !active.path;
  const title = card === 'view' ? t.viewTitle : card === 'pdf' ? pdf.title : t.packageTitle;
  const reply = d === NOW_D ? null : <CardReply d={d} label={t.reply(title)} active={isActive} onReply={() => onReply({type: 'offer', card})} />;
  let node: ReactNode;
  if (d === B) {
    const v = view(t);
    const s = card === 'pdf' ? pdf : pkg(t);
    const st = card === 'view' ? undefined : stateOf(card, t);
    node = card === 'view'
      ? <OfferCard data-testid="view-offer" data-view-id={v.view_id} aria-label={v.title} kind="view" title={v.title} facts={viewFacts(v)} open={open} onToggle={onToggle}
          actions={<OfferActions label={v.title} publish={privateVisibility} onTab={noop} download={viewDownload(v)}>{reply}</OfferActions>} />
      : <OfferCard data-testid="file-offer" data-offer-id={s.offer_id} aria-label={s.title} kind={offerKind(s, st!)} title={s.title} facts={offerFacts(s, st!)} open={open} onToggle={onToggle}
          actions={<OfferActions label={s.title} publish={privateVisibility} onTab={noop} download={offerDownload(s, card === 'pdf' ? pdfItem : undefined)}>{reply}</OfferActions>} />;
  } else {
    node = card === 'view'
      ? <ViewOfferCard view={view(t)} open={open} onToggle={onToggle} onOpenTab={noop} visibility={privateVisibility} />
      : <FileOfferCard offer={card === 'pdf' ? pdf : pkg(t)} state={stateOf(card, t)} open={open} onToggle={onToggle} onTab={noop} visibility={privateVisibility} />;
  }
  return (
    <div className="ah-offer-row">
      <div className="or-cardwrap" data-entry={KEY[card]} data-card={card} data-corner={d === A || d === C || undefined}>
        {node}
        {d === A || d === C ? reply : null}
      </div>
    </div>
  );
}

/** C: one ↩ on each row of the package's file list, placed into production
 * OfferFolder's own icon group through a portal. */
function RowReplies({d, t, active, onReply, panel}: {d: number; t: Text; active?: Target; onReply: (x: Target) => void; panel: React.RefObject<HTMLDivElement | null>}) {
  const [hosts, setHosts] = useState<{path: string; el: HTMLElement}[]>([]);
  const [, setTick] = useState(0);
  useLayoutEffect(() => {
    if (d !== C) return;
    const rows = [...(panel.current?.querySelectorAll<HTMLElement>('.ah-offer-folder-row') ?? [])];
    // The panel may draw its rows a frame later; look again then.
    if (!rows.length) { const f = requestAnimationFrame(() => setTick((n) => n + 1)); return () => cancelAnimationFrame(f); }
    const next = rows.map((row) => {
      const path = row.querySelector<HTMLElement>('[data-path]')!.dataset.path!;
      let el = row.querySelector<HTMLElement>(':scope .or-row-host');
      if (!el) { el = document.createElement('span'); el.className = 'or-row-host'; row.querySelector('.ah-offer-icons')!.append(el); }
      return {path, el};
    });
    if (next.length !== hosts.length || next.some((h, i) => h.el !== hosts[i]?.el)) setHosts(next);
  });
  return <>{hosts.map(({path, el}) => createPortal(
    <CardReply d={A} label={t.reply(path)} path={path} active={active?.type === 'offer' && active.card === 'pkg' && active.path === path}
      onReply={() => onReply({type: 'offer', card: 'pkg', path})} />, el, path))}</>;
}

// ---------- The conversation ----------

type Sent = {id: string; text: string; target?: Target; at: number};

function initialSent(d: number, t: Text): Sent[] {
  return [{id: 'u2', at: AT.u2, text: d === NOW_D ? t.uNow : t.u[2], target: d === NOW_D ? undefined : {type: 'offer', card: 'pdf'}}];
}

function Conversation({d}: {d: number}) {
  const {lang} = useReview();
  const t = TEXT[lang];
  const desk = () => matchMedia('(min-width: 801px)').matches;
  const [target, setTarget] = useState<Target | undefined>(d === NOW_D ? undefined : {type: 'offer', card: 'view'});
  const [draft, setDraft] = useState(d === NOW_D ? '' : t.draft);
  const [sent, setSent] = useState<Sent[]>(() => initialSent(d, t));
  // C opens the package beside the conversation on a desktop, so its rows' ↩ show at once.
  const [open, setOpen] = useState<CardId | undefined>(() => d === C && desk() ? 'pkg' : undefined);
  const frame = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const stateLabel = conversationEventsText[lang].toolStates;

  const flash = (el: Element | null | undefined, attr: string) => {
    if (!el) return;
    el.scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
    el.setAttribute(attr, '');
    window.setTimeout(() => el.removeAttribute(attr), 1600);
  };
  const jump = (key: string) => {
    const box = frame.current?.querySelector(`[data-entry="${key}"]`);
    if (box?.matches('.or-cardwrap')) flash(box.querySelector('.ah-offer'), 'data-located');
    else flash(box, 'data-flash');
  };
  const reply = (x: Target) => {
    setTarget(x);
    // On a phone the panel covers the conversation; a reply goes back to the field.
    if (!desk()) setOpen(undefined);
    requestAnimationFrame(() => frame.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
  };
  const control: ReplyControl = {
    active: target?.type === 'message' ? target.key : undefined,
    onReply: (key) => {
      const r = [[KEY.r0, t.r[0], AT.r0], [KEY.r1, t.r[1], AT.r1], [KEY.r2, t.r[2], AT.r2]].find((m) => m[0] === key)!;
      reply({type: 'message', key, text: r[1] as string, at: r[2] as number});
    },
    onJump: jump,
  };
  const toggle = (card: CardId) => () => setOpen((o) => o === card ? undefined : card);

  const tool = (k: string, name: string, path: string, ms: number): TurnStep => ({kind: 'tool', key: k, at: ms,
    node: <div className="ah-ordered-blocks"><div><ToolRow name={name} targetText={path} statusLabel={stateLabel.succeeded} state="succeeded" expanded={false} onToggle={noop} /></div></div>});
  const say = (k: string, i: number, key: string, ms: number): TurnStep => ({kind: 'text', key: k, at: ms, text: t.r[i], replyEntry: key, node: <Markdown text={t.r[i]} />});
  const user = (id: string, text: string, ms: number, x?: Target) => ({id, kind: 'user', content: (
    <div className="or-user" data-entry={id} data-testid="user-row">
      <UserMessage sourceText={text} time={clock(ms)} onCopy={noop}
        quote={!x ? undefined : x.type === 'message'
          ? <SentQuote entryKey={x.key} excerpt={messageExcerpt(x.text)} />
          : <SentOfferQuote d={d} card={x.card} path={x.path} t={t} onJump={() => jump(KEY[x.card])} />} />
    </div>)});
  const card = (c: CardId) => ({id: KEY[c], kind: 'notice', content: <Card d={d} card={c} t={t} open={open === c} onToggle={toggle(c)} active={target} onReply={reply} />});
  const turn = (id: string, key: string, steps: TurnStep[], start: number) => ({id, kind: 'assistant', content: (
    <div data-entry={key} className="or-turn"><AgentTurn steps={steps} startedAt={start} /></div>)});
  // As HistoryView orders them: a notice is pushed when it is read, its turn when the turn ends.
  const items = [
    user('u0', t.u[0], AT.u0),
    card('view'),
    turn('t0', KEY.r0, [tool('0a', 'bash', 'node build.mjs rounds/ajat-3', at('09:18:00')), tool('0b', 'bash', 'oh agent view offer --current --source dist/ajat-3', AT.view), say('0c', 0, KEY.r0, AT.r0)], AT.u0),
    user('u1', t.u[1], AT.u1),
    card('pdf'), card('pkg'),
    turn('t1', KEY.r1, [tool('1a', 'bash', 'typst compile vuosikertomus.typ out/vuosikertomus-2026.pdf', at('09:30:00')), tool('1b', 'bash', 'oh agent file offer --current --source out/vuosikertomus-2026.pdf', AT.pdf), tool('1c', 'bash', 'oh agent file offer --current --source liitteet --title "…"', AT.pkg), say('1d', 1, KEY.r1, AT.r1)], AT.u1),
    ...sent.slice(0, 1).map((s) => user(s.id, s.text, s.at, s.target)),
    turn('t2', KEY.r2, [tool('2a', 'edit', 'vuosikertomus.typ', at('09:41:00')), say('2b', 2, KEY.r2, AT.r2)], AT.u2),
    ...sent.slice(1).map((s) => user(s.id, s.text, s.at, s.target)),
  ];
  useLayoutEffect(() => {
    let el: HTMLElement | null = frame.current?.querySelector('[data-testid="conversation-timeline"]') ?? null;
    while (el && !(el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    el?.scrollTo({top: 1e6});
  }, [sent.length]);

  const fieldQuote = !target ? undefined : target.type === 'message'
    ? <ComposerQuote excerpt={messageExcerpt(target.text)} time={clock(target.at)} onJump={() => jump(target.key)} onRemove={() => setTarget(undefined)} />
    : <OfferQuote d={d} card={target.card} path={target.path} t={t} onJump={() => jump(KEY[target.card])} onRemove={() => setTarget(undefined)} />;
  const send = (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body) return;
    setSent((s) => [...s, {id: `s${s.length}`, text: body, target, at: AT.r2 + 60000 * s.length}]);
    setTarget(undefined); setDraft('');
  };

  let pane: ReactNode = null;
  if (open === 'pkg') {
    pane = (
      <div className="or-pane" ref={panel} data-testid="pane">
        <OfferPanel offer={pkg(t)} state={stateOf('pkg', t)} expanded={false} onToggleExpanded={noop} onSub={noop} onTab={noop} onClose={() => setOpen(undefined)} visibility={privateVisibility} />
        <p className="or-pane-note">{t.paneFolderNote}</p>
        <RowReplies d={d} t={t} active={target} onReply={reply} panel={panel} />
      </div>
    );
  } else if (open) {
    const q = quoteFacts(open, undefined, t);
    pane = (
      <div className="or-pane" data-testid="pane">
        <section className="ah-view-pane ah-offer-pane">
          <ViewHeader kind={q.mark} title={q.title} facts={q.facts} expanded={false} onToggleExpanded={noop} onClose={() => setOpen(undefined)} />
          <p className="or-pane-note">{t.pane}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="or-live">
      <div className="or-frame" ref={frame} data-pane={open ? 'open' : undefined}>
        <ReplyContext.Provider value={control}>
          <div className="or-convo">
            <ConversationFrame>
              <AgentHeader title={t.convTitle} workspaceLabel={t.ws} workspaceHref={`/workspaces/ws_${t.ws}`}
                activityLabel={t.activityIdle} controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
              <ConversationStream>
                <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
              </ConversationStream>
              <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="follow_up" onModeChange={noop}
                onSendNow={send} onSteer={noop} onFollowUp={noop} csrf="prototype" fieldQuote={fieldQuote}
                modelPicker={<button type="button" className="md-pill">medium</button>} />
            </ConversationFrame>
          </div>
          {pane}
        </ReplyContext.Provider>
      </div>
      <AgentGets t={t} sent={sent} target={target} draft={draft} />
    </div>
  );
}

/** The literal text Pi receives for each reply, the pending one first. */
function AgentGets({t, sent, target, draft}: {t: Text; sent: Sent[]; target?: Target; draft: string}) {
  return (
    <aside className="or-agent" data-testid="agent-gets" aria-label={t.agentHead}>
      <h2>{t.agentHead}</h2>
      <p className="or-agent-note">{t.agentNote}</p>
      <h3>{t.agentPending}</h3>
      {target
        ? <pre data-testid="agent-pending">{block(target, draft.trim() || t.agentDraft, t)}</pre>
        : <p className="or-agent-note" data-testid="agent-pending-none">{t.agentEmpty}</p>}
      <h3>{t.agentSent}</h3>
      {[...sent].reverse().map((s) => <pre key={s.id} data-testid="agent-sent">{block(s.target, s.text, t)}</pre>)}
    </aside>
  );
}

// ---------- The page ----------

function App({direction}: {direction: number}) {
  const {theme, lang} = useReview();
  const t = TEXT[lang];
  const [generation, setGeneration] = useState(0);
  const [all, setAll] = useState(false);
  useLayoutEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useLayoutEffect(() => {
    setPersonalLanguage(lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.proto-picker-item').forEach((b, i) => { b.textContent = t.picker[i].replaceAll(' ', ' '); });
  }, [lang]);
  return (
    <div className={`or-review variant-${direction}`} data-direction={direction}>
      <header className="or-bar" data-all={all || undefined}>
        <div className="or-controls">
          <strong>{t.title}</strong>
          <label>{t.theme} <select id="theme" value={theme} onChange={(e) => setReview({theme: e.target.value})}>
            {(['light', 'dark', 'contrast'] as const).map((v) => <option key={v} value={v}>{t.themes[v]}</option>)}</select></label>
          <label>{t.language} <select id="lang" value={lang} onChange={(e) => setReview({lang: e.target.value as Lang})}>
            <option value="fi">suomi</option><option value="en">English</option></select></label>
          <button type="button" data-testid="reset" onClick={() => setGeneration((g) => g + 1)}>{t.reset}</button>
          <span className="or-hint">{t.hint}</span>
        </div>
        <button type="button" className="or-all-toggle" data-testid="all" aria-expanded={all} onClick={() => setAll((v) => !v)}>{all ? t.fewer : t.all}</button>
        <div className="or-study" data-testid="lines">
          <h2>{t.axis}</h2>
          <ol>{t.lines.map((l, i) => <li key={i} aria-current={i === direction ? 'true' : undefined}>{l}</li>)}</ol>
          <p className="or-recommend">{t.recommend}</p>
        </div>
      </header>
      <StatusBellProvider items={[]}>
        <MemoryRouter key={`${generation}-${lang}`} initialEntries={['/c/1']}>
          <Conversation key={`${generation}-${direction}-${lang}`} d={direction} />
        </MemoryRouter>
      </StatusBellProvider>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
// The shared picker wiring unchanged: its stage writes become React commits.
const stageSink = {set innerHTML(v: React.ReactNode) { flushSync(() => root.render(v === '' ? null : v)); }};
const variants = TEXT.fi.picker.map((_, direction) => () => <App key="app" direction={direction} />);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
TEXT.fi.picker.forEach((n, i) => {
  const button = document.createElement('button');
  button.className = 'proto-picker-item'; button.textContent = n.replaceAll(' ', ' ');
  if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); }
  picker.append(button);
});
document.body.append(picker);
// A Habitat view is an opaque-origin sandbox: ?v= bookkeeping stays in memory.
let memorySearch = '';
const memoryLocation = {get search() { return memorySearch; }, toString: () => `about:blank${memorySearch}`};
const memoryHistory = {replaceState: (_s: unknown, _t: string, url: URL) => { memorySearch = url.search; }};
new Function('stage', 'variants', 'location', 'history', pickerSource)(stageSink, variants, memoryLocation, memoryHistory);
