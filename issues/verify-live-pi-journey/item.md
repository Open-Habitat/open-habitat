---
created: 2026-09-30
updated: 2026-10-05
type: task
reporter: jari
status: obsolete
priority: high
related: ['@gate-native-routes-on-pi', '@build-agent-control']
lane: agent-control
closed: 2026-10-05
closed_by: jari
---

# Verify live Pi onboarding and conversation

This issue records the remaining real-environment acceptance for Pi onboarding,
conversation control and per-person Unix separation on the test server.
@gate-native-routes-on-pi owns the implemented access gate;
@build-agent-control owns conversation control. A failed acceptance check becomes
a concrete implementation bug; it does not disappear from this ledger.

Synthetic browser tests establish browser behavior. Real Pi with a synthetic
provider, real provider use and installed-host isolation establish different
things; [TESTING.md](../../TESTING.md) explains those evidence boundaries.

## Release and consent boundaries

The [dated verification result](result.md) records the release checked on the
test server. Releases and test-server data changes follow the root `AGENTS.md`: deploys need no approval, a failed
upgrade is fixed forward, and test users and data are disposable. The
procedure and receipts are in Fleetrepo's
`infra/native-agent-host-test/RELEASE-UPGRADE.md`.

Product release and concrete deployment belong in Fleetrepo; no real secret,
one-time code, private home, screenshot with workspace names or unredacted
identity is committed here. Any real OpenAI sign-in needs Jari's consent and
participation; a second person's sign-in is voluntary and separately consented.

## Pi onboarding and native gate

These checks concern an installed new release.

- [ ] A returning signed-in user with missing Pi credentials reaches the OpenAI
  step from a normal route and direct workspace, history and control URLs.
  Of the workspace routes, only the explicit pre-Pi GitHub chooser/checkout
  remains accessible. Native history and control stay protected on stale tabs
  and after a browser-session
  change.
- [ ] Unknown Pi state or a daemon interruption produces an explained check
  failure and a fresh read-only retry. The browser neither claims credentials
  are missing nor automatically restarts an uncertain attempt. An old device
  code or another browser session cannot take over a pending attempt.
- [ ] With Jari's approved account, the installed Pi completes the actual
  device-code exchange, saves its credentials under the mapped UID and returns
  the browser to the intended route, with recovery after reload. Record
  redacted outcomes and clean up temporary experiment state. Prior synthetic
  provider/UID results do not establish this outcome.
- [ ] The test host's kernel UID/socket permissions, systemd activation and
  cross-user denials work with consented identities. Disposable rootless
  multi-UID fixtures do not establish host isolation. A second participant
  can sign in only after @plan-second-user-admission's test-host admission is
  in place; without both, this check remains not run.

## Agent control

Run these checks only after @build-agent-control implementation lands.

- [ ] Against real installed Pi, with a synthetic/offline provider where
  possible, the rendered browser supports create/send, live streamed text and
  tool updates, interruption, reconnect without duplicate send, and deliberate
  continuation of an ended browser-owned conversation from native history.
  Existing terminal histories remain read-only; losing daemon state does not
  confer control.
- [ ] With Jari's separate approval for real provider use, repeat the agreed
  bounded conversation story using his account; distinguish provider success
  from synthetic-model success and record cleanup of temporary state. Do not
  require another person's credentials for this check.

## Evidence

Record each check's exact product release, Fleetrepo host receipt,
participants/consent and result in `result.md`, with redacted product-level
observations and links to any resulting implementation bugs. Link concrete
Fleetrepo deployment/recovery receipts rather than copying host facts or secrets
into this product repository. Missing prerequisites remain explicit as not run;
a partial run is not a pass.

Agents run every check that needs no real person: synthetic or offline
provider, test users created for the purpose. Checks that need Jari's real
OpenAI account or a second consenting person stay marked as waiting for them.

## Decisions

### 2026-09-30T17:56:20Z · @claude

Rethink-night 30.9.: rethink-instructions (gpt-6-astra), faktantarkistus fact-check-instructions (claude-opus-5-5). Ilman Jaria säilytin kuusi erillistä hyväksyntätarkistusta, suostumus- ja julkaisurajat sekä alkuperäisen frontmatterin; tulkitsin pilot.12:n kirjattuna lähtötasona ja erottelin synteettisen testin, oikean Pi:n, tarjoajan ja testipalvelimen näytöt. Faktantarkistus erotti pilot.12:n julkaisuohjeen vanhentuneesta pilot.11:n tilan nollausohjeesta, täsmensi että vain työtilareiteistä GitHub-esivaihe on avoin, ja että toisen käyttäjän pääsy edellyttää myös testipalvelimen admission-muutosta. Julkinen repo -väite muutettiin tuoterepoksi (GitHubin näkyvyys nyt private). Hostin nykytilaa tai offline-tarjoajan asentamista ei vahvistettu; tarkista ennen live-koetta. Ristiriitaa Jarin kirjattuihin päätöksiin ei löytynyt.

## Resolution

### 2026-10-05T10:12:26Z · @jari

Jari does not want a separate issue for ordinary upcoming real-person and Pi browser testing. Retain pilot.18 result.md as bounded evidence (no Pi browser journey was run there); use consent for real sign-in, follow normal install procedures and file specific defects if observed.
