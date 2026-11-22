import React, { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/Multiplayer.css";
import "../../../../web/src/components/ServerBrowser.css";
import { type BrowserStatus, summarize } from "../../../../web/src/app/serverBrowser";
import type { FileChange } from "../../../../web/src/app/turnChanges";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AgentTurn, type TurnStep } from "../../../../web/src/components/AgentTurn";
import { BashToolCard } from "../../../../web/src/components/BashToolCard";
import { Composer, ConversationTimeline, ToolGroup, ToolRow, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AgentHeader, AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { PiToolUse } from "../../../../web/src/components/PiBlocks";
import { BrowserChip, BrowserStrip } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { TurnChanges } from "../../../../web/src/components/TurnChanges";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import { TEXT, type Text } from "./text";
import "./round.css";

// server-browser-agent-visit-log, Claude round (22.11.2026). One view: the
// conversation after, and while, the agent used the person's signed-in
// server browser. The record is the same in every direction (sites, pages,
// downloads, presses and entries, the time span, whether the agent's tab is
// still open); what differs is where it lives in the conversation:
//   1 Rivi  — a Habitat line after the turn, opening into a list in place;
//   2 Kortti — a Selain card under the reply, beside Muutokset;
//   3 Työ   — inside the agent's work: the browser commands as one group, a
//             mark on the work row.
// The live window list (production BrowserChip and BrowserStrip) is shared:
// the agent's tab is named and counts its pages while the visit runs.

setPersonalLanguage("fi");
const directions = ["1 Rivi", "2 Kortti", "3 Työ"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- The synthetic world ----------

type Page = { origin: string; path: string; title: string };
type Ev = {
  at: string;
  cmd: string;
  page?: Page;
  download?: string;
  action?: { kind: "click" | "type"; sel: string };
};

const SITE = "https://stays.example";
const HELP = "https://help.stays.example";
const RECEIPTS = "https://receipts.stays.example";
const CLI = "open-habitat agent browser";
const TAB = "4F1C";
const BOOKINGS = [
  ["R-1041", "Tampere · 2 yötä", "Tampere · 2 nights"],
  ["R-1056", "Oulu · 1 yö", "Oulu · 1 night"],
  ["R-1063", "Turku · 3 yötä", "Turku · 3 nights"],
  ["R-1077", "Kuopio · 2 yötä", "Kuopio · 2 nights"],
  ["R-1082", "Vaasa · 1 yö", "Vaasa · 1 night"],
  ["R-1090", "Lahti · 2 yötä", "Lahti · 2 nights"],
  ["R-1104", "Pori · 1 yö", "Pori · 1 night"],
  ["R-1118", "Joensuu · 4 yötä", "Joensuu · 4 nights"],
  ["R-1125", "Rovaniemi · 3 yötä", "Rovaniemi · 3 nights"],
  ["R-1131", "Jyväskylä · 2 yötä", "Jyväskylä · 2 nights"],
] as const;
const CLEANING = new Set(["R-1063", "R-1118", "R-1125"]);
const DIR = "~/Downloads/stays-2026/";

function events(lang: "fi" | "en"): Ev[] {
  const fi = lang === "fi";
  const out: Ev[] = [
    { at: "16.42", cmd: `${CLI} status --json` },
    { at: "16.42", cmd: `${CLI} goto ${HELP}/receipts --json`, page: { origin: HELP, path: "/receipts", title: fi ? "Kuitit ja laskut" : "Receipts and invoices" } },
    { at: "16.43", cmd: `${CLI} goto ${SITE}/trips --tab ${TAB} --json`, page: { origin: SITE, path: "/trips", title: fi ? "Matkat" : "Trips" } },
    { at: "16.43", cmd: `printf 2026 | ${CLI} type --tab ${TAB} --selector 'input[name=year]' --text-file - --json`, action: { kind: "type", sel: "input[name=year]" } },
    {
      at: "16.43",
      cmd: `${CLI} click --tab ${TAB} --selector 'button.search' --json`,
      action: { kind: "click", sel: "button.search" },
      page: { origin: SITE, path: "/trips", title: fi ? "Matkat · 2026" : "Trips · 2026" },
    },
    { at: "16.43", cmd: `${CLI} links --tab ${TAB} --json` },
  ];
  let minute = 44;
  BOOKINGS.forEach(([id, fiTitle, enTitle], i) => {
    if (i && i % 2 === 0) minute++;
    const at = `16.${minute}`;
    out.push({ at, cmd: `${CLI} goto ${SITE}/trips/${id} --tab ${TAB} --json`, page: { origin: SITE, path: `/trips/${id}`, title: fi ? fiTitle : enTitle } });
    out.push({ at, cmd: `${CLI} download ${RECEIPTS}/r/${id}.pdf --tab ${TAB} --name stays-2026/${id}.pdf --json`, download: `${id}.pdf` });
    if (CLEANING.has(id))
      out.push({ at, cmd: `${CLI} download ${RECEIPTS}/r/${id}-2.pdf --tab ${TAB} --name stays-2026/${id}-2.pdf --json`, download: `${id}-2.pdf` });
  });
  out.push({ at: "16.48", cmd: `${CLI} close --tab ${TAB} --json` });
  return out;
}

/** Where the default "in progress" view stops: after the fifth booking. */
const LIVE_AT = (evs: Ev[]) => evs.findIndex((e) => e.download === "R-1082.pdf") + 1;

type Visit = {
  start: string;
  end?: string;
  open: boolean;
  pages: (Page & { at: string })[];
  downloads: { at: string; name: string }[];
  actions: (NonNullable<Ev["action"]> & { at: string; page?: string })[];
  current?: Page;
};

/** The record, from the agent's browser commands so far. */
function visitOf(evs: Ev[]): Visit {
  const v: Visit = { start: evs[0]?.at ?? "", open: false, pages: [], downloads: [], actions: [] };
  for (const e of evs) {
    if (e.cmd.includes(" close ")) {
      v.open = false;
      v.end = e.at;
      v.current = undefined;
      continue;
    }
    if (e.action) v.actions.push({ ...e.action, at: e.at, page: v.current ? v.current.origin.replace(/^https:\/\//, "") + v.current.path : undefined });
    if (e.page) {
      v.pages.push({ ...e.page, at: e.at });
      v.current = e.page;
      v.open = true;
    }
    if (e.download) v.downloads.push({ at: e.at, name: e.download });
  }
  return v;
}

const host = (origin: string) => origin.replace(/^https?:\/\//, "");
const origins = (v: Visit) => {
  const m = new Map<string, number>();
  for (const p of v.pages) m.set(p.origin, (m.get(p.origin) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const CSV = [
  "varaus,paikka,päivä,summa,kuitti",
  ...BOOKINGS.map(([id, t], i) => `${id},${t.split(" · ")[0]},2026-${String(i + 1).padStart(2, "0")}-14,${(89 + i * 7).toFixed(2)},${id}.pdf`),
].join("\n");
const CHANGES: FileChange[] = [
  {
    path: "kulut/majoitus-2026.csv",
    inWorkspace: true,
    change: "written",
    events: [{ callId: "w1", tool: "write", content: CSV }],
    after: CSV,
    counts: { add: CSV.split("\n").length, del: 0 },
  },
];

// ---------- Review state ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
const LangContext = React.createContext<"fi" | "en">("fi");
const useT = () => TEXT[React.useContext(LangContext)];

// ---------- Shared pieces of the record ----------

function Counts({ v, live }: { v: Visit; live: boolean }) {
  const t = useT();
  const parts = [t.pages(v.pages.length), t.downloads(v.downloads.length), t.actionsShort(v.actions.length)];
  return (
    <span className="vr-counts" data-testid="visit-counts">
      {parts.join(" · ")}
      {live ? ` ${t.soFar}` : ""}
    </span>
  );
}

function Sites({ v }: { v: Visit }) {
  return (
    <span className="vr-sites" data-testid="visit-sites">
      {origins(v).map(([o]) => (
        <code key={o}>{host(o)}</code>
      ))}
    </span>
  );
}

/** The opened record, the same list in every direction. */
function Detail({ v, live }: { v: Visit; live: boolean }) {
  const t = useT();
  return (
    <div className="vr-detail" data-testid="visit-detail">
      <section>
        <h4>
          <Icon name="globe" aria-hidden="true" />
          {t.sectionPages} <span className="vr-n">{v.pages.length}</span>
        </h4>
        {origins(v).map(([o, n]) => (
          <div key={o} className="vr-origin" data-testid="visit-origin" data-origin={host(o)}>
            <p className="vr-origin-head">
              <code>{host(o)}</code> <span className="vr-n">{t.pages(n)}</span>
            </p>
            <ol className="vr-pages">
              {v.pages
                .filter((p) => p.origin === o)
                .map((p, i) => (
                  <li key={i} data-testid="visit-page">
                    <time>{p.at}</time>
                    <span className="vr-page-title">{p.title}</span>
                    <code className="vr-path">{p.path}</code>
                  </li>
                ))}
            </ol>
          </div>
        ))}
      </section>
      {v.downloads.length ? (
        <section>
          <h4>
            <Icon name="download" aria-hidden="true" />
            {t.sectionDownloads} <span className="vr-n">{v.downloads.length}</span>
          </h4>
          <p className="vr-saved">{t.savedTo(DIR)}</p>
          <ul className="vr-files" data-testid="visit-files">
            {v.downloads.map((d) => (
              <li key={d.name}>
                <Icon name="file" aria-hidden="true" />
                <code>{d.name}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {v.actions.length ? (
        <section>
          <h4>
            <Icon name="pencil" aria-hidden="true" />
            {t.sectionActions} <span className="vr-n">{v.actions.length}</span>
          </h4>
          <ol className="vr-pages" data-testid="visit-actions">
            {v.actions.map((a, i) => (
              <li key={i}>
                <time>{a.at}</time>
                <span className="vr-page-title">{a.kind === "click" ? t.actionClick : t.actionType}</span>
                <code className="vr-path">{a.sel}</code>
                {a.page ? <code className="vr-path vr-on">{a.page}</code> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <p className="vr-coverage" data-testid="visit-coverage">
        {live ? `${t.coverageLive} ` : ""}
        {t.coverage}
      </p>
    </div>
  );
}

function TabState({ v }: { v: Visit }) {
  const t = useT();
  return (
    <span className="vr-tab" data-testid="visit-tab" data-open={v.open || undefined}>
      <Icon name={v.open ? "agent" : "check"} aria-hidden="true" />
      {v.open ? t.tabOpen : t.tabClosed}
    </span>
  );
}

// ---------- 1 Rivi: a Habitat line after the turn ----------

function VisitLine({ v, live, onLook }: { v: Visit; live: boolean; onLook: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="vr-line-wrap" data-testid="visit-record" data-direction="line">
      <p className="ah-mp-line vr-line" role="note" data-testid="habitat-line" data-kind="browser_visit">
        <span className="ah-mp-line-mark" aria-hidden="true" />
        <span className="vr-line-text">
          <strong>{live ? t.usingSince(v.start) : t.usedRange(v.start, v.end ?? "")}</strong>
          {" · "}
          <Sites v={v} />
          {" · "}
          <Counts v={v} live={live} />
        </span>
        <span className="vr-line-actions">
          {live ? (
            <button type="button" className="vr-link" data-testid="visit-look" onClick={onLook}>
              {t.look}
            </button>
          ) : null}
          <button type="button" className="vr-link" data-testid="visit-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t.hide : t.show}
          </button>
        </span>
      </p>
      {open ? <Detail v={v} live={live} /> : null}
    </div>
  );
}

// ---------- 2 Kortti: under the reply, beside Muutokset ----------

function VisitCard({ v, live, onLook }: { v: Visit; live: boolean; onLook: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="ah-turn-changes vr-card" data-testid="visit-record" data-direction="card" data-open={open || undefined} data-live={live || undefined} aria-label={live ? t.cardTitleLive : t.cardTitle}>
      <div className="ah-tc-head">
        <button type="button" className="ah-tc-toggle" data-testid="visit-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span aria-hidden="true" className="ah-disclosure-chevron" />
          <Icon name="globe" aria-hidden="true" />
          <span className="ah-tc-line">
            <span className="ah-tc-title">{live ? t.cardTitleLive : t.cardTitle}</span>
            <span className="ah-tc-meta vr-card-meta">
              <Sites v={v} />
              <Counts v={v} live={live} />
              <span className="vr-when">{live ? `${v.start}–` : `${v.start}–${v.end}`}</span>
            </span>
          </span>
        </button>
        {live ? (
          <button type="button" className="ah-tc-timeline-button" data-testid="visit-look" onClick={onLook}>
            <Icon name="eye" aria-hidden="true" />
            <span>{t.look}</span>
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="ah-tc-body vr-card-body">
          <TabState v={v} />
          <Detail v={v} live={live} />
        </div>
      ) : null}
    </section>
  );
}

// ---------- 3 Työ: inside the agent's work ----------

function BrowserWork({ v, evs, live }: { v: Visit; evs: Ev[]; live: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const top = origins(v)[0]?.[0];
  return (
    <div className="vr-work" data-testid="visit-record" data-direction="work">
      <ToolGroup
        title={t.workBrowser}
        summary={`${top ? host(top) : ""} · ${t.pages(v.pages.length)} · ${t.downloads(v.downloads.length)} · ${t.actionsShort(v.actions.length)}${live ? ` ${t.soFar}` : ""}`}
        expanded={open}
        onToggle={() => setOpen(!open)}
      >
        <TabState v={v} />
        <Detail v={v} live={live} />
        <div className="vr-work-cmds">
          {evs.map((e, i) => (
            <PiToolUse key={i} name="bash" state={live && i === evs.length - 1 ? "running" : "succeeded"} targetText={e.cmd}>
              <BashToolCard command={e.cmd} output={'{"ok": true}'} />
            </PiToolUse>
          ))}
        </div>
      </ToolGroup>
    </div>
  );
}

/** A span appended into a production element found from `anchor`; it is
 * re-created only when the element it lives in is replaced. */
function useSlot(find: (from: HTMLElement) => HTMLElement | null | undefined, className: string, testid: string) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [hostEl, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const target = anchor.current ? find(anchor.current) : null;
    if (hostEl && target && hostEl.parentElement === target) return;
    if (hostEl && !target) {
      hostEl.remove();
      setHost(null);
      return;
    }
    if (!target) return;
    hostEl?.remove();
    const span = document.createElement("span");
    span.className = className;
    span.dataset.testid = testid;
    target.append(span);
    setHost(span);
  });
  useLayoutEffect(() => () => hostEl?.remove(), [hostEl]);
  return { anchor, hostEl };
}

/** Adds "· selain: 13 sivua" to the production work row of the turn, or
 * to its working strip while it runs and the work is hidden. */
function StageMark({ text }: { text: string }) {
  const { anchor, hostEl } = useSlot(
    // The work row once the turn has settled; while it runs, the working strip.
    (from) => {
      const turn = from.closest(".vr-turn");
      return turn?.querySelector<HTMLElement>('[data-testid="history-stage-toggle"]') ?? turn?.querySelector<HTMLElement>('[data-testid="turn-progress"]');
    },
    "vr-stage-mark",
    "stage-browser-mark",
  );
  return (
    <>
      <span ref={anchor} hidden />
      {hostEl
        ? createPortal(
            <>
              {" · "}
              <Icon name="globe" aria-hidden="true" />
              {text}
            </>,
            hostEl,
          )
        : null}
    </>
  );
}

// ---------- The live window list ----------

const picture = (title: string, url: string, tone: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#fbfaf7"/><rect width="320" height="22" fill="#e7e3da"/><text x="10" y="15" font-family="sans-serif" font-size="10" fill="#555">${url}</text><rect x="16" y="36" width="120" height="14" rx="3" fill="${tone}"/><text x="16" y="72" font-family="sans-serif" font-size="15" fill="#222">${title.replace(/[<&]/g, "")}</text>${[0, 1, 2, 3].map((i) => `<rect x="16" y="${90 + i * 24}" width="${270 - i * 30}" height="12" rx="3" fill="#ddd8cc"/>`).join("")}</svg>`,
  )}`;

function statusOf(t: Text, v: Visit, live: boolean): BrowserStatus {
  const windows: BrowserStatus["windows"] = [{ id: "own", title: t === TEXT.fi ? "Uutiset · news.example" : "News · news.example", origin: "https://news.example", agent: false }];
  if (live && v.current) windows.push({ id: "agent", title: v.current.title, origin: v.current.origin, agent: true });
  return { schema_version: 1, state: "running", survives_restart: true, control: "agent", agent_connected: live, windows };
}

/** Names the agent's tab and counts its pages, inside the production card. */
function TabCount({ n }: { n: number }) {
  const t = useT();
  const { anchor, hostEl } = useSlot(
    (from) => from.closest(".sb-dock")?.querySelector<HTMLElement>('[data-window="agent"] figcaption'),
    "vr-tabcount",
    "agent-tab-mark",
  );
  return (
    <>
      <span ref={anchor} hidden />
      {hostEl ? createPortal(`${t.agentTab} · ${t.tabPages(n)}`, hostEl) : null}
    </>
  );
}

function Dock({ v, live, open, setOpen, onShow }: { v: Visit; live: boolean; open: boolean; setOpen: (o: boolean) => void; onShow: () => void }) {
  const t = useT();
  const status = statusOf(t, v, live);
  const summary = summarize(status);
  const pictures: Record<string, string> = { own: picture(status.windows[0].title, "news.example", "#c9d4e4") };
  if (live && v.current) pictures.agent = picture(v.current.title, host(v.current.origin) + v.current.path, "#e4cdb8");
  return (
    <div className="sb-dock" data-testid="browser-dock">
      {open ? (
        <>
          <BrowserStrip status={status} summary={summary} pictures={pictures} onLook={noop} onTakeForRequest={noop} onGiveBack={noop} />
          {live ? <TabCount n={v.pages.length} /> : null}
          <p className="vr-strip-note" data-testid="strip-record">
            <Icon name="message" aria-hidden="true" />
            {t.stripRecord}
            <button type="button" className="vr-link" data-testid="strip-show" onClick={onShow}>
              {t.showInConversation}
            </button>
          </p>
        </>
      ) : null}
      <BrowserChip status={status} summary={summary} open={open} onToggle={() => setOpen(!open)} onStart={noop} />
    </div>
  );
}

// ---------- The conversation ----------

function Thread({ d, evs, live, onLook }: { d: number; evs: Ev[]; live: boolean; onLook: () => void }) {
  const t = useT();
  const v = visitOf(evs);
  const browserEv = evs;
  const toolStep = (e: Ev, i: number, running: boolean): TurnStep => ({
    kind: "tool",
    key: `b${i}`,
    node: (
      <div className="ah-ordered-blocks">
        <PiToolUse name="bash" state={running ? "running" : "succeeded"} targetText={e.cmd}>
          <BashToolCard command={e.cmd} output={'{"ok": true}'} running={running} />
        </PiToolUse>
      </div>
    ),
  });
  const steps: TurnStep[] = [];
  if (d === 2) steps.push({ kind: "tool", key: "browser", node: (
        <div className="ah-ordered-blocks">
          <BrowserWork v={v} evs={browserEv} live={live} />
        </div>
      ),
    });
  else browserEv.forEach((e, i) => steps.push(toolStep(e, i, live && i === browserEv.length - 1)));
  if (!live) {
    steps.push({
      kind: "tool",
      key: "write",
      node: (
        <div className="ah-ordered-blocks">
          <PiToolUse name="write" state="succeeded" targetText="kulut/majoitus-2026.csv" />
        </div>
      ),
    });
    steps.push({ kind: "text", key: "reply", text: t.replyDone, node: <Markdown text={t.replyDone} /> });
  }
  const changes = (
    <>
      <TurnChanges files={CHANGES} />
      {d === 1 ? <VisitCard v={v} live={false} onLook={onLook} /> : null}
    </>
  );
  const items: { id: string; kind?: string; content: ReactNode }[] = [
    {
      id: "ask",
      kind: "user",
      content: (
        <UserMessage sourceText={t.ask} onCopy={noop} time="16.41">
          <Markdown text={t.ask} />
        </UserMessage>
      ),
    },
    {
      id: "turn",
      kind: "assistant",
      content: (
        <div className="vr-turn" data-testid="turn">
          <AgentTurn steps={steps} working={live} activity={live ? t.activity : undefined} duration={live ? "3:12" : undefined} changes={changes} />
          {d === 2 ? <StageMark text={t.stageMark(t.pages(v.pages.length))} /> : null}
          {d === 1 && live ? <VisitCard v={v} live onLook={onLook} /> : null}
        </div>
      ),
    },
  ];
  if (d === 0) items.push({ id: "record", content: <VisitLine v={v} live={live} onLook={onLook} /> });
  return (
    <ConversationTimeline
      state="ready"
      items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))}
      historyMode="pagedAccessible"
      onJumpToLatest={noop}
      emptyLabel={null}
    />
  );
}

function Main({ d, evs, live, strip, setStrip }: { d: number; evs: Ev[]; live: boolean; strip: boolean; setStrip: (o: boolean) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const v = visitOf(evs);
  const toRecord = () => {
    requestAnimationFrame(() => {
      const el = document.querySelector('[data-testid="visit-record"]') ?? document.querySelector('[data-testid="history-stage-toggle"]') ?? document.querySelector('[data-testid="turn-progress"]');
      el?.scrollIntoView({ block: "center" });
      el?.classList.add("vr-flash");
      setTimeout(() => el?.classList.remove("vr-flash"), 1600);
    });
  };
  const rail = (
    <WorkspaceRail
      collapsed={false}
      serverLabel="Habitat"
      connectionLabel=""
      connectionTone="success"
      filterValue=""
      resultSummary="2"
      listState="ready"
      onToggle={noop}
      onFilter={noop}
      onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: "Aino Laine", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}
    >
      <WorkspaceNavRow name="kotikirjasto" href="/workspaces/kotikirjasto" />
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} />
    </WorkspaceRail>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.convTitle}
        rail={rail}
        main={
          <div className="vr-main" id="main" data-testid="conversation">
            <ConversationFrame>
              <AgentHeader
                title={t.convTitle}
                workspaceLabel={t.workspace}
                workspaceHref={`/workspaces/${t.workspace}`}
                activityLabel={live ? t.activity : ""}
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
              <ConversationStream>
                <Thread d={d} evs={evs} live={live} onLook={() => setStrip(true)} />
              </ConversationStream>
              <Dock v={v} live={live} open={strip} setOpen={setStrip} onShow={toRecord} />
              <Composer
                value={draft}
                onChange={setDraft}
                activity={live ? "working" : "idle"}
                selectedWorkingMode="steer"
                onModeChange={noop}
                onSendNow={noop}
                onSteer={noop}
                onFollowUp={noop}
                idlePlaceholder=""
              />
            </ConversationFrame>
          </div>
        }
      />
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const t = TEXT[language];
  const all = events(language);
  const [step, setStep] = useState(params.get("state") === "live" ? LIVE_AT(all) : all.length);
  const [strip, setStrip] = useState(false);
  const [run, setRun] = useState(0);
  const live = step < all.length;
  const evs = all.slice(0, step);
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
  useLayoutEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const goLive = () => {
    setStep(LIVE_AT(all));
    setStrip(true);
    setRun((r) => r + 1);
  };
  const goDone = () => {
    setStep(all.length);
    setRun((r) => r + 1);
  };
  return (
    <LangContext.Provider value={language}>
      <div className="ra-review" data-direction={direction} data-state={live ? "live" : "done"}>
        <header className="ra-bar" ref={bar}>
          <div className="ra-controls">
            <strong>{t.title}</strong>
            <label>
              {t.theme}{" "}
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
                    {t.themes[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.language}{" "}
              <select
                id="language"
                value={language}
                onChange={(e) => {
                  reviewLanguage = e.target.value as "fi" | "en";
                  setPersonalLanguage(reviewLanguage);
                  setLanguage(reviewLanguage);
                  setRun((r) => r + 1);
                }}
              >
                <option value="fi">suomi</option>
                <option value="en">English</option>
              </select>
            </label>
            <span className="ra-seg" role="group">
              <button type="button" className="ra-event" data-testid="event-live" aria-pressed={live} onClick={goLive}>
                {t.events.live}
              </button>
              <button type="button" className="ra-event" data-testid="event-done" aria-pressed={!live} onClick={goDone}>
                {t.events.done}
              </button>
            </span>
            <button type="button" className="ra-event" data-testid="event-step" disabled={!live} onClick={() => setStep((s) => Math.min(all.length, s + 1))}>
              {t.events.step}
            </button>
            <span className="ra-hint">{t.hint}</span>
          </div>
          <ol className="ra-lines" data-testid="direction-lines">
            {t.lines.map((l, i) => (
              <li key={i} aria-current={i === direction ? "true" : undefined}>
                {l}
              </li>
            ))}
          </ol>
          <p className="ra-recommend" data-testid="recommendation">
            {t.recommend}
          </p>
        </header>
        <div className="ra-stage">
          <MemoryRouter key={run} initialEntries={[`/workspaces/${t.workspace}?conversation=kuitit`]}>
            <Main key={`${direction}-${language}-${run}`} d={direction} evs={evs} live={live} strip={strip} setStrip={setStrip} />
          </MemoryRouter>
        </div>
      </div>
    </LangContext.Provider>
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

if (reviewLanguage === "en") setPersonalLanguage("en");
const root = createRoot(document.getElementById("root")!);
// Keep the shared picker wiring intact: its stage writes become React commits.
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
