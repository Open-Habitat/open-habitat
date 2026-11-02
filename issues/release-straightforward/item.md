---
created: 2026-11-02
updated: 2026-11-02
type: improvement
reporter: jari
status: open
priority: high
lane: release-straightforward
lane_seq: 1
related: ['@release-cut-stop-signing', '@research-release-10x-faster']
preparation: ready
---

# Make the release straightforward: unsigned, gate before, one script

Jari 2.11., after pilot.18 stalled for hours: the release process has grown
far too complex and must be cleaned up and made straightforward.

Decided:

1. **Releases are unsigned.** ADR 0034's signing was already given up; the
   trust is the pinned manifest digest and immutable GitHub releases. Remove
   signing from the release cut entirely (no key, no throwaway key, no
   `.sig`/`.pub`, no `runtime-release sign` step), together with every
   instruction that mentions the key. This finishes `release-cut-stop-signing`.
2. **The gate is the conductor's job before the release, not part of it.**
   The conductor runs the clean gate on main, fixes what it finds, reruns
   only the failing specs to confirm each fix, and runs one final gate for
   the receipt. The release then uses that receipt and never runs the gate
   again inside the release work, where nobody sees it.
3. **One straightforward cut**: a single script that takes the gated commit
   and its receipt and produces, verifies once, uploads (reduced: only new
   assets) and publishes the release, then starts the Fleetrepo upgrade
   operator. No agent improvisation in the ordinary path; an agent is needed
   only when the script stops.

Scope: remove the steps and instructions that the above makes unnecessary
(release recipes in issues, AGENTS-WORKFLOW/TESTING release prose, the
pilot.18 worker's ad-hoc `cut.sh`); keep digest pinning and immutable
releases. `research-release-10x-faster` (report.md) has the measured time
budget.
