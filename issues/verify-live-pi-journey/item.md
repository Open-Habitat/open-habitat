---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: high
related: ['@gate-native-routes-on-pi', '@build-agent-control']
---

# Verify live Pi onboarding and conversation

## Goal
Keep the remaining **real-environment acceptance checks** separate from product implementation issues. A passing Playwright run with synthetic identities/Pi is evidence for browser behavior, not for a real provider, systemd installation, or per-person Unix separation on the test server. Record exact product release, host receipt, participants/consent and result for each check; a failed check becomes a concrete implementation bug, not an unchecked box silently waived.

## Preconditions
The test server currently runs pilot.12, not these newly landed changes. Before any replacing release or test-account reset, confirm the Fleetrepo test host's approved versioned upgrade/rollback procedure and exact bytes; do not infer authorization to overwrite pilot.12 from this checklist. Product release and concrete deployment belong in Fleetrepo; no real secret, one-time code, private home, screenshot with workspace names or unredacted identity is committed here. Any real OpenAI sign-in needs Jari's consent and participation; a second person's sign-in is voluntary and separately consented.

## Pi onboarding and native gate
- [ ] On an installed **new** release, a returning signed-in user with missing Pi credentials reaches the OpenAI step from a normal route and a direct workspace/history/control URL; only the explicit pre-Pi GitHub chooser/checkout remains accessible. No native history/control leaks on a stale tab or changed browser session.
- [ ] If Pi state is unknown or the daemon is interrupted, the OpenAI step explains check failure and permits a fresh read-only retry; it does not claim credentials are missing or automatically restart an uncertain attempt. An old device code or another browser session cannot take over a pending attempt.
- [ ] With Jari's approved account, verify actual installed Pi device-code exchange, credentials saved by Pi under the mapped UID, usable return to the intended browser route and recovery after reload; record redacted outcomes and clean up any temporary experiment state. Do not mistake the prior synthetic provider/UID tests for this result.
- [ ] Check test-host kernel UID/socket permissions, systemd activation and cross-user denials using consented identities; disposable rootless multi-UID fixtures are not host proof. If no second participant is available, record this as not run, not pass.

## Agent control (run only after @build-agent-control implementation lands)
- [ ] Against real installed Pi with a synthetic/offline provider where possible, exercise the **rendered browser** journey: create/send, live streamed text/tool updates, interrupt, reconnect without duplicate send, and deliberate continuation of an ended browser-owned conversation from native history. Existing terminal histories remain read-only, and losing daemon state must not confer control.
- [ ] With Jari's separate approval for real provider use, repeat the agreed bounded conversation story using his account; distinguish provider success from synthetic-model success and record cleanup of temporary state. Do not require another person's credentials for this check.

## Evidence
Put redacted product-level observations in `result.md`; link concrete Fleetrepo deployment/recovery receipts rather than copying host facts or secrets into this public repository. The list is the acceptance ledger, not an executable lane or permission to deploy/authorize a person.
