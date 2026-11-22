import React, { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Menu as AriaMenu, MenuSection, MenuTrigger, Popover, Separator } from "react-aria-components";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import { AccountIdentity } from "../../../../web/src/components/Account";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  UserMessage,
} from "../../../../web/src/components/Conversation";
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
import { DIRECTIONS, type Device, type Lang, TEXT, type Text } from "./text";
import "./round.css";

// account-menu-round (22.11.2026), with general-feedback-entry folded in.
// Today's menu (web/src/components/Account.tsx, AccountShelf): person,
// Asetukset, Selitä tämä näkymä, Palvelimen ylläpito, then Teema, Agentin työ
// and Äänet as rows, then Kirjaudu ulos. No item has an icon, and Selitä
// sits between the two items that open a page. One axis: grouping and order
// of the menu, and how much of it is icons.
//   A Groups: pages (Asetukset, Palvelimen ylläpito) | help (Selitä,
//     Palaute Habitatista) | the named quick rows | sign out. A leading icon
//     on every row. Same three-part keyboard structure as production: a menu,
//     the rows reached with Tab, a menu with Kirjaudu ulos.
//   B Actions only: Teema and Agentin työ move to Settings. One menu walked
//     with the arrow keys; muting this device stays as a checkable item
//     because it is the one choice that is urgent (a meeting starts).
//   C Quick row: the quick choices as an icon row under the person, then A's
//     actions with icons.
// In every direction Palvelimen ylläpito is shown only to an administrator,
// Palaute Habitatista opens the general feedback panel (explain-f-reminder
// round 2) as a public GitHub issue, and on a phone the menu is a sheet from
// the bottom of the drawer with touch-height rows. The shell, rail, menu
// primitives, header, timeline and composer are production components;
// the menu bodies, the panel and the toast are this round's. Synthetic
// content throughout.

const params = new URLSearchParams(location.search);
const bare = params.get("bare") === "1";
const noop = () => {};
const VERSION = "0.0.0-proto";
type Theme = "light" | "dark" | "contrast";
type ThemeChoice = "system" | Theme;
type Ctx = { lang: Lang; d: number; admin: boolean; setTheme: (t: Theme) => void };
const RoundContext = React.createContext<Ctx>({ lang: "fi", d: 0, admin: true, setTheme: noop });
const useRound = () => React.useContext(RoundContext);
const useT = (): Text => TEXT[useRound().lang];
const narrow = () => window.matchMedia("(max-width: 800px)").matches;
const frames = (n: number, f: () => void) => (n <= 0 ? f() : requestAnimationFrame(() => frames(n - 1, f)));

// ---------- Device state the menu shows (one per page) ----------

type Prefs = { theme: ThemeChoice; work: "hidden" | "visible"; muted: boolean };
const PrefsContext = React.createContext<[Prefs, (p: Partial<Prefs>) => void]>([
  { theme: "system", work: "hidden", muted: false },
  noop,
]);
const usePrefs = () => React.useContext(PrefsContext);
/** The prototype's night: the device is in its night hours, so sounds rest. */
const NIGHT = params.get("night") === "1";

/** A speaker in the icons' stroke; slashed when quiet (production's). */
function Speaker({ muted }: { muted?: boolean }) {
  return (
    <svg className="ah-speaker" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      {muted ? <path d="M10.5 6l3.5 4M14 6l-3.5 4" /> : <path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 4a5.6 5.6 0 0 1 0 8" />}
    </svg>
  );
}

/** Selitä's own mark, the top bar's "?" (ExplainMode.tsx), so the menu item
 * and the top-bar button read as the same thing. */
const ExplainMark = () => (
  <span className="ah-explain-q" aria-hidden="true">
    ?
  </span>
);

function Lead({ icon }: { icon: IconName | "explain" | "speaker" | "speakerOff" }) {
  return (
    <span className="am-lead" aria-hidden="true">
      {icon === "explain" ? <ExplainMark /> : icon === "speaker" ? <Speaker /> : icon === "speakerOff" ? <Speaker muted /> : <Icon name={icon} />}
    </span>
  );
}

type ItemDef = { id: string; label: string; icon: Parameters<typeof Lead>[0]["icon"]; danger?: boolean };

function Item({ def, after }: { def: ItemDef; after?: ReactNode }) {
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
      {after}
    </ControlMenuItem>
  );
}

