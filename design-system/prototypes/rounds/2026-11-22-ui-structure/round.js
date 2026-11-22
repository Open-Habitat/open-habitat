// Three whole-shell structures over the same synthetic content. Presentation
// only: no host calls, no persistence. Workspace, conversation and person names
// are invented. Rows a structure can show are tagged data-count="conv|ws" so
// check.mjs can measure what fits at 1280×720 instead of trusting the top line.
const stage = document.querySelector("#stage");
const params = new URLSearchParams(location.search);
const S = {
  dir: 0,
  lang: params.get("lang") === "en" ? "en" : "fi",
  theme: ["dark", "contrast"].includes(params.get("theme"))
    ? params.get("theme")
    : "light",
  bare: params.has("bare"),
  scope: "all", // D1: workspace narrowing in the strip
  ws: "atelier-site", // D3: the workspace that is home
  current: "ship",
  page: "conv", // conv | home | outputs | browser | access | workspace
  tab: "chat", // D2: chat | editor | terminal | info
  pop: null, // more | account | inbox | allconv | browser | map
  drawer: false,
};
const t = (fi, en) => (S.lang === "fi" ? fi : en);

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
const glyph = (w) => WS.indexOf(w) % 8;
const C = [
  [
    "c1",
    "kurssit",
    "yours",
    "Kevään kurssikalenteri",
    "Spring course calendar",
    "12 min",
  ],
  [
    "c2",
    "dye-lab",
    "yours",
    "Indigokokeiden taulukko",
    "Indigo trial table",
    "1 t|1 h",
  ],
  [
    "c3",
    "newsletter",
    "yours",
    "Joulukuun uutiskirje",
    "December newsletter",
    "3 t|3 h",
  ],
  [
    "ship",
    "atelier-site",
    "running",
    "Toimituskulut verkkokauppaan",
    "Shipping costs for the shop",
    "2 min",
  ],
  [
    "c5",
    "ledger-tools",
    "running",
    "Tositteiden täsmäytys",
    "Receipt reconciliation",
    "8 min",
  ],
  [
    "c6",
    "ledger-tools",
    "worker",
    "Apulainen: kuittien luku",
    "Helper: reading receipts",
    "8 min",
  ],
  [
    "q1",
    "atelier-site",
    "quiet",
    "Tuotesivujen kuvatekstit",
    "Product page captions",
    "1 t|1 h",
  ],
  [
    "q2",
    "print-shop",
    "quiet",
    "Painokoneen huoltolista",
    "Press maintenance list",
    "2 t|2 h",
  ],
  [
    "q3",
    "budget-2027",
    "quiet",
    "Kevään kassavirta",
    "Spring cash flow",
    "5 t|5 h",
  ],
  [
    "q4",
    "dye-lab",
    "failed",
    "Värimittarin vienti",
    "Colorimeter export",
    "6 t|6 h",
  ],
  [
    "q5",
    "web-photos",
    "quiet",
    "Taustojen poisto",
    "Background removal",
    "eilen|yesterday",
  ],
  [
    "q6",
    "supplier-portal",
    "quiet",
    "Pellavatoimittajan hinnasto",
    "Linen supplier price list",
    "eilen|yesterday",
  ],
  [
    "q7",
    "habitat-notes",
    "quiet",
    "Viikon muistiinpanot",
    "Weekly notes",
    "ma|Mon",
  ],
  ["q8", "kurssit", "quiet", "Ilmoittautumislomake", "Sign-up form", "ma|Mon"],
  [
    "q9",
    "newsletter",
    "quiet",
    "Tilaajalistan siivous",
    "Subscriber list cleanup",
    "su|Sun",
  ],
  ["q10", "atelier-site", "quiet", "Alennuskoodit", "Discount codes", "su|Sun"],
  ["q11", "ledger-tools", "quiet", "ALV-raportti", "VAT report", "la|Sat"],
  [
    "q12",
    "print-shop",
    "quiet",
    "Kangasvaraston laskenta",
    "Fabric stock count",
    "pe|Fri",
  ],
  ["q13", "budget-2027", "quiet", "Palkkiot 2027", "Fees 2027", "pe|Fri"],
  [
    "q14",
    "atelier-site",
    "quiet",
    "Kassan saavutettavuus",
    "Checkout accessibility",
    "to|Thu",
  ],
  [
    "q15",
    "dye-lab",
    "quiet",
    "Yliopiston näyteluettelo",
    "University sample list",
    "ke|Wed",
  ],
  ["q16", "web-photos", "quiet", "Kuvien rajaus", "Image cropping", "ti|Tue"],
].map(([id, ws, state, fi, en, age]) => ({ id, ws, state, fi, en, age }));
const title = (c) => t(c.fi, c.en);
const age = (c) =>
  c.age.includes("|") ? c.age.split("|")[S.lang === "fi" ? 0 : 1] : c.age;
const conv = (id) => C.find((c) => c.id === id);
const inScope = (c) => S.scope === "all" || c.ws === S.scope;
const yours = (w) => C.filter((c) => c.ws === w && c.state === "yours").length;
const running = (w) =>
  C.filter((c) => c.ws === w && (c.state === "running" || c.state === "worker"))
    .length;

