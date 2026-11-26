// The round's own words in both languages: review chrome, the synthetic
// conversation and the pieces this round draws. Production components bring
// their own words through the app's i18n. The `<reply-to>` blocks the agent
// receives are written by the host and stay in English whatever the
// person's language, as Habitat's other lines to the agent do (round.tsx).

export type Lang = 'fi' | 'en';
export type OfferType = 'view' | 'file' | 'package';

const fi = {
  lang: 'fi' as Lang,
  title: 'Vastaa näkymään tai tiedostoon · kierros 1',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  reset: 'Alusta',
  hint: 'Valitsin (alhaalla) vaihtaa suuntaa. Vastaus näkymään on kesken, ja keskustelussa on lähetetty vastaus PDF:ään. Paketin kortti avaa tiedostot oikealle.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Kulmassa', 'B Rivissä', 'C Tiedostoon'],
  axis: 'Kierros 1: missä ↩ on kortilla, mitä lainaus kertoo ja kuinka tarkasti vastaus osoittaa',
  lines: [
    'Nyt: korteissa ei ole ↩:ta. Agentin viesteissä on (kokeellinen vastaus viestiin). Kortin otsikon voi valita ja kopioida, ja ihminen kirjoittaa itse, mihin vastaa: ”vuosikertomus-2026.pdf: sivun 4 kaavio puuttuu.”',
    'A Kulmassa: ↩ on aina kortin oikeassa yläkulmassa, samana Kopioin parina kuin agentin viestissä. Lainaus on viestin lainauksen muotoinen: ”Vastaat näkymään · 09.20” ja otsikko kahdella rivillä. Vastaus osoittaa koko tarjoukseen, myös paketin.',
    'B Rivissä: ↩ on kortin omassa ikonirivissä julkaisun, välilehden ja latauksen jälkeen: työpöydällä osoittimen alla tai fokuksessa, puhelimessa kortin alarivillä. Lainaus on pieni kortti: merkki, otsikko ja kortin tiedot (Näkymä · 12 tiedostoa · 7,5 Mt).',
    'C Tiedostoon asti: kortissa ↩ kuten A:ssa ja lainaus kuten B:ssä. Lisäksi paketin tiedostolistan jokaisella rivillä on oma ↩, joten vastauksen voi osoittaa yhteen tiedostoon: ”henkilosto.csv · CSV-taulukko · 18 kt · paketista Vuosikertomuksen liitteet”.',
  ],
  recommend: 'Suositus C: ↩ on samassa paikassa ja samannäköinen kuin agentin viestissä, joten se löytyy ilman osoitinta ja puhelimessa samalla tavalla. Lainaus näyttää lajin ja koon, joten saman nimiset versiot (kierros 2 ja 3) erottuvat ennen lähettämistä. Paketissa ”se taulukko” ei kerro agentille, mikä kolmesta, joten tiedoston rivillä on oma ↩.',
  agentHead: 'Mitä agentti saa',
  agentNote: 'Pi saa tämän tekstin ja natiivi istunto kirjaa sen käyttäjän viestinä. Lohkon kirjoittaa daemon tarjouksen natiivista merkinnästä; selain lähettää vain merkinnän avaimen (ja C:ssä tiedoston polun).',
  agentPending: 'Lähtisi nyt',
  agentSent: 'Lähetetty',
  agentDraft: '(kirjoittamasi teksti)',
  agentEmpty: 'Ei lainausta kesken.',
  // The quote's head, as production's "Vastaat agentin viestiin".
  replying: {view: 'Vastaat näkymään', file: 'Vastaat tiedostoon', package: 'Vastaat tiedostopakettiin'} as Record<OfferType, string>,
  // The sent quote's head, as production's "Agentin viesti".
  replied: {view: 'Agentin näkymä', file: 'Agentin tiedosto', package: 'Agentin tiedostopaketti'} as Record<OfferType, string>,
  inPackage: (title: string) => `paketista ${title}`,
  reply: (title: string) => `Vastaa: ${title}`,
  jump: (title: string) => `Siirry korttiin: ${title}`,
  pane: 'Avattu kohde näkyisi tässä. Esikatselu ei kuulu tähän kierrokseen.',
  paneFolderNote: 'Rivin painallus avaisi tiedoston; tällä kierroksella se ei avaa mitään.',
  convTitle: 'Vuosikertomus 2026',
  ws: 'vuosikertomus',
  activityIdle: 'Odottaa sinua',
  viewTitle: 'Ajat keskustelussa – prototyyppi, kierros 3: vuoron kesto, pysäytetyn vuoron rivi ja päiväerottimet kaikissa teemoissa',
  packageTitle: 'Vuosikertomuksen liitteet',
  u: [
    'Tee aikojen prototyypistä kolmas kierros ja näytä se minulle.',
    'Tee vielä vuosikertomuksen PDF ja paketoi liitteet.',
    'Sivun 4 kaavio puuttuu.',
  ],
  // Today the person names the item themselves.
  uNow: 'vuosikertomus-2026.pdf: sivun 4 kaavio puuttuu.',
  r: [
    'Kolmas kierros on valmis. Suunnat ovat Nyt, A, B ja C, ja suosittelen B:tä. Kolme kysymystä on sivun lopussa.',
    'PDF on valmis, ja liitteet ovat yhdessä paketissa. Tase on Excel-taulukkona ja henkilöstö CSV:nä.',
    'Kaavio jäi pois, koska sen kuva puuttui kuvat-kansiosta. Lisäsin sen ja tein PDF:n uudelleen.',
  ],
  draft: 'Menen B:llä. Kysymykseen 2: kesto saa näkyä myös pysäytetyssä vuorossa.',
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Reply to a view or file · round 1',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  reset: 'Reset',
  hint: 'The picker (bottom) switches direction. A reply to the view is under way, and the conversation holds a sent reply to the PDF. The package card opens its files on the right.',
  all: 'Show every direction and the recommendation', fewer: 'Show only the chosen one',
  picker: ['Now', 'A Corner', 'B Row', 'C To the file'],
  axis: 'Round 1: where ↩ sits on the card, what the quote tells and how precisely the reply points',
  lines: [
    'Now: the cards have no ↩. Agent messages do (the experimental reply to a message). The card title can be selected and copied, and the person writes what they answer: “vuosikertomus-2026.pdf: the chart on page 4 is missing.”',
    'A Corner: ↩ is always in the card\'s top-right corner, the same pair of Copy as on an agent message. The quote has the message quote\'s shape: “Replying to the view · 09:20” and the title on two lines. The reply points at the whole offer, a package too.',
    'B Row: ↩ is in the card\'s own icon row after publish, tab and download: on a desktop under the pointer or on focus, on a phone in the card\'s bottom row. The quote is a small card: mark, title and the card\'s facts (View · 12 files · 7.5 MB).',
    'C To the file: on the card ↩ as in A and the quote as in B. Each row of a package\'s file list also has its own ↩, so a reply can point at one file: “henkilosto.csv · CSV table · 18 kB · from the package Vuosikertomuksen liitteet”.',
  ],
  recommend: 'Recommended C: ↩ sits where and looks as on an agent message, so it is found without a pointer and the same way on a phone. The quote shows kind and size, so versions with the same name (round 2 and 3) can be told apart before sending. In a package “that table” does not tell the agent which of three, so a file\'s row has its own ↩.',
  agentHead: 'What the agent receives',
  agentNote: 'Pi receives this text and the native session records it as the user\'s message. The daemon writes the block from the offer\'s native entry; the browser sends only the entry key (and in C the file\'s path).',
  agentPending: 'Would go now',
  agentSent: 'Sent',
  agentDraft: '(your text)',
  agentEmpty: 'No quote under way.',
  replying: {view: 'Replying to the view', file: 'Replying to the file', package: 'Replying to the file package'},
  replied: {view: 'Agent\'s view', file: 'Agent\'s file', package: 'Agent\'s file package'},
  inPackage: (title) => `from the package ${title}`,
  reply: (title) => `Reply: ${title}`,
  jump: (title) => `Go to the card: ${title}`,
  pane: 'The opened item would show here. The preview is not part of this round.',
  paneFolderNote: 'A press on a row would open the file; in this round it opens nothing.',
  convTitle: 'Annual report 2026',
  ws: 'vuosikertomus',
  activityIdle: 'Waiting for you',
  viewTitle: 'Times in the conversation – prototype, round 3: turn duration, the stopped turn\'s row and day separators in every theme',
  packageTitle: 'Vuosikertomuksen liitteet',
  u: [
    'Make the third round of the times prototype and show it to me.',
    'Also make the annual report PDF and package the appendices.',
    'The chart on page 4 is missing.',
  ],
  uNow: 'vuosikertomus-2026.pdf: the chart on page 4 is missing.',
  r: [
    'The third round is ready. The directions are Now, A, B and C, and I recommend B. Three questions are at the end of the page.',
    'The PDF is ready, and the appendices are in one package. The balance sheet is an Excel spreadsheet and the staff list a CSV.',
    'The chart was left out because its image was missing from the images folder. I added it and rebuilt the PDF.',
  ],
  draft: 'I\'ll go with B. To question 2: the duration may show on a stopped turn too.',
};

export const TEXT: Record<Lang, Text> = {fi, en};
