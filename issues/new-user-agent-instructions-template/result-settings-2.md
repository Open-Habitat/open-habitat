# Prototyyppikierros: Asetukset › Tili › Ohjeet agentille, kierros 2

## Saatesanat

Jari, ohjeet näytetään nyt tavallisena Markdown-lohkona, kuten pyysit
(B Teksti muokattuna). Lohko avautuu Esikatseluun, Muokkaa-välilehdellä on
raaka teksti, ja painikkeet ovat Tallenna ja Peru. Sama editori on
käyttöönoton viimeisessä vaiheessa, joten molemmat näkymät näyttävät ja
muokkaavat samaa tiedostoa samalla tavalla. Lohkon alla kerrotaan, mikä
tiedosto on kyseessä ja lukeeko Claude sitä. Valitse ylhäältä **Tilanne**:
Käyttöönotossa kirjoitettu, Ei vielä ohjeita, Itse kirjoitetut tai Muuttuu
sillä välin. Viimeisessä agentti on muuttanut tiedostoa toisessa
keskustelussa sillä aikaa, kun muokkaat sitä. Tallennus hylätään, editori
yhdistää muutokset kuten työtilaeditori ja pyytää tallentamaan uudelleen.
Jos sama rivi on muuttunut molemmissa, valitset ensin, kumpi jää. Akseli
on se kysymys, jonka jätit auki: jääkö Muokkaa agentin kanssa editorin
viereen. **B1** pitää sen toissijaisena painikkeena, **B2** jättää sen
pois. Suosittelen **B1**:tä.

## Sivu

- Rakennettu sivu: `/var/tmp/agent-keep/new-user-agent-instructions-template/settings-2/offline.html`
  (fontit upotettuina) ja `index.html` (ilman fontteja Glasspadia varten).
- Ruutukaappaukset (1440 ja 390 px; Päivä, Yö ja Kontrasti; kaikki
  tilanteet ja kulut; englanti):
  `/var/tmp/agent-keep/new-user-agent-instructions-template/settings-2/shots/`.
- Lähteet: `design-system/prototypes/rounds/2026-11-21-instructions-settings-2/`
  (jaettu editori on `editor.tsx`). Rakennus: `node build.mjs <out>`.
  Tarkistus: `node check.mjs <out>/offline.html <shots>` (914 tarkistusta,
  konsoli puhdas; 63 ruutukaappausta).
- Rakenne: kierroksen `NOTES.md`.

## Akseli ja suunnat

Akseli: **jääkö Muokkaa agentin kanssa editorin viereen toissijaiseksi
toiminnoksi.**

- **B1 Editori ja agentti**: editorin toimintorivillä vasemmalla on
  toissijainen Muokkaa agentin kanssa. Jos tiedostoa ei ole, painike on
  ensisijainen Kirjoita agentin kanssa. Painike avaa saman kotihakemiston
  keskustelun kuin kierroksella 1: agentti on lukenut tiedoston, ehdottaa
  muutosta ja tallentaa, kun sanot. Sen jälkeen pääset takaisin
  päivittyneeseen editoriin.
- **B2 Pelkkä editori**: agentin painiketta ei ole. Tyhjä tila neuvoo
  kirjoittamaan Muokkaa-välilehdellä tai pyytämään agenttia missä tahansa
  keskustelussa. Itse kirjoitetun tiedoston kohdalla näkymä neuvoo
  pyytämään agenttia lisäämään Clauden viittauksen.

Kaikille yhteistä: editori avautuu Esikatseluun, eikä Tallenna näy ennen
muutosta. Muutos näyttää merkinnän "Tallentamattomia muutoksia", Peru
palauttaa tiedoston tekstin, ja tallennuksen jälkeen näkyvät "Tallennettu"
ja lähderivillä "Päivitetty juuri". Lähderivillä ovat tiedoston polku,
muokkauspäivä, tieto siitä, että Pi lukee tiedoston, ja tieto siitä,
lukeeko Claude sen. Itse kirjoitetun tiedoston alla on huomautus, ettei
agentti kirjoita oman tekstin päälle.

## Suositus

**B1. Muokkaa agentin kanssa jää toissijaiseksi toiminnoksi.** Editori
riittää omaan tekstiin, ja siksi se on näkymän pääosa. Kaksi tapausta
ratkeaa kuitenkin vain agentin kanssa. Ensimmäinen on tyhjä tiedosto:
aloittelija ei tiedä, mitä tyhjään kenttään kirjoitetaan, ja agentti kysyy
samat pari asiaa kuin käyttöönotossa. Toinen on Clauden puuttuva viittaus.
Editori muokkaa vain ohjetiedostoa, ja sen pitääkin, koska Clauden omaan
tiedostoon ei kosketa Asetuksista. Agentti voi ehdottaa viittausta ja
näyttää muutoksen. Painike ei myöskään vaadi hostilta mitään uutta: se
avaa tavallisen keskustelun, jonka agentti kirjoittaa omilla
työkaluillaan. B2:ssa nämä kaksi tapausta jäävät ohjetekstin varaan
("pyydä agenttia missä tahansa keskustelussa"), eli ihmisen pitää itse
tietää, mihin keskusteluun mennä ja mitä sanoa.

## Mitä host-tietoja näkymä olettaa

