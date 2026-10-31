# README-luonnos: mitä se väittää ja mitä se odottaa

Jarille, 31.10.2026. Luonnokset:

- `OSS-RELEASE.md` repon juuressa, `status: draft`. Validoitu
  (`shipshape contract validate`: valid, ei varoituksia). Kukaan
  shipshape-jäsen ei toimi sen pohjalta ennen kuin vaihdat sen tilaksi
  `approved`.
- `issues/readme-first-draft/README.draft.md`, englanniksi. Se ei ole vielä
  juuressa, koska `/shipshape-readme` kieltäytyy kirjoittamasta
  luonnossopimuksen pohjalta. Kirjoitin sen käsin saman skillin sääntöjen
  mukaan (merkityt badge-, install- ja license-alueet, ei keksittyjä
  komentoja).

## Mitä README väittää

Ensimmäinen ruutu kertoo yhdellä lauseella, mikä tuote on: *tiimin agentit
yhdellä Linux-palvelimella, jokainen ihminen omana Unix-käyttäjänään,
selaimesta käytettävissä*. Sen alla on paikka GIF:lle, rehellinen
pre-release-huomautus ja lyhyt luettelo: yksi palvelin ja monta ihmistä,
natiivit työkalut pitävät totuuden, työ jatkuu selaimen sulkemisen jälkeen,
terminaali, worktreet, valinnainen code-server ja integraatiot, oma
mallitili Pi:n kautta, ei telemetriaa. Tarkistin koodista, ettei
telemetriaa ole (code-server käynnistetään jopa `--disable-telemetry`-lipulla).

Vertailutaulukko perustuu benchmark-raportteihin (Orca, HumanLayer, PI WEB /
Pi Web, JupyterHub). Taulukon alla sanotaan ääneen, milloin Orca on parempi
valinta ja että JupyterHub on saman mallin kypsä toteutus notebookeille.

"What it is not" sanoo suoraan, ettei Unix-raja erota agenttia sen
omistajasta, että tuote on yksi palvelin ja yksi harness (Pi), ettei
pilvipalvelua ole ja että root näkee kaiken. Tämä on launch-tutkimuksen
tärkein varoitus: liioiteltu turvaväite kaatuu ensimmäiseen HN-kommenttiin.

Asennusosio kuvaa sen, mikä on oikeasti olemassa: GitHub Releasesin
tuotepaketti ja runtime-julkaisu arkkitehtuureittain, digestien tarkistus,
`site.json`, `host prepare` ja `host apply` (komennot tarkistettu binäärin
`--help`-tulosteesta) ja linkki `docs/operations.md`:hen. Se ei lupaa
kymmenen minuutin asennusta, koska sitä ei vielä ole.

## Paikkamerkit (`<!-- confirm: ... -->`)

1. **GIF tai kuvakaappaus**: kaksi ihmistä samalla palvelimella, kumpikin
   näkee vain omansa, välilehti suljetaan ja agentti jatkaa.
2. **Mallipalveluntarjoajat**: mitkä kirjautumiset luetellaan julkisesti.
   Koodissa on tarjoukset `chatgpt`, `claude`, `openai_key`, `anthropic_key`
   ja `deepseek_key`; luonnos mainitsee vain ChatGPT:n.
3. **SECURITY.md** puuttuu, ja GitHubin Private Vulnerability Reporting
   pitää kytkeä päälle (`/shipshape-security-policy`).
4. **Asennus ulkopuoliselle**: osio olettaa vielä ylläpitäjän apua.
   `customer-install`-kaistan valmistuttua tilalle tulee lyhyt VPS-ohje.
5. **CONTRIBUTING.md** ja se, miten GitHubin julkiset issuet liittyvät
   issuectl-seurantaan (`/shipshape-contributing`).
6. **Lisenssi**: README sanoo MIT, mutta `LICENSE`-tiedostoa ei ole, koska
   sen tekijänoikeusrivin haltija on vielä auki.
7. **Linkit**: luonnos on `issues/`-hakemistossa, joten `LICENSE`,
   `SECURITY.md` ja `docs/operations.md` ovat siinä pelkkinä polkuina (repon
   linkkitarkistus hylkää puuttuvat kohteet). Juureen siirrettäessä niistä
   tehdään taas linkit.

## Päätetty

- **Lisenssi: MIT** (Jari 31.10.). Sopimuksessa `license: MIT`, README:n
  badge ja License-osio sanovat MIT.
- **Verkkosivusto: `https://open-habitat.ai`** on kanoninen; `open-habitat.dev`,
  `openhabitat.ai` ja `openhabitat.dev` ohjaavat siihen. README linkittää
  sen otsikon alla.

## Päätökset, joita sopimus odottaa

1. **Tekijänoikeuden haltija** (MIT-lisenssin copyright-rivi): sinä
   henkilönä vai yhtiö. `LICENSE` kirjoitetaan, kun tämä on päätetty ja
   sopimus hyväksytty; samalla muuttuu `licenses/DEPENDENCIES.md`.
2. **Kypsyys: `mvp`.** Pilottiasennukset ovat todellisia, mutta versiot ovat
   `v0.1.0-pilot.N`, ulkopuolisen asennus on kesken ja formaatit muuttuvat
   ilman yhteensopivuuskoodia.
3. **Jakelu: GitHub Releases, ei rekisteriä.** Linux amd64 ja arm64.
   Huomaa: tehtävänannossa luki "allekirjoitetut julkaisut", mutta nykyinen
   operaattori luottaa GitHubin ilmoittamiin SHA-256-digesteihin eikä lue
   allekirjoitusta (`.sig`/`.pub` ovat vain vanhoja työkaluja varten).
   Siksi README puhuu muuttumattomista julkaisuista ja digesteistä, ei
   allekirjoituksista. Jos haluat sanan "signed" takaisin, allekirjoituksen
   pitää ensin olla taas osa luottamusketjua.
4. **Julkistuksen ajankohta.** Suositus: kun itsenäinen asennus toimii
   vieraalla VPS:llä. Repon näkyvyyden vaihto on erillinen, peruuttamaton
   päätös, ja sitä ennen historia ja työmuistiot käydään läpi
   asiakasnimien ja infraviitteiden varalta.

Muut valinnat on perusteltu sopimuksen Rationale-osiossa ja ne voi vaihtaa
yhdellä rivillä: DCO-sign-off (vaihtoehto `none`), ei dependency-bottia eikä
CI-merkkiä ennen kuin GitHub Actions -CI on olemassa, muutosloki käsin
issuectl-trailereiden pohjalta.

## Seuraavaksi

Kun olet päättänyt yllä olevat, sopimus hyväksytään (`status: approved`) ja
`/shipshape-readme` voi kirjoittaa README:n ja LICENSE-tiedoston juureen tästä
luonnoksesta.
