---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: research-release-10x-faster
lane_seq: 1
preparation: ready
closed: 2026-11-01
---

# Research: a release in about 10 % of today's time

Jari 1.11.: a release to Birch, Northwind and Contoso takes about 1–2 hours
end to end (clean gate, cut, signing on Alder, draft upload and
verification, publication, Fleetrepo upgrade operator on three machines).
Find out how it could take **about 10 % of that** (roughly 6–12 minutes),
and what that would cost.

Measure first: where does the time go, step by step, in pilot.17 and
pilot.18 (`issues/release-pilot-17/result.md`, the pilot.18 run
`01m6c2ybczc0gvg629k2gnka93` and its result when it lands, Fleetrepo's
`infra/open-habitat-upgrades/` reports and the upgrade operator's receipts
on Alder, the gate's phase timings in `scripts/ci-local.sh` output). Then
look at every step for what is unnecessary, repeatable from cache,
parallelisable or movable off the critical path: for example reusing a
clean-gate receipt of the same tree, building both architectures at once,
signing only what changed, verifying once instead of several times,
installing the three machines in parallel, not rebuilding unchanged runtime
archives, a smaller install delta on the machines (only the changed
generation parts), and whether the gate must precede a pilot release at all
or can run alongside. Keep the trust properties (digest pinning, signature,
immutable releases, gated production) unless a change to them is named as
such for Jari to decide.

Report in Finnish in `report.md`: a one-paragraph summary first, the
measured time budget per step, the proposals ordered by time saved per
effort, which together reach ~10 % and which do not, and what each changes
in the trust model. Research only, no product or Fleetrepo changes.
