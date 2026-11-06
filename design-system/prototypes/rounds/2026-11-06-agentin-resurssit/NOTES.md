# Agentin käytössä – kierros 1

Issue `proto-agent-resources-view`. Jatkoa `proto-browse-what-agent-sees-m365`
-kierroksen 1 suunnalle B (Tiedostot), josta Jari piti 6.11.: erillinen,
selattava näkymä laajennetaan kattamaan kaikki integraatiot tasoineen ja
rajoineen, ja sen kautta pääsee integraatioiden asetuksiin ja yhdistämiseen.

**Ero edelliseen kierrokseen oletusnäkymässä:** sivupalkin merkintä on nyt
*Agentin käytössä* (ei *Tiedostot*), ja sivun lista näyttää kaikki kuusi
yhteyttä (Microsoft 365, Google, Dropbox, GitHub, Gitea, oma kone) ja
yhdistämättömät palvelut, ei vain Microsoftin tiedostoja.

Rakennettu tuotannon komponenteista: `AppShell`, `WorkspaceRail`,
`WorkspaceNavRow`, `LinkRow`, `AccountShelf`, koko `AccountSettings`
(Tiedot agenteille, Koodipalvelut, Omat koneet oikeine kortteineen),
`LetterMark`, `levelName`, tuotannon tasopilleri (`ig-lv`), `ControlButton`,
`ExternalLink`, `StatusMark`, `Markdown`. Hostin paikalla on `fetch`-sijainen,
jonka integraatiolista ja omat koneet läpäisevät tuotannon sopimusskeemat.
Kierroksen omia ovat lista, lähteen otsake (taso, mitä agentti voi, "Ei voi
estää") ja selaimet postille, kalenterille, yhteystiedoille, repoille ja
koneelle. Kaikki on synteettistä: Contoso, Aino Virtanen.

## Akseli ja suunnat

Akseli: miten lista järjestää kaiken. Sijainti, lähteen näkymä ja sisältö
ovat samat.

- **A Tileittäin**: lista on tilit kuten asetuksissa, jokaisen tilin alla sen palvelut; taso ja rajat tilin rivillä.
- **B Lajeittain**: lista on lajit (tiedostot, posti, kalenteri, yhteystiedot, koodi, koneet), joiden alla kaikkien tilien lähteet tasoineen.
- **C Oikeuksittain**: lista on kolme ryhmää, Voi muuttaa, Lukee ja Ei näe; tason vaihto siirtää lähteen ryhmästä toiseen.

Suositus: **A Tileittäin** (result.md).

## Sama kaikissa suunnissa

- Sivupalkissa työtilojen yllä *Agentin käytössä* (13 lähdettä). Sivun
  yläosassa yhteenveto ja *Yhdistä palvelu*.
- Työpöydällä lista vasemmalla, valittu lähde oikealla. Puhelimessa lista
  ensin ja lähde omana ruutunaan *‹ Agentin käytössä* -paluulla.
- Lähteen otsake: tilin merkki ja osoite, taso nimellä ja lauseella siitä,
  mitä agentti voi; *Ei voi estää* omana rivinään (jakolinkki, kalenterin
  kutsut, GitHubin reporajaus, ylläpitäjän pääsy koneelle); *<Tili>-asetukset*
  vie tuotannon asetussivulle juuri sen tilin riville, ja *Avaa …* palvelun
  omaan näkymään.
- Selattavaa: tiedostot kansioittain (OneDrive, kolme SharePoint-kirjastoa,
  Driven valittu kansio, Dropboxin sovelluskansio), posti kansioittain
  (agentin lähettämätön luonnos merkitty), kalenteri kahdelta viikolta,
  yhteystiedot, repot (luku ja push / vain luku), kone (tila, käyttäjä,
  päättymispäivä; Habitat ei selaa koneen tiedostoja).
- *Agentti ei näe* jokaisen lähteen alla, korjattavissa olevat
  toimintoineen (*Valitse kirjastot*, *Valitse kansiot*, *Vaihda taso*).
- Yhdistämättömät (Apple, IMAP, GitLab, toinen kone) *Yhdistä*-painikkeella,
  joka avaa asetussivun kyseisen palvelun rivin.

## Yläpalkin ohjaimet

- *Microsoft 365 -taso*: Täysi / Luonnokset, ei lähetystä / Vain luku.
  Tasopilleri, lauseet ja C:n ryhmät seuraavat; vain luku -tasolla agentin
  luoma viikkoraportti ja postiluonnos puuttuvat.
- *Alusta* palauttaa alkutilan.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-agentin-resurssit/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-agentin-resurssit/check.mjs \
  design-system/prototypes/dist/agentin-resurssit/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px vaaleana: oletus,
Outlook ja agentin luonnos, GitHub-repot ja rajat, oma kone, Ei näe, Vain
luku, Luonnokset-taso (posti kirjoitettavissa, ei lähetystä), lähteen
asetukset tuotannon asetussivulla ja takaisin, Applen yhdistäminen listasta.
Oletukset myös tummana. 238 tarkistuspistettä, konsoli puhdas, kuvat
kertoimella 2. `index.html` on sama ilman upotettuja fontteja glasspadia
varten.
