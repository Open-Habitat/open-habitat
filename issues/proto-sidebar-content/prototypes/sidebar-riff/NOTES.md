# Sivupalkin työtilat · Kierros 2

Kierroksella 1 Jari valitsi Nyt-sivupalkin (`../sidebar/`). Ylimpänä on
*Sinun vuorosi* (kysymys tai uusi vastaus) ja sen alla *Käynnissä*. Hän pyysi
kahta muutosta, ja ne ovat mukana kaikissa muunnelmissa:

- Käynnissä-lohkossa ovat myös agentit, jotka odottavat taustatyötä
  (prosessia tai Taskfleet-workeria). Niissä on tuotannon *Odottaa
  taustatyötä* -merkki (`agentPresentation.ts`, `waiting_background`):
  paikallaan pysyvä aksenttirengas, jonka keskellä on piste. Rivillä näkyy,
  mitä agentti odottaa.
- Työtilojen alla ei enää luetella agentteja. Rivi vie työtilan
  etusivulle, ja siellä ovat työtilan keskustelut.

Kierroksen aihe on se, miten työtilat näytetään näiden kahden lohkon alla,
sekä se, miten työtilan etusivu listaa agenttinsa. Ulkoasu tulee
`design-system/tokens/`-tiedostoista, ja kaikki nimet ja tekstit ovat
keksittyjä.

Synteettisessä datassa on 16 työtilaa: GitHubissa kahdella omistajalla,
Giteassa kahdella omistajalla ja paikallisesti. Kaksi niistä on arkistoitu
(`vanha-blogi`, `kesatyo-2024`). Käynnissä on kaksi taustatyötä odottavaa
agenttia: `kirjasto-api` odottaa workeria, joka työskentelee
`wt/muistutus-pohja`-worktreessä, ja `kotisivu` odottaa `npm test`
-prosessia. `opinnaytetyo`- ja `matkapaivakirja`-työtiloissa ei ole
keskusteluja.

## Neljä muunnelmaa

| # | Työtilat palkissa | Arkistoidut | Kapea kaista | Puhelin | Työtilan etusivu | Vahvuus | Hinta |
|---|---|---|---|---|---|---|---|
| 1 Aakkoset | Kaikki näkyvät työtilat aakkosjärjestyksessä, yhden rivin korkuisina. Suodatin on listan yllä. Oikealla on pieni vihje: huomiomäärä, työskentelypiste, taustatyön merkki tai ○ | Taitettuna listan lopussa (*Arkistoidut 2*). Suodatin löytää myös ne | Nyt-merkit ja ▢, joka levittää palkin | Laatikossa sama sisältö | Kolme ryhmää samalla sanastolla kuin palkissa: Sinun vuorosi, Käynnissä, Aiemmat. Spinoff on sisennettynä | Paikka ei muutu, joten työtila löytyy samasta kohdasta joka kerta. Muutos tuotantoon on pienin (nykyinen lista ilman keskusteluja) | Pitkä lista. Vihjeet toistavat osin sen, mikä näkyy jo ylempänä |
| 2 Viimeisimmät | Viisi viimeksi käytettyä työtilaa ja aika (*3 min*, *eilen*). Muut ovat *Kaikki työtilat 14* -avauksen takana aakkosjärjestyksessä, suodattimen kanssa | Kaikki-listan lopussa taitettuna | Viiden viimeisimmän kirjaimet ja ⋯, joka avaa kaikki | Laatikossa sama | Yksi lista, uusin ensin, ja aika jokaisella rivillä | Lyhyt, ja lähellä on se, mitä juuri käytit | Järjestys muuttuu käytön mukaan. ”Viimeksi käytetty” tarkoittaa tässä uusimman keskustelun aloitusaikaa (`started_at`). Pelkkä selaaminen ei nosta työtilaa |
| 3 Ryhmät | Ryhmät omistajan mukaan (*jari · Gitea*, *tailspin · GitHub*, *Paikalliset*). Ryhmän voi taittaa, ja taitetun ryhmän otsikossa näkyy huomio- ja käynnissä-merkki | Oma taitettu ryhmä lopussa | Yksi kirjainpainike ryhmää kohden. Se levittää palkin niin, että vain se ryhmä on auki | Laatikossa sama | Paikat: päätyöpuu ja jokainen worktree omana lohkonaan, keskustelut paikkansa alla | Sopii, kun työtilat jakautuvat selvästi (oma, työ, perhe). Etusivu näyttää worktreet, joista muut eivät kerro | Omistaja ei aina vastaa sitä, miten työtä ajattelee. Kapean kaistan ryhmäkirjaimet ovat epäselviä (*JI*, *JN*). Pisin palkki |
| 4 Haku ensin | Hakukenttä (`/` siirtää siihen) ja kolme viimeisintä. *Kaikki työtilat 14 →* vie etusivulle, joka on työtilojen hakemisto | Löytyvät vain haulla, ja niissä on merkintä *arkistoitu* | Nyt-merkit ja ⌕, joka levittää palkin ja siirtää kohdistuksen hakuun | Laatikossa haku ylimpänä | Tiivis taulukko, jossa on oma suodatin ja Kaikki / Käynnissä / Valmiit -valinnat | Lyhyin palkki, ja Nyt-lohkot saavat tilan. Haku osuu myös keskustelujen otsikoihin, joten vanhaan keskusteluun pääsee suoraan | Hiljaista työtilaa ei näe, ellei muista sen nimeä tai avaa etusivua. Kosketuksella haku on hitaampi kuin napautus |

