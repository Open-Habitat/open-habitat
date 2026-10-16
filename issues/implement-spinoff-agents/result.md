# Result: observe the parent's native spinoffs

The daemon supplies creator-session attribution on fresh and continued browser
Pi launches and reads Taskfleet 0.15+ as the mapped Unix user. The parent gets
live groups at the native turn that preceded creation, plus a status line above
the composer. Opening a row or the native wait chip selects a read-only child
view through the route; there is no composer or settlement/continuation control.
The parent retains messaging and the process implementation owns all waiting
and wake-up facts. The sidebar's right-hand waiting dot blinks, except when
reduced motion is requested.

## Decisions for later review

- Taskfleet list is inventory, not landing proof. Unselected active rows use
  native list state; terminal/selected rows read show for verified landing,
  reports and preserved work. Reads have an overall command budget and expose
  partial/unavailable rather than interpreting failures as no children. The
  twenty newest direct spinoffs are shown (including Taskfleet research,
  technical-decision and fan-out workers; caller-owned runs are excluded); selected older children remain
  directly readable by full ID. Envelope warnings and deadline expiry degrade
  availability. No registry, cache or archive is written by the daemon.
- Creator attribution must also match the actual source checkout. Taskfleet
  records a creating subdirectory, so Git toplevel is checked when exact paths
  differ; a shared Git common directory does not admit a sibling worktree.
  Relative source paths that cannot establish this identity are not guessed.
  The same exact attribution now fences process-wait enrichment. Native
  uppercase or malformed UUID spellings remain readable but get no creator
  environment hint, so a display association cannot break Taskfleet create.
- The executable is explicitly resolved from the mapped user's native PATH,
  rather than Go resolving a bare name against the daemon service's PATH.
  No inherited TASKFLEET_HOME redirects reads outside the fixed native root.
- Transcript opens prefer Taskfleet's original archive, fall back to live,
  reject symlinks/escapes/foreign-owned or nonregular files, and verify native
  session type/version, exact session ID and recorded live/original cwd.
  Current-attempt identity comes from Taskfleet; no filename establishes it.
- The read-only transcript is a bounded **text projection**, not a second Pi
  controller: at most 8 MiB per native file, the last 200 decoded entries,
  4 KiB per message, 500 messages and 256 KiB total projected text. Partial live lines are
  ignored, and truncation/unavailable/unsupported harnesses are explicit.
  Thinking-only/tool-call-only turns and native argument expansion are not
  presented. Claude transcripts remain unsupported, with the result visible.
- No merge SHA, diffstat or commit count is invented from `report.origin.worker_oid`:
  Taskfleet documents that as **pre-rebase**, not a guaranteed integrated object.
  The retained `merge.rebased` event initially looked usable, but producer-source
  review established that **only caller-owned runs emit it**. Ordinary
  Taskfleet-owned spinoffs use a no-op callback instead. A proposed event-to-Git
  helper and its manufactured fixture were therefore removed, not shipped as
  imaginary coverage. Current results show verified landing, the native report
  and retained paths; exact Git details need the producer contract follow-up
  recorded below. This limitation does not make native results/transcripts
  unavailable.
- Native worktree paths exclude spinoff checkouts and their unannotated immediate
  `src` containers from the workspace snapshot. A name like `__worktrees` alone
  never hides a directory; ordinary annotated/root Git workspaces are retained.
- The process worker's waiting plumbing was already landed in this worker's
  base (`cdbb2c22` and successors), although its run remained open for rollout.
  It was reused, not reimplemented. The child view and links build on it.

## Test guest runtime

Fleetrepo spinoff **01m521wyc6h5qz7b95kvg94ped** completed and was awaited through
`taskfleet run wait`. Its changes are pushed through Fleetrepo `478c0acb`.
It installed released Taskfleet **0.15.0**, producer commit
`8464733b0d69cf1342eed64995163fd36c33523d`, and workmux 0.1.276 through the declared
guest runtime, with persistent lingering and a working private user-manager bus.
It passed all 265 offline tests and real guest checks for minimal-environment
independent units, two parent-service restarts, external socket access,
reattach/cleanup, creator attribution, live-to-original transcript discovery and
retained terminal reports. This is native guest evidence, not a real browser
provider conversation. Alder's installed Taskfleet was not changed.
The product tolerates missing/older Taskfleet, so runtime deployment ordering
cannot break the existing browser.

