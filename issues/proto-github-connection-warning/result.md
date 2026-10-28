# Tulos: rikkinäinen GitHub-yhteys

Prototyyppi on `prototypes/github-connection/index.html`, yksi offline-HTML.
Se on käsin kirjoitettu sivu
(`design-system/prototypes/rounds/2026-10-28-github-yhteys/page.html`), jonka
`build.mjs` täydentää tokeneilla, upotetuilla fonteilla ja yhteisellä
valitsimella (`lib/picker.*`). Tuotantokomponenttien bundlea ei käytetä, koska
sellainen jää Habitatin näkymissä tyhjäksi. Opas on
`prototypes/github-connection/NOTES.md`. Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2. `verify.mjs` tarkistaa 80 sijoittelutapausta:
4 suuntaa × 4 näkymää × 5 syytä. Lisäksi se klikkaa vuorovaikutukset läpi:
kirjoitetun nimen lisäys, Myöhemmin, sivupalkin rivi ja uudelleen yhdistäminen.
Konsolivirheitä tai verkkopyyntöjä ei tullut, ja valitsin läpäisee
`picker-check`in.

Nykytila on luettu koodista. Labia ei ajettu: kaikki varoitukset ovat
komponenttien tekstejä, ja niiden ehdot ovat tässä luetuissa tiedostoissa.

## Missä GitHub-yhteyttä tarvitaan ja mitä näkyy nyt

| Kohta | Mitä tarvitsee | Mitä näkyy nyt, kun yhteys puuttuu tai on rikki |
|---|---|---|
| Uusi työtila, repolista (`NewWorkspacePage` → `RepoFinder`) | `GET …/github/repos` (daemon: `gh api /user` ja `/user/repos`) | "Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen muodossa omistaja/repo." (`ClonePage.tsx:195`). Syytä ei näy, vaikka selain saa 409 `github_auth_unavailable` → `GitHubError("auth")`, koska `catch` heittää koodin pois (`NewWorkspacePage.tsx:211`). |
| Uusi työtila, kirjoitettu omistaja/repo | `GET …/github/repository` (sama `/user`-tarkistus ensin) | "GitHubiin ei saatu yhteyttä. Yritä hetken päästä uudelleen." (`ClonePage.tsx:244`). Sama teksti tulee myös, kun tunnus on vanhentunut, eli "yritä hetken päästä" johtaa harhaan. |
| Uusi työtila, Kloonaa | `POST …/github/clones` | Aloitus hylätään (409 `github_auth_unavailable`, `github_jobs_linux.go:390`): "GitHub-tunnukset eivät ole käytettävissä. Yhdistä GitHub kohdassa Asetukset › Koodipalvelut." Pelkkä teksti ilman linkkiä. Kesken mennyt klooni kertoo syyn `auth_refused`. |
| Asetukset › Käyttöönotto › Lisää oletusrepo (`OnboardingAdministration`) | ylläpitäjän oma repolista ja haku | Sama `RepoFinder`-teksti kuin yllä, eikä valittavaa ole (bugi alla). |
| Asetukset › Käyttöönotto, oletusrepojen tiedot | ylläpitäjän repolista | Ei mitään: `.catch(() => {})` (`OnboardingAdministration.tsx:262`), jolloin tiedot vain puuttuvat. |
| Ensimmäinen kirjautuminen, repovalitsin (`GitHubOnboarding` → `GitHubRepoChooser`) | repolista | Erottaa syyt `no-auth` ("GitHub-kirjautuminen puuttuu") ja `unavailable` ("Repoja ei voitu hakea"). Korjausnappia ei ole. |
| Asetukset › Koodipalvelut, GitHub-rivi (`CodeHostSettings`) | snapshotin `auth.native_github.state` | Tila ja kuvaus jokaiselle tilalle (Yhdistetty, Ei yhdistetty, Vanhentunut, Osittainen, Tilaa ei tiedetä). Painike on Yhdistä uudelleen, ja GitHub-työtiloissa lukee "Push ei onnistu…". Tämä on ainoa paikka, jossa syy näkyy nyt. |
| Työtila › Julkaise GitHubiin (`WorkspaceGitHub`) | gh ja git push | `github_auth_unavailable`: "Paikallinen GitHub-valtuutus ei vastaa tätä käyttäjää." Korjausta ei tarjota. |
| Työtila › Päivitä tila / Hae etärepo | git fetch käyttäjän tunnuksilla | `remote_auth_unavailable`: "…etärepo vaati kirjautumisen, eikä Git löytänyt tunnuksia palvelimelta." |
| Agentit keskustelussa ja worktree-agentit | gh ja git push agentin omina komentoina | Host ei näytä mitään. Virhe näkyy vain agentin työkalutulosteessa. |
| Bannerit (`ConnectionBanner`, `NewVersionBanner`, `StoragePressureNotice`) | – | GitHub-tilalle ei ole banneria. |

