# Vastaa näkymään tai tiedostoon

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-26-reply-view-file/`
(`NOTES.md` kertoo rakenteen, rakennuskomennon ja tarkistuksen).
Rakennettu sivu: `design-system/prototypes/dist/2026-11-26-reply-view-file/offline.html`
(kaikki upotettuna; `index.html` samassa hakemistossa ilman upotettuja
fontteja Glasspadin hiekkalaatikkoa varten). `dist/` ei ole
versionhallinnassa, joten sivu tehdään uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-26-reply-view-file/build.mjs`.

Sivu on rakennettu tuotannon komponenteista muuttamatta niitä: keskustelu,
agentin viestit omine ↩-painikkeineen, `ViewOfferCard`, `FileOfferCard`,
`OfferCard`, `OfferActions`, `OfferPanel`, kenttä ja viestin lainaukset.
Kierroksen omia ovat vain kortin ↩, tarjouksen lainaus ja hyppy korttiin.
Data on synteettistä: vuosikertomus-työtila, näkymä pitkällä otsikolla,
PDF ja kolmen tiedoston paketti (`liitteet/`). Teema (Päivä, Yö, Korkea
kontrasti), kieli (fi/en) ja vähennetty liike toimivat kaikissa suunnissa.
Oikealla sarakkeessa *Mitä agentti saa* näkyy kesken olevan ja lähetettyjen
vastausten teksti täsmälleen sellaisena kuin Pi sen saisi.

Oletusnäkymässä vastaus näkymäkorttiin on kesken ja keskustelussa on yksi
lähetetty vastaus PDF:ään, joten erot näkyvät heti. Kaikissa suunnissa:
lainauksen painallus vierittää kortin näkyviin ja korostaa sen (tuotannon
`data-located`; vähennetyllä liikkeellä ilman vieritysanimaatiota), ✕
poistaa lainauksen ja luonnos jää, kortin ↩ pysyy painettuna niin kauan kuin
siihen vastataan, ja agentin viestien ↩ toimii rinnalla ennallaan. Katkaistu
lainaus päättyy "…" (Jari 26.11.): otsikko enintään kaksi riviä, tiedot yksi.

### Suunnat

Akseli: missä ↩ on kortilla, mitä lainaus kertoo ja kuinka tarkasti vastaus
osoittaa.

0. **Nyt**: tuotanto tänään. Korteissa ei ole ↩:ta. Ihminen valitsee ja
   kopioi otsikon (offer-card-title-copy) ja kirjoittaa itse, mihin vastaa:
   *vuosikertomus-2026.pdf: sivun 4 kaavio puuttuu.* Agentti saa pelkän
   tekstin.
1. **A Kulmassa**: ↩ on aina näkyvissä kortin oikeassa yläkulmassa, sama
   painike kuin agentin viestin kulmassa (Kopioin pari, 26×32 px työpöydällä,
   26×40 puhelimessa). Kortin oma ikonirivi (julkaisu, välilehti, lataus)
   ilmestyy osoittimen alla sen vasemmalle puolelle, ja nuoli siirtyy kortin
   alakulmaan. Puhelimessa ikonirivi on kortin alarivillä ↩:n alla. Lainaus
   on viestin lainauksen muotoinen: *↩ Vastaat näkymään 09.20* ja otsikko.
   Lähetetyssä viestissä *Agentin näkymä* ja otsikko. Vastaus osoittaa koko
   tarjoukseen, myös pakettiin.
2. **B Rivissä**: ↩ on kortin oman ikonirivin viimeinen ikoni. Työpöydällä se
   näkyy vain osoittimen alla tai fokuksessa kuten muutkin kortin ikonit,
   puhelimessa kortin alarivillä. Lainaus on pieni kortti: merkki, otsikko
   ja kortin tiedot (*Näkymä · 12 tiedostoa · 7,5 Mt*), lähetetyssä viestissä
   samoin. Vastaus osoittaa koko tarjoukseen.
