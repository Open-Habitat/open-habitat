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
import { DIRECTIONS, type Device, type Lang, type Scenario, TEXT, type Text } from "./text";
import "./round.css";

// attention-sound-night-visible (22.11.2026). Night quiet (Hiljennä yöllä)
// follows the device's dark mode (web/src/app/attentionSound.ts,
// useDeviceNight), and production says so only in the night row's small
// "Nyt yö" line halfway down Settings › Äänet and at the very bottom of the
// device card. A person with dark mode on all day never hears an agent and
// nothing near the top tells them why. One axis: where the page says that
// sounds are quiet because it is night, and what defines night.
//   A Tilarivi: a status line above everything on the page, with the reason
//     and Soita silti; night stays the device's dark mode.
//   B Pääkytkin: the Äänet switch itself carries the night state, and
//     Hiljennä yöllä moves into the same card right under it.
//   C Kello: A's status line, but night is an editable clock window
//     (default 22–7) instead of dark mode.
// In every direction the tiles and Testaa ääni say that listening skips
// night quiet, and the account menu's Äänet row reads the same state. The
// page is production's Settings frame (Settings.css classes, the section
// list from settingsIndex), production controls, emblems and real sounds
// (attentionSound.playSound); the page body is a copy of SoundSettings.tsx
// with the direction's changes, on local state. Synthetic content.

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
  override: boolean;
  muted: boolean;
  volume: number;
  menuMuted: boolean;
};
const firstPrefs = (): Prefs => ({
  enabled: true,
  night: true,
  def: "kalimba",
  length: "short",
  inView: "quiet",
  start: 22,
  end: 7,
  override: false,
  muted: false,
  volume: 70,
  menuMuted: false,
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
  scenario: "night",
  prefs: firstPrefs(),
  set: noop,
  toast: noop,
});
const useRound = () => useContext(RoundContext);
const useT = (): Text => TEXT[useRound().lang];

const clockOf: Record<Scenario, [number, number]> = { night: [23, 40], darkday: [14, 10], day: [14, 10] };
const fmt = (lang: Lang, h: number, m = 0) =>
  lang === "fi" ? `${h}.${String(m).padStart(2, "0")}` : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const inWindow = (h: number, m: number, start: number, end: number) => {
  const t = h * 60 + m;
  const s = start * 60, e = end * 60;
  return s <= e ? t >= s && t < e : t >= s || t < e;
};
/** What the direction counts as night now, and whether that silences. */
function useNight() {
  const { d, scenario, prefs, lang } = useRound();
  const dark = scenario !== "day";
  const [h, m] = clockOf[scenario];
  const clockNight = inWindow(h, m, prefs.start, prefs.end);
  const night = d === C ? clockNight : dark;
  const silenced = prefs.enabled && prefs.night && night && !prefs.override;
  const overridden = prefs.enabled && prefs.night && night && prefs.override;
  return {
    night,
    silenced,
    overridden,
    now: fmt(lang, h, m),
    start: fmt(lang, prefs.start),
    end: fmt(lang, prefs.end),
  };
}

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

// ---------- The direction's night pieces ----------

