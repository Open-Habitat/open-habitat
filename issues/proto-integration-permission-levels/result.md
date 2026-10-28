# Integraation oikeustaso – kierroksen tulos

Kokeiluopas kuvineen on [NOTES.md](NOTES.md):ssä. Valinta on Jarin, joten
issue jää avoimeksi (`preparation: pending`). Tuotantokoodi ei muuttunut.

Prototyyppi on yksi käsin kirjoitettu offline-tiedosto,
`prototype/index.html`. Lähteinä ovat `prototype/app.js`, `prototype/surface.css` ja
`prototype/build.py`. Rakennus tehdään komennolla
`python3 issues/proto-integration-permission-levels/prototype/build.py`, ja
tarkistus ja kuvat komennolla
`TMPDIR=<scratch> PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-integration-permission-levels/prototype/check.mjs`.
Tarkistus käy jokaisen suunnan läpi työpöydällä ja puhelimessa, vaaleana ja
tummana. Se tekee yhdistämiset, tason vaihdot, rajatun tilanteen ja
poistot ja varmistaa, ettei sivu vuoda vaakasuunnassa, ettei verkkopyyntöjä
lähde ja että konsoli on puhdas. Valitsimen tarkistus on
`design-system/prototypes/picker-check.mjs`. Viimeisin ajo meni läpi ja tuotti 44 kuvaa
(2×, AVIF) hakemistoon `screenshots/`.

## Akseli ja suunnat

Akseli on se, **kuka päättää oikeuksista ja kuinka tarkasti**. Kaikissa
suunnissa ovat samat tilit, synteettinen data, varoitus siitä, mitä taso ei
estä, organisaation rajaama tilanne, Myönnetyt oikeudet -luettelo ja
tuotannon nykyinen sivurunko.

| Suunta | Yhdistettäessä | Jälkikäteen | Mitä se päättää |
|---|---|---|---|
| **1 Tilitaso** | Tasot kortteina. Kortti, jota palvelu ei tarjoa, näkyy harmaana ja syy kerrotaan. Microsoftilla on lisäksi valinta *Tiedostot vain valituista kansioista*. | Tason nimi kortin otsikossa (*Vain luku*, *Luonnokset, ei lähetystä*, *Täysi, ilman: Gmail*) ja sen vaikutus jokaisella palvelurivillä. *Vaihda taso…* avaa saman valinnan, ja siinä näkyvät vanha ja uusi taso sekä vaihdon seuraukset. | Yksi palveluntarjoajan valvoma taso tiliä kohden. Taso luetaan myönnöstä. |
| **2 Palveluittain** | Valitsin jokaiselle palvelulle. Googlella jokainen palvelu valitaan erikseen. Microsoftilla taso valitaan postille, ja muut palvelut seuraavat sitä. Dropboxilla on yksi rivi, IMAPilla lähetys päälle tai pois. | Tason merkki jokaisella palvelurivillä. *Muuta oikeuksia…* avaa saman valinnan. | Tarkin valinta. Microsoft ei pysty siihen ilman sovellusta jokaiselle yhdistelmälle, joten valinta on Googlella hienojakoisempi kuin muilla. |
| **3 Myönnöstä** | Habitat pyytää kaiken ja kertoo palvelukohtaisesti, voiko kirjautumissivulla rajata. Googlen suostumussivulla palvelun voi jättää pois. | Jokaisella palvelulla näkyy ✓/✗-luettelo myönnetystä (*Lukee, Luonnokset, Lähettää*). Jos jokin jätettiin myöntämättä, siitä on huomautus. Oikeuksia muutetaan kirjautumalla uudelleen. | Pienin muutos (selvityksen vaihtoehto C). Henkilö ei voi valita tasoa Microsoftilla eikä Dropboxilla eikä vaihtaa Gmailia pelkkään lukuun. |

Kaikille yhteinen sisältö, joka ehdotetaan speksiksi valitusta suunnasta
riippumatta:

- **Mitä taso ei estä**: sivun yläosassa, nykyisen agenttivaroituksen
  tilalla. Taso on palvelun oma raja, joten se pitää myös erehtyvää tai
  ohjailtua agenttia vastaan. Se ei kuitenkaan estä seuraavia:
  - Agentit ajavat henkilön käyttäjänä ja voivat lukea kirjautumistiedot.
    Jos ne päätyvät muualle, niillä voi tehdä saman kuin agentti, ei enempää.
  - Agentti voi kertoa eteenpäin kaiken, mitä se saa lukea.
  - Työkalujen "turvatilat" ovat ohjeita.

  Yhdistämisikkunan varoitus seuraa valittua tasoa: täydellä tasolla
  kerrotaan, mitä agentti voi lähettää ja muuttaa, ja vain luku -tasolla,
  että agentti voi silti kertoa lukemansa eteenpäin.
- **Organisaation rajaama myöntö hyväksytään.** Kortti kertoo, kuka rajasi ja
  mitä puuttuu (*postin lähetys sekä kalenterin, yhteystietojen ja tiedostojen
  muokkaus*), ja että rajaus muutetaan organisaation Entra- tai
  Workspace-hallinnassa. Tasoksi näytetään se, mitä myönnettiin.
