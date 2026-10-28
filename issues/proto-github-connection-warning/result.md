# Tulos: rikkinäinen GitHub-yhteys

Kierroksen 2 prototyyppi on `prototypes/github-connection-2/index.html`, yksi
käsin kirjoitettu offline-HTML. Lähde on
`design-system/prototypes/rounds/2026-10-28-github-yhteys-2/page.html`, ja
`build.mjs` täydentää sen tokeneilla, upotetuilla fonteilla ja yhteisellä
valitsimella (`lib/picker.*`). Opas Jarille on
`prototypes/github-connection-2/NOTES.md`, ja kuvat ovat
`prototypes/github-connection-2/evidence/`-hakemistossa (AVIF, laitteen skaalaus 2).

`verify.mjs` tarkistaa seuraavat:

- **78 sijoittelutapausta**: 4 suuntaa × 3 näkymää × 6 tilannetta
  asettuneessa tilassa, ja lisäksi palvelimen yrityksen aikaiset tilat.
- **Elävät tapahtumat**: pitkä katko asettuu varoitukseksi ja poistuu, kun
  GitHub palaa. Lyhyt katko pysyy suunnassa 1 hiljaa.
- **Uudelleen yhdistäminen** kaikista kolmesta paikasta ja organisaation
  hyväksyntäpyyntö.
- **Valitsin** läpäisee `picker-check`in.
- **Konsolivirheitä tai verkkopyyntöjä** ei tullut.

Kierros 1 (`prototypes/github-connection/`) jää vertailuksi.

Tuotantokoodia ei muutettu. Nykytila on luettu koodista. Labia tai oikeaa
GitHubia ei ajettu, joten alla oleva GitHubin käytös on merkitty
dokumentoiduksi silloin, kun sitä ei kokeiltu.

## Jarin kysymys: tarvitaanko painallusta?

Vain silloin, kun korjaus vaatii ihmisen päätöksen tai kirjautumisen
GitHubissa. Alla syy kerrallaan, mitä host voi tehdä itse ja mistä se nyt
tunnistaa syyn.

