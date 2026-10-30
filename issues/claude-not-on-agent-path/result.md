# Tulos: `claude` agentin PATHissa

## Toistui yhä (30.10.)

Agentin PATH oli `~/.local/bin:~/.cargo/bin:/usr/local/bin:/usr/bin:/bin:<release>`.
Birchlla tuoreella HOMElla `command -v claude` ei löytänyt mitään. Jarin
oma tili löytää `claude`n vain siksi, että Fleetrepon dotfilesit linkittävät
sen hakemistoon `~/.local/bin`. Ydinruntime toimittaa Claude Coden polussa
`<release>/payloads/core/runtime/node_modules/@anthropic-ai/claude-agent-sdk-linux-<cpu>/claude`.
Hakemistossa on vain yksi suoritettava tiedosto, `claude`. Sen lisäksi siellä
on README, LICENSE ja package.json.

## Mitä tehtiin

`agentPath` lisää PATHin loppuun käynnistetyn julkaisun Claude Code
-hakemiston (`internal/daemon/agent_path_linux.go`). Polku johdetaan samasta
käynnistyspolusta kuin julkaisun bin (`/opt/open-habitat/current`), joten
pitkäikäinen kuori tai tmux seuraa päivitystä eikä jää vanhaan sukupolveen.
Kirjautuminen (`claudeLogin.binary`) ja PATH käyttävät samaa
`claudeCodeDir`-funktiota. Agentti, kuori, editori ja Taskfleet ajavat siis
samaa binääriä ja samaa natiivia tallennetta (`~/.claude`) kuin Claude-kirjautuminen.

Testi `TestAgentPathFindsSignInClaudeCode` varmistaa, että `claude` löytyy
PATHista ja on kirjautumisen binääri. Se varmistaa myös, että ihmisen itse
asentama `~/.local/bin/claude` voittaa. Birchlla tarkistettiin oikealla
asennuksella: tuoreella HOMElla uusi PATH löytää binäärin
`/opt/open-habitat/current/payloads/core/runtime/…/claude` (2.1.301), ja
vanha PATH ei löydä mitään.

## Päätökset myöhempää katselmointia varten

- **Hakemisto PATHiin, ei `claude`-linkkiä julkaisuun.** Vaihtoehto oli
  lisätä `claude`-linkki tai -kääre julkaisun bin-hakemistoon tai
  ydinruntimen `bin/`iin. Ydinpayload on linkitön ja allekirjoitettu
  suljettu kokonaisuus, joten linkki olisi vaatinut muutoksen
  julkaisun rakentamiseen ja sulkeuman tarkistukseen. Kopio taas olisi
  vienyt 270 Mt lisää. SDK-paketin hakemistossa ei ole muita suoritettavia
  tiedostoja, joten se on PATHissa yhtä rajattu kuin linkki.
- **Viimeisenä PATHissa.** Ihmisen oma Claude Code (esim. Fleetrepon
  `claude-launch` Birchlla) pysyy etusijalla. Näin tuote ei ohita tietoista
  valintaa, ja asennukset ilman omaa Claude Codea saavat toimitetun.
- **Julkaisun käynnistyspolusta, ei `pi-runtime.json`in sukupolvesta.**
  Kirjautuminen käyttää `pi-runtime.json`in nimeämää sukupolvea, ja apply
  osoittaa sen samaan sukupolveen kuin `current`. PATH taas seuraa
  `current`-valitsinta, jotta päivityksen jälkeen poistettu vanha sukupolvi
  ei jätä avointa kuorta ilman `claude`a.
- Testipalvelimen Fleetrepo-kääre `/usr/local/bin/claude` on tämän jälkeen
  tarpeeton, mutta ei haitallinen. Sen poistaminen kuuluu Fleetrepoen.
