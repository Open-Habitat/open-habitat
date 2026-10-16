# Result

Implemented the chosen failure corner (Syy kulmassa), bottom archive undo offer
(Hetki alhaalla), and centred latest pill (Kertova). Jari's later addition is
included: unseen native replies are counted, e.g. `● Uusi vastaus (2)`; tool
results and older history pages do not increase that count.

The daemon projects only explicitly failed bash results and recognizes the
three agreed terminal status formats. Native history is never rewritten. The
browser hides the exact recognized terminal line and retains it in the corner
tooltip. Unknown statuses, including other Pi versions and fractional timeouts,
keep their output and generic failure. The hint has no process/control authority.

The undo offer lives for eight unpaused seconds, pauses for pointer, keyboard
focus and restore requests/errors, dismisses with Escape/×, and returns to the
original route after successful restore. Restore waits for a fresh archived
observation rather than sending the old active token. Focus after archive goes
to the workspace heading; jumping to latest focuses the conversation region.

## Evidence

Synthetic lab at `OH_PORT_BASE=27700`: `failed-*`, `archive-*` and `latest-*`
are adjacent screenshot/static-HTML pairs, desktop 1440 and phone 390, both
themes. Capture script: `web/lab/capture-conversation-details.mjs`.

Deliberate differences from the rounds: real native synthetic conversation
content replaces the hand-authored Python example; the existing host output
viewer and shared button components remain. The prototype's first-load teaching
toast is omitted: it would appear on every conversation without a defined
once-only scope, while the actual action is exposed when useful. No persistent
browser teaching state was introduced. The failure count uses the actual tool
results, not fixture totals.

Validation:
- `go test ./internal/daemon ./internal/contracts`: passed after installing the
  pinned synthetic Pi fixture dependencies (initial run lacked them).
- `scripts/check-generated.sh`: passed.
- Fast web static/unit/component checks: passed; final checks recorded below.
- Focused browser cases cover failed corner/summary/output removal, archive
  expiry/pointer and focus pause/undo, layout-driven latest visibility, working
  state, unread count and keyboard return. The synthetic turn emits two text
  messages (commentary and final reply), hence its expected unread count is 2.
- Targeted `/llm-review` of the daemon/contract: no confirmed defects after local
  assessment. Added an oversized live-result regression from its test suggestion.
  Additional Pi termination wording was outside the agreed formats and retains
  the explicit fallback. Model-performance recording was attempted but SSH to
  alder rejected the key; no corpus entry was written.

The two requested per-issue merges cannot use `/worktree-merge` twice: its first
success terminalizes this exact run and removes this worktree. Feature delivery
therefore uses guarded, non-terminal fast-forwards into clean main, with the
terminal Taskfleet merge reserved for the final evidence/closure update. The
conversation feature was merged and pushed first, before the workspace feature.
No other agent's uncommitted main-worktree files are changed.

Full clean gate on `fa308a72`: Go/contracts, Storybook, documentation and static
checks passed; browser suite had 170 passes, 2 intentional skips and 2 timeout
failures (archive restore observation and host-outage reconnect). Both failed
cases passed together in isolation (one worker, 9 seconds) with no code change.
Per the worker brief, these isolated transient failures do not block landing.
This is not a clean-gate pass or receipt. Focused browser suite: 5/5 passed;
fast web checks passed. The first deployment is recorded below. Live checks
are listed in KOKEILTAVAA.md; no live-user screenshots were captured.


## First deployment

The conversation feature first landed on pushed main at
`05775a7fe8e715685fa9c8f202aa296939dfbd74` and was deployed by the standing release
watcher as **0.0.0-pilot.140**. The operator receipt is `verified`, `ungated`,
`within_limit` in 43.15 s. Archive SHA-256:
`dc72a1595991b4f9d9861117dd02fe4ef87e0e041617a07a601a559896177856`.
Public `/healthz` and `/` both returned HTTP 200 without an authenticated session.
This is release/route evidence, not a claim that real provider use or browser
sign-in was tested. Later workspace integration retains this feature and fixes
its query-only archive focus timing; final combined validation is recorded with
@implement-workspace-page.


## Final combined validation

The later workspace integration passed the complete clean gate on `d8a7d74c`,
tree `7929411c7af6aa12b07869287f509f405264db0a`: 133 app tests, 126 component
tests, 176 normal browser cases (two intentional visual skips), all 31 lab cases,
Go/race/contracts/docs/Storybook and packaging. No phase was reused. Its matching
workspace deployment **pilot.147** was verified in 41.408 s and retains these
conversation details, including the query-only archive focus repair and unseen
count during work. Exact receipt and limits are in @implement-workspace-page.
