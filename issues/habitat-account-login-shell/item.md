---
created: 2026-10-25
updated: 2026-10-25
type: feature
status: open
priority: normal
preparation: ready
provenance: chat
lane: unlaned
collision: [internal/provision, internal/host]
---

# Optional SSH login shell for named Habitat accounts

## Description

Jari 2026-10-25 (decision, recorded after the conductor's warning that a sudo-capable Habitat account gives every browser session and agent root): on his own installations he wants one account: `ssh birch` from his machines and the browser should be the same Unix user, and he accepts that this account has sudo ("ei haittaa … ihan sama onko mulla pääsy tailscalen kautta terminaalilla vai verkkoselaimella"). The browser is just another way to the same native sessions as SSH and tmux.

Today Open Habitat creates every account with `/usr/sbin/nologin` (`internal/provision/executor_linux.go` useradd, and the broker's verification refuses any other shell), so SSH login into a Habitat account is impossible.

## Goal

An operator can declare in the site configuration that named Habitat accounts get an interactive login shell (e.g. `/bin/bash`), so the person can SSH in as that same Unix user. The broker creates or adjusts such accounts accordingly and its verification accepts exactly the declared shell for those accounts and `nologin` for all others. Everything else about the account (UID pool, home, quota, ownership) stays as now. Sudo membership is not the product's business: Fleetrepo grants it on Birch. Document the choice and its consequence (a login-shell account with sudo makes browser access equivalent to root SSH for that person) in docs/operations.md.

## Acceptance Criteria

- [ ] Site schema field with validation; accounts not named keep nologin.
- [ ] Broker create and verification honour the declared shell; tests including an attempt to set it for an undeclared account.
- [ ] Existing installations upgrade cleanly; an account switching from nologin to the declared shell on upgrade is handled.