| Syy | Voiko host korjata itse? | Miten tunnistetaan nyt | Mitä puuttuu |
|---|---|---|---|
| **GitHubin tilapäinen katko** (verkko, GitHubin 5xx, aikakatkaisu) | **Kyllä: odottaa ja yrittää uudelleen.** Tunnus on kunnossa, joten ihmisen ei tarvitse tehdä mitään. | Daemon kysyy `gh api user` neljän sekunnin aikarajalla (`internal/nativegh/native.go:33`, `classify` `:256`). Mikä tahansa muu kuin GitHubin oma "Bad credentials" -vastaus jää luokittelematta, ja tila on `unknown` (`:535`). Tila `unknown` tarkistetaan uudelleen 30 sekunnin välein, `observedUnknownRecheck` (`:311`), joten katkon päätyttyä tila palaa itsestään. Selain lukee snapshotin minuutin välein ja kun välilehti palaa näkyviin (`web/src/app/App.tsx:566`, `:461`). | **Katkoa ei eroteta** muista `unknown`-tapauksista, kuten lukitusta avainnipusta tai kesken olevasta muutoksesta. Tarvitaan oma tila (esimerkiksi `unreachable`), jonka gh:n verkkovirheviesti tai HTTP 5xx tuottaa. Lisäksi tarvitaan tieto siitä, mistä hetkestä tila on jatkunut, jotta varoitus voidaan näyttää vasta kahden minuutin jälkeen. Repolistan 409 `github_auth_unavailable` (`internal/daemon/github_repos_linux.go:215`, `:317`) tulee myös verkkovirheestä, joten se pitää jakaa kahtia. |
| **Vanhentunut tunnus** (8 tunnin tunnukset) | **Ei.** Gateway saa uusimistunnuksen, mutta heittää sen pois tarkoituksella (`internal/gateway/github.go:45`). Gh ei osaa uusia toisen sovelluksen tunnusta, ja jos Habitat säilyttäisi ja uusisi tunnuksia, se olisi oma valtuutusvälittäjä. Juuren `AGENTS.md` kieltää sellaisen. Oikea korjaus on ylläpitäjän: OAuth-sovelluksen asetuksista kytketään vanhenevat tunnukset pois (`docs/operations.md:73`). Gateway kirjaa vanhenevan tunnuksen `github_token_expiring`-varoituksena (`internal/gateway/auth.go:698`). | GitHub vastaa vanhentuneeseen tunnukseen "Bad credentials (HTTP 401)" (`rejectedDiagnostic`, `native.go:127`), jolloin tila on `expired` (`:529`). Tiedostoon tallennettu tunnus tarkistetaan uudelleen viiden minuutin välein, `observedRecheck` (`:310`), avainnipun tunnus joka kerta. Vanheneminen näkyy siis enintään noin kuuden minuutin viiveellä. | Ei mitään hostin korjaukseen. Ehdotus: henkilö ei voi korjata ylläpitäjän asetusta, joten ylläpitäjälle näytetään oma vihje silloin, kun gateway näkee vanhenevia tunnuksia. Tätä ei ole prototyypissä. |
| **Tunnus peruttu** (henkilö poisti tunnuksen tai sovelluksen GitHubissa) | **Ei ilman ihmistä**, mutta korjaus on yksi painallus: `/auth/github/start?return_to=…&reconnect=1`. GitHub ohittaa hyväksyntäsivun, jos sovellus on yhä hyväksytty samoilla oikeuksilla ja henkilö on kirjautunut GitHubiin (GitHubin OAuth-ohjeen mukaan; ei kokeiltu tällä kierroksella). Jos sovellus on peruttu, GitHub kysyy luvan uudelleen. **Myös tavallinen kirjautuminen** korvaa tunnuksen, jonka GitHub hylkää (`Install`, `case kind == revoked`, `native.go:747`). Uusi kirjautuminen millä tahansa laitteella korjaa siis tilanteen itsestään. Istunto kestää kuitenkin 90 päivää (`internal/gateway/session_store.go:16`), joten tähän ei voi luottaa. | Sama 401 ja `expired` kuin vanhentuneessa. Perutun ja vanhentuneen erottaminen vaatisi tunnuksen, eikä GitHub erottele niitä vastauksessaan. | Ei mitään. Automaattinen siirtyminen GitHubiin ilman painallusta olisi mahdollinen, mutta sitä ei suositella (päätös alla). |
| **Ei yhdistetty** (ei kirjautumista tai eri tili gh:ssa) | **Ei.** Valinta kuuluu henkilölle. Hän voi myös olla katkaissut yhteyden tarkoituksella. | Gh:n oma "not logged in" -viesti tuottaa tilan `disconnected` (`absentDiagnostic`, `native.go:119`). Myös vieras tili tuottaa `disconnected`in (`:531`). | Ei mitään. |
| **Organisaatio estää** (OAuth App access restrictions tai SAML SSO) | **Ei.** OAuth-rajoituksessa organisaation omistajan pitää hyväksyä sovellus, ja GitHubin hyväksyntäpyyntö ilmoittaa hänelle. SAML SSO:ssa henkilö voi itse kirjautua organisaation SSO:hon ja yhdistää uudelleen. | **Ei tunnisteta.** Repohaku muuttaa 403:n `not_found`iksi (`github_repos_linux.go:353`), repolista jättää organisaation repot pois hiljaa, ja agentin gh tai git kaatuu ilman hostin selitystä. | 403:n viestin tunnistus kuten "organization has enabled OAuth App access restrictions" ja "Resource protected by organization SAML enforcement", sekä GitHubin `X-GitHub-SSO`-otsake (GitHubin dokumentoima, ei kokeiltu). Tieto annetaan organisaatiokohtaisena, ja sen voi liittää työtilaan sen `git_summary.github_repo`-omistajan perusteella. |
| **Git-tunnusapu puuttuu** (`partial`) | **Mahdollisesti**: `gh auth setup-git` korjaisi sen. Se kuitenkin muuttaa henkilön `~/.gitconfig`ia, jossa voi olla tarkoituksella toinen apu. | `observeWithLogin` (`native.go:662`). | Ei kuulu tähän kierrokseen. Ehdotus: painike "Korjaa Git-asetus" Koodipalveluissa, ei hiljaista korjausta. |

