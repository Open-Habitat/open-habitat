---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: done
priority: normal
lane: research-locked-account
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Research: what a locked Linux account means for Open Habitat access

## Description

Jari 31.10.: the Cockpit benchmark (`issues/benchmark-cockpit/report.md`, lesson 3) inferred, untested, that a natively locked or expired Linux account keeps browser access while SSH refuses it. Research it so nothing is guessed: what "locked" means on Linux (passwd -l / usermod -L password lock, usermod -e account expiry, shadow expiry fields, nologin shell, `AllowUsers`/`DenyUsers`, pam_access, faillock), what each blocks for SSH key login, su, cron, systemd user managers and linger, and how Cockpit, JupyterHub and similar handle it. Then establish by experiment what Open Habitat does today for each kind of lock: sign-in through the gateway, an existing browser session, the running daemon and its Pi, tmux, the editor. Experiment only on a disposable account on the test server or the qualification VM through Fleetrepo's documented operators (`ssh alder`, read `~/Sources/fleetrepo/infra/open-habitat-test/`), never on Birch's or the pilots' real users, and restore what you change. Report in Finnish in `report.md`: the facts table, what Open Habitat should do for each lock (recommendation), and which component would own that check (gateway, daemon, provision) as a question for an ADR.

## Acceptance Criteria

- [x] Suomenkielinen `report.md` erottaa säilytetyt natiivimittaukset ja lähdekoodista päätellyt selainpolut file:line-viittein Jarin hyväksymän rajauksen mukaan.
- [x] Raportti suosittelee toimintaa lukitustavoittain ja jättää uuden pääsyesteen sekä gatewayn, daemonin ja provisionin vastuunjaon ADR-kysymyksiksi.

## Comments

## Decisions

### 2026-10-31T17:55:02Z · @conductor

Jari 31.10.: a source-code-based boundary is enough; no test GitHub account for browser experiments. Finish the report from the preserved partial (5e5fc69b) with the browser-side rows established from the gateway, daemon and provision code, marked as inferred from source.
