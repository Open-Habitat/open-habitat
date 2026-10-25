---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5e8vxwacyv7zek57natgew3/observed:terminal-ready-steals-tab-focus
originating_run: 01m5e8vxwacyv7zek57natgew3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Terminal reattachment steals keyboard focus from shell tabs

## Description

## Description

Switching terminal tabs with Left/Right can move focus from the selected tab into the terminal after the connection becomes ready. This breaks continued keyboard tab navigation and leaves the ordinary browser suite intermittently red.

Observed on Cedar's warm 12-worker runner on 2026-10-21 in the second full ordinary suite of Taskfleet run 01m5e8vxwacyv7zek57natgew3 (source base 1e9991b8 plus the browser-suite-red repair; see that issue's result). `web/tests/browser-shell.spec.ts:90`, "tabs, Ctrl+Shift+Enter and hiding keep shells running in tmux", failed at line 113: the busy sleep tab was aria-selected=true but remained unfocused for the five-second assertion deadline. This same spec passed focused (9/9), so connection scheduling matters.

Cause: `web/src/components/TerminalPanel.tsx` onTabKey selects the next tab and schedules focusTab(next.key). That selection reconnects the single terminal socket in `web/src/app/BrowserShell.tsx:355`. Its ready callback at approximately line 248 unconditionally schedules focusTerminal(), racing and overriding tab focus. The test now waits for actual focus between arrow presses, exposing rather than bypassing this race.

## Reproduction

1. Sign into a synthetic host and open a workspace terminal.
2. Run `sleep 300`; create another idle shell.
3. Press Ctrl+Shift+Enter to focus its tab, then Left to select the busy shell.
4. When attachment readiness arrives after tab focus, keyboard focus moves into the terminal instead of remaining on the selected tab.
5. Run `cd web && npx playwright test browser-shell.spec.ts --trace on` to exercise the journey; a full 12-worker run reproduced the race after a focused pass.

Synthetic trace inspection confirmed the selected-but-unfocused tab. Local evidence: `/var/tmp/browser-red-final.log`, `/var/tmp/browser-red-final-results/test-results/browser-shell--browser-she-fc04e-keep-shells-running-in-tmux-chromium/trace.zip`, and `/var/tmp/browser-red-shell-final-inspect.txt` on Alder. These paths supplement the self-contained diagnosis above and are not required to implement a fix.

## Expected behavior

Tab arrows retain focus on the selected tab even after its socket becomes ready. Opening a shell, explicitly entering a terminal, and restoring the hidden panel must still put focus into that terminal. Distinguish the intent to connect from the intent to focus; do not remove either assertion or add sleeps/timeouts.

## Acceptance Criteria

- [x] Attachment readiness does not steal focus from a shell tab selected with Left/Right.
- [x] The existing browser-shell journey passes under concurrent suite load, retaining opening, hiding/reattachment, busy-close and terminal-focus assertions.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
