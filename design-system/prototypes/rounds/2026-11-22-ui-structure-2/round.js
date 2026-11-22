// Round 2 of the whole-shell structure: three navigation models over the same
// synthetic content. Presentation only: no host calls, no persistence. Every
// workspace, conversation and person name is invented. Navigation rows are
// tagged data-count="conv|ws" so check.mjs measures what is visible at
// 1280×720 instead of trusting the review line.
const stage = document.querySelector("#stage");
const params = new URLSearchParams(location.search);
const S = {
  dir: 0,
  lang: params.get("lang") === "en" ? "en" : "fi",
  theme: ["dark", "contrast"].includes(params.get("theme"))
    ? params.get("theme")
    : "light",
  bare: params.has("bare"),
  current: "ship",
  page: "conv", // conv | home | outputs | browser | access | workspace
  ws: "atelier-site", // workspace page / D3 filter target
  filter: "all", // D3: workspace filter of the preview list
  open: new Set(), // D1/D2: workspaces expanded in place
  nav: false, // D2: navigator summoned
  pinned: false, // D2: navigator pinned as a sidebar
  query: "",
  pop: null, // more | account | wsfilter | map
  drawer: false, // phone drawer (D1, D3)
};
const t = (fi, en) => (S.lang === "fi" ? fi : en);
const pick = (s) => (s.includes("|") ? s.split("|")[S.lang === "fi" ? 0 : 1] : s);

// ---------- synthetic data ----------
const WS = [
  "atelier-site",
  "budget-2027",
  "dye-lab",
  "habitat-notes",
  "kurssit",
  "ledger-tools",
  "newsletter",
  "print-shop",
  "supplier-portal",
  "web-photos",
];
// id, workspace, state, title fi|en, age fi|en, preview fi|en (D3 only)
const C = [
  ["c1", "kurssit", "yours", "Kevään kurssikalenteri|Spring course calendar", "12 min", "Pyytää selainta: kirjautuminen varausjärjestelmään|Asks for the browser: sign-in to the booking system", "browser"],
  ["c2", "dye-lab", "yours", "Indigokokeiden taulukko|Indigo trial table", "1 t|1 h", "Kysyy: yhdistetäänkö erät 4 ja 5 samaan sarakkeeseen?|Asks: merge batches 4 and 5 into one column?"],
  ["c3", "newsletter", "yours", "Joulukuun uutiskirje|December newsletter", "3 t|3 h", "Luonnos valmis. Seuraavaksi: valitse kansikuva kolmesta.|Draft ready. Next: pick a cover image from three."],
  ["ship", "atelier-site", "running", "Toimituskulut verkkokauppaan|Shipping costs for the shop", "2 min", "Ajaa testejä · shipping.ts muutettu|Running tests · shipping.ts changed"],
  ["c5", "ledger-tools", "running", "Tositteiden täsmäytys|Receipt reconciliation", "8 min", "Odottaa apulaista: kuittien luku|Waiting for helper: reading receipts"],
  ["c6", "ledger-tools", "worker", "Apulainen: kuittien luku|Helper: reading receipts", "8 min", "Luettu 41/120 kuittia|Read 41/120 receipts"],
  ["q1", "atelier-site", "quiet", "Tuotesivujen kuvatekstit|Product page captions", "1 t|1 h"],
  ["q2", "print-shop", "quiet", "Painokoneen huoltolista|Press maintenance list", "2 t|2 h"],
  ["q3", "budget-2027", "quiet", "Kevään kassavirta|Spring cash flow", "5 t|5 h"],
  ["q4", "dye-lab", "failed", "Värimittarin vienti|Colorimeter export", "6 t|6 h"],
  ["q5", "web-photos", "quiet", "Taustojen poisto|Background removal", "eilen|yesterday"],
  ["q6", "supplier-portal", "quiet", "Pellavatoimittajan hinnasto|Linen supplier price list", "eilen|yesterday"],
  ["q7", "habitat-notes", "quiet", "Viikon muistiinpanot|Weekly notes", "ma|Mon"],
  ["q8", "kurssit", "quiet", "Ilmoittautumislomake|Sign-up form", "ma|Mon"],
  ["q9", "newsletter", "quiet", "Tilaajalistan siivous|Subscriber list cleanup", "su|Sun"],
  ["q10", "atelier-site", "quiet", "Alennuskoodit|Discount codes", "su|Sun"],
  ["q11", "ledger-tools", "quiet", "ALV-raportti|VAT report", "la|Sat"],
  ["q12", "print-shop", "quiet", "Kangasvaraston laskenta|Fabric stock count", "pe|Fri"],
  ["q13", "budget-2027", "quiet", "Palkkiot 2027|Fees 2027", "pe|Fri"],
  ["q14", "atelier-site", "quiet", "Kassan saavutettavuus|Checkout accessibility", "to|Thu"],
  ["q15", "dye-lab", "quiet", "Yliopiston näyteluettelo|University sample list", "ke|Wed"],
  ["q16", "web-photos", "quiet", "Kuvien rajaus|Image cropping", "ti|Tue"],
].map(([id, ws, state, title, age, preview = "", flag = ""]) => ({ id, ws, state, title, age, preview, flag }));
const title = (c) => pick(c.title);
const conv = (id) => C.find((c) => c.id === id);
const isYours = (c) => c.state === "yours";
const isRunning = (c) => c.state === "running" || c.state === "worker";
const isQuiet = (c) => c.state === "quiet" || c.state === "failed";
const YOURS = () => C.filter(isYours);
const RUNNING = () => C.filter(isRunning);
const yoursIn = (w) => C.filter((c) => c.ws === w && isYours(c)).length;
const runningIn = (w) => C.filter((c) => c.ws === w && isRunning(c)).length;
const failedIn = (w) => C.filter((c) => c.ws === w && c.state === "failed").length;
const quietIn = (w) => C.filter((c) => c.ws === w && isQuiet(c));

