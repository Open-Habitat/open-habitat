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

## Purpose

The full clean gate can dominate a small change: the run that prompted this
issue took 203 seconds, and workers sometimes repeated it for unchanged code.
Shorten that feedback loop while preserving the evidence needed to ship a release.

## Existing result

[result.md](result.md) records combined browser startup/build work, checkout-local
Go/npm cache reuse and the test-selection policy now in
[TESTING.md](../../TESTING.md). In the recorded warm-cache comparison the gate
went from 215 to 184 seconds, about 14%; these were single observations under
variable load, not a guaranteed speedup. The serial browser suite remained the
largest cost. Negative tests showed that broken source and lockfile changes
still failed the gate.

## Completing the work

Assess the existing change against that purpose before adding more optimization.
If a material bottleneck remains worth addressing, measure it and focus there.
Comparable revisions, cache conditions and machine load make timings useful;
a long measurement checklist is not an outcome by itself.

A faster gate is useful only if its result still means the checked source and
release package passed. Shared caches or concurrency need particular care where
they could mix runs or hide changed inputs. The browser suite's shared scenario
state is the reason it currently runs serially. Disposable test homes and
checkout-local caches keep this work from disturbing native accounts or the
machine's installed tools.

Record the improvement, remaining costs and evidence in the result, using the
project's testing policy. Close when the feedback-loop improvement is verified;
this issue does not promise a particular percentage or endless optimization.
