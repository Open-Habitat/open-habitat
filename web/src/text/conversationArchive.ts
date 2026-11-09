import { catalog, plural } from "../i18n";

// The workspace page's archive list (components/ConversationArchive.tsx) and
// the foot an archived conversation shows in its composer's place. Rows are
// grouped and dated by when the person archived each conversation.
const fi = {
  heading: "Arkisto",
  filter: "Etsi otsikosta",
  noMatch: (q: string) => `Otsikkoa ”${q}” ei löydy arkistosta.`,
  groups: {
    today: "Tänään",
    yesterday: "Eilen",
    week: "Aiemmin tällä viikolla",
    older: "Vanhemmat",
  },
  today: (time: string) => `klo ${time}`,
  yesterday: (time: string) => `eilen ${time}`,
  restore: (title: string) => `Palauta ${title}`,
  restored: (title: string, helpers: boolean) =>
    `Palautettu: ${title}. Se on taas avoimissa keskusteluissa${helpers ? ", ja sen avustajat palasivat käynnistämättä" : ""}.`,
  traces: {
    helper: (name: string) => `avustaja ${name}`,
    helperOpen: (name: string) =>
      `Avustaja ${name} odottaa · työtä haarassa, yhdistämistä ei vahvistettu`,
    helperWorking: (name: string) => `Avustaja ${name} tekee kierrosta`,
    helperUnknown: (name: string) => `Avustajan ${name} tila ei ole tiedossa`,
    helperLanded: (name: string) =>
      `Avustaja ${name} odottaa · kaikki yhdistetty`,
    merged: (n: number) =>
      n === 1 ? "työ yhdistetty" : `${n} työtä yhdistetty`,
    unmerged: (n: number) => (n === 1 ? "työ haarassa" : `${n} työtä haarassa`),
    failed: (n: number) =>
      n === 1 ? "työ epäonnistui" : `${n} työtä epäonnistui`,
    working: (n: number) =>
      n === 1 ? "työ käynnissä" : `${n} työtä käynnissä`,
  },
  foot: {
    archived: (at: string) =>
      `Arkistoitu ${at}. Luettavissa; palauta jatkaaksesi.`,
    archivedUndated: "Arkistoitu. Luettavissa; palauta jatkaaksesi.",
    restore: "Palauta",
  },
};

const workers = (n: number, what: string) =>
  n === 1
    ? `worker ${what}`
    : `${n} ${plural("en", n, { one: "worker", other: "workers" })} ${what}`;

export const conversationArchiveText = catalog(fi, {
  heading: "Archive",
  filter: "Find by title",
  noMatch: (q) => `No title “${q}” in the archive.`,
  groups: {
    today: "Today",
    yesterday: "Yesterday",
    week: "Earlier this week",
    older: "Older",
  },
  today: (time) => time,
  yesterday: (time) => `yesterday ${time}`,
  restore: (title) => `Restore ${title}`,
  restored: (title, helpers) =>
    `Restored: ${title}. It is back among the open conversations${helpers ? ", and its helpers came back without starting" : ""}.`,
  traces: {
    helper: (name) => `helper ${name}`,
    helperOpen: (name) =>
      `Helper ${name} is waiting · work on its branch, merge not confirmed`,
    helperWorking: (name) => `Helper ${name} is working on a round`,
    helperUnknown: (name) => `Helper ${name}'s state is not known`,
    helperLanded: (name) => `Helper ${name} is waiting · all merged`,
    merged: (n) => workers(n, "merged"),
    unmerged: (n) => workers(n, "on branch"),
    failed: (n) => workers(n, "failed"),
    working: (n) => workers(n, "running"),
  },
  foot: {
    archived: (at) =>
      `Archived ${at}. You can read it; restore it to continue.`,
    archivedUndated: "Archived. You can read it; restore it to continue.",
    restore: "Restore",
  },
});
