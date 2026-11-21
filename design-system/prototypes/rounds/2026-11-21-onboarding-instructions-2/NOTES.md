# Käyttöönoton viimeinen vaihe: ohjeet agentille (kierros 2)

Issue `new-user-agent-instructions-template`. Jari hylkäsi kierroksen 1
21.11.2026, koska siinä ohjeet kirjoitettiin erillisessä keskustelussa
käyttöönoton jälkeen. Tässä kierroksessa ohjeet ovat käyttöönoton reitin
**viimeinen vaihe**: GitHub, Repot, AI-tili, **Ohjeet agentille**. Vaihe näkyy
reitin edistymisessä samalla tavalla kuin muut vaiheet. Suunnat, suositus ja
kysymykset Jarille ovat issuen `result-2.md`:ssä.

Akseli: **missä muodossa vaihe kokoaa ohjeet**.

- **A Keskustelu**: vaihekortissa on pieni keskustelu. Agentti kertoo, mitä se
  jo tietää, näyttää luonnoksen keskustelussa ja kysyy kaksi puuttuvaa asiaa
  pikavastauksina. Tämä on kierroksen 1 suositeltu sisältö vaiheen asettelussa.
- **B Tiedosto** (suositus): vaihe näyttää luonnostiedoston. Jokaisen rivin
  vieressä lukee, mistä tieto tuli, ja puuttuvat kohdat valitaan suoraan
  tiedostosta. Agentin pieni keskustelu on vieressä, puhelimessa tiedoston
  alla.
- **C Lomake**: lyhyt lomake, jonka kentät on täytetty valmiiksi siltä osin
  kuin tiedot tunnetaan. Jokaisessa kentässä on Kysy agentilta -apu, jonka
  ehdotuksen voi ottaa käyttöön. Valmiin tiedoston saa näkyviin.

Kaikissa suunnissa on sama sisältö, sama pohja ja samat lopputilat:

- **Tallenna ohjeet**: reitin viimeinen vaihe merkitään valmiiksi, ja kortti
  näyttää kirjoitetut tiedostot (`write` kummallekin) ja tiedoston sisällön.
  Siirry Habitatiin -painike vie työtiloihin.
- **Tee myöhemmin**: mitään ei kirjoiteta. Vaihe merkitään ohitetuksi
  (katkoviiva, "Myöhemmin"), ja reitti päättyy silti. Työtilat-sivulla on
  muistutus, jonka Tee nyt -painike avaa saman vaiheen Asetuksiin (Tili →
  Ohjeet agentille).
- **Olemassa oleva tiedosto**: ingressi kertoo, että ohjeet ovat jo olemassa.
  Vanha teksti näkyy ensimmäisenä harmaana, ja lisäykset merkitään. Kieltä ei
  kysytä. Lisää ehdotukset tekee kumpaankin tiedostoon `edit`-muutoksen, ja
  Jätä ennalleen ei kirjoita mitään (reitissä "Ennallaan").

## Käyttö

Oletusnäkymä on viimeinen vaihe, jossa suunnat eroavat, ja reitissä kolme
ensimmäistä vaihetta ovat valmiina. **Alkuun kirjautumisesta** käy koko
ketjun läpi: tuotannon kirjautumiskortti, repovalitsin ja AI-vaihe (ChatGPT:n
laitekoodi ja painike "Prototyyppi: kirjautuminen valmis") ja sen jälkeen
viimeinen vaihe. Valinnoilla **Teema**, **Kieli** ja **Tili** (Uusi tili tai
Ohjeet jo olemassa) vaihdetaan tilannetta. Saman voi valita osoitteessa:
`?theme=light|dark|contrast`, `?lang=en`, `?scenario=existing` ja
`?stage=login`.