// ---------- The quick rows (A), the icon row (C) ----------

function useThemes(t: Text) {
  return [
    { id: "system" as const, label: t.themeSystem, icon: "system" as const },
    { id: "light" as const, label: t.themeLight, icon: "sun" as const },
    { id: "dark" as const, label: t.themeDark, icon: "moon" as const },
    { id: "contrast" as const, label: t.themeContrast, icon: "contrast" as const },
  ];
}

function useChooseTheme() {
  const [, set] = usePrefs();
  const { setTheme } = useRound();
  return (v: ThemeChoice) => {
    set({ theme: v });
    setTheme(v === "system" ? "light" : v);
  };
}

function SoundNote() {
  const t = useT();
  const [p] = usePrefs();
  if (!NIGHT && !p.muted) return null;
  return (
    <p className="am-note" data-testid="sound-note">
      {NIGHT && !p.muted ? <Icon name="moon" /> : <Speaker muted />}
      <span>{NIGHT && !p.muted ? t.night : t.muted}</span>
    </p>
  );
}

function QuickRows() {
  const t = useT();
  const [p, set] = usePrefs();
  const choose = useChooseTheme();
  return (
    <section className="am-quick" data-testid="quick-rows" aria-label={t.groupQuick}>
      <div className="am-row">
        <Lead icon={p.theme === "dark" ? "moon" : p.theme === "contrast" ? "contrast" : p.theme === "light" ? "sun" : "system"} />
        <span className="am-label">{t.theme}</span>
        <Segmented
          data-testid="theme-choice"
          label={t.theme}
          className="ah-account-menu-theme"
          options={useThemes(t).map(({ id, label, icon }) => ({ id, label, icon: <Icon name={icon} />, iconOnly: true, title: label }))}
          value={p.theme}
          onChange={choose}
        />
      </div>
      <div className="am-row">
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
      <div className="am-row">
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
      <SoundNote />
    </section>
  );
}

/** C: one row of icon toggles. Each button names its state for assistive
 * tech and in its tooltip; a press flips it (theme: a four-way group). */
function QuickIcons() {
  const t = useT();
  const [p, set] = usePrefs();
  const choose = useChooseTheme();
  return (
    <section className="am-icons" data-testid="quick-icons" aria-label={t.groupQuick}>
      <Segmented
        data-testid="theme-choice"
        label={t.theme}
        className="am-icons-theme"
        options={useThemes(t).map(({ id, label, icon }) => ({ id, label: `${t.theme}: ${label}`, icon: <Icon name={icon} />, iconOnly: true, title: `${t.theme}: ${label}` }))}
        value={p.theme}
        onChange={choose}
      />
      <span className="am-icons-gap" aria-hidden="true" />
      <button
        type="button"
        className="am-toggle"
        data-testid="work-toggle"
        aria-pressed={p.work === "visible"}
        aria-label={t.agentWork}
        title={p.work === "visible" ? t.workShown : t.workHidden}
        onClick={() => set({ work: p.work === "visible" ? "hidden" : "visible" })}
      >
        <Icon name={p.work === "visible" ? "eye" : "eyeOff"} />
      </button>
      <button
        type="button"
        className="am-toggle"
        data-testid="sound-toggle"
        aria-pressed={p.muted}
        aria-label={`${t.muteHere}`}
        title={p.muted ? t.soundsQuiet : t.soundsPlay}
        onClick={() => set({ muted: !p.muted })}
      >
        <Speaker muted={p.muted} />
      </button>
      <span className="am-icons-state" data-testid="quick-state">
        {p.work === "visible" ? t.workShown : t.workHidden}
        {" · "}
        {p.muted ? t.soundsQuiet : t.soundsPlay}
      </span>
    </section>
  );
}

