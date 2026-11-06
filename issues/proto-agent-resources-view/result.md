# Kierros 1: kaikki agentin käytössä oleva yhdessä näkymässä

Kierros: `design-system/prototypes/rounds/2026-11-06-agentin-resurssit/`
(NOTES.md kertoo ohjaimet ja mikä on yhteistä). Lähtökohta oli
`proto-browse-what-agent-sees-m365`-kierroksen 1 suunta B. Ero siihen näkyy
jo oletusnäkymässä: sivupalkin *Agentin käytössä* avaa listan kaikista
kuudesta yhteydestä ja yhdistämättömistä palveluista, ei vain Microsoftin
tiedostoja. Akseli: miten lista järjestää kaiken. Yläpalkin
*Microsoft 365 -taso* vaihtaa tason.

- **A Tileittäin**: lista on tilit kuten asetuksissa, jokaisen tilin alla sen palvelut; taso ja rajat tilin rivillä.
- **B Lajeittain**: lista on lajit (tiedostot, posti, kalenteri, yhteystiedot, koodi, koneet), joiden alla kaikkien tilien lähteet tasoineen.
- **C Oikeuksittain**: lista on kolme ryhmää, Voi muuttaa, Lukee ja Ei näe; tason vaihto siirtää lähteen ryhmästä toiseen.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet:
`0-oletus`, `1-posti` (agentin lähettämätön luonnos), `2-koodi` (GitHub ja
sen rajat), `3-kone`, `4-ei-nae`, `5-vain-luku` (Microsoft vain luku),
`6-asetukset` (lähteestä tuotannon asetussivulle), `7-yhdista` (Apple
listasta). Oletukset myös tummana.

## Mitä kukin päättää

| | Listan järjestys | Missä taso näkyy | Ei näe | Yhdistä |
|---|---|---|---|---|
| A | tili › palvelut, kuten Asetukset | tilin rivillä kerran; palvelurivillä kynä / silmä | lähteen alla | oma *Ei yhdistetty* -ryhmä listan lopussa |
| B | laji › kaikkien tilien lähteet | jokaisella rivillä tilin taso | lähteen alla | kunkin lajin lopussa (Apple kolmessa lajissa) |
| C | Voi muuttaa / Lukee / Ei näe | ryhmä ja rivin lause | oma ryhmä kaikista lähteistä | Ei näe -ryhmän lopussa |

## Suositus

**A Tileittäin.** Taso on tilin ominaisuus: palvelu valvoo sitä tilin
myöntämillä oikeuksilla, ja sitä muutetaan tilin asetuksista. A näyttää sen
siellä, missä se oikeasti asuu, kerran tilin rivillä, ja jokainen lähde vie
saman tilin asetuksiin; näkymä ja Asetukset › Tiedot agenteille ovat saman
asian kaksi puolta, joten kumpaakaan ei tarvitse opetella erikseen. B
vastaa hyvin kysymykseen "missä postini on", mutta toistaa tason jokaisella
rivillä ja hajottaa yhden tilin kolmeen paikkaan, joten tason vaihto näyttää
muuttavan monta asiaa. C on rehellisin siitä, mitä agentti voi, ja sen
*Ei näe* -ryhmä on kierroksen paras yksittäinen ajatus, mutta ryhmittely
muuttuu tason mukana (lähteet hyppäävät ryhmästä toiseen) ja sekoittaa
tilit. Jos C:n kooste halutaan, sen voi ottaa A:han yläosan yhteenvedoksi
(kysymys 3).

## Host-tiedot

Valtuus pysyy daemonilla henkilön omana Unix-käyttäjänä, eikä uutta
tietovarastoa tarvita: jokainen rivi on jo daemonin tiedossa tai luettavissa
henkilön omilla tunnuksilla.

- **Tilit, tasot ja palveluiden oikeudet** ovat integraatiolistassa
  (`/api/v1/integrations`: `accounts[].level`, `services[].access`,
  `directory`). Lauseet "mitä agentti voi" ovat nykyisen katalogin
  (`levelAbility`, `narrower`) lauseita; "Ei voi estää" on
  `proto-integration-levels`-kierroksen rivi ja vaatii katalogiin uuden
  tekstin palvelua kohti.
- **Tiedostot** listataan peilihakemistoista kuten kierroksella 1
  (`~/cloud/onedrive|sharepoint|google|dropbox/…`); Driven valittu kansio ja
  SharePointin valitut kirjastot ovat jo daemonin tiedossa.
