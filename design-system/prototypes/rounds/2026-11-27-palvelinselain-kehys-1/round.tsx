import React, { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Dialog as AriaDialog, Heading, Menu, MenuTrigger, Modal, ModalOverlay, Popover, Separator } from "react-aria-components";
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

// server-browser-frame, round 1 (27.11.2026). Jari: the frame around the
// server browser's picture is too heavy (take control, Valmis and Close
// browser are separate steps, closing the current tab is missing), the
// Leikepöytä menu is extra since ⌘/Ctrl+V already types the text, and the
// picture is small. The lighter frame is the same in every direction:
//   - no Take control button: a click or a key on the picture takes control,
//     as production already does;
//   - one end action: Valmis gives control back, empties the remote
//     clipboard and closes the view; × only closes while the agent drives;
//   - real tabs with × (a popup window is a tab marked as one);
//   - no Leikepöytä: ⌘/Ctrl+V types; the rare cases live in ⋯ and in the
//     refusal's own toast button; Close browser moves into ⋯.
// The axis is where the browser lives and how its controls sit on it:
//   1 Paneeli     — production's right-hand panel (ViewSplit), slim bar,
//                   wide while you drive, the conversation one press away;
//   2 Ikkuna      — a full-window view with the same slim bar;
//   3 Pilleri     — the picture fills the window, controls float in a pill.
// "Vertaa nykyiseen" draws production's sheet (BrowserSheet, BrowserFrame,
// BrowserWindows) around the same page, so the picture sizes compare.
// Production components: the shell, rail, Oma selain row, conversation,
// Selain card, ViewSplit, buttons, menus, the frame's border, mid-step
// question and toast styles. The round's own: the slim bar, the pill, tab
// strip, the drawn third-party pages and the size readout. Synthetic.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const noop = () => {};
const directions = ["1 Paneeli", "2 Ikkuna", "3 Pilleri"];
const NATIVE = { w: 1280, h: 800 };

// ---------- Text (Finnish; production strings where they exist) ----------