3. **C Tiedostoon asti**: kortissa ↩ kuten A:ssa ja lainaus kuten B:ssä.
   Lisäksi paketin tiedostolistan (oikea paneeli; puhelimessa keskustelun
   päällä) jokaisella rivillä on oma ↩ rivin muiden ikonien jatkona:
   työpöydällä osoittimen alla, puhelimessa aina. Lainaus nimeää tiedoston ja
   paketin: *henkilosto.csv · CSV-taulukko · 142 riviä · 6 saraketta · 18 kt
   · paketista Vuosikertomuksen liitteet*. Puhelimessa rivin ↩ sulkee
   paneelin ja vie kenttään.

**Suositus: C.** ↩ on samassa paikassa ja samannäköinen kuin agentin
viestissä, joten kaikki vastattavat asiat näyttävät samalta perheeltä, ja
aina näkyvä painike löytyy ilman osoitinta. Tämä on sama syy, jolla kulman A
valittiin viesteille 23.11. B piilottaa ↩:n kortin ikonien joukkoon, ja juuri
sitä toiminnosta tietämätön ei löydä. Lainauksen laji ja koko erottavat
saman nimiset versiot (kierros 2 ja kierros 3, sama raportti uudelleen
tarjottuna) ennen lähettämistä, ja koska ne tulevat samoista sanoista kuin
kortissa, ne eivät lisää uutta sanastoa. Paketissa *se taulukko* ei kerro
agentille, mitä kolmesta tarkoitetaan, joten tiedoston rivillä on oma ↩.
A on kevein, mutta pelkkä otsikko ei erota versioita eikä kerro, onko
kohde näkymä vai tiedosto, kun otsikko on katkaistu.

### Mitä host tarvitsee (`<reply-to>`-lohko tarjoukselle)

Tarjous on natiivissa istunnossa `custom`-merkintä (`customType:
"oh-agent-notice"`, `data.view` tai `data.file_offer`;
`internal/daemon/notices_linux.go`). Sillä on oma natiivi tunniste, joka on
historiassa sen `entry_key`, joten selain voi lähettää sen kuten viestin
avaimen. Merkintä ei ole mallin kontekstissa: agentti tuntee tarjouksen vain
oman `oh agent view|file offer` -kutsunsa tulosteesta (`view_id`/`offer_id`)
ja lähdepoluista, jotka se itse antoi. Siksi lohkon on nimettävä tunniste ja
lähde, ei vain otsikkoa.

- **Selain → daemon:** sama `reply_to: {entry_key}` kuin viestille, ja C:ssä
  valinnainen `path` (tiedoston polku paketin sisällä). Sopimuksen muutos
  `contracts/v1/pi-message.schema.json`:iin.
- **Daemon** hyväksyy avaimen nykyiseltä haaralta myös, kun merkintä on
  `custom`/`oh-agent-notice` (`replyExcerpt` hyväksyy nyt vain
  `assistant`-merkinnän; `rewindLine` kantaa jo `customType`n). `path`
  tarkistetaan tarjouksen manifestin `items`-listasta
  (`~/.local/state/open-habitat/files/<id>/`), muuten 409
  `reply_target_gone`.
- **Lohko** pysyy samassa muodossa, joten jäsennin (`internal/replyblock`) ei
  muutu: `<reply-to entry="…">`, runko, `</reply-to>`. Rungon kirjoittaa
  daemon englanniksi kuten Habitatin muutkin rivit agentille, ja otsikko ja
  polut ovat agentin dataa (`</reply-to`-jono poistetaan kuten nyt):

  ```
  <reply-to entry="4c1e9a07">
  View you offered: "Ajat keskustelussa – prototyyppi, kierros 3: …" (view_id vk3qzm7d2xw4a6b5c7e2f3g4h5j)
  Source: dist/ajat-3/ · opens index.html · 12 files · 7.5 MB
  </reply-to>

  Menen B:llä. Kysymykseen 2: kesto saa näkyä myös pysäytetyssä vuorossa.
  ```

  Yksi tiedosto: `File you offered: "vuosikertomus-2026.pdf" (offer_id …)` /
  `Source: out/vuosikertomus-2026.pdf · PDF · 2.4 MB`. Paketti:
  `Files you offered: "Vuosikertomuksen liitteet" (offer_id …)` /
  `Source: liitteet/ · 3 files · 1.1 MB`. Paketin tiedosto (C):
  `File henkilosto.csv in the files you offered as "Vuosikertomuksen liitteet" (offer_id …)`
  / `Source: liitteet/henkilosto.csv · CSV table · 18 KB`.
  Näkymän lähde on `view.source` (absoluuttinen, näytetään työtilan
  suhteen, kun se on työtilan sisällä); tiedostotarjouksen lähteet ovat
  manifestin `paths`, joita ilmoituksen yhteenveto ei kanna.
