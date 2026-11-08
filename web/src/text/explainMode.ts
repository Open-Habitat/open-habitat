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
      know: "Valikosta voit vaihtaa ne tälle keskustelulle; uusien keskustelujen oletus on Asetuksissa.",
      try: "Avaa mallit",
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
      lead: "Keskustelu on antanut työn workerille, joka tekee sitä omassa worktreessään.",
      know: "Workerin näet keskustelun yllä Workerit-merkistä.",
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
    T01: {
      name: "Työtilan nimi",
      lead: "Työtilan nimi; kansion nimi, ellei sille ole annettu näyttönimeä.",
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
      lead: "Tämän työtilan arkistoidut keskustelut. Täältä saat ne palautettua.",
    },
    A01: {
      name: "Työtilan esittely",
      lead: "Kertoo, mikä tämä työtila on, ennen kuin kirjoitat ensimmäisen viestin.",
      know: "Esittely katoaa, kun keskustelu alkaa.",
    },
    A02: {
      name: "Tavoite",
      lead: "Kirjoittaa pyynnön valmiiksi viestikenttään ja avaa oppaan viereen.",
      know: "Mitään ei lähde ennen kuin painat Lähetä; voit myös kirjoittaa suoraan agentille.",
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
      know: "Mitään ei lähetetä uudelleen; vain näkyvä tila päivittyy.",
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
      know: "Kirjoita @ kentässä, niin sama lista aukeaa kursorin kohdalle. Ctrl+P avaa valitsimen.",
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
      lead: "Malli, jolla agentti vastaa; ylimpänä tuoreimmat.",
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
      lead: "Vaihtaa tämän keskustelun mallin tai ajattelutason; seuraava vastaus käyttää uutta.",
      know: "Aiempaa viestiä ei toisteta, ja luonnoksesi säilyy.",
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
    W06: {
      name: "Pääte · vain luku",
      lead: "Workerin oma pääte; painallus avaa sen koko näkymään katsottavaksi.",
      know: "Päätteeseen ei voi kirjoittaa selaimesta.",
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
      know: "The menu changes them for this conversation; the default for new ones is in Settings.",
      try: "Open the models",
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
      lead: "The conversation has handed work to a worker, which does it in its own worktree.",
      know: "Find the worker in the Workers badge above the message field.",
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
    T01: {
      name: "Workspace name",
      lead: "The workspace's name; the folder's name unless it has been given a display name.",
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
      lead: "This workspace's archived conversations. Restore them from here.",
    },
    A01: {
      name: "Workspace introduction",
      lead: "Says what this workspace is before you write your first message.",
      know: "It goes away once the conversation starts.",
    },
    A02: {
      name: "Goal",
      lead: "Writes the request into the message field and opens its guide alongside.",
      know: "Nothing is sent until you press Send; you can also write to the agent directly.",
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
      know: "Nothing is sent again; only what you see is updated.",
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
      know: "Type @ in the field to open the same list at the cursor. Ctrl+P opens the picker.",
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
      lead: "A model the agent can answer with; the newest are at the top.",
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
      lead: "Changes this conversation's model or thinking level; the next reply uses the new one.",
      know: "No earlier message is repeated, and your draft stays.",
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
    W06: {
      name: "Terminal · read only",
      lead: "The worker's own terminal; a press opens it to the whole view for watching.",
      know: "You cannot type into it from the browser.",
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
