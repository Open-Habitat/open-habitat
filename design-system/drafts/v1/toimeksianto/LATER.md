# Keskustelukäyttöliittymä v1:n jälkeen

Kirjattu 2026-09-20 käyttäjän toimittaman Fleetrepo-raportin perusteella.
Tämä lista säilyttää jatkoideat; se ei laajenna designerin v1-toimeksiantoa.
Valitse yksi kokonaisuus kerrallaan toimivan v1:n käyttökokemusten perusteella.
Ennen toteutusta tarkista natiivin komponentin tarjoama tieto ja ohjausrajapinta,
tee pieni vedos ja kokeile toiminta oikeassa agenttikeskustelussa.

## Miten etenemme

1. Arvioi keskustelun ensimmäinen päävedos, sovita sovelluksen navigointi siihen
   ja täydennä v1:n tilat.
2. Toteuta v1 oikeaan Pi-yhteyteen. Tarkista erityisesti työkalutapahtumat,
   lähetyksen kuittaus, resume, keskeytys ja yhteyskatkosta palautuminen.
3. Lisää yksi alla oleva kokonaisuus kerrallaan. Ehdotettu ensimmäinen lisäys on
   prosessien lukutila ja yhden prosessin loki, jos pitkäkestoiset prosessit ovat
   käytössä. Sen jälkeen voidaan lisätä ohjaus ja vasta myöhemmin ilmoitusvahdit.
4. Arvioi hyötyä käytössä ennen seuraavaa lisäystä. Numerot alla tunnistavat
   ideat; ne eivät määrää sprinttejä tai kaikkien ominaisuuksien toteutuslupausta.

## Myöhemmät kokonaisuudet

