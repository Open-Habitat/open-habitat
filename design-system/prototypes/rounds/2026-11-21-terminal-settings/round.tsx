import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { Button, Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { FitAddon } from "@xterm/addon-fit";
import { type ITheme, Terminal as XTerm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import settingsPaths from "../../../../internal/uiroutes/settings.json";
import { AccountSettings, AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, UserMessage } from "../../../../web/src/components/Conversation";
import { ControlButton, IconButton, Segmented } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import type { TerminalSelection } from "../../../../web/src/components/Terminal";
import { TerminalPanel } from "../../../../web/src/components/TerminalPanel";
import { terminalCopyKey } from "../../../../web/src/components/terminalKeyboard";
import { PiModelsProvider } from "../../../../web/src/app/PiModels";
import { type ShownSection, shownSettingsSections } from "../../../../web/src/app/settingsIndex";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { statusText } from "../../../../web/src/text/status";
import { type Cursor, type FontSize, type Lang, type Paste, TEXT, type Text, type View } from "./text";
import "./round.css";

// terminal-settings-page, round 1 (Jari 21.11.2026: copy on select becomes
// an ordinary terminal setting, off by default, on a page that gathers the
// terminal's configuration). The content is the same in every direction:
// copy on select (exists today as an experimental switch), text size, cursor
// shape and multi-line paste (proposals: each is one xterm option or one
// existing branch in BrowserShell), and what the terminal already does
// without a setting (colours follow the theme, address cards, tmux history,
// Shift to select). The axis is where the page lives:
//   A  Settings › Terminal, an ordinary section; nothing new in the panel;
//   B  a gear in the terminal panel, settings over the live terminal;
//      Settings only points there;
//   C  Settings › Terminal opening with a live preview terminal, and a gear
//      in the panel that leads to that section.
// The surface here is xterm.js on the design tokens like production's
// TerminalSurface, which has no font-size or cursor option to change yet.
// No host runs: the terminal output is written once, and copies are logged
// in window.__copies (the browser may refuse the clipboard headless).

const NAMES = ["A Osio", "B Ratas", "C Esikatselu"];
const A = 0, B = 1, C = 2;
const params = new URLSearchParams(location.search);
const noop = () => {};
let lang: Lang = params.get("lang") === "en" ? "en" : "fi";
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const phone = () => matchMedia("(max-width: 760px)").matches;

// ---- The section in production's own settings index ----
for (const l of ["fi", "en"] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const x = TEXT[l];
  const at = list.findIndex((s) => s.id === "editori") + 1;
  list.splice(at, 0, {
    id: "paate" as ShownSection["id"], label: x.section, icon: "terminal", kw: x.sectionKw,
    rows: [
      { id: "terminal-copy-on-select", label: x.copy, kw: ["kopioi", "copy", "leikepöytä", "clipboard", "valinta", "selection"], desc: x.copyDesc.replace("{key}", terminalCopyKey) },
      { id: "terminal-font-size", label: x.font, kw: ["fontti", "font", "koko", "size", "zoom"], desc: x.fontDesc },
      { id: "terminal-cursor", label: x.cursor, kw: ["kursori", "cursor", "kohdistin"], desc: x.cursorDesc },
      { id: "terminal-paste", label: x.paste, kw: ["liitä", "paste", "rivit", "lines"], desc: x.pasteDesc },
    ],
  } as unknown as ShownSection);
  // Copy on select leaves Kokeelliset ominaisuudet for the section above.
  const ex = list.find((s) => s.id === "kokeelliset");
  if (ex) (ex as { rows: { id: string }[] }).rows = ex.rows.filter((r) => r.id !== "terminal-copy-on-select" && r.id !== "terminal-open-urls");
}

// ---- Settings state ----
type Prefs = { copy: boolean; font: FontSize; cursor: Cursor; paste: Paste };
const defaults = (): Prefs => ({ copy: false, font: "normal", cursor: "block", paste: "ask" });
let prefs: Prefs = defaults();
const listeners = new Set<() => void>();
const set = (next: Partial<Prefs>) => { prefs = { ...prefs, ...next }; listeners.forEach((f) => f()); };
function usePrefs() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return prefs;
}
declare global { interface Window { __copies: string[]; __prefs: () => Prefs; __pastes: string[] } }
window.__copies = []; window.__pastes = [];
window.__prefs = () => prefs;
const FONT_PX: Record<FontSize, [number, number]> = { small: [11, 10.5], normal: [12.5, 12], large: [14, 13] };

// ---- The surface: xterm.js on the tokens, as production's TerminalSurface ----
function tokenTheme(el: Element): ITheme {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const ink = v("--ah-ink");
  return {
    background: v("--ah-sunken"), foreground: ink, cursor: ink, cursorAccent: v("--ah-sunken"),
    selectionBackground: v("--ah-terminal-selection"), selectionInactiveBackground: v("--ah-terminal-selection"),
    selectionForeground: v("--ah-terminal-selection-ink"),
    black: ink, red: v("--ah-err"), green: v("--ah-ok"), yellow: v("--ah-syntax-number"), blue: v("--ah-accent-ink"),
    magenta: v("--ah-syntax-keyword"), cyan: v("--ah-syntax-string"), white: v("--ah-muted"),
    brightBlack: v("--ah-muted"), brightRed: v("--ah-err"), brightGreen: v("--ah-ok"), brightYellow: v("--ah-syntax-number"),
    brightBlue: v("--ah-accent-ink"), brightMagenta: v("--ah-syntax-keyword"), brightCyan: v("--ah-syntax-string"), brightWhite: v("--ah-ink-2"),
  };
}
const prompt = "\x1b[1;32maino@habitat\x1b[0m:\x1b[1;34m~/src/aurinkokello\x1b[0m$ ";
const SAMPLE = [
  `${prompt}git log --oneline -3`,
  "\x1b[33m1a19356\x1b[0m clock: read the zone from the system",
  "\x1b[33mf46502d\x1b[0m clock: winter time for the alarm",
  "\x1b[33m6ea2b5b\x1b[0m web: larger digits on a phone",
  `${prompt}go test ./...`,
  "\x1b[31m--- FAIL\x1b[0m: TestAlarmWinter (0.00s)",
  "\x1b[31mFAIL\x1b[0m\texample.invalid/aurinkokello/internal/clock\t\x1b[2m0.412s\x1b[0m",
  "\x1b[32mok\x1b[0m  \texample.invalid/aurinkokello/internal/web\t\x1b[2m1.207s\x1b[0m",
  prompt,
].join("\r\n");

type SurfaceApi = { write: (s: string) => void };
function ProtoSurface({ label, testid, onSelection, onCopied, api }: {
  label: string; testid: string;
  onSelection?: (s: TerminalSelection | undefined) => void;
  onCopied?: (text: string) => void;
  api?: (a: SurfaceApi) => void;
}) {
  const p = usePrefs();
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<XTerm>(undefined);
  const fitRef = useRef<FitAddon>(undefined);
  const cb = useRef({ onSelection, onCopied });
  cb.current = { onSelection, onCopied };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const xterm = new XTerm({
      cursorBlink: true, cursorStyle: prefs.cursor, cursorInactiveStyle: prefs.cursor === "block" ? "outline" : prefs.cursor,
      fontFamily: css.getPropertyValue("--ah-mono").trim() || "monospace",
      fontSize: FONT_PX[prefs.font][phone() ? 1 : 0], lineHeight: 1.25, scrollback: 1000, theme: tokenTheme(el),
    });
    term.current = xterm;
    const fit = new FitAddon();
    fitRef.current = fit;
    xterm.loadAddon(fit);
    xterm.open(el);
    xterm.textarea?.setAttribute("aria-label", label);
    try { fit.fit(); } catch { /* hidden */ }
    xterm.write(SAMPLE);
    api?.({ write: (s) => xterm.write(s) });
    const selectionText = () => xterm.getSelection().replace(/[ \t]+$/gm, "");
    const report = () => {
      const text = selectionText();
      if (!text.trim()) { cb.current.onSelection?.(undefined); return; }
      const pos = xterm.getSelectionPosition();
      const screen = el.querySelector(".xterm-screen");
      const cellH = screen ? screen.clientHeight / xterm.rows : 16;
      const cellW = screen ? screen.clientWidth / xterm.cols : 8;
      cb.current.onSelection?.({ text, at: pos ? { top: (pos.start.y - xterm.buffer.active.viewportY) * cellH, left: pos.start.x * cellW } : undefined });
    };
    const sel = xterm.onSelectionChange(report);
    let pressed = false;
    const down = () => { pressed = true; };
    // Production copies inside the release, the person's gesture for the clipboard.
    const up = () => {
      if (!pressed) return;
      pressed = false;
      const text = xterm.hasSelection() ? selectionText() : "";
      if (!text.trim() || !prefs.copy) return;
      window.__copies.push(text);
      void navigator.clipboard?.writeText(text).catch(() => {});
      cb.current.onCopied?.(text);
    };
    el.addEventListener("mousedown", down, true);
    window.addEventListener("mouseup", up, true);
    const ro = new ResizeObserver(() => { try { fit.fit(); } catch { /* hidden */ } });
    ro.observe(el);
    const retheme = () => { xterm.options.theme = tokenTheme(el); };
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    void document.fonts?.ready.then(() => { if (term.current === xterm) { try { fit.fit(); } catch { /* hidden */ } } });
    return () => {
      sel.dispose(); ro.disconnect(); mo.disconnect();
      el.removeEventListener("mousedown", down, true);
      window.removeEventListener("mouseup", up, true);
      term.current = undefined;
      xterm.dispose();
    };
  }, []);
  useEffect(() => {
    const xterm = term.current;
    if (!xterm) return;
    xterm.options.fontSize = FONT_PX[p.font][phone() ? 1 : 0];
    xterm.options.cursorStyle = p.cursor;
    xterm.options.cursorInactiveStyle = p.cursor === "block" ? "outline" : p.cursor;
    try { fitRef.current?.fit(); } catch { /* hidden */ }
  }, [p.font, p.cursor]);
  return <div className="ah-terminal-surface ts-surface" data-testid={testid} data-font={p.font} data-cursor={p.cursor} ref={host} />;
}