// ---------- icons ----------
const P = {
  outputs: '<path d="M7 3h7l4 4v6"/><path d="M14 3v4h4"/><path d="M5 7v13h8"/><path d="M15 17h6m-3-3 3 3-3 3"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
  access: '<path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6z"/><circle cx="12" cy="10.5" r="2"/><path d="M12 12.5V16"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  compose: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  editor: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m13 10-1.5 2 1.5 2m3-4 1.5 2-1.5 2"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m5 0h5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  branch: '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 8v8m10-6c0 4-6 3-9.5 6.5"/>',
  clip: '<path d="m20 11-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  next: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  pin: '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 16v4"/>',
  page: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/>',
};
const ic = (n, s = 18) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
function stateName(c) {
  return {
    yours: c.flag === "browser" ? t("Sinun vuorosi · pyytää selainta", "Your turn · asks for the browser") : t("Sinun vuorosi", "Your turn"),
    running: c.id === "c5" ? t("Odottaa apulaista", "Waiting for helper") : t("Työskentelee", "Working"),
    worker: t("Apulainen työskentelee", "Helper working"),
    failed: t("Epäonnistui", "Failed"),
    quiet: t("Valmis", "Done"),
  }[c.state];
}
function mark(c) {
  const cls = { yours: "mark-yours", running: "mark-run", worker: "mark-run", failed: "mark-fail", quiet: "mark-quiet" }[c.state];
  return `<span class="mark ${cls}" role="img" aria-label="${stateName(c)}" title="${stateName(c)}"></span>`;
}
const btn = (action, inner, cls = "", label = "", extra = "") =>
  `<button type="button" data-action="${action}" class="${cls}"${label ? ` aria-label="${label}" title="${label}"` : ""}${extra}>${inner}</button>`;
const here = (p) => (S.page === p ? ' aria-current="page"' : "");

// ---------- places: one row of icons, same in every direction ----------
// Outputs, own browser, agent access and explain are occasional or rare jobs:
// they share one 44 px row with the account instead of four stacked rows.
const PLACES = () => [
  ["outputs", t("Tuotokset · 1 uusi", "Outputs · 1 new"), '<span class="badge">1</span>'],
  ["browser", t("Oma selain · 1 pyyntö: Kevään kurssikalenteri", "Your browser · 1 request: Spring course calendar"), '<span class="badge">1</span>'],
  ["access", t("Agentin käytössä", "Agent access"), ""],
];
const placeName = (k) => ({ outputs: t("Tuotokset", "Outputs"), browser: t("Oma selain", "Your browser"), access: t("Agentin käytössä", "Agent access"), home: t("Etusivu", "Home") })[k];
function placesRow(cls = "") {
  return `<div class="places ${cls}">${PLACES().map(([k, label, extra]) => btn("dest:" + k, `${ic(k)}${extra}`, "place icon", label, here(k))).join("")}${btn("noop", ic("help"), "place icon", t("Selitä tämä näkymä", "Explain this view"))}<span class="spacer"></span>${btn("pop:account", `<span class="avatar" aria-hidden="true">R</span><span class="acct-name">Robin</span>`, "acct", t("Robin · tili ja asetukset", "Robin · account and settings"), ` aria-expanded="${S.pop === "account"}"`)}${accountPop()}</div>`;
}
function accountPop() {
  if (S.pop !== "account") return "";
  return `<div class="pop account-pop"><strong>Robin Example</strong><small>robin@example.test</small>${btn("noop", t("Asetukset", "Settings"))}${btn("noop", t("Palvelimen ylläpito", "Server administration"))}${btn("noop", t("Teema: Järjestelmä", "Theme: System"))}${btn("noop", t("Kirjaudu ulos", "Sign out"))}</div>`;
}
const brand = (extra = "") =>
  btn("dest:home", `<span class="logo" aria-hidden="true"></span><span class="srv">Example Habitat</span><span class="ok-dot" aria-hidden="true"></span>`, "brand", t("Etusivu · Example Habitat, yhdistetty", "Home · Example Habitat, connected"), here("home") + extra);

