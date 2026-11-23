import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  Dialog,
  Menu as AriaMenu,
  MenuSection,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Separator,
} from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountIdentity, AccountLogoutDialog } from "../../../../web/src/components/Account";
import { AssistantMessage, Composer, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton, ControlMenuItem, Segmented } from "../../../../web/src/components/ControlElements";
import { FEEDBACK_REPO } from "../../../../web/src/components/explainFeedback";
import { Icon, type IconName } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import {
  type AgentNavModel,
  AgentHeader,
  AppShell,
  NowSections,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/ExplainMode.css";
import { DIRECTIONS, type Lang, type Show, TEXT, type Text } from "./text";
import "./round.css";

// account-menu-phone round 2 (23.11.2026): round 1 (2026-11-22-account-menu-
// phone) rebuilt so that it opens as a Habitat view. The view's sandbox CSP
// blocks frames and network, so round 1's iframe phones stayed empty. Here each
// phone is an inline container (Device): production CSS answers to its size
// through container queries (build.mjs rewrites them), React Aria portals its
// overlays into it, window.matchMedia answers width queries as a phone, and
// each phone has its own in-memory history so its Back closes its own layers.
// Directions, content and questions are round 1's unchanged.
//
// account-menu-phone (22.11.2026). Round 1 (2026-11-22-account-menu) settled
// the content and order: Jari chose A Ryhmät with separators only. Today, on a
// phone, the account button sits at the bottom of the navigation drawer and
// opens production's popover (Account.tsx AccountShelf, placement "top
// start") inside the drawer. One axis: what the person row in the drawer
// opens on a phone.
//   A Sheet: a full-width sheet from the bottom edge, finger-height rows,
//     swipe down / Back / tap above it to close.
//   B Popover: today's popover in the drawer, in A's order; it scrolls inside
//     itself on a short phone.
//   C Account page: a full-screen Account page with a back arrow; feedback is
//     its sub-page, an edge swipe or Back returns.
// Every direction answers the phone's Back: each open layer is one history
// entry (state.am = depth), so Back pops exactly one layer and every in-page
// close goes through back() too. The shell, rail, menu
// primitives, logout dialog, header, timeline and composer are production
// components; the menu body, the sheet, the page, the feedback panel and the
// toast are this round's. Synthetic content throughout.

const params = new URLSearchParams(location.search);
const bare = params.get("bare") === "1";
const noop = () => {};
const VERSION = "0.0.0-proto";
type Theme = "light" | "dark" | "contrast";
type ThemeChoice = "system" | Theme;
type Layer = "menu" | "feedback" | "logout";
type Ctx = { lang: Lang; d: number; admin: boolean; setTheme: (t: Theme) => void };
const RoundContext = React.createContext<Ctx>({ lang: "fi", d: 0, admin: true, setTheme: noop });
const useRound = () => React.useContext(RoundContext);
const useT = (): Text => TEXT[useRound().lang];
const frames = (n: number, f: () => void) => (n <= 0 ? f() : requestAnimationFrame(() => frames(n - 1, f)));
const NIGHT = params.get("night") === "1";

// ---------- One phone on a shared page ----------

// Every production component on this page is inside a phone, so a width or
// height query is answered for the phone (the larger one, 390 × 844: both are
// under every breakpoint the shell uses), not for the review window.
const PHONE_W = 390;
const PHONE_H = 844;
const realMatchMedia = window.matchMedia?.bind(window);
window.matchMedia = (query: string) => {
  if (!/width|height/.test(query)) return realMatchMedia(query);
  const px = (v: string, u: string) => Number(v) * (u === "rem" || u === "em" ? 16 : 1);
  const matches = [...query.matchAll(/\((min|max)-(width|height):\s*([\d.]+)(px|rem|em)\)/g)].every(([, mm, dim, v, u]) => {
    const size = dim === "width" ? PHONE_W : PHONE_H;
    return mm === "min" ? size >= px(v, u) : size <= px(v, u);
  });
  const none = () => {};
  return { matches, media: query, onchange: null, addEventListener: none, removeEventListener: none, addListener: none, removeListener: none, dispatchEvent: () => false } as MediaQueryList;
};

// A React Aria modal or popover hides everything outside itself, up to the
// body (inert or aria-hidden). On this page that would freeze the other phone,
// the review bar and the picker while one phone has its menu open, and the two
// phones open theirs at the same time. So the page's own scaffolding, which a
// real phone does not have, refuses to be hidden; inside a phone's screen the
// hiding works as in production. (Marking the phones as React Aria top layers
// instead would also make taps inside them count as "inside", and the sheet's
// tap-outside close would stop working.)
const SCAFFOLD = ".am-review, .am-review > *, .am-stage > *, .am-phone > *, .proto-picker, #root";
const scaffold = (el: Element) => !el.closest(".am-screen") && el.matches(SCAFFOLD);
const inert = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "inert");
if (inert?.set && inert.get) {
  const { get, set } = inert;
  Object.defineProperty(HTMLElement.prototype, "inert", {
    configurable: true,
    get() {
      return get.call(this);
    },
    set(v: boolean) {
      if (v && scaffold(this)) return;
      set.call(this, v);
    },
  });
}
const setAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  if (name === "aria-hidden" && value === "true" && scaffold(this)) return;
  setAttribute.call(this, name, value);
};

