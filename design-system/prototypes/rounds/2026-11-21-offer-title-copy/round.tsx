import React, {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import type {
  FileKind,
  FileOfferSummary,
  OfferState,
} from "../../../../web/src/app/fileOffers";
import {
  AssistantMessage,
  ConversationTimeline,
  UserMessage,
} from "../../../../web/src/components/Conversation";
import {
  ConversationFrame,
  ConversationStream,
} from "../../../../web/src/components/ConversationFrame";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import { FileOfferCard } from "../../../../web/src/components/FileOffer";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AgentHeader } from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { CopyButton } from "../../../../web/src/components/ViewLink";
import {
  ViewOfferCard,
  type ViewSummary,
  type ViewVisibility,
} from "../../../../web/src/components/ViewOffer";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import "../../../../web/src/components/components.css";
import { type Format, TEXT, type Text } from "./text";
import "./round.css";

// offer-card-title-copy, round 1. Jari 21.11.2026: the title of a view or
// file the agent offered cannot be selected or copied, and he often wants
// to refer to it when he answers. The card is one press (OfferCard.tsx: a
// button layer beneath the card, and pointer-events: none on everything
// else), so a drag over the title moves the button, not a selection.
//
// One view: the production conversation (ConversationFrame, AgentHeader,
// ConversationTimeline with UserMessage and AssistantMessage, Composer) and
// four offers in a row on the production cards (ViewOfferCard,
// FileOfferCard), one with a long title. Round-own are only each
// direction's piece: direction 1 is CSS on the production title;
// direction 2 places production's CopyButton after the title; direction 3
// places a production ControlButton (Viittaa) at the end of the facts line
// and puts the title in the field as the terminal's Vie keskusteluun puts a
// selection there (BrowserConversation.tsx). The pieces are portalled into
// the production card, which is not changed.
setPersonalLanguage("fi");

// No-break spaces: four labels share the phone's width.
const directions = ["Nyt", "1\u00a0Valinta", "2\u00a0Kopioi", "3\u00a0Viittaa"];
const params = new URLSearchParams(location.search);
const noop = () => {};

// ---------- What was copied: the review's stand-in for the clipboard ----------
// A prototype page served from a plain http address has no clipboard API,
// and a person reviewing cannot see the clipboard anyway, so the review bar
// shows what the page last put there. Where the real API exists it is still
// written to.
let lastCopied = "";
const copiedListeners = new Set<(s: string) => void>();
const noteCopied = (s: string) => {
  lastCopied = s;
  for (const f of copiedListeners) f(s);
};
const realClipboard = navigator.clipboard;
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: {
    writeText: (s: string) => {
      noteCopied(s);
      return realClipboard
        ? realClipboard.writeText(s).catch(() => undefined)
        : Promise.resolve();
    },
  },
});
// Direction 1 copies with the browser's own Copy (Ctrl/⌘+C, the context
// menu, the phone's selection menu). A triple-click selects the title as a
// paragraph, and the browser would copy it with a line break after it,
// which lands in the message field as an empty line; a selection that
// starts in a title is copied without its surrounding whitespace.
document.addEventListener("copy", (e) => {
  const sel = document.getSelection();
  const s = sel?.toString();
  if (!s) return;
  const inTitle = sel?.anchorNode?.parentElement?.closest(".ah-offer-title");
  if (inTitle && s.trim() !== s && e.clipboardData) {
    e.clipboardData.setData("text/plain", s.trim());
    e.preventDefault();
  }
  noteCopied(inTitle ? s.trim() : s);
});
function useCopied() {
  const [s, set] = useState(lastCopied);
  useEffect(() => {
    copiedListeners.add(set);
    return () => {
      copiedListeners.delete(set);
    };
  }, []);
  return s;
}

// ---------- The synthetic offers ----------