## Validation

- Full daemon and gateway suites passed after installing their declared pinned
  synthetic Pi dependency and using short disk-backed `TMPDIR=/var/tmp/ohs`.
- Web format, lint, typecheck, unit and production-component tests passed.
- Contract examples, generated drift, project-view docs and whitespace checks
  passed. New API and process fields originate in `contracts/v1`.
- Four focused browser journeys passed: the new group/read-only/result/return
  flow and the three existing process journeys, including the waiting sidebar
  dot, native waiting facts, parent messaging and accessibility checks.
- Storybook uses the production group and read-only components. Adjacent
  `group-light`, `group-dark`, `desktop`, `desktop-dark` and `phone` AVIF/HTML
  pairs are synthetic-lab views with explicit wire fixtures, not live data or
  automated visual comparisons. The HTML twins embed assets and are inert.
- The first full clean gate caught a missing shared lab-helper type declaration;
  the second passed all Go/race/contracts and 181 browser cases, with one
  warm-return assertion needing the new independent spinoff inventory read
  allowlisted (2 capture-only skips). Both defects are corrected. The final
  integrated clean-gate result is recorded below after the committed tree is
  tested. No real provider prompt or distinct-UID browser-to-spinoff journey
  is claimed by these synthetic checks.

Early setup/fixture failures were corrected, not counted as passes: missing
native Pi test dependencies; Unix socket paths exceeding the kernel limit under
an overlong TMPDIR; a daemon test's non-`unix` Host; and a browser API probe run
before its new parent existed. The probe now uses an actual native fixture
session and crosses the real authenticated gateway without page-route mocking.

## Review

`/llm-review` used claude-fable-5-1 as finder and gpt-6-astra as verifier for the
new native reads and creator environment. `/assess-findings` confirmed five
localized fixes: source-directory attribution, native binary lookup,
availability degradation, strict creator spelling and unnecessary active-row
landing checks. All are fixed; none required a new issue. The verifier also
checked that browser input cannot select a raw path, another parent's child, or
a writer capability. Native containment and ownership denial fixtures passed.

Scratch review/assessment artifacts are `history/review-spinoff-native-reads.md`
and `history/assessment-spinoff-native-reads.{json,md}`. Durable decisions are in
this result and the architecture docs. Model-performance logging was attempted
for both review passes and failed with the known `ssh alder: Permission denied`
self-SSH problem;
this optional telemetry failure does not affect the independent review.


## Producer-contract follow-up

A second, narrow event-to-Git review (gpt-6-astra finder, claude-fable-5-1 verifier)
confirmed that the apparent integrated-OID event is caller-owned-only. Local
source checks also confirmed this at the released guest commit, not just current
Taskfleet main. The rejected helper and fabricated fixture were removed before
committing. `/assess-findings` retained one confirmed producer-contract SPIN_OFF,
not a speculative consumer workaround.

Taskfleet issue **particularly-cooperative-chalk**, “Expose the integrated merge
OID for Taskfleet-owned runs”, was filed **untriaged and unlaned** with this
worker's exact origin, both model labels and all available review metadata.
Its self-contained evidence and acceptance criteria are pushed in Taskfleet
`142d35c5`. Prefer a native optional integrated OID on the ordinary merge report;
the Taskfleet maintainer chooses the contract without changing caller-owned
intent authority. Current browser landing/report/transcript remain useful and
honest while that narrower enhancement waits for scheduling.

The later gate's cross-tab identity timeout was a test race: an independent
native inventory could correctly observe the temporary logout before the test
manually refreshed the old tab. That test now supplies deterministic unavailable
inventories while keeping its held late-status and real snapshot identity fence.
Its purpose is not to suppress production 401 handling, which is unchanged.