// ---------- icons ----------
const P = {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  outputs:
    '<path d="M7 3h7l4 4v6"/><path d="M14 3v4h4"/><path d="M5 7v13h8"/><path d="M15 17h6m-3-3 3 3-3 3"/>',
  browser:
    '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
  access:
    '<path d="M12 3 5 6v5c0 4.4 3 8 7 10 4-2 7-5.6 7-10V6z"/><circle cx="12" cy="10.5" r="2"/><path d="M12 12.5V16"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  editor:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="m13 10-1.5 2 1.5 2m3-4 1.5 2-1.5 2"/>',
  terminal:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3m5 0h5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  branch:
    '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 8v8m10-6c0 4-6 3-9.5 6.5"/>',
  clip: '<path d="m20 11-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  send: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  files:
    '<path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  inbox:
    '<path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5 6h14l1 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5z"/>',
};
const ic = (n, s = 18) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const tile = (w, size = "") =>
  `<span class="tile ${size}" style="--g:var(--ah-glyph-${glyph(w)})" aria-hidden="true">${w
    .replace(/[^a-z]/g, "")
    .slice(0, 2)
    .toUpperCase()}</span>`;
function mark(c) {
  const m = {
    yours: ["mark-yours", t("Sinun vuorosi", "Your turn")],
    running: [
      "mark-run",
      c.id === "c5"
        ? t("Odottaa apulaista", "Waiting for helper")
        : t("Työskentelee", "Working"),
    ],
    worker: ["mark-run", t("Apulainen työskentelee", "Helper working")],
    failed: ["mark-fail", t("Epäonnistui", "Failed")],
    quiet: ["mark-quiet", t("Valmis", "Done")],
  }[c.state];
  return `<span class="mark ${m[0]}" role="img" aria-label="${m[1]}" title="${m[1]}"></span>`;
}

// ---------- the four destinations, one treatment, four icons ----------
// Etusivu, Tuotokset, Oma selain, Agentin käytössä: same row shape everywhere;
// the browser's readiness is a small text line, never a card.
const DEST = () => [
  ["home", "home", t("Etusivu", "Home"), ""],
  ["outputs", "outputs", t("Tuotokset", "Outputs"), "1"],
  [
    "browser",
    "browser",
    t("Oma selain", "Your browser"),
    t("Valmiina · 1 ikkuna", "Ready · 1 window"),
  ],
  ["access", "access", t("Agentin käytössä", "Agent access"), ""],
];
const shortDest = () => ({
  home: t("Etusivu", "Home"),
  outputs: t("Tuotokset", "Outputs"),
  browser: t("Selain", "Browser"),
  access: t("Käytössä", "Access"),
});
const btn = (action, inner, cls = "", label = "", extra = "") =>
  `<button type="button" data-action="${action}" class="${cls}"${label ? ` aria-label="${label}" title="${label}"` : ""}${extra}>${inner}</button>`;
const here = (p) => (S.page === p ? ' aria-current="page"' : "");

function convRow(c, opts = {}) {
  const sel = S.page === "conv" && S.current === c.id;
  return `<button type="button" class="conv-row${sel ? " selected" : ""}${c.state === "worker" ? " worker" : ""}" data-count="conv" data-action="open:${c.id}"${sel ? ' aria-current="true"' : ""}>${opts.noTile ? "" : tile(c.ws, "sm")}<span class="conv-title">${title(c)}</span>${mark(c)}<span class="age">${age(c)}</span></button>`;
}
function sections(list, opts = {}) {
  const groups = [
    [
      "yours",
      t("Sinun vuorosi", "Your turn"),
      list.filter((c) => c.state === "yours"),
    ],
    [
      "running",
      t("Käynnissä", "Running"),
      list.filter((c) => c.state === "running" || c.state === "worker"),
    ],
    [
      "quiet",
      t("Hiljaiset", "Quiet"),
      list.filter((c) => c.state === "quiet" || c.state === "failed"),
    ],
  ];
  return groups
    .filter(([k, , rows]) => rows.length || k !== "quiet")
    .map(
      ([k, label, rows]) =>
        `<section class="sec sec-${k}"><h3>${label}${rows.length && k !== "quiet" ? ` <span class="count">${rows.length}</span>` : ""}</h3>${rows.length ? rows.map((c) => convRow(c, opts)).join("") : `<p class="empty">${k === "yours" ? t("Ei mitään odottamassa.", "Nothing waiting.") : t("Mikään ei ole käynnissä.", "Nothing is running.")}</p>`}</section>`,
    )
    .join("");
}

