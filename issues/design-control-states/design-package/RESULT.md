# Kontrollien ja agenttitilojen paketti — koottu, toimitus kesken

Paketti koottiin [pyynnöstä](REQUEST.md) commitissa `1efd34d36acb753a207915be8121dc1b2a53fc94`. Se sisältää tuotantokomponentit ja story-tiedostot, tokenit, nykyiset vedokset (myös `Navigaatio ja asetukset.dc.html`), tuotteen ja käyttöliittymän kuvaukset sekä `refine-agent-status`-analyysin, `consistent-control-feedback`-tutkimuksen ja tämän kierroksen issuen. Aineistoa ei ole lähetetty design-työkaluun eikä designerin palautusta ole arvioitu.

Synteettinen labikaappaus onnistui 84/84 toistettavassa esityksessä (neljä näyttö-/teemayhdistelmää); kaappausvirheitä ei jäänyt. 24 tilalla ei ole erillistä toistettavaa labipolkua, yhteensä 96 esitysaukkoa. Mukana ovat esimerkiksi kontrollien vuorovaikutustilat, agentin uusi/nähty huomio, vain luku sekä agentin toiminnan ja lähetys-/yhteysvirheen yhdistelmät. `rendered-pages/COVERAGE.md` listaa jokaisen aukon sekä kaikki sovittamattomat tiedosto-, story- ja vedosvastaavuudet. Aukkotila ei ole onnistunut kaappaus. `rendered-pages/index.html` avaa tuotetut offline-HTML-palaiset ja PNG-parit.

Kokoajan oma credential-scan meni läpi. Lähdecommit, manifestin lähdetiedostojen tavut, zipin kaikki 280 jäsentä, esitysten lukumäärä, synteettinen indeksin kattavuus ja zipin CRC tarkistettiin. Briefin nimettyjen lähdetiedostojen polut ja `REQUEST.md`-linkki tarkistettiin. `git diff --check` sekä JSON-inventaarion jäsennys menivät läpi. Täyttä CI-gatea ei ajettu dokumentti-/inventaariopakettia varten.

**Toimitus ei onnistunut:** `tw doctor` näytti serveriksi aldern mutta `reverse.client` ilmoitti ettei liitettyä thin clientia tunnisteta; `tw client` palautti `No attached thin client detected`. Siksi zipiä ei kopioitu eikä Downloads-polusta tai vastaanottajan koneella olevasta tavumäärästä/tiivisteestä väitetä mitään. Paketti säilytettiin alderlla palautettavaksi:

- `/var/tmp/nah-control-state-package/design-control-states.zip`
- Koko: **12 021 150 tavua**
- SHA-256: `f1834b38e3213665e47f71654562772b44cebc0fecd118e109018cea4245658e`

Kun liitetty kone näkyy `tw doctor`- ja `tw client`-komennoissa, kopioi zip skillin `scp … "$(tw client)":Downloads/` -kanavalla ja tarkista koko sekä SHA-256 kohteessa. Toimituksen puuttuminen estää tämän workerin merge-toiminnon; kierroksen issue pysyy auki.

## Työkalupoikkeamat

- Ensimmäinen inventaariokaappaus keskeytyi heti: paikallisesta Playwright-cachepolusta puuttui version 1243 Chromium headless shell. Asensin tämän projektin Playwright-version Chromiumin välimuistiin ja ajoin kaappauksen uudelleen onnistuneesti. Lab käynnistettiin `NAH_PORT_BASE=20000`-asetuksella, pysäytettiin kaappauksen jälkeen eikä mitään oikeaa käyttäjädataa kerätty.
- Kokoajan yksikkötesteistä 4/6 onnistui; kaksi epäonnistui, koska niiden odottama manifestin englanninkielinen sanamuoto (`No tracked self-contained lab HTML`, `21 tracked HTML snapshots; 0 tracked images`) ei enää vastaa nykyisen kokoajan sanamuotoa. Varsinainen kokoonpano, manifesti, zip ja sisältö tarkistettiin yllä itsenäisesti. Testien teksti-assertiot jäävät erilliseksi työkalukorjaukseksi; tämä poikkeama ei osoita paketin sisältövirhettä.