/** A and C: the status line, the first thing under the page heading. */
function StatusLine() {
  const { d, set, toast } = useRound();
  const t = useT();
  const n = useNight();
  if (!n.silenced && !n.overridden) return null;
  const toNight = () => {
    const row = document.querySelector<HTMLElement>('[data-settings-row="attention-sound-night"]');
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    row?.focus({ preventScroll: true });
  };
  if (n.overridden)
    return (
      <div className="nq-status" data-state="override" role="status" data-testid="night-status">
        <Icon name="music" />
        <div className="nq-status-text">
          <strong>{t.overridden}</strong>
          <span>{d === C ? t.overriddenClock(n.start) : t.overriddenDark}</span>
        </div>
        <div className="nq-status-actions">
          <ControlButton size="row" variant="secondary" data-testid="night-quiet-again" onPress={() => set({ override: false })}>
            {t.quietAgain}
          </ControlButton>
        </div>
      </div>
    );
  return (
    <div className="nq-status" data-state="night" role="status" data-testid="night-status">
      <Icon name="moon" />
      <div className="nq-status-text">
        <strong data-testid="night-status-title">{d === C ? t.quietUntil(n.end) : t.quietNow}</strong>
        <span>{d === C ? t.whyClock(n.start, n.end) : t.whyDark}</span>
      </div>
      <div className="nq-status-actions">
        <ControlButton
          size="row"
          variant="secondary"
          data-testid="night-play-anyway"
          onPress={() => {
            set({ override: true });
            toast(t.toastOverride);
          }}
        >
          {d === C ? t.playAnywayTonight : t.playAnyway}
        </ControlButton>
        <ControlButton size="row" variant="quiet" data-testid="night-settings-link" onPress={toNight}>
          {t.nightSettings}
          <Icon name="down" />
        </ControlButton>
      </div>
    </div>
  );
}

/** The master row. B carries the night state in it and the night choice
 * right under it; A and C keep production's row. */
function MasterCard() {
  const { d, prefs, set, toast } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const bState = !prefs.enabled ? "off" : n.silenced ? "night" : n.overridden ? "override" : "on";
  return (
    <div className="s-card" data-testid="master-card" data-state={d === B ? bState : undefined}>
      <div className="s-row" data-settings-row="attention-sound-on" tabIndex={-1}>
        <div className="s-lbl">
          <strong>
            {p.on}
            {d === B && bState === "night" ? (
              <span className="nq-tag" data-testid="master-night-tag">
                <Icon name="moon" />
                {t.nightTag}
              </span>
            ) : null}
          </strong>
          {d === B ? (
            <span className={`s-desc nq-master-desc${bState === "night" ? " nq-strong" : ""}`} data-testid="master-state">
              {bState === "off" ? t.onOff : bState === "night" ? t.onNight : bState === "override" ? t.onOverride : t.onDay}
            </span>
          ) : (
            <span className="s-desc">{p.onDesc}</span>
          )}
        </div>
        <div className="s-val">
          <Segmented
            size="row"
            data-testid="sound-enabled"
            label={p.on}
            options={[
              { id: "off", label: p.off },
              {
                id: "on",
                label: p.onLabel,
                ...(d === B && bState === "night" ? { icon: <Icon name="moon" /> } : {}),
              },
            ]}
            value={prefs.enabled ? "on" : "off"}
            onChange={(v) => set({ enabled: v === "on" })}
          />
        </div>
      </div>
      {d === B && bState === "night" ? (
        <div className="nq-b-why" data-testid="master-why">
          <span>{t.onNightWhy}</span>
          <ControlButton
            size="row"
            variant="secondary"
            data-testid="night-play-anyway"
            onPress={() => {
              set({ override: true });
              toast(t.toastOverride);
            }}
          >
            {t.playAnyway}
          </ControlButton>
        </div>
      ) : null}
      {d === B && bState === "override" ? (
        <div className="nq-b-why" data-testid="master-why">
          <span>{t.overriddenDark}</span>
          <ControlButton size="row" variant="secondary" data-testid="night-quiet-again" onPress={() => set({ override: false })}>
            {t.quietAgain}
          </ControlButton>
        </div>
      ) : null}
      {d === B ? <NightRow sub /> : null}
    </div>
  );
}

/** Hiljennä yöllä. A: production's row with its Nyt line. B: the same as a
 * sub-row of the master card. C: the clock window. */
