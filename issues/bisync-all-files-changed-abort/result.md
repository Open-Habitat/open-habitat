# Tulos: kaikkien tiedostojen muokkaus ei enää pysäytä synkronointia

**Mikä tarkistus laukesi.** bisyncin "Safety abort: all files were changed"
(`cmd/bisync/operations.go`, rclone v1.71.2). Se laukeaa, kun *yhtään*
edellisen listauksen merkintää ei löydy muuttumattomana jommaltakummalta
puolelta. Kansio lasketaan muuttumattomaksi merkinnäksi, joten käytännössä
tämä osuu vain litteisiin kirjastoihin, joissa ei ole alikansioita (todettu
kokeella: yksikin alikansio estää keskeytyksen). bisync tarkistaa ensin
poistojen määrän (`--max-delete 50`, prosentteina) ja vasta sitten tämän;
`--force` ohittaa molemmat.

**Korjaus.**

1. Keskeytys saa oman syyn `all_changed` (sopimus, kortin teksti *Kaikki
   tiedostot muuttuivat kerralla, tarkistetaan ja jatketaan*). Aiemmin se oli
   nimetön `pass_failed`.
2. Kun kierros päättyy tähän keskeytykseen, valvoja käynnistää silmukan
   uudelleen ja kertoo sille (`OPEN_HABITAT_FORCE`), mitkä kierrokset
   jatketaan. Daemonin lokiin tulee
   `integration_sync outcome=resuming reason=all_changed`.
3. Silmukka ajaa ensin saman bisyncin `--dry-run`-tilassa ilman `--force`a.
   `--force` lisätään vain, jos koeajo pysähtyi yhä tähän keskeytykseen
   *eikä* liian moneen poistoon. Muuten kierros ajetaan tavallisena, jolloin
   todellinen joukkopoisto pysähtyy `delete_limit`-syyhyn kuten ennenkin.
4. Pakotus koskee vain ensimmäistä kierrosta ja vain kaksisuuntaista
   kierrosta (ei peiliä). Seuraava tulos (onnistuminen tai muu syy) poistaa
   merkinnän, joten yksi keskeytys johtaa korkeintaan yhteen pakotettuun
   kierrokseen.

Kummankaan puolen muutokset eivät katoa: tiedosto, jota on muutettu
molemmissa päissä, on ristiriita (pilven versio pitää nimensä, agentin versio
tulee viereen, ks. `bisync-conflict-renames-cloud-file`), eikä bisync poista
muutettua tiedostoa.

**Testit** (oikea rclone v1.71.2, `OH_TEST_RCLONE`):
`TestBisyncAllFilesChangedResumesSafely` toistaa keskeytyksen, osoittaa
koeajon estävän joukkopoiston pakotetussa kierroksessa (pilvi
koskematon) ja sen jälkeen valvojan kautta, että agentin muokkaukset
nousevat pilveen, kollegan samanaikainen muutos säilyy ristiriitakopiona,
kortti palaa tilaan `ok` ilman virhettä ja loki nimeää syyn. Vanhalla
koodilla testi epäonnistui: pilvi jäi vanhaan sisältöön ja kortissa luki
`pass_failed`. Yksikkötesteissä luokittelu ja `forced()` (vain oikeat
kierrokset, vain kerran).

## Päätökset myöhempää tarkistusta varten

- **Kynnys: ei tiedostomäärärajaa, vaan poistotarkistus juuri ennen
  pakotusta.** Vaihtoehdot olivat (a) erillinen *Synkronoi silti* -toiminto
  kortissa, (b) `--force` vain pienille kirjastoille, (c) tämä. Valitsin
  (c):n, koska keskeytys osuu vain litteisiin kirjastoihin, pakotettu
  kierros ei hävitä muokkauksia, ja Microsoftin oma asiakas synkronoi
  vastaavan muutoksen ilman pysähdystä. (a) vaatisi ihmisen käymään
  asetuksissa joka kerta, kun agentti muotoilee kansion uudelleen; (b)
  jättäisi isommat litteät kansiot pysähtyneiksi pysyvästi. Hinta: jos
  kaikkien tiedostojen aikaleimat siirtyvät (esim. palautus
  varmuuskopiosta), muuttuneet tiedostot kopioidaan toiselle puolelle; pilven
  versiohistoria säilyttää edelliset.
- **Jäljelle jäävä kilpailutilanne.** Poistotarkistus ja pakotettu kierros
  ovat kaksi erillistä rclone-ajoa. Jos joku poistaa yli puolet tiedostoista
  niiden välissä (litteällä kirjastolla sekunteja: koeajon ja varsinaisen
  ajon listaukset), pakotettu kierros vie poistot toiselle puolelle ilman
  joukkopoistosuojaa. Poistetut tiedostot ovat palveluntarjoajan
  roskakorissa (pilvestä poistettaessa) tai pilvessä/sen roskakorissa
  (paikallisesti poistettaessa). Ikkunaa ei saa suljettua ilman rclonen
  muutosta, joka ohittaisi vain kaikki-muuttuneet-tarkistuksen. Katselmointi
  nosti tämän must-fixiksi; arvioin sen hyväksyttäväksi, perustelut alla.
- **Kortin tila.** `all_changed` näkyy kortissa vain hetken, valvojan
  uudelleenkäynnistyksen viiveen ajan; jos koeajo löytää joukkopoiston,
  kortissa näkyy `delete_limit` ohjeineen kuten ennenkin.
- **Agentin ohjetta ei muutettu.** Teksti kieltää agenttia ohittamasta
  bisyncin suojia `--force`lla; se pitää yhä paikkansa, koska daemon tekee
  tämän ainoan ohituksen itse ja tarkistuksen kanssa.

## Katselmointi

Kriittinen taso (tietojen menetys, suojan ohitus): `/llm-review` (etsijä
gpt-6-astra, tarkistaja claude-fable-5-1) ja `/assess-findings`. Ainoa löydös
oli yllä kuvattu kilpailutilanne (DROP 1b: harvinainen, korjaus veisi
automaattisen jatkamisen). Tarkistaja ajoi generoidun skriptin dashilla ja
bashilla hankalilla argumenteilla eikä löytänyt virheitä lainauksista,
kierrosindekseistä, koeajon lukoista tai listauksista, pakotuksen
toistumisesta eikä ristiriitalipuista.
