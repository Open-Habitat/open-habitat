# Focused test work

## Measurements and decisions

The previous worker measured a changed-tree clean gate at 232.14 s (browser
116 s, Go/contracts 76 s, other phases 39 s); identical-tree reuse took
41.89 s. Earlier cold evidence was 287.63 s (browser 133 s, Go/contracts
111 s). The initial baseline attempt in this worktree stopped during npm's
Pi-device-test dependency install (ETIMEDOUT after 35 s); this was an external
fetch failure, not a passing or failing test. Later runs below distinguish
that from test evidence.

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

The requested 10x browser and Go speedup cannot be inferred from scheduling
alone. Measuring per-case host creation separately from case runtime and Go
race compile separately from execution is needed before removing any proofs or
changing fixture lifecycle. A safe pooled/reset host would need exhaustive
reset of gateway sessions and OAuth state, daemon leases/controllers, fake Pi,
filesystem history and synthetic clocks, plus repeated isolation runs. Native
race checks and Storybook/VM/validator cost should be profiled before changing
full-gate coverage. These are candidates for a follow-up spinoff, not evidence
of a completed 10x reduction.