| ID | Kokonaisuus | Ensimmäinen hyödyllinen pala | Sen jälkeen / riippuvuudet |
|---|---|---|---|
| L1 | Prosessien yleisnäkymä (aiempi B11) | Extensionilta luettava lista: nimi, redaktoitu komento, tila, aloitusaika/ajoaika ja viimeisin output. Prosessien puuttuminen ja tiedon puuttuminen ovat eri tilat. | Käynnissä/päättyneet, haku, suodatus ja järjestys tarpeen mukaan. Selvitä prosessien session-sidonnaisuus ja elinkaari. |
| L2 | Prosessin loki | Yhden prosessin säilytetty output ja live-seuranta, jonka voi keskeyttää selatakseen historiaa. | Haku ja osumien välillä siirtyminen, stdout/stderr-suodatus vain jos lähde erottaa ne, prosessivälilehdet ja erillinen lukukohta kullekin. Näytä retention/truncation rehellisesti. Paneeli vai modaali ratkaistaan käytössä. |
| L3 | Prosessin ohjaus | Lopeta yksi prosessi ja näytä lopputuloksen vahvistus. | Stdin-syöte, käynnistys ja päättyneiden merkintöjen tyhjentäminen vasta kun extensionin komennot, kohdeidentiteetti ja tyhjentämisen vaikutus on selvitetty. Keskustelun keskeytys on eri toiminto. |
| L4 | Prosessitelakka ja tilarivi | Tarvittaessa supistettu yhteenveto keskustelun yhteydessä ja linkki prosessin outputiin. | Yhden prosessin kiinnitys, viimeisimmät tapahtumat ja leveydelle mukautuva +N-yhteenveto. Kokeile tarvitaanko sekä telakka että alapalkki; niitä ei lisätä automaattisesti molempia. |
| L5 | Ilmoitukset ja lokivahdit | Näytä extensionin ilmoittama valmistuminen tai virhe. | Teksti-/regex-vahdit, lisää/poista/hiljennä ilman prosessin uudelleenkäynnistystä. Erota pelkkä UI-ilmoitus, seuraavaan vuoroon tuleva tieto ja agentin välitön herätys. Extension vastaa niiden toteutuksesta; selain ei keksi omaa ajastusmoottoria. |
| L6 | Komentotäydennys | Slash-komennon nimi, kuvaus ja lähde löytyvät harnessilta. Täydennä myös keskellä lausetta oikeaan kursorikohtaan. | Selvitä mitä komento tekee ja voidaanko se suorittaa selaimesta. TUI-komento ei automaattisesti ole selainkomento. Näppäimistö-, mobiili- ja IME-käytös. |
| L7 | Paluuyhteenveto | Aloita käyttäjän pyytämästä recapista ja erillisestä lyhyestä kortista. Ikä, generointi, epäonnistuminen ja vanhentuminen näkyvät. | Automaattinen yhteenveto poissaolon ja historian määrän perusteella vasta myöhemmin. Selvitä mallikutsun kustannus, käynnistystiheys ja kontekstista erillisyys. Seuraava toimi on ehdotus; linkitä oikeaan kohteeseen ilman automaattista suoritusta. |
| L8 | Tehtäväprofiili ja reititys | Näytä natiivin komennon tekemä malli-/thinking-muutos ja lyhyt vahvistus. | Light/standard/design/strict ovat raportin esimerkkejä, eivät hostin uusi profiiliskeema. Valitsin vasta kun komponentti tarjoaa profiilit ja niiden käynnistämisen. Asetukset pysyvät natiivin komponentin omistuksessa. |
| L9 | Rikkaampi muutosten tarkastelu | Unified-diffin jälkeen rinnakkainen diff, sanakohtaiset muutokset, syntaksivärit ja muutosmäärät. | Suurten diffien selaus ja erillinen laaja output-näkymä tarvittaessa. Hyväksy/hylkää vain aidosti odottavaan muutospyyntöön; tehtyä muutosta ei esitetä vielä hyväksymättömänä. |
| L10 | Lisää työkalukohtaisia esityksiä | Erilliset MCP-, verkko- ja alitehtävänäkymät niille työkaluille, joita käytetään. | Ryhmittelyn tarkennus lähteen oikealla parent-/rinnakkaisuustiedolla. Ei keksittyä suunnitelmaa, riippuvuuksia tai mallin sisäistä päättelyä. |
| L11 | Teeman ja tiheyden valinta | V1:n yhden selkeän tyylin jälkeen harkitaan light/dark ja käytössä hyödyllinen tiheysvalinta. | Reunustettu/läpinäkyvä/oletusesitys vain jos tarpeellinen. Tila, diff ja animaatiot mukautuvat teemaan; animaatioiden vähentäminen ja kontrasti kuuluvat jo v1:n laatuun. |
| L12 | Editorin lisäoikotiet ja kopiointitavat | Arvioi tarvitseeko selain pikatyhjennystä tavallisen valinnan ja poistamisen lisäksi. | Kaksois-Escape ei v1:een. Jos lisätään, huomioi fokus, avoin popup, agentin työ, palautettavuus ja selaimen Escape-käytös. Smart/default-kopiointitilat vain todettuun tarpeeseen; normaalia valintaa ei kaapata. |
| L13 | Taskfleet- ja tmux-lisätiedot | Näytä luotettavasti löydettävä natiiviyhteys ja työntekijän tila silloin kun käyttäjä tarvitsee niitä. | Raportin settled/agent_active/tool_running/shutdown eivät yksin kerro ohjattavuutta tai koko keskustelun elinkaarta. Tarvitaan tarkka sovitus ja tuntematon/vanhentunut tila. Agentin natiivi ID säilyy; selainvälilehdestä ei tule agentin identiteettiä. |

## Raportin kattavuus ja selainvastineet

