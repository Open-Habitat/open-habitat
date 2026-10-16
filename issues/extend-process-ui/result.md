# Agent processes in the browser

Implementation of the accepted *Kentän yllä* tray and *Merkintänä* notification design.

## Native owner and bridge

The release embeds `process-extension.mjs` alongside the existing recap extension. Each daemon-owned Pi child receives a fresh socket in a 0700 temporary directory; the socket is 0600. The daemon accepts only its own effective UID **and exact child PID** using `SO_PEERCRED`. Systemd's existing `PrivateTmp=yes` keeps the directory within the daemon service. Terminal-owned Pi is never scanned or attached.

The companion dispatches native list/get/combined-output/kill/clear events. pi-processes owns every record, log and process group. The daemon keeps no registry, PID table, log copy or wake-state store. Output reads and stops carry both the child generation and the native record's start-time token, checked against the live record before dispatch. Clear only removes native finished records/logs. Before closing Pi the companion blocks further native process starts and kills remaining groups; RPC shutdown then allows four seconds rather than 100 ms.

Pi's `agent_start` now establishes an active run even without a browser command. It remains active until `agent_settled`; the composer can steer and abort a native wake-up exactly like a browser-started run. Process custom messages project structured `details`, never the XML content that repeats raw commands. Historical delivery remains null; live initial native messages are wake, subsequent messages steer, idle messages context.

The companion joins live process IDs **and start times** to this child's native process start results for exit wake conditions. Pending/spent log watches do not count. Unknown metadata remains unknown rather than inventing a waiting state. An extension question takes precedence over background waiting.

## Decisions for later review

- Live log delivery uses bounded **invalidation hints** on the existing user SSE, followed by a fresh bounded native tail while an output view follows. This deliberately avoids assembling a second stream/log store or promising gap-free replay over upstream's lossy output broadcasts. No log data is read for a closed output view; paused output remains readable in the browser and resume reads a fresh tail. Unknown omitted counts and retention state stay null. A retention restart is claimed only on the exact native marker.
- Command previews redact assignments, URL user-info, header arguments, credential-like long options and known token prefixes. This is best effort, not a guarantee about arbitrary shell syntax. PIDs, log paths, cwd and raw native records are not process API fields. Output is the user's own bounded text, not redacted.
- The optional upstream runtime is discovered beside the selected Pi. Its absence does not break ordinary Pi or rewrite user settings. Only its core extension is loaded, not logs/dock. Fleetrepo owns the pinned package graph and selector; the product owns the companion bytes.
- Fleetrepo child `01m51vja3n7asnpj1skj8yjb5m` landed/pushed `2f1167c7`: Pi 1.3.0 + pi-processes 0.10.9 + existing Claude bridge, with a licensed `@aliou/sh` 0.3.4 override. The product test graph uses the same override. The upstream default parser 0.2.2 declares UNLICENSED and is not the shipped runtime. Fleetrepo verified 254 tests, registry signatures, a real disposable install and byte-identical offline rebuild. Guest selection must happen **after** the matching product release; no guest runtime was switched by that worker. Runbook: Fleetrepo `infra/open-habitat-test/GUEST-PROCESSES-RUNTIME.md`.
- One approved upstream request was filed: https://github.com/aliou/pi-processes/issues/132 — record `ctx.isIdle()` in notification details and report remaining wake conditions, including pending one-shot log watches, in the list reply. No host internals were disclosed.

## Verification