type OfferId = "view" | "csv" | "pdf" | "folder";
const created = "2026-11-21T09:12:00Z";
const visibility: ViewVisibility = {
  public: false,
  maxDays: 30,
  onPublic: noop,
  onDuration: noop,
};
function fileOffer(
  id: string,
  title: string,
  items: { path: string; bytes: number; kind: FileKind; lines?: number; columns?: number }[],
  folder?: string,
): { offer: FileOfferSummary; state: OfferState } {
  const offer: FileOfferSummary = {
    offer_id: id,
    title,
    folder,
    files: items.length,
    bytes: items.reduce((n, i) => n + i.bytes, 0),
    created_at: created,
    conversation_id: "c1",
  };
  return { offer, state: { state: "ready", manifest: { offer, items } } };
}

/** What copying gives, and what Viittaa puts in the field. */
export function reference(t: Text, id: OfferId, format: Format) {
  const title = t.offers[id];
  return format === "plain" ? title : `${t.kindWord[id]} ${t.quote(title)}`;
}

// ---------- The directions' own pieces, inside the production card ----------

/** Renders `children` inside the card's element that `where` names: after
 * the title's text, or at the end of the facts line. */
function Inside({
  host,
  where,
  children,
}: {
  host: HTMLElement | null;
  where: "title" | "facts";
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const target = host?.querySelector<HTMLElement>(
      where === "title" ? ".ah-offer-title" : ".ah-offer-body > .ah-offer-facts",
    );
    if (!target) return;
    const span = document.createElement("span");
    span.className = `ot-own ot-own-${where}`;
    target.append(span);
    setSlot(span);
    return () => {
      span.remove();
      setSlot(null);
    };
  }, [host, where]);
  return slot ? createPortal(children, slot) : null;
}

function Offer({
  id,
  d,
  t,
  format,
  open,
  onToggle,
  onRefer,
}: {
  id: OfferId;
  d: number;
  t: Text;
  format: Format;
  open: boolean;
  onToggle: () => void;
  onRefer: (text: string) => void;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const title = t.offers[id];
  let card: ReactNode;
  if (id === "view") {
    const view: ViewSummary = {
      view_id: "v-reitit",
      title,
      entry: "index.html",
      files: 14,
      bytes: 8_400_000,
      created_at: created,
    };
    card = (
      <ViewOfferCard
        view={view}
        open={open}
        onToggle={onToggle}
        onOpenTab={noop}
        visibility={visibility}
      />
    );
  } else {
    const { offer, state } =
      id === "csv"
        ? fileOffer("fcsv", title, [
            { path: t.csvPath, bytes: 48_200, kind: "csv", lines: 25, columns: 7 },
          ])
        : id === "pdf"
          ? fileOffer("fpdf", title, [
              { path: t.pdfPath, bytes: 2_480_000, kind: "pdf" },
            ])
          : fileOffer(
              "fgpx",
              title,
              ["nuuksio-haukankierros", "nuuksio-punarinnankierros", "sipoonkorpi-kalkkiruukki", "sipoonkorpi-byabacken", "sipoonkorpi-storkarr"].map(
                (n) => ({ path: `${t.folderName}/${n}.gpx`, bytes: 180_000, kind: "text" as const }),
              ),
              t.folderName,
            );
    card = (
      <FileOfferCard
        offer={offer}
        state={state}
        open={open}
        onToggle={onToggle}
        onTab={noop}
        visibility={visibility}
      />
    );
  }
  return (
    <div className="ot-offer" ref={setHost} data-offer={id}>
      {card}
      {d === 2 ? (
        <Inside host={host} where="title">
          <CopyButton
            iconOnly
            text={reference(t, id, format)}
            label={t.copyTitle(title)}
            copiedLabel={t.copied}
            blockedLabel={t.copyBlocked}
            data-testid="offer-copy-title"
          />
        </Inside>
      ) : null}
      {d === 3 ? (
        <Inside host={host} where="facts">
          <ControlButton
            size="row"
            variant="quiet"
            className="ot-refer"
            data-testid="offer-refer"
            aria-label={t.referLabel(title)}
            onPress={() => onRefer(reference(t, id, format))}
          >
            <Icon name="at" />
            {t.refer}
          </ControlButton>
        </Inside>
      ) : null}
    </div>
  );
}

// ---------- The conversation: production pieces ----------

const OFFERS: OfferId[] = ["view", "csv", "pdf", "folder"];

function Conversation({ d, t, format }: { d: number; t: Text; format: Format }) {
  const s = useText(statusText);
  const [draft, setDraft] = useState("");
  const [opened, setOpened] = useState<OfferId | null>(null);
  // As Vie keskusteluun: added to the draft, unsent, and the caret after it.
  // An inline reference continues the sentence rather than opening a block.
  const refer = (text: string) => {
    setDraft((old) => (old.trim() ? `${old.replace(/\s*$/, " ")}${text} ` : `${text} `));
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLTextAreaElement>(".ah-composer textarea");
      field?.focus();
      field?.setSelectionRange(field.value.length, field.value.length);
    });
  };
  return (
    <ConversationFrame>
      <AgentHeader
        title={t.convTitle}
        activityLabel={s.rail.newReply}
        activityKind="unknown"
        activityAnimated={false}
        controlLabel=""
        controlKind="neutral"
        workspaceLabel={t.ws}
        workspaceHref={`/workspaces/${t.ws}`}
        detailsExpanded={false}
        onToggleDetails={noop}
      />
      <ConversationStream label={t.convTitle}>
        <ConversationTimeline
          state="ready"
          historyMode="pagedAccessible"
          onJumpToLatest={noop}
          items={[
            { id: "u", kind: "user", content: <UserMessage sourceText={t.asked} onCopy={noop} /> },
            {
              id: "a1",
              kind: "assistant",
              content: (
                <AssistantMessage onCopy={noop}>
                  <Markdown text={t.before} />
                </AssistantMessage>
              ),
            },
            ...OFFERS.map((id) => ({
              id,
              kind: "notice",
              content: (
                <Offer
                  id={id}
                  d={d}
                  t={t}
                  format={format}
                  open={opened === id}
                  onToggle={() => setOpened((o) => (o === id ? null : id))}
                  onRefer={refer}
                />
              ),
            })),
            {
              id: "a2",
              kind: "assistant",
              content: (
                <AssistantMessage streamState="complete" onCopy={noop}>
                  <Markdown text={t.after} />
                </AssistantMessage>
              ),
            },
          ]}
        />
      </ConversationStream>
      <Composer
        value={draft}
        onChange={setDraft}
        activity="idle"
        selectedWorkingMode="steer"
        onModeChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        csrf="prototype"
      />
    </ConversationFrame>
  );
}

