---
created: 2026-09-24
updated: 2026-10-05
type: task
status: duplicate
priority: high
lane: installation
lane_seq: 10
collision: [docs/, AGENTS.md]
related: ['@installation-and-operations-guide']
blocked_by: ['@deliver-login-pilot']
closed: 2026-10-05
closed_by: jari
---

# Prove clean-server installation from standalone guide

## Purpose

After @deliver-login-pilot works, turn its setup observations into a
self-contained, host-neutral Linux installation and operations guide. The
result is demonstrated when a fresh agent can install and operate a functioning
instance on a separate clean server using only the shipped public guide,
package and documented operator inputs.

Native Agent Host owns the guide, generic scripts and product package.
Fleetrepo owns the concrete Hetzner pilot's users, secrets, firewall, DNS, fleet
and receipts. Coordinate with @installation-and-operations-guide and reuse and improve its
operations artifact rather than duplicate its general lifecycle work. Start
with the guide; a reusable skill becomes worth proposing only after the process
works and repeated agent use warrants one.

## Material for the guide

During the pilot, capture exact commands, version and configuration inputs,
deviations, failures and recovery receipts. Redacted evidence belongs in the
owning public issue's `result.md`; private details belong in Fleetrepo's
issue-local result and inventory. Review those observations after the pilot to
separate generic product requirements from host-specific adaptations.

Provide one navigable guide in `docs/`, with any necessary generic automation,
covering:

- Supported Linux/systemd prerequisites, package download, integrity and
  provenance.
- Distinct gateway and per-user identities, Unix-domain sockets, ACLs and
  reboot ordering.
- Operator-provided OAuth identity and secrets, HTTPS, origin and CSRF
  protections, and the Access boundary.
- Safe start/stop, health and live-version checks, update, rollback,
  backup/restore and troubleshooting.

The guide stands on its own: installation cannot depend on Fleetrepo documents,
hidden local files, undocumented manual commands or an earlier conversation.
Explain which actions require operator consent, identity verification or
external provider setup, so these dependencies can be supplied explicitly
rather than bypassed to obtain a passing result. Public templates contain no
host-specific values; public evidence contains no private credentials or
identifying data.

## Clean-server proof

Use an independently provisioned clean Linux VM or server, separate from the
pilot and without pre-seeded application or Fleetrepo state. A fresh agent
receives only the shipped public guide and package, plus normal documented
operator inputs.

Under synthetic identities, demonstrate login, isolation between two distinct
kernel UIDs, restart, failed upgrade and rollback. Compare the installed live
binary digest/revision with the release receipt. Synthetic fixtures establish
only their tested behavior, not real GitHub consent.

Record every question, failure and missing prerequisite as a guide or product
defect. Repair the guide or automation and repeat the scenario on a freshly
reset or new server until it passes; accumulated manual repairs would conceal
what the next installer still cannot reproduce.

## Scope and completion evidence

This post-pilot checkpoint does not authorize exposing ingress, using real
people's credentials or deploying onto an arbitrary third-party host. Keep the
proof within a safe, authorized test environment.

Run clean committed-tree CI as described in `TESTING.md` and obtain independent,
relevant security/operations review of any changed privilege or installation
boundaries. Record exact tested revisions, the machine/image baseline, checks,
evidence and remaining supported-platform limits in this issue's `result.md`.
If a safe clean-server proof is unavailable, leave the issue open with the
specific blocker.

## Decisions

### 2026-09-30T17:49:23Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue kirjoitettiin luettavammaksi rethink-instructions-skillillä (gpt-6-astra); alkuperäinen tavoite, näyttövaatimukset, riippuvuus ja turvallisuusrajat säilyivät. Ilman Jaria säilytettiin frontmatter ja nykyinen hyväksyntäraja, käsiteltiin docs/operations.md tulevana artefaktina eikä väitetty olemassa olevaksi; uutta hyväksyntäporttia ei lisätty. Fact-check-instructions (claude-opus-5-5) ei löytänyt korjattavaa asiavirhettä; paikallisesti varmistettiin TESTING.md:n puhdas CI -komento, issuereferenssit ja nykyisten testifixtureiden Fleetrepo-riippuvuus. Nykyinen synteettinen OAuth-fixture ei ole vielä itsenäisen julkisen oppaan mukana, ja Accessin yleinen/tietyn toimittajan merkitys jää toteutusvaiheessa ratkaistavaksi. Nämä ovat alkuperäisen tekstin avoimia toteutuskysymyksiä, eivät muutoksia Jarin kirjattuihin päätöksiin. Palvelimen tämänhetkistä tilaa ei tarkistettu.

## Resolution

### 2026-10-05T10:00:03Z · @jari

The standalone guide and clean-VM proof belong to @installation-and-operations-guide as acceptance of installable packaging, not a separate post-pilot test issue. The distinctive fresh-agent and synthetic two-UID checks have been carried there.
