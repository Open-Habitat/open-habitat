import React, {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import { initialTheme } from "../../lib/view-theme.js";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountShelf } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  ToolRow,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import {
  ControlButton,
  Segmented,
} from "../../../../web/src/components/ControlElements";
import "../../../../web/src/components/HelperArchive.css";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  ConversationLine,
  type ConversationLineFact,
  ParticipantMessage,
  PersonAvatar,
  SharedCard,
  SharedViewer,
} from "../../../../web/src/components/Multiplayer";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  AppShell,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { PageNotice } from "../../../../web/src/components/PageNotice";
import {
  Checkbox,
  Select,
} from "../../../../web/src/components/Primitives";
import "../../../../web/src/components/Settings.css";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { WorkspaceActions } from "../../../../web/src/components/WorkspaceActions";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { first, NAMES, T, type Who } from "./text";
import "./round.css";

// multiplayer-own-conversation-kind (Jari 24.11. and 28.11.2026): a
// multiplayer conversation is its own kind, started with Moninpeli +, always
// on an API-key model. One round shows all five areas — configuration,
// starting, the owner's view, the participant's view and the corner cases —
// under a Näkymä selector; the three directions differ only in where
// Moninpeli + sits and how it looks (the issue leaves that to the prototype).
// Built on production pieces: AppShell, WorkspaceRail, AgentNavItem,
// AgentHeader, ConversationFrame, ConversationTimeline, UserMessage,
// AssistantMessage, ToolRow, Composer, WorkspaceActions, PageNotice, the
// settings rows (Settings.css), Segmented, Select, Checkbox,
// production's dialog structure, and the shipped multiplayer pieces
// (PersonAvatar, ParticipantMessage, ConversationLine, SharedCard and the
// ah-mp-band / ah-mp-strip / ah-mp-invite classes). The round's own parts are
// Moninpeli + in its three placements, the start and convert dialogs, the
// Moninpeli settings rows, the multiplayer mark and the corner-case texts.
setPersonalLanguage("fi");

const directions = ["1 Nimetty painike", "2 Ikoni rivissä", "3 Tyhjässä"];
const params = new URLSearchParams(location.search);
const noop = () => {};
const REAL_NOW = Date.now();
let reviewTheme = initialTheme() as "light" | "dark" | "contrast";

type Scene = "config" | "start" | "owner" | "guest" | "corner";
type Corner = "removed" | "away" | "nokey" | "crowd" | "archived";
type KeyState = "own" | "server" | "none";
type ModelId = "gpt-own" | "mini-own" | "claude-server";
const scenes: Scene[] = ["config", "start", "owner", "guest", "corner"];
const corners: Corner[] = ["removed", "away", "nokey", "crowd", "archived"];
const pick = <V extends string>(v: string | null, all: readonly V[], d: V) =>
  (all as readonly string[]).includes(v ?? "") ? (v as V) : d;

const modelsFor = (k: KeyState): ModelId[] =>
  k === "own" ? ["gpt-own", "mini-own"] : k === "server" ? ["claude-server"] : [];

// ---------- The synthetic world ----------

type Op = { tool: string; target: string; decision?: "allow" | "deny" };
type CardState = "waiting" | "each" | "allowed" | "declined";
type Item =
  | { k: "msg"; id: string; who: Who; text: string; at: string; held?: boolean }
  | {
      k: "reply";
      id: string;
      text: string;
      at: string;
      tools: { tool: string; target: string; state: "succeeded" | "blocked" }[];
    }
  | { k: "line"; id: string; text?: string; fact?: ConversationLineFact }
  | {
      k: "card";
      id: string;
      who: Who;
      ops: Op[];
      state: CardState;
      waited?: string;
    };
type Member = { who: Who; state: "here" | "away" | "invited" };
type World = {
  items: Item[];
  members: Member[];
  seq: number;
  minute: number;
  ownerHere: boolean;
  archived: boolean;
  keyBroken: boolean;
  model: ModelId;
};

const FILE = "content/events/kevatkokous.md";
const opsV1 = (): Op[] => [
  { tool: "edit", target: FILE },
  { tool: "bash", target: "npm run deploy" },
];
const clock = (w: World) => `14.${String(w.minute).padStart(2, "0")}`;
const fact = (
  w: World,
  kind: ConversationLineFact["kind"],
  who: Who,
  extra: Partial<ConversationLineFact> = {},
): Item => ({
  k: "line",
  id: `l${w.seq}`,
  fact: { line_id: `l${w.seq}`, kind, subject: who, display_name: first(who), ...extra },
});

function mpWorld(model: ModelId = "gpt-own"): World {
  const w: World = {
    seq: 20,
    minute: 14,
    ownerHere: true,
    archived: false,
    keyBroken: false,
    model,
    members: [
      { who: "ville", state: "here" },
      { who: "maija", state: "here" },
    ],
    items: [],
  };
  w.items = [
    { k: "line", id: "l0", text: T.lineStarted(T.modelShort[model]) },
    { k: "msg", id: "a1", who: "aino", text: T.c.a1, at: "14.02" },
    {
      k: "reply",
      id: "r1",
      text: T.c.r1,
      at: "14.03",
      tools: [
        { tool: "edit", target: FILE, state: "succeeded" },
        { tool: "bash", target: "npm run build", state: "succeeded" },
      ],
    },
    { k: "line", id: "l1", fact: { line_id: "l1", kind: "membership", event: "joined", subject: "ville", display_name: "Ville" } },
    { k: "line", id: "l2", fact: { line_id: "l2", kind: "membership", event: "joined", subject: "maija", display_name: "Maija" } },
    { k: "msg", id: "v1", who: "ville", text: T.c.v1, at: "14.11" },
    { k: "reply", id: "rv1", text: T.c.rv1, at: "14.11", tools: [] },
    { k: "card", id: "c1", who: "ville", ops: opsV1(), state: "waiting" },
    { k: "msg", id: "m1", who: "maija", text: T.c.m1, at: "14.13" },
    { k: "reply", id: "rm1", text: T.c.rm1, at: "14.13", tools: [] },
  ];
  return w;
}

const crowdPeople: Who[] = ["ville", "maija", "pekka", "sanna", "juha", "liisa", "mikko", "tiina", "antti", "elina", "kalle"];
function crowdWorld(): World {
  const w = mpWorld();
  w.members = crowdPeople.map((who, i) => ({
    who,
    state: i < 8 ? "here" : i < 10 ? "away" : "invited",
  }));
  const speakers: Who[] = ["sanna", "juha", "liisa", "mikko"];
  w.items = [
    ...w.items.slice(0, 3),
    ...speakers.map((who, i): Item => ({ k: "msg", id: `cw${i}`, who, text: T.c.crowd[i], at: `14.0${5 + i}` })),
    { k: "reply", id: "cwr", text: T.c.crowdReply, at: "14.09", tools: [] },
    { k: "card", id: "c2", who: "liisa", ops: [{ tool: "edit", target: FILE }], state: "waiting" },
    ...w.items.slice(5),
  ];
  return w;
}

