// rail-icons-tuotokset-oma-selain (Jari 22.11.2026): Tuotokset and Oma
// selain both wear the globe today, the two earlier rounds proposed opposite
// fixes, and Agentin käytössä's shield with an exclamation mark reads as a
// warning. This round gives the rail's places one coherent set and shows it
// where it lives: the adaptive rail's three steps (rail-space round 2's icon
// row, tiles and rows), its state badges and tooltips, light and dark, and
// each icon rasterised at 1x and 2x. The axis is the icon idea: A literal
// objects, B what the place does (metaphor), C A's objects with the place's
// idea as a tinted fill (places solid, tools line). "Nyt" is production.
// Everything is drawn on the production 24-unit grid with its 1.8 stroke.
// Synthetic content only.

const stage = document.getElementById("stage");
const Q = new URLSearchParams(location.search);
const S = {
  lang: Q.get("lang") === "en" ? "en" : "fi",
  theme: Q.get("theme") === "dark" ? "dark" : "light",
  scene: ["rest", "usual", "waiting"].includes(Q.get("scene")) ? Q.get("scene") : "usual",
  current: "home",
  menu: false,
  dir: 0,
};
const t = (fi, en) => (S.lang === "fi" ? fi : en);
document.documentElement.dataset.theme = S.theme;
document.documentElement.lang = S.lang;

