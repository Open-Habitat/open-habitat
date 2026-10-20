---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: shell
lane_seq: 1
collision: [web/src/components/terminal]
closed: 2026-10-20
---

# Pääte still opens an empty panel with another open button; floating pill covers the terminal; tmux error opens the panel

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247): pressing Pääte opens the panel showing another 'Avaa pääte' button instead of the terminal immediately (browser-shell-polish was meant to fix this; check whether the fix is in this path, e.g. first open vs reopen, or a different entry point). When the terminal is open, the floating 'latest/viimeisin' jump pill sits on top of the terminal window. Once 'Palvelin ei voi avata päätettä: tmux puuttuu tai ei käynnistynyt' appeared at the bottom of the panel: the panel should not open just to show an error; errors need the product's natural notice place, and find why tmux failed to start (server log around the event). Shortcut: Jari proposed Ctrl+T/⌘T, but browsers reserve them for a new tab and pages cannot take them; use Ctrl+Alt+T (Mac ⌃⌥T), consistent with Ctrl+Alt+K for the editor, keep Ctrl+Shift+Enter as an alias. Done: browser tests for direct open, pill placement, error placement.

## Comments

### 2026-10-20T12:03:40Z · @conductor

Server evidence (Fleetrepo infra/open-habitat-test/evidence/terminal-tmux-20261020.md): maintainer daemon logged shell create_failed at 08:12:06, 08:24:17, 08:24:20, 08:39:07 UTC 2026-10-20, ~8 min after a release restart, not during it. tmux 3.4 present, PATH resolves /usr/local/bin/tmux, user tmux service active, socket 0600 under 0700 dirs. Failure is at new-session creation; the daemon does not log tmux's stderr, so the cause is unproved — log it.

## Result

Preserved UI commits 7a39de8e and e282b982 were cherry-picked onto current main
(3a6cf29c and 71cf151b); the earlier lab-script formatting fix was already on
main. Opening is explicit per view; startup refusals use the existing notice;
Ctrl+Alt+T / ⌃⌥T opens/focuses the terminal (Ctrl+Shift+Enter remains an alias).
Floating history actions account for the dock and hide when it covers history.
The earlier focused UI self-review remains applicable.

The baseline ARM failures have a source-grounded product explanation, not a
reason to skip tests: tmux 3.4's `cmdq_print_data` calls
`server_client_print(..., 0, ...)`, which passes output through `utf8_stravisx`
and renders the unit separator as literal `\037`. tmux 3.6 calls it with
`parse=1`, preserving the raw separator. The inventory parser previously
accepted only the latter, hiding existing sessions and choosing an already
occupied shell number on the next open. Both encodings are now accepted for
shell and Taskfleet inventories; malformed rows still fail validation. Upstream
sources checked: tmux tags 3.4/3.6, `cmd-queue.c`, `server-client.c`, `utf8.c`.
Runner-native diagnostic reproduction and final checks are pending below.

Failed `new-session` commands now collect bounded stderr and emit
`terminal_create` / `create_failed` with `tmux_stderr` and
`stderr_truncated`. The stderr field preserves only known fixed messages,
fixed prefixes and known errno text, redacting paths/session names; unfamiliar
native text is explicitly redacted. This follows the service diagnostic privacy
rule rather than sending raw user configuration/commands to the journal. It
will distinguish duplicate sessions, fork/window creation and socket errors.
The original live-server failure is not proven without a post-fix journal;
this worker did not access the server and establishes no installation change.

Lab screenshot/HTML captures are deferred under Alder policy, without a human
input request. No isolation claim is made from same-UID browser/package tests.
No tests are skipped or weakened by this work.

Runner-native diagnosis confirmed the source explanation: ARM job
`1ab5edd604b40ccd3ec4e904822187de5edb6d4bb5204c789851e809c01c55e1`
(snapshot `9c413c123dc9814a32347f5f0dc3877d7d08b70a3b3816b86f99ba216b6f5104`,
pre-fix daemon with temporary test-only logging) reports **tmux 3.4** and a
successful native list command on the exact fixture socket returning
`demo_repo-GXahVL-1\037bash\037bash`. The old parser returns an empty shell
inventory from that output. Thus this is a product parser defect, not a socket,
workspace-base or unavailable-tmux runner prerequisite. The diagnostic run
correctly failed the baseline terminal assertions; its instrumentation was
removed before final checks. Raw evidence is retained under
`/var/tmp/oh-browser-kuhqve_l/033-logs.json` on Alder. No native output from
personal homes was read.

Final browser-source fast checks passed: `umask 077; TMPDIR=/var/tmp
./scripts/test-focused.sh --area web`, ARM job
`b79a369e53f9457cadeee99d5d9d3826d6ec87ca42e16b1e2b7dfe677200a451`
(snapshot `613417d51a13c839bb7f04e1adec47dfcc3d456c6b27bfe0e9ed470d8b1b1458`):
format/lint/typecheck, 268 unit tests and 196 component tests. Web source has
not changed since that capture; subsequent implementation edits are confined
to daemon inventory parsing/diagnostics and their tests.

