# Pilvikansio siltana: missä ja milloin se opitaan

**[Avaa kierros](https://glasspad.example.test/p/iraxuncffrxiqgdoe427j7ncdi/).** Valitse suunta alareunasta (myös näppäimet 1–4 ja nuolet). Yläreunan *Lähtötilanne* vaihtaa tilaa *Dropbox yhdistetty* ja *Ei vielä pilveä* välillä. Kaikki tiedot ovat keksittyjä: henkilö on `aino@example.test`, ja kansio on *Dropbox › Open Habitat*.

## Akseli ja suunnat

Akseli on se, **missä kohtaa** ihminen oppii, että Dropboxin tai OneDriven kansio kuljettaa tiedostoja hänen koneensa ja agentin välillä. Sisältö on kaikissa suunnissa sama: siltarivi *Oma kone ⇄ Dropbox › Open Habitat ⇄ Agentti* ja lyhyt käyttöönotto-ohje (Mac / Windows / Puhelin: asenna sovellus, kansio näkyy Finderissa tai Resurssienhallinnassa, Macilla kuvakaappaukset suoraan kansioon `⇧⌘5` › Valinnat).

1. **Aloitus**: käyttöönoton oma vaihe *Oma kone* Googlen jälkeen. Sivusto voi lisätä sen reitille kuten Googlen. Vaiheessa yhdistetään Dropbox tai OneDrive, kansio avataan omalla koneella ja silta kokeillaan yhdellä tiedostolla. Vaihe odottaa, että kansioon ilmestyy tiedosto (*Tiedosto saapuu* -painike simuloi sen). Ratkaisee: kaikki oppivat asian heti ja kerralla, mutta silloin kun sille ei vielä ole tarvetta, ja sovelluksen asentaminen koneelle on sivupolku keskellä käyttöönottoa.
2. **Liitä**: tarpeen hetkellä. Liitä-valikossa on tavallisen liitteen alla *Oman koneen kansio*. Siinä näkyy kansio, *Kerro agentille* (kirjoittaa kenttään "Katso Dropboxin Open Habitat -kansio.") ja *Koneellani?* -ohje, tai ilman pilveä *Yhdistä Dropbox / OneDrive*. Kokeile myös *Pudota 48 Mt tiedosto*: liian iso liite ohjaa kansioon. Ratkaisee: asia tulee vastaan juuri silloin, kun ihminen yrittää saada tiedoston agentille.
3. **Kortti**: Asetukset › Integraatiot alkaa osiolla *Oma kone*. Dropbox-kortin alla on kansio koneella ja palvelimella, uusin tiedosto, ohje ja *Kokeile siltaa*: agentti kirjoittaa kansioon `Tervetuloa.txt`, ja ihminen vastaa *Näkyy* tai *Ei näy*. *Ei näy* antaa kolme tarkistettavaa asiaa. Ratkaisee: paikka, josta Jari etsi asiaa, ja vianetsintä löytyvät samasta kohdasta. Ihminen oppii asian kuitenkin vain, jos hän menee asetuksiin.
4. **Agentti**: etukäteen ei opasteta mitään. Kun agentti vie tiedostoja pilvikansioon, vastauksessa on kortti *Koneellesi Dropboxin kautta*: polku, tiedostot, synkronoinnin aika ja *Eikö näy koneellasi?*. Kun agentti lukee kansiosta, vastauksen yllä on rivi *Koneeltasi Dropboxin kautta · tiedosto*. Jos pilveä ei ole, agentti kertoo, ettei pääse koneelle, ja vastauksessa ovat yhdistämispainikkeet. Ratkaisee: ihminen oppii asian siitä, mitä agentti tekee, eikä ohjeesta.

## Suositus

**Liitä ja Agentti yhdessä, Kortti tietolähteeksi.** Silta on merkityksellinen vasta, kun tiedoston pitää liikkua, ja silloin ihminen on keskustelussa joko Liitä-valikossa tai pyytämässä agenttia. Nämä kaksi kattavat suunnat *koneelta agentille* ja *agentilta koneelle*. Integraatiokortin *Oma kone* -osio korvaa nykyisen kappaleen ja on paikka, johon molemmat ohjeet viittaavat. Käyttöönottovaihetta en suosittele nyt: vaihe pidentää reittiä kaikille, ja vain osa tarvitsee siltaa ensimmäisenä päivänä. Jos jokin sivusto haluaa sen, sama ohje sopii myöhemmin vaiheeksi.

## Mitä näkymät olettavat hostilta

- **Kansio `Open Habitat`** on tämän kierroksen ehdotus. Nyt Dropbox synkronoi koko tilin kansioon `~/cloud/dropbox/<tili>/`, ja agentti voi kirjoittaa minne tahansa sen alle. Erillinen kansio tekee ohjeesta konkreettisen, ja agentin kirjoitukset pysyvät yhdessä paikassa. Daemon tai agentti luo kansion ensimmäisellä käyttökerralla.
- **20 Mt** on daemonin nykyinen liiteraja (`host-context.md`).
- **Synkronointi:** Dropboxin bisync kulkee noin minuutin välein, joten ohjeessa lukee "noin minuutti". Kortin *Dropboxissa klo 10.42* edellyttää, että daemon kertoo, milloin kansion viimeinen bisync-kierros valmistui.
- **Uusin tiedosto** on kansion uusimman tiedoston nimi ja muokkausaika. Host ei tiedä, tuliko tiedosto ihmisen koneelta, joten näkymä ei väitä sitä.
- **Agentin toimituskortti** johdetaan agentin työkalukutsujen kirjoituspoluista, jos ne osuvat pilvikansioon, ja vastaavasti lukemisista. Kortti ei ole agentin oma väite. Tämä on uusi esitystapa keskustelussa.
- *Kokeile siltaa* kirjoittaa yhden tiedoston synkronoituun kansioon. Kirjoitus on todellinen, ja se näkyy ihmisen muilla laitteilla.
- Ihmisen koneen tilaa (onko asiakasohjelma asennettu, synkronoiko se) host ei voi tietää. Siksi kortit kysyvät *Näkyykö se koneellasi?* eivätkä päättele sitä.

## Sivulöydös

Liitä-valikon popoverilla ei ole tuotannossa enää yhtään tyylisääntöä. Säännöt olivat `LocalFolder.css`:ssä, joka poistettiin kansionjaon mukana (22c53a9b). Kierros palauttaa ne omana ohituksenaan, ja korjaus on kirjattu issueksi (`attachment-menu-lost-styles`).

## Kysymykset Jarille

1. Otetaanko käyttöön oma kansio *Open Habitat* Dropboxissa ja OneDrivessa, vai riittääkö koko synkronoitu juuri?
2. Näytetäänkö Liitä-valikossa *Oman koneen kansio* myös silloin, kun pilveä ei ole yhdistetty? Silloin se on käytännössä kehotus yhdistää.
3. Onko agentin toimituskortti (suunta 4) tarpeeksi arvokas, jotta keskustelu tunnistaa pilvikansioon kirjoittamisen omaksi esitystavakseen, vai riittääkö agentin oma teksti?
4. Pidetäänkö käyttöönoton *Oma kone* -vaihe sivuston valintana myöhempää varten, vai hylätäänkö se?

## Rakentaminen ja tarkistus

```
cd design-system/prototypes/rounds/2026-10-24-pilvikansio-silta
node build.mjs                      # dist/cloud-folder-bridge/{index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node check.mjs <html-tai-url> <kuvakansio>
```

`check.mjs` käy läpi neljä suuntaa kolmella leveydellä (1440, 820 ja 390 px) vaaleana ja tummana, klikkaa vuorovaikutukset ja tarkistaa, että konsoli on puhdas: 66 tarkistuspistettä, sekä paikallinen tiedosto että julkaistu sivu. Komponentit ovat tuotannon omia (`Composer`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`, `AccountCard`, `IntegrationsOverview`, `InlineNotice`, `Segmented`, Kartta-kehyksen tyylit). Kierroksen omia ovat Liitä-valikko (`menu.tsx`, korvaa tuotannon `AttachmentMenu`n rakennuksessa), kehys *Oma kone* -vaiheella (`frame.tsx`) ja yhteiset palat (`bridge.tsx`).

# Kierros 2: käyttöönoton kysymys

**[Avaa kierros 2](https://glasspad.example.test/p/2i3f4jdrwyetfa6tvef2impfse/).** Suunnat ovat alareunassa (myös näppäimet 1–3). Yläreunan *Näkymä* vaihtaa henkilön ja ylläpitäjän *Käyttöönotto*-välilehden välillä. *Lähtötilanne* vaihtaa tilanteiden *Ei pilveä* (henkilö ohitti sivuston Microsoft 365 -vaiheen) ja *OneDrive jo yhdistetty* (hän yhdisti sen) välillä. *Alusta* aloittaa vaiheen alusta. Tiedot ovat keksittyjä.

Jarin päätös 24.10. rajasi kierroksen: vaihe kysyy *Onko sinulla henkilökohtainen Dropbox tai OneDrive?*, eikä sitä kysytä, jos jompikumpi yhdistettiin jo aiemmassa integraatiovaiheessa. Kaikissa suunnissa yhdistäminen käyttää tuotannon Integraatiot-listaa (`IntegrationsOverview` ja tilikortti) kuten nykyinen integraatiovaihe, ohje omalle koneelle on kierroksen 1 Mac/Windows/Puhelin-ohje, ja kokeilussa odotetaan, että kansioon tulee tiedosto.

## Suunnat

1. **Kolme vastausta.** Kortti ennen AI-tiliä. Vastauksia on kolme: *Dropbox*, *OneDrive* ja *Ei ole*. Ohituspainiketta ei ole, koska *Ei ole* on ohitus. Valinnan jälkeen samalla kortilla ovat yhdistäminen, *Avaa kansio koneellasi* ja *Kokeile*. *Ei ole* näyttää yhden rivin: "Voit yhdistää sen myöhemmin: Asetukset › Integraatiot." Reitillä lukee lopuksi *Dropbox · kokeiltu*, *Dropbox* tai *Ei pilveä*. Jos pilvi on jo yhdistetty, reitillä ei ole Oma kone -vaihetta. Sivusto ei aseta vaihetta: se kysytään aina, kun Dropbox tai Microsoft 365 on palvelimella valmis. Ratkaisee: lyhin polku, sillä yksi napautus vastaa ja valitsee.
2. **Kyllä / Ei.** Ylläpitäjä lisää vaiheen reitille kuten integraation. Sitä ei voi tehdä pakolliseksi. *Kyllä* kysyy vielä, kumpi palvelu, ja reitti kasvaa Oma kone -kohdan alle kolmeksi alavaiheeksi: *Yhdistä OneDrive*, *Koneellesi*, *Kokeile*. Jokainen alavaihe on oma sivunsa, ja kokeilun voi ohittaa. *Ei* jatkaa heti. Kysymyksen alla lukee etukäteen, mistä asian löytää myöhemmin. Jos pilvi on jo yhdistetty, vaihe näkyy reitillä valmiina (*OneDrive · yhdistetty*), mutta siinä ei pysähdytä. Ratkaisee: noudattaa samaa sivustomallia kuin muut integraatiovaiheet, ja reitti näyttää koko asennuksen.
3. **Lopuksi.** Viimeinen, valinnainen vaihe AI-tilin jälkeen. Vastaukset ovat *Dropbox* ja *OneDrive*, ja ohitus on *Ei nyt, aloita työ*. Silta kokeillaan agentin kanssa: kun tiedosto tulee kansioon, agentti kertoo, mitä siinä on. Jos pilvi on jo yhdistetty, kysymystä ei esitetä, mutta vaihe tarjoaa ohjeen omalle koneelle ja kokeilun (*Kokeile OneDrive-kansiota*). Sivustolla on kytkin *Kysy / Älä kysy*. *Ei nyt* ohjaa Liitä-valikkoon ja Integraatioihin. Ratkaisee: kokeilu näyttää heti sen, mitä silta tekee, ja kysymys tulee vasta, kun työ voi alkaa.

## Suositus

**Kolme vastausta, mutta sivuston lisäämänä vaiheena kuten suunnassa 2.** Yksi kortti ja kolme vastausta pitävät tekstin lyhyenä ja säästävät yhden kysymyksen. Kun vaiheen lisää ylläpitäjä, se toimii kuten Google ja Microsoft 365 (`onboarding-integration-steps`), eikä uutta automaattista sääntöä tarvita. Jos pilvi on jo yhdistetty, vaihe jätetään pois reitiltä niin kuin päätit. Kokeilun voi ohittaa (*Jatka kokeilematta*), koska tiedoston odottaminen keskellä käyttöönottoa voi jumittaa sen, joka on puhelimella. Agentin kanssa kokeilu (suunta 3) on hyvä idea, mutta se käyttää henkilön AI-tiliä jo käyttöönotossa. Se sopii paremmin ensimmäiseen keskusteluun (kierroksen 1 suunta Agentti).

## Mitä näkymät olettavat hostilta

- *OneDrive* yhdistää koko Microsoft 365 -tilin, siis myös postin ja kalenterin, koska OneDrive on tuotannossa Microsoftin palvelu. Suunta 2 sanoo sen yhdistämissivulla. Erillistä pelkkä OneDrive -kirjautumista ei ole.
- *Jo yhdistetty* päätellään integraatiolistasta: tilillä on palvelu `dropbox` tai `onedrive`. Host ei tiedä, onko OneDrive henkilökohtainen vai työpaikan.
- Kokeilu odottaa tiedostoa kansiossa `Open Habitat` (kierroksen 1 ehdotus). Daemonin pitää kertoa kansion uusin tiedosto, kuten kierroksessa 1.
- Suunta 2 käyttää Kartta-kehyksen `detail`-paikkaa alavaiheille, samaa paikkaa, jossa reitti näyttää repojen haun. Kierroksen kehys on tuotannon kopio, koska tuotanto nimeää jokaisen tuntemattoman vaiheen palveluntarjoajan mukaan.
- Suunta 3 ajaa agentin kehotteen käyttöönotossa, ja siitä tulee henkilölle kustannus.

## Kysymykset Jarille

1. Lisääkö ylläpitäjä Oma kone -vaiheen reitille (suositus), vai kysytäänkö se automaattisesti aina, kun Dropbox tai Microsoft 365 on valmis?
2. Riittääkö työpaikan Microsoft 365 -vaiheessa yhdistetty OneDrive siihen, ettei kysymystä esitetä, vaikka kysymys koskee henkilökohtaista pilveä?
3. Kuuluuko kokeilu tiedostolla käyttöönottoon, vai riittääkö yhdistäminen ja ohje omalle koneelle?
4. Tuleeko vaihe ennen AI-tiliä (suunnat 1 ja 2) vai viimeiseksi (suunta 3)?

## Rakentaminen ja tarkistus

```
cd design-system/prototypes/rounds/2026-10-24-pilvikansio-silta
node r2/build.mjs                   # dist/cloud-folder-bridge-r2/{index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node r2/check.mjs <html-tai-url> <kuvakansio>
```

`r2/check.mjs` käy läpi kolme suuntaa kolmella leveydellä (1440, 820 ja 390 px) vaaleana ja tummana, molemmat lähtötilanteet ja ylläpitäjän näkymän. Se klikkaa vuorovaikutukset ja tarkistaa, että konsoli on puhdas: 96 tarkistuspistettä, sekä paikallinen tiedosto että julkaistu sivu. Komponentit ovat tuotannon omia: `IntegrationsOverview`, `AccountCard`, `ProviderMark`, `ControlButton`, `Segmented`, `UserMessage`, `AssistantMessage`, `Markdown`, Kartta-kehyksen ja Käyttöönotto-välilehden tyylit. Kierroksen omia ovat kehyksen kopio Oma kone -vaiheella (`r2/frame.tsx`) ja ylläpitäjän näkymän rivit. Kumpikin `build.mjs` ohittaa nyt Viten `?url`-tuonnin, koska `DocumentPreview`n PDF-worker katkaisi kierroksen 1 rakennuksen 24.10.

# Kierros 3: Lataukset ja Dokumentit

**[Avaa kierros 3](https://glasspad.example.test/p/cq2icm5ioc7vfvrfzpave6iou4/).** Suunnat ovat alareunassa (myös näppäimet 1–2). *Näkymä* vaihtaa käyttöönoton vaiheen ja keskustelun välillä. Keskustelussa *Pilvi* valitsee Dropboxin tai OneDriven, ja *Varmuuskopio* valitsee, onko varmuuskopio jo päällä. Tiedot ovat keksittyjä.

Jarin päätös 24.10.: erillistä Open Habitat -kansiota ei tehdä. Silta on ihmisen oma varmuuskopio Latauksista ja Dokumenteista. Pohjana on kierroksen 2 *Kolme vastausta* ylläpitäjän lisäämänä vaiheena, ja Dropbox- tai Microsoft 365 -yhteyden jälkeen sitä ei kysytä.

## Mitä palvelut oikeasti tekevät

Tämä ratkaisee suunnat, koska palvelut eroavat toisistaan:

- **OneDriven kansiovarmuuskopio** siirtää Windowsilla Työpöydän, Tiedostot, Kuvat, Musiikin ja Videot ja Macilla Työpöydän ja Dokumentit OneDriveen. Ne ovat tavallisia OneDrive-kansioita, joihin voi kirjoittaa kumpaankin suuntaan. **Latauksia OneDrive ei varmuuskopioi kummallakaan koneella.** Macilla tarvitaan Microsoftin sivulta ladattava OneDrive, koska App Storen versio ei varmuuskopioi. Polku on Asetukset › Varmuuskopio (Windowsilla Synkronointi ja varmuuskopiointi) › Hallitse varmuuskopiota. ([Microsoft: Back up your folders with OneDrive](https://support.microsoft.com/en-us/office/back-up-your-folders-with-onedrive-d61a7930-a6fb-4b95-b28a-6552e77c3057), [macOS](https://learn.microsoft.com/en-us/sharepoint/redirect-known-folders-macos), [Windows](https://learn.microsoft.com/en-us/sharepoint/redirect-known-folders))
- **Dropbox Backup** varmuuskopioi minkä tahansa kotikansion, myös Lataukset. Se kulkee vain koneelta pilveen, eivätkä varmuuskopiot näy koneen Dropbox-kansiossa. Ne ovat dropbox.comissa varmuuskopion nimen alla (*Mac* tai *PC*). Polku on Asetukset › Varmuuskopiot › Hallitse varmuuskopioita. ([Dropbox Backup: overview](https://help.dropbox.com/organize/dropbox-backup-overview), [FAQ](https://help.dropbox.com/organize/dropbox-backup-faq))
- **Kuvakaappaukset:** Mac tallentaa ne Työpöydälle, ja sijainnin voi vaihtaa kohdasta `⇧⌘5` › Valinnat. Windowsin `Win`+`PrtScn` tallentaa ne Kuviin (Kuvat › Näyttökuvat).

## Mistä agentti löytää kansiot

- **OneDrive:** `~/cloud/onedrive/<tili>/Documents/` ja `…/Desktop/`. Nimi voi olla käännetty. Graph-rajapinta tarjoaa siksi Dokumenteille aliaksen `special/documents`, ja sitä käytettäessä nimeä ei tarvitse tietää ([Graph: Get special folders](https://learn.microsoft.com/en-us/graph/api/drive-get-specialfolder)). Työpöydälle aliasta ei ole, joten se löytyy vain nimellä.
- **Dropbox:** Dropboxin API-tuen mukaan varmuuskopio luetaan polusta `/Mac/Downloads` (varmuuskopion nimi ja kansio). Varmuuskopio voi kuitenkin olla omassa nimiavaruudessaan juuren ulkopuolella ([Dropbox-foorumi: using API to access file/folders in Backups](https://community.dropbox.com/en/discussion/638365/using-api-to-access-file-folders-in-backups)). Prototyyppi näyttää polun `~/cloud/dropbox/<tili>/Mac/Downloads/`. Sitä ei ole kokeiltu oikealla tilillä.

## Suunnat

1. **Lataukset.** Ehdotuksesi sellaisenaan: varmuuskopioi Lataukset ja Dokumentit. Dropboxilla molemmat toimivat. OneDrivella silta on vain Dokumentit, ja ohjeessa lukee "OneDrive ei varmuuskopioi Latauksia". Macin kuvakaappaukset ohjataan Latauksiin (Dropbox) tai Dokumentteihin (OneDrive). Kokeilussa ihminen tallentaa tiedoston Latauksiin, ja vaihe odottaa, että agentti näkee sen. Liitä-valikossa lukee *Lataukset koneellasi* ja *Dokumentit koneellasi*, ja *Kerro agentille* kirjoittaa kenttään "Katso uusin tiedosto Latauksistani."
2. **Työpöytä.** Työpöytä ja Dokumentit. Kumpikin palvelu varmuuskopioi ne sekä Macilla että Windowsilla, joten ohje on sama molemmille. Mac tallentaa kuvakaappaukset Työpöydälle valmiiksi. Kokeilu on kuvakaappaus (`⇧⌘3`). Lataukset jäävät sillan ulkopuolelle.

Kummassakin suunnassa agentti toimittaa tiedostot eri paikkaan kuin mistä se lukee. OneDrivella toimitus menee Dokumentteihin, ja OneDrive tuo ne koneelle. Dropbox Backup kulkee vain koneelta pilveen, joten toimitus menee tavalliseen Dropbox-kansioon (*Koneellasi: Dropbox › Laskut 10-2026*). **"Lataukset koneellasi" ei siis ole kummallakaan palvelulla mahdollinen toimituspaikka.** Ilman varmuuskopiota agentti kertoo, ettei näe kansioita, ja Liitä-valikko tarjoaa ohjeen *Laita varmuuskopio päälle*.

## Suositus

**Suunta 2, Työpöytä ja Dokumentit.** Se toimii molemmilla palveluilla ja molemmilla koneilla samalla ohjeella, ja kuvakaappaukset ovat siellä ilman asetusmuutosta. Lataukset ovat hyvä idea, mutta OneDrive ei tue niitä. Dropbox taas edellyttää, että host lukee varmuuskopiota, joka on mahdollisesti eri nimiavaruudessa ja vain luettavissa, ja se on hostille uusi asia. Jos Lataukset halutaan, ne kannattaa lisätä Dropbox-käyttäjille vasta, kun nimiavaruus on kokeiltu oikealla tilillä.

## Mitä näkymät olettavat hostilta

- Daemon tunnistaa varmuuskopioidut kansiot pilvikansiosta ja kertoo kunkin uusimman tiedoston (*Lataukset · myynti-q3.csv · 10.41*). Rivi *Koneeltasi* johdetaan agentin lukupolusta, ei agentin väitteestä.
- Dropboxissa daemonin pitää lukea varmuuskopion nimiavaruutta (rclonen `--dropbox-root-namespace` tai API:n `Dropbox-API-Path-Root`), eikä se saa yrittää kirjoittaa sinne kaksisuuntaisella bisyncillä.
- OneDrivessa Dokumentit haetaan aliaksella `special/documents`, ei nimellä.
- Host ei tiedä, mikä käyttöjärjestelmä ihmisellä on, joten ohjeessa on Mac/Windows-valinta.

## Kysymykset Jarille

1. Työpöytä ja Dokumentit (suositus) vai Lataukset ja Dokumentit, vaikka OneDrive ei varmuuskopioi Latauksia?
2. Kelpaako, että agentti toimittaa Dropbox-käyttäjälle tavalliseen Dropbox-kansioon, vaikka se lukee varmuuskopiosta? Toinen vaihtoehto on, että Dropboxin silta on tavallinen Dropbox-kansio ja Macin selaimen latauskansio ohjataan sinne.
3. Kokeillaanko Dropbox Backupin lukemista testitilillä ennen kuin Lataukset lupaillaan käyttöönotossa?

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-10-24-pilvikansio-silta/r3/build.mjs   # dist/cloud-folder-bridge-r3/{index,offline}.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node design-system/prototypes/rounds/2026-10-24-pilvikansio-silta/r3/check.mjs <html-tai-url> <kuvakansio>
```

`r3/check.mjs` käy läpi molemmat suunnat kolmella leveydellä (1440, 820 ja 390 px) vaaleana ja tummana. Se tarkistaa käyttöönoton vaiheen Dropboxilla ja OneDrivella, Mac- ja Windows-ohjeen ja kokeilun sekä keskustelun eli Liitä-valikon, lukurivin, toimituksen ja puuttuvan varmuuskopion. Konsolin pitää olla puhdas. Tarkistuspisteitä on 108, ja ne ajettiin sekä paikalliselle tiedostolle että julkaistulle sivulle. Komponentit ovat tuotannon omia: `IntegrationsOverview`, `AccountCard`, `ProviderMark`, `Composer`, `ConversationTimeline`, `UserMessage`, `AssistantMessage`, `Markdown`, `Segmented` ja kierroksen 2 Kartta-kehys. Kierroksen omia ovat Liitä-valikko (`r3/menu.tsx`) ja ohje (`r3/bridge.tsx`).