- **Vain luku -tiedostot ovat peili.** Riville kirjoitetaan, että muutokset
  eivät palaa palveluun ja kirjoittuvat yli.
- **IMAP ilman lähetystä**: Habitat kokeilee, kelpaako salasana
  lähetykseen, ja kertoo, onko raja aito.
- **Myönnetyt oikeudet** -luettelo näyttää scopet palvelun omin nimin, ja
  puuttuvat on merkitty *pyydettiin, ei myönnetty*. Luettelo on IT:lle ja
  tarkistamista varten.

## Suositus: 1 Tilitaso

- Jokainen taso vastaa yhtä rajaa, jonka palveluntarjoaja oikeasti toteuttaa.
  Microsoftilla taso on Entra-sovellus, Dropboxilla sovellus tai scope-joukko
  ja Googlella scope-joukko. Siksi lupaus pitää, ja käyttöliittymä on sama
  kaikilla palveluilla.
- Tasoja on yhdestä kolmeen palvelua kohden. Harmaa kortti kertoo
  rehellisesti, mitä palvelu ei tarjoa: Gmailin luonnokset ja IMAPin vain luvun.
- Jälkikäteen tilin oikeudet näkee yhdellä silmäyksellä kortin otsikosta,
  ja palvelurivit kertovat yksityiskohdat.

Palveluittain tuo lisää valintoja vain Googlelle. Microsoftilla se on
käytännössä sama kuin Tilitaso, mutta ikkuna näyttää monimutkaisemmalta.
Myönnöstä on halvin ja kannattaa toteuttaa ensin perustaksi, koska
kapeamman myönnön hyväksyminen ja myönnön lukeminen kuuluvat kaikkiin
suuntiin. Yksin se ei kuitenkaan anna henkilölle valintaa Microsoftilla eikä
Dropboxilla, eikä se vastaa pyyntöön "luonnoksia mutta ei lähetystä", ellei
organisaatio rajaa oikeuksia.

Toteutusjärjestykseksi ehdotan selvityksen mukaisesti: ensin myönnön
lukeminen ja kapeamman myönnön hyväksyminen, sitten Tilitason valinta
Microsoftille ja Dropboxille ja lopuksi Googlelle.

## Host-tiedot suunnittain

*On* = koodissa nyt. *Ei* = toteutus tuottaa. Mikään suunta ei siirrä
valtaa gatewayn, daemonin ja provisionin välillä eikä tuo uutta tallennetta.
Taso luetaan aina myönnöstä eikä erillisestä tietueesta.

| Tieto | 1 | 2 | 3 | Onko olemassa |
|---|---|---|---|---|
| Myönnön lukeminen palvelukohtaiseksi kyvyksi (Googlen tokenivastauksen `scope`, Microsoftin `scp`, Dropboxin scopet) listaan `Service`-riveille | ✓ | ✓ | ✓ | **Ei.** Daemon tarkistaa scopet vain hylätäkseen (`googleScopes` `google_linux.go`:ssä, `Files.ReadWrite.All` `microsoft_linux.go`:ssä). `catalog_linux.go`:n `Service`-rakenteessa ei ole kykykenttää. |
| Kapeamman myönnön hyväksyminen, puuttuva palvelu merkitään (`none`) | ✓ | ✓ | ✓ | **Ei.** Nyt koko kirjautuminen hylätään. |
| Organisaation nimi rajaushuomautukseen | ✓ | ✓ | ✓ | **Osittain.** Tenant tunnetaan (`microsoft_tenant_linux.go`), mutta näyttönimi ei. Jos nimeä ei saada, teksti voi olla "Organisaatiosi on rajannut…". |
| Pyydetyn ja myönnetyn ero ("pyydettiin, ei myönnetty") | ✓ | ✓ | ✓ | **Ei.** Microsoftilla pyydetty taso selviää sovelluksesta (`azp`/`appid` → taso), Googlella pyydetty scope-joukko on daemonin oma vakio. Tallennetta ei tarvita. |
| Tasokohtaiset scope-joukot pyynnössä | ✓ | ✓ (per palvelu) | – | **Ei.** `googleScopes` ja Microsoftin listat ovat kiinteitä. |
| Microsoftin sovellus tasoa kohden `integrations.json`issa ja brokerin `Valid`-säännössä | ✓ | ✓ (vain postin taso) | – | **Ei.** `integrationapps` tuntee yhden sovelluksen palveluntarjoajaa kohden. Tämä on muodon muutos, ei vallan siirto. |
| Dropboxin sovelluskansiosovellus | ✓ | ✓ | – | **Ei.** Tarvitaan toinen Dropbox-sovellus. Vain luku onnistuu samalla sovelluksella. |
| Microsoftin valittujen kansioiden taso (`Files.SelectedOperations.Selected`) | ✓ | ✓ | – | **Ei**, ja todentamatta: rclonen käytös tällaisella tokenilla on avoin. Tämä voidaan jättää pois ensimmäisestä toteutuksesta. |
| Palvelimen tarjoamat tasot `Provider`-tiedossa (harmaa kortti ja syy) | ✓ | ✓ | – | **Ei.** |
| Yksisuuntainen peilisynkronointi vain luku -tiedostoille | ✓ | ✓ | – (vain jos organisaatio rajaa) | **Ei.** Nyt käytössä on vain bisync. |
| Viimeinen kaksisuuntainen synkronointi ennen siirtymistä peiliin | ✓ | ✓ | – | **Ei.** |
| Vanhan kirjautumisen peruminen tason vaihdossa (Googlen ja Dropboxin revoke-rajapinta; Microsoftilla ei yksittäistä perumista) | ✓ | ✓ | ✓ | **Ei.** Nyt ei peruta edes poistettaessa (`handler_linux.go`, `remove`). |
| SMTP-kokeilu IMAP-tilille, jolta lähetys puuttuu | ✓ | ✓ | ✓ | **Osittain.** Himalaya tarjoaa tarkistuksen `account check --backend smtp`, mutta tuote ei käytä sitä eikä erota tilannetta "ei lähetysoikeutta" virheestä. |
| ms-365-mcp-serverin `--allowed-scopes` johdettuna myönnöstä | ✓ | ✓ | ✓ | **Ei.** Lista on kiinteä (`microsoftMCPScopes`). |
| Googlen suostumussivun palvelukohtainen poisjättö | – | – | ✓ | **On** Googlen puolella. Tuote hylkää sen nyt. |