Agentin oma `git push` keskustelussa ei odota hostin tarkistusta. Se
epäonnistuu heti, ja hostin tila päivittyy vasta seuraavassa tarkistuksessa,
tiedostotunnuksella enintään viiden minuutin kuluttua. Viivettä lyhentäisi,
jos daemon tunnistaisi agentin epäonnistuneen bash-tuloksen gitin
kirjautumisvirheeksi ja tekisi siitä heti uuden tarkistuksen. Tunnistuksen
sääntö on jo olemassa (`gitAuthRefusal`,
`internal/daemon/github_stream_linux.go:118`), samoin malli tulosteesta
tehdystä esitysvihjeestä (`parseBashFailure`,
`internal/daemon/bash_failure_linux.go:22`). Vihje käynnistäisi vain
tarkistuksen. Itse todisteena sitä ei käytettäisi.

## Missä GitHubia tarvitaan (kierroksen 1 kartoitus tiivistettynä)

Repolista ja kirjoitetun nimen haku (`NewWorkspacePage` → `RepoFinder`),
Kloonaa, Asetukset › Käyttöönotto › Lisää oletusrepo, ensimmäisen
kirjautumisen repovalitsin, Koodipalvelut, Julkaise GitHubiin sekä agenttien
gh ja git push. Nyt syy näkyy vain Koodipalveluissa (`CodeHostSettings`).
Keskustelussa host ei näytä mitään, eikä GitHub-tilalle ole banneria.
Kirjoitetun omistaja/repo-nimen vika on kirjattu erilliseksi bugiksi
`typed-repo-unselectable-without-github`.

## Akseli: missä varoitus on keskustelussa ja miten palvelimen oma yritys näkyy

Kaikissa suunnissa palvelin yrittää ensin itse ja varoittaa vasta sitten.
Yritys tehdään näin:

- **Katko**: uudet yritykset 0, 30, 60 ja 120 sekunnin kohdalla. Sen jälkeen
  näytetään varoitus, ja tarkistus jatkuu 30 sekunnin välein.
- **401**: yksi lisätarkistus 10 sekunnin kuluttua.
- **Ei yhdistetty ja organisaation esto**: varoitus heti, koska nämä ovat
  varmoja tietoja.

Varoitus on yleinen. Se näkyy keskustelussa ja sovelluksen yläreunassa
muissa näkymissä, ja se poistuu itsestään, kun tila korjaantuu. Pitkän katkon
varoituksessa ei ole korjausnappia, koska ihmisen ei tarvitse tehdä mitään,
mutta siinä on Tarkista nyt. Organisaation esto näkyy vain kyseisen
organisaation työtiloissa.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Hiljaa, yläreunaan** | Yritys ei näy. Kun palvelin luovuttaa, `ConnectionBanner`in paikalle tulee banneri kaikissa näkymissä, myös keskustelussa. | Kun halutaan vähiten näkyvää liikettä. Lyhyestä katkosta ei näy mitään. | Kahden minuutin ajan agentin push epäonnistuu keskustelussa ilman selitystä. Banneri on kaukana kirjoituskentästä, jossa katse on. |
| 2 | **Näkyvä yritys, kentän yllä** | Keskustelussa ilmoitus on kirjoituskentän yllä `.ah-actionable-notices`-paikassa, jossa nykyinen "Kielimallikirjautuminen ei ole kunnossa" on (`web/src/app/BrowserConversation.tsx:2008`). Yritys näkyy yhden rivin tilana "yritetään uudelleen… (2/4)", ja paluu näkyy hetken. Muualla yläreunan banneri näyttää saman. | Kun henkilö on keskustelussa ja hänen pitää ymmärtää heti, miksi push epäonnistui ja että palvelin hoitaa sen. | Lyhyt katko näkyy (rivi ja paluu). Kentän yllä oleva ilmoitus vie korkeutta puhelimessa. |
| 3 | **Otsakkeessa ja langassa** | Keskustelun otsakkeessa on Git-tilan vieressä GitHub-siru: pyörivä merkki yrityksen aikana, piste epäonnistuessa. Sirusta aukeaa selitys ja korjaus (puhelimessa alhaalta). Kun palvelin luovuttaa, agentin epäonnistuneen komennon alle tulee Open Habitatin huomautus korjausnappeineen. Muualla on banneri kuten suunnassa 1. | Kun varoituksen pitää liittyä siihen, mikä epäonnistui, ja muuten pysyä pienenä. | Siru on helppo ohittaa. Huomautus langassa vaatii daemonilta uuden tiedon: agentin komennon tunnistamisen. Puhelimen yläpalkissa on vähän tilaa. |

