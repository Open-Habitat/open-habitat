# Palvelimen ylläpito › integraatiot

## Kierros 3 · Googlen ohjattu asetus

**Suositus: Sivupaneeli.** *Aseta tunnukset…* avaa paneelin rivien viereen. Ylimpänä ovat Client ID, Client secret ja *Tallenna*, joten ylläpitäjä, jolla on jo asiakas, ei lue ohjetta lainkaan. Ohje on niiden alla neljänä avattavana kohtana, ja kopioitavat arvot ovat siinä. Rivi näkyy paneelin vieressä koko ajan, joten tila *Odottaa palvelinta* → *Käytössä* näkyy samalla, kun paneeli sulkeutuu. Puhelimessa paneeli korvaa listan, ja *‹ Integraatiot* palaa listaan.

**[Avaa kierros 3](https://glasspad.example.test/p/h5jrjw3ub7sxmdedylv42nyqnu/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Integraatiot-välilehti on kierroksen 2 suunta *Käytössä vai ei* sellaisenaan. Kaikki tiedot ovat keksittyjä.

### Mitä kaikissa suunnissa on samaa

Sisältö tulee daemonin koodista (`internal/daemon/integrations/google_linux.go`), ja konsolin sanat tulevat Googlen ohjeista (lähteet alla):

1. **API:t:** Gmail API, Google Calendar API, Google Drive API ja People API. Linkki *Ota käyttöön Google Cloudissa* avaa Googlen enableflow-sivun, jossa kaikki neljä ovat valmiina.
2. **Kohdeyleisö** (*Google Auth platform › Branding › Get started*): App name ja valinta *Internal* / *External*. Internal: vain organisaation Workspace-tilit, eikä Googlen vahvistusta tarvita. External: *Testing*-tilassa jokainen tili lisätään kohtaan *Audience › Test users* (enintään 100), ja kirjautuminen vanhenee 7 päivässä. *In production* -tilassa Gmail ja Drive ovat rajoitettuja käyttöoikeuksia, joten ne vaativat Googlen vahvistuksen ja vuosittaisen tietoturva-arvion.
3. **Käyttöoikeudet** (*Data Access › Add or Remove Scopes*): koodin kuusi scopea yhtenä kopioitavana lohkona.
4. **OAuth-asiakas** (*Clients › Create Client*): *Desktop app*, nimi *Open Habitat*. **Uudelleenohjausosoitetta ei lisätä.** Daemon käyttää osoitetta `http://localhost`, jonka henkilö liittää takaisin. Desktop-asiakkaalle konsoli kysyy vain nimeä, eikä palvelin tarvitse julkista callbackia. Varoitus: Google näyttää Client secretin vain kerran.
5. **Tunnukset:** Client ID (päättyy `.apps.googleusercontent.com`) ja Client secret. Väärä muoto kerrotaan kentässä, eikä mitään lähetetä. Tallennuksen jälkeen painike näyttää *Odottaa palvelinta…*, rivi *Odottaa palvelinta*, ja palvelimen vahvistuksen jälkeen ohje sulkeutuu, rivi näyttää *Käytössä* ja käyttöönoton merkistä poistuu *piilossa*.

**Vaihda tunnukset** (*Tunnukset*-valikosta) kysyy ensin, mitä vaihdetaan:

- *Uusi salaisuus samalle asiakkaalle* (*Clients › Open Habitat › Add secret*): Client ID pysyy ja kysytään vain salaisuus. Ohjetta ei näytetä.
- *Uusi asiakas*: koko ohje.

Kummassakin lukee: *Yhdistetyt tilit käyttävät vanhaa salaisuutta / asiakasta, kunnes poistat sen Googlessa. Sen jälkeen niiden täytyy kirjautua uudelleen.* Tämä vastaa kierroksen 1 avoimeen oletukseen. Kun henkilö yhdistää tilin, daemon kirjoittaa asiakkaan ja salaisuuden hänen omaan rclone-konfiguraatioonsa ja gogin tunnuksiin (`googleLogin.Commit`). Vaihto koskee siis vain uusia kirjautumisia, ja vanhat yhteydet katkeavat vasta, kun vanha salaisuus tai asiakas poistetaan Googlessa.

**Korjaus kierroksiin 1–2:** Tunnukset-valikon otsikko näyttää nyt client id:n alun (`704213598812-…`, projektin numero), ei neljää viimeistä merkkiä. Googlen client id päättyy aina `.apps.googleusercontent.com`, joten loppu olisi aina `.com`.

### Suunnat

Akseli: miten ohje asettuu konsolityön rinnalle.

| Suunta | Muoto | Hyöty | Hinta |
| --- | --- | --- | --- |
| **1. Tarkistuslista** | Dialogi, jossa kaikki viisi kohtaa numeroituna ja kentät lopussa | Kaikki näkyy kerralla, ja sivua voi selata konsolin rinnalla | Pitkä. Kentät ovat alimpana, joten valmiin asiakkaan omistaja vierittää ohjeen ohi. Dialogi peittää rivin. |
| **2. Vaiheittain** | Dialogi, jossa yksi kohta kerrallaan, edistymispalkki (1/5…5/5), *Takaisin* / *Seuraava* sekä ensimmäisellä sivulla *Minulla on jo asiakas* | Vähiten tekstiä kerrallaan | Neljä painallusta kenttiin. Edellisen vaiheen arvo ei näy, kun konsolissa tarvitaan kahta kohtaa yhtä aikaa. |
| **3. Sivupaneeli** (suositus) | Avoin paneeli rivien vieressä. Ensin kentät, sitten avattava ohje. | Kentät ensin. Rivi ja sen tila pysyvät näkyvissä. Ei modaalia. | Leveällä näytöllä rivit kapenevat. Puhelimessa paneeli on oma näkymänsä. |

### Kokeile

1. Suunta 1, *Uusi asennus*: *Aseta tunnukset…* Googlelle. Vaihda *Internal* → *External* ja lue ero.
2. Kirjoita Client ID:ksi `abc` ja tallenna: virheet näkyvät kentissä. Kokeile oikealla muodolla, esimerkiksi `915508263417-a8d2kq0zr7m3vh1ts9pe5wybc6lfnjxu.apps.googleusercontent.com` ja salaisuus `GOCSPX-x`.
3. *Tunnukset* › *Vaihda tunnukset…*: oletuksena uusi salaisuus. Vaihda *Uusi asiakas* -vaihtoehtoon.
4. Suunta 2: kulje vaiheet läpi ja kokeile *Minulla on jo asiakas*.
5. Suunta 3: rivi näkyy paneelin vieressä tallennuksen ajan. 390 px:n leveydellä paneeli korvaa listan.

### Kysymykset Jarille

1. **Tarkistuslista, Vaiheittain vai Sivupaneeli?**
2. **Internal vai External:** riittääkö, että ohje kertoo molempien seuraukset, vai pitäisikö se suositella Internalia suoraan ja näyttää External vain, jos organisaatiolla ei ole Workspacea?
3. **Vaihda:** tarvitaanko valinta *uusi salaisuus / uusi asiakas*, vai riittääkö pelkkä uusi salaisuus? Toisen asiakkaan voi asettaa myös poistamalla tunnukset ja asettamalla ne uudelleen.
4. **Konsolin sanat englanniksi** (*Google Auth platform › Clients › Create Client*), kuten Googlen ohjeissa: kelpaako? Suomenkielistä konsolia en pystynyt tarkistamaan dokumentaatiosta.

### Oletukset, ei toteutuspäätöksiä

- Palvelin palauttaa client id:n kokonaan, koska se ei ole salaisuus: se näkyy jokaisessa kirjautumisosoitteessa. Salaisuus ei palaa koskaan.
- Internal/External on vain ohjeen valinta. Palvelin ei tallenna sitä eikä voi tietää sitä.
- Palvelimen vahvistus on edelleen 0,9 sekunnin viive. Palvelimen hylkäystä (esim. `integrations.browser_setup` pois päältä) ei ole tällä kierroksella.
- Selaimen muototarkistus on tiukempi kuin daemonin (`googleApp()` sallii `[A-Za-z0-9._-]`). Brokerin pitää tarkistaa sama muoto itse.
- Microsoft ja Dropbox ovat yhä paikkamerkkejä.

### Lähteet

- Suostumusnäkymän asetus, Internal/External, Test users ja Data Access: https://developers.google.com/workspace/guides/configure-oauth-consent
- OAuth-asiakas (*Clients › Create Client › Desktop app*): https://developers.google.com/workspace/guides/create-credentials
- API:en käyttöönotto ja enableflow-tunnisteet (`gmail.googleapis.com`, `calendar-json.googleapis.com`, `drive.googleapis.com`, `people.googleapis.com`): https://developers.google.com/workspace/guides/enable-apis
- Testing-tila: 100 testikäyttäjää, 7 päivän vanheneminen, *Publish app*: https://support.google.com/cloud/answer/15549945 ja https://developers.google.com/identity/protocols/oauth2 (refresh token -vanheneminen)
- Client secret näkyy vain luotaessa, *Add Secret*, *Disable*: https://support.google.com/cloud/answer/15549257
- Vahvistuksen poikkeukset (sisäinen käyttö, testaus, alle 100 käyttäjää): https://support.google.com/cloud/answer/13464323
- Rajoitettujen käyttöoikeuksien vuosittainen tietoturva-arvio: https://support.google.com/cloud/answer/13464321
- Rajoitetut scopet: `gmail.modify` https://developers.google.com/workspace/gmail/api/auth/scopes ja `drive` https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Desktop-asiakkaan loopback-osoite ja OOB-kopioinnin poisto: https://developers.google.com/identity/protocols/oauth2/native-app ja https://developers.google.com/identity/protocols/oauth2/resources/loopback-migration

### Näyttö

[evidence](evidence/) sisältää `r3-`-alkuiset kuvakaappaus/staattinen HTML -parit: `guide-1…3` (kaikki suunnat 1440/390, vaalea/tumma), `external-1`, `enter-2`, `replace-1`, `replace-3`, `menu-1` ja `saved-3`.

Tarkistukset:

- `check.mjs`: 36 tarkistuspistettä kolmella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana yhteinen `picker-check.mjs`, valitsimen näppäimet, URL ja R. Ohjeen API:t, enableflow-linkki ja scopet verrataan koodin arvoihin, ja tarkistetaan uudelleenohjausosoitteen puuttuminen ja localhost, Internal/External-seuraukset, muotovirheet ilman lähetystä, tila *Odottaa palvelinta* → *Käytössä*, valikon client id:n alku ilman `.com`ia, vaihdon kaksi tapaa, vaiheiden järjestys ja *Minulla on jo asiakas*, paneelin kentät ennen ohjetta, rivien näkyvyys leveällä näytöllä ja paneelin oma näkymä puhelimessa sekä poisto ja puuttuva työkalu. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r3-checks.json`, julkaistulla sivulla `evidence/r3-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi; ei testaa daemonia, brokeria, Googlea eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-3/check.mjs \
  design-system/prototypes/dist/server-integrations-r3-space/offline.html /var/tmp/server-integrations-r3-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 2 · Rivi

**Suositus: Käytössä vai ei.** Rivillä on vain palvelun nimi, tila ja yksi toiminto. Tila on kirjoitettu henkilön kannalta: *Käytössä* tai *Ei käytössä*, ja puuttuva työkalu nimetään tilassa (*Ei käytössä · rclone puuttuu*). Valmiilla DAV-riveillä ei ole muuta kuin *Käytössä*, joten ne eivät toista mitään. Käyttöönotto näkyy vain, kun palvelulla on vaihe: merkki *Käyttöönotossa* tai *Käyttöönotossa · piilossa*, ja merkki vie Käyttöönotto-välilehdelle. *Aseta tunnukset…* on rivillä. *Vaihda* ja *Poista* ovat harvinaisia, joten ne ovat *Tunnukset*-valikossa, jonka otsikossa näkyy client id:n loppu, asettaja ja päivä. Puuttuvan työkalun korjaus on *Korjaa…*-dialogissa: yksi komento ja kopiointipainike.

**[Avaa kierros 2](https://glasspad.example.test/p/frv6jdpbbcpq74spkwo5a724f4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta, esimerkkipalvelimet ovat samat kuin kierroksella 1. Kaikki tiedot ovat keksittyjä.

Kierroksen 1 suunnasta 1 on poistettu kaikista suunnista *Näytä henkilön näkymä*, johdanto, selitys tunnusten tallennuksesta ja yhteenvetorivi. Sivulla on vain otsikko *Integraatiot* ja kuusi riviä katalogin järjestyksessä.

### Suunnat

Akseli: miten rivi kertoo tilan ja seuraukset ja missä sen toiminnot ovat.

| Suunta | Tila | Seuraus henkilöille ja käyttöönotolle | Toiminnot | Työkalu puuttuu |
| --- | --- | --- | --- | --- |
| **1. Tila ja lause** | Kierroksen 1 sanat: *Valmiina käyttöön*, *Tarvitsee sovellustunnukset*, *Työkalu puuttuu* | Yksi lause vain, kun jokin on pielessä (*Henkilöt eivät voi vielä yhdistää.*). Käyttöönoton merkki, kun vaihe on olemassa. | *Aseta tunnukset…* sekä *Vaihda…* ja *Poista* suoraan rivillä | Yksi ilmoitus listan yllä komennon kanssa, koska korjaus on koko palvelimelle sama. Rivit nimeävät puuttuvan työkalun. |
| **2. Käytössä vai ei** (suositus) | *Käytössä* / *Ei käytössä* / *Ei käytössä · rclone puuttuu* omassa sarakkeessaan | Tila on itse seuraus, ei lausetta. Käyttöönoton merkki, kun vaihe on olemassa. | *Aseta tunnukset…* rivillä; *Vaihda* ja *Poista* *Tunnukset*-valikossa | *Korjaa…* avaa komennon dialogiin |
| **3. Avattava rivi** | Kierroksen 1 sanat tasattuna oikealle | Avattavassa osassa: lause, sovelluksen tiedot ja *Käyttöönoton vaihe, piilossa · Käyttöönotto* | Kaikki avattavassa osassa; valmiit DAV-rivit eivät avaudu | Komento avattavassa osassa |

Suunta 1 kertoo eniten, mutta vaihda- ja poista-painikkeet ovat aina näkyvissä, vaikka niitä käytetään harvoin. Suunta 3 on rauhallisin suljettuna, mutta ylläpitäjän pitää avata rivi nähdäkseen, mitä tehdä, ja yksi painallus lisää jokaiseen asetukseen. Suunta 2 on lyhyin ja silti näyttää tehtävän työn heti: jokainen *Ei käytössä* -rivi on myös rivi, jolla on painike.

### Kokeile

1. Suunta 2, *Uusi asennus*: kolme *Ei käytössä* -riviä painikkeineen, kolme *Käytössä*-riviä ilman mitään muuta.
2. *Aseta tunnukset…* Googlelle → *Simuloi: tallennettu*. Rivi näyttää *Odottaa palvelinta* ja sitten *Käytössä*. Käyttöönoton merkistä katoaa *piilossa*.
3. *Tunnukset*-valikko Googlen riviltä: client id:n loppu ja asettaja otsikossa, *Vaihda tunnukset…* ja *Poista tunnukset…*.
4. *Vajaa asennus*: *Ei käytössä · rclone puuttuu* ja *Korjaa…*. Vertaa suunnan 1 yhteen ilmoitukseen listan yllä.
5. Klikkaa *Käyttöönotossa · piilossa*: avautuu Käyttöönotto-välilehti, jossa kierroksen 1 säännöt pätevät.
6. Suunnat 1 ja 3 samoilla esimerkkipalvelimilla.

### Kysymykset Jarille

1. **Tila ja lause, Käytössä vai ei vai Avattava rivi?** Tai yhdistelmä, esimerkiksi suunta 2 ja suunnan 1 yksi ilmoitus listan yllä, kun työkalu puuttuu.
2. **Riittääkö *Käytössä / Ei käytössä*?** Vaihtoehto on *Ei käytössä · tarvitsee tunnukset*, joka kertoo syyn, mutta painike *Aseta tunnukset…* on jo samalla rivillä.
3. **Käyttöönotto merkkinä:** riittääkö merkki vain silloin, kun vaihe on olemassa, ilman mitään tekstiä muille riveille?
4. **Kierros 3:** Googlen ohjattu asetus, kuten issue ehdottaa?

### Oletukset, ei toteutuspäätöksiä

- Palvelimen vahvistus on edelleen 0,9 sekunnin viive, ja asettajan nimi ja aika ovat option B kirjanpitoa, jota ei vielä ole.
- Poiston vahvistus on lyhennetty kolmeen seuraukseen: uusia tilejä ei voi yhdistää, yhdistetyt tilit eivät voi kirjautua uudelleen ja käyttöönoton vaihe piilotetaan.
- *Aseta tunnukset…* on yhä paikkamerkki, joka nimeää kysyttävät kentät.

### Näyttö

[evidence](evidence/) sisältää `r2-`-alkuiset kuvakaappaus/staattinen HTML -parit: `overview-1…3`, `partial-1…3` (vajaa asennus), `menu-2` (Tunnukset-valikko), `fix-2` (Korjaa-dialogi), `setup-1` ja `remove-1`.

Tarkistukset:

- `check.mjs`: 44 tarkistuspistettä kolmella suunnalla, 1440 ja 390 px, vaalea ja tumma. Mukana yhteinen `picker-check.mjs`, valitsimen näppäimet, URL-valinta ja R, katalogin järjestys, kierroksen 1 poistojen pysyminen poissa, tilat ja välitila, valmiiden DAV-rivien hiljaisuus, käyttöönoton merkki ja sen linkki, valikko, poiston seuraukset, puuttuvan työkalun korjaus kerran sanottuna (suunta 1) ja suljettuna (suunta 3). Ei konsolivirheitä eikä vaakaylivuotoa. Tulos `evidence/r2-checks.json`, julkaistulla sivulla `evidence/r2-hosted-checks.json`.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Synteettinen selainprototyyppi; ei testaa daemonia, brokeria eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/`:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-2/check.mjs \
  design-system/prototypes/dist/server-integrations-r2-space/offline.html /var/tmp/server-integrations-r2-evidence
```

Julkaise vain rakennettu `index.html`.

## Kierros 1 · Yleiskuva

**Suositus: Oma välilehti.** *Palvelimen ylläpito* -ryhmään tulee välilehti *Integraatiot* Palvelimen ja Käyttöönoton väliin. Siinä on yksi rivi kullekin kuudelle palvelulle samassa järjestyksessä ja samoilla merkeillä kuin henkilön Asetukset › Integraatiot -sivulla. Rivillä on tila, ja sen alla kerrotaan, mitä tila tarkoittaa henkilöille ja käyttöönotolle. Tunnuksia tarvitsevilla riveillä on painike *Aseta tunnukset…*. Suosittelen omaa välilehteä, koska jokaisella palvelulla on kaksi seurausta, jotka ylläpitäjän pitää nähdä, eikä niille ole tilaa Palvelin-välilehden osiossa. Lisäksi Käyttöönotto-välilehti viittaa tähän näkymään. Kiinteä järjestys pitää rivit paikallaan, kun tila muuttuu.

**[Avaa kierros 1](https://glasspad.example.test/p/7xaaidgbl3ebzck24twjpmy6c4/).** Suunta vaihdetaan alareunan valitsimesta (myös 1–3, nuolet ja R). Teema ja 390 px:n kehys vaihtuvat yläreunasta. *Esimerkkipalvelin* vaihtaa kolmen palvelintilan välillä: uusi asennus, Google asetettu ja vajaa asennus. Kaikki tiedot ovat keksittyjä.

### Mitä kaikissa suunnissa on samaa

- **Palvelut ja tilat tulevat katalogista** (`internal/daemon/integrations`). IMAP, CalDAV ja CardDAV ovat valmiina käyttöön heti, kun työkalut on asennettu. Google, Microsoft 365 ja Dropbox tarvitsevat lisäksi organisaation sovellustunnukset. Rivin tila on yksi seuraavista:
  - *Valmiina käyttöön*: henkilö näkee Yhdistä…-painikkeen.
  - *Tarvitsee sovellustunnukset*: henkilö näkee tekstin "Ei käytettävissä tällä palvelimella", ja painike on pois käytöstä. Teksti on tuotannon nykyinen.
  - *Työkalu puuttuu*: henkilö näkee saman kuin edellisessä tilassa. Rivi nimeää puuttuvan työkalun (esimerkiksi `rclone`), ja *Miten korjataan…* neuvoo ajamaan `host apply`n. Tilaa ei pitäisi esiintyä, kun `integration-tools-always-installed` on tehty. Se näytetään silti, koska daemon voi päätyä siihen vajaalla asennuksella.
  - *Tallennetaan · odottaa palvelinta*: välitila. Muutos on voimassa vasta, kun palvelin on vahvistanut sen. Tämä noudattaa kierroksen 6 periaatetta "selain pyytää, palvelin vahvistaa".
- **Henkilön näkymä:** *Näytä henkilön näkymä* avaa tuotannon `IntegrationsOverview`-komponentin sellaisena kuin uusi henkilö sen näkee tällä palvelimella. Kokeile asettaa Googlen tunnukset ja avata näkymä uudelleen.
- **Käyttöönoton integraatiovaiheet:** ehdotan kolmea sääntöä.
  1. Vaihe näkyy uusille henkilöille vain, kun sen integraatio on valmiina käyttöön. Muuten vaihe on tallessa mutta *piilossa uusilta henkilöiltä*, ja Käyttöönotto-välilehti linkittää sen tilaan.
  2. Uudeksi vaiheeksi voi lisätä vain valmiin integraation.
  3. Tunnusten poisto ei poista vaihetta, vaan piilottaa sen.

  Näin puuttuvat tunnukset eivät koskaan pysäytä uuden henkilön käyttöönottoa.
- **Sovellustunnukset ovat vain kirjoitettavia.** Tallennuksen jälkeen näkyy palvelu, client id:n neljä viimeistä merkkiä, asettaja ja päivä. Salaisuutta ei näytetä. Tämä toimii samoin kuin ADR 0030:n sivuston AI-avain.
- **Tunnusten poisto** kertoo seuraukset ennen vahvistusta: uusia tilejä ei voi yhdistää, jo yhdistetyt tilit näkyvät mutta niihin ei voi kirjautua uudelleen, vaihe piilotetaan ja sovellus jää palveluntarjoajan konsoliin. Poisto ja uudelleenkirjautuminen toimivat näin tuotannon nykyisessä koodissa (`AccountCard` ilman `onSignInAgain`ia, kun palvelu ei ole saatavilla).
- *Aseta tunnukset…* on tällä kierroksella paikkamerkki. Se kertoo, mitä ohjattu asetus kysyy: Googlelta Client ID ja Client secret, Microsoftilta sovelluksen id ja kirjautujat (`common`, `organizations`, `consumers` tai oma tenant), Dropboxilta App key ja App secret. Lisäksi siinä on painike, joka simuloi tallennuksen. Varsinainen ohjattu asetus tehdään kierroksilla 2–4.

### Suunnat

Akseli: missä ylläpitäjän integraatioyleiskuva on ja miten se on järjestetty.

| Suunta | Paikka | Järjestys | Hyöty | Hinta |
| --- | --- | --- | --- | --- |
| **1. Oma välilehti** (suositus) | *Palvelimen ylläpito › Integraatiot* | Katalogin järjestys, yksi rivi palvelua kohden. Kummallakin rivillä näkyy *Henkilöille* ja *Käyttöönotossa*, ja yläreunan yhteenveto kertoo tilojen lukumäärät. | Vastaa henkilön sivua. Rivit eivät hypi. Molemmat seuraukset näkyvät jokaisella rivillä. | Pitkä sivu. Valmiit DAV-rivit toistavat samaa tekstiä. |
| **2. Tilan mukaan** | Oma välilehti | Ryhmät: *Korjattavaa*, *Tarvitsee sovellustunnukset* (kortti, jossa "Tarvitaan: …") ja *Valmiina käyttöön*. Valmiit IMAP, CalDAV ja CardDAV ovat yhdessä tiiviissä kortissa. | Tehtävä työ on ylimpänä, mikä toimii hyvin uudessa asennuksessa. | Rivi siirtyy ryhmästä toiseen tallennuksen jälkeen, ja järjestys poikkeaa henkilön sivusta. |
| **3. Osana Palvelinta** | Palvelin-välilehden osio palvelintietojen alla | Tiivis taulukko: palvelu, tila, henkilöille ja toiminto. Käyttöönoton vaihe on pienenä merkintänä nimen alla. | Yksi välilehti vähemmän, ja kokonaisuus mahtuu yhdelle näytölle. | Seuraukset käyttöönotolle jäävät yhteen sanaan. Palvelin-välilehti kasvaa, ja se jää kauemmas Käyttöönotosta. |

Suuntia voi myös yhdistää, esimerkiksi suunnan 1 järjestykseen suunnan 2 *Korjattavaa*-ryhmän, jos jokin on rikki.

### Auktoriteettimuistio: kuka kirjoittaa sovellustunnukset

**Nykytila.** Sovellustunnukset ovat tiedostossa `/opt/open-habitat/integrations.json` työkalupolkujen vieressä. Tiedoston omistaa root, ja kaikki liitetyt käyttäjät voivat lukea sitä. Daemon lukee sen funktiolla `core.ReadOperatorFile`, joka hylkää tiedoston, jos se tai jokin sen hakemistoista ei ole rootin omistama tai jos muut voivat kirjoittaa siihen. Daemonin luottamus tunnuksiin perustuu siis siihen, että vain root kirjoittaa tiedostoa. Tiedostoon kirjoittaa nyt operaattori käsin, ja `integration-tools-always-installed`in jälkeen `host apply` kirjoittaa sen `tools`-osion ja säilyttää tunnukset. Jos selaimen ylläpitäjä voi kirjoittaa tunnukset, auktoriteetti muuttuu samalla tavalla kuin ADR 0030:ssä: ylläpitäjä voi vaihtaa sovelluksen, jonka kautta kaikkien tulevat Google-, Microsoft- ja Dropbox-kirjautumiset kulkevat. Vaihdetun sovelluksen haltija saisi käyttöönsä niiden henkilöiden tunnukset, jotka kirjautuvat sen kautta.

| Vaihtoehto | Miten | Mitä muuttuu | Arvio |
| --- | --- | --- | --- |
| **A. Vain root** | Selain näyttää tilan ja valmiin komennon, esimerkiksi `sudo open-habitat admin integrations set google`, joka lukee salaisuuden stdinistä. | Ei muutosta. | Turvallisin, mutta ylläpitäjä ei voi viimeistellä asennusta selaimessa, mikä oli tavoite. Komento tarvitaan joka tapauksessa, kuten ADR 0030:n `admin onboarding`. |
| **B. Broker kirjoittaa gatewayn pyynnöstä** (suositus) | Uudet gateway-socketin operaatiot `set_integration_app` ja `clear_integration_app`, samaan tapaan kuin ADR 0030:n `admit` ja `withdraw`. Gateway tarkistaa ylläpitäjän ja välittää syötteen. Broker validoi saman tiukan muodon kuin `parseConfig` ja korvaa vain kyseisen palvelun osion atomisesti saman lukon alla, jota `host apply` käyttää `tools`-osion kanssa. Selaimelle palautetaan vain palvelu, client id:n loppu, asettaja ja aika. | Broker saa yhden root-kirjoituksen tiedostoon `/opt`. Se ei saa verkkoa, henkilöiden tunnuksia eikä kirjoitusoikeutta koteihin. Daemon, tiedoston muoto ja luottamuksen juuri pysyvät ennallaan. | Sama malli kuin ADR 0030:n pääsylistassa: broker omistaa tiedon, gateway saa vain pyytää, ja juuri voi rajata. Rajaus: `site.json`in kytkin `integrations.browser_setup`, jonka ollessa `false` broker hylkää kirjoitukset. Lisäksi asettaja ja aika näkyvät `host plan`issa ja `admin integrations list`issä. |
| **C. Gateway omistaa** | Kuten ADR 0030:n sivuston AI-avain: tunnukset ovat gatewayn omassa tiedostossa, ja daemon saa ne pyynnöissä tai lukee gatewayn tiedoston. | Daemon alkaa luottaa gatewayn kirjoittamaan sovelluksen tunnisteeseen. Gateway näkee jo nyt henkilöiden liittämät paluuosoitteet, joten salaisuuden haltijana se voisi lunastaa niiden koodit itse. | Hylkään. AI-avain kuului gatewaylle, koska se kylvetään kerran henkilön kotiin. Sovellustunnus taas on asennuksen yhteinen syöte jokaiselle kirjautumiselle. ADR 0030 jätti vastaavan yhteisen syötteen, pääsylistan, brokerille. Se hylkäsi brokerin AI-avaimen haltijana vain siksi, että avain olisi vaatinut kirjoitusta henkilöiden koteihin, eikä sitä tässä tarvita. |

**Suositus: B.** Yksi avoin valinta on `integrations.browser_setup`-kytkimen oletus. Ehdotan, että se on päällä (`true`), toisin kuin ADR 0030:n `runtime_admission`. Tunnusten asetus ei luo tilejä eikä anna pääsyä kenenkään tietoihin ilman henkilön omaa kirjautumista, ja tavoite on, että asennus valmistuu selaimessa. Root voi silti lukita kytkimen. Jos haluat yhtenäisyyttä ADR 0030:n kanssa, oletus on `false` ja asennusohje kertoo sen kääntämisestä. Ratkaisu kirjataan ADR:ksi tai ADR 0030:n lisäykseksi ennen toteutusta.

### Kokeile

1. Suunta 1, *Uusi asennus*: lue Googlen rivi. Käyttöönoton vaihe on olemassa mutta piilossa. Avaa *Näytä henkilön näkymä*.
2. *Aseta tunnukset…* Googlelle → *Simuloi: tunnukset tallennettu*. Rivi näyttää ensin *odottaa palvelinta* ja sitten *Valmiina käyttöön*. Avaa henkilön näkymä uudelleen.
3. *Poista* Googlen riviltä: lue seuraukset.
4. *Vajaa asennus*: rclone puuttuu, joten Google, Microsoft ja Dropbox ovat *Työkalu puuttuu*. Avaa *Miten korjataan…*.
5. *Käyttöönotto*-välilehti: piilotettu Google-vaihe ja *Lisää integraatio*. Microsoft on estetty, IMAP voidaan lisätä.
6. Suunnat 2 ja 3 kaikilla esimerkkipalvelimilla. Esimerkkipalvelin säilyy, kun suuntaa vaihdetaan.

### Kysymykset Jarille

1. **Oma välilehti, Tilan mukaan vai Osana Palvelinta?** Tai yhdistelmä, esimerkiksi suunta 1 ja *Korjattavaa*-ryhmä ylimpänä.
2. **Välilehden nimi:** asetuksissa olisi silloin kaksi *Integraatiot*-kohtaa, henkilön oma ja ylläpidon. Kelpaako sama nimi ryhmän alla, vai käytetäänkö nimeä *Integraatioiden asetus*?
3. **Käyttöönoton säännöt:** kelpaako, että vaihe näkyy vain, kun integraatio on valmiina käyttöön, että vaiheeksi voi lisätä vain valmiin integraation ja että tunnusten poisto piilottaa vaiheen poistamatta sitä?
4. **Auktoriteetti:** hyväksytkö vaihtoehdon B? Onko `integrations.browser_setup`-kytkimen oletus `true` vai `false`?
5. **Kierros 2:** aloitetaanko Googlen ohjatusta asetuksesta, kuten issue ehdottaa?

### Oletukset, ei toteutuspäätöksiä

- Palvelimen vahvistus on prototyypissä 0,9 sekunnin viive.
- Asettajan nimi ja aika ("24.10. Kaisa Admin") ovat B:n kirjanpitoa, jota ei vielä ole.
- En ole tarkistanut, toimivatko jo yhdistetyt tilit, kun sovellus *vaihdetaan* toiseen (työkalun tallentamat refresh-tokenit ovat sidottuja client id:hen). Vaihtodialogi sanoo varovasti, että uudelleenkirjautuminen voi olla tarpeen. Tämä tarkistetaan Googlen kierroksella.
- Microsoftin "Kirjautujat" on `MicrosoftApp.TenantID`. Katalogin kommentin mukaan se on kirjautumisen kohdeyleisö eikä operaattorin oma tenant.

### Näyttö

[evidence](evidence/) sisältää `r1-`-alkuiset kuvakaappaus/staattinen HTML -parit: `overview-*` (suunnat 1–3), `partial-*` (vajaa asennus), `person-1-*` (henkilön näkymä), `setup-1-*`, `remove-1-390-light` ja `onboarding-1-*`. Kaikki on otettu 1440 px:n ja 390 px:n leveydellä sekä vaaleassa ja tummassa teemassa siltä osin kuin `check.mjs` ne ottaa.

Tarkistukset:

- `check.mjs` (Playwright `web/node_modules`ista): 36 tarkistuspistettä kolmella suunnalla, molemmilla leveyksillä ja molemmilla teemoilla. Mukana ovat yhteinen `picker-check.mjs`, valitsimen näppäimet, URL-valinta ja R:n uudelleenaloitus, katalogin järjestys, kaikki tilat, henkilön näkymän ruutujen käytettävyys ennen tallennusta ja sen jälkeen, välitila *odottaa palvelinta*, poiston seuraukset, puuttuvan työkalun ohje, käyttöönoton piilotettu vaihe sekä estetty ja sallittu lisäys, suunnan 2 ryhmät ja suunnan 3 osio ilman omaa välilehteä. Ei konsolivirheitä eikä vaakaylivuotoa. Tulos on `evidence/r1-checks.json`.
- Sama tarkistus julkaistulla Glasspad-sivulla: `evidence/r1-hosted-checks.json`, 36 tarkistuspistettä.
- Yhteinen `design-system/prototypes/check.mjs` hyväksyi sivun (9 kuvaa, ei virheitä), ja `picker-check.test.mjs` meni läpi.

Tämä on synteettisen selainprototyypin näyttöä. Se **ei** testaa daemonin katalogia, brokeria eikä oikeaa `integrations.json`ia. Tuotantotiedostoja ei muutettu.

Lähde: `design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/`. Rakenna checkoutissa, jossa `web/node_modules` on asennettu lukosta:

```sh
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/build.mjs
node design-system/prototypes/rounds/2026-10-24-palvelin-integraatiot-1/check.mjs \
  design-system/prototypes/dist/server-integrations-r1-space/offline.html /var/tmp/server-integrations-r1-evidence
```

Julkaise vain rakennettu `index.html`.
