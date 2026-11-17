# Tulos: otsikko ja ikoni jäävät vanhoiksi isäntäkoneen uudelleenkäynnistyksen jälkeen

## Syy

Tavallinen daemonin uudelleenkäynnistys toipuu jo oikein. Tämän
varmisti tutkiva spesi: daemon ja gateway käynnistetään uudelleen, sivu
avataan uudestaan, ja uuden keskustelun otsikko päivittyy railiin. Vika
syntyy, kun selaimen tapahtumavirta jää auki mutta hiljaiseksi. Näin käy,
kun välissä oleva proxy menettää yhteyden isäntäkoneeseen sulkematta
selaimen virtaa. Muut pyynnöt (luonti, lähetys) kulkevat silloin uusia
yhteyksiä pitkin ja toimivat, joten sivu ei huomannut mitään. Rail
päivittyy vain tapahtumien laukaisemista snapshot-luvuista, joten otsikko
jäi "Uusi keskustelu" -tilaan ja pallo vanhaksi. Daemon lähetti
sydämenlyönnin 20 sekunnin välein, mutta SSE-kommenttina, jota selain ei
näe. Hiljaisuutta ei siis voinut havaita. Repon `reconnect-paths.spec.ts`
kuvasi tämän aukon jo aiemmin; elvytys tapahtui vain lepotilasta
heräämisen tai `online`-tapahtuman jälkeen.

Lisäksi löytyi kaksi muuta vikaa:

- **Otsikkotyö katosi.** Uudelleenkäynnistyksen jälkeen jatkettu keskustelu
  (`acceptedMessages: 4`) ei koskaan aloittanut automaattista nimeämistä.
  Keskustelu, jonka ensimmäinen otsikkotyö katosi daemonin mukana, jäi siis
  pysyvästi ensimmäisen viestin varaotsikolle.
- **Snapshot-silmukka.** Kun uusi daemon-instanssi oli käynnistynyt, vanhan
  instanssin odottava invalidaatio sai selaimen pitämään jokaista uutta
  snapshotia vanhentuneena ja pyytämään uuden (tahdistettuna). Näin jatkui,
  kunnes uuden daemonin järjestysnumero ohitti vanhan.

## Mitä tehtiin

- **Daemon** (`events_linux.go`): sydämenlyönti on nyt nimetty
  `heartbeat`-tapahtuma ilman id:tä. Se ei ole journalin tapahtuma eikä
  liikuta kursoria. Skenaario CT-005 kuvaa tämän sopimuksessa.
- **Selain** (`conversationJournal.ts`): avoin virta, joka ei ole tuonut
  tapahtumaa eikä sydämenlyöntiä 65 sekuntiin, avataan uudelleen
  validoidusta kursorista. Uudelleenkäynnistynyt daemon vastaa 409:llä, ja
  selain lukee tuoreen snapshotin. Vanhalla bundlella ja uudella daemonilla
  nimetty tapahtuma jää huomiotta.
- **Uusi instanssi** kuittaa vanhan instanssin odottavan invalidaation ja
  sovittaa vanhentuneet ikkunat kerran.
- **Velkaotsikko** (`titleOwed`): jatketulla selainkeskustelulla on yksi
  otsikko velkana. Ensimmäinen asettunut vuoro tuottaa sen, jos Pi:n
  historiassa ei siihen mennessä ole nimeä. Olemassa oleva nimi maksaa
  yhden natiiviluvun eikä yhtään mallikutsua. Vain yhteenvetoa varten
  käynnistetty Pi odottaa, kunnes ihminen ottaa sen käyttöön.
- **Testihost:**
  - `/fixture/edge-silence-streams` hiljentää avoimet virrat.
  - `/fixture/title-model` antaa synteettiselle otsikkomallille vastauksen.
    Oletuksena malli ei ole käytettävissä, joten muut testit pysyvät
    ennallaan.
  - Fixture ajaa otsikkoapurin kotihakemistossa.

