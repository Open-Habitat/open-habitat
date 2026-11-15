// The round's own words and the three synthetic files, Finnish and English.
// Production pieces (the editor's toolbar words, the start page, the guide
// labels) keep their own catalogs and follow the same language choice. Every
// repository, person, address and request here is invented for the round.

export type Lang = "fi" | "en";
export type Yaml =
  | null
  | boolean
  | number
  | string
  | Yaml[]
  | { [key: string]: Yaml };
export type FileId = "start" | "deep" | "yaml";
export type Doc = { path: string; data: { [key: string]: Yaml }; body?: string };

const fiStart: Doc = {
  path: ".agents/start-page.md",
  data: {
    title: "Tervetuloa pyöräseuran sivustolle",
    goals: [
      {
        title: "Tutustu sivustoon",
        what: "Tiedät, mistä sivut, tapahtumakalenteri ja kuvat tulevat, ja saat yhden pienen aloitustehtävän.",
        when: "Kun avaat tämän repon ensimmäistä kertaa.",
        steps: [
          "Lue agentin kokoama kartta sivuston osista.",
          "Kysy, mitä haluat ymmärtää tarkemmin.",
          "Valitse ehdotettu aloitustehtävä.",
        ],
        prompt:
          "Lue projektin ohjeet ja näytä, mistä sivut, tapahtumakalenteri ja kuvat tulevat. Ehdota yhtä pientä aloitustehtävää muuttamatta koodia.",
        skill: "tutustu-sivustoon",
        start: "immediate",
      },
      {
        title: "Lisää tapahtuma kalenteriin",
        what: "Uusi tapahtuma näkyy kalenterissa ja etusivun nostoissa, ja saat esikatselulinkin tarkistettavaksi.",
        when: "Kun seuralla on tulossa lenkki, kurssi tai kokous.",
        steps: [
          "Kerro tapahtuman nimi, aika, paikka ja lyhyt kuvaus.",
          "Tarkista agentin tekemä tapahtumasivu esikatselussa.",
          "Pyydä korjaukset tai hyväksy muutos.",
        ],
        prompt:
          "Lisää tapahtumakalenteriin uusi tapahtuma alla olevilla tiedoilla. Tee tapahtumalle oma sivu, nosta se etusivulle ja kerro esikatselulinkki. Älä julkaise mitään.\n\n[tapahtuman nimi, aika, paikka ja kuvaus]",
        skill: "lisaa-tapahtuma",
        name: "Uusi tapahtuma",
      },
      {
        title: "Korjaa rikkinäinen linkki",
        what: "Rikkinäiset linkit on listattu ja korjattu, ja tarkistus menee läpi.",
        when: "Kun joku kertoo, että sivulta puuttuu kuva tai linkki ei vie minnekään.",
        steps: [
          "Kerro sivu, jolla ongelma näkyy, jos tiedät sen.",
          "Katso agentin löytämät linkit ja korjaukset.",
        ],
        prompt:
          "Aja sivuston linkkitarkistus ja korjaa rikkinäiset sisäiset linkit ja kuvat. Kerro, mitkä ulkoiset linkit jäivät rikki.",
        skill: "review",
      },
    ],
  },
  body:
    "Tämä repo on **Kaarinan pyöräseuran** julkinen sivusto. Muutokset näkyvät sivuilla vasta, kun hallitus on hyväksynyt ne.\n\nAloita tutustumisesta tai valitse tavoite alta. Voit myös kysyä agentilta omin sanoin.\n",
};

