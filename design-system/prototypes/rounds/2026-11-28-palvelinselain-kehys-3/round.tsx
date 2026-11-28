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
import { BrowserRailRow, BrowserTurnCard } from "../../../../web/src/components/ServerBrowser";
import { StatusBellProvider } from "../../../../web/src/components/StatusBell";
import { ViewSplit } from "../../../../web/src/components/ViewPanel";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "./round.css";

// server-browser-frame, round 3 (28.11.2026). Round 2's frame is approved
// (Paneeli, Valmis, tabs in Habitat's bar, ⋯ with Leikkaa/Kopioi/Liitä,
// Sulje välilehti, Chrome in --kiosk). Kiosk mode has no address bar, so this
// round adds what Jari asked for: entering an address, browsing the remote
// Chrome's history and, minimally, bookmarks; plus Takaisin and Lataa
// uudelleen in ⋯, since kiosk mode also removed Chrome's own buttons.
// Two directions differ in where the address and history live:
//   1 Osoite palkissa: the origin in the bar turns into an address field with
//     suggestions under it; history is a panel over the picture.
//   2 Komentoarkki: one sheet over the picture for the address, suggestions,
//     history and bookmarks; the bar stays as approved.
// Shared by both: opening a page changes the agent's world, so it takes
// control first (and asks while the agent is mid-step), like selecting or
// closing a tab. Typing in the field does not: it is Habitat's, not the page's.
// History and bookmarks are the remote Chrome's own, read by the host for the
// person's view; the agent's fixed command set (agentpolicy_linux.go) gets no
// new command. Production components: the shell, rail, Oma selain row,
// conversation, Selain card, ViewSplit, buttons, menus, the frame's border,
// mid-step question and toast styles. The round's own: the bar, tabs,
// address field, result lists, history panel, sheet and the drawn pages.
// Synthetic.
setPersonalLanguage("fi");

const params = new URLSearchParams(location.search);
const noop = () => {};
const directions = ["1 Osoite palkissa", "2 Komentoarkki"];
const NATIVE = { w: 1280, h: 800 };
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = (k: string) => (mac ? `⌘${k}` : `Ctrl+${k}`);
const KEY = {
  address: mod("L"),
  history: mac ? "⌘Y" : "Ctrl+H",
  bookmark: mod("D"),
  back: mac ? "⌘[" : "Alt+←",
  reload: mod("R"),
  newTab: mac ? "⌥↵" : "Alt+Enter",
};

// ---------- Text (Finnish; production strings where they exist) ----------

const T = {
  title: "Palvelinselaimen kehys · kierros 3",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö" },
  lines: [
    "1 Osoite palkissa: palkin osoite muuttuu kentäksi, ehdotukset sen alla. Historia on paneeli kuvan päällä.",
    "2 Komentoarkki: yksi arkki kuvan päällä osoitteelle, ehdotuksille, historialle ja kirjanmerkeille. Palkki pysyy ennallaan.",
  ],
  phases: { agent: "Agentti työssä", ask: "Odottaa sinua", person: "Sinä ohjaat", back: "Annettu takaisin" },
  many: "Monta välilehteä",
  bookmarksOn: "Kirjanmerkit",
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
  tabs: (n: number) => (n === 1 ? "1 välilehti" : `${n} välilehteä`),
  tabsLabel: "Välilehdet",
  closeTab: (t: string) => `Sulje välilehti: ${t}`,
  closeThisTab: "Sulje välilehti",
  popupMark: "ponnahdus",
  newTab: "Uusi välilehti",
  editAddress: (o: string) => `Osoite: ${o}. Muokkaa osoitetta`,
  cut: "Leikkaa",
  copy: "Kopioi",
  paste: "Liitä",
  openAddress: "Avaa osoite…",
  history: "Historia",
  addBookmark: "Lisää kirjanmerkki",
  removeBookmark: "Poista kirjanmerkki",
  back: "Takaisin",
  reload: "Lataa uudelleen",
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
  // The address field and its lists.
  addrLabel: "Osoite tai haku",
  addrPlaceholder: "Kirjoita osoite tai hakusana",
  modeHere: "Tässä välilehdessä",
  modeNew: "Uuteen välilehteen",
  search: (q: string) => `Hae Googlella: ${q}`,
  searchSub: "Palvelinselaimen oletushaku",
  invalid: "Vain http- ja https-osoitteet avataan",
  invalidSub: "Muut osoitteet, kuten javascript: tai file:, eivät avaudu tästä.",
  switchTo: "Vaihda välilehteen",
  groups: { tabs: "Avoimet välilehdet", bookmarks: "Kirjanmerkit", history: "Historia", today: "Tänään", earlier: "Aiemmin", top: "" },
  enterHint: "↵ avaa tässä välilehdessä",
  enterHintAlt: ` · ${KEY.newTab} uuteen`,
  enterHintNew: "↵ avaa uuteen välilehteen",
  takesControl: "Agentti ohjaa: avaaminen ottaa ohjauksen sinulle.",
  takesControlBusy: "Agentti on kesken: avaaminen kysyy ensin.",
  source: "Palvelinselaimen oma historia, myös agentin avaamat sivut. Agentti ei saa sitä selainkomennoillaan.",
  clear: "Tyhjennä historia…",
  clearHint: "Avaa Chromen oman Poista selaustiedot -sivun uuteen välilehteen. Siellä valitset, mitä poistetaan.",
  noHistory: "Historia on tyhjä.",
  noMatch: "Ei osumia historiassa.",
  historyFilter: "Hae historiasta",
  closePanel: "Sulje historia",
  removeBm: (t: string) => `Poista kirjanmerkki: ${t}`,
  star: (on: boolean) => (on ? "Poista kirjanmerkki tältä sivulta" : "Lisää kirjanmerkki tälle sivulle"),
  toast: {
    took: "Sinä ohjaat. Agentti odottaa.",
    tookAfter: "Agentin toiminto päättyi. Sinä ohjaat.",
    back: "Agentti jatkaa.",
    backCleared: "Agentti jatkaa. Etäkoneen leikepöytä tyhjennettiin.",
    typed: (n: number) => `Kirjoitettiin sivulle näppäilyinä · ${n} merkkiä`,
    copied: (n: number) => `Kopioitu etäsivulta koneesi leikepöydälle · ${n} merkkiä`,
    cutDone: (n: number) => `Leikattu etäsivulta koneesi leikepöydälle · ${n} merkkiä`,
    nothing: "Sivulla ei ole valintaa. Mitään ei kopioitu.",
    tabClosed: (t: string) => `Välilehti suljettu: ${t}`,
    lastTab: "Viimeistä välilehteä ei suljeta. Sulje selain ⋯-valikosta.",
    stopped: "Selain suljettu.",
    reloaded: "Sivu ladattiin uudelleen.",
    noBack: "Tässä välilehdessä ei ole edellistä sivua.",
    bmAdded: (t: string) => `Kirjanmerkki lisätty: ${t}`,
    bmRemoved: (t: string) => `Kirjanmerkki poistettu: ${t}`,
    cleared: "Selaushistoria poistettu. Kirjautumiset säilyivät.",
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
};

// ---------- The synthetic browser ----------

type Kind = "energia" | "sopimus" | "login" | "popup" | "kirjasto" | "site" | "search" | "clear";
type Tab = { key: string; id: string; title: string; origin: string; url: string; kind: Kind; agent?: boolean; popup?: boolean; prev?: string; q?: string };
const hex = (n: number) => n.toString(16).toUpperCase().padStart(32, "0");
const TABS: Record<string, Tab> = {
  laskut: { key: "laskut", id: hex(1), title: "Laskut – Energia Oy", origin: "energia.example", url: "https://energia.example/laskut", kind: "energia" },
  kirjaudu: { key: "kirjaudu", id: hex(2), title: "Kirjaudu – Tunnistus", origin: "tunnistus.example", url: "https://tunnistus.example/kirjaudu", kind: "login", agent: true },
  vahvista: { key: "vahvista", id: hex(3), title: "Vahvista kirjautuminen", origin: "tunnistus.example", url: "https://tunnistus.example/vahvista", kind: "popup", popup: true },
  kirjasto: { key: "kirjasto", id: hex(4), title: "Lainat – Kirjasto", origin: "kirjasto.example", url: "https://kirjasto.example/lainat", kind: "kirjasto" },
  sopimus: { key: "sopimus", id: hex(5), title: "Sähkösopimus – Energia Oy", origin: "energia.example", url: "https://energia.example/sopimus", kind: "sopimus" },
};
let seq = 16;

/** Pages the synthetic web knows; any other http(s) address draws a plain site. */
const SITES: { url: string; title: string; kind: Kind }[] = [
  { url: "https://energia.example/laskut", title: "Laskut – Energia Oy", kind: "energia" },
  { url: "https://energia.example/sopimus", title: "Sähkösopimus – Energia Oy", kind: "sopimus" },
  { url: "https://tunnistus.example/kirjaudu", title: "Kirjaudu – Tunnistus", kind: "login" },
  { url: "https://kirjasto.example/lainat", title: "Lainat – Kirjasto", kind: "kirjasto" },
  { url: "https://sanomat.example/", title: "Etusivu – Sanomat", kind: "site" },
  { url: "https://yhdistys.example/kokous", title: "Kevätkokous – Yhdistys", kind: "site" },
  { url: "https://kunta.example/jatehuolto", title: "Jätehuolto – Kunta", kind: "site" },
  { url: "https://vero.example/verotili", title: "Verotili – Vero", kind: "site" },
];
const originOf = (url: string) => {
  try { return new URL(url).host; } catch { return url; }
};

type Entry = { url: string; title: string; time: string; day: "today" | "earlier"; when?: string };
const HISTORY: Entry[] = [
  { url: "https://tunnistus.example/kirjaudu", title: "Kirjaudu – Tunnistus", time: "9.14", day: "today" },
  { url: "https://energia.example/laskut", title: "Laskut – Energia Oy", time: "9.13", day: "today" },
  { url: "https://sanomat.example/", title: "Etusivu – Sanomat", time: "8.52", day: "today" },
  { url: "https://kirjasto.example/lainat", title: "Lainat – Kirjasto", time: "18.40", day: "earlier", when: "eilen" },
  { url: "https://yhdistys.example/kokous", title: "Kevätkokous – Yhdistys", time: "17.05", day: "earlier", when: "eilen" },
  { url: "https://energia.example/sopimus", title: "Sähkösopimus – Energia Oy", time: "16.30", day: "earlier", when: "eilen" },
  { url: "https://kunta.example/jatehuolto", title: "Jätehuolto – Kunta", time: "12.10", day: "earlier", when: "25.11." },
  { url: "https://vero.example/verotili", title: "Verotili – Vero", time: "11.02", day: "earlier", when: "25.11." },
];
const BOOKMARKS = ["https://energia.example/laskut", "https://kirjasto.example/lainat"];
const CLEAR_URL = "chrome://settings/clearBrowserData";

type Target = { url: string; q?: string };
/** What the address field makes of its text: an http(s) address, a refused
 * scheme, or a search with the remote Chrome's default engine. */
function parse(text: string): { kind: "go" | "search" | "invalid"; url?: string } {
  const s = text.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s) && !/^([^\s/]+\.[^\s/]+|localhost):\d+/.test(s)) return { kind: "invalid" };
  if (/^https?:\/\/\S+$/i.test(s)) return { kind: "go", url: s };
  if (!/\s/.test(s) && (/^[^\s/]+\.[a-z]{2,}(\/|:|$)/i.test(s) || /^localhost(:\d+)?(\/|$)/.test(s))) return { kind: "go", url: `https://${s}` };
  return { kind: "search" };
}

