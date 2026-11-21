# Ensimmäinen keskustelu: omat ohjeet agentille

Issue `new-user-agent-instructions-template` (Jari 21.11.2026). Käyttöönotto
päättyy keskusteluun, jossa agentti kysyy ihmiseltä muutaman asian ja
kirjoittaa niistä hänen omat ohjeensa tiedostoon `~/.pi/agent/AGENTS.md`.
Clauden `~/.claude/CLAUDE.md` tuo saman tiedoston. Suunnat, suositus ja
kysymykset Jarille ovat issuen `result.md`:ssä.

Akseli: **miten agentti saa tiedot** (kysyy, ehdottaa vai antaa lomakkeen).

- **1 Haastattelu**: kuusi lyhyttä kysymystä yksi kerrallaan. Jokaisessa
  on pikavastaukset, Ohita ja vapaa teksti kentässä. Lopuksi tulee luonnos.
- **2 Luonnos ensin** (suositus): agentti kertoo, mitä se jo tietää ja
  mistä, näyttää heti luonnoksen ja kysyy vain puuttuvat kaksi asiaa.
  Jokainen vastaus päivittää luonnoksen.
- **3 Lomake**: agentti antaa keskusteluun lomakekortin. Lähetys näkyy
  ihmisen viestinä, ja siitä tulee luonnos.

Kaikissa suunnissa on sama luonnoskortti (polku, Uusi tiedosto / Lisäys
nykyiseen, Clauden viittaus, Tallenna / Muuta vielä), tallennus (tool-rivit
`write` tai `edit`), käyttöönoton loppurivi (Siirry työtiloihin / Näytä
ohjeet asetuksissa) ja Asetukset → Tili → Ohjeet agentille. Kentän yllä on
käyttöönoton kaista (kysymys n/N, luonnos tai lomake) ja sen Tee myöhemmin.

## Käyttö

Oletusnäkymä on keskustelu, jossa suunnat eroavat. **Alkuun käyttöönoton
lopusta** näyttää koko kulun: käyttöönoton viimeinen kortti
(`OnboardingFrame`, reitti valmis), Aloita keskustelu tai Tee myöhemmin
(Työtilat ja muistutuskortti). **Tili**-valinta vaihtaa tilanteen: Uusi tili
tai Ohjeet jo olemassa (olemassa oleva tiedosto, jota ei kirjoiteta päälle).
`?theme=light|dark|contrast`, `?lang=en`, `?scenario=existing` ja
`?stage=landing` valitsevat alkutilan.

```
node build.mjs <out-dir>          # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

## Kysymykset suunnittain

**1 Haastattelu** (olemassa olevassa tiedostossa kieli ohitetaan, ja kysymyksiä on viisi):

1. Miten haluat, että sinua puhutellaan? (Aino / Aino Laine)
2. Millä kielellä vastaan? (Suomeksi / Suomeksi, tekniset termit
   englanniksi / Englanniksi)
3. Mitä teet, ja mihin aiot käyttää agenttia? Omin sanoin kertominen auttaa
   eniten. (Ohjelmointi ja omat projektit / Tekstit ja selvitykset / Arjen
   asiat)
4. Millaisia vastauksia haluat? (Lyhyesti ja suoraan / Selitä vaiheet /
   Kysy, jos epäselvää)
5. Onko jotain, mitä en saa tehdä kysymättä? (Ennen julkaisua tai pushia /
   Ennen kuin poistat mitään / Ei rajoituksia)
6. Vielä jotain muuta, mitä minun on hyvä tietää? (Ei muuta, näytä luonnos)

Kysymyksiin 1–5 voi vastata myös Ohita-napilla. Vapaa teksti vastaa aina
avoinna olevaan kysymykseen ja menee tiedostoon sellaisenaan.

**2 Luonnos ensin**: agentti tietää GitHubista nimen, Habitatin kielestä
kielen ja GitHub-kuvauksesta työn. Se kertoo myös, ettei kirjoita yhdistettyjä
tilejä tai työtiloja ohjeisiin, koska näkee ne aina ajantasaisina. Agentti
kysyy kaksi asiaa: millaisia vastauksia haluat ja mitä en saa tehdä
kysymättä. Pikavastauksina ovat tyyli- ja kysy ensin -vaihtoehdot sekä
Näyttää hyvältä, tallenna. Vapaa teksti menee Muuta-osioon.

**3 Lomake**: kentät ovat samat kuin haastattelun kysymykset (nimi, kieli,
käyttö ja vapaa kuvaus, vastaukset, kysy ensin ja Muuta). Kaikki kentät ovat
vapaaehtoisia. Olemassa olevassa tiedostossa kielikenttä kertoo, että kieli
on jo ohjeissa.

Muuta vielä -napin jälkeen kaikissa suunnissa on vaihtoehdot Vastaa
lyhyemmin, Kysy ennen pushia, Selitä vaiheet ja Näyttää hyvältä, tallenna
sekä vapaa teksti.

## Pohja, jonka agentti täyttää

Tyhjä osio jätetään pois. Tiedosto kirjoitetaan keskustelun kielellä.

```markdown
# <nimi GitHubista>

Omat ohjeeni agenteille. Pi lukee tämän tiedoston, ja Claude lukee sen
~/.claude/CLAUDE.md:n kautta. Muokkaa vapaasti.