// ---------- the conversation itself (identical content in all three) ----------
function feed() {
  if (S.page !== "conv") return pageStub();
  const c = conv(S.current);
  if (c.id !== "ship")
    return `<div class="feed"><div class="col"><div class="bubble user">${t("Jatketaan tästä.", "Let’s continue from here.")}</div><p class="agent">${t(`Tämä on synteettinen keskustelu "${title(c)}". Varsinainen sisältö on kierroksen pääkeskustelussa.`, `This is the synthetic conversation “${title(c)}”. The real content is in the round’s main conversation.`)}</p></div></div>`;
  return `<div class="feed"><div class="col">
<div class="bubble user">${t("Lisää verkkokauppaan toimituskulut: Suomeen 6,90 €, muualle EU:hun 12,50 € ja yli 80 euron tilauksille ilmainen toimitus.", "Add shipping costs to the shop: €6.90 within Finland, €12.50 elsewhere in the EU, and free shipping for orders over €80.")}</div>
<div class="agent"><p>${t("Luin kassan koodin. Toimituskulut lasketaan nyt yhdessä paikassa,", "I read the checkout code. Shipping is computed in one place,")} <code>src/checkout/shipping.ts</code>${t(", joten lisään säännöt sinne ja testit niiden viereen.", ", so I’ll add the rules there and tests next to them.")}</p>
<div class="tool"><span class="tool-ok" aria-hidden="true">✓</span>${t("Luki 3 tiedostoa", "Read 3 files")}<span class="tool-meta">src/checkout/</span></div>
<div class="tool"><span class="tool-ok" aria-hidden="true">✓</span>${t("Muokkasi", "Edited")} <code>shipping.ts</code><span class="tool-meta">+42 −6</span></div>
<div class="tool live"><span class="spin" aria-hidden="true"></span>${t("Ajaa", "Running")} <code>npm test -- shipping</code><span class="tool-meta">0:14</span></div>
<p>${t("Rajatapaus: tasan 80 euron tilaus. Tulkitsin sen ilmaiseksi, koska kampanjasivulla lukee ”80 € alkaen”. Sano, jos tarkoitit toisin.", "Edge case: an order of exactly €80. I treated it as free, because the campaign page says “from €80”. Tell me if you meant otherwise.")}</p></div>
<p class="status-line"><span class="spin" aria-hidden="true"></span>${t("Työskentelee · 2 min", "Working · 2 min")}</p>
</div></div>`;
}
function pageStub() {
  const d = DEST().find((x) => x[0] === S.page);
  const name = d ? d[2] : S.ws;
  const body = {
    home: t(
      "Etusivu: työtilat osioina, avoimet keskustelut kortteina huomiojärjestyksessä (nykyinen, ennallaan).",
      "Home: workspaces as sections, open conversations as cards in attention order (current, unchanged).",
    ),
    outputs: t(
      "Tuotokset: agenttien julkaisemat näkymät ja tiedostot omissa osoitteissasi. 1 uusi.",
      "Outputs: views and files agents published at your addresses. 1 new.",
    ),
    browser: t(
      "Oma selain: palvelimen selainikkunat. 1 ikkuna, valmiina agentille. Tämän keskustelun ikkunat avautuvat myös kentän yllä olevasta sirusta.",
      "Your browser: the server’s browser windows. 1 window, ready for the agent. This conversation’s windows also open from the chip above the field.",
    ),
    access: t(
      "Agentin käytössä: datayhteydet, omat koneet ja avaimet, joita agentit voivat käyttää.",
      "Agent access: data connections, own machines and keys agents can use.",
    ),
    workspace: t(
      "Työtilan sivu: polku, haara, kaikki keskustelut ja arkisto.",
      "Workspace page: path, branch, every conversation and the archive.",
    ),
  }[S.page];
  return `<div class="feed"><div class="col stub"><h2>${d ? ic(d[1], 22) : tile(S.ws)} ${S.page === "workspace" ? `<span class="mono">${S.ws}</span>` : name}</h2><p>${body}</p>${btn("open:ship", t("Takaisin keskusteluun", "Back to the conversation"))}</div></div>`;
}
function composer() {
  if (S.page !== "conv") return "";
  return `<div class="composer-wrap"><div class="col">
<div class="chips-above">${btn("dest:browser", `${ic("browser", 15)}<span>${t("Tämän keskustelun ikkunat · 1", "This conversation’s windows · 1")}</span>`, "chip")}</div>
<div class="composer"><textarea rows="1" aria-label="${t("Viesti agentille", "Message to the agent")}" placeholder="${t("Kirjoita agentille…", "Write to the agent…")}"></textarea>
<div class="composer-row">${btn("noop", `${ic("clip", 15)}<span>${t("Liitä", "Attach")}</span>`, "ghost")}${btn("noop", `<span class="glyph">/</span><span>${t("Komennot", "Commands")}</span>`, "ghost")}${btn("noop", `<span class="glyph">@</span><span>${t("Tiedosto", "File")}</span>`, "ghost")}<span class="spacer"></span><span class="ctx" title="${t("Konteksti 18 %", "Context 18%")}">18 %</span>${btn("noop", `Opus 5.5 · <span class="muted">Medium</span>`, "model")}${btn("noop", ic("mic", 16), "ghost icon", t("Sanele", "Dictate"))}${btn("noop", ic("send", 16), "send icon", t("Lähetä (vedos)", "Send (prototype)"), " disabled")}</div></div>
<small class="proto-note">${t("Toimiva vedos · viestiä ei lähetetä · kaikki nimet keksittyjä", "Interactive prototype · nothing is sent · all names invented")}</small></div></div>`;
}
function moreMenu(extra = "") {
  if (S.pop !== "more") return "";
  return `<div class="pop more-pop">${extra}${btn("noop", t("Tee tilannekatsaus nyt", "Make a recap now"))}${btn("noop", t("Luo uusi otsikko", "New title"))}${btn("noop", t("Tiedot", "Details"))}<button type="button" disabled title="${t("Odota, että agentin vuoro päättyy", "Wait for the agent’s turn to end")}">${t("Arkistoi", "Archive")}<small>${t("Estetty: vuoro kesken", "Blocked: turn in progress")}</small></button></div>`;
}
function accountPop(cls = "") {
  if (S.pop !== "account") return "";
  return `<div class="pop account-pop ${cls}"><strong>Robin Example</strong><small>robin@example.test</small>${btn("noop", t("Asetukset", "Settings"))}${btn("noop", t("Palvelimen ylläpito", "Server administration"))}${btn("noop", t("Teema: Järjestelmä", "Theme: System"))}${btn("noop", t("Kirjaudu ulos", "Sign out"))}</div>`;
}
const avatar = (cls = "") =>
  btn(
    "pop:account",
    `<span class="avatar" aria-hidden="true">R</span>`,
    `avatar-btn ${cls}`,
    t("Robin · tili ja asetukset", "Robin · account and settings"),
  );
