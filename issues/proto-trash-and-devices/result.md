# Tulos: roskakori ja puhelinkirjautuminen

Kaksi kierrosta, kumpikin kolme suuntaa yhdellä akselilla. Nykytila katsottiin labissa
ennen suuntia: tuotannon Asetukset (osioluettelo Tili, Agentit, Yhteydet, Ulkoasu,
Tallennustila; yksi osio kerrallaan) ja työtilasivu (Ikonirivi, jossa roskakori-ikoni on
nyt estetty). Kierrokset käyttävät samaa muotoa.

```
cd design-system/prototypes
node build.mjs rounds/2026-10-17-roskakori   # dist/2026-10-17-roskakori.html
node build.mjs rounds/2026-10-17-laitteet    # dist/2026-10-17-laitteet.html
```

`check.mjs` ajettiin molemmille: vaalea, tumma, puhelin ja klikkaukset (poistodialogin
kolme tapausta, roskakorin sivu, pysyvä poisto, palautus; koodi, puhelimen sivu, vieras
skannaus, uloskirjaus, tilivalikon ponnahdus, vanheneminen). Konsoli oli puhdas.

## Roskakori (`2026-10-17-roskakori`)

**Akseli: missä roskakori on.** Kaikissa suunnissa ovat samat poistovahvistus, estot,
roskakorin rivi, palautus ja pysyvä poisto. Suunnat eroavat vain siinä, mistä roskakorin
löytää.

1. **Oma sivu.** Sivupalkin alareunassa tilipainikkeen yläpuolella on Roskakori-rivi
   lukumäärän kanssa, ja se avaa oman sivun. Ratkaisu: roskakori on pysyvä paikka
   navigaatiossa, kuten työpöydän roskakori, ja se näkyy aina.
2. **Työtilojen joukossa.** Roskakorissa olevat työtilat ovat sivupalkin lopussa
   taittuvana Roskakori-ryhmänä (nimi yliviivattuna, päiväys). Rivi avaa työtilan sivun
   roskakoritilassa: banneri, Palauta ja Poista pysyvästi, mitä Gitissä on vain täällä
   sekä keskustelut, jotka palaavat. Kun työtila siirretään roskakoriin, sen sivu jää
   auki tähän tilaan. Ratkaisu: roskakorissa oleva työtila on yhä työtila, jonka sisällön
   voi katsoa ennen kuin päättää.
3. **Tallennustilassa.** Asetukset › Tallennustila näyttää käyttöpalkin, jossa
   roskakorilla on oma osuutensa, ja sen alla roskakorin listan. Sivupalkissa ei ole
   mitään. Ratkaisu: roskakori on tilankäytön asia, ja pysyvä poisto on tapa saada tila
   takaisin (ADR 0019 ja kiintiöt ADR 0012).

Yhteistä kaikille suunnille:

