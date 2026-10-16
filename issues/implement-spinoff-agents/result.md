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
  twenty newest direct spinoffs are shown; selected older children remain
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
  Taskfleet documents that as **pre-rebase**, not a guaranteed merge commit.
  This release shows verified landing, the native result and recorded retained
  paths. Exact Git change details await a reliable integrated-object contract.
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
- Final integrated clean-gate result is recorded below after the committed tree
  is tested. No real provider prompt or distinct-UID browser-to-spinoff journey
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
once and failed with the known `ssh alder: Permission denied` self-SSH problem;
this optional telemetry failure does not affect the independent review.