// ---------- one-line queue rows with the workspace name always printed ----------
function queueRow(c) {
  const sel = S.page === "conv" && S.current === c.id;
  return `<button type="button" class="q-row${sel ? " selected" : ""}${c.state === "worker" ? " worker" : ""}" data-count="conv" data-action="open:${c.id}"${sel ? ' aria-current="true"' : ""}>${mark(c)}<span class="q-title">${title(c)}</span>${c.flag === "browser" ? `<span class="row-flag" role="img" aria-label="${t("Pyytää selainta", "Asks for the browser")}" title="${t("Pyytää selainta", "Asks for the browser")}">${ic("browser", 14)}</span>` : ""}<span class="q-ws mono">${c.ws}</span></button>`;
}
function queue() {
  const y = YOURS(),
    r = RUNNING();
  return `<section class="sec"><h2>${t("Sinun vuorosi", "Your turn")} <span class="count">${y.length}</span></h2>${y.map(queueRow).join("")}</section><section class="sec"><h2>${t("Käynnissä", "Running")} <span class="count">${r.length}</span></h2>${r.map(queueRow).join("")}</section>`;
}
// Workspaces by name, alphabetical, each opening its quiet conversations in
// place. Quiet stops being a third list: it is the tree, shown on demand.
function wsRow(w) {
  const open = S.open.has(w);
  const marks = `${yoursIn(w) ? `<span class="wm"><span class="mark mark-yours"></span>${yoursIn(w)}</span>` : ""}${runningIn(w) ? `<span class="wm"><span class="mark mark-run"></span>${runningIn(w)}</span>` : ""}${failedIn(w) ? `<span class="wm"><span class="mark mark-fail"></span>${failedIn(w)}</span>` : ""}`;
  const label = `${w}${yoursIn(w) ? t(`, ${yoursIn(w)} sinun vuorosi`, `, ${yoursIn(w)} your turn`) : ""}${runningIn(w) ? t(`, ${runningIn(w)} käynnissä`, `, ${runningIn(w)} running`) : ""}${failedIn(w) ? t(", 1 epäonnistui", ", 1 failed") : ""}`;
  const kids = open
    ? `<div class="ws-kids">${quietIn(w).map((c) => `<button type="button" class="q-row kid${S.page === "conv" && S.current === c.id ? " selected" : ""}" data-action="open:${c.id}">${mark(c)}<span class="q-title">${title(c)}</span><span class="age">${pick(c.age)}</span></button>`).join("")}${btn("ws-page:" + w, `${ic("page", 14)}<span>${t("Työtilan sivu ja arkisto", "Workspace page and archive")}</span>`, "q-row kid link-row")}</div>`
    : "";
  return `<div class="ws-item"><button type="button" class="ws-row${open ? " open" : ""}" data-count="ws" data-action="expand:${w}" aria-expanded="${open}" aria-label="${label}"><span class="chev">${ic("chevron", 14)}</span><span class="mono ws-name">${w}</span>${marks}<span class="ws-n">${quietIn(w).length}</span></button>${kids}</div>`;
}
const wsList = () =>
  `<section class="sec"><h2>${t("Työtilat", "Workspaces")} <span class="count">${WS.length}</span>${btn("noop", ic("plus", 14), "icon mini", t("Uusi työtila", "New workspace"))}</h2>${WS.map(wsRow).join("")}</section>`;

