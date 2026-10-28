# Tulos: GitHub-yhteyden varoitus, osa 1

Toteutettu kierroksen 2 suunta 2 (*Näkyvä yritys, kentän päällä*) niillä
tiedoilla, jotka host jo antaa (`native_github.state` = `expired` tai
`disconnected`), sekä yhteinen varoituskomponentti.

## Mitä tuli

- **Yhteinen varoitus** `web/src/components/WarningBanner.tsx` (+ `.css`,
  Storybook *Production/Warning banner*). Neljä sävyä: palvelimen yritys
  (`progress`, yksi rivi pyörivällä merkillä), neutraali, vakava ja paluu
  (`success`). Sivuraita on poissa: sävy näkyy pehmeänä pintana, 1 px
  reunana ja kuvakkeen pyöreänä merkkinä (tokenit `--ah-err-soft`,
  `--ah-err-line`, `--ah-ok-soft`, `--ah-surface-2` …). Paikat: `inline`
  (kortti, kirjoituskentän yllä kentän levyinen) ja `page` (yläreunan nauha
  kuten yhteysilmoitus). Puhelimessa lyhyempi teksti ja korjausnappi koko
  rivin levyisenä. Kirjattu `design-system/design.md`:hen (Tilat ja
  toimintojen palaute).
- **Keskustelu**: varoitus `.ah-actionable-notices`-paikassa kentän yllä,
  yksi korjausnappi *Yhdistä uudelleen* / *Yhdistä GitHub*. Samaan paikkaan
  siirtyivät myös kielimallin kirjautumis- ja mallivaroitukset, jotta paikassa
  on yksi tyyli.
- **Muut näkymät**: sama varoitus yläreunan nauhana, paitsi Uusi työtila
  (tarvekohdan ilmoitus) ja Koodipalvelut (GitHub-rivi kertoo).
- **Korjaus palaa samalle sivulle**: gateway palauttaa vain polun, joten
  selain muistaa välilehden `sessionStorage`en koko reitin
  (`?conversation=…`, Uusi työtila) ja palauttaa sen kerran täsmälleen
  siihen polkuun, johon gateway palasi. Paluun jälkeen hetken (8 s)
  *GitHub yhdistetty käyttäjänä …*; jos tila korjaantuu itsestään
  välilehden ollessa auki, *GitHub-yhteys palasi*.
- **Tarvekohdat**: Uusi työtila ja Lisää oletusrepo kertovat listan paikalla
  syyn ja korjauksen; kirjoitetun nimen haun epäonnistuminen sanoo, että
  kloonaus tarvitsee yhteyden.
- **`native_github.login` snapshotissa** (skeemassa jo ollut kenttä):
  daemon välittää oman, toimivan kirjautumisen nimen samasta havainnosta kuin
  tilan; vieraan tai hylätyn tunnuksen nimeä ei koskaan. Koodipalveluiden
  *Kirjautunut käyttäjänä …* näkyy nyt.
- **Bugi `typed-repo-unselectable-without-github`** (oma commit): Lisää
  oletusrepo -ikkunassa kirjoitetun nimen voi valita rivinä *ei tarkistettu*,
  kun GitHubilta ei saa vastausta.

Organisaation estoa ja katkon tunnistusta ei tehty (osa 2,
`github-connection-classify`). `progress`-sävy on komponentissa ja
Storybookissa valmiina sitä varten, mutta mikään tila ei vielä tuota sitä.

## Todisteet

Kuvat `evidence/` (AVIF, laitteen skaalaus 2, vaalea ja tumma):
`workspace` (nauha), `conversation` ja `conversation-phone` (kentän yllä),
`reconnected` (paluu), `new-workspace` (tarvekohta), `default-repository`
(Jarin tapaus: kirjoitettu nimi *ei tarkistettu*).

Tarkistukset: `go test ./internal/nativegh ./internal/daemon
./internal/gateway`, contracts-tarkistus, web-tarkistukset (852 yksikkötestiä),
selainspecit `github-connection-warning` (uusi, 3 tapausta oikeaa gatewayta
vasten, myös axe), `site-onboarding`, `clone-page`, `account-settings` ja
`browser-conversation`in kielimallivaroitukset. Kaikki vihreät. Koko
selainsarjaa ei ajettu (kapellimestari ajaa).

Riippumaton katselmointi (`/llm-review`, löytäjä gpt-6-astra, tarkistaja
claude-fable-5-1): kolme löydöstä, kaikki vahvistettu ja korjattu testein:
paluuviesti saattoi näyttää edellisen henkilön kirjautumisnimen, jos
välilehden henkilö vaihtui 8 sekunnin sisällä; korjaus Uusi työtila -sivulta
palasi työtilalistaan; reitin palautus ei kulunut käytössä.

Ei kokeiltu: oikeaa GitHubin OAuth-kierrosta (synteettinen host).

## Päätökset myöhempää tarkistusta varten

- **"Yritetään uudelleen" -riviä ei näytetä vielä.**
  - Vaihtoehto: näyttää rivi tilassa `unknown`.
  - Syy: `unknown` tarkoittaa myös lukittua avainnippua ja kesken olevaa
    muutosta; rivi väittäisi katkoa, jota ei tiedetä. Komponentti on valmis
    osaa 2 varten.
- **Googlella kirjautuneelle `disconnected` ei näy yleisenä varoituksena.**
  - Vaihtoehto: varoitus kaikille, joilla gh ei ole kirjautunut.
  - Syy: Google-käyttäjä, joka ei käytä GitHubia, näkisi pysyvän
    varoituksen. Hän näkee sen GitHub-työtilojen keskusteluissa ja
    repovalitsimissa. `expired` näkyy kaikille, koska gh tarjoaa hylättyä
    tunnusta jokaiselle pushille. GitHubilla kirjautuneelle `disconnected`
    näkyy kaikkialla, myös tarkoituksella katkaistuna (prototyypin päätös:
    ei sulkemista; Myöhemmin-painike lisätään, jos se häiritsee).
- **Paluureitti selaimessa, ei gatewayn sallittuihin polkuihin.**
  - Vaihtoehto: lisätä `/workspaces/new` ja kysely gatewayn `uiReturn`iin.
  - Syy: gatewayn paluulista on turvaraja (avoin uudelleenohjaus); selain
    voi palauttaa oman reittinsä itse samasta alkuperästä, kerran ja
    10 minuutin sisällä.
- **Paluun vahvistus ilman gatewayn merkintää.**
  - Vaihtoehto: gateway lisää paluuosoitteeseen merkin.
  - Syy: sama välilehti tietää lähteneensä; ei muutosta gatewayhin.
- **Kielimallin varoitukset siirrettiin samaan komponenttiin.**
  - Vaihtoehto: jättää ne vanhaan `InlineNotice`-tyyliin.
  - Syy: Jari pyysi yleistä varoitustyyliä, ja samassa paikassa kaksi eri
    tyyliä näyttäisi virheeltä. Muut `ah-notice`-ilmoitukset (sivuraidalla)
    jäivät ennalleen; niiden siirto on oma päätöksensä.
- **Ei tarkistettu -rivi oletusrepoille vain hakuvirheessä.**
  - Vaihtoehto: myös silloin, kun GitHub vastaa "ei löydy".
  - Syy: "ei löydy" on ylläpitäjän oma pääsy ja usein kirjoitusvirhe; vika
    koski vain tilannetta, jossa GitHubilta ei saatu vastausta.
