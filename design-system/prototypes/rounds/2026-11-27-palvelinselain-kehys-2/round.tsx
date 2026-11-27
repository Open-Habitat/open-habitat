import React, { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Menu, MenuTrigger, Popover, Separator } from "react-aria-components";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import "../../../../web/src/components/components.css";
import "../../../../web/src/components/ServerBrowser.css";
import "../../../../web/src/components/EditorSplit.css";
import "../../../../web/src/components/ViewPanel.css";
import { type BrowserStatus, summarize } from "../../../../web/src/app/serverBrowser";
import { AccountShelf } from "../../../../web/src/components/Account";
import { AssistantMessage, Composer, ConversationTimeline, UserMessage } from "../../../../web/src/components/Conversation";
import { ConversationFrame, ConversationStream } from "../../../../web/src/components/ConversationFrame";
import { ControlButton, ControlMenuItem, LinkRow } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { Markdown } from "../../../../web/src/components/Markdown";
import { type AgentNavModel, AgentHeader, AppShell, NowSections, WorkspaceNavRow, WorkspaceRail } from "../../../../web/src/components/Navigation";
import { BrowserFrame, BrowserRailRow, BrowserSheet, BrowserTurnCard, BrowserWindows } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { ViewSplit } from "../../../../web/src/components/ViewPanel";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "./round.css";

// server-browser-frame, round 2 (27.11.2026). Jari chose round 1's
// direction 1 Paneeli and trimmed it:
//   - the remote display stays a fixed 1280 × 800 as today;
//   - Chrome's own tab strip is not in the picture: the host would launch
//     Chrome with --kiosk (no tab strip, no toolbar) and make each popup
//     window fullscreen over CDP, so the page gets the whole 800 px; with the
//     address bar gone the active tab shows its origin in Habitat's bar;
//   - no < / > (widen / beside the conversation): a click on the picture
//     widens the panel, production's Keskustelu strip narrows it;
//   - ⋯ keeps Ota ohjaus / Anna agentille ja jatka katsomista, Leikkaa,
//     Kopioi and Liitä with their shortcuts, Sulje välilehti, Sulje selain
//     and the truth sentence; the long-paste dialog, Kirjoita sivulle and
//     Kopioi valinta koneellesi are gone;
//   - the phone types through its own keyboard: the bar's keyboard button
//     focuses a hidden field, and each character goes to the page as a
//     keystroke, as on a desktop;
//   - Valmis is round 1's, unchanged.
// The picker's second entry, Nykyinen, is production's sheet around the
// same page with Chrome's tab strip and toolbar drawn into the picture, so
// the picture sizes compare. Production components: the shell, rail, Oma
// selain row, conversation, Selain card, ViewSplit, buttons, menus, the
// frame's border, mid-step question and toast styles. The round's own: the
// slim bar, tab strip, the drawn third-party pages and Chrome's strip, and
// the size readout. Synthetic.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const noop = () => {};
const directions = ["1 Paneeli", "Nykyinen"];
const NATIVE = { w: 1280, h: 800 };
/** Chrome's tab strip and toolbar in a normal window at 1280 × 800, measured
 * on Chrome under Xvfb: the page's viewport is 712 px high, 799 with --kiosk. */
const CHROME_STRIP = 88;
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = (k: string) => (mac ? `⌘${k}` : `Ctrl+${k}`);

// ---------- Text (Finnish; production strings where they exist) ----------

