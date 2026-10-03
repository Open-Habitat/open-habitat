# Design-kierros

Käyttöliittymän ulkoasu syntyy Jarin ja design-tekoälyn keskustelussa, ei
tässä repossa. Repo antaa sille keskustelulle lähtökohdan ja ottaa tuloksen
vastaan. Tämä sivu kuvaa, miten se tapahtuu niin, että vedokset, [designin
kuvaus](design.md) ja koodi pysyvät samassa totuudessa. Muu ohjelmointityö
etenee [työskentelyohjeen](../AGENTS-WORKFLOW.md) mukaan; design-kierros on
siitä poikkeava työtapa, koska sen keskeinen vaihe tehdään repon ulkopuolella.

## Kolme lähdettä ja niiden roolit

- **Vedokset** `drafts/`-hakemistossa ovat ulkoasun auktoriteetti: sommittelu,
  mitat, tilat ja ilme. Niitä muuttaa vain design-kierros, ja ne korvataan
  paikalleen, jotta vertailut ja paketit osoittavat aina samaan kohteeseen.
- **[design.md](design.md)** kirjaa sen, mitä vedos ei voi ilmaista: käytöksen
  säännöt, rehellisyysvaatimukset, tietoisesti sovitut poikkeamat ja syyt.
  Sitä muuttaa kierroksen handoff tai Jarin päätös poikkeamasta.
- **Koodi** (`web/src/components/`, `tokens/`, Storybook) toteuttaa vedokset.
  Se ei ole designin lähde; kun koodi ja vedos eroavat, ero on joko korjattava
  tai kirjattava `design.md`:hen poikkeamana.

Kun jokin näyttää väärältä, ensimmäinen kysymys on, kumpi näistä kolmesta on
oikeassa. Vastaus on aina pääteltävissä rooleista, ei muistista.

## Kierroksen vaiheet

### 1. Nykytila kerätään koneellisesti

Designer ei näe sovellusta, joten paketti kertoo, mitä sovelluksessa on.
Lähtökohta on **tilainventaario**: versioitu lista jokaisesta näkymästä ja
tilasta, johon käyttäjä voi päätyä, mukaan lukien virhetilat, puhelin ja
työpöytä sekä molemmat teemat. Yksi komento tallentaa inventaarion kaikki
tilat synteettisestä labista. Tallenteet johdetaan koodista tietyssä
commitissa, joten niitä ei commitoida; paketti kirjaa commitin.

Design-tekoäly työstää HTML:ää, joten tallenne on HTML, ei kuva. Kokonainen
sivu jokaisesta tilasta on liikaa; tallenne on **palanen**: se DOM-alipuu,
jota tila koskee, tyylit ja fontit mukaan liitettyinä niin, että se aukeaa
yksinään ja näyttää samalta kuin sovelluksessa. Koko sivu otetaan vain
kierroksen fokusnäkymistä. Kuvat ovat ihmisen katselmointia varten, eivät
designerin pääaineisto.

Uusi käyttöliittymätyö lisää tilansa inventaarioon. Tila, jota ei ole
listassa, ei ole olemassa designerille, ja juuri sellaisista tiloista
syntyvät designin väärinkäsitykset.

### 2. Muutos edellisestä kierroksesta ja aukot

Paketin brief sisältää osion "muuttunut edellisen kierroksen jälkeen". Se
kootaan edellisen paketin commitista alkaen `web/src`-hakemistoa
koskettaneista commiteista ja yhdistetään inventaarion tallenteisiin, jotta
designer näkee muutoksen eikä vain lue siitä. Jokaiseen muutokseen pyydetään
designerin kommentti.

Samalla listataan **aukot**: tilat, jotka ovat koodissa mutta joille ei ole
vedosta, ja vedoksen tilat, joita koodi ei toteuta. Aukkolista on se tieto,
joka designeriltä useimmin puuttuu.

### 3. Brief ja paketti

