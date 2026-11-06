# Kierros 1: mitä agentti näkee SharePointissa ja OneDrivessa

Kierros: `design-system/prototypes/rounds/2026-11-06-m365-selaus/`
(NOTES.md kertoo ohjaimet ja mikä on yhteistä). Akseli: missä selaus asuu
ja mistä agentin muutokset löytyvät. Yläpalkin *Taso* vaihtaa Täysi /
Luonnokset / Vain luku.

- **A Asetukset**: selaus asuu Microsoft-tilin kortin alla (Asetukset › Tiedot agenteille); agentin muutokset ovat lista kortissa ja merkki tiedoston kohdalla.
- **B Tiedostot**: oma Tiedostot-näkymä sivupalkissa työtilojen yllä; kolme saraketta, Agentin muutokset -välilehti ja keskustelun vuorosta linkki muutettuun tiedostoon.
- **C Paneeli**: keskustelun sivupaneeli alkaa siitä, mitä agentti luki ja muutti tässä keskustelussa; samasta paneelista selataan ja annetaan tiedosto agentille.

Kuvat: `evidence/<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet:
`0-oletus`, `1-muutos` (agentin muokkaama tiedosto, muutos matkalla),
`2-siirretty` (muutos Microsoftissa), `3-muutokset` / `3-vuoron-linkit` /
`3-vuorosta-tiedostoon` (vain B), `4-anna` (B kysyy keskustelun), `4-selaa`
(C), `5-annettu` (tiedosto viestin sirussa), `6-lahetetty`, `7-vain-luku`,
`8-vain-luku-tiedosto`, `9-ei-nae`. Oletukset myös tummana.

## Mitä kukin päättää

| | Missä | Agentin muutos | Anna agentille | "Agentti ei näe" |
|---|---|---|---|---|
| A | Asetukset › Tiedot agenteille › Microsoft 365, oma tilisivu kortin *Selaa*-rivin takana | lista sivun yläosassa, merkki rivillä, tiedosto ikkunassa | aina uusi keskustelu | sivun alaosassa |
| B | sivupalkin *Tiedostot* työtilojen yllä, kolme saraketta | merkki rivillä, *Agentin muutokset (2)* -välilehti, vuoron alla linkit muutettuihin tiedostoihin | ikkuna: uusi keskustelu tai olemassa oleva | lähdesarakkeen alla |
| C | keskustelun otsakkeen kansiopainike avaa paneelin | *Tässä keskustelussa*: Agentti muutti / Agentti luki | lisää tämän keskustelun viestiin | *Selaa*-välilehden lähteiden alla |

## Suositus

**C Paneeli.** Ainon kaksi tarvetta kohtaavat keskustelussa: hän pyytää
agentilta jotain SharePointin tiedostoista ja haluaa nähdä, mitä se luki ja
mitä se muutti. C vastaa siihen ilman, että hänen tarvitsee tietää, missä
kirjastossa tiedosto oli tai mennä asetuksiin, ja tiedoston antaminen
agentille on samassa paikassa kuin keskustelu, johon se annetaan. Selaus
on paneelissa yhden sarakkeen syvyinen; Ainon ensimmäinen tarve ("mitä
agentti näkee") toteutuu siellä riittävästi, koska selattavaa on vain
valitut kirjastot. A on rehellinen paikka tasolle ja valinnoille, mutta
muutokset jäävät asetuksiin, jonne kukaan ei mene katsomaan, mitä agentti
teki eilen. B on tilavin ja sen muutoslista kattaa kaikki keskustelut, mutta
se on uusi päänäkymä tuotteeseen, jossa työtilat ja keskustelut ovat
keskiössä; se kannattaa vasta, jos keskustelukohtainen näkymä osoittautuu
liian kapeaksi (kysymys 3). A:n *Mitä agentti näkee* -rivi tilikortissa
kannattaa ottaa C:n rinnalle linkiksi samaan selaimeen.

## Host-tiedot

Valtuus pysyy daemonilla henkilön omana Unix-käyttäjänä: kaikki alla oleva
luetaan henkilön kotihakemistosta tai hänen omilla tunnuksillaan.
Gateway ei näe tiedostoja, eikä uutta tietovarastoa tai välimuistia
tarvita.

- **Selaus ei tarvitse Graphia.** Agentti ei käytä tiedostoja Graphin kautta,
  vaan daemonin paikallisen peilin kautta: `~/cloud/onedrive/<osoite>/` ja
  `~/cloud/sharepoint/<org>--<osoite>/<sivusto>/<kirjasto>/`
  (`microsoft_files_linux.go`). Selain näyttää siis tarkalleen sen, mitä
  agentti näkee, kun daemon listaa nämä hakemistot ja lukee tiedostot
  kuten työtilan tiedostot (sama polkurajaus ja kokoraja). Lähteiden
  nimet (sivusto, kirjasto) daemon saa tilin rclone-konfiguraatiosta, josta
  se jo lukee juurten hakemistot; ihmisen nimet täytyy tallentaa sinne
  kuvaukseen hakemistopolun rinnalle, koska polku on slugattu.
- **Mikä on valittu**: juuret, joilla on bisync-listaukset tai peilikierros
  (`microsoftReady`), ovat näkyvissä; muut ovat "Et ole valinnut". Tämä on jo
  daemonin tiedossa.
- **Ei pääsyä -sivustot** (403 kirjastoja haettaessa) saadaan nyt vain
  kirjautumisen aikana (`unavailableSites`), eikä niitä tallenneta. Joko
  daemon kysyy `me/followedSites` uudelleen Graphista henkilön tunnuksilla,
  kun sivu avataan, tai rivi jää pois. "Muut sivustot" -rivi on yleisohje
  eikä vaadi mitään.
- **Taso** on jo tilin tiedoissa (`level`, palveluiden `access`). Täysi =
  kaksisuuntainen synkronointi; luonnokset ja vain luku = yksisuuntainen
  peili, jonka seuraava kierros kirjoittaa yli.
- **Agentin muutokset tulevat Pi:n historiasta, eivät Graphista.** Graph ei
  erota agenttia henkilöstä: muutos tehdään henkilön tunnuksilla, joten
  SharePointissa muokkaajaksi näkyy hän itse. Daemon lukee keskustelun
  Pi-historiasta `write`- ja `edit`-kutsut, joiden polku osuu `~/cloud/`-
  juureen; ne ovat täsmällisiä. `bash`-komennolla tehty tiedosto (esim. docx
  Pythonilla) näkyy historiassa vain komentona, joten sen polku on
  pääteltävä komennosta tai juuren muutosajoista vuoron aikaikkunassa;
  tämä on epävarma ja pitää kertoa sellaisena. Kaikkien keskustelujen
  lista (B) tarkoittaa, että daemon käy läpi henkilön Pi-historiat;
  keskustelukohtainen (C) lukee vain avoimen keskustelun.
- **Onko muutos jo Microsoftissa**: daemon vertaa tiedoston kokoa ja
  muutosaikaa bisyncin viimeisimpään listaukseen (`microsoftWork`); sama
  = siirretty, eri = odottaa seuraavaa kierrosta. Tarkistettava toteutuksessa.
- **Avaa SharePointissa** tarvitsee kohteen verkko-osoitteen. Sivuston
  `webUrl` haetaan jo kirjautuessa, mutta sitä ei tallenneta; kohteen
  osoite saadaan Graphista (`GET /drives/{id}/root:/{polku}` → `webUrl`)
  henkilön tunnuksella. Ei koskaan `rclone link`iä, joka loisi jakolinkin.
- **Anna agentille** ei kopioi eikä lataa mitään: viestiin tulee rivi
  paikallisesta polusta, jonka agentti jo lukee. Nykyinen tiedostoviittaus
  hyväksyy vain työtilan suhteelliset polut (`fileRefs.ts`), joten tämä on
  uusi viittauslaji: polku `~/cloud/`-juureen, jonka daemon tarkistaa
  valituksi juureksi ennen lähetystä.
- Vain luku -tasolla agentti voi silti kirjoittaa paikalliseen peiliin, ja
  seuraava kierros kirjoittaa muutoksen yli (taito kieltää sen). Selain
  voisi näyttää sellaisen tiedoston eroavana; kierros ei näytä sitä.

## Kysymykset Jarille

1. **Suunta A, B vai C?** `a-asetukset-0-oletus-1440-light`,
   `b-tiedostot-0-oletus-1440-light`, `c-paneeli-0-oletus-1440-light`.
   Suositus C.
2. **Mihin annettu tiedosto menee?** C lisää sen avoimeen keskusteluun
   (`c-paneeli-5-annettu`), A aloittaa aina uuden (`a-asetukset-5-annettu`),
   B kysyy (`b-tiedostot-4-anna`). Suosittelen C:n tapaa.
3. **Tarvitseeko Aino kaikkien keskustelujen muutoslistan**
   (`b-tiedostot-3-muutokset`), vai riittääkö keskustelukohtainen
   (`c-paneeli-0-oletus`)? Kaikkien lista vaatii daemonilta kaikkien
   Pi-historioiden läpikäynnin.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-m365-selaus/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/m365-selaus/offline.html \
  --title "Mitä agentti näkee Microsoft 365:ssä – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs`: 154 tarkistuspistettä, konsoli puhdas. Kaikki suunnat 1440 ja