/** A phone's own history. Two phones share one window, and a view's sandbox
 * is no place to lean on window.history, so each phone keeps the entries its
 * layers push; Back (the button under the phone, or an am-back event on the
 * device) pops them asynchronously, like popstate. */
class PhoneHistory {
  entries: unknown[] = [null];
  index = 0;
  listeners = new Set<(state: unknown) => void>();
  get state() {
    return this.entries[this.index];
  }
  pushState(state: unknown) {
    this.entries = [...this.entries.slice(0, this.index + 1), state];
    this.index++;
  }
  replaceState(state: unknown) {
    this.entries[this.index] = state;
  }
  go(n: number) {
    setTimeout(() => {
      const next = Math.max(0, Math.min(this.entries.length - 1, this.index + n));
      if (next === this.index) return;
      this.index = next;
      for (const l of this.listeners) l(this.state);
    }, 0);
  }
  back() {
    this.go(-1);
  }
  /** Close every layer now, inside the current event (see Device). */
  resetNow() {
    if (this.index === 0) return;
    this.entries = [this.entries[0]];
    this.index = 0;
    flushSync(() => {
      for (const l of this.listeners) l(this.state);
    });
  }
}
type DeviceCtx = { history: PhoneHistory; root: () => HTMLElement | null };
const DeviceContext = React.createContext<DeviceCtx>({ history: new PhoneHistory(), root: () => null });
const useDevice = () => React.useContext(DeviceContext);

// ---------- Device state the menu shows ----------

type Prefs = { theme: ThemeChoice; work: "hidden" | "visible"; muted: boolean };
const PrefsContext = React.createContext<[Prefs, (p: Partial<Prefs>) => void]>([{ theme: "system", work: "hidden", muted: false }, noop]);
const usePrefs = () => React.useContext(PrefsContext);