// ---------- the conversation itself (identical in all three) ----------
function feed() {
  if (S.page !== "conv") return pageStub();
  const c = conv(S.current);
  if (c.id !== "ship")
    return `<div class="feed"><div class="col"><div class="bubble user">${t("Jatketaan tästä.", "Let’s continue from here.")}</div><p class="agent">${t(`Tämä on synteettinen keskustelu "${title(c)}" työtilassa`, `This is the synthetic conversation “${title(c)}” in`)} <code>${c.ws}</code>. ${c.preview ? pick(c.preview) : ""}</p><p class="muted">${t("Kierroksen varsinainen sisältö on keskustelussa Toimituskulut verkkokauppaan.", "The round’s real content is in Shipping costs for the shop.")}</p></div></div>`;
  return `<div class="feed"><div class="col">
<div class="bubble user">${t("Lisää verkkokauppaan toimituskulut: Suomeen 6,90 €, muualle EU:hun 12,50 € ja yli 80 euron tilauksille ilmainen toimitus.", "Add shipping costs to the shop: €6.90 within Finland, €12.50 elsewhere in the EU, and free shipping for orders over €80.")}</div>
<div class="agent"><p>${t("Luin kassan koodin. Toimituskulut lasketaan nyt yhdessä paikassa,", "I read the checkout code. Shipping is computed in one place,")} <code>src/checkout/shipping.ts</code>${t(", joten lisään säännöt sinne ja testit niiden viereen.", ", so I’ll add the rules there and tests next to them.")}</p>
<div class="tool"><span class="tool-ok" aria-hidden="true">✓</span>${t("Luki 3 tiedostoa", "Read 3 files")}<span class="tool-meta">src/checkout/</span></div>
<div class="tool"><span class="tool-ok" aria-hidden="true">✓</span>${t("Muokkasi", "Edited")} <code>shipping.ts</code><span class="tool-meta">+42 −6</span></div>
<p>${t("Maat on nyt luettelona, joten Ahvenanmaa ja muut ALV-poikkeukset saa myöhemmin omalle rivilleen ilman uutta koodia.", "Countries are now a list, so Åland and other VAT exceptions can get their own row later without new code.")}</p>
<div class="tool live"><span class="spin" aria-hidden="true"></span>${t("Ajaa", "Running")} <code>npm test -- shipping</code><span class="tool-meta">0:14</span></div>
<p>${t("Rajatapaus: tasan 80 euron tilaus. Tulkitsin sen ilmaiseksi, koska kampanjasivulla lukee ”80 € alkaen”. Sano, jos tarkoitit toisin.", "Edge case: an order of exactly €80. I treated it as free, because the campaign page says “from €80”. Tell me if you meant otherwise.")}</p></div>
<p class="status-line"><span class="spin" aria-hidden="true"></span>${t("Työskentelee · 2 min", "Working · 2 min")}</p>
</div></div>`;
}
function pageStub() {
  const body = {
    home: t("Etusivu: työtilat osioina, avoimet keskustelut kortteina huomiojärjestyksessä (nykyinen, ennallaan).", "Home: workspaces as sections, open conversations as cards in attention order (current, unchanged)."),
    outputs: t("Tuotokset: agenttien julkaisemat näkymät ja tiedostot omissa osoitteissasi. 1 uusi.", "Outputs: views and files agents published at your addresses. 1 new."),
    browser: t("Oma selain: palvelimen selainikkunat. 1 pyyntö keskustelusta Kevään kurssikalenteri.", "Your browser: the server’s browser windows. 1 request from Spring course calendar."),
    access: t("Agentin käytössä: datayhteydet, omat koneet ja avaimet, joita agentit voivat käyttää.", "Agent access: data connections, own machines and keys agents can use."),
    workspace: t("Työtilan sivu: polku, haara, kaikki keskustelut ja arkisto.", "Workspace page: path, branch, every conversation and the archive."),
  }[S.page];
  const head = S.page === "workspace" ? `${ic("page", 22)} <span class="mono">${S.ws}</span>` : `${S.page === "home" ? '<span class="logo" aria-hidden="true"></span>' : ic(S.page, 22)} ${placeName(S.page)}`;
  return `<div class="feed"><div class="col stub"><h2>${head}</h2><p>${body}</p>${btn("open:ship", t("Takaisin keskusteluun", "Back to the conversation"))}</div></div>`;
}
function composer() {
  if (S.page !== "conv") return "";
  return `<div class="composer-wrap"><div class="col">
<div class="composer"><textarea rows="1" aria-label="${t("Viesti agentille", "Message to the agent")}" placeholder="${t("Kirjoita agentille…", "Write to the agent…")}"></textarea>
<div class="composer-row">${btn("noop", ic("clip", 16), "ghost icon", t("Liitä", "Attach"))}${btn("noop", `<span class="glyph">/</span>`, "ghost icon", t("Komennot", "Commands"))}${btn("noop", `<span class="glyph">@</span>`, "ghost icon", t("Tiedosto", "File"))}<span class="spacer"></span><span class="ctx" title="${t("Konteksti 18 %", "Context 18%")}">18 %</span>${btn("noop", `Opus 5.5 · <span class="muted">Medium</span>`, "model")}${btn("noop", ic("mic", 16), "ghost icon", t("Sanele", "Dictate"))}${btn("noop", ic("send", 16), "send icon", t("Lähetä (vedos)", "Send (prototype)"), " disabled")}</div></div>
<small class="proto-note">${t("Toimiva vedos · viestiä ei lähetetä · kaikki nimet keksittyjä", "Interactive prototype · nothing is sent · all names invented")}</small></div></div>`;
}
function moreMenu() {
  if (S.pop !== "more") return "";
  return `<div class="pop more-pop">${btn("noop", t("Tee tilannekatsaus nyt", "Make a recap now"))}${btn("noop", t("Luo uusi otsikko", "New title"))}${btn("noop", t("Tiedot", "Details"))}<button type="button" disabled title="${t("Odota, että agentin vuoro päättyy", "Wait for the agent’s turn to end")}">${t("Arkistoi", "Archive")}<small>${t("Estetty: vuoro kesken", "Blocked: turn in progress")}</small></button></div>`;
}
// The header is the same in every direction except what sits at its left edge.
function header(lead = "", after = "") {
  const c = conv(S.current);
  const id =
    S.page === "conv"
      ? `<div class="conv-id"><h1>${title(c)}</h1><div class="meta"><span class="mono">${c.ws}</span><span class="sep">·</span>${ic("branch", 13)}<span class="mono">main</span><span class="sep">·</span>${mark(c)}<span>${stateName(c)}</span></div></div>`
      : `<div class="conv-id"><h1>${S.page === "workspace" ? `<span class="mono">${S.ws}</span>` : placeName(S.page)}</h1></div>`;
  const tools =
    S.page === "conv"
      ? `<div class="tools">${after}${btn("noop", ic("editor"), "icon", t("Editori: avaa työtila VS Codessa", "Editor: open the workspace in VS Code"))}${btn("noop", `${ic("terminal")}<span class="num-dot">1</span>`, "icon", t("Pääte: 1 tmux-istunto", "Terminal: 1 tmux session"))}${btn("pop:more", ic("more"), "icon", t("Keskustelun toiminnot", "Conversation actions"), ` aria-expanded="${S.pop === "more"}"`)}${moreMenu()}</div>`
      : "";
  return `<header class="conv-head">${lead}${id}${tools}</header>`;
}
const phoneMenu = () =>
  btn("drawer", `${ic("menu")}<span class="badge">3</span>`, "icon phone-only", t("Avaa navigaatio · 3 odottaa sinua", "Open navigation · 3 waiting for you"));
const scrim = (action) => btn(action, "", "scrim", t("Sulje navigaatio", "Close navigation"));

