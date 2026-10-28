# Tulos: GitHub-yhteyden luokittelu, osa 2

Toteutettu `proto-github-connection-warning`in Suosituksen osa 2. Daemon
luokittelee henkilön GitHub-yhteyden hänen omalla gh-kirjautumisellaan, ja
selain näyttää tuloksen osan 1 varoituksella (`WarningBanner`).

## Mitä tuli

- **Katko on oma tilansa** (`native_github.state = "unreachable"`). Tila
  tulee gh:n omista verkkovirheviesteistä ja GitHubin 5xx-vastauksista
  (`internal/nativegh/native.go`, `unreachableDiagnostic`). Muu tunnistamaton
  teksti jää tilaksi `unknown`, kuten ennenkin. Daemon yrittää itse uudelleen
  0, 30, 60 ja 120 sekunnin kohdalla ja sen jälkeen 30 sekunnin välein,
  vaikka yhtään sivua ei olisi auki. Snapshotissa on `retry`: `attempt`,
  `attempts` (4), `since` ja `next_at`. Yrityslaskuri seuraa aikataulua eikä
  lukukertoja, joten sivun lataukset eivät nopeuta varoitusta.
- **Keskustelussa kentän yllä ja muualla yläreunan nauhassa** näkyy yrityksen
  ajan yksi rivi *GitHub ei vastannut · yritetään uudelleen… (2/4)*. Kun
  yritykset loppuvat, tilalle tulee varoitus *GitHub ei vastaa*, jossa ei ole
  painiketta, koska palvelin hoitaa korjauksen itse. Kun yhteys palaa, näkyy
  hetken *GitHub-yhteys palasi*.
- **Ensimmäinen 401 tarkistetaan kerran.** Tila on ensin `verifying` (rivi
  *tarkistetaan uudelleen…*) ja muuttuu tilaksi `expired` vasta, kun saman
  tunnuksen toinen tarkistus 10 sekunnin päästä sanoo saman. Toinen
  tunnus (uusi kirjautuminen) aloittaa tarkistuksen alusta.
- **Organisaation esto tunnistetaan.** Repohaku ei enää muuta 403:a
  `not_found`iksi silloin, kun GitHub kertoo OAuth App -rajoituksesta tai
  SAML-vaatimuksesta (`X-GitHub-SSO: required`, viesti). Vastaus on
  `state: "restricted"` ja `restriction: "oauth_app" | "saml"`. Daemon
  muistaa estävät organisaatiot vain muistissa (enintään 16) ja kysyy
  saman repon uudelleen 5 minuutin välein, joten hyväksyntä poistaa
  varoituksen itsestään. Snapshotissa on `restricted_orgs`. Varoitus näkyy
  vain sen organisaation repon keskustelussa. OAuth-rajoituksessa
  painike avaa GitHubin sovellusasetukset (*Pyydä hyväksyntää GitHubissa*),
  SAML-rajoituksessa painike on *Yhdistä uudelleen*. Repovalitsimet
  (Uusi työtila, Lisää oletusrepo) kertovat syyn eivätkä sano *ei löydy*.
  GitHubin rate limit -403 on nyt `unavailable`, ei `not_found`.
- **Agentin epäonnistunut git- tai gh-komento käynnistää tarkistuksen.**
  Daemon näkee jo jokaisen bash-työkalun tuloksen keskustelun
  Pi-tapahtumista (`tool_execution_end`), joten uutta varastoa ei tarvittu.
  Gitin oma `fatal: … 'https://github.com/…'` -rivi tai gh:n 401-, 403-,
  5xx- tai yhteysvirhe on vihje, joka käynnistää yhteyden tarkistuksen
  heti (enintään yksi tarkistus 5 sekunnissa). Kieltäytymisen (403 tai
  organisaatiorajoitus) jälkeen daemon kysyy myös Gitin nimeämää repoa tai
  työtilan GitHub-originia. Vihje ei koskaan ole itse todiste, sillä tila
  tulee aina daemonin omasta tarkistuksesta.
- **Avoimet sivut lukevat snapshotin uudelleen**, kun yhteyden tila,
  yrityskerta tai organisaatioesto muuttuu (journalin
  `snapshot.invalidated`, joka ei laske natiivikirjoitukseksi).
- Koodipalveluiden GitHub-rivi tuntee tilat *GitHub ei vastaa* ja
  *Tarkistetaan*.

Refresh tokenia ei tallenneta, omaa tunnusvälittäjää ei ole, eikä gatewayn
valta muuttunut. Kaikki tiedot ovat henkilön oman daemonin havaintoja hänen
omalla tunnuksellaan.

## Todisteet

Kuvat (vaalea ja tumma, axe) `web/test-results/evidence/`:
`github-connection-outage-retrying`, `-outage-warning`, `-org-restricted`
(eivät ole repossa).