function makeTab(t: Target, prev?: string): string {
  const key = `t${++seq}`;
  const base = { key, id: hex(seq), prev };
  if (t.q !== undefined) {
    TABS[key] = { ...base, title: `${t.q} – Google-haku`, origin: "www.google.com", url: `https://www.google.com/search?q=${encodeURIComponent(t.q)}`, kind: "search", q: t.q };
  } else if (t.url === CLEAR_URL) {
    TABS[key] = { ...base, title: "Asetukset – Poista selaustiedot", origin: "chrome://settings", url: CLEAR_URL, kind: "clear" };
  } else {
    const known = SITES.find((s) => s.url === t.url) ?? SITES.find((s) => originOf(s.url) === originOf(t.url!) && new URL(t.url!).pathname === "/");
    const origin = originOf(t.url!);
    TABS[key] = { ...base, title: known?.title ?? origin, origin, url: known?.url ?? t.url!, kind: known?.kind ?? "site" };
  }
  return key;
}

type Phase = keyof typeof T.phases;
type World = {
  phase: Phase;
  control: "agent" | "person";
  busy: boolean;
  request?: string;
  tabs: string[];
  active: string;
  open: boolean;
  waiting: boolean;
  mid?: { x: number; y: number };
  fields: Record<string, string>;
  focusField?: string;
  pasted: boolean;
  stopped: boolean;
  history: Entry[];
  bookmarks: string[];
  flash?: number;
};

const baseTabs = (many: boolean): string[] => (many ? ["laskut", "kirjaudu", "kirjasto", "sopimus"] : ["laskut", "kirjaudu"]);
const fieldFor = (k: string) => (TABS[k]?.kind === "popup" ? "code" : TABS[k]?.kind === "login" ? "user" : undefined);
function worldAt(p: Phase, many: boolean): World {
  const w: World = { phase: p, control: "agent", busy: false, tabs: baseTabs(many), active: "kirjaudu", open: true, waiting: false, fields: {}, pasted: false, stopped: false, history: HISTORY, bookmarks: BOOKMARKS };
  if (p === "agent") return { ...w, busy: true, active: "laskut" };
  if (p === "ask") return { ...w, request: T.request };
  if (p === "person") return { ...w, control: "person", request: T.request, focusField: "user" };
  return { ...w, busy: true, open: false, active: "laskut" };
}

let reviewTheme = initialTheme(["light", "dark"]) as "light" | "dark";
const firstPhase = ((Object.keys(T.phases) as Phase[]).includes(params.get("state") as Phase) ? params.get("state") : "ask") as Phase;

// ---------- The drawn pages (fixed colours: not Habitat's) ----------

function Field({ id, label, w, set, secret, control }: { id: string; label: string; w: World; set: Setter; secret?: boolean; control: boolean }) {
  const value = w.fields[id] ?? "";
  const shown = secret ? "•".repeat(value.length) : value;
  return (
    <label className="fp-field">
      <span>{label}</span>
      <span className="fp-input" data-field={id} data-focus={control && w.focusField === id ? "" : undefined} onPointerDown={() => control && set((x) => ({ ...x, focusField: id }))}>
        {shown}
        {control && w.focusField === id ? <i className="fp-caret" /> : null}
      </span>
    </label>
  );
}

