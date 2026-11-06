# Agentin käytössä – kierros 2: lajien osiot

- **A Välilehdet**: lajin osio näyttää yhden lähteen välilehtenä; taso ja rajat sen yllä, Ei näe sen alla.
- **B Yhdessä**: kaikkien tilien sisältö yhtenä listana (posti yhdessä, kalenteri yhdessä); tasot pienenä taulukkona yllä, Ei näe koko lajista alla.
- **C Kortit**: jokainen lähde on kortti, jossa taso, rajat ja Ei näe; sisältö avautuu kortin Selaa-painikkeesta.

Issue `proto-agent-resources-view`. Kierroksella 1
(`design-system/prototypes/rounds/2026-11-06-agentin-resurssit/`) Jari
valitsi suunnan B Lajeittain ja kysyi, saako jokainen laji oman
kierroksensa. Tällä kierroksella kaikkien lajien osiot suunnitellaan yhdessä,
jotta ne pysyvät yhtenäisinä. Lajit ovat tiedostot (OneDrive, SharePoint,
Google Drive, Dropbox), posti, kalenteri, yhteystiedot, koodi (GitHub, Gitea)
ja omat koneet.

**Ero edelliseen kierrokseen oletusnäkymässä:** vasemmalla on nyt vain
kuusi lajia tilien nimineen (B:n otsikot). Oikealla on valitun lajin osio,
joka kertoo yhdellä lauseella, montako lähdettä lajissa on ja mitä agentti
niille voi, sekä mitä osiossa listataan. Osion runko vaihtelee riffin
mukaan.

Rakennettu tuotannon komponenteista: `AppShell`, `WorkspaceRail`,
`WorkspaceNavRow`, `LinkRow`, `AccountShelf`, koko `AccountSettings`
(Tiedot agenteille, Koodipalvelut ja Omat koneet oikeine kortteineen),
`LetterMark`, `levelName`, tuotannon tasopilleri (`ig-lv`), `ControlButton`,
`IconButton`, `ExternalLink`, `StatusMark` ja `Markdown`. Hostin paikalla on
`fetch`-sijainen, jonka integraatiolista ja omat koneet (nyt kaksi konetta,
joista toisen pääsy on päättynyt) läpäisevät tuotannon sopimusskeemat.
Kaikki on synteettistä: Contoso, Aino Virtanen.

## Akseli

Akseli on lajin osion yhteinen rakenne eli se, miten taso ja sisältö
kohtaavat. Lajit, lähteet, tasot, rajat, Ei näe -rivit ja asetusreitit ovat
samat kaikissa riffeissä.

## Jokaisen lajin osiossa

Jokaisessa osiossa on samat osat:

- otsikko ja lause siitä, mitä agentti voi (esim. "5 lähdettä 3 tililtä.
  Agentti voi muuttaa 4, lukee 1.")
- mitä listataan
- taso ja rajat lähteittäin
- selattava sisältö
- Agentti ei näe
- tie asetuksiin ja *Yhdistä*

| Laji | Lähteet | Selattavaa | Ei voi estää | Agentti ei näe | Yhdistä |
|---|---|---|---|---|---|
| Tiedostot | OneDrive, SharePoint (Asiakasprojektit, Myynti), Drive (Kuitit 2026), Dropbox (sovelluskansio) | kansiot ja tiedostot, agentin luoma raportti merkitty | jakolinkki (Microsoft, Täysi) | valitsematon kirjasto, Johtoryhmä, muut sivustot, muu Drive, muu Dropbox | – |
| Posti | Outlook, Gmail | kansiot ja viestit, agentin lähettämätön luonnos merkitty | lähetetty viesti lähtee heti (Täysi) | jaettu postilaatikko | Apple, IMAP |
| Kalenteri | Outlook, Google | tämä ja ensi viikko | osallistujat saavat aina kutsun (Täysi) | kollegan kalenteri ja kokoushuoneet | Apple |
| Yhteystiedot | Outlook, Google | nimet ja osoitteet | – | organisaation osoitteisto | Apple |
| Koodi | GitHub, Gitea | repot, luku ja push / vain luku, työtila | yksittäisiä repoja ei voi rajata | kesko-digital (organisaatio estää) | GitLab |
| Koneet | aino-mbp (päättyy 4.12.), aino-pc (päättyi 1.11.) | tila, käyttäjä, verkko, päättymispäivä; ei tiedostoja | ylläpitäjä pääsee samaa reittiä | macOS:n suojatut kansiot | Toinen kone |

Asetuksiin pääsee jokaisesta lähteestä tuotannon asetussivun sille tilille
(*Microsoft 365 -asetukset*, *GitHub-asetukset*, *Koneen asetukset*). A:ssa
painike on valitun lähteen alla, B:ssä taulukon rivin rataskuvake ja C:ssä
kortin alalaita. Korjattavat Ei näe -rivit vievät suoraan oikeaan kohtaan
(*Valitse kirjastot*, *Valitse kansiot*, *Vaihda taso*).

Puhelimessa lajit näkyvät ensin, ja osio aukeaa omaksi ruudukseen
*‹ Agentin käytössä* -paluulla.

## Yläpalkin ohjaimet

- *Microsoft 365 -taso*: Täysi / Luonnokset, ei lähetystä / Vain luku.
  Lauseet, pillerit ja rajat seuraavat tasoa. Vain luku -tasolla agentin
  raportti ja luonnos puuttuvat.
- *Alusta* palauttaa alkutilan.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-resurssien-lajit/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-resurssien-lajit/check.mjs \
  design-system/prototypes/dist/resurssien-lajit/offline.html "$(mktemp -d /var/tmp/agent-scratch/r2-XXXX)"
```

`check.mjs` käy jokaisen riffin läpi 1440 ja 390 px leveänä vaaleassa
teemassa. Vaiheet ovat oletus (tiedostot), posti ja agentin luonnos,
kalenteri, yhteystiedot, koodi rajoineen, koneet, Ei näe, Vain luku ja
Luonnokset-taso, Microsoftin asetukset postin osiosta ja takaisin sekä
Applen yhdistäminen postin osiosta. Oletukset kuvataan myös tummassa
teemassa. Tarkistuspisteitä on 293, konsoli on puhdas ja kuvat on otettu
kertoimella 2. `index.html` on sama sivu ilman upotettuja fontteja
glasspadia varten.
