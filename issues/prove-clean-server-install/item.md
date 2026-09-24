---
created: 2026-09-24
updated: 2026-09-24
type: task
status: open
priority: high
lane: installation
lane_seq: 10
collision: [docs/, AGENTS.md]
related: ['@prepare-mvp-operations']
blocked_by: ['@deliver-login-pilot']
---

# Prove clean-server installation from standalone guide

## Goal
After the dedicated first-login test server works, turn the recorded pilot setup observations into a self-contained, host-neutral Linux installation and operations guide for Native Agent Host, then prove an agent can use that guide ALONE to install a functioning instance on a separate clean server. The guide, scripts and product package belong here; Fleetrepo remains the owner of the concrete Hetzner pilot's users, secrets, firewall, DNS, fleet and receipts. Start with a guide, not a speculative skill.

## Acceptance Criteria
- [ ] During the pilot, gather redacted exact commands, version/config inputs, deviations, failures and recovery receipts in the owning public issue result.md and Fleetrepo's private issue-local result/inventory. After the pilot, review those observations and distinguish generic product requirements from host-specific adaptations; never publish private credentials or identifying data.
- [ ] Produce one navigable, self-contained guide in docs/ (and necessary generic automation): supported Linux/systemd prerequisites, package download and integrity/provenance, distinct gateway and per-user identities, UDS/ACL and reboot ordering, operator-provided OAuth identity and secret configuration, HTTPS/origin/CSRF/Access boundary, safe start/stop, health/live-version, update, rollback, backup/restore and troubleshooting. It must not require Fleetrepo docs, hidden local files, undocumented manual commands or a prior conversation. Explicitly document what requires operator consent, identity verification and external provider setup; never bypass these to claim success.
- [ ] On an independently provisioned clean Linux VM/server (not the pilot host, no pre-seeded application or Fleetrepo state), have a fresh agent follow ONLY the shipped public guide and package to bring up the service under synthetic identities and prove login, two UID isolation, restart, failed upgrade and rollback. Run with no instructions beyond the guide and normal documented operator inputs; log every question, failure and missing prerequisite as a guide/product defect. Fix the guide or automation and repeat on a freshly reset/new server until the scenario passes. Compare the installed live binary digest/revision with the release receipt. Do not claim real GitHub consent from synthetic fixtures.
- [ ] Run clean committed-tree CI and independent relevant security/ops review for changed privilege/install boundaries; record exact tested revisions, machine/image baseline, checks, evidence and remaining supported-platform limits in result.md. If a safe clean-server proof is not possible, leave open with specific blocker rather than marking it done.

## Execution boundary
This is a post-pilot reproducibility checkpoint, not authorization to expose ingress, use real people's credentials or deploy onto an arbitrary third-party host. Coordinate with @prepare-mvp-operations to avoid duplicating its general lifecycle work; reuse and improve its artifact. No host-specific values in the public templates. A reusable skill may be proposed only after the documented process works and a repeated agent workflow warrants it.
