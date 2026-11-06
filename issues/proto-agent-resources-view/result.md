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
