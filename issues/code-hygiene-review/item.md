---
created: 2026-11-14
updated: 2026-11-14
type: task
status: open
priority: normal
preparation: ready
lane: code-hygiene
lane_seq: 2
---

# Code hygiene review: dead code, duplication, missing basic seams

## Goal (Jari 14.11.2026)

A code-hygiene review of the product: dead code (branches the contract
never reaches, unused exports, leftovers of removed features), outright
duplication (copied logic that should be one function or component), and
missing basic architectural seams that grew by accretion (the same rule
implemented in several places, modules that know too much). Not style
nits and not speculative hardening.

Output: one intake issue per real finding (or per coherent cluster), each
with where, why it matters (maintenance cost, risk of divergence) and the
proposed refactor; plus a short report in this issue ranking them. The
refactors themselves are scheduled from the findings.