## Testit

- **Vitest** (`conversationJournal.test.tsx`):
  - hiljainen virta avataan uudelleen, sydämenlyöntejä saava ei;
  - uusi instanssi kuittaa vanhan invalidaation ilman silmukkaa ja sovittaa
    kerran.

  Kaikki kolme uutta tapausta kaatuivat ilman korjausta.
- **Go:**
  - `TestEventStreamHeartbeatIsNamedAndOutsideTheJournal`;
  - `TestTitleLostInRestartIsWrittenAfterContinuation`;
  - `TestOwedTitleWaitsForRecapStartedHandleToBeTakenOver`.

  Molemmat otsikkotestit kaatuivat ilman korjausta. Koko `./internal/daemon`
  ajettiin `test-focused.sh`:lla, ja myös `./test/browser-host` meni läpi.
- **Selain** (`rail-title-restart.spec.ts`):
  - hiljentynyt virta ja uudelleenkäynnistys, jonka jälkeen uusi keskustelu
    saa railiin daemonin tuottaman otsikon ja oikean pallon ilman
    uudelleenlatausta;
  - uudelleenkäynnistyksen otsikotta jättämä keskustelu nimetään, kun sitä
    jatketaan.

  Molemmat kaatuivat ilman korjausta. Spesit `rail-title-restart`,
  `reconnect-paths`, `reconnect-recovery`, `rail-interrupted-turn` ja
  `title-regeneration` ajettiin kolmesti, 57/57 vihreänä. Yhdessä
  aiemmassa ajossa (ennen katselmoinnin korjauksia) yksi tapaus
  kaatui eikä sitä saatu yksilöityä tulosteesta. Myöhemmissä
  kolmen toiston ajoissa samat spesit menivät kaikki läpi.
- `./scripts/test-web-fast.sh` ja `--area contracts` menivät läpi.
- **Katselmointi:** riippumaton `/llm-review` (GPT Astra löysi
  vikaehdokkaat, Claude Fable vastasi kohdennettuun kysymykseen) ja
  `/assess-findings`. Kaksi vahvistettua löydöstä korjattiin testeineen:
  yhteenvetoa varten käynnistetty Pi ja ohitettu `reconcileStale`.

## Rajat

Live-ympäristön proxyreittiä, joka jätti virran hiljaiseksi, ei voitu
todentaa; fixture mallintaa sen. Jos tapaus olikin jokin muu
uudelleenkäynnistyspolku, se on jo katettu: tavallinen daemonin ja
gatewayn uudelleenkäynnistys toipui jo ennestään.

## Päätökset myöhempää tarkistusta varten

- **Hiljaisuusraja 65 s** (kolme sydämenlyöntiä ja vähän varaa).
  - Vaihtoehdot: lyhyempi raja, joka vaatisi myös tiheämmän
    sydämenlyönnin, tai pelkkä säännöllinen uudelleenavaus.
  - Perustelu: ei lisää liikennettä, ja vanhentunut näkymä korjautuu
    noin minuutissa.
- **Velkaotsikko syntyy vasta, kun keskustelua jatketaan**, ei daemonin
  käynnistyessä kaikille nimettömille historioille.
  - Vaihtoehto: nimetä käynnistyksessä, mikä vaatisi kylmän Pi:n jokaiselle
    nimettömälle historialle.
  - Perustelu: käynnistyksessä nimeäminen olisi raskasta ja koskisi myös
    vanhoja keskusteluja. Jatkamaton keskustelu pitää ensimmäisen viestin
    varaotsikkonsa.
- **Sydämenlyönti nimettynä SSE-tapahtumana journalin ulkopuolella**, ei
  journalin tapahtumalajina.
  - Vaihtoehto: journalin tapahtumalaji.
  - Perustelu: journalin lajina se kuluttaisi järjestysnumeroita ja
    replay-puskuria. Muutos on lisäys v1-sopimukseen, jonka vanha bundle
    ohittaa.
