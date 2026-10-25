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

# Kierros 2 · Työtilat Nyt-lohkojen alla

Prototyyppi: `issues/proto-sidebar-content/prototypes/sidebar-riff/index.html`.
Muistiinpanot ovat samassa hakemistossa tiedostossa `NOTES.md`, ja kuvat
ovat hakemistossa `evidence/`.

Kaikissa neljässä muunnelmassa on kierroksen 1 Nyt-palkki ja ne kaksi
muutosta, joita pyysit. Käynnissä-lohkossa ovat myös taustatyötä odottavat
agentit (*Odottaa taustatyötä* -merkki ja se, mitä odotetaan). Työtilan
alla ei ole agentteja, vaan työtilan rivi vie sen etusivulle.

## Jarille

**Suosittelen muunnelmaa 1, Aakkoset, ja sen työtilasivua.** Kaikki
näkyvät työtilat ovat Nyt-lohkojen alla tiiviinä aakkoslistana. Listan
yllä on suodatin, ja jokaisella rivillä on pieni tilavihje (huomiomäärä,
työskentelypiste, taustatyön merkki tai ○). Arkistoidut ovat taitettuna
listan lopussa. Työtilan etusivu ryhmittelee keskustelut samoin kuin palkki:
Sinun vuorosi, Käynnissä, Aiemmat. Worker on sisennettynä vanhempansa alla.

Perustelut:

- Työtila on joka kerta samassa kohdassa. Kun käynnissä oleva työ on jo
  ylempänä, alempi lista toimii pysyvänä hakemistona, eikä sen järjestys
  saa muuttua käytön mukaan.
- Uutta tietoa ei tarvita, ja tuotannossa muutos on pienin: nykyinen
  työtilalista ilman keskusteluja. *Arkistoidut*-taitto on jo olemassa.
- Työtilasivu puhuu samaa kieltä kuin palkki. Työtilan sisällä käynnissä
  olevan erottaa valmiista samalla tavalla kuin palkissa.

Muut ja miksi niitä ei suositella:

- **Viimeisimmät** on lyhin lista, mutta järjestys muuttuu. Lisäksi
  ”viimeksi käytetty” on tässä uusimman keskustelun aloitusaika: pelkkä
  selaaminen ei nosta työtilaa. Jos työtiloja on myöhemmin selvästi yli
  kolmekymmentä, tämä on hyvä seuraava askel Aakkosten päälle.
- **Ryhmät** toimii, jos työtilat jakautuvat omistajan mukaan, mutta
  omistaja tunnetaan vain GitHubista ja HTTPS-Giteasta, ja kapean kaistan
  ryhmäkirjaimet ovat epäselviä. Ryhmien työtilasivun idea, worktreet
  omina paikkoinaan keskusteluineen, kannattaa ottaa erikseen harkittavaksi.
- **Haku ensin** antaa Nyt-lohkoille eniten tilaa, mutta hiljainen työtila
  katoaa näkyvistä, jos sen nimeä ei muista. Hakuun osuvat myös
  keskustelujen otsikot. Kenttä on hyvä lisä Aakkosten suodattimeen.

Havainto: 1440 × 900 -näkymässä Sinun vuorosi ja Käynnissä vievät noin
520 px, kun agentteja on seitsemän, joten työtilalista alkaa vasta palkin
alaosasta. Käynnissä-rivien tiivistäminen yhteen riviin auttaisi kaikissa
muunnelmissa. Se on oma kysymyksensä.

**Valitaanko Aakkoset ja sen työtilasivu tuotannon pohjaksi? Otetaanko
suodattimeen mukaan keskustelujen otsikot Haku ensin -muunnelmasta?**

## Tarkistus

`check.mjs` meni läpi: neljä muunnelmaa 1440 ja 390 px:n leveydellä,
vaalealla ja tummalla teemalla. Taustatyötä odottavat agentit ovat
Käynnissä-lohkossa, eikä työtilalistassa ole agenttirivejä. Työtilan
etusivu sekä tyhjä ja arkistoitu työtila aukeavat kaikista muunnelmista.
Kapea kaista ja puhelimen laatikko (avaus, Escape, navigointi) toimivat,
samoin muunnelmakohtaiset toiminnot. Sivu ei vieritä vaakasuunnassa,
kirjoita virheitä konsoliin eikä tee verkkopyyntöjä. Tuotantokoodia ei
muutettu.
