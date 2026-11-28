import React, { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Menu, MenuTrigger, Popover, Separator } from "react-aria-components";
import { MemoryRouter } from "react-router";
import pickerSource from "../../lib/picker.js?raw";
import { initialTheme } from "../../lib/view-theme.js";
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

// server-browser-frame, round 4 (28.11.2026). Jari's decision after round 3:
// the picture shows the whole remote Chrome window with its own tab strip,
// address bar, back / reload, history and bookmarks, and Habitat's own bar
// has nothing about tabs (no tab list, no Sulje välilehti, no address field,
// history or bookmarks). No kiosk mode. Kept from rounds 1–3: Paneeli, who
// drives (border + chip), the agent's request line, the mid-step question, a
// click takes control, Valmis gives back + empties the remote clipboard +
// closes, closing while you drive gives back, ⋯ with Leikkaa / Kopioi /
// Liitä, the turn item, Sulje selain and the truth sentence, the phone's
// keyboard button, the fixed 1280 × 800 display.
//
// Chrome's window is drawn as measured on google-chrome under Xvfb with no
// window manager (as the host runs it): no caption buttons, tab strip 40 px,
// toolbar 47 px (page 1280 × 713), the bookmarks bar 34 px more when Chrome
// shows it; a feature popup opens over the whole display with only a 34 px
// read-only address strip and no close control. Every click on the drawn
// window is a click on the remote screen, so it takes control like any click.
// Production components: the shell, rail, Oma selain row, conversation,
// Selain card, ViewSplit, buttons, menus, the frame's border, mid-step
// question, toast styles and Nykyinen's sheet. The round's own: the slim bar,
// the drawn Chrome window and pages (fixed colours), the size readout.
// Synthetic.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const noop = () => {};
const directions = ["1 Koko ikkuna", "Nykyinen"];
const NATIVE = { w: 1280, h: 800 };
/** Measured on Chrome under Xvfb, no window manager. */
const CR = { tabs: 40, toolbar: 47, bookmarks: 34, popup: 34 };
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = (k: string) => (mac ? `⌘${k}` : `Ctrl+${k}`);

// ---------- Text (Finnish; production strings where they exist) ----------

const T = {
  title: "Palvelinselaimen kehys · kierros 4",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  lines: [
    "1 Koko ikkuna: selain oikeassa paneelissa. Kuvassa koko Chrome-ikkuna omine välilehtineen, osoiteriveineen ja kirjanmerkkeineen; Habitatin palkissa vain vuoro, ⋯ ja Valmis.",
    "Nykyinen: tuotannon arkki saman Chrome-ikkunan ympärillä.",
  ],
  phases: { agent: "Agentti työssä", ask: "Odottaa sinua", person: "Sinä ohjaat", popup: "Ponnahdusikkuna", back: "Annettu takaisin", stopped: "Selain suljettu" },
  many: "Monta välilehteä",
  bookmarksBar: "Kirjanmerkkipalkki",
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
  closeHint: "Sulje näkymä. Agentti jatkaa.",
  says: "Agentti",
  more: "Lisää",
  cut: "Leikkaa",
  copy: "Kopioi",
  paste: "Liitä",
  keys: "Näppäimistö",
  keysOn: "Kirjoitus menee sivulle",
  giveKeep: "Anna agentille ja jatka katsomista",
  takeHere: "Ota ohjaus",
  closePopup: "Sulje ponnahdusikkuna",
  stopBrowser: "Sulje selain",
  truth: "Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
  ownKeys: `${mod("T")}, ${mod("W")} ja ${mod("N")} jäävät omalle selaimellesi. Käytä kuvan +- ja ×-painikkeita.`,
  hintAgent: "Klikkaa tai kirjoita ottaaksesi ohjauksen",
  hintBusy: "Agentti toimii · klikkaa ottaaksesi ohjauksen",
  screen: "Palvelinselaimen näkymä",
  helpAgent: "Klikkaa sivua tai ala kirjoittaa, niin ohjaus siirtyy sinulle.",
  helpYou: `Agentti odottaa, kunnes annat selaimen takaisin. Käytä selainta kuten omaasi: välilehdet, osoiterivi ja kirjanmerkit ovat kuvassa. ${mod("C")}, ${mod("X")} ja ${mod("V")} toimivat kuten koneellasi.`,
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
    popupClosed: "Ponnahdusikkuna suljettu.",
    stopped: "Selain suljettu.",
    lastTab: "Selain sulkeutui, koska sen viimeinen välilehti suljettiin. Agentti avaa sen uudelleen, kun tarvitsee sitä.",
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
  newTab: "Uusi välilehti",
  searchHint: "Hae Googlella tai kirjoita URL-osoite",
};