function Speaker({ muted }: { muted?: boolean }) {
  return (
    <svg className="ah-speaker" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      {muted ? <path d="M10.5 6l3.5 4M14 6l-3.5 4" /> : <path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 4a5.6 5.6 0 0 1 0 8" />}
    </svg>
  );
}

function Lead({ icon }: { icon: IconName | "explain" | "speaker" | "speakerOff" }) {
  return (
    <span className="am-lead" aria-hidden="true">
      {icon === "explain" ? <span className="ah-explain-q">?</span> : icon === "speaker" ? <Speaker /> : icon === "speakerOff" ? <Speaker muted /> : <Icon name={icon} />}
    </span>
  );
}

type ItemDef = { id: string; label: string; icon: Parameters<typeof Lead>[0]["icon"]; danger?: boolean };

function Item({ def }: { def: ItemDef }) {
  return (
    <ControlMenuItem
      id={def.id}
      data-testid={`menu-${def.id}`}
      data-menu-item={def.id}
      textValue={def.label}
      danger={def.danger}
      className={`am-item${def.danger ? " ah-menu-danger" : ""}`}
    >
      <Lead icon={def.icon} />
      <span className="am-label">{def.label}</span>
    </ControlMenuItem>
  );
}

// ---------- Round 1's direction A body: pages | help | quick rows | sign out ----------

function QuickRows() {
  const t = useT();
  const [p, set] = usePrefs();
  const { setTheme } = useRound();
  const themes = [
    { id: "system" as const, label: t.themeSystem, icon: "system" as const },
    { id: "light" as const, label: t.themeLight, icon: "sun" as const },
    { id: "dark" as const, label: t.themeDark, icon: "moon" as const },
    { id: "contrast" as const, label: t.themeContrast, icon: "contrast" as const },
  ];
  return (
    <section className="am-quick" data-testid="quick-rows" aria-label={t.groupQuick}>
      <div className="am-row" data-quick="theme">
        <Lead icon={p.theme === "dark" ? "moon" : p.theme === "contrast" ? "contrast" : p.theme === "light" ? "sun" : "system"} />
        <span className="am-label">{t.theme}</span>
        <Segmented
          data-testid="theme-choice"
          label={t.theme}
          className="ah-account-menu-theme"
          options={themes.map(({ id, label, icon }) => ({ id, label, icon: <Icon name={icon} />, iconOnly: true, title: label }))}
          value={p.theme}
          onChange={(v) => {
            set({ theme: v });
            setTheme(v === "system" ? "light" : v);
          }}
        />
      </div>
      <div className="am-row" data-quick="work">
        <Lead icon={p.work === "visible" ? "eye" : "eyeOff"} />
        <span className="am-label">{t.agentWork}</span>
        <Segmented
          data-testid="work-choice"
          label={t.agentWork}
          className="ah-account-menu-theme"
          options={[
            { id: "hidden", label: t.hidden },
            { id: "visible", label: t.visible },
          ]}
          value={p.work}
          onChange={(v) => set({ work: v as Prefs["work"] })}
        />
      </div>
      <div className="am-row" data-quick="sounds">
        <Lead icon={p.muted ? "speakerOff" : "speaker"} />
        <span className="am-label">{t.sounds}</span>
        <Segmented
          data-testid="sound-choice"
          label={`${t.sounds}, ${t.scope}`}
          className="ah-account-menu-theme"
          options={[
            { id: "plays", label: t.plays },
            { id: "quiet", label: t.quiet },
          ]}
          value={p.muted ? "quiet" : "plays"}
          onChange={(v) => set({ muted: v === "quiet" })}
        />
      </div>
      {NIGHT || p.muted ? (
        <p className="am-note" data-testid="sound-note">
          {NIGHT && !p.muted ? <Icon name="moon" /> : <Speaker muted />}
          <span>{NIGHT && !p.muted ? t.night : t.muted}</span>
        </p>
      ) : null}
    </section>
  );
}

function MenuBody({ onAction }: { onAction: (id: string) => void }) {
  const t = useT();
  const { admin } = useRound();
  const pages: ItemDef[] = [
    { id: "settings", label: t.settings, icon: "gear" },
    ...(admin ? [{ id: "administration", label: t.administration, icon: "server" as const }] : []),
  ];
  const help: ItemDef[] = [
    { id: "explain", label: t.explain, icon: "explain" },
    { id: "feedback", label: t.feedback, icon: "message" },
  ];
  const act = (key: React.Key) => onAction(String(key));
  return (
    <>
      <AriaMenu aria-label={t.menuLabel} onAction={act} className="am-menu" data-testid="account-menu-list">
        <MenuSection aria-label={t.groupPages} className="am-section">
          {pages.map((def) => (
            <Item key={def.id} def={def} />
          ))}
        </MenuSection>
        <Separator className="am-sep" />
        <MenuSection aria-label={t.groupHelp} className="am-section">
          {help.map((def) => (
            <Item key={def.id} def={def} />
          ))}
        </MenuSection>
      </AriaMenu>
      <QuickRows />
      <AriaMenu aria-label={t.menuEnd} onAction={act} className="am-menu am-end" autoFocus={false}>
        <Item def={{ id: "logout", label: t.logout, icon: "logout", danger: true }} />
      </AriaMenu>
    </>
  );
}

const person = (t: Text) => ({ name: t.person, email: t.email, avatar_url: "" });

/** The drawer's person row: production's account trigger. */
function PersonRow({ onPress, label, expanded }: { onPress?: () => void; label: string; expanded?: boolean }) {
  const t = useT();
  const [p] = usePrefs();
  const { d } = useRound();
  return (
    <ControlButton
      size="row"
      data-testid="account-menu-trigger"
      variant="secondary"
      presentation="account"
      aria-label={label}
      aria-haspopup={d === 2 ? undefined : "dialog"}
      aria-expanded={d === 2 ? undefined : expanded}
      onPress={onPress}
    >
      <span className="ah-account-trigger">
        <AccountIdentity profile={person(t)} compact />
        {p.muted ? (
          <span className="ah-sound-badge" data-testid="sound-muted-badge">
            <Speaker muted />
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className={d === 2 ? "am-chevron-right" : "ah-menu-chevron"} />
    </ControlButton>
  );
}

// ---------- Gestures ----------

/** Drag a sheet down by its head; past the threshold it closes. */
function useSwipeDown(onClose: () => void) {
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  return {
    dy,
    bind: {
      onPointerDown: (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest("button")) return;
        start.current = e.clientY;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (start.current !== null) setDy(Math.max(0, e.clientY - start.current));
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (start.current === null) return;
        const moved = e.clientY - start.current;
        start.current = null;
        setDy(0);
        if (moved > 70) onClose();
      },
      onPointerCancel: () => {
        start.current = null;
        setDy(0);
      },
    },
  };
}

/** A swipe from the left edge, like iOS's back gesture. */
function useEdgeSwipe(onBack: () => void) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  return {
    dx,
    bind: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.clientX > 24) return;
        // A sub-page's swipe must not also reach the page under it (React
        // events bubble through portals).
        e.stopPropagation();
        start.current = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (start.current !== null) setDx(Math.max(0, e.clientX - start.current));
      },
      onPointerUp: (e: React.PointerEvent) => {
        if (start.current === null) return;
        e.stopPropagation();
        const moved = e.clientX - start.current;
        start.current = null;
        setDx(0);
        if (moved > 80) onBack();
      },
      onPointerCancel: () => {
        start.current = null;
        setDx(0);
      },
    },
  };
}

