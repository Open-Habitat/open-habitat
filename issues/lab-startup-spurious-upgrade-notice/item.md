---
created: 2026-11-10
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: other
source_ref: taskfleet:01m72fv7gt7s9f20hf5644qyqx/observed:lab-startup-upgrade
originating_run: 01m72fv7gt7s9f20hf5644qyqx
originating_run_kind: spinoff
closed: 2026-11-14
---

# Fresh lab conversation sometimes becomes an upgrade-reload notice under reply jitter

## Description

## Observed failure

On Birch, repeated lab-skill-invocation.spec.ts executions with OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=skill-third OH_BROWSER_WORKERS=2 OH_PORT_BASE=17700 sometimes reach only the full-page “Palvelin päivitettiin” reload notice after the first Send. No first skill chip appears (line 32 assertion). This occurs before the skill-reader controls under investigation and occurred both before and after the reading-position fix in race-skill-block-load-lost.

The synthetic host is fresh per case and no installation upgrade was performed. A person cannot proceed without reloading. The exact cause of the upgrade notice is not established; do not assume a lost send or fix this with a longer chip timeout.

Reproduction from web/: npx playwright test --config playwright.lab.config.ts tests/lab-skill-invocation.spec.ts -g '1440 light' --repeat-each 10 --trace on, with the environment above and a short disk-backed TMPDIR / umask 077. One instrumented run had two such failures out of ten; an uninstrumented 390|1440 light batch had nine startup failures out of thirty (plus one separately diagnosed Load press failure).

Retained synthetic evidence on Birch: /var/tmp/skill-reader-evidence/claim/lab-skill-invocation--lab--f0a0a-ded-skill-reader-1440-light-repeat5/{trace.zip,error-context.md}. Its snapshot shows only the upgrade notice. Console near Send contains net::ERR_TOO_MANY_RETRIES. The POST /api/v1/conversations returned 200. The presence of that console error does not establish which observation caused the notice. Additional uninstrumented evidence: /var/tmp/skill-reader-evidence/fixed3/; logs /var/tmp/skill-fixed3.log and /var/tmp/skill-stack2.log.

This is an observed detector result, not a proven live-installation upgrade defect. Investigate the build/instance fence and delayed startup observations before altering that fence.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
