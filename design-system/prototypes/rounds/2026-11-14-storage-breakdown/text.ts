// The round's own words, Finnish and English. Production's Storage view
// (Trash, Worktrees) keeps its own catalogs and follows the same switch.
export type Lang = 'fi' | 'en';

type Req = {
  percent: number;
  used: string;
  bound: string;
  shared: boolean;
  items: {label: string; path: string; size: string; clean: string}[];
  live: string[];
  measured: boolean;
};

const fi = {
  // Review chrome
  title: 'Tallennustilan erittely · kierros 1',
  scenario: 'Tilanne',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  scenarios: {
    varoitus: 'Yli 85 %: varoitus (oletus)',
    normaali: 'Alle 85 %: siivottu, workerit yhä käynnissä',
    mitataan: 'Ensimmäinen mittaus kesken',
    jaettu: 'Ei käyttäjäkohtaisia rajoja: yhteinen levy lähes täynnä',
  } as Record<string, string>,
  roundLine: 'Sama kaikissa: yli 85 %:ssa varoitus näkyy Tallennustilan alussa. Erittely näyttää tunnetut välimuistit, worktreiden käännöshakemistot (käynnissä oleva worker vai valmis), roskakorin, työtilat ja agentin historian. Pyydä agenttia siivoamaan -painike avaa uuden keskustelun valmiilla pyynnöllä, joka jättää käynnissä olevat workerit rauhaan.',
  lines: [
    'A Pylväs: tuotannon käyttöpalkki jaetaan ryhmiin, ja jokaisen ryhmän voi avata. Siivouspainike on kortin alalaidassa.',
    'B Vapautettavissa: ensimmäisenä on lista siitä, mikä voidaan poistaa, valintaruutuineen ja summineen. Pyyntöön tulee vain valittu. Muu käyttö on tiivis palkki listan alla.',
    'C Kansioittain: yksi suurimmasta pienimpään lajiteltu kansiotaulukko, jossa jokaisella rivillä on laji, kuten välimuisti, käännöshakemisto tai työtila. Siivouspainike on taulukon yläpuolella.',
  ],
  recommend: 'Suositus: B. Varoitus kysyy, mitä voi vapauttaa. B vastaa siihen ensimmäisellä rivillä luvulla, ja pyyntö sisältää juuri sen, minkä ihminen näki ja valitsi. Käynnissä olevien workerien hakemistot näkyvät listassa, mutta niitä ei voi valita. A on lähimpänä nykyistä näkymää, mutta siinä vapautettava tila jää avattavien ryhmien sisään. C kertoo, missä tila on, mutta ei sitä, mitä saa poistaa.',
  // Warning
  warnTitle: (percent: number) => `Tallennustilasi on lähes täynnä (${percent} %)`,
  warnTitleShared: (percent: number) => `Palvelimen levy on lähes täynnä (${percent} %)`,
  warnBody: (free: string) => `Uudelleen luotavista välimuisteista ja valmiiden worktreiden käännöshakemistoista voi vapauttaa noin ${free}. Agentti voi siivota ne puolestasi.`,
  warnBodyShared: (free: string) => `Levy on kaikkien käyttäjien yhteinen. Omista tiedostoistasi voi vapauttaa noin ${free} välimuisteista ja valmiiden worktreiden käännöshakemistoista.`,
  warnBodyUnmeasured: 'Erittelyä mitataan vielä. Agentti voi jo nyt etsiä ja siivota uudelleen luotavat välimuistit.',
  // Usage
  usedOf: (used: string, bound: string) => `${used} / ${bound}`,
  sharedOf: (used: string, bound: string, free: string) => `Levyllä ${free} vapaana (${used} / ${bound} käytössä kaikilla yhteensä)`,
  yourShare: (own: string) => `Sinun tiedostosi: ${own}`,
  measuredAt: (when: string) => `Erittely mitattu ${when}`,
  measuring: 'Mitataan erittelyä…',
  measuringFirst: 'Erittelyä mitataan ensimmäistä kertaa. Kotihakemiston läpikäynti voi kestää minuutin.',
  remeasure: 'Mittaa uudelleen',
  today: (time: string) => `tänään klo ${time}`,
  // Groups
  groups: {
    caches: 'Uudelleen luotavat välimuistit',
    finished: 'Valmiiden worktreiden käännöshakemistot',
    live: 'Käynnissä olevien workerien käännöshakemistot',
    own: 'Työtilojen omat käännöshakemistot',
    trash: 'Roskakori',
    workspaces: 'Työtilat',
    history: 'Agentin historia',
    other: 'Muu kotihakemistossa',
  } as Record<string, string>,
  groupNotes: {
    caches: 'Työkalut lataavat tai kääntävät nämä uudelleen tarvittaessa. Seuraava käännös on hitaampi.',
    finished: 'Worker on valmis tai worktree yhdistetty. Hakemisto syntyy uudelleen, jos worktreessä käännetään.',
    live: 'Worker käyttää näitä nyt. Siivous ei koske niihin.',
    own: 'Työtilan pääkopion käännöshakemisto. Poistetaan vain, jos pyydät erikseen.',
    trash: 'Vapautuu, kun roskakori tyhjennetään alempana.',
    workspaces: 'Lähdekoodi ja muut tiedostot ~/src-kansiossa ilman käännöshakemistoja.',
    history: 'Agenttien keskusteluhistoriat (~/.pi).',
    other: 'Kaikki, mitä erittely ei tunnista.',
  } as Record<string, string>,
  items: {
    'go-build': 'Go-käännösvälimuisti',
    'go-mod': 'Go-moduulit',
    npm: 'npm-välimuisti',
    cargo: 'Cargo-rekisteri',
    playwright: 'Playwright-selaimet',
    uv: 'uv-välimuisti',
    pip: 'pip-välimuisti',
    target: 'Rust target',
    node_modules: 'node_modules',
  } as Record<string, string>,
  runLive: (title: string) => `worker käynnissä: ${title}`,
  runEnded: 'worker valmis',
  merged: 'yhdistetty',
  ownCheckout: 'pääkopio',
  // A
  open: 'Näytä erittely',
  close: 'Piilota erittely',
  // B
  freeable: 'Vapautettavissa',
  freeableNow: (n: string) => `Vapautettavissa ilman keskeneräisen työn häiriintymistä: ${n}`,
  selected: (n: string, all: string) => `Valittu ${n} / ${all}`,
  selectAll: 'Valitse kaikki',
  selectNone: 'Poista valinnat',
  inUse: 'Käytössä',
  inUseNote: 'Näitä ei voi valita, ennen kuin worker on valmis.',
  emptyTrashBelow: 'Tyhjennä alempana',
  restOfUsage: 'Muu käyttö',
  // C
  colPath: 'Kansio',
  colKind: 'Laji',
  colSize: 'Koko',
  kinds: {
    cache: 'Välimuisti',
    live: 'Käännös · worker käynnissä',
    finished: 'Käännös · valmis',
    own: 'Käännös · pääkopio',
    trash: 'Roskakori',
    workspace: 'Työtila',
    history: 'Historia',
    other: 'Muu',
  } as Record<string, string>,
  showAll: (n: number) => `Näytä kaikki (${n})`,
  showFewer: 'Näytä vähemmän',
  // Clean-up
  askAgent: 'Pyydä agenttia siivoamaan…',
  askAgentSelected: (n: string) => `Pyydä agenttia siivoamaan valitut (${n})…`,
  convTitle: 'Uusi keskustelu',
  standIn: 'Sijainen: uuden keskustelun aloitus. Pyyntö on valmiina kentässä, mutta sitä ei lähetetä ennen kuin painat Lähetä.',
  convIn: 'Työtila',
  convInNote: 'Agentti siivoaa koko kotihakemistosta. Työtila on vain paikka, jossa keskustelu näkyy.',
  request: 'Pyyntö',
  send: 'Lähetä',
  cancel: 'Peru',
  sent: (ws: string) => `Prototyyppi: keskustelu avautuisi työtilaan ${ws}, ja pyyntö lähtisi agentille ensimmäisenä viestinä.`,
  nothingSelected: 'Valitse ensin jotain siivottavaa.',
  requestText: (r: Req) => {
    const head = r.shared
      ? `Palvelimen yhteinen levy on ${r.percent} % täynnä (${r.used} / ${r.bound}). Vapauta tilaa omista tiedostoistani.`
      : `Tallennustilani on ${r.percent} % täynnä (${r.used} / ${r.bound}).`;
    if (!r.measured)
      return `${head} Etsi kotihakemistostani uudelleen luotavat välimuistit (esimerkiksi Go, npm, Cargo, Playwright, pip ja uv) sekä valmiiden worktreiden käännöshakemistot, kerro niiden koot ja siivoa ne työkalujen omilla komennoilla.

Älä koske käynnissä olevien workerien worktreihin, lähdekoodiin, git-historiaan äläkä roskakoriin. Kerro lopuksi, paljonko tilaa vapautui.`;
    const list = r.items.map((i) => `- ${i.label} ${i.path} (${i.size}): ${i.clean}`).join('\n');
    const live = r.live.length ? `\n\nÄlä koske käynnissä olevien workerien hakemistoihin:\n${r.live.map((p) => `- ${p}`).join('\n')}` : '';
    return `${head} Siivoa nämä uudelleen luotavat välimuistit ja käännöshakemistot:
${list}${live}

Älä poista lähdekoodia, git-historiaa äläkä roskakoria. Jos jokin näistä on muuttunut mittauksen jälkeen käyttöön, jätä se ja kerro miksi. Kerro lopuksi, paljonko tilaa vapautui.`;
  },
  cleanRm: 'poista hakemisto',
  away: 'Prototyyppi: linkki veisi osoitteeseen',
};