// ---------- The page ----------

let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLanguage: "fi" | "en" = params.get("lang") === "en" ? "en" : "fi";
let reviewFormat: Format = params.get("format") === "kind" ? "kind" : "plain";

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(reviewLanguage);
  const [format, setFormat] = useState(reviewFormat);
  const copied = useCopied();
  const bar = useRef<HTMLElement>(null);
  const t = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
  }, [theme, language]);
  return (
    <div className="ot-review" data-direction={direction}>
      <header className="ot-bar" ref={bar}>
        <div className="ot-controls">
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
              }}
            >
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t.format}{" "}
            <select
              id="format"
              value={format}
              onChange={(e) => {
                reviewFormat = e.target.value as Format;
                setFormat(reviewFormat);
              }}
            >
              <option value="plain">{t.formats.plain}</option>
              <option value="kind">{t.formats.kind}</option>
            </select>
          </label>
        </div>
        <ol className="ot-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined}>
              {l}
            </li>
          ))}
        </ol>
        <p className="ot-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
        <p className="ot-clip" data-testid="clipboard">
          {t.clipboard} <q>{copied || t.clipboardEmpty}</q>
        </p>
      </header>
      <div className="ot-stage">
        <MemoryRouter initialEntries={["/workspaces/retkiopas?conversation=c1"]}>
          <StatusBellProvider items={[]}>
            <Conversation key={`${direction}-${language}-${format}`} d={direction} t={t} format={format} />
          </StatusBellProvider>
        </MemoryRouter>
      </div>
    </div>
  );
}

// ---------- Host stand-in: the page asks the host for nothing it needs ----------

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  return new Response("", { status: 404 });
};

if (reviewLanguage === "en") setPersonalLanguage("en");
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
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
