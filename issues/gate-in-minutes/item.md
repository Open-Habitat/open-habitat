---
created: 2026-11-02
updated: 2026-11-02
type: improvement
reporter: jari
status: open
priority: high
lane: gate-in-minutes
lane_seq: 1
preparation: ready
---

# The clean gate takes 22 minutes; bring it to a few

Jari 2.11.: the clean gate takes over 20 minutes; at one point the tests ran
in a couple of minutes. Measured on an **idle** Birch (8 cores, nothing else
running), 2.11. 07:37, commit `3c9c6072`: total 22 min 24 s; setup 5 s,
dependencies 50 s, web checks 44 s, **browser + Go/contracts 19 min 10 s**
(ordinary browser suite 532 tests in 14.2 min with 8 workers, then the lab
suite 163 tests in 4.9 min, sequentially; Go and contracts beside them),
packaging 95 s. So load is not the cause: the suite itself has grown (about
170 spec-file changes in a week) and each case starts its own synthetic
host.

Find where the browser time goes (per-spec durations from the Playwright
report; host start cost per case; the longest specs; sequential lab after
ordinary) and bring the whole gate to a few minutes without losing what the
specs protect: for example share a synthetic host per file where cases do
not interfere, run lab and ordinary suites concurrently within the CPU
budget, cut fixed sleeps and long timeouts, merge redundant journeys, move
pure layout checks to component tests. Report the before/after per phase.
