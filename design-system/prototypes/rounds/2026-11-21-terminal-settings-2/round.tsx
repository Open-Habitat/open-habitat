import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
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
import { type Cursor, type Lang, type Paste, type Preset, TEXT, type Text, type View } from "./text";
import "./round.css";

// terminal-settings-page, round 2. Jari 21.11.2026 chose round 1's C
// (Settings › Terminal with a live preview, reached from a gear in the
// terminal panel) with two changes: the gear only opens the Settings page,
// with no settings in the panel itself, and text size needs a preview. So
// this round has one view, Settings › Terminal, and its axis is how text size
// is chosen and previewed. The rest of the section is round 1's content.
//   A  a slider; the live terminal right below resizes while dragging;
//   B  a − 12.5 px + stepper; the preview carries a column ruler and a line
//      at column 80, and a sentence says how many columns fit the panel;
//   C  four preset sizes as thumbnails, each with the columns that fit.
// The column count is for the terminal panel on this screen: the width of
// the main area less xterm's scrollbar, divided by the cell width a
// hidden xterm gets at that size. check.mjs compares it with the panel's
// own fitted columns.
// The surface is xterm.js on the design tokens like production's
// TerminalSurface, which has no font-size or cursor option yet. No host
// runs: the output is written once, and copies land in window.__copies.

const NAMES = ["A Liukusäädin", "B Askelin", "C Valmiit koot"];
const A = 0, B = 1, C = 2;
const params = new URLSearchParams(location.search);
const noop = () => {};
let lang: Lang = params.get("lang") === "en" ? "en" : "fi";
setPersonalLanguage(lang);
const t = () => TEXT[lang];
const phone = () => matchMedia("(max-width: 760px)").matches;

// ---- Sizes ----
const MIN = 10, MAX = 18, STEP = 0.5;
const defaultPx = () => (phone() ? 12 : 12.5);
const PRESET_IDS: Preset[] = ["small", "normal", "large", "largest"];
const presetPx = (id: Preset) => (phone() ? { small: 10.5, normal: 12, large: 13, largest: 15 } : { small: 11, normal: 12.5, large: 14, largest: 16 })[id];
const clamp = (px: number) => Math.min(MAX, Math.max(MIN, Math.round(px / STEP) * STEP));
const fmtPx = (px: number) => t().sizeLabel.replace("{px}", px.toLocaleString(lang === "fi" ? "fi-FI" : "en-GB"));
const fill = (s: string, c: number) => s.replace("{c}", String(c));

// Cell width exactly as xterm lays it out: a hidden xterm at that size, so
// font hinting and xterm's own device-pixel rounding are both included.
const widths = new Map<string, number>();
function cellWidth(px: number) {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--ah-mono").trim() || "monospace";
  const key = `${px}|${family}|${devicePixelRatio}`;
  const hit = widths.get(key);
  if (hit) return hit;
  const box = document.createElement("div");
  box.style.cssText = "position:absolute;left:-10000px;top:0;width:800px;height:60px;visibility:hidden";
  document.body.append(box);
  const probe = new XTerm({ fontFamily: family, fontSize: px, lineHeight: 1.25, cols: 40, rows: 2 });
  probe.open(box);
  const screen = box.querySelector<HTMLElement>(".xterm-screen");
  const w = screen && screen.clientWidth ? screen.getBoundingClientRect().width / 40 : 0;
  probe.dispose();
  box.remove();
  if (w > 0) widths.set(key, w);
  return w || px * 0.6;
}
// FitAddon reads the surface's border-box width and takes off its 14 px
// scrollbar; production's padding is not subtracted, so that is matched.
const PANEL_INSET = 14;
function panelWidth() {
  const main = document.getElementById("main");
  return (main?.clientWidth ?? innerWidth) - PANEL_INSET;
}
const panelCols = (px: number) => Math.max(1, Math.floor(panelWidth() / cellWidth(px)));
function usePanelCols() {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => { widths.clear(); tick((n) => n + 1); };
    addEventListener("resize", f);
    void document.fonts?.ready.then(f);
    const main = document.getElementById("main");
    const ro = main ? new ResizeObserver(f) : undefined;
    if (main) ro?.observe(main);
    return () => { removeEventListener("resize", f); ro?.disconnect(); };
  }, []);
  return panelCols;
}

