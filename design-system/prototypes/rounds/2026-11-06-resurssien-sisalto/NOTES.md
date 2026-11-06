# Agentin käytössä – kierros 3: lajin sisältö

- **A Kuten palvelussa**: kansiot, viestit ja repot näkyvät kuten palvelussa; taso ja rajat kerran yläosassa, Ei näe alimpana.
- **B Kohde kohteelta**: samat kohteet, mutta jokaisella rivillä on, mitä agentti voi juuri sille, ja mitä agentti ei näe, on harmaana omalla paikallaan.
- **C Vain rajat**: ei viestejä eikä tiedostoja; lähde kertoo, mikä on mukana ja mikä ei ja mitä agentti saa tehdä.

Issue `proto-agent-resources-view`, kierros 3 uudestaan. Kierroksella 1
(`design-system/prototypes/rounds/2026-11-06-agentin-resurssit/`) Jari valitsi
suunnan B Lajeittain. Kierros 2 suunnitteli vasemman listan uudelleen, ja Jari
sanoi sen menneen väärään suuntaan: lista oli jo kunnossa, ja auki oli lajin
sisältö. Siksi sivupalkin *Agentin käytössä* ja lajilista lähteineen ovat
kierroksen 1 B:n koodia muuttamattomina kaikissa suunnissa. Suunnat eroavat
vain siinä, mitä valittu lähde näyttää.

**Ero edelliseen kierrokseen oletusnäkymässä:** vasen lista on taas
kierroksen 1 B. Oikealla SharePointin kirjasto Asiakasprojektit näyttää
suunnan mukaan kansiot (A), kansiot rivikohtaisine tekoineen ja harmaat
valitsemattomat kirjastot (B) tai pelkän rajauksen ja teot ilman tiedostoja (C).

Rakennettu tuotannon komponenteista: `AppShell`, `WorkspaceRail`,
`WorkspaceNavRow`, `LinkRow`, `AccountShelf`, koko `AccountSettings`,
`LetterMark`, `levelName`, tasopilleri (`ig-lv`), `ControlButton`,
`ExternalLink`, `StatusMark` ja `Markdown`. Hostin paikalla on kierroksen 1
`fetch`-sijainen, jonka vastaukset läpäisevät tuotannon skeemat. Kaikki on
synteettistä (Contoso, Aino Virtanen).

## Akseli

Akseli on lähteen sisältö: mitä listassa on, miltä yksi kohde näyttää ja miten
taso ja rajat kohtaavat sisällön. Suunnat on piirretty kolmeen erilaiseen
lajiin: **Tiedostot** (OneDrive, SharePoint, Drive, Dropbox), **Posti**
(Outlook, Gmail) ja **Koodi** (GitHub, Gitea). Kalenteri, yhteystiedot ja
koneet näyttävät kaikissa suunnissa kierroksen 1 näkymän.

| | Lista | Yksi kohde | Taso ja rajat | Ei näe |
|---|---|---|---|---|
| A | kansiot, viestit, repot kuten palvelussa | esikatselu kuten palvelussa | laatikko kerran yläosassa | lista alimpana |
| B | samat kohteet, rivillä teko (*Muokkaa*, *Voi vastata*, *Lukee, varattu*) | esikatselu ja *Agentti tälle tiedostolle/viestille* ✓/✗ | rivillä ja avatussa kohteessa | harmaa rivi tai kansio omalla paikallaan |
| C | ei sisältöä: *Mukana* määrineen | ei kohteita; sisältö palvelussa (*Viestit näet Outlookissa*) | *Agentti saa* ✓/✗ ja *Ei voi estää* | *Ei mukana* -ryhmä |

## Mistä tieto tulee

Yläpalkin *Mistä tieto tulee* näyttää jokaisen lähteen alla, mistä host saa
kunkin näytetyn tiedon. Merkintä on katselmoinnin apu, ei tuotteen tekstiä.

- **integraatiolista**: daemonin `/api/v1/integrations` (tili, taso, palveluiden oikeudet).
- **yhdistämisen valinnat**: valitut kirjastot ja Driven kansio, jo daemonin tiedossa.
- **peilikansio**: daemon lukee `~/cloud/...` henkilön omana käyttäjänä (nimet, koot, ajat, määrät).
- **Microsoft sivua avattaessa (uusi lukureitti)**: viestit ja tiedoston muokkaaja/varaus Graphista henkilön tunnuksin, ilman välimuistia.
- **GitHub gh:n kirjautumisella / Gitea tea:n kirjautumisella**: repolista, `permissions.push`, organisaatiot.
- **Pi-historia**: agentin luoma tiedosto ja luonnos.
- **työtilalista**: repon työtila.
- **katalogin lause**: selaimen sanoitus tasosta.
- **oletus, tarkistettava**: jaettu postilaatikko (Microsoft-yhteyden laajuus).

## Ohjaimet

- *Microsoft 365 -taso*: Täysi / Luonnokset, ei lähetystä / Vain luku. A:n laatikko, B:n rivit ja C:n teot seuraavat tasoa.
- *Mistä tieto tulee*: tiedon lähteet näkyviin.
- *Alusta* palauttaa alkutilan.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-resurssien-sisalto/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-resurssien-sisalto/check.mjs \
  design-system/prototypes/dist/resurssien-sisalto/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi 1440 ja 390 px vaaleana yhdeksässä
vaiheessa ja oletukset myös tummana: 234 tarkistuspistettä, konsoli puhdas,
kuvat kertoimella 2.