// ---------- A: the sheet ----------

function SheetMenu({ open, onBack, onAction }: { open: boolean; onBack: () => void; onAction: (id: string) => void }) {
  const t = useT();
  const swipe = useSwipeDown(onBack);
  return (
    <ModalOverlay isOpen={open} onOpenChange={(o) => !o && onBack()} isDismissable className="am-overlay" data-testid="sheet-scrim">
      <Modal className="am-sheet" style={swipe.dy ? { transform: `translateY(${swipe.dy}px)`, transition: "none" } : undefined}>
        <Dialog aria-label={t.menuLabel} className="am-sheet-dialog" data-testid="account-menu" data-shape="sheet">
          <div className="am-sheet-head" data-testid="sheet-head" {...swipe.bind}>
            <span className="am-grip" aria-hidden="true" />
            <div className="ah-menu-heading">
              <AccountIdentity profile={person(t)} />
            </div>
          </div>
          <div className="am-sheet-body">
            <MenuBody onAction={onAction} />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- C: the account page ----------

function AccountPage({ open, onBack, onAction, children }: { open: boolean; onBack: () => void; onAction: (id: string) => void; children?: ReactNode }) {
  const t = useT();
  const edge = useEdgeSwipe(onBack);
  return (
    <ModalOverlay isOpen={open} onOpenChange={(o) => !o && onBack()} className="am-page-overlay">
      <Modal className="am-page" style={edge.dx ? { transform: `translateX(${edge.dx}px)`, transition: "none" } : undefined}>
        <Dialog aria-labelledby="am-page-title" className="am-page-dialog" data-testid="account-menu" data-shape="page" {...edge.bind}>
          <header className="am-page-bar">
            <button type="button" className="am-back" data-testid="page-back" aria-label={t.backTo} onClick={onBack}>
              <Icon name="back" />
            </button>
            <h2 id="am-page-title">{t.accountPage}</h2>
          </header>
          <div className="am-page-body">
            <div className="ah-menu-heading am-page-person">
              <AccountIdentity profile={person(t)} />
            </div>
            <MenuBody onAction={onAction} />
          </div>
          {children}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- General feedback ----------

function issueOf(note: string, lang: Lang) {
  const text = note.trim().slice(0, 1200);
  const title = `Feedback: ${text.split("\n")[0].slice(0, 60) || "…"}`;
  const fields = { feedback: text, view: "conversation", version: VERSION, language: lang };
  const query = new URLSearchParams({ template: "feedback.yml", title, ...fields });
  return {
    lines: [title, "", text || "…", "", "View: conversation", `Open Habitat ${VERSION} · ${lang}`],
    url: `https://github.com/${FEEDBACK_REPO}/issues/new?${query}`,
  };
}

/** The general feedback panel: a bottom sheet (A, B) or a sub-page (C). The
 * draft lives in Main, so Back and a reopen keep what was written. */
function FeedbackPanel({ shape, note, setNote, onBack }: { shape: "sheet" | "page"; note: string; setNote: (s: string) => void; onBack: () => void }) {
  const t = useT();
  const { lang } = useRound();
  const field = useRef<HTMLTextAreaElement>(null);
  const [need, setNeed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [sent, setSent] = useState(false);
  const empty = !note.trim();
  const swipe = useSwipeDown(onBack);
  const edge = useEdgeSwipe(onBack);
  const issue = issueOf(note, lang);
  const dismiss = () => {
    if (!empty && !sent) setNudge(true);
    else onBack();
  };
  const style = shape === "sheet" && swipe.dy ? { transform: `translateY(${swipe.dy}px)`, transition: "none" } : shape === "page" && edge.dx ? { transform: `translateX(${edge.dx}px)`, transition: "none" } : undefined;
  return (
    <ModalOverlay isOpen onOpenChange={(o) => !o && dismiss()} isDismissable={shape === "sheet"} className={shape === "sheet" ? "am-overlay" : "am-page-overlay"}>
      <Modal className={shape === "sheet" ? "am-sheet am-panel-sheet" : "am-page"} style={style}>
        <Dialog aria-labelledby="am-fb-title" className={shape === "sheet" ? "am-sheet-dialog" : "am-page-dialog"} data-testid="feedback-panel" data-shape={shape} {...(shape === "page" ? edge.bind : {})}>
          {shape === "sheet" ? (
            <div className="am-sheet-head am-panel-head" {...swipe.bind}>
              <span className="am-grip" aria-hidden="true" />
              <div className="am-panel-title">
                <span className="am-lead" aria-hidden="true">
                  <Icon name="message" />
                </span>
                <h2 id="am-fb-title">{t.panelTitle}</h2>
                <button type="button" className="am-x" data-testid="feedback-close" aria-label={t.close} onClick={onBack}>
                  <Icon name="cross" />
                </button>
              </div>
            </div>
          ) : (
            <header className="am-page-bar">
              <button type="button" className="am-back" data-testid="feedback-close" aria-label={t.backTo} onClick={onBack}>
                <Icon name="back" />
              </button>
              <h2 id="am-fb-title">{t.panelTitle}</h2>
            </header>
          )}
          <div className={shape === "sheet" ? "am-sheet-body am-form" : "am-page-body am-form"}>
            {sent ? (
              <div className="am-done" data-testid="feedback-done">
                <p>
                  <Icon name="check" /> {t.done}
                </p>
                <p className="am-meta">{t.sentProto}</p>
                <button type="button" className="am-secondary" onClick={onBack}>
                  {t.close}
                </button>
              </div>
            ) : (
              <>
                <p className="am-lead-text">{t.lead}</p>
                <label htmlFor="am-fb-note">{t.label}</label>
                <textarea
                  id="am-fb-note"
                  ref={field}
                  data-testid="feedback-text"
                  rows={4}
                  maxLength={1200}
                  aria-invalid={need && empty ? true : undefined}
                  aria-describedby="am-fb-facts"
                  placeholder={t.placeholder}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    if (e.target.value.trim()) setNeed(false);
                  }}
                />
                {need && empty ? (
                  <p className="am-nudge" role="alert">
                    {t.need}
                  </p>
                ) : null}
                <section className="am-facts" id="am-fb-facts" data-testid="feedback-facts" aria-label={t.publicTitle}>
                  <p className="am-public">
                    <Icon name="globe" />
                    <b>{t.publicTitle}</b>
                  </p>
                  <p>{t.publicText}</p>
                  <p>
                    <b>{t.autoTitle}:</b> {t.auto}
                  </p>
                  <p>
                    <b>{t.neverTitle}:</b> {t.never}
                  </p>
                  <button type="button" className="am-link" data-testid="feedback-preview-toggle" aria-expanded={preview} onClick={() => setPreview(!preview)}>
                    {preview ? t.previewHide : t.preview}
                  </button>
                  {preview ? (
                    <pre className="am-preview" data-testid="feedback-preview">
                      {issue.lines.join("\n")}
                    </pre>
                  ) : null}
                </section>
                {nudge ? (
                  <p className="am-nudge" role="status" data-testid="feedback-nudge">
                    {t.finishFirst}
                  </p>
                ) : null}
                <div className="am-actions">
                  <button
                    type="button"
                    className="am-send"
                    data-testid="feedback-send"
                    data-url={issue.url}
                    onClick={() => {
                      if (empty) {
                        setNeed(true);
                        field.current?.focus({ preventScroll: true });
                        return;
                      }
                      setSent(true);
                      setNote("");
                    }}
                  >
                    <Icon name="github" />
                    {t.send}
                    <Icon name="external" />
                  </button>
                  <button type="button" className="am-secondary" data-testid="feedback-cancel" onClick={onBack}>
                    {t.cancel}
                  </button>
                </div>
                <p className="am-meta">{t.explainHowPhone}</p>
              </>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- Layers as history entries ----------

/** Each open layer is one history entry, so the phone's Back closes exactly
 * one; in-page closes call history.back() so the two never disagree. */
function useLayers() {
  const [layers, setLayers] = useState<Layer[]>([]);
  // The truth between a close and its popstate: React state lags a tick,
  // and a menu that closes itself after an action must not pop twice.
  const now = useRef<Layer[]>([]);
  const { history } = useDevice();
  const set = (l: Layer[]) => {
    now.current = l;
    setLayers(l);
  };
  useEffect(() => {
    history.replaceState({ am: 0 });
    const pop = (state: unknown) => {
      const am = (state as { am?: unknown } | null)?.am;
      set(now.current.slice(0, typeof am === "number" ? am : 0));
    };
    history.listeners.add(pop);
    return () => {
      history.listeners.delete(pop);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: one history per phone
  }, []);
  return {
    layers,
    top: layers.at(-1),
    push: (l: Layer) => {
      const next = [...now.current, l];
      history.pushState({ am: next.length });
      set(next);
    },
    replace: (l: Layer) => set([...now.current.slice(0, -1), l]),
    /** Close the top layer, only if it is the one the caller owns. */
    back: (owner: Layer) => {
      if (now.current.at(-1) !== owner) return;
      now.current = now.current.slice(0, -1);
      history.back();
    },
    closeAll: () => {
      const n = now.current.length;
      now.current = [];
      if (n) history.go(-n);
    },
  };
}

// ---------- The page ----------

function Main({ show }: { show: Show }) {
  const t = useT();
  const { d } = useRound();
  const { root } = useDevice();
  const tap = (selector: string) => root()?.querySelector<HTMLElement>(selector)?.click();
  const closeDrawer = () => tap(".ah-mobile-scrim");
  const L = useLayers();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    tap('[data-testid="navigation-open"]');
    frames(4, () => {
      if (d === 1) tap('[data-testid="account-menu-trigger"]');
      else L.push("menu");
      if (show === "menu") return;
      frames(3, () => onAction(show));
    });
    // biome-ignore lint/correctness/useExhaustiveDependencies: opens once on load
  }, []);
  const onAction = (id: string) => {
    if (id === "feedback" || id === "logout") {
      if (d === 2) return L.push(id);
      // A, B: the menu gives way to the panel or the dialog, and the drawer
      // closes under the feedback sheet so it has the whole height.
      if (id === "feedback") closeDrawer();
      return L.replace(id);
    }
    L.closeAll();
    closeDrawer();
    setToast((t.did as Record<string, string>)[id] ?? "");
  };
  const menuOpen = L.layers.includes("menu");
  const accountLabel = d === 2 ? t.accountPageOf(t.person.split(" ")[0]) : t.accountMenuOf(t.person.split(" ")[0]);
  let account: ReactNode;
  if (d === 1) {
    account = (
      <MenuTrigger isOpen={L.top === "menu"} onOpenChange={(o) => (o ? L.top !== "menu" && L.push("menu") : L.back("menu"))}>
        <PersonRow label={accountLabel} />
        <Popover placement="top start" className="ah-popover ah-account-menu am-pop" data-testid="account-menu" data-shape="popover">
          <div className="ah-menu-heading">
            <AccountIdentity profile={person(t)} />
          </div>
          <MenuBody onAction={onAction} />
        </Popover>
      </MenuTrigger>
    );
  } else {
    account = <PersonRow label={accountLabel} expanded={menuOpen} onPress={() => L.push("menu")} />;
  }
  const feedback = L.top === "feedback" ? <FeedbackPanel shape={d === 2 ? "page" : "sheet"} note={note} setNote={setNote} onBack={() => L.back("feedback")} /> : null;
  const logout = (
    <AccountLogoutDialog
      open={L.top === "logout"}
      onClose={() => L.back("logout")}
      onConfirm={() => {
        L.closeAll();
        closeDrawer();
        setToast(t.did.loggedOut);
      }}
    />
  );
  const path = `/workspaces/${t.workspace}?conversation=a`;
  const rowA: AgentNavModel = {
    agentId: "pi:a",
    title: t.conv,
    href: path,
    activity: "waiting",
    activityLabel: t.waits,
    attentionLabel: t.waits,
    controlLabel: "",
    workspaceId: "ws_kotitalous00",
    workspaceName: t.workspace,
    detail: t.workspace,
    changedAt: Date.now() - 60_000,
    selected: true,
  };
  const rowB: AgentNavModel = {
    agentId: "pi:b",
    title: t.otherConv,
    href: `/workspaces/${t.otherWorkspace}?conversation=b`,
    activity: "waiting",
    activityLabel: t.doneLabel,
    controlLabel: "",
    workspaceId: "ws_yhdistys000",
    workspaceName: t.otherWorkspace,
    detail: t.otherWorkspace,
    changedAt: Date.now() - 32 * 60_000,
    turnMark: "read",
    selected: false,
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
      now={<NowSections yours={[rowA, rowB]} running={[]} />}
      sessionActions={
        <div className="ah-account-shelf" data-account-controls>
          {account}
        </div>
      }
    >
      <WorkspaceNavRow name={t.workspace} href={`/workspaces/${t.workspace}`} selected />
      <WorkspaceNavRow name={t.otherWorkspace} href={`/workspaces/${t.otherWorkspace}`} selected={false} />
    </WorkspaceRail>
  );
  const items = [
    {
      id: "u1",
      kind: "user",
      content: (
        <UserMessage sourceText={t.ask} onCopy={noop} time="9.12">
          <Markdown text={t.ask} />
        </UserMessage>
      ),
    },
    {
      id: "a1",
      kind: "assistant",
      content: (
        <AssistantMessage streamState="complete" time="9.13" onCopy={noop}>
          <Markdown text={t.reply} />
        </AssistantMessage>
      ),
    },
  ];
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={t.conv}
        navigationBadge={1}
        rail={rail}
        main={
          <div className="am-main" data-testid="conversation">
            <ConversationFrame>
              <AgentHeader title={t.conv} workspaceLabel={t.workspace} workspaceHref={`/workspaces/${t.workspace}`} activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
              <ConversationStream>
                <ConversationTimeline state="ready" items={items} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />
              </ConversationStream>
              <Composer
                value={draft}
                onChange={setDraft}
                activity="idle"
                selectedWorkingMode="steer"
                onModeChange={noop}
                onSendNow={() => setDraft("")}
                onSteer={() => setDraft("")}
                onFollowUp={() => setDraft("")}
                idlePlaceholder=""
              />
            </ConversationFrame>
          </div>
        }
      />
      {d === 0 ? <SheetMenu open={L.top === "menu"} onBack={() => L.back("menu")} onAction={onAction} /> : null}
      {d === 2 ? (
        <AccountPage open={menuOpen} onBack={() => L.back("menu")} onAction={onAction}>
          {feedback}
          {logout}
        </AccountPage>
      ) : (
        <>
          {feedback}
          {logout}
        </>
      )}
      {toast ? (
        <p className="am-toast" role="status" data-testid="toast">
          {toast}
        </p>
      ) : null}
      <output className="am-depth" data-testid="layers" hidden>
        {L.layers.join(",")}
      </output>
    </StatusBellProvider>
  );
}

function Page({ lang, d, admin, theme, setTheme, show }: { lang: Lang; d: number; admin: boolean; theme: Theme; setTheme: (t: Theme) => void; show: Show }) {
  const [prefs, setPrefs] = useState<Prefs>({ theme: theme === "light" ? "system" : theme, work: "hidden", muted: false });
  const t = TEXT[lang];
  return (
    <RoundContext.Provider value={{ lang, d, admin, setTheme }}>
      <PrefsContext.Provider value={[prefs, (p) => setPrefs((old) => ({ ...old, ...p }))]}>
        <MemoryRouter initialEntries={[`/workspaces/${t.workspace}?conversation=a`]}>
          <Main show={show} />
        </MemoryRouter>
      </PrefsContext.Provider>
    </RoundContext.Provider>
  );
}

// ---------- Review page: two phones side by side ----------

const firstTheme = (["light", "dark", "contrast"].includes(params.get("theme") ?? "") ? params.get("theme") : "light") as Theme;
let reviewTheme: Theme = firstTheme;
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
let reviewAdmin = params.get("admin") !== "0";
const SHOWS: Show[] = ["menu", "feedback", "logout"];
let reviewShow: Show = SHOWS.includes(params.get("show") as Show) ? (params.get("show") as Show) : "menu";
const PHONES = [
  { w: 390, h: 844, key: "frame844" as const },
  { w: 360, h: 640, key: "frame640" as const },
];

/** One phone: an inline container the production shell lays itself out in.
 * container-type: size makes it the containing block of the shell's fixed
 * layers and the target of the rewritten container queries; overlays portal
 * into its screen, so they stay inside it and scale with it.
 *
 * React Aria keeps one stack of open overlays per page and treats a press
 * anywhere outside the topmost one as a dismissal, which it swallows. With two
 * phones open side by side, a tap in one phone would close the other phone's
 * menu instead of doing what was tapped. So a press outside a phone (and its
 * caption) first closes that phone's layers, synchronously, before React
 * Aria sees the press: the phone you touch is the live one. */
function Device({ w, h, scale = 1, d, theme, lang, admin, show, historyRef, testid }: { w?: number; h?: number; scale?: number; d: number; theme: Theme; lang: Lang; admin: boolean; show: Show; historyRef?: (h: PhoneHistory) => void; testid?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const [history] = useState(() => new PhoneHistory());
  const [phoneTheme, setPhoneTheme] = useState(theme);
  const ctx = React.useMemo(() => ({ history, root: () => screen.current }), [history]);
  useEffect(() => {
    historyRef?.(history);
    const el = box.current;
    const back = () => history.back();
    const press = (e: Event) => {
      const own = el?.closest(".am-phone") ?? el;
      if (own && !own.contains(e.target as Node)) history.resetNow();
    };
    el?.addEventListener("am-back", back);
    window.addEventListener("pointerdown", press, true);
    return () => {
      el?.removeEventListener("am-back", back);
      window.removeEventListener("pointerdown", press, true);
    };
  }, [history, historyRef]);
  return (
    <div
      ref={box}
      className="am-device"
      data-testid={testid ?? "device"}
      style={w && h ? ({ width: w, height: h, transform: scale !== 1 ? `scale(${scale})` : undefined, "--am-scale": scale } as React.CSSProperties) : undefined}
    >
      <div ref={screen} className="am-screen" data-theme={phoneTheme} data-testid="phone-screen">
        <DeviceContext.Provider value={ctx}>
          <UNSAFE_PortalProvider getContainer={() => portal.current}>
            <Page lang={lang} d={d} admin={admin} theme={phoneTheme} setTheme={setPhoneTheme} show={show} />
          </UNSAFE_PortalProvider>
        </DeviceContext.Provider>
        <div ref={portal} className="am-portal" />
      </div>
    </div>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState(reviewLanguage);
  const [admin, setAdmin] = useState(reviewAdmin);
  const [show, setShow] = useState(reviewShow);
  const [run, setRun] = useState(0);
  const [scale, setScale] = useState(1);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  const histories = useRef<PhoneHistory[]>([]);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const fit = () => {
      const h = bar.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--review-h", `${h}px`);
      // Both frames at one scale, so their sizes stay comparable.
      const room = innerHeight - h - 64 - 40;
      const wide = (innerWidth - 60) / (390 + 360 + 40);
      setScale(Math.max(0.4, Math.min(1, room / 844, wide)));
    };
    fit();
    const o = new ResizeObserver(fit);
    if (bar.current) o.observe(bar.current);
    addEventListener("resize", fit);
    return () => {
      o.disconnect();
      removeEventListener("resize", fit);
    };
  }, []);
  const restart = () => setRun((r) => r + 1);
  return (
    <div className="am-review" data-direction={direction}>
      <header className="am-bar" ref={bar} data-react-aria-top-layer="true">
        <div className="am-controls">
          <strong>{t.title}</strong>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as Theme;
                setTheme(reviewTheme);
                restart();
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
              value={lang}
              onChange={(e) => {
                reviewLanguage = e.target.value as Lang;
                setPersonalLanguage(reviewLanguage);
                setLang(reviewLanguage);
                restart();
              }}
            >
              <option value="fi">suomi</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {t.role}{" "}
            <select
              id="role"
              value={admin ? "admin" : "member"}
              onChange={(e) => {
                reviewAdmin = e.target.value === "admin";
                setAdmin(reviewAdmin);
                restart();
              }}
            >
              <option value="admin">{t.roles.admin}</option>
              <option value="member">{t.roles.member}</option>
            </select>
          </label>
          <label>
            {t.showLabel}{" "}
            <select
              id="show"
              value={show}
              onChange={(e) => {
                reviewShow = e.target.value as Show;
                setShow(reviewShow);
                restart();
              }}
            >
              {SHOWS.map((k) => (
                <option key={k} value={k}>
                  {t.shows[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="am-event" data-testid="event-reset" onClick={restart}>
            {t.reset}
          </button>
        </div>
        <ol className="am-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined} title={l}>
              {l}
            </li>
          ))}
        </ol>
        <p className="am-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <div className="am-stage" style={{ "--s": scale } as React.CSSProperties}>
        {PHONES.map((p, i) => (
          <figure key={p.key} className="am-phone" data-testid={`phone-${p.h}`} style={{ width: p.w * scale }}>
            <div className="am-phone-box" style={{ width: p.w * scale, height: p.h * scale }}>
              <Device
                key={`${direction}-${theme}-${lang}-${admin}-${show}-${run}`}
                testid="phone-frame"
                w={p.w}
                h={p.h}
                scale={scale}
                d={direction}
                theme={theme}
                lang={lang}
                admin={admin}
                show={show}
                historyRef={(h) => {
                  histories.current[i] = h;
                }}
              />
            </div>
            <figcaption data-react-aria-top-layer="true">
              <span>{t[p.key]}</span>
              <button type="button" className="am-event" data-testid={`back-${p.h}`} title={t.backTitle} onClick={() => histories.current[i]?.back()}>
                {t.back}
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** One phone filling the window: one direction, no review bar, no picker. */
function Bare() {
  const d = Math.min(2, Math.max(0, Number(params.get("d") ?? 0) || 0));
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = firstTheme;
    document.documentElement.classList.add("am-bare");
  }, []);
  return <Device d={d} theme={firstTheme} lang={reviewLanguage} admin={reviewAdmin} show={reviewShow} />;
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
// No request leaves the page: a view's CSP refuses every connection.
window.fetch = async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (path === "/api/v1/server") return json({ schema_version: 1, name: "Habitat", administrator: reviewAdmin, version: VERSION });
  return new Response("", { status: 404 });
};

setPersonalLanguage(reviewLanguage);
const root = createRoot(document.getElementById("root")!);
if (bare) {
  root.render(<Bare />);
} else {
  // Keep the shared reference wiring intact: its stage writes become React commits.
  const stageSink = {
    set innerHTML(view: ReactNode) {
      flushSync(() => root.render(view === "" ? null : view));
    },
  };
  const variants = DIRECTIONS.map((_, direction) => () => <App key={direction} direction={direction} />);
  const picker = document.createElement("nav");
  picker.className = "proto-picker";
  picker.setAttribute("aria-label", "Prototype variants");
  picker.setAttribute("data-react-aria-top-layer", "true");
  picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
  DIRECTIONS.forEach((n, i) => {
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
}

export type { React };
