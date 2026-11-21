// The round's words: the review bar, the synthetic conversation, and the
// round-own controls (direction 2's copy button, direction 3's Viittaa).
// Offer titles are agent data: the agent writes them in the conversation's
// language, so the English conversation has English titles.

export type Format = "plain" | "kind";

const fi = {
  title: "Tarjotun kohteen otsikon kopiointi",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  format: "Kopioi",
  formats: { plain: "pelkkä otsikko", kind: "laji ja otsikko" },
  clipboard: "Leikepöydällä:",
  clipboardEmpty: "ei vielä mitään tästä sivusta",
  lines: [
    "Nyt: koko kortti on yksi painallus, eikä otsikkoa voi valita.",
    "1 Valinta: otsikko on tavallista valittavaa tekstiä; muu kortti avaa kohteen.",
    "2 Kopioi: otsikon perässä pieni Kopioi-painike, himmeä levossa ja selvä osoittimen alla.",
    "3 Viittaa: Viittaa-painike vie otsikon viestikenttään lähettämättä, kuten terminaalin Vie keskusteluun.",
  ],
  recommend:
    "Suositus: 1 Valinta. Otsikko käyttäytyy kuin muukin teksti, eikä kortille tule uutta painiketta.",
  // The control words of the round-own pieces, as production would say them.
  copyTitle: (t: string) => `Kopioi otsikko: ${t}`,
  copied: "Kopioitu",
  copyBlocked: "Kopiointi estettiin",
  refer: "Viittaa",
  referLabel: (t: string) => `Viittaa viestissä: ${t}`,
  kindWord: { view: "näkymä", csv: "taulukko", pdf: "PDF", folder: "kansio" },
  quote: (t: string) => `”${t}”`,
  // The conversation.
  convTitle: "Retkireitit kesälle",
  ws: "retkiopas",
  asked:
    "Kokoa kesän retkireitit yhteen: kartta, vertailutaulukko ja tulostettava opas. Laita mukaan myös reittien GPX-jäljet.",
  before:
    "Tein neljä kohdetta. Kartta näyttää kaikki reitit, taulukko vertailee pituuksia ja nousuja, ja opas on tulostettava PDF. GPX-jäljet ovat omassa kansiossaan.",
  after:
    "Taulukon nousut ovat karttapalvelun arvioita, joten ne voivat poiketa maastosta muutaman metrin. Kerro, mitä reittiä haluat tarkentaa.",
  offers: {
    view: "Retkireitit kartalla – kesä 2026",
    csv: "Nuuksion ja Sipoonkorven reittivertailu, pituudet, nousut ja pysäköintipaikat, päivitetty kesäkuun maastokäyntien jälkeen",
    pdf: "Tulostettava retkiopas",
    folder: "Reittien GPX-jäljet",
  },
  folderName: "gpx",
  csvPath: "reittivertailu.csv",
  pdfPath: "retkiopas.pdf",
};

export type Text = typeof fi;

const en: Text = {
  title: "Copying the title of an offered item",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  format: "Copy",
  formats: { plain: "title only", kind: "kind and title" },
  clipboard: "On the clipboard:",
  clipboardEmpty: "nothing from this page yet",
  lines: [
    "Now: the whole card is one press, and the title cannot be selected.",
    "1 Select: the title is ordinary selectable text; the rest of the card opens the item.",
    "2 Copy: a small Copy button after the title, faint at rest and clear under the pointer.",
    "3 Refer: a Refer button puts the title in the message field, unsent, like the terminal's Send to conversation.",
  ],
  recommend:
    "Recommended: 1 Select. The title behaves like any other text, and the card gets no new button.",
  copyTitle: (t) => `Copy title: ${t}`,
  copied: "Copied",
  copyBlocked: "Copying was blocked",
  refer: "Refer",
  referLabel: (t) => `Refer to in a message: ${t}`,
  kindWord: { view: "view", csv: "table", pdf: "PDF", folder: "folder" },
  quote: (t) => `“${t}”`,
  convTitle: "Summer hiking routes",
  ws: "retkiopas",
  asked:
    "Put the summer's hiking routes together: a map, a comparison table and a printable guide. Include the routes' GPX tracks too.",
  before:
    "I made four items. The map shows every route, the table compares lengths and climbs, and the guide is a printable PDF. The GPX tracks are in a folder of their own.",
  after:
    "The climbs in the table are the map service's estimates, so they may differ from the terrain by a few metres. Tell me which route you want refined.",
  offers: {
    view: "Hiking routes on a map – summer 2026",
    csv: "Nuuksio and Sipoonkorpi route comparison, lengths, climbs and parking places, updated after the June field visits",
    pdf: "Printable hiking guide",
    folder: "Route GPX tracks",
  },
  folderName: "gpx",
  csvPath: "route-comparison.csv",
  pdfPath: "hiking-guide.pdf",
};

export const TEXT = { fi, en };