function cornerWorld(c: Corner): World {
  if (c === "crowd") return crowdWorld();
  const w = mpWorld();
  if (c === "removed") {
    w.members = w.members.filter((m) => m.who !== "ville");
    w.items.push({ k: "line", id: "lr", fact: { line_id: "lr", kind: "membership", event: "removed", subject: "ville", display_name: "Ville" } });
  }
  if (c === "away") {
    w.ownerHere = false;
    const card = w.items.find((i) => i.k === "card") as Extract<Item, { k: "card" }>;
    card.waited = "2 h";
  }
  if (c === "nokey") {
    w.keyBroken = true;
    w.items.push({ k: "msg", id: "vh", who: "ville", text: T.c.v2, at: "14.20", held: true });
  }
  if (c === "archived") {
    w.archived = true;
    w.items.push({ k: "line", id: "la", text: T.lineArchived });
  }
  return w;
}

const ordinaryItems: Item[] = [
  { k: "msg", id: "o1", who: "aino", text: T.c.o1, at: "13.40" },
  { k: "reply", id: "ro1", text: T.c.ro1, at: "13.42", tools: [{ tool: "edit", target: "data/jasenet.csv", state: "succeeded" }] },
];

// Transitions.
const bump = (w: World): World => ({ ...w, seq: w.seq + 1, minute: w.minute + 1 });
function settleCard(w: World, id: string, state: CardState, decisions?: ("allow" | "deny")[]): World {
  const card = w.items.find((i) => i.id === id) as Extract<Item, { k: "card" }>;
  const ops = card.ops.map((o, i) => ({ ...o, decision: decisions?.[i] ?? (state === "allowed" ? "allow" : state === "declined" ? "deny" : o.decision) }));
  let x: World = { ...w, items: w.items.map((i) => (i.id === id ? { ...card, ops, state } : i)) };
  x = bump(x);
  if (state === "declined") return { ...x, items: [...x.items, fact(x, "declined", card.who)] };
  const each = !!decisions;
  x = { ...x, items: [...x.items, fact(x, "continue", card.who, { mode: each ? "approve_each" : "tools" })] };
  x = bump(x);
  const allAllowed = ops.every((o) => o.decision === "allow");
  return {
    ...x,
    items: [
      ...x.items,
      {
        k: "reply",
        id: `r${x.seq}`,
        text: allAllowed ? T.c.released : T.c.partial,
        at: clock(x),
        tools: ops.map((o) => ({ tool: o.tool, target: o.target, state: o.decision === "allow" ? "succeeded" : "blocked" })),
      },
    ],
  };
}
function ownerWrites(w: World, text: string): World {
  const x = bump(w);
  if (x.keyBroken) return { ...x, items: [...x.items, { k: "msg", id: `a${x.seq}`, who: "aino", text, at: clock(x), held: true }] };
  return {
    ...x,
    items: [
      ...x.items,
      { k: "msg", id: `a${x.seq}`, who: "aino", text, at: clock(x) },
      { k: "reply", id: `r${x.seq}`, text: T.c.ownerReply, at: clock(x), tools: [{ tool: "edit", target: FILE, state: "succeeded" }] },
    ],
  };
}
function guestWrites(w: World, who: Who, text: string, answer: string, needsTools: boolean): World {
  const x = bump(w);
  if (x.keyBroken) return { ...x, items: [...x.items, { k: "msg", id: `g${x.seq}`, who, text, at: clock(x), held: true }] };
  const items: Item[] = [
    { k: "msg", id: `g${x.seq}`, who, text, at: clock(x) },
    { k: "reply", id: `gr${x.seq}`, text: answer, at: clock(x), tools: [] },
  ];
  if (needsTools) items.push({ k: "card", id: `gc${x.seq}`, who, ops: [{ tool: "edit", target: FILE }], state: "waiting" });
  return { ...x, items: [...x.items, ...items] };
}

// ---------- Small pieces ----------

const Dir = React.createContext(0);

function Line({ children }: { children: ReactNode }) {
  return (
    <p className="ah-mp-line" role="note" data-testid="habitat-line">
      <span className="ah-mp-line-mark" aria-hidden="true" />
      {children}
    </p>
  );
}

function MpMark() {
  return (
    <span className="mp1-mark" data-testid="mp-mark">
      <Icon name="users" aria-hidden="true" />
      <span className="mp1-mark-text">{T.mpMark}</span>
    </span>
  );
}

/** Moninpeli + in the direction's look. `place` says where it is. */
function MpButton({ place, onPress }: { place: "workspace" | "conversation"; onPress: () => void }) {
  const d = React.useContext(Dir);
  const label = place === "workspace" ? T.mpButtonLabel : T.mpButtonConvert;
  if (d === 1)
    return (
      <ControlButton
        data-testid="mp-start"
        size="row"
        variant={place === "workspace" ? "secondary" : "quiet"}
        presentation="icon"
        className="mp1-icon-button"
        aria-label={label}
        title={label}
        tooltip={label}
        onPress={onPress}
      >
        <span className="mp1-users-plus" aria-hidden="true">
          <Icon name="users" />
          <Icon name="plus" />
        </span>
      </ControlButton>
    );
  return (
    <ControlButton
      data-testid="mp-start"
      size="row"
      variant={place === "workspace" ? "secondary" : "quiet"}
      aria-label={label}
      title={label}
      onPress={onPress}
    >
      <Icon name="plus" />
      {T.mpButton}
    </ControlButton>
  );
}