const enStart: Doc = {
  path: ".agents/start-page.md",
  data: {
    title: "Welcome to the cycling club's website",
    goals: [
      {
        title: "Get to know the site",
        what: "You know where the pages, the event calendar and the pictures come from, and you have one small first task.",
        when: "When you open this repository for the first time.",
        steps: [
          "Read the agent's map of the site's parts.",
          "Ask about what you want to understand better.",
          "Pick the suggested first task.",
        ],
        prompt:
          "Read the project instructions and show me where the pages, the event calendar and the pictures come from. Suggest one small first task without changing code.",
        skill: "get-to-know-site",
        start: "immediate",
      },
      {
        title: "Add an event to the calendar",
        what: "The new event shows in the calendar and on the front page, and you get a preview link to check.",
        when: "When the club has a ride, a course or a meeting coming up.",
        steps: [
          "Give the event's name, time, place and a short description.",
          "Check the agent's event page in the preview.",
          "Ask for corrections or accept the change.",
        ],
        prompt:
          "Add a new event to the calendar with the details below. Give it its own page, feature it on the front page and tell me the preview link. Do not publish anything.\n\n[event name, time, place and description]",
        skill: "add-event",
        name: "New event",
      },
      {
        title: "Fix a broken link",
        what: "The broken links are listed and fixed, and the check passes.",
        when: "When someone says a picture is missing or a link goes nowhere.",
        steps: [
          "Name the page where you saw the problem, if you know it.",
          "Look at the links the agent found and its fixes.",
        ],
        prompt:
          "Run the site's link check and fix broken internal links and pictures. Tell me which external links stayed broken.",
        skill: "review",
      },
    ],
  },
  body:
    "This repository is the **Kaarina cycling club's** public website. Changes reach the site only after the board has approved them.\n\nStart by getting to know the site, or choose a goal below. You can also ask the agent in your own words.\n",
};

// A generic deep front matter: a site generator's article page, 6 levels,
// mixed lists and maps, long and multi-line strings and empty values.
const deep = (lang: Lang): Doc => {
  const fi = lang === "fi";
  return {
    path: fi ? "content/jutut/syyskauden-paatos.md" : "content/posts/season-finale.md",
    data: {
      title: fi ? "Syyskauden päätöslenkki" : "Season finale ride",
      date: "2026-11-02",
      draft: false,
      summary: null,
      tags: fi ? ["lenkit", "syksy", "seura"] : ["rides", "autumn", "club"],
      aliases: [],
      authors: [
        {
          name: "Aino Esimerkki",
          role: fi ? "toimittaja" : "editor",
          contact: { email: "aino@example.org", links: ["https://example.org/aino"] },
        },
        { name: "Pekka Malli", role: fi ? "kuvaaja" : "photographer", contact: {} },
      ],
      seo: {
        description: fi
          ? "Kauden viimeinen yhteislenkki kiersi rantareitin ja päättyi kerholle, jossa jaettiin kauden kilometripalkinnot ja suunniteltiin talven sisäharjoituksia."
          : "The season's last group ride took the shore route and ended at the clubhouse, where the season's distance awards were handed out and winter indoor training was planned.",
        open_graph: {
          type: "article",
          image: {
            src: "/kuvat/2026/paatoslenkki.avif",
            alt: fi ? "Pyöräilijöitä rantatiellä iltapäivällä" : "Cyclists on the shore road in the afternoon",
            size: { width: 1600, height: 900 },
          },
        },
      },
      sections: [
        {
          heading: fi ? "Reitti" : "Route",
          blocks: [
            {
              type: "map",
              gpx: "/reitit/rantareitti.gpx",
              stops: [
                {
                  name: fi ? "Kerho" : "Clubhouse",
                  km: 0,
                  services: { water: true, toilet: true, notes: fi ? ["Avain hallituksella"] : ["The board has the key"] },
                },
                {
                  name: fi ? "Satama" : "Harbour",
                  km: 18.5,
                  services: { water: true, toilet: false, notes: [] },
                },
              ],
            },
            {
              type: "text",
              markdown: fi
                ? "Lähtö kerholta klo 10.\nVauhti on rauhallinen, ja ryhmä odottaa mäkien päällä.\n\nKypärä on pakollinen."
                : "We leave the clubhouse at 10.\nThe pace is easy, and the group waits at the top of the hills.\n\nA helmet is required.",
            },
          ],
        },
        {
          heading: fi ? "Palkinnot" : "Awards",
          blocks: [
            {
              type: "table",
              columns: fi ? ["sarja", "voittaja", "km"] : ["class", "winner", "km"],
              rows: [
                [fi ? "naiset" : "women", "Aino Esimerkki", 4210],
                [fi ? "miehet" : "men", "Pekka Malli", 3980],
              ],
            },
          ],
        },
      ],
      extra: {},
    },
    body: fi
      ? "# Syyskauden päätöslenkki\n\nKauden viimeinen yhteislenkki ajettiin aurinkoisessa säässä.\n"
      : "# Season finale ride\n\nThe season's last group ride was ridden in sunny weather.\n",
  };
};

