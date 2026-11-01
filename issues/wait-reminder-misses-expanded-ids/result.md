# Result

The turn-end reminder retains the static parser first, then reads the waking process's real argv and descendants. It pins proc directories, checks directory and file ownership against its own UID before reading, and caps traversal (64 processes, 128 threads, 100 ms), argv (32 KiB), and child lists (8 KiB). Only run IDs leave the reader; no argv is logged or stored. Incomplete observation is unknown and suppresses the reminder. A complete ordinary non-wait tree does not suppress it.

## Decisions for later review

- Choose silence for unknown coverage rather than another warning asking for literal IDs: the issue explicitly permits either, and silence avoids provoking another unnecessary wait. An unrelated unreadable waking tree can also suppress a reminder conservatively.
- If a command names Taskfleet but no wait child exists yet, retain unknown: shell expansion may still be running. A complete wrapper tree that does not name Taskfleet and has not yet launched a wait cannot be identified as a future wait.
- Keep the existing twenty-ID grammar for live argv too. Unsupported options or larger waits remain unknown, not falsely uncovered. No new parser or native state store.

## Verification

Based on 3858d4b16f3626262f8496a16a95c1d15222d24a plus this issue's diff, on Birch, umask 077, scratch under /var/tmp/oh-wait-reminder.G6rTqW.

- Installed locked web and Pi fixture dependencies with npm ci.
- `node --test internal/daemon/pi-device-test/wait-reminder.test.mjs internal/daemon/pi-device-test/process-extension.test.mjs`: 8 passed. Real shell expansion from active.txt into a compiled synthetic native wait; partial ID coverage; oversized/malformed argv; unknown and non-wait behavior; mismatched expected UID; static parser and settlement hooks.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed (176 s). First attempt failed because Python referencing was absent; installed requirements-ci.txt into a disposable uv venv and reran successfully.
- `./scripts/test-focused.sh --area web`: check and typecheck passed. Unit/component suite had unrelated 5-second timeouts: first SpinoffConversation and GitLabConnection (1183/1185 passed); retry only SpinoffConversation (1184/1185); maxWorkers=2 also only that test. Both files passed together with maxWorkers=1 (8 tests); the SpinoffConversation file also passed independently on main, with no diff in the touched test/component. No whole-web pass claimed and no issue filed for a main failure that did not reproduce. No web code changed.
- No browser specs or contracts changed; no browser suite/full clean gate run.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.
- Independent llm-review: claude-fable-5-1 finder and gpt-6-astra verifier, two calls. Assessment: one confirmed non-wait suppression regression fixed (including the verifier's static-string case); compiler-prerequisite concern dropped because native gate already requires cgo/compiler. No unresolved actionable findings. Local review/assessment artifacts are in history/review-wait-expanded.md and history/assessment-wait-expanded.{json,md}.

The UID regression checks the ownership refusal with a mismatched expected UID, not distinct-kernel-UID or installed-host isolation. PID-reuse isolation was reviewed from pinned proc-handle semantics; no claim of a reproduced cross-UID reuse race. Live installation acceptance remains in KOKEILTAVAA.md.