## Kuka olen
- Puhuttele minua nimellä <nimi>.
- <työ / mihin käytän agenttia, omin sanoin>

## Kieli
- <Vastaa suomeksi. | … tekniset termit englanniksi. | Vastaa englanniksi.>

## Miten vastaat
- <tyyli>

## Kysy ensin
- <rajat>

## Muuta
- <vapaa teksti>
```

Pohjassa ei ole mitään siitä, minkä Open Habitat jo kertoo jokaisessa
keskustelussa (`internal/daemon/host-context.md` Pi:n
`open_habitat`-osiona, `open-habitat skill print agent`). Siitä puuttuvat siis
ympäristö, työtilat `~/src`:ssä, linkit asetuksiin, yhdistetyt tilit,
tallennustila, valtuuksien rajat ja yleinen "vastaa ihmisen kielellä".
Kieli-osio vain tarkentaa yleistä sääntöä, kuten sitä, mitkä termit jäävät
englanniksi. Tiedosto kertoo ihmisestä, ei ympäristöstä: jos ympäristöstä
kerrottaisiin kahdessa paikassa, kuvaukset alkaisivat erota ensimmäisen
julkaisun jälkeen.

Olemassa olevan tiedoston kohdalla ehdotus on lisäys: alkuperäinen sisältö
pysyy ennallaan ensimmäisenä, ja agentti lisää perään vain ne osiot, joita
siinä ei vielä ole. Kortti merkitsee lisätyt rivit `+`-merkillä.

## Hostin puoli

**Miten käyttöönotto aloittaa keskustelun.** Reitin viimeinen vaihe (AI-tili)
on nyt `finish` / `onUsable` -kohta (`web/src/app/GitHubOnboarding.tsx`).
Ehdotus: sen jälkeen näytetään vielä `OnboardingFrame step="done"` -kortti
Aloita keskustelu / Tee myöhemmin. Aloita keskustelu luo tavallisen
selainkeskustelun kotihakemistoon (`cwd = ~`, otsikko Omat ohjeet
agentille) ja lähettää ensimmäiseksi viestiksi julkaisun mukana tulevan taidon
kutsun, esimerkiksi `/skill:open-habitat-instructions`. Taito sisältää
kysymykset, pohjan ja kirjoitussäännöt, eli saman mekanismin kuin
aloitussivun tavoitteet (`goalDraft`). Uutta hostin tilaa ei tarvita: se, onko
tiedosto olemassa, luetaan tiedostosta, ja "tehty / myöhemmin" on käyttöönoton
oma merkintä samaan tapaan kuin `finishFirstRoute`. Kaistan "kysymys n/N" on
prototyypin oma: tuotannossa sen antaisi agentti tai se jätettäisiin pois
(katso result.md).

**Miten tiedosto kirjoitetaan turvallisesti.** Agentti kirjoittaa ihmisen
omana Unix-käyttäjänä omilla työkaluillaan. Uutta valtuutta tai
daemon-operaatiota ei tarvita.

- Uusi tiedosto luodaan vain, jos sitä ei ole: luonti epäonnistuu, jos kohde
  on jo olemassa (`O_EXCL`, shellissä `set -o noclobber`). Silloin agentti
  siirtyy lisäyspolulle. Hakemisto `~/.pi/agent` luodaan tarvittaessa.
- Olemassa olevaan tiedostoon tehdään vain lisäys. Agentti lukee tiedoston,
  näyttää ehdotuksen ja tarkistaa ennen kirjoittamista, että sisältö on yhä
  sama kuin luettaessa (tiiviste). Jos se on muuttunut, agentti näyttää
  ehdotuksen uudelleen. Kirjoitus tehdään väliaikaistiedoston ja `rename`n
  kautta, joten puolikasta tiedostoa ei synny.
- Mitään ei kirjoiteta ennen Tallenna-painallusta tai selvää "tallenna"
  -vastausta. Tee myöhemmin ei kirjoita mitään.
- Asetusten Muokkaa tekstinä -toiminto vaatii daemonilta uuden
  kirjoitusoperaation (ihmisen omana käyttäjänä, sama vertaa ja vaihda
  -sääntö). Se on erillinen päätös (result.md).

**Miten Clauden tiedosto viittaa.** Claude Code tukee `CLAUDE.md`:ssä
tuontirivejä (`@polku`). Jos `~/.claude/CLAUDE.md`:tä ei ole, agentti luo sen
yhdellä rivillä `@~/.pi/agent/AGENTS.md`. Jos tiedosto on olemassa eikä siinä
ole tuontia, agentti lisää rivin alkuun eikä koske muuhun sisältöön. Jos
tuonti on jo olemassa, Clauden tiedostoon ei kosketa. Symlinkkiä ei käytetä:
se korvaisi ihmisen oman `CLAUDE.md`:n.

## Rakenne

Sivu koostuu tuotannon osista: `OnboardingFrame` (reitti valmis),
`AppShell`, `WorkspaceRail`, `AccountShelf`, `AgentHeader`,
`ConversationFrame`, `ConversationStream`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Markdown`, `ControlButton`,
`HabitatMark` ja `Composer`, jonka `beforeField`-paikassa on käyttöönoton
kaista. Kierroksen omia osia ovat pikavastaukset, luonnoskortti,
lomakekortti, Työtilat-sivun muistutus ja asetusten osio. Kirjastoon
(`lib/`) ei tehty muutoksia.
