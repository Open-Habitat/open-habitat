import { catalog } from "../i18n";

// The ⌘K / Ctrl+K switcher and its search across the person's conversations
// (components/Switcher.tsx, app/SwitcherHost.tsx), the rail's search door and
// the band in a conversation opened from a hit. `mod` is the platform's
// modifier as the keyboard names it: ⌘K on a Mac, Ctrl+K elsewhere.
const fi = {
  dialog: "Hae keskusteluista",
  placeholder: "Hae keskusteluista",
  door: "Hae keskusteluista",
  recent: "Viimeksi avatut",
  previous: "edellinen",
  archived: "Arkistoitu",
  continueSearch: (q: string) => `Jatka hakua: ”${q}”`,
  more: (n: number) => (n === 1 ? "+1 osuma" : `+${n} osumaa`),
  moreLabel: (n: number, open: boolean) =>
    open
      ? "Piilota muut osumat"
      : n === 1
        ? "Näytä 1 muu osuma"
        : `Näytä ${n} muuta osumaa`,
  empty: (q: string) =>
    `Ei osumia nimissä eikä viesteissä: ”${q}”. Kokeile lyhyempää sanaa tai sanan alkua.`,
  building: (indexed: number, total: number) =>
    `Viestihaku valmistuu: ${indexed}/${total} keskustelua luettu. Nimet löytyvät jo kaikki.`,
  unavailable:
    "Viestien haku ei vastaa nyt. Nimet löytyvät, ja viestihaku yrittää uudelleen seuraavalla näppäimellä.",
  who: { user: "Sinä", assistant: "Agentti" },
  ago: (days: number) =>
    days <= 0 ? "tänään" : days === 1 ? "eilen" : `${days} pv sitten`,
  foot: (enter: string) =>
    `↑↓ valitse · → lisää osumia · ← piilota · ${enter} avaa lauseen kohdalta · Esc sulje`,
  jump: (q: string, who: string, ago: string) =>
    `Hakuosuma ”${q}” · ${who}, ${ago}`,
  jumpSearching: (q: string) => `Haetaan osumaa ”${q}” keskustelun alusta…`,
  jumpMissing: (q: string) =>
    `Osumaa ”${q}” ei löytynyt keskustelusta. Se on voinut jäädä toiseen haaraan.`,
  jumpBack: (mod: string) => `${mod} jatkaa hakua`,
  close: "Sulje",
};

export const switcherText = catalog(fi, {
  dialog: "Search conversations",
  placeholder: "Search conversations",
  door: "Search conversations",
  recent: "Recently opened",
  previous: "previous",
  archived: "Archived",
  continueSearch: (q) => `Continue search: “${q}”`,
  more: (n) => (n === 1 ? "+1 hit" : `+${n} hits`),
  moreLabel: (n, open) =>
    open
      ? "Hide the other hits"
      : n === 1
        ? "Show 1 other hit"
        : `Show ${n} other hits`,
  empty: (q) =>
    `No hits in names or messages: “${q}”. Try a shorter word or the start of a word.`,
  building: (indexed, total) =>
    `Message search is getting ready: ${indexed}/${total} conversations read. Every name can already be found.`,
  unavailable:
    "Message search is not answering right now. Names can be found, and message search tries again with the next key.",
  who: { user: "You", assistant: "Agent" },
  ago: (days) =>
    days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`,
  foot: (enter) =>
    `↑↓ choose · → more hits · ← hide · ${enter} open at the sentence · Esc close`,
  jump: (q, who, ago) => `Search hit “${q}” · ${who}, ${ago}`,
  jumpSearching: (q) =>
    `Looking for the hit “${q}” further back in the conversation…`,
  jumpMissing: (q) =>
    `The hit “${q}” was not found in the conversation. It may be on another branch.`,
  jumpBack: (mod) => `${mod} continues the search`,
  close: "Close",
});