// ---------- The synthetic browser ----------

type PageKey = "laskut" | "kirjaudu" | "kirjasto" | "sopimus" | "uusi" | "haku";
const PAGES: Record<PageKey, { title: string; origin: string; path: string }> = {
  laskut: { title: "Laskut – Energia Oy", origin: "energia.example", path: "/laskut" },
  kirjaudu: { title: "Kirjaudu – Tunnistus", origin: "tunnistus.example", path: "/kirjaudu" },
  kirjasto: { title: "Lainat – Kirjasto", origin: "kirjasto.example", path: "/lainat" },
  sopimus: { title: "Sähkösopimus – Energia Oy", origin: "energia.example", path: "/sopimus" },
  uusi: { title: T.newTab, origin: "", path: "" },
  haku: { title: "Google-haku", origin: "www.google.com", path: "/search" },
};
const POPUP = { title: "Vahvista kirjautuminen", origin: "tunnistus.example", path: "/vahvista" };
type Tab = { id: number; page: PageKey; back: PageKey[]; q?: string };
const titleOf = (t: Tab) => (t.page === "haku" ? `${t.q} – Google-haku` : PAGES[t.page].title);
const urlOf = (t: Tab) => (t.page === "uusi" ? "" : t.page === "haku" ? `https://www.google.com/search?q=${encodeURIComponent(t.q ?? "")}` : `https://${PAGES[t.page].origin}${PAGES[t.page].path}`);
/** Chrome shows the address without the scheme until you edit it. */
const shownUrl = (t: Tab) => urlOf(t).replace(/^https:\/\//, "");
const hexId = (n: number) => n.toString(16).toUpperCase().padStart(32, "0");
const POPUP_ID = 0x99;

type Phase = keyof typeof T.phases;
/** A click or key on the remote screen: Chrome's own controls or the page. */
type Remote = { op: string; arg?: string };
type World = {
  phase: Phase;
  control: "agent" | "person";
  busy: boolean;
  request?: string;
  tabs: Tab[];
  active: number;
  popup: boolean;
  omni?: string;
  omniSelected?: boolean;
  starred: PageKey[];
  reloads: number;
  open: boolean;
  waiting: boolean;
  mid?: { x: number; y: number };
  pending?: Remote;
  fields: Record<string, string>;
  focusField?: string;
  pasted: boolean;
  stopped: boolean;
};

const baseTabs = (many: boolean): Tab[] =>
  (many ? (["laskut", "kirjaudu", "kirjasto", "sopimus"] as PageKey[]) : (["laskut", "kirjaudu"] as PageKey[])).map((page, i) => ({ id: i + 1, page, back: page === "kirjaudu" ? ["laskut"] : [] }));
function worldAt(p: Phase, many: boolean): World {
  const w: World = { phase: p, control: "agent", busy: false, tabs: baseTabs(many), active: 2, popup: false, starred: ["laskut", "kirjasto"], reloads: 0, open: true, waiting: false, fields: {}, pasted: false, stopped: false };
  if (p === "agent") return { ...w, busy: true, active: 1 };
  if (p === "ask") return { ...w, request: T.request };
  if (p === "person") return { ...w, control: "person", request: T.request, focusField: "user" };
  if (p === "popup") return { ...w, control: "person", request: T.request, popup: true, fields: { user: "aino.laine", pass: "••••••••" }, focusField: "code" };
  if (p === "back") return { ...w, busy: true, open: false, active: 1 };
  return { ...w, open: false, stopped: true, tabs: [] };
}
const activeTab = (w: World) => w.tabs.find((t) => t.id === w.active) ?? w.tabs[0];

let reviewTheme = initialTheme(["light", "dark"]) as "light" | "dark";
const firstPhase = ((Object.keys(T.phases) as Phase[]).includes(params.get("state") as Phase) ? params.get("state") : "ask") as Phase;
const measuring = params.get("measure") === "1";

// ---------- The drawn third-party pages (fixed colours: not Habitat's) ----------

function Field({ id, label, w, secret }: { id: string; label: string; w: World; secret?: boolean }) {
  const value = w.fields[id] ?? "";
  const shown = secret ? "•".repeat(value.length) : value;
  const on = w.control === "person" && w.focusField === id && w.omni === undefined;
  return (
    <label className="fp-field">
      <span>{label}</span>
      <span className="fp-input" data-field={id} data-focus={on ? "" : undefined} data-cr="field" data-arg={id}>
        {shown}
        {on ? <i className="fp-caret" /> : null}
      </span>
    </label>
  );
}

function Page({ tab, w }: { tab: Tab; w: World }) {
  const p = tab.page;
  if (p === "laskut" || p === "sopimus")
    return (
      <div className="fp fp-energia">
        <header className="fp-head"><b>Energia Oy</b><nav>Etusivu · Laskut · Sopimus · Asiakaspalvelu</nav></header>
        <main className="fp-main">
          <h1>{p === "laskut" ? "Laskut 2026" : "Sähkösopimus"}</h1>
          {p === "laskut" ? (
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
  if (p === "kirjasto")
    return (
      <div className="fp fp-kirjasto">
        <header className="fp-head"><b>Kaupunginkirjasto</b><nav>Haku · Lainat · Varaukset</nav></header>
        <main className="fp-main"><h1>Lainat</h1><p>Kolme lainaa, eräpäivä 4.12.2026.</p></main>
      </div>
    );
  if (p === "uusi")
    return (
      <div className="fp fp-ntp">
        <b className="fp-ntp-logo">Google</b>
        <span className="fp-ntp-box">{T.searchHint}</span>
      </div>
    );
  if (p === "haku")
    return (
      <div className="fp fp-haku">
        <header className="fp-haku-head"><b>Google</b><span className="fp-ntp-box">{tab.q}</span></header>
        <main className="fp-main">
          <p className="fp-haku-row"><span className="fp-link">Sähkön hinta tänään – Pörssisähkö</span><small>porssisahko.example</small></p>
          <p className="fp-haku-row"><span className="fp-link">Sähkön hinta ja kulutus – Energia Oy</span><small>energia.example</small></p>
        </main>
      </div>
    );
  return (
    <div className="fp fp-tunnistus">
      <main className="fp-card">
        <h1>Kirjaudu palveluun</h1>
        <p>Energia Oy pyytää tunnistautumista.</p>
        <Field id="user" label="Käyttäjätunnus" w={w} />
        <Field id="pass" label="Salasana" w={w} secret />
        <span className="fp-button">Kirjaudu</span>
      </main>
    </div>
  );
}

// ---------- Chrome's own window, as measured ----------

/** The whole Chrome window: tab strip, toolbar, the bookmarks bar when
 * Chrome shows it. No caption buttons: there is no window manager. Each
 * control carries data-cr, read by the picture's pointer handler, since a
 * click here is a click on the remote screen. */
function ChromeWindow({ w, bookmarksBar }: { w: World; bookmarksBar: boolean }) {
  const t = activeTab(w);
  const editing = w.omni !== undefined;
  const starred = w.starred.includes(t.page);
  return (
    <div className="cr-window" data-testid="chrome-window" style={{ height: CR.tabs + CR.toolbar + (bookmarksBar ? CR.bookmarks : 0) }}>
      <div className="cr-tabs" style={{ height: CR.tabs }}>
        <span className="cr-btn cr-tabsearch" aria-hidden="true">⌄</span>
        {w.tabs.map((x) => (
          <span key={x.id} className="cr-tab" data-active={x.id === w.active || undefined} data-cr="tab" data-arg={x.id} data-testid="chrome-tab">
            <span className="kh-fav" data-site={PAGES[x.page].origin} />
            <span className="cr-tab-title">{titleOf(x)}</span>
            <span className="cr-tab-x" data-cr="tab-close" data-arg={x.id} data-testid="chrome-tab-close">×</span>
          </span>
        ))}
        <span className="cr-btn cr-plus" data-cr="new-tab" data-testid="chrome-new-tab">+</span>
      </div>
      <div className="cr-toolbar" style={{ height: CR.toolbar }}>
        <span className="cr-btn" data-cr="back" data-testid="chrome-back" data-off={t.back.length ? undefined : ""}>←</span>
        <span className="cr-btn" data-off="">→</span>
        <span className="cr-btn" data-cr="reload" data-testid="chrome-reload">↻</span>
        <span className="cr-omni" data-cr="omni" data-testid="chrome-omni" data-editing={editing || undefined}>
          {editing ? (
            <span className="cr-omni-text" data-testid="chrome-omni-text">
              <span data-selected={w.omniSelected || undefined}>{w.omni}</span><i className="fp-caret" />
            </span>
          ) : t.page === "uusi" ? (
            <span className="cr-omni-text cr-omni-hint">{T.searchHint}</span>
          ) : (
            <span className="cr-omni-text" data-testid="chrome-url">{shownUrl(t)}</span>
          )}
          {t.page === "uusi" ? null : <span className="cr-star" data-cr="star" data-testid="chrome-star" data-on={starred || undefined}>{starred ? "★" : "☆"}</span>}
        </span>
        <span className="cr-btn" aria-hidden="true">⋮</span>
      </div>
      {bookmarksBar ? (
        <div className="cr-bookmarks" style={{ height: CR.bookmarks }} data-testid="chrome-bookmarks">
          {w.starred.map((k) => (
            <span key={k} className="cr-bookmark" data-cr="bookmark" data-arg={k} data-testid="chrome-bookmark">
              <span className="kh-fav" data-site={PAGES[k].origin} />{PAGES[k].title.split(" – ")[0]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A feature popup with no window manager: Chrome opens it over the whole
 * display, with a read-only address strip and no close control (measured). */
function PopupWindow({ w }: { w: World }) {
  return (
    <div className="cr-popup" data-testid="chrome-popup">
      <div className="cr-popup-strip" style={{ height: CR.popup }}><span className="cr-lock" aria-hidden="true">ⓘ</span>{POPUP.origin}{POPUP.path}</div>
      <div className="fp fp-tunnistus fp-popup" style={{ top: CR.popup }}>
        <main className="fp-card">
          <h1>{POPUP.title}</h1>
          <p>Syötä tekstiviestinä saamasi koodi.</p>
          <Field id="code" label="Koodi" w={w} />
          <span className="fp-button" data-cr="popup-confirm" data-testid="popup-confirm">Vahvista</span>
        </main>
      </div>
    </div>
  );
}

type Setter = (f: (x: World) => World) => void;

/** The remote picture: the fixed 1280 × 800 display scaled to fit, as
 * noVNC's scaleViewport does today, Chrome's window in it. */
function Picture({ w, onRemote, onKey, onWiden, compare, keys, bookmarksBar }: {
  w: World; onRemote: (r: Remote, at: { x: number; y: number }) => void; onKey: (e: React.KeyboardEvent) => void; onWiden?: () => void; compare?: boolean; keys?: ReactNode; bookmarksBar: boolean;
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
  const head = w.popup ? CR.popup : CR.tabs + CR.toolbar + (bookmarksBar ? CR.bookmarks : 0);
  const page = Math.round((NATIVE.h - head) * s);
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
    const r = box.current!.getBoundingClientRect();
    const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-cr]");
    if (hit) e.preventDefault();
    onRemote(hit ? { op: hit.dataset.cr!, arg: hit.dataset.arg } : { op: "page" }, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };
  const tab = activeTab(w);
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
        <ChromeWindow w={w} bookmarksBar={bookmarksBar} />
        {tab ? (
          <div className="kh-page" style={{ top: CR.tabs + CR.toolbar + (bookmarksBar ? CR.bookmarks : 0) }} data-testid="browser-page" data-url={urlOf(tab)} data-reloads={w.reloads}>
            <Page tab={tab} w={w} />
          </div>
        ) : null}
        {w.popup ? <PopupWindow w={w} /> : null}
      </div>
      {keys}
    </div>
  );
}

// ---------- The slim bar and its pieces ----------

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

type Clip = "cut" | "copy" | "paste";
type Acts = {
  take: () => void;
  done: () => void;
  close: () => void;
  giveKeep: () => void;
  closePopup: () => void;
  stop: () => void;
  clip: (op: Clip) => void;
  keys: () => void;
  cancelWait: () => void;
};

/** ⋯: the turn, cut / copy / paste with their shortcuts, the popup when one
 * covers the picture (it has no close control of its own), the browser, and
 * the two sentences. */
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
            else if (key === "popup") acts.closePopup();
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
          {w.popup ? <ControlMenuItem id="popup" textValue={T.closePopup} data-testid="menu-close-popup"><Icon name="cross" /> {T.closePopup}</ControlMenuItem> : null}
          <ControlMenuItem id="stop" textValue={T.stopBrowser} danger data-testid="menu-stop"><Icon name="stop" /> {T.stopBrowser}</ControlMenuItem>
        </Menu>
        <p className="kh-truth" data-testid="browser-truth">{T.truth}</p>
        <p className="kh-truth kh-own-keys kh-desk-only" data-testid="browser-own-keys">{T.ownKeys}</p>
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
 * so the button focuses a hidden field whose characters go to the remote
 * screen as keystrokes, the same way a desktop keyboard does. */
function KeysButton({ w, acts, on }: { w: World; acts: Acts; on: boolean }) {
  if (w.control !== "person") return null;
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" className="kh-phone-only" data-testid="browser-keys" aria-pressed={on} aria-label={T.keys} title={T.keys} onPress={acts.keys}>
      <Icon name="key" />
    </ControlButton>
  );
}

/** The slim bar: what this is, who drives, ⋯, one end action. Nothing about tabs. */
function Bar({ w, acts, keysOn }: { w: World; acts: Acts; keysOn: boolean }) {
  return (
    <div className="kh-bar" data-testid="browser-bar">
      <span className="kh-bar-title" data-testid="browser-bar-title"><Icon name="browser" /><span>{T.ownBrowser}</span></span>
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
        <ControlButton size="row" variant="quiet" data-testid="browser-mid-cancel" onPress={() => set((x) => ({ ...x, mid: undefined, pending: undefined }))}>{T.cancel}</ControlButton>
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

/** At the picture's bottom edge: the top is Chrome's own tab strip now. It
 * gives way to a toast, which sits in the same place. */
function Hint({ w, toast }: { w: World; toast?: Toast }) {
  if (w.control === "person" || w.waiting || w.mid || toast) return null;
  return (
    <div className="sb-canvas-hint kh-hint" aria-hidden="true">
      <Icon name={w.busy ? "agent" : "user"} />
      <span>{w.busy ? T.hintBusy : T.hintAgent}</span>
    </div>
  );
}

/** The phone's keyboard: an invisible field over the picture's bottom edge.
 * Its input never stays in it; each character goes to the remote screen. */
function PhoneKeys({ on, onText, onPaste, onBackspace, onEnter }: { on: boolean; onText: (t: string) => void; onPaste: () => void; onBackspace: () => void; onEnter: () => void }) {
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
          if (e.key === "Enter") { e.preventDefault(); onEnter(); }
        }}
        onPaste={(e) => { e.preventDefault(); onPaste(); }}
        onChange={(e) => e.target.value && onText(e.target.value)}
      />
      <p className="kh-ime-note" data-testid="browser-ime-note"><Icon name="key" /> {T.keysOn}</p>
    </>
  );
}

// ---------- 1 Koko ikkuna and Nykyinen ----------

type ViewProps = { w: World; set: Setter; acts: Acts; toast?: Toast; onKey: (e: React.KeyboardEvent) => void; onRemote: (r: Remote, at: { x: number; y: number }) => void; keys: ReactNode; onWiden: () => void; bookmarksBar: boolean };

function Screen({ w, set, acts, toast, onKey, onRemote, keys, onWiden, bookmarksBar }: ViewProps) {
  return (
    <div className="sb-frame kh-frame" data-testid="browser-frame" data-control={w.control} data-waiting={w.waiting || undefined}>
      <div className="kh-screen" data-testid="browser-screen">
        <Picture w={w} onKey={onKey} onWiden={onWiden} onRemote={onRemote} keys={keys} bookmarksBar={bookmarksBar} />
        <Hint w={w} toast={toast} />
        <Mid w={w} acts={acts} set={set} />
        <Foot toast={toast} />
      </div>
    </div>
  );
}

/** 1 Koko ikkuna: the browser in production's right-hand panel. */
function PanelView(p: ViewProps & { keysOn: boolean }) {
  return (
    <section className="ah-view-pane kh-pane" aria-label={T.ownBrowser} data-testid="browser-view" data-direction="panel">
      <Bar w={p.w} acts={p.acts} keysOn={p.keysOn} />
      <Says w={p.w} />
      <Screen {...p} />
    </section>
  );
}

/** Nykyinen: production's sheet around the same Chrome window. */
function Today({ w, acts, onKey, onRemote, bookmarksBar }: Pick<ViewProps, "w" | "acts" | "onKey" | "onRemote" | "bookmarksBar">) {
  const status = statusOf(w);
  return (
    <BrowserSheet
      mode={w.control === "person" ? "control" : "view"}
      running
      windows={<BrowserWindows windows={status.windows} busy={false} onSelect={noop} onClose={noop} />}
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
        <Picture compare w={w} onKey={onKey} onRemote={onRemote} bookmarksBar={bookmarksBar} />
      </BrowserFrame>
    </BrowserSheet>
  );
}

function statusOf(w: World): BrowserStatus {
  const windows = w.tabs.map((t) => ({ id: hexId(t.id), title: titleOf(t), origin: PAGES[t.page].origin ? `https://${PAGES[t.page].origin}` : "", agent: t.page === "kirjaudu" }));
  if (w.popup) windows.push({ id: hexId(POPUP_ID), title: POPUP.title, origin: `https://${POPUP.origin}`, agent: false });
  return {
    schema_version: 1,
    state: w.stopped ? "stopped" : "running",
    survives_restart: true,
    control: w.control,
    agent_connected: true,
    windows,
    request: w.request && w.control === "agent" ? { window: hexId(2), text: w.request, age_ms: 30_000 } : undefined,
  };
}

/** What Chrome does with text typed in its address bar, for this synthetic world. */
function navigateTo(text: string): { page: PageKey; q?: string } {
  const s = text.trim().toLowerCase();
  const hit = (Object.keys(PAGES) as PageKey[]).find((k) => PAGES[k].origin && k !== "haku" && s.includes(PAGES[k].origin.split(".")[0]));
  return hit ? { page: hit } : { page: "haku", q: text.trim() };
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
            agentWindow={PAGES.kirjaudu.title}
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

function Main({ compare, many, bookmarksBar, w, set }: { compare: boolean; many: boolean; bookmarksBar: boolean; w: World; set: Setter }) {
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
      set((x) => run({ ...x, waiting: false, busy: false, control: "person" }, x.pending));
      say(T.toast.tookAfter);
    }, 1500);
    return () => clearTimeout(id);
  }, [w.waiting]);
  useEffect(() => {
    if (w.control !== "person" || !w.open) setKeysOn(false);
  }, [w.control, w.open]);
  // ⌘W cannot reach the remote page: the local browser closes its own tab
  // first. While you drive, Habitat asks the browser to confirm leaving, so
  // ⌘W asks instead of closing Habitat mid-task.
  useEffect(() => {
    if (w.control !== "person" || !w.open) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [w.control, w.open]);
  const focusPicture = () => requestAnimationFrame(() => document.querySelector<HTMLElement>(".kh-picture")?.focus({ preventScroll: true }));

  /** One click or key on Chrome's window or the page, as the remote Chrome does it. */
  function run(x: World, r?: Remote): World {
    const y = { ...x, pending: undefined };
    if (!r) return y;
    const t = activeTab(y);
    const setTab = (f: (t: Tab) => Tab) => ({ ...y, tabs: y.tabs.map((z) => (z.id === y.active ? f(z) : z)) });
    const go = (to: { page: PageKey; q?: string }) => ({ ...setTab((z) => ({ ...z, page: to.page, q: to.q, back: z.page === "uusi" ? z.back : [...z.back, z.page] })), omni: undefined, focusField: to.page === "kirjaudu" ? "user" : undefined });
    if (y.popup && r.op !== "popup-confirm" && r.op !== "field") return y; // the popup covers the window
    switch (r.op) {
      case "tab": {
        const id = Number(r.arg);
        const page = y.tabs.find((z) => z.id === id)?.page;
        return { ...y, active: id, omni: page === "uusi" ? "" : undefined, focusField: page === "kirjaudu" ? "user" : undefined };
      }
      case "tab-close": {
        const id = Number(r.arg);
        const tabs = y.tabs.filter((z) => z.id !== id);
        if (!tabs.length) return { ...worldAt("stopped", many), phase: "stopped" };
        const i = y.tabs.findIndex((z) => z.id === id);
        return { ...y, tabs, active: y.active === id ? tabs[Math.min(i, tabs.length - 1)].id : y.active, omni: undefined };
      }
      case "new-tab": {
        const id = Math.max(...y.tabs.map((z) => z.id)) + 1;
        return { ...y, tabs: [...y.tabs, { id, page: "uusi", back: [] }], active: id, omni: "", omniSelected: false, focusField: undefined };
      }
      case "back":
        if (!t.back.length) return y;
        return { ...setTab((z) => ({ ...z, page: z.back[z.back.length - 1], back: z.back.slice(0, -1) })), omni: undefined, focusField: t.back[t.back.length - 1] === "kirjaudu" ? "user" : undefined };
      case "reload":
        return { ...y, reloads: y.reloads + 1, omni: undefined };
      case "omni":
        return y.omni !== undefined ? y : { ...y, omni: urlOf(t), omniSelected: true };
      case "omni-go":
        return y.omni ? go(navigateTo(y.omni)) : { ...y, omni: undefined };
      case "star":
        return { ...y, starred: y.starred.includes(t.page) ? y.starred.filter((k) => k !== t.page) : [...y.starred, t.page] };
      case "bookmark":
        return go({ page: r.arg as PageKey });
      case "field":
        return { ...y, focusField: r.arg, omni: undefined };
      case "popup-confirm":
        return { ...y, popup: false, focusField: undefined };
      case "page":
        return { ...y, omni: undefined, focusField: y.focusField ?? (y.popup ? "code" : t.page === "kirjaudu" ? "user" : undefined) };
    }
    return y;
  }

  const acts: Acts = {
    take: () => {
      set((x) => run({ ...x, control: "person", busy: false, mid: undefined, waiting: false, focusField: x.focusField ?? (x.popup ? "code" : activeTab(x)?.page === "kirjaudu" ? "user" : undefined) }, x.pending));
      setExpanded(true);
      say(T.toast.took);
      focusPicture();
    },
    // Valmis: give back, empty the remote clipboard, close the view.
    done: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, open: false, mid: undefined, focusField: undefined, omni: undefined, phase: "back", pasted: false }));
      setAppToast(w.pasted ? T.toast.backCleared : T.toast.back);
      setToast(undefined);
    },
    close: () => {
      if (w.control === "person") return acts.done();
      set((x) => ({ ...x, open: false, mid: undefined, waiting: false }));
    },
    giveKeep: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, focusField: undefined, omni: undefined, phase: "agent", pasted: false }));
      say(w.pasted ? T.toast.backCleared : T.toast.back);
    },
    // The popup has no close control in the picture; the host closes that
    // window with the request it already has for closing a window.
    closePopup: () => {
      set((x) => ({ ...x, popup: false, focusField: undefined }));
      say(T.toast.popupClosed);
      focusPicture();
    },
    stop: () => {
      if (!window.confirm(T.confirmStop)) return;
      set(() => ({ ...worldAt("stopped", many), phase: "stopped" }));
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
    cancelWait: () => set((x) => ({ ...x, waiting: false, pending: undefined })),
  };

  /** A click on the remote screen: it takes control when the agent waits,
   * asks first mid-step (the click runs after Ota ohjaus nyt), and is ignored
   * while you are waiting for the agent's step to end. */
  const onRemote = (r: Remote, at: { x: number; y: number }) => {
    if (w.waiting || w.mid) return;
    if (w.control === "person") return set((x) => run(x, r));
    if (w.busy) return set((x) => ({ ...x, mid: at, pending: r }));
    set((x) => ({ ...x, pending: r }));
    acts.take();
  };
  const typeInto = (text: string) =>
    set((x) => (x.omni !== undefined ? { ...x, omni: (x.omniSelected ? "" : x.omni) + text, omniSelected: false } : x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "") + text } } : x));
  const backspace = () =>
    set((x) => (x.omni !== undefined ? { ...x, omni: x.omniSelected ? "" : x.omni.slice(0, -1), omniSelected: false } : x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "").slice(0, -1) } } : x));
  const enter = () => set((x) => (x.omni !== undefined ? run(x, { op: "omni-go" }) : x));
  const pasteText = () => (w.focusField === "pass" ? "kesä-2026-Sähkö" : w.focusField === "code" ? "482913" : "aino.laine");
  // The prototype never touches the real clipboard: invented text only.
  const runClip = (op: Clip) => {
    if (op === "paste") {
      const text = pasteText();
      typeInto(text);
      return say(T.toast.typed(text.length));
    }
    const field = w.focusField && w.focusField !== "pass" ? w.focusField : undefined;
    const text = field ? (w.fields[field] ?? "") : activeTab(w)?.page === "laskut" ? "Lokakuu 2026 48,20 €" : "";
    if (!text) return say(T.toast.nothing);
    if (op === "cut" && field) set((x) => ({ ...x, fields: { ...x.fields, [field]: "" } }));
    say(op === "cut" ? T.toast.cutDone(text.length) : T.toast.copied(text.length));
  };
  const onKey = (e: React.KeyboardEvent) => {
    // The picture's keys never reach the review picker.
    e.stopPropagation();
    const k = e.key.toLowerCase();
    const cmd = e.metaKey || e.ctrlKey;
    const clip: Clip | undefined = cmd ? (k === "x" ? "cut" : k === "c" ? "copy" : k === "v" ? "paste" : undefined) : undefined;
    if (w.mid || w.waiting) return;
    if (clip) {
      e.preventDefault();
      return acts.clip(clip);
    }
    // ⌘L / Ctrl+L, ⌘R / Ctrl+R and Alt+← reach the page when it asks for
    // them, so they go to the remote Chrome like any key (to verify in the lab).
    const remote: Remote | undefined = cmd && k === "l" ? { op: "omni" } : cmd && k === "r" ? { op: "reload" } : e.altKey && e.key === "ArrowLeft" ? { op: "back" } : undefined;
    if (remote) {
      e.preventDefault();
      return onRemote(remote, { x: 0.2, y: 0.2 });
    }
    if (w.control !== "person") {
      if (cmd || e.altKey || e.key.length !== 1) return;
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
    if (e.key === "Enter") {
      e.preventDefault();
      return enter();
    }
    if (e.key === "Escape" && w.omni !== undefined) {
      e.preventDefault();
      return set((x) => ({ ...x, omni: undefined }));
    }
    if (e.key === "Tab") {
      e.preventDefault();
      return set((x) => ({ ...x, focusField: x.focusField === "user" ? "pass" : x.focusField === "pass" ? "user" : x.focusField }));
    }
    if (e.key.length === 1 && !cmd) {
      e.preventDefault();
      typeInto(e.key);
    }
  };
  // The review bar's "⌘V: pitkä teksti": the refusal and its own button.
  useEffect(() => {
    const go = () => {
      if (w.control !== "person") return;
      say(T.toast.long, {
        label: T.toast.longAction,
        run: () => {
          set((x) => ({ ...x, pasted: true }));
          say(T.toast.pasted(T.fakeLong.length));
        },
      });
    };
    window.addEventListener("kh-long-paste", go);
    return () => window.removeEventListener("kh-long-paste", go);
  });
  // Closing the last tab in the picture closes Chrome: say so in the app.
  const prevTabs = useRef(w.tabs.length);
  useEffect(() => {
    if (prevTabs.current > 0 && w.tabs.length === 0 && w.phase === "stopped" && !appToast) setAppToast(T.toast.lastTab);
    prevTabs.current = w.tabs.length;
  }, [w.tabs.length]);
  const open = (take: boolean) => {
    if (w.stopped) set(() => ({ ...worldAt("agent", many), busy: false, phase: "agent" }));
    else set((x) => ({ ...x, open: true }));
    setAppToast(undefined);
    if (take) acts.take();
    else setExpanded(w.control === "person");
  };
  const keys = <PhoneKeys on={keysOn} onText={typeInto} onPaste={() => acts.clip("paste")} onBackspace={backspace} onEnter={enter} />;
  const view = { w, set, acts, toast, onKey, onRemote, keys, onWiden: () => setExpanded(true), keysOn, bookmarksBar };
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
      {showView && compare ? <Today w={w} acts={acts} onKey={onKey} onRemote={onRemote} bookmarksBar={bookmarksBar} /> : null}
      {appToast ? <p className="sb-toast kh-app-toast" role="status" data-testid="app-toast">{appToast}</p> : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const compare = direction === 1;
  const [theme, setTheme] = useState(reviewTheme);
  const [many, setMany] = useState(params.get("many") === "1");
  const [bookmarksBar, setBookmarksBar] = useState(params.get("bookmarks") === "1");
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
          <label><input type="checkbox" id="bookmarks-bar" checked={bookmarksBar} onChange={(e) => setBookmarksBar(e.target.checked)} /> {T.bookmarksBar}</label>
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
          <Main key={`${direction}-${run}`} compare={compare} many={many} bookmarksBar={bookmarksBar} w={w} set={setW} />
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
