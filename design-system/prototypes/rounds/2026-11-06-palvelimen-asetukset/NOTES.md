# Palvelimen asetukset – kierros 1

Issue `proto-server-settings-overview`. Jari 6.11., Contosoin käyttöönotossa
Ainon kanssa: kun ylläpitäjä avaa palvelimen asetukset, vasen lista on yhä
asetusten alussa, ja asetuksia on niin paljon, ettei alempia, kuten
integraatioita, näe. Palvelimen asetusten pitäisi näkyä kaikki oikealla.

Nyt-näkymä on tuotannon `AccountSettings` muuttamattomana: henkilön 13
osiota, otsikko *Palvelimen ylläpito* ja palvelimen 7 osiota samassa
listassa. Tilivalikon *Palvelimen ylläpito* avaa Palvelin-osion (nimi,
oletuskieli, versio). Muut kuusi palvelinosiota ovat listan lopussa.
Suunnat käyttävät samoja tuotannon osioita (`AccountSettings` piirtää yhden
osion, sen oma lista piilotettuna) kierroksen omassa navigaatiossa. Lista
käyttää tuotannon luokkia (`s-nav`, `s-nav-i`, `s-nav-h`, `s-card`) ja
`SettingsSearchField`-hakukenttää, joka ei kierroksella hae. Kuori on
`AppShell`, `WorkspaceRail` ja `AccountShelf`. Hostin paikalla on
`fetch`-sijainen, joka on rakennettu `contracts/v1/examples`-esimerkeistä:
Contoso, kuusi henkilöä (kaksi ylläpitäjää, yksi ei vielä kirjautunut),
Google ja Dropbox käytössä ja Microsoft 365 ilman tunnuksia, sivuston
Anthropic-avain, ei saneluavainta, 500 Gt levy ilman rajoja. Kaikki on
synteettistä.

## Suunnat

Akseli: missä palvelimen osiot ovat ja kuinka moni niistä näkyy kerralla.

- **Nyt**: henkilön 13 osiota ja palvelimen 7 samassa listassa. Palvelimen asetukset avautuvat Palvelin-osioon, lista on alussa ja integraatiot ovat näkymän alapuolella.
- **A Yleiskuva**: palvelin on listassa yksi rivi heti haun alla. Sen sivu luettelee kaikki seitsemän osiota ja kunkin tilan; osio avautuu riviltä ja palaa yleiskuvaan.
- **B Oma alue**: Palvelimen ylläpito on oma alueensa, jonka lyhyt lista sisältää vain palvelimen seitsemän osiota. Omat asetukset ovat alueen yläreunan linkin takana.
- **C Ryhmät**: vasen lista on kuusi ryhmää. Oikealla näkyvät ryhmän kaikki osiot peräkkäin, ja yläreunan pikalinkit vievät osioon, esimerkiksi integraatioihin.

Oletusnäkymä on kaikissa sama hetki: ylläpitäjä on juuri valinnut
tilivalikosta *Palvelimen ylläpito*. *Alusta* palauttaa sen.

## Mitä kussakin tapahtuu

- **Nyt.** 1440 × 900 -ikkunassa Palvelinintegraatiot-rivin alareuna on
  766 px ja Levytilan 956 px asetuskerroksen yläreunasta. Selainikkunassa,
  jonka sisäkorkeus on 900 px, integraatiot juuri mahtuvat, mutta
  Käyttöönotto, Käyttäjät ja pääsy sekä Levytila eivät. 900 px korkealla
  näytöllä selaimen omat palkit vievät noin 100 px, jolloin myös
  integraatiot jäävät alle. Integraatioihin pääsee vierittämällä listaa,
  ja takaisin Palvelin-riviltä. Puhelimessa palvelimen asetukset avautuvat
  Palvelin-osioon. *‹ Asetukset* vie 20 rivin listaan, jossa
  Palvelinintegraatiot on 734 px:n kohdalla (844 px ikkuna) ja muut sen alla.
- **A.** Listan ensimmäinen rivi haun alla on *Palvelimen ylläpito*, ja
  sen alla otsikon *Omat asetukset* alla ovat henkilön 13 osiota. Oikealla
  on yleiskuva: seitsemän riviä, joilla kullakin on nimi, yhden rivin tila
  ja tarvittaessa merkki. Integraatioiden tila on *Google ja Dropbox
  käytössä · Microsoft 365 ei asetettu* merkillä *Kesken*, AI-avaimella
  *Kunnossa*. Rivi avaa osion, ja sen yläpuolella oleva *‹ Palvelimen
  ylläpito* palaa yleiskuvaan. Puhelimessa yleiskuva on ensimmäinen näkymä,
  ja listassa palvelin on ensimmäinen rivi.
- **B.** Tilivalikon *Palvelimen ylläpito* vaihtaa koko listan: ylhäällä
  *‹ Omat asetukset*, otsikko *Palvelimen ylläpito · Contoso · koskee
  kaikkia käyttäjiä* ja seitsemän osiota (Yleiset, Integraatiot, AI-avain,
  Saneluavain, Käyttöönotto, Käyttäjät ja pääsy, Levytila). Omissa
  asetuksissa ei ole palvelinosioita. Niiden lopussa on vain painike
  *Palvelimen ylläpito ›*. Puhelimessa seitsemän osiota ovat vieritettävä
  välilehtirivi osion yläpuolella.
- **C.** Lista on kuusi ryhmää, ja kunkin alla lukee, mitä se sisältää:
  Tili ja laitteet, Tekoäly, Yhteydet, Ulkoasu ja editori, Tallennustila
  sekä otsikon *Ylläpito* alla Palvelimen ylläpito. Oikealla ovat ryhmän
  kaikki osiot peräkkäin. Yläreunan pikalinkit pysyvät näkyvissä
  vieritettäessä ja merkitsevät osion, jossa ollaan.
  *Palvelinintegraatiot* vierittää integraatioihin ja *Palvelin* takaisin
  alkuun. Puhelimessa pikalinkit ovat vieritettävä rivi.

Kuvat: `issues/proto-server-settings-overview/evidence/<suunta>-<vaihe>-<leveys>-<teema>.avif`.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-palvelimen-asetukset/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-palvelimen-asetukset/check.mjs \
  design-system/prototypes/dist/palvelimen-asetukset/offline.html <kuvahakemisto>
```

`check.mjs` avaa jokaisen oletusnäkymän, kulkee integraatioihin ja takaisin
suunnan omaa reittiä 1440 × 900 ja 390 × 844 px, vaaleana ja tummana, ja
tulostaa, mihin Nyt-näkymän integraatiorivi osuu. Tarkistuspisteitä on 134,
ja konsoli pysyy puhtaana. `index.html` on sama sivu ilman upotettuja
fontteja glasspadia varten.

Kierroksen poikkeamat tuotannosta: hakukenttä ei hae, ja yleiskuvan tilarivit
ovat kierroksen kirjoittamia, eivät hostin luettuja (katso `result.md`).
Osion sisällä on tuotannon otsikko (*Palvelin*, *Palvelinintegraatiot*),
vaikka A:n ja B:n listassa sama osio on *Yleiset* tai *Integraatiot*.
