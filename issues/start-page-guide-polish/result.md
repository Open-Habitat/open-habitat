# Start-page guide polish

All five points implemented. The hint uses `/open-habitat-start-page`;
leading installed-skill aliases resolve to Pi's native `/skill:<name>` on send,
including queued messages and creating/worktree conversations. Exact native
command names win collisions. Failed lookup sends nothing; editing or changing
the send context cancels it. Accepted receipts still clear the draft.

Both Aloita buttons align left, the upper one below the title. The bottom
explanation is removed. Starting keeps the guide selected, preserves existing
draft text, adds exactly two final newlines and focuses the end caret. Authored
skill references are checked against Pi before insertion; failed checks leave
the draft unchanged for an explicit retry. No-skill goals insert immediately.

## Timing

Previously Pi's command-list helper completed **before** the file was read.
The new file-only `/api/v1/workspaces/start_page?workspace_id=…` reads the
confined, owner-checked, bounded file without Pi or helper slots. An unavailable
workspace returns 404, not a retained `needs_update` result. Its admitted fd is
passed into the file reader without a second workspace lookup. Unverified skill
references remain authored data, not proof of installation. No cache was added;
the short wait retains the layout without a loading sentence.

Three-sample median HTTP timings, milliseconds, on the same synthetic host:

| View | Before: combined commands/page | After: file-only |
| --- | ---: | ---: |
| 1440 light | 7.89 | 3.78 |
| 1440 dark | 7.73 | 3.33 |
| 390 light | 8.68 | 3.44 |
| 390 dark | 17.80 | 3.29 |

HTTP comparisons use cheap fake Pi. Separately, pinned **Pi 1.3.0** helper
startup/RPC/teardown took **205.58 ms**; daemon file read/parse/JSON took
**0.175 ms**. The old path paid that helper cost; the new one does not.
Initial synthetic snapshots took 13.8–21.6 ms, later snapshots 5.7–14.1 ms;
initial browser file responses took 1.7–4.5 ms. [timings.json](timings.json)
contains raw observations. **Not a live-server before/after latency claim.**

## Validation and review

Base `47796e7f` plus this implementation. Installed both web and pinned Pi
fixture lockfiles. All affected checks were repeated after the review fixes:

- Focused web: format/lint/types, **91 files / 510 tests** passed.
- Focused browser `start-here.spec.ts`: **4 passed**, 1440/390 × light/dark:
  axe, left alignment, both actions staying on the guide, drafts/end caret,
  typing, no unintended send, executable hint commands, canonical short-skill
  send/accepted-draft clearing and the creating→held→send worktree journey.
- `thread-fill.spec.ts`: **1 passed**; `native-history.spec.ts`: **11 passed**.
  Browser suites ran sequentially through Fleetrepo's Cedar guest warm runner,
  never locally on Alder. Same-UID synthetic evidence, not user isolation.
- Storybook production catalogue built, including pending skill preparation.
- `GOMAXPROCS=2 go test -p 1 -count=1 -v ./internal/daemon ./internal/gateway
  ./test/browser-host`: all passed with umask 077 and `/var/tmp` scratch.
  Distinct-UID/container-only tests skip on this developer run; no installed-host
  or isolation acceptance claim. Focused native/file timing tests passed too.
- Focused contracts: generated fingerprints clean; **63 schemas / 70 fixtures /
  40 scenarios** valid, including the new reply fixture.
- Project-view, issue doctor and whitespace checks passed. Doctor retains
  unrelated pre-existing image advisories. No full gate or deployment claim.

One targeted reviewer (`claude-fable-5-1`) found two confirmed integration gaps:
creating/worktree composers lacked alias sources, and failed workspace discovery
could be retained as a successful update hint. Both fixed and covered by the
creating→held→send browser journey and unknown-workspace Go HTTP case. No second
reviewer or speculative issue. Final diff self-reviewed against the brief.

[evidence/](evidence/) has eight AVIF/static-HTML pairs: guide and update hint,
both widths/themes, synthetic lab only. Inspected desktop/light and phone/dark
guides and phone/light update hint. Compared with the round-2 prototype source
at `design-system/prototypes/rounds/2026-10-22-aloitussivu-2`: same token-based
column, continuous sections, typography and bounded disclosure. This brief
intentionally changes action placement/copy. On phone the bottom action is
scroll-reachable; the top one stays near the title. Real production shell and
composer retained; no personal/live content captured.

## Recovered failures

No incomplete check is counted as passing; detailed logs remain in `/var/tmp`.

- Exploratory scoped lookups guessed nonexistent hooks/actions/tests/schema,
  Fleetrepo and local browser-result paths. Located actual files and retrieved
  captures from the warm runner's pinned transport; no infrastructure changed.
- Intermediate Biome rejected cancellation-only dependencies and non-null box
  assertions; documented intent and used explicit missing-box failures.
- First web run: two JSX inputs contained literal backslash-newlines; changed
  them to JavaScript strings. All 510 tests pass.
- First Go run: a test decoded an unexported embedded pointer; decode the wire
  page instead. Reran all packages and the previously blocked contracts step.
- Reviewer invocation rejected unsupported `--prompt`; retried via stdin and
  completed the same single review.
- Extended browser assertion used `.text` rather than contract `.message`;
  corrected and all four cases pass.
- Post-review Go run hit unrelated `TestAgentConversationControls` archive
  refusal `409 control_uncertain` after title/recap operations. That case never
  reads a start page. It passed ten repetitions; reran all affected packages
  and contracts without weakening the archive proof. Exact race cause unproven.
- Tracker refuses `fixed` for an `improvement`; retained the original type and
  closed with its supported completion status **done**.

Logs: `/var/tmp/polish-{web,browser}-reviewed.log`,
`/var/tmp/polish-{go,contracts}-verified.log`,
`/var/tmp/polish-{thread-fill,native-history,storybook}-reviewed.log`,
`/var/tmp/polish-{browser-timing,timing-go,archive-repeat,review-final}.log`.