- **Takaisin näkymään:** historian `reply_to` saa valinnaisen kentän
  `offer: {kind: "view"|"file", title, path?}`, jotta lähetetty lainaus
  piirtyy merkin ja otsikon kanssa eikä englanninkielisestä rungosta.
  Projektio löytää kohteen samasta istuntotiedoston läpikäynnistä
  (ilmoitus on aina ennen vastausta). Kentän lainaus näkyy selaimen jo
  lataamasta kortista.
- Gateway ja `internal/provision` eivät muutu, eikä mikään auktoriteetti
  siirry.

### Päätökset myöhempään katselmointiin

- Lohkon runko on englantia, vaikka ihmisen kieli on suomi; se on hostin
  rivi agentille, ei ihmiselle näytettävä teksti.
- Näkymän tiedostoon (monen tiedoston näkymän yksittäinen sivu) ei voi
  vastata erikseen; vain paketin tiedostoihin (C).
- Vastattava kohde on yksi kerrallaan, kuten viesteissä: uusi ↩ korvaa
  edellisen, myös viestin ja kortin välillä.
- Poistetun tarjouksen kortissa ei ole ↩:ta (kortti on jo inertti).
- Kortin nuoli siirtyy A:ssa ja C:ssä alakulmaan ↩:n tieltä.

### Kysymykset Jarille

1. Riittääkö vastaus koko pakettiin (A, B), vai tarvitaanko C:n rivikohtainen
   ↩ paketin tiedostoihin?
2. Näytetäänkö lainauksessa kortin tiedot (laji ja koko, B ja C) vai pelkkä
   otsikko (A)?
3. Saako lohkon runko olla englantia, vai kirjoitetaanko se ihmisen kielellä?

### Tarkistus

`check.mjs` tarjoili sivun näkymän hiekkalaatikon CSP:llä (läpinäkymätön
alkuperä, ei yhteyksiä eikä kehyksiä) ja kävi kaikki neljä suuntaa Päivä-,
Yö- ja Korkea kontrasti -teemassa 1440 ja 390 px:n leveydellä vähennetyllä
liikkeellä suomeksi sekä englanniksi 1440/Päivä ja 390/Yö: ↩ jokaisessa
kortissa (Nyt: ei yhtään), paikka kulmassa ja sama koko kuin viestin ↩:llä
(A, C), B:n ↩ ikonirivissä piilossa levossa työpöydällä ja näkyvissä
osoittimen alla, fokuksessa ja puhelimessa, otsikko ei ↩:n alla, lainauksen
otsake, kahden rivin katkaisu ja "…" puhelimessa, tiedot vain B:ssä ja C:ssä,
lohkon muoto kullekin kohteelle, lähetetty lainaus, hyppy kenttä- ja
lähetetystä lainauksesta, ✕ luonnoksen säilyessä, vastaus pakettiin, C:n
rivien ↩ (A ja B: ei yhtään) ja vastaus yhteen tiedostoon, vastaus agentin
viestiin rinnalla, lähetys ja ylivuodon puuttuminen. 1264 tarkistusta meni
läpi, ja konsoli pysyi puhtaana. Kuvakaappaukset (DPR 2) ovat repositorion
ulkopuolella hakemistossa `/var/tmp/agent-keep/reply-view-file/`
(`<suunta>-<n>-<tila>-<leveys>-<teema>-<kieli>.png`).