// ---- The section in production's own settings index ----
for (const l of ["fi", "en"] as const) {
  const list = shownSettingsSections(l) as ShownSection[];
  const x = TEXT[l];
  const at = list.findIndex((s) => s.id === "editori") + 1;
  list.splice(at, 0, {
    id: "paate" as ShownSection["id"], label: x.section, icon: "terminal", kw: x.sectionKw,
    rows: [
      { id: "terminal-copy-on-select", label: x.copy, kw: ["kopioi", "copy", "leikepöytä", "clipboard", "valinta", "selection"], desc: x.copyDesc.replace("{key}", terminalCopyKey) },
      { id: "terminal-font-size", label: x.font, kw: ["fontti", "font", "koko", "size", "zoom", "sarakkeet", "columns"], desc: x.fontDesc },
      { id: "terminal-cursor", label: x.cursor, kw: ["kursori", "cursor", "kohdistin"], desc: x.cursorDesc },
      { id: "terminal-paste", label: x.paste, kw: ["liitä", "paste", "rivit", "lines"], desc: x.pasteDesc },
    ],
  } as unknown as ShownSection);
  const ex = list.find((s) => s.id === "kokeelliset");
  if (ex) (ex as { rows: { id: string }[] }).rows = ex.rows.filter((r) => r.id !== "terminal-copy-on-select" && r.id !== "terminal-open-urls");
}

// ---- Settings state ----
type Prefs = { copy: boolean; font: number; cursor: Cursor; paste: Paste };
const defaults = (): Prefs => ({ copy: false, font: defaultPx(), cursor: "block", paste: "ask" });
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
declare global { interface Window { __copies: string[]; __prefs: () => Prefs; __pastes: string[]; __panelCols: (px: number) => number } }
window.__copies = []; window.__pastes = [];
window.__prefs = () => prefs;
window.__panelCols = (px) => panelCols(px);

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
// A realistic snippet with one long line, so a larger size visibly wraps it.
const prompt = "\x1b[1;32maino@habitat\x1b[0m:\x1b[1;34m~/src/aurinkokello\x1b[0m$ ";
const SAMPLE_LINES = [
  `${prompt}go test ./...`,
  "\x1b[31m--- FAIL\x1b[0m: TestAlarmSummer (0.00s)",
  "    alarm_test.go:42: got 07:00 EET, want 07:00 EEST (zone Europe/Helsinki, date 2026-03-29, rule last-sunday)",
  "\x1b[31mFAIL\x1b[0m\texample.invalid/aurinkokello/internal/clock\t\x1b[2m0.412s\x1b[0m",
  "\x1b[32mok\x1b[0m  \texample.invalid/aurinkokello/internal/web\t\x1b[2m1.207s\x1b[0m",
  `${prompt}git log --oneline -2`,
  "\x1b[33m1a19356\x1b[0m (HEAD -> main) clock: read the zone from the system",
  "\x1b[33mf46502d\x1b[0m clock: summer time for the alarm",
  prompt,
];
const SAMPLE = SAMPLE_LINES.join("\r\n");
// Plain text of the first lines for C's thumbnails.
const THUMB = ["aino@habitat:~/src/aurinkokello$ go test ./...", "--- FAIL: TestAlarmSummer (0.00s)", "    alarm_test.go:42: got 07:00 EET, want 07:00 EEST"];