// ---------- The icon sets ----------
// F marks a tinted area (direction C): the part that carries the place's idea.
const F = (d) => `<path d="${d}" fill="currentColor" fill-opacity=".28" stroke="none"/>`;
const PROD = {
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  folderPlus:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5m-2.5-2.5h5"/>',
  gear: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="M12 8v4M12 15h.01"/>',
  question: '<path d="M9 9a3 3 0 1 1 5 2c-1.3 1-2 1.5-2 3"/><path d="M12 18h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
};
const A = {
  home: PROD.home,
  // A tray with a page in it: what the agent has handed you, private or shared.
  outputs:
    '<path d="M3.5 14h4.2l1.6 2.5h5.4l1.6-2.5h4.2v5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19z"/><path d="M7 14V4.5h6.5L17 8v6"/><path d="M13.5 4.5V8H17"/>',
  // A browser window, the same mark as the conversation row's "selain".
  browser: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18M6.2 6.8h.01M8.8 6.8h.01"/>',
  // A plug: the connected services and folders (the page's "Yhdistä palvelu").
  access: '<path d="M9 2.5V7M15 2.5V7"/><path d="M6 7h12v4a6 6 0 0 1-12 0z"/><path d="M12 17v4.5"/>',
  search: PROD.search,
  explain: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8v.3M12 17h.01"/>',
  newConv: PROD.plus,
  newWs: PROD.folderPlus,
  settings: PROD.gear,
};
const B = {
  // Habitat's own mark: the sun over the arc. Home is the habitat itself.
  home: '<circle cx="12" cy="7" r="2.4"/><path d="M3.5 19.5a8.5 8.5 0 0 1 17 0"/><path d="M2.5 19.5h19"/>',
  // Layers: what accumulates from the conversations.
  outputs: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16 9 4.5 9-4.5"/>',
  // A pointer: hands on the web; the badge says whose.
  browser: '<path d="M6 3v15l4-3.8 2.8 6.3 2.6-1.2-2.8-6.2 5.4-.5z"/>',
  // A hub: what the agent is connected to.
  access:
    '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5.5" r="2"/><circle cx="19" cy="5.5" r="2"/><circle cx="12" cy="20" r="2"/><path d="m6.5 7 3.6 3.4M17.5 7l-3.6 3.4M12 14.6V18"/>',
  search: PROD.search,
  // A question in a speech bubble: the view talks back.
  explain:
    '<path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-7l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z"/><path d="M10 8.6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3M12 13.6h.01"/>',
  newConv: PROD.plus,
  newWs: PROD.folderPlus,
  settings: PROD.gear,
};
const C = {
  home: F("M5 10.2 12 4l7 6.2V21H5z") + PROD.home,
  outputs: F("M3.5 14h4.2l1.6 2.5h5.4l1.6-2.5h4.2v5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 19z") + A.outputs,
  browser: F("M5 4.5h14a2 2 0 0 1 2 2V9H3V6.5a2 2 0 0 1 2-2z") + A.browser,
  access: F("M6 7h12v4a6 6 0 0 1-12 0z") + A.access,
  search: A.search,
  explain: A.explain,
  newConv: A.newConv,
  newWs: A.newWs,
  settings: A.settings,
};
const NOW = {
  home: PROD.home,
  outputs: PROD.globe,
  browser: PROD.globe,
  access: PROD.shield,
  search: PROD.search,
  explain: PROD.question,
  newConv: PROD.plus,
  newWs: PROD.folderPlus,
  settings: PROD.gear,
};
const SETS = [A, B, C, NOW];
const svg = (inner, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
const ic = (name, size) => svg(SETS[S.dir][name], size);

const DIRS = () => [
  {
    name: t("A Esineet", "A Objects"),
    line: t(
      "A Esineet: jokainen paikka on esine, jossa sen sisältö on: lokero, jossa on sivu (Tuotokset), selainikkuna (Oma selain, sama merkki kuin keskustelurivin selain) ja pistoke (Agentin käytössä: yhdistetyt palvelut).",
      "A Objects: each place is the object that holds its content: a tray with a page (Outputs), a browser window (Your browser, the same mark as the conversation row's browser) and a plug (Agent access: the connected services).",
    ),
  },
  {
    name: t("B Merkitykset", "B Meanings"),
    line: t(
      "B Merkitykset: kuvake kertoo, mitä paikka tekee: Habitatin aurinko ja kaari (Etusivu), kertyvät kerrokset (Tuotokset), osoitin (Oma selain: kenen käsi on ohjaimissa) ja napa (Agentin käytössä: mihin agentti on kytketty).",
      "B Meanings: the icon says what the place does: Habitat's sun and arc (Home), accumulating layers (Outputs), a pointer (Your browser: whose hand is on the controls) and a hub (Agent access: what the agent is wired to).",
    ),
  },
  {
    name: t("C Kaksisävy", "C Two-tone"),
    line: t(
      "C Kaksisävy: A:n esineet, mutta paikan tunnusosa on sävytetty (katto, lokero, otsikkopalkki, pistokkeen runko): paikat erottuvat massallaan, työkalut (haku, Selitä, uusi) jäävät viivoiksi.",
      "C Two-tone: A's objects with the place's defining part tinted (roof, tray, title bar, plug body): places stand out by their mass, tools (search, Explain, new) stay line.",
    ),
  },
  {
    name: t("Nyt", "Today"),
    line: t(
      "Nyt: tuotannon kuvakkeet vertailuksi: Tuotokset ja Oma selain ovat sama maapallo, Agentin käytössä kilpi ja huutomerkki.",
      "Today: production's icons for comparison: Outputs and Your browser share one globe, Agent access is a shield with an exclamation mark.",
    ),
  },
];

// ---------- Places and their states ----------
const SCENES = () => ({
  rest: t("Levossa", "At rest"),
  usual: t("Tavallinen: 1 uusi tuotos, agentti selaimessa", "Usual: 1 new output, agent in the browser"),
  waiting: t("Sinua odotetaan: selain ja yhteys pyytävät", "Waiting for you: browser and a connection ask"),
});
function places() {
  const s = S.scene;
  const outputsN = s === "usual" ? 1 : s === "waiting" ? 3 : 0;
  const browser = s === "usual" ? "agent" : s === "waiting" ? "ask" : undefined;
  const access = s === "waiting" ? "ask" : undefined;
  const stateWord = {
    agent: t("Agentti työssä", "Agent working"),
    ask: t("Odottaa sinua", "Waiting for you"),
  };
  const newWord = (n) => t(n === 1 ? "1 uusi" : `${n} uutta`, n === 1 ? "1 new" : `${n} new`);
  return [
    { id: "home", label: t("Etusivu", "Home"), tip: t("Etusivu", "Home") },
    {
      id: "outputs",
      label: t("Tuotokset", "Outputs"),
      count: outputsN || undefined,
      small: outputsN ? newWord(outputsN) : undefined,
      tip: t("Tuotokset", "Outputs") + (outputsN ? ` · ${newWord(outputsN)}` : ""),
    },
    {
      id: "browser",
      label: t("Oma selain", "Your browser"),
      state: browser,
      small: browser ? stateWord[browser] : undefined,
      tip:
        t("Oma selain", "Your browser") +
        (browser === "ask"
          ? t(" · odottaa sinua: vahvista kirjautuminen", " · waiting for you: confirm the sign-in")
          : browser
            ? t(" · agentti työssä: Kirjanpito", " · agent working: Ledger")
            : ""),
    },
    {
      id: "access",
      label: t("Agentin käytössä", "Agent access"),
      state: access,
      small: access ? t("1 yhteys odottaa", "1 connection waits") : undefined,
      tip:
        t("Agentin käytössä", "Agent access") +
        (access ? t(" · GitHub-yhteys odottaa kirjautumista", " · the GitHub connection needs a sign-in") : t(" · palvelut ja kansiot", " · services and folders")),
    },
  ];
}
const searchTip = () => t("Hae keskusteluista (Ctrl+K)", "Search conversations (Ctrl+K)");

// ---------- Pieces ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// A visible tooltip as production's (below or beside, on hover and focus);
// the accessible name is the same text.
const tip = (text) => `<span class="rit-tip" role="tooltip">${esc(text)}</span>`;
function badges(p, step) {
  let h = "";
  if (p.count && step === 0) h += `<span class="rit-count" aria-hidden="true">${p.count}</span>`;
  if (p.state) h += `<span class="rit-dot" data-state="${p.state}" aria-hidden="true"></span>`;
  return h;
}
function head(step) {
  const ps = places();
  if (step === 0) {
    const items = [...ps, { id: "search", label: t("Haku", "Search"), tip: searchTip() }];
    return `<div class="rit-head rit-icons" role="toolbar" aria-label="${t("Paikat ja haku", "Places and search")}">${items
      .map(
        (p) =>
          `<button type="button" class="rit-icon-item" data-place="${p.id}" data-state="${p.state || ""}" aria-label="${esc(p.tip)}"${p.id === S.current ? ' aria-current="page"' : ""}><span class="rit-mark">${ic(p.id)}${badges(p, 0)}</span>${tip(p.tip)}</button>`,
      )
      .join("")}</div>`;
  }
  const cls = step === 1 ? "rit-tile" : "rit-row";
  return `<div class="rit-head ${step === 1 ? "rit-tiles" : "rit-rows"}">${ps
    .map(
      (p) =>
        `<button type="button" class="${cls}" data-place="${p.id}" data-state="${p.state || ""}" aria-label="${esc(p.tip)}"${p.id === S.current ? ' aria-current="page"' : ""}><span class="rit-mark">${ic(p.id)}${badges(p, step)}</span><span class="rit-label"><b>${esc(p.label)}</b>${step === 1 && p.small ? `<small>${esc(p.small)}</small>` : ""}</span>${step === 2 && p.count ? `<span class="rit-count rit-count-inline" aria-hidden="true">${p.count}</span>` : ""}${step === 2 && p.state ? `<small class="rit-state">${esc(p.small)}</small>` : ""}${tip(p.tip)}</button>`,
    )
    .join("")}</div><button type="button" class="rit-door" data-place="search" aria-label="${esc(searchTip())}">${ic("search", 16)}<span>${t("Hae keskusteluista", "Search conversations")}</span><kbd>Ctrl+K</kbd></button>`;
}
const CONVS = () => [
  ["turn", t("Kevään kurssikalenteri", "Spring course calendar"), "koti", t("Sinun vuorosi", "Your turn")],
  ["run", t("Koontiversion hidastuminen", "Slower build"), "rakennus", t("Työskentelee", "Working")],
];
const WS = ["koti", "kirjanpito", "rakennus"];
function rail(step) {
  const caps = [
    t("Kuvakkeet · matala näyttö", "Icons · short screen"),
    t("Ruudut · keskikorkea", "Tiles · medium height"),
    t("Rivit · korkea näyttö", "Rows · tall screen"),
  ];
  const ws = WS[0];
  return `<section class="rit-col" data-step="${step}" aria-label="${caps[step]}"><h3 class="rit-cap">${caps[step]}</h3><nav class="rit-rail" aria-label="${t("Sivupalkki", "Rail")}">
  <header class="rit-title"><strong>Example Habitat</strong><span class="rit-ok" title="${t("Yhdistetty", "Connected")}"></span></header>
  ${head(step)}
  <div class="rit-sec"><h4>${t("Sinun vuorosi ja käynnissä", "Your turn and running")}</h4><ul>${CONVS()
    .map(([k, title, w, word]) => `<li class="rit-conv"><span class="rit-cdot" data-k="${k}" role="img" aria-label="${word}"></span><span><b>${esc(title)}</b><small>${w} · ${word}</small></span></li>`)
    .join("")}</ul></div>
  <div class="rit-sec rit-ws"><h4>${t("Työtilat", "Workspaces")} <span class="rit-n">18</span><button type="button" class="rit-ib" data-act="newWs" aria-label="${t("Uusi työtila", "New workspace")}">${ic("newWs", 16)}${tip(t("Uusi työtila", "New workspace"))}</button></h4><ul>${WS.map(
    (w, i) =>
      `<li class="rit-wsrow${i === 0 ? " is-hover" : ""}"><span class="rit-glyph" style="--h:${i * 97 + 30}">${w.slice(0, 2).toUpperCase()}</span><b>${w}</b>${i === 0 ? `<button type="button" class="rit-ib" data-act="newConv" aria-label="${t(`Uusi keskustelu: ${ws}`, `New conversation: ${ws}`)}">${ic("newConv", 16)}${tip(t(`Uusi keskustelu: ${ws}`, `New conversation: ${ws}`))}</button>` : ""}</li>`,
  ).join("")}</ul></div>
  <footer class="rit-shelf"><button type="button" class="rit-person" data-act="menu" aria-haspopup="menu" aria-expanded="${S.menu && step === 2}" aria-label="${t("Robin Example · tili ja asetukset", "Robin Example · account and settings")}"><span class="rit-avatar" aria-hidden="true">R</span><span>Robin Example</span></button><button type="button" class="rit-ib" data-act="explain" aria-pressed="${S.scene === "waiting"}" aria-label="${t("Selitä tämä näkymä", "Explain this view")}">${ic("explain", 16)}${tip(t("Selitä tämä näkymä", "Explain this view"))}</button>${
    S.menu && step === 2
      ? `<div class="rit-menu" role="menu"><strong>Robin Example</strong><small>robin@example.test</small><button role="menuitem" type="button">${ic("settings", 16)}${t("Asetukset", "Settings")}</button><button role="menuitem" type="button">${ic("explain", 16)}${t("Selitä tämä näkymä", "Explain this view")}</button><button role="menuitem" type="button" class="rit-danger">${svg(PROD.logout, 16)}${t("Kirjaudu ulos", "Sign out")}</button></div>`
      : ""
  }</footer></nav></section>`;
}

// The whole set as a legend: icon, its name and what it says.
const LEGEND = () => [
  ["home", t("Etusivu", "Home")],
  ["outputs", t("Tuotokset", "Outputs")],
  ["browser", t("Oma selain", "Your browser")],
  ["access", t("Agentin käytössä", "Agent access")],
  ["search", t("Haku", "Search")],
  ["explain", t("Selitä", "Explain")],
  ["newConv", t("Uusi keskustelu", "New conversation")],
  ["newWs", t("Uusi työtila", "New workspace")],
  ["settings", t("Asetukset (tilivalikossa)", "Settings (account menu)")],
];

function view(i) {
  S.dir = i;
  const d = DIRS();
  const sc = SCENES();
  return `<div class="rit" data-direction="${i}">
  <header class="rit-bar">
    <h1>${t("Sivupalkin paikkojen kuvakkeet", "The rail's place icons")}</h1>
    <ul class="rit-lines">${d.map((x, j) => `<li${j === i ? " aria-current=\"true\"" : ""}>${esc(x.line)}</li>`).join("")}</ul>
    <p class="rit-rec">${t(
      "Suositus: A Esineet. Esine on nopein tunnistaa ilman nimeä, selainikkuna on sama merkki kuin keskustelurivin selainmerkki, ja sarja pysyy tuotannon viivatyylissä. C:n sävytys on hyvä varaus, jos 16 px koossa tarvitaan lisää massaa; B:n merkitykset pitää opetella.",
      "Recommended: A Objects. An object is the fastest to recognise without its label, the browser window is the same mark as the conversation row's browser mark, and the set stays in production's line style. C's tint is a good reserve if 16 px needs more mass; B's meanings have to be learnt.",
    )}</p>
    <div class="rit-controls">
      <label>${t("Tilanne", "Situation")} <select data-ctl="scene">${Object.entries(sc).map(([k, v]) => `<option value="${k}"${k === S.scene ? " selected" : ""}>${v}</option>`).join("")}</select></label>
      <span class="rit-seg" role="group" aria-label="${t("Teema", "Theme")}">${[["light", t("Päivä", "Day")], ["dark", t("Yö", "Night")]].map(([k, v]) => `<button type="button" data-theme-set="${k}" aria-pressed="${S.theme === k}">${v}</button>`).join("")}</span>
      <span class="rit-seg" role="group" aria-label="${t("Kieli", "Language")}">${[["fi", "Suomi"], ["en", "English"]].map(([k, v]) => `<button type="button" data-lang-set="${k}" aria-pressed="${S.lang === k}">${v}</button>`).join("")}</span>
    </div>
  </header>
  <section class="rit-panel" aria-label="${t("Sivupalkissa", "In the rail")}">
    <h2>${t("Sivupalkissa: kolme askelta", "In the rail: three steps")} <small>${t("vie osoitin tai fokus kuvakkeeseen nähdäksesi vihjeen; tilivalikko avautuu rivien askeleessa", "hover or focus an icon for its tooltip; the account menu opens in the rows step")}</small></h2>
    <div class="rit-rails">${rail(0)}${rail(1)}${rail(2)}</div>
  </section>
  <section class="rit-panel" aria-label="${t("Kuvakerivi molemmissa teemoissa", "The icon row in both themes")}">
    <h2>${t("Kuvakerivi päivällä ja yöllä, 1x ja 2x", "The icon row by day and night, 1x and 2x")}</h2>
    <div class="rit-pair">${["light", "dark"].map((th) => `<div class="rit-swatch" data-theme="${th}"><div class="rit-z1">${head(0)}</div><div class="rit-z2">${head(0)}</div></div>`).join("")}</div>
  </section>
  <section class="rit-panel" aria-label="${t("Tarkkuus ja erottuvuus", "Sharpness and distinctness")}">
    <h2>${t("Pikseleinä 1x ja 2x", "As pixels at 1x and 2x")} <small>${t("18 px kuvake rasteroituna ja suurennettuna, päivä ja yö", "the 18 px icon rasterised and magnified, day and night")}</small></h2>
    <div class="rit-px">${LEGEND()
      .map(
        ([k, label]) =>
          `<figure class="rit-pxcell" data-icon="${k}"><div class="rit-pxrow"><canvas data-k="${k}" data-dpr="1" data-th="light"></canvas><canvas data-k="${k}" data-dpr="2" data-th="light"></canvas><canvas data-k="${k}" data-dpr="1" data-th="dark"></canvas><canvas data-k="${k}" data-dpr="2" data-th="dark"></canvas></div><figcaption><span class="rit-real">${ic(k)}</span>${esc(label)}</figcaption></figure>`,
      )
      .join("")}</div>
    <h2>${t("Erottuvuus ilman nimeä", "Distinct without a label")}</h2>
    <p class="rit-dist" data-testid="distinct">${t("Lasketaan…", "Measuring…")}</p>
    <div class="rit-matrix" data-testid="matrix"></div>
  </section>
</div>`;
}
const variants = [0, 1, 2, 3].map((i) => () => view(i));

// ---------- After each render: rasters and the distinctness measure ----------
// The rasters take the rail's background and ink from each theme's tokens.
function colors(th) {
  const el = stage.querySelector(`.rit-swatch[data-theme="${th}"]`);
  const cs = getComputedStyle(el);
  return [cs.getPropertyValue("--ah-rail").trim(), cs.getPropertyValue("--ah-ink").trim()];
}
function raster(name, dpr, bg, fg) {
  const px = 18 * dpr;
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(SETS[S.dir][name], 18).replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" style="color:${fg}" `).replace(/currentColor/g, fg))}`;
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = px;
      const g = c.getContext("2d");
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, px, px);
      }
      g.drawImage(img, 0, 0, px, px);
      res(c);
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}
const SAMPLE = ["home", "outputs", "browser", "access", "search", "explain", "newWs", "settings"];
async function afterMount() {
  const dir = S.dir;
  for (const cv of stage.querySelectorAll("canvas[data-k]")) {
    const [bg, fg] = colors(cv.dataset.th);
    const dpr = Number(cv.dataset.dpr);
    const c = await raster(cv.dataset.k, dpr, bg, fg);
    if (!c || dir !== S.dir) return;
    cv.width = cv.height = 18 * dpr;
    cv.getContext("2d").drawImage(c, 0, 0);
  }
  // Soft overlap of two 1x alpha masks, after centring each on its ink:
  // 100 % means the same picture. The icon row needs every pair well apart.
  const masks = {};
  for (const k of SAMPLE) {
    const c = await raster(k, 1, null, "#000");
    if (!c) return;
    masks[k] = c.getContext("2d").getImageData(0, 0, 18, 18).data;
  }
  if (dir !== S.dir) return;
  const sim = (a, b) => {
    let mn = 0,
      mx = 0;
    for (let i = 3; i < a.length; i += 4) {
      mn += Math.min(a[i], b[i]);
      mx += Math.max(a[i], b[i]);
    }
    return mx ? mn / mx : 0;
  };
  const names = Object.fromEntries(LEGEND());
  let worst = { v: -1 };
  let rows = "";
  const places4 = ["home", "outputs", "browser", "access", "search"];
  rows += `<table><thead><tr><th></th>${places4.map((k) => `<th scope="col" aria-label="${esc(names[k])}">${ic(k, 16)}</th>`).join("")}</tr></thead><tbody>`;
  for (const a of places4) {
    rows += `<tr><th scope="row" aria-label="${esc(names[a])}">${ic(a, 16)}</th>`;
    for (const b of places4) {
      if (a === b) {
        rows += '<td class="rit-self">–</td>';
        continue;
      }
      const v = sim(masks[a], masks[b]);
      if (v > worst.v) worst = { v, a, b };
      rows += `<td data-v="${v.toFixed(3)}" class="${v > 0.6 ? "rit-bad" : v > 0.4 ? "rit-mid" : ""}">${Math.round(v * 100)} %</td>`;
    }
    rows += "</tr>";
  }
  rows += "</tbody></table>";
  stage.querySelector("[data-testid=matrix]").innerHTML = rows;
  const p = stage.querySelector("[data-testid=distinct]");
  p.dataset.worst = worst.v.toFixed(3);
  p.dataset.pair = `${worst.a}/${worst.b}`;
  p.textContent = t(
    `Kuvakerivin lähin pari: ${names[worst.a]} ja ${names[worst.b]}, kuvista päällekkäin ${Math.round(worst.v * 100)} % (100 % = sama kuva; alle 40 % erottuu selvästi).`,
    `The icon row's closest pair: ${names[worst.a]} and ${names[worst.b]}, ${Math.round(worst.v * 100)} % of the pictures overlap (100 % = the same picture; under 40 % reads clearly apart).`,
  );
}
new MutationObserver(() => {
  if (stage.querySelector(".rit")) afterMount();
}).observe(stage, { childList: true });