- Roskakori-ikoni avaa dialogin, joka ensin tarkistaa ("Tarkistetaan, käyttääkö jokin
  työtilaa …") ja näyttää sitten yhden kolmesta tapauksesta.
  - **Estetty** (`issuectl`): jokainen esto on omalla rivillään, ja rivillä kerrotaan,
    miten esto poistuu. Estoja ovat Pi:n vuoro (Avaa keskustelu), pääte PID:n ja `comm`in
    kanssa, Taskfleet-ajo kopioitavalla `taskfleet run cancel` -komennolla, linkitetty
    worktree `git worktree remove` -komennolla ja tuntematon prosessi, joka estää
    varmuuden vuoksi. Lisäksi sanotaan, mitä mitään ei ole siirretty ja että keskustelut ja
    Gitin muutokset eivät estä. Painike on Tarkista uudelleen.
  - **Roskakoriin** (`aurinkokello`, `fleetrepo`): "Roskakoriin eikä suoraan pois, koska tämä
    on vain täällä" ja lista muutoksista, uusista tiedostoista, committeista, joita ei ole
    GitHubissa, stashista tai puuttuvasta etärepojista. Keskustelujen määrä kerrotaan, ja
    vahvistuspainike on tavallinen ensisijainen painike, koska siirto on palautettavissa.
  - **Heti pysyvästi** (`kokeilu-wasm`, puhdas ja kokonaan pushattu): vihreä tarkistuslista
    ja milloin on viimeksi haettu. Gitin ohittamat tiedostot (`.env`, `node_modules/`)
    mainitaan häviävinä. Painikkeet ovat Poista pysyvästi (punainen) ja hiljainen
    "Siirrä silti roskakoriin".
- Siirron jälkeen tulee Hetki alhaalla -ilmoitus Palauta-painikkeella. Pysyvän poiston
  jälkeen tulee toast, jossa kerrotaan, mistä työtilan saa kloonattua takaisin.
- Roskakorin rivillä ovat nimi, poistoaika, koko, keskustelujen määrä, merkit siitä, mitä
  on vain täällä, sekä Palauta ja Poista pysyvästi…. Jos nimi on varattu `~/src`:ssä,
  Palauta on estetty ja syy kerrotaan (ADR: palautus ei nimeä hiljaa uudelleen).
- Pysyvässä poistossa nimi kirjoitetaan vahvistukseksi, ja dialogi toistaa, mitä
  menetetään ja paljonko tilaa vapautuu.
- Roskakorin johdannossa sanotaan, että tämä on kotihakemiston tavallinen
  `~/.local/share/Trash`, jonka myös `gio trash` ja `trash-restore` näkevät, ja että
  mitään ei poisteta automaattisesti.

### Host-tiedot, joita näkymä olettaa

- **Koko.** Kunkin roskakorimerkinnän ja työtilan koko vaatii daemonilta hakemiston
  läpikäynnin. ADR 0019 ei sitä mainitse.
- **Tarkistukset ennen vahvistusta.** Dialogi olettaa, että tarkistukset (estot ja
  Git-faktat) voi ajaa lukuoperaationa ennen varsinaista poistopyyntöä, ja että tulos
  kertoo, mihin kolmesta tapauksesta työtila kuuluu. ADR kuvaa tarkistukset vain
  poistopyynnön sisällä.
- **Gitin ohittamat tiedostot.** Lista ja koko tulisivat esimerkiksi komennolla
  `git status --ignored`. Puhtauden ehdossa niitä ei nyt ole.
- **Roskakorissa olevan työtilan Git-faktat.** Ne luetaan roskakorissa olevasta
  hakemistosta samalla Git-kerroksella. Keskustelut liitetään polun perusteella
  (`.trashinfo`n `Path`).
- **Tuntematon prosessi** nimetään PID:llä, eikä sen `comm`ia tiedetä.
- **Estetyn Pi:n "Avaa keskustelu"** olettaa, että esto osaa nimetä keskustelun, jonka
  `cwd` on tämä.

### Kysymykset Jarille

1. Mikä suunta?
2. **Gitin ohittamat tiedostot.** Kuuluuko puhtaaseen pysyvään poistoon, että Gitin
   ohittamat tiedostot (`.env`, paikalliset asetukset) eivät ole GitHubissa? Prototyyppi
   poistaa ne ja varoittaa siitä. Vaihtoehto on, että `.env` tai muu ohitettu tiedosto
   siirtää työtilan roskakoriin.
3. **Haku ennen poistoa.** "Kaikki GitHubissa" perustuu viimeisimpään hakuun (ADR: ei
   fetchiä). Haetaanko ennen pysyvää poistoa, jotta poistettu tai uudelleenkirjoitettu
   etähaara ei jää huomaamatta?
4. **Siirrä silti roskakoriin.** Pidetäänkö puhtaan tapauksen vaihtoehto, vai riittääkö
   pelkkä pysyvä poisto?
5. **Tyhjennä roskakori.** Tarvitaanko selaimeen "Tyhjennä roskakori"? Prototyypissä ja
   ADR:ssä on vain poisto merkintä kerrallaan.

## Kirjaudu puhelimella (`2026-10-17-laitteet`)

**Akseli: kuinka lähellä koodi on.** QR-paneeli, puhelimen `/link`-sivu ja istuntorivi
ovat samat kaikissa suunnissa.

1. **Tilin rivi.** Asetukset › Tili -osiossa on rivi "Kirjaudu puhelimella · Näytä
   koodi…", joka avaa koodin dialogiin. Kirjautuneet laitteet ovat samassa osiossa.
   Ratkaisu: toiminto on tilin asetus, ja koodi näkyy vain hetken erillisessä kerroksessa.
2. **Laitteet-osio.** Asetuksissa on oma Laitteet-osio. Kortin "Näytä koodi" avaa koodin
   kortin sisään sivulle, ja uusi laite ilmestyy heti alla olevaan listaan korostettuna
   (Uusi). Ratkaisu: laitteet ovat oma asiansa, ja linkityksen tulos näkyy samassa
   paikassa, josta sen voi myös perua.
3. **Tilivalikosta.** Tilivalikossa on Asetusten alla "Kirjaudu puhelimella", joka
   näyttää koodin heti sivupalkin päällä käymättä Asetuksissa. Asetukset › Tili -osiossa
   on vain laitelista ja linkki samaan ponnahdukseen. Ratkaisu: nopein reitti, koska
   Jarin käyttötapa on testata puhelinta usein.

Yhteistä kaikille suunnille:

- Koodin vieressä ovat lähtölaskenta 1.00 → 0.00 ja palkki (vain teksti ja palkki
  päivittyvät), maininta, että puhelin kysyy vielä vahvistuksen, sekä varoitus: "Koodi
  kirjaa laitteen tilillesi, joten älä näytä sitä kenellekään äläkä skannaa sitä toisen
  pyynnöstä." Lisäksi on Peruuta.
- Kun koodia on käytetty, näkyy "Koodilla kirjautui **iPhone · Safari** juuri nyt. Koodi
  ei toimi enää." ja kysymys "Oliko se sinun puhelimesi?". Painikkeet ovat Kirjaa tämä
  laite ulos ja Se olin minä. Sama näkymä tulee, jos joku muu ehtii ensin, koska host ei
  tiedä, kenen laite on.
- Vanhentunut koodi: "Koodi vanheni käyttämättä. Kukaan ei kirjautunut." ja Näytä uusi
  koodi.
- Puhelimen sivu: palvelin, avatar, "Kirjaudutaanko nimellä Jari Mustonen?", GitHub-tunnus
  ja palvelin, "Hyväksy vain, jos skannasit koodin omalta näytöltäsi juuri nyt." sekä
  Kirjaudu ja Peruuta. Tilat ovat Kirjauduttu, Koodi ei enää toimi ja Et kirjautunut.
- Istuntorivillä ovat laitekuvake, karkea nimi, Tämä selain- tai Uusi-merkki ja
  "Kirjautunut GitHubilla / QR-koodilla <aika>". Oman istunnon rivillä on nykyinen
  Kirjaudu ulos…, muilla Kirjaa ulos… vahvistuksen kanssa. Alaviitteessä kerrotaan, että
  nimet ovat selainten omia ilmoituksia ja että uloskirjaus ei koske palvelimen työtä.
- Esitys-rivi (katkoviivakehys) on vain prototyypissä: Puhelin skannaa, Joku muu ehtii
  ensin ja Minuutti kuluu. QR on koriste eikä skannaudu.

### Host-tiedot, joita näkymä olettaa

- **Koodin tila.** Gateway kertoo koodin tilan selaimelle: odottaa, käytetty (ja millä
  istunnolla) tai vanhentunut. ADR kohta 5 edellyttää tätä mutta ei kerro, miten tieto
  kulkee (kysely vai tapahtuma).
- **Istuntotietueet.** Tietueissa ovat luontiaika, tapa (`github`/`link`) ja karkea
  laitenimi (ADR kohta 6). Viimeistä käyttöaikaa ei ole, joten sitä ei näytetä.
- **Nykyinen istunto** tunnistetaan listassa (Tämä selain).
- **Puhelimen vahvistussivu** näyttää koko nimen, GitHub-tunnuksen ja palvelimen nimen.
  ADR:n describe-kutsu palauttaa nämä kuluttamatta koodia.

### Kysymykset Jarille

1. Mikä suunta?
2. **Kirjaa ulos kaikki muut.** Tarvitaanko "Kirjaa ulos kaikki muut laitteet"? ADR:ssä
   on vain istuntokohtainen uloskirjaus.
3. **Viimeksi käytetty.** Näytetäänkö istunnoille viimeinen käyttöaika? Se auttaa
   tunnistamaan vanhat laitteet, mutta se on uusi kenttä, jota gateway päivittää joka
   pyynnöllä.
4. **Tilivalikko.** Jos valitset Tilivalikosta, onko tilivalikko oikea paikka toiminnolle,
   joka luo tunnuksen tilillesi? ADR:n uhkataulukko perustelee sen, mutta toiminto on
   silloin yhden klikkauksen päässä.

## Kirjastoehdotukset

Kirjastoa (`lib/`) ei muutettu. Kumpikin kierros poistaa oman ohituksensa avulla
`account.js`:n `…`-valikon työtilariviltä, koska tuotannossa sitä ei ole, ja piirtää
asetusten kehyksen itse. Kun suunta valitaan, työtilasivun Ikonirivi ja asetusten kehys
kannattaa siirtää kirjastoon. Ne on nyt kopioitu useaan kierrokseen.
