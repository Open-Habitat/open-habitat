---
created: 2026-09-29
updated: 2026-09-30
type: improvement
reporter: jari
status: open
priority: normal
lane: build-tooling
collision: [scripts/ci-local.sh]
---

# Speed up clean CI gate

Shorten the feedback loop for small changes while keeping the evidence needed
to ship a release. The run that prompted this issue took 203 seconds, and
workers sometimes repeated the full gate for unchanged code.

The existing improvement combines browser startup and build work, reuses
checkout-local Go/npm caches and gives test selection one home in
[TESTING.md](../../TESTING.md). [result.md](result.md) records a warm-cache
comparison of 215 to 184 seconds. Those are single observations under variable
load, not a guaranteed speedup; the serial browser suite remained the largest
cost.

The remaining question is whether this already meets the purpose or whether a
material bottleneck warrants more work. Comparable source revisions, cache
conditions and machine load make a timing comparison meaningful. The result
should explain the time saved and remaining costs, with enough evidence to
judge whether the improvement is complete; there is no target percentage.

A passing gate still means the checked source and release package passed.
Cache reuse is valuable where changed inputs still invalidate results, and
concurrency is valuable where runs remain independent. The browser tests share
scenario state, so merely increasing their worker count can mix test cases.
Disposable test homes and checkout-local caches protect native accounts and
installed tools. The existing negative tests in the result show that broken
source and lockfile changes still failed after the optimization.