Independent review expanded to the added daemon surface: finder
`claude-fable-5-1`, verifier `gpt-6-astra`, two calls. Two useful diagnostic gaps
were fixed (parenthesized errno preservation and the path-bearing no-server
message), and the verifier confirmed that every logging result is built from
fixed literals, never native text. A rare existing malformed-name allocation
edge was dropped under assessment rule 1b; no follow-up filed. Review/assessment
scratch: `history/review-shell-panel-open-direct.md` and
`history/assessment-shell-panel-open-direct.{json,md}` on Alder. No performance
corpus write was attempted because it would commit/push Fleetrepo, outside this
worker's authorization.

Contract checks passed: `umask 077; TMPDIR=/var/tmp
./scripts/test-focused.sh --area contracts`, ARM job
`aab65e783d071ae18aef3b2f8d44f9e9bde6661eab077f5a96f82e111765cfcb`
(snapshot `abd856a2128f94222605e69b4f70c7b73d4e12a68511dae2631190349c196206`).
No contract/generated source changed in this task.

The complete affected Playwright spec passed on ARM: `umask 077;
TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec
browser-shell.spec.ts`, job
`7e5fd052799faf5b7ce5c7ee6c4062446291384346322e6a623d870e1b63bf65`
(snapshot `2865c74a07586a368cee340c9870d9024b67cd03c1d0ebef8c1835b4e7fc3c59`), covering direct opening,
shortcut/focus behavior, persistent shells, Taskfleet read-only viewing,
startup notice placement and floating-action layout. Exact snapshot is recorded
in the runner receipt outside source.

Daemon final attempt 2 (`d4024077e40b67cfdad51924bd7f7a8cea6cb7a025822087f41a524e7dae6bc6`,
snapshot `2073b831819381adc16ddc324c37a67e147d4dfebd09688b1d5f2b166317ff64`)
passed the four inventory-dependent cases but still failed
`TestTerminalLingeringStartsServerAsUserService`: new-session timed out at four
seconds, with empty stderr. This last failure has a different cause: the test's
fake D-Bus socket listened without accepting/responding. Upstream tmux 3.4
`spawn.c` calls `systemd_move_pid_to_new_cgroup` when compiled with
`HAVE_SYSTEMD && ENABLE_CGROUPS`; `compat/systemd.c` uses `sd_bus_default_user`
and synchronous bus calls. The fake socket stalled bus authentication before
pane setup could finish. The fixture now accepts/closes connections promptly;
it still tests the same linger detection, exact systemd-run arguments and live
shell inventory, and still does not claim real systemd evidence. No version
skip, deadline relaxation or assertion removal. Product code is unchanged by
this test-only correction; the independently reviewed product is 704380db.
Daemon attempt 3 runs the complete package again.

Final daemon package passed: `umask 077; TMPDIR=/var/tmp
./scripts/test-focused.sh --area go --go-package ./internal/daemon`, ARM job
`6b0e1f52be611c699e70d1e17d97e181a75fbd28e30b2dc7eb4a5cab7fe4b48e`
(snapshot `776c6edb92924967b8690044d3129c8a6036e42fe61ef6aef7e7dedebffed3e0`).
This runs vet and race-enabled tests for the complete daemon package after
installing the pinned Pi SDK fixture. It covers product code 704380db and the
fixture correction 2a74716a. All five previously failing terminal cases now
pass without skips/adaptations to their assertions. Browser result: **8 passed**.
`python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
`git diff --check` also passed. Full clean gate and packaging were not run:
this focused change alters no shared auth/contracts/build/packaging input.
Distinct-UID/live-provider/live-systemd evidence is not claimed.

Failure inventory: the pre-fix diagnostic daemon run reproduced five baseline
failures; final daemon attempt 2 exposed the separate fake-bus timeout, corrected
and superseded by the passing complete-package attempt 3. Superseded queued
Go/browser attempt-1 jobs `019f9f1774baff1b64c65a73503e3d9bdff686c2fc7e8be91006ff223c961bbb`
and `e23083104e5d2850195edfcff62d114ff137b47b20df5af87c545c2a3bd1138f`
were explicitly cancelled before final diagnostic corrections and replaced by
new final captures, not treated as passing or ambiguous retries. The finder
reported an optional queued build/test attempt with no result; it was not used
as evidence, and the complete required package check above independently passed.
Exploratory missing-path/source lookups, no-match greps and one unsupported
`tail -12` invocation returned nonzero, were corrected with scoped file/JSON
inspection, and affected no deliverable. Cherry-pick conflicts in issue notes
were resolved by retaining the newer server evidence and recording this result.
No required step remains failing or incomplete. Lab captures remain deferred
by policy. All worker-managed processes have exited. No push, test-server
access, Fleetrepo edit or persistent tool installation was performed.

## Acceptance Criteria

- [x] Explicit terminal opening and Nordic-keyboard focus shortcut pass browser checks.
- [x] Startup refusals use notices, and floating history controls do not cover the dock.
- [x] tmux 3.4 inventory failures are fixed; all five daemon cases pass, with safe creation stderr diagnostics.
