import { catalog } from "../i18n";

// Settings › Tallennustila with the storage-breakdown experiment
// (app/StorageBreakdown.tsx). Group names are plain language; tool names
// and paths appear only behind "Näytä tarkemmin" and in the request the
// agent reads. Host values (paths, sizes, run titles) come in as arguments.

export type CleanupRequest = {
  percent: number;
  used: string;
  bound: string;
  shared: boolean;
  items: { label: string; path: string; size: string; clean: string }[];
  live: string[];
  measured: boolean;
};

const fi = {
  warnTitle: (percent: number) =>
    `Tallennustilasi on lähes täynnä (${percent} %)`,
  warnTitleShared: (percent: number) =>
    `Palvelimen levy on lähes täynnä (${percent} %)`,
  warnBody: (free: string) =>
    `Noin ${free} voidaan vapauttaa ilman, että mitään tärkeää katoaa. Valitse alta, mitä siivotaan, ja pyydä agenttia tekemään se.`,
  warnBodyShared: (free: string) =>
    `Levy on kaikkien käyttäjien yhteinen. Omista tiedostoistasi voidaan vapauttaa noin ${free}.`,
  warnBodyUnmeasured:
    "Erittelyä mitataan vielä. Agentti voi jo nyt etsiä ja siivota uudelleen luotavat tiedostot.",
  now: "Nyt",
  afterShort: "Valinnan jälkeen",
  ofBound: (used: string, bound: string, pct: number) =>
    `${used} / ${bound} · ${pct} %`,
  diskOf: (used: string, bound: string, pct: number) =>
    `Levyllä ${used} / ${bound} · ${pct} %`,
  yourShare: (own: string) => `Mitattu kotihakemistostasi: ${own}`,
  warnLine: "Varoitus 85 %",
  barLabel: (now: string, after: string, bound: string) =>
    `Nyt ${now}, valinnan jälkeen ${after} / ${bound}`,
  belowWarn: "Valinnan jälkeen alle varoitusrajan.",
  stillOver: "Valinnan jälkeenkin yli varoitusrajan.",
  nothingChosen: "Mitään ei ole valittu.",
  freesUp: (n: string) => `Vapauttaa ${n}`,
  legend: {
    others: "Muut tiedostot levyllä",
    kept: "Projektit ja muut tiedostot",
    trash: "Roskakori",
    live: "Käynnissä oleva työ",
    freeable: "Vapautettavissa, ei valittu",
    chosen: "Valittu siivottavaksi",
  } as Record<string, string>,
  measuredAt: (when: string) => `Mitattu ${when}`,
  measuring: "Mitataan…",
  measuringFirst: "Tilaa mitataan ensimmäistä kertaa. Se voi kestää minuutin.",
  incomplete:
    "Kaikkea ei ehditty mitata, joten luvut ovat vähintään näin suuria.",
  readFailed: "Erittelyä ei voitu lukea.",
  remeasure: "Mittaa uudelleen",
  freeable: "Vapautettavissa",
  groups: {
    caches: "Ohjelmointityökalujen välimuistit",
    finished: "Valmiiden töiden jäljet",
    own: "Omien projektien käännöstiedostot",
    live: "Agentin käynnissä olevat työt",
    trash: "Roskakori",
  } as Record<string, string>,
  groupNotes: {
    caches:
      "Työkalut lataavat nämä uudelleen, kun niitä tarvitaan. Seuraava työ voi olla hetken hitaampi.",
    finished:
      "Agentin jo valmistuneista töistä jääneitä käännöstiedostoja. Työ itse on tallessa.",
    own: "Syntyvät uudelleen, kun projekti käännetään seuraavan kerran. Ei valittu oletuksena.",
    live: "Agentti käyttää näitä juuri nyt. Ne vapautuvat, kun työt valmistuvat.",
    trash: "Vapautuu, kun tyhjennät roskakorin alempana.",
  } as Record<string, string>,
  partial: (n: string, all: string) => `valittu ${n} / ${all}`,
  more: "Näytä tarkemmin",
  less: "Piilota tarkemmat",
  detailsNote: "Kansiot, joista ryhmä koostuu. Voit valita ne myös yksitellen.",
  items: {
    "go-build": "Go-käännösvälimuisti",
    "go-mod": "Go-moduulit",
    npm: "npm-välimuisti",
    cargo: "Cargo-rekisteri",
    playwright: "Playwright-selaimet",
    uv: "uv-välimuisti",
    pip: "pip-välimuisti",
    "cache-tag": "Muu välimuisti",
    target: "Rust target",
    node_modules: "node_modules",
  } as Record<string, string>,
  runLive: (title: string) =>
    title ? `työ käynnissä: ${title}` : "työ käynnissä",
  runEnded: "työ valmis",
  merged: "yhdistetty",
  ownCheckout: "oma projekti",
  emptyTrashBelow: "Tyhjennä alempana",
  askAgent: "Pyydä agenttia siivoamaan…",
  askAgentSelected: (n: string) => `Pyydä agenttia siivoamaan valitut (${n})…`,
  dialogTitle: "Pyydä agenttia siivoamaan",
  dialogNote:
    "Pyyntö avautuu uuden keskustelun kenttään. Se lähtee agentille vasta, kun lähetät sen.",
  convIn: "Työtila",
  convInNote:
    "Agentti siivoaa koko kotihakemistosta. Työtila on vain paikka, jossa keskustelu näkyy.",
  request: "Pyyntö",
  open: "Avaa keskustelu",
  cancel: "Peru",
  cannotOpen:
    "Keskustelua ei voitu vielä aloittaa. Pyyntö odottaa työtilan uuden keskustelun kentässä.",
  noWorkspace: "Keskustelu tarvitsee työtilan. Lisää ensin työtila.",
  requestText: (r: CleanupRequest) => {
    const head = r.shared
      ? `Palvelimen yhteinen levy on ${r.percent} % täynnä (${r.used} / ${r.bound}). Vapauta tilaa omista tiedostoistani.`
      : `Tallennustilani on ${r.percent} % täynnä (${r.used} / ${r.bound}).`;
    if (!r.measured)
      return `${head} Etsi kotihakemistostani uudelleen luotavat välimuistit (esimerkiksi Go, npm, Cargo, Playwright, pip ja uv) sekä valmiiden worktreiden käännöshakemistot, kerro niiden koot ja siivoa ne työkalujen omilla komennoilla.

Älä koske käynnissä olevien workerien worktreihin, lähdekoodiin, git-historiaan äläkä roskakoriin. Kerro lopuksi, paljonko tilaa vapautui.`;
    const list = r.items
      .map((i) => `- ${i.label} ${i.path} (${i.size}): ${i.clean}`)
      .join("\n");
    const live = r.live.length
      ? `\n\nÄlä koske käynnissä olevien workerien hakemistoihin:\n${r.live.map((p) => `- ${p}`).join("\n")}`
      : "";
    return `${head} Siivoa nämä uudelleen luotavat välimuistit ja käännöshakemistot:
${list}${live}

Älä poista lähdekoodia, git-historiaa äläkä roskakoria. Jos jokin näistä on muuttunut mittauksen jälkeen käyttöön, jätä se ja kerro miksi. Kerro lopuksi, paljonko tilaa vapautui.`;
  },
  cleanRm: "poista hakemisto",
};