const T = {
  title: "Palvelinselaimen kehys · kierros 1",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  lines: [
    "1 Paneeli: selain sovelluksen oikeassa paneelissa, ohut palkki. Kun ohjaat, paneeli on leveä; keskustelu on yhden painalluksen päässä.",
    "2 Ikkuna: selain täyttää ikkunan, sama ohut palkki.",
    "3 Pilleri: kuva täyttää ikkunan, ohjaimet kelluvat pillerissä kuvan päällä.",
  ],
  recommend: "Suositus: 2 Ikkuna. Suurin kuva ilman mitään sivun päällä; palkki ja käytös ovat samat kuin 1:ssä.",
  phases: { agent: "Agentti työssä", ask: "Odottaa sinua", person: "Sinä ohjaat", popup: "Ponnahdusikkuna", back: "Annettu takaisin", stopped: "Selain suljettu" },
  many: "Monta välilehteä",
  follow: "Näyttö seuraa kokoa",
  followNote: "(vaatii host-muutoksen)",
  compare: "Vertaa nykyiseen",
  longPaste: "⌘V: pitkä teksti",
  size: (w: number, h: number, pct: number, follow: boolean) =>
    follow ? `Kuva ${w} × ${h} px · sivu piirtyy tähän kokoon (100 %)` : `Kuva ${w} × ${h} px · ${pct} % alkuperäisestä 1280 × 800`,
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
  closeThisTab: "Sulje tämä välilehti",
  popupMark: "ponnahdus",
  agentTab: "agentti tässä",
  pasteLong: "Liitä pitkä teksti…",
  typeText: "Kirjoita sivulle…",
  copySel: "Kopioi valinta koneellesi",
  giveKeep: "Anna agentille ja jatka katsomista",
  takeHere: "Ota ohjaus",
  stopBrowser: "Sulje selain",
  expand: "Leveäksi",
  restore: "Keskustelun viereen",
  truth: "Agentti saa käyttää kaikkea, mihin tämä selain on kirjautunut, sinun nimissäsi.",
  hintAgent: "Klikkaa tai kirjoita ottaaksesi ohjauksen",
  hintBusy: "Agentti toimii · klikkaa ottaaksesi ohjauksen",
  screen: "Palvelinselaimen näkymä",
  helpAgent: "Klikkaa sivua tai ala kirjoittaa, niin ohjaus siirtyy sinulle.",
  helpYou: "Agentti odottaa, kunnes annat selaimen takaisin. Klikkaa ja kirjoita sivulla kuten omassa selaimessasi. ⌘/Ctrl+V kirjoittaa leikepöydän tekstin.",
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
    pasted: (n: number) => `Liitetty sivulle etäkoneen leikepöydän kautta · ${n} merkkiä`,
    long: "Tekstissä on rivinvaihtoja tai yli 1 000 merkkiä, joten sitä ei kirjoitettu. Mitään ei lähetetty.",
    longAction: "Liitä leikepöydän kautta",
    copied: "Kopioitu etäsivulta koneellesi.",
    tabClosed: (t: string) => `Välilehti suljettu: ${t}`,
    lastTab: "Viimeistä välilehteä ei suljeta. Sulje selain ⋯-valikosta.",
    popup: "Sivusto avasi ponnahdusikkunan. Se on oma välilehtensä; × sulkee sen.",
    stopped: "Selain suljettu.",
  },
  dialog: {
    pasteTitle: "Liitä pitkä teksti",
    typeTitle: "Kirjoita sivulle",
    label: "Teksti sivulle",
    note: "Liittäminen käy etäkoneen leikepöydän kautta, ja se tyhjennetään, kun annat ohjauksen takaisin. Teksti menee sivulle eikä ole agentilta piilossa.",
    typeNote: "Näppäilyt eivät käy leikepöydän kautta. Teksti menee sivulle eikä ole agentilta piilossa.",
    send: "Liitä sivulle",
    sendKeys: "Kirjoita näppäilyinä",
    show: "Näytä teksti",
    hide: "Piilota teksti",
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
  // A feature popup: without a window manager it lies at the screen's
  // top-left, over the opener, with no frame or close button of its own.
  return (
    <div className="fp-popup-stage">
      {login}
      <div className="fp fp-popup">
        <main className="fp-card">
          <h1>Vahvista kirjautuminen</h1>
          <p>Syötä tekstiviestinä saamasi koodi.</p>
          <Field id="code" label="Koodi" w={w} set={set} control={control} />
          <span className="fp-button">Vahvista</span>
        </main>
      </div>
    </div>
  );
}

type Setter = (f: (x: World) => World) => void;

/** The remote picture. Fixed 1280 × 800 scaled to fit, as noVNC's
 * scaleViewport does today; with "follow" on and the person driving, the
 * page is drawn at the container's own size, as if the display followed. */