function NightRow({ sub }: { sub?: boolean }) {
  const { d, prefs, set, lang } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const off = !prefs.enabled;
  const hours = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => (from + i) % 24).map((h) => ({ id: String(h), label: `${lang === "fi" ? "klo" : "at"} ${fmt(lang, h)}` }));
  // A label of digits alone has no letters, and production's ControlButton
  // then draws the menu as an icon square; "klo" keeps it a word button.
  return (
    <>
      <div className={`s-row${sub ? " nq-sub" : ""}`} data-settings-row="attention-sound-night" tabIndex={-1}>
        <div className="s-lbl">
          <strong>{sub ? t.nightSub : p.night}</strong>
          <span className="s-desc">{d === C ? t.nightClockDesc : sub ? t.nightSubDesc : p.nightDesc}</span>
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
      {d === C && prefs.night && !off ? (
        <div className="s-row nq-clock" data-testid="night-clock">
          <div className="nq-clock-fields">
            <span className="nq-clock-field">
              <span>{t.from}</span>
              <span className="ss-choice"><ChoiceMenu
                data-testid="night-start"
                label={t.from}
                value={String(prefs.start)}
                options={hours(18, 9)}
                onChange={(v) => set({ start: Number(v), override: false })}
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
                onChange={(v) => set({ end: Number(v), override: false })}
              /></span>
            </span>
          </div>
        </div>
      ) : null}
      {prefs.night && !off && !sub ? (
        <p className="ss-now" data-testid="sound-night-now" data-night={n.night || undefined}>
          <Icon name={n.night ? "moon" : "sun"} />
          {d === C ? t.clockNow(n.now, n.start, n.end, n.night) : n.night ? p.nowNight : p.nowDay}
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
  const listen = (id: SoundId, where: string, length = prefs.length) => playSound(id, length, where, prefs.muted ? 0 : prefs.volume);
  const choose = (id: SoundId) => {
    listen(id, "settings-tile");
    set({ def: id });
  };
  return (
    <div className="s-stack ss-body" data-testid="sound-settings">
      {d !== B ? <StatusLine /> : null}
      <p className="s-intro">{p.intro}</p>
      <MasterCard />
      <h3 className="s-h3">{p.sound}</h3>
      <p className="s-desc ss-lead">{p.soundDesc}</p>
      {n.silenced ? (
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
        {d !== B ? <NightRow /> : null}
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
        {n.silenced ? (
          <p className="ss-note" data-testid="test-bypass">
            <Icon name="moon" />
            {t.testBypass}
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
  const { d, prefs, set, toast } = useRound();
  const t = useT();
  const p = useText(attentionSoundText);
  const n = useNight();
  const status = !prefs.enabled ? "off" : prefs.muted ? "muted" : n.silenced ? "night" : undefined;
  const text =
    status === "off"
      ? p.stateOff
      : status === "muted"
        ? p.stateMuted
        : status === "night"
          ? d === A
            ? t.menuNightA
            : d === B
              ? t.menuNightB
              : t.menuNightC(n.end)
          : n.overridden
            ? t.menuOverride
            : t.menuPlays;
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
          <span>
            {p.menuRow}
            {d === B && status === "night" ? (
              <span className="nq-tag" data-testid="menu-night-tag">
                <Icon name="moon" />
                {t.nightTag}
              </span>
            ) : null}
          </span>
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
        {status === "night" && d !== A ? (
          <div className="nq-menu-act">
            <ControlButton
              size="row"
              variant="secondary"
              data-testid="menu-play-anyway"
              onPress={() => {
                set({ override: true });
                toast(t.toastOverride);
              }}
            >
              {d === C ? t.playAnywayTonight : t.playAnyway}
            </ControlButton>
          </div>
        ) : null}
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
  const [prefs, setPrefs] = useState(firstPrefs);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 2600);
    return () => clearTimeout(id);
  }, [note]);
  useEffect(() => setPrefs(firstPrefs()), [run]);
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
const scenarios: Scenario[] = ["night", "darkday", "day"];
let reviewScenario: Scenario = scenarios.includes(params.get("scenario") as Scenario) ? (params.get("scenario") as Scenario) : "night";
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