// ---------- direction 1: the queue (permanent, names always readable) ----------
function d1() {
  const side = `<nav class="side" aria-label="${t("Navigaatio", "Navigation")}"><div class="side-top">${brand()}<span class="spacer"></span>${btn("palette", ic("search", 17), "icon", t("Hae tai komenna (⌘K)", "Search or command (⌘K)"))}${btn("noop", ic("compose", 17), "icon", t("Uusi keskustelu", "New conversation"))}</div><div class="scroll side-list">${queue()}${wsList()}</div>${placesRow()}</nav>`;
  return `<div class="app d1${S.drawer ? " drawer-open" : ""}" data-direction="0">${side}<main class="main">${header(phoneMenu())}${feed()}${composer()}</main>${S.drawer ? scrim("drawer-close") : ""}</div>`;
}

// ---------- direction 2: summoned navigator (radically quiet) ----------
// No permanent navigation. The header's left edge says whose turn it is and
// opens the navigator; Seuraava moves through Your turn without opening it.
// The navigator is also the search: ⌘K opens it with the field focused.
function nextYours() {
  const y = YOURS();
  const at = y.findIndex((c) => c.id === S.current);
  return y[(at + 1) % y.length];
}
function d2() {
  const y = YOURS().length,
    r = RUNNING().length;
  const summon = btn("nav", `<span class="logo" aria-hidden="true"></span><span class="sum"><span class="mark mark-yours"></span>${y}</span><span class="sum"><span class="mark mark-run"></span>${r}</span>`, "summon", t(`Avaa navigaatio (⌘K) · ${y} sinun vuorosi, ${r} käynnissä`, `Open navigation (⌘K) · ${y} your turn, ${r} running`), ` aria-expanded="${S.nav || S.pinned}"`);
  const n = nextYours();
  const next =
    n && n.id !== S.current
    ? btn("open:" + n.id, `<span class="mark mark-yours" aria-hidden="true"></span><span class="next-title">${title(n)}</span>${ic("next", 15)}`, "next-btn", t(`Seuraava sinun vuorosi: ${title(n)} (${n.ws})`, `Next your turn: ${title(n)} (${n.ws})`))
    : "";
  const shown = S.nav || S.pinned;
  const q = S.query.trim().toLocaleLowerCase();
  const hits = q ? C.filter((c) => title(c).toLocaleLowerCase().includes(q) || c.ws.includes(q)) : [];
  const navBody = q
    ? `<section class="sec"><h2>${t("Osumat", "Matches")} <span class="count">${hits.length}</span></h2>${hits.map(queueRow).join("") || `<p class="empty">${t("Ei osumia.", "No matches.")}</p>`}</section>`
    : `${queue()}${wsList()}`;
  const navigator = shown
    ? `<nav class="navigator${S.pinned ? " pinned" : ""}" aria-label="${t("Navigaatio", "Navigation")}"><div class="side-top">${btn("dest:home", '<span class="logo" aria-hidden="true"></span>', "brand icon", t("Etusivu · Example Habitat, yhdistetty", "Home · Example Habitat, connected"), here("home"))}<div class="nav-search">${ic("search", 15)}<input id="nav-input" type="search" value="${S.query.replace(/"/g, "&quot;")}" aria-label="${t("Hae keskusteluja ja työtiloja", "Search conversations and workspaces")}" placeholder="${t("Hae tai komenna", "Search or command")}"></div>${btn("pin", ic("pin", 16), "icon" + (S.pinned ? " on" : ""), S.pinned ? t("Irrota: navigaatio vain kutsuttaessa", "Unpin: navigation only when summoned") : t("Kiinnitä sivupalkiksi", "Pin as a sidebar"), ` aria-pressed="${S.pinned}"`)}${S.pinned ? "" : btn("nav-close", ic("close", 16), "icon", t("Sulje (Esc)", "Close (Esc)"))}</div><div class="scroll side-list">${navBody}</div>${placesRow()}</nav>`
    : "";
  return `<div class="app d2${S.pinned ? " is-pinned" : ""}" data-direction="1">${S.pinned ? navigator : ""}<main class="main">${header(S.pinned ? "" : summon, next)}${feed()}${composer()}</main>${shown && !S.pinned ? navigator + scrim("nav-close") : ""}</div>`;
}