const metaLine = (c) =>
  `<span class="mono">${c.ws}</span><span class="sep">·</span>${ic("branch", 13)}<span class="mono">main</span><span class="sep">·</span>${mark(c)}<span>${c.state === "running" ? t("Työskentelee", "Working") : c.state === "yours" ? t("Sinun vuorosi", "Your turn") : t("Valmis", "Done")}</span>`;
const phoneMenu = () =>
  btn(
    "drawer",
    `${ic("menu")}<span class="badge">3</span>`,
    "icon phone-only",
    t(
      "Avaa navigaatio · 3 odottaa sinua",
      "Open navigation · 3 waiting for you",
    ),
  );

// ---------- direction 1: two levels ----------
function d1() {
  const c = conv(S.current);
  const list = C.filter(inScope);
  const scopeHead =
    S.scope === "all"
      ? `<div class="col-head"><strong>${t("Kaikki työtilat", "All workspaces")}</strong>${btn("noop", ic("plus", 16), "icon", t("Uusi keskustelu", "New conversation"))}</div>`
      : `<div class="col-head">${tile(S.scope, "sm")}${btn("ws-page:" + S.scope, `<span class="mono">${S.scope}</span>`, "link", t("Avaa työtilan sivu", "Open workspace page"))}${btn("noop", ic("plus", 16), "icon", t("Uusi keskustelu", "New conversation"))}${btn("scope:all", ic("close", 14), "icon", t("Näytä kaikki työtilat", "Show all workspaces"))}</div>`;
  const strip = `<nav class="strip" aria-label="${t("Paikat", "Places")}">
${btn("dest:home", `<span class="logo" aria-hidden="true"></span><span class="lbl">${shortDest().home}</span>`, "strip-btn home-btn", t("Etusivu · Example Habitat, yhdistetty", "Home · Example Habitat, connected"), here("home"))}
${btn("scope:all", `${ic("all")}<span class="lbl">${t("Kaikki", "All")}</span>`, "strip-btn" + (S.scope === "all" ? " on" : ""), t("Kaikki työtilat", "All workspaces"), S.scope === "all" ? ' aria-pressed="true"' : ' aria-pressed="false"')}
<div class="strip-ws scroll">${WS.map((w) => btn("scope:" + w, `${tile(w)}${yours(w) ? `<span class="badge">${yours(w)}</span>` : running(w) ? '<span class="run-dot"></span>' : ""}`, "ws-tile" + (S.scope === w ? " on" : ""), `${w}${yours(w) ? t(` · ${yours(w)} odottaa sinua`, ` · ${yours(w)} waiting for you`) : running(w) ? t(" · käynnissä", " · running") : ""}`, ` data-count="ws" aria-pressed="${S.scope === w}"`)).join("")}${btn("noop", ic("plus", 16), "ws-tile add", t("Uusi työtila", "New workspace"))}</div>
<div class="strip-foot">${["outputs", "browser", "access"].map((k) => btn("dest:" + k, `${ic(k)}${k === "outputs" ? '<span class="badge">1</span>' : k === "browser" ? '<span class="ok-dot"></span>' : ""}<span class="lbl">${shortDest()[k]}</span>`, "strip-btn", DEST().find((d) => d[0] === k)[2] + (DEST().find((d) => d[0] === k)[3] ? " · " + DEST().find((d) => d[0] === k)[3] : ""), here(k))).join("")}
${btn("noop", `${ic("help")}<span class="lbl">${t("Selitä", "Explain")}</span>`, "strip-btn", t("Selitä tämä näkymä", "Explain this view"))}${avatar("strip-avatar")}</div>${accountPop("from-strip")}</nav>`;
  const column = `<nav class="column" aria-label="${t("Keskustelut", "Conversations")}">${scopeHead}${btn("palette", `${ic("search", 15)}<span>${t("Hae tai komenna", "Search or command")}</span><kbd>⌘K</kbd>`, "search-door")}<div class="scroll col-list">${sections(list, { noTile: S.scope !== "all" })}</div></nav>`;
  const header = `<header class="conv-head">${phoneMenu()}<div class="conv-id"><h1>${S.page === "conv" ? title(c) : DEST().find((d) => d[0] === S.page)?.[2] || S.ws}</h1>${S.page === "conv" ? `<div class="meta">${metaLine(c)}</div>` : ""}</div>${S.page === "conv" ? `<div class="tools">${btn("noop", `${ic("editor", 16)}<span>${t("Editori", "Editor")}</span>`, "tool-btn")}${btn("noop", `${ic("terminal", 16)}<span>${t("Pääte", "Terminal")}</span><span class="num">1</span>`, "tool-btn")}${btn("pop:more", ic("more"), "icon", t("Keskustelun toiminnot", "Conversation actions"), ` aria-expanded="${S.pop === "more"}"`)}${moreMenu()}</div>` : ""}</header>`;
  return `<div class="app d1${S.drawer ? " drawer-open" : ""}" data-direction="0">${strip}${column}<main class="main">${header}${feed()}${composer()}</main>${scrim()}</div>`;
}