390 px vaaleana oletuksesta muutokseen, sen siirtymiseen, tiedoston
antamiseen ja lähettämiseen, vain luku -tasoon ja "Agentti ei näe"
-listaan; oletukset myös tummana. Kuvat kertoimella 2 (AVIF). Synteettinen
komponenttilabra, ei hostia vasten ajettu. Kierros ei muuttanut
tuotantokoodia.

## Päätökset myöhempää katselmointia varten

- **Selaus lukee peilin, ei Graphia.** Vaihtoehto oli listata Graphista
  (`/drives/{id}/children`); hylätty, koska se näyttäisi myös sen, mitä
  agentti ei vielä näe (synkronoimaton tai valitsematon), ja lisäisi
  Graph-kutsuja jokaiseen avaukseen. Graphia tarvitaan vain verkko-
  osoitteeseen ja Ei pääsyä -sivustoihin.
- **Agentin muutokset Pi-historiasta.** Graphin muutostiedot hylätty, koska
  ne näyttävät henkilön, eivät agenttia. `bash`-kirjoitusten tunnistus on
  epätäsmällinen; kierros näyttää bash-luodun docx-tiedoston agentin
  luomana olettaen, että komennon polku tunnistetaan.
- **Luonnostaso näkyy tiedostoille vain lukuna.** Näin `microsoftLevelScopes`
  toimii (luonnoksissa `Files.Read.All`); sivu sanoo tason nimen ja
  "ei voi muuttaa", ei erikseen, että luonnokset koskevat postia.
- **Muutos näkyy henkilön nimellä SharePointissa**, ja sivu sanoo sen
  suoraan. Vaihtoehto (merkitä muutos agentin tekemäksi Microsoftissa,
  esim. version kommentilla) ei onnistu rclone-synkronoinnilla.
