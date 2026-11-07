# Tulos

Syy: kaikki koko istuntotiedoston lukevat polut (`readNativeBytes` +
`decodeNative`, `close_linux.go`, `history_tail_linux.go`, haaraluku
`scanBranch`, kontekstisivu) lukivat tiedoston kerralla muistiin ja
kieltäytyivät yli 32 MiB:n tiedostosta. Siksi yli 32 MiB:n keskustelua ei voinut
jatkaa, nimetä tai arkistoida, eteenpäin-sivutus (`after`) palautti 503, eikä
haaraluku (prosessit, keskeytynyt vuoro, `turn_error`, viimeinen vastaus)
toiminut. Hännästä sivuttava historia toimi jo ennestään 512 MiB:iin asti.

Nyt:

- Koko tiedoston lukijat virtaavat tiedoston tietue kerrallaan
  (`native_stream_linux.go`: `eachNativeLine`, `readNativeStream`); yhden
  tietueen raja on 64 MiB ja tiedoston raja `maxHistoryFile` (512 MiB), sama
  kuin löydöllä. Revisio on yhä sha256 kaikista tavuista, joten se on sama kuin
  hännän ikkunan revisio (selaimen lohkoluvut vertaavat niitä).
- **Arkistointi ja nimeäminen** eivät lue tiedostoa kokonaan:
  `nativeTailProof` todistaa otsikon, viimeisen kokonaisen tietueen (tai
  katkenneen hännän) ja että tiedosto pysyi paikallaan; leima (dev, ino, koko,
  ajat) on halpa revisio. Kirjoittajakatsaus, omistajalukko ja nimeämisen
  "revisio sama ennen ja jälkeen mallikutsun" säilyvät, nyt leimalla.
  Nimeämisen uusin kehote ja malli luetaan hännästä (`latestNativeEntry`).
- **Jatkaminen** todistaa yhä jokaisen tietueen (Pi lataa koko tiedoston
  joka tapauksessa), mutta yhdellä virtaavalla läpikäynnillä, jonka jälkeen
  riittää muuttumaton leima toisen läpikäynnin sijaan; todistus ei pidä
  merkintöjä muistissa. Katkenneen hännän karanteeni kopioi ja jäsentää
  virtana.
- **Sulkeminen** (tyhjän keskustelun poisto) lopettaa lukemisen ensimmäiseen
  keskustelutietueeseen.
- Kontekstisivun apuri saa tiedoston etuosan viimeiseen rivinvaihtoon asti
  suoraan tiedostosta, ja tiedosto suljetaan heti kun apuri on sen lukenut.

Mitattu 40 MiB:n kuvaistunnolla: häntätodistus ~30 µs, jatkamisen todistus
~50 ms / 7 MiB allokointia, haaraluku ~30 ms.

Testit (`internal/daemon/large_session_linux_test.go`): synteettinen yli
40 MiB:n istunto, jossa yli 1 MiB:n kuvatietueita: historia avautuu lopusta ja
sivuttuu alkuun, eteenpäin-sivu ja lohkoluku toimivat samalla revisiolla,
mallin nimeämä ja käsin annettu nimi, arkistointi ja palautus levossa, jatkaminen
ja arkistointi tyhjäkäynnillä; sama istunto jatkuu kiinnitetyllä natiivilla
Pi:llä (Pi lähettää koko haaran palveluntarjoajalle ja kirjoittaa vastauksen).
Molemmat testit kaatuvat ennen korjausta. `TestNativeProofRefusesWhatHistoryRefuses`
varmistaa, että todistus hylkää samat tietueet kuin historian lukija.

Katselmointi: riippumaton `/llm-review` (löytäjä gpt-6-astra, vastaväittäjä
claude-fable-5-1 rinnakkaisuuden rajalla) ja `/assess-findings`: kolme
korjattua löydöstä (todistuksen tyyppitarkistus, kontekstisivun avoin
tiedostokuvaaja esti katkenneen hännän korjauksen, häntätodistuksen koko), yksi
päätökseksi kirjattu (alla).

## Decisions for later review

- **Arkistointi ja nimeäminen eivät enää tarkista keskiosan tietueita.**
  Vaihtoehto: yksi virtaava kokotodistus (~50 ms / 40 MiB) ja sen jälkeen
  leima. Valitsin häntätodistuksen, koska issue sanoo, ettei näiden pidä lukea
  koko tiedostoa: arkistointi on vain merkintä, ja nimi kulkee Pi:n oman
  istuntokäsittelijän kautta, joka ohittaa rikkinäiset rivit. Vaurioitunutta
  keskustelua voi siis nyt arkistoida ja nimetä; jatkaminen kertoo yhä
  vauriosta (`history_damaged`).
- **Raja pysyy 512 MiB:ssä.** Pi lataa istunnon yhdeksi merkkijonoksi, ja
  V8:n merkkijonoraja on noin 512 MiB, joten Pi ei voisi jatkaa suurempaa
  tiedostoa. Rajan ylitys näkyy nyt vain yleisenä "Historiaa ei voitu
  tarkistaa" -merkkinä; selitys ja ohje henkilölle on oma työnsä
  (`supremely-robust-berry`, sopimukseen uusi historiatila).
- **Vuoron jälkeinen julkaisu lukee yhä koko tiedoston.** Jokaisen vuoron
  päättyessä `publishNativeHistory` jäsentää koko tiedoston (40 MiB:llä noin
  0,4 s, valtaosa kuvatietueiden toistuvasta JSON-jäsennyksestä
  `nativeBlocks`issa). Se toimii, mutta hännästä lukeva julkaisu olisi
  halvempi; jätin sen, koska kahden julkaisutavan (bash kesken vuoron)
  järjestys tekee hännästä pysähtymisestä virhealtista.
- **Ennalleen jäivät:** `firstPrompt` lukee nimeämättömän keskustelun
  otsikon 128 KiB:n alusta (kuvallinen ensimmäinen viesti jää ilman
  varaotsikkoa, keskustelu toimii), ja spinoff-työntekijöiden transkriptien
  8 MiB:n raja.
- Ikkunalukija lukee nyt puuttuvan `parentId`:n kuten `null`:n, samoin kuin
  koko tiedoston lukija (vain synteettiset tiedostot jättävät sen pois).
