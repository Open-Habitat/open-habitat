import React, { type ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/Settings.css";
import "../../../../web/src/app/SoundSettings.css";
import { playSound, usePlaying, usePlayingAt } from "../../../../web/src/app/attentionSound";
import { shownSettingsSections } from "../../../../web/src/app/settingsIndex";
import { type SoundId, soundIds } from "../../../../web/src/app/soundSynth";
import { ChoiceMenu } from "../../../../web/src/components/ChoiceMenu";
import { ControlButton, IconButton, Segmented } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { AppShell, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { ScaleSlider } from "../../../../web/src/components/ScaleSlider";
import { SoundEmblem } from "../../../../web/src/components/SoundEmblem";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { setPersonalLanguage, useText } from "../../../../web/src/i18n";
import { attentionSoundText } from "../../../../web/src/text/attentionSound";
import { DIRECTIONS, type Device, type Lang, SCENARIOS, type Scenario, TEXT, type Text } from "./text";
import "./round.css";
// attention-sound-night-visible, round 2 (22.11.2026). Jari chose round 1's
// C: a status line at the top of Settings › Äänet, night as a clock window
// (default 22–7), and no one-night override; the line's action changes the
// setting itself. Production still tells the other two silences, "Tämä
// laite on mykistetty" and "Äänet ovat pois kaikilta laitteilta", as notes
// at the very bottom of the device card. One axis: which silences the top
// line tells, and how many at once.
//   A Vahvin syy: one line, always the strongest reason (off everywhere ›
//     this device muted › night) with its one fix; fixing it reveals the
//     next reason.
//   B Kaikki syyt: one line headed "Äänet ovat hiljaa tällä laitteella"
//     that lists every active reason, each with its own fix.
//   C Vain yö: the line tells only the clock's night; the permanent choices
//     stay as the page's controls and production's bottom notes.
// Every fix is a real setting change (Äänet on, unmute, Hiljennä yöllä
// off). The page is production's Settings frame and controls, emblems and
// real sounds; the page body is a copy of SoundSettings.tsx with the
// direction's changes, on local state. Synthetic content.

const params = new URLSearchParams(location.search);
const bare = params.get("bare") === "1";
const noop = () => {};
const A = 0, B = 1, C = 2;

// ---------- The state the page shows ----------

type Prefs = {
  enabled: boolean;
  night: boolean;
  def: SoundId;
  length: "short" | "long";
  inView: "quiet" | "play";
  start: number;
  end: number;
  muted: boolean;
  volume: number;
};
const firstPrefs = (s: Scenario): Prefs => ({
  enabled: s !== "off" && s !== "all",
  night: true,
  def: "kalimba",
  length: "short",
  inView: "quiet",
  start: 22,
  end: 7,
  muted: s === "muted" || s === "nightMuted" || s === "all",
  volume: 70,
});
type Ctx = {
  d: number;
  lang: Lang;
  scenario: Scenario;
  prefs: Prefs;
  set: (p: Partial<Prefs>) => void;
  toast: (s: string) => void;
};
const RoundContext = React.createContext<Ctx>({
  d: 0,
  lang: "fi",
  scenario: "nightMuted",
  prefs: firstPrefs("nightMuted"),
  set: noop,
  toast: noop,
});
const useRound = () => useContext(RoundContext);
const useT = (): Text => TEXT[useRound().lang];

const atNight = (s: Scenario) => s === "night" || s === "nightMuted" || s === "all";
const clockOf = (s: Scenario): [number, number] => (atNight(s) ? [23, 40] : [14, 10]);
const fmt = (lang: Lang, h: number, m = 0) =>
  lang === "fi" ? `${h}.${String(m).padStart(2, "0")}` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const inWindow = (h: number, m: number, start: number, end: number) => {
  const t = h * 60 + m;
  const s = start * 60, e = end * 60;
  return s <= e ? t >= s && t < e : t >= s || t < e;
};
/** Night by the clock window (round 1's C, chosen). */
function useNight() {
  const { scenario, prefs, lang } = useRound();
  const [h, m] = clockOf(scenario);
  const night = inWindow(h, m, prefs.start, prefs.end);
  return {
    night,
    /** Night quiet is what silences, whatever else is on. */
    active: prefs.night && night,
    now: fmt(lang, h, m),
    start: fmt(lang, prefs.start),
    end: fmt(lang, prefs.end),
  };
}

type ReasonId = "off" | "muted" | "night";
/** The active silences, strongest first: off reaches every device and
 * outlasts the rest, a mute is this device's lasting choice, night ends by
 * itself in the morning. */
function useReasons(): ReasonId[] {
  const { prefs } = useRound();
  const n = useNight();
  const r: ReasonId[] = [];
  if (!prefs.enabled) r.push("off");
  if (prefs.muted) r.push("muted");
  if (n.active) r.push("night");
  return r;
}

/** Each reason's one fix: the real setting, not an override. */
function useFix() {
  const { set, toast } = useRound();
  const t = useT();
  return (r: ReasonId) => {
    if (r === "off") set({ enabled: true });
    if (r === "muted") set({ muted: false });
    if (r === "night") set({ night: false });
    toast(r === "off" ? t.toastOff : r === "muted" ? t.toastMuted : t.toastNight);
  };
}
const fixLabel = (t: Text, r: ReasonId) => (r === "off" ? t.offFix : r === "muted" ? t.mutedFix : t.nightFix);
const ReasonIcon = ({ r }: { r: ReasonId }) => (r === "night" ? <Icon name="moon" /> : <Speaker muted />);
const toNight = () => {
  const row = document.querySelector<HTMLElement>('[data-testid="night-clock"]') ?? document.querySelector<HTMLElement>('[data-settings-row="attention-sound-night"]');
  row?.scrollIntoView({ block: "center", behavior: "smooth" });
  row?.focus({ preventScroll: true });
};

// ---------- Pieces copied from SoundSettings.tsx ----------

function Tile({ id, chosen, disabled, onChoose }: { id: SoundId; chosen: boolean; disabled: boolean; onChoose: (id: SoundId) => void }) {
  const t = useText(attentionSoundText);
  const play = usePlaying(id, "settings-tile");
  const playing = usePlayingAt("settings-tile") === id;
  const [name, desc] = t.sounds[id];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      tabIndex={chosen ? 0 : -1}
      disabled={disabled}
      aria-label={t.tileLabel(name, desc)}
      data-testid={`sound-tile-${id}`}
      data-playing={playing || undefined}
      className="ss-tile"
      onClick={() => onChoose(id)}
    >
      <SoundEmblem id={id} play={play} />
      <span className="ss-tile-name">{name}</span>
      <span className="ss-tile-state">
        {playing ? (
          <>
            <Icon name="music" />
            {t.playing}
          </>
        ) : chosen ? (
          <>
            <Icon name="check" />
            {t.selected}
          </>
        ) : null}
      </span>
    </button>
  );
}

const WORKSPACES = [
  { id: "ws_a", name: "aurinkokello" },
  { id: "ws_k", name: "kotisivu" },
];

// ---------- The direction's status line ----------

function FixButton({ r }: { r: ReasonId }) {
  const t = useT();
  const fix = useFix();
  return (
    <ControlButton size="row" variant="secondary" data-testid={`fix-${r}`} onPress={() => fix(r)}>
      {fixLabel(t, r)}
    </ControlButton>
  );
}
function EditHours() {
  const t = useT();
  return (
    <ControlButton size="row" variant="quiet" data-testid="night-edit" onPress={toNight}>
      {t.nightEdit}
      <Icon name="down" />
    </ControlButton>
  );
}

/** The first thing under the page heading. A: the strongest reason. B: all
 * reasons. C: night only. */
function StatusLine() {
  const { d, prefs } = useRound();
  const t = useT();
  const n = useNight();
  const reasons = useReasons();
  const title = (r: ReasonId) => (r === "off" ? t.offTitle : r === "muted" ? t.mutedTitle : t.nightTitle(n.end));
  const why = (r: ReasonId) => (r === "off" ? t.offWhy : r === "muted" ? t.mutedWhy : t.nightWhy(n.start, n.end));
  if (d === B) {
    if (!reasons.length) return null;
    const short = (r: ReasonId) => (r === "off" ? t.offShort : r === "muted" ? t.mutedShort : t.nightShort(n.start, n.end));
    return (
      <div className="nq-status" data-state="list" role="status" data-testid="status-line" data-reasons={reasons.join(" ")}>
        <ReasonIcon r={reasons[0]} />
        <div className="nq-status-text">
          <strong data-testid="status-title">{t.quietHere}</strong>
          <span>{t.quietReasons(reasons.length)}</span>
        </div>
        <ul className="nq-reasons">
          {reasons.map((r) => (
            <li key={r} data-testid={`reason-${r}`}>
              <ReasonIcon r={r} />
              <span className="nq-reason-text">
                {short(r)}
                {r !== "off" && !prefs.enabled ? <em>{t.offRedundant}</em> : null}
              </span>
              <span className="nq-reason-act">
                <FixButton r={r} />
                {r === "night" ? <EditHours /> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const shown = d === A ? reasons[0] : prefs.enabled && n.active ? "night" : undefined;
  if (!shown) return null;
  return (
    <div className="nq-status" data-state={shown} role="status" data-testid="status-line" data-reasons={shown}>
      <ReasonIcon r={shown} />
      <div className="nq-status-text">
        <strong data-testid="status-title">{title(shown)}</strong>
        <span>{why(shown)}</span>
      </div>
      <div className="nq-status-actions">
        <FixButton r={shown} />
        {shown === "night" ? <EditHours /> : null}
      </div>
    </div>
  );
}

/** Production's master row. */
function MasterCard() {
  const { prefs, set } = useRound();
  const p = useText(attentionSoundText);
  return (
    <div className="s-card" data-testid="master-card">
      <div className="s-row" data-settings-row="attention-sound-on" tabIndex={-1}>
        <div className="s-lbl">
          <strong>{p.on}</strong>
          <span className="s-desc">{p.onDesc}</span>
        </div>
        <div className="s-val">
          <Segmented
            size="row"
            data-testid="sound-enabled"
            label={p.on}
            options={[
              { id: "off", label: p.off },
              { id: "on", label: p.onLabel },
            ]}
            value={prefs.enabled ? "on" : "off"}
            onChange={(v) => set({ enabled: v === "on" })}
          />
        </div>
      </div>
    </div>
  );
}

/** Hiljennä yöllä as round 1's C: on/off and the clock window. */
function NightRow() {
  const { prefs, set, lang } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const off = !prefs.enabled;
  // A label of digits alone has no letters, and production's ControlButton
  // then draws the menu as an icon square; "klo" keeps it a word button.
  const hours = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => (from + i) % 24).map((h) => ({ id: String(h), label: `${lang === "fi" ? "klo" : "at"} ${fmt(lang, h)}` }));
  return (
    <>
      <div className="s-row" data-settings-row="attention-sound-night" tabIndex={-1}>
        <div className="s-lbl">
          <strong>{p.night}</strong>
          <span className="s-desc">{t.nightClockDesc}</span>
        </div>
        <div className="s-val">
          <Segmented
            size="row"
            data-testid="sound-night"
            label={p.night}
            isDisabled={off}
            options={[
              { id: "off", label: p.off },
              { id: "on", label: p.onLabel },
            ]}
            value={prefs.night ? "on" : "off"}
            onChange={(v) => set({ night: v === "on" })}
          />
        </div>
      </div>
      {prefs.night && !off ? (
        <div className="s-row nq-clock" data-testid="night-clock" tabIndex={-1}>
          <div className="nq-clock-fields">
            <span className="nq-clock-field">
              <span>{t.from}</span>
              <span className="ss-choice"><ChoiceMenu
                data-testid="night-start"
                label={t.from}
                value={String(prefs.start)}
                options={hours(18, 9)}
                onChange={(v) => set({ start: Number(v) })}
              /></span>
            </span>
            <span className="nq-clock-dash" aria-hidden="true">
              –
            </span>
            <span className="nq-clock-field">
              <span>{t.to}</span>
              <span className="ss-choice"><ChoiceMenu
                data-testid="night-end"
                label={t.to}
                value={String(prefs.end)}
                options={hours(4, 8)}
                onChange={(v) => set({ end: Number(v) })}
              /></span>
            </span>
          </div>
        </div>
      ) : null}
      {prefs.night && !off ? (
        <p className="ss-now" data-testid="sound-night-now" data-night={n.night || undefined}>
          <Icon name={n.night ? "moon" : "sun"} />
          {t.clockNow(n.now, n.start, n.end, n.night)}
        </p>
      ) : null}
    </>
  );
}

// ---------- The page body: SoundSettings.tsx with the direction's changes ----------

function SoundsPage() {
  const { d, prefs, set } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const off = !prefs.enabled;
  // Production's bottom notes: C keeps them for the permanent choices; A and
  // B tell every silence on the top line instead.
  const note = d !== C ? undefined : off ? "off" : prefs.muted ? "muted" : undefined;
  const listen = (id: SoundId, where: string, length = prefs.length) => playSound(id, length, where, prefs.muted ? 0 : prefs.volume);
  const choose = (id: SoundId) => {
    listen(id, "settings-tile");
    set({ def: id });
  };
  return (
    <div className="s-stack ss-body" data-testid="sound-settings">
      <StatusLine />
      <p className="s-intro">{p.intro}</p>
      <MasterCard />
      <h3 className="s-h3">{p.sound}</h3>
      <p className="s-desc ss-lead">{p.soundDesc}</p>
      {n.active && !off && !prefs.muted ? (
        <p className="nq-bypass" data-testid="preview-bypass">
          <Icon name="run" />
          {t.previewBypass}
        </p>
      ) : null}
      <div role="radiogroup" aria-label={p.sound} className="ss-tiles" data-testid="sound-tiles">
        {soundIds.map((id) => (
          <Tile key={id} id={id} chosen={prefs.def === id} disabled={off} onChoose={choose} />
        ))}
      </div>
      <div className="s-card">
        <div className="s-row">
          <div className="s-lbl">
            <strong>{p.length}</strong>
            <span className="s-desc">{p.lengthDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              label={p.length}
              isDisabled={off}
              options={[
                { id: "short", label: p.short },
                { id: "long", label: p.long },
              ]}
              value={prefs.length}
              onChange={(v) => {
                listen(prefs.def, "settings-tile", v);
                set({ length: v });
              }}
            />
          </div>
        </div>
      </div>
      <h3 className="s-h3">{p.when}</h3>
      <div className="s-card">
        <div className="s-row">
          <div className="s-lbl">
            <strong>{p.inView}</strong>
            <span className="s-desc">{p.inViewDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              label={p.inView}
              isDisabled={off}
              options={[
                { id: "quiet", label: p.inViewQuiet },
                { id: "play", label: p.inViewPlays },
              ]}
              value={prefs.inView}
              onChange={(v) => set({ inView: v })}
            />
          </div>
        </div>
        <NightRow />
      </div>
      <h3 className="s-h3">{p.workspaces}</h3>
      <div className="s-card">
        <p className="s-desc ss-pad">{p.workspacesDesc}</p>
        {WORKSPACES.map((w) => (
          <div className="s-row ss-workspace" key={w.id}>
            <div className="s-lbl ss-workspace-lbl">
              <SoundEmblem id={prefs.def} size="small" />
              <code className="ss-workspace-name">{w.name}</code>
            </div>
            <div className="s-val">
              <span className="ss-choice">
                <ChoiceMenu<string>
                  label={p.workspaceLabel(w.name)}
                  value="default"
                  isDisabled={off}
                  options={[
                    { id: "default", label: p.sameAsDefault(p.sounds[prefs.def][0]) },
                    ...soundIds.map((id) => ({ id, label: p.sounds[id][0], description: p.sounds[id][1] })),
                  ]}
                  onChange={noop}
                />
              </span>
              <IconButton size="row" variant="secondary" aria-label={p.listenWorkspace(w.name)} onPress={() => listen(prefs.def, `ws-${w.id}`)}>
                <Icon name="run" />
              </IconButton>
            </div>
          </div>
        ))}
      </div>
      <h3 className="s-h3">{p.device}</h3>
      <div className="s-card">
        <p className="s-desc ss-pad">{p.deviceDesc}</p>
        <div className="s-row">
          <div className="s-lbl">
            <strong>{p.mute}</strong>
            <span className="s-desc">{p.muteDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              label={p.mute}
              options={[
                { id: "plays", label: p.plays },
                { id: "quiet", label: p.quiet },
              ]}
              value={prefs.muted ? "quiet" : "plays"}
              onChange={(v) => set({ muted: v === "quiet" })}
            />
          </div>
        </div>
        <div className="s-row ss-volume">
          <div className="s-lbl">
            <strong>{p.volume}</strong>
          </div>
          <div className="s-val">
            <ScaleSlider
              testId="sound-device-volume"
              label={p.volume}
              value={prefs.volume}
              stops={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              format={(v) => `${v} %`}
              disabled={prefs.muted}
              onChange={(v) => set({ volume: v })}
            />
            <ControlButton data-testid="sound-test" size="row" variant="secondary" onPress={() => listen(prefs.def, "settings-tile")}>
              <Icon name="run" />
              {p.test}
            </ControlButton>
          </div>
        </div>
        {n.active && !off && !prefs.muted ? (
          <p className="ss-note" data-testid="test-bypass">
            <Icon name="moon" />
            {t.testBypass}
          </p>
        ) : null}
        {note ? (
          <p className="ss-note" data-testid={`sound-note-${note}`}>
            <Speaker muted />
            {note === "muted" ? p.mutedNote : p.offNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------- The account menu's rows, opened beside the page ----------

/** A speaker in the icons' stroke; slashed when quiet (production's). */
function Speaker({ muted }: { muted?: boolean }) {
  return (
    <svg className="ah-speaker" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      {muted ? <path d="M10.5 6l3.5 4M14 6l-3.5 4" /> : <path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 4a5.6 5.6 0 0 1 0 8" />}
    </svg>
  );
}

function MenuCard() {
  const { prefs, set } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const status = !prefs.enabled ? "off" : prefs.muted ? "muted" : n.active ? "night" : undefined;
  const text = status === "off" ? p.stateOff : status === "muted" ? p.stateMuted : status === "night" ? t.menuNightC(n.end) : t.menuPlays;
  return (
    <aside className="nq-menu ah-account-menu" data-testid="menu-card" aria-label={t.menuCaption}>
      <p className="nq-menu-cap">{t.menuCaption}</p>
      <div className="ah-account-menu-theme-row">
        <span>{t.menuTheme}</span>
        <Segmented
          label={t.menuTheme}
          className="ah-account-menu-theme"
          options={(["system", "sun", "moon", "contrast"] as const).map((i) => ({ id: i, label: i, icon: <Icon name={i} />, iconOnly: true }))}
          value="system"
          onChange={noop}
        />
      </div>
      <div className="ah-account-menu-theme-row">
        <span>{t.menuWork}</span>
        <Segmented
          label={t.menuWork}
          className="ah-account-menu-theme"
          options={[
            { id: "hidden", label: t.hidden },
            { id: "visible", label: t.visible },
          ]}
          value="hidden"
          onChange={noop}
        />
      </div>
      <div className="ah-sound-menu" data-testid="sound-menu-row">
        <div className="ah-account-menu-theme-row">
          <span>{p.menuRow}</span>
          <Segmented
            data-testid="sound-menu-mute"
            label={`${p.menuRow}, ${p.menuScope}`}
            className="ah-account-menu-theme"
            isDisabled={status === "off"}
            options={[
              { id: "plays", label: p.plays },
              { id: "quiet", label: p.quiet },
            ]}
            value={prefs.muted ? "quiet" : "plays"}
            onChange={(v) => set({ muted: v === "quiet" })}
          />
        </div>
        <p className={`ah-sound-state${status === "night" ? " nq-menu-night" : ""}`} data-testid="sound-menu-state" data-status={status ?? "plays"}>
          {status === "night" ? <Icon name="moon" /> : <Speaker muted={!!status} />}
          <span>{text}</span>
        </p>
      </div>
    </aside>
  );
}

// ---------- The Settings frame (production classes) ----------

function SettingsFrame({ phone }: { phone: boolean }) {
  const { lang } = useRound();
  const t = useT();
  const sections = shownSettingsSections(lang).filter((s) => s.id !== "palvelin");
  return (
    <section className={`ah-account-settings s-page${phone ? " detail" : ""}`} data-testid="settings-page">
      <nav className="s-nav" aria-label={t.settings}>
        <h1>{t.settings}</h1>
        {sections.map(({ id, label, icon }) => (
          <button type="button" className="s-nav-i" key={id} aria-current={id === "aanet" ? "page" : undefined}>
            <Icon name={icon} />
            {label}
          </button>
        ))}
      </nav>
      <div className="s-main" data-settings-page="aanet">
        <ControlButton className="s-back" variant="quiet" size="row" presentation="back" onPress={noop}>
          {t.back}
        </ControlButton>
        <h2 data-testid="settings-section-aanet">{t.section}</h2>
        <SoundsPage />
      </div>
    </section>
  );
}

function Page({ phone }: { phone: boolean }) {
  const t = useT();
  const rail = (
    <WorkspaceRail>
      <WorkspaceNavRow name="aurinkokello" href="/workspaces/ws_a" />
      <WorkspaceNavRow name="kotisivu" href="/workspaces/ws_k" />
    </WorkspaceRail>
  );
  const main = (
    <div className="ah-settings-layer">
      <div className="ah-state">
        <SettingsFrame phone={phone} />
      </div>
    </div>
  );
  return (
    <StatusBellProvider items={[]}>
      <AppShell mobileTitle={t.section} rail={rail} main={main} />
    </StatusBellProvider>
  );
}

function Round({ d, lang, scenario, phone, menu, run }: { d: number; lang: Lang; scenario: Scenario; phone: boolean; menu: boolean; run: string }) {
  const [prefs, setPrefs] = useState(() => firstPrefs(scenario));
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 2600);
    return () => clearTimeout(id);
  }, [note]);
  useEffect(() => setPrefs(firstPrefs(scenario)), [run, scenario]);
  const ctx: Ctx = { d, lang, scenario, prefs, set: (p) => setPrefs((o) => ({ ...o, ...p })), toast: setNote };
  return (
    <RoundContext.Provider value={ctx}>
      <MemoryRouter initialEntries={["/settings/aanet"]}>
        <Page phone={phone} />
      </MemoryRouter>
      {menu ? <MenuCard /> : null}
      {note ? (
        <p className="nq-toast" role="status" data-testid="toast">
          {note}
        </p>
      ) : null}
    </RoundContext.Provider>
  );
}

// ---------- Review page ----------

type Theme = "light" | "dark";
const firstTheme: Theme = params.get("theme") === "dark" ? "dark" : "light";
let reviewTheme: Theme = firstTheme;
let reviewLanguage: Lang = params.get("lang") === "en" ? "en" : "fi";
const scenarios = SCENARIOS;
let reviewScenario: Scenario = scenarios.includes(params.get("scenario") as Scenario) ? (params.get("scenario") as Scenario) : "nightMuted";
let reviewDevice: Device = (["both", "desktop", "phone"] as Device[]).includes(params.get("device") as Device) ? (params.get("device") as Device) : "both";

function phoneSrc(d: number, theme: Theme, lang: Lang, scenario: Scenario) {
  const q = new URLSearchParams({ bare: "1", d: String(d), theme, lang, scenario });
  return `${location.pathname}?${q}`;
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [lang, setLang] = useState(reviewLanguage);
  const [scenario, setScenario] = useState(reviewScenario);
  const [device, setDevice] = useState(reviewDevice);
  const [run, setRun] = useState(0);
  const t = TEXT[lang];
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const s = () => document.documentElement.style.setProperty("--review-h", `${el.getBoundingClientRect().height}px`);
    s();
    const o = new ResizeObserver(s);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const restart = () => setRun((r) => r + 1);
  return (
    <div className="nq-review" data-direction={direction} data-device={device}>
      <header className="nq-bar" ref={bar}>
        <div className="nq-controls">
          <strong>{t.title}</strong>
          <label>
            {t.scenario}{" "}
            <select
              id="scenario"
              value={scenario}
              onChange={(e) => {
                reviewScenario = e.target.value as Scenario;
                setScenario(reviewScenario);
                restart();
              }}
            >
              {scenarios.map((k) => (
                <option key={k} value={k}>
                  {t.scenarios[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.theme}{" "}
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                reviewTheme = e.target.value as Theme;
                setTheme(reviewTheme);
              }}
            >
              {(["light", "dark"] as const).map((k) => (
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
            {t.device}{" "}
            <select
              id="device"
              value={device}
              onChange={(e) => {
                reviewDevice = e.target.value as Device;
                setDevice(reviewDevice);
              }}
            >
              {(["both", "desktop", "phone"] as Device[]).map((k) => (
                <option key={k} value={k}>
                  {t.devices[k]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" data-testid="event-reset" onClick={restart}>
            {t.reset}
          </button>
        </div>
        <ol className="nq-lines" data-testid="direction-lines">
          {t.lines.map((l, i) => (
            <li key={l} aria-current={i === direction ? "true" : undefined} title={l}>
              {l}
            </li>
          ))}
        </ol>
        <p className="nq-recommend" data-testid="recommendation">
          {t.recommend}
        </p>
      </header>
      <div className="nq-stage">
        {device !== "phone" ? (
          <div className="nq-desktop" data-testid="desktop-stage">
            <Round key={`${lang}`} d={direction} lang={lang} scenario={scenario} phone={false} menu run={`${run}-${scenario}`} />
          </div>
        ) : null}
        {device !== "desktop" ? (
          <figure className="nq-phone" data-testid="phone-stage">
            <iframe key={`${direction}-${theme}-${lang}-${scenario}-${run}`} title={t.phoneCaption} src={phoneSrc(direction, theme, lang, scenario)} data-testid="phone-frame" />
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
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = firstTheme;
    document.documentElement.lang = reviewLanguage;
    document.documentElement.classList.add("nq-bare");
  }, []);
  return <Round d={d} lang={reviewLanguage} scenario={reviewScenario} phone menu={false} run="0" />;
}

// No host: the page asks nothing of the network.
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(url, "http://prototype.test/").pathname.startsWith("/api/")) return realFetch(input, init);
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
    button.textContent = n.replaceAll(" ", " ");
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