function Page({ tab, w, set, onClearData }: { tab: string; w: World; set: Setter; onClearData: () => void }) {
  const control = w.control === "person";
  const t = TABS[tab];
  if (t.kind === "energia" || t.kind === "sopimus")
    return (
      <div className="fp fp-energia">
        <header className="fp-head"><b>Energia Oy</b><nav>Etusivu · Laskut · Sopimus · Asiakaspalvelu</nav></header>
        <main className="fp-main">
          <h1>{t.kind === "energia" ? "Laskut 2026" : "Sähkösopimus"}</h1>
          {t.kind === "energia" ? (
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
  if (t.kind === "kirjasto")
    return (
      <div className="fp fp-kirjasto">
        <header className="fp-head"><b>Kaupunginkirjasto</b><nav>Haku · Lainat · Varaukset</nav></header>
        <main className="fp-main"><h1>Lainat</h1><p>Kolme lainaa, eräpäivä 4.12.2026.</p></main>
      </div>
    );
  if (t.kind === "site")
    return (
      <div className="fp fp-site" data-site={t.origin}>
        <header className="fp-head"><b>{t.title.split(" – ").pop()}</b><nav>{t.origin}</nav></header>
        <main className="fp-main"><h1>{t.title.split(" – ")[0]}</h1><p>Piirretty esimerkkisivu osoitteessa {t.url}.</p></main>
      </div>
    );
  if (t.kind === "search")
    return (
      <div className="fp fp-search">
        <header className="fp-search-head"><b>Google</b><span className="fp-search-box">{t.q}</span></header>
        <main className="fp-main">
          {["energia.example", "kunta.example", "sanomat.example"].map((o) => (
            <p key={o} className="fp-result"><small>https://{o}/</small><span className="fp-link">{t.q} – {o.split(".")[0]}</span></p>
          ))}
        </main>
      </div>
    );
  if (t.kind === "clear")
    // Chrome's own Clear browsing data, opened in a tab: Chrome says what it
    // removes and the person chooses; the host has no deletion code of its own.
    return (
      <div className="fp fp-chrome">
        <main className="fp-chrome-card">
          <h1>Poista selaustiedot</h1>
          <p className="fp-chrome-range">Aikaväli: <b>Kaikki</b></p>
          <p className="fp-check" data-on=""><span aria-hidden="true">☑</span> <span><b>Selaushistoria</b><br /><small>Poistaa historian kaikilta laitteilta, joilla tämä profiili on.</small></span></p>
          <p className="fp-check"><span aria-hidden="true">☐</span> <span><b>Evästeet ja muut sivustotiedot</b><br /><small>Kirjaa sinut ulos useimmilta sivustoilta.</small></span></p>
          <p className="fp-check"><span aria-hidden="true">☐</span> <span><b>Välimuistissa olevat kuvat ja tiedostot</b></span></p>
          <span className="fp-button fp-chrome-button" data-testid="clear-data" onPointerDown={(e) => { if (!control) return; e.stopPropagation(); onClearData(); }}>Poista tiedot</span>
        </main>
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
  if (t.kind === "login") return login;
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

type Setter = (f: (x: World) => World) => void;

/** The remote picture: the fixed 1280 × 800 display scaled to fit. */
function Picture({ w, set, onTake, onMid, onKey, onWiden, keys, onClearData }: {
  w: World; set: Setter; onTake: () => void; onMid: (at: { x: number; y: number }) => void; onKey: (e: React.KeyboardEvent) => void; onWiden?: () => void; keys?: ReactNode; onClearData: () => void;
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
    <div ref={box} className="kh-picture" data-testid="browser-viewer" data-control={w.control} tabIndex={0} role="application" aria-label={T.screen} aria-describedby="kh-screen-help" onPointerDown={down} onKeyDown={onKey} onPaste={(e) => e.preventDefault()}>
      <span id="kh-screen-help" hidden>{w.control === "person" ? T.helpYou : T.helpAgent}</span>
      <div className="kh-remote" data-flash={w.flash || undefined} key={w.flash} style={{ width: NATIVE.w, height: NATIVE.h, transform: `translate(-50%, -50%) scale(${s})`, left: "50%", top: "50%" } as CSSProperties}>
        <div className="kh-page" style={{ top: 0 }} data-testid="browser-page" data-url={TABS[w.active].url}>
          <Page tab={w.active} w={w} set={set} onClearData={onClearData} />
        </div>
      </div>
      {keys}
    </div>
  );
}

// ---------- The frame's pieces, shared by both directions ----------

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
type Mode = "here" | "new";
type Acts = {
  take: (msg?: string) => void;
  done: () => void;
  close: () => void;
  giveKeep: () => void;
  select: (k: string) => void;
  closeTab: (k: string) => void;
  stop: () => void;
  clip: (op: Clip) => void;
  keys: () => void;
  cancelWait: () => void;
  address: (mode: Mode) => void;
  history: () => void;
  open: (t: Target, mode: Mode) => void;
  bookmark: (url: string) => void;
  back: () => void;
  reload: () => void;
  clearHistory: () => void;
};

/** Tabs as tabs; the one in front shows its origin as a button that opens the
 * address (Chrome's own bar is not in the picture), and + opens a new tab's. */
function TabStrip({ w, acts }: { w: World; acts: Acts }) {
  return (
    <div className="kh-tabs" role="tablist" aria-label={T.tabsLabel} data-testid="browser-tabs">
      {w.tabs.map((k) => {
        const t = TABS[k];
        const on = w.active === k;
        return (
          <div className="kh-tab" key={k} data-tab={k} data-active={on || undefined} data-popup={t.popup || undefined}>
            <button type="button" role="tab" aria-selected={on} title={`${t.title} · ${t.origin}`} data-testid="browser-tab" onClick={() => acts.select(k)}>
              {t.popup ? <Icon name="external" /> : <Fav origin={t.origin} />}
              <span className="kh-tab-title">{t.title}</span>
              {t.popup ? <span className="kh-tab-mark">{T.popupMark}</span> : null}
            </button>
            {on ? (
              <button type="button" className="kh-origin" data-testid="browser-origin" aria-label={T.editAddress(t.origin)} title={`${T.openAddress} (${KEY.address})`} onClick={() => acts.address("here")}>
                {t.origin}
              </button>
            ) : null}
            <ControlButton size="inline" variant="quiet" presentation="icon" data-testid="browser-tab-close" aria-label={T.closeTab(t.title)} title={T.closeTab(t.title)} onPress={() => acts.closeTab(k)}>
              <Icon name="cross" />
            </ControlButton>
          </div>
        );
      })}
      <ControlButton size="inline" variant="quiet" presentation="icon" className="kh-newtab" data-testid="browser-new-tab" aria-label={T.newTab} title={T.newTab} onPress={() => acts.address("new")}>
        <Icon name="plus" />
      </ControlButton>
    </div>
  );
}

function Fav({ origin }: { origin: string }) {
  return <span className="kh-fav" data-site={origin} aria-hidden="true" />;
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
          else if (s === "new") acts.address("new");
          else acts.select(s);
        }}>
          {w.tabs.map((k) => (
            <ControlMenuItem key={k} id={k} textValue={TABS[k].title} className="kh-menu-tab" data-active={w.active === k || undefined}>
              {TABS[k].popup ? <Icon name="external" /> : <Fav origin={TABS[k].origin} />}
              <span className="kh-menu-tab-text">
                <span className="kh-tab-title">{TABS[k].title}</span>
                <small>{TABS[k].origin}</small>
              </span>
              {TABS[k].popup ? <span className="kh-tab-mark">{T.popupMark}</span> : null}
            </ControlMenuItem>
          ))}
          <ControlMenuItem id="new" textValue={T.newTab} data-testid="menu-new-tab"><Icon name="plus" /> {T.newTab}</ControlMenuItem>
          <ControlMenuItem id="close" textValue={T.closeThisTab} data-testid="menu-close-tab"><Icon name="cross" /> {T.closeThisTab}</ControlMenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

/** ⋯: the turn; address, history, bookmark; back and reload; cut / copy /
 * paste; the tab and the browser; and the truth sentence. */
function More({ w, acts, bookmarksOn }: { w: World; acts: Acts; bookmarksOn: boolean }) {
  const mine = w.control === "person";
  const marked = w.bookmarks.includes(TABS[w.active].url);
  const item = (id: string, label: string, k: string, icon?: ReactNode) => (
    <ControlMenuItem id={id} textValue={label} data-testid={`menu-${id}`}>
      {icon ?? null}
      <span className="kh-menu-label" data-icon={icon ? "" : undefined}>{label}</span>
      <kbd className="kh-kbd" data-testid="menu-shortcut">{k}</kbd>
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
            else if (key === "address") acts.address("here");
            else if (key === "history") acts.history();
            else if (key === "bookmark") acts.bookmark(TABS[w.active].url);
            else if (key === "back") acts.back();
            else if (key === "reload") acts.reload();
          }}
        >
          {mine ? (
            <ControlMenuItem key="keep" id="keep" textValue={T.giveKeep} data-testid="menu-give-keep"><Icon name="agent" /> {T.giveKeep}</ControlMenuItem>
          ) : (
            <ControlMenuItem key="take" id="take" textValue={T.takeHere} data-testid="menu-take"><Icon name="user" /> {T.takeHere}</ControlMenuItem>
          )}
          <Separator className="kh-sep" />
          {item("address", T.openAddress, KEY.address, <Icon name="search" />)}
          {item("history", T.history, KEY.history, <Icon name="clock" />)}
          {bookmarksOn ? item("bookmark", marked ? T.removeBookmark : T.addBookmark, KEY.bookmark, <span className="kh-star" aria-hidden="true">{marked ? "★" : "☆"}</span>) : null}
          <Separator className="kh-sep" />
          {item("back", T.back, KEY.back, <Icon name="back" />)}
          {item("reload", T.reload, KEY.reload, <Icon name="refresh" />)}
          <Separator className="kh-sep" />
          {item("cut", T.cut, mod("X"))}
          {item("copy", T.copy, mod("C"))}
          {item("paste", T.paste, mod("V"))}
          <Separator className="kh-sep" />
          <ControlMenuItem id="tab" textValue={T.closeThisTab} data-testid="menu-close-tab"><Icon name="cross" /> {T.closeThisTab}</ControlMenuItem>
          <ControlMenuItem id="stop" textValue={T.stopBrowser} danger data-testid="menu-stop"><Icon name="stop" /> {T.stopBrowser}</ControlMenuItem>
        </Menu>
        <p className="kh-truth" data-testid="browser-truth">{T.truth}</p>
      </Popover>
    </MenuTrigger>
  );
}

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

function KeysButton({ w, acts, on }: { w: World; acts: Acts; on: boolean }) {
  if (w.control !== "person") return null;
  return (
    <ControlButton size="row" variant="quiet" presentation="icon" className="kh-phone-only" data-testid="browser-keys" aria-pressed={on} aria-label={T.keys} title={T.keys} onPress={acts.keys}>
      <Icon name="key" />
    </ControlButton>
  );
}

// ---------- Address: suggestions, history, bookmarks ----------

type Row = { id: string; kind: "go" | "search" | "invalid" | "tab" | "bookmark" | "history"; title: string; sub?: string; url?: string; q?: string; tab?: string; time?: string };
type Section = { key: keyof typeof T.groups; rows: Row[] };

const entryRow = (e: Entry, i: number): Row => ({ id: `h${i}`, kind: "history", title: e.title, sub: originOf(e.url), url: e.url, time: e.when ? `${e.when} ${e.time}` : e.time });
const bookmarkRow = (url: string): Row => {
  const known = SITES.find((s) => s.url === url) ?? Object.values(TABS).find((t) => t.url === url);
  return { id: `b${url}`, kind: "bookmark", title: known?.title ?? originOf(url), sub: originOf(url), url };
};
const hit = (q: string, ...s: (string | undefined)[]) => s.some((x) => x?.toLowerCase().includes(q));

/** One visit per address, newest first. */
function uniq(history: Entry[]) {
  const seen = new Set<string>();
  return history.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}

/** Suggestions for typed text: what you typed (address, search or refusal),
 * then matching open tabs, bookmarks and history. An address whose origin
 * starts with the text goes first, as Chrome's omnibox does. */
function suggest(text: string, w: World, bookmarksOn: boolean): Section[] {
  const q = text.trim().toLowerCase();
  const p = parse(text);
  const typed: Row = p.kind === "go" ? { id: "go", kind: "go", title: p.url!, sub: originOf(p.url!), url: p.url } : p.kind === "search" ? { id: "search", kind: "search", title: T.search(text.trim()), sub: T.searchSub, q: text.trim() } : { id: "invalid", kind: "invalid", title: T.invalid, sub: T.invalidSub };
  const tabs = w.tabs.filter((k) => k !== w.active && hit(q, TABS[k].title, TABS[k].origin)).map<Row>((k) => ({ id: `t${k}`, kind: "tab", title: TABS[k].title, sub: TABS[k].origin, tab: k }));
  const marks = bookmarksOn ? w.bookmarks.filter((u) => hit(q, u, bookmarkRow(u).title)).map(bookmarkRow) : [];
  const hist = uniq(w.history).filter((e) => hit(q, e.url, e.title) && !w.bookmarks.includes(e.url)).slice(0, 5).map(entryRow);
  const lead = [...marks, ...hist].find((r) => r.sub?.startsWith(q.replace(/^https?:\/\//, "")));
  const top = lead && p.kind !== "invalid" ? [lead, typed] : [typed];
  return [
    { key: "top", rows: top },
    { key: "tabs", rows: tabs },
    { key: "bookmarks", rows: marks.filter((r) => r !== lead) },
    { key: "history", rows: hist.filter((r) => r !== lead) },
  ].filter((s) => s.rows.length) as Section[];
}

/** The list with an empty field: bookmarks, then history by day (or the
 * most recent pages when limited, under direction 1's field). */
function browse(w: World, bookmarksOn: boolean, filter = "", limit?: number): Section[] {
  const q = filter.trim().toLowerCase();
  const marks = bookmarksOn ? w.bookmarks.map(bookmarkRow).filter((r) => hit(q, r.title, r.url)) : [];
  const rows = w.history.map((e, i) => ({ e, r: entryRow(e, i) })).filter(({ e }) => hit(q, e.title, e.url));
  const sections: Section[] = limit
    ? [{ key: "bookmarks", rows: marks }, { key: "history", rows: uniq(w.history).slice(0, limit).map(entryRow) }]
    : [{ key: "bookmarks", rows: marks }, { key: "today", rows: rows.filter(({ e }) => e.day === "today").map(({ r }) => r) }, { key: "earlier", rows: rows.filter(({ e }) => e.day === "earlier").map(({ r }) => r) }];
  return sections.filter((s) => s.rows.length);
}

function RowIcon({ r }: { r: Row }) {
  if (r.kind === "search") return <Icon name="search" />;
  if (r.kind === "invalid") return <Icon name="warning" />;
  if (r.kind === "tab") return <Icon name="grid" />;
  if (r.kind === "bookmark") return <span className="kh-star" aria-hidden="true">★</span>;
  return <Fav origin={r.sub ?? ""} />;
}

/** Rows as a listbox; the selected one is what ↵ opens. */
function Results({ sections, sel, onRun, onRemove, label }: { sections: Section[]; sel: number; onRun: (r: Row, newTab: boolean) => void; onRemove: (url: string) => void; label: string }) {
  let i = -1;
  return (
    <div className="kh-results" role="listbox" aria-label={label} data-testid="address-results">
      {sections.map((s) => (
        <div key={s.key} className="kh-group" data-group={s.key} role="group" aria-label={T.groups[s.key] || undefined}>
          {T.groups[s.key] ? <p className="kh-group-label" aria-hidden="true">{T.groups[s.key]}</p> : null}
          {s.rows.map((r) => {
            i++;
            const on = i === sel;
            return (
              <div key={`${s.key}-${r.id}`} className="kh-row" role="option" aria-selected={on} aria-disabled={r.kind === "invalid" || undefined} data-kind={r.kind} data-testid="address-row" data-selected={on || undefined}
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => r.kind !== "invalid" && onRun(r, e.altKey || e.metaKey || e.ctrlKey)}>
                <span className="kh-row-icon"><RowIcon r={r} /></span>
                <span className="kh-row-text">
                  <span className="kh-row-title">{r.title}</span>
                  {r.sub ? <small className={r.kind === "search" || r.kind === "invalid" ? "" : "kh-mono"}>{r.sub}</small> : null}
                </span>
                {r.kind === "tab" ? <span className="kh-row-end">{T.switchTo}</span> : null}
                {r.time ? <span className="kh-row-end">{r.time}</span> : null}
                {r.kind === "bookmark" ? (
                  <button type="button" className="kh-row-x" data-testid="bookmark-remove" aria-label={T.removeBm(r.title)} title={T.removeBm(r.title)} onClick={(e) => { e.stopPropagation(); onRemove(r.url!); }}>
                    <Icon name="cross" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const flat = (sections: Section[]) => sections.flatMap((s) => s.rows);

/** The address field and its list, the same in both directions; only where
 * it sits differs. The field starts with the page's address selected, so
 * typing replaces it; an untouched field lists bookmarks and recent pages. */
function useFinder(w: World, mode: Mode, prefill: boolean, bookmarksOn: boolean, acts: Acts, close: () => void, emptyList: (w: World) => Section[]) {
  const here = prefill && mode === "here" ? TABS[w.active].url : "";
  const [text, setText] = useState(here);
  const [sel, setSel] = useState(0);
  const dirty = text !== here && text.trim() !== "";
  const sections = dirty ? suggest(text, w, bookmarksOn) : emptyList(w);
  const rows = flat(sections);
  // Focus after the menu that opened the field has restored focus to its trigger.
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setTimeout(() => { ref.current?.focus({ preventScroll: true }); ref.current?.select(); }, 40);
    return () => clearTimeout(id);
  }, []);
  const run = (r: Row, newTab: boolean) => {
    if (r.kind === "invalid") return;
    close();
    if (r.kind === "tab") return acts.select(r.tab!);
    acts.open(r.q !== undefined ? { url: "", q: r.q } : { url: r.url! }, newTab || mode === "new" ? "new" : "here");
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const r = rows[sel] ?? rows[0];
      if (!dirty && sel === 0 && text === here && here) return close();
      if (r) run(r, e.altKey || e.metaKey || e.ctrlKey);
    }
  };
  const input = (
    <input
      ref={ref}
      className="kh-addr-input"
      data-testid="address-input"
      aria-label={T.addrLabel}
      placeholder={T.addrPlaceholder}
      autoFocus
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="go"
      value={text}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => { setText(e.target.value); setSel(0); }}
      onKeyDown={onKeyDown}
    />
  );
  const results = <Results sections={sections} sel={sel} onRun={run} onRemove={acts.bookmark} label={T.addrLabel} />;
  return { input, results, empty: rows.length === 0, here };
}

function Star({ w, acts, url }: { w: World; acts: Acts; url: string }) {
  const on = w.bookmarks.includes(url);
  return (
    <button type="button" className="kh-star-btn" data-testid="address-star" aria-pressed={on} aria-label={T.star(on)} title={`${T.star(on)} (${KEY.bookmark})`} onPointerDown={(e) => e.preventDefault()} onClick={() => acts.bookmark(url)}>
      <span className="kh-star" aria-hidden="true">{on ? "★" : "☆"}</span>
    </button>
  );
}

function FinderFoot({ w, mode }: { w: World; mode: Mode }) {
  const gate = w.control === "person" ? null : w.busy ? T.takesControlBusy : T.takesControl;
  return (
    <p className="kh-finder-foot" data-testid="address-foot">
      <span>{mode === "new" ? T.enterHintNew : <>{T.enterHint}<span className="kh-desk-only">{T.enterHintAlt}</span></>}</span>
      {gate ? <span className="kh-gate" data-testid="address-gate"><Icon name="user" /> {gate}</span> : null}
    </p>
  );
}

/** Direction 1: the address field takes the tab strip's place in the bar;
 * suggestions drop under it. */
function BarAddress({ w, mode, acts, close, bookmarksOn }: { w: World; mode: Mode; acts: Acts; close: () => void; bookmarksOn: boolean }) {
  const f = useFinder(w, mode, true, bookmarksOn, acts, close, (x) => browse(x, bookmarksOn, "", 5));
  return (
    <div className="kh-addr" data-testid="address" data-direction="bar" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) close(); }}>
      <div className="kh-addr-field">
        <span className="kh-addr-mode" data-testid="address-mode">{mode === "new" ? <Icon name="plus" /> : <Icon name="search" />}<span className="kh-desk-only">{mode === "new" ? T.modeNew : null}</span></span>
        {f.input}
        {bookmarksOn && mode === "here" ? <Star w={w} acts={acts} url={f.here} /> : null}
      </div>
      <div className="kh-drop" data-testid="address-drop">
        {f.results}
        <FinderFoot w={w} mode={mode} />
      </div>
    </div>
  );
}

/** Direction 1's history: a panel over the picture's right edge. */
function HistoryPanel({ w, acts, close, bookmarksOn }: { w: World; acts: Acts; close: () => void; bookmarksOn: boolean }) {
  const [filter, setFilter] = useState("");
  const sections = browse(w, bookmarksOn, filter);
  return (
    <aside className="kh-hist" data-testid="history" aria-label={T.history} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") close(); }}>
      <header className="kh-hist-head">
        <strong>{T.history}</strong>
        <ControlButton size="inline" variant="quiet" presentation="icon" data-testid="history-close" aria-label={T.closePanel} title={T.closePanel} onPress={close}><Icon name="cross" /></ControlButton>
      </header>
      <input className="kh-addr-input kh-hist-filter" data-testid="history-filter" aria-label={T.historyFilter} placeholder={T.historyFilter} value={filter} autoFocus onChange={(e) => setFilter(e.target.value)} />
      <div className="kh-hist-list">
        {sections.length ? (
          <Results sections={sections} sel={-1} label={T.history} onRun={(r, n) => { close(); acts.open({ url: r.url! }, n ? "new" : "here"); }} onRemove={acts.bookmark} />
        ) : (
          <p className="kh-empty" data-testid="history-empty">{w.history.length ? T.noMatch : T.noHistory}</p>
        )}
      </div>
      <HistoryFoot w={w} acts={acts} close={close} />
    </aside>
  );
}

function HistoryFoot({ w, acts, close }: { w: World; acts: Acts; close: () => void }) {
  return (
    <footer className="kh-hist-foot">
      <p className="kh-source" data-testid="history-source">{T.source}</p>
      <ControlButton size="inline" variant="quiet" data-testid="history-clear" isDisabled={!w.history.length} title={T.clearHint} onPress={() => { close(); acts.clearHistory(); }}>
        <Icon name="trash" /> {T.clear}
      </ControlButton>
    </footer>
  );
}

/** Direction 2: one sheet for the address, suggestions, history and
 * bookmarks. ⋯ › Historia opens it with an empty field. */
function Sheet({ w, mode, acts, close, bookmarksOn, history }: { w: World; mode: Mode; acts: Acts; close: () => void; bookmarksOn: boolean; history?: boolean }) {
  const f = useFinder(w, mode, !history, bookmarksOn, acts, close, (x) => browse(x, bookmarksOn));
  return (
    <div className="kh-sheet-scrim" data-testid="address-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="kh-sheet" role="dialog" aria-modal="true" aria-label={history ? T.history : T.openAddress} data-testid="address" data-direction="sheet">
        <div className="kh-addr-field kh-sheet-field">
          <span className="kh-addr-mode" data-testid="address-mode">{mode === "new" && !history ? <><Icon name="plus" /><span>{T.modeNew}</span></> : <Icon name="search" />}</span>
          {f.input}
          {bookmarksOn && mode === "here" && !history ? <Star w={w} acts={acts} url={f.here} /> : null}
          <ControlButton size="inline" variant="quiet" presentation="icon" data-testid="address-close" aria-label={T.cancel} title={`${T.cancel} (Esc)`} onPress={close}><Icon name="cross" /></ControlButton>
        </div>
        <div className="kh-sheet-list">{f.empty ? <p className="kh-empty" data-testid="history-empty">{T.noHistory}</p> : f.results}</div>
        <FinderFoot w={w} mode={history ? "here" : mode} />
        <HistoryFoot w={w} acts={acts} close={close} />
      </div>
    </div>
  );
}

// ---------- Bar, request line, mid-step, toasts ----------

type Overlay = { kind: "address"; mode: Mode } | { kind: "history" } | undefined;

function Bar({ w, acts, keysOn, overlay, setOverlay, direction, bookmarksOn }: { w: World; acts: Acts; keysOn: boolean; overlay: Overlay; setOverlay: (o: Overlay) => void; direction: number; bookmarksOn: boolean }) {
  if (direction === 0 && overlay?.kind === "address")
    return (
      <div className="kh-bar" data-testid="browser-bar" data-editing="">
        <BarAddress key={overlay.mode} w={w} mode={overlay.mode} acts={acts} close={() => setOverlay(undefined)} bookmarksOn={bookmarksOn} />
        <span className="kh-bar-end" data-testid="browser-bar-end">
          <ControlButton size="inline" variant="quiet" data-testid="address-cancel" onPress={() => setOverlay(undefined)}>{T.cancel}</ControlButton>
        </span>
      </div>
    );
  return (
    <div className="kh-bar" data-testid="browser-bar">
      <span className="kh-desk-only kh-tabs-wrap"><TabStrip w={w} acts={acts} /></span>
      <span className="kh-phone-only kh-tabmenu-wrap"><TabMenu w={w} acts={acts} /></span>
      <span className="kh-bar-end" data-testid="browser-bar-end">
        <Turn w={w} />
        <KeysButton w={w} acts={acts} on={keysOn} />
        <More w={w} acts={acts} bookmarksOn={bookmarksOn} />
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

function Mid({ w, acts, set, cancel }: { w: World; acts: Acts; set: Setter; cancel: () => void }) {
  if (!w.mid) return null;
  return (
    <div className="sb-mid" role="alertdialog" aria-labelledby="kh-mid-title" aria-describedby="kh-mid-text" data-testid="browser-mid-step"
      style={{ "--sb-mid-x": `${Math.min(Math.max(w.mid.x, 0), 0.6) * 100}%`, "--sb-mid-y": `${Math.min(Math.max(w.mid.y, 0), 0.55) * 100}%` } as CSSProperties}>
      <strong id="kh-mid-title"><Icon name="warning" />{T.midTitle}</strong>
      <p id="kh-mid-text">{T.midText}</p>
      <div className="sb-actions">
        <ControlButton size="row" variant="primary" data-testid="browser-take-now" autoFocus onPress={() => acts.take()}>{T.takeNow}</ControlButton>
        <ControlButton size="row" data-testid="browser-take-after" onPress={() => set((x) => ({ ...x, mid: undefined, waiting: true }))}>{T.takeAfter}</ControlButton>
        <ControlButton size="row" variant="quiet" data-testid="browser-mid-cancel" onPress={() => { cancel(); set((x) => ({ ...x, mid: undefined })); }}>{T.cancel}</ControlButton>
      </div>
    </div>
  );
}

type Toast = { text: string; n: number };

function Foot({ toast }: { toast?: Toast }) {
  return (
    <div className="sb-frame-foot kh-foot">
      <p className="sb-toast kh-toast" role="status" aria-live="polite" data-testid="browser-toast">{toast?.text ?? ""}</p>
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

function PhoneKeys({ on, onText, onPaste, onBackspace }: { on: boolean; onText: (t: string) => void; onPaste: () => void; onBackspace: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (on) ref.current?.focus({ preventScroll: true });
    else ref.current?.blur();
  }, [on]);
  if (!on) return null;
  return (
    <>
      <textarea ref={ref} className="kh-ime" data-testid="browser-ime" aria-label={T.keysOn} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} value=""
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Backspace") { e.preventDefault(); onBackspace(); } }}
        onPaste={(e) => { e.preventDefault(); onPaste(); }}
        onChange={(e) => e.target.value && onText(e.target.value)} />
      <p className="kh-ime-note" data-testid="browser-ime-note"><Icon name="key" /> {T.keysOn}</p>
    </>
  );
}

// ---------- The panel ----------

type ViewProps = { w: World; set: Setter; acts: Acts; toast?: Toast; onKey: (e: React.KeyboardEvent) => void; keys: ReactNode; onWiden: () => void; keysOn: boolean; overlay: Overlay; setOverlay: (o: Overlay) => void; direction: number; bookmarksOn: boolean; cancelPending: () => void };

function PanelView(p: ViewProps) {
  const closeOverlay = () => {
    p.setOverlay(undefined);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".kh-picture")?.focus({ preventScroll: true }));
  };
  return (
    <section className="ah-view-pane kh-pane" aria-label={T.ownBrowser} data-testid="browser-view" data-direction={p.direction === 0 ? "bar" : "sheet"} onKeyDown={p.onKey}>
      <Bar w={p.w} acts={p.acts} keysOn={p.keysOn} overlay={p.overlay} setOverlay={p.setOverlay} direction={p.direction} bookmarksOn={p.bookmarksOn} />
      <Says w={p.w} />
      <div className="sb-frame kh-frame" data-testid="browser-frame" data-control={p.w.control} data-waiting={p.w.waiting || undefined}>
        <div className="kh-screen" data-testid="browser-screen">
          <Picture w={p.w} set={p.set} onKey={p.onKey} onWiden={p.onWiden} onTake={() => p.acts.take()} onMid={(at) => p.set((x) => ({ ...x, mid: at }))} keys={p.keys} onClearData={() => {
            p.set((x) => ({ ...x, history: [] }));
            window.dispatchEvent(new CustomEvent("kh-say", { detail: T.toast.cleared }));
          }} />
          <Hint w={p.w} />
          {p.direction === 0 && p.overlay?.kind === "history" ? <HistoryPanel w={p.w} acts={p.acts} close={closeOverlay} bookmarksOn={p.bookmarksOn} /> : null}
          {p.direction === 1 && p.overlay ? (
            <Sheet key={p.overlay.kind === "address" ? p.overlay.mode : "history"} w={p.w} mode={p.overlay.kind === "address" ? p.overlay.mode : "here"} history={p.overlay.kind === "history"} acts={p.acts} close={closeOverlay} bookmarksOn={p.bookmarksOn} />
          ) : null}
          <Mid w={p.w} acts={p.acts} set={p.set} cancel={p.cancelPending} />
          <Foot toast={p.toast} />
        </div>
      </div>
    </section>
  );
}

const statusOf = (w: World): BrowserStatus => ({
  schema_version: 1,
  state: w.stopped ? "stopped" : "running",
  survives_restart: true,
  control: w.control,
  agent_connected: true,
  windows: w.tabs.map((k) => ({ id: TABS[k].id, title: TABS[k].title, origin: TABS[k].kind === "clear" ? "chrome://settings" : `https://${TABS[k].origin}`, agent: !!TABS[k].agent })),
  request: w.request && w.control === "agent" ? { window: TABS.kirjaudu.id, text: w.request, age_ms: 30_000 } : undefined,
});

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
        <AssistantMessage streamState="complete" time="9.13" onCopy={noop}><Markdown text={back ? T.replyBack : T.reply} /></AssistantMessage>
        {w.stopped ? null : (
          <BrowserTurnCard state={state} visits={{ summary: { sites: ["energia.example", "tunnistus.example"], pageCount: back ? 5 : 3, downloadCount: 0, actionCount: 2, startedAt: Date.now() - 120_000 }, coverage: "command-results-only" }}
            request={w.request} agentWindow={TABS.kirjaudu.title} onLook={onLook} onTake={onTake} onGiveBack={onGiveBack} />
        )}
      </div>
    ),
  });
  return <ConversationTimeline state="ready" items={items.map((i) => ({ ...i, content: <div data-item={i.id}>{i.content}</div> }))} historyMode="pagedAccessible" onJumpToLatest={noop} emptyLabel={null} />;
}

/** The story's clock: the synthetic history ends at 9.14, so new visits follow it. */
let minute = 20;
const clock = () => `9.${String(Math.min(minute++, 59)).padStart(2, "0")}`;

function Main({ direction, many, bookmarksOn, w, set }: { direction: number; many: boolean; bookmarksOn: boolean; w: World; set: Setter }) {
  const [expanded, setExpanded] = useState(true);
  const [toast, setToast] = useState<Toast>();
  const [appToast, setAppToast] = useState<string | undefined>(w.phase === "back" ? T.toast.backCleared : undefined);
  const [keysOn, setKeysOn] = useState(false);
  const [draft, setDraft] = useState("");
  const [overlay, setOverlay] = useState<Overlay>();
  // A page-changing action waiting for the turn: run once control is yours.
  const pending = useRef<(() => void) | undefined>(undefined);
  const say = (text: string) => setToast((o) => ({ text, n: (o?.n ?? 0) + 1 }));
  useEffect(() => {
    const on = (e: Event) => say((e as CustomEvent<string>).detail);
    window.addEventListener("kh-say", on);
    return () => window.removeEventListener("kh-say", on);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!appToast) return;
    const id = setTimeout(() => setAppToast(undefined), 8000);
    return () => clearTimeout(id);
  }, [appToast]);
  useEffect(() => {
    if (!w.waiting) return;
    const id = setTimeout(() => {
      set((x) => ({ ...x, waiting: false, busy: false, control: "person" }));
      say(T.toast.tookAfter);
      const run = pending.current;
      pending.current = undefined;
      run?.();
    }, 1500);
    return () => clearTimeout(id);
  }, [w.waiting]);
  useEffect(() => {
    if (w.control !== "person" || !w.open) setKeysOn(false);
  }, [w.control, w.open]);
  const focusPicture = () => requestAnimationFrame(() => document.querySelector<HTMLElement>(".kh-picture")?.focus({ preventScroll: true }));
  /** Page-changing actions act like a click on the picture: they take control
   * while the agent waits and ask while it is mid-step. */
  const gated = (run: () => void) => {
    if (w.waiting) return;
    if (w.control === "person") return run();
    if (w.busy) {
      pending.current = run;
      set((x) => ({ ...x, mid: { x: 0.25, y: 0.12 } }));
      return;
    }
    acts.take();
    run();
  };
  const acts: Acts = {
    take: (msg = T.toast.took) => {
      set((x) => ({ ...x, control: "person", busy: false, mid: undefined, waiting: false, focusField: x.focusField ?? fieldFor(x.active) }));
      setExpanded(true);
      say(msg);
      focusPicture();
      const run = pending.current;
      pending.current = undefined;
      run?.();
    },
    done: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, open: false, mid: undefined, focusField: undefined, phase: "back", pasted: false }));
      setOverlay(undefined);
      setAppToast(w.pasted ? T.toast.backCleared : T.toast.back);
      setToast(undefined);
    },
    close: () => {
      if (w.control === "person") return acts.done();
      setOverlay(undefined);
      set((x) => ({ ...x, open: false, mid: undefined, waiting: false }));
    },
    giveKeep: () => {
      set((x) => ({ ...x, control: "agent", busy: true, request: undefined, focusField: undefined, phase: "agent", pasted: false }));
      say(w.pasted ? T.toast.backCleared : T.toast.back);
    },
    select: (k) => {
      set((x) => ({ ...x, active: k, control: "person", busy: false, mid: undefined, focusField: fieldFor(k) }));
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
      setOverlay(undefined);
      set((x) => ({ ...worldAt("agent", many), history: x.history, bookmarks: x.bookmarks, open: false, stopped: true, tabs: [], busy: false }));
      setAppToast(T.toast.stopped);
    },
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
    cancelWait: () => { pending.current = undefined; set((x) => ({ ...x, waiting: false })); },
    // Opening the field changes nothing remote, so it does not take control.
    address: (mode) => setOverlay({ kind: "address", mode }),
    history: () => setOverlay({ kind: "history" }),
    open: (t, mode) =>
      gated(() => {
        set((x) => {
          const key = makeTab(t, mode === "here" ? x.active : undefined);
          const tab = TABS[key];
          const history = tab.kind === "clear" ? x.history : [{ url: tab.url, title: tab.title, time: clock(), day: "today" as const }, ...x.history];
          const tabs = mode === "new" ? [...x.tabs, key] : x.tabs.map((k) => (k === x.active ? key : k));
          return { ...x, tabs, active: key, history, focusField: fieldFor(key), control: "person", busy: false };
        });
        focusPicture();
      }),
    bookmark: (url) => {
      const title = bookmarkRow(url).title;
      const on = w.bookmarks.includes(url);
      set((x) => ({ ...x, bookmarks: on ? x.bookmarks.filter((u) => u !== url) : [url, ...x.bookmarks] }));
      say(on ? T.toast.bmRemoved(title) : T.toast.bmAdded(title));
    },
    // Back and reload are the remote Chrome's own keys sent through the
    // picture (Alt+← / F5), so they need nothing new from the host.
    back: () =>
      gated(() => {
        const prev = TABS[w.active].prev;
        if (!prev) return say(T.toast.noBack);
        set((x) => ({ ...x, tabs: x.tabs.map((k) => (k === x.active ? prev : k)), active: prev, focusField: fieldFor(prev) }));
        focusPicture();
      }),
    reload: () =>
      gated(() => {
        set((x) => ({ ...x, flash: (x.flash ?? 0) + 1 }));
        say(T.toast.reloaded);
        focusPicture();
      }),
    clearHistory: () => acts.open({ url: CLEAR_URL }, "new"),
  };
  const typeInto = (text: string) => set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "") + text } } : x));
  const pasteText = () => (w.focusField === "pass" ? "kesä-2026-Sähkö" : w.focusField === "code" ? "482913" : "aino.laine");
  const runClip = (op: Clip) => {
    if (op === "paste") {
      const text = pasteText();
      typeInto(text);
      return say(T.toast.typed(text.length));
    }
    const field = w.focusField && w.focusField !== "pass" ? w.focusField : undefined;
    const text = field ? (w.fields[field] ?? "") : TABS[w.active].kind === "energia" ? "Lokakuu 2026 48,20 €" : "";
    if (!text) return say(T.toast.nothing);
    if (op === "cut" && field) set((x) => ({ ...x, fields: { ...x.fields, [field]: "" } }));
    say(op === "cut" ? T.toast.cutDone(text.length) : T.toast.copied(text.length));
  };
  const backspace = () => set((x) => (x.focusField ? { ...x, fields: { ...x.fields, [x.focusField]: (x.fields[x.focusField] ?? "").slice(0, -1) } } : x));
  const onKey = (e: React.KeyboardEvent) => {
    // The view's keys never reach the review picker or the panel twice.
    e.stopPropagation();
    const k = e.key.toLowerCase();
    const m = e.metaKey || e.ctrlKey;
    if (w.mid || w.waiting) return;
    // Habitat's own shortcuts, while the focus is in the view.
    if (m && k === "l") { e.preventDefault(); return acts.address("here"); }
    if ((mac && e.metaKey && k === "y") || (!mac && e.ctrlKey && k === "h")) { e.preventDefault(); return acts.history(); }
    if (bookmarksOn && m && k === "d") { e.preventDefault(); return acts.bookmark(TABS[w.active].url); }
    if ((mac && e.metaKey && e.key === "[") || (!mac && e.altKey && e.key === "ArrowLeft")) { e.preventDefault(); return acts.back(); }
    if ((m && k === "r") || e.key === "F5") { e.preventDefault(); return acts.reload(); }
    if ((e.target as HTMLElement).closest?.(".kh-bar")) return;
    const clip: Clip | undefined = m ? (k === "x" ? "cut" : k === "c" ? "copy" : k === "v" ? "paste" : undefined) : undefined;
    if (clip) { e.preventDefault(); return acts.clip(clip); }
    if (w.control !== "person") {
      if (m || e.altKey || e.key.length !== 1) return;
      e.preventDefault();
      if (w.busy) return set((x) => ({ ...x, mid: { x: 0.2, y: 0.2 } }));
      acts.take();
      typeInto(e.key);
      return;
    }
    if (e.key === "Backspace") { e.preventDefault(); return backspace(); }
    if (e.key === "Tab") {
      e.preventDefault();
      return set((x) => ({ ...x, focusField: x.focusField === "user" ? "pass" : x.focusField === "pass" ? "user" : x.focusField }));
    }
    if (e.key.length === 1 && !m) { e.preventDefault(); typeInto(e.key); }
  };
  const open = (take: boolean) => {
    if (w.stopped) set((x) => ({ ...worldAt("agent", many), history: x.history, bookmarks: x.bookmarks, busy: false }));
    else set((x) => ({ ...x, open: true }));
    setAppToast(undefined);
    if (take) acts.take();
    else setExpanded(w.control === "person");
  };
  const keys = <PhoneKeys on={keysOn} onText={typeInto} onPaste={() => acts.clip("paste")} onBackspace={backspace} />;
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
  const view: ViewProps = { w, set, acts, toast, onKey, keys, onWiden: () => setExpanded(true), keysOn, overlay, setOverlay, direction, bookmarksOn, cancelPending: () => { pending.current = undefined; } };
  const total = typeof window === "undefined" ? 1000 : window.innerWidth;
  return (
    <StatusBellProvider items={[]}>
      <AppShell
        mobileTitle={T.convA}
        navigationBadge={w.request ? 1 : 0}
        rail={rail}
        main={
          <div className="bp-main" id="main" data-testid="conversation">
            <ViewSplit open={showView} expanded={expanded} width={Math.round(total * 0.4)} min={420} max={total} panel={<PanelView {...view} />}
              onResize={noop} onReset={noop} onShowConversation={() => setExpanded(false)}>
              {conversation}
            </ViewSplit>
          </div>
        }
      />
      {appToast ? <p className="sb-toast kh-app-toast" role="status" data-testid="app-toast">{appToast}</p> : null}
    </StatusBellProvider>
  );
}

