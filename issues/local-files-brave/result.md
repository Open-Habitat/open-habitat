# Result

Fixed the unsupported-folder advice: it describes missing capability under the current browser settings, offers manual attachments, and conditionally explains Brave's `brave://flags/#file-system-access-api` opt-in and browser restart. Existing `showDirectoryPicker` capability detection and grant behavior remain unchanged; there is no unreliable browser-brand sniffing.

## Evidence

Base revision: `20b0dda46a412af462ad37baac00df282666d4ab`; checks below cover the accompanying App.tsx and local-files.spec.ts diff.

- Before editing, `cd web && TMPDIR=/var/tmp npx playwright test tests/local-files.spec.ts`: 2 passed, 6.2s suite / 24s command. The host-backed missing-API case reproduces the state leading to the misleading fallback; wording was inspected in App.tsx, not asserted.
- After editing, same command: 2 passed, 4.2s suite / 153s routed command including queue/setup. Covers explicit grant, persisted handle, revocation, CSRF and both capability branches; axe passes for both. Synthetic Chromium with the picker unavailable models the reported Brave capability, not an actual Brave installation or flag toggle.
- `TMPDIR=/var/tmp ./scripts/test-web-fast.sh`: formatting, lint, typecheck and 471 tests / 81 files passed; tests took 22.67s.
- `python3 scripts/validate-project-view.py`, `git diff --check`, `issuectl doctor --json`: passed (doctor reports existing attachment advisories).

The first fast-web attempt stopped because this fresh worktree had no web dependencies. Installed with `TMPDIR=/var/tmp npm ci --prefix web` and reran successfully (combined install/check 28s). Logs: `/var/tmp/local-files-web-fast.log`, `/var/tmp/local-files-deps.log`, `/var/tmp/local-files-web-fast-retry.log`; browser logs: `/var/tmp/local-files-before.log`, `/var/tmp/local-files-after.log`.

Self-review: localized copy change plus capability-branch assertions, no wording assertions. No Go changes or full gate. Not deployed by this worker; live Brave behavior remains for the conductor's test-server release and manual confirmation, so no KOKEILTAVAA entry yet.