Palvelimen pääsylista (ylläpitäjä lisää henkilön GitHub-tunnuksella) käyttää
gatewayn OAuth-sovellusta eikä henkilön yhteyttä
(`internal/gateway/github.go:195`), joten se ei kuulu tähän.

## Mitä host osaa erottaa (host-tiedot)

| Syy | Tunnistaako host nyt? | Mistä |
|---|---|---|
| Ei yhdistetty (gh:lla ei ole github.com-kirjautumista) | **Kyllä**: `native_github.state = disconnected` | `nativegh` `classify`: gh:n oma "not logged in" -viesti (`native.go:256`, `:531`) |
| Gh:ssa on eri GitHub-tilin kirjautuminen | Kyllä, mutta sama `disconnected` | `foreign` yhdistyy `disconnected`iin (`native.go:531`) |
| Tunnus vanhentunut tai peruttu | **Kyllä**: `expired`. Vanhentunutta ja peruttua ei voi erottaa, koska GitHub vastaa molempiin "Bad credentials (HTTP 401)". | `rejectedDiagnostic` (`native.go:127`) |
| Git-tunnusapu puuttuu (gh toimii, git push ei) | Kyllä: `partial` | `checkStatus` (`native.go:544`) |
| **GitHub ei vastaa** (verkko, GitHubin katko) | **Ei**: `unknown`, sama arvo kuin lukitulla avainnipulla, kesken olevalla muutoksella ja oudolla gh-tulosteella | `classify` palauttaa `unclassified` (`native.go:266`) |
| **Organisaatio estää OAuth-sovelluksen** (OAuth App access restrictions tai SAML SSO) | **Ei**. Repolista jättää organisaation repot pois hiljaa, haku muuttaa 403:n `not_found`iksi (`github_repos_linux.go:353`), ja klooni kaatuu syyllä `auth_refused` tai `source_unavailable`. | – |
| Repolistan epäonnistumisen syy | Osittain. 409 `github_auth_unavailable` tulee mistä tahansa `/user`-virheestä, myös verkkovirheestä (`github_repos_linux.go:215`). 503 `native_source_unavailable` tulee sivutuksen virheestä. | |
| Kirjautunut tunnus (`native_github.login`) | Skeemassa on, mutta daemon ei lähetä sitä (`snapshot_linux.go:600`), joten "Kirjautunut käyttäjänä …" ei näy Koodipalveluissa koskaan. Repolista kertoo tunnuksen (`login`). | |
| Milloin tila päivittyy | Snapshot luetaan minuutin välein ja kun välilehti palaa näkyviin (`App.tsx:566`, `:461`). Daemon muistaa tiedostopohjaisen tunnuksen tilan enintään 5 minuuttia ja `unknown`in 30 sekuntia. Paikallinen tunnusmuutos, kuten uudelleen yhdistäminen, havaitaan heti (`native.go:301`–`356`). | |

## Bugi: miksi kirjoitettu omistaja/repo ei kelvannut

Hakulistan rivit ovat linkkejä. Kirjoitettu tarkka nimi muuttuu riviksi vasta,
kun haku `GET /api/v1/onboarding/github/repository` vastaa `found`. Daemonin
haku tekee ensin saman `boundGitHubUser`-tarkistuksen samoilla gh-tunnuksilla
kuin repolista (`github_repos_linux.go:317`). Jos lista epäonnistui yhteyden
takia, haku epäonnistuu siis samasta syystä. Selain tekee jokaisesta
virheestä tilan `failed`, ja `RepoFinder` näyttää "GitHubiin ei saatu
yhteyttä", eikä valittavaa ole. Vihje "Voit silti kirjoittaa repon nimen" toimii
vain, kun lista kaatui muusta syystä (503 sivutuksessa). Tämä on vika,
koska tallennus ei tarvitse GitHubia: gateway tarkistaa vain nimen muodon
(`internal/gateway/onboarding.go:111`), ja pääsy tarkistetaan jokaisen uuden
henkilön kirjautumisessa. Kirjattu erilliseksi bugiksi
`typed-repo-unselectable-without-github` (intake, ajoittamaton). Uusi työtila
-sivulla vika on vain sanamuodossa, koska kloonaus tarvitsee yhteyden
joka tapauksessa.

## Akseli: kuinka paljon varoitus näkyy muualla kuin tarvekohdassa

Kaikissa kolmessa suunnassa tarvekohdat ovat samat. Repolista, kirjoitetun
nimen haku, Kloonaa ja Lisää oletusrepo näyttävät syyn omana ilmoituksenaan ja
tarjoavat sen korjauksen:

