# Palvelin › käyttöönotto ja kutsut

**Suositus: 1. Vaikutus vieressä.** Ylläpitäjä näkee koko uuden henkilön aloituspolun samalla, kun muuttaa asetuksia. Näin esimerkiksi automaattinen repohaku ja pakollinen Google eivät jää teknisiksi valinnoiksi ilman näkyvää seurausta. Puhelimessa yhteenveto siirtyy lomakkeen alle.

**[Avaa kolmen suunnan prototyyppi](https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/).** Vaihda suuntaa alareunan vakiovalitsimesta (myös 1–3 ja nuolinäppäimet); teema ja 390 px:n kehys vaihtuvat yläreunasta. Kaikki tiedot ovat keksittyjä. Tämä ei ole testipalvelimen uusi versio.

**Kysymys Jarille:** valitaanko **Vaikutus vieressä** jatkosuunnittelun pohjaksi? Samalla ehdotan, että käyttöönoton asetukset tallennetaan yhtenä kokonaisuutena mutta kutsut ovat erillisiä, heti vahvistettavia toimintoja.

## Mitä vertaillaan

Akseli on asetusten ja uuden henkilön kokemuksen suhde. Sama sisältö ja samat toiminnot kaikissa suunnissa:

| Suunta | Mitä ylläpitäjä näkee | Hyöty ja hinta |
| --- | --- | --- |
| **1. Vaikutus vieressä** | Kaikki asetukset, vieressä koko aloituspolku | Kokonaisuus on näkyvissä ilman erillistä esikatseluun siirtymistä. Pitkä lomake. |
| **2. Vaihelista** | Yksi muokattava vaihe kerrallaan, vieressä koko aloituspolku | Lyhyempi muokkausalue. Muiden vaiheiden asetusten vertailu vaatii vaihtamista. |
| **3. Yksi lomake** | Kaikki asetukset, yhteenveto niiden jälkeen | Yksinkertaisin lukujärjestys. Muutoksen ja seurauksen väliin jää vieritystä. |

Kutsujen näkymä on yhteinen, ei kolme eri kutsumallia. Ylläpitonavigaatio ja Palvelin-sivun nimi-/versiotiedot säilyvät kontekstina. Muiden asetusosioiden navigaatio on tarkoituksella vain sommitelma.

## Kokeile

1. Vaihda repot esivalituista automaattiseen hakuun tai ohitettaviksi. Katso vaikutusteksti ja aloituspolku. Ohitus ei tarkoita automaattista hakua.
2. Esivalinnassa muuta 14 päivän aikarajaa. Oletusrepo ei katoa suodattimeen; tuntematon päivitysaika ei piilota repoa. Henkilö voi poistaa esivalinnan ja näyttää vanhemmat repot.
3. Vaihda Google vapaaehtoisesta pakolliseksi tai pois käyttöönotosta. Pakollisuuden etenemistä estävä seuraus näkyy suoraan, samoin henkilön oma valtuutus ja agentille annettavat oikeudet. Ylläpitäjä ei liitä kenenkään tiliä.
4. Vaihda repojen ja integraatioiden järjestystä. GitHub pysyy ensimmäisenä, AI-tili viimeisenä tässä kokeilussa.
5. Muuta asetuksia, käy Kutsut ja pääsy -näkymässä ja palaa: luonnos säilyy. Peru tai tallenna se. Tallennus on vain selaimessa oleva simulaatio.
6. Luo kutsu GitHub-käyttäjänimelle, kokeile virheellistä ja jo listalla olevaa nimeä, peru kutsu vahvistuksineen tai simuloi ensimmäinen kirjautuminen. Liittyneen henkilön pääsyn poisto ei esiinny kutsun perumisena.

Kutsu tarkoittaa tässä ehdotuksessa hyväksyntää liittyä nimetyllä GitHub-tilillä, ei viestin lähetystä, repo-oikeuksia tai ylläpitäjän asemaa. Sivuston osoite jaetaan itse. Uutta hyväksyttyä henkilöä ei luoda oikeasti, eikä oikeaa pääsyä myönnetä tai poisteta.

## Oletukset, ei toteutuspäätöksiä

- Jaettu sanasto on `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`. Sivun lopun avattava tietonäkymä näyttää niiden suunnitteluesimerkin, ei ehdota lukittua API-skeemaa.
- Lomakkeessa on yksi oletusrepo esimerkkidatana; usean oletusrepon editorin yksityiskohdat eivät kuulu tämän akselin ratkaisuun. Automaattihaku ei anna henkilölle GitHub-oikeuksia. Puuttuva oikeus tai haun virhe tarvitsee henkilön näkymässä korjattavan pysähdyksen, ei ohitettua onnistumista.
- Aikarajan sanamuoto on tuotannon tapaan ”päivitetty”. Nykyinen valitsin käyttää `pushed_at`-aikaa, ei viimeisen commitin todistettua aikaa. Jos halutaan nimenomaan commit-ikä, sen tietolähde on ratkaistava toteutussuunnitelmassa.
- Esimerkki sallii repojen ja integraatioiden keskinäisen järjestyksen vaihtamisen. Se ei päätä vapaata vaiheiden uudelleenjärjestelyä tai AI-vaiheen poistamista.
- Muutokset eivät muuta jo liittyneiden työtiloja tai liitoksia. Kesken olevan käyttöönoton suhde muuttuneeseen malliin on vielä ratkaistava. Esikatselu ei väitä näyttävänsä jo aloittaneen henkilön tilaa.
- Palvelimelta tarvitaan vahvistettu ylläpito-oikeus, voimassa oleva käyttöönoton malli, hyväksytyt GitHub-käyttäjät sekä kutsujen odottava/liittynyt-tila ja toimintojen vahvistetut tulokset. Prototyyppi ei päätä näiden tallennuspaikkaa, admission-auktoriteettia, CLI:tä, kutsujen vanhenemista tai olemassa olevien istuntojen poistamista. Ne eivät siirry selaimen tai gatewayn vallaksi tämän vedoksen vuoksi; auktoriteettisuunnitelma tehdään rinnakkaisessa työssä.

## Tuotantokonteksti ja näyttö

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