- `go test -race ./internal/daemon ./internal/gateway -run 'TestProcess|TestConversation|TestNativeBlocks|TestCustomMessage' -count=1`: passed, including real pinned Pi/core/companion with synthetic HOME and synthetic provider. Verified idle completion wake, working state, list during a model request without another prompt, stop and clear.
- `node --test internal/daemon/pi-device-test/process-extension.test.mjs`: passed. Checks missing extension vs empty, reused-ID rejection before kill, current-token force stop, native clear/shutdown and bounded hostile output.
- New `TestProcessDistinctUIDs`: passed in the disposable rootless Ubuntu fixture, own UID allowed and foreign/gateway UIDs denied. Dialog and device-login isolation also pass after repairing the contradictory positive-probe assertion described below.
- A full affected-package run with `TMPDIR=/var/tmp/oh-process-build` passed daemon tests but hit existing gateway Unix-socket path-length limits. Subsequent tests use the shorter disk-backed `/var/tmp`.

## Browser and cross-surface integration

Browser child `01m51vhpd0cve74tvq1tmyky7v` landed the accepted tray, fenced
start joins, typed completion markers, waiting activities and generated
contracts. [browser-result.md](browser-result.md) records its checks and paired
synthetic screenshot/HTML; these are synthetic UI evidence, not a live capture.
Subsequent integration added the actionable waiting chip, first-person *Odotan*
recap line, bounded current Taskfleet facts and live-delivery correlation. An
additional host-backed wire-fixtured browser journey verifies waiting-process →
waiting-spinoff across header, recap and home, the typed historical completion,
and a Pi-started run with steering/Stop instead of waiting. It passed; its first
fixture attempt omitted the live-process fact of a still-empty fake Pi, which
was corrected explicitly rather than weakening the presentation assertions.

Taskfleet metadata is read with validated IDs and fixed `run show` argv as the
mapped user, bounded by a shared projection deadline. Missing/pruned runs are
not invented. A timeout/failure of the wait is kept distinct from the spinoff's
current state. Readable unfinished runs establish `waiting_spinoff`; absent
Taskfleet observations remain ordinary process waiting. This does not implement
spinoff creation, attribution or transcript navigation from the separate
`implement-spinoff-agents` issue.

## Review and assessed fixes

One critical `/llm-review` used finder `claude-fable-5-1` and independent verifier
`gpt-6-astra` (two calls). `/assess-findings` classified seven confirmed fixes,
no design spin-offs, and two dropped claims. Machine-local artifacts are
`history/review-process-ui.md` and `history/assessment-process-ui.{json,md}`.
No residual review issue was filed.

The fixes: output-read leases suppress unobserved log traffic and coalesce active
hints; duplicate extension managers fail closed before controls (and a configured
native package avoids adding a second product core); Unicode names are bounded
without hiding the inventory; native suppressed-log notices remain visible;
serialized Pi argument deltas use toolcall_start identity rather than the
stripped `partial`; diagnostic status is signal-only, including aggregate
messages; and an open output selection keeps owner + ID + record token rather
than transferring to a recycled ID. The verifier checked real Pi serialization,
and the repaired real-Pi test places a synthetic secret in its process command.
No command/PID/log-path metadata may leak through those default surfaces.

Last-browser-command receipts deliberately remain acceptance evidence during a
native wake; they are not run identities or completion evidence. Silently
truncating a live inventory was rejected: unavailable is more truthful than
omitting a process that may wake the agent.

The optional model-performance append was attempted once and failed with the
known Alder SSH-to-self refusal (`Permission denied (publickey,password)`, helper
exit 3). The two review outputs and assessment exist locally; no review call was
skipped and feature verification does not depend on corpus publication.

## Recovered validation failures

- The first clean gate was deliberately stopped after the verifier found the
  RPC disclosure/lifetime defects. It is not counted as a passed gate.
- A new secret-marker regression initially used an invalid environment prefix
  before a shell compound loop. The fixture now uses a valid export; its held
  fake-provider response is released before httptest shutdown, so an assertion
  cannot hang cleanup. The real pinned-Pi regression then passed.
- The distinct-UID script exposed an old contradictory test: its explicit
  positive own-native-data probe returned its expected sentinel, then rejected
  that sentinel unconditionally. The test now requires it on that positive
  probe and forbids it on login replies. All three isolation cases pass.
