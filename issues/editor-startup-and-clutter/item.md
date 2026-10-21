---
created: 2026-10-20
updated: 2026-10-21
type: improvement
reporter: jari
status: open
priority: normal
lane: editor
lane_seq: 3
collision: [internal/gateway/editor]
---

# Editor: slow start, Copilot chat, Restricted Mode and Welcome tab; Ctrl+Alt+K focus return

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247, screenshot): opening the editor took 15–30 s, not a few seconds. The workbench shows a lot of noise: a Chat/'Build with Agent' panel on the right (not needed: Pi is the agent), Restricted Mode banner and status-bar badge (workspace trust — the person's own workspace should be trusted), and a code-server Welcome tab (open empty instead). Ship these as code-server defaults the daemon applies per user without overwriting the person's own settings (e.g. security.workspace.trust.enabled=false, workbench.startupEditor=none, chat/copilot disabled, welcome off). Measure and reduce start time (where does it go: user service start, extension host, first load); show honest progress. Also Ctrl+Alt+K (⌘⌥K) moves focus to the composer, but going back does not return focus to the exact editor position where it was. Done: measured before/after start time, lab capture of a clean workbench, focus round-trip test.

## Acceptance Criteria

- [x] Add quiet native editor preferences without replacing existing values or JSONC comments.
- [x] Restore the focused editor control and its selection after the composer shortcut round trip.
- [x] Distinguish service startup from workbench loading and instrument their durations.
- [ ] Measure native code-server before/after startup and confirm the workbench is clean.

## Result

Implementation prepared in Taskfleet run `01m5cwbyzjrjmzs56b26fke1t1`, based on `3a2034d16a10ee1e8105ddba6474e279e516f285`.

The daemon fills only missing keys in code-server's native `User/settings.json`: workspace trust off, no startup editor, AI features off, secondary sidebar initially hidden. Existing values (including explicit false/null), comments and formatting remain intact. Invalid, oversized and symlinked settings files are left alone; defaults never prevent editor startup. These apply on the next cold editor start, not to an already-running service. The file-link extension activates immediately rather than waiting for `onStartupFinished`.

The bridge remembers the focused control, rather than just refocusing its containing window. The existing host-backed shortcut test now verifies selection offsets and that typing after returning replaces the selected text. The app distinguishes starting the service from loading its interface and no longer promises a few seconds. Fixed-name browser User Timing measures (`oh-editor-service-start`, `oh-editor-workbench-load`, `oh-editor-first-load`) and the daemon's `editor_start.duration_ms` provide stage observations, without user content. Frame load is not proof that the extension host has finished activating.

### Verification

Final runnable bytes were tested on the shared Linux ARM64 runner (dirty source based on the revision above; staged new Go files included):

- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area web`: passed, job `5a221f6e220603e18fbe9d745beb090420f752b1c5e7f48bc05537eae1fca9a3`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: all five passed, including accessibility, focus/selection round trip, and leftover-document identity separation; job `1dd0a97316eb3ddfe364c2d089e75830fe2da08bdc5c9c6678d9d0239e4068c3`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed (51.357 s), job `91cfe3898a36b0558507447c7232ce6e010c791155aebc71c783e81247696591`. The runner prepared the pinned Pi fixture.
- Same focused Go command for `./internal/gateway`: passed (8.988 s), job `f8698fcabcb46eb73ccdf1757e030552a954ee8fde7f1c4ad4b1e5f4dbf2753a`.
- `TMPDIR=/var/tmp ./scripts/test-focused.sh --area contracts`: passed, job `3d7441cd6298a428d1b982dc78de750f3e271f42fb210141cc39f7ea5decfc99`.
- `git diff --check`: passed. No full gate, deployment, or test-server access.

Focused self-review was proportionate: this changes native preferences, startup activation and frame focus/progress, not Unix-user routing, authentication, origin validation, broker authority or installation hardening. Reviewed JSONC string/comment/trailing-comma handling, idempotence, override preservation, file handling, and unchanged origin/source checks.

### Limits and failure inventory

Native startup improvement is **not established**. The baseline remains Jari's reported 15–30 seconds; there is no measured native after value. The browser suite uses a stand-in code-server and cannot verify Copilot/Welcome/Restricted Mode appearance or actual Monaco focus behavior. Native before/after measurements and clean-workbench captures remain outstanding. Local specialist/lab execution on Alder is prohibited; no live capture was taken and no server was touched. Consequently this issue remains open rather than presenting those acceptance criteria as verified.

The first remote browser attempt (`230e557a6480ab93060838d7bbfe53f3c152b47e9d187151d363d2a4d1d24280`) failed to compile because the two new Go files were untracked and omitted from capture. Staging them and rerunning passed. The initial web check also passed, but final web evidence above supersedes it. Exploratory upstream lookups included no-match/404 results and an incorrect process-skill path; the correct skill was subsequently read, and no unsuccessful lookup is used as evidence. An optional log-summary parser failed on a truncated/non-JSON log tail after extracting the host results; authoritative process exit status and retained runner responses establish success instead.

No Fleetrepo installation change is required. The conductor can deploy the prepared implementation, let the existing editor service restart/idle out to load its new extension, and then collect native stage timings and confirm the clean workbench before closing the issue.

## Comments

### 2026-10-20T16:11:10Z · @conductor

Landed by conductor salvage (926b0ed5). Remains open for the live check on the test server: before/after editor start time and a clean workbench (no Chat panel, no Restricted Mode, no Welcome tab).

### 2026-10-21T06:29:01Z · @jari

Jari 2026-10-21 on the test server: first load still takes a while; the editor opened correctly.
