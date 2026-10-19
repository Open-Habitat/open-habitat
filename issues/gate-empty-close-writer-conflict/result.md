# Empty-close load repair

## Cause and repair

A 150-repetition baseline (`go test -race ./internal/daemon -run '^TestCloseEmptyBrowserChild$' -count=150`) under eight-worker browser load reproduced four empty-mode failures. Temporary diagnostics in `closeEmpty` distinguished its two `writer_conflict` branches: all four were a pre-stop census result of `unknown`; none was lock reacquisition after stopping, and none observed a writer in the empty fixture. The separate `writer` mode consistently observed `writer_present`, as intended. Log: `/var/tmp/oh-harvest-close-baseline.log` (failed, 100 s package time). Diagnostic production edits were removed.

The test incorrectly required live host-wide `/proc` censuses to prove absence under unrelated same-UID process churn. Production correctly refuses uncertain ownership. An initial bounded pre-stop retry repair still failed once with post-stop `control_uncertain` (`/var/tmp/oh-harvest-close-fixed.log`, 31 s). Retrying that response is unsafe: the child is already stopped. That attempt was discarded, not weakened to accept a refusal as success.

The final fixture uses an isolated census directory containing symlinks to only its real child process directories. The existing scanner still inspects real kernel process details and must exclude the controller's own child, detect a real competing history descriptor, and refuse an unreadable synthetic process. `ConversationController` has a private unit-only census-root field; the unset production default remains `/proc`, and there is no configuration or browser input for the field. After reaping, the own-child symlink disappears and is handled by the scanner's existing exited-process rule. There are no close retries.

The only production-file change is the private unit census-root seam; security authority, writer admission and automatic retry behavior are unchanged. These checks use synthetic homes and same-UID child processes, not the live installation or distinct-UID isolation.

## Decisions for later review

Keep conservative native uncertainty rather than treating `unknown` as absence. Use a controller-local fixture census rather than live-host retries: the close operation contains a second, post-exit census that can also become unknown, so retrying is not a sound general test repair. The private seam keeps the real scanner and live fixture processes without making unrelated host process churn the test's subject.

## Focused self-review

The positive test still requires deletion and reaping. `writer`, `unknown`, `terminal` and `nonempty` modes require refusal without child exit and with the session/history retained. The new unknown fixture specifically proves fail-closed behavior. No global scanner function is replaced; production constructors leave the root unset. Independent review of the small production-file seam is recorded by this run.

## Validation

`go test -race ./internal/daemon -run '^TestCloseEmptyBrowserChild$' -count=150` passed (900 subcases, six modes per repetition; `/var/tmp/oh-harvest-close-isolated.log`). Go uses `umask 077` and a private short disk-backed TMPDIR. Additional loaded repetition, final package checks and the committed-tree gate are recorded by adopting run `01m59w27sr3kz2jsw4h3t63car` before landing.

Final isolated close under simultaneous eight-worker browser and restart-test load: 500/500 repetitions passed (3,000 subcases, `/var/tmp/oh-harvest-close-loaded-final.log`, 39.1 s package time). The normal browser empty-close journey also passed eight repetitions in the 40/40 final browser batch (`/var/tmp/oh-harvest-browser-final.log`).

`go test -race -count=1 ./internal/daemon ./internal/gateway ./internal/cli ./internal/transport` passed on the isolated-census implementation (`/var/tmp/oh-harvest-packages-final.log`; daemon 64.3 s). Independent `/llm-review` by `claude-fable-5-1` found no new actionable defect. Its pre-existing proof-strength observation about the `exec sleep` close child is already covered by `TestKnownControllerChildInSameWorkspaceDoesNotBlockOtherSession`, which uses Pi-looking argv and asserts unmanaged unknown versus controlled absence. The close test alone is not claimed to prove that distinction. Local review report: `history/review-harvest-gate-fixtures.md` (scratch); raw response `/var/tmp/oh-harvest-review.txt`. The reviewer initially used default umask and failed, then passed with the documented 077; its runs do not replace the host-agent proof above.
