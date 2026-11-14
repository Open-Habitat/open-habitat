# text/explainMode.ts

Generated from web/src/text/explainMode.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The explain mode (components/ExplainMode.tsx, experimental): the bar, the
// card each part of the screen shows while the mode is on, and the state
// card of a conversation. The cards are also the agent's description of the
// interface: each card's id names a part in components/explainParts.ts,
// which says which element it is (its test id or class), its kind and its
// shortcut.
//
// How a card speaks (proto-explain-mode-r6, style 1):
// - name: the same word as on screen or in the button's tooltip.
// - lead: what the part does for you, starting with a verb or "Shows";
//   never "This button…"; about 12 words at most.
// - know: the one thing worth knowing (what is kept, what does not happen,
//   when it is grey, where it is on a phone); about 20 words; absent when
//   there is nothing to say.
// - try: what a press does, as an imperative; only where a press is safe.
//   Archive, delete and sign out tell how to undo instead.
// - grey: shown only while the part is disabled; menu: shown only when the
//   part is a row of ⋯ instead of the top bar.
// Second person, calm and direct, no internals (paths, protocols, model
// ids). A card does not repeat what the part already says: a settings page
// has one card, its rows describe themselves.
//
// states: the card of the conversation as a whole, by the state the screen
// shows (the header's dot, the latest turn). `can` lists what you can do now,
// each keyed by the card id of the part that does it.
const fi = {
  bar: {
    title: "Selitystila",
    hint: "Osoita mitä tahansa kohtaa; napsautus toimii kuten aina.",
    hintTouch: "Napauta mitä tahansa kohtaa, niin näet, mitä se tekee.",
    now: "Tilanne",
    showState: "Näytä tilanne",
    stop: "Lopeta",
  },
  card: {
    clickHint: (action: string) => `Napsautus: ${action}.`,
    clickOpens: "Napsautus avaa sen; selitystila pysyy päällä.",
    tapAgain: "Napauta uudelleen, niin se tapahtuu.",
    open: "Avaa",
    close: "Sulje kortti",
    waits:
      "Selitystilassa tämä odottaa, jotta mitään ei tapahdu vahingossa. Lopeta tila, niin painike toimii.",
    waited:
      "Selitystilassa tämä ei tee mitään. Lopeta tila (Esc), niin painike toimii.",
    onlyHover:
      "Näkyy vain, kun osoitin on rivillä. Kosketusnäytöllä se näkyy aina.",
    now: "Tilanne nyt",
    can: "Voit nyt",
  },
  strip: {
    title: "Mitä näytöllä on?",
    text: "Vie osoitin minkä tahansa kohdan päälle, niin näet, mitä se tekee.",
    textTouch: "Napauta mitä tahansa kohtaa, niin näet, mitä se tekee.",
    go: "Selitä nämä mulle",
    end: "Lopeta selitys",
    close: "Sulje nauha",
  },
  entry: "Selitä tämä näkymä",
  toggle: "Selitä",
  workerLegend: {
    caption: "Workerien merkit",
    working: "Työskentelee",
    idle: "Odottaa sinua",
    waiting_parent: "Odottaa pääagenttia",
    unknown: "Tila ei tiedossa",
    merged: "Valmis",
    unfinished: "Kesken, työ tallessa",
    failed: "Epäonnistui, ei työtä tallessa",
    unmerged: "Päättyi keskeneräisenä, ei työtä tallessa",
    checking: "Agentti käsittelee pyyntöä",
    answer: "Odottaa vastaustasi",
    reported: "Avustajan uusi kierrosraportti",
    waited: "Kehä: agentti odottaa workeria",
    gone: "Työn jäljet poistettu",
  },
  kinds: {
    panel: "Paneeli",
    once: "Kertatoiminto",
    info: "Tietoa",
    menu: "Valikko",
    nav: "Siirtyminen",
    list: "Luettelo",
    input: "Kirjoitus",
    page: "Asetussivu",
  },
  cards: {
    J01: {
      name: "Jaetut",
      lead: "Avaa näkymien ja tiedostojen osoitteet keskusteluittain.",
      know: "Sivupalkin luku kertoo julkisten osoitteiden määrän.",
      try: "Avaa Jaetut",
    },
    J02: {
      name: "Jaetut",
      lead: "Näyttää jaot, niiden julkisuuden ja valitun kohteen sisällön.",
      know: "Keskustelut ovat uusimman toiminnan mukaisessa järjestyksessä. Puhelimella avaat ensin jaon listasta.",
    },
    J03: {
      name: "Keskustelu",
      lead: "Avaa keskustelun, josta nämä jaot ovat peräisin.",
      know: "Päivä kertoo keskustelun viimeisimmän toiminnan, ei jaon päivää.",
      try: "Avaa keskustelu",
    },
    J04: {
      name: "Jakojen suodatin",
      lead: "Rajaa listan julkisiin, yksityisiin tai päättyneisiin jakoihin.",
      know: "Päättyneissä ovat myös osoitteet, joiden kohde on poistettu.",
    },
    J05: {
      name: "Jako",
      lead: "Avaa jaon sisällön, osoitteen ja julkisuuden ohjaimet.",
      know: "Jaettu-päivä kertoo osoitteen luomisen. Uudelleenjulkaisu ei muuta sitä.",
      try: "Avaa jako",
    },
    J06: {
      name: "Jaon tila",
      lead: "Kertoo, kuka voi avata osoitteen ja mihin asti.",
      know: "Vain sinä tarkoittaa omaa kirjautumistasi. Poistettu kohde ei enää aukea.",
    },
    J07: {
      name: "Jaon osoite",
      lead: "Kopioi kentässä näkyvän osoitteen leikepöydälle kuvakkeesta.",
      know: "Anna osoite sille, jolle haluat näyttää julkisen kohteen.",
      try: "Kopioi linkki",
    },
    J09: {
      name: "Tee yksityiseksi",
      lead: "Lopettaa julkisuuden, mutta säilyttää osoitteen.",
      know: "Voit julkaista saman osoitteen uudelleen, kun palvelin sallii jakamisen.",
    },
    J08: {
      name: "Poista osoite",
      lead: "Poistaa osoitteen pysyvästi vahvistuksen jälkeen.",
      know: "Vanha linkki lakkaa toimimasta. Kohteen tiedostot jäävät, mutta osoitetta ei voi palauttaa.",
    },
    X01: {
      name: "Selitä nämä mulle",
      lead: "Avaa selitystilan, jossa näet, mitä mikä tahansa kohta näytöllä tekee.",
      know: "Nauha näkyy ensimmäisellä tyhjällä aloitussivulla. Myöhemmin tila löytyy Tilivalikosta ja keskustelun ?-painikkeesta.",
    },
    X02: {
      name: "Selitystila",
      lead: "Kertoo, että näyttö on selitystilassa: osoittamasi kohta selittyy, ja painallus toimii kuten aina.",
      know: "Esc tai Lopeta palauttaa tavallisen näkymän. Arkistointi, poisto ja lähettäminen odottavat, kunnes lopetat.",
    },
    X03: {
      name: "Selitä tämä näkymä",
      lead: "Avaa selitystilan siinä näkymässä, jossa olet.",
      know: "Sama tila kuin aloitussivun nauhassa; se löytyy aina Tilivalikosta ja puhelimella myös ⋯-valikosta.",
    },
    X05: {
      name: "Selitä",
      lead: "Avaa selitystilan tilakortista.",
      know: "Toinen painallus lopettaa tilan. Tilakortin saa takaisin palkin tilanteesta ylhäältä.",
    },
    Y01: {
      name: "Keskustelun nimi",
      lead: "Napsauta nimeä, niin voit kirjoittaa keskustelulle oman nimen.",
      know: "Ensimmäisen viestin jälkeen nimi syntyy itsestään; oma nimesi pysyy, kunnes vaihdat sen.",
      try: "Nimeä uudelleen",
      menu: "Puhelimella myös ⋯ › Nimeä uudelleen.",
    },
    Y02: {
      name: "Työtila",
      lead: "Vie työtilan sivulle: esittely, Git-tila ja muut avoimet keskustelut.",
      know: "Työtila on kansio palvelimella, yleensä Git-repo, ja agentti työskentelee siinä.",
      try: "Avaa työtila",
      menu: "Kapealla näytöllä nimi on ⋯-valikon ylimmällä rivillä.",
    },
    Y03: {
      name: "Keskustelun tila",
      lead: "Kertoo yhdellä pisteellä, työskenteleekö agentti, odottaako se sinua vai onko työ valmis.",
      know: "Napauta pistettä, niin tila näkyy sanoina ja vuoron kesto sen vieressä.",
      try: "Näytä tila",
    },
    Y04: {
      name: "Git-tila",
      lead: "Näyttää työtilan haaran: ↑ lähettämättä, ↓ tulossa ja muuttuneiden tiedostojen määrän.",
      know: "Avaa Git-tiedot, joista näet commitit ja muuttuneet tiedostot. Tietojen katsominen ei muuta mitään.",
      try: "Avaa Git-tiedot",
    },
    Y05: {
      name: "Konteksti",
      lead: "Näyttää, kuinka suuren osan agentin muistista tämä keskustelu jo vie.",
      know: "Kun muisti täyttyy, agentti tiivistää vanhimman osan yhteenvedoksi ja jatkaa. Painallus avaa erittelyn.",
      try: "Avaa erittely",
    },
    Y06: {
      name: "Malli",
      lead: "Malli ja ajattelutaso, joilla agentti vastaa tässä keskustelussa.",
      know: "Painallus kertoo, mihin malli sopii. Malli valitaan ennen ensimmäistä viestiä; uusien keskustelujen oletus on Asetuksissa.",
      try: "Näytä mallin tiedot",
    },
    Y07: {
      name: "Editori",
      lead: "Avaa työtilan tiedostot muokattavaksi keskustelun viereen.",
      know: "Agentin muutokset tulevat auki olevaan tiedostoon; jos muokkaatte samaa riviä, saat valita, kumpi jää.",
      try: "Avaa editori",
    },
    Y08: {
      name: "Pääte",
      lead: "Avaa komentorivin tämän työtilan kansioon, keskustelun alle.",
      know: "Pääte jatkaa palvelimella, vaikka suljet selaimen. Numero kertoo, montako päätettä on auki.",
      try: "Avaa pääte",
    },
    Y09: {
      name: "Tee tilannekatsaus nyt",
      lead: "Pyytää lyhyen yhteenvedon siitä, mitä keskustelussa on tehty ja mitä seuraavaksi.",
      know: "Katsaus tulee keskustelun yläpuolelle korttina. Se ei mene agentin muistiin.",
      try: "Tee katsaus",
      grey: "Harmaa, kun keskustelussa ei ole vielä viestejä.",
      menu: "Kapealla näytöllä ⋯ › Tee tilannekatsaus nyt.",
    },
    Y10: {
      name: "Luo uusi otsikko",
      lead: "Antaa keskustelulle uuden nimen sen nykyisen sisällön mukaan.",
      know: "Hyödyllinen, kun keskustelu on kääntynyt toiseen aiheeseen kuin se alkoi.",
      try: "Luo otsikko",
      menu: "Kapealla näytöllä ⋯ › Luo uusi otsikko.",
    },
    Y11: {
      name: "Arkistoi",
      lead: "Siirtää keskustelun pois listoilta. Mitään ei poisteta.",
      know: "Arkistoidun keskustelun saat takaisin työtilan sivun arkistosta.",
      grey: "Harmaa, kun agentin vuoro on kesken: odota, että se päättyy.",
      menu: "Kapealla näytöllä ⋯ › Arkistoi.",
    },
    Y12: {
      name: "Sulje",
      lead: "Sulkee tämän tyhjän keskustelun.",
      know: "Vain selaimessa aloitetun tyhjän keskustelun voi sulkea; siitä ei jää mitään talteen.",
    },
    Y13: {
      name: "Tiedot",
      lead: "Näyttää keskustelun perustiedot: työtilan, mallin, ajattelutason ja aloitusajan.",
      know: "Tunnisteen voi kopioida, jos haluat jatkaa samaa keskustelua päätteessä.",
      try: "Avaa tiedot",
      menu: "Kapealla näytöllä ⋯ › Tiedot.",
    },
    Y14: {
      name: "Keskustelun toiminnot",
      lead: "Kokoaa keskustelun toiminnot, jotka eivät nyt mahdu riville.",
      know: "Valikossa on vain se, mitä rivillä ei näy; leveämmässä ikkunassa samat ovat suoraan rivillä.",
      try: "Avaa valikko",
    },
    Y15: {
      name: "Opas",
      lead: "Näyttää tai piilottaa valitun tavoitteen oppaan keskustelun vieressä.",
      know: "Opas kertoo vaiheet ja mitä saat. Se ei seuraa, missä vaiheessa agentti on.",
      try: "Piilota opas",
    },
    Y16: {
      name: "Avaa navigaatio",
      lead: "Avaa sivupalkin, jossa ovat kaikki keskustelusi ja työtilasi.",
      know: "Kun jokin odottaa sinua, se näkyy merkkinä tässä painikkeessa.",
      try: "Avaa sivupalkki",
    },
    Y17: {
      name: "Keskustelun tiedot",
      lead: "Kokoaa puhelimella yhteen työtilan, Git-tilan, kontekstin ja mallin.",
      know: "Rivi avaa saman kuin leveällä näytöllä otsikkorivin vastaava painike.",
    },
    Y18: {
      name: "Ilmoitus",
      lead: "Kertoo, mitä juuri tapahtui, esimerkiksi mikä arkistoitiin tai mikä kuvake otettiin käyttöön.",
      know: "Virhe jää näkyviin, kunnes suljet sen tai yrität uudelleen. × sulkee ilmoituksen; se ei peru tehtyä.",
    },
    Y19: {
      name: "Palauta",
      lead: "Peruu juuri tehdyn muutoksen: palauttaa arkistoidun tai edellisen kuvakkeen.",
      know: "Kuvakkeen ilmoituksessa painikkeen nimi on Kumoa.",
    },
    Y20: {
      name: "Arkistoitu",
      lead: "Kertoo, milloin keskustelu arkistoitiin, ja näyttää sen avustajat.",
      know: "Keskustelua voi lukea, mutta siihen ei voi kirjoittaa ennen kuin palautat sen.",
    },
    Y21: {
      name: "Palauta",
      lead: "Palauttaa keskustelun arkistosta, jotta voit jatkaa sitä.",
      know: "Viestikenttä palaa ja avustajat tulevat mukana käynnistämättä. Keskustelun voi arkistoida uudelleen.",
    },
    Y22: {
      name: "Yhteysilmoitus",
      lead: "Kertoo yhteyden katkeamisesta, kirjautumisen tarpeesta tai uudesta versiosta.",
      know: "Pyörivä merkki tarkoittaa, että Habitat yrittää itse. Ilmoitus pysyy, kunnes tilanne muuttuu.",
    },
    Y23: {
      name: "Yritä yhteyttä uudelleen",
      lead: "Tarkistaa yhteyden ja hakee ajantasaisen tilanteen. Ei lähetä viestejäsi uudelleen.",
      try: "Tarkista yhteys",
    },
    Y24: {
      name: "Lataa uusi versio",
      lead: "Lataa sivun uudelleen, jotta saat palvelimella olevan version käyttöösi.",
      know: "Keskeneräinen viestiluonnos säilyy tässä välilehdessä.",
    },
    Y25: {
      name: "Päätteen ilmoitus",
      lead: "Kertoo päätteen tapahtumasta tai toiminnosta, joka ei onnistunut. Epävarma tulos ei tarkoita, että toiminto jäi tekemättä.",
      know: "Ilmoitus ei katoa ajastimella. × sulkee sen muuttamatta päätteen tilaa.",
    },
    S01: {
      name: "Palvelimen nimi",
      lead: "Tämän Habitatin nimi; napsautus vie etusivulle.",
      know: "Nimen antaa palvelimen ylläpitäjä, ja se näkyy kaikille.",
    },
    S02: {
      name: "Yhteys",
      lead: "Kertoo, onko selaimella yhteys palvelimeen juuri nyt.",
      know: "Jos yhteys katkeaa, näkyvä tieto voi olla vanhaa, ja Habitat sanoo sen tässä.",
    },
    S03: {
      name: "Etusivu",
      lead: "Näyttää kaikki työtilasi ja niiden avoimet keskustelut yhdellä sivulla.",
      try: "Avaa etusivu",
    },
    S04: {
      name: "Sulje navigaatio",
      lead: "Kaventaa sivupalkin kuvakeriviksi, jotta keskustelulle jää enemmän tilaa.",
      know: "Samasta kohdasta saat sivupalkin takaisin; puhelimella se sulkee laatikon.",
    },
    S05: {
      name: "Sinun vuorosi",
      lead: "Keskustelut, joissa agentti odottaa sinua: vastausta, päätöstä tai luettavaa.",
      know: "Keskustelu pysyy tässä, kunnes vastaat tai painat rivin Ei nyt -painiketta. Pelkkä lukeminen ei siirrä sitä pois.",
    },
    S06: {
      name: "Käynnissä",
      lead: "Keskustelut, joissa agentti tai worker työskentelee juuri nyt, työtiloittain.",
      know: "Kun työ valmistuu, keskustelu siirtyy Sinun vuorosi -listaan.",
    },
    S07: {
      name: "Hiljaiset",
      lead: "Keskustelut, joissa mikään ei odota sinua eikä ole käynnissä.",
      know: "Rivin Nosta-painikkeella siirrät keskustelun Sinun vuoroosi. Otsikko taittaa listan piiloon; auki oleva keskustelu jää silti näkyviin.",
      try: "Taita lista",
    },
    S08: {
      name: "Rajaa ja järjestä Hiljaiset",
      lead: "Näyttää Hiljaisista vain yhden työtilan ja valitsee järjestyksen.",
      know: "Kirjaimet ovat työtilojen lyhenteet. Valinta säilyy kaikilla laitteillasi.",
      try: "Avaa rajaus",
    },
    S09: {
      name: "Keskustelurivi",
      lead: "Avaa keskustelun. Rivillä ovat tila, nimi, työtila ja milloin siinä viimeksi tapahtui.",
      know: "Auki olevan keskustelun rivillä on kehys.",
    },
    S10: {
      name: "Tilapallo",
      lead: "Keskustelun tila yhdellä merkillä: sykkivä työskentelee, täysi pallo odottaa sinua tai on valmis.",
      know: "Salmiakki tarkoittaa, että vuoro epäonnistui, ja tyhjä rengas, ettei tilaa juuri nyt tiedetä.",
    },
    S11: {
      name: "Workerin merkki",
      lead: "Keskustelu on antanut työtä workerille. Haaran päässä oleva pallo kertoo workerin tilan.",
      know: "Useasta workerista näkyy keltainen, jos joku odottaa sinua. Kehä pallon ympärillä: agentti odottaa workeria. Workerit avautuvat keskustelun Workerit-sirusta.",
    },
    S12: {
      name: "Nimeä uudelleen",
      lead: "Antaa keskustelulle oman nimen suoraan listasta.",
      know: "Painike näkyy, kun osoitin on rivin päällä.",
    },
    S13: {
      name: "Arkistoi",
      lead: "Siirtää keskustelun pois listoilta. Mitään ei poisteta.",
      know: "Arkistoidun keskustelun saat takaisin työtilan sivun arkistosta.",
    },
    S14: {
      name: "Työtilat",
      lead: "Kaikki työtilasi; luku kertoo, montako niitä on.",
      know: "Arkistoidut työtilat ovat listan lopussa omana ryhmänään.",
    },
    S15: {
      name: "Uusi työtila",
      lead: "Lisää työtilan: kloonaa repo koodipalvelusta tai luo tyhjä kansio.",
      know: "Työtila tulee kotihakemistosi src-kansioon, ja agentti voi aloittaa siinä heti.",
    },
    S16: {
      name: "Suodata työtiloja",
      lead: "Rajaa sivupalkin työtilat ja keskustelut kirjoittamasi nimen mukaan.",
      know: "Tyhjennä kenttä, niin kaikki näkyvät taas.",
    },
    S17: {
      name: "Päivitä",
      lead: "Lukee työtilat ja keskustelut palvelimelta uudelleen.",
      know: "Lista päivittyy yleensä itsestään; tätä tarvitset, jos jokin näyttää vanhalta.",
      try: "Päivitä",
    },
    S18: {
      name: "Työtilarivi",
      lead: "Avaa työtilan sivun: esittely, Git-tila ja avoimet keskustelut.",
      know: "Merkki rivin lopussa kertoo, että työtilassa on käynnissä työtä.",
      try: "Avaa työtila",
    },
    S19: {
      name: "Uusi keskustelu työtilassa",
      lead: "Aloittaa uuden keskustelun suoraan tähän työtilaan.",
      know: "Uusi keskustelu alkaa työtilan aloitussivulta, jossa on valmiita tavoitteita.",
      try: "Aloita keskustelu",
    },
    S20: {
      name: "Kaikki työtilat",
      lead: "Avaa kavennetun sivupalkin takaisin täyteen leveyteen.",
      know: "Kavennettuna sivupalkki näyttää vain kuvakkeet ja tilapisteet.",
    },
    S21: {
      name: "Tilivalikko",
      lead: "Asetukset, teema, agentin työn näkyvyys ja uloskirjautuminen.",
      know: "Täältä löytyy myös Selitä tämä näkymä, missä tahansa olet.",
      try: "Avaa tilivalikko",
    },
    S22: {
      name: "Asetukset",
      lead: "Avaa omat asetuksesi: tili, mallit, yhteydet palveluihin ja ulkoasu.",
      try: "Avaa asetukset",
    },
    S23: {
      name: "Palvelimen ylläpito",
      lead: "Palvelimen asetukset, jotka koskevat kaikkia sen käyttäjiä.",
      know: "Näkyy vain ylläpitäjälle.",
    },
    S24: {
      name: "Teema",
      lead: "Valitsee vaalean tai tumman ulkoasun, tai seuraa laitteen asetusta.",
      know: "Valinta koskee vain tätä selainta.",
    },
    S25: {
      name: "Agentin työ",
      lead: "Valitsee, näkyvätkö agentin ajattelu ja työkalut keskustelussa auki vai piilossa.",
      know: "Piilossa työ näkyy yhtenä rivinä, jonka saa auki painamalla.",
    },
    S26: {
      name: "Kirjaudu ulos…",
      lead: "Kirjaa sinut ulos tästä selaimesta. Agentit jatkavat työtään palvelimella.",
      know: "Kysyy vahvistuksen ensin; muut laitteesi pysyvät kirjautuneina.",
    },
    S27: {
      name: "Järjestys",
      lead: "Järjestää Hiljaiset uusimman, työtilan tai nimen mukaan.",
    },
    S28: {
      name: "Työtilan ruutu",
      lead: "Näyttää Hiljaisissa vain tämän työtilan keskustelut; Kaikki palauttaa koko listan.",
      know: "Luku kertoo, montako hiljaista keskustelua työtilassa on.",
    },
    S29: {
      name: "Valmis",
      lead: "Sulkee rajauksen; valintasi on jo tallessa.",
    },
    S30: {
      name: "Työtilan kuvake",
      lead: "Avaa kortin, jossa on työtilan koko nimi ja mistä sen kuvake tulee.",
      know: "Kortista pääset työtilan sivulle tai aloitat siinä uuden keskustelun.",
    },
    S31: {
      name: "Nosta Sinun vuoroosi",
      lead: "Siirtää hiljaisen keskustelun Sinun vuorosi -listaan muistutukseksi tailspin.",
      know: "Agentin tila ei muutu. Laske-painike vie sen takaisin Hiljaisiin.",
    },
    S32: {
      name: "Laske Hiljaisiin",
      lead: "Palauttaa itse nostamasi keskustelun Hiljaisiin.",
    },
    S33: {
      name: "Ei nyt",
      lead: "Siirtää vastausta odottavan keskustelun Hiljaisiin, kun et ehdi siihen nyt.",
      know: "Keskustelu säilyy ennallaan. Nosta tuo sen takaisin Sinun vuoroosi.",
    },
    E01: {
      name: "Työtilat",
      lead: "Etusivu kokoaa kaikki työtilasi ja niiden avoimen työn yhdelle sivulle.",
      know: "Yläreunan yhteenveto kertoo, moniko keskustelu odottaa sinua ja moniko on käynnissä.",
    },
    E02: {
      name: "Työtilan otsake",
      lead: "Työtilan nimi ja haara; alla sen avoimet keskustelut kortteina.",
      know: "Nimestä pääset työtilan sivulle, +:sta aloitat uuden keskustelun.",
    },
    E03: {
      name: "Keskustelukortti",
      lead: "Keskustelun tila ja viimeisin tilannekatsaus: mitä tehtiin ja mitä seuraavaksi.",
      know: "Katsauksen ansiosta näet tilanteen avaamatta keskustelua.",
    },
    E04: {
      name: "Vain luku",
      lead: "Keskustelua ohjataan nyt muualta, esimerkiksi päätteestä, joten selaimessa voit lukea sitä.",
      know: "Kun muu ohjaus päättyy, voit taas kirjoittaa siihen selaimesta.",
    },
    E05: {
      name: "Katsauksen ikä",
      lead: "Kertoo, kuinka vanha kortin tilannekatsaus on.",
    },
    E06: {
      name: "Avaa",
      lead: "Vie keskusteluun, jossa voit jatkaa siitä, mihin jäätiin.",
      try: "Avaa keskustelu",
    },
    E07: {
      name: "Ei avointa työtä",
      lead: "Työtilat, joissa ei ole nyt avoimia keskusteluja.",
      know: "Aloita uusi keskustelu rivin +:sta.",
    },
    E08: {
      name: "Sulje katsaus",
      lead: "Piilottaa tilannekatsauksen näkyvistä; keskusteluun se ei vaikuta.",
    },
    T01: {
      name: "Työtilan nimi",
      lead: "Työtilan nimi; kansion nimi, ellei sille ole annettu näyttönimeä.",
    },
    T46: {
      name: "Työtilan kansio",
      lead: "Näyttää työtilan kansion sijainnin palvelimella.",
      know: "Kopioi polku -painikkeella saat koko polun leikepöydälle.",
    },
    T02: {
      name: "Kopioi polku",
      lead: "Kopioi työtilan kansion sijainnin leikepöydälle, esimerkiksi päätteeseen liitettäväksi.",
      try: "Kopioi",
    },
    T03: {
      name: "Avaa GitHubissa",
      lead: "Avaa työtilan repon GitHubissa uuteen välilehteen.",
      grey: "Harmaa, kun työtilaa ei ole kloonattu GitHubista.",
    },
    T04: {
      name: "Muuta näyttönimeä…",
      lead: "Antaa työtilalle nimen, joka näkyy vain Habitatissa.",
      know: "Kansion nimi ei muutu, joten päätteessä ja agentilla kaikki toimii kuten ennen.",
    },
    T05: {
      name: "Arkistoi työtila",
      lead: "Siirtää työtilan sivupalkin Arkistoidut-ryhmään. Tiedostot ja keskustelut säilyvät.",
      know: "Sieltä saat sen takaisin Palauta-painikkeella.",
    },
    T06: {
      name: "Poista työtila…",
      lead: "Siirtää työtilan kansion roskakoriin.",
      know: "Kysyy vahvistuksen ensin. Roskakorista sen voi palauttaa: Asetukset › Tallennustila.",
    },
    T07: {
      name: "Uusi worktree-agentti",
      lead: "Aloittaa agentin omassa worktreessä: erillinen kopio ja haara, jotka eivät sotke nykyistä työtä.",
      know: "Sopii, kun haluat kokeilla tai tehdä kahta asiaa yhtä aikaa samassa repossa.",
    },
    T08: {
      name: "Aloita uusi keskustelu",
      lead: "Aloittaa uuden keskustelun tämän työtilan agentin kanssa.",
      try: "Aloita keskustelu",
    },
    T09: {
      name: "Aloitussivu",
      lead: "Työtilan esittely ja ehdotuksia siitä, mitä täällä voi tehdä.",
      know: "Agentti kirjoittaa ja päivittää sen pyynnöstä; sama sivu näkyy uuden keskustelun alussa.",
    },
    T10: {
      name: "Näytä koko esittely",
      lead: "Avaa esittelyn kokonaan; Näytä vähemmän lyhentää sen taas.",
      try: "Näytä koko",
    },
    T11: {
      name: "Tavoite",
      lead: "Aloittaa uuden keskustelun, jonka pyyntö on kirjoitettu valmiiksi.",
      know: "Ennen lähettämistä voit lisätä pyyntöön omat tietosi.",
      try: "Aloita tällä tavoitteella",
    },
    T12: {
      name: "Git",
      lead: "Työtilan haara ja muutosten määrä; painallus avaa Git-tiedot.",
      know: "↑ on lähettämättä, ↓ tulossa etärevosta.",
    },
    T13: {
      name: "Avoimet keskustelut",
      lead: "Tämän työtilan keskustelut, joita ei ole arkistoitu, kortteina.",
    },
    T14: {
      name: "Työtilan arkisto",
      lead: "Tämän työtilan arkistoidut keskustelut, uusin arkistoitu ensin ja päivittäin ryhmiteltyinä.",
      know: "Mitään ei ole poistettu: avaa keskustelu luettavaksi tai palauta se avoimiin.",
    },
    T15: {
      name: "Worktreet",
      lead: "Agenttien ja omat Git-työkopiot (worktreet) ja niiden viemä levytila.",
      know: "Työtilan sivulla näkyvät ensin ne, jotka tarvitsevat sinua. Muut hoituvat itsestään.",
    },
    T16: {
      name: "Työkopio",
      lead: "Kertoo, kenen työkopio on, mistä keskustelusta se tuli ja mitä sille tapahtuu seuraavaksi.",
      know: "Avustajan työkopio vapautuu itsestään, kun sen kierrokset on yhdistetty ja se on ollut vuorokauden joutilaana.",
    },
    T17: {
      name: "Git-tiedot",
      lead: "Näyttää työkopion hakemiston, haaran, koon ja ajon tunnuksen.",
      know: "Niillä löydät saman työkopion terminaalista. Katsominen ei muuta mitään.",
      try: "Näytä Git-tiedot",
    },
    T18: {
      name: "Hoituu ilman sinua",
      lead: "Työkopiot, joita agentti vielä käyttää tai jotka vapautuvat itsestään.",
      know: "Niille ei tarvitse tehdä mitään.",
      try: "Näytä ne",
    },
    T19: {
      name: "Palauta keskustelu",
      lead: "Palauttaa keskustelun arkistosta ja avaa sen, jotta agentti voi päättää workerista.",
      know: "Habitat ei itse yhdistä eikä hylkää workeria; sen tekee keskustelun agentti. Keskustelun voi arkistoida uudelleen.",
    },
    T20: {
      name: "Keskustelu",
      lead: "Avaa keskustelun, jossa agentti hoitaa tämän työkopion.",
      try: "Avaa keskustelu",
    },
    T21: {
      name: "Poista…",
      lead: "Poistaa työkopion, jota kukaan ei enää käytä. Ensin näet, mitä häviää.",
      know: "Yhdistämätön työ jää haaraan. Tallenna ja poista commitoi muutokset haaraan ensin.",
    },
    T22: {
      name: "Siivoa merkintä",
      lead: "Poistaa Gitin luettelosta työkopion, jonka hakemisto on jo poistettu.",
      know: "Tiedostoja ei häviä, koska niitä ei enää ole.",
    },
    T23: {
      name: "Siivoa kaikki yhdistetyt",
      lead: "Poistaa kerralla työkopiot, joiden työ on yhdistetty ja joita kukaan ei pidä.",
      know: "Ensin näet listan. Commitoitua työtä ei häviä. Työtilan sivulla painike näkyy vain, kun siivottavaa on.",
    },
    T24: {
      name: "Vaihda kuvake",
      lead: "Avaa työtilan kuvakkeen valinnan: automaattinen, omat kirjaimet tai emoji.",
      know: "Kuvake näkyy sivupalkissa ja etusivulla.",
    },
    T25: {
      name: "Kuvakkeen valinta",
      lead: "Ottaa tämän kuvakkeen työtilan käyttöön heti.",
      know: "Valinta tallentuu työtilaan, ja Git-repossa Habitat commitoi sen; ilmoitus kertoo, miten kävi. Kumoa palauttaa edellisen.",
    },
    T26: {
      name: "Kirjaimet",
      lead: "Kirjoita 1–3 kirjainta; Enter ottaa ne kuvakkeeksi heti.",
    },
    T27: {
      name: "Ehdotuksia mallilta…",
      lead: "Pyytää mallia ehdottamaan kuvakkeita työtilan nimen ja esittelyn perusteella.",
      know: "Ehdotukset tulevat työtilan sivulle; mitään ei vaihdu ennen kuin valitset.",
    },
    T28: {
      name: "Kuvake-ehdotus",
      lead: "Mallin ehdottamat kuvakkeet perusteluineen tälle työtilalle.",
      know: "Toive tai pikatoive pyytää uudet ehdotukset; nuolet selaavat aiempia kierroksia. Jos mallia ei saada, tilalla on vaihtoehtoja ilman mallia.",
    },
    T29: {
      name: "Ehdotus",
      lead: "Ottaa tämän ehdotuksen työtilan kuvakkeeksi.",
      know: "Valinta tallentuu työtilaan, ja Git-repossa Habitat commitoi sen. Ilmoituksen Kumoa palauttaa edellisen.",
    },
    T30: {
      name: "Toive mallille",
      lead: "Kerro, millaista kuvaketta haluat, esimerkiksi kettu, sininen tai kirjaimet.",
      know: "Voit liittää kuvan tai tekstin esimerkiksi.",
    },
    T31: {
      name: "Lähetä",
      lead: "Lähettää toiveesi mallille, joka vastaa uusilla kuvake-ehdotuksilla.",
      grey: "Harmaa, kun kentässä ei ole tekstiä tai malli vielä miettii.",
    },
    T32: {
      name: "Pikatoive",
      lead: "Pyytää uudet ehdotukset valmiilla toiveella, esimerkiksi leikkisämpiä.",
    },
    T33: {
      name: "Ei nyt",
      lead: "Piilottaa ehdotukset. Kuvake ei muutu.",
      know: "Ehdotukset saa takaisin kuvakkeen valinnasta: Ehdotuksia mallilta….",
    },
    T34: {
      name: "Valmiit",
      lead: "Työtilan keskustelut, joiden agentti on suljettu eikä mitään ole lukematta.",
      know: "Ne eivät ole arkistossa. Rivi avaa keskustelun.",
      try: "Avaa lista",
    },
    T35: {
      name: "Muuta näyttönimeä",
      lead: "Kirjoita nimi, joka näkyy työtilalle Habitatissa; Tallenna ottaa sen käyttöön.",
      know: "Kansion nimi ei muutu.",
    },
    T36: {
      name: "Poista työtila",
      lead: "Tarkistaa ennen poistoa, käyttääkö jokin työtilaa ja mikä on vain tällä koneella.",
      know: "Keskustelut säilyvät agentin historiassa. Tarkista uudelleen lukee tilanteen, kun olet poistanut esteen.",
    },
    T37: {
      name: "Siirrä roskakoriin",
      lead: "Siirtää työtilan kansion roskakoriin ja poistaa sen listoilta.",
      know: "Roskakorista sen saa takaisin: Asetukset › Tallennustila.",
    },
    T39: {
      name: "Kuvakkeen lähde",
      lead: "Kertoo, mistä työtilan kuvake tulee: nimestä johdettu tunnus, repon logo tai oma valinta.",
    },
    T40: {
      name: "Oma emoji",
      lead: "Kirjoita yksi emoji; Käytä ottaa sen kuvakkeeksi.",
    },
    T41: {
      name: "Yritä uudelleen",
      lead: "Pyytää mallilta ehdotuksia uudelleen, kun edellinen pyyntö epäonnistui.",
    },
    T42: {
      name: "Etsi otsikosta",
      lead: "Rajaa arkiston keskustelut otsikon perusteella.",
      know: "Haku katsoo vain otsikoita, ei sitä, mitä keskusteluissa sanottiin.",
    },
    T43: {
      name: "Arkistoitu keskustelu",
      lead: "Avaa keskustelun luettavaksi sellaisena kuin se jäi.",
      know: "Arkistoituun keskusteluun ei voi kirjoittaa; palauta se jatkaaksesi. Rivin päivä kertoo, milloin se arkistoitiin.",
      try: "Avaa keskustelu",
    },
    T44: {
      name: "Palauta",
      lead: "Palauttaa keskustelun arkistosta avoimiin keskusteluihin.",
      know: "Sen avustajat palaavat mukana käynnistämättä. Keskustelun voi arkistoida uudelleen.",
    },
    T45: {
      name: "Jäljet",
      lead: "Kertoo, mitä keskustelusta jäi: avustaja nimeltä tai workerien työ ja sen tila.",
      know: "Tumma teksti on työtä, joka odottaa yhä jotakuta. Tarkan tilan ja haaran näet, kun avaat keskustelun.",
    },
    T38: {
      name: "Poista pysyvästi",
      lead: "Poistaa työtilan kansion lopullisesti, ohi roskakorin.",
      know: "Kansiota ei saa takaisin. Etärepossa oleva työ säilyy, ja sen voi kloonata uudelleen.",
    },
    A01: {
      name: "Työtilan esittely",
      lead: "Kertoo, mikä tämä työtila on, ennen kuin kirjoitat ensimmäisen viestin.",
      know: "Esittely katoaa, kun keskustelu alkaa.",
    },
    A02: {
      name: "Tavoite",
      lead: "Kirjoittaa pyynnön valmiiksi viestikenttään ja avaa oppaan viereen.",
      know: "Valmis tavoite voi käynnistää työn heti. Jos pyyntöä pitää täydentää tai kentässä on omaa tekstiäsi, se odottaa Lähetä-painallusta. Selitystilassa pyyntö vain valmistellaan.",
      try: "Valitse tavoite",
    },
    A03: {
      name: "Valittu tavoite",
      lead: "Tavoite, jonka pyyntö lähtee viestisi mukana; painallus näyttää pyynnön.",
    },
    A04: {
      name: "Poista tavoite",
      lead: "Poistaa tavoitteen viestistä; oma tekstisi jää kenttään.",
    },
    A05: {
      name: "Uuden keskustelun malli",
      lead: "Valitsee mallin ja ajattelutason, joilla tämä keskustelu alkaa.",
      know: "Oletuksena on Asetuksissa valittu malli; muutos koskee vain tätä keskustelua.",
      try: "Avaa mallit",
    },
    K01: {
      name: "Sinun viestisi",
      lead: "Viesti, jonka lähetit agentille.",
      know: "Pitkä viesti näkyy lyhennettynä; Näytä koko viesti avaa sen.",
    },
    K02: {
      name: "Kopioi viesti",
      lead: "Kopioi viestin tekstin leikepöydälle muotoiluineen.",
      try: "Kopioi",
    },
    K03: {
      name: "Välivastaus",
      lead: "Agentti kertoo työn lomassa, mitä se on tekemässä.",
      know: "Välivastaus ei vielä ole valmis vastaus; työ jatkuu sen alla.",
    },
    K04: {
      name: "Agentin työ",
      lead: "Agentin työvaiheet yhtenä rivinä: montako työkalua, epäonnistuiko jokin ja kauanko kesti.",
      know: "Painallus avaa jokaisen vaiheen omaksi rivikseen.",
      try: "Avaa työ",
    },
    K05: {
      name: "Komento",
      lead: "Agentti ajoi komennon työtilassa; rivillä on komento ja onnistuiko se.",
      know: "Avaa rivi, niin näet koko tulosteen kuin olisit ajanut komennon itse.",
      try: "Avaa tuloste",
    },
    K06: {
      name: "Luettu tiedosto",
      lead: "Agentti luki tiedoston; rivillä on tiedoston nimi ja montako riviä se luki.",
      know: "Lukeminen ei muuta tiedostoa.",
      try: "Näytä sisältö",
    },
    K07: {
      name: "Kirjoitettu tiedosto",
      lead: "Agentti kirjoitti tiedoston kokonaan; uusi tarkoittaa, ettei sitä ollut ennen.",
      know: "Avaa rivi, niin näet kirjoitetun sisällön.",
      try: "Näytä sisältö",
    },
    K08: {
      name: "Muokattu tiedosto",
      lead: "Agentti muutti tiedostoa; +1 −1 kertoo lisätyt ja poistetut rivit.",
      know: "Avaa rivi, niin näet muutoksen vihreänä ja punaisena.",
      try: "Näytä muutos",
    },
    K09: {
      name: "Taustaprosessi",
      lead: "Agentti käynnisti ohjelman jäämään päälle, esimerkiksi kehityspalvelimen.",
      know: "Käynnissä olevat prosessit näet viestikentän yllä Prosessit-merkistä.",
    },
    K10: {
      name: "Epäonnistunut vaihe",
      lead: "Tämä vaihe ei onnistunut, ja rivi on merkitty punaisella.",
      know: "Avaa rivi, niin näet virheen; agentti yleensä kertoo vastauksessa, mitä teki sen jälkeen.",
      try: "Näytä virhe",
    },
    K11: {
      name: "Vastaus valmis",
      lead: "Agentin vastaus, kun sen vuoro on päättynyt.",
      know: "Nyt on sinun vuorosi: vastaa, jatka tai jätä keskustelu odottamaan.",
    },
    K12: {
      name: "Tiedostolinkki",
      lead: "Avaa mainitun tiedoston editorissa, mainittujen rivien kohdalta.",
      know: "Rivinumerot kertovat, mihin kohtaan editori avautuu.",
      try: "Avaa editorissa",
    },
    K13: {
      name: "Kaavio",
      lead: "Agentti piirsi kaavion; Kaavion lähde näyttää, mistä tekstistä se syntyi.",
    },
    K14: {
      name: "Kaavion lähde",
      lead: "Näyttää kaavion tekstinä, jotta voit kopioida tai muokata sitä.",
    },
    K20: {
      name: "Markdown-esikatselu",
      lead: "Vaihtaa lohkon lähteen ja muotoillun esikatselun välillä. Kopiointi ottaa aina lähteen.",
    },
    K21: {
      name: "Esikatselun pituus",
      lead: "Avaa pitkän luonnoksen kokonaan tai rajaa sen taas lyhyemmäksi.",
    },
    K22: {
      name: "Tiivistys",
      lead: "Kertoo, että agentti tiivistää tai tiivisti vanhimmat viestit yhteenvedoksi, tai miksi tiivistys jäi tekemättä.",
      know: "Vanhat viestit jäävät luettaviksi; agentti näkee niistä enää yhteenvedon. Yhteenveto aukeaa rivin alta.",
    },
    K15: {
      name: "Kopioi koodi",
      lead: "Kopioi laatikon koko sisällön leikepöydälle.",
    },
    K16: {
      name: "Rivitä pitkät rivit",
      lead: "Taittaa pitkät rivit näkyviin, ettei tarvitse vierittää sivuttain.",
    },
    K17: {
      name: "Agentti työskentelee",
      lead: "Kertoo, mitä agentti tekee juuri nyt ja kauanko vuoro on kestänyt.",
      know: "Voit kirjoittaa viestin sillä aikaa: se menee ohjauksena tai työn jälkeen.",
    },
    K18: {
      name: "Näytä työ",
      lead: "Avaa agentin ajattelun ja työkalut näkyviin kesken vuoron.",
      know: "Piilota työ taittaa ne taas yhdeksi riviksi.",
    },
    K19: {
      name: "Tarkista keskustelun tila",
      lead: "Kysyy palvelimelta keskustelun tilan uudelleen, kun se näyttää jääneen jumiin.",
      know: "Tarkistus ei itse lähetä mitään. Jos se osoittaa, ettei agentti saanut viestiäsi, Habitat lähettää viestin kerran uudelleen.",
    },
    K26: {
      name: "Keskustelun koko",
      lead: "Kertoo, kun keskustelu on kasvanut niin suureksi, että se alkaa hidastua.",
      know: "Kokoa kertyy lähinnä kuvista. Yli 512 Mt:n keskustelu aukeaa uusimmista viesteistä. Mitään ei katoa, ja voit yhä jatkaa sitä.",
    },
    K27: {
      name: "Uusi keskustelu",
      lead: "Vie työtilaan, josta aloitat uuden keskustelun puhtaalta pöydältä.",
      know: "Tämä keskustelu jää ennalleen luettavaksi ja arkistoitavaksi.",
      try: "Siirry työtilaan",
    },
    K28: {
      name: "Selvä",
      lead: "Piilottaa kokovaroituksen tästä keskustelusta.",
      know: "Varoitus palaa, kun lataat sivun uudelleen, ja yli 512 Mt:n keskustelussa se näkyy aina.",
      try: "Piilota varoitus",
    },
    K29: {
      name: "Avaa kuvat",
      lead: "Näyttää rivin kuvat; kukin latautuu sitten omasta painikkeestaan.",
      know: "Monta suurta kuvaa on koottu yhdelle riville, jotta muu historia pysyy kevyenä lukea.",
      try: "Avaa kuvat",
    },
    K30: {
      name: "Muutokset",
      lead: "Näyttää vuoron muuttamat tiedostot ja rivimäärät ja avaa listan tähän.",
      know: "Tieto tulee agentin työkalukutsuista. Komennon muuttama tiedosto näkyy vain, jos komento nimeää sen.",
      try: "Avaa muutokset",
    },
    K31: {
      name: "Aikajana",
      lead: "Näyttää vuoron muutokset sen kellolla listan sijaan.",
      know: "Ympyrä on agentin muokkaus ja neliö komento. Merkki avaa juuri sen muutoksen.",
      try: "Näytä aikajana",
    },
    K32: {
      name: "Avaa editorissa",
      lead: "Avaa tiedoston editoriin keskustelun viereen ensimmäisestä muuttuneesta rivistä.",
      know: "Rivi tiedetään, kun vuoro luki tiedoston ennen muutosta. Muuten tiedosto avautuu alusta.",
      try: "Avaa editorissa",
    },
    V33: {
      name: "Muut ilmoitukset",
      lead: "Näyttää myös keskustelun ja luonnoksen muut ilmoitukset.",
      know: "Tavallisesti näkyy kaksi ilmoitusta, esteet ensin. Uusi painallus supistaa pinon.",
      try: "Näytä tai piilota muut ilmoitukset",
    },
    V34: {
      name: "Yritä uudelleen",
      lead: "Yrittää tallentaa uudelleen liitteet, joiden tallennus katkesi.",
      know: "Onnistuneet liitteet tulevat luonnokseen. Viestiä ei lähetetä.",
    },
    V36: {
      name: "Liitteen eteneminen",
      lead: "Rengas ja prosentti näyttävät, kuinka paljon tiedostosta on lähtenyt. Tallennetaan tarkoittaa, että se odottaa vielä vahvistusta.",
      know: "Lähetä odottaa kaikkia liitteitä. Viesti lähtee vasta, kun painat sitä itse.",
    },
    V37: {
      name: "Peru tiedoston liittäminen",
      lead: "× lopettaa tämän tiedoston lähettämisen ja poistaa sen luonnoksesta.",
      know: "Jo tallennetut liitteet jäävät viestiin, ja jonossa olevat jatkavat.",
    },
    V35: {
      name: "Keskustelun ilmoitus",
      lead: "Kertoo, mikä estää työn, on epävarmaa, käynnissä tai korjautui.",
      know: "Tila näkyy, kunnes se muuttuu. Torjunta jää seuraavaan yritykseen tai sulkemiseen asti.",
    },
    V32: {
      name: "Piilota liiteilmoitus",
      lead: "Piilottaa ilmoituksen muuttamatta viestiä tai sen liitteitä.",
      know: "Jos liitteet eivät mahdu viestiin, lähettäminen näyttää varoituksen uudelleen.",
    },
    V01: {
      name: "Viesti agentille",
      lead: "Kirjoita, mitä haluat agentin tekevän; Enter lähettää, Shift+Enter tekee uuden rivin.",
      know: "Luonnos säilyy tällä välilehdellä, vaikka vaihdat keskustelua.",
    },
    V02: {
      name: "Liitä",
      lead: "Liittää viestiin tiedostoja tai kuvia omalta laitteeltasi.",
      know: "Voit myös vetää tiedostot kenttään.",
    },
    V03: {
      name: "Komennot",
      lead: "Listaa agentin komennot ja taidot, jotka voit liittää viestin alkuun.",
      know: "Saman listan saat kirjoittamalla / kentän alkuun.",
      try: "Avaa komennot",
    },
    V04: {
      name: "Tiedosto",
      lead: "Lisää viestiin viittauksen työtilan tiedostoon, jotta agentti tietää, mitä tarkoitat.",
      know: "Kirjoita @ kentässä tai paina Ctrl+P, niin sama kansiopuu aukeaa kentän sisään. Tab merkitsee tiedostoja, Enter lisää merkityt.",
      try: "Avaa tiedostot",
    },
    V05: {
      name: "Sanele",
      lead: "Kirjoittaa puheesi viestikenttään; napauta aloittaaksesi tai pidä pohjassa puhuessasi.",
      know: "Teksti jää kenttään tarkistettavaksi, ja Esc peruu. Ilman saneluavainta painallus kertoo, mistä sen saa.",
    },
    V06: {
      name: "Lähetä",
      lead: "Lähettää viestin agentille.",
      know: "Kun agentti työskentelee, sama painike lähettää viestin ohjauksena tai työn jälkeen.",
      grey: "Harmaa, kun kentässä ei ole tekstiä.",
    },
    V07: {
      name: "Pysäytä agentti",
      lead: "Pysäyttää agentin työn heti.",
      know: "Jo tehty jää: tiedostoihin tehdyt muutokset eivät peruunnu.",
    },
    V08: {
      name: "Viestin tapa",
      lead: "Valitsee, saako agentti viestisi heti työn lomassa (Ohjaa) vai vasta työn jälkeen.",
      know: "Alt+Enter lähettää kerran toisella tavalla vaihtamatta valintaa.",
    },
    V09: {
      name: "Taustatyö",
      lead: "Viestikentän yllä olevat merkit kertovat workereista ja prosesseista, jotka jatkavat taustalla.",
      know: "Merkki puuttuu, kun taustalla ei ole mitään.",
    },
    V10: {
      name: "Prosessit",
      lead: "Agentin käynnistämät ohjelmat, jotka jäävät päälle, kuten kehityspalvelin.",
      know: "Kysymysmerkki tarkoittaa, ettei tilaa juuri nyt saada; se ei tarkoita, ettei prosesseja ole.",
    },
    V11: {
      name: "Workerit",
      lead: "Workerit, joille agentti antoi työtä.",
      know: "Agentti voi odottaa workerin valmistumista ja jatkaa itse sen jälkeen.",
      try: "Avaa workerit",
    },
    V12: {
      name: "Workerien merkit",
      lead: "Sama merkki kertoo workerin tilan sirussa, listassa ja sivupalkissa.",
      know: "Kehä kertoo, että agentti odottaa. Kehän puuttuminen ei todista, ettei agentti odota: odotuksen kohdetta ei aina tunnisteta.",
    },
    V13: {
      name: "Näkymät ja tiedostot",
      lead: "Kaikki, mitä agentti on tässä keskustelussa tarjonnut: näkymät ja tiedostot, uusin ylimpänä.",
      know: "Kun agentti tarjoaa saman tiedoston tai kansion uudelleen, uusi versio tulee samalle riville; samanniminen raportti muualta saa oman rivinsä. Rivi avaa kohteen keskustelun viereen, ja sama rivi sulkee sen.",
      try: "Avaa lista",
    },
    V14: {
      name: "Tarjottu kohde",
      lead: "Agentin tarjoama näkymä tai tiedosto. Kortti avaa sen keskustelun viereen, ja uusi painallus sulkee.",
      know: "Kulman kuvakkeet julkaisevat kohteen, avaavat sen omalle välilehdelle ja lataavat sen. Julkisen kohteen voi avata kuka tahansa linkin saanut kirjautumatta; kansio jaetaan kokonaan.",
    },
    V15: {
      name: "Avustajat",
      lead: "Robottikuvake avaa avustajat. Sen vieressä on kunkin avustajan tilamerkki.",
      know: "Avustajat jäävät odottamaan kierroksen jälkeen. Viestit, kierrosten yhdistäminen ja lopetus kulkevat pääagentin kautta.",
      try: "Avaa avustajat",
    },
    V16: {
      name: "Avustaja",
      lead: "Avaa avustajan keskustelun luettavaksi. Rivillä näkyvät tehtävä, kierrokset ja viimeisin raportti.",
      know: "Kirjoita avustajalle pääagentin kautta. Raportin avaaminen kuittaa sen nähdyksi, ei yhdistä työtä.",
    },
    V17: {
      name: "Avaa kohde",
      lead: "Avaa näkymän tai tiedoston keskustelun viereen. Uusi painallus sulkee sen.",
      know: "Listan kuvake kertoo kohteen lajin, kellonaika milloin se tarjottiin. Julkisen kohteen kohdalla näkyy voimassaoloaika.",
    },
    V18: {
      name: "Versiot",
      lead: "Näyttää tai piilottaa saman näkymän aiemmat versiot.",
      know: "Luku kertoo versioiden kokonaismäärän. Ylin rivi avaa uusimman version.",
    },
    V19: {
      name: "Näytä keskustelussa",
      lead: "Puhekupla vie viestiin, jossa agentti tarjosi kohteen.",
    },
    V20: {
      name: "Julkinen",
      lead: "Maapallo julkaisee kohteen linkillä tai poistaa sen julkisuuden.",
      know: "Julkisen linkin saanut voi avata kohteen kirjautumatta. Voimassaoloajan voi vaihtaa päivämäärästä.",
      grey: "Julkaisutietoa tarkistetaan tai muutos on vielä kesken.",
    },
    V21: {
      name: "Voimassaoloaika",
      lead: "Avaa vaihtoehdot sille, kuinka kauan julkinen linkki toimii.",
      know: "Pelkkä valikon avaaminen ei muuta voimassaoloaikaa.",
    },
    V22: {
      name: "Vaihda voimassaoloaika",
      lead: "Asettaa julkisen linkin uuden päättymisajan.",
    },
    V23: {
      name: "Kopioi linkki",
      lead: "Kopioi julkisen osoitteen leikepöydälle jaettavaksi.",
      try: "Kopioi linkki",
    },
    V24: {
      name: "Avaa omalle välilehdelle",
      lead: "Vinonuoli avaa kohteen omaan selaimen välilehteen.",
      know: "Avaaminen ei julkaise kohdetta.",
    },
    V25: {
      name: "Lataa",
      lead: "Alanuoli lataa kohteen omalle laitteellesi.",
      know: "Palvelimella oleva kohde säilyy ennallaan.",
      try: "Lataa kohde",
    },
    V26: {
      name: "Sulje lista",
      lead: "Sulkee näkymien ja tiedostojen listan poistamatta mitään.",
      try: "Sulje lista",
    },
    V27: {
      name: "Lopeta odotus",
      lead: "Lopettaa pääagentin odotuksen. Avustaja tai workeri jatkaa työtään.",
      know: "Pääagentti ei herää tämän odotuksen kautta työn valmistuessa.",
    },
    V28: {
      name: "Viestiä ei lähetetty",
      lead: "Kertoo, että liitteet eivät mahdu yhteen viestiin, ja montako ja kuinka suuria niitä on.",
      know: "Yhteen viestiin mahtuu 30 tiedostoa ja yhteensä 100 Mt. Poista liitteitä: kun loput mahtuvat, voit lähettää viestin.",
    },
    V29: {
      name: "Käsittele",
      lead: "Pyytää agenttia tarkistamaan päättyneiden workerien worktreet ja suosittelemaan, mitä niille tehdään.",
      know: "Pyyntö lähtee agentille viestinä, ja agentti vastaa keskustelussa. Mitään ei poisteta ennen kuin päätät.",
    },
    V30: {
      name: "Päättyneet",
      lead: "Avaa tai taittaa päättyneiden rivit.",
    },
    V31: {
      name: "Kerro agentille",
      lead: "Pyytää agenttia tarkistamaan tämän workerin worktreen ja suosittelemaan, mitä sille tehdään.",
      know: "Pyyntö lähtee agentille viestinä. Mitään ei poisteta ennen kuin päätät.",
    },
    B01: {
      name: "Selain",
      lead: "Avaa palvelimella olevan selaimesi ikkunat; käynnistää selaimen, jos se on pysähtynyt.",
      know: "Tilamerkki ja teksti kertovat, käyttääkö selainta agentti vai sinä tai odottaako agentti apuasi.",
    },
    B02: {
      name: "Selaimen ikkunat",
      lead: "Näyttää ikkunoiden esikatselut ja agentin mahdollisen avunpyynnön.",
      know: "Esikatselun avaaminen ei ota ohjausta. Ota ohjaus erikseen, kun haluat toimia itse.",
    },
    B03: {
      name: "Katso isona",
      lead: "Avaa selaimen ikkunan suurempana katseltavaksi, ilman ohjausta.",
    },
    B04: {
      name: "Ota ohjaus",
      lead: "Siirtää selaimen ohjauksen sinulle. Agentti odottaa sillä aikaa.",
      know: "Palauta ohjaus agentille, kun olet valmis.",
      grey: "Ohjauksen vaihto on vielä kesken tai selain ei ole käytettävissä.",
    },
    B05: {
      name: "Anna takaisin agentille",
      lead: "Luovuttaa selaimen ohjauksen takaisin agentille.",
    },
    B06: {
      name: "Sulje selain",
      lead: "Sulkee palvelimella olevan selaimen ja sen ikkunat.",
      know: "Voit käynnistää selaimen uudelleen Selain-painikkeesta.",
    },
    B07: {
      name: "Oma selain",
      lead: "Avaa palvelimella olevan selaimesi näkymän.",
      know: "Rivi näyttää selaimen tilan ja ikkunoiden määrän.",
    },
    B08: {
      name: "Sulje näkymä",
      lead: "Sulkee selaimen suuren näkymän. Selain jää käyntiin palvelimelle.",
      try: "Sulje näkymä",
    },
    H01: {
      name: "Keskustelun avustaja",
      lead: "Näyttää avustajan kierroksen tilan ja onko työ yhdistetty.",
      know: "Haaramerkki kertoo keskeneräisestä tai varmistamattomasta työstä; valintamerkki yhdistetystä. Arkistointi ei lopeta avustajaa eikä yhdistä työtä.",
    },
    H02: {
      name: "Näytä haara",
      lead: "Avaa avustajan työn haaratiedot tarkasteltavaksi.",
      know: "Tietojen katsominen ei yhdistä eikä poista työtä.",
    },
    L01: {
      name: "Hae komentoa tai taitoa",
      lead: "Rajaa listan kirjoittamasi mukaan; Enter lisää ylimmän viestin alkuun.",
    },
    L02: {
      name: "Taito",
      lead: "Agentin osaama työtapa, esimerkiksi commitointi tai testin korjaaminen.",
      know: "Oma taito on sinun, projektin taito tulee tästä reposta.",
    },
    L03: {
      name: "Komento",
      lead: "Valmis pyyntöpohja tai agentin oma komento, joka ajetaan viestin alussa.",
      know: "Päätteen valikkoja käyttävää komentoa ei voi ajaa selaimesta; lista kertoo sen.",
    },
    L04: {
      name: "Tiedostorivi",
      lead: "Työtilan tiedosto; valinta lisää sen nimen viestiin.",
      know: "Muutetut tiedostot ovat ylimpänä, koska niistä puhutaan useimmin.",
    },
    L05: {
      name: "Muutoksen merkki",
      lead: "Kertoo, miten tiedosto on muuttunut: U uusi, M muutettu, D poistettu.",
    },
    L06: {
      name: "Palveluntarjoaja",
      lead: "Valitsee, minkä tilauksen tai avaimen malleista valitset.",
      know: "Harmaa vaihtoehto ei ole käytettävissä; syy ja korjaus näkyvät alla.",
    },
    L07: {
      name: "Malli",
      lead: "Malli, jolla agentti vastaa; ylimpänä kyvykkäin, ja kuvaus kertoo, mihin kukin sopii.",
    },
    L08: {
      name: "Vanhemmat mallit",
      lead: "Näyttää myös vanhemmat mallit, jotka ovat yhä käytettävissä.",
    },
    L09: {
      name: "Ajattelutaso",
      lead: "Kuinka paljon malli miettii ennen vastaamista: korkeampi on perusteellisempi mutta hitaampi.",
      know: "Vain mallin tukemat tasot ovat valittavissa.",
    },
    L10: {
      name: "Oletusmallin asetukset",
      lead: "Vie Asetuksiin, jossa valitset uusien keskustelujen oletusmallin.",
    },
    L11: {
      name: "Valitse",
      lead: "Ottaa valitun mallin ja tason käyttöön tälle keskustelulle.",
    },
    L12: {
      name: "Tekoäly-asetukset",
      lead: "Avaa asetukset, joissa kirjaudut mallipalveluun tai lisäät avaimen.",
    },
    P01: {
      name: "Git-tila",
      lead: "Työtilan haara verrattuna etärepoon ja pohjahaaraan, sekä muuttuneet tiedostot.",
      know: "Paneeli vain näyttää; muutokset haaraan teet agentin tai päätteen kautta.",
    },
    P02: {
      name: "Seurantahaara",
      lead: "Etärepon haara, johon tämä haara pushaa ja josta se hakee muutokset.",
      know: "↑ on lähettämättä, ↓ tulossa.",
    },
    P03: {
      name: "Lähettämättä",
      lead: "Commitit, jotka ovat tällä koneella mutta eivät vielä etärepossa.",
      know: "Pyydä agenttia pushaamaan, kun haluat ne talteen etärepoon.",
    },
    P04: {
      name: "Tulossa",
      lead: "Commitit, jotka ovat etärepossa mutta eivät vielä tässä haarassa.",
      know: "Luku on viimeisimmän haun tieto; Päivitä tila hakee uudet.",
    },
    P05: {
      name: "Pohjahaara",
      lead: "Haara, josta tämä haara tehtiin, yleensä main.",
      know: "Edellä ja jäljessä kertovat, kuinka kauas haarat ovat erkaantuneet.",
    },
    P06: {
      name: "Edellä pohjahaaraa",
      lead: "Tämän haaran commitit, joita pohjahaarassa ei vielä ole.",
      know: "Ne ovat se työ, joka yhdistetään, kun haara viedään pohjahaaraan.",
    },
    P07: {
      name: "Jäljessä pohjahaarasta",
      lead: "Pohjahaaraan tulleet commitit, joita tässä haarassa ei vielä ole.",
      know: "Pyydä agenttia tuomaan ne, jos tarvitset niitä ennen yhdistämistä.",
    },
    P08: {
      name: "Muutokset",
      lead: "Tiedostot, jotka ovat muuttuneet viimeisimmän commitin jälkeen, ja muutettujen rivien määrä.",
      know: "Kirjain kertoo laadun: M muutettu, U uusi, D poistettu.",
    },
    P09: {
      name: "Päivitä tila",
      lead: "Hakee etärepon uusimmat tiedot ja lukee haaran tilan uudelleen.",
      know: "Ei muuta haaraa eikä tiedostoja; muutokset tuot pyytämällä agenttia.",
    },
    P10: {
      name: "Tiedot",
      lead: "Keskustelun työtila, malli, ajattelutaso, ohjaus ja aloitusaika.",
      know: "Kopioi-painikkeet antavat tiedon täsmälleen, esimerkiksi päätteeseen liitettäväksi.",
    },
    P11: {
      name: "Keskustelun malli",
      lead: "Kertoo keskustelun mallin ja ajattelutason ja mihin ne sopivat.",
      know: "Tässä ei voi vaihtaa mitään. Selaimessa malli valitaan ennen ensimmäistä viestiä viestikentän vasemmasta reunasta.",
    },
    P12: {
      name: "Opas",
      lead: "Valitun tavoitteen vaiheet ja mitä saat, keskustelun vieressä.",
      know: "Ohje, ei agentin edistyminen: Habitat ei tiedä, missä vaiheessa agentti on.",
    },
    P13: {
      name: "Leveys",
      lead: "Vedä reunasta, niin keskustelun ja paneelin leveys muuttuu.",
    },
    P14: {
      name: "Taustatyön välilehdet",
      lead: "Vaihtaa paneelissa workereiden ja prosessien välillä.",
    },
    P15: {
      name: "Workerin rivi",
      lead: "Yksi worker: sen tehtävä, kesto ja odottaako agentti sitä. Painallus avaa sen näkymän.",
      try: "Avaa worker",
    },
    P16: {
      name: "Sulje",
      lead: "Sulkee paneelin, valikon tai ilmoituksen. Mitään ei muutu.",
    },
    P17: {
      name: "Takaisin keskusteluun",
      lead: "Palaa keskusteluun, josta avasit kontekstin erittelyn.",
      try: "Takaisin",
    },
    P18: {
      name: "Kontekstin erittely",
      lead: "Näyttää, mistä agentin muisti tässä keskustelussa koostuu ja milloin se seuraavaksi tiivistyy.",
      know: "Vuorot-taulukossa näkyy, miten konteksti kasvoi vuoro vuorolta. Sivun katsominen ei muuta keskustelua.",
    },
    R01: {
      name: "Pääte",
      lead: "Tavallinen komentorivi työtilan kansiossa omana käyttäjänäsi.",
      know: "Tab ja Esc kuuluvat päätteelle; Ctrl+Alt+T vie fokuksen välilehtiin ja takaisin.",
    },
    R02: {
      name: "Päätteen välilehti",
      lead: "Yksi auki oleva pääte; nimi kertoo, mitä siinä on käynnissä.",
      know: "Piste kertoo, että pääte odottaa kehotteessa; muuten siinä on ohjelma ajossa.",
    },
    R03: {
      name: "Lopeta pääte",
      lead: "Sulkee päätteen ja lopettaa siinä käynnissä olevan ohjelman.",
    },
    R04: {
      name: "Uusi pääte",
      lead: "Avaa uuden päätteen samaan työtilaan omaksi välilehdekseen.",
    },
    R05: {
      name: "Suurenna",
      lead: "Antaa päätteelle koko näkymän; Palauta koko tuo keskustelun takaisin.",
    },
    R06: {
      name: "Piilota paneeli",
      lead: "Piilottaa päätepaneelin; päätteet jatkavat ja löytyvät Pääte-painikkeesta.",
      know: "Puhelimella sama on Takaisin keskusteluun -nuoli.",
    },
    R07: {
      name: "Paneelin korkeus",
      lead: "Vedä reunasta, niin päätteen ja keskustelun välinen raja liikkuu.",
    },
    R08: {
      name: "Päätteen näppäimet",
      lead: "Muistilista: valitse tekstiä Shift pohjassa vetämällä, Ctrl+C kopioi ja Ctrl+V liittää.",
    },
    R09: {
      name: "Näppäinrivi",
      lead: "Puhelimen näppäimistöstä puuttuvat näppäimet: Esc, Tab, Ctrl, Alt ja nuolet.",
      know: "Ctrl ja Alt jäävät pohjaan seuraavaa näppäintä varten.",
    },
    R10: {
      name: "Valinta",
      lead: "Kopioi päätteessä valitun tekstin tai vie sen keskustelun kirjoituskenttään.",
      know: "Kopioitu tarkoittaa, että teksti on jo leikepöydällä. Ctrl+Shift+C kopioi saman.",
    },
    R11: {
      name: "Osoite päätteestä",
      lead: "Päätteen ohjelma pyysi avaamaan verkko-osoitteen; kortti näyttää, mihin se vie.",
      know: "Osoite avautuu uuteen välilehteen vasta, kun painat. Ohita sulkee kortin.",
    },
    D01: {
      name: "Editori",
      lead: "Työtilan tiedosto muokattavana keskustelun vieressä; otsikko on tiedoston nimi.",
      know: "Agentin muutokset tulevat auki olevaan tiedostoon, ja ristiriidassa valitset, mikä jää.",
    },
    D02: {
      name: "Tiedostot",
      lead: "Näyttää tai piilottaa tiedostopuun editorin vieressä.",
    },
    D03: {
      name: "Tallenna",
      lead: "Tallentaa muutoksesi tiedostoon.",
      grey: "Harmaa, kun tiedostossa ei ole tallentamattomia muutoksia.",
    },
    D04: {
      name: "Editori koko ikkunaan",
      lead: "Antaa editorille koko ikkunan; Palauta rinnakkain tuo keskustelun takaisin viereen.",
    },
    D05: {
      name: "Sulje editori",
      lead: "Sulkee editorin; tallentamattomista muutoksista kysytään ensin.",
    },
    D06: {
      name: "Työtilan tiedostot",
      lead: "Työtilan kansiot ja tiedostot; tiedosto aukeaa editoriin painamalla.",
      know: "Haku etsii vain jo avattujen kansioiden nimistä.",
    },
    D07: {
      name: "Suodata nimellä",
      lead: "Rajaa tiedostopuun kirjoittamasi nimen mukaan.",
    },
    D08: {
      name: "Ei tiedostoa auki",
      lead: "Avaa tiedosto puusta tai keskustelun tiedostolinkistä.",
    },
    W01: {
      name: "Worker",
      lead: "Katsot workeria: agenttia, jolle pääkeskustelu antoi tehtävän omaan worktreehensä.",
      know: "Workerin työ näkyy tässä, mutta ohjaat sitä pääkeskustelun kautta.",
    },
    W02: {
      name: "Pääkeskusteluun",
      lead: "Palaa keskusteluun, josta tämä worker sai tehtävänsä.",
      try: "Palaa pääkeskusteluun",
    },
    W03: {
      name: "Agentti ja profiili",
      lead: "Millä agentilla ja asetuksilla worker tekee työtään.",
    },
    W04: {
      name: "Vain luku · kysy pääagentin kautta",
      lead: "Workerille ei kirjoiteta suoraan; tämä vie pääkeskusteluun, jossa voit kysyä siitä.",
      try: "Kysy pääagentilta",
    },
    W05: {
      name: "Pääagentti · tehtävä",
      lead: "Tehtävä, jonka pääagentti antoi workerille, sanatarkasti.",
    },
    M01: {
      name: "Hae asetuksista",
      lead: "Löytää asetuksen nimellä tai sen kuvauksen sanalla, kaikilta sivuilta kerralla.",
    },
    M02: {
      name: "Sulje asetukset",
      lead: "Palaa siihen näkymään, josta avasit asetukset.",
    },
    M03: {
      name: "Tili",
      lead: "Nimesi ja kuvasi, Git-identiteetti, näkymiesi osoitteet ja uloskirjautuminen.",
    },
    M04: {
      name: "Laitteet",
      lead: "Kirjaudu puhelimella koodin avulla ja katso, millä laitteilla olet kirjautunut.",
    },
    M05: {
      name: "Avaimet",
      lead: "Tilisi julkiset SSH- ja age-avaimet, joita ylläpitäjä tarvitsee pääsyyn tai salaisuuksiin.",
    },
    M06: {
      name: "Tekoäly",
      lead: "Oletusmalli, agentin työn näkyvyys sekä tilaukset ja avaimet, joilla mallit saadaan.",
    },
    M07: {
      name: "Tilannekatsaus",
      lead: "Milloin ja millä mallilla katsaus tehdään, ja kuinka paljon se lukee ja kirjoittaa.",
    },
    M08: {
      name: "Sanelu",
      lead: "Avain, jolla sanelu kirjoittaa puheesi viestikenttään.",
    },
    M09: {
      name: "Koodipalvelut",
      lead: "GitHub, Gitea ja GitLab: mistä työtilat kloonataan ja minne agentit pushaavat.",
    },
    M10: {
      name: "Tiedot agenteille",
      lead: "Sähköposti, kalenterit, yhteystiedot ja tiedostot, joita agenttisi saavat käyttää.",
    },
    M11: {
      name: "Omat koneet",
      lead: "Omat tietokoneesi, joille agentti pääsee Tailscalen kautta.",
    },
    M12: {
      name: "Ulkoasu",
      lead: "Teema tälle selaimelle ja käyttöliittymän kieli kaikille laitteillesi.",
    },
    M13: {
      name: "Editori",
      lead: "Millä editorilla työtilan tiedostot avautuvat.",
    },
    M14: {
      name: "Tallennustila",
      lead: "Kuinka paljon tilaa käytät, ja roskakori, josta poistetut työtilat palautetaan.",
    },
    M15: {
      name: "Kokeelliset ominaisuudet",
      lead: "Keskeneräiset ominaisuudet, jotka voit ottaa käyttöön itse.",
      know: "Ne voivat muuttua tai poistua; ne ovat oletuksena pois päältä.",
    },
    M16: {
      name: "Palvelimen ylläpito",
      lead: "Ylläpitäjän sivut: asetukset, jotka koskevat kaikkia palvelimen käyttäjiä.",
    },
    M17: {
      name: "Palvelin",
      lead: "Palvelimen nimi, oletuskieli ja käynnissä oleva versio.",
    },
    M18: {
      name: "Palvelinintegraatiot",
      lead: "Mitkä palvelut ovat käyttäjien käytettävissä tällä palvelimella.",
    },
    M19: {
      name: "AI-avain",
      lead: "Yhteinen avain niille, joilla ei ole omaa tilausta tai avainta.",
    },
    M20: {
      name: "Saneluavain",
      lead: "Yhteinen saneluavain kaikille, joilla ei ole omaa.",
    },
    M21: {
      name: "Käyttöönotto",
      lead: "Mitä uusi käyttäjä käy läpi ensimmäisellä kirjautumisella, ja miltä se hänestä näyttää.",
    },
    M22: {
      name: "Käyttäjät ja pääsy",
      lead: "Ketkä saavat kirjautua, liittyneet käyttäjät ja jaetut linkit.",
    },
    M23: {
      name: "Levytila",
      lead: "Kotihakemistojen levy ja kunkin käyttäjän tilaraja.",
    },
    M24: {
      name: "Muokkaa Git-identiteettiä",
      lead: "Asettaa nimen ja sähköpostin, jotka tulevat agentin ja sinun commiteihisi.",
    },
    M25: {
      name: "Versio",
      lead: "Palvelimen Habitat-versio ja onko tämä välilehti ajan tasalla sen kanssa.",
      know: "Jos ei ole, sivun lataaminen uudelleen tuo uuden version.",
    },
    M26: {
      name: "Keskustelut",
      lead: "Raja sille, montako keskustelua saa työskennellä yhtä aikaa, kaikille ja henkilöittäin.",
    },
    M27: {
      name: "Asetukset",
      lead: "Palaa puhelimella asetusten luetteloon tai hakutuloksiin.",
    },
    M28: {
      name: "Omat asetukset",
      lead: "Palaa ylläpidosta omiin asetuksiisi.",
    },
    M70: {
      name: "Atlassian",
      lead: "Yhdistä Jira ja Confluence omalla tililläsi.",
      know: "Valitse pyydettävät oikeudet. Yhteys näyttää myönnetyn luvan, joka voi olla pyyntöä laajempi.",
    },
    M71: {
      name: "Pyyntö ylläpitäjälle",
      lead: "Kopioi koko pyyntö ja toimita se ylläpitäjällesi.",
      know: "Habitat ei lähetä mitään. Odottaminen ei yksin tarkoita, että ylläpitäjä käsittelee pyyntöä.",
    },
    M72: {
      name: "Jira ja Confluence",
      lead: "Näyttää Atlassian-yhteyden kokeellisena ominaisuutena asetuksissa.",
      know: "Valinta ei yhdistä tiliä eikä katkaise jo tehtyä yhteyttä.",
    },
    M73: {
      name: "Kirjautuminen Atlassianiin",
      lead: "Aloittaa kirjautumisen tai viimeistelee sen liittämälläsi paluuosoitteella.",
      know: "Tason vaihtaminen poistaa vanhan kirjautumisen ennen uuden luvan pyytämistä.",
    },
    M74: {
      name: "Pyydettävät oikeudet",
      lead: "Valitse luku tai luku ja muokkaus ennen kirjautumista.",
      know: "Valinta ei vielä muuta yhteyttä. Tarkista myönnetyt oikeudet kirjautumisen jälkeen.",
    },
    M75: {
      name: "Poista Atlassian-yhteys",
      lead: "Poistaa tämän yhteyden kirjautumisen agenttien käytöstä.",
      know: "Jira-tehtäviä ja Confluence-sivuja ei poisteta. Voit yhdistää tilin uudelleen.",
    },
    M76: {
      name: "Trello",
      lead: "Yhdistä Trellon taulut ja kortit omalla tililläsi.",
      know: "Jokainen yhteys on oma kirjautumisensa. Se näyttää myönnetyn luvan, joka voi olla pyyntöä laajempi.",
    },
    M77: {
      name: "Lisää toinen Trello-yhteys",
      lead: "Lisää uuden Trello-kirjautumisen esimerkiksi toista Workspacea varten.",
      know: "Aiemmat yhteydet säilyvät ennallaan.",
    },
    M78: {
      name: "Pyyntö ylläpitäjälle",
      lead: "Kopioi koko pyyntö ja toimita se ylläpitäjällesi.",
      know: "Habitat ei lähetä mitään. Vain ylläpitäjä voi rajata Trellon varmasti pelkkään lukuun.",
    },
    M79: {
      name: "Trello",
      lead: "Näyttää Trello-yhteyden kokeellisena ominaisuutena asetuksissa.",
      know: "Valinta ei yhdistä tiliä eikä katkaise jo tehtyjä yhteyksiä.",
    },
    M80: {
      name: "Kirjautuminen Trelloon",
      lead: "Aloittaa kirjautumisen tai viimeistelee sen liittämälläsi paluuosoitteella.",
      know: "Trello kysyy kirjautuessa, mihin Workspaceen yhteys pääsee.",
    },
    M81: {
      name: "Pyydettävät oikeudet",
      lead: "Valitse luku tai luku ja muokkaus ennen kirjautumista.",
      know: "Trello voi myöntää pyydettyä enemmän. Tarkista myönnetty lupa kirjautumisen jälkeen.",
    },
    M82: {
      name: "Poista Trello-yhteys",
      lead: "Poistaa tämän yhteyden kirjautumisen agenttien käytöstä.",
      know: "Tauluja ja kortteja ei poisteta. Muut Trello-yhteydet säilyvät.",
    },
    N01: {
      name: "Työtilan lähde",
      lead: "Valitse, kloonataanko työtila valmiista reposta vai luodaanko uusi tyhjä hakemisto.",
    },
    N02: {
      name: "Hae repoa",
      lead: "Rajaa listaa nimellä. Kirjoita omistaja/repo, niin muukin repo haetaan.",
    },
    N03: {
      name: "Päivitetty",
      lead: "Näyttää vain repot, joihin on tullut muutoksia valitulla aikavälillä.",
    },
    N04: {
      name: "Repo",
      lead: "Valitsee repon ja näyttää sen tiedot. Mitään ei vielä kloonata.",
      know: "Rivillä ovat viimeisin muutos ja koko; lukko tarkoittaa yksityistä repoa.",
    },
    N05: {
      name: "Omistaja",
      lead: "Repot ryhmiteltyinä omistajan mukaan: omat, ryhmiesi ja yhteistyörepot.",
    },
    N06: {
      name: "Näytä kaikki",
      lead: "Näyttää ryhmän kaikki repot; Näytä vähemmän lyhentää listan taas.",
    },
    N07: {
      name: "Repon tiedot",
      lead: "Valitun repon tiedot ennen kloonausta: koko, oletushaara ja minne se tulee.",
      know: "Jos repo on jo työtilana, tästä pääset avaamaan sen.",
    },
    N08: {
      name: "Kloonaus",
      lead: "Valitse koko historia tai kevyt klooni, joka hakee vanhat tiedostoversiot vasta tarvittaessa.",
      know: "Kevyt klooni on nopeampi ja pienempi, mutta osa historian katselusta vaatii yhteyden.",
    },
    N09: {
      name: "Kloonaa työtilaksi",
      lead: "Aloittaa kloonauksen. Valmis repo näkyy työtilana.",
      know: "Kloonaus jatkuu palvelimella, vaikka poistut sivulta.",
    },
    N10: {
      name: "Kloonaukset",
      lead: "Käynnissä, jonossa ja äskettäin päättyneet kloonaukset.",
      know: "Sivupalkin rivi näkyy kloonauksen ajan ja vie tälle sivulle.",
    },
    N11: {
      name: "Keskeytä tai poista",
      lead: "Keskeyttää kloonauksen, poistaa sen jonosta tai poistaa keskeneräisen hakemiston.",
      know: "Habitat poistaa keskeneräisen hakemiston, kun se onnistuu turvallisesti; ilmoitus kertoo, jäikö jotain levylle.",
    },
    N12: {
      name: "Nimi",
      lead: "Uuden työtilan kansion nimi: pienet kirjaimet, numerot sekä . _ -.",
    },
    N14: {
      name: "Keskeytä",
      lead: "Kysyy ensin, keskeytetäänkö kloonaus, ja kertoo, mitä siitä poistetaan.",
    },
    N15: {
      name: "Yritä uudelleen",
      lead: "Aloittaa kloonauksen uudelleen, kun se epäonnistui tai ei alkanut.",
      know: "Keskeytyneessä kloonauksessa sama painike on Aloita alusta.",
    },
    N13: {
      name: "Luo työtila",
      lead: "Luo tyhjän kansion, alustaa sen Git-repoksi ja lisää sen työtiloihin.",
      grey: "Harmaa, kun nimi puuttuu tai työtiloja ei voi juuri nyt luoda.",
    },
  },
  states: {
    notStarted: {
      name: "Ei vielä alkanut",
      lead: "Keskustelu alkaa, kun lähetät ensimmäisen viestin.",
      know: "Ennen sitä mitään ei tallennu: jos suljet sivun, tyhjää keskustelua ei jää listoille.",
      can: {
        V01: "Kirjoita, mitä haluat agentin tekevän",
        A02: "Tai valitse tavoite, niin pyyntö kirjoitetaan valmiiksi",
        A05: "Vaihda malli tälle keskustelulle",
      },
    },
    working: {
      name: "Työskentelee",
      lead: "Agentti tekee pyytämääsi: se ajaa komentoja ja lukee tiedostoja tässä työtilassa.",
      know: "Työ jatkuu palvelimella, vaikka suljet selaimen; sivupalkin pallo kertoo, kun se on valmis.",
      can: {
        V01: "Kirjoita jo seuraava viesti: se menee ohjauksena tai työn jälkeen",
        K18: "Katso, mitä agentti tekee juuri nyt",
        V07: "Pysäytä, jos työ on menossa väärään suuntaan",
      },
    },
    yourTurn: {
      name: "Odottaa sinua",
      lead: "Agentti on vastannut, ja vuoro on sinun.",
      know: "Keskustelu odottaa niin kauan kuin haluat. Jos et palaa siihen, se siirtyy sivupalkissa Hiljaisiin.",
      can: {
        K04: "Avaa agentin työ, niin näet, mitä se teki",
        V01: "Vastaa tai pyydä seuraava asia",
        Y04: "Katso, mitä työtilassa muuttui",
      },
    },
    stopped: {
      name: "Pysäytit vuoron",
      lead: "Agentti lopetti kesken eikä kirjoittanut vastausta.",
      know: "Se, minkä agentti ehti tehdä, jäi työtilaan. Agentti muistaa tähänastisen, joten voit jatkaa siitä.",
      can: { K04: "Katso, mihin agentti jäi", V01: "Kerro, miten jatketaan" },
    },
    failed: {
      name: "Vuoro epäonnistui",
      lead: "Agentti ei saanut vastausta valmiiksi, ja vuoro päättyi virheeseen.",
      know: "Viestisi on tallessa. Usein riittää, että lähetät sen hetken päästä uudelleen.",
      can: {
        V01: "Lähetä uudelleen tai kirjoita jatko",
        Y06: "Vaihda malli, jos sama virhe toistuu",
      },
    },
    background: {
      name: "Odottaa sinua, työ jatkuu taustalla",
      lead: "Agentti on vastannut, mutta sen käynnistämä worker tekee vielä omaa osaansa.",
      know: "Voit jatkaa keskustelua sillä aikaa; workerin valmistuminen näkyy viestikentän yllä.",
      can: {
        V11: "Katso, mitä worker tekee",
        V01: "Jatka keskustelua sillä aikaa",
      },
    },
  },
};