// A plain YAML file: a CI workflow, the commonest YAML in a repository.
const workflow = (lang: Lang): Doc => ({
  path: ".github/workflows/tarkistus.yml",
  data: {
    name: lang === "fi" ? "Sivuston tarkistus" : "Site check",
    on: {
      push: { branches: ["main"] },
      pull_request: null,
      schedule: [{ cron: "0 4 * * 1" }],
    },
    permissions: { contents: "read" },
    jobs: {
      build: {
        "runs-on": "ubuntu-latest",
        "timeout-minutes": 15,
        strategy: { "fail-fast": false, matrix: { node: [20, 22], locale: ["fi", "en"] } },
        steps: [
          { uses: "actions/checkout@v4" },
          {
            name: lang === "fi" ? "Asenna Node" : "Set up Node",
            uses: "actions/setup-node@v4",
            with: { "node-version": "${{ matrix.node }}", cache: "npm" },
          },
          { name: lang === "fi" ? "Asenna riippuvuudet" : "Install dependencies", run: "npm ci" },
          {
            name: lang === "fi" ? "Rakenna ja tarkista linkit" : "Build and check links",
            run: "npm run build -- --locale ${{ matrix.locale }}\nnpx linkinator dist --recurse --skip '^https://example.org'",
            env: { CI: true, SITE_URL: "https://pyoraseura.example.org" },
          },
        ],
      },
    },
  },
});

export const files = (lang: Lang): Record<FileId, Doc> => ({
  start: lang === "fi" ? fiStart : enStart,
  deep: deep(lang),
  yaml: workflow(lang),
});

/** The error case: goal 2 lost its `when` and gained a field the page does not know. */
export function broken(doc: Doc): Doc {
  const goals = (doc.data.goals as { [k: string]: Yaml }[]).map((g, i) => {
    if (i !== 1) return g;
    const { when: _w, ...rest } = g;
    return { ...rest, kuvaus: "?" };
  });
  return { ...doc, data: { ...doc.data, goals } };
}