export const storageBreakdownText = catalog(fi, {
  warnTitle: (percent) => `Your storage is nearly full (${percent} %)`,
  warnTitleShared: (percent) => `The server disk is nearly full (${percent} %)`,
  warnBody: (free) =>
    `About ${free} can be freed without losing anything important. Choose below what to clean up and ask an agent to do it.`,
  warnBodyShared: (free) =>
    `The disk is shared by all users. About ${free} of your own files can be freed.`,
  warnBodyUnmeasured:
    "The breakdown is still being measured. An agent can already find and clean up regenerable files.",
  now: "Now",
  afterShort: "After the selection",
  ofBound: (used, bound, pct) => `${used} / ${bound} · ${pct} %`,
  diskOf: (used, bound, pct) => `On the disk ${used} / ${bound} · ${pct} %`,
  yourShare: (own) => `Measured in your home: ${own}`,
  warnLine: "Warning 85 %",
  barLabel: (now, after, bound) =>
    `Now ${now}, after the selection ${after} / ${bound}`,
  belowWarn: "Below the warning line after the selection.",
  stillOver: "Still over the warning line after the selection.",
  nothingChosen: "Nothing is selected.",
  freesUp: (n) => `Frees ${n}`,
  legend: {
    others: "Other files on the disk",
    kept: "Projects and other files",
    trash: "Trash",
    live: "Work in progress",
    freeable: "Freeable, not selected",
    chosen: "Selected for clean-up",
  },
  measuredAt: (when) => `Measured ${when}`,
  measuring: "Measuring…",
  measuringFirst:
    "Storage is being measured for the first time. This can take a minute.",
  incomplete:
    "Not everything could be measured in time, so the figures are at least this large.",
  readFailed: "The breakdown could not be read.",
  remeasure: "Measure again",
  freeable: "Freeable",
  groups: {
    caches: "Programming tools' caches",
    finished: "Leftovers from finished work",
    own: "Build files in your projects",
    live: "Agent work in progress",
    trash: "Trash",
  },
  groupNotes: {
    caches:
      "Tools download these again when they need them. The next job may be a little slower.",
    finished:
      "Build files left from the agent's finished work. The work itself is kept.",
    own: "They come back the next time the project is built. Not selected by default.",
    live: "The agent is using these right now. They are freed when the work finishes.",
    trash: "Freed when you empty the Trash below.",
  },
  partial: (n, all) => `selected ${n} / ${all}`,
  more: "Show details",
  less: "Hide details",
  detailsNote:
    "The folders this group is made of. You can also select them one by one.",
  items: {
    "go-build": "Go build cache",
    "go-mod": "Go modules",
    npm: "npm cache",
    cargo: "Cargo registry",
    playwright: "Playwright browsers",
    uv: "uv cache",
    pip: "pip cache",
    "cache-tag": "Other cache",
    target: "Rust target",
    node_modules: "node_modules",
  },
  runLive: (title) => (title ? `work running: ${title}` : "work running"),
  runEnded: "work finished",
  merged: "merged",
  ownCheckout: "your project",
  emptyTrashBelow: "Empty below",
  askAgent: "Ask an agent to clean up…",
  askAgentSelected: (n) => `Ask an agent to clean up the selected (${n})…`,
  dialogTitle: "Ask an agent to clean up",
  dialogNote:
    "The request opens in a new conversation's field. It goes to the agent only when you send it.",
  convIn: "Workspace",
  convInNote:
    "The agent cleans up across your home directory. The workspace is only where the conversation shows.",
  request: "Request",
  open: "Open the conversation",
  cancel: "Cancel",
  cannotOpen:
    "The conversation could not start yet. The request waits in the workspace's new conversation field.",
  noWorkspace: "A conversation needs a workspace. Add a workspace first.",
  requestText: (r) => {
    const head = r.shared
      ? `The server's shared disk is ${r.percent} % full (${r.used} / ${r.bound}). Free space from my own files.`
      : `My storage is ${r.percent} % full (${r.used} / ${r.bound}).`;
    if (!r.measured)
      return `${head} Find the regenerable caches in my home directory (for example Go, npm, Cargo, Playwright, pip and uv) and the build directories of finished worktrees, tell me their sizes and clean them up with the tools' own commands.

Do not touch running workers' worktrees, source code, Git history or the Trash. Tell me at the end how much space was freed.`;
    const list = r.items
      .map((i) => `- ${i.label} ${i.path} (${i.size}): ${i.clean}`)
      .join("\n");
    const live = r.live.length
      ? `\n\nDo not touch the directories of running workers:\n${r.live.map((p) => `- ${p}`).join("\n")}`
      : "";
    return `${head} Clean up these regenerable caches and build directories:
${list}${live}

Do not remove source code, Git history or the Trash. If any of these has come into use since it was measured, leave it and tell me why. Tell me at the end how much space was freed.`;
  },
  cleanRm: "remove the directory",
});