export const explainModeText = catalog(fi, {
  bar: {
    title: "Explain mode",
    hint: "Point at any part; a click works as always.",
    hintTouch: "Tap any part to see what it does.",
    now: "Now",
    showState: "Show the state",
    stop: "Stop",
  },
  card: {
    clickHint: (action: string) => `A click: ${action}.`,
    clickOpens: "A click opens it; the explain mode stays on.",
    tapAgain: "Tap again to do it.",
    open: "Open",
    close: "Close the card",
    waits:
      "In explain mode this waits, so nothing happens by accident. Stop the mode and the button works.",
    waited:
      "In explain mode this does nothing. Stop the mode (Esc) and the button works.",
    onlyHover:
      "Shows only while the pointer is on the row. A touch screen always shows it.",
    now: "Right now",
    can: "You can now",
  },
  strip: {
    title: "What is on the screen?",
    text: "Point at any part to see what it does.",
    textTouch: "Tap any part to see what it does.",
    go: "Explain these to me",
    end: "Stop explaining",
    close: "Close the strip",
  },
  entry: "Explain this view",
  toggle: "Explain",
  workerLegend: {
    caption: "Worker marks",
    working: "Working",
    idle: "Waiting for you",
    waiting_parent: "Waiting for the parent agent",
    unknown: "State unknown",
    merged: "Done",
    unfinished: "Unfinished, work kept",
    failed: "Failed, no work kept",
    unmerged: "Ended unfinished, no work kept",
    checking: "Agent handling the request",
    answer: "Waiting for your answer",
    reported: "A helper's new round report",
    waited: "Outer ring: agent waiting for the worker",
    gone: "Work cleaned up",
  },
  kinds: {
    panel: "Panel",
    once: "One-off action",
    info: "Information",
    menu: "Menu",
    nav: "Navigation",
    list: "List",
    input: "Writing",
    page: "Settings page",
  },
  cards: {
    J01: {
      name: "Shares",
      lead: "Opens view and file addresses grouped by conversation.",
      know: "The sidebar count shows how many addresses are public.",
      try: "Open Shares",
    },
    J02: {
      name: "Shares",
      lead: "Shows shares, their visibility and the selected item's content.",
      know: "Conversations follow latest activity. On a phone, open a share from the list first.",
    },
    J03: {
      name: "Conversation",
      lead: "Opens the conversation these shares came from.",
      know: "The date is the conversation's latest activity, not when it was shared.",
      try: "Open conversation",
    },
    J04: {
      name: "Share filter",
      lead: "Narrows the list to public, private or expired shares.",
      know: "Expired also includes addresses whose item has been removed.",
    },
    J05: {
      name: "Share",
      lead: "Opens the share's content, address and publication controls.",
      know: "The shared date records address creation. Publishing again does not change it.",
      try: "Open share",
    },
    J06: {
      name: "Share status",
      lead: "Shows who can open the address and until when.",
      know: "Only you requires your own sign-in. A removed item no longer opens.",
    },
    J07: {
      name: "Share address",
      lead: "Use the icon to copy the field's address to the clipboard.",
      know: "Give the address to anyone you want to show the public item to.",
      try: "Copy link",
    },
    J09: {
      name: "Make private",
      lead: "Ends publication while keeping the address.",
      know: "You can publish the same address again when the server allows sharing.",
    },
    J08: {
      name: "Delete address",
      lead: "Permanently deletes the address after confirmation.",
      know: "The old link stops working. The item's files stay, but its address cannot be restored.",
    },
    X01: {
      name: "Explain these to me",
      lead: "Opens the explain mode, which shows what any part of the screen does.",
      know: "The strip shows on your first empty start page. Later the mode is in the account menu and behind the conversation's ? button.",
    },
    X02: {
      name: "Explain mode",
      lead: "Tells you the screen is in explain mode: what you point at is explained, and a press works as always.",
      know: "Esc or Stop returns to the normal view. Archiving, deleting and sending wait until you stop.",
    },
    X03: {
      name: "Explain this view",
      lead: "Opens the explain mode in the view you are in.",
      know: "The same mode as the start page's strip; it is always in the account menu, and on a phone also in ⋯.",
    },
    X05: {
      name: "Explain",
      lead: "Opens the explain mode at the state card.",
      know: "A second press ends the mode. The state in the bar at the top brings the state card back.",
    },
    Y01: {
      name: "Conversation name",
      lead: "Click the name to give the conversation a name of your own.",
      know: "After the first message a name appears by itself; yours stays until you change it.",
      try: "Rename",
      menu: "On a phone also ⋯ › Rename.",
    },
    Y02: {
      name: "Workspace",
      lead: "Takes you to the workspace page: introduction, Git state and other open conversations.",
      know: "A workspace is a folder on the server, usually a Git repository, and the agent works in it.",
      try: "Open the workspace",
      menu: "On a narrow screen the name is the top row of ⋯.",
    },
    Y03: {
      name: "Conversation state",
      lead: "Shows with one dot whether the agent is working, waiting for you or done.",
      know: "Tap the dot to see the state in words, with how long the turn has taken.",
      try: "Show the state",
    },
    Y04: {
      name: "Git state",
      lead: "Shows the workspace's branch: ↑ not yet pushed, ↓ incoming, and how many files changed.",
      know: "Opens the Git details with the commits and changed files. Looking changes nothing.",
      try: "Open Git details",
    },
    Y05: {
      name: "Context",
      lead: "Shows how much of the agent's memory this conversation already takes.",
      know: "As it fills, the agent condenses the oldest part into a summary and carries on. A press opens the breakdown.",
      try: "Open the breakdown",
    },
    Y06: {
      name: "Model",
      lead: "The model and thinking level the agent answers with in this conversation.",
      know: "A press tells what the model is good for. The model is chosen before the first message; the default for new ones is in Settings.",
      try: "Show the model details",
    },
    Y07: {
      name: "Editor",
      lead: "Opens the workspace's files for editing beside the conversation.",
      know: "The agent's changes arrive in the open file; if you both edit the same line, you choose which stays.",
      try: "Open the editor",
    },
    Y08: {
      name: "Terminal",
      lead: "Opens a command line in this workspace's folder, below the conversation.",
      know: "The terminal keeps running on the server when you close the browser. The number is how many are open.",
      try: "Open the terminal",
    },
    Y09: {
      name: "Make a recap now",
      lead: "Asks for a short summary of what was done in the conversation and what comes next.",
      know: "The recap appears as a card above the conversation. It does not enter the agent's memory.",
      try: "Make a recap",
      grey: "Grey while the conversation has no messages yet.",
      menu: "On a narrow screen ⋯ › Make a recap now.",
    },
    Y10: {
      name: "Create a new title",
      lead: "Gives the conversation a new name from what it is about now.",
      know: "Useful when the conversation has turned to another subject than it began with.",
      try: "Create a title",
      menu: "On a narrow screen ⋯ › Create a new title.",
    },
    Y11: {
      name: "Archive",
      lead: "Moves the conversation off the lists. Nothing is deleted.",
      know: "Bring an archived conversation back from the workspace page's archive.",
      grey: "Grey while the agent's turn is on: wait for it to end.",
      menu: "On a narrow screen ⋯ › Archive.",
    },
    Y12: {
      name: "Close",
      lead: "Closes this empty conversation.",
      know: "Only an empty conversation started in the browser can be closed; nothing of it is kept.",
    },
    Y13: {
      name: "Details",
      lead: "Shows the conversation's basics: workspace, model, thinking level and when it started.",
      know: "Copy the identifier if you want to continue the same conversation in a terminal.",
      try: "Open details",
      menu: "On a narrow screen ⋯ › Details.",
    },
    Y14: {
      name: "Conversation actions",
      lead: "Holds the conversation's actions that do not fit on the row right now.",
      know: "It lists only what the row does not show; in a wider window the same are on the row.",
      try: "Open the menu",
    },
    Y15: {
      name: "Guide",
      lead: "Shows or hides the chosen goal's guide beside the conversation.",
      know: "The guide lists the steps and what you get. It does not track where the agent is.",
      try: "Hide the guide",
    },
    Y16: {
      name: "Open navigation",
      lead: "Opens the sidebar with all your conversations and workspaces.",
      know: "When something waits for you, a mark shows on this button.",
      try: "Open the sidebar",
    },
    Y17: {
      name: "Conversation details",
      lead: "Gathers the workspace, Git state, context and model in one place on a phone.",
      know: "Each row opens what the matching header button opens on a wide screen.",
    },
    Y18: {
      name: "Notice",
      lead: "Tells you what just happened, such as what was archived or which icon is now in use.",
      know: "An error stays until you dismiss it or try again. × closes the notice; it does not undo anything.",
    },
    Y19: {
      name: "Restore",
      lead: "Takes back the change you just made: brings back what was archived or the previous icon.",
      know: "In the icon notice the button is called Undo.",
    },
    Y20: {
      name: "Archived",
      lead: "Says when the conversation was archived and shows its helpers.",
      know: "You can read the conversation but not write in it until you restore it.",
    },
    Y21: {
      name: "Restore",
      lead: "Brings the conversation back from the archive so you can continue it.",
      know: "The message field returns and its helpers come back without starting. You can archive the conversation again.",
    },
    Y22: {
      name: "Connection notice",
      lead: "Reports a lost connection, a required sign-in or a new version.",
      know: "A spinning mark means Habitat is trying by itself. The notice stays until the situation changes.",
    },
    Y23: {
      name: "Try connecting again",
      lead: "Checks the connection and reads the current state. Does not send your messages again.",
      try: "Check connection",
    },
    Y24: {
      name: "Load new version",
      lead: "Reloads the page so you can use the version on the server.",
      know: "Your unfinished message draft stays in this tab.",
    },
    Y25: {
      name: "Terminal notice",
      lead: "Reports a terminal event or an action that did not succeed. An uncertain result does not mean nothing happened.",
      know: "The notice does not expire on a timer. × dismisses it without changing the terminal's state.",
    },
    S01: {
      name: "Server name",
      lead: "This Habitat's name; a click takes you home.",
      know: "The administrator names the server, and everyone sees the name.",
    },
    S02: {
      name: "Connection",
      lead: "Shows whether the browser is connected to the server right now.",
      know: "If the connection drops, what you see may be old, and Habitat says so here.",
    },
    S03: {
      name: "Home",
      lead: "Shows all your workspaces and their open conversations on one page.",
      try: "Open Home",
    },
    S04: {
      name: "Close navigation",
      lead: "Narrows the sidebar to a row of icons so the conversation gets more room.",
      know: "The same spot brings the sidebar back; on a phone it closes the drawer.",
    },
    S05: {
      name: "Your turn",
      lead: "Conversations where the agent waits for you: an answer, a decision or something to read.",
      know: "The conversation stays here until you reply or press Not now on its row. Reading it does not move it away.",
    },
    S06: {
      name: "Running",
      lead: "Conversations where an agent or a worker is working right now, by workspace.",
      know: "When the work is done, the conversation moves to Your turn.",
    },
    S07: {
      name: "Quiet",
      lead: "Conversations where nothing waits for you and nothing runs.",
      know: "Raise on a row moves the conversation to Your turn. The heading folds the list away; the open conversation stays in view.",
      try: "Fold the list",
    },
    S08: {
      name: "Filter and sort Quiet",
      lead: "Shows only one workspace in Quiet and chooses the order.",
      know: "The letters stand for workspaces. Your choice follows you to every device.",
      try: "Open the filter",
    },
    S09: {
      name: "Conversation row",
      lead: "Opens the conversation. The row shows state, name, workspace and when something last happened.",
      know: "The open conversation's row has a frame around it.",
    },
    S10: {
      name: "State ball",
      lead: "The conversation's state in one mark: pulsing is working, a full ball waits for you or is done.",
      know: "A diamond means the turn failed, and an empty ring that the state is not known right now.",
    },
    S11: {
      name: "Worker mark",
      lead: "The conversation has handed work to a worker. The ball at the branch's end shows its state.",
      know: "With several workers, yellow shows if any of them waits for you. A ring around the ball: the agent waits for the worker. Open them from the conversation's Workers badge.",
    },
    S12: {
      name: "Rename",
      lead: "Gives the conversation a name of your own straight from the list.",
      know: "The button shows while the pointer is over the row.",
    },
    S13: {
      name: "Archive",
      lead: "Moves the conversation off the lists. Nothing is deleted.",
      know: "Bring an archived conversation back from the workspace page's archive.",
    },
    S14: {
      name: "Workspaces",
      lead: "All your workspaces; the number is how many there are.",
      know: "Archived workspaces are a group of their own at the end of the list.",
    },
    S15: {
      name: "New workspace",
      lead: "Adds a workspace: clone a repository from a code host or create an empty folder.",
      know: "It goes in your home directory's src folder, and an agent can start in it at once.",
    },
    S16: {
      name: "Filter workspaces",
      lead: "Narrows the sidebar's workspaces and conversations to the name you type.",
      know: "Clear the field to see everything again.",
    },
    S17: {
      name: "Refresh",
      lead: "Reads the workspaces and conversations from the server again.",
      know: "The list usually updates by itself; use this when something looks out of date.",
      try: "Refresh",
    },
    S18: {
      name: "Workspace row",
      lead: "Opens the workspace page: introduction, Git state and open conversations.",
      know: "A mark at the end of the row means work is running in that workspace.",
      try: "Open the workspace",
    },
    S19: {
      name: "New conversation in workspace",
      lead: "Starts a new conversation right in this workspace.",
      know: "It opens on the workspace's start page, with ready-made goals.",
      try: "Start a conversation",
    },
    S20: {
      name: "All workspaces",
      lead: "Opens the narrowed sidebar back to full width.",
      know: "Narrowed, the sidebar shows only icons and state dots.",
    },
    S21: {
      name: "Account menu",
      lead: "Settings, theme, how much of the agent's work shows, and sign out.",
      know: "Explain this view is here too, wherever you are.",
      try: "Open the account menu",
    },
    S22: {
      name: "Settings",
      lead: "Opens your settings: account, models, connected services and appearance.",
      try: "Open Settings",
    },
    S23: {
      name: "Server administration",
      lead: "The server's settings, which apply to everyone who uses it.",
      know: "Only administrators see this.",
    },
    S24: {
      name: "Theme",
      lead: "Chooses the light or dark look, or follows the device.",
      know: "The choice applies to this browser only.",
    },
    S25: {
      name: "Agent's work",
      lead: "Chooses whether the agent's thinking and tools show open or hidden in conversations.",
      know: "Hidden, the work is one row that opens with a press.",
    },
    S26: {
      name: "Sign out…",
      lead: "Signs you out of this browser. Agents keep working on the server.",
      know: "It asks first; your other devices stay signed in.",
    },
    S27: {
      name: "Order",
      lead: "Sorts Quiet by newest, by workspace or by name.",
    },
    S28: {
      name: "Workspace tile",
      lead: "Shows only this workspace's conversations in Quiet; All brings back the whole list.",
      know: "The number is how many quiet conversations the workspace has.",
    },
    S29: {
      name: "Done",
      lead: "Closes the filter; your choice is already saved.",
    },
    S30: {
      name: "Workspace icon",
      lead: "Opens a card with the workspace's full name and where its icon comes from.",
      know: "From the card you can go to the workspace's page or start a new conversation there.",
    },
    S31: {
      name: "Raise to Your turn",
      lead: "Moves a quiet conversation to Your turn as a reminder to yourself.",
      know: "The agent's state does not change. Lower moves it back to Quiet.",
    },
    S32: {
      name: "Lower to Quiet",
      lead: "Moves a conversation you raised back to Quiet.",
    },
    S33: {
      name: "Not now",
      lead: "Moves a conversation waiting for your reply to Quiet when you cannot get to it now.",
      know: "The conversation stays as it is. Raise brings it back to Your turn.",
    },
    E01: {
      name: "Workspaces",
      lead: "Home gathers all your workspaces and their open work on one page.",
      know: "The summary at the top says how many conversations wait for you and how many run.",
    },
    E02: {
      name: "Workspace heading",
      lead: "The workspace's name and branch; its open conversations follow as cards.",
      know: "The name opens the workspace page; + starts a new conversation.",
    },
    E03: {
      name: "Conversation card",
      lead: "The conversation's state and latest recap: what was done and what comes next.",
      know: "The recap lets you see where things stand without opening the conversation.",
    },
    E04: {
      name: "Read only",
      lead: "The conversation is being driven elsewhere, for example from a terminal, so here you can read it.",
      know: "When that ends, you can write to it from the browser again.",
    },
    E05: { name: "Recap age", lead: "Shows how old the card's recap is." },
    E06: {
      name: "Open",
      lead: "Takes you into the conversation, to carry on where it left off.",
      try: "Open the conversation",
    },
    E07: {
      name: "No open work",
      lead: "Workspaces with no open conversations right now.",
      know: "Start a new conversation with the row's +.",
    },
    E08: {
      name: "Close recap",
      lead: "Hides the recap from view; the conversation is not affected.",
    },
    T01: {
      name: "Workspace name",
      lead: "The workspace's name; the folder's name unless it has been given a display name.",
    },
    T46: {
      name: "Workspace folder",
      lead: "Shows where the workspace's folder is on the server.",
      know: "Use Copy path to copy the full path to the clipboard.",
    },
    T02: {
      name: "Copy path",
      lead: "Copies where the workspace's folder is, to paste into a terminal, for example.",
      try: "Copy",
    },
    T03: {
      name: "Open on GitHub",
      lead: "Opens the workspace's repository on GitHub in a new tab.",
      grey: "Grey when the workspace was not cloned from GitHub.",
    },
    T04: {
      name: "Change display name…",
      lead: "Gives the workspace a name that shows only in Habitat.",
      know: "The folder keeps its name, so the terminal and the agent work as before.",
    },
    T05: {
      name: "Archive workspace",
      lead: "Moves the workspace to the sidebar's Archived group. Files and conversations stay.",
      know: "Bring it back from there with Restore.",
    },
    T06: {
      name: "Delete workspace…",
      lead: "Moves the workspace's folder to the trash.",
      know: "It asks first. You can restore it from the trash: Settings › Storage.",
    },
    T07: {
      name: "New worktree agent",
      lead: "Starts an agent in its own worktree: a separate copy and branch that leave your current work alone.",
      know: "Good for trying something out, or doing two things at once in the same repository.",
    },
    T08: {
      name: "Start a new conversation",
      lead: "Starts a new conversation with an agent in this workspace.",
      try: "Start a conversation",
    },
    T09: {
      name: "Start page",
      lead: "The workspace's introduction and suggestions for what you can do here.",
      know: "The agent writes and updates it on request; the same page opens every new conversation.",
    },
    T10: {
      name: "Show the whole introduction",
      lead: "Opens the whole introduction; Show less shortens it again.",
      try: "Show it all",
    },
    T11: {
      name: "Goal",
      lead: "Starts a new conversation with the request already written.",
      know: "Before sending you can add your own details to the request.",
      try: "Start with this goal",
    },
    T12: {
      name: "Git",
      lead: "The workspace's branch and how many changes; a press opens the Git details.",
      know: "↑ is not yet pushed, ↓ is incoming from the remote.",
    },
    T13: {
      name: "Open conversations",
      lead: "This workspace's conversations that are not archived, as cards.",
    },
    T14: {
      name: "Workspace archive",
      lead: "This workspace's archived conversations, newest archived first and grouped by day.",
      know: "Nothing is deleted: open a conversation to read it, or restore it to the open ones.",
    },
    T15: {
      name: "Worktrees",
      lead: "The agents' and your own Git working copies (worktrees) and the disk they take.",
      know: "On a workspace page the ones that need you come first. The rest take care of themselves.",
    },
    T16: {
      name: "Working copy",
      lead: "Says whose working copy it is, which conversation it came from and what happens to it next.",
      know: "A helper's working copy releases itself once its rounds are merged and it has been idle for a day.",
    },
    T17: {
      name: "Git details",
      lead: "Shows the working copy's directory, branch, size and run ID.",
      know: "With them you find the same working copy in a terminal. Looking changes nothing.",
      try: "Show Git details",
    },
    T18: {
      name: "Takes care of itself",
      lead: "Working copies an agent is still using, or that release themselves.",
      know: "You do not need to do anything with them.",
      try: "Show them",
    },
    T19: {
      name: "Restore conversation",
      lead: "Brings the conversation back from the archive and opens it, so the agent can decide about the worker.",
      know: "Habitat does not merge or discard the worker itself; the conversation's agent does. You can archive the conversation again.",
    },
    T20: {
      name: "Conversation",
      lead: "Opens the conversation where the agent looks after this working copy.",
      try: "Open the conversation",
    },
    T21: {
      name: "Delete…",
      lead: "Deletes a working copy nobody uses any more. First you see what would be lost.",
      know: "Unmerged work stays on the branch. Save and delete commits the changes to the branch first.",
    },
    T22: {
      name: "Clean up entry",
      lead: "Removes a working copy whose directory is already gone from Git's list.",
      know: "No files are lost, because they no longer exist.",
    },
    T23: {
      name: "Clean up all merged",
      lead: "Deletes at once the working copies whose work is merged and that nobody keeps.",
      know: "First you see the list. No committed work is lost. On a workspace page the button shows only when there is something to clean up.",
    },
    T24: {
      name: "Change icon",
      lead: "Opens the choice of the workspace's icon: automatic, your own letters or an emoji.",
      know: "The icon shows in the sidebar and on the home page.",
    },
    T25: {
      name: "Icon choice",
      lead: "Puts this icon to use for the workspace right away.",
      know: "The choice is saved in the workspace, and in a Git repository Habitat commits it; the notice says how it went. Undo restores the previous one.",
    },
    T26: {
      name: "Letters",
      lead: "Type 1–3 letters; Enter makes them the icon right away.",
    },
    T27: {
      name: "Suggestions from a model…",
      lead: "Asks a model to suggest icons from the workspace's name and introduction.",
      know: "The suggestions appear on the workspace page; nothing changes until you choose one.",
    },
    T28: {
      name: "Icon suggestion",
      lead: "Icons a model suggests for this workspace, each with its reason.",
      know: "A wish or a quick wish asks for new suggestions; the arrows go through earlier rounds. If no model can be reached, choices without a model show instead.",
    },
    T29: {
      name: "Suggestion",
      lead: "Makes this suggestion the workspace's icon.",
      know: "The choice is saved in the workspace, and in a Git repository Habitat commits it. Undo in the notice restores the previous one.",
    },
    T30: {
      name: "Wish for the model",
      lead: "Say what kind of icon you would like, such as a fox, blue or letters.",
      know: "You can attach an image or text as an example.",
    },
    T31: {
      name: "Send",
      lead: "Sends your wish to the model, which answers with new icon suggestions.",
      grey: "Grey while the field is empty or the model is still thinking.",
    },
    T32: {
      name: "Quick wish",
      lead: "Asks for new suggestions with a ready-made wish, such as more playful.",
    },
    T33: {
      name: "Not now",
      lead: "Hides the suggestions. The icon stays as it is.",
      know: "Bring the suggestions back from the icon choice: Suggestions from a model….",
    },
    T34: {
      name: "Done",
      lead: "The workspace's conversations whose agent has closed and that have nothing unread.",
      know: "They are not archived. A row opens the conversation.",
      try: "Open the list",
    },
    T35: {
      name: "Change display name",
      lead: "Type the name Habitat shows for the workspace; Save puts it to use.",
      know: "The folder keeps its name.",
    },
    T36: {
      name: "Delete workspace",
      lead: "Checks before deleting whether anything is using the workspace and what exists only on this machine.",
      know: "Conversations stay in the agent's history. Check again reads the situation once you have removed what is in the way.",
    },
    T37: {
      name: "Move to Trash",
      lead: "Moves the workspace's folder to the trash and takes it off the lists.",
      know: "You can restore it from the trash: Settings › Storage.",
    },
    T39: {
      name: "Icon source",
      lead: "Says where the workspace's icon comes from: letters from the name, the repository's logo or your own choice.",
    },
    T40: {
      name: "Your own emoji",
      lead: "Type a single emoji; Use makes it the icon.",
    },
    T41: {
      name: "Try again",
      lead: "Asks the model for suggestions again after the last request failed.",
    },
    T42: {
      name: "Find by title",
      lead: "Narrows the archived conversations by their titles.",
      know: "It looks at titles only, not at what was said in the conversations.",
    },
    T43: {
      name: "Archived conversation",
      lead: "Opens the conversation to read, as it was left.",
      know: "You cannot write in an archived conversation; restore it to continue. The row's date says when it was archived.",
      try: "Open conversation",
    },
    T44: {
      name: "Restore",
      lead: "Brings the conversation back from the archive to the open conversations.",
      know: "Its helpers come back with it without starting. You can archive the conversation again.",
    },
    T45: {
      name: "Traces",
      lead: "Says what the conversation left behind: a helper by name, or its workers' work and its state.",
      know: "Darker text is work that still waits for someone. Open the conversation to see the exact state and branch.",
    },
    T38: {
      name: "Delete permanently",
      lead: "Deletes the workspace's folder for good, skipping the trash.",
      know: "The folder cannot be restored. Work that is on the remote stays there and can be cloned again.",
    },
    A01: {
      name: "Workspace introduction",
      lead: "Says what this workspace is before you write your first message.",
      know: "It goes away once the conversation starts.",
    },
    A02: {
      name: "Goal",
      lead: "Writes the request into the message field and opens its guide alongside.",
      know: "A ready goal can start work immediately. If the request needs input or the field has your own text, it waits for Send. In Explain mode the request is only prepared.",
      try: "Choose the goal",
    },
    A03: {
      name: "Chosen goal",
      lead: "The goal whose request goes with your message; a press shows the request.",
    },
    A04: {
      name: "Remove goal",
      lead: "Takes the goal out of the message; your own text stays in the field.",
    },
    A05: {
      name: "New conversation's model",
      lead: "Chooses the model and thinking level this conversation starts with.",
      know: "It defaults to the model chosen in Settings; a change applies to this conversation only.",
      try: "Open the models",
    },
    K01: {
      name: "Your message",
      lead: "A message you sent to the agent.",
      know: "A long message shows shortened; Show the whole message opens it.",
    },
    K02: {
      name: "Copy message",
      lead: "Copies the message's text to the clipboard, formatting included.",
      try: "Copy",
    },
    K03: {
      name: "Interim reply",
      lead: "The agent says what it is doing while it works.",
      know: "It is not the finished answer yet; the work continues below it.",
    },
    K04: {
      name: "Agent's work",
      lead: "The agent's steps as one row: how many tools, whether any failed and how long it took.",
      know: "A press opens each step as a row of its own.",
      try: "Open the work",
    },
    K05: {
      name: "Command",
      lead: "The agent ran a command in the workspace; the row shows the command and whether it worked.",
      know: "Open the row to see the whole output, as if you had run it yourself.",
      try: "Open the output",
    },
    K06: {
      name: "File read",
      lead: "The agent read a file; the row shows its name and how many lines it read.",
      know: "Reading does not change the file.",
      try: "Show the content",
    },
    K07: {
      name: "File written",
      lead: "The agent wrote a whole file; new means it did not exist before.",
      know: "Open the row to see what was written.",
      try: "Show the content",
    },
    K08: {
      name: "File edited",
      lead: "The agent changed a file; +1 −1 counts the lines added and removed.",
      know: "Open the row to see the change in green and red.",
      try: "Show the change",
    },
    K09: {
      name: "Background process",
      lead: "The agent started a program that stays running, such as a development server.",
      know: "See running processes in the Processes badge above the message field.",
    },
    K10: {
      name: "Failed step",
      lead: "This step did not work, and the row is marked red.",
      know: "Open the row to see the error; the agent usually says in its reply what it did next.",
      try: "Show the error",
    },
    K11: {
      name: "Reply done",
      lead: "The agent's answer once its turn has ended.",
      know: "It is your turn now: reply, carry on, or leave the conversation for later.",
    },
    K12: {
      name: "File link",
      lead: "Opens the mentioned file in the editor, at the mentioned lines.",
      know: "The line numbers say where the editor opens.",
      try: "Open in the editor",
    },
    K13: {
      name: "Diagram",
      lead: "The agent drew a diagram; Diagram source shows the text it was drawn from.",
    },
    K14: {
      name: "Diagram source",
      lead: "Shows the diagram as text, so you can copy or change it.",
    },
    K20: {
      name: "Markdown preview",
      lead: "Switches between the block's source and formatted preview. Copy always takes the source.",
    },
    K21: {
      name: "Preview length",
      lead: "Expands a long draft or limits its height again.",
    },
    K22: {
      name: "Compaction",
      lead: "Shows that the agent is compacting or compacted the oldest messages into a summary, or why it did not.",
      know: "The old messages stay readable; the agent now sees only their summary. The summary opens under the row.",
    },
    K15: { name: "Copy code", lead: "Copies the whole box to the clipboard." },
    K16: {
      name: "Wrap long lines",
      lead: "Wraps long lines into view so you need not scroll sideways.",
    },
    K17: {
      name: "Agent working",
      lead: "Says what the agent is doing right now and how long the turn has taken.",
      know: "You can write meanwhile: the message goes as steering or after the work.",
    },
    K18: {
      name: "Show work",
      lead: "Opens the agent's thinking and tools during the turn.",
      know: "Hide work folds them back into one row.",
    },
    K19: {
      name: "Check the conversation's state",
      lead: "Asks the server for the conversation's state again when it seems stuck.",
      know: "The check itself sends nothing. If it shows that the agent never got your message, Habitat sends it once more.",
    },
    K26: {
      name: "Conversation size",
      lead: "Tells you when the conversation has grown large enough to start slowing down.",
      know: "Size comes mostly from pictures. Past 512 MB the conversation opens from the newest messages. Nothing is lost, and you can still continue it.",
    },
    K27: {
      name: "New conversation",
      lead: "Takes you to the workspace, where you start a fresh conversation.",
      know: "This conversation stays as it is, readable and ready to archive.",
      try: "Go to the workspace",
    },
    K28: {
      name: "Got it",
      lead: "Hides the size warning for this conversation.",
      know: "The warning returns when you reload the page, and past 512 MB it always shows.",
      try: "Hide the warning",
    },
    K29: {
      name: "Open pictures",
      lead: "Shows the row's pictures; each then loads from its own button.",
      know: "Many large pictures are gathered on one row so the rest of the history stays light to read.",
      try: "Open pictures",
    },
    K30: {
      name: "Changes",
      lead: "Shows the files this turn changed and their line counts, and opens the list here.",
      know: "It comes from the agent's tool calls. A file a command changed shows only when the command names it.",
      try: "Open the changes",
    },
    K31: {
      name: "Timeline",
      lead: "Shows the turn's changes on its clock instead of the list.",
      know: "A circle is the agent's edit and a square a command. A mark opens that change.",
      try: "Show the timeline",
    },
    K32: {
      name: "Open in editor",
      lead: "Opens the file in the editor beside the conversation at its first changed line.",
      know: "The line is known when the turn read the file before changing it. Otherwise the file opens at the top.",
      try: "Open in editor",
    },
    V33: {
      name: "More notices",
      lead: "Shows the other notices for this conversation and draft.",
      know: "Normally two notices show, blockers first. Press again to collapse the stack.",
      try: "Show or hide other notices",
    },
    V34: {
      name: "Try again",
      lead: "Tries saving attachments again after an interrupted upload.",
      know: "Saved attachments appear in the draft. This does not send the message.",
    },
    V36: {
      name: "Attachment progress",
      lead: "The ring and percentage show how much of the file has left your device. Saving means it still awaits confirmation.",
      know: "Send waits for every attachment. The message leaves only when you press Send yourself.",
    },
    V37: {
      name: "Cancel attaching a file",
      lead: "× stops uploading this file and removes it from the draft.",
      know: "Saved attachments stay in the message, and queued files continue.",
    },
    V35: {
      name: "Conversation notice",
      lead: "Shows what blocks work, is uncertain, is underway or has recovered.",
      know: "Conditions stay until they change. Refusals stay until the next attempt or dismissal.",
    },
    V32: {
      name: "Dismiss attachment notice",
      lead: "Hides the notice without changing your message or its attachments.",
      know: "If the attachments do not fit in one message, sending shows the warning again.",
    },
    V01: {
      name: "Message to the agent",
      lead: "Write what you want the agent to do; Enter sends, Shift+Enter starts a new line.",
      know: "The draft stays in this tab even if you switch conversations.",
    },
    V02: {
      name: "Attach",
      lead: "Attaches files or pictures from your own device to the message.",
      know: "You can also drag files into the field.",
    },
    V03: {
      name: "Commands",
      lead: "Lists the agent's commands and skills you can put at the start of a message.",
      know: "Typing / at the start of the field opens the same list.",
      try: "Open commands",
    },
    V04: {
      name: "File",
      lead: "Adds a reference to a workspace file, so the agent knows what you mean.",
      know: "Type @ in the field or press Ctrl+P to open the same folder tree inside the field. Tab marks files; Enter adds the marked files.",
      try: "Open files",
    },
    V05: {
      name: "Dictate",
      lead: "Writes what you say into the field; tap to start, or hold while you speak.",
      know: "The text stays in the field for you to check, and Esc cancels. Without a dictation key, a press says where to get one.",
    },
    V06: {
      name: "Send",
      lead: "Sends the message to the agent.",
      know: "While the agent works, the same button sends it as steering or for after the work.",
      grey: "Grey while the field is empty.",
    },
    V07: {
      name: "Stop the agent",
      lead: "Stops the agent's work at once.",
      know: "What is done stays done: changes to files are not undone.",
    },
    V08: {
      name: "How the message goes",
      lead: "Chooses whether the agent gets your message during its work (Steer) or after it.",
      know: "Alt+Enter sends once the other way without changing the choice.",
    },
    V09: {
      name: "Background work",
      lead: "The badges above the field show workers and processes that carry on in the background.",
      know: "A badge is missing when nothing runs in the background.",
    },
    V10: {
      name: "Processes",
      lead: "Programs the agent started that stay running, such as a development server.",
      know: "A question mark means the state cannot be read right now, not that none run.",
    },
    V11: {
      name: "Workers",
      lead: "Workers the agent handed work to.",
      know: "The agent can wait for a worker to finish and carry on by itself afterwards.",
      try: "Open workers",
    },
    V12: {
      name: "Worker marks",
      lead: "The same mark shows a worker’s state in the chip, list and sidebar.",
      know: "The outer ring means the agent is waiting. No ring does not prove it is not waiting: the worker being waited for is not always known.",
    },
    V13: {
      name: "Views and files",
      lead: "Everything the agent has offered in this conversation: views and files, newest first.",
      know: "When the agent offers the same file or folder again, the new version joins its row; a report of the same name from elsewhere gets its own. A row opens the item beside the conversation, and the same row closes it.",
      try: "Open the list",
    },
    V14: {
      name: "Offered item",
      lead: "A view or file the agent offered. The card opens it beside the conversation, and another press closes it.",
      know: "The corner icons publish the item, open it in a new tab and download it. Anyone who receives a public item's link can open it without signing in; a folder is shared whole.",
    },
    V15: {
      name: "Helpers",
      lead: "The robot icon opens your helpers. Each has a state mark beside it.",
      know: "Helpers wait after each round. Messages, landing rounds and stopping go through the main agent.",
      try: "Open helpers",
    },
    V16: {
      name: "Helper",
      lead: "Opens the helper's conversation to read. The row shows its task, rounds and latest report.",
      know: "Write to helpers through the main agent. Opening a report marks it as seen, without landing the work.",
    },
    V17: {
      name: "Open item",
      lead: "Opens the view or file beside the conversation. Press again to close it.",
      know: "The list icon shows the kind of item; the time says when it was offered. Public items show their expiry.",
    },
    V18: {
      name: "Versions",
      lead: "Shows or hides earlier versions of the same view.",
      know: "The number counts all versions. The top row opens the latest one.",
    },
    V19: {
      name: "Show in the conversation",
      lead: "The speech bubble takes you to the message where the agent offered the item.",
    },
    V20: {
      name: "Public",
      lead: "The globe publishes the item by link or makes it private again.",
      know: "Anyone with a public link can open the item without signing in. Change its expiry from the date.",
      grey: "Publication details are being checked or a change is still in progress.",
    },
    V21: {
      name: "Expiry",
      lead: "Opens choices for how long the public link works.",
      know: "Opening the menu does not change the expiry.",
    },
    V22: {
      name: "Change expiry",
      lead: "Sets a new expiry for the public link.",
    },
    V23: {
      name: "Copy link",
      lead: "Copies the public address to your clipboard to share.",
      try: "Copy link",
    },
    V24: {
      name: "Open in a new tab",
      lead: "The diagonal arrow opens the item in its own browser tab.",
      know: "Opening it does not publish it.",
    },
    V25: {
      name: "Download",
      lead: "The downward arrow downloads the item to your device.",
      know: "The item on the server stays unchanged.",
      try: "Download item",
    },
    V26: {
      name: "Close list",
      lead: "Closes the views and files list without removing anything.",
      try: "Close list",
    },
    V27: {
      name: "Stop waiting",
      lead: "Stops the main agent's wait. The helper or worker keeps working.",
      know: "This wait will no longer wake the main agent when the work finishes.",
    },
    V28: {
      name: "The message was not sent",
      lead: "Tells you the attachments do not fit in one message, and how many and how large they are.",
      know: "One message holds 30 files and 100 MB in total. Remove attachments: once the rest fit, you can send the message.",
    },
    V29: {
      name: "Handle",
      lead: "Asks the agent to check the ended workers' worktrees and recommend what to do with them.",
      know: "The request goes to the agent as a message, and it answers in the conversation. Nothing is removed until you decide.",
    },
    V30: {
      name: "Ended",
      lead: "Opens or folds the rows that have ended.",
    },
    V31: {
      name: "Tell the agent",
      lead: "Asks the agent to check this worker's worktree and recommend what to do with it.",
      know: "The request goes to the agent as a message. Nothing is removed until you decide.",
    },
    B01: {
      name: "Browser",
      lead: "Opens your server browser's windows; starts the browser if it is stopped.",
      know: "The mark and text show whether the agent or you are using it, or whether the agent needs your help.",
    },
    B02: {
      name: "Browser windows",
      lead: "Shows window previews and any request for help from the agent.",
      know: "Opening a preview does not take control. Take control separately when you want to act yourself.",
    },
    B03: {
      name: "View large",
      lead: "Opens a larger view of the browser window, without taking control.",
    },
    B04: {
      name: "Take control",
      lead: "Hands browser control to you. The agent waits meanwhile.",
      know: "Give control back to the agent when you are done.",
      grey: "Control is still changing or the browser is unavailable.",
    },
    B05: {
      name: "Give back to the agent",
      lead: "Hands browser control back to the agent.",
    },
    B06: {
      name: "Close browser",
      lead: "Closes the browser on the server and its windows.",
      know: "You can start it again from the Browser button.",
    },
    B07: {
      name: "Your browser",
      lead: "Opens the view of your browser on the server.",
      know: "The row shows the browser's state and window count.",
    },
    B08: {
      name: "Close view",
      lead: "Closes the large browser view. The browser keeps running on the server.",
      try: "Close view",
    },
    H01: {
      name: "Conversation's helper",
      lead: "Shows the helper's round state and whether its work has been landed.",
      know: "A branch marks unfinished or unconfirmed work; a check marks landed work. Archiving neither stops the helper nor lands its work.",
    },
    H02: {
      name: "Show branch",
      lead: "Opens the helper's branch details for inspection.",
      know: "Looking neither lands nor removes the work.",
    },
    L01: {
      name: "Search commands and skills",
      lead: "Narrows the list as you type; Enter puts the top one at the start of the message.",
    },
    L02: {
      name: "Skill",
      lead: "A way of working the agent knows, such as committing or fixing a test.",
      know: "A personal skill is yours; a project skill comes with this repository.",
    },
    L03: {
      name: "Command",
      lead: "A ready request template or one of the agent's own commands, run at the start of a message.",
      know: "A command that needs the terminal's menus cannot run from the browser; the list says so.",
    },
    L04: {
      name: "File row",
      lead: "A file in the workspace; choosing it adds its name to the message.",
      know: "Changed files come first, since they are the ones most often talked about.",
    },
    L05: {
      name: "Change mark",
      lead: "Shows how the file has changed: U new, M modified, D deleted.",
    },
    L06: {
      name: "Provider",
      lead: "Chooses whose subscription or key the models come from.",
      know: "A grey option is not available; the reason and the fix show below.",
    },
    L07: {
      name: "Model",
      lead: "A model the agent answers with; the most capable first, and its description tells what each is good for.",
    },
    L08: {
      name: "Older models",
      lead: "Also shows older models that are still available.",
    },
    L09: {
      name: "Thinking level",
      lead: "How much the model thinks before answering: higher is more thorough but slower.",
      know: "Only levels the model supports can be chosen.",
    },
    L10: {
      name: "Default model settings",
      lead: "Takes you to Settings, where you choose the default model for new conversations.",
    },
    L11: {
      name: "Choose",
      lead: "Uses the chosen model and level for this conversation.",
    },
    L12: {
      name: "AI settings",
      lead: "Opens the settings where you sign in to a model service or add a key.",
    },
    P01: {
      name: "Git state",
      lead: "The workspace's branch compared with the remote and the base branch, and the changed files.",
      know: "The panel only shows; changes to the branch go through the agent or the terminal.",
    },
    P02: {
      name: "Upstream branch",
      lead: "The remote's branch this branch pushes to and pulls changes from.",
      know: "↑ is not yet pushed, ↓ is incoming.",
    },
    P03: {
      name: "Not pushed",
      lead: "Commits that are on this machine but not yet in the remote.",
      know: "Ask the agent to push when you want them in the remote.",
    },
    P04: {
      name: "Incoming",
      lead: "Commits that are in the remote but not yet in this branch.",
      know: "The number is from the last fetch; Update state fetches again.",
    },
    P05: {
      name: "Base branch",
      lead: "The branch this one was made from, usually main.",
      know: "Ahead and behind say how far the two have drifted apart.",
    },
    P06: {
      name: "Ahead of the base",
      lead: "This branch's commits that the base branch does not have yet.",
      know: "They are the work that goes in when the branch is merged.",
    },
    P07: {
      name: "Behind the base",
      lead: "Commits that reached the base branch and are not in this branch yet.",
      know: "Ask the agent to bring them in if you need them before merging.",
    },
    P08: {
      name: "Changes",
      lead: "Files changed since the latest commit, and how many lines changed.",
      know: "The letter says how: M modified, U new, D deleted.",
    },
    P09: {
      name: "Update state",
      lead: "Fetches the remote's latest and reads the branch's state again.",
      know: "It changes neither the branch nor the files; ask the agent to bring changes in.",
    },
    P10: {
      name: "Details",
      lead: "The conversation's workspace, model, thinking level, control and start time.",
      know: "The copy buttons give each value exactly, for pasting into a terminal for example.",
    },
    P11: {
      name: "Conversation's model",
      lead: "Tells the conversation's model and thinking level and what they are good for.",
      know: "Nothing can be changed here. In the browser the model is chosen before the first message, at the left edge of the message box.",
    },
    P12: {
      name: "Guide",
      lead: "The chosen goal's steps and what you get, beside the conversation.",
      know: "Instructions, not progress: Habitat does not know which step the agent is at.",
    },
    P13: {
      name: "Width",
      lead: "Drag the edge to change how wide the conversation and the panel are.",
    },
    P14: {
      name: "Background tabs",
      lead: "Switches the panel between workers and processes.",
    },
    P15: {
      name: "Worker row",
      lead: "One worker: its task, how long it has run, and whether the agent waits for it. A press opens its view.",
      try: "Open the worker",
    },
    P16: {
      name: "Close",
      lead: "Closes the panel, menu or notice. Nothing changes.",
    },
    P17: {
      name: "Back to the conversation",
      lead: "Returns to the conversation you opened the context breakdown from.",
      try: "Go back",
    },
    P18: {
      name: "Context breakdown",
      lead: "Shows what the agent's memory in this conversation is made of and when it is compacted next.",
      know: "The Turns table shows how the context grew turn by turn. Looking changes nothing in the conversation.",
    },
    R01: {
      name: "Terminal",
      lead: "An ordinary command line in the workspace's folder, as your own user.",
      know: "Tab and Esc belong to the terminal; Ctrl+Alt+T moves focus to the tabs and back.",
    },
    R02: {
      name: "Terminal tab",
      lead: "One open terminal; the name says what is running in it.",
      know: "A dot means it waits at the prompt; otherwise a program is running.",
    },
    R03: {
      name: "End terminal",
      lead: "Closes the terminal and ends whatever runs in it.",
    },
    R04: {
      name: "New terminal",
      lead: "Opens another terminal in the same workspace, in a tab of its own.",
    },
    R05: {
      name: "Maximize",
      lead: "Gives the terminal the whole view; Restore size brings the conversation back.",
    },
    R06: {
      name: "Hide panel",
      lead: "Hides the terminal panel; the terminals keep running behind the Terminal button.",
      know: "On a phone this is the Back to conversation arrow.",
    },
    R07: {
      name: "Panel height",
      lead: "Drag the edge to move the line between the terminal and the conversation.",
    },
    R08: {
      name: "Terminal keys",
      lead: "A reminder: select text by dragging with Shift held, Ctrl+C copies and Ctrl+V pastes.",
    },
    R09: {
      name: "Key row",
      lead: "The keys a phone keyboard lacks: Esc, Tab, Ctrl, Alt and the arrows.",
      know: "Ctrl and Alt stay down for the next key.",
    },
    R10: {
      name: "Selection",
      lead: "Copies the text selected in the terminal or puts it in the conversation's message field.",
      know: "Copied means the text is already on the clipboard. Ctrl+Shift+C copies the same.",
    },
    R11: {
      name: "Address from the terminal",
      lead: "A program in the terminal asked to open a web address; the card shows where it leads.",
      know: "The address opens in a new tab only when you press. Dismiss closes the card.",
    },
    D01: {
      name: "Editor",
      lead: "A workspace file open for editing beside the conversation; the title is the file's name.",
      know: "The agent's changes arrive in the open file, and in a conflict you choose what stays.",
    },
    D02: {
      name: "Files",
      lead: "Shows or hides the file tree beside the editor.",
    },
    D03: {
      name: "Save",
      lead: "Saves your changes to the file.",
      grey: "Grey when the file has no unsaved changes.",
    },
    D04: {
      name: "Editor full window",
      lead: "Gives the editor the whole window; Restore side by side brings the conversation back.",
    },
    D05: {
      name: "Close editor",
      lead: "Closes the editor; it asks first about unsaved changes.",
    },
    D06: {
      name: "Workspace files",
      lead: "The workspace's folders and files; a press opens a file in the editor.",
      know: "The search looks only in folders already opened.",
    },
    D07: {
      name: "Filter by name",
      lead: "Narrows the file tree to the name you type.",
    },
    D08: {
      name: "No file open",
      lead: "Open a file from the tree or from a file link in the conversation.",
    },
    W01: {
      name: "Worker",
      lead: "You are looking at a worker: an agent the main conversation gave a task, in its own worktree.",
      know: "Its work shows here, but you steer it through the main conversation.",
    },
    W02: {
      name: "To the main conversation",
      lead: "Goes back to the conversation this worker got its task from.",
      try: "Back to the main conversation",
    },
    W03: {
      name: "Agent and profile",
      lead: "Which agent and settings the worker does its work with.",
    },
    W04: {
      name: "Read only · ask through the main agent",
      lead: "You do not write to a worker directly; this takes you to the main conversation to ask about it.",
      try: "Ask the main agent",
    },
    W05: {
      name: "Main agent · task",
      lead: "The task the main agent gave the worker, word for word.",
    },
    M01: {
      name: "Search settings",
      lead: "Finds a setting by its name or a word from its description, across every page.",
    },
    M02: {
      name: "Close settings",
      lead: "Goes back to the view you opened Settings from.",
    },
    M03: {
      name: "Account",
      lead: "Your name and picture, Git identity, your views' addresses, and signing out.",
    },
    M04: {
      name: "Devices",
      lead: "Sign in on a phone with a code, and see which devices are signed in.",
    },
    M05: {
      name: "Keys",
      lead: "Your account's public SSH and age keys, which an administrator needs for access or secrets.",
    },
    M06: {
      name: "AI",
      lead: "The default model, how the agent's work shows, and the subscriptions and keys that provide models.",
    },
    M07: {
      name: "Recap",
      lead: "When and with which model recaps are made, and how much they read and write.",
    },
    M08: {
      name: "Dictation",
      lead: "The key with which dictation writes your speech into the message field.",
    },
    M09: {
      name: "Code hosts",
      lead: "GitHub, Gitea and GitLab: where workspaces are cloned from and where agents push.",
    },
    M10: {
      name: "Data for agents",
      lead: "Email, calendars, contacts and files your agents may use.",
    },
    M11: {
      name: "Own machines",
      lead: "Your own computers that the agent can reach through Tailscale.",
    },
    M12: {
      name: "Appearance",
      lead: "The theme for this browser and the interface language for all your devices.",
    },
    M13: { name: "Editor", lead: "Which editor opens the workspace's files." },
    M14: {
      name: "Storage",
      lead: "How much space you use, and the trash that deleted workspaces are restored from.",
    },
    M15: {
      name: "Experimental features",
      lead: "Features still in the works that you can turn on yourself.",
      know: "They may change or go away; they are off by default.",
    },
    M16: {
      name: "Server administration",
      lead: "Administrator pages: settings that apply to everyone on the server.",
    },
    M17: {
      name: "Server",
      lead: "The server's name, default language and running version.",
    },
    M18: {
      name: "Server integrations",
      lead: "Which services people can use on this server.",
    },
    M19: {
      name: "AI key",
      lead: "A shared key for people without a subscription or key of their own.",
    },
    M20: {
      name: "Dictation key",
      lead: "A shared dictation key for everyone without their own.",
    },
    M21: {
      name: "Onboarding",
      lead: "What a new person goes through on first sign-in, and how it looks to them.",
    },
    M22: {
      name: "Users and access",
      lead: "Who may sign in, the people who have joined, and shared links.",
    },
    M23: {
      name: "Disk space",
      lead: "The home directories' disk and each person's storage limit.",
    },
    M24: {
      name: "Edit Git identity",
      lead: "Sets the name and email that go into your and your agents' commits.",
    },
    M25: {
      name: "Version",
      lead: "The server's Habitat version, and whether this tab is up to date with it.",
      know: "If not, reloading the page brings the new version.",
    },
    M26: {
      name: "Conversations",
      lead: "How many conversations may work at once, for everyone and per person.",
    },
    M27: {
      name: "Settings",
      lead: "On a phone, returns to the list of settings or to the search results.",
    },
    M28: {
      name: "Your settings",
      lead: "Returns from administration to your own settings.",
    },
    M70: {
      name: "Atlassian",
      lead: "Connect Jira and Confluence with your own account.",
      know: "Choose requested permissions. The connection shows the actual grant, which may be broader than requested.",
    },
    M71: {
      name: "Request for your administrator",
      lead: "Copy the full request and give it to your administrator.",
      know: "Habitat sends nothing. Waiting alone does not mean an administrator is reviewing the request.",
    },
    M72: {
      name: "Jira and Confluence",
      lead: "Shows the experimental Atlassian connection in settings.",
      know: "This choice neither connects an account nor disconnects an existing one.",
    },
    M73: {
      name: "Atlassian sign-in",
      lead: "Starts sign-in or completes it with the return URL you pasted.",
      know: "Changing the level removes the previous sign-in before requesting a new grant.",
    },
    M74: {
      name: "Requested permissions",
      lead: "Choose read or read and write before signing in.",
      know: "The choice does not change the connection yet. Check granted permissions after sign-in.",
    },
    M75: {
      name: "Remove Atlassian connection",
      lead: "Removes this connection's sign-in from agents' use.",
      know: "Jira issues and Confluence pages are not deleted. You can connect the account again.",
    },
    M76: {
      name: "Trello",
      lead: "Connect Trello boards and cards with your own account.",
      know: "Each connection is its own sign-in. It shows the actual grant, which may be broader than requested.",
    },
    M77: {
      name: "Add another Trello connection",
      lead: "Adds a new Trello sign-in, for example for another Workspace.",
      know: "Your existing connections stay as they are.",
    },
    M78: {
      name: "Request for your administrator",
      lead: "Copy the full request and give it to your administrator.",
      know: "Habitat sends nothing. Only an administrator can reliably limit Trello to reading.",
    },
    M79: {
      name: "Trello",
      lead: "Shows the experimental Trello connection in settings.",
      know: "This choice neither connects an account nor disconnects existing ones.",
    },
    M80: {
      name: "Trello sign-in",
      lead: "Starts sign-in or completes it with the return URL you pasted.",
      know: "Trello asks at sign-in which Workspace the connection may reach.",
    },
    M81: {
      name: "Requested permissions",
      lead: "Choose read or read and write before signing in.",
      know: "Trello may grant more than requested. Check the actual grant after sign-in.",
    },
    M82: {
      name: "Remove Trello connection",
      lead: "Removes this connection's sign-in from agents' use.",
      know: "Boards and cards are not deleted. Your other Trello connections stay.",
    },
    N01: {
      name: "Workspace source",
      lead: "Choose whether to clone the workspace from an existing repository or create a new empty folder.",
    },
    N02: {
      name: "Search repositories",
      lead: "Narrows the list by name. Type owner/repo to look up any other repository.",
    },
    N03: {
      name: "Updated",
      lead: "Shows only the repositories that changed in the chosen period.",
    },
    N04: {
      name: "Repository",
      lead: "Selects the repository and shows its details. Nothing is cloned yet.",
      know: "The row shows the latest change and the size; a lock means a private repository.",
    },
    N05: {
      name: "Owner",
      lead: "Repositories grouped by owner: your own, your groups' and those you collaborate on.",
    },
    N06: {
      name: "Show all",
      lead: "Shows every repository in the group; Show less shortens the list again.",
    },
    N07: {
      name: "Repository details",
      lead: "The selected repository before cloning: its size, default branch and where it will go.",
      know: "If the repository is already a workspace, you can open it from here.",
    },
    N08: {
      name: "Cloning",
      lead: "Choose the full history or a light clone that fetches old file versions only when needed.",
      know: "A light clone is faster and smaller, but some ways of looking at history need a connection.",
    },
    N09: {
      name: "Clone as a workspace",
      lead: "Starts cloning. The finished repository shows up as a workspace.",
      know: "Cloning goes on on the server even if you leave the page.",
    },
    N10: {
      name: "Clones",
      lead: "Clones under way, queued and recently ended.",
      know: "The sidebar row shows while a clone runs and leads to this page.",
    },
    N11: {
      name: "Cancel or remove",
      lead: "Cancels a clone, takes it off the queue or removes an unfinished folder.",
      know: "Habitat removes the unfinished folder when it can do so safely; the notice says whether anything was left on disk.",
    },
    N12: {
      name: "Name",
      lead: "The new workspace's folder name: lowercase letters, numbers and . _ -.",
    },
    N14: {
      name: "Cancel",
      lead: "Asks first whether to cancel the clone and says what of it is removed.",
    },
    N15: {
      name: "Try again",
      lead: "Starts the clone again when it failed or did not start.",
      know: "For an interrupted clone the same button is Start over.",
    },
    N13: {
      name: "Create workspace",
      lead: "Creates an empty folder, sets it up as a Git repository and adds it to your workspaces.",
      grey: "Grey while the name is missing or workspaces cannot be created right now.",
    },
  },
  states: {
    notStarted: {
      name: "Not started yet",
      lead: "The conversation starts when you send the first message.",
      know: "Nothing is kept before that: close the page and no empty conversation is left on the lists.",
      can: {
        V01: "Write what you want the agent to do",
        A02: "Or choose a goal to have the request written for you",
        A05: "Change the model for this conversation",
      },
    },
    working: {
      name: "Working",
      lead: "The agent is doing what you asked: running commands and reading files in this workspace.",
      know: "The work goes on on the server when you close the browser; the sidebar's ball tells you when it is done.",
      can: {
        V01: "Write your next message now: it goes as steering or after the work",
        K18: "See what the agent is doing right now",
        V07: "Stop it if the work is heading the wrong way",
      },
    },
    yourTurn: {
      name: "Waiting for you",
      lead: "The agent has answered, and it is your turn.",
      know: "The conversation waits as long as you like. If you do not come back, it moves to Quiet in the sidebar.",
      can: {
        K04: "Open the agent's work to see what it did",
        V01: "Reply or ask for the next thing",
        Y04: "See what changed in the workspace",
      },
    },
    stopped: {
      name: "You stopped the turn",
      lead: "The agent stopped midway and wrote no reply.",
      know: "What the agent had done stays in the workspace. It remembers the conversation so far, so you can carry on from there.",
      can: { K04: "See where the agent stopped", V01: "Say how to carry on" },
    },
    failed: {
      name: "The turn failed",
      lead: "The agent could not finish its reply, and the turn ended in an error.",
      know: "Your message is kept. Sending it again in a moment is often enough.",
      can: {
        V01: "Send it again or write what comes next",
        Y06: "Change the model if the same error repeats",
      },
    },
    background: {
      name: "Waiting for you, work goes on in the background",
      lead: "The agent has answered, but a worker it started is still doing its part.",
      know: "You can carry on meanwhile; the worker finishing shows above the message field.",
      can: { V11: "See what the worker is doing", V01: "Carry on meanwhile" },
    },
  },
});

```