// ---------- direction 3: previews beside (Etusivu as the sidebar) ----------
// The list says what each agent is waiting for, so the person can decide
// where to go without opening each conversation. Workspaces are a filter.
function card(c) {
  const sel = S.page === "conv" && S.current === c.id;
  return `<button type="button" class="card-row${sel ? " selected" : ""}${c.state === "worker" ? " worker" : ""}" data-count="conv" data-action="open:${c.id}"${sel ? ' aria-current="true"' : ""}><span class="card-top">${mark(c)}<span class="q-title">${title(c)}</span><span class="age">${pick(c.age)}</span></span><span class="card-ws mono">${c.ws}</span><span class="card-say">${c.flag === "browser" ? ic("browser", 13) : ""}${pick(c.preview)}</span></button>`;
}
function d3() {
  const inF = (c) => S.filter === "all" || c.ws === S.filter;
  const y = YOURS().filter(inF),
    r = RUNNING().filter(inF),
    q = C.filter((c) => isQuiet(c) && inF(c));
  const filterBtn = btn("pop:wsfilter", `${S.filter === "all" ? `<span>${t("Kaikki työtilat", "All workspaces")}</span>` : `<span class="mono">${S.filter}</span>`}${ic("down", 14)}`, "ws-filter", t("Rajaa työtilaan", "Narrow to a workspace"), ` aria-expanded="${S.pop === "wsfilter"}"`);
  const filterPop =
    S.pop === "wsfilter"
      ? `<div class="pop wsfilter-pop">${btn("filter:all", `<span>${t("Kaikki työtilat", "All workspaces")}</span>`, S.filter === "all" ? "on" : "")}${WS.map((w) => btn("filter:" + w, `<span class="mono">${w}</span><span class="spacer"></span>${yoursIn(w) ? `<span class="wm"><span class="mark mark-yours"></span>${yoursIn(w)}</span>` : ""}${runningIn(w) ? `<span class="wm"><span class="mark mark-run"></span>${runningIn(w)}</span>` : ""}`, "wsf-row" + (S.filter === w ? " on" : ""), "", ' data-count="wsmenu"')).join("")}${btn("noop", `${ic("plus", 14)}<span>${t("Uusi työtila", "New workspace")}</span>`)}</div>`
      : "";
  const wsHead =
    S.filter === "all"
      ? ""
      : `<div class="filter-head">${btn("ws-page:" + S.filter, `${ic("page", 14)}<span>${t("Työtilan sivu", "Workspace page")}</span>`, "link-row")}${btn("filter:all", ic("close", 14), "icon mini", t("Näytä kaikki työtilat", "Show all workspaces"))}</div>`;
  const list = `<nav class="previews" aria-label="${t("Keskustelut", "Conversations")}"><div class="side-top">${brand()}<span class="spacer"></span>${btn("palette", ic("search", 17), "icon", t("Hae tai komenna (⌘K)", "Search or command (⌘K)"))}${btn("noop", ic("compose", 17), "icon", t("Uusi keskustelu", "New conversation"))}</div><div class="filter-bar">${filterBtn}${filterPop}</div>${wsHead}<div class="scroll side-list">
<section class="sec"><h2>${t("Sinun vuorosi", "Your turn")} <span class="count">${y.length}</span></h2>${y.map(card).join("") || `<p class="empty">${t("Ei mitään odottamassa.", "Nothing waiting.")}</p>`}</section>
<section class="sec"><h2>${t("Käynnissä", "Running")} <span class="count">${r.length}</span></h2>${r.map(card).join("") || `<p class="empty">${t("Mikään ei ole käynnissä.", "Nothing is running.")}</p>`}</section>
<section class="sec"><h2>${t("Hiljaiset", "Quiet")}</h2>${q.map((c) => `<button type="button" class="q-row${S.page === "conv" && S.current === c.id ? " selected" : ""}" data-count="conv" data-action="open:${c.id}">${mark(c)}<span class="q-title">${title(c)}</span><span class="q-ws mono">${c.ws}</span></button>`).join("")}</section></div>${placesRow()}</nav>`;
  return `<div class="app d3${S.drawer ? " drawer-open" : ""}" data-direction="2">${list}<main class="main">${header(phoneMenu())}${feed()}${composer()}</main>${S.drawer ? scrim("drawer-close") : ""}</div>`;
}