type Metrics = { cols: number; rows: number; cellW: number; left: number };
type SurfaceApi = { write: (s: string) => void };
function ProtoSurface({ label, testid, top, onSelection, onCopied, onMetrics, api }: {
  label: string; testid: string; top?: boolean;
  onSelection?: (s: TerminalSelection | undefined) => void;
  onCopied?: (text: string) => void;
  onMetrics?: (m: Metrics) => void;
  api?: (a: SurfaceApi) => void;
}) {
  const p = usePrefs();
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<XTerm>(undefined);
  const fitRef = useRef<FitAddon>(undefined);
  // The preview keeps its first line in view, so a larger size shows the
  // command and its wrapped line rather than the bottom of the sample.
  const pinTop = useRef(top);
  const cb = useRef({ onSelection, onCopied, onMetrics });
  cb.current = { onSelection, onCopied, onMetrics };
  const [cols, setCols] = useState(0);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const css = getComputedStyle(el);
    const xterm = new XTerm({
      cursorBlink: true, cursorStyle: prefs.cursor, cursorInactiveStyle: prefs.cursor === "block" ? "outline" : prefs.cursor,
      fontFamily: css.getPropertyValue("--ah-mono").trim() || "monospace",
      fontSize: prefs.font, lineHeight: 1.25, scrollback: 1000, theme: tokenTheme(el),
    });
    term.current = xterm;
    const fit = new FitAddon();
    fitRef.current = fit;
    xterm.loadAddon(fit);
    xterm.open(el);
    xterm.textarea?.setAttribute("aria-label", label);
    const measure = () => {
      try { fit.fit(); } catch { /* hidden */ }
      if (pinTop.current) xterm.scrollToTop();
      const screen = el.querySelector<HTMLElement>(".xterm-screen");
      if (!screen || !xterm.cols) return;
      setCols(xterm.cols);
      cb.current.onMetrics?.({ cols: xterm.cols, rows: xterm.rows, cellW: screen.clientWidth / xterm.cols, left: screen.offsetLeft + parseFloat(getComputedStyle(el).paddingLeft || "0") });
    };
    measure();
    xterm.write(SAMPLE, () => { if (pinTop.current) xterm.scrollToTop(); });
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
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const retheme = () => { xterm.options.theme = tokenTheme(el); };
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    void document.fonts?.ready.then(() => { if (term.current === xterm) measure(); });
    (el as HTMLDivElement & { __measure?: () => void }).__measure = measure;
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
    xterm.options.fontSize = p.font;
    xterm.options.cursorStyle = p.cursor;
    xterm.options.cursorInactiveStyle = p.cursor === "block" ? "outline" : p.cursor;
    (host.current as (HTMLDivElement & { __measure?: () => void }) | null)?.__measure?.();
  }, [p.font, p.cursor]);
  return <div className="ah-terminal-surface ts-surface" data-testid={testid} data-font={p.font} data-cols={cols} data-cursor={p.cursor} ref={host} />;
}

// ---- Rows ----
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

