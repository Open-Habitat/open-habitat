# Rinnakkainen muokkaus: Rivimerkit tuotannossa

Kierroksen 2 suunta Rivimerkit ja kahden sekunnin tauko ovat selaimen
tekstieditorissa (CodeMirror). Väliaikainen vertailu- ja varmistusvirta
(`editor-keep-own-drops-agent-changes`) on poistettu. Daemonin `base_version`
-sääntö ja `contracts/v1/` ovat ennallaan.

## Mitä tehtiin

- **Huomaaminen.** Editori lukee auki olevan tiedoston uudelleen, kun
  - viereisen keskustelun agentin työkalukutsu päättyy (`read`, `grep`,
    `find` ja `ls` eivät käynnistä lukua),
  - ikkuna saa fokuksen tai tulee näkyviin,
  - ennen jokaista tallennusta.

  Muokkaamaton tiedosto seuraa levyä hiljaa ja kursori pysyy paikallaan.
- **Odotus.** Rivit, joille muutos tulee, saavat katkoviivan ja merkin
  *odottaa*. Työkalurivillä lukee "Agentin N muutosta odottaa" ja *Tuo nyt*.
  Tuonti tapahtuu, kun viimeisestä näppäilystä on kulunut 2 s, kuitenkin
  aikaisintaan 2 s huomaamisen jälkeen.
- **Tallenna.** Tallenna tuo odottavat muutokset ensin ja tallentaa saman tien,
  jos ristiriitoja ei ole. Daemonin `file_changed`-hylkäys johtaa uuteen
  lukuun ja yhdistämiseen, korkeintaan kolme kertaa. Epävarma tallennus
  ratkaistaan lukemalla tiedosto; kirjoitusta ei lähetetä uudelleen.
- **Ristiriita.** Rivin yllä on kortti, jossa ovat *Sinun*, *Agentin* (tai
  *Levyn*) ja *Molemmat*. Tallenna on pois käytöstä ja syy näkyy sen alla.
- **Peruminen.** Ctrl+Z ja Ctrl+Y (myös Ctrl+Shift+Z) perivät tuonnin yhtenä
  askeleena merkintöineen. *Peru tuonti* näkyy vain, kun tuonti on viimeisin
  muutos. Perutun tuonnin jälkeen tallennuspainike on punainen *Tallenna ja
  korvaa agentin versio*, ja vieressä on *Tuo uudelleen*.
- **Merkintä keskusteluun.** Jos tallennettuun tiedostoon ei jäänyt kaikkia
  agentin `edit`- tai `write`-työkalun muutoksia, sen keskustelun loppuun tulee
  "Korvasit agentin muutoksia" riveineen. *Kerro agentille* kirjoittaa
  luonnoksen viestikenttään.
- **Neutraali muoto.** Muutos, joka ei tullut agentin tiedostotyökalusta
  (agentin bash, SSH, toinen välilehti), on "Levyn". Siitä ei tule merkintää.
- **Riippuvuus.** Yhdistäminen käyttää kirjastoa `node-diff3` 3.2.1 (MIT,
  lukittu). Alueet ryhmitellään omassa koodissa kirjaston `diffIndices`-
  rivieroista, koska kirjaston `diff3MergeRegions` pudottaa pelkät poistot.

## Päätökset myöhempään arvioon

1. **Ristiriitaisille riveille ei voi kirjoittaa ennen valintaa.**
   Vaihtoehto oli sallia kirjoittaminen, kuten prototyypissä. Katselmointi
   kuitenkin löysi neljä tapausta, joissa muokattu ristiriita ratkesi
   väärään tekstiin, kuten poistoja ja tiedoston loppuun lisäyksiä. Lukitus
   poistaa koko luokan. Muut rivit ovat vapaasti muokattavissa, ja kortti
   pyytää jo valitsemaan ensin.
2. **Uudempi levyversio odottaa, kun ristiriita on auki.** Se tuodaan, kun
   viimeinen kortti on ratkaistu (taas tauon jälkeen). Jos se yhdistettäisiin
   heti, avoin ristiriita katoaisi, koska pohja on jo ohittanut sen.
   Odottaessaan työkalurivi näyttää ristiriitatilan, ei odottavaa muutosta.
