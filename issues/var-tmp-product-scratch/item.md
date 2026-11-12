---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-12/var-tmp-oh
lane: unlaned
preparation: ready
closed: 2026-11-12
---

# Product scripts and workers leave oh-* scratch under /var/tmp that nothing cleans

## Description

Fleetrepo 12.11.2026: Birch now has an hourly retention timer like Alder's,
but it cleans only `/var/tmp/agent-scratch`. Open Habitat's own `oh-*`
directories and release staging directories were deliberately left out:
removing them is the product's job. They filled `/var` on 10.11. and seven
browser specs failed. On 12.11. there were ~870 entries directly under
`/var/tmp` (gate worktrees `oh-gate-*`, worker TMPDIRs `oh-XXXX`, release
`pilot*-incoming`, build dirs). Fleetrepo alerts at 85 % / 95 %.

Fix: product scripts (`scripts/ci-local.sh` sets `TMPDIR=/var/tmp` and
`mktemp -d`; release-cut/prepare scratch; lab and evidence scripts) remove
what they create on every exit path, or create it under
`/var/tmp/agent-scratch/` where retention applies; worker and conductor
instructions use agent-scratch (AGENTS-WORKFLOW updated 12.11.). One-time
cleanup of the stale entries.