## Päätöksiä myöhempää tarkistusta varten

- **Luonnokset, ei lähetystä -taso tekee kalenterin, yhteystiedot ja tiedostot
  vain luku -tilaan.** Vaihtoehto olisi, että vain posti rajataan. Valitsin
  tämän, koska selvityksen mukaan kalenteritapahtuma lähettää kutsuja ja
  tiedosto-oikeus voi luoda julkisen jakolinkin. Tasoon kuuluu siis lupaus
  "tililtä ei lähde mitään", ja sen voi pitää vain näin.
- **Vain luku on harmaana IMAPilla ja CalDAVilla.** Vaihtoehtoja olisivat
  piilottaminen tai Habitatin oma ohje. Sovellussalasana ei rajaa
  lukemiseen, ja ohje ei ole raja. Julkaistu ICS-osoite antaisi aidon vain
  luku -kalenterin, mutta se on eri integraatio eikä kuulu tähän.
- **Tason vaihto peruu vanhan kirjautumisen Googlella ja Dropboxilla.**
  Vaihtoehto on jättää se voimaan kuten nyt poistossa. Kavennus ei ole aito,
  jos vanha laaja token jää voimaan. Googlen revoke peruu koko myönnön
  asiakkaalle, joten järjestys on ensin peruminen ja sitten uusi
  kirjautuminen. Microsoftilla yksittäistä refresh tokenia ei voi perua, ja
  ikkuna sanoo sen.
- **Peiliin siirryttäessä tehdään viimeinen kaksisuuntainen synkronointi.**
  Vaihtoehto olisi varoittaa, että tallentamattomat muutokset katoavat.
  Valitsin synkronoinnin, koska henkilö ei voi tietää, mitkä muutokset ovat
  vielä palvelussa.
- **Taso luetaan myönnöstä, eikä henkilön valintaa tallenneta.** Jos
  organisaatio kaventaa myöntöä, tasoksi näytetään se, mitä myönnettiin.
  Ero pyydettyyn päätellään sovelluksesta tai pyynnön vakiosta. Tämä
  noudattaa periaatetta, ettei rakenneta toista totuuden paikkaa.
- **Microsoftilla Palveluittain sitoo muut palvelut postin tasoon.**
  Vaihtoehto olisi Entra-sovellus jokaiselle yhdistelmälle. Siitä tulisi
  operaattorille kohtuuton määrä sovelluksia.
- **Palvelimella on vain Täysi-tason Microsoft-sovellus.** Muut tasot ovat
  harmaina ja ohjaavat palvelimen ylläpitäjälle. Näin selvityksen mukaan
  käy, kunnes joku pyytää toista sovellusta.
- **Kirjautumissivut ovat sijaisia.** Tuotannon kirjautumisvaiheet (laitekoodi
  ja liitetty osoite) eivät muutu, joten prototyyppi ei toista niitä.
- **GitHub ja Gitea eivät ole mukana.** Ne kuuluvat Koodipalveluihin.
  GitHubin kavennus on selvityksen mukaan erillinen yhdyskäytävää koskeva
  päätös.

## Kysymykset Jarille

1. Tilitaso, Palveluittain vai Myönnöstä? Suosittelen Tilitasoa ja sen
   perustaksi Myönnöstä-suunnan myönnön lukemista.
2. Hyväksytkö, että Luonnokset, ei lähetystä -taso tekee myös kalenterista ja
   tiedostoista vain luku -tilaiset?
3. Saako tason vaihto perua vanhan kirjautumisen palvelussa? Jos saa, pitäisikö
   myös poiston tehdä niin?