function Window({ label, testId, onClose, children, alert = false }: { label: string; testId: string; onClose: () => void; children: ReactNode; alert?: boolean }) {
  return (
    <ModalOverlay isOpen isDismissable className="ah-overlay" onOpenChange={(o) => !o && onClose()}>
      <Modal className="ah-modal">
        <AriaDialog className="ah-dialog ah-helper-dialog mp1-dialog" role={alert ? "alertdialog" : "dialog"} aria-label={label} data-testid={testId}>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function NoKeyDialog({ onClose, onSettings }: { onClose: () => void; onSettings: () => void }) {
  return (
    <Window label={T.noKeyTitle} testId="nokey-dialog" onClose={onClose} alert>
      <Heading slot="title">{T.noKeyTitle}</Heading>
      <p>{T.noKeyBody}</p>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="nokey-cancel" onPress={onClose}>
          {T.cancel}
        </ControlButton>
        <ControlButton size="row" variant="primary" data-testid="nokey-settings" autoFocus onPress={onSettings}>
          {T.openAiSettings}
        </ControlButton>
      </div>
    </Window>
  );
}

const invitable: Who[] = ["ville", "maija", "pekka"];

function StartDialog({ convert, keys, onClose, onStart }: { convert: boolean; keys: KeyState; onClose: () => void; onStart: (model: ModelId, who: Who[]) => void }) {
  const models = modelsFor(keys);
  const [model, setModel] = useState<ModelId>(models[0]);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<Who[]>(["ville", "maija"]);
  const title = convert ? T.convertTitle : T.startTitle;
  return (
    <Window label={title} testId="start-dialog" onClose={onClose}>
      <Heading slot="title">{title}</Heading>
      <p>{convert ? T.convertLead : T.startLead}</p>
      {convert ? null : (
        <label className="ah-field">
          <span className="ah-field-label">{T.nameLabel}</span>
          <input className="ah-text-input mp1-input" data-testid="start-name" value={name} placeholder={T.namePlaceholder} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <div data-testid="start-model">
        <Select label={T.modelLabel} value={model} options={models.map((m) => ({ value: m, label: T.models[m] }))} onChange={setModel} />
      </div>
      <p className="mp1-help" data-testid="start-model-help">
        {convert ? T.convertModel(T.ordinaryModel, T.modelShort[model]) : T.modelHelp}
      </p>
      <fieldset className="mp1-invite" data-testid="start-invite">
        <legend className="ah-field-label">{T.inviteLabel}</legend>
        {invitable.map((who) => (
          <div key={who} className="mp1-invite-row">
            <PersonAvatar subject={who} name={NAMES[who]} />
            <Checkbox
              data-testid={`start-invite-${who}`}
              label={NAMES[who]}
              checked={chosen.includes(who)}
              onChange={(on) => setChosen(on ? [...chosen, who] : chosen.filter((c) => c !== who))}
            />
          </div>
        ))}
        <p className="mp1-help">{T.inviteLater}</p>
      </fieldset>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="start-cancel" onPress={onClose}>
          {T.cancel}
        </ControlButton>
        <ControlButton size="row" variant="primary" data-testid="start-confirm" onPress={() => onStart(model, chosen)}>
          {convert ? T.convert : T.start}
        </ControlButton>
      </div>
    </Window>
  );
}

function PeoplePanel({ w, onClose, onRemove }: { w: World; onClose: () => void; onRemove?: (who: Who) => void }) {
  const state = (m: Member) => (m.state === "here" ? T.here : m.state === "away" ? T.away : T.invited);
  return (
    <Window label={T.peopleTitle} testId="people-panel" onClose={onClose}>
      <Heading slot="title">{T.peopleTitle}</Heading>
      <p>{T.peopleLead}</p>
      <ul className="ah-mp-list mp1-people">
        <li data-testid="people-member" data-subject="aino">
          <PersonAvatar subject="aino" name={NAMES.aino} presence={w.ownerHere ? "here" : "away"} />
          <span className="ah-mp-person">
            <strong>{NAMES.aino}</strong>
            <span>{T.owner}</span>
          </span>
        </li>
        {w.members.map((m) => (
          <li key={m.who} data-testid="people-member" data-subject={m.who}>
            <PersonAvatar subject={m.who} name={NAMES[m.who]} presence={m.state} />
            <span className="ah-mp-person">
              <strong>{NAMES[m.who]}</strong>
              <span>{state(m)}</span>
            </span>
            {onRemove ? (
              <span className="ah-mp-row-actions">
                <ControlButton size="inline" variant="quiet" data-testid={`remove-${m.who}`} onPress={() => onRemove(m.who)}>
                  {T.removeFrom}
                </ControlButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="ah-dialog-actions">
        <ControlButton size="row" variant="quiet" data-testid="people-close" onPress={onClose}>
          {T.close}
        </ControlButton>
      </div>
    </Window>
  );
}

/** The people row under the header, in production's ah-mp-band look. */
function PeopleBand({ w, onOpen, owner }: { w: World; onOpen: () => void; owner: boolean }) {
  const everyone: Member[] = [{ who: "aino", state: w.ownerHere ? "here" : "away" }, ...w.members];
  const here = everyone.filter((m) => m.state === "here").length;
  const shown = everyone.slice(0, 5);
  const rest = everyone.length - shown.length;
  return (
    <div className="ah-mp-band mp1-band" data-testid="people-band">
      <button type="button" className="ah-mp-band-people" data-testid="people-band-open" aria-label={T.peopleTitle} onClick={onOpen}>
        <span className="ah-mp-stack">
          {shown.map((m) => (
            <PersonAvatar key={m.who} subject={m.who} name={NAMES[m.who]} presence={m.state} />
          ))}
        </span>
        {rest > 0 ? (
          <span className="mp1-more" data-testid="people-more">
            {T.more(rest)}
          </span>
        ) : null}
        <span data-testid="people-here">{T.present(here)}</span>
      </button>
      {owner ? (
        <ControlButton data-testid="people-invite" size="row" variant="quiet" onPress={noop} isDisabled={w.archived}>
          {T.invite}
        </ControlButton>
      ) : null}
    </div>
  );
}

// ---------- The thread ----------

type Acts = {
  allowAll: (id: string) => void;
  each: (id: string) => void;
  decline: (id: string) => void;
  decide: (id: string, index: number, d: "allow" | "deny") => void;
  cancelHeld?: (id: string) => void;
};

function Card({ c, w, acts, viewer }: { c: Extract<Item, { k: "card" }>; w: World; acts?: Acts; viewer?: Who }) {
  const gone = !w.members.some((m) => m.who === c.who);
  const open = c.state === "waiting" || c.state === "each";
  // Only the owner acts on the card; a participant reads its state.
  const owner = !viewer;
  const actionable = owner && !!acts && open && !w.archived;
  const own = viewer === c.who;
  return (
    <SharedCard
      testId="waiting-card"
      title={T.waitingTitle}
      subtitle={
        <>
          {T.requester(own ? `${first(c.who)} (${T.you})` : first(c.who))}
          {c.waited ? ` · ${T.waitedFor(c.waited)}` : ""}
        </>
      }
      tone={open ? "attention" : "neutral"}
      subject={c.who}
      state={c.state}
      actions={
        actionable && c.state === "waiting" ? (
          <>
            <ControlButton size="row" variant="primary" data-testid="card-allow-all" onPress={() => acts.allowAll(c.id)}>
              {T.allowAll}
            </ControlButton>
            <ControlButton size="row" variant="secondary" data-testid="card-each" onPress={() => acts.each(c.id)}>
              {T.approveEach}
            </ControlButton>
            <ControlButton size="row" variant="quiet" data-testid="card-decline" onPress={() => acts.decline(c.id)}>
              {T.decline}
            </ControlButton>
          </>
        ) : undefined
      }
    >
      {owner && open && gone ? (
        <p className="mp1-gone" data-testid="card-removed-note">
          {T.removedNote(first(c.who))}
        </p>
      ) : null}
      {owner && open ? <p>{T.waitingLead}</p> : null}
      <ul className="ah-mp-rows">
        {c.ops.map((o, i) => (
          <li key={`${o.tool}${i}`} data-answer={o.decision === "allow" ? "allowed" : o.decision === "deny" ? "denied" : undefined} data-testid="card-op">
            <code>
              {o.tool} {o.target}
            </code>
            {o.decision ? (
              <span>{o.decision === "allow" ? T.allowed : T.denied}</span>
            ) : actionable && c.state === "each" ? (
              <span className="mp1-op-actions">
                <ControlButton size="inline" variant="secondary" data-testid={`op-allow-${i}`} onPress={() => acts.decide(c.id, i, "allow")}>
                  {T.allow}
                </ControlButton>
                <ControlButton size="inline" variant="quiet" data-testid={`op-deny-${i}`} onPress={() => acts.decide(c.id, i, "deny")}>
                  {T.deny}
                </ControlButton>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </SharedCard>
  );
}

function Thread({ items, w, acts, viewer }: { items: Item[]; w: World; acts?: Acts; viewer?: Who }) {
  const rows: { id: string; kind?: string; content: ReactNode }[] = [];
  for (const i of items) {
    if (i.k === "msg") {
      const ownerOwn = i.who === "aino" && !viewer;
      const body = ownerOwn ? (
        <UserMessage sourceText={i.text} onCopy={noop} time={i.at} delivery={i.held ? "pending" : undefined}>
          <Markdown text={i.text} />
        </UserMessage>
      ) : (
        <ParticipantMessage
          fact={{ message_id: i.id, subject: i.who, display_name: viewer && i.who !== viewer ? NAMES[i.who] : i.who === viewer ? first(i.who) : NAMES[i.who], role: (i.who === "aino" ? "owner" : "participant") as "participant", text: i.text }}
          at={i.at}
        />
      );
      rows.push({
        id: i.id,
        kind: ownerOwn ? "user" : undefined,
        content: (
          <div className="mp1-msg" data-testid="message" data-who={i.who} data-held={i.held || undefined}>
            {body}
            {i.held ? (
              <p className="mp1-held" data-testid="held">
                {T.heldTitle}
                {acts?.cancelHeld && i.who === (viewer ?? "aino") ? (
                  <ControlButton size="inline" variant="quiet" data-testid="held-cancel" onPress={() => acts.cancelHeld?.(i.id)}>
                    {T.cancelHeld}
                  </ControlButton>
                ) : null}
              </p>
            ) : null}
          </div>
        ),
      });
      continue;
    }
    if (i.k === "line") {
      rows.push({ id: i.id, content: i.fact ? <ConversationLine fact={i.fact} /> : <Line>{i.text}</Line> });
      continue;
    }
    if (i.k === "card") {
      rows.push({ id: i.id, content: <Card c={i} w={w} acts={acts} viewer={viewer} /> });
      continue;
    }
    i.tools.forEach((tool, n) =>
      rows.push({
        id: `${i.id}-t${n}`,
        kind: "tool",
        content: (
          <ToolRow name={tool.tool} targetText={tool.target} statusLabel={tool.state === "blocked" ? T.denied : T.tool} state={tool.state} expanded={false} onToggle={noop} />
        ),
      }),
    );
    rows.push({
      id: i.id,
      kind: "assistant",
      content: (
        <div data-testid="agent-reply">
          <AssistantMessage streamState="complete" time={i.at} onCopy={noop}>
            <Markdown text={i.text} />
          </AssistantMessage>
        </div>
      ),
    });
  }
  return (
    <ConversationTimeline
      state="ready"
      items={rows.map((r) => ({ ...r, content: <div data-item={r.id}>{r.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

function useActs(setW: React.Dispatch<React.SetStateAction<World>>): Acts {
  return {
    allowAll: (id) => setW((x) => settleCard(x, id, "allowed")),
    decline: (id) => setW((x) => settleCard(x, id, "declined")),
    each: (id) => setW((x) => ({ ...x, items: x.items.map((i) => (i.id === id && i.k === "card" ? { ...i, state: "each" } : i)) })),
    decide: (id, index, dec) =>
      setW((x) => {
        const card = x.items.find((i) => i.id === id) as Extract<Item, { k: "card" }>;
        const ops = card.ops.map((o, n) => (n === index ? { ...o, decision: dec } : o));
        if (ops.every((o) => o.decision)) return settleCard(x, id, "allowed", ops.map((o) => o.decision!));
        return { ...x, items: x.items.map((i) => (i.id === id ? { ...card, ops } : i)) };
      }),
    cancelHeld: (id) => setW((x) => ({ ...x, items: x.items.filter((i) => i.id !== id) })),
  };
}

// ---------- The shell ----------

function Rail({ who, rows, onRow, shared }: { who: Who; rows: AgentNavModel[]; onRow?: (id: string) => void; shared?: AgentNavModel[] }) {
  const status = useText(statusText);
  const id = useId();
  const sid = useId();
  return (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel={status.connected}
      connectionTone="success"
      filterValue=""
      resultSummary="2"
      listState="ready"
      adaptive={{ places: [{ id: "home", testId: "home-link", label: "Etusivu", href: "/workspaces" }], search: { label: "Hae", keyHint: "/", onOpen: noop }, filter: false }}
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: NAMES[who], email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
      now={
        <>
          {shared?.length ? (
            <section className="ah-now" data-testid="rail-shared" aria-labelledby={sid}>
              <h2 className="ah-rail-section-head" id={sid}>
                {T.sharedWithYou}
              </h2>
              <ul>
                {shared.map((r) => (
                  <AgentNavItem key={r.agentId} {...r} now={REAL_NOW} />
                ))}
              </ul>
            </section>
          ) : null}
          {rows.length ? (
            // biome-ignore lint/a11y/noStaticElementInteractions: the rows' own links are the controls; this only routes them in the round.
            <section
              className="ah-now"
              data-testid="rail-conversations"
              aria-labelledby={id}
              onClickCapture={(e) => {
                const li = (e.target as HTMLElement).closest<HTMLElement>("[data-testid^='agent-item-']");
                if (!li || !onRow) return;
                // The row's own link still navigates, so the phone drawer
                // closes as in production; the round only picks what to show.
                onRow(li.dataset.testid!.slice("agent-item-".length));
              }}
            >
              <h2 className="ah-rail-section-head" id={id}>
                {T.workspace}
              </h2>
              <ul>
                {rows.map((r) => (
                  <AgentNavItem key={r.agentId} {...r} now={REAL_NOW} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      }
    >
      <WorkspaceNavRow name="kotikirjasto" href="/workspaces/kotikirjasto" />
      <WorkspaceNavRow name={T.workspace} href={`/workspaces/${T.workspace}`} selected />
    </WorkspaceRail>
  );
}

const row = (agentId: string, title: string, detail: string, selected: boolean, mp: boolean, waiting = false): AgentNavModel => ({
  agentId: mp ? `mp-${agentId}` : agentId,
  href: `/workspaces/${T.workspace}?conversation=${agentId}`,
  title,
  workspaceId: T.workspace,
  workspaceName: T.workspace,
  changedAt: REAL_NOW - 120_000,
  activity: waiting ? "waiting" : "idle",
  activityLabel: "",
  controlLabel: "",
  attentionLabel: waiting ? detail : undefined,
  detail,
  selected,
});

function Shell({ title, rail, children }: { title: string; rail: ReactNode; children: ReactNode }) {
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={title}
        rail={rail}
        main={
          <div className="mp1-main" id="main" data-testid="main">
            {children}
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function Header({ title, model, mp, extra }: { title: string; model: string; mp: boolean; extra?: ReactNode }) {
  return (
    <AgentHeader
      title={title}
      workspaceLabel={T.workspace}
      workspaceHref={`/workspaces/${T.workspace}`}
      activityLabel=""
      controlLabel=""
      detailsExpanded={false}
      onToggleDetails={noop}
      settings={{ model }}
      guideControl={
        mp || extra ? (
          <span className="mp1-head-extra">
            {mp ? <MpMark /> : null}
            {extra}
          </span>
        ) : undefined
      }
    />
  );
}

function Follow({ dep, children }: { dep: unknown; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Follow the latest, as production does when the person is at the end:
  // scroll whichever ancestor actually scrolls.
  useLayoutEffect(() => {
    const end = () => {
      for (let el = ref.current?.parentElement; el; el = el.parentElement) {
        const o = getComputedStyle(el).overflowY;
        if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) {
          el.scrollTop = el.scrollHeight;
          return;
        }
      }
    };
    end();
    const f = requestAnimationFrame(end);
    return () => cancelAnimationFrame(f);
  }, [dep]);
  return <div ref={ref}>{children}</div>;
}

/** The owner's multiplayer conversation. */
function OwnerConversation({ w, setW, banner, beforeField }: { w: World; setW: React.Dispatch<React.SetStateAction<World>>; banner?: ReactNode; beforeField?: ReactNode }) {
  const [draft, setDraft] = useState(T.ownerDraft);
  const [panel, setPanel] = useState(false);
  const acts = useActs(setW);
  const send = () => {
    const body = draft.trim();
    if (!body || w.archived) return;
    setW((x) => ownerWrites(x, body));
    setDraft("");
  };
  return (
    <ConversationFrame>
      <Header title={T.mpTitle} model={T.modelShort[w.model]} mp />
      <PeopleBand w={w} owner onOpen={() => setPanel(true)} />
      <ConversationStream>
        <Follow dep={w}>
          {banner}
          <Thread items={w.items} w={w} acts={acts} />
        </Follow>
      </ConversationStream>
      {w.archived ? null : (
        <Composer
          value={draft}
          onChange={setDraft}
          activity="idle"
          selectedWorkingMode="steer"
          onModeChange={noop}
          onSendNow={send}
          onSteer={send}
          onFollowUp={send}
          idlePlaceholder={T.placeholder}
          beforeField={beforeField}
        />
      )}
      {panel ? (
        <PeoplePanel
          w={w}
          onClose={() => setPanel(false)}
          onRemove={(who) => {
            setW((x) => {
              const y = bump(x);
              return { ...y, members: y.members.filter((m) => m.who !== who), items: [...y.items, fact(y, "membership", who, { event: "removed" })] };
            });
          }}
        />
      ) : null}
    </ConversationFrame>
  );
}

/** Ville's view of Aino's multiplayer conversation. */
function GuestConversation({ w, setW, stripNote }: { w: World; setW: React.Dispatch<React.SetStateAction<World>>; stripNote?: string }) {
  const [draft, setDraft] = useState(T.guestDraft);
  const [panel, setPanel] = useState(false);
  const acts = useActs(setW);
  const mine = w.items.filter((i) => i.k === "card" && i.who === "ville" && (i.state === "waiting" || i.state === "each")).length;
  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setW((x) => guestWrites(x, "ville", body, T.c.guestReply, true));
    setDraft("");
  };
  const strip = (
    <div className="ah-mp-strip" data-testid="shared-strip" data-mode="text_only" role="status">
      <div className="ah-mp-strip-row">
        <span>{stripNote ?? T.stripText(first("aino"))}</span>
      </div>
      {mine && !w.keyBroken ? (
        <div className="ah-mp-strip-row" data-testid="shared-strip-waiting">
          {T.stripWaiting(mine, first("aino"))}
        </div>
      ) : null}
    </div>
  );
  return (
    <SharedViewer.Provider value={{ subject: "ville", owner: first("aino"), share: "s1", agentId: "a1", revision: "1" }}>
      <ConversationFrame>
        <Header title={T.mpTitle} model={T.modelShort[w.model]} mp />
        <PeopleBand w={w} owner={false} onOpen={() => setPanel(true)} />
        <ConversationStream>
          <Follow dep={w}>
            <Thread items={w.items} w={w} viewer="ville" acts={{ ...acts, cancelHeld: acts.cancelHeld }} />
          </Follow>
        </ConversationStream>
        <Composer
          value={draft}
          onChange={setDraft}
          activity="idle"
          selectedWorkingMode="steer"
          onModeChange={noop}
          onSendNow={send}
          onSteer={send}
          onFollowUp={send}
          idlePlaceholder={T.placeholder}
          beforeField={strip}
        />
        {panel ? <PeoplePanel w={w} onClose={() => setPanel(false)} /> : null}
      </ConversationFrame>
    </SharedViewer.Provider>
  );
}

// ---------- 1 Asetukset ----------

function ConfigScene({ keys, setKeys }: { keys: KeyState; setKeys: (k: KeyState) => void }) {
  const [as, setAs] = useState<"person" | "admin">("person");
  const models = modelsFor(keys);
  const [model, setModel] = useState<ModelId | undefined>(models[0]);
  const shown = model && models.includes(model) ? model : models[0];
  return (
    <Shell title={T.settings} rail={<Rail who="aino" rows={[]} />}>
      <div className="mp1-settings s-page detail" data-testid="settings">
        <div className="s-main">
          <div className="mp1-settings-head">
            <h2>{as === "person" ? `${T.settings} · ${T.aiPage}` : `${T.settings} · ${T.serverPage}`}</h2>
            <Segmented
              data-testid="settings-as"
              label={T.perspective}
              value={as}
              onChange={setAs}
              options={[
                { id: "person", label: T.asPerson },
                { id: "admin", label: T.asAdmin },
              ]}
            />
          </div>
          {as === "person" ? (
            <>
              <h3 className="mp1-h3">{T.credTitle}</h3>
              <div className="s-card" data-testid="settings-credentials">
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>{T.credSub}</strong>
                    <span className="s-desc">{T.credSubDesc}</span>
                  </div>
                  <div className="s-val">{T.credSubVal}</div>
                </div>
                <div className="s-row" data-testid="settings-own-key">
                  <div className="s-lbl">
                    <strong>{T.credOwn}</strong>
                    <span className="s-desc">{T.credOwnDesc}</span>
                  </div>
                  <div className="s-val">
                    {keys === "own" ? <code>{T.credOwnVal}</code> : <span>{T.credOwnNone}</span>}
                    <ControlButton size="row" variant="secondary" data-testid="settings-key-toggle" onPress={() => setKeys(keys === "own" ? "none" : "own")}>
                      {keys === "own" ? T.removeKey : T.addKey}
                    </ControlButton>
                  </div>
                </div>
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>{T.credServer}</strong>
                    <span className="s-desc">{keys === "server" ? T.credServerAllowed : T.credServerNot}</span>
                  </div>
                  <div className="s-val">{keys === "server" ? T.serverKey : "–"}</div>
                </div>
              </div>
              <h3 className="mp1-h3">{T.mpTitleSettings}</h3>
              {models.length && shown ? (
                <div className="s-card" data-testid="settings-mp">
                  <div className="s-row">
                    <div className="s-lbl">
                      <strong>{T.mpDefault}</strong>
                      <span className="s-desc">{T.mpDefaultDesc}</span>
                    </div>
                    <div className="s-val" data-testid="settings-mp-model">
                      <Select label={T.modelLabel} value={shown} options={models.map((m) => ({ value: m, label: T.models[m] }))} onChange={setModel} />
                    </div>
                  </div>
                </div>
              ) : (
                <PageNotice data-testid="settings-mp-unavailable" tone="warning" title={T.mpUnavailable} description={T.mpUnavailableDesc} actions={[{ label: T.addKey, onPress: () => setKeys("own"), testId: "settings-add-key" }]} />
              )}
            </>
          ) : (
            <>
              <h3 className="mp1-h3">{T.serverKeyTitle}</h3>
              <div className="s-card" data-testid="settings-server">
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>{T.serverKey}</strong>
                  </div>
                  <div className="s-val">
                    <code>{T.serverKeyVal}</code>
                  </div>
                </div>
                <div className="s-row" data-testid="settings-server-allow">
                  <div className="s-lbl">
                    <Checkbox label={T.serverAllow} checked={keys === "server"} onChange={(on) => setKeys(on ? "server" : "none")} hint={T.serverAllowDesc} />
                    {keys === "server" ? <span className="s-desc">{T.serverOffNote}</span> : null}
                  </div>
                </div>
                <div className="s-row">
                  <div className="s-lbl">
                    <strong>{T.serverRunning}</strong>
                  </div>
                  <div className="s-val">{T.serverRunningVal(keys === "server" ? 3 : 0)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

// ---------- 2 Aloitus ----------

type Open = "workspace" | "ordinary" | "empty" | "mp" | "converted";

function WorkspacePage({ onNew, onMp, mps }: { onNew: () => void; onMp: () => void; mps: number }) {
  const d = React.useContext(Dir);
  const ws = { workspace_id: "w1", name: T.workspace, path: T.workspacePath, kind: "git_main_worktree", visibility: "visible", git_summary: { github_repo: "" }, mutation_state: "allowed" } as never;
  return (
    <div className="ah-workspace-page mp1-ws" data-testid="workspace-page">
      <header className="ah-workspace-page-head">
        <div className="ah-workspace-page-title">
          <h1 data-testid="workspace-title">{T.workspace}</h1>
          <p>
            <code>{T.workspacePath}</code>
          </p>
        </div>
        <div className="mp1-ws-actions" data-testid="ws-actions" data-direction={d}>
          {d === 0 ? (
            <>
              <ControlButton size="row" variant="primary" data-testid="conversation-start" onPress={onNew}>
                <Icon name="plus" />
                {T.newConversation}
              </ControlButton>
              <MpButton place="workspace" onPress={onMp} />
            </>
          ) : (
            <>
              <WorkspaceActions page workspace={ws} onNew={onNew} />
              {d === 1 ? <MpButton place="workspace" onPress={onMp} /> : null}
            </>
          )}
        </div>
      </header>
      <ul className="mp1-ws-list" data-testid="ws-conversations">
        {Array.from({ length: mps }, (_, i) => (
          <li key={`mp${i}`}>
            <Icon name="users" aria-hidden="true" />
            <span>{i === 0 ? T.mpTitle : T.newMpTitle}</span>
            <MpMark />
          </li>
        ))}
        <li>
          <Icon name="message" aria-hidden="true" />
          <span>{T.ordinaryTitle}</span>
        </li>
      </ul>
    </div>
  );
}

function EmptyConversation({ keys, onMp, onOrdinary }: { keys: KeyState; onMp: () => void; onOrdinary: () => void }) {
  const [kind, setKind] = useState<"ordinary" | "mp">("ordinary");
  const [draft, setDraft] = useState("");
  return (
    <ConversationFrame>
      <Header title={T.newConversation} model={T.ordinaryModel} mp={false} />
      <ConversationStream>
        <div className="mp1-empty" data-testid="empty-kind">
          <h2>{T.emptyKind}</h2>
          <div className="s-prov-opts mp1-kinds" role="group" aria-label={T.emptyKind}>
            <button type="button" className="s-prov-opt" aria-pressed={kind === "ordinary"} data-testid="kind-ordinary" onClick={() => setKind("ordinary")}>
              <Icon name="message" aria-hidden="true" />
              <span>
                <strong>{T.kindOrdinary}</strong>
                <small>{T.kindOrdinaryDesc}</small>
              </span>
            </button>
            <button
              type="button"
              className="s-prov-opt"
              aria-pressed={kind === "mp"}
              data-testid="kind-mp"
              // Choosing it opens the start dialog; the choice holds only once
              // the multiplayer conversation exists.
              onClick={onMp}
            >
              <Icon name="users" aria-hidden="true" />
              <span>
                <strong>
                  {T.kindMp} <Icon name="plus" aria-hidden="true" />
                </strong>
                <small>{keys === "none" ? T.noKeyTitle : T.kindMpDesc}</small>
              </span>
            </button>
          </div>
        </div>
      </ConversationStream>
      <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={onOrdinary} onSteer={onOrdinary} onFollowUp={onOrdinary} idlePlaceholder={T.placeholder} />
    </ConversationFrame>
  );
}

function OrdinaryConversation({ onMp, items }: { onMp: () => void; items: Item[] }) {
  const [draft, setDraft] = useState("");
  const w = mpWorld();
  return (
    <ConversationFrame>
      <Header title={T.ordinaryTitle} model={T.ordinaryModel} mp={false} extra={<MpButton place="conversation" onPress={onMp} />} />
      <ConversationStream>
        <Thread items={items} w={w} />
      </ConversationStream>
      <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={noop} onSteer={noop} onFollowUp={noop} idlePlaceholder={T.placeholder} />
    </ConversationFrame>
  );
}

function StartScene({ keys, toSettings }: { keys: KeyState; toSettings: () => void }) {
  const d = React.useContext(Dir);
  const [open, setOpen] = useState<Open>("workspace");
  const [dialog, setDialog] = useState<"start" | "convert" | "nokey">();
  const [w, setW] = useState<World>(() => mpWorld());
  const [mps, setMps] = useState(1);
  const ask = (convert: boolean) => setDialog(keys === "none" ? "nokey" : convert ? "convert" : "start");
  const startNew = (model: ModelId, who: Who[]) => {
    const x: World = { ...mpWorld(model), members: who.map((s) => ({ who: s, state: "invited" as const })), items: [] };
    x.items = [{ k: "line", id: "s0", text: T.lineStarted(T.modelShort[model]) }];
    if (who.length) x.items.push({ k: "line", id: "s1", text: T.lineInvited(who.map((s) => first(s)).join(", ")) });
    setW(x);
    setMps(2);
    setOpen("mp");
    setDialog(undefined);
  };
  const convert = (model: ModelId, who: Who[]) => {
    const x: World = { ...mpWorld(model), members: who.map((s) => ({ who: s, state: "invited" as const })), items: [...ordinaryItems] };
    x.items.push({ k: "line", id: "c0", text: T.lineConverted(T.ordinaryModel, T.modelShort[model]) });
    if (who.length) x.items.push({ k: "line", id: "c1", text: T.lineInvited(who.map((s) => first(s)).join(", ")) });
    setW(x);
    setOpen("converted");
    setDialog(undefined);
  };
  const rows: AgentNavModel[] = [
    row("kevat", T.mpTitle, T.railDetail(3), open === "mp" && mps === 1, true),
    ...(mps > 1 ? [row("uusi", T.newMpTitle, T.railDetail(w.members.length + 1), open === "mp", true)] : []),
    open === "converted"
      ? row("jasen", T.ordinaryTitle, T.railDetail(w.members.length + 1), true, true)
      : row("jasen", T.ordinaryTitle, T.railOrdinary, open === "ordinary", false),
  ];
  const title = open === "workspace" ? T.workspace : open === "ordinary" ? T.ordinaryTitle : open === "empty" ? T.newConversation : open === "converted" ? T.ordinaryTitle : mps > 1 ? T.newMpTitle : T.mpTitle;
  return (
    <Shell
      title={title}
      rail={
        <Rail
          who="aino"
          rows={rows}
          onRow={(id) => {
            if (id === "jasen") setOpen("ordinary");
            else if (id === "mp-jasen") setOpen("converted");
            else if (id === "mp-kevat") {
              setW(mpWorld());
              setMps(1);
              setOpen("mp");
            } else setOpen("mp");
          }}
        />
      }
    >
      {open === "workspace" ? (
        <WorkspacePage mps={mps} onNew={() => (d === 2 ? setOpen("empty") : setOpen("ordinary"))} onMp={() => ask(false)} />
      ) : open === "empty" ? (
        <EmptyConversation keys={keys} onMp={() => ask(false)} onOrdinary={() => setOpen("ordinary")} />
      ) : open === "ordinary" ? (
        <OrdinaryConversation items={ordinaryItems} onMp={() => ask(true)} />
      ) : (
        <OwnerConversation key={open + mps} w={w} setW={setW} />
      )}
      {dialog === "nokey" ? (
        <NoKeyDialog onClose={() => setDialog(undefined)} onSettings={toSettings} />
      ) : dialog ? (
        <StartDialog convert={dialog === "convert"} keys={keys} onClose={() => setDialog(undefined)} onStart={dialog === "convert" ? convert : startNew} />
      ) : null}
    </Shell>
  );
}

// ---------- 3 Omistaja ----------

function ownerRows(w: World, sel = true): AgentNavModel[] {
  const waiting = w.items.some((i) => i.k === "card" && (i.state === "waiting" || i.state === "each"));
  return [row("kevat", T.mpTitle, T.railDetail(w.members.length + 1), sel, true, waiting && !w.archived), row("jasen", T.ordinaryTitle, T.railOrdinary, false, false)];
}

function OwnerScene({ w, setW, banner, beforeField }: { w: World; setW: React.Dispatch<React.SetStateAction<World>>; banner?: ReactNode; beforeField?: ReactNode }) {
  return (
    <Shell title={T.mpTitle} rail={<Rail who="aino" rows={w.archived ? ownerRows(w).slice(1) : ownerRows(w)} />}>
      <OwnerConversation w={w} setW={setW} banner={banner} beforeField={beforeField} />
    </Shell>
  );
}

// ---------- 4 Osallistuja ----------

function guestRail(phase: "invited" | "joined" | "gone") {
  const shared =
    phase === "gone"
      ? []
      : [
          {
            ...row("kevat", T.mpTitle, phase === "invited" ? T.invite : `${first("aino")} · ${T.mpMark}`, true, true, phase === "invited"),
            agentId: "mp-shared",
          },
        ];
  return <Rail who="ville" rows={[]} shared={shared} />;
}

function InvitePage({ onJoin }: { onJoin: () => void }) {
  return (
    <section className="ah-mp-invite mp1-invite-page" data-testid="shared-invite">
      <h1>
        <PersonAvatar subject="aino" name={NAMES.aino} /> {T.invitedBy(first("aino"))}
      </h1>
      <p>
        <strong>{T.mpTitle}</strong> <MpMark />
      </p>
      <p>{T.ownerLine(NAMES.aino)}</p>
      <p>{T.workspaceLine(T.workspace)}</p>
      <p>{T.inviteWhose(first("aino"))}</p>
      <p className="mp1-help">{T.inviteNothing}</p>
      <div className="mp1-invite-actions" data-testid="invite-actions">
        <ControlButton size="row" variant="primary" data-testid="invite-join" onPress={onJoin}>
          {T.join}
        </ControlButton>
        <ControlButton size="row" variant="quiet" data-testid="invite-later" onPress={noop}>
          {T.notNow}
        </ControlButton>
      </div>
    </section>
  );
}

function Unavailable({ detail }: { detail: string }) {
  return (
    <div className="ah-mp-invite mp1-invite-page" data-testid="shared-unavailable">
      <h1>{T.unavailable}</h1>
      <p>{detail}</p>
      <a href="/workspaces">{T.toAll}</a>
    </div>
  );
}

function guestWorld(base: World): World {
  // The participant sees what the owner sees, minus the owner's own controls.
  return { ...base, items: base.items.map((i) => (i.k === "line" && i.id === "l0" ? { ...i, text: T.lineStartedGuest(first("aino"), T.modelShort[base.model]) } : i)) };
}

function GuestScene({ w, setW }: { w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  const [joined, setJoined] = useState(false);
  return (
    <Shell title={T.mpTitle} rail={guestRail(joined ? "joined" : "invited")}>
      {joined ? <GuestConversation w={guestWorld(w)} setW={setW} /> : <InvitePage onJoin={() => setJoined(true)} />}
    </Shell>
  );
}

// ---------- 5 Kulmat ----------

function CornerScene({ c, view, w, setW }: { c: Corner; view: "owner" | "guest"; w: World; setW: React.Dispatch<React.SetStateAction<World>> }) {
  if (view === "guest") {
    if (c === "removed")
      return (
        <Shell title={T.unavailable} rail={guestRail("gone")}>
          <Unavailable detail={T.unavailableRemoved(first("aino"))} />
        </Shell>
      );
    if (c === "archived" && w.archived)
      return (
        <Shell title={T.unavailable} rail={guestRail("gone")}>
          <Unavailable detail={T.unavailableArchived(first("aino"))} />
        </Shell>
      );
    const note = c === "away" ? T.stripAway(first("aino")) : c === "nokey" && w.keyBroken ? T.stripNoKey(first("aino")) : undefined;
    return (
      <Shell title={T.mpTitle} rail={guestRail("joined")}>
        <GuestConversation w={guestWorld(w)} setW={setW} stripNote={note} />
      </Shell>
    );
  }
  let banner: ReactNode;
  let beforeField: ReactNode;
  if (c === "nokey" && w.keyBroken)
    beforeField = (
      <div className="mp1-banner">
        <PageNotice
          data-testid="nokey-banner"
          tone="warning"
          title={T.noKeyOwnerTitle}
          description={T.noKeyOwnerDesc}
          actions={[
            { label: T.chooseModel, testId: "nokey-fix", onPress: () => setW((x) => releaseHeld({ ...x, keyBroken: false, model: "claude-server" })) },
          ]}
        />
      </div>
    );
  if (c === "archived" && w.archived)
    banner = (
      <div className="mp1-banner">
        <PageNotice data-testid="archived-banner" tone="neutral" title={T.archivedTitle} description={T.archivedDesc} actions={[{ label: T.restore, testId: "archived-restore", onPress: () => setW((x) => ({ ...x, archived: false })) }]} />
      </div>
    );
  if (c === "away")
    banner = (
      <p className="mp1-away" data-testid="away-note">
        {T.awayOwnerNote("2 h")}
      </p>
    );
  return <OwnerScene w={{ ...w, ownerHere: true }} setW={setW} banner={banner} beforeField={beforeField} />;
}

/** The key works again: held messages are delivered and answered. */
function releaseHeld(w: World): World {
  let x: World = { ...w, items: w.items.map((i) => (i.k === "msg" && i.held ? { ...i, held: false } : i)) };
  x = bump(x);
  x.items = [...x.items, { k: "reply", id: `rh${x.seq}`, text: T.c.guestReply, at: clock(x), tools: [] }, { k: "card", id: `ch${x.seq}`, who: "ville", ops: [{ tool: "edit", target: FILE }], state: "waiting" }];
  return x;
}

// ---------- Review page ----------

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [scene, setScene] = useState<Scene>(pick(params.get("scene"), scenes, "owner"));
  const [corner, setCorner] = useState<Corner>(pick(params.get("corner"), corners, "removed"));
  const [view, setView] = useState<"owner" | "guest">(params.get("view") === "guest" ? "guest" : "owner");
  const [keys, setKeys] = useState<KeyState>(pick(params.get("key"), ["own", "server", "none"] as const, "own"));
  const [run, setRun] = useState(0);
  const fresh = (s: Scene, c: Corner) => (s === "corner" ? cornerWorld(c) : mpWorld());
  const [w, setW] = useState<World>(() => fresh(scene, corner));
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const reset = (s = scene, c = corner) => {
    setW(fresh(s, c));
    setRun((r) => r + 1);
  };
  const events =
    scene === "owner" || (scene === "corner" && view === "owner" && corner !== "removed" && corner !== "archived") ? (
      <>
        <button type="button" className="ra-event" data-testid="event-ville" disabled={!w.members.some((m) => m.who === "ville") || w.archived} onClick={() => setW((x) => guestWrites(x, "ville", T.c.v2, T.c.guestReply, true))}>
          {T.villeWrites}
        </button>
        <button type="button" className="ra-event" data-testid="event-maija" disabled={!w.members.some((m) => m.who === "maija") || w.archived} onClick={() => setW((x) => guestWrites(x, "maija", T.c.m1, T.c.rm1, false))}>
          {T.maijaWrites}
        </button>
      </>
    ) : scene === "guest" || (scene === "corner" && view === "guest") ? (
      <>
        <button
          type="button"
          className="ra-event"
          data-testid="event-allow"
          onClick={() => setW((x) => {
            const c = [...x.items].reverse().find((i) => i.k === "card" && i.who === "ville" && i.state === "waiting");
            return c ? settleCard(x, c.id, "allowed") : x;
          })}
        >
          {T.ainoAllows}
        </button>
        <button
          type="button"
          className="ra-event"
          data-testid="event-decline"
          onClick={() => setW((x) => {
            const c = [...x.items].reverse().find((i) => i.k === "card" && i.who === "ville" && i.state === "waiting");
            return c ? settleCard(x, c.id, "declined") : x;
          })}
        >
          {T.ainoDeclines}
        </button>
      </>
    ) : null;
  return (
    <Dir.Provider value={direction}>
      <div className="ra-review" data-direction={direction} data-scene={scene}>
        <header className="ra-bar" ref={bar}>
          <div className="ra-controls">
            <strong>{T.title}</strong>
            <label>
              {T.scene}{" "}
              <select
                id="scene"
                value={scene}
                onChange={(e) => {
                  const s = e.target.value as Scene;
                  setScene(s);
                  reset(s);
                }}
              >
                {scenes.map((s) => (
                  <option key={s} value={s}>
                    {T.scenes[s]}
                  </option>
                ))}
              </select>
            </label>
            {scene === "corner" ? (
              <>
                <label>
                  {T.corner}{" "}
                  <select
                    id="corner"
                    value={corner}
                    onChange={(e) => {
                      const c = e.target.value as Corner;
                      setCorner(c);
                      reset("corner", c);
                    }}
                  >
                    {corners.map((c) => (
                      <option key={c} value={c}>
                        {T.corners[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {T.viewAs}{" "}
                  <select id="view" value={view} onChange={(e) => setView(e.target.value as "owner" | "guest")}>
                    <option value="owner">{T.viewAsOwner}</option>
                    <option value="guest">{T.viewAsGuest}</option>
                  </select>
                </label>
              </>
            ) : null}
            {scene === "config" || scene === "start" ? (
              <label>
                {T.keyState}{" "}
                <select id="key" value={keys} onChange={(e) => setKeys(e.target.value as KeyState)}>
                  {(["own", "server", "none"] as const).map((k) => (
                    <option key={k} value={k}>
                      {T.keyStates[k]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              {T.theme}{" "}
              <select
                id="theme"
                value={theme}
                onChange={(e) => {
                  reviewTheme = e.target.value as typeof reviewTheme;
                  setTheme(reviewTheme);
                }}
              >
                {(["light", "dark", "contrast"] as const).map((k) => (
                  <option key={k} value={k}>
                    {T.themes[k]}
                  </option>
                ))}
              </select>
            </label>
            {events}
            <button type="button" className="ra-event" data-testid="event-reset" onClick={() => reset()}>
              {T.reset}
            </button>
          </div>
          <ol className="ra-lines" data-testid="direction-lines">
            {T.lines.map((l, i) => (
              <li key={l} aria-current={i === direction ? "true" : undefined}>
                {l}
              </li>
            ))}
          </ol>
        </header>
        <div className="ra-stage">
          <MemoryRouter key={`${run}-${scene}-${corner}-${view}`} initialEntries={[`/workspaces/${T.workspace}`]}>
            {scene === "config" ? (
              <ConfigScene keys={keys} setKeys={setKeys} />
            ) : scene === "start" ? (
              <StartScene keys={keys} toSettings={() => setScene("config")} />
            ) : scene === "owner" ? (
              <OwnerScene w={w} setW={setW} />
            ) : scene === "guest" ? (
              <GuestScene w={w} setW={setW} />
            ) : (
              <CornerScene c={corner} view={view} w={w} setW={setW} />
            )}
          </MemoryRouter>
        </div>
      </div>
    </Dir.Provider>
  );
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/server") return json({ schema_version: 1, name: "Habitat", administrator: false, version: "0.0.0-proto" });
  return new Response("", { status: 404 });
};

const root = createRoot(document.getElementById("root")!);
const stageSink = {
  set innerHTML(view: ReactNode) {
    flushSync(() => root.render(view === "" ? null : view));
  },
};
const variants = directions.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) {
    button.setAttribute("data-active", "");
    button.setAttribute("aria-current", "true");
  }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);

export type { React };
