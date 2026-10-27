# Tulos: GitLab koodipalveluna

Toteutus selvityksen suosituksen A ja prototyypin (Koko polku) mukaan.

## Mitä tuli

- `internal/nativeforge`: Gitean koodista erotettu yhteinen osa (perusosoite,
  egress-tarkistettu HTTP, Gitin credential-protokolla, apuohjelman
  rekisteröinti, natiivitiedoston elinkaari, holdit). `nativegitea` säilyi
  ennallaan aliasten kautta.
- `internal/nativegitlab`: glabin `config.yml` ainoana varastona glabin
  `config.lock`-lukon alla; yksi tili palvelinta kohden; uloskirjaus kuten
  `glab auth logout`; `/user`, `/personal_access_tokens/self` (oikeudet,
  vanheneminen, pushin tila) ja jäsenprojektit keyset-sivutuksella;
  sisäkkäiset polut; projektit, joiden kloonausosoite on yhdistetyn
  perusosoitteen ulkopuolella, lasketaan eikä niitä listata.
  `gitlabfake` on synteettinen GitLab (Git smart HTTP mukana).
- `open-habitat gitlab git-credential` (CONFORMANCE.md).
- Daemonin reitit `/api/v1/integrations/gitlab`, `/gitlab/repos`,
  `/gitlab/tokens`; kloonaustyöt `gitlab`-lähteellä; keskeytyneet kloonit koko
  polulla; workspace fetch kiinnitetään kuten Gitealla; snapshotin
  `gitlab_origin`; palvelimen hylkäämä kloonaus on `auth_refused`.
- Sopimukset `gitlab-connection(-change)`, `gitlab-tokens`, `gitlab-repos`;
  integraatiot, kloonit ja snapshot laajennettu; sidokset generoitu.
- Selain: GitLab-laatta ja -kortit Koodipalveluissa, lomake gitlab.comista
  alkaen, yhteinen lista nimiavaruuksittain, kloonaus id:llä.
- glab 1.124.0 integrations-profiiliin (arkisto ja binäärin digest kummallekin
  arkkitehtuurille, notices); `go-binary-notices.py` ottaa vendoroidun buildin
  summat julkaisun omasta go.sumista.

## Todisteet

Go: nativeforge, nativegitea, nativegitlab, cli, daemon (GitLab-kävely:
yhdistys, tunnusten kuvaus, lista, sisäkkäinen kloonaus, SSO-hylkäys, fetch,
vanhentunut tunnus, vaihto, irrotus; vastaukset validoidaan sopimuksia
vasten), gateway, host. Oikea glab 1.124.0: `scripts/test-glab-interop.sh`
(glab lukee Habitatin merkinnän ja säilyttää sen omissa kirjoituksissaan,
glabin oma login on käyttökelpoinen yhteys). Vitest kokonaan; Playwright
`gitlab.spec.ts` ja koskettuneet specit. Riippumaton review (gpt-6-astra
löytäjänä, claude-fable-5-1 todentajana): kaksi vahvistettua korjattiin, yksi
kumottiin.

## Testattavaa Jarin tilillä

1. `/personal_access_tokens/self` pelkällä `read_api` + `write_repository`:
   näkyvätkö kortin oikeudet ja päättymispäivä (jos ei, kortti sanoo, ettei
   GitLab kerro niitä, ja push on *ei tiedossa*).
2. Projektilista `statistics=true` + keyset: tuleeko koko ja toimiiko
   sivutus (Link-otsakkeen `id_after`).
3. Sisäkkäisen projektin kloonaus ja push.
4. Vanhentuneen tunnuksen virheteksti (odotetaan "Token is expired").

## Decisions for later review

- Vanhenemisvaroitus 30 päivää ennen (prototyypin raja; Jarin kysymys 2 jäi
  vastaamatta).
- Arkistoidut projektit näytetään merkittyinä kuten Gitealla (kysymys 3).
- Tunnuksen tiedot luetaan GitLabista joka kerta erillisestä
  `/gitlab/tokens`-reitistä; integraatiolista lukee vain glabin tiedoston,
  kuten Gitealla. Mitään ei tallenneta.
- Habitat kirjoittaa vain oman host-merkintänsä, ei glabin oletusasetuksia
  (`telemetry`); `container_registry_domains` jätetään pois.
- Disconnect poistaa vain `token`- ja `use_keyring`-avaimet kuten glab logout;
  muut asetukset ja `user` jäävät.
- Väärän `external_url`:n huomautus näkyy Uusi työtila -listassa, ei
  Koodipalvelujen kortissa eikä valmisnäkymässä (projektimäärää ei tiedetä
  ilman listausta). Valmisnäkymästä puuttuu myös projektien määrä.
- Apuohjelma ei seuraa `GLAB_CONFIG_DIR`-muuttujaa eikä lue avainnippua tai
  `GITLAB_TOKEN`ia.
- Keskeytynyt klooni, jonka palvelimelle glabilla ei ole kirjautumista,
  nimetään Gitean tapaan `omistaja/nimi`; jos polku ei voi olla Gitean, se
  listataan GitLabin kloonina ilman yhteyttä.
- Tunnuksen vaihto tarkistaa saman käyttäjänimen (glab ei tallenna
  käyttäjän id:tä).