// ---------- review strip: one line per direction + the element map ----------
// The row counts are filled in by check.mjs's measurement and asserted there.
const LINES = () => [
  t(
    "Jono: yksi pysyvä sivupalkki käyttötiheyden järjestyksessä. Ylimpänä kenen vuoro (Sinun vuorosi, Käynnissä), alla työtilat nimillään; hiljaiset avautuvat työtilan alle. Paikat ja tili ovat yhdellä kuvakerivillä. 1280×720: 6 keskustelua + 10 työtilaa, kaikki nimet luettavissa.",
    "Queue: one permanent sidebar in order of use. On top whose turn it is (Your turn, Running), below the workspaces by name; quiet ones open under their workspace. Places and account share one icon row. 1280×720: 6 conversations + 10 workspaces, every name readable.",
  ),
  t(
    "Kutsuttava: ei pysyvää navigaatiota. Yläpalkin vasen reuna kertoo kenen vuoro (● 3 ◌ 3) ja avaa navigaattorin, joka on myös haku (⌘K); Seuraava vie suoraan seuraavaan odottavaan. Voi kiinnittää sivupalkiksi. 1280×720: 0 keskustelua + 0 työtilaa näkyvissä, kutsuttuna 6 keskustelua + 10 työtilaa.",
    "Summoned: no permanent navigation. The header’s left edge says whose turn it is (● 3 ◌ 3) and opens the navigator, which is also search (⌘K); Next goes straight to the next waiting one. Can be pinned as a sidebar. 1280×720: 0 conversations + 0 workspaces visible, summoned 6 conversations + 10 workspaces.",
  ),
  t(
    "Katsaukset vierellä: sivupalkki on kapea Etusivu. Jokainen odottava keskustelu kertoo, mitä agentti haluaa, joten valitset avaamatta; työtila on rajausvalikko. 1280×720: 7 keskustelua + 0 työtilaa (työtila näkyy joka rivillä ja valikossa).",
    "Previews beside: the sidebar is a narrow Home. Every waiting conversation says what its agent wants, so you choose without opening; the workspace is a filter menu. 1280×720: 7 conversations + 0 workspaces (the workspace shows on every row and in the menu).",
  ),
];
const MAP = () => [
  [t("Palvelimen nimi ja yhteys → Etusivu", "Server name and connection → Home"), t("sivupalkin ylärivi", "sidebar top line"), t("navigaattorin ylärivi; yläpalkissa merkki", "navigator top line; mark in the header"), t("sivupalkin ylärivi", "sidebar top line")],
  [t("Haku (⌘K)", "Search (⌘K)"), t("ylärivin kuvake → paletti", "top-line icon → palette"), t("navigaattorin kenttä: haku ja navigaatio ovat sama pinta", "navigator field: search and navigation are one surface"), t("ylärivin kuvake → paletti", "top-line icon → palette")],
  [t("Uusi keskustelu", "New conversation"), t("ylärivin kynä", "top-line pen"), t("paletti / navigaattori", "palette / navigator"), t("ylärivin kynä", "top-line pen")],
  [t("Sinun vuorosi, Käynnissä", "Your turn, Running"), t("sivupalkin ylin osa, työtila joka rivillä", "top of the sidebar, workspace on every row"), t("yläpalkin ● 3 ◌ 3 ja Seuraava; listat navigaattorissa", "header ● 3 ◌ 3 and Next; lists in the navigator"), t("kortit: otsikko, työtila, mitä agentti haluaa", "cards: title, workspace, what the agent wants")],
  [t("Hiljaiset", "Quiet"), t("työtilan alla, avautuu paikallaan", "under its workspace, opens in place"), t("sama navigaattorissa", "same, in the navigator"), t("yksirivisinä korttien alla", "one-line rows under the cards")],
  [t("Hiljaisten rajaus ja järjestys", "Quiet narrowing and sort"), t("työtilan avaaminen on rajaus", "opening a workspace is the narrowing"), t("sama + haku", "same + search"), t("työtilavalikko rajaa koko listan", "workspace menu narrows the whole list")],
  [t("Työtilat, uusi työtila", "Workspaces, new workspace"), t("nimilista tilamerkein, otsikon +", "name list with state marks, heading +"), t("sama navigaattorissa", "same, in the navigator"), t("rajausvalikko tilamerkein, valikon +", "filter menu with state marks, menu +")],
  [t("Työtilan sivu", "Workspace page"), t("avatun työtilan viimeinen rivi", "last row of an opened workspace"), t("sama", "same"), t("rajauksen otsikko", "filter heading")],
  [t("Apulaiset", "Helpers"), t("oma sisennetty rivi Käynnissä", "own indented row in Running"), t("sama navigaattorissa", "same, in the navigator"), t("oma kortti, edistys tekstinä", "own card, progress as text")],
  [t("Tuotokset, Oma selain, Agentin käytössä", "Outputs, Your browser, Agent access"), t("alarivin kuvakkeet merkkeineen", "bottom row icons with badges"), t("navigaattorin alarivi", "navigator bottom row"), t("alarivin kuvakkeet", "bottom row icons")],
  [t("Selainpyyntö toisesta keskustelusta", "Browser request from another conversation"), t("Oma selain -merkki + keskustelurivin selainkuvake", "Your browser badge + browser icon on the conversation row"), t("● 3 kattaa sen; Seuraava ja navigaattori kertovat", "● 3 covers it; Next and the navigator say it"), t("kortin teksti: Pyytää selainta", "card text: Asks for the browser")],
  [t("Selitä", "Explain"), t("alarivin ?", "bottom row ?"), t("navigaattorin alarivin ?", "navigator bottom row ?"), t("alarivin ?", "bottom row ?")],
  [t("Tili ja asetukset", "Account and settings"), t("alarivin oikea reuna", "bottom row, right"), t("navigaattorin alarivi", "navigator bottom row"), t("alarivin oikea reuna", "bottom row, right")],
  [t("Editori, pääte, keskustelun toiminnot", "Editor, terminal, conversation actions"), t("yläpalkin kuvakkeet ja ⋯ (sama kaikissa)", "header icons and ⋯ (same in all)"), t("sama + Seuraava niiden edessä", "same + Next before them"), t("sama", "same")],
  [t("Malli, konteksti", "Model, context"), t("kentän rivi", "composer row"), t("kentän rivi", "composer row"), t("kentän rivi", "composer row")],
];
function review() {
  if (S.bare) return "";
  const m = MAP();
  return `<section class="review"><p class="line"><strong>${S.dir + 1}/3</strong> ${LINES()[S.dir]}</p><div class="review-controls">${btn("pop:map", t("Kartta", "Map"), "map-btn", "", ` aria-expanded="${S.pop === "map"}"`)}<label>${t("Kieli", "Language")} <select id="language"><option value="fi"${S.lang === "fi" ? " selected" : ""}>Suomi</option><option value="en"${S.lang === "en" ? " selected" : ""}>English</option></select></label><label>${t("Teema", "Theme")} <select id="theme"><option value="light"${S.theme === "light" ? " selected" : ""}>${t("Päivä", "Light")}</option><option value="dark"${S.theme === "dark" ? " selected" : ""}>${t("Yö", "Dark")}</option><option value="contrast"${S.theme === "contrast" ? " selected" : ""}>${t("Kontrasti", "Contrast")}</option></select></label></div>${S.pop === "map" ? `<div class="pop map-pop"><table><caption>${t("Missä kukin nykyinen osa nyt asuu", "Where each current element now lives")}</caption><thead><tr><th>${t("Nykyinen", "Current")}</th><th>1 ${t("Jono", "Queue")}</th><th>2 ${t("Kutsuttava", "Summoned")}</th><th>3 ${t("Katsaukset", "Previews")}</th></tr></thead><tbody>${m.map((r) => `<tr>${r.map((x, i) => (i ? `<td${i === S.dir + 1 ? ' class="hl"' : ""}>${x}</td>` : `<th>${x}</th>`)).join("")}</tr>`).join("")}</tbody></table></div>` : ""}</section>`;
}
function palette() {
  return `<dialog id="palette" aria-label="${t("Hae tai komenna", "Search or command")}"><input id="palette-input" type="search" aria-label="${t("Hae", "Search")}" placeholder="${t("Hae keskusteluja, työtiloja ja komentoja", "Search conversations, workspaces and commands")}"><div class="pal-list"><h2>${t("Keskustelut", "Conversations")}</h2>${C.slice(0, 4).map((c) => btn("open:" + c.id, `${mark(c)}<span>${title(c)}</span><span class="mono muted">${c.ws}</span>`, "pal-row")).join("")}<h2>${t("Työtilat", "Workspaces")}</h2>${WS.slice(0, 3).map((w) => btn("ws-page:" + w, `<span class="mono">${w}</span>`, "pal-row")).join("")}<h2>${t("Komennot", "Commands")}</h2>${[t("Uusi keskustelu", "New conversation"), t("Avaa editori", "Open editor"), t("Avaa pääte", "Open terminal"), t("Tee tilannekatsaus nyt", "Make a recap now")].map((x) => btn("noop", `<span>${x}</span>`, "pal-row")).join("")}</div></dialog>`;
}