// ---- The rows: the same content wherever they live ----
function Tag() {
  return <span className="ts-tag" data-testid="proposal-tag">{t().proposal}</span>;
}
function Row({ id, label, desc, proposal, children }: { id: string; label: string; desc: string; proposal?: boolean; children: ReactNode }) {
  return (
    <div className="s-row ts-row" data-settings-row={id} data-testid={`row-${id}`} tabIndex={-1}>
      <div className="s-lbl">
        <strong>{label}{proposal ? <Tag /> : null}</strong>
        <span className="s-desc">{desc}</span>
      </div>
      <div className="s-val">{children}</div>
    </div>
  );
}
function SettingRows({ compact = false }: { compact?: boolean }) {
  const p = usePrefs(), x = t();
  return (
    <div className={`s-card ts-card${compact ? " ts-compact" : ""}`} data-testid="terminal-rows">
      <Row id="terminal-copy-on-select" label={x.copy} desc={x.copyDesc.replace("{key}", terminalCopyKey)}>
        <Segmented size="row" data-testid="copy-choice" label={x.copy}
          options={[{ id: "off", label: lang === "fi" ? "Pois" : "Off" }, { id: "on", label: lang === "fi" ? "Päällä" : "On" }]}
          value={p.copy ? "on" : "off"} onChange={(v) => set({ copy: v === "on" })} />
      </Row>
      <Row id="terminal-font-size" label={x.font} desc={x.fontDesc} proposal>
        <Segmented size="row" data-testid="font-choice" label={x.font}
          options={(["small", "normal", "large"] as FontSize[]).map((id) => ({ id, label: x.fonts[id] }))}
          value={p.font} onChange={(font) => set({ font })} />
      </Row>
      <Row id="terminal-cursor" label={x.cursor} desc={x.cursorDesc} proposal>
        <Segmented size="row" data-testid="cursor-choice" label={x.cursor}
          options={(["block", "underline", "bar"] as Cursor[]).map((id) => ({ id, label: x.cursors[id], icon: <span className="ts-cur" data-shape={id} aria-hidden="true" /> }))}
          value={p.cursor} onChange={(cursor) => set({ cursor })} />
      </Row>
      <Row id="terminal-paste" label={x.paste} desc={x.pasteDesc} proposal>
        <Segmented size="row" data-testid="paste-choice" label={x.paste}
          options={(["ask", "direct"] as Paste[]).map((id) => ({ id, label: x.pastes[id] }))}
          value={p.paste} onChange={(paste) => set({ paste })} />
      </Row>
    </div>
  );
}
function Facts({ onAppearance }: { onAppearance?: () => void }) {
  const x = t();
  return (
    <section className="ts-facts" data-testid="terminal-facts" aria-labelledby="ts-how">
      <h3 className="s-h3" id="ts-how">{x.how}</h3>
      <dl className="s-card">
        {x.facts.map((f) => (
          <div className="s-row" key={f.k} data-testid={`fact-${f.k}`}>
            <dt>{f.label}</dt>
            <dd>
              {f.text.split(/(~\/\.tmux\.conf|history-limit|gh auth login)/).map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}
              {f.link && onAppearance ? <> <button type="button" className="ts-link" data-testid="to-appearance" onClick={onAppearance}>{f.link}</button></> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function Preview() {
  const x = t();
  const [copied, setCopied] = useState(false);
  const [sel, setSel] = useState<TerminalSelection>();
  useEffect(() => { if (!copied) return; const id = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(id); }, [copied]);
  return (
    <figure className="ts-preview" data-testid="preview">
      <figcaption><Icon name="terminal" /><strong>{x.preview}</strong><span className="s-desc">{x.previewNote}</span></figcaption>
      <div className="ts-preview-term ah-terminal-host">
        <ProtoSurface label={x.preview} testid="preview-surface" onSelection={setSel} onCopied={() => setCopied(true)} />
      </div>
      <p className="ts-preview-state" data-testid="preview-state" aria-live="polite">
        {copied ? <><Icon name="check" />{x.copied}</> : sel ? <><Icon name="copy" />{terminalCopyKey}</> : "\u00a0"}
      </p>
    </figure>
  );
}
function SettingsBody({ direction, onAppearance, onOpenTerminal }: { direction: number; onAppearance: () => void; onOpenTerminal: () => void }) {
  const x = t();
  if (direction === B)
    return (
      <section className="ts-wrap s-stack" data-testid="settings-pointer">
        <div className="s-card"><div className="s-row">
          <div className="s-lbl"><strong>{x.section}</strong><span className="s-desc">{x.pointer}</span></div>
          <div className="s-val"><ControlButton size="row" variant="secondary" data-testid="open-terminal" onPress={onOpenTerminal}><Icon name="terminal" />{x.pointerOpen}</ControlButton></div>
        </div></div>
      </section>
    );
  return (
    <section className="ts-wrap s-stack" data-testid="terminal-section" data-direction={direction}>
      <p className="s-intro">{x.intro}</p>
      {direction === C ? <Preview /> : null}
      <SettingRows />
      <Facts onAppearance={onAppearance} />
    </section>
  );
}

// ---- The workspace with its terminal panel ----
function useSlot(selector: string, className: string, before: string | null, active: boolean, key: unknown) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setEl(null);
    if (!active) return;
    const id = setInterval(() => {
      const parent = document.querySelector<HTMLElement>(selector);
      if (!parent) return;
      let slot = parent.querySelector<HTMLElement>(`:scope > .${className}`);
      if (!slot) {
        slot = document.createElement("div");
        slot.className = className;
        parent.insertBefore(slot, before ? parent.querySelector(before) : null);
      }
      setEl(slot);
      clearInterval(id);
    }, 10);
    return () => clearInterval(id);
  }, [active, key]);
  return el;
}
function GearPopover() {
  const x = t();
  const [open, setOpen] = useState(params.get("gear") !== "closed");
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className="ts-gear" data-testid="terminal-gear" aria-label={x.gear}><Icon name="gear" /></Button>
      <Popover className="ts-popover" placement="top end" offset={6} data-testid="gear-popover">
        <Dialog className="ts-dialog" aria-label={x.gear} data-testid="gear-dialog">
          {({ close }) => (
            <>
              <header className="ts-dialog-top">
                <Heading slot="title" level={2}><Icon name="gear" />{x.gear}</Heading>
                <IconButton size="row" variant="quiet" aria-label={x.close} onPress={close} data-testid="gear-close"><Icon name="cross" /></IconButton>
              </header>
              <SettingRows compact />
              <footer className="ts-dialog-foot">
                <ControlButton size="row" variant="primary" onPress={close} data-testid="gear-done">{x.done}</ControlButton>
              </footer>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
function WorkspaceView({ direction, toSettings }: { direction: number; toSettings: () => void }) {
  const x = t();
  const p = usePrefs();
  const [sel, setSel] = useState<TerminalSelection>();
  const [paste, setPaste] = useState<string[]>();
  const [feedback, setFeedback] = useState(false);
  const surface = useRef<SurfaceApi>(undefined);
  const tools = useSlot(".ah-terminal-tools", "ts-gear-slot", ".ah-terminal-maxbtn", direction !== A, direction);
  useEffect(() => { if (!feedback) return; const id = setTimeout(() => setFeedback(false), 2500); return () => clearTimeout(id); }, [feedback]);
  useEffect(() => {
    const onPaste = () => {
      const lines = ["git fetch", "git rebase origin/main", "go test ./internal/clock"];
      if (prefs.paste === "ask") setPaste(lines);
      else { window.__pastes.push(lines.join("\n")); surface.current?.write(`\r\n${lines.join("\r\n")}`); }
    };
    window.addEventListener("ts-paste", onPaste);
    return () => window.removeEventListener("ts-paste", onPaste);
  }, []);
  return (
    <div className="ts-workspace ah-conversation-frame" data-testid="workspace">
      <div className="ts-convo">
        <h1 className="ts-ws-title" data-testid="workspace-title"><code>{x.workspaceTitle}</code></h1>
        <UserMessage sourceText={x.convo[0]} onCopy={noop}><Markdown text={x.convo[0]} /></UserMessage>
        <AssistantMessage streamState="complete" onCopy={noop}><Markdown text={x.convo[1]} /></AssistantMessage>
      </div>
      <TerminalPanel workspaceLabel={x.workspaceTitle}
        tabs={[{ key: "s:1", name: "bash", busy: false }]} activeKey="s:1" height={phone() ? 330 : 340} maximized={false}
        selection={sel} paste={paste}
        feedback={feedback ? <p className="ts-feedback" data-testid="copied-feedback" role="status"><Icon name="check" />{x.copied}</p> : null}
        onSelectTab={noop} onCloseTab={noop} onNew={noop} onAttach={noop} onToggleMax={noop} onHide={noop} onResize={noop} onKey={noop}
        onClipboardPaste={noop}
        onPasteAnswer={(ok) => { if (ok && paste) { window.__pastes.push(paste.join("\n")); surface.current?.write(`\r\n${paste.join("\r\n")}`); } setPaste(undefined); }}
        onCopySelection={() => { if (sel) window.__copies.push(sel.text); setSel(undefined); }}
        onFocusTerminal={noop}>
        <ProtoSurface label="bash" testid="panel-surface" onSelection={setSel} onCopied={() => { setFeedback(true); setSel(undefined); }} api={(a) => { surface.current = a; }} />
      </TerminalPanel>
      {tools ? createPortal(
        direction === B ? <GearPopover /> : (
          <IconButton size="row" variant="quiet" data-testid="terminal-gear" aria-label={x.gear} title={x.gear} onPress={toSettings}><Icon name="gear" /></IconButton>
        ), tools) : null}
    </div>
  );
}

// ---- The page ----
function Rail({ view }: { view: View }) {
  const x = t();
  const status = useText(statusText);
  return (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel={status.connected} connectionTone="success"
      filterValue="" resultSummary="2" listState="ready" onToggle={noop} onFilter={noop} onRefresh={noop}
      sessionActions={<AccountShelf profile={{ name: x.person, email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/aurinkokello" selected={view === "workspace"} />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/kotisivu" />
    </WorkspaceRail>
  );
}
const pathToSection = (path: string) => {
  const seg = path.split("/")[2]?.split("#")[0];
  if (!seg) return null;
  const hit = Object.entries(settingsPaths as Record<string, string>).find(([, v]) => v === seg)?.[0];
  return hit ?? (seg === "undefined" ? "paate" : null);
};
function Page({ direction, view, setView }: { direction: number; view: View; setView: (v: View) => void }) {
  const x = t();
  const [section, setSection] = useState("paate");
  const slot = useSlot(".s-main", "ts-section", ":scope > .s-version-line", view === "settings" && section === "paate", `${section}-${direction}`);
  const main = view === "workspace" ? <WorkspaceView direction={direction} toSettings={() => { setSection("paate"); setView("settings"); }} /> : (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection={section} onNavigate={(path) => { const s = pathToSection(path); if (s) setSection(s); }}
          profile={{ name: x.person, email: "", avatar_url: "" }} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={noop} onLogout={noop} workspaces={[]} onClose={noop} />
      </div>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={view === "workspace" ? x.workspaceTitle : x.section} rail={<Rail view={view} />} main={main} />
      {slot ? createPortal(<SettingsBody direction={direction} onAppearance={() => setSection("ulkoasu")} onOpenTerminal={() => setView("workspace")} />, slot) : null}
    </StatusBellProvider>
  );
}

// ---- Synthetic host replies for production rows ----
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url, "http://prototype.test/").pathname;
  if (!path.startsWith("/api/")) return realFetch(input, init);
  if (path === "/api/v1/pi/models") return json({ schema_version: 1, catalog_status: "native_cached", models: [] });
  return new Response("", { status: 404 });
};

// ---- Review chrome ----
const DEFAULT_VIEW: View[] = ["settings", "workspace", "settings"];
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [view, setView] = useState<View>((params.get("view") as View) || DEFAULT_VIEW[direction]);
  const [generation, setGeneration] = useState(0);
  const bar = useRef<HTMLElement>(null);
  const x: Text = TEXT[language];
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    update();
    const o = new ResizeObserver(update);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const reset = () => { prefs = defaults(); setGeneration((n) => n + 1); };
  return (
    <div className={`ts-review variant-${direction}`} data-direction={direction} data-view={view}>
      <header className="ts-bar" ref={bar}>
        <div className="ts-controls">
          <strong>{x.title}</strong>
          <label>{x.view} <select id="view" value={view} onChange={(e) => setView(e.target.value as View)}>
            {(["settings", "workspace"] as View[]).map((v) => <option key={v} value={v}>{x.views[v]}</option>)}</select></label>
          <label>{x.theme} <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
            {(["light", "dark", "contrast"] as const).map((k) => <option key={k} value={k}>{x.themes[k]}</option>)}</select></label>
          <label>{x.language} <select id="language" value={language} onChange={(e) => {
            lang = e.target.value as Lang; setPersonalLanguage(lang); setLanguage(lang); setGeneration((n) => n + 1);
          }}><option value="fi">Suomi</option><option value="en">English</option></select></label>
          <button type="button" className="ts-event" data-testid="event-paste" disabled={view !== "workspace"} onClick={() => window.dispatchEvent(new Event("ts-paste"))}>{x.pasteEvent}</button>
          <button type="button" className="ts-event" data-testid="event-reset" onClick={reset}>{x.reset}</button>
        </div>
        <ol className="ts-lines" data-testid="direction-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>)}
        </ol>
        <p className="ts-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="ts-stage">
        <PiModelsProvider key={`${generation}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${language}-${view}`} initialEntries={[view === "settings" ? "/settings/paate" : "/workspaces/aurinkokello"]}>
            <Page direction={direction} view={view} setView={setView} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const reactRoot = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = { set innerHTML(view: ReactNode) { prefs = defaults(); window.__copies = []; window.__pastes = []; flushSync(() => reactRoot.render(view === "" ? null : view)); } };
const variants = NAMES.map((_, direction) => () => <App key={direction} direction={direction} />);
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
NAMES.forEach((n, i) => {
  const button = document.createElement("button");
  button.className = "proto-picker-item";
  button.textContent = n;
  if (i === 0) { button.setAttribute("data-active", ""); button.setAttribute("aria-current", "true"); }
  picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);
