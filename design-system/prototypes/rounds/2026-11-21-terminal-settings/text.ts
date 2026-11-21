// Every word the round shows, in Finnish and English. Production's own
// components bring their own text; this file is only what the round adds.
export type Lang = "fi" | "en";
export type View = "settings" | "workspace";
export type FontSize = "small" | "normal" | "large";
export type Cursor = "block" | "underline" | "bar";
export type Paste = "ask" | "direct";

const fi = {
  title: "Päätteen asetukset",
  view: "Näkymä",
  views: { settings: "Asetukset › Pääte", workspace: "Työtila ja pääte" } as Record<View, string>,
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  pasteEvent: "Liitä 3 riviä",
  reset: "Alusta",
  lines: [
    "A Asetusten osio: Asetukset › Pääte on tavallinen osio Editorin vieressä; päätepaneeliin ei tule mitään uutta.",
    "B Ratas päätteessä: asetukset avautuvat päätepaneelin rattaasta suoraan päätteen päälle, ja muutos näkyy heti takana; Asetuksissa on vain viittaus.",
    "C Osio, esikatselu ja ratas: Asetukset › Pääte alkaa elävällä päätteellä, joka näyttää valinnat; päätepaneelin ratas vie tähän osioon.",
  ],
  recommend:
    "Suositus: C. Asetuksilla on yksi koti, josta haku löytää ne, ratas löytyy sieltä missä asetusta kaipaa, eikä toista asetuskäyttöliittymää tarvita.",
  // Settings section
  section: "Pääte",
  sectionKw: ["terminal", "pääte", "komentorivi", "shell", "tmux", "xterm"],
  intro: "Miltä selaimen pääte näyttää ja mitä hiiri ja leikepöytä tekevät. Pääte on sama tmux-istunto kuin SSH:lla, joten ohjelmien omat asetukset pysyvät niiden omissa tiedostoissa.",
  proposal: "Ehdotus",
  preview: "Esikatselu",
  previewNote: "Kokeile valitsemista tässä. Mitään ei lähetetä palvelimelle.",
  copy: "Kopioi valitsemalla",
  copyDesc: "Hiirellä valittu teksti menee leikepöydälle heti, kun päästät irti. Pois päältä kopioi valinnan Kopioi-painike tai {key}. Koskee kaikkia laitteitasi.",
  font: "Tekstin koko",
  fontDesc: "Koskee tätä selainta, koska näytöt ovat eri kokoisia. Puhelimessa koko on yhtä pykälää pienempi.",
  fonts: { small: "Pieni", normal: "Normaali", large: "Iso" } as Record<FontSize, string>,
  cursor: "Kohdistin",
  cursorDesc: "Kohdistimen muoto. Koskee kaikkia laitteitasi.",
  cursors: { block: "Laatikko", underline: "Alaviiva", bar: "Pystyviiva" } as Record<Cursor, string>,
  paste: "Usean rivin liittäminen",
  pasteDesc: "Monta riviä voi ajaa monta komentoa, joten Habitat näyttää ne ensin. Koskee kaikkia laitteitasi.",
  pastes: { ask: "Kysy ensin", direct: "Liitä heti" } as Record<Paste, string>,
  how: "Näin pääte toimii",
  facts: [
    { k: "colour", label: "Värit", text: "Seuraavat Ulkoasun teemaa: Päivä, Yö tai Kontrasti.", link: "Ulkoasu" },
    { k: "urls", label: "Osoitteet", text: "Kun ohjelma avaa verkko-osoitteen, esimerkiksi gh auth login, paneeliin tulee kortti. Mitään ei avata ilman painallustasi." },
    { k: "history", label: "Historia", text: "Rulla selaa tmuxin historiaa. Sen pituus tulee tmuxin omasta history-limit-asetuksesta (~/.tmux.conf)." },
    { k: "shift", label: "Valinta", text: "Kun ohjelma käyttää hiirtä, valitse Shift pohjassa." },
  ],
  // Gear
  gear: "Päätteen asetukset",
  gearAll: "Kaikki päätteen asetukset",
  done: "Valmis",
  close: "Sulje",
  pointer: "Päätteen asetukset ovat päätepaneelin rattaassa.",
  pointerOpen: "Avaa pääte",
  copied: "Valinta kopioitu leikepöydälle.",
  person: "Aino Esimerkki",
  workspaceTitle: "aurinkokello",
  convo: [
    "Aja testit ja kerro, mikä kaatuu.",
    "Ajoin `go test ./...` päätteessä. Kaksi testiä kaatuu paketissa `internal/clock`; ne odottavat talviaikaa.",
  ],
};
export type Text = typeof fi;

const en: Text = {
  title: "Terminal settings",
  view: "View",
  views: { settings: "Settings › Terminal", workspace: "Workspace and terminal" },
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  pasteEvent: "Paste 3 lines",
  reset: "Reset",
  lines: [
    "A Settings section: Settings › Terminal is an ordinary section beside Editor; nothing new in the terminal panel.",
    "B Gear in the terminal: the settings open from a gear in the terminal panel, over the terminal, and a change shows behind at once; Settings only points there.",
    "C Section, preview and gear: Settings › Terminal starts with a live terminal that shows the choices; the panel's gear leads to this section.",
  ],
  recommend:
    "Recommendation: C. The settings have one home that search finds, the gear is where you miss a setting, and no second settings interface is needed.",
  section: "Terminal",
  sectionKw: ["terminal", "pääte", "command line", "shell", "tmux", "xterm"],
  intro: "How the browser terminal looks and what the mouse and the clipboard do. The terminal is the same tmux session as over SSH, so programs keep their settings in their own files.",
  proposal: "Proposal",
  preview: "Preview",
  previewNote: "Try selecting here. Nothing is sent to the server.",
  copy: "Copy on select",
  copyDesc: "Text you select with the mouse goes to the clipboard as soon as you let go. When off, the selection's Copy button or {key} copies. Applies to all your devices.",
  font: "Text size",
  fontDesc: "Applies to this browser, because screens differ in size. On a phone the size is one step smaller.",
  fonts: { small: "Small", normal: "Normal", large: "Large" },
  cursor: "Cursor",
  cursorDesc: "The shape of the cursor. Applies to all your devices.",
  cursors: { block: "Block", underline: "Underline", bar: "Bar" },
  paste: "Pasting several lines",
  pasteDesc: "Several lines can run several commands, so Habitat shows them first. Applies to all your devices.",
  pastes: { ask: "Ask first", direct: "Paste at once" },
  how: "How the terminal works",
  facts: [
    { k: "colour", label: "Colours", text: "Follow the Appearance theme: Day, Night or Contrast.", link: "Appearance" },
    { k: "urls", label: "Addresses", text: "When a program opens a web address, gh auth login for example, a card appears in the panel. Nothing opens without your press." },
    { k: "history", label: "History", text: "The wheel scrolls tmux's history. Its length comes from tmux's own history-limit setting (~/.tmux.conf)." },
    { k: "shift", label: "Selecting", text: "When a program uses the mouse, hold Shift to select." },
  ],
  gear: "Terminal settings",
  gearAll: "All terminal settings",
  done: "Done",
  close: "Close",
  pointer: "The terminal settings are behind the gear in the terminal panel.",
  pointerOpen: "Open the terminal",
  copied: "Selection copied to the clipboard.",
  person: "Aino Example",
  workspaceTitle: "aurinkokello",
  convo: [
    "Run the tests and tell me what fails.",
    "I ran `go test ./...` in the terminal. Two tests fail in `internal/clock`; they expect winter time.",
  ],
};

export const TEXT: Record<Lang, Text> = { fi, en };