`design-package`-skilli kokoaa paketin: brief, tilainventaario palasineen,
muutos- ja aukkolistat, komponentit, tokenit, nykyiset vedokset ja viitatut
issuet. Brief kertoo kierroksen fokuksen ja ongelmat issue-viittauksin, ja se
tallennetaan kierroksen issueen. Pysyvät vaatimukset, kuten jokaisen
kontrollin vuorovaikutustilojen suunnittelu, kuuluvat skillin ohjeeseen, eivät
yksittäisen briefin muistamisen varaan.

Paketti on zip, jonka Jari vie design-työkaluun. Se on kierroksen lähtöpiste:
siitä alkaen työ tapahtuu Jarin ja designerin keskustelussa, ja repo odottaa.

### 4. Handoff arvioidaan ennen kuin mitään toteutetaan

Designerin vastaus on vedokset ja handoff-teksti. Niistä kirjoitetaan
kierroksen issueen **handoff-arvio**, näkymä ja tila kerrallaan:

- uutta, muuttunut, poistunut edelliseen vedokseen nähden;
- ristiriita `design.md`:n sääntöjen, rajapintojen tai sovitun käytöksen
  kanssa;
- designerin väärinkäsitys, joka johtuu paketista puuttuneesta tiedosta;
- toteutetaan, lykätään, hylätään, ja miksi.

Vedosten vertailu edelliseen versioon tehdään samalla tilakaappauksella kuin
tuotannon vertailu, ei HTML-diffinä. Arvio vastaa kysymykseen *mitä*; vasta
sen jälkeen suunnitellaan *miten*, ja toteutusissuet filataan arviosta.

Designin tekemisen aikana löytyy usein toiminnallisuutta, jota kukaan ei ole
pyytänyt: puuttuva toiminto, tila tai kokonainen ominaisuus. Ne kirjataan
arvioon omana luokkanaan ja viedään issueiden lajitteluun ehdokkaina. Niitä
ei toteuteta vedoksen mukana hiljaa, eikä niitä hukata siksi, että ne eivät
kuuluneet kierroksen fokukseen.

### 5. Toteutus mitataan vedosta vasten

Toteutus rakennetaan yhteisistä komponenteista ja tokeneista. Vastaavuus
vedokseen ei ole silmämääräinen arvio jälkikäteen vaan mittaus: labin näkymän
maamerkkielementtien lasketut tyylit (reunat, täytteet, fontit, leveydet)
verrataan vedoksen samoihin elementteihin, ja vuorovaikutteisten elementtien
luettelo (rooli ja nimi) verrataan tilakohtaisesti. Puuttuva painike tai väärä
viivaleveys on raportin rivi, ei havainto, joka sattuu jäämään huomaamatta.
Parikuvat jäävät ihmisen katselmointia varten.

Mittaus vaatii maamerkkikartan vedoksen ja tuotannon välille. Kartta on osa
tilainventaariota ja päivittyy, kun vedos tai komponentti muuttuu.

### 6. Kierros päättyy, kun kolme lähdettä täsmäävät

Vedokset on korvattu `drafts/`-hakemistossa, `design.md` kuvaa muuttuneet
säännöt ja poikkeamat, ja mittaus ei raportoi eroja, joita ei ole kirjattu
poikkeamiksi. Kierroksen issue sisältää briefin, handoff-arvion ja mittauksen
tuloksen. Seuraava kierros alkaa tästä commitista.

## Mikä puuttuu vielä

Tilainventaario, palasten tallennus ja mittausvertailu ovat sovittu suunta,
eivät vielä olemassa olevia työkaluja. Ne toteutetaan issueissa
[inventory-ui-states](../issues/inventory-ui-states/item.md) ja
[compare-draft-fidelity](../issues/compare-draft-fidelity/item.md).
Ensimmäinen kierros tätä polkua pitkin on
[design-control-states](../issues/design-control-states/item.md). Siihen
asti paketti kootaan nykyisillä labin kaappauksilla ja arvio kirjoitetaan
käsin samalla rakenteella.
