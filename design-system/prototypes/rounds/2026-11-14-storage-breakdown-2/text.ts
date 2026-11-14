// The round's own words, Finnish and English. Production's Storage view
// (Trash, Worktrees) keeps its own catalogs and follows the same switch.
// Group names are plain language; tool names and paths appear only behind
// "Näytä tarkemmin" and in the request the agent reads.
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
  title: 'Tallennustila · kierros 2 (B:n muunnelmat)',
  scenario: 'Tilanne',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  scenarios: {
    varoitus: 'Yli 85 %: varoitus (oletus)',
    normaali: 'Alle 85 %: siivottu, työt yhä käynnissä',
    mitataan: 'Ensimmäinen mittaus kesken',
    jaettu: 'Ei käyttäjäkohtaisia rajoja: yhteinen levy lähes täynnä',
  } as Record<string, string>,
  roundLine: 'Pohjana B Vapautettavissa. Sama kaikissa: ryhmät arkikielellä ja kokoineen, kansiot ja polut kunkin ryhmän Näytä tarkemmin -kohdan takana, ja palkki, joka näyttää valinnan vaikutuksen rajaan ja 85 %:n varoitusrajaan. Muunnelmat eroavat siinä, miten palkki ja valintalista yhdistyvät.',
  lines: [
    'B1 Esikatselu: yksi iso palkki listan yläpuolella. Valittu osa korostuu palkin päässä raidallisena, ja palkin yllä lukee nyt → valinnan jälkeen. Lista on tavallinen valintalista.',
    'B2 Palkkivalinta: palkin osat ovat itse valintoja. Ryhmä valitaan napauttamalla sen osaa palkissa. Pienet osat on suurennettu napautettaviksi, ja palkin alla on selitys ilman valintaruutuja.',
    'B3 Ennen ja jälkeen: tiivis yhteenveto, jossa on kaksi ohutta palkkia päällekkäin, Nyt ja Siivouksen jälkeen. Yhteenveto pysyy näkyvissä listaa vieritettäessä. Lista on tavallinen valintalista.',
  ],
  recommend: 'Suositus: B1. Yksi palkki näyttää samassa kuvassa, mitä on käytössä, mitä valinta vapauttaa ja missä raja ja varoitusraja ovat, ja valintalista toimii puhelimellakin. B2 on suorin, mutta pienet ryhmät on suurennettava, jolloin palkki ei enää ole mittakaavassa, eikä palkin osan napauttaminen ole tuttu tapa valita. B3:n kaksi palkkia näyttävät eron selvästi, mutta vertailu vie silmältä kaksi kertaa tilaa ja värit jäävät pieniksi.',
  // Warning
  warnTitle: (percent: number) => `Tallennustilasi on lähes täynnä (${percent} %)`,
  warnTitleShared: (percent: number) => `Palvelimen levy on lähes täynnä (${percent} %)`,
  warnBody: (free: string) => `Noin ${free} voidaan vapauttaa ilman, että mitään tärkeää katoaa. Valitse alta, mitä siivotaan, ja pyydä agenttia tekemään se.`,
  warnBodyShared: (free: string) => `Levy on kaikkien käyttäjien yhteinen. Omista tiedostoistasi voidaan vapauttaa noin ${free}.`,
  warnBodyUnmeasured: 'Erittelyä mitataan vielä. Agentti voi jo nyt etsiä ja siivota uudelleen luotavat tiedostot.',
  // Usage and preview
  now: 'Nyt',
  after: 'Siivouksen jälkeen',
  afterShort: 'Valinnan jälkeen',
  ofBound: (used: string, bound: string, pct: number) => `${used} / ${bound} · ${pct} %`,
  diskOf: (used: string, bound: string, pct: number) => `Levyllä ${used} / ${bound} · ${pct} %`,
  yourShare: (own: string) => `Sinun tiedostosi: ${own}`,
  limit: 'Raja',
  warnLine: 'Varoitus 85 %',
  belowWarn: 'Valinnan jälkeen alle varoitusrajan.',
  stillOver: 'Valinnan jälkeenkin yli varoitusrajan.',
  nothingChosen: 'Mitään ei ole valittu.',
  freesUp: (n: string) => `Vapauttaa ${n}`,
  legend: {
    others: 'Muiden käyttäjien tiedostot',
    kept: 'Projektit ja muut tiedostot',
    trash: 'Roskakori',
    live: 'Käynnissä oleva työ',
    freeable: 'Vapautettavissa, ei valittu',
    chosen: 'Valittu siivottavaksi',
  } as Record<string, string>,
  tapHint: 'Napauta palkin osaa valitaksesi sen siivottavaksi tai jättääksesi sen.',
  enlarged: 'Pienet osat on suurennettu, jotta niitä voi napauttaa.',
  phoneKey: 'Osien nimet ovat palkin alla.',
  segPressed: 'valittu siivottavaksi',
  segNot: 'ei valittu',
  measuredAt: (when: string) => `Mitattu ${when}`,
  measuring: 'Mitataan…',
  measuringFirst: 'Tilaa mitataan ensimmäistä kertaa. Se voi kestää minuutin.',
  remeasure: 'Mittaa uudelleen',
  today: (time: string) => `tänään klo ${time}`,
  // Groups, plain language
  freeable: 'Vapautettavissa',
  groups: {
    caches: 'Ohjelmointityökalujen välimuistit',
    finished: 'Valmiiden töiden jäljet',
    own: 'Omien projektien käännöstiedostot',
    live: 'Agentin käynnissä olevat työt',
    trash: 'Roskakori',
  } as Record<string, string>,
  short: {
    caches: 'Välimuistit',
    finished: 'Valmiit työt',
    own: 'Omat käännökset',
    live: 'Käynnissä',
    kept: 'Muut tiedostot',
  } as Record<string, string>,
  groupNotes: {
    caches: 'Työkalut lataavat nämä uudelleen, kun niitä tarvitaan. Seuraava työ voi olla hetken hitaampi.',
    finished: 'Agentin jo valmistuneista töistä jääneitä käännöstiedostoja. Työ itse on tallessa.',
    own: 'Syntyvät uudelleen, kun projekti käännetään seuraavan kerran. Ei valittu oletuksena.',
    live: 'Agentti käyttää näitä juuri nyt. Ne vapautuvat, kun työt valmistuvat.',
    trash: 'Vapautuu, kun tyhjennät roskakorin alempana.',
  } as Record<string, string>,
  partial: (n: string, all: string) => `valittu ${n} / ${all}`,
  more: 'Näytä tarkemmin',
  less: 'Piilota tarkemmat',
  detailsNote: 'Kansiot, joista ryhmä koostuu. Voit valita ne myös yksitellen.',
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
  runLive: (title: string) => `työ käynnissä: ${title}`,
  runEnded: 'työ valmis',
  merged: 'yhdistetty',
  ownCheckout: 'pääkopio',
  emptyTrashBelow: 'Tyhjennä alempana',
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
};