- Ohjetiedoston sisältö, versio ja muokkausaika sekä se, lukeeko Claude
  sen: onko `~/.claude/CLAUDE.md`:ssä tuontirivi `@~/.pi/agent/AGENTS.md`,
  omia ohjeita ilman sitä, vai puuttuuko tiedosto kokonaan.
- Vertaa ja vaihda -kirjoitus. Molemmat kuvataan alla.

## Päätökset myöhempää katselmointia varten

- **Editorin vaatimat host-operaatiot.** Molemmat ajaa ihmisen oma daemon
  hänen Unix-käyttäjänään. Gateway vain todentaa ja reitittää kuten muut
  tilin pyynnöt. Uutta valtuutta ei tule: daemon kirjoittaa jo nyt ihmisen
  kotihakemistoon (Git-identiteetti `~/.gitconfig`:iin), ja nämä
  operaatiot koskevat vain kahta kiinteää polkua. Polkua ei koskaan oteta
  pyynnöstä. Muoto mukailee työtilaeditorin tiedosto-operaatioita
  (`contracts/v1/workspace-editor-files.schema.json`), jotta sama
  selainlogiikka ja yhdistäminen käyvät.
  - **Luku** (esim. `GET /api/v1/account/agent-instructions`): daemon lukee
    `~/.pi/agent/AGENTS.md`:n. Vastauksessa ovat `exists`, `version`
    (`sha256:v1:…` kuten editorissa), `content`, `newline`, `modified` ja
    Clauden tila `claude: imports | own | none`, joka päätellään
    `~/.claude/CLAUDE.md`:stä vain lukemalla. Vain tavallinen
    UTF-8-tekstitiedosto kelpaa (ei CR/NUL-merkkejä, enintään 1 MiB). Muu
    tiedosto palauttaa virheen eikä sisältöä. Habitat ei tallenna tilasta
    mitään. Vastaus on `no-store`.
  - **Kirjoitus** (esim. `PUT` samaan osoitteeseen): pyynnössä on joko
    `base_version` tai `create: true` sekä `content`. Jos `base_version` ei
    vastaa levyllä olevaa versiota, vastaus on `409 file_changed` ja
    mitään ei kirjoiteta. Muuten daemon kirjoittaa väliaikaiseen
    tiedostoon samaan hakemistoon ja vaihtaa sen paikalleen säilyttäen
    oikeudet. `create` luo tiedoston vain, jos sitä ei ole (`O_EXCL`), ja
    luo silloin myös `~/.claude/CLAUDE.md`:n tuontirivillä, jos sitäkään ei
    ole (`O_EXCL`). Olemassa olevaa Clauden tiedostoa ei muokata koskaan.
    Kadonnut vastaus on epävarma, eikä selain yritä uudelleen
    automaattisesti, kuten työtilaeditorissakaan.
  - Kaikki ristiriitojen käsittely tehdään selaimessa
    (`editorMerge.threeWay`): daemon vain vertaa versiota ja kieltäytyy.
    Lukitusta tai rinnakkaista tilaa ei ole.
  - Tämä on uusi kohta selaimen ja hostin rajapinnassa. Se kirjataan
    issueen tai ADR:ään ja skeemaan ennen toteutusta.
- **Muokkaa agentin kanssa jää (B1).** Perustelu on suosituksessa.
- **Ristiriita näytetään työtilaeditorin omalla kortilla.** Vaihtoehto oli
  oma "Korvaa omallani / Hae uusin" -valinta. Sama kortti ja sama
  yhdistäminen tarkoittavat, että samanlainen tilanne näyttää samalta kuin
  työtilan tiedostoissa. Prototyypin tekstikenttä ei merkitse ihmisen riviä
  punaisella kuten CodeMirror. Toteutuksessa Muokkaa-välilehti voi olla
  tuotannon `CodeMirrorEditor` Markdown-tilassa (kysymys 3).
- **Tyhjän tiedoston kirjoittaminen itse luo myös Clauden viittauksen**,
  jos Clauden tiedostoa ei ole. Muuten itse kirjoitettu ensimmäinen lappu
  jäisi Claudelta lukematta ilman, että ihminen tietää syytä.
- **Teemat Päivä, Yö ja Kontrasti, kielet suomi ja englanti.**

## Kysymykset Jarille

1. Kelpaako B1, eli Muokkaa agentin kanssa jää editorin viereen
   toissijaiseksi toiminnoksi?
2. Hyväksytkö daemonin kaksi uutta operaatiota: kiinteän ohjetiedoston
   luvun ja vertaa ja vaihda -kirjoituksen ihmisen omana käyttäjänä? Clauden
   tiedosto luodaan vain, jos sitä ei ole, eikä olemassa olevaa muokata
   koskaan. Tämä on rajapintamuutos, joten se kirjataan ennen toteutusta.
3. Riittääkö Muokkaa-välilehdelle tavallinen tekstikenttä, vai käytetäänkö
   työtilaeditorin CodeMirroria? CodeMirror toisi rivimerkinnät
   ristiriitaan ja syntaksivärit, mutta raskaampana.
4. Pysyykö kohdan nimi Asetuksissa "Ohjeet agentille", kun käyttöönotto
   puhuu muistilapusta? Prototyyppi pitää nimen ja kertoo johdannossa, että
   kyse on muistilapusta.