const en: typeof fi = {
  title: 'Storage breakdown · round 1',
  scenario: 'Situation',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  scenarios: {
    varoitus: 'Over 85 %: warning (default)',
    normaali: 'Under 85 %: cleaned, workers still running',
    mitataan: 'First measurement in progress',
    jaettu: 'No per-user limits: shared disk nearly full',
  },
  roundLine: 'The same in all: from 85 % the warning shows at the top of Storage. The breakdown shows known caches, worktrees\' build directories (running worker or finished), the Trash, workspaces and agent history. Ask an agent to clean up opens a new conversation with a ready request that leaves running workers alone.',
  lines: [
    'A Bar: production\'s usage bar is split into groups, and each group opens. The clean-up button sits at the bottom of the card.',
    'B Freeable: first comes a list of what can be removed, with checkboxes and a total. The request carries only what is selected. The rest of the usage is a compact bar under the list.',
    'C By folder: one folder table sorted by size, each row with its kind, such as cache, build directory or workspace. The clean-up button sits above the table.',
  ],
  recommend: 'Recommendation: B. The warning asks what can be freed. B answers that with a number on its first line, and the request carries exactly what the person saw and selected. Running workers\' directories show in the list but cannot be selected. A is closest to the current view, but the freeable space stays inside the groups you have to open. C shows where the space is, not what may go.',
  warnTitle: (percent) => `Your storage is nearly full (${percent} %)`,
  warnTitleShared: (percent) => `The server disk is nearly full (${percent} %)`,
  warnBody: (free) => `About ${free} can be freed from regenerable caches and finished worktrees' build directories. An agent can clean them up for you.`,
  warnBodyShared: (free) => `The disk is shared by all users. About ${free} of your own files can be freed from caches and finished worktrees' build directories.`,
  warnBodyUnmeasured: 'The breakdown is still being measured. An agent can already find and clean up regenerable caches.',
  usedOf: (used, bound) => `${used} / ${bound}`,
  sharedOf: (used, bound, free) => `${free} free on the disk (${used} / ${bound} in use by everyone)`,
  yourShare: (own) => `Your files: ${own}`,
  measuredAt: (when) => `Breakdown measured ${when}`,
  measuring: 'Measuring the breakdown…',
  measuringFirst: 'The breakdown is being measured for the first time. Walking the home directory can take a minute.',
  remeasure: 'Measure again',
  today: (time) => `today at ${time}`,
  groups: {
    caches: 'Regenerable caches',
    finished: 'Finished worktrees\' build directories',
    live: 'Running workers\' build directories',
    own: 'Workspaces\' own build directories',
    trash: 'Trash',
    workspaces: 'Workspaces',
    history: 'Agent history',
    other: 'Other in the home directory',
  },
  groupNotes: {
    caches: 'Tools download or build these again when needed. The next build is slower.',
    finished: 'The worker has finished or the worktree is merged. The directory comes back if the worktree is built again.',
    live: 'A worker is using these now. Clean-up does not touch them.',
    own: 'The build directory of a workspace\'s main checkout. Removed only if you ask for it.',
    trash: 'Freed when the Trash is emptied below.',
    workspaces: 'Source and other files in ~/src, without build directories.',
    history: 'Agents\' conversation histories (~/.pi).',
    other: 'Everything the breakdown does not recognise.',
  },
  items: {
    'go-build': 'Go build cache',
    'go-mod': 'Go modules',
    npm: 'npm cache',
    cargo: 'Cargo registry',
    playwright: 'Playwright browsers',
    uv: 'uv cache',
    pip: 'pip cache',
    target: 'Rust target',
    node_modules: 'node_modules',
  },
  runLive: (title) => `worker running: ${title}`,
  runEnded: 'worker finished',
  merged: 'merged',
  ownCheckout: 'main checkout',
  open: 'Show breakdown',
  close: 'Hide breakdown',
  freeable: 'Freeable',
  freeableNow: (n) => `Freeable without disturbing unfinished work: ${n}`,
  selected: (n, all) => `Selected ${n} / ${all}`,
  selectAll: 'Select all',
  selectNone: 'Clear selection',
  inUse: 'In use',
  inUseNote: 'These cannot be selected until the worker has finished.',
  emptyTrashBelow: 'Empty below',
  restOfUsage: 'Other usage',
  colPath: 'Folder',
  colKind: 'Kind',
  colSize: 'Size',
  kinds: {
    cache: 'Cache',
    live: 'Build · worker running',
    finished: 'Build · finished',
    own: 'Build · main checkout',
    trash: 'Trash',
    workspace: 'Workspace',
    history: 'History',
    other: 'Other',
  },
  showAll: (n) => `Show all (${n})`,
  showFewer: 'Show fewer',
  askAgent: 'Ask an agent to clean up…',
  askAgentSelected: (n) => `Ask an agent to clean up the selected (${n})…`,
  convTitle: 'New conversation',
  standIn: 'Stand-in: starting a new conversation. The request is ready in the field and is not sent until you press Send.',
  convIn: 'Workspace',
  convInNote: 'The agent cleans up across your home directory. The workspace is only where the conversation shows.',
  request: 'Request',
  send: 'Send',
  cancel: 'Cancel',
  sent: (ws) => `Prototype: the conversation would open in ${ws}, and the request would go to the agent as its first message.`,
  nothingSelected: 'Select something to clean up first.',
  requestText: (r) => {
    const head = r.shared
      ? `The server's shared disk is ${r.percent} % full (${r.used} / ${r.bound}). Free space from my own files.`
      : `My storage is ${r.percent} % full (${r.used} / ${r.bound}).`;
    if (!r.measured)
      return `${head} Find the regenerable caches in my home directory (for example Go, npm, Cargo, Playwright, pip and uv) and the build directories of finished worktrees, tell me their sizes and clean them up with the tools' own commands.

Do not touch running workers' worktrees, source code, Git history or the Trash. Tell me at the end how much space was freed.`;
    const list = r.items.map((i) => `- ${i.label} ${i.path} (${i.size}): ${i.clean}`).join('\n');
    const live = r.live.length ? `\n\nDo not touch the directories of running workers:\n${r.live.map((p) => `- ${p}`).join('\n')}` : '';
    return `${head} Clean up these regenerable caches and build directories:
${list}${live}

Do not remove source code, Git history or the Trash. If any of these has come into use since it was measured, leave it and tell me why. Tell me at the end how much space was freed.`;
  },
  cleanRm: 'remove the directory',
  away: 'Prototype: the link would go to',
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
