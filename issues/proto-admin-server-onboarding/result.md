# Palvelin › käyttöönotto ja kutsut

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