const fi = {
  title: "Front matterin esikatselu",
  direction: ["Nyt", "1 Sisäkkäin", "2 Puu", "3 Sivuna"],
  lines: [
    "Nyt: ylätason tekstiarvot luetteloksi; kaikki sisäkkäinen (goals) jää YAML-lähteeksi, ja .yml-tiedostolla ei ole esikatselua.",
    "1 Sisäkkäin: kaikki auki sisäkkäisenä luettelona; oliolistat kortteina, merkkijonolistat luetteloina, monirivinen teksti lainauslohkona.",
    "2 Puu: kaksi tasoa auki, syvemmät kiinni määrineen; samanmuotoiset oliot taulukon riveinä, rivi avautuu.",
    "3 Sivuna: aloitussivu näkyy niin kuin työtilan sivu sen näyttää, tavoitteiden oppaat ja kelpoisuus alla; muut tiedostot kuten 1.",
  ],
  recommend:
    "Suositus: 3 Sivuna aloitussivulle ja sen pohjana 1 Sisäkkäin kaikille muille, myös .yml-tiedostoille. Puun taittelu on jo tekstinäkymässä.",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  state: "Aloitussivu",
  states: { ok: "Kelpaa", broken: "Virhe tavoitteessa 2" },
  file: "Tiedosto",
  fileNames: { start: "aloitussivu", deep: "syvä front matter", yaml: "pelkkä YAML" },
  // Renderer words.
  empty: "tyhjä",
  noItems: "ei kohtia",
  items: (n: number) => (n === 1 ? "1 kohta" : `${n} kohtaa`),
  keys: (n: number) => (n === 1 ? "1 avain" : `${n} avainta`),
  lines_: (n: number) => `${n} riviä`,
  frontmatter: "Front matter",
  yamlDoc: "YAML-tiedosto",
  openAll: "Avaa kaikki",
  closeAll: "Sulje kaikki",
  more: "Lisää",
  rowOpen: (n: number) => `Avaa rivi ${n}`,
  // Direction 3.
  startPage: "Työtilan aloitussivu",
  startPageNote: "Näin työtilan sivu ja uuden keskustelun alku näyttävät tämän tiedoston.",
  valid: (n: number) => `Kelpaa · ${n === 1 ? "1 tavoite" : `${n} tavoitetta`}`,
  invalid: "Ei kelpaa: työtila näyttää tallennettuna “Aloitussivu tarvitsee päivityksen”",
  guides: "Tavoitteiden oppaat",
  guidesNote: "Opas avautuu keskustelun viereen, kun tavoite valitaan.",
  when: "Milloin",
  request: "Pyyntö",
  skill: "Taito",
  convName: "Keskustelun nimi",
  immediate: "Lähtee heti valittaessa",
  placeholder: "täytettävä kohta",
  goalN: (n: number) => `Tavoite ${n}`,
  missing: (field: string) => `kenttä ${field} puuttuu`,
  unknown: (field: string) => `tuntematon kenttä ${field}`,
  tooMany: (field: string, max: number) => `${field}: enintään ${max}`,
  bodyLabel: "Vapaa teksti",
};
type Text = typeof fi;
const en: Text = {
  title: "Front matter preview",
  direction: ["Now", "1 Nested", "2 Tree", "3 As page"],
  lines: [
    "Now: top-level text values as a list; everything nested (goals) stays YAML source, and a .yml file has no preview.",
    "1 Nested: everything open as a nested list; lists of objects as cards, string lists as lists, multi-line text as a quoted block.",
    "2 Tree: two levels open, deeper ones folded with counts; uniform objects as table rows that open.",
    "3 As page: the start page as the workspace page shows it, goal guides and validity below; other files as in 1.",
  ],
  recommend:
    "Recommendation: 3 As page for the start page, with 1 Nested as its base for everything else, .yml files too. The text view already folds like a tree.",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  state: "Start page",
  states: { ok: "Valid", broken: "Error in goal 2" },
  file: "File",
  fileNames: { start: "start page", deep: "deep front matter", yaml: "plain YAML" },
  empty: "empty",
  noItems: "no items",
  items: (n) => (n === 1 ? "1 item" : `${n} items`),
  keys: (n) => (n === 1 ? "1 key" : `${n} keys`),
  lines_: (n) => `${n} lines`,
  frontmatter: "Front matter",
  yamlDoc: "YAML file",
  openAll: "Open all",
  closeAll: "Close all",
  more: "More",
  rowOpen: (n) => `Open row ${n}`,
  startPage: "Workspace start page",
  startPageNote: "This is how the workspace page and the start of a new conversation show this file.",
  valid: (n) => `Valid · ${n === 1 ? "1 goal" : `${n} goals`}`,
  invalid: "Not valid: once saved, the workspace shows “The start page needs an update”",
  guides: "Goal guides",
  guidesNote: "A guide opens beside the conversation when its goal is chosen.",
  when: "When",
  request: "Request",
  skill: "Skill",
  convName: "Conversation name",
  immediate: "Starts as soon as it is chosen",
  placeholder: "to fill in",
  goalN: (n) => `Goal ${n}`,
  missing: (field) => `field ${field} is missing`,
  unknown: (field) => `unknown field ${field}`,
  tooMany: (field, max) => `${field}: at most ${max}`,
  bodyLabel: "Free text",
};
export const TEXT: Record<Lang, Text> = { fi, en };
export type { Text };