## Mitä host-tietoja kukin suunta tarvitsee

| Tieto | On nyt? | 1 | 2 | 3 |
|---|---|---|---|---|
| `native_github.state` = `expired` tai `disconnected` snapshotissa (`internal/daemon/snapshot_linux.go:600`) | **On** | banneri | ilmoitus ja banneri | siru ja banneri |
| Taustatarkistus 30 sekunnin välein (`unknown`) ja 5 minuutin välein (tiedostotunnus) (`internal/nativegh/native.go:310`–`311`) | **On** | kaikki | kaikki | kaikki |
| Uudelleen yhdistäminen samalle sivulle (`reconnect=1`, `return_to`; `internal/gateway/auth.go:522`, `web/src/app/App.tsx` `onReconnect`) | **On** | kaikki | kaikki | kaikki |
| Työtilan GitHub-repo (`git_summary.github_repo`, `web/src/app/CodeHostSettings.tsx:118`) | **On** | organisaation esto keskustelussa | sama | sama |
| **Katkon oma tila** (esim. `unreachable`) erotettuna muista `unknown`-tapauksista | **Ei ole** | banneri katkosta | rivi ja ilmoitus | siru |
| **Yrityksen eteneminen** snapshotissa (monesko yritys, mistä hetkestä tila on jatkunut) | **Ei ole** | vain alkuhetki (2 min raja) | rivi "(2/4)" | siru |
| **Tila "varmistetaan"** 401:n lisätarkistuksen ajaksi (nyt `expired` tulee heti) | **Ei ole** (pieni muutos `checkStatus`iin) | – | rivi | siru |
| **Organisaation esto** organisaatiokohtaisena tietona (403:n viesti tai `X-GitHub-SSO`) | **Ei ole** | banneri | ilmoitus | siru ja huomautus |
| **Agentin epäonnistuneen git- tai gh-komennon tunnistus** (laukaisee tarkistuksen ja liittää huomautuksen komentoon; malleina `gitAuthRefusal` ja `parseBashFailure`) | **Ei ole** | nopeampi varoitus | nopeampi varoitus | huomautus langassa |
| `native_github.login` snapshotissa ("yhdistetty käyttäjänä …") | Skeemassa on, mutta daemon ei lähetä sitä (`snapshot_linux.go:600`) | onnistumisviesti | sama | sama |

Ilman puuttuvia tietoja kaikki suunnat toimivat syillä Vanhentunut ja Ei
yhdistetty. Katko näkyy silloin kuten nyt: Koodipalveluissa "Tilaa ei
tiedetä", eikä varoitusta tule.

## Suositus

**Suunta 2, Näkyvä yritys, kentän yllä.** Jarin kysymykseen vastaa parhaiten
se, että henkilö näkee palvelimen yrittävän. Kun push epäonnistuu
keskustelussa, kentän yllä lukee heti "GitHub ei vastannut · yritetään
uudelleen…". Henkilö tietää silloin, ettei hänen tarvitse tehdä mitään.
Jos palvelin ei onnistu, sama paikka muuttuu varoitukseksi, jossa on yksi
painallus (tai ei yhtään, jos kyse on katkosta). Paikka on jo tuotannossa
saman lajin ilmoitukselle, kielimallin kirjautumiselle, joten uutta
esitystapaa ei tarvita. Suunta 1 jättää kahden minuutin aukon, jonka aikana
epäonnistunut push jää selittämättä. Suunnan 3 siru on näistä
hienovaraisin, mutta se on helppo ohittaa, ja langan huomautus vaatii
eniten uutta daemonilta.

Toteutus kannattaa tehdä kahdessa osassa:

1. **Olemassa olevilla tiedoilla**:
   - ilmoitus kentän yllä ja banneri tiloille `expired` ja `disconnected`
   - korjaus samalle sivulle
   - tarvekohtien ilmoitukset kierroksen 1 mukaan
   - `native_github.login` snapshotiin
   - bugi `typed-repo-unselectable-without-github`