// ---------- direction 2: top bar and command palette ----------
function d2() {
  const c = conv(S.current);
  const top = `<header class="topbar">${phoneMenu()}${btn("dest:home", `<span class="logo" aria-hidden="true"></span><span class="srv">Example Habitat</span><span class="ok-dot static" title="${t("Yhdistetty", "Connected")}"></span>`, "brand", t("Etusivu · Example Habitat, yhdistetty", "Home · Example Habitat, connected"), here("home"))}
${btn("palette", `${ic("search", 16)}<span class="ph">${t("Hae keskusteluja, työtiloja ja komentoja", "Search conversations, workspaces and commands")}</span><kbd>⌘K</kbd>`, "omnibox", t("Hae tai komenna", "Search or command"))}
<nav class="top-dest" aria-label="${t("Paikat", "Places")}">${["outputs", "browser", "access"].map((k) => btn("dest:" + k, `${ic(k, 17)}<span class="lbl">${shortDest()[k]}</span>${k === "outputs" ? '<span class="badge">1</span>' : k === "browser" ? '<span class="ok-dot"></span>' : ""}`, "top-btn", DEST().find((d) => d[0] === k)[2] + (DEST().find((d) => d[0] === k)[3] ? " · " + DEST().find((d) => d[0] === k)[3] : ""), here(k))).join("")}
${btn("noop", `${ic("help", 17)}<span class="lbl">${t("Selitä", "Explain")}</span>`, "top-btn", t("Selitä tämä näkymä", "Explain this view"))}</nav>${avatar()}${accountPop("from-top")}</header>`;
  const rail = `<nav class="slim" aria-label="${t("Keskustelut", "Conversations")}"><div class="slim-head"><strong>${t("Keskustelut", "Conversations")}</strong>${btn("noop", ic("plus", 16), "icon", t("Uusi keskustelu", "New conversation"))}</div><div class="scroll col-list">${sections(C)}</div>
<section class="ws-cloud"><h3>${t("Työtilat", "Workspaces")} <span class="count">${WS.length}</span></h3><div class="pills">${WS.map((w) => btn("ws-page:" + w, `${tile(w, "xs")}<span class="mono">${w}</span>${yours(w) ? `<span class="badge sm">${yours(w)}</span>` : ""}`, "pill", "", ' data-count="ws"')).join("")}</div></section></nav>`;
  const tabs = [
    ["chat", t("Keskustelu", "Conversation"), ""],
    ["editor", t("Editori", "Editor"), "editor"],
    ["terminal", t("Pääte", "Terminal"), "terminal"],
    ["info", t("Tiedot", "Details"), "info"],
  ];
  const head =
    S.page === "conv"
      ? `<header class="conv-head d2-head"><div class="conv-id"><h1>${title(c)}</h1><div class="meta">${metaLine(c)}</div></div>${btn("pop:more", ic("more"), "icon", t("Keskustelun toiminnot", "Conversation actions"), ` aria-expanded="${S.pop === "more"}"`)}${moreMenu()}</header><div class="tabs" role="tablist" aria-label="${t("Keskustelun näkymät", "Conversation views")}">${tabs.map(([k, l, i]) => `<button type="button" role="tab" data-action="tab:${k}" aria-selected="${S.tab === k}" class="tab">${i ? ic(i, 15) : ""}<span>${l}</span>${k === "terminal" ? '<span class="num">1</span>' : ""}</button>`).join("")}</div>`
      : `<header class="conv-head d2-head"><div class="conv-id"><h1>${DEST().find((d) => d[0] === S.page)?.[2] || S.ws}</h1></div></header>`;
  let body;
  if (S.page === "conv" && S.tab === "editor")
    body = `<div class="feed"><div class="pane-mock"><div class="tree"><span class="mono">src/</span><span class="mono">  checkout/</span><span class="mono on">    shipping.ts</span><span class="mono">    shipping.test.ts</span></div><pre class="mono">export function shipping(order) {\n  if (order.total &gt;= 80) return 0;\n  return order.country === "FI" ? 6.9 : 12.5;\n}</pre></div></div>`;
  else if (S.page === "conv" && S.tab === "terminal")
    body = `<div class="feed"><pre class="pane-term mono">~/src/atelier-site $ npm test -- shipping\n  ✓ Finland 6.90\n  ✓ EU 12.50\n  … running</pre></div>`;
  else if (S.page === "conv" && S.tab === "info")
    body = `<div class="feed"><div class="col stub"><p>${t("Työtila", "Workspace")} <span class="mono">atelier-site</span> · Opus 5.5 · Medium · ${t("aloitettu 14.02", "started 14:02")}</p></div></div>`;
  else body = feed();
  return `<div class="app d2${S.drawer ? " drawer-open" : ""}" data-direction="1">${top}<div class="below">${rail}<main class="main">${head}${body}${S.tab === "chat" ? composer() : ""}</main></div>${scrim()}</div>`;
}

