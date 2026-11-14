// The round's own words, Finnish and English. Production's dialog keeps its
// own catalog (text/integrations.tsx) and follows the same language switch.
export type Lang = 'fi' | 'en';

const fi = {
  // Review chrome
  title: 'Microsoftin kansiovalinta ja koot · kierros 1',
  scenario: 'Tilanne',
  theme: 'Teema', light: 'Vaalea', dark: 'Tumma',
  language: 'Kieli',
  reset: 'Alusta',
  scenarios: {
    ladataan: 'Kokoja haetaan',
    mahtuu: 'Koot tiedossa, valinta mahtuu',
    ylittyy: 'Valinta ei mahdu (ennen laskentaa)',
    arvio: 'Vain Microsoftin tallennustila-arvio (yläraja)',
    torjuttu: 'Hylätty laskennan jälkeen',
    sivusto: 'Kaksi sivustoa ei avaudu',
  } as Record<string, string>,
  roundLine: 'Sama kaikissa: kirjautumisen jälkeen Habitat hakee Microsoftilta OneDriven ja jokaisen SharePoint-kirjaston koon parissa sekunnissa ja näyttää sen arviona. Tarkka koko lasketaan yhä valinnan jälkeen ennen kopiointia. Jos valinta ei silloin mahdu, ikkuna kertoo tarvitun ja vapaan tilan. Kaikki tiedot ovat keksittyjä.',
  lines: [
    'A Rivit: tuotannon kansiovaihe sellaisenaan. Isäntä antaa jokaiselle kirjastolle Microsoftin arvion, ja tilamittari ja varoitus toimivat kuten Googlella. Hylkäykseen tulee tarvittu ja vapaa tila.',
    'B Kansiot auki: kirjaston voi avata ja valita siitä vain osan kansioista kokoineen. Jos valinta ei mahdu, suurin kirjasto avautuu valmiiksi. Hylkäyksen jälkeen palataan valintaan lasketuin kooin.',
    'C Tilamittari: vapaa tila on ylhäällä mittarina, jota valitut kirjastot täyttävät. Epävarma arvio on viivoitettu, ja kirjasto, joka ei enää mahdu, on merkitty. Hylkäyksessä laskettu koko menee mittarin yli.',
  ],
  recommend: 'Suositus: B. Pilotissa kirjastot eivät mahtuneet yhdessä, eikä niistä voinut valita osaa. A kertoo vain, minkä kirjaston voi jättää kokonaan pois. B:n kansiokohtaiset koot tulevat samalla Graph-pyynnöllä, jolla kansiot listataan. C:n mittari on selkeä, mutta se vie puhelimessa puolet ikkunasta. C:n viivoitettu yläraja kannattaa ottaa B:hen.',
  // Sizes
  about: (s: string) => `noin ${s}`,
  atMost: (s: string) => `enintään ${s}`,
  counted: (s: string) => `${s} (laskettu)`,
  loading: 'Haetaan kokoa…',
  atMostHint: 'Microsoftin luvussa ovat mukana versiohistoria ja roskakori, joita ei kopioida.',
  // B and C capacity
  nothingChosen: 'Mitään ei ole valittu.',
  free: (f: string) => `Vapaana ${f}.`,
  loadingChosen: 'Kokoja haetaan Microsoftilta. Voit jo valita. Tila tarkistetaan joka tapauksessa ennen kopiointia.',
  fits: (approx: boolean, upper: boolean, total: string, free: string, quota: string) =>
    `Valittu ${upper ? 'enintään ' : approx ? 'noin ' : ''}${total}. Kotihakemistossa on vapaana ${free} / ${quota}.`,
  overB: (total: string, free: string) =>
    `Ei mahdu: valitut noin ${total}, vapaana ${free}. Valitse suurimmasta kirjastosta vain tarvitsemasi kansiot tai pyydä ylläpitäjältä lisää tilaa.`,
  overC: (total: string, free: string) =>
    `Ei mahdu: valitut noin ${total}, vapaana ${free}. Jätä jotain pois tai pyydä ylläpitäjältä lisää tilaa.`,
  overExact: (total: string, free: string) =>
    `Ei mahdu: valitut ${total} (laskettu), vapaana ${free}. Jätä jotain pois.`,
  maybe: (total: string, free: string) =>
    `Voi mahtua: valitut enintään ${total}, vapaana ${free}. Microsoftin luvussa ovat mukana versiohistoria ja roskakori, joita ei kopioida. Tarkka koko lasketaan ennen kopiointia, mikä voi isoilla kirjastoilla kestää kymmeniä minuutteja.`,
  startCount: 'Laske ja aloita',
  // B
  open: (name: string) => `Näytä kirjaston ${name} kansiot`,
  close: (name: string) => `Piilota kirjaston ${name} kansiot`,
  partOf: (n: number, of: number, size: string) => `${n}/${of} kansiota · ${size}`,
  rootFiles: 'Tiedostot kansioiden ulkopuolella',
  childrenLater: 'Kansioiden koot lasketaan ennen kopiointia.',
  // C
  meterUsed: 'Jo käytössä',
  meterFree: (s: string) => `${s} jää vapaaksi`,
  meterOver: (s: string) => `${s} liikaa`,
  meterMaybeOver: (s: string) => `Yli enintään ${s}`,
  meterUncertain: 'Viivoitettu: yläraja, todellinen koko voi olla pienempi',
  noRoom: 'Ei mahdu enää',
  aloneTooBig: 'Liian suuri yksinään',
  // Refusal
  needLine: (needed: string, free: string, short: string) =>
    `Valitut tiedostot laskettiin: tarvitaan ${needed}, vapaana on ${free}. Puuttuu ${short}.`,
  countedTitle: 'Lasketut koot',
  keptChoose: 'Kirjautuminen säilyi, joten Outlook, kalenteri ja yhteystiedot toimivat jo. Lasketut koot ovat nyt valinnassa: kirjastoja, joita et muuta, ei lasketa uudelleen.',
  chooseAgain: 'Valitse uudelleen',
  closeDialog: 'Sulje',
  // Unavailable sites
  notOpen: 'Ei avattavissa',
  otherTenant: 'Todennäköisesti toisen organisaation jaettu kanava. Sen tiedostot ovat kumppanin Microsoft 365:ssä, eikä tämän organisaation kirjautuminen avaa niitä.',
  notFound: 'Ei löytynyt. Sivusto on ehkä poistettu. Kun lopetat sen seuraamisen SharePointissa, ilmoitus poistuu.',
  sitesNotice: (other: string, gone: string) =>
    `Kahta seurattua sivustoa ei voitu avata, joten ne jätettiin pois. ${other} on todennäköisesti toisen organisaation jaettu kanava, jonka tiedostoja tämän organisaation kirjautuminen ei avaa. Sivustoa ${gone} ei löytynyt, joten se on ehkä poistettu.`,
  // Names (synthetic)
  names: {
    onedrive: 'OneDrive',
    myynti: 'Myynti · Asiakirjat',
    projektit: 'Projektit · Asiakirjat',
    asiakirjat: 'Asiakirjat', kuvat: 'Kuvat', tallenteet: 'Tallenteet', tyopoyta: 'Työpöytä',
    tarjoukset: 'Tarjoukset', sopimukset: 'Sopimukset', esitykset: 'Esitykset',
    y2026: '2026', arkisto: 'Arkisto',
    channel: 'Hankinnat-Toimittajat', intranet: 'Vanha intranet · Asiakirjat',
  } as Record<string, string>,
  away: 'Prototyyppi ei avaa ulkoisia osoitteita:',
};

