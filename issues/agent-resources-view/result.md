# Tulos: Agentin käytössä (kokeellinen)

Kokeellinen ominaisuus *Agentin käytössä* (Asetukset › Kokeelliset
ominaisuudet). Päällä ollessaan sivupalkissa on Etusivun alla rivi, joka avaa
reitin `/resources`.

- **Lista on kierroksen 1 B Lajeittain:** Tiedostot, Posti, Kalenteri,
  Yhteystiedot, Koodi ja Koneet; jokaisen alla kaikkien tilien lähteet
  tasopillereineen ja lopussa yhdistämättömät palvelut *Yhdistä*-linkillä
  asetusten riville (Koneissa *Lisää*). Yläosassa yhteenveto ja *Yhdistä
  palvelu*. Tietokoneella lista ja valittu lähde rinnakkain (oletuksena
  ensimmäinen), puhelimessa lista ensin ja lähde omana ruutunaan
  *‹ Agentin käytössä* -paluulla. Reitti (`?source=…&folder=…`) on valinnan
  ainoa muisti.
- **Lähteen sisältö on kierroksen 3 C Vain rajat:** otsake (tili, osoite,
  taso, *<Tili>-asetukset* juuri sen tilin riville, *Avaa …* palveluun),
  *Mukana*, *Ei mukana* (harmaat rivit, korjattavissa olevilla toiminto) ja
  *Agentti saa* ✓/✗ ja *Ei voi estää*. Postille, kalenterille, yhteystiedoille
  ja koodille lause *Viestit näet Outlookissa. Agentti avaa ne vasta, kun
  pyydät.* Koneelle tila, käyttäjä, järjestelmä ja päättymispäivä.
- **Tiedostot-lajissa synkronoitua kansiota selataan** henkilön omana
  käyttäjänä: kansiot ensin, kansio avautuu paikallaan ja murupolku palaa.
  Vain nimet, koot ja ajat, ei sisältöä. Agentin luoma tiedosto näkyy
  siellä kuten muutkin.

## Host

Uusi daemonin luku `GET /api/v1/integrations/files`
(`contracts/v1/integration-files.schema.json`), integraatioluettelon
handlerissa, selaimen reitti vain portin kautta (ei agentin kuuntelijassa):

- ilman kyselyä se luettelee juuret: kunkin yhdistetyn tilin
  synkronointihakemistot (`SyncEntry.Directories` tilin omista tiedostoista,
  ei verkkoa) jotka ovat nyt olemassa henkilön omina hakemistoina
  (`openHomeDir`: ei linkkiä, oma UID, ei muiden kirjoitettavissa); enintään
  256 vastauksessa;
- `?directory=<juuri>&folder=<polku>` lukee yhden kansion: hakemiston pitää
  olla täsmälleen jokin juurista, kansio avataan yhdellä `openat2`-kutsulla
  `RESOLVE_BENEATH|RESOLVE_NO_SYMLINKS|RESOLVE_NO_XDEV`, merkinnät `statx`illa
  ilman linkin seuraamista; linkit, erikoistiedostot ja liitospisteet
  lasketaan kohtaan `unlisted`. Enintään 5000 nimeä luetaan ja 500
  palautetaan.
- portti hyväksyy vain kolme kyselymuotoa (ei mitään / directory /
  directory+folder) eikä lue niitä muuten; `/resources` lisättiin tunnettuihin
  UI-reitteihin ja kirjautumisen paluukohteisiin.

Muu näkymä rakentuu selaimessa olemassa olevista vastauksista:
integraatioluettelo (tilit, tasot, palveluiden `access`), Omat koneet
(`/api/v1/own-machines`), snapshotin `native_github` sekä luettelon Gitea- ja
GitLab-yhteydet. Ei uutta tietovarastoa eikä lukureittiä palveluihin.

## Tarkistus

- Go: `TestFilesReadStaysInsideConnectedSyncDirectories` (linkki ulos,
  puuttuva, `..`, ylimääräiset ja toistetut parametrit, toinen hakemisto,
  juuren alikansio juurena, linkki juurena, valtuuttamaton), raja-testi,
  portin `TestGatewayIntegrationFilesQueryShapes`, paluureittitesti; paketit
  integrations, gateway, daemon ja browser-host kokonaan.
- Sopimus: esimerkit ja hylkäystapaukset `validate-contracts.py`ssä.
- Web: yksikkötestit (`agentResources.test.ts`), kaikki 1338 web-testiä,
  biome, tsc.
- Selain (synteettinen host, sama UID): `agent-resources.spec.ts` (työpöytä,
  puhelin, pois päältä, axe), `settings-experimental`, `settings-search`,
  `integrations`. Todisteet `evidence/` (kuva + HTML).
- Katselmointi: riippumaton `/llm-review` (gpt-6-astra etsijä,
  claude-fable-5-1 tarkistaja) ja `/assess-findings`: kolme löydöstä, kaikki
  korjattu tässä työssä (bind-liitos ohitti laitevertailun → `openat2`
  `RESOLVE_NO_XDEV`; juurilla ei ollut kokonaisrajaa; epäonnistunut juurien
  luku näytti tyhjältä → oma virhe ja *Yritä uudelleen*).
- Ei todistettu: oikea bind-liitos (vaatii oikeudet), oikeat palvelut ja
  kahden UID:n erottelu (VM-skenaariot).

## Päätökset myöhempää katselmointia varten

- **SharePoint-kirjastot nimetään *SharePoint 1, 2…*.** Kirjaston ja sivuston
  nimet eivät ole talletettuina koneella (hakemistonimi on tiiviste), ja
  nimen haku olisi uusi Graph-luku sivua avattaessa, jota ei haluttu.
  Vaihtoehto: tallentaa nimet yhdistettäessä rclone-asetukseen.
- **GitHubin ja Gitean *Mukana* ilman repomääriä.** Määrät vaatisivat
  GitHub- ja Gitea-kutsut sivua avattaessa; näkymä sanoo *Kaikki repot,
  joihin sinulla on pääsy* ja ohjaa palveluun. Gitean ja GitLabin *Pushata*
  näytetään sallittuna, koska taso ei koskaan väitä vähempää kuin tunnus voi
  (lukutunnuksen tieto on Koodipalveluissa).
- **Microsoftin jaettu postilaatikko -rivi jätettiin pois**, koska se oli
  prototyypissä tarkistamaton oletus Microsoft-yhteyden laajuudesta.
- **Jakolinkki ja kalenterikutsut ovat *Ei voi estää*** täydellä tasolla
  (Microsoft, Google, koko Dropbox), samoin GitHubin reporajaus ja palvelimen
  ylläpitäjän pääsy koneelle; macOS-koneelle *Työpöytä, Dokumentit ja Mail*
  kuten Omat koneet -dialogi sanoo.
- **Lukematon taso lasketaan täydeksi** (ei koskaan väitetä vähempää);
  `access: none` -palvelu näkyy lähteenä *Ei mukana* ja *Vaihda taso*.
- **Sivupalkin rivillä ei ole lähteiden määrää eikä alaotsikkoa** (prototyypin
  *13* ja *Tilit, tiedostot, koodi ja koneet*): määrä vaatisi koko
  integraatioluettelon, joka tarkistaa jokaisen tilin, joka sivulla.
- **Pistetiedostot näytetään** kansiossa; agentti näkee ne myös.
- **Kansion selaus ei avaa tiedostoja** (ei esikatselua), koska C:n mukaan
  sisältö katsotaan palvelussa; selaus näyttää vain, mitä kansiossa on.