function App({ direction }: { direction: number }) {
  const [theme, setTheme] = useState(reviewTheme);
  const [many, setMany] = useState(params.get("many") === "1");
  const [bookmarksOn, setBookmarksOn] = useState(params.get("bookmarks") !== "0");
  const [w, setW] = useState<World>(() => worldAt(firstPhase, params.get("many") === "1"));
  const [run, setRun] = useState(0);
  const bar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    const set = () => document.documentElement.style.setProperty("--review-h", `${el ? el.getBoundingClientRect().height : 0}px`);
    set();
    if (!el) return;
    const o = new ResizeObserver(set);
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const restart = (next: World) => {
    setW(next);
    setRun((r) => r + 1);
  };
  return (
    <div className="ra-review" data-direction={direction}>
      <header className="ra-bar" ref={bar}>
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
          <label><input type="checkbox" id="bookmarks" checked={bookmarksOn} onChange={(e) => setBookmarksOn(e.target.checked)} /> {T.bookmarksOn}</label>
        </div>
        <div className="ra-stepper" role="group" aria-label="Tila" data-testid="stepper">
          {(Object.keys(T.phases) as Phase[]).map((p) => (
            <button key={p} type="button" className="ra-event ra-step" data-phase={p} aria-pressed={w.phase === p} onClick={() => restart(worldAt(p, many))}>
              {T.phases[p]}
            </button>
          ))}
        </div>
        <ol className="ra-lines" data-testid="direction-lines">
          {T.lines.map((l, i) => <li key={i} aria-current={i === direction ? "true" : undefined}>{l}</li>)}
        </ol>
      </header>
      <div className="ra-stage">
        <MemoryRouter initialEntries={[`/workspaces/${T.workspace}?conversation=a`]}>
          <Main key={`${direction}-${run}`} direction={direction} many={many} bookmarksOn={bookmarksOn} w={w} set={setW} />
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