// ---------- direction 3: the workspace is home ----------
function d3() {
  const c = conv(S.current);
  const wsConvs = C.filter((x) => x.ws === S.ws);
  // Tabs are what is open: live work plus the two most recently read quiet ones.
  const live = wsConvs.filter(
    (x) => x.state !== "quiet" && x.state !== "failed",
  );
  const rest = wsConvs.filter((x) => !live.includes(x));
  const open = [...live, ...rest.slice(0, 2)];
  const quiet = rest.slice(2);
  const attention = C.filter(
    (x) => x.state === "yours" || x.state === "running" || x.state === "worker",
  );
  const rail = `<nav class="wsrail" aria-label="${t("Työtilat", "Workspaces")}"><div class="wsrail-top">${btn("dest:home", `<span class="logo" aria-hidden="true"></span><span class="srv">Example Habitat</span><span class="ok-dot static"></span>`, "brand", t("Etusivu · Example Habitat, yhdistetty", "Home · Example Habitat, connected"), here("home"))}</div>
${btn("pop:inbox", `${ic("inbox", 17)}<span>${t("Huomio", "Attention")}</span><span class="pair"><span class="mark mark-yours"></span>3<span class="mark mark-run"></span>3</span>`, "inbox-btn", t("Huomio: 3 sinun vuorosi, 3 käynnissä", "Attention: 3 your turn, 3 running"), ` aria-expanded="${S.pop === "inbox"}"`)}
${S.pop === "inbox" ? `<div class="pop inbox-pop">${sections(attention)}</div>` : ""}
${btn("palette", `${ic("search", 15)}<span>${t("Hae tai komenna", "Search or command")}</span><kbd>⌘K</kbd>`, "search-door")}
<div class="ws-head"><h3>${t("Työtilat", "Workspaces")} <span class="count">${WS.length}</span></h3>${btn("noop", ic("plus", 16), "icon", t("Uusi työtila", "New workspace"))}</div>
<div class="scroll ws-list">${WS.map((w) => btn("ws:" + w, `${tile(w, "sm")}<span class="mono">${w}</span><span class="ws-state">${yours(w) ? `<span class="mark mark-yours"></span>${yours(w)}` : ""}${running(w) ? `<span class="mark mark-run"></span>${running(w)}` : ""}</span>`, "ws-row" + (S.ws === w ? " selected" : ""), "", ` data-count="ws"${S.ws === w ? ' aria-current="true"' : ""}`)).join("")}</div>
<div class="dest-grid">${["outputs", "browser", "access"].map((k) => btn("dest:" + k, `${ic(k, 17)}<span class="lbl">${shortDest()[k]}</span>${k === "outputs" ? '<span class="badge">1</span>' : k === "browser" ? '<span class="ok-dot"></span>' : ""}`, "grid-btn", DEST().find((d) => d[0] === k)[2] + (DEST().find((d) => d[0] === k)[3] ? " · " + DEST().find((d) => d[0] === k)[3] : ""), here(k))).join("")}${btn("noop", `${ic("help", 17)}<span class="lbl">${t("Selitä", "Explain")}</span>`, "grid-btn", t("Selitä tämä näkymä", "Explain this view"))}</div>
<div class="acct-row">${avatar()}<span>Robin</span></div>${accountPop("from-rail")}</nav>`;
  const wsbar = `<header class="wsbar">${phoneMenu()}${tile(S.ws)}${btn("ws-page:" + S.ws, `<span class="mono">${S.ws}</span>`, "link ws-name", t("Avaa työtilan sivu", "Open workspace page"))}<span class="branch">${ic("branch", 14)}<span class="mono">main</span><span class="muted">${t("3 muutettua", "3 changed")}</span></span><span class="spacer"></span>${btn("noop", `${ic("editor", 16)}<span>${t("Editori", "Editor")}</span>`, "tool-btn")}${btn("noop", `${ic("terminal", 16)}<span>${t("Pääte", "Terminal")}</span><span class="num">1</span>`, "tool-btn")}${btn("noop", `${ic("files", 16)}<span>${t("Tiedostot", "Files")}</span>`, "tool-btn")}</header>`;
  const tabs = `<div class="ctabs"><div class="ctab-list" role="tablist" aria-label="${t("Työtilan keskustelut", "Workspace conversations")}">${open
    .map(
      (x) =>
        `<button type="button" role="tab" class="ctab" data-count="conv" data-action="open:${x.id}" aria-selected="${S.page === "conv" && S.current === x.id}">${mark(x)}<span>${title(x)}</span></button>`,
    )
    .join(
      "",
    )}</div>${btn("noop", ic("plus", 15), "icon ctab-new", t("Uusi keskustelu tähän työtilaan", "New conversation in this workspace"))}<span class="spacer"></span>${btn("pop:allconv", `${t("Kaikki", "All")} ${wsConvs.length}${ic("chevron", 14)}`, "allconv", t(`Kaikki työtilan keskustelut (${wsConvs.length})`, `All conversations in this workspace (${wsConvs.length})`), ` aria-expanded="${S.pop === "allconv"}"`)}${S.pop === "allconv" ? `<div class="pop allconv-pop"><h3>${t("Hiljaiset", "Quiet")}</h3>${quiet.map((x) => convRow(x, { noTile: true })).join("") || `<p class="empty">${t("Ei muita.", "No others.")}</p>`}${btn("ws-page:" + S.ws, t("Työtilan sivu ja arkisto", "Workspace page and archive"), "link")}</div>` : ""}</div>`;
  const head =
    S.page === "conv"
      ? `<header class="conv-head d3-head"><div class="conv-id"><h1>${title(c)}</h1><div class="meta">${mark(c)}<span>${c.state === "running" ? t("Työskentelee · 2 min", "Working · 2 min") : t("Valmis", "Done")}</span></div></div>${btn("pop:more", ic("more"), "icon", t("Keskustelun toiminnot", "Conversation actions"), ` aria-expanded="${S.pop === "more"}"`)}${moreMenu()}</header>`
      : "";
  return `<div class="app d3${S.drawer ? " drawer-open" : ""}" data-direction="2">${rail}<main class="main">${wsbar}${tabs}${head}${feed()}${composer()}</main>${scrim()}</div>`;
}
const scrim = () =>
  S.drawer
    ? btn(
        "drawer-close",
        "",
        "scrim",
        t("Sulje navigaatio", "Close navigation"),
      )
    : "";