const T = {
  title: "Palvelinselaimen kehys · kierros 2",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  lines: [
    "1 Paneeli: selain sovelluksen oikeassa paneelissa, ohut palkki. Chromen oma välilehti- ja osoiterivi eivät ole kuvassa, joten sivu saa koko 800 px korkeuden.",
    "Nykyinen: tuotannon arkki saman sivun ympärillä, Chromen välilehti- ja osoiterivi kuvassa.",
  ],
  phases: { agent: "Agentti työssä", ask: "Odottaa sinua", person: "Sinä ohjaat", popup: "Ponnahdusikkuna", back: "Annettu takaisin", stopped: "Selain suljettu" },
  many: "Monta välilehteä",
  longPaste: "⌘V: pitkä teksti",
  size: (w: number, h: number, pct: number, page: number) => `Kuva ${w} × ${h} px · ${pct} % näytöstä 1280 × 800 · sivulle ${page} px korkeutta`,
  ownBrowser: "Oma selain",
  you: "Sinä ohjaat",
  agent: "Agentti ohjaa",
  agentBusy: "Agentti toimii",
  agentWaits: "Agentti odottaa sinua",
  waiting: "Otat ohjauksen, kun agentin toiminto päättyy…",
  done: "Valmis",
  doneHint: "Anna selain takaisin agentille ja sulje näkymä",
  close: "Sulje",
  closeHint: "Sulje näkymä. Agentti jatkaa.",
  says: "Agentti",
  more: "Lisää",
  tabs: (n: number) => (n === 1 ? "1 välilehti" : `${n} välilehteä`),
  tabsLabel: "Välilehdet",
  closeTab: (t: string) => `Sulje välilehti: ${t}`,
  closeThisTab: "Sulje välilehti",
  popupMark: "ponnahdus",
  cut: "Leikkaa",
  copy: "Kopioi",
  paste: "Liitä",
  keys: "Näppäimistö",
  keysOn: "Kirjoitus menee sivulle",
  giveKeep: "Anna agentille ja jatka katsomista",
  takeHere: "Ota ohjaus",
  stopBrowser: "Sulje selain",
  truth: "Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
  hintAgent: "Klikkaa tai kirjoita ottaaksesi ohjauksen",
  hintBusy: "Agentti toimii · klikkaa ottaaksesi ohjauksen",
  screen: "Palvelinselaimen näkymä",
  helpAgent: "Klikkaa sivua tai ala kirjoittaa, niin ohjaus siirtyy sinulle.",
  helpYou: `Agentti odottaa, kunnes annat selaimen takaisin. Klikkaa ja kirjoita sivulla kuten omassa selaimessasi. ${mod("C")}, ${mod("X")} ja ${mod("V")} toimivat kuten koneellasi.`,
  midTitle: "Agentti on kesken",
  midText: "Jos otat ohjauksen nyt, sen seuraavat askeleet perutaan ja sivulle voi jäädä puolikas syöte. Agentti katsoo sivun uudelleen ennen kuin jatkaa.",
  takeNow: "Ota ohjaus nyt",
  takeAfter: "Ota, kun se on valmis",
  cancel: "Peru",
  toast: {
    took: "Sinä ohjaat. Agentti odottaa.",
    tookAfter: "Agentin toiminto päättyi. Sinä ohjaat.",
    back: "Agentti jatkaa.",
    backCleared: "Agentti jatkaa. Etäkoneen leikepöytä tyhjennettiin.",
    typed: (n: number) => `Kirjoitettiin sivulle näppäilyinä · ${n} merkkiä`,
    pasted: (n: number) => `Liitetty etäkoneen leikepöydän kautta · ${n} merkkiä. Agentti näkee leikepöydän, kunnes annat selaimen takaisin.`,
    long: "Tekstissä on rivinvaihtoja tai yli 1 000 merkkiä, joten sitä ei kirjoitettu. Mitään ei lähetetty.",
    longAction: "Liitä leikepöydän kautta",
    copied: (n: number) => `Kopioitu etäsivulta koneesi leikepöydälle · ${n} merkkiä`,
    cutDone: (n: number) => `Leikattu etäsivulta koneesi leikepöydälle · ${n} merkkiä`,
    nothing: "Sivulla ei ole valintaa. Mitään ei kopioitu.",
    tabClosed: (t: string) => `Välilehti suljettu: ${t}`,
    lastTab: "Viimeistä välilehteä ei suljeta. Sulje selain ⋯-valikosta.",
    stopped: "Selain suljettu.",
  },
  confirmStop: "Sulje selain? Kaikki välilehdet suljetaan, ja agentti avaa selaimen uudelleen, kun tarvitsee sitä.",
  workspace: "kotitalous",
  otherWorkspace: "yhdistys",
  convA: "Sähkölaskut 2026",
  convB: "Kevätkokouksen esitys",
  ask: "Hae Energia Oy:n palvelusta vuoden 2026 sähkölaskut ja tallenna ne kansioon `Laskut/2026`.",
  reply: "Avasin Energia Oy:n palvelun selaimessasi. Kirjautuminen vaatii tunnuksesi: kirjaudu sisään, niin jatkan laskujen hakemista.",
  replyBack: "Kiitos. Haen nyt laskut tammikuusta lokakuuhun.",
  request: "Kirjaudu sisään Energia Oy:n palveluun, niin haen laskut.",
  working: "Työskentelee",
  waits: "Odottaa sinua",
  fakeLong: "Rivi 1\nRivi 2",
};

// ---------- The synthetic browser ----------

type TabKey = "laskut" | "kirjaudu" | "vahvista" | "kirjasto" | "sopimus";
type Tab = { key: TabKey; id: string; title: string; origin: string; agent?: boolean; popup?: boolean };
const TABS: Record<TabKey, Tab> = {
  laskut: { key: "laskut", id: "7F2A0000000000000000000000000001", title: "Laskut – Energia Oy", origin: "energia.example" },
  kirjaudu: { key: "kirjaudu", id: "9C410000000000000000000000000002", title: "Kirjaudu – Tunnistus", origin: "tunnistus.example", agent: true },
  vahvista: { key: "vahvista", id: "AA010000000000000000000000000003", title: "Vahvista kirjautuminen", origin: "tunnistus.example", popup: true },
  kirjasto: { key: "kirjasto", id: "3B100000000000000000000000000004", title: "Lainat – Kirjasto", origin: "kirjasto.example" },
  sopimus: { key: "sopimus", id: "5D200000000000000000000000000005", title: "Sähkösopimus – Energia Oy", origin: "energia.example" },
};

type Phase = keyof typeof T.phases;
type World = {
  phase: Phase;
  control: "agent" | "person";
  busy: boolean;
  request?: string;
  tabs: TabKey[];
  active: TabKey;
  open: boolean;
  waiting: boolean;
  mid?: { x: number; y: number };
  fields: Record<string, string>;
  focusField?: string;
  pasted: boolean;
  stopped: boolean;
};

const baseTabs = (many: boolean): TabKey[] => (many ? ["laskut", "kirjaudu", "kirjasto", "sopimus"] : ["laskut", "kirjaudu"]);
function worldAt(p: Phase, many: boolean): World {
  const w: World = { phase: p, control: "agent", busy: false, tabs: baseTabs(many), active: "kirjaudu", open: true, waiting: false, fields: {}, pasted: false, stopped: false };
  if (p === "agent") return { ...w, busy: true, active: "laskut" };
  if (p === "ask") return { ...w, request: T.request };
  if (p === "person") return { ...w, control: "person", request: T.request, focusField: "user" };
  if (p === "popup") return { ...w, control: "person", request: T.request, tabs: [...w.tabs, "vahvista"], active: "vahvista", fields: { user: "aino.laine", pass: "••••••••" }, focusField: "code" };
  if (p === "back") return { ...w, busy: true, open: false, active: "laskut" };
  return { ...w, open: false, stopped: true, tabs: [] };
}

let reviewTheme = (params.get("theme") as "light" | "dark") || "light";
const firstPhase = ((Object.keys(T.phases) as Phase[]).includes(params.get("state") as Phase) ? params.get("state") : "ask") as Phase;
const measuring = params.get("measure") === "1";

// ---------- The drawn third-party pages (fixed colours: not Habitat's) ----------

function Field({ id, label, w, set, secret, control }: { id: string; label: string; w: World; set: Setter; secret?: boolean; control: boolean }) {
  const value = w.fields[id] ?? "";
  const shown = secret ? "•".repeat(value.length) : value;
  return (
    <label className="fp-field">
      <span>{label}</span>
      <span
        className="fp-input"
        data-field={id}
        data-focus={control && w.focusField === id ? "" : undefined}
        onPointerDown={() => control && set((x) => ({ ...x, focusField: id }))}
      >
        {shown}
        {control && w.focusField === id ? <i className="fp-caret" /> : null}
      </span>
    </label>
  );
}

