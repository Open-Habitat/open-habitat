# Sivupalkin sisältö · Kierros 1

Prototyyppi: `issues/proto-sidebar-content/prototypes/sidebar/index.html`
(yksi tiedosto, ei verkkoa). Muistiinpanot ja kokeiluohje ovat samassa
hakemistossa tiedostossa `NOTES.md`, kuvat hakemistossa `evidence/`.

## Jarille

**Suosittelen ideaa 1, Nyt, ja siihen ideasta 3 sen, että spinoff näkyy
sisennettynä vanhempansa alla.** Sivupalkin yläosassa on *Sinun vuorosi*
(kysymys tai uusi vastaus) ja sen alla *Käynnissä* (agentit, spinoffit
vanhempansa alla, worktree näkyvissä). Työtilat ovat näiden alla tiiviinä
listana, jossa on suodatin ja huomio- ja käynnissä-määrät. Silloin
etusivun tehtävä muuttuu: siitä tulee työtilojen yleiskuva ja paikka
aloittaa uutta, koska elävä lista on jo palkissa.

Perustelut:

- Idea vastaa suoraan siihen, mitä ehdotit: aktiiviset agentit ensin.
  Ei-aktiivinen työtila on silti aina näkyvissä ilman avaamista.
- Kaikki tarvittava tieto on jo olemassa (`activity`, `pending_question`,
  `waiting_on`, `parent`, `worktree_id`, lukemattomuus). Uutta tietovarastoa
  ei tarvita.
- Kapeassa kaistassa näkyvät huomio- ja käynnissä-merkit, ja puhelimen
  valikkopainikkeessa on merkki, kun jokin odottaa sinua. Tämä toimii
  myös kaventaessa.
- Muutos tuotantoon on pienin: etusivun `homeSections` järjestää jo
  agentit ja työtilat huomion mukaan, ja sama järjestys siirtyy palkkiin.

Muut ideat ja miksi niitä ei suositella:

- **Saapuneet** on vahvin silloin, kun haluat tietää mitä pitää tehdä.
  Toimiva postilaatikko tarvitsee kuitenkin pysyvän kuittauksen, ja se olisi
  uusi tietovarasto. Nykyinen lukemattomuus on vain välilehden muistissa.
  Idean voi ottaa käsittelyyn myöhemmin, jos Nyt-listan Sinun vuorosi jää
  liian kevyeksi.
- **Työpuu** on hyvä Taskfleet-työssä, mutta palkkina tiheä. Siitä
  otetaan mukaan vain vanhempi–spinoff-sisennys.
- **Työtila kerrallaan** sopii pitkään yhteen repoon keskittymiseen, mutta
  heikentää juuri sitä, mitä haet: agenttien seuraamista työtilojen yli.
- **Kiinnitetyt** ratkaisee hiljaisten työtilojen läheisyyden, mutta
  kiinnitys olisi uusi tallennettava tieto. Haku on hyvä lisä mihin
  tahansa ideaan.

Ideoita 6–8 (aikajärjestys, ei sivupalkkia, työtilakuvakkeiden kaista)
ei rakennettu. Perustelut ovat `NOTES.md`-tiedostossa: aikajärjestys
tarvitsisi viimeisen tapahtuman ajan, jota host ei tiedä, ja kuvakekaista on
mukana ideassa 4.

**Valitaanko Nyt (ja spinoffit vanhempansa alle) tuotannon pohjaksi, vai
haluatko Saapuneiden kaltaisen kuittauksen, joka vaatisi uuden pysyvän
tiedon?**

## Tarkistus

`check.mjs` meni läpi: viisi ideaa 1440 ja 390 px:n leveydellä, vaalealla
ja tummalla teemalla. Ei-aktiivinen työtila ja odottava kysymys aukeavat
kaikista, kapea kaista ja puhelimen laatikko (avaus, Escape, navigointi)
toimivat, eikä sivu vieritä vaakasuunnassa, kirjoita virheitä konsoliin
tai tee verkkopyyntöjä. Tuotantokoodia ei muutettu.