3. **Merkintä katoaa sivun uudelleenlatauksessa.** Se on välilehden
   näkymätilaa (kierroksen 2 kysymys 3). Pysyvä merkintä vaatisi uuden
   tallennuspaikan, mitä emme rakenna ilman tarvetta.
4. **Merkintä menee siihen keskusteluun, jonka työkalukutsu kirjoitti
   tiedoston.** Se ei siis mene sille, joka on tallennushetkellä näkyvissä.
   Agentin nimeäminen vaatii, että `edit`/`write`-kutsun `path` on sama
   tiedosto. Absoluuttinen polku verrataan sen työtilan suhteellisen lopun
   mukaan.
5. **Muokkaamaton tiedosto seuraa levyä hiljaa korostamatta.** Muutosta ei
   viedä peruttavaan historiaan, kuten kierros 1 linjasi. Vaihtoehto olisi
   ollut korostaa myös nämä agentin rivit.
6. **Pelkkä Tallenna ilman levymuutoksia ei näytä ilmoitusta.** Ilmoitus
   tulee vain silloin, kun tallennus yhdisti tai korvasi levyn muutoksia,
   kuten "Tallennettu. Tiedostossa ovat nyt sekä sinun että agentin
   muutokset.".
7. **Puhelimen asettelu.** Puhelimessa editori pysyy tuotannon jaossa (40 %
   keskustelun yllä). Pitkä tilateksti siirtyy työkalurivillä omalle
   rivilleen. Kierros näytti puhelimessa koko ikkunan editorin.

## Katselmointi

Oma katselmointi ja yksi kohdistettu katselmoija (gpt-6-astra, kaksi
kierrosta). Itsenäistä katselmointia ei tarvittu, koska daemonin sopimus
ei muuttunut.

- **Ensimmäinen kierros** löysi viisi todellista virhettä, ja jokainen
  toistettiin paikallisesti ennen korjausta:
  - kirjasto pudotti pelkät poistot, jolloin seuraava tallennus kirjoitti
    poistetut rivit takaisin;
  - myöhempi tuonti tyhjensi avoimen ristiriidan;
  - *Sinun* ja *Molemmat* käyttivät tuontihetken kopiota;
  - pelkän ristiriidan tuonnista ei syntynyt historia-askelta;
  - poistojen ja loppuun lisäysten rivinvaihdot menivät väärin.
- **Toinen kierros** löysi neljä reunatapausta ristiriidan muokkaamisesta, ja
  ne suljettiin päätöksillä 1 ja 2.

Jokaisella on regressiotesti.

## Varmistus

- Yksikkötestit:
  - `editorMerge.test.ts`: yhdistäminen, poistot, korvatut muutokset ja
    rivimuutosten rakentaminen;
  - `CodeMirrorEditor.test.tsx`: historia, lukitus ja ratkaisut aidossa
    CodeMirrorissa jsdomissa;
  - `BrowserDocument.test.tsx`: ohjaimen tila, kun moottori on korvattu
    valetoteutuksella;
  - `editorChanges.test.ts`: työkalun polku ja tekijän päättely.
- Selaintestit: `browser-editor-concurrent.spec.ts`, 5 tapausta:
  - tauon jälkeinen tuonti, jota kirjoittaminen siirtää, sekä Ctrl+Z,
    Ctrl+Shift+Z ja Ctrl+Y (1366 vaalea ja 390 tumma);
  - tallennuksen aikainen tuonti bash-muutoksella neutraalina;
  - ristiriidan kolme valintaa ja niiden peruminen, merkintä ja *Kerro
    agentille* (1366 ja 390, axe ja vaakavieritys).

  `browser-editor.spec.ts`-tiedoston vanha vertailupolku korvattiin
  levymuutoksen ristiriidalla, ja sen 17 tapausta menivät läpi.
- Synteettiselle Pi:lle lisättiin kehotteet "muokkaa tiedostoa", "muokkaa
  samaa riviä" ja "muokkaa bashilla". Ne muuttavat tiedostoa `cmd/main.go`
  oikeasti.
- Rajaus: testit eivät todista eri UID:iden erotusta. Muutos ei koske
  gatewayta eikä daemonia.