Kaikissa muunnelmissa työtilan rivi vie työtilan etusivulle. Siellä on
repon tiedot (isäntä, omistaja/nimi, haara, muutokset), *Uusi keskustelu*,
*Tiedostot*, *Terminaali* ja keskustelulista muunnelman mukaisessa
muodossa. Arkistoidulla työtilalla on lisäksi *Palauta*. Kotipalvelin-
linkki vie työtilakorttien yleiskuvaan, kuten kierroksen 1 Nyt-ideassa.

## Havainto kaikista muunnelmista

1440 × 900 -näkymässä Sinun vuorosi ja Käynnissä vievät noin 520 px, kun
agentteja on seitsemän. Työtilat alkavat silloin vasta palkin alaosasta.
Muunnelmat 2 ja 4 kärsivät tästä vähiten. Muunnelmissa 1 ja 3 lista jää
pääosin vieritettäväksi. Käynnissä-rivin kaksirivisyys on tämän
kierroksen ulkopuolella, mutta tiivistäminen yhteen riviin (otsikko ja
merkki, työtila ja tila vasta osoittimella tai kapeammin) helpottaisi
jokaista muunnelmaa.

## Mitä tietoja kukin tarvitsee

Kaikki tarvittava on jo olemassa: `contracts/v1/snapshot.schema.json`
-tiedoston `workspace.visibility` (arkistoitu), `git_remote`,
`git_summary.github_repo` ja `gitea_origin.full_name` (omistaja),
`git_summary` (haara, muutokset), `worktrees` sekä agenttien `started_at`,
`waiting_on`, `parent` ja `worktree_id`.

- **Aakkoset**: ei uutta tietoa.
- **Viimeisimmät**: ”viimeksi käytetty” johdetaan työtilan uusimman
  keskustelun `started_at`-ajasta. Jos sen pitäisi tarkoittaa
  ”viimeksi avattu”, tieto olisi selaimen muistissa ja laitekohtainen, tai
  sitä varten tarvittaisiin uusi tallennettu tieto hostilla.
- **Ryhmät**: omistaja on saatavilla vain GitHub-reposta ja Giteasta, kun
  origin on tunnistettu HTTPS-osoite. SSH-originilla oleva Gitea-repo
  joutuu *Paikallisiin* tai ryhmään *Muu*.
- **Haku ensin**: haku kohdistuu snapshotissa jo oleviin nimiin ja
  otsikoihin.

## Kokeile

```
issues/proto-sidebar-content/prototypes/sidebar-riff/index.html
```

## Rakentaminen ja tarkistus

```sh
python3 issues/proto-sidebar-content/prototypes/sidebar-riff/build.py
npm ci --prefix web --ignore-scripts   # jos Playwright puuttuu
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node issues/proto-sidebar-content/prototypes/sidebar-riff/check.mjs
```

`check.mjs` käy läpi neljä muunnelmaa 1440 ja 390 px:n leveydellä sekä
vaalealla ja tummalla teemalla. Se tarkistaa, että Käynnissä-lohkossa on
kaksi taustatyötä odottavaa agenttia ja ettei työtilalistassa ole
agenttirivejä. Lisäksi se avaa työtilan etusivun, tyhjän työtilan ja
arkistoidun työtilan, kokeilee kapean kaistan ja puhelimen laatikon
(avaus, Escape, navigointi) sekä muunnelmakohtaiset toiminnot (suodatin,
Kaikki, ryhmän taitto, `/`-haku, tilavalinnat). Se myös varmistaa, ettei sivu
tee verkkopyyntöjä, kirjoita virheitä konsoliin tai vieritä vaakasuunnassa.
Kuvat tallentuvat hakemistoon `evidence/` nimillä
`<muunnelma>-<leveys>-<teema>-<tila>.png`.
