# Palvelin › käyttöönotto ja kutsut

## Kierros 6 · Käyttäjät ja pääsy

**Suositus: Yksi lista.** Sallitut GitHub-tunnukset ja liittyneet henkilöt ovat samoja ihmisiä eri vaiheissa, joten jokainen on yksi rivi, ja rivin tila kertoo vaiheen: *Ei vielä kirjautunut*, *Käyttäjä*, *Ylläpitäjä* tai *Pääsy poistettu*. Listan yläpuolella on yksi kenttä, johon kirjoitetaan tunnus. Kenttä tarkistaa tunnuksen GitHubista ennen lisäystä. Suodatin *Kaikki / Liittyneet / Ei kirjautuneet / Poistetut* riittää, kun ihmisiä on paljon. Suosittelen tätä, koska pääsyn poistaminen ei poista ihmistä palvelimelta: hänen Unix-tilinsä jää, ja on rehellisintä, että hänen rivinsä jää samaan listaan uudella tilalla eikä siirry toiseen paikkaan.

**[Avaa kierros 6](https://glasspad.example.test/p/c32hkvhffsk4biofnunhrmewdy/).** Sivu avautuu *Käyttäjät ja pääsy* -välilehdelle. Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä.

### Mikä on sovittu ja näkyy sellaisenaan

- Kutsuja ei ole. Pääsy on sallittujen GitHub-tunnusten lista (Jari r2), ja sama välilehti näyttää liittyneet henkilöt (Jari r4).
- Välilehdet ja ulkoasu ovat kierroksen 5 mukaiset: *Palvelimen ylläpito* -ryhmä, puhelimessa painikerivi sisällön yllä.
- Käyttäjälistassa näkyy käyttöönoton tulos kierroksen 5 mukaisesti, esimerkiksi "2/3 oletusrepoa haettu · ei pääsyä: `northstar-demo/infra`". Henkilö itse ei näe pois jäänyttä repoa.
- Tarkemmat ylläpitotoimet tehdään komentorivillä (Jari 23.10.). Selain ei poista Unix-tiliä.

### Mitä kaikissa suunnissa on samaa

- **Selain pyytää, palvelin vahvistaa.** Välilehden alussa lukee: "Palvelin tekee pääsymuutokset. Selain lähettää pyynnön, ja muutos on voimassa, kun palvelin on vahvistanut sen." Lisätty tai poistettu rivi näyttää ensin tilan *Lisätään · odottaa palvelinta* tai *Poistetaan · odottaa palvelinta*. Lopullinen tila tulee vasta vahvistuksen jälkeen (prototyypissä 0,9 sekunnin viive). Sivu ei siis missään vaiheessa näytä muutosta voimassa olevana ennen palvelinta.
- **Tunnuksen tarkistus:** kenttä hyväksyy muodot `@nimi` ja `https://github.com/nimi`. Se tarkistaa GitHubin tunnussäännön (kirjaimia, numeroita ja yksittäisiä yhdysmerkkejä, enintään 39 merkkiä) ja hakee tunnuksen GitHubista. Löytyneestä näytetään nimi ja GitHub-id ennen *Salli*-painiketta, jotta ylläpitäjä näkee lisäävänsä oikean ihmisen. Kentän alla kerrotaan, että pääsy sidotaan GitHub-tilin numeroon, joten tunnuksen vaihto GitHubissa ei vie pääsyä. Tämä vastaa nykyistä brokeria, joka sallii numeerisia GitHub-id:itä.
- **Kaksoiskappaleet ja muut tapaukset** näytetään kentän alla eikä virheenä painalluksen jälkeen. Kirjainkoolla ei ole väliä:
  - `MAIJA-esim`: "on jo käyttäjä (Unix: maija)".
  - `@northstar-ops`: "on jo sallittu. Hän ei ole vielä kirjautunut".
  - `northstar-demo`: "on organisaatio. Lisää henkilön oma GitHub-tunnus".
  - Tuntematon tunnus: "GitHub-käyttäjää … ei löydy".
  - Tunnus, jonka pääsy on poistettu: painike muuttuu muotoon *Palauta pääsy*, ja ohje sanoo, että henkilö pääsee taas omalle Unix-tililleen.
- **Pääsyn poisto** kysyy vahvistuksen, ja vahvistus kertoo seuraukset:
  - *Ei vielä kirjautunut:* "Unix-käyttäjää ei ole luotu … Hän ei voi enää kirjautua." Rivi poistuu, kun palvelin on vahvistanut muutoksen.
  - *Liittynyt:* "Teppo Esimerkki ei voi enää kirjautua. Avoimet selainistunnot päättyvät, kun palvelin on vahvistanut muutoksen. Unix-käyttäjä `teppo`, kotihakemisto, työtilat ja tunnukset jäävät palvelimelle. Selaimesta niitä ei poisteta. Tilin poisto ja muut tarkemmat toimet tehdään palvelimella komentorivillä." Rivi jää näkyviin tilalla *Pääsy poistettu*, ja siinä lukee "Unix-tili `teppo` ja sen tiedostot ovat yhä palvelimella". Rivillä on painike *Palauta pääsy*.
  - *Ylläpitäjä:* omalla rivillä ei ole poistoa. Siinä lukee "Ylläpitäjän pääsy tulee palvelimen asetuksista", koska ylläpitäjät on määritelty palvelimen `site.json`issa.

### Suunnat

Akseli: miten sallitut mutta ei vielä kirjautuneet ja liittyneet henkilöt näytetään ja miten niitä muokataan.

| Suunta | Lista | Lisäys | Poisto ja poistetut | Puhelin | Hyöty ja hinta |
| --- | --- | --- | --- | --- | --- |
| **1. Yksi lista** (suositus) | Yksi lista *Henkilöt*. Rivin tila kertoo vaiheen, ja suodatin rajaa listaa. | Yksi kenttä listan yllä, GitHub-tarkistus heti. | *Poista pääsy* rivillä. Poistettu jää listaan omalla tilallaan ja *Palauta pääsy* -painikkeella. | Rivit pinoutuvat, painike rivin alle. Suodatin taittuu kahdelle riville. | Yksi paikka jokaiselle ihmiselle, eikä mitään katoa. Pitkässä listassa tarvitaan suodatinta. |
| **2. Kaksi listaa** | *Sallitut, eivät vielä kirjautuneet* ja *Käyttäjät*, sekä tarvittaessa *Pääsy poistettu*. | Kenttä on odottavien listan sisällä, koska uusi tunnus menee aina sinne. | Poistettu käyttäjä siirtyy kolmanteen osioon, jonka ohje kertoo, että Unix-tilit ovat yhä palvelimella. | Osiot allekkain. | Selkein ero kirjautumattomien ja käyttäjien välillä. Ihminen kuitenkin vaihtaa paikkaa elinkaarensa aikana, ja osioita on käytännössä kolme. |
| **3. Henkilö auki** | Tiivis lista, josta henkilö avataan. Tiedot ja toiminnot ovat avatussa näkymässä: GitHub-id, Unix-käyttäjä, päivämäärät, käyttöönotto ja komentorivihuomautus. | *Salli GitHub-tunnuksia…* avaa ikkunan, johon voi liittää useita tunnuksia kerralla. Jokainen tarkistetaan omalla rivillään, ja painike sanoo esimerkiksi *Salli 2 tunnusta*. | Toiminnot ovat avatussa henkilössä. | Avattu henkilö korvaa listan, ja *‹ Kaikki henkilöt* palaa listaan. | Skaalautuu parhaiten, ja usean tunnuksen lisäys säästää työtä. Jokainen toiminto vaatii kuitenkin yhden klikkauksen lisää. |

Suuntien osia voi myös yhdistellä, esimerkiksi suunnan 3 usean tunnuksen lisäyksen suunnan 1 listaan.

### Mitkä toiminnot vaativat palvelimen pääkäyttäjäoikeuden

Nykyään pääsy on root-brokerin päätösvaltaa. Sallitut ovat palvelimen `site.json`issa numeerisina GitHub-id:inä, ja `host apply` vie ne brokerin sallittujen listaan. Selain ja gateway eivät voi muuttaa sitä. Missä selaimesta lähtevä pyyntö käsitellään, on yhä auki suunnitelmassa `plan-site-onboarding-authority`. Prototyyppi ei oleta ratkaisua. Se näyttää vain, että muutos odottaa palvelinta.

| Toiminto | Kuka sen tekee | Huomio |
| --- | --- | --- |
| Salli tunnus | Root-broker (nyt `site.json` + `host apply`) | Tunnus pitää muuttaa GitHub-id:ksi. Kuka tekee haun ja kenen GitHub-tunnuksella, kuuluu suunnitelmaan. |
| Poista sallituista (ei kirjautunut) | Root-broker | Ei muuta poistettavaa. |
| Poista pääsy (liittynyt) | Root-broker ja gatewayn root-only-peruutusohjaus | Nykyinen `host apply` peruu poistetun henkilön istunnot ennen uutta sallittujen listaa. Pelkkä brokerin listan muutos ei lopeta istuntoja. |
| Palauta pääsy | Root-broker | Oletus: brokerin sidonta GitHub-id:stä Unix-käyttäjään säilyy, joten henkilö palaa samalle tilille. Tämä on tarkistettava toteutuksessa. |
| Käyttäjälistan lukeminen (Unix-käyttäjä, liittymispäivä) | Brokerin sidontakirjanpito, root-omisteinen | Selain tarvitsee siitä lukunäkymän. |
| Viimeksi nähty | Gateway (istunnot) | |
| Käyttöönoton tulos ("2/3 oletusrepoa haettu") | Henkilön oma daemon hänen Unix-käyttäjänään | **Rajan ylitys:** ylläpitäjä lukee toisen käyttäjän tietoa. Siksi tarvitaan etuoikeutettu raportointitie, joka ei anna pääsyä henkilön kotihakemistoon. Kuuluu suunnitelmaan, kuten kierroksella 5 todettiin. |
| Unix-tilin poisto | Vain komentorivillä | Komentoa ei ole vielä. `docs/operations.md`:n mukaan tuettua deprovisiointioperaattoria ei ole. |
| Ylläpitäjän oma pääsy | `site.json`in ylläpitäjät | Ei muokattavissa selaimesta. |

### Siirtyvä asia kierrokselta 5: lukitut pakkovalinnat repovalitsimessa

Jarin päätöksen mukaan automaattisessa haussa jo haettavat oletusrepot pysyvät henkilön repovalitsimessa lukittuina valintoina. Kokeile *Käyttöönotto*-välilehdeltä: tapa on valmiiksi *Hae automaattisesti*, ja *Näytä henkilön näkymä* avaa esikatselun.

- Oletusrepot ovat listan alussa. Ne ovat valittuja eikä niitä voi poistaa, ja jokaisella on oma tilansa: lukkokuvake ja "Sivusto hakee · 42 %" tai "Sivusto hakee · jonossa".
- Haku ja aikaväli eivät piilota lukittuja rivejä, eikä *Valitse kaikki näkyvät* koske niihin.
- Laskuri sanoo "Valittu 1 repo. Sivusto hakee lisäksi 3.", ja painike on *Jatka* tai *Hae 1 repo lisää ja jatka*. Painike ei sano enää "Jatka ilman repoja", mikä korjaa kierroksen 5 huomaaman ristiriidan.
- Oletusrepo, jota henkilö ei voi lukea, ei ole lukittukaan rivi. Se ei näy hänelle missään (persona *Ei pääsyä: infra*).
- Esivalinta pysyy ennallaan: tavalliset valitut rivit, joista valinnan voi poistaa.

**Ehdotus `GitHubRepoChooser`in pienimmäksi muutokseksi:** yksi uusi valinnainen props, `locked?: {full_name: string; status: string}[]`. Lukittu repo on myös `view.repositories`-listassa, jotta valitsin tuntee sen kuvauksen ja yksityisyyden. Se ei kuulu `selectedNames`-listaan eikä `onProceed`-kutsuun, koska haku on jo käynnissä. Valitsin piirtää lukitut rivit ensin valittuina ja pois käytöstä, ja tilan kertoo `status`-teksti. Lisäksi lukitut huomioidaan laskurissa ja painikkeen tekstissä. Muu valitsin on tuotannon koodi muuttamattomana. Koko ehdotus on diff tiedostojen `web/src/components/GitHubRepoChooser.tsx` ja kierroksen `chooser.tsx` välillä (noin 90 muutettua riviä). Edistymisen teksti tulee vanhemmalta, joka jo omistaa haut, joten valitsin ei päättele hakujen tilaa itse.

### Kokeile

1. Suunta 1: kirjoita kenttään vuorotellen `-bad-`, `MAIJA-esim`, `@northstar-ops`, `northstar-demo`, `ville-vanha` ja `https://github.com/lauri-k`, ja salli viimeinen. Rivi näyttää ensin *odottaa palvelinta*.
2. Poista `@northstar-ops` (rivi katoaa) ja `@teppo-esim` (rivi jää tilalla *Pääsy poistettu*). Lue vahvistusikkunan seuraukset. Palauta `@ville-vanha`.
3. Kokeile suodatinta *Poistetut*.
4. Suunta 2: vertaa osioita. Poistettu käyttäjä siirtyy omaan osioonsa.
5. Suunta 3: *Salli GitHub-tunnuksia…* ja liitä useampi tunnus kerralla. Avaa henkilö. Puhelimessa avattu henkilö korvaa listan.
6. *Käyttöönotto* → *Näytä henkilön näkymä*: lukitut repot valitsimessa. Hae `docs` ja valitse se, vaihda henkilöksi *Ei pääsyä: infra* ja lopuksi tavaksi *Esivalitse*.

### Kysymykset Jarille

1. **Valitaanko Yksi lista?** Vai Kaksi listaa tai Henkilö auki, tai yhdistelmä, esimerkiksi suunnan 3 usean tunnuksen lisäys suunnan 1 listaan?
2. **Liittyneen pääsyn poisto:** sopiiko, että selain lopettaa kirjautumisen ja istunnot, mutta Unix-tili, tiedostot ja tunnukset jäävät, rivi jää listaan tilalla *Pääsy poistettu* ja tilin poisto tehdään komentorivillä?
3. **Palautus:** palaako pääsyn takaisin saanut henkilö samalle Unix-tilille (prototyypin oletus)?
4. **GitHub-id näkyviin?** Prototyyppi näyttää lisäyksen yhteydessä nimen ja numeerisen GitHub-id:n, koska pääsy sidotaan numeroon. Riittääkö pelkkä nimi?
5. **Lukitut pakkovalinnat:** kelpaako ehdotettu `locked`-props ja rivin teksti "Sivusto hakee · 42 %"?

### Oletukset, ei toteutuspäätöksiä

- Sanasto: `admission.allowed = [{github_id, login}]`. Kirjautumistunnus on vain näyttöä varten, ja tunnistus tehdään numerolla. Tämä ei ole lukittu skeema.
- Palvelimen vahvistus on prototyypissä 0,9 sekunnin viive. Oikea kesto ja epäonnistuneen pyynnön esitys riippuvat siitä, mihin auktoriteettisuunnitelma päätyy.
- GitHub-haku on synteettinen. Kenen tunnuksella oikea haku tehdään, on auki.
- "Viimeksi nähty" ja käyttöönoton tulos ovat lukunäkymiä, joita tuotannossa ei vielä ole (ks. taulukko yllä).

### Näyttö

Kierroksen 6 [evidence](evidence/) on `r6-`-alkuisissa tiedostoissa. Jokainen on kuvakaappaus/staattinen HTML -pari:

- `r6-users-*`: välilehti kaikista suunnista 1440 px:n leveydellä sekä suunnat 1 ja 2 390 px:n leveydellä.
- `r6-add-*`: tarkistettu tunnus (suunta 1) ja usean tunnuksen ikkuna (suunta 3).
- `r6-remove-1-390-light`: liittyneen poiston vahvistus puhelimessa.
- `r6-removed-3-*`: poistettu käyttäjä avattuna.
- `r6-detail-3-390-dark`: avattu henkilö puhelimessa.
- `r6-locked-*`: lukitut pakkovalinnat repovalitsimessa.

Tarkistukset:

- `check.mjs` (Playwright `web/node_modules`ista): 74 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja teemoilla. Mukana ovat yhteinen `picker-check.mjs`, valitsimen näppäimet, URL-valinta ja R:n uudelleenaloitus, tekstikentän näppäinten ohitus, välilehden palvelinhuomautus, tunnuksen tarkistukset (muoto, liittynyt, jo sallittu, organisaatio, tuntematon, palautus, profiiliosoite), usean tunnuksen ikkuna, *odottaa palvelinta* -välitila, ylläpitäjän poistamaton rivi, poistot ja niiden seuraukset, palautus, suodatin, puhelimen avattu henkilö sekä lukitut pakkovalinnat (valittu, pois käytöstä, tila, haku ei piilota, *Valitse kaikki näkyvät* ei koske, laskuri, painikkeen teksti, pääsyä vailla oleva henkilö, esivalinta ennallaan). Ei konsolivirheitä eikä vaakaylivuotoa. Tulos on `evidence/r6-checks.json`.
- Sama tarkistus julkaistulla Glasspad-sivulla: `evidence/r6-hosted-checks.json` (74 tarkistuspistettä).
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Tämä on synteettisen selainprototyypin näyttöä. Se **ei** testaa host-backed labia, oikeaa GitHub-hakua, brokeria tai UID-eristystä. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-aloitus-6/` (`access.tsx` välilehti, `chooser.tsx` ehdotettu valitsin). Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-aloitus-6/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-aloitus-6/check.mjs \
  design-system/prototypes/dist/admin-onboarding-r6-space/offline.html /var/tmp/admin-onboarding-r6-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 5 · Repot

**Suositus: Tapa ja lista.** Ylläpitäjä valitsee repojen aloitustavan samanlaisella kolmen kohdan valitsimella kuin AI-tilin *Kolme tapaa*: *Esivalitse / Hae automaattisesti / Ohita vaihe*. Sen alla on yksi oletusrepojen lista, joka on sama kaikissa tavoissa. Vain listan otsikko kertoo, mitä repoille tapahtuu (*Esivalitut repot*, *Automaattisesti haettavat repot* tai *Taustalla tuotavat repot*). Henkilö näkee taustalla haettavat repot nimeltä reitin Repot-rivillä, jossa haun edistyminen jo kierroksella 4 sovittiin näkyväksi. Suosittelen tätä, koska tapa ja lista ovat erillisiä päätöksiä. Kun tapaa vaihtaa, lista pysyy ennallaan, ja ohitustilassakin oletusrepot ovat samassa paikassa. Repojen nimet reitillä kertovat henkilölle, mitä sivusto tekee, ilman uutta osaa korttiin.

**[Avaa kierros 5](https://glasspad.example.test/p/eiccjybwfpgcnjub7agb56t5kq/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä.

### Mikä on sovittu ja näkyy sellaisenaan

- Välilehdet ovat Asetusten *Palvelimen ylläpito* -ryhmässä: *Palvelin*, *Käyttöönotto* ja *Käyttäjät ja pääsy*. Puhelimessa ne näkyvät painikerivinä sisällön yllä. Käyttöönoton sivu on *Lista reittinä*: vasemmalla reitti, oikealla valitun vaiheen asetukset. Kierroksessa 5 vain Repot-rivi on muokattavissa.
- Esikatselutila on kierroksen 4 suunta 2. Kierroksen 4 sivulla *Näytä henkilön näkymä* oli yhteenvetokortissa asetusten alla. Nyt painike on Käyttöönotto-välilehden otsikkorivillä ja aina näkyvissä, valitusta vaiheesta riippumatta. Puhelimessa se on otsikon alla koko levyisenä. Painike avaa koko ruudun esikatselun, jossa asetukset ovat sivupaneelissa. Puhelinleveydellä esikatselu täyttää ruudun, ja yläpalkista jää pois selitysteksti, jotta palkki mahtuu.
- Henkilön repovaihe on tuotannon `GitHubRepoChooser` muuttamattomana: haku, aikaväli, *Valitse kaikki näkyvät*, valintojen määrä ja *Jatka ilman repoja*. Sen jälkeen tulevat Google-vaihe ja AI-vaihe *Ehdotus ja lista* kierroksesta 4 sellaisenaan.
- Ylläpitäjä lisää oletusrepon tuotannon `RepoFinder`-valitsimella, joka on sama kuin uuden työtilan haussa. Valitsimessa voi selata, hakea ja kirjoittaa nimen muodossa `omistaja/repo`. Tuntemattomasta nimestä näkyy tuotannon teksti "Repoa ei ole". Jokaisen oletusrepon voi poistaa omalla painikkeellaan. Vanhentuneiden repojen suodatinta ei ole.

### Miten oletusrepot näkyvät henkilölle kussakin tavassa

| Tapa | Henkilön repovaihe | Reitin Repot-rivi |
| --- | --- | --- |
| **Esivalitse** | Valitsin avautuu, ja oletusrepot on valittu valmiiksi. Henkilö voi poistaa valinnan ja valita muita. Kortin alla lukee "Sivusto on valinnut valmiiksi 3 repoa". | Ensin "Nyt". Jatkamisen jälkeen "Haetaan 2 repoa", palkki ja nimet. |
| **Hae automaattisesti** | Oletusrepojen haku alkaa heti GitHub-kirjautumisen jälkeen, eikä niitä tarjota valitsimessa uudelleen. Valitsimessa ovat vain muut repot. Kortin alla lukee "Sivusto hakee sinulle jo 2 repoa. Valitse tästä vain lisää." | Jo valitsimen aikana "Nyt · 2 haussa", palkki ja nimet. Henkilön omat valinnat lisätään samaan joukkoon. |
| **Ohita vaihe**, oletusrepoja on | Repovaihetta ei ole. Henkilö aloittaa Googlesta. | Rivi on reitillä merkkinä siitä, mitä sivusto tekee. Sen pallossa on päivityskuvake ja katkoviiva, teksti on "Sivusto hakee 3 repoa", ja palkki sekä nimet ovat mukana. Rivi ei ole vaihe, eikä siihen voi siirtyä. |
| **Ohita vaihe**, oletusrepoja ei ole | Repovaihetta ei ole. | Riviä ei ole: reitti on GitHub → Google → AI-tili. |

### Kun henkilöllä ei ole pääsyä oletusrepoon

**Ehdotus: repo jää henkilöltä pois näkymättä, ja ylläpitäjä näkee asian.** Henkilön repolista luetaan hänen omalla GitHub-tilillään, joten repo, johon hänellä ei ole pääsyä, ei ole listassa. Siksi sitä ei esivalita, ei haeta eikä lasketa reitin lukuun, eikä sen nimeä näytetä hänelle missään. Virhettä ei näytetä kahdesta syystä. Ensinnäkin henkilö ei voi korjata pääsyä itse. Toiseksi virhe paljastaisi yksityisen repon nimen ihmiselle, jolla ei ole siihen oikeutta. Ylläpitäjä näkee tuloksen *Käyttäjät ja pääsy* -välilehden käyttäjälistassa, esimerkiksi "2/3 oletusrepoa haettu. Ei pääsyä: `northstar-demo/infra`". Asetuksissa on tästä yksi selittävä rivi oletusrepojen alla.

Tämä korvaa kierroksen 2 oletuksen ("automaattisessa haussa puuttuva oikeus näkyy virheenä"). Virhe näytetään henkilölle vain silloin, kun hänellä on pääsy mutta haku epäonnistuu. Silloin tuotannon `OnboardingClones` näyttää epäonnistuneen haun ja tarjoaa uudelleenyrityksen.

Esikatselun sivupaneelissa on valinta *Esikatsele henkilönä: Pääsy kaikkiin / Ei pääsyä: infra*. Sillä voi kokeilla, miltä kumpikin tilanne näyttää kaikissa tavoissa.

### Suunnat

Kaksi avointa valintaa, kolme suuntaa. Jokainen suunta yhdistää yhden ylläpitäjän esitystavan ja yhden tavan kertoa henkilölle taustalla haettavista repoista. Edistymispalkki on reitillä kaikissa suunnissa, kuten sovittiin.

| Suunta | Ylläpitäjä: tapa ja oletusrepot | Henkilö: mistä hän näkee haettavat repot | Hyöty ja hinta |
| --- | --- | --- | --- |
| **1. Tapa ja lista** (suositus) | Kolmen kohdan valitsin, jonka alla yksi lista. Listan otsikko ja yhden rivin ohje vaihtuvat tavan mukaan. | **Nimet reitillä:** Repot-rivillä on palkki ja sen alla jokainen repo lyhyellä nimellä ja tilalla ("product 42 %", "docs jonossa"). | Sama rakenne kuin AI-tilillä. Henkilö näkee aina, mitä tapahtuu. Pitkä lista pidentää reittiä, ja puhelimessa reitti on kahdessa sarakkeessa. |
| **2. Repot ensin** | Ensin *Sivuston oletusrepot*, sitten *Miten ne tarjotaan uudelle henkilölle*: kolme valintariviä, joissa jokaisessa on seurauksen kuvaus. | **Nimet kortin alla:** reitillä on vain palkki ja luku. Nimet näkyvät tuotannon `OnboardingClones`-listana vaiheen kortin alla siinä vaiheessa, jossa henkilö on. | Kertoo selvimmin, että lista on yksi ja tapa on sen ominaisuus. Henkilön puolella se on lähimpänä nykyistä tuotantoa, mutta kortin alle tulee taas repo-osa, josta Jari ei kierroksella 3 pitänyt. |
| **3. Tapa korttina** | Kolme valintakorttia. Valitun kortin sisällä on lista otsikolla, joka sopii juuri siihen tapaan. | **Nimet reitin takana:** reitillä on palkki, luku ja linkki *Näytä 3 repoa*, joka avaa nimet reitille. | Tapa ja sen repot näkyvät yhtenä kokonaisuutena. Lista kuitenkin siirtyy, kun tapaa vaihtaa, ja muiden korttien sisältö jää piiloon. Henkilöltä nimet vaativat klikkauksen. |

### Tuotantoon tarvittavat muutokset (ehdotuksia, ei vielä tehty)

- **`GitHubRepoChooser` automaattisessa haussa.** Painikkeen teksti on nyt "Jatka ilman repoja", vaikka sivuston repoja haetaan jo. Prototyyppi näyttää tuotannon tekstin muuttamattomana ja kertoo kortin alla, ettei jatkaminen peru hakua. Toteutuksessa valitsin tarvitsee tiedon jo haussa olevista, jotta painike voi sanoa "Jatka" tai "Hae 1 repo lisää ja jatka".
- **`OnboardingFrame`n reittirivi** saa haettavat repot (`clones`) ja tilan *sivusto tekee* (`auto`), joka ei ole vaihe. Prototyypin `frame.tsx` on tuotannon kehys näillä lisäyksillä. Rakennus ohjaa tuotannon valitsimen kehyksen tuonnin siihen, joten itse valitsinta ei ole muutettu. Lisäksi isäntänimi tulee kehykselle propsina eikä `window.location`ista, kuten kierroksella 4 ehdotettiin.
- **Ohitustila oletusrepoilla** tarkoittaa, että daemon aloittaa haun ilman henkilön valintaa heti kirjautumisen jälkeen ja tarkistaa pääsyn henkilön omalla GitHub-tunnuksella. Haku on sama kuin automaattisessa tavassa, mutta valitsinta ei näytetä. Missä oletuslista säilyy ja kuka käynnistää haun, ratkaistaan `plan-site-onboarding-authority`-suunnitelmassa.
- **Pois jäänyt oletusrepo** näkyy ylläpitäjälle käyttäjälistassa. Se vaatii, että käyttöönoton tulos tallentuu henkilön tietoihin niin, että ylläpitäjä voi lukea sen. Tämäkin kuuluu auktoriteettisuunnitelmaan.

### Kokeile

1. Suunta 1: *Näytä henkilön näkymä*. Esivalinnassa kolme repoa on valittu. Vaihda sivupaneelista *Ei pääsyä: infra*: infra katoaa, ja valittuja on 2. Poista yksi valinta ja jatka. Repot-rivillä on palkki ja nimi.
2. Vaihda tavaksi *Hae automaattisesti*: valitsimessa ovat vain muut repot, ja reitillä näkyy "Nyt · 2 haussa". Valitse `docs` ja jatka. Haettavia on nyt 3.
3. Vaihda tavaksi *Ohita vaihe*: henkilö aloittaa Googlesta, ja reitillä näkyy "Sivusto hakee 3 repoa". Poista kaikki oletusrepot: Repot katoaa reitiltä.
4. Lisää oletusrepo valitsimella: kirjoita `northstar-labs/research` tai olematon nimi.
5. Suunnat 2 ja 3: vertaa ylläpitäjän puolta ja sitä, mistä henkilö näkee repojen nimet.
6. Avaa *Käyttäjät ja pääsy*: `@teppo-esim` jäi ilman infraa.

### Kysymykset Jarille

1. **Valitaanko Tapa ja lista ja nimet reitillä?** Vai jokin muu yhdistelmä, esimerkiksi suunnan 3 *Näytä 3 repoa* suunnan 1 asetuksiin?
2. **Puuttuva pääsy:** sopiiko, että repo jää henkilöltä pois näkymättä ja vain ylläpitäjä näkee sen?
3. **Automaattinen haku valitsimessa:** jätetäänkö jo haussa olevat repot pois valitsimesta, kuten nyt, vai näytetäänkö ne lukittuina valittuina riveinä? Lukitut rivit vaatisivat valitsimeen uuden tilan, eikä tuotannon valitsin silloin enää olisi muuttamaton.
4. **Ohitus ilman oletusrepoja:** katoaako Repot reitiltä kokonaan, kuten nyt, vai jääkö rivi "Ohitettu · hae myöhemmin työtiloista"?

### Oletukset, ei toteutuspäätöksiä

- Sanasto on `onboarding.repositories = {mode: preselected | auto | skip, defaults: [omistaja/repo]}`. Oletuslista säilyy myös ohitustilassa. Tämä ei ole lukittu skeema.
- Esikatselu näyttää haun yhtenä hetkenä: ensimmäinen repo on 42 %:ssa ja loput jonossa. Haku ei etene.
- Esikatselu aloittaa alusta, kun asetus tai esikatseltava henkilö vaihtuu. Lisäksi palkissa on *Aloita alusta*.
- Muutos koskee seuraavaa uutta käyttöönottoa. Jo liittyneet eivät muutu.

### Näyttö

Kierroksen 5 [evidence](evidence/) on `r5-`-alkuisissa tiedostoissa. Jokainen on kuvakaappaus/staattinen HTML -pari:

- `r5-settings-*`: asetussivu kaikista suunnista 1440 px:n leveydellä vaaleana ja 390 px:n leveydellä tummana.
- `r5-pre-*`: esivalinta.
- `r5-pre-ai-1-*`: AI-vaihe, jossa haku näkyy reitillä.
- `r5-auto-chooser-*`: automaattinen haku valitsimen aikana, kaikki suunnat.
- `r5-auto-2-*`: nimet kortin alla.
- `r5-skip-*`: ohitus.
- `r5-finder-*`: ylläpitäjän repovalitsin.

Tarkistukset:

- `check.mjs` (Playwright `web/node_modules`ista): 108 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja teemoilla. Mukana ovat yhteinen `picker-check.mjs`, valitsimen näppäimet ja URL-valinta, välilehdet ja käyttäjälistan pois jäänyt repo, oletusrepon lisäys hakemalla nimellä ja tuntematon nimi, poisto, esikatselutilan avaus otsikkorivin painikkeesta ja sulku, esivalitut valintaruudut, ilman pääsyä -henkilö (infra ei näy missään), jatkaminen ja reitin palkki, nimet kunkin suunnan paikassa, AI-vaiheen yksi otsikko ja repo-osan puuttuminen kortista, automaattisen haun valitsin ilman haettavia, ohitus reittimerkintöineen, ohitus ilman oletusrepoja, laitteen vaihto, peruutus ja tallennus. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos on `evidence/r5-checks.json`.
- Sama tarkistus julkaistulla Glasspad-sivulla: `evidence/r5-hosted-checks.json` (108 tarkistuspistettä).
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Tämä on synteettisen selainprototyypin näyttöä. Se **ei** testaa host-backed labia, oikeaa GitHub-pääsyä tai UID-eristystä. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-5/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-5/build.mjs
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-5/check.mjs \
  design-system/prototypes/dist/admin-onboarding-r5-space/offline.html /var/tmp/admin-onboarding-r5-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 4 · Esikatselu ja AI-vaihe

**Suositus: Ikkuna vieressä.** Henkilön näkymä on koko ajan asetusten vieressä omana selainikkunanaan: musta merkki *Henkilön näkymä*, osoiterivi `habitat.example.test/aloitus`, katkoviivainen tausta ja valinta *Tietokone / Puhelin*. Ylläpitäjän puoli on vasemmalla otsikolla *Sinun asetuksesi*. Näin ei jää epäselväksi, kumpi osa on ylläpitäjän ja kumpi henkilön ruutu, ja jokainen asetusmuutos näkyy ikkunassa heti ilman lisäklikkausta. Henkilön AI-vaiheeseen suosittelen samaa suunnan 1 asettelua *Ehdotus ja lista*, ja repojen haun edistymistä reitin Repot-rivillä. Suunnan osat voi myös yhdistellä toisin, esimerkiksi suunnan 1 ikkunan suunnan 3 AI-vaiheeseen.

**[Avaa kierros 4](https://glasspad.example.test/p/lpjcp6fbpdferog7plpctqvqj4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä, eikä avaimia lähetetä minnekään.

### Välilehdet

Jarin lisäyksen mukaan *Käyttöönotto* on Asetusten oma välilehti, eikä se ole enää Palvelin-välilehdellä. *Käyttäjät ja pääsy* on toinen oma välilehti: siinä ovat sallitut GitHub-tunnukset (lisäys ja poisto) ja käyttäjälista Unix-käyttäjineen. *Palvelin* näyttää vain yleiset tiedot. Puhelimessa välilehdet ovat sisällön yllä painikeriveinä. Ylläpitäjän AI-asetus on kierroksen 3 valittu *Kolme tapaa*: *Henkilö valitsee / Oletus / Sivuston avain*.

### Suunnat

Jokainen suunta yhdistää yhden esikatselun esitystavan, yhden AI-vaiheen asettelun ja yhden paikan repojen haun edistymiselle.

| Suunta | Esikatselu | Henkilön AI-vaihe | Repojen haku | Hyöty ja hinta |
| --- | --- | --- | --- | --- |
| **1. Ikkuna vieressä** (suositus) | Selainikkuna aina asetusten vieressä. Leveydellä 1440 se näkyy luonnollisessa koossa. Kapeassa sarakkeessa tietokonenäkymä pienennetään ja pienennys kerrotaan prosentteina. Puhelin näkyy omassa kehyksessään. | **Ehdotus ja lista:** yksi otsikko, ja vaihtoehdot ovat yhden listan rivejä. Valittu rivi aukeaa paikallaan, ja kirjautuminen tai avainkenttä on sen sisällä tekstin kanssa samassa linjassa. Oletuksella näkyy vain ehdotettu rivi. *› Käytä muuta AI-palvelua* avaa ryhmät *Tilaus* ja *API-avain · maksu käytön mukaan*. Kolme avainta ovat kiinni ollessaan yksirivisiä. | Reitin Repot-rivillä palkki ja "Haetaan 42 %". | Seuraus näkyy aina ja koko reitti mukana. Vaatii leveyttä, joten kapeassa näkymässä ikkuna on asetusten alla. |
| **2. Esikatselutila** | Asetussivulla on yhteenveto ja painike *Näytä henkilön näkymä*. Painike avaa koko ruudun tilan, jossa yläreunan palkki sanoo "Esikatselu · mitään ei tallenneta" ja asetukset ovat sivupaneelissa. Muutokset näkyvät heti. | **Tapa ja palvelu:** oletuksella vain ehdotettu kirjautuminen ja merkki *Sivuston ehdotus*. Valinta avaa tuotannon `Segmented`-valitsimen *ChatGPT / Claude / API-avain*. Kolmella avaimella on yksi kenttä, ja palvelu valitaan toisella valitsimella *OpenAI / Anthropic / DeepSeek*. | Kehyksen yläpalkissa "Repot haussa · 42 %". | Rauhallisin asetussivu ja tiivein avainosa. Seuraus jää kuitenkin klikkauksen taakse, ja se oli kierrosten 1 ja 2 hylätty heikkous. |
| **3. Merkitty puhelin** | Esikatselu on oletuksena puhelinkehyksessä. Numerot ①②③ yhdistävät asetuksen siihen kohtaan, jota se muuttaa henkilön näkymässä: tavan reitin AI-tili-vaiheeseen, oletuksen otsikkoon ja muut palvelut linkkiin. Kun osoitin on asetuksen päällä, sen kohta korostuu esikatselussa. | **Yksi kerrallaan:** otsikko nimeää palvelun ("Kirjaudu: ChatGPT-tilaus"). Muut palvelut ovat rivilistana, jossa jokaisella on *Valitse*, ja valinta vaihtaa vaiheen. *‹ Palaa sivuston ehdotukseen* tuo ehdotuksen takaisin. | Kortin alla tuotannon `notice`-paikalla: "Taustalla haetaan northstar-demo/product · 42 %". | Selittää parhaiten, mitä kukin asetus tekee. Numerot ovat kuitenkin lisäkerros, josta on hyötyä vain ensimmäisellä kerralla. |

### Mitä henkilön AI-vaiheessa korjattiin

Kuvakaappauksen virheet johtuvat siitä, että tuotannon `ClaudeSignIn` ja `PiCredentials` käyttävät asetussivun `.s-row`-ruudukkoa: otsikko on vasemmalla ja tila ja painike oikealla. Kortissa rivi taittuu, ja tila ja painike jäävät oikealle irti otsikostaan. Prototyypissä vaihe on rakennettu uudelleen tuotannon tokeneilla ja osilla (`OnboardingFrame`n moduuli-CSS, `PiDeviceSignIn`in numeroidut askeleet, `ControlButton`, `Segmented`, `StatusMark`):

- **Yksi otsikko:** vaiheella on yksi `h1` (koko `--ah-size-h2`). Kirjautumiset eivät tuo omaa otsikkoaan tai yläotsikkoaan.
- **Kaikki vasemmassa reunassa:** tila, ohje ja painikkeet ovat otsikon alla samassa linjassa. Painikkeet ovat rivissä vasemmalla, eivätkä ne kellu oikealla.
- **Repojen haku pois kortista:** edistyminen näkyy suunnasta riippuen reitillä, kehyksen yläpalkissa tai kortin alla.
- **Avaimet tiiviisti:** OpenAI, Anthropic ja DeepSeek ovat yksirivisiä rivejä (suunnat 1 ja 3) tai yksi kenttä palveluvalinnalla (suunta 2). Avainkentässä on *Tallenna* samalla rivillä, muodon tarkistus ja tieto siitä, kuka laskuttaa.

Tuotantoon tämä tarkoittaisi seuraavia muutoksia (ehdotuksia, ei vielä tehty):

- `PiOnboarding` omistaa vaiheen otsikon, ja `OnboardingClones` siirtyy pois kortista.
- `PiDeviceSignIn` saa upotettuna tilan ilman omaa yläotsikkoa ja `h1`:tä.
- `ClaudeSignIn` saa käyttöönottoon pinotun muodon, jossa on samat numeroidut askeleet kuin OpenAI-kirjautumisessa.
- `PiCredentials` saa palvelun parametrina (vaatii kierroksen 3 tuotantotyön Anthropic- ja DeepSeek-avaimille) ja tiiviin kenttä + *Tallenna* -muodon.
- `OnboardingFrame`n reittivaihe saa edistymän (`progress`), jos suunta 1 valitaan, ja isäntänimen propsina, koska esikatselu ei voi lukea sitä `window.location`ista.

### Kokeile

1. Suunta 1: oletus on ChatGPT-tilaus. Kirjaudu ja simuloi hyväksyntä. Avaa *› Käytä muuta AI-palvelua* ja lisää DeepSeek-avain sen riviltä. Vaihda ikkuna puhelimeksi.
2. Vaihda asetuksista oletukseksi Claude-tilaus, sitten *Henkilö valitsee* ja lopuksi *Sivuston avain* (`sk-ant-…`-avain Anthropicille): AI-tili katoaa reitiltä ja Google on viimeinen vaihe. Palaa *Oletukseen* vahvistuksella.
3. Suunta 2: *Näytä henkilön näkymä*, muuta asetusta sivupaneelista ja katso, miten esikatselu muuttuu. Kokeile *API-avain*-valintaa ja palvelun vaihtoa.
4. Suunta 3: vie osoitin numeroidun asetuksen päälle. Valitse listasta toinen palvelu ja palaa ehdotukseen.
5. Avaa *Käyttäjät ja pääsy* ja lisää GitHub-tunnus.

### Kysymykset Jarille

1. **Valitaanko Ikkuna vieressä ja Ehdotus ja lista?** Vai jokin muu yhdistelmä, esimerkiksi suunnan 3 numerot suunnan 1 ikkunaan?
2. **Missä repojen haku näkyy AI-vaiheen aikana:** reitin Repot-rivillä (suositus), kehyksen yläpalkissa vai kortin alla?
3. **Käyttäjät ja pääsy:** sopiiko, että sallitut GitHub-tunnukset ja käyttäjälista ovat samalla välilehdellä?
4. **Nimet henkilölle:** prototyyppi käyttää nimiä *ChatGPT-tilaus* ja *Claude-tilaus* (kierroksessa 3 *ChatGPT / OpenAI*). Kelpaavatko ne?

### Oletukset, ei toteutuspäätöksiä

- Henkilön kirjautumiset ovat prototyypin simulaatioita samassa muodossa kuin tuotannon kulku (OpenAI-laitekoodi, Claude-koodi takaisin). Niitä ei ole kytketty tuotannon komponentteihin, koska tämä kierros ehdottaa niihin rakennemuutosta.
- Sivuston avaimen säilytys ja jakelu ovat yhä auki `plan-site-onboarding-authority`-suunnitelmassa. Prototyyppi ei lähetä avainta minnekään.
- Esikatselu näyttää henkilön tilanteessa, jossa GitHub, Repot ja Google on käyty ja yksi repo on haussa.

### Näyttö

Kierroksen 4 [evidence](evidence/) on `r4-`-alkuisissa tiedostoissa: `r4-others-*` (muut palvelut auki ja avain lisätty), `r4-key-*` (sivuston avain, AI-tili poissa reitiltä) 1440 px:n ja 390 px:n leveydellä vaaleana ja tummana, `r4-all-1-*` (Henkilö valitsee) ja `r4-device-*-1440-light` (laitteen vaihto). Jokainen on kuvakaappaus/staattinen HTML -pari, ja HTML:istä on poistettu upotetut fontit ja salasanakenttien arvot.

- `check.mjs` (Playwright `web/node_modules`ista): 60 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja teemoilla. Mukana ovat yhteinen `picker-check.mjs`, valitsimen näppäimet ja URL-valinta, välilehdet, vain oletuksen näkyminen, yksi otsikko kortissa, repojen haku kortin ulkopuolella, OpenAI- ja Claude-kirjautumisen simulointi, kolme avainriviä ja avainten tallennus, laitteen vaihto, *Henkilö valitsee*, sivuston avaimen virheellinen muoto, käyttöönotto ja poisto vahvistuksella, esikatselutilan avaus ja sulku, merkintöjen korostus sekä tallennus. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos on `evidence/r4-checks.json`.
- Sama tarkistus julkaistulla Glasspad-sivulla: `evidence/r4-hosted-checks.json` (60 tarkistuspistettä). Tarkistukseen lisättiin odotus iframen uudelleenlataukselle, koska ensimmäinen ajo luki vanhaa dokumenttia ennen latausta.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Tämä on synteettisen selainprototyypin näyttöä. Se **ei** testaa host-backed labia, oikeita tunnuksia tai UID-eristystä. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-4/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-4/build.mjs
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-4/check.mjs \
  design-system/prototypes/dist/admin-onboarding-r4-space/offline.html /var/tmp/admin-onboarding-r4-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 3 · AI-tili

**Suositus: Avain erikseen.** Ylläpitäjä valitsee AI-tilin vaiheessa ensin, mitä tarjotaan: ei oletusta tai yksi viidestä vaihtoehdosta. Sen alla on oma osio *Sivuston API-avain*. Kun avain on annettu, oletusvalinta himmenee ("Ei käytössä, koska sivusto antaa avaimen") ja AI-tili katoaa henkilön reitiltä. Uusi henkilö näkee oletuksen kohdalla vain sen yhden vaihtoehdon, ja muut ovat alareunan linkin *› Käytä muuta AI-palvelua* takana samassa muodossa kuin tuotannossa nyt. Suosittelen tätä, koska oletus ja avain ovat eri asioita. Oletus on luonnoksen asetus, joka tallennetaan muiden kanssa. Avain taas on salaisuus, joka otetaan käyttöön ja poistetaan heti omalla toiminnollaan. Kun ne ovat erillään, kumpikaan ei piilota toista: poistetun avaimen jälkeen aiempi oletus palaa voimaan sellaisenaan.

**[Avaa kierros 3](https://glasspad.example.test/p/2vk2gkcroprzixhgitdlsu7dz4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä, eikä avainta lähetetä minnekään.

Sivun yleisilme on kierroksen 2 *Lista reittinä*, kuten sovittiin: vasemmalla reittilista ja oikealla valitun vaiheen asetukset, joiden alla on henkilön näkymä. Vain AI-tilin rivi on muokattavissa. Henkilön näkymä on nyt **tuotannon Kartta-kehys** (`OnboardingFrame` + `OnboardingRoute`) samassa tilassa kuin testikoneella: GitHub ✓, Repot ✓ "1 repo haussa", Google ohitettu ja AI-tili nyt. Vaiheen sisältö on tuotannon `PiDeviceSignIn`, `ClaudeSignIn`, `PiCredentials` ja `OnboardingClones`.

### Suunnat

Kaksi avointa valintaa, kolme suuntaa: suunnat 1 ja 2 eroavat vain ylläpitäjän puolelta, suunnat 2 ja 3 vain henkilön puolelta.

| Suunta | Ylläpitäjä: sivuston avain | Henkilö: › Käytä muuta AI-palvelua | Hyöty ja hinta |
| --- | --- | --- | --- |
| **1. Avain erikseen** (suositus) | Oma osio oletusvalinnan alla. Avain ohittaa oletuksen, joka näkyy himmennettynä. | Avaa tuotannon valinnat ilman oletusta: tilaukset vaihtopainikkeina ja API-avaimet yhden avattavan kohdan alla. | Molemmat asetukset näkyvät aina. Avaimen poisto palauttaa vanhan oletuksen. Sivu on hieman pidempi. |
| **2. Kolme tapaa** | Yksi valinta: *Henkilö valitsee / Oletus / Sivuston avain*. Avain on tapa muiden rinnalla. | Kuten 1. | Lyhin ja selkein yksi päätös. Kun avain on käytössä ja valitaan *Henkilö valitsee* tai *Oletus*, avain pitää ensin poistaa (vahvistus). Tapa ja salaisuus sotkeutuvat: *Sivuston avain* -tapa ilman tallennettua avainta ei vielä tee mitään. |
| **3. Muut listana** | Kuten 2. | Muut palvelut ovat rivilistana (nimi, lyhyt kuvaus, *Valitse*). Valinta vaihtaa vaiheen sisällön, ja *‹ Palaa sivuston ehdotukseen* tuo oletuksen takaisin. | Rauhallisempi ja yhtenäinen viidelle vaihtoehdolle. Poikkeaa nykyisestä tuotannon valintamallista, ja jokainen vaihto on yksi klikkaus lisää. |

### Mitä kierros näyttää

- **Viisi vaihtoehtoa:** *ChatGPT / OpenAI* (kirjautuminen), *Claude-tilaus*, *OpenAI API-avain*, *Anthropic API-avain* ja *DeepSeek API-avain*. Ilman oletusta henkilö näkee tuotannon nykyisen valinnan, ja sen avattava kohta on nyt *Käytä API-avainta tilauksen sijaan*, jossa on kolme avainriviä.
- **Oletus:** henkilölle näytetään vain oletuksen oma kirjautuminen tai avainrivi. Kirjautumiskomponenteissa on jo otsikko ("Kirjaudu OpenAI-tiliisi", "Kirjaudu Claude-tiliisi"), joten niiden yllä on vain lyhyt rivi "Sivusto ehdottaa tätä AI-tiliä". Avaimelle tulee oma otsikko.
- **Sivuston avain:** ylläpitäjä valitsee palvelun (OpenAI, Anthropic tai DeepSeek) ja liittää avaimen salasanakenttään. Muodon tarkistus kertoo, jos avain ei näytä valitun palvelun avaimelta. Tallennuksen jälkeen näkyy vain loppuosa (`sk-ant-…abcd`) sekä *Vaihda avain…* ja *Poista avain…*. Poisto vahvistetaan, eikä se peru avainta palvelussa. Reittilistan AI-tili-rivi muuttuu muotoon "– Ohitetaan · sivuston Anthropic-avain". Esikatselu näyttää henkilön reitin GitHub → Repot → Google, jossa Google on viimeinen vaihe ("Seuraavaksi avautuvat työtilat").
- **Ei toteutuslupauksia:** avainosion alla lukee "Prototyyppi ei lähetä avainta minnekään. Missä sivuston avain säilyy ja miten se tulee kunkin henkilön käyttöön, on vielä päättämättä." Sivu ei väitä, että avain tallennettaisiin selaimeen, palvelimelle tai henkilön Pi-tunnuksiin.

### Avoin arkkitehtuurikysymys

**Missä ylläpitäjän antama API-avain säilyy ja miten se tulee kunkin Unix-käyttäjän agenttien käyttöön, on avoin kysymys suunnitelmassa `plan-site-onboarding-authority`.** Prototyyppi ei päätä sitä. Vaihtoehtoja ovat esimerkiksi kopio jokaisen henkilön Pi-tunnuksiin ensimmäisellä kirjautumisella, jaettu ympäristömuuttuja tai välityspalvelu, ja jokaisella on oma hintansa: avainta voi lukea jokainen käyttäjä, kierto on vaikeaa ja auktoriteetti siirtyy uuteen paikkaan. Unix-käyttäjä on turvaraja, joten jaettu salaisuus kaikkien henkilöiden kesken on juuri sellainen asia, josta päätetään yhdessä. Samaan suunnitelmaan kuuluu, koskeeko avain vain uusia henkilöitä vai myös jo liittyneitä ja mitä avaimen poisto tekee heidän keskusteluilleen.

### Tuotantotyö, jota vaihtoehdot vaativat

Pi tukee natiivisti sekä Anthropicin (`ANTHROPIC_API_KEY`) että DeepSeekin (`DEEPSEEK_API_KEY`) avaimia (`pi --help`). Open Habitat tukee nyt vain OpenAI-avainta. Sopimus `contracts/v1/pi-credentials.schema.json` tuntee vain `openai`-avaimen, daemonin `pi_credentials_linux.go` hyväksyy vain `provider: "openai"` ja `sk-`-muodon, ja keskustelun ja ensimmäisen mallivalinnan palveluntarjoajalista on `openai-codex | openai | claude-bridge`. Anthropic- ja DeepSeek-avaimet tarvitsevat siis sopimuksen, daemonin, mallilistan ja mallivalitsimen muutokset. Prototyypissä niiden avainrivi on `PiCredentials`in merkinnän kopio, ja ylläpitäjän listalla ne on merkitty "ei vielä tuotannossa". Myös avattavan kohdan otsikko muuttuu kolmen avaimen myötä.

### Kokeile

1. Suunnassa 1 oletus on *ChatGPT / OpenAI*: esikatselussa on vain OpenAI-kirjautuminen. Avaa *› Käytä muuta AI-palvelua*, jolloin näkyvät Claude ja kolme avainta. Vaihda oletukseksi *Claude-tilaus* tai *DeepSeek API-avain* ja lisää avain esikatselussa.
2. Valitse *Ei oletusta*: henkilö näkee kaikki vaihtoehdot, kuten nyt.
3. Valitse *Anna API-avain…*, kirjoita väärän muotoinen avain, vaihda palveluksi Anthropic ja anna `sk-ant-…`-avain. AI-tili katoaa reitiltä ja oletus himmenee. Vaihda avain DeepSeekiin ja poista se vahvistuksella: oletus palaa.
4. Suunnassa 2 tee sama *Sivuston avain* -valinnalla. Kokeile siirtymistä takaisin *Oletukseen*, kun avain on käytössä. Suunnassa 3 valitse listasta toinen palvelu ja palaa ehdotukseen.

### Kysymykset Jarille

1. **Valitaanko Avain erikseen** (vai *Kolme tapaa*) ylläpitäjän puolelle, ja **samat valinnat** (vai *Muut listana*) henkilön puolelle?
2. **Kuka maksaa ja kenen tilillä?** Sivuston avain tarkoittaa, että kaikkien uusien henkilöiden käyttö laskutetaan ylläpitäjän tililtä. Pitääkö henkilön silti voida lisätä oma tilinsä myöhemmin asetuksissa? Prototyyppi olettaa, että voi.
3. **Koskeeko avain jo liittyneitä?** Prototyyppi muuttaa vain seuraavaa käyttöönottoa. Päätös kuuluu yhdessä avaimen säilytyksen kanssa `plan-site-onboarding-authority`-suunnitelmaan.
4. **Anthropic- ja DeepSeek-avaimet** vaativat tuotantotyötä (sopimus, daemon, mallilista). Tehdäänkö se erillisenä työnä ennen ylläpidon asetuksia, vai riittääkö ensimmäiseen versioon OpenAI-avain?

### Oletukset, ei toteutuspäätöksiä

- Sanasto on `onboarding.ai_account.offer` (`all` tai jokin viidestä vaihtoehdosta) ja `onboarding.ai_account.site_key` (palvelu ja olemassaolo, ei koskaan itse avain). Tämä on esimerkki eikä lukittu skeema.
- Avain lähetetään kerran eikä sitä näytetä uudelleen, kuten tuotannon `PiCredentials`issa. Avainta ei pidetä luonnoksessa.
- Muodon tarkistus on prototyypin oma: `sk-` OpenAIlle ja DeepSeekille, `sk-ant-` Anthropicille. Palvelulta ei tarkisteta, että avain toimii.

### Näyttö

Kierroksen 3 [evidence](evidence/) on `r3-`-alkuisissa tiedostoissa. Jokaisesta suunnasta on 1440 px:n ja 390 px:n leveys vaaleana ja tummana: `r3-offer-*` (oletus ja muut palvelut auki), `r3-key-*` (sivuston avain ja reitti ilman AI-tiliä) sekä `r3-all-1-*` (ei oletusta). Jokainen on kuvakaappaus/staattinen HTML -pari, ja HTML:istä on poistettu upotetut fontit ja salasanakenttien arvot.

- `check.mjs` (Playwright `web/node_modules`ista, Aldern Playwright-Chromium): 48 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja teemoilla. Mukana on yhteinen `picker-check.mjs`, valitsimen näppäimet (1–3, nuolet, R ja kenttien ohitus), URL-valinnan säilyminen uudelleenlatauksessa, vain oletuksen näkyminen, muiden palveluiden avaus kummassakin muodossa, OpenAI-kirjautumisen simulointi, Claude- ja DeepSeek-oletus, *Ei oletusta*, sivuston avaimen virheellinen muoto, käyttöönotto, korvaus ja poisto (suunnissa 2–3 myös tavan vaihdon vahvistus ja peruutus), reitin vaiheet ennen ja jälkeen sekä tallennus ja peruutus. Ei konsoli- tai JavaScript-virheitä eikä vaakaylivuotoa. Tulos on `evidence/r3-checks.json`.
- Sama tarkistus julkaistussa Glasspad-sandboxissa: `evidence/r3-hosted-checks.json` (48 tarkistuspistettä). Sandbox estää lomakkeen lähetyksen, joten prototyypin omat tallennuspainikkeet toimivat painalluksella. Tuotannon `PiCredentials` tallentaa vain lomakkeen lähetyksellä, joten henkilön oma OpenAI-avain ei tallennu hosted-sivulla. Paikallisessa HTML:ssä se tallentuu.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi rakennetun sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.
- Tuotannon kehys näyttää osoiterivinä sivun oman osoitteen (`prototype.test`; Glasspadissa tyhjä), koska `OnboardingFrame` lukee sen `window.location`ista.

Tämä on selaimessa toimivan synteettisen prototyypin näyttöä. Se **ei** testaa host-backed labia, oikeita tunnuksia tai UID-eristystä. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-3/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-3/build.mjs
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-3/check.mjs \
  design-system/prototypes/dist/admin-onboarding-r3-space/offline.html /var/tmp/admin-onboarding-r3-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 2

**Suositus: Kartta vieressä.** Ylläpitäjä muokkaa vaiheita vaihelistasta. Vieressä näkyy uuden henkilön oikea Kartta-näkymä tuotannon vaihesisällöillä. Kun ylläpitäjä valitsee vaiheen, esikatselu siirtyy samaan kohtaan. Jokainen muutos näkyy reitillä heti, myös jokainen lisätty integraatio omana vaiheenaan. Puhelimessa esikatselu siirtyy editorin alle ja reitti tiivistyy kahteen sarakkeeseen.

**[Avaa kierros 2](https://glasspad.example.test/p/2pbl3lkzsqwha4igun24xp52au/).** Suuntaa vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä, eikä tämä ole testipalvelimen uusi versio. [Kierroksen 1 sivu](https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/) on yhä auki vertailua varten.

### Mitä palautteesta muuttui

- **Järjestys on kiinteä:** GitHub → Repot → integraatiot → AI-tili. Järjestyksen valitsin on poistettu. Lisätyt integraatiot tulevat siinä järjestyksessä, jossa ne ovat Asetukset › Integraatiot -sivulla (Google, Microsoft 365, Dropbox, Sähköposti (IMAP)). Ylläpitäjä päättää, mitkä niistä ovat vaiheita, mutta ei niiden paikkaa.
- **Repot:** vanhentuneiden repojen suodatin on poistettu kokonaan. Aloitustapa on ennallaan (esivalinta, automaattinen haku tai vaiheen ohitus). Oletusrepoja voi olla useita. *Lisää oletusrepo* avaa tuotannon repovalitsimen (`RepoFinder`, sama kuin uuden työtilan haussa), jossa voi selata, hakea ja kirjoittaa `omistaja/repo`. Tuntematon nimi näyttää tuotannon "Repoa ei ole" -tilan. Kunkin repon voi poistaa.
- **Integraatiot:** ylläpitäjä lisää yhden tai useamman integraation. Ne valitaan tuotannon `ig-tile`-laatoista, joissa on samat palvelut ja merkit kuin Integraatiot-sivulla. Jokainen lisätty integraatio on oma vaiheensa sekä vaikutuksissa että henkilön reitillä, ja jokaiselle valitaan *Voi ohittaa* tai *Pakollinen*.
- **AI-tili:** ylläpitäjä valitsee, mikä tuotannon kolmesta vaihtoehdosta avautuu oletuksena: *ChatGPT / OpenAI*, *Claude-tilaus* tai *OpenAI API-avain*. Henkilö voi silti valita jonkin muista.
- **Kutsut** ovat ennallaan kierroksesta 1. Kutsulomakkeeseen on lisätty vain maininta, että kutsuttu kulkee yllä määritellyn käyttöönoton.
- **Uuden henkilön näkymä** on valittu Kartta: koko reitti näkyy pysyvästi vaiheen vieressä. Vaiheiden sisältö on tuotannosta: `LoginCard`, `GitHubRepoChooser`, jossa oletusrepot ovat valmiiksi valittuina, `OnboardingClones` automaattisessa haussa, Integraatiot-sivun laatta, `AgentWarning` ja `ConnectDialog`, sekä AI-vaiheen `PiDeviceSignIn`, `ClaudeSignIn` ja `PiCredentials` samassa asettelussa kuin `PiOnboarding`. Tuotannon kehyksen oma kolmen vaiheen laskuri on piilotettu, koska reitti korvaa sen.

### Suunnat

Akseli on se, missä uuden henkilön Kartta-näkymä näkyy vaihelistaan nähden. Sisältö ja toiminnot ovat samat kaikissa suunnissa.

| Suunta | Mitä ylläpitäjä näkee | Hyöty ja hinta |
| --- | --- | --- |
| **1. Kartta vieressä** (suositus) | Vasemmalla neljän ryhmän vaihelista ja valitun vaiheen asetukset. Oikealla henkilön koko Kartta-näkymä, jonka läpi voi myös klikata. | Koko reitti ja vaiheen oikea sisältö näkyvät koko ajan. Reitin vaiheen valinta vie editorin samaan kohtaan. Vaatii leveyttä; puhelimessa esikatselu on editorin alla. |
| **2. Lista reittinä** | Vaihelista *on* henkilön reitti: jokainen integraatio on oma rivinsä ja *Lisää integraatio* on rivi ennen AI-tiliä. Valitun rivin asetukset ovat ylhäällä ja alla se, miltä vaihe näyttää henkilölle. | Yksi lista, ei kahta. Kokonaisreitin ulkoasu henkilölle ei kuitenkaan näy, vain yksi vaihe kerrallaan. |
| **3. Erillinen kokeilu** | Vaihelista ja lyhyt tekstireitti. *Kokeile uuden henkilön näkymää* avaa koko Kartan dialogiin. | Rauhallisin asetussivu. Muutoksen seuraus jää kuitenkin yhden klikkauksen taakse, mikä oli kierroksen 1 hylätyn suunnan heikkous. |

### Kokeile

1. Repot: lisää oletusrepo valitsimesta, hae `northstar-labs/research` nimellä ja poista yksi. Esikatselun repovalitsimessa oletukset ovat valmiiksi valittuina. Vaihda automaattiseen hakuun, jolloin esikatselu näyttää taustahaun rivit, ja ohitukseen, jolloin Repot katoaa reitiltä.
2. Integraatiot: lisää Microsoft 365 ja Dropbox. Reitillä ne näkyvät omina vaiheinaan Googlen jälkeen. Merkitse Microsoft pakolliseksi: henkilöltä katoaa ohitus. Yhdistä tuotannon dialogilla, jolloin reitille tulee ✓, ja poista Dropbox.
3. AI-tili: vaihda oletukseksi Claude-tilaus tai API-avain. Esikatselun AI-vaihe avautuu valitusta kohdasta.
4. Tallenna tai peru luonnos, käy Kutsut ja pääsy -näkymässä ja palaa takaisin.

### Kysymykset Jarille

1. **Valitaanko Kartta vieressä** toteutuksen pohjaksi?
2. **Integraation pakollisuus:** pidetäänkö *Voi ohittaa / Pakollinen* jokaiselle integraatiolle, vai riittääkö pelkkä lisääminen, jolloin integraation voi aina ohittaa? Pakollinen integraatio voi pysäyttää henkilön, jos liitos ei onnistu.
3. **AI-tili:** riittääkö oletuksen valinta, vai pitääkö ylläpitäjän voida myös piilottaa vaihtoehtoja, esimerkiksi tarjota vain Claude-tilausta?
4. **Integraatioiden järjestys** seuraa Integraatiot-sivua eikä lisäysjärjestystä. Sopiiko tämä tulkinta kiinteästä järjestyksestä?

### Oletukset, ei toteutuspäätöksiä

- Jaettu sanasto muuttui palautteen mukaan. `onboarding.repositories.stale_after_days` on poistettu. `onboarding.repositories` on `{mode, defaults[]}`, `onboarding.integrations` on lista `{provider, required}`, ja uusi `onboarding.ai_account.default` on `openai | claude | api-key`. Vaiheet johdetaan näistä, eikä niitä tallenneta järjestyksenä. Sivun lopun tietonäkymä näyttää esimerkin; tämä ei ole lukittu skeema. Tallennuspaikka ja auktoriteetti ratkaistaan `plan-site-onboarding-authority`-suunnitelmassa.
- Ylläpitäjän repovalitsin näyttää ylläpitäjän oman GitHub-näkymän. Henkilön oikeus tarkistetaan hänen omalla tilillään. Esivalinnassa oletusrepo, johon henkilöllä ei ole pääsyä, ei näy hänelle. Automaattisessa haussa puuttuva oikeus näkyy virheenä eikä ohitettuna onnistumisena.
- Automaattisen haun voi tallentaa ilman oletusrepoja. Silloin mitään ei haeta, ja vaikutusteksti kertoo sen. Jos tämä halutaan estää, tallennus pitää estää.
- Muutos koskee seuraavaa uutta käyttöönottoa. Kesken olevan käyttöönoton suhde muuttuneeseen malliin ratkaistaan yhä erikseen.

### Näyttö

Kierroksen 2 [evidence](evidence/) on `r2-`-alkuisissa tiedostoissa. Mukana on jokainen suunta 1440 px:n ja 390 px:n leveydellä vaaleana ja tummana sekä integraatio-, AI-, repovalitsin- ja kutsutilat. Tiedostot ovat kuvakaappaus/staattinen HTML -pareja, ja HTML:istä on poistettu upotetut fontit.

- `check.mjs` (paikallinen Chromium, Playwright `web/node_modules`ista): 60 tarkistuspistettä kaikilla kolmella suunnalla, molemmilla leveyksillä ja teemoilla. Mukana on yhteinen `picker-check.mjs`-tarkistus, valitsimen näppäimet (1–3, nuolet, R ja kenttien ohitus), URL-valinnan säilyminen uudelleenlatauksessa, repojen lisäys, haku, ei löytynyt -tila ja poisto, aloitustavat, integraatioiden lisäys ja järjestys, pakollisuus, yhdistäminen tuotannon dialogilla ja poisto, AI-oletus esikatselussa, tallennus ja peruutus sekä kutsujen validointi, duplikaatti ja peruminen. Ei konsoli- tai JavaScript-virheitä eikä vaakaylivuotoa. Tulos on `evidence/r2-checks.json`.
- Sama tarkistus julkaistussa Glasspad-sandboxissa: `evidence/r2-hosted-checks.json` (60 tarkistuspistettä). Ensimmäinen hosted-ajo aikakatkaistiin iframen uudelleenlatauksen jälkeen. Toinen ajo samalla sivulla läpäisi kaiken.
- Glasspad käyttää tokenien varafontteja, koska sen sandbox estää upotetut fontit.

Tämä on selaimessa toimivan synteettisen prototyypin näyttöä. Se **ei** testaa host-backed labia, oikeaa admissionia, OAuthia tai UID-eristystä. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-2/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-2/build.mjs
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-2/check.mjs \
  design-system/prototypes/dist/admin-onboarding-r2-space/offline.html /var/tmp/admin-onboarding-r2-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 1

**Suositus: 1. Vaikutus vieressä.** Ylläpitäjä näkee koko uuden henkilön aloituspolun samalla, kun muuttaa asetuksia. Näin esimerkiksi automaattinen repohaku ja pakollinen Google eivät jää teknisiksi valinnoiksi ilman näkyvää seurausta. Puhelimessa yhteenveto siirtyy lomakkeen alle.

**[Avaa kolmen suunnan prototyyppi](https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/).** Vaihda suuntaa alareunan vakiovalitsimesta (myös 1–3 ja nuolinäppäimet); teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä. Tämä ei ole testipalvelimen uusi versio.

**Kysymys Jarille:** valitaanko **Vaikutus vieressä** jatkosuunnittelun pohjaksi? Samalla ehdotan, että käyttöönoton asetukset tallennetaan yhtenä kokonaisuutena mutta kutsut ovat erillisiä, heti vahvistettavia toimintoja.

### Mitä vertaillaan

Akseli on asetusten ja uuden henkilön kokemuksen suhde. Sama sisältö ja samat toiminnot kaikissa suunnissa:

| Suunta | Mitä ylläpitäjä näkee | Hyöty ja hinta |
| --- | --- | --- |
| **1. Vaikutus vieressä** | Kaikki asetukset, vieressä koko aloituspolku | Kokonaisuus on näkyvissä ilman erillistä esikatseluun siirtymistä. Pitkä lomake. |
| **2. Vaihelista** | Yksi muokattava vaihe kerrallaan, vieressä koko aloituspolku | Lyhyempi muokkausalue. Muiden vaiheiden asetusten vertailu vaatii vaihtamista. |
| **3. Yksi lomake** | Kaikki asetukset, yhteenveto niiden jälkeen | Yksinkertaisin lukujärjestys. Muutoksen ja seurauksen väliin jää vieritystä. |

Kutsujen näkymä on yhteinen, ei kolme eri kutsumallia. Ylläpitonavigaatio ja Palvelin-sivun nimi-/versiotiedot säilyvät kontekstina. Muiden asetusosioiden navigaatio on tarkoituksella vain sommitelma.

### Kokeile

1. Vaihda repot esivalituista automaattiseen hakuun tai ohitettaviksi. Katso vaikutusteksti ja aloituspolku. Ohitus ei tarkoita automaattista hakua.
2. Esivalinnassa muuta 14 päivän aikarajaa. Oletusrepo ei katoa suodattimeen; tuntematon päivitysaika ei piilota repoa. Henkilö voi poistaa esivalinnan ja näyttää vanhemmat repot.
3. Vaihda Google vapaaehtoisesta pakolliseksi tai pois käyttöönotosta. Pakollisuuden etenemistä estävä seuraus näkyy suoraan, samoin henkilön oma valtuutus ja agentille annettavat oikeudet. Ylläpitäjä ei liitä kenenkään tiliä.
4. Vaihda repojen ja integraatioiden järjestystä. GitHub pysyy ensimmäisenä, AI-tili viimeisenä tässä kokeilussa.
5. Muuta asetuksia, käy Kutsut ja pääsy -näkymässä ja palaa: luonnos säilyy. Peru tai tallenna se. Tallennus on vain selaimessa oleva simulaatio.
6. Luo kutsu GitHub-käyttäjänimelle, kokeile virheellistä ja jo listalla olevaa nimeä, peru kutsu vahvistuksineen tai simuloi ensimmäinen kirjautuminen. Liittyneen henkilön pääsyn poisto ei esiinny kutsun perumisena.

Kutsu tarkoittaa tässä ehdotuksessa hyväksyntää liittyä nimetyllä GitHub-tilillä, ei viestin lähetystä, repo-oikeuksia tai ylläpitäjän asemaa. Sivuston osoite jaetaan itse. Uutta hyväksyttyä henkilöä ei luoda oikeasti, eikä oikeaa pääsyä myönnetä tai poisteta.

### Oletukset, ei toteutuspäätöksiä

- Jaettu sanasto on `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`. Sivun lopun avattava tietonäkymä näyttää niiden suunnitteluesimerkin, ei ehdota lukittua API-skeemaa.
- Lomakkeessa on yksi oletusrepo esimerkkidatana; usean oletusrepon editorin yksityiskohdat eivät kuulu tämän akselin ratkaisuun. Automaattihaku ei anna henkilölle GitHub-oikeuksia. Puuttuva oikeus tai haun virhe tarvitsee henkilön näkymässä korjattavan pysähdyksen, ei ohitettua onnistumista.
- Aikarajan sanamuoto on tuotannon tapaan ”päivitetty”. Nykyinen valitsin käyttää `pushed_at`-aikaa, ei viimeisen commitin todistettua aikaa. Jos halutaan nimenomaan commit-ikä, sen tietolähde on ratkaistava toteutussuunnitelmassa.
- Esimerkki sallii repojen ja integraatioiden keskinäisen järjestyksen vaihtamisen. Se ei päätä vapaata vaiheiden uudelleenjärjestelyä tai AI-vaiheen poistamista.
- Muutokset eivät muuta jo liittyneiden työtiloja tai liitoksia. Kesken olevan käyttöönoton suhde muuttuneeseen malliin on vielä ratkaistava. Esikatselu ei väitä näyttävänsä jo aloittaneen henkilön tilaa.
- Palvelimelta tarvitaan vahvistettu ylläpito-oikeus, voimassa oleva käyttöönoton malli, hyväksytyt GitHub-käyttäjät sekä kutsujen odottava/liittynyt-tila ja toimintojen vahvistetut tulokset. Prototyyppi ei päätä näiden tallennuspaikkaa, admission-auktoriteettia, CLI:tä, kutsujen vanhenemista tai olemassa olevien istuntojen poistamista. Ne eivät siirry selaimen tai gatewayn vallaksi tämän vedoksen vuoksi; auktoriteettisuunnitelma tehdään rinnakkaisessa työssä.

### Tuotantokonteksti ja näyttö

Luettu nykyiset `GitHubOnboarding.tsx`, `GitHubRepoChooser.tsx`, `Account.tsx`, `ServerAdministration.tsx`, `ServerVersion.tsx`, `IntegrationsSettings.tsx` ja integraatioiden tuotantokomponentti. Tuotannossa Palvelin-osio sisältää nyt nimen ja version; Integraatiot on henkilön oma osio.

Kierros **tuo oikeat** `ControlButton`-, `Icon`- ja `GitHubRepoChooser`-komponentit sekä `Settings.css`-tyylit ja design-tokenit. Tuotannon valitsimen voi avata vertailuksi sivun lopusta; se käyttää synteettistä dataa. Uudet ylläpidon lomakkeet ja kutsulista ovat vain tässä kierroksessa. Tuotantotiedostoja ei muutettu.

[Evidence-hakemisto](evidence/) sisältää jokaisesta suunnasta 1440 px:n ja 390 px:n kuvakaappaus/staattinen HTML -parin vaaleana ja tummana, lisäksi yhteisen kutsunäkymän ja oikean repovalitsimen vertailukuvat. HTML:t toimivat ilman verkkoa tai JavaScriptiä; niistä on poistettu toistuvat upotetut fonttibinaarit. Kuvakaappaukset käyttävät tuotannon fontteja. Glasspad käyttää tokenien varafontteja, koska sen sandbox estää upotetut fontit.

- Cedarissa ajettu synteettisen komponenttilabin `check.mjs`: 44 tarkistuspistettä, kaikki kolme suuntaa, molemmat leveydet ja teemat, muokkaus/tallennus/peruminen, kutsun validointi/duplikaatti/peruminen/liittyminen sekä oikean repovalitsimen valinta. Ei konsoli- tai JavaScript-virheitä eikä vaakaylivuotoa.
- Sama tarkistus julkaistussa Glasspad-sandboxissa: tulos `evidence/hosted-checks.json`.
- Vakiovalitsin lisätty samaan julkaistuun osoitteeseen: `lib/picker.css` ja `lib/picker.js` sellaisinaan, Reactin remount-sovittimella. Hosted-tarkistus työpöydällä ja 390 px:ssä molemmilla teemoilla: suuntien klikkaus, 1–3, nuolet, R, syötekenttien ja muokkausnäppäinten ohitus, iframe-uudelleenlatauksen URL-valinta, teeman ja puhelinkehyksen säilyminen vaihdossa sekä yllä olevat lomake- ja kutsutarkistukset. Tulos `evidence/picker-hosted-checks.json`; kuvakaappauksista tarkistettu valitsimen näkyvyys ja yksirivisyys.
- Yhteinen `check.mjs` hyväksyi tämän kierroksen sekä käyttöönoton kierroksen 2 ja otsikon odotusliikkeen (9 kuvaa kustakin, ei konsolivirheitä). Valitsimeton rakennettu HTML hylättiin exit-koodilla 1 (`missing prototype picker`). `picker-check.test.mjs` tarkistaa myös piilotetun/virheellisen valitsimen ja vanhojen kierrosten nimetyt poikkeukset; poikkeus ei päde, jos kierros on yhä kokeilulistalla.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`.

Tämä on selaimessa toimivan synteettisen prototyypin näyttöä, **ei** host-backed labin, oikean admissionin, OAuthin, UID-eristyksen tai uuden käyttöönoton toteutuksen testi. Ei clean gatea eikä tuotantojulkaisua.

Lähde: `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus/`. Rakenna erillisessä checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus/build.mjs
node design-system/prototypes/rounds/2026-10-23-palvelin-aloitus/check.mjs \
  design-system/prototypes/dist/admin-onboarding-space/offline.html /var/tmp/admin-onboarding-evidence
```

Alderlla selainajo tehdään etäkoneella. Tämän kierroksen selainajo käytti Cedarin valmista Chromiumia `PROTO_CHROMIUM`-ympäristömuuttujalla; ei muutoksia koneen asennettuihin työkaluihin. Julkaise vain rakennettu `index.html`, ei koko työhakemistoa.

Issue jää **in-progress** odottamaan Jarin valintaa.