2. **Daemonin luokittelu**: katkon oma tila ja yrityksen eteneminen,
   401:n lisätarkistus, organisaation esto sekä agentin epäonnistuneen
   komennon laukaisema tarkistus. Nämä ovat daemonin havaintoja henkilön
   omilla tunnuksilla, joten ne eivät muuta valtuuksia eivätkä gatewayn,
   daemonin ja provisionin jakoa.

## Päätökset myöhempää tarkistusta varten

- **Uusimistunnusta ei säilytetä, eikä tunnusta uusita automaattisesti.**
  - Vaihtoehto: gateway tai daemon säilyttää GitHubin uusimistunnuksen ja
    vaihtaa gh:lle uuden tunnuksen kahdeksan tunnin välein.
  - Valinnan syy: se olisi oma valtuutusvälittäjä, jonka juuren
    `AGENTS.md` kieltää, ja se toisi uuden salaisuuden säilytyspaikan. Oikea
    korjaus on ylläpitäjän asetus (`docs/operations.md`).
  - Jos tätä halutaan, se on arkkitehtuuripäätös Jarin kanssa.
- **Vanhentunut tai peruttu tunnus tarvitsee painalluksen; automaattista
  siirtymistä GitHubiin ei tehdä.**
  - Vaihtoehto: kun sovellus avataan ja tila on `expired`, selain siirtyy
    itse GitHubiin ja takaisin.
  - Valinnan syy: palvelin ei voi tietää etukäteen, kysyykö GitHub
    kirjautumista tai lupaa. Kesken työn tapahtuva sivun vaihto vie
    henkilön pois siitä, mitä hän teki. Yksi painallus, jonka jälkeen
    GitHub tavallisesti palauttaa kysymättä, on lähes yhtä kevyt.
- **Kahden minuutin odotus ennen katkon varoitusta, yritykset 0, 30, 60
  ja 120 sekunnin kohdalla.**
  - Vaihtoehdot: varoitus heti tai vasta viiden minuutin jälkeen.
  - Valinnan syy: daemon tarkistaa jo 30 sekunnin välein. GitHubin lyhyet
    häiriöt menevät yleensä ohi minuutissa, ja kaksi minuuttia on vielä
    lyhyt aika selittämättömälle epäonnistumiselle.
- **Katkon varoitus näytetään yleisenä bannerina, mutta ilman
  korjausnappia.**
  - Kierroksessa 1 katko näkyi vain tarvekohdassa.
  - Valinnan syy: Jari pyysi yleistä varoitusta. Kun teksti sanoo
    "sinun ei tarvitse tehdä mitään" ja varoitus poistuu itsestään, se
    selittää epäonnistuneet pushit melutta.
- **401:lle tehdään yksi lisätarkistus 10 sekunnin kuluttua.**
  - Vaihtoehto: varoitus heti.
  - Valinnan syy: tarkistus on halpa, ja se suojaa GitHubin hetkellisiltä
    virhevastauksilta. Kymmenen sekuntia ei viivästytä mitään, minkä
    henkilö huomaisi.
- **Organisaation esto näkyy keskustelussa vain sen organisaation
  työtiloissa** (`git_summary.github_repo`-omistaja).
  - Vaihtoehto: kaikkialla.
  - Valinnan syy: muut repot toimivat, joten yleinen varoitus johtaisi
    harhaan.
- **Varoitusta ei voi sulkea.**
  - Kierroksessa 1 suunnalla 2 oli Myöhemmin-painike.
  - Valinnan syy: varoitus tulee nyt vasta, kun palvelin on luovuttanut,
    ja se poistuu itsestään. Myöhemmin-painikkeen voi lisätä, jos
    tarkoituksella katkaistu yhteys (`disconnected`) osoittautuu
    häiritseväksi.

## Sivulöydös

- Snapshot ei lähetä tunnusta `native_github.login`, vaikka skeema ja
  `CodeHostSettings` olettavat sen (`internal/daemon/snapshot_linux.go:600`).
  Siksi "Kirjautunut käyttäjänä …" ei näy koskaan. Pieni, ja kuuluu osaan 1.