function render(d) {
  S.dir = d;
  document.documentElement.lang = S.lang;
  document.documentElement.dataset.theme = S.theme;
  document.querySelectorAll(".proto-picker-item").forEach(
    (b, i) => (b.textContent = [t("1 Jono", "1 Queue"), t("2 Kutsuttava", "2 Summoned"), t("3 Katsaukset vierellä", "3 Previews beside")][i]),
  );
  requestAnimationFrame(() => typeof moveHighlight === "function" && moveHighlight());
  return `<div class="frame${S.bare ? " bare" : ""}">${review()}${[d1, d2, d3][d]()}</div>${palette()}`;
}
function redraw() {
  stage.innerHTML = render(S.dir);
  if (S.dir === 1 && S.nav && !S.pinned) {
    const input = stage.querySelector("#nav-input");
    if (input && document.activeElement !== input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}
function closeNav() {
  S.nav = false;
  S.query = "";
}
function setPage(p) {
  S.page = p;
  S.pop = null;
  S.drawer = false;
  closeNav();
}
function summon() {
  S.nav = true;
  S.pop = null;
  redraw();
  stage.querySelector("#nav-input")?.focus();
}
stage.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) {
    if (S.pop && !e.target.closest(".pop")) {
      S.pop = null;
      redraw();
    }
    return;
  }
  const [a, arg] = el.dataset.action.split(/:(.*)/s);
  if (a === "noop") return;
  if (a === "palette") {
    openPalette();
    return;
  }
  if (a === "nav") {
    summon();
    return;
  }
  const dlg = document.querySelector("#palette");
  if (dlg?.open) dlg.close();
  if (a === "pop") S.pop = S.pop === arg ? null : arg;
  else if (a === "open") {
    setPage("conv");
    S.current = arg;
  } else if (a === "dest") setPage(arg);
  else if (a === "expand") {
    if (S.open.has(arg)) S.open.delete(arg);
    else S.open.add(arg);
  } else if (a === "filter") {
    S.filter = arg;
    S.pop = null;
  } else if (a === "ws-page") {
    S.ws = arg;
    setPage("workspace");
  } else if (a === "pin") {
    S.pinned = !S.pinned;
    S.nav = false;
    S.query = "";
  } else if (a === "nav-close") closeNav();
  else if (a === "drawer") S.drawer = !S.drawer;
  else if (a === "drawer-close") S.drawer = false;
  redraw();
  const again = stage.querySelector(`[data-action="${el.dataset.action}"]`);
  again?.focus();
});
stage.addEventListener("input", (e) => {
  if (e.target.id !== "nav-input") return;
  S.query = e.target.value;
  redraw();
});
stage.addEventListener("change", (e) => {
  if (e.target.id === "language") S.lang = e.target.value;
  if (e.target.id === "theme") S.theme = e.target.value;
  redraw();
});
function openPalette() {
  if (S.dir === 1) {
    if (S.pinned) {
      stage.querySelector("#nav-input")?.focus();
      return;
    }
    summon();
    return;
  }
  const dlg = document.querySelector("#palette");
  if (!dlg.open) dlg.showModal();
  dlg.querySelector("input").focus();
}
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openPalette();
  } else if (e.key === "Escape" && (S.pop || S.drawer || S.nav)) {
    S.pop = null;
    S.drawer = false;
    closeNav();
    redraw();
    if (S.dir === 1) stage.querySelector('[data-action="nav"]')?.focus();
  }
});
if (!params.has("v")) {
  const u = new URL(location);
  u.searchParams.set("v", "1");
  history.replaceState(null, "", u);
}
const variants = [() => render(0), () => render(1), () => render(2)];