- **Ei yhdistetty**: Yhdistä GitHub.
- **Vanhentunut**: Yhdistä uudelleen. Molemmat menevät osoitteeseen
  `/auth/github/start?return_to=<tämä sivu>&reconnect=1` ja palaavat samalle
  sivulle.
- **GitHub ei vastaa**: Yritä uudelleen. Uudelleen yhdistämistä ei tarjota,
  koska se ei auttaisi.
- **Organisaatio estää**: Pyydä hyväksyntää GitHubissa (GitHubin sivu, jolla
  sovellukselle pyydetään organisaation hyväksyntää).

Lisää oletusrepo -ikkunassa kirjoitetun nimen voi lisätä **tarkistamatta**
(merkintä "ei tarkistettu"). Korjauksen jälkeen näkyy hetken "GitHub yhdistetty
käyttäjänä …", varoitukset poistuvat ja lista tulee näkyviin. Banneri tai rivi
näkyy vain, kun korjaus on henkilön omissa käsissä (Ei yhdistetty tai
Vanhentunut). GitHubin katko ja organisaation esto näkyvät vain kohdassa,
johon ne vaikuttavat.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Aina näkyvä** | Koko sovelluksen yläreunassa on banneri (`ConnectionBanner`in paikka ja muoto). Vanhentunut on punainen, Ei yhdistetty neutraali. Painikkeet ovat korjaus ja Asetukset › Koodipalvelut. Banneria ei voi sulkea, vaan se poistuu, kun seuraava snapshot kertoo yhteyden toimivan. | Kun GitHub on työn ydin kaikille, eikä kukaan tee pelkkää paikallista työtä. | Tarvekohdissa sama asia näkyy kahdesti (banneri ja ilmoitus). Henkilö, joka on tarkoituksella katkaissut yhteyden (Katkaise paikallinen GitHub-yhteys), näkee bannerin aina. |
| 2 | **Väistyvä** | Sama banneri ja lisäksi Myöhemmin. Sen jälkeen varoitus pienenee sivupalkin alareunaan riviksi "GitHub-yhteys vanhentunut · Korjaa", ja puhelimessa valikkonappiin tulee piste. Banneri palaa seuraavassa istunnossa (sessionStorage, ei palvelinta). Asetuksissa Koodipalveluiden vieressä on piste. | Kun varoituksen pitää tavoittaa jokainen kerran, mutta paikallinen työ ei saa jäädä sen alle. | Kaksi esitystapaa samalle tilalle. Sivupalkin rivi vie korkeutta pienellä näytöllä. Suljettu banneri palaa uudessa välilehdessä. |
| 3 | **Vain tarvittaessa** | Banneria ei ole. Sivupalkin alareunassa on koko ajan hiljainen rivi (puhelimessa valikkonapin piste), ja kokonaisuudessaan varoitus näkyy vasta tarvekohdassa. | Kun suurin osa käytöstä on keskustelua agentin kanssa ja GitHub tarvitaan harvoin. | Agentin epäonnistunut push keskustelussa ei saa vierelleen selitystä. Sivupalkin rivi jää helposti huomaamatta. Jarin tapaus olisi näkynyt vasta oletusrepo-ikkunassa (nyt oikein selitettynä). |

## Mitä host-tietoja kukin suunta tarvitsee

| Tieto | On nyt? | 1 | 2 | 3 |
|---|---|---|---|---|
| `native_github.state` `disconnected`/`expired` snapshotissa | **On** | banneri | banneri ja rivi | rivi |
| Tarvekohdan syy repolistalle ja haulle (409 `github_auth_unavailable` erotettuna muista virheistä) | **On** palvelimella ja `GitHubError("auth")`ina selaimessa, mutta kutsujat heittävät sen pois | kaikki | kaikki | kaikki |
| Kirjoitetun oletusrepon tallennus ilman GitHubia | **On** (gateway tarkistaa vain muodon) | kaikki | kaikki | kaikki |
| Paluu samalle sivulle (`return_to`, `reconnect=1`) | **On** (`App.tsx:1870`) | kaikki | kaikki | kaikki |
| Suljetun bannerin muistaminen | Selaimen sessionStorage, ei palvelinta | – | tarvitaan | – |
| **"GitHub ei vastaa"** erillään muista `unknown`-tapauksista (gh:n verkkovirheen luokitus, esimerkiksi tila `unreachable`, sekä repolistan 409:n jakaminen verkkovirheeseen ja tunnusvirheeseen) | **Ei ole** | tarvekohta | tarvekohta | tarvekohta |
| **Organisaation esto** (gh api:n 403:n viesti "OAuth App access restrictions" tai "SAML enforcement" omana koodinaan haussa ja kloonissa; listan hiljaisesti puuttuvat organisaatiot vaativat erillisen selvityksen, esimerkiksi `/user/memberships/orgs` vs. listan omistajat) | **Ei ole** | tarvekohta ja Koodipalvelut | sama | sama |
| `native_github.login` snapshotissa | Skeemassa on, daemon ei lähetä | onnistumisviesti | sama | sama |