- **Posti, kalenteri ja yhteystiedot eivät ole hakemistoja.** Selaus vaatii,
  että daemon kysyy ne natiivityökalulla henkilön tunnuksin silloin, kun
  sivu avataan (Microsoft: Graph/`ms-365-mcp-server`; Google: `gog`; IMAP:
  `himalaya`), ilman välimuistia. Tämä on uusi lukureitti; jos sitä ei
  haluta, näille lähteille jää vain otsake (taso, rajat, asetukset) ilman
  sisältöä (kysymys 2).
- **Agentin luonnos** tunnistetaan Pi-historiasta kuten kierroksen 1
  tiedostomuutokset; Microsoft näyttää luonnoksen henkilön omana.
- **GitHub** on gh:n kirjautuminen; repolista ja push-oikeus tulevat
  GitHubista henkilön tunnuksella (`gh repo list`, `permissions.push`).
  OAuth-pyyntö on `repo read:org gist`, joten yksittäisiä repoja ei voi
  rajata. Organisaatio, joka rajoittaa OAuth-sovelluksia, näkyy GitHubin
  vastauksessa; sen nimeäminen *Ei näe* -listassa vaatii `read:org`-kyselyn.
- **Gitea ja GitLab** ovat tea:n ja glab:n kirjautumisia (`gitea`, `gitlab`
  integraatiolistassa); push-oikeus on jo `GiteaPush`/`GitLabToken.push`.
- **Oma kone** on `own-machines`-rivi: käyttäjä, päättymispäivä, tila.
  macOS:n suojatut kansiot ovat tieto siitä, ettei täyttä levyn
  käyttöoikeutta annettu (omat koneet -dialogin oletus), ei koneelta luettu.
- **Yhdistä ja asetukset** ovat linkkejä nykyisiin asetusreitteihin
  (`/settings/tiedot#apple`, `/settings/koodipalvelut#github` jne.), jotka
  jo merkitsevät rivin; uutta yhdistämisreittiä ei tarvita.

## Kysymykset Jarille

1. **Suunta A, B vai C?** `r1-a-tileittain-0-oletus-1440-light`,
   `r1-b-lajeittain-0-oletus-1440-light`,
   `r1-c-oikeuksittain-0-oletus-1440-light`. Suositus A.
2. **Selataanko postia, kalenteria ja yhteystietoja vai riittääkö niille
   otsake?** `r1-a-tileittain-1-posti-1440-light`. Selaus on uusi
   lukureitti natiivityökaluihin; tiedostot ja repot eivät sitä vaadi.
3. **Otetaanko C:n kooste A:han?** `r1-c-oikeuksittain-4-ei-nae-1440-light`:
   kaikki "Agentti ei näe" -kohdat yhdessä, A:ssa ne ovat kunkin lähteen
   alla (`r1-a-tileittain-4-ei-nae-1440-light`).

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-agentin-resurssit/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/agentin-resurssit/offline.html \
  --title "Agentin käytössä – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs`: 238 tarkistuspistettä, konsoli puhdas. Kaikki suunnat 1440 ja
390 px vaaleana kahdeksassa vaiheessa, oletukset myös tummana, kuvat
kertoimella 2 (AVIF). Integraatiolistan ja omien koneiden sijaisvastaukset
läpäisevät tuotannon skeemavalidoinnin (asetussivu näyttää ne). Synteettinen
komponenttilabra, ei hostia vasten ajettu. Kierros ei muuttanut
tuotantokoodia.

## Päätökset myöhempää katselmointia varten

- **Sijainti pidettiin kierroksen 1 B:n paikalla** (sivupalkki työtilojen
  yllä) kaikissa suunnissa, jotta akseli on vain järjestys.
- **Koneen tiedostoja ei selata.** Se vaatisi daemonilta SSH-yhteyden
  koneelle sivun avautuessa; näkymä kertoo tämän ja näyttää pääsyn tiedot.
- **Agentin muutokset** näkyvät vain merkkinä tiedoston ja luonnoksen
  kohdalla; muutoslista kuuluu `proto-conversation-context-view`-linjalle.
- **Tason esitys GitHubille ja Gitealle** ("Kaikki repot", "Luku ja push")
  ja koneelle ("Päättyy 4.12.") on kierroksen sanoitus; niillä ei ole
  tuotannossa tasonimeä.

# Kierros 2: jokaisen lajin osio yhdessä

