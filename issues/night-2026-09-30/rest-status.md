# night:rest — status

Kirjoittaja: `night:rest`-kapellimestari. Lue `ui-status.md` jokaisen
kierroksen alussa. Uusin merkintä ylimmäksi.

## Pyynnöt toiselle

- **UI: `fit-onboarding-v2` ei voi edetä tänä yönä.** Sen esto
  `show-large-clone-progress` odottaa Jarin arkkitehtuuripäätöstä
  kloonauksen levykiintiön valtuudesta (ADR 0005 vaatii 20 GiB:n
  yrityskohtaisen kovan rajan, jota mapped-UID-daemon ei voi asettaa).
  Aiemman ajon `01m3p7y1w4nsh2wdjjj72341j1` säilötty työpuu pitää kaistaa
  `github-clone-progress` ja tokenit `internal/daemon/github_clone_linux.go`,
  `web/src/app/GitHubOnboarding.tsx`. `rest` ei tee sitä yöllä.
- **UI: agenttiohjauksen selainosa tulossa.** `build-agent-control`in
  daemon/gateway/sopimus-viipale on käynnissä. Jos se tarvitsee
  selainmuutoksen (jatka päättynyttä keskustelua, replay), pyyntö tulee
  tähän ja `issues/build-agent-control/result.md`:hen otsikolla
  "Browser request for night:ui". Generoidut `web/src/contracts/` voivat
  muuttua sen mukana; älä muokkaa niitä käsin.

## Kierrokset

### Kierros 1 — käynnissä (alkoi 2026-09-30 17:22 UTC)

Käynnissä (omat ajot, varaukset):

- `01m3snj56qfh0t14tyd429hmz8` — `build-agent-control`, kaista
  `agent-control`, tokenit `AGENTS.md`, `internal/daemon/`,
  `docs/interfaces.md`, `internal/gateway/`, `contracts/v1/`
  (kavennettu commitissa `505d7ad`; ei `design-system/` eikä
  `Conversation.tsx`).
- `01m3snkgxx4jnmzm0enbzyw40v` — rethink-fan-out 19 issuelle
  (`rethink-project-docs`, kaista `planning`, token `docs/`). Yksiköt
  kirjoittavat vain omaan `issues/<slug>/`-kansioonsa; ei UI:n issueita.

Jarille: `show-large-clone-progress` odottaa kiintiövaltuuspäätöstä
(säilötyn työpuun `blocker.md`). `plan-second-user-admission`in
toteutusosa (Access-assertion-vartija) on jo tehty; jäljellä on
testipalvelimen gateway-asetus ja vapaaehtoisen toisen käyttäjän koe,
jotka vaativat Jarin.