Tarkistukset: contracts (`validate-contracts.py` uusin positiivisin ja
negatiivisin tapauksin, generoidut paketit puhtaat), `go test` paketeille
`./internal/nativegh` ja `./internal/daemon` (myös `-race` uusille testeille),
`./internal/cli`, web (869 yksikkötestiä), selainspec
`github-connection-warning` (6 tapausta, joista 3 uutta). Koko
selainsarjaa ei ajettu (kapellimestari ajaa).

Daemonin kokoajossa `TestProcessPinnedPiBridgeAndWake` kaatui kerran
kuormassa (load noin 10). Testi meni yksinään läpi 10 kertaa 10:stä, eikä
muutos koske sitä. Kirjattu intakeen `absolutely-alcoholic-news`.

Riippumaton katselmointi (`/llm-review`; löytäjä gpt-6-astra, tarkistaja
claude-fable-5-1) ja `/assess-findings`: 5 löydöstä, kaikki vahvistettu ja
korjattu testein.

1. Kesken jäänyt 401-tarkistus saattoi jäädä ilman seuraajaa.
2. Organisaation hyväksyntä ei näkynyt joutilaalla sivulla.
3. Vanhan tunnuksen hylkäys vahvisti uuden tunnuksen ensimmäisen 401:n.
4. Rate limit -403 poisti muistetun eston.
5. Tarkistaja löysi korjauksesta regression: sisäänkirjautumisen aikana
   tullut tarkistus korvasi odottavan uudelleenyrityksen.

Ei kokeiltu: oikeaa GitHubia, oikeaa katkoa tai oikeaa organisaatiota.
gh:n virhetekstit on kirjoitettu gh 2.45/2.46:n mukaan, ja tunnistus on
fail-closed.

## Päätökset myöhempää tarkistusta varten

- **Aikakatkaisu ei ole katko.**
  - Vaihtoehto: gh:n `api user` -kutsun aikakatkaisu (1,5 s) tulkittaisiin
    tilaksi `unreachable`.
  - Syy: jumiutunut avainnipun apuohjelma näyttää samalta, ja hidas
    ISP-yhteys tuottaisi turhia yritysrivejä. Katko tunnistetaan gh:n
    omista verkko- ja 5xx-viesteistä. Aikakatkaisu on edelleen `unknown`,
    ja se tarkistetaan 30 sekunnin välein.
- **Varoituksessa ei ole Tarkista nyt -painiketta.**
  - Vaihtoehto: uusi selainreitti, joka pakottaa tarkistuksen.
  - Syy: reitti vaatisi uuden gateway-välityksen. Daemon tarkistaa jo itse
    30 sekunnin välein, ja agentin epäonnistunut komento käynnistää
    tarkistuksen heti.
- **Repolistan 409 `github_auth_unavailable` jätettiin jakamatta.**
  - Vaihtoehto: oma virhekoodi katkolle.
  - Syy: repolistan gh-kutsu ei näe gh:n virhetekstiä. Repovalitsin näyttää
    katkon snapshotin tilasta (*GitHub ei juuri nyt vastaa…*), joten
    erillistä koodia ei tarvita.
- **Agentin `/agent/v1/repository` vastaa edelleen `not_found`.**
  - Vaihtoehto: myös agentti saisi vastauksen `restricted`.
  - Syy: agenttisopimus pysyy ennallaan. Esto muistetaan myös agentin
    haussa, ja keskustelun varoitus kertoo sen henkilölle.
- **Organisaatiorajoituksen painike vie GitHubin sovellusasetuksiin**
  (`https://github.com/settings/applications`) eikä suoraan sovelluksen
  sivulle.
  - Vaihtoehto: syvälinkki sovelluksen client id:llä.
  - Syy: selain ei tunne client id:tä, ja sen välittäminen olisi uusi
    sopimuskenttä vain linkkiä varten.
- **Muistissa pidetty organisaatioluettelo ja uudelleentarkistus 5 minuutin
  välein ilman sivua.**
  - Vaihtoehto: tarkistus vain snapshotin luvun yhteydessä.
  - Syy: sivu voi olla joutilaana auki, kun omistaja hyväksyy sovelluksen.
    Muistiin mahtuu enintään 16 organisaatiota, ja tieto katoaa daemonin
    uudelleenkäynnistyksessä. Seuraava kieltäytyminen löytää eston
    uudelleen.
- **Katkon uudelleenyritykset jatkuvat 30 sekunnin välein niin kauan kuin
  katko kestää**, vaikka sivua ei olisi auki.
  - Vaihtoehto: harventaminen pitkän katkon aikana.
  - Syy: yksi gh-kutsu 30 sekunnissa on halpa, ja varoituksen pitää
    poistua itsestään heti, kun GitHub palaa.