// ---------- Interaction ----------
function setQuery(k, v) {
  const u = new URL(location);
  u.searchParams.set(k, v);
  history.replaceState(null, "", u);
}
function rerender() {
  stage.innerHTML = variants[S.dir]();
  relabelPicker();
}
function relabelPicker() {
  document.querySelectorAll(".proto-picker-item").forEach((b, i) => {
    b.textContent = DIRS()[i].name;
  });
  window.dispatchEvent(new Event("resize"));
}
let toastTimer;
function toast(text) {
  let el = document.querySelector(".rit-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "rit-toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 1600);
}
stage.addEventListener("click", (e) => {
  const th = e.target.closest(".rit-seg [data-theme-set]");
  if (th) {
    S.theme = th.dataset.themeSet;
    document.documentElement.dataset.theme = S.theme;
    setQuery("theme", S.theme);
    return rerender();
  }
  const lg = e.target.closest(".rit-seg [data-lang-set]");
  if (lg) {
    S.lang = lg.dataset.langSet;
    document.documentElement.lang = S.lang;
    setQuery("lang", S.lang);
    return rerender();
  }
  const pl = e.target.closest(".rit-rail [data-place]");
  if (pl) {
    if (pl.dataset.place === "search") return toast(t("Avaisi haun", "Would open search"));
    S.current = pl.dataset.place;
    return rerender();
  }
  const act = e.target.closest(".rit-rail [data-act]");
  if (act) {
    if (act.dataset.act === "menu") {
      S.menu = !S.menu;
      return rerender();
    }
    return toast(act.getAttribute("aria-label"));
  }
});
stage.addEventListener("change", (e) => {
  if (e.target.matches("[data-ctl=scene]")) {
    S.scene = e.target.value;
    setQuery("scene", S.scene);
    rerender();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.menu) {
    S.menu = false;
    rerender();
  }
});
// The picker re-renders through mount(); keep S.dir in step with it.
requestAnimationFrame(relabelPicker);