const en: typeof fi = {
  title: 'Microsoft folder choice and sizes · round 1',
  scenario: 'Situation',
  theme: 'Theme', light: 'Light', dark: 'Dark',
  language: 'Language',
  reset: 'Reset',
  scenarios: {
    ladataan: 'Sizes loading',
    mahtuu: 'Sizes known, the choice fits',
    ylittyy: 'The choice does not fit (before the count)',
    arvio: 'Only Microsoft’s storage figure (upper bound)',
    torjuttu: 'Refused after the count',
    sivusto: 'Two sites do not open',
  },
  roundLine: 'Same in all: after the sign-in Habitat asks Microsoft for the size of OneDrive and of each SharePoint library, which takes a couple of seconds, and shows it as an estimate. The exact size is still counted after the choice, before anything is copied. If the choice does not fit then, the dialog says how much is needed and how much is free. All data is made up.',
  lines: [
    'A Rows: production’s folder step as it is. The host gives every library Microsoft’s estimate, and the space meter and warning work as they do for Google. The refusal says what was needed and what was free.',
    'B Folders open: a library opens and only some of its folders can be chosen, each with its size. A choice that does not fit opens the largest library. After a refusal the choice comes back with the counted sizes.',
    'C Space meter: free space is a meter at the top that the chosen libraries fill. An uncertain estimate is hatched, and a library that no longer fits is marked. The refusal shows the counted size running past the meter.',
  ],
  recommend: 'Recommendation: B. In the pilot the libraries did not fit together and none could be taken in part. A only tells which library to leave out whole. B’s per-folder sizes come from the same Graph request that lists the folders. C’s meter is clear but takes half the dialog on a phone. C’s hatched upper bound is worth taking into B.',
  about: (s) => `about ${s}`,
  atMost: (s) => `at most ${s}`,
  counted: (s) => `${s} (counted)`,
  loading: 'Getting the size…',
  atMostHint: 'Microsoft’s figure includes version history and the recycle bin, which are not copied.',
  nothingChosen: 'Nothing is chosen.',
  free: (f) => `${f} free.`,
  loadingChosen: 'Getting the sizes from Microsoft. You can already choose. The space is checked before anything is copied in any case.',
  fits: (approx, upper, total, free, quota) =>
    `Chosen ${upper ? 'at most ' : approx ? 'about ' : ''}${total}. The home directory has ${free} / ${quota} free.`,
  overB: (total, free) =>
    `Does not fit: chosen about ${total}, ${free} free. Choose only the folders you need from the largest library, or ask the administrator for more space.`,
  overC: (total, free) =>
    `Does not fit: chosen about ${total}, ${free} free. Leave something out or ask the administrator for more space.`,
  overExact: (total, free) =>
    `Does not fit: chosen ${total} (counted), ${free} free. Leave something out.`,
  maybe: (total, free) =>
    `May fit: chosen at most ${total}, ${free} free. Microsoft’s figure includes version history and the recycle bin, which are not copied. The exact size is counted before copying, which can take tens of minutes for large libraries.`,
  startCount: 'Count and start',
  open: (name) => `Show the folders of ${name}`,
  close: (name) => `Hide the folders of ${name}`,
  partOf: (n, of, size) => `${n}/${of} folders · ${size}`,
  rootFiles: 'Files outside folders',
  childrenLater: 'The folders’ sizes are counted before copying.',
  meterUsed: 'Already used',
  meterFree: (s) => `${s} stays free`,
  meterOver: (s) => `${s} too much`,
  meterMaybeOver: (s) => `At most ${s} over`,
  meterUncertain: 'Hatched: upper bound, the real size may be smaller',
  noRoom: 'No longer fits',
  aloneTooBig: 'Too large on its own',
  needLine: (needed, free, short) =>
    `The chosen files were counted: ${needed} needed, ${free} free. ${short} short.`,
  countedTitle: 'Counted sizes',
  keptChoose: 'The sign-in was kept, so Outlook, calendar and contacts already work. The counted sizes are now in the choice: libraries you do not change are not counted again.',
  chooseAgain: 'Choose again',
  closeDialog: 'Close',
  notOpen: 'Cannot be opened',
  otherTenant: 'Probably another organisation’s shared channel. Its files are in the partner’s Microsoft 365, and this organisation’s sign-in does not open them.',
  notFound: 'Not found. The site may have been removed. Stop following it in SharePoint and the notice goes away.',
  sitesNotice: (other, gone) =>
    `Two followed sites could not be opened, so they were left out. ${other} is probably another organisation’s shared channel, whose files this organisation’s sign-in does not open. ${gone} was not found and may have been removed.`,
  names: {
    onedrive: 'OneDrive',
    myynti: 'Sales · Documents',
    projektit: 'Projects · Documents',
    asiakirjat: 'Documents', kuvat: 'Pictures', tallenteet: 'Recordings', tyopoyta: 'Desktop',
    tarjoukset: 'Quotes', sopimukset: 'Contracts', esitykset: 'Presentations',
    y2026: '2026', arkisto: 'Archive',
    channel: 'Procurement-Suppliers', intranet: 'Old intranet · Documents',
  },
  away: 'The prototype opens no external addresses:',
};

export const TEXT: Record<Lang, typeof fi> = {fi, en};
