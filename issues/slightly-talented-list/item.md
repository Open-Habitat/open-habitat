---
created: 2026-10-06
updated: 2026-10-06
type: task
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m47pbesrjq7cfmy6zwnpy04q/human-observation:second-person-isolation
originating_run: 01m47pbesrjq7cfmy6zwnpy04q
originating_run_kind: spinoff
---

# Observe second-person sign-in and live isolation

## Description

The test installation now runs `0.0.0-pilot.19` with signed Cloudflare Access assertion enforcement, test-only allowlist-free broker admission, and an Access policy allowing Kaisa and the northwind.test domain. Product issue @plan-second-user-admission delivered and verified the installation, but nobody has observed Kaisa's own Access/GitHub sign-in. No Unix account should be precreated for her.

When Kaisa chooses to try the installation, observe that her successful Access and GitHub login creates exactly one account under her own Unix UID and shows her workspaces. With both people participating, verify in both directions that neither can access the other's home, native credentials, agent sockets or sessions. Record actual observations and limitations, without copying tokens, PINs or personal credentials into the issue. A synthetic two-UID VM check passed; it does not substitute for this live observation. If the login fails, record the concrete symptom and investigate rather than claiming isolation.

## Acceptance Criteria

- [ ] Kaisa voluntarily signs in through Access and GitHub; her own new Unix binding and workspace view are observed.
- [ ] Live cross-person home, credential, socket and agent-route denials are observed in both directions.

## Evidence available before participation

Product `f25649247b8419a2a0ac273b674f6e4a55e73b97` clean-gated; Fleetrepo `infra/machines/native-agent-host-test.md` and `issues/native-agent-hetzner-jit-broker/admission-deployment-result.md` record pilot.19, root broker mode, Access stages and guest receipts. Their checks explicitly did **not** include a second-person login or isolation observation.
