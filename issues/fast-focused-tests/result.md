# Focused test work

## Measurements and decisions

The previous worker measured a changed-tree clean gate at 232.14 s (browser
116 s, Go/contracts 76 s, other phases 39 s); identical-tree reuse took
41.89 s. Earlier cold evidence was 287.63 s (browser 133 s, Go/contracts
111 s). The initial baseline attempt in this worktree stopped during npm's
Pi-device-test dependency install (ETIMEDOUT after 35 s); this was an external
fetch failure, not a passing or failing test. The first changed-tree full
`--clean --json --no-reuse` gate on commit `55e9573` passed in 233 s (setup
5 s, dependencies 49 s including browser download, web checks 12 s,
concurrent browser 142 s and Go/contracts 157 s, packaging 10 s). A second
changed-tree no-reuse run on commit `9eed903` with caches populated took
169 s (setup 5 s, dependencies 14 s, web checks 11 s, concurrent browser
129 s and Go/contracts 124 s, packaging 10 s). Relative to the earlier
sequential 232 s run, warm-cache elapsed time fell about 27%, not 10x.
Browser cases: 142/142 normal and 17/17 lab. Two further serial repetitions passed
142/142 + 17/17 each (normal 1.3 and 1.2 minutes, lab 41.2 and 41.1 s).
Separate normal and lab Playwright commands must not overlap within one
worktree: an exploratory concurrent attempt failed because they both use
`web/test-results` for trace/artifact storage, not because the case hosts
shared state. Those failures were discarded and both suites rerun serially.

On warm caches, `go test -race -run '^$' -count=1 ./...` (compile/link without
running tests) took 2.94 s; `go test -race -json -count=1 ./...` took 65.81 s.
The daemon package alone took 65.06 s. Its slowest cases were
`TestTailPageLargeNativeFileAndByteCap` 34.3 s,
`TestTypedHistoryPageBoundsMetadata` 7.53 s, and
`TestBoundedBlockReadSelectionAndPrivacy` 7.25 s. Those cases prove large
native history paging and privacy bounds; dropping them to shorten a gate
would lose unique proof. Other measured isolated warm steps: Storybook build
3.51 s, generated drift check 0.04 s, contracts validator 0.21 s, plan
validator 0.32 s and its tests 4.84 s, project view 0.02 s, licenses 0.01 s,
gate receipt test 0.67 s and offline VM self-test under 0.01 s. Ten direct
standalone host starts reached readiness in 10–32 ms (median 16.5 ms), so
pooling hosts is not a credible order-of-magnitude browser lever. A separate
warm full browser JSON profile passed all 142 cases in 82.15 s. The
[per-spec and per-case profile](profile.md) records every case: the biggest
spec by summed case time is `browser-conversation.spec.ts` (58 cases,
241.4 case-seconds across workers), and the longest case is Pi onboarding's
poll/focus/slow-read journey (21.21 s). These timings include the host fixture;
case sums overlap under eight workers.

The browser tests use fresh Go hosts, homes and sockets per case, and fixture
state includes more than the scenario switch: OAuth admission, clock, fake Pi
leases, daemon controllers and on-disk history. Reusing a host without an
atomic teardown of all these authorities is unsafe. Fixed waits in Pi tests
exercise real lease and polling deadlines; merely replacing those waits with
UI assertions would change what they prove. We retained per-case hosts and all
security-boundary checks rather than claiming a speedup from an incomplete
reset. Go's race instrumentation and host-side fixture startup also remain
part of the full gate.

The full gate now launches the browser and Go/contracts phases concurrently
*after* the single production web build. It waits for and reports both child
exit codes, without recording a receipt if either fails. Focused runs select
an explicit area plus a spec/tag or internal Go package; they do not infer
safety from paths. They print skipped areas and cannot call the receipt writer.

## Coverage map

No tests were removed, merged or moved. Therefore every existing proof remains
at its original layer: Playwright host-backed journeys and a11y; Vitest
component and client-state checks; Go race-tested internal packages; generated
contract checks; offline VM recipe; and release packaging. In particular,
gateway authorization, daemon identity distrust, provisioning and socket/user
boundary tests remain intact. There is no replacement-proof claim to audit.

## Remaining work

The requested 10x browser and Go speedup is not reached. Standalone host
startup and warm Go compilation are small; runtime in the daemon's large
native-history bounds tests and timed browser journeys dominates. A safe
pooled/reset host would need exhaustive reset of gateway sessions and OAuth
state, daemon leases/controllers, fake Pi, filesystem history and synthetic
clocks, plus repeated isolation runs; a scenario-only reset is not sufficient.
The follow-up should profile history parsing and per-case browser waits before
changing full-gate coverage. This is a spinoff proposal, not evidence of a
completed 10x reduction.