- The browser child's independently reproduced baseline archive-expiry failure
  was a clock fixture issue. The clock is now installed before toast creation
  and advanced through callbacks, rather than jumping over React's timer
  cleanup/rescheduling. The eight-unpaused-second and archive-state assertions
  remain; the isolated process-tray + expiry run passes 3/3.
- A long build TMPDIR made old gateway Unix socket fixtures exceed the kernel
  path limit. Repeating with the short, disk-backed `TMPDIR=/var/tmp` passes.

## Integration after parallel workspace delivery

Rebased onto `18d3b2dc` without discarding its workspace Git surface. Conflicts
were the generated fingerprints, fixture registration and browser assertions:
regenerated from both schema families, retained all fixture registrations, and
kept both warm-controller protection and independent workspace-card recap checks.

The first completed integrated gate passed all Go/contracts/Storybook checks but
failed two browser cases: a route.fetch still in flight during my new journey's
teardown, and a model-radio choice reset. The route fixtures now drain before
page teardown. A second gate passed 178 browser cases but exposed the same model
initialization race as a third catalog read on warm return. The selector's
catalog read is now mount-scoped; late native observations initialize only an
untouched form, never overwrite explicit model/thinking intent. Two regressions
pass on the fix and fail on the previous implementation. The focused process +
model + warm-return browser run passes 5/5; the original <=2 catalog-read bound
and all no-replay/no-default-write assertions remain.

The native snapshot also carries its validated pending question, not just the
active-run bit, so home/sidebar preserve question priority. A native snapshot
regression and the browser home transition check this. Initial-wake delivery
ends when the first assistant message starts streaming; a second completion
during that stream is steering, not another wake.

### Model-control rebase

While the gate repairs were being checked, `main` advanced to `70874983` with
the parallel model-control delivery. Its `a88562fc` / `81b541ff` work already
preserves staged choices and provides identity-scoped shared model reads. The
redundant local `887bdae7` selector implementation/tests were dropped during the
complex rebase in favour of that broader implementation and its regression
coverage; no process feature was dropped.

Kept the native `get_state` admission/readiness check, combined the companion
watch with it, and preserved active-run state if Pi has already started work.
The composer's first-message choice now remains the main-branch native-choice
flow, with the process tray and run-aware controls layered around it. Generated
metadata and fixture registration include both Pi message and process families.
Both model-selection source files are identical to the accepted main versions.

## Final verification and release

`46f170db` and the following test-only changes retain the repaired product code:
full affected Go packages with `-race` passed, companion tests passed, and all
fast web checks passed (`/var/tmp/oh-process-final-focused.log`). The final clean
gate and selected live product/runtime receipts are recorded at completion.

### Final integrated checks and test-release handoff

At `4e8a8d09` the clean command passed 133 fast web tests, all 181 regular
browser cases (two opt-in cases skipped), Go/contracts and Storybook. The first
lab run exposed obsolete XML-only / identity-free fixtures and an actual recap
padding regression caused by the inserted tray. Fixtures now use structured
native details and `toolcall_start`; the CSS retains recap-owned spacing around
the tray. Typed streaming and process completion passed the focused rerun.

The next full command still failed in the parallel lab phase, on an automatic
recap timeout and Chromium response-body retrieval for title regeneration.
These are not counted as a green command; the full lab suite is being checked
serially in `/var/tmp/oh-process-lab-serial.log`. Both failed commands retain
Go/contracts/Storybook and regular-browser results in
`/var/tmp/oh-process-clean-gate-{integrated,lab-repaired}.log`.

All remaining packaging/final-check commands passed separately: 2,500-entry
native fixture, byte-identical repeated archives, archive verification,
packaged socket smoke, relocated verification, tamper rejection, issue doctor
and clean-tree checks (`/var/tmp/oh-process-packaging.log`). No passed clean-gate
receipt is invented. The disposable test release may use the authorized
`--ungated` path; product release is required before the guest runtime switch.