Ilman puuttuvia tietoja kaikki suunnat toimivat syillä Ei yhdistetty ja
Vanhentunut. GitHubin katko näkyy silloin kuten nyt ("ei saatu yhteyttä,
yritä uudelleen"), ja organisaation esto näkyy kuten nyt ("Repoa ei ole, tai
sinulla ei ole siihen pääsyä").

## Suositus

**Suunta 2, Väistyvä.** Jarin tapauksessa yhteys oli poikki eikä mikään
kertonut sitä. Banneri kertoo sen heti ensimmäisellä sivulla, myös silloin,
kun agentin push epäonnistuu keskustelussa. Siinä kohdassa suunta 3 jää
hiljaiseksi. Myöhemmin poistaa suunnan 1 kustannuksen: henkilö, joka tekee
tarkoituksella pelkkää paikallista työtä tai on katkaissut yhteyden, saa
varoituksen pois näkyvistä. Silti se jää sivupalkkiin ja palaa täytenä
jokaisessa tarvekohdassa. Toteutus kannattaa tehdä kahdessa osassa:

1. **Heti, olemassa olevilla tiedoilla:** tarvekohtien ilmoitukset syineen ja
   korjauspainikkeineen (repolista, haku, Kloonaa, Lisää oletusrepo,
   ensimmäisen kirjautumisen valitsin, Julkaise GitHubiin) ja Lisää
   tarkistamatta (korjaa bugin). Lisäksi banneri ja sivupalkin rivi
   tiloille `disconnected` ja `expired` sekä `native_github.login`
   snapshotiin.
2. **Myöhemmin, host-tiedot:** "GitHub ei vastaa" ja organisaation esto.
   Kumpikin on daemonin luokittelua (gh:n tulosteen tai HTTP-tilan
   tulkinta). Valtuuksia ne eivät muuta.

## Päätökset myöhempää tarkistusta varten

- **Banneri vain korjattaville syille** (Ei yhdistetty, Vanhentunut).
  Vaihtoehto: banneri myös GitHubin katkolle. Valinnan syy: henkilö ei voi
  korjata katkoa, joten pysyvä varoitus olisi melua. Katko näkyy siellä, missä
  se estää jotain.
- **Ei yhdistetty saa bannerin, mutta neutraalina; Vanhentunut on punainen.**
  Vaihtoehto: Ei yhdistetty pelkkänä rivinä. Valinnan syy: host ei erota
  tarkoituksellista katkaisua kadonneesta yhteydestä (tarkoituksellisesta
  katkaisusta ei jää merkintää, eikä sellaista kuulu jäädä), ja suunnan 2
  Myöhemmin hoitaa tarkoituksellisen tapauksen.
- **Lisää tarkistamatta Lisää oletusrepo -ikkunassa.** Vaihtoehdot: estää
  lisäys, kunnes yhteys toimii, tai sallia vain muotoon tarkistettu nimi
  ilman merkintää. Valinnan syy: tallennus ei tarvitse ylläpitäjän GitHubia,
  ja pääsy tarkistetaan jokaisen henkilön omalla tilillä. Merkintä "ei
  tarkistettu" kertoo, että kirjoitusvirhe on mahdollinen. Tämä ei muuta
  valtuuksia: ylläpitäjä voi jo nyt tallentaa minkä tahansa muodollisesti
  kelvollisen nimen API:n kautta.
- **Korjaus palaa samalle sivulle** (`return_to`). Vaihtoehto: korjaus
  Asetukset › Koodipalveluissa. Valinnan syy: kohta, jossa henkilö oli
  tekemässä jotain, on se, jonne hän haluaa takaisin. Koodipalvelut on
  bannerissa toisena painikkeena.
- **Suljetun bannerin muisti on selaimen sessionStorage.** Vaihtoehto:
  palvelimelle tallennettu kuittaus. Valinnan syy: uutta tallennuspaikkaa ei
  tehdä ilman tarvetta (AGENTS.md), ja uuden istunnon muistutus on
  tarkoituksellinen.
- **Organisaation eston korjaus on GitHubin hyväksyntäpyyntö.** Vaihtoehto:
  ohje ottaa yhteyttä organisaation omistajaan. Valinnan syy: GitHubin oma
  sivu tekee pyynnön ja ilmoittaa omistajalle.

## Sivulöydös

- Snapshot ei lähetä tunnusta `native_github.login`, vaikka skeema ja
  `CodeHostSettings` olettavat sen (`snapshot_linux.go:600`). Siksi
  "Kirjautunut käyttäjänä …" ei näy koskaan. Pieni, ja kuuluu osaan 1.