function Page({ tab, w, set }: { tab: TabKey; w: World; set: Setter }) {
  const control = w.control === "person";
  if (tab === "laskut" || tab === "sopimus")
    return (
      <div className="fp fp-energia">
        <header className="fp-head"><b>Energia Oy</b><nav>Etusivu · Laskut · Sopimus · Asiakaspalvelu</nav></header>
        <main className="fp-main">
          <h1>{tab === "laskut" ? "Laskut 2026" : "Sähkösopimus"}</h1>
          {tab === "laskut" ? (
            <table className="fp-table">
              <tbody>
                {["Lokakuu", "Syyskuu", "Elokuu", "Heinäkuu", "Kesäkuu"].map((m, i) => (
                  <tr key={m}><td>{m} 2026</td><td>{(48.2 + i * 3.1).toFixed(2).replace(".", ",")} €</td><td><span className="fp-link">Lataa PDF</span></td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Toistaiseksi voimassa oleva pörssisähkösopimus. Marginaali 0,39 c/kWh.</p>
          )}
        </main>
      </div>
    );
  if (tab === "kirjasto")
    return (
      <div className="fp fp-kirjasto">
        <header className="fp-head"><b>Kaupunginkirjasto</b><nav>Haku · Lainat · Varaukset</nav></header>
        <main className="fp-main"><h1>Lainat</h1><p>Kolme lainaa, eräpäivä 4.12.2026.</p></main>
      </div>
    );
  const login = (
    <div className="fp fp-tunnistus">
      <main className="fp-card">
        <h1>Kirjaudu palveluun</h1>
        <p>Energia Oy pyytää tunnistautumista.</p>
        <Field id="user" label="Käyttäjätunnus" w={w} set={set} control={control} />
        <Field id="pass" label="Salasana" w={w} set={set} secret control={control} />
        <span className="fp-button">Kirjaudu</span>
      </main>
    </div>
  );
  if (tab === "kirjaudu") return login;
  // A feature popup. In a normal window Chrome gives it a read-only address
  // strip; the host makes it fullscreen (CDP Browser.setWindowBounds,
  // windowState "fullscreen"), so the page fills the display like a tab.
  return (
    <div className="fp fp-tunnistus fp-popup">
      <main className="fp-card">
        <h1>Vahvista kirjautuminen</h1>
        <p>Syötä tekstiviestinä saamasi koodi.</p>
        <Field id="code" label="Koodi" w={w} set={set} control={control} />
        <span className="fp-button">Vahvista</span>
      </main>
    </div>
  );
}

/** Today's picture: Chrome's own tab strip and toolbar take the top 88 px
 * of the 1280 × 800 display. A popup window has only its address strip. */
function ChromeStrip({ w }: { w: World }) {
  const t = TABS[w.active];
  if (t.popup)
    return (
      <div className="cr-strip cr-popup-strip" style={{ height: 36 }} data-testid="chrome-strip">
        <span className="cr-url">https://{t.origin}/vahvista</span>
      </div>
    );
  return (
    <div className="cr-strip" style={{ height: CHROME_STRIP }} data-testid="chrome-strip">
      <div className="cr-tabs">
        {w.tabs.filter((k) => !TABS[k].popup).map((k) => (
          <span key={k} className="cr-tab" data-active={k === w.active || undefined}>
            <span className="kh-fav" data-site={TABS[k].origin} />
            <span className="cr-tab-title">{TABS[k].title}</span>
            <span aria-hidden="true">×</span>
          </span>
        ))}
        <span className="cr-plus" aria-hidden="true">+</span>
      </div>
      <div className="cr-toolbar">
        <span aria-hidden="true">←</span>
        <span aria-hidden="true">→</span>
        <span aria-hidden="true">↻</span>
        <span className="cr-url">https://{t.origin}/</span>
        <span aria-hidden="true">⋮</span>
      </div>
    </div>
  );
}

type Setter = (f: (x: World) => World) => void;

/** The remote picture: the fixed 1280 × 800 display scaled to fit, as
 * noVNC's scaleViewport does today. In Paneeli the page has all of it; in
 * Nykyinen Chrome's strip takes the top. */
function Picture({ w, set, onTake, onMid, onKey, onWiden, compare, keys }: {
  w: World; set: Setter; onTake: () => void; onMid: (at: { x: number; y: number }) => void; onKey: (e: React.KeyboardEvent) => void; onWiden?: () => void; compare?: boolean; keys?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    read();
    const o = new ResizeObserver(read);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const s = size.w && size.h ? Math.min(size.w / NATIVE.w, size.h / NATIVE.h) : 0;
  const shown = { w: Math.round(NATIVE.w * s), h: Math.round(NATIVE.h * s) };
  const strip = compare ? (TABS[w.active].popup ? 36 : CHROME_STRIP) : 0;
  const page = Math.round((NATIVE.h - strip) * s);
  useLayoutEffect(() => {
    const out = document.querySelector<HTMLElement>("[data-testid='picture-size']");
    if (!out || !shown.w) return;
    out.textContent = T.size(shown.w, shown.h, Math.round(s * 100), page);
    out.dataset.width = String(shown.w);
    out.dataset.height = String(shown.h);
    out.dataset.page = String(page);
    out.dataset.scale = s.toFixed(3);
  });
  const down = (e: React.PointerEvent) => {
    box.current?.focus({ preventScroll: true });
    onWiden?.();
    if (w.control === "person" || w.waiting) return;
    const r = box.current!.getBoundingClientRect();
    if (w.busy) {
      e.preventDefault();
      onMid({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      return;
    }
    onTake();
  };
  return (
    <div
      ref={box}
      className={compare ? "sb-viewer kh-picture" : "kh-picture"}
      data-testid="browser-viewer"
      data-control={w.control}
      tabIndex={0}
      role="application"
      aria-label={T.screen}
      aria-describedby="kh-screen-help"
      onPointerDown={down}
      onKeyDown={onKey}
      onPaste={(e) => e.preventDefault()}
    >
      <span id="kh-screen-help" hidden>{w.control === "person" ? T.helpYou : T.helpAgent}</span>
      <div
        className="kh-remote"
        style={{ width: NATIVE.w, height: NATIVE.h, transform: `translate(-50%, -50%) scale(${s})`, left: "50%", top: "50%" } as CSSProperties}
      >
        {compare ? <ChromeStrip w={w} /> : null}
        <div className="kh-page" style={{ top: strip }}>
          <Page tab={w.active} w={w} set={set} />
        </div>
      </div>
      {keys}
    </div>
  );
}

// ---------- The lighter frame's pieces, shared by every direction ----------

function turnOf(w: World) {
  if (w.waiting) return T.waiting;
  if (w.control === "person") return T.you;
  if (w.busy) return T.agentBusy;
  if (w.request) return T.agentWaits;
  return T.agent;
}

function Turn({ w }: { w: World }) {
  const mine = w.control === "person";
  return (
    <span className="kh-turn" data-testid="browser-turn" data-control={w.control} role="status">
      <Icon name={mine ? "user" : "agent"} />
      <strong>{turnOf(w)}</strong>
    </span>
  );
}

type Acts = {
  take: (msg?: string) => void;
  done: () => void;
  close: () => void;
  giveKeep: () => void;
  select: (k: TabKey) => void;
  closeTab: (k: TabKey) => void;
  stop: () => void;
  clip: (op: Clip) => void;
  keys: () => void;
  cancelWait: () => void;
};
type Clip = "cut" | "copy" | "paste";

/** Tabs as tabs: the one in front is marked, its × is always there, and it
 * shows its origin, since Chrome's address bar is no longer in the picture. */
function TabStrip({ w, acts }: { w: World; acts: Acts }) {
  return (
    <div className="kh-tabs" role="tablist" aria-label={T.tabsLabel} data-testid="browser-tabs">
      {w.tabs.map((k) => {
        const t = TABS[k];
        const on = w.active === k;
        return (
          <div className="kh-tab" key={k} data-tab={k} data-active={on || undefined} data-popup={t.popup || undefined}>
            <button type="button" role="tab" aria-selected={on} title={`${t.title} · ${t.origin}`} data-testid="browser-tab" onClick={() => acts.select(k)}>
              {t.popup ? <Icon name="external" /> : <span className="kh-fav" data-site={t.origin} aria-hidden="true" />}
              <span className="kh-tab-title">{t.title}</span>
              {on ? <span className="kh-origin" data-testid="browser-origin">{t.origin}</span> : null}
              {t.popup ? <span className="kh-tab-mark">{T.popupMark}</span> : null}
            </button>
            <ControlButton size="inline" variant="quiet" presentation="icon" data-testid="browser-tab-close" aria-label={T.closeTab(t.title)} title={T.closeTab(t.title)} onPress={() => acts.closeTab(k)}>
              <Icon name="cross" />
            </ControlButton>
          </div>
        );
      })}
    </div>
  );
}

/** On a phone: the tab in front as a button whose menu lists the tabs. */
function TabMenu({ w, acts }: { w: World; acts: Acts }) {
  const t = TABS[w.active];
  return (
    <MenuTrigger>
      <ControlButton size="inline" variant="quiet" className="kh-tabmenu" data-testid="browser-tab-menu" aria-label={`${T.tabsLabel}: ${t.title}, ${t.origin}, ${T.tabs(w.tabs.length)}`}>
        <span className="kh-tabcount" aria-hidden="true">{w.tabs.length}</span>
        <span className="kh-tab-title" data-testid="browser-origin">{t.origin}</span>
        <Icon name="down" />
      </ControlButton>
      <Popover placement="bottom start" className="ah-popover kh-menu">
        <Menu aria-label={T.tabsLabel} onAction={(key) => {
          const s = String(key);
          if (s === "close") acts.closeTab(w.active);
          else acts.select(s as TabKey);
        }}>
          {w.tabs.map((k) => (
            <ControlMenuItem key={k} id={k} textValue={TABS[k].title} className="kh-menu-tab" data-active={w.active === k || undefined}>
              {TABS[k].popup ? <Icon name="external" /> : <span className="kh-fav" data-site={TABS[k].origin} aria-hidden="true" />}
              <span className="kh-menu-tab-text">
                <span className="kh-tab-title">{TABS[k].title}</span>
                <small>{TABS[k].origin}</small>
              </span>
              {TABS[k].popup ? <span className="kh-tab-mark">{T.popupMark}</span> : null}
            </ControlMenuItem>
          ))}
          <ControlMenuItem id="close" textValue={T.closeThisTab} data-testid="menu-close-tab">
            <Icon name="cross" /> {T.closeThisTab}
          </ControlMenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** ⋯: the turn, cut / copy / paste with their shortcuts, the tab and the
 * browser, and the sentence the old frame kept on screen. */
function More({ w, acts }: { w: World; acts: Acts }) {
  const mine = w.control === "person";
  const clip = (id: Clip, label: string, k: string) => (
    <ControlMenuItem id={id} textValue={label} data-testid={`menu-${id}`}>
      <span className="kh-menu-label">{label}</span>
      <kbd className="kh-kbd" data-testid="menu-shortcut">{mod(k)}</kbd>
    </ControlMenuItem>
  );
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" presentation="icon" data-testid="browser-more" aria-label={T.more} title={T.more}>
        <Icon name="more" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover kh-menu kh-more">
        <Menu
          aria-label={T.more}
          onAction={(key) => {
            if (key === "cut" || key === "copy" || key === "paste") acts.clip(key);
            else if (key === "keep") acts.giveKeep();
            else if (key === "take") acts.take();
            else if (key === "tab") acts.closeTab(w.active);
            else if (key === "stop") acts.stop();
          }}
        >
          {mine ? (
            <ControlMenuItem key="keep" id="keep" textValue={T.giveKeep} data-testid="menu-give-keep"><Icon name="agent" /> {T.giveKeep}</ControlMenuItem>
          ) : (
            <ControlMenuItem key="take" id="take" textValue={T.takeHere} data-testid="menu-take"><Icon name="user" /> {T.takeHere}</ControlMenuItem>
          )}
          <Separator className="kh-sep" />
          {clip("cut", T.cut, "X")}
          {clip("copy", T.copy, "C")}
          {clip("paste", T.paste, "V")}
          <Separator className="kh-sep" />
          <ControlMenuItem id="tab" textValue={T.closeThisTab} data-testid="menu-close-tab"><Icon name="cross" /> {T.closeThisTab}</ControlMenuItem>
          <ControlMenuItem id="stop" textValue={T.stopBrowser} danger data-testid="menu-stop"><Icon name="stop" /> {T.stopBrowser}</ControlMenuItem>
        </Menu>
        <p className="kh-truth" data-testid="browser-truth">{T.truth}</p>
      </Popover>
    </MenuTrigger>
  );
}

/** The one end action: Valmis while you drive, × while the agent does. */
function EndAction({ w, acts }: { w: World; acts: Acts }) {
  if (w.waiting)
    return (
      <ControlButton size="inline" data-testid="browser-cancel-wait" onPress={acts.cancelWait}>
        <Icon name="cross" /> {T.cancel}
      </ControlButton>
    );
  if (w.control === "person")
    return (
      <ControlButton size="inline" variant="primary" data-testid="browser-done" aria-label={T.doneHint} title={T.doneHint} onPress={acts.done}>
        <Icon name="check" />
        <span>{T.done}</span>
      </ControlButton>
    );
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" data-testid="browser-close" aria-label={T.closeHint} title={T.closeHint} onPress={acts.close}>
      <Icon name="cross" />
    </ControlButton>
  );
}

/** The phone's keyboard button: a picture cannot raise the system keyboard,
 * so the button focuses a hidden field whose characters go to the page as
 * keystrokes, the same way a desktop keyboard does. */
function KeysButton({ w, acts, on }: { w: World; acts: Acts; on: boolean }) {
  if (w.control !== "person") return null;
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" className="kh-phone-only" data-testid="browser-keys" aria-pressed={on} aria-label={T.keys} title={T.keys} onPress={acts.keys}>
      <Icon name="key" />
    </ControlButton>
  );
}

/** The slim bar: tabs, who drives, ⋯, one end action. */
function Bar({ w, acts, keysOn }: { w: World; acts: Acts; keysOn: boolean }) {
  return (
    <div className="kh-bar" data-testid="browser-bar">
      <span className="kh-desk-only kh-tabs-wrap"><TabStrip w={w} acts={acts} /></span>
      <span className="kh-phone-only kh-tabmenu-wrap"><TabMenu w={w} acts={acts} /></span>
      <span className="kh-bar-end" data-testid="browser-bar-end">
        <Turn w={w} />
        <KeysButton w={w} acts={acts} on={keysOn} />
        <More w={w} acts={acts} />
        <EndAction w={w} acts={acts} />
      </span>
    </div>
  );
}

function Says({ w }: { w: World }) {
  if (!w.request || w.control === "person") return null;
  return (
    <p className="kh-says" data-testid="browser-says">
      <b>{T.says}:</b> <span>{w.request}</span>
    </p>
  );
}

/** Production's mid-step question, placed where the click landed. */
function Mid({ w, acts, set }: { w: World; acts: Acts; set: Setter }) {
  if (!w.mid) return null;
  return (
    <div
      className="sb-mid"
      role="alertdialog"
      aria-labelledby="kh-mid-title"
      aria-describedby="kh-mid-text"
      data-testid="browser-mid-step"
      style={{ "--sb-mid-x": `${Math.min(Math.max(w.mid.x, 0), 0.6) * 100}%`, "--sb-mid-y": `${Math.min(Math.max(w.mid.y, 0), 0.55) * 100}%` } as CSSProperties}
    >
      <strong id="kh-mid-title"><Icon name="warning" />{T.midTitle}</strong>
      <p id="kh-mid-text">{T.midText}</p>
      <div className="sb-actions">
        <ControlButton size="row" variant="primary" data-testid="browser-take-now" autoFocus onPress={() => acts.take()}>{T.takeNow}</ControlButton>
        <ControlButton size="row" data-testid="browser-take-after" onPress={() => set((x) => ({ ...x, mid: undefined, waiting: true }))}>{T.takeAfter}</ControlButton>
        <ControlButton size="row" variant="quiet" data-testid="browser-mid-cancel" onPress={() => set((x) => ({ ...x, mid: undefined }))}>{T.cancel}</ControlButton>
      </div>
    </div>
  );
}

type Toast = { text: string; n: number; action?: { label: string; run: () => void } };

function Foot({ toast }: { toast?: Toast }) {
  return (
    <div className="sb-frame-foot kh-foot">
      <p className="sb-toast kh-toast" role="status" aria-live="polite" data-testid="browser-toast">
        {toast?.text ?? ""}
        {toast?.action ? (
          <button type="button" className="kh-toast-action" data-testid="browser-toast-action" onClick={toast.action.run}>
            {toast.action.label}
          </button>
        ) : null}
      </p>
    </div>
  );
}

function Hint({ w }: { w: World }) {
  if (w.control === "person" || w.waiting || w.mid) return null;
  return (
    <div className="sb-canvas-hint kh-hint" aria-hidden="true">
      <Icon name={w.busy ? "agent" : "user"} />
      <span>{w.busy ? T.hintBusy : T.hintAgent}</span>
    </div>
  );
}

/** The phone's keyboard: an invisible field over the picture's bottom edge.
 * Its input never stays in it; each character goes to the page. */
function PhoneKeys({ on, onText, onPaste, onBackspace }: { on: boolean; onText: (t: string) => void; onPaste: () => void; onBackspace: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (on) ref.current?.focus({ preventScroll: true });
    else ref.current?.blur();
  }, [on]);
  if (!on) return null;
  return (
    <>
      <textarea
        ref={ref}
        className="kh-ime"
        data-testid="browser-ime"
        aria-label={T.keysOn}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value=""
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Backspace") { e.preventDefault(); onBackspace(); }
        }}
        onPaste={(e) => { e.preventDefault(); onPaste(); }}
        onChange={(e) => e.target.value && onText(e.target.value)}
      />
      <p className="kh-ime-note" data-testid="browser-ime-note"><Icon name="key" /> {T.keysOn}</p>
    </>
  );
}

// ---------- 1 Paneeli and Nykyinen ----------

type ViewProps = { w: World; set: Setter; acts: Acts; toast?: Toast; onKey: (e: React.KeyboardEvent) => void; keys: ReactNode; onWiden: () => void };

function Screen({ w, set, acts, toast, onKey, keys, onWiden }: ViewProps) {
  return (
    <div className="sb-frame kh-frame" data-testid="browser-frame" data-control={w.control} data-waiting={w.waiting || undefined}>
      <div className="kh-screen" data-testid="browser-screen">
        <Picture w={w} set={set} onKey={onKey} onWiden={onWiden} onTake={() => acts.take()} onMid={(at) => set((x) => ({ ...x, mid: at }))} keys={keys} />
        <Hint w={w} />
        <Mid w={w} acts={acts} set={set} />
        <Foot toast={toast} />
      </div>
    </div>
  );
}

/** 1 Paneeli: the browser in production's right-hand panel. */
function PanelView(p: ViewProps & { keysOn: boolean }) {
  return (
    <section className="ah-view-pane kh-pane" aria-label={T.ownBrowser} data-testid="browser-view" data-direction="panel">
      <Bar w={p.w} acts={p.acts} keysOn={p.keysOn} />
      <Says w={p.w} />
      <Screen {...p} />
    </section>
  );
}

/** Nykyinen: production's sheet around the same page, Chrome's strip in the picture. */
function Today({ w, set, acts, onKey }: Pick<ViewProps, "w" | "set" | "acts" | "onKey">) {
  const status = statusOf(w);
  return (
    <BrowserSheet
      mode={w.control === "person" ? "control" : "view"}
      running
      windows={<BrowserWindows windows={status.windows} busy={false} onSelect={(id) => acts.select(keyOfId(id))} onClose={(id) => acts.closeTab(keyOfId(id))} />}
      onClose={acts.close}
      onStop={acts.stop}
    >
      <BrowserFrame
        control={w.control}
        agent={w.busy ? "busy" : w.request ? "waits" : "idle"}
        waiting={w.waiting}
        says={w.control === "agent" ? w.request : undefined}
        clipOpen={false}
        clipboard={null}
        onTake={() => acts.take()}
        onDone={acts.giveKeep}
        onCancelWait={acts.cancelWait}
        onClipToggle={noop}
        onTakeNow={() => acts.take()}
        onTakeAfter={noop}
        onMidCancel={noop}
        onKeep={noop}
        onClipClose={noop}
      >
        <Picture compare w={w} set={set} onKey={onKey} onTake={() => acts.take()} onMid={(at) => set((x) => ({ ...x, mid: at }))} />
      </BrowserFrame>
    </BrowserSheet>
  );
}

const keyOfId = (id: string) => (Object.values(TABS).find((t) => t.id === id)?.key ?? "laskut") as TabKey;
function statusOf(w: World): BrowserStatus {
  return {
    schema_version: 1,
    state: w.stopped ? "stopped" : "running",
    survives_restart: true,
    control: w.control,
    agent_connected: true,
    windows: w.tabs.map((k) => ({ id: TABS[k].id, title: TABS[k].title, origin: `https://${TABS[k].origin}`, agent: !!TABS[k].agent })),
    request: w.request && w.control === "agent" ? { window: TABS.kirjaudu.id, text: w.request, age_ms: 30_000 } : undefined,
  };
}

// ---------- The app around it ----------

function Thread({ w, onLook, onTake, onGiveBack }: { w: World; onLook: () => void; onTake: () => void; onGiveBack: () => void }) {
  const items: { id: string; kind?: string; content: ReactNode }[] = [];
  items.push({ id: "a1", kind: "user", content: <UserMessage sourceText={T.ask} onCopy={noop} time="9.12"><Markdown text={T.ask} /></UserMessage> });
  const state = w.control === "person" ? "control" : w.request ? "ask" : "working";
  const back = w.phase === "back" || (!w.request && w.control === "agent" && w.busy && w.phase !== "agent");
  items.push({
    id: "a2",
    kind: "assistant",
    content: (
      <div className="kh-reply">
        <AssistantMessage streamState="complete" time="9.13" onCopy={noop}>
          <Markdown text={back ? T.replyBack : T.reply} />
        </AssistantMessage>
        {w.stopped ? null : (
          <BrowserTurnCard
            state={state}
            visits={{ summary: { sites: ["energia.example", "tunnistus.example"], pageCount: back ? 5 : 3, downloadCount: 0, actionCount: 2, startedAt: Date.now() - 120_000 }, coverage: "command-results-only" }}
            request={w.request}
            agentWindow={TABS.kirjaudu.title}
            onLook={onLook}
            onTake={onTake}
            onGiveBack={onGiveBack}
          />
        )}
      </div>
    ),
  });
  return <ConversationTimeline state="ready" items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />;
}

function Main({ compare, many, w, set }: { compare: boolean; many: boolean; w: World; set: Setter }) {
  const [expanded, setExpanded] = useState(true);
  const [toast, setToast] = useState<Toast>();
  const [appToast, setAppToast] = useState<string | undefined>(w.phase === "back" ? T.toast.backCleared : undefined);
  const [keysOn, setKeysOn] = useState(false);
  const [draft, setDraft] = useState("");
  const say = (text: string, action?: Toast["action"]) => setToast((o) => ({ text, n: (o?.n ?? 0) + 1, action }));
  useEffect(() => {
    if (!toast || toast.action) return;
    const id = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!appToast) return;
    const id = setTimeout(() => setAppToast(undefined), 8000);
    return () => clearTimeout(id);
  }, [appToast]);
  // "Take when it's done": the agent's step ends a moment later.
  useEffect(() => {
    if (!w.waiting) return;
    const id = setTimeout(() => {
      set((x) => ({ ...x, waiting: false, busy: false, control: "person" }));
      say(T.toast.tookAfter);
    }, 1500);
    return () => clearTimeout(id);
  }, [w.waiting]);
  // The phone's keyboard closes when the turn leaves you.
  useEffect(() => {
    if (w.control !== "person" || !w.open) setKeysOn(false);
  }, [w.control, w.open]);
  const focusPicture = () => requestAnimationFrame(() => document.querySelector<HTMLElement>(".kh-picture")?.focus({ preventScroll: true }));
  const acts: Acts = {
    take: (msg = T.toast.took) => {
      set((x) => ({ ...x, control: "person", busy: false, mid: undefined, waiting: false, focusField: x.focusField ?? (x.active === "vahvista" ? "code" : "user") }));
      setExpanded(true);
      say(msg);
      focusPicture();
    },
    // Valmis: give back, empty the remote clipboard, close the view.
    done: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, open: false, mid: undefined, focusField: undefined, phase: "back", pasted: false }));
      setAppToast(w.pasted ? T.toast.backCleared : T.toast.back);
      setToast(undefined);
    },
    close: () => {
      if (w.control === "person") return acts.done();
      set((x) => ({ ...x, open: false, mid: undefined, waiting: false }));
    },
    giveKeep: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, focusField: undefined, phase: "agent", pasted: false }));
      say(w.pasted ? T.toast.backCleared : T.toast.back);
    },
    // Bringing a tab forward changes the agent's world: it takes control, as today.
    select: (k) => {
      set((x) => ({ ...x, active: k, control: "person", busy: false, mid: undefined, focusField: k === "vahvista" ? "code" : k === "kirjaudu" ? "user" : undefined }));
      if (w.control !== "person") say(T.toast.took);
      focusPicture();
    },
    closeTab: (k) => {
      if (w.tabs.length <= 1) return say(T.toast.lastTab);
      set((x) => {
        const tabs = x.tabs.filter((t) => t !== k);
        const active = x.active === k ? (k === "vahvista" ? "kirjaudu" : tabs[Math.max(0, x.tabs.indexOf(k) - 1)]) : x.active;
        return { ...x, tabs, active, control: "person", busy: false, mid: undefined };
      });
      say(T.toast.tabClosed(TABS[k].title));
      focusPicture();
    },
    stop: () => {
      if (!window.confirm(T.confirmStop)) return;
      set((x) => ({ ...worldAt("stopped", many), phase: "stopped" }));
      setAppToast(T.toast.stopped);
    },
    // Cut, copy and paste act like the keys on the picture: while the agent
    // waits they take control first; mid-step they ask.
    clip: (op) => {
      if (w.waiting) return;
      if (w.control !== "person") {
        if (w.busy) return set((x) => ({ ...x, mid: { x: 0.2, y: 0.2 } }));
        acts.take();
      }
      runClip(op);
      if (!keysOn) focusPicture();
    },
    keys: () => setKeysOn((v) => !v),
    cancelWait: () => set((x) => ({ ...x, waiting: false })),
  };
  const typeInto = (text: string) =>
    set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "") + text } } : x));
  const pasteText = () => (w.focusField === "pass" ? "kesä-2026-Sähkö" : w.focusField === "code" ? "482913" : "aino.laine");
  // The prototype never touches the real clipboard: invented text only.
  // ⌘V types the text as keystrokes; copying takes the page's selection (here:
  // the focused visible field, or a row of the invoice list).
  const runClip = (op: Clip) => {
    if (op === "paste") {
      const text = pasteText();
      typeInto(text);
      return say(T.toast.typed(text.length));
    }
    const field = w.focusField && w.focusField !== "pass" ? w.focusField : undefined;
    const text = field ? (w.fields[field] ?? "") : w.active === "laskut" ? "Lokakuu 2026 48,20 €" : "";
    if (!text) return say(T.toast.nothing);
    if (op === "cut" && field) set((x) => ({ ...x, fields: { ...x.fields, [field]: "" } }));
    say(op === "cut" ? T.toast.cutDone(text.length) : T.toast.copied(text.length));
  };
  const backspace = () => set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "").slice(0, -1) } } : x));
  const onKey = (e: React.KeyboardEvent) => {
    // The picture's keys never reach the review picker.
    e.stopPropagation();
    const k = e.key.toLowerCase();
    const clip: Clip | undefined = e.metaKey || e.ctrlKey ? (k === "x" ? "cut" : k === "c" ? "copy" : k === "v" ? "paste" : undefined) : undefined;
    if (w.mid || w.waiting) return;
    if (clip) {
      e.preventDefault();
      return acts.clip(clip);
    }
    if (w.control !== "person") {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      if (w.busy) return set((x) => ({ ...x, mid: { x: 0.2, y: 0.2 } }));
      acts.take();
      typeInto(e.key);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      return backspace();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      return set((x) => ({ ...x, focusField: x.focusField === "user" ? "pass" : x.focusField === "pass" ? "user" : x.focusField }));
    }
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      typeInto(e.key);
    }
  };
  // The review bar's "⌘V: pitkä teksti": the refusal and its own button.
  useEffect(() => {
    const run = () => {
      if (w.control !== "person") return;
      say(T.toast.long, {
        label: T.toast.longAction,
        run: () => {
          set((x) => ({ ...x, pasted: true }));
          say(T.toast.pasted(T.fakeLong.length));
        },
      });
    };
    window.addEventListener("kh-long-paste", run);
    return () => window.removeEventListener("kh-long-paste", run);
  });
  const open = (take: boolean) => {
    if (w.stopped) set(() => ({ ...worldAt("agent", many), busy: false, phase: "agent" }));
    else set((x) => ({ ...x, open: true }));
    setAppToast(undefined);
    if (take) acts.take();
    else setExpanded(w.control === "person");
  };
  const keys = <PhoneKeys on={keysOn} onText={typeInto} onPaste={() => acts.clip("paste")} onBackspace={backspace} />;
  const view = { w, set, acts, toast, onKey, keys, onWiden: () => setExpanded(true), keysOn };
  const showView = w.open && !w.stopped;
  const status = statusOf(w);
  const rowA: AgentNavModel = {
    agentId: "pi:a", title: T.convA, href: `/workspaces/${T.workspace}?conversation=a`,
    activity: w.request || w.control === "person" ? "waiting" : "working",
    activityLabel: w.request ? T.waits : T.working, attentionLabel: w.request ? T.waits : undefined,
    detail: w.request ? T.request : T.replyBack, controlLabel: "", workspaceId: "ws_kotitalous00", workspaceName: T.workspace,
    changedAt: Date.now() - 60_000, selected: true,
  };
  const rowB: AgentNavModel = {
    agentId: "pi:b", title: T.convB, href: `/workspaces/${T.otherWorkspace}?conversation=b`, activity: "waiting", activityLabel: "Valmis",
    detail: "Diat valmiina", controlLabel: "", workspaceId: "ws_yhdistys000", workspaceName: T.otherWorkspace, changedAt: Date.now() - 32 * 60_000, turnMark: "read",
  };
  const pages = (
    <>
      <div className="ah-rail-home-row">
        <LinkRow href="/shares" kind="home" className="ah-rail-home"><Icon name="globe" /><span className="ah-rail-home-label">Tuotokset</span></LinkRow>
      </div>
      <BrowserRailRow summary={summarize(status)} windows={status.windows.length} conversation={T.convA} onOpen={() => open(false)} />
    </>
  );
  const rail = (
    <WorkspaceRail collapsed={false} serverLabel="Habitat" connectionLabel="" connectionTone="success" filterValue="" resultSummary="2" listState="ready"
      onToggle={noop} onFilter={noop} onRefresh={noop} pages={pages}
      now={<NowSections yours={[rowA, rowB]} running={[]} />}
      sessionActions={<AccountShelf profile={{ name: "Aino Laine", email: "", avatar_url: "" }} onSettings={noop} onLogout={noop} />}>
      <WorkspaceNavRow name={T.workspace} href={`/workspaces/${T.workspace}`} selected />
      <WorkspaceNavRow name={T.otherWorkspace} href={`/workspaces/${T.otherWorkspace}`} />
    </WorkspaceRail>
  );
  const conversation = (
    <ConversationFrame>
      <AgentHeader title={T.convA} workspaceLabel={T.workspace} workspaceHref={`/workspaces/${T.workspace}`} activityLabel="" controlLabel="" detailsExpanded={false} onToggleDetails={noop} />
      <ConversationStream>
        <Thread w={w} onLook={() => open(false)} onTake={() => open(true)} onGiveBack={acts.giveKeep} />
      </ConversationStream>
      <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={noop} onSendNow={() => setDraft("")} onSteer={() => setDraft("")} onFollowUp={() => setDraft("")} idlePlaceholder="" />
    </ConversationFrame>
  );
  const panel = showView && !compare;
  const total = typeof window === "undefined" ? 1000 : window.innerWidth;
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={T.convA}
        navigationBadge={w.request ? 1 : 0}
        rail={rail}
        main={
          <div className="bp-main" id="main" data-testid="conversation">
            <ViewSplit open={panel} expanded={expanded} width={Math.round(total * 0.4)} min={420} max={total} panel={<PanelView {...view} />}
              onResize={noop} onReset={noop} onShowConversation={() => setExpanded(false)}>
              {conversation}
            </ViewSplit>
          </div>
        }
      />
      {showView && compare ? <Today w={w} set={set} acts={acts} onKey={onKey} /> : null}
      {appToast ? <p className="sb-toast kh-app-toast" role="status" data-testid="app-toast">{appToast}</p> : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const compare = direction === 1;
  const [theme, setTheme] = useState(reviewTheme);
  const [many, setMany] = useState(params.get("many") === "1");
  const [w, setW] = useState<World>(() => worldAt(firstPhase, params.get("many") === "1"));
  const [run, setRun] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    const set = () => document.documentElement.style.setProperty("--review-h", `${measuring || !el ? 0 : el.getBoundingClientRect().height}px`);
    set();
    if (!el) return;
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.measure = measuring ? "1" : undefined;
  }, [theme]);
  const restart = (next: World) => {
    setW(next);
    setRun((r) => r + 1);
  };
  return (
    <div className="ra-review" data-direction={direction}>
      <header className="ra-bar" ref={bar} hidden={measuring}>
        <div className="ra-controls">
          <strong>{T.title}</strong>
          <label>
            {T.theme}{" "}
            <select id="theme" value={theme} onChange={(e) => { reviewTheme = e.target.value as typeof reviewTheme; setTheme(reviewTheme); }}>
              <option value="light">{T.themes.light}</option>
              <option value="dark">{T.themes.dark}</option>
            </select>
          </label>
          <label><input type="checkbox" id="many" checked={many} onChange={(e) => { setMany(e.target.checked); restart(worldAt(w.phase, e.target.checked)); }} /> {T.many}</label>
          <button type="button" className="ra-event" data-testid="event-long-paste" onClick={() => window.dispatchEvent(new Event("kh-long-paste"))}>{T.longPaste}</button>
        </div>
        <div className="ra-stepper" role="group" aria-label="Tila" data-testid="stepper">
          {(Object.keys(T.phases) as Phase[]).map((p) => (
            <button key={p} type="button" className="ra-event ra-step" data-phase={p} aria-pressed={w.phase === p} onClick={() => restart(worldAt(p, many))}>
              {T.phases[p]}
            </button>
          ))}
          <output className="ra-size" data-testid="picture-size" />
        </div>
        <ol className="ra-lines" data-testid="direction-lines">
          {T.lines.map((l, i) => <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="ra-stage">
        <MemoryRouter initialEntries={[`/workspaces/${T.workspace}?conversation=a`]}>
          <Main key={`${direction}-${run}`} compare={compare} many={many} w={w} set={setW} />
        </MemoryRouter>
      </div>
    </div>
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