// ---------- review strip: one line per direction + the element map ----------
const LINES = () => [
  t(
    "Kaksi tasoa: vasen kaista on työtilojen vaihtaja ja paikat, viereinen palsta pelkät keskustelut tiloittain koko korkeudelta. Haastaa: työtilat nimiriveistä kirjainruuduiksi; editori ja pääte nimettyinä (design.md: kuvake voittaa). 1280×720: 17 keskustelua + 10 työtilaa.",
    "Two levels: the left strip switches workspaces and holds the places; the column beside it is only conversations by state, full height. Challenges: workspaces become letter tiles, not name rows; editor and terminal labelled (design.md: the icon wins). 1280×720: 17 conversations + 10 workspaces.",
  ),
  t(
    "Yläpalkki: haku/komentopaletti, paikat ja tili siirtyvät koko leveyden yläpalkkiin; editori, pääte ja tiedot ovat keskustelun välilehtiä. Haastaa: tili ylös oikealle (sovittu: sivupalkin alareuna); välilehdet nimettyinä. 1280×720: 11 keskustelua + 10 työtilaa.",
    "Top bar: search/command palette, places and account move into a full-width top bar; editor, terminal and details become the conversation’s tabs. Challenges: account moves top right (agreed: rail bottom); tabs labelled. 1280×720: 11 conversations + 10 workspaces.",
  ),
  t(
    "Työtila kotina: sivupalkki listaa vain työtilat, keskustelut ovat työtilan välilehtiä ja tilaosiot Huomio-ponnahduksessa. Haastaa: tilaosiot pois sivupalkista (product.md); työtilan työkalut nimettyinä. 1280×720: 3 keskustelua + 10 työtilaa (välilehtinä; muut Huomiossa ja Kaikki-listassa).",
    "Workspace as home: the sidebar lists only workspaces, conversations are the workspace’s tabs and the state sections sit in an Attention popover. Challenges: state sections leave the sidebar (product.md); workspace tools labelled. 1280×720: 3 conversations + 10 workspaces (as tabs; the rest in Attention and the All list).",
  ),
];
const MAP = () =>
  [
    [
      [
        t("Palvelimen nimi ja yhteys", "Server name and connection"),
        t("kaistan yläpään merkki (vihje)", "strip top mark (tooltip)"),
        t("yläpalkin vasen reuna", "top bar, left"),
        t("sivupalkin yläpää", "sidebar top"),
      ],
      [
        t("Etusivu", "Home"),
        t("merkki = Etusivu", "mark = Home"),
        t("merkki/nimi = Etusivu", "mark/name = Home"),
        t("merkki/nimi = Etusivu", "mark/name = Home"),
      ],
      [
        t("Tuotokset", "Outputs"),
        t("kaistan alaosa, oma kuvake", "strip foot, own icon"),
        t("yläpalkki, kuvake + nimi", "top bar, icon + label"),
        t("paikkojen ruudukko", "places grid"),
      ],
      [
        t("Oma selain", "Your browser"),
        t(
          "kaistan alaosa + keskustelun siru",
          "strip foot + conversation chip",
        ),
        t("yläpalkki + siru", "top bar + chip"),
        t("ruudukko + siru", "grid + chip"),
      ],
      [
        t("Agentin käytössä", "Agent access"),
        t("kaistan alaosa", "strip foot"),
        t("yläpalkki", "top bar"),
        t("ruudukko", "grid"),
      ],
      [
        t("Haku", "Search"),
        t("palstan yläpää → paletti", "column top → palette"),
        t("yläpalkin keskellä, paletti", "top bar centre, palette"),
        t("sivupalkki → paletti", "sidebar → palette"),
      ],
      [
        t(
          "Sinun vuorosi / Käynnissä / Hiljaiset",
          "Your turn / Running / Quiet",
        ),
        t("palsta, yksi vieritys", "column, one scroll"),
        t("kapea palkki, yksi vieritys", "slim rail, one scroll"),
        t(
          "Huomio-ponnahdus; Hiljaiset työtilan Kaikki-listaan",
          "Attention popover; Quiet in the workspace’s All list",
        ),
      ],
      [
        t("Työtilat", "Workspaces"),
        t("kaistan ruudut, rajaavat palstaa", "strip tiles, narrow the column"),
        t("pilleripilvi palkin alla", "pill cloud under the rail"),
        t("sivupalkin päälista", "the sidebar’s main list"),
      ],
      [
        t("Apulaiset", "Helpers"),
        t(
          "omat rivit Käynnissä + siru kentän yllä",
          "own rows in Running + chip above the field",
        ),
        t("sama", "same"),
        t("välilehtenä työtilassa + siru", "tab in the workspace + chip"),
      ],
      [
        t("Editori, pääte", "Editor, terminal"),
        t("otsikon nimetyt painikkeet", "labelled header buttons"),
        t("keskustelun välilehdet", "conversation tabs"),
        t(
          "työtilan palkki (työtilan työkaluja)",
          "workspace bar (workspace tools)",
        ),
      ],
      [
        t("Selitä", "Explain"),
        t("kaistan alaosa", "strip foot"),
        t("yläpalkki", "top bar"),
        t("ruudukko", "grid"),
      ],
      [
        t(
          "Katsaus, uusi otsikko, tiedot, arkistoi",
          "Recap, new title, details, archive",
        ),
        "⋯",
        t("⋯ (tiedot myös välilehti)", "⋯ (details also a tab)"),
        "⋯",
      ],
      [
        t("Malli, konteksti", "Model, context"),
        t("vain kentän rivillä", "composer row only"),
        t("sama", "same"),
        t("sama", "same"),
      ],
      [
        t("Tili ja asetukset", "Account and settings"),
        t("kaistan alin kuva", "strip bottom avatar"),
        t("yläpalkin oikea reuna", "top bar, right"),
        t("sivupalkin alareuna", "sidebar bottom"),
      ],
    ],
  ][0];