// ---------- The menu ----------

function AccountMenu({ onAction }: { onAction: (id: string) => void }) {
  const t = useT();
  const { d, admin } = useRound();
  const [p, set] = usePrefs();
  const phone = narrow();
  const person = { name: t.person, email: t.email, avatar_url: "" };
  const first = t.person.split(" ")[0];
  const pages: ItemDef[] = [
    { id: "settings", label: t.settings, icon: "gear" },
    ...(admin ? [{ id: "administration", label: t.administration, icon: "server" as const }] : []),
  ];
  const help: ItemDef[] = [
    { id: "explain", label: t.explain, icon: "explain" },
    { id: "feedback", label: t.feedback, icon: "message" },
  ];
  const logout: ItemDef = { id: "logout", label: t.logout, icon: "logout", danger: true };
  const act = (key: React.Key) => {
    const id = String(key);
    if (id === "mute") return;
    onAction(id);
  };
  const actions = (
    <>
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
    </>
  );
  let body: ReactNode;
  if (d === 1) {
    body = (
      <AriaMenu aria-label={t.menuLabel} onAction={act} className="am-menu" data-testid="account-menu-list">
        {actions}
        <Separator className="am-sep" />
        <MenuSection
          aria-label={t.sounds}
          className="am-section"
          selectionMode="multiple"
          selectedKeys={p.muted ? ["mute"] : []}
          onSelectionChange={(keys) => set({ muted: keys === "all" || (keys as Set<React.Key>).has("mute") })}
        >
          <ControlMenuItem id="mute" data-testid="menu-mute" textValue={t.muteHere} className="am-item">
            <Lead icon={p.muted ? "speakerOff" : "speaker"} />
            <span className="am-label">
              {t.muteHere}
              {NIGHT && !p.muted ? <small className="am-sub">{t.night}</small> : null}
            </span>
            <span className="am-check" aria-hidden="true">
              {p.muted ? <Icon name="check" /> : null}
            </span>
          </ControlMenuItem>
        </MenuSection>
        <Separator className="am-sep" />
        <MenuSection aria-label={t.logout} className="am-section">
          <Item def={logout} />
        </MenuSection>
      </AriaMenu>
    );
  } else {
    body = (
      <>
        {d === 2 ? <QuickIcons /> : null}
        <AriaMenu aria-label={t.menuLabel} onAction={act} className="am-menu" data-testid="account-menu-list">
          {actions}
        </AriaMenu>
        {d === 0 ? <QuickRows /> : null}
        {d === 2 ? <SoundNote /> : null}
        <AriaMenu aria-label={t.menuEnd} onAction={act} className="am-menu am-end" autoFocus={false}>
          <Item def={logout} />
        </AriaMenu>
      </>
    );
  }
  return (
    <div className="ah-account-shelf" data-account-controls>
      <MenuTrigger>
        <ControlButton
          size="row"
          data-testid="account-menu-trigger"
          variant="secondary"
          presentation="account"
          aria-label={t.accountMenuOf(first)}
        >
          <span className="ah-account-trigger">
            <AccountIdentity profile={person} compact />
            {p.muted ? (
              <span className="ah-sound-badge" data-testid="sound-muted-badge">
                <Speaker muted />
              </span>
            ) : null}
          </span>
          <span aria-hidden="true" className="ah-menu-chevron" />
        </ControlButton>
        <Popover
          placement="top start"
          className={`ah-popover ah-account-menu am-popover${phone ? " am-sheet" : ""}`}
          data-direction={d}
          data-testid="account-menu"
        >
          {phone ? <span className="am-grip" aria-hidden="true" /> : null}
          <div className="ah-menu-heading">
            <AccountIdentity profile={person} />
          </div>
          {body}
        </Popover>
      </MenuTrigger>
    </div>
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

function FeedbackPanel({ onClose }: { onClose: (refocus: boolean) => void }) {
  const t = useT();
  const { lang } = useRound();
  const sheet = narrow();
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const [need, setNeed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [sent, setSent] = useState(false);
  const empty = !note.trim();
  useEffect(() => {
    // Desktop: the field. Phone: the sheet, so the keyboard does not cover
    // what the sheet says before the person chooses to type.
    const id = setTimeout(() => (sheet ? box.current?.focus() : field.current?.focus()), 30);
    return () => clearTimeout(id);
  }, [sheet]);
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose(true);
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  const outside = () => {
    if (!empty && !sent) setNudge(true);
    else onClose(false);
  };
  const issue = issueOf(note, lang);
  return (
    <>
      <div className="am-scrim" data-testid="feedback-scrim" onPointerDown={outside} />
      <div
        ref={box}
        className={`am-panel${sheet ? " am-panel-sheet" : ""}`}
        data-testid="feedback-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="am-fb-title"
        tabIndex={-1}
      >
        {sheet ? <span className="am-grip" aria-hidden="true" /> : null}
        <div className="am-panel-head">
          <span className="am-lead" aria-hidden="true">
            <Icon name="message" />
          </span>
          <h2 id="am-fb-title">{t.panelTitle}</h2>
          <button type="button" className="am-x" data-testid="feedback-close" aria-label={t.close} onClick={() => onClose(true)}>
            <Icon name="cross" />
          </button>
        </div>
        {sent ? (
          <div className="am-done" data-testid="feedback-done" tabIndex={-1} ref={doneRef}>
            <p>
              <Icon name="check" /> {t.done}
            </p>
            <p className="am-meta">{t.sentProto}</p>
            <button type="button" className="am-secondary" onClick={() => onClose(true)}>
              {t.close}
            </button>
          </div>
        ) : (
          <div className="am-form">
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
                }}
              >
                <Icon name="github" />
                {t.send}
                <Icon name="external" />
              </button>
              <button type="button" className="am-secondary" data-testid="feedback-cancel" onClick={() => onClose(true)}>
                {t.cancel}
              </button>
            </div>
            <p className="am-meta">{sheet ? t.explainHowPhone : t.explainHow}</p>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- The page ----------

function Main({ openOnLoad }: { openOnLoad: boolean }) {
  const t = useT();
  const { d } = useRound();
  const [draft, setDraft] = useState("");
  const [panel, setPanel] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!openOnLoad) return;
    const phone = narrow();
    if (phone) document.querySelector<HTMLElement>('[data-testid="navigation-open"]')?.click();
    frames(phone ? 4 : 2, () => document.querySelector<HTMLElement>('[data-testid="account-menu-trigger"]')?.click());
  }, [openOnLoad]);
  const onAction = (id: string) => {
    if (id === "feedback") {
      // On the phone the drawer closes under the sheet so the panel has the
      // whole height; Esc or Peru returns to the conversation.
      if (narrow()) document.querySelector<HTMLElement>(".ah-mobile-scrim")?.click();
      setPanel(true);
      return;
    }
    const did = t.did as Record<string, string>;
    setToast(id === "settings" && d === 1 ? did.settingsB : (did[id] ?? ""));
  };
  const close = (refocus: boolean) => {
    setPanel(false);
    if (!refocus) return;
    requestAnimationFrame(() => {
      const back = narrow()
        ? document.querySelector<HTMLElement>('[data-testid="navigation-open"]')
        : document.querySelector<HTMLElement>('[data-testid="account-menu-trigger"]');
      back?.focus();
    });
  };
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
      sessionActions={<AccountMenu onAction={onAction} />}
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
              <AgentHeader
                title={t.conv}
                workspaceLabel={t.workspace}
                workspaceHref={`/workspaces/${t.workspace}`}
                activityLabel=""
                controlLabel=""
                detailsExpanded={false}
                onToggleDetails={noop}
              />
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
      {panel ? <FeedbackPanel onClose={close} /> : null}
      {toast ? (
        <p className="am-toast" role="status" data-testid="toast">
          {toast}
        </p>
      ) : null}
    </StatusBellProvider>
  );
}

function Page({ lang, d, admin, theme, setTheme, openOnLoad, run }: { lang: Lang; d: number; admin: boolean; theme: Theme; setTheme: (t: Theme) => void; openOnLoad: boolean; run: number }) {
  const [prefs, setPrefs] = useState<Prefs>({ theme: theme === "light" ? "system" : theme, work: "hidden", muted: false });
  const t = TEXT[lang];
  return (
    <RoundContext.Provider value={{ lang, d, admin, setTheme }}>
      <PrefsContext.Provider value={[prefs, (p) => setPrefs((old) => ({ ...old, ...p }))]}>
        <MemoryRouter key={`${run}-${lang}`} initialEntries={[`/workspaces/${t.workspace}?conversation=a`]}>
          <Main key={`${d}-${lang}-${admin}-${run}`} openOnLoad={openOnLoad} />
        </MemoryRouter>
      </PrefsContext.Provider>
    </RoundContext.Provider>
  );
}

// ---------- Review page ----------

const firstTheme = (["light", "dark", "contrast"].includes(params.get("theme") ?? "") ? params.get("theme") : "light") as Theme;
let reviewTheme: Theme = firstTheme;
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
let reviewAdmin = params.get("admin") !== "0";
let reviewDevice: Device = (["both", "desktop", "phone"] as Device[]).includes(params.get("device") as Device)
  ? (params.get("device") as Device)
  : "both";

function phoneSrc(d: number, theme: Theme, lang: Lang, admin: boolean, run: number) {
  const q = new URLSearchParams({ bare: "1", d: String(d), theme, lang, admin: admin ? "1" : "0", run: String(run) });
  if (NIGHT) q.set("night", "1");
  return `${location.pathname}?${q}`;
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState(reviewLanguage);
  const [admin, setAdmin] = useState(reviewAdmin);
  const [device, setDevice] = useState(reviewDevice);
  const [run, setRun] = useState(0);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    set();
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const restart = () => setRun((r) => r + 1);
  return (
    <div className="am-review" data-direction={direction} data-device={device}>
      <header className="am-bar" ref={bar}>
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
            {t.device}{" "}
            <select
              id="device"
              value={device}
              onChange={(e) => {
                reviewDevice = e.target.value as Device;
                setDevice(reviewDevice);
                restart();
              }}
            >
              {(["both", "desktop", "phone"] as Device[]).map((k) => (
                <option key={k} value={k}>
                  {t.devices[k]}
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
      <div className="am-stage">
        {device !== "phone" ? (
          <div className="am-desktop" data-testid="desktop-stage">
            <Page lang={lang} d={direction} admin={admin} theme={theme} setTheme={setTheme} openOnLoad run={run} />
          </div>
        ) : null}
        {device !== "desktop" ? (
          <figure className="am-phone" data-testid="phone-stage">
            <iframe
              key={`${direction}-${theme}-${lang}-${admin}-${run}`}
              title={t.phoneCaption}
              src={phoneSrc(direction, theme, lang, admin, run)}
              data-testid="phone-frame"
            />
            <figcaption>{t.phoneCaption}</figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  );
}

/** The phone frame's page: one direction, no review bar, no picker. */
function Bare() {
  const d = Math.min(2, Math.max(0, Number(params.get("d") ?? 0) || 0));
  const [theme, setTheme] = useState(firstTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.add("am-bare");
  }, [theme]);
  return <Page lang={reviewLanguage} d={d} admin={reviewAdmin} theme={theme} setTheme={setTheme} openOnLoad run={0} />;
}

// ---------- Host stand-in: only what the production shell asks for ----------

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
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