function Picture({ w, set, follow, onTake, onMid, onKey, compare }: {
  w: World; set: Setter; follow: boolean; onTake: () => void; onMid: (at: { x: number; y: number }) => void; onKey: (e: React.KeyboardEvent) => void; compare?: boolean;
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
  const fitting = follow && w.control === "person";
  const s = size.w && size.h ? Math.min(size.w / NATIVE.w, size.h / NATIVE.h) : 0;
  const shown = fitting ? size : { w: Math.round(NATIVE.w * s), h: Math.round(NATIVE.h * s) };
  useLayoutEffect(() => {
    const out = document.querySelector<HTMLElement>("[data-testid='picture-size']");
    if (!out || !shown.w) return;
    out.textContent = T.size(shown.w, shown.h, Math.round(s * 100), fitting);
    out.dataset.width = String(shown.w);
    out.dataset.height = String(shown.h);
    out.dataset.scale = fitting ? "1" : s.toFixed(3);
  });
  const down = (e: React.PointerEvent) => {
    box.current?.focus({ preventScroll: true });
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
      data-fit={fitting ? "follow" : "scale"}
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
        style={
          fitting
            ? { width: size.w, height: size.h }
            : ({ width: NATIVE.w, height: NATIVE.h, transform: `translate(-50%, -50%) scale(${s})`, left: "50%", top: "50%" } as CSSProperties)
        }
        data-fit={fitting ? "follow" : "scale"}
      >
        <Page tab={w.active} w={w} set={set} />
      </div>
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
  pasteLong: () => void;
  typeText: () => void;
  copySel: () => void;
  cancelWait: () => void;
};

/** Tabs as tabs: the one in front is marked and its × is always there. */
function TabStrip({ w, acts }: { w: World; acts: Acts }) {
  return (
    <div className="kh-tabs" role="tablist" aria-label={T.tabsLabel} data-testid="browser-tabs">
      {w.tabs.map((k) => {
        const t = TABS[k];
        const on = w.active === k;
        return (
          <div className="kh-tab" key={k} data-tab={k} data-active={on || undefined} data-popup={t.popup || undefined}>
            <button type="button" role="tab" aria-selected={on} title={t.title} data-testid="browser-tab" onClick={() => acts.select(k)}>
              {t.popup ? <Icon name="external" /> : <span className="kh-fav" data-site={t.origin} aria-hidden="true" />}
              <span className="kh-tab-title">{t.title}</span>
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

/** On a phone, and in the pill: the tab in front as a button whose menu
 * lists the tabs. */
function TabMenu({ w, acts, compact }: { w: World; acts: Acts; compact?: boolean }) {
  const t = TABS[w.active];
  return (
    <MenuTrigger>
      <ControlButton size="inline" variant="quiet" className="kh-tabmenu" data-testid="browser-tab-menu" aria-label={`${T.tabsLabel}: ${t.title}, ${T.tabs(w.tabs.length)}`}>
        <span className="kh-tabcount" aria-hidden="true">{w.tabs.length}</span>
        {compact ? null : <span className="kh-tab-title">{t.title}</span>}
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
              <span className="kh-tab-title">{TABS[k].title}</span>
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

/** ⋯: the rare things, and the sentence the old frame kept on screen. */
function More({ w, acts }: { w: World; acts: Acts }) {
  const mine = w.control === "person";
  return (
    <MenuTrigger>
      <ControlButton size="row" variant="quiet" presentation="icon" data-testid="browser-more" aria-label={T.more} title={T.more}>
        <Icon name="more" />
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover kh-menu kh-more">
        <Menu
          aria-label={T.more}
          disabledKeys={mine ? [] : ["paste", "type", "copy", "keep"]}
          onAction={(key) => {
            if (key === "paste") acts.pasteLong();
            else if (key === "type") acts.typeText();
            else if (key === "copy") acts.copySel();
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
          <ControlMenuItem id="paste" textValue={T.pasteLong} data-testid="menu-paste"><Icon name="copy" /> {T.pasteLong}</ControlMenuItem>
          <ControlMenuItem id="type" textValue={T.typeText} data-testid="menu-type"><Icon name="key" /> {T.typeText}</ControlMenuItem>
          <ControlMenuItem id="copy" textValue={T.copySel} data-testid="menu-copy"><Icon name="download" /> {T.copySel}</ControlMenuItem>
          <ControlMenuItem id="tab" textValue={T.closeThisTab} data-testid="menu-close-tab"><Icon name="cross" /> {T.closeThisTab}</ControlMenuItem>
          <Separator className="kh-sep" />
          <ControlMenuItem id="stop" textValue={T.stopBrowser} danger data-testid="menu-stop"><Icon name="stop" /> {T.stopBrowser}</ControlMenuItem>
        </Menu>
        <p className="kh-truth" data-testid="browser-truth">{T.truth}</p>
      </Popover>
    </MenuTrigger>
  );
}

/** The one end action: Valmis while you drive, × while the agent does. */
function EndAction({ w, acts, iconOnly }: { w: World; acts: Acts; iconOnly?: boolean }) {
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
        <span className={iconOnly ? "kh-label" : undefined}>{T.done}</span>
      </ControlButton>
    );
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" data-testid="browser-close" aria-label={T.closeHint} title={T.closeHint} onPress={acts.close}>
      <Icon name="cross" />
    </ControlButton>
  );
}

/** The phone's keyboard button: the picture cannot raise the keyboard. */
function KeysButton({ w, acts }: { w: World; acts: Acts }) {
  if (w.control !== "person") return null;
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" className="kh-phone-only" data-testid="browser-keys" aria-label={T.typeText} title={T.typeText} onPress={acts.typeText}>
      <Icon name="key" />
    </ControlButton>
  );
}

/** The slim bar of directions 1 and 2: tabs, who drives, one end action, ⋯. */
function Bar({ w, acts, expand }: { w: World; acts: Acts; expand?: { on: boolean; toggle: () => void } }) {
  return (
    <div className="kh-bar" data-testid="browser-bar">
      <span className="kh-desk-only kh-tabs-wrap"><TabStrip w={w} acts={acts} /></span>
      <span className="kh-phone-only"><TabMenu w={w} acts={acts} /></span>
      <span className="kh-bar-end">
        <Turn w={w} />
        <KeysButton w={w} acts={acts} />
        {expand ? (
          <ControlButton size="row" variant="quiet" presentation="icon" className="kh-desk-only" data-testid="expand-view" aria-pressed={expand.on} aria-label={expand.on ? T.restore : T.expand} title={expand.on ? T.restore : T.expand} onPress={expand.toggle}>
            <Icon name={expand.on ? "forward" : "back"} />
          </ControlButton>
        ) : null}
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

/** Long paste through the remote clipboard, or the phone's text field. */
function TextDialog({ kind, onClose, onSend }: { kind: "paste" | "type"; onClose: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const [hidden, setHidden] = useState(true);
  return (
    <ModalOverlay className="ah-overlay kh-dialog-overlay" isDismissable isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal className="ah-modal kh-dialog">
        <AriaDialog aria-label={kind === "paste" ? T.dialog.pasteTitle : T.dialog.typeTitle} data-testid="browser-text-dialog" data-kind={kind}>
          <Heading slot="title">{kind === "paste" ? T.dialog.pasteTitle : T.dialog.typeTitle}</Heading>
          <div className="sb-paste">
            <label htmlFor="kh-text">{T.dialog.label}</label>
            <div className="sb-secret-field">
              <textarea id="kh-text" data-testid="browser-text" rows={kind === "paste" ? 4 : 2} className={hidden ? "sb-masked" : undefined} autoComplete="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
              <ControlButton size="row" variant="quiet" data-testid="browser-text-eye" aria-label={hidden ? T.dialog.show : T.dialog.hide} aria-pressed={!hidden} onPress={() => setHidden((h) => !h)}>
                <Icon name={hidden ? "eye" : "eyeOff"} />
              </ControlButton>
            </div>
            <small>{kind === "paste" ? T.dialog.note : T.dialog.typeNote}</small>
          </div>
          <div className="sb-actions kh-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>{T.cancel}</ControlButton>
            <ControlButton size="row" variant="primary" data-testid="browser-text-send" isDisabled={!text} onPress={() => onSend(text)}>
              {kind === "paste" ? T.dialog.send : T.dialog.sendKeys}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

// ---------- The three directions ----------

type ViewProps = { d: number; w: World; set: Setter; acts: Acts; follow: boolean; toast?: Toast; onKey: (e: React.KeyboardEvent) => void };

function Screen({ w, set, acts, follow, toast, onKey }: Omit<ViewProps, "d">) {
  return (
    <div className="sb-frame kh-frame" data-testid="browser-frame" data-control={w.control} data-waiting={w.waiting || undefined}>
      <div className="kh-screen" data-testid="browser-screen">
        <Picture w={w} set={set} follow={follow} onKey={onKey} onTake={() => acts.take()} onMid={(at) => set((x) => ({ ...x, mid: at }))} />
        <Hint w={w} />
        <Mid w={w} acts={acts} set={set} />
        <Foot toast={toast} />
      </div>
    </div>
  );
}

/** 1 Paneeli: the browser in production's right-hand panel. */
function PanelView(p: ViewProps & { expanded: boolean; setExpanded: (v: boolean) => void }) {
  return (
    <section className="ah-view-pane kh-pane" aria-label={T.ownBrowser} data-testid="browser-view" data-direction="panel">
      <Bar w={p.w} acts={p.acts} expand={{ on: p.expanded, toggle: () => p.setExpanded(!p.expanded) }} />
      <Says w={p.w} />
      <Screen {...p} />
    </section>
  );
}

/** The full-window layer. Production would make it modal; here it stays
 * non-modal so the review bar above it keeps working. Escape closes it only
 * while the agent drives: while you drive, Escape belongs to the page. */
function FullLayer({ w, acts, children }: { w: World; acts: Acts; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape from the view's own controls closes it.
    <div
      className="ah-overlay kh-full-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && w.control !== "person" && !e.defaultPrevented) acts.close();
      }}
    >
      <div className="kh-full">{children}</div>
    </div>
  );
}

/** 2 Ikkuna: the same bar over a full-window view. */
function FullView(p: ViewProps) {
  return (
    <FullLayer acts={p.acts} w={p.w}>
        <section role="dialog" className="kh-full-dialog" aria-label={T.ownBrowser} data-testid="browser-view" data-direction="full">
          <Bar w={p.w} acts={p.acts} />
          <Says w={p.w} />
          <Screen {...p} />
        </section>
    </FullLayer>
  );
}

/** 3 Pilleri: the picture fills the window, the controls float over it. */
function PillView(p: ViewProps) {
  const [low, setLow] = useState(false);
  return (
    <FullLayer acts={p.acts} w={p.w}>
        <section role="dialog" className="kh-full-dialog kh-pill-dialog" aria-label={T.ownBrowser} data-testid="browser-view" data-direction="pill" data-low={low || undefined}>
          <div className="sb-frame kh-frame" data-testid="browser-frame" data-control={p.w.control} data-waiting={p.w.waiting || undefined}>
            <div className="kh-screen" data-testid="browser-screen">
              <Picture w={p.w} set={p.set} follow={p.follow} onKey={p.onKey} onTake={() => p.acts.take()} onMid={(at) => p.set((x) => ({ ...x, mid: at }))} />
              <div className="kh-pill-wrap">
                <div className="kh-pill" data-testid="browser-bar" data-control={p.w.control}>
                  <ControlButton size="inline" variant="quiet" presentation="icon" className="kh-pill-move" data-testid="pill-move" aria-label={low ? "Siirrä ylös" : "Siirrä alas"} title={low ? "Siirrä ylös" : "Siirrä alas"} onPress={() => setLow((v) => !v)}>
                    <Icon name={low ? "top" : "bottom"} />
                  </ControlButton>
                  <TabMenu w={p.w} acts={p.acts} compact />
                  <Turn w={p.w} />
                  <KeysButton w={p.w} acts={p.acts} />
                  <More w={p.w} acts={p.acts} />
                  <EndAction w={p.w} acts={p.acts} iconOnly />
                </div>
                <Says w={p.w} />
              </div>
              <Mid w={p.w} acts={p.acts} set={p.set} />
              <Foot toast={p.toast} />
            </div>
          </div>
        </section>
    </FullLayer>
  );
}

/** Vertaa nykyiseen: production's sheet around the same page. */
function Today({ w, set, acts, follow, onKey }: Omit<ViewProps, "d" | "toast">) {
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
        <Picture compare w={w} set={set} follow={follow} onKey={onKey} onTake={() => acts.take()} onMid={(at) => set((x) => ({ ...x, mid: at }))} />
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

function Main({ d, compare, follow, many, w, set }: { d: number; compare: boolean; follow: boolean; many: boolean; w: World; set: Setter }) {
  const [expanded, setExpanded] = useState(true);
  const [toast, setToast] = useState<Toast>();
  const [appToast, setAppToast] = useState<string | undefined>(w.phase === "back" ? T.toast.backCleared : undefined);
  const [dialog, setDialog] = useState<"paste" | "type">();
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
    pasteLong: () => setDialog("paste"),
    typeText: () => setDialog("type"),
    copySel: () => say(T.toast.copied),
    cancelWait: () => set((x) => ({ ...x, waiting: false })),
  };
  const typeInto = (text: string) =>
    set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "") + text } } : x));
  const pasteText = () => (w.focusField === "pass" ? "kesä-2026-Sähkö" : w.focusField === "code" ? "482913" : "aino.laine");
  const onKey = (e: React.KeyboardEvent) => {
    // The picture's keys never reach the review picker.
    e.stopPropagation();
    const paste = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v";
    if (w.mid || w.waiting) return;
    if (w.control !== "person") {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.key.length !== 1 && !paste)) return;
      e.preventDefault();
      if (w.busy) return set((x) => ({ ...x, mid: { x: 0.2, y: 0.2 } }));
      acts.take();
      if (!paste) typeInto(e.key);
      return;
    }
    if (paste) {
      e.preventDefault();
      // The prototype never reads the real clipboard: invented text only.
      const text = pasteText();
      typeInto(text);
      return say(T.toast.typed(text.length));
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      return set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "").slice(0, -1) } } : x));
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
  const view = { d, w, set, acts, follow, toast, onKey };
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
  const panel = d === 0 && showView && !compare;
  const total = typeof window === "undefined" ? 1000 : window.innerWidth;
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={T.convA}
        navigationBadge={w.request ? 1 : 0}
        rail={rail}
        main={
          <div className="bp-main" id="main" data-testid="conversation">
            <ViewSplit open={panel} expanded={expanded} width={Math.round(total * 0.4)} min={420} max={total} panel={<PanelView {...view} expanded={expanded} setExpanded={setExpanded} />}
              onResize={noop} onReset={noop} onShowConversation={() => setExpanded(false)}>
              {conversation}
            </ViewSplit>
          </div>
        }
      />
      {showView && compare ? <Today w={w} set={set} acts={acts} follow={follow} onKey={onKey} /> : null}
      {showView && !compare && d === 1 ? <FullView {...view} /> : null}
      {showView && !compare && d === 2 ? <PillView {...view} /> : null}
      {dialog ? (
        <TextDialog kind={dialog} onClose={() => setDialog(undefined)} onSend={(text) => {
          setDialog(undefined);
          if (dialog === "paste") {
            set((x) => ({ ...x, pasted: true }));
            say(T.toast.pasted(text.length));
          } else {
            typeInto(text);
            say(T.toast.typed(text.length));
          }
          focusPicture();
        }} />
      ) : null}
      {appToast ? <p className="sb-toast kh-app-toast" role="status" data-testid="app-toast">{appToast}</p> : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [many, setMany] = useState(params.get("many") === "1");
  const [follow, setFollow] = useState(params.get("follow") === "1");
  const [compare, setCompare] = useState(params.get("compare") === "1");
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
          <label><input type="checkbox" id="follow" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> {T.follow} <span className="ra-muted">{T.followNote}</span></label>
          <label><input type="checkbox" id="compare" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> {T.compare}</label>
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
        <p className="ra-recommend" data-testid="recommendation">{T.recommend}</p>
      </header>
      <div className="ra-stage">
        <MemoryRouter initialEntries={[`/workspaces/${T.workspace}?conversation=a`]}>
          <Main key={`${direction}-${run}`} d={direction} compare={compare} follow={follow} many={many} w={w} set={setW} />
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