```
node build.mjs <out-dir>          # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

`build.mjs` vaatii `web/node_modules`-hakemiston (`npm ci` hakemistossa `web/`) ja
`check.mjs` lisäksi Playwrightin Chromiumin (`PLAYWRIGHT_BROWSERS_PATH`).

## Pohja

Pohja on sama kuin kierroksessa 1: Kuka olen, Kieli, Miten vastaat, Kysy
ensin ja Muuta. Tyhjä osio jätetään pois, ja tiedostoon ei tule mitään siitä,
minkä Habitatin ympäristökuvaus jo kertoo. Agentti tietää valmiiksi nimen ja
kuvauksen GitHubista sekä kielen Habitatin kielestä. Se kysyy vain
vastaustyylin ja kysy ensin -rajat. A:ssa ja B:ssä vapaa teksti menee
Muuta-osioon.

## Hostin puoli

**Miksi vaihe on viimeinen.** Agentti tarvitsee mallin, ja malli on
käytettävissä vasta, kun AI-tili on kunnossa. Siksi vaihe tulee AI-vaiheen
jälkeen eikä sitä ennen. Jos AI-tiliä ei ole (sivuston avain, jonka
`seeded`-polku ohittaa AI-vaiheen), vaihe on silti viimeinen, koska Pi on jo
käytettävissä.

**Miten vaihe ajaa agentin ennen ensimmäistä keskustelua.** Vaihe käynnistää
tavallisen Pi-session ihmisen omana Unix-käyttäjänä kotihakemistossa
(`cwd = ~`). Session aloittaa julkaisun mukana tuleva taito
(esimerkiksi `/skill:open-habitat-instructions`), joka sisältää kysymykset,
pohjan ja kirjoitussäännöt. Daemon käynnistää sen samalla operaatiolla kuin
minkä tahansa selainkeskustelun, joten uutta valtuutta tai uutta
daemon-operaatiota ei tarvita. Ero on vain esityksessä. Sovelluskerros
(`GitHubOnboarding`) omistaa session ja piirtää sen tapahtumat vaiheen
omaan asetteluun (A: pieni keskustelu, B: tiedosto ja sivukeskustelu, C:
kenttien apu) eikä keskustelunäkymään. Sessio on silti natiivi Pi-sessio,
joten se näkyy myöhemmin historiassa (`~`, otsikkona "Ohjeet agentille").
Tämä vastaa periaatetta, ettei rinnakkaista historiaa tehdä. Pikavastaukset
ja B:n riveittäin näkyvät lähteet edellyttävät, että agentti palauttaa
luonnoksen rakenteisena (esimerkiksi taidon määräämänä JSON-lohkona tai Pi:n
kysymystyökalulla). Se on avoin kysymys (`result-2.md`). Ilman sitä A toimii
vapaalla tekstillä, mutta B ja C eivät.

Vaihtoehtona olisi deterministinen pohja, jonka daemon kirjoittaa ilman
mallia. Se vaatisi uuden kirjoitusoperaation kotihakemistoon, ja se on
arkkitehtuuripäätös. C voisi toimia sillä, A ja B eivät.

**Mihin tiedosto kirjoitetaan.** Pi lukee tiedostoa `~/.pi/agent/AGENTS.md`.
Agentti kirjoittaa sen omilla työkaluillaan vasta, kun ihminen painaa
Tallenna ohjeet tai Lisää ehdotukset. Uusi tiedosto luodaan vain, jos sitä ei
ole (`O_EXCL`), ja tarvittaessa luodaan myös hakemisto `~/.pi/agent`.
Olemassa olevaan tiedostoon tehdään vain lisäys. Ennen kirjoitusta
tarkistetaan tiivisteellä, että tiedosto on yhä sama kuin luettaessa, ja
kirjoitus tehdään väliaikaistiedoston ja `rename`n kautta. Tee myöhemmin ja
Jätä ennalleen eivät kirjoita mitään. Käyttöönoton merkintä tehdään samaan
tapaan kuin `finishFirstRoute`. Merkintää ei kirjoiteta ohjetiedostoon, eikä
siitä pääteltäisi mitään, joten ohitettu vaihe ei avaudu uudelleen
seuraavalla latauksella.

**Clauden tuontirivi.** Claude Code tukee `CLAUDE.md`:ssä tuontirivejä
(`@polku`, myös `@~/…`). Jos tiedostoa `~/.claude/CLAUDE.md` ei ole, agentti
luo sen yhdellä rivillä:

```
@~/.pi/agent/AGENTS.md
```

Jos tiedosto on olemassa eikä siinä ole tuontia, rivi lisätään alkuun eikä
muuhun sisältöön kosketa. Jos tuonti on jo olemassa, tiedostoon ei kosketa.
Symlinkkiä ei käytetä, koska se korvaisi ihmisen oman `CLAUDE.md`:n.

## Rakenne

Sivu koostuu tuotannon osista: `OnboardingRoute` ja `OnboardingFrame`
(reitti ja vaihekortti), `LoginCard`, `GitHubRepoChooser`, AI-vaiheen
`AIOfferList` ja `PiDeviceSignIn`, `AssistantMessage`, `UserMessage`,
`ToolRow`, `Markdown`, `ControlButton`, `Button`, `AppShell`, `WorkspaceRail`
ja `AccountShelf`. Tuotannon `OnboardingFrame` nimeää vaiheen suljetulla
valinnalla (`OnboardingStepId`). Siksi `build.mjs` paikkaa rakennuksen
aikana täsmälleen sen yhden kohdan (`label`), jotta uusi vaihe piirtyy
tuotannon kehyksellä. Paikka vastaa tuotantomuutosta: yksi uusi vaihetunnus
ja sen nimi `onboardingFrameText`-tekstiluetteloon. Rakennus epäonnistuu, jos
kohta muuttuu. Kierroksen omia osia ovat kolmen vaiheen sisällöt,
tiedostonäkymä, Habitatin muistutus ja Asetukset-sivun kehys. Kirjastoon
(`lib/`) ja tuotantokoodiin ei tehty muutoksia.