// ---- The axis: text size with its live preview ----
function Preview({ variant, metrics, setMetrics, chip, children }: {
  variant: number; metrics?: Metrics; setMetrics: (m: Metrics) => void; chip?: ReactNode; children?: ReactNode;
}) {
  const x = t();
  const [copied, setCopied] = useState(false);
  const [sel, setSel] = useState<TerminalSelection>();
  useEffect(() => { if (!copied) return; const id = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(id); }, [copied]);
  const ruler = variant === B && metrics;
  return (
    <figure className="ts-preview" data-testid="preview" data-variant={variant}>
      <figcaption>
        <Icon name="terminal" /><strong>{x.preview}</strong><span className="s-desc">{x.previewNote}</span>
        {chip}
      </figcaption>
      <div className={`ts-preview-term ah-terminal-host${ruler ? " ts-has-ruler" : ""}`}>
        {ruler ? <Ruler m={metrics} /> : null}
        <ProtoSurface label={x.preview} testid="preview-surface" top onSelection={setSel} onCopied={() => setCopied(true)} onMetrics={setMetrics} />
        {ruler && metrics.cols > 80 ? <span className="ts-mark80" data-testid="mark-80" style={{ left: metrics.left + 80 * metrics.cellW }} aria-hidden="true"><span>{x.mark80}</span></span> : null}
      </div>
      {children}
      <p className="ts-preview-state" data-testid="preview-state" aria-live="polite">
        {copied ? <><Icon name="check" />{x.copied}</> : sel ? <><Icon name="copy" />{terminalCopyKey}</> : "\u00a0"}
      </p>
    </figure>
  );
}
// B: a column ruler over the preview, aligned with xterm's own cells.
function Ruler({ m }: { m: Metrics }) {
  const ticks: number[] = [];
  for (let c = 10; c <= m.cols; c += 10) ticks.push(c);
  return (
    <div className="ts-ruler" data-testid="ruler" aria-hidden="true">
      {ticks.map((c) => <span key={c} className={c === 80 ? "ts-tick ts-tick-80" : "ts-tick"} style={{ left: m.left + c * m.cellW }}>{c}</span>)}
    </div>
  );
}
function Slider() {
  const p = usePrefs(), x = t(), cols = usePanelCols();
  const [m, setM] = useState<Metrics>();
  return (
    <div className="ts-size ts-size-a" data-testid="size-block">
      <div className="ts-size-head">
        <div className="s-lbl"><strong>{x.font}<Tag /></strong><span className="s-desc">{x.fontDesc}</span></div>
        <output className="ts-size-value" data-testid="size-value" htmlFor="ts-slider">{fmtPx(p.font)}</output>
      </div>
      <div className="ts-slider-row">
        <span className="ts-aa ts-aa-small" aria-hidden="true">Aa</span>
        <input id="ts-slider" type="range" className="ts-slider" data-testid="size-slider" min={MIN} max={MAX} step={STEP} value={p.font}
          aria-label={x.font} aria-valuetext={fmtPx(p.font)} onChange={(e) => set({ font: clamp(Number(e.target.value)) })} />
        <span className="ts-aa ts-aa-large" aria-hidden="true">Aa</span>
      </div>
      <Preview variant={A} metrics={m} setMetrics={setM}
        chip={<span className="ts-chip" data-testid="cols-readout" data-cols={cols(p.font)}>{fill(x.fitsShort, cols(p.font))}</span>} />
    </div>
  );
}
function Stepper() {
  const p = usePrefs(), x = t(), cols = usePanelCols();
  const [m, setM] = useState<Metrics>();
  const c = cols(p.font);
  return (
    <div className="ts-size ts-size-b" data-testid="size-block">
      <div className="ts-size-head">
        <div className="s-lbl"><strong>{x.font}<Tag /></strong><span className="s-desc">{x.fontDesc}</span></div>
        <div className="ts-stepper" role="group" aria-label={x.font} data-testid="size-stepper">
          <IconButton size="row" variant="secondary" aria-label={x.smaller} data-testid="size-down" isDisabled={p.font <= MIN} onPress={() => set({ font: clamp(p.font - STEP) })}><span className="ts-glyph" aria-hidden="true">−</span></IconButton>
          <output className="ts-size-value" data-testid="size-value" aria-live="polite">{fmtPx(p.font)}</output>
          <IconButton size="row" variant="secondary" aria-label={x.larger} data-testid="size-up" isDisabled={p.font >= MAX} onPress={() => set({ font: clamp(p.font + STEP) })}><Icon name="plus" /></IconButton>
          <ControlButton size="row" variant="quiet" data-testid="size-reset" isDisabled={p.font === defaultPx()} onPress={() => set({ font: defaultPx() })}>{x.resetSize}</ControlButton>
        </div>
      </div>
      <Preview variant={B} metrics={m} setMetrics={setM}>
        <p className={`ts-fit${c < 80 ? " ts-fit-narrow" : ""}`} data-testid="cols-readout" data-cols={c}>
          <Icon name={c < 80 ? "wrap" : "check"} />
          <span>{fill(x.fitsCols, c)} {c < 80 ? x.narrow80 : x.wide80}</span>
        </p>
      </Preview>
    </div>
  );
}
function Presets() {
  const p = usePrefs(), x = t(), cols = usePanelCols();
  const [m, setM] = useState<Metrics>();
  return (
    <div className="ts-size ts-size-c" data-testid="size-block">
      <div className="ts-size-head">
        <div className="s-lbl"><strong>{x.font}<Tag /></strong><span className="s-desc">{x.fontDesc}</span></div>
      </div>
      <div className="ts-presets" role="radiogroup" aria-label={x.font} data-testid="size-presets">
        {PRESET_IDS.map((id) => {
          const px = presetPx(id), on = p.font === px, c = cols(px);
          return (
            <button key={id} type="button" role="radio" aria-checked={on} className="ts-preset" data-testid={`preset-${id}`} data-cols={c} onClick={() => set({ font: px })}>
              <span className="ts-thumb" aria-hidden="true"><pre style={{ fontSize: `${px}px` }}>{THUMB.join("\n")}</pre></span>
              <span className="ts-preset-name">{x.presets[id]} <span className="ts-preset-px">{fmtPx(px)}</span></span>
              <span className={`ts-preset-cols${c < 80 ? " ts-fit-narrow" : ""}`}>{fill(x.fitsShort, c)}</span>
            </button>
          );
        })}
      </div>
      <Preview variant={C} metrics={m} setMetrics={setM} />
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
function SettingsBody({ variant, fromTerminal, onBack, onAppearance }: { variant: number; fromTerminal: boolean; onBack: () => void; onAppearance: () => void }) {
  const p = usePrefs(), x = t();
  return (
    <section className="ts-wrap s-stack" data-testid="terminal-section" data-variant={variant}>
      {fromTerminal ? (
        <div><ControlButton size="row" variant="secondary" data-testid="back-to-terminal" onPress={onBack}><Icon name="back" />{x.back}</ControlButton></div>
      ) : null}
      <p className="s-intro">{x.intro}</p>
      <div className="s-card ts-card" data-testid="terminal-rows">
        <Row id="terminal-copy-on-select" label={x.copy} desc={x.copyDesc.replace("{key}", terminalCopyKey)}>
          <Segmented size="row" data-testid="copy-choice" label={x.copy}
            options={[{ id: "off", label: lang === "fi" ? "Pois" : "Off" }, { id: "on", label: lang === "fi" ? "Päällä" : "On" }]}
            value={p.copy ? "on" : "off"} onChange={(v) => set({ copy: v === "on" })} />
        </Row>
        <div className="s-row ts-row ts-size-row" data-settings-row="terminal-font-size" data-testid="row-terminal-font-size" tabIndex={-1}>
          {variant === A ? <Slider /> : variant === B ? <Stepper /> : <Presets />}
        </div>
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
function WorkspaceView({ toSettings }: { toSettings: () => void }) {
  const x = t();
  const [sel, setSel] = useState<TerminalSelection>();
  const [paste, setPaste] = useState<string[]>();
  const [feedback, setFeedback] = useState(false);
  const surface = useRef<SurfaceApi>(undefined);
  const tools = useSlot(".ah-terminal-tools", "ts-gear-slot", ".ah-terminal-maxbtn", true, 0);
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
        <IconButton size="row" variant="quiet" data-testid="terminal-gear" aria-label={x.gear} title={x.gear} onPress={toSettings}><Icon name="gear" /></IconButton>,
        tools) : null}
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
function Page({ variant, view, setView }: { variant: number; view: View; setView: (v: View) => void }) {
  const x = t();
  const [section, setSection] = useState("paate");
  const [fromTerminal, setFromTerminal] = useState(false);
  const slot = useSlot(".s-main", "ts-section", ":scope > .s-version-line", view === "settings" && section === "paate", `${section}-${variant}`);
  const back = () => { setFromTerminal(false); setView("workspace"); };
  const main = view === "workspace" ? <WorkspaceView toSettings={() => { setSection("paate"); setFromTerminal(true); setView("settings"); }} /> : (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <AccountSettings routeSection={section} onNavigate={(path) => { const s = pathToSection(path); if (s) setSection(s); }}
          profile={{ name: x.person, email: "", avatar_url: "" }} csrf="prototype"
          nativeState="connected" nativeLogin="aino-esimerkki" onReconnect={noop} onLogout={noop} workspaces={[]}
          onClose={fromTerminal ? back : noop} />
      </div>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={view === "workspace" ? x.workspaceTitle : x.section} rail={<Rail view={view} />} main={main} />
      {slot ? createPortal(<SettingsBody variant={variant} fromTerminal={fromTerminal} onBack={back} onAppearance={() => setSection("ulkoasu")} />, slot) : null}
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
let reviewTheme = (params.get("theme") as "light" | "dark" | "contrast") || "light";
function App({ variant }: { variant: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [language, setLanguage] = useState(lang);
  const [view, setView] = useState<View>((params.get("view") as View) || "settings");
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
    <div className={`ts-review variant-${variant}`} data-variant={variant} data-view={view}>
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
        <ol className="ts-lines" data-testid="variant-lines">
          {x.lines.map((l, i) => <li key={i} aria-current={i === variant ? "true" : undefined}>{l}</li>)}
        </ol>
        <p className="ts-recommend" data-testid="recommendation">{x.recommend}</p>
      </header>
      <div className="ts-stage">
        <PiModelsProvider key={`${generation}-${language}`} enabled={false}>
          <MemoryRouter key={`${generation}-${language}`} initialEntries={["/settings/paate"]}>
            <Page variant={variant} view={view} setView={setView} />
          </MemoryRouter>
        </PiModelsProvider>
      </div>
    </div>
  );
}

const reactRoot = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = { set innerHTML(view: ReactNode) { prefs = defaults(); window.__copies = []; window.__pastes = []; flushSync(() => reactRoot.render(view === "" ? null : view)); } };
const variants = NAMES.map((_, variant) => () => <App key={variant} variant={variant} />);
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