Kierros: `design-system/prototypes/rounds/2026-11-06-resurssien-lajit/`
(NOTES.md kertoo jokaisen lajin sisällön taulukkona). Lähtökohta on
kierroksen 1 suunta B Lajeittain. Ero siihen näkyy jo oletusnäkymässä:
vasemmalla on vain kuusi lajia, ja oikealla on valitun lajin osio, joka
alkaa yhdellä lauseella ("5 lähdettä 3 tililtä. Agentti voi muuttaa 4,
lukee 1."). Akseli on lajin osion yhteinen rakenne eli se, miten taso ja
sisältö kohtaavat.

- **A Välilehdet**: lajin osio näyttää yhden lähteen välilehtenä; taso ja rajat sen yllä, Ei näe sen alla.
- **B Yhdessä**: kaikkien tilien sisältö yhtenä listana (posti yhdessä, kalenteri yhdessä); tasot pienenä taulukkona yllä, Ei näe koko lajista alla.
- **C Kortit**: jokainen lähde on kortti, jossa taso, rajat ja Ei näe; sisältö avautuu kortin Selaa-painikkeesta.

Kuvat: `evidence/r2-<riffi>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus` (tiedostot), `1-posti` (agentin lähettämätön luonnos),
`2-kalenteri`, `3-yhteystiedot`, `4-koodi`, `5-koneet` (toisen koneen pääsy
on päättynyt), `6-ei-nae`, `7-vain-luku`, `8-asetukset` (Microsoft postin
osiosta) ja `9-yhdista` (Apple postin osiosta). Oletukset on kuvattu myös
tummassa teemassa.

## Mitä kukin päättää

| | Tasot | Sisältö | Ei näe | Asetukset |
|---|---|---|---|---|
| A | valitun lähteen yllä, muut välilehtien takana | yksi lähde kerrallaan | valitun lähteen alla | painike lähteen alla |
| B | kaikki lähteet kerralla taulukossa | kaikki tilit yhdessä listassa tilin merkein | koko lajista yhdessä, yhdistämättömät mukana | rataskuvake taulukon rivillä |
| C | kortissa, jokaisesta lähteestä kerralla | taitettu, avautuu Selaa-painikkeesta | kortissa lähteen kohdalla | kortin alalaidassa |

## Suositus

**B Yhdessä.** Lajeittain järjestetyn näkymän ajatus on vastata kysymykseen
"mitä agentti näkee postistani", ja B vastaa siihen yhdellä näkymällä. B
näyttää kaikki postilaatikot samassa listassa, kaikki kalenterit samassa
viikossa ja kaikki repot samassa luettelossa. Lisäksi lajin jokainen taso
näkyy kerralla taulukossa, jossa jokaisella rivillä on tie asetuksiin. Sen
*Agentti ei näe* kokoaa koko lajin rajaukset ja yhdistämättömät palvelut
yhteen. Tämä on kierroksen 1 kysymyksen 3 kooste lajin kokoisena.

A on tuttu kierroksen 1 lähdenäkymästä, mutta se piilottaa muiden lähteiden
tasot välilehtien taakse, joten kysymykseen "voiko agentti lähettää
postia" ei vastata yhdellä silmäyksellä. C on rehellisin tasoista ja toimii
hyvin koodille ja koneille, joissa sisältöä on vähän. Tiedostoissa ja
postissa sisältö on kuitenkin aina klikkauksen takana, ja sivusta tulee
pitkä.

B:n heikkous näkyy tiedostoissa: viisi tasoriviä työntää sisällön alas
(`r2-b-yhdessa-0-oletus-1440-light`). Tämä ratkaistaan tiedostojen omalla
kierroksella.

## Mitkä lajit tarvitsevat oman kierroksen

- **Tiedostot: kyllä.** Neljällä palvelulla on neljä eri rajausmallia
  (SharePointin valitut kirjastot, Driven valittu kansio, Dropboxin
  sovelluskansio ja koko OneDrive). Lisäksi on ratkaistava, miten
  synkronoinnin viive ja agentin tekemät muutokset näkyvät tiedostoissa
  ja kansioissa. Myös esikatselu on vielä auki, ja B:n tasotaulukko kasvaa
  tässä lajissa suurimmaksi.
- **Posti: kyllä, ja kalenteri ja yhteystiedot sen mukana.** Kierroksen 1
  kysymys 2 on yhä auki: selataanko sisältöä vai riittääkö otsake.
  Sisällön selaaminen tarvitsee uuden lukureitin natiivityökaluihin, ja
  sama päätös koskee kalenteria ja yhteystietoja. Lisäksi luonnoksen ja
  lähettämisen ero (Luonnokset-taso), jaetut postilaatikot ja yhdistetyn
  postilistan yksityisyys ovat postin omia kysymyksiä. Kalenterin ja
  yhteystietojen esitys on tällä kierroksella jo riittävä.
- **Koodi: ei omaa kierrosta.** Avoimet asiat ovat host-tietoja:
  organisaation hyväksyntä näkyy GitHubin vastauksessa, ja repon suhde
  työtilaan on jo yhden rivin asia.
- **Koneet: ei.** Koneen tiedostoja ei selata. Rivit ovat jo tuotannon
  `own-machines`-tietoja, ja voimassa oleva ja päättynyt pääsy näkyvät
  molemmat.

## Host-tiedot

Kierroksen 1 host-tiedot ovat yhä voimassa: valtuus on daemonilla
henkilön omana käyttäjänä, eikä uutta tietovarastoa tarvita. Tämä kierros
lisää seuraavat:

- **B:n yhdistetyt listat** kysyvät jokaisen lajin lähteet samalla kertaa
  sivun avautuessa, kukin omalla natiivityökalullaan ja henkilön tunnuksin,
  ja järjestävät tulokset lähteiden omien aikaleimojen mukaan selaimessa.
  Välimuistia ei ole. Hidas tai virheellinen lähde näkyy omana rivinään
  taulukossa, eikä se estä muiden lähteiden näyttämistä (prototyypissä tätä
  tilaa ei ole).
- **Google-yhteystiedot** on jo integraatiolistassa (`contacts`,
  `access: read`).
- **Päättynyt kone** on `own-machines`-vastauksen `expired: true`.
  Sijaisvastaus läpäisee tuotannon skeeman.
- **Microsoftin Ei näe -rivit postissa, kalenterissa ja yhteystiedoissa**
  (jaettu postilaatikko, kollegan kalenteri ja kokoushuoneet,
  organisaation osoitteisto) ovat oletuksia nykyisen Microsoft-yhteyden
  laajuudesta. Ne on tarkistettava `ms-365-mcp-server`in pyytämistä
  oikeuksista ennen toteutusta. Jos laajuus kattaa jaetut kohteet, rivit
  poistuvat.

## Kysymykset Jarille

1. **A, B vai C?** Vertaa kuvia `r2-a-valilehdet-0-oletus-1440-light`,
   `r2-b-yhdessa-0-oletus-1440-light` ja `r2-c-kortit-0-oletus-1440-light`.
   Suositus on B.
2. **Saako posti näkyä sisältöineen yhdessä listassa?** Vertaa kuvia
   `r2-b-yhdessa-1-posti-1440-light` (sisältö näkyy) ja
   `r2-c-kortit-0-oletus-1440-light` (sisältö taitettu, ensin vain taso).
   Tämä on kierroksen 1 avoin kysymys 2, nyt kaikkien tilien postille.
3. **Omat kierrokset tiedostoille ja postille, muut tähän?** Kuva
   `r2-b-yhdessa-0-oletus-1440-light` näyttää, miksi tiedostot tarvitsevat
   oman kierroksensa (tasotaulukko). Kalenteri, yhteystiedot, koodi ja
   koneet jäisivät tämän kierroksen mukaisiksi.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-resurssien-lajit/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/resurssien-lajit/offline.html \
  --title "Agentin käytössä – kierros 2: lajien osiot" \
  --idempotency-key "$(uuidgen)" --json
```

## Tarkistus

`check.mjs` ajaa 293 tarkistuspistettä, ja konsoli pysyy puhtaana. Kaikki
riffit on käyty läpi 1440 ja 390 px leveänä vaaleassa teemassa kymmenessä
vaiheessa, ja oletukset myös tummassa teemassa. Kuvat on otettu
kertoimella 2 ja tallennettu AVIF-muodossa. Integraatiolistan ja omien
koneiden sijaisvastaukset läpäisevät tuotannon skeemavalidoinnin.
Prototyyppi on synteettinen komponenttilabra, jota ei ole ajettu hostia
vasten. Tuotantokoodiin ei koskettu.

## Päätökset myöhempää katselmointia varten

- **Vasemmalla on vain lajit, ei lähteitä niiden alla.** Lähteet ovat nyt
  osion sisällä, joten kierroksen 1 B:n lähdelista olisi toistanut ne.
  Vaihtoehto oli pitää B:n lista ja avata osio lajin otsikosta, mutta
  silloin sama lähde olisi näkynyt kahdessa paikassa.
- **Oletuslaji on tiedostot**, koska siinä on eniten lähteitä ja riffien
  erot näkyvät siinä selvimmin.
- **Koneiden lause** on "pääsee" eikä "voi muuttaa", ja päättyneen
  pääsyn kone on lajissa mukana (*ei pääse 1*), jotta pääsyn
  päättyminen näkyy eikä kone vain katoa näkymästä.
- **B:n yhdistetyt tiedostot** näyttävät lähteiden juuret rinnakkain
  yhtenä kansiona *Kaikki tiedostot*. Tiedostoja ei yhdistetä yhdeksi
  puuksi, koska samannimiset kansiot eri tileillä sekoittuisivat.