| Raportin havainto | Mihin se päätyi |
|---|---|
| Kokoruudun TUI | V1:n responsiivinen sovellusnäkymä; selaimen fullscreen-APIa ei tarvita. |
| Ryhmitellyt peräkkäiset ja rinnakkaiset kutsut | V1 B5; rinnakkaisuus vain lähdetiedon perusteella. |
| Tilapiste, verbi ja päivittyvä esikatselu | V1 B4–B5; puuttuvia välituloksia ei simuloida oikeassa käytössä. |
| Työkalukohtainen supistus ja laajennus | V1 B5; erillinen erittäin suuren tulosteen tila L9. |
| Unified/rinnakkaisdiff, sanavärit, koko ja uudet tiedostot | Yksinkertainen unified ja uuden tiedoston esitys v1 B5; laajemmat ominaisuudet L9. |
| Eri sisältötyyppien oma visuaalinen esitys | V1:n tiedosto, haku, komento, muutos ja fallback; laajempi valikoima L10. |
| Vaihdettavat teemat ja reunustyylit | L11; luettavuus ja kohtuullinen liike jo v1:ssä. |
| Prosessien listaus, käynnistys, stop, clear ja stdin | L1 ja L3. |
| Prosessien yleisnäkymä, järjestys, haku ja kiinnitys | L1 ja L4. |
| Lokimodaali, välilehdet, haku, stream-suodatus ja follow | L2. |
| Supistettu telakka ja editorin alapuolinen tilarivi | L4. |
| Tapahtumailmoitukset ja agentin herätys | L5. |
| Lisättävät, poistettavat ja hiljennettävät lokivahdit | L5. |
| Slash-täydennys keskellä tekstiä | L6. |
| Hiirikohdistus ja tekstin valitseminen | V1:n normaali selain-/editorikäytös; TUI-extensionia ei siirretä. |
| Kaksois-Escape tyhjentää syötteen | L12, harkittava oikotie. |
| Kopiointi ilman visuaalisia koristeita ja rivityksiä | V1 B2: lähdetekstin kopiointipainikkeet ja tavallinen valinta. |
| Kaksi kopiointitapaa ja tilanvaihtoilmoitus | L12 vain jos selaimessa ilmenee tarve; kopioinnin palaute jo v1:ssä. |
| Automaattinen recap ja /recap | L7; manuaalinen ennen automaattista. |
| Toteutuskomennon malli-/thinking-reititys | L8; nykyisen mallin näyttö lähteestä jo v1:ssä. |
| Tmux-session yhteys ja Taskfleet-telemetria | L13; natiivi identiteetti ja tilan päivitys jo v1 B12:ssa. |

## Arkkitehtuuri säilyy

Agentti ja process-extension hallitsevat aliprosessit. Käyttäjädaemon välittää
niiden tietoja ja tuettuja komentoja; selain ei vaadi uutta prosessien omistajaa,
pysyvää palvelurekisteriä tai rinnakkaista lokitietokantaa. Käytetään HTTP-komentoja
ja sovittua SSE-virtaa. Raportin WebSocket-suositus ei ole päätös vaihtaa protokollaa.

Keskustelun historia ja identiteetti pysyvät harnessissa. Recap ei korvaa historiaa.
Profiilit ja mallit pysyvät komponentin omissa asetuksissa. Extensionin lupa tai
hyväksyntäkortti ei tarkoita Unix-oikeuksien muuttamista tai sandboxia.

## Raportin lähdeviitteet myöhempää toteutustarkistusta varten

Seuraavat nimet, versiot ja polut on kopioitu käyttäjän raportista. Niitä ei ole
tässä työssä tarkistettu Fleetrepon asennuksesta; designer ei tarvitse pääsyä sinne.

- `pi-claude-code-ui` 1.0.78, `~/.pi/agent/npm/node_modules/pi-claude-code-ui/README.md`.
- `@aliou/pi-processes` 0.10.9, `~/.pi/agent/npm/node_modules/@aliou/pi-processes/README.md`
  ja `dotfiles/src/.pi/agent/extensions/processes.json`.
- `dotfiles/src/.pi/agent/extensions/midline-slash-completion.ts`,
  `click-to-position/`, `esc-esc-clear/` ja `clean-copy/` saman extensions-hakemiston alla.
- `dotfiles/src/.pi/agent/extensions/conversation-recap/` ja `llm-implement-router/`.
- `dotfiles/src/.pi/agent/extensions/tmux-agent-session.ts`.
- `~/.pi/agent/git/github.com/jarimustonen/taskfleet-pi-telemetry/src/index.ts`.
