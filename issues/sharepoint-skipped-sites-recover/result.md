# Result

The daemon now repairs old Microsoft library inventories at startup without another login or folder submission. It uses the existing rclone grant, retries fixed-ID Graph discovery, preserves every existing remote section and local path, and appends recovered libraries. When every previously offered root was syncing, the recovered roots receive their initial cloud-preferred union pass automatically. A narrowed selection is unchanged; recovered libraries are available through the existing folder list (not suggested), and a newly available SharePoint service uses the existing account service display.

No gateway, provision, identity or security authority changed. No web/contract change or new credential store.

## Decisions for later review

1. **Infer broad selection from all existing roots being ready.** There is no persisted “whole account” bit. Microsoft Folders exposes individual root IDs; ChooseFolders stores the choice through native bisync listings or mirror completion. All offered roots selected, including OneDrive when it was the only offered root, is treated as broad. Any unselected, interrupted or failed root prevents automatic widening. Alternative: never expand without asking, which would leave Aino doing the repair himself. A historical intent to select only OneDrive when nothing else was offered cannot be distinguished; this inference implements the requested behavior without inventing past evidence.
2. **Run at daemon startup, after app alignment and interrupted-pass recovery.** A background retry uses the existing relay exclusion, quota check, native lock observation and supervisor stop/wait. Removal cancels/waits through the existing resume lifecycle. Alternative: discovery in status reads would repeatedly block the UI and complicate long first-pass ownership. Network/429/5xx failures retry with exponential backoff; permanent auth/config errors end this daemon's attempt rather than interrupt healthy sync indefinitely.
3. **Repair an old inventory once, not automatically select future sites forever.** The native rclone config carries a fixed-discovery comment, plus `habitat_recovery_selected` on newly auto-selected roots until an explicit choice supersedes it. These are options beside the existing `habitat_grant`, not a separate registry. Pending selection survives a stop between publication and first pass. An explicit choice clears automatic selection before running any new first pass. Alternative: in-memory-only state loses the choice after an upgrade interruption; a parallel store would split native truth.
4. **A genuine 403/404 after fixed-ID discovery completes the repair attempt.** Such a site remains unavailable rather than causing endless sync interruptions. No access rights are expanded. A failed initial pass ends this daemon's automatic attempt; native interrupted-pass recovery handles restart, and critical bisync aborts remain stopped. Alternative: indefinitely retry every unavailable library, which the independent review showed could starve healthy sync.
5. **No file roots means no inferred selection or reusable rclone token.** Mail-only accounts with an empty rclone inventory are left alone; the repair does not extract Outlook credentials or ask for a new grant. The targeted OneDrive-connected case is covered. Live Contoso account state and provider permissions were not inspected or changed by this worker.

## Validation

Tested final working implementation based on `a213b5af89c7d21a9538e7d5eeba074925f6f75b` (the commit carrying this result records the exact tree), on Birch, Go under umask 077 and private `/var/tmp/oh-recover*` scratch.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`: passed, final run 33.953 s.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, final run 113.436 s.
- `go test -race ./internal/daemon/integrations -run 'TestMicrosoft(StartupRecovers|Recovery)' -count=1`: passed.
- `./scripts/test-focused.sh --area web`: passed static/types and 170 test files / 1267 tests. No browser spec or web code changed; no browser suite or full gate run.
- Both requested npm dependency installations completed. The first daemon test run failed only because Python `referencing` was absent; installed `requirements-ci.txt` into a disposable uv venv and reran successfully.
- Initial new tests exposed a discovery comment containing `=` being interpreted as an option before the first section. Changed the comment to `:` and reran successfully.
- One later integrations run hit the existing `TestWaitingAccountDoesNotBlockOthers` TempDir cleanup race (`.local: directory not empty`). The unchanged test and full integrations package passed on immediate rerun; no persistent product failure was established.
- Synthetic Graph tests first return the old site 404, then expose the library at daemon startup; verify broad vs narrow choice, existing folder suggestions, pending publication across a fresh entry/restart, explicit deselection, no repeat of healthy first passes, outage preservation/retry, permanent 401 and genuine 404 termination, 429/503 retry, and login/quota exclusion. A final self-review added a regression for dead native locks left by a stopped sync process: stale locks use the existing resume ownership/change proof, while expired locks remain rclone's own takeover.
- Real installed **rclone v1.71.2**, with only a synthetic local-backend scratch config, preserved both the discovery comment and pending option through `config update`. This proves native config serialization, not live OAuth/Graph acceptance.
- `git diff --check`, issue doctor and project-view validator passed before commit. Doctor retained the repository's existing image/binary advisories, with no schema or consistency findings.

## Review

Independent `/llm-review` finder **claude-fable-5-1**, verifier **gpt-6-astra**, followed by `/assess-findings`. One confirmed finding: permanent failures caused repeated supervisor stops. Fixed completion markers, exponential backoff and terminal-error handling; synthetic regression tests verify the resulting decisions. Verifier traced relay/removal/native exclusion without finding another defect. Final localized fixes were checked locally. No remaining confirmed finding or follow-up issue.

Local scratch reports: `history/review-sharepoint-recovery.md` and `history/assessment-sharepoint-recovery.{json,md}`. Model assessment logged via the canonical helper as `2026-11-06-llm-review-sharepoint-recovery` on Alder.

## Deployment check

Not deployed by this worker. After the next upgrade, verify the recovered libraries and sync state as operator without asking Aino to reconnect. The existing KOKEILTAVAA line now says that explicitly. Live Graph entitlement and the original Contoso 404 cause remain unverified; synthetic tests establish the recovery behavior, not that the tenant grants access.