const en: typeof fi = {
  title: 'Storage · round 2 (variations of B)',
  scenario: 'Situation',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  scenarios: {
    varoitus: 'Over 85 %: warning (default)',
    normaali: 'Under 85 %: cleaned, work still running',
    mitataan: 'First measurement in progress',
    jaettu: 'No per-user limits: shared disk nearly full',
  },
  roundLine: 'Based on B Freeable. The same in all: plain-language groups with sizes, folders and paths behind each group\'s Show details, and a bar that shows what the selection does against the limit and the 85 % warning line. The variations differ in how the bar and the checklist combine.',
  lines: [
    'B1 Preview: one large bar above the list. The selected part is highlighted, striped, at the end of the bar, and above it reads now → after the selection. The list is an ordinary checklist.',
    'B2 Bar picks: the bar\'s parts are the selection. A group is selected by tapping its part of the bar. Small parts are enlarged to be tappable, and a key without checkboxes sits under the bar.',
    'B3 Before and after: a compact summary with two thin bars, Now and After clean-up, one above the other. The summary stays in view while the list scrolls. The list is an ordinary checklist.',
  ],
  recommend: 'Recommendation: B1. One bar shows in one picture what is in use, what the selection frees and where the limit and the warning line are, and the checklist works on a phone too. B2 is the most direct, but small groups must be enlarged, so the bar is no longer to scale, and tapping part of a bar is not a familiar way to select. B3\'s two bars show the difference clearly, but the comparison takes twice the room and the colours stay small.',
  warnTitle: (percent) => `Your storage is nearly full (${percent} %)`,
  warnTitleShared: (percent) => `The server disk is nearly full (${percent} %)`,
  warnBody: (free) => `About ${free} can be freed without losing anything important. Choose below what to clean up and ask an agent to do it.`,
  warnBodyShared: (free) => `The disk is shared by all users. About ${free} of your own files can be freed.`,
  warnBodyUnmeasured: 'The breakdown is still being measured. An agent can already find and clean up regenerable files.',
  now: 'Now',
  after: 'After clean-up',
  afterShort: 'After the selection',
  ofBound: (used, bound, pct) => `${used} / ${bound} · ${pct} %`,
  diskOf: (used, bound, pct) => `On the disk ${used} / ${bound} · ${pct} %`,
  yourShare: (own) => `Your files: ${own}`,
  limit: 'Limit',
  warnLine: 'Warning 85 %',
  belowWarn: 'Below the warning line after the selection.',
  stillOver: 'Still over the warning line after the selection.',
  nothingChosen: 'Nothing is selected.',
  freesUp: (n) => `Frees ${n}`,
  legend: {
    others: 'Other users\' files',
    kept: 'Projects and other files',
    trash: 'Trash',
    live: 'Work in progress',
    freeable: 'Freeable, not selected',
    chosen: 'Selected for clean-up',
  },
  tapHint: 'Tap a part of the bar to select it for clean-up or to keep it.',
  enlarged: 'Small parts are enlarged so they can be tapped.',
  phoneKey: 'The parts are named under the bar.',
  segPressed: 'selected for clean-up',
  segNot: 'not selected',
  measuredAt: (when) => `Measured ${when}`,
  measuring: 'Measuring…',
  measuringFirst: 'Storage is being measured for the first time. This can take a minute.',
  remeasure: 'Measure again',
  today: (time) => `today at ${time}`,
  freeable: 'Freeable',
  groups: {
    caches: 'Programming tools\' caches',
    finished: 'Leftovers from finished work',
    own: 'Build files in your projects',
    live: 'Agent work in progress',
    trash: 'Trash',
  },
  short: {
    caches: 'Caches',
    finished: 'Finished work',
    own: 'Own builds',
    live: 'In progress',
    kept: 'Other files',
  },
  groupNotes: {
    caches: 'Tools download these again when they need them. The next job may be a little slower.',
    finished: 'Build files left from the agent\'s finished work. The work itself is kept.',
    own: 'They come back the next time the project is built. Not selected by default.',
    live: 'The agent is using these right now. They are freed when the work finishes.',
    trash: 'Freed when you empty the Trash below.',
  },
  partial: (n, all) => `selected ${n} / ${all}`,
  more: 'Show details',
  less: 'Hide details',
  detailsNote: 'The folders this group is made of. You can also select them one by one.',
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
  runLive: (title) => `work running: ${title}`,
  runEnded: 'work finished',
  merged: 'merged',
  ownCheckout: 'main checkout',
  emptyTrashBelow: 'Empty below',
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
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