function review() {
  if (S.bare) return "";
  const m = MAP();
  return `<section class="review"><p class="line"><strong>${S.dir + 1}/3</strong> ${LINES()[S.dir]}</p><div class="review-controls">${btn("pop:map", t("Kartta", "Map"), "map-btn", "", ` aria-expanded="${S.pop === "map"}"`)}<label>${t("Kieli", "Language")} <select id="language"><option value="fi"${S.lang === "fi" ? " selected" : ""}>Suomi</option><option value="en"${S.lang === "en" ? " selected" : ""}>English</option></select></label><label>${t("Teema", "Theme")} <select id="theme"><option value="light"${S.theme === "light" ? " selected" : ""}>${t("Päivä", "Light")}</option><option value="dark"${S.theme === "dark" ? " selected" : ""}>${t("Yö", "Dark")}</option><option value="contrast"${S.theme === "contrast" ? " selected" : ""}>${t("Kontrasti", "Contrast")}</option></select></label></div>${S.pop === "map" ? `<div class="pop map-pop"><table><caption>${t("Missä kukin nykyinen osa nyt asuu", "Where each current element now lives")}</caption><thead><tr><th>${t("Nykyinen", "Current")}</th><th>1</th><th>2</th><th>3</th></tr></thead><tbody>${m.map((r) => `<tr>${r.map((x, i) => (i ? `<td${i === S.dir + 1 ? ' class="hl"' : ""}>${x}</td>` : `<th>${x}</th>`)).join("")}</tr>`).join("")}</tbody></table></div>` : ""}</section>`;
}

function palette() {
  return `<dialog id="palette" aria-label="${t("Hae tai komenna", "Search or command")}"><input id="palette-input" type="search" aria-label="${t("Hae", "Search")}" placeholder="${t("Hae keskusteluja, työtiloja ja komentoja", "Search conversations, workspaces and commands")}"><div class="pal-list"><h3>${t("Keskustelut", "Conversations")}</h3>${C.slice(
    0,
    4,
  )
    .map((c) =>
      btn(
        "open:" + c.id,
        `${tile(c.ws, "xs")}<span>${title(c)}</span><span class="mono muted">${c.ws}</span>`,
        "pal-row",
      ),
    )
    .join("")}<h3>${t("Työtilat", "Workspaces")}</h3>${WS.slice(0, 3)
    .map((w) =>
      btn(
        "ws-page:" + w,
        `${tile(w, "xs")}<span class="mono">${w}</span>`,
        "pal-row",
      ),
    )
    .join(
      "",
    )}<h3>${t("Komennot", "Commands")}</h3>${[t("Uusi keskustelu", "New conversation"), t("Avaa editori", "Open editor"), t("Avaa pääte", "Open terminal"), t("Tee tilannekatsaus nyt", "Make a recap now")].map((x) => btn("noop", `<span>${x}</span>`, "pal-row")).join("")}</div></dialog>`;
}

function render(d) {
  S.dir = d;
  document.documentElement.lang = S.lang;
  document.documentElement.dataset.theme = S.theme;
  document
    .querySelectorAll(".proto-picker-item")
    .forEach(
      (b, i) =>
        (b.textContent = [
          t("1 Kaksi tasoa", "1 Two levels"),
          t("2 Yläpalkki", "2 Top bar"),
          t("3 Työtila kotina", "3 Workspace as home"),
        ][i]),
    );
  requestAnimationFrame(
    () => typeof moveHighlight === "function" && moveHighlight(),
  );
  return `<div class="frame${S.bare ? " bare" : ""}">${review()}${[d1, d2, d3][d]()}</div>${palette()}`;
}
function redraw() {
  stage.innerHTML = render(S.dir);
}
function setPage(p) {
  S.page = p;
  S.pop = null;
  S.drawer = false;
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
  const dlg = document.querySelector("#palette");
  if (dlg?.open) dlg.close();
  if (a === "pop") S.pop = S.pop === arg ? null : arg;
  else if (a === "open") {
    setPage("conv");
    S.current = arg;
    S.tab = "chat";
    if (S.dir === 2) S.ws = conv(arg).ws;
  } else if (a === "dest") setPage(arg);
  else if (a === "scope") {
    S.scope = arg;
    S.pop = null;
  } else if (a === "ws") {
    S.ws = arg;
    S.pop = null;
    const first =
      C.find((c) => c.ws === arg && c.state !== "quiet") ||
      C.find((c) => c.ws === arg);
    setPage("conv");
    S.current = first.id;
  } else if (a === "ws-page") {
    S.ws = arg;
    setPage("workspace");
  } else if (a === "tab") S.tab = arg;
  else if (a === "drawer") S.drawer = !S.drawer;
  else if (a === "drawer-close") S.drawer = false;
  redraw();
  const again = stage.querySelector(`[data-action="${el.dataset.action}"]`);
  again?.focus();
});
stage.addEventListener("change", (e) => {
  if (e.target.id === "language") S.lang = e.target.value;
  if (e.target.id === "theme") S.theme = e.target.value;
  redraw();
});
function openPalette() {
  const dlg = document.querySelector("#palette");
  if (!dlg.open) dlg.showModal();
  dlg.querySelector("input").focus();
}
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openPalette();
  } else if (e.key === "Escape" && (S.pop || S.drawer)) {
    S.pop = null;
    S.drawer = false;
    redraw();
  }
});
if (!params.has("v")) {
  const u = new URL(location);
  u.searchParams.set("v", "1");
  history.replaceState(null, "", u);
}
const variants = [() => render(0), () => render(1), () => render(2)];
