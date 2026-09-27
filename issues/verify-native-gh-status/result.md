# Result: native GitHub status verification

The daemon snapshot now checks native `gh` under its mapped Unix UID using the same adapter as credential handoff. It reports `connected` only after fresh, bounded `gh auth status`, numeric API identity match, Git HTTPS helper check, credential fill and protected storage attestation. A verified wrong numeric account or gh's exact no-known-hosts diagnostic yields `disconnected`; a broken/unknown auth check stays `unknown`, and a verified identity with incomplete native Git setup is `partial`. Snapshot auth validation happens before the check. Child diagnostics, tokens, and paths are never returned to the gateway or browser. Concurrent requests share only an in-flight result, not a persistent cache; cancellation by one requester does not cancel another's verification.

## Evidence

- `go test -race -count=1 ./internal/nativegh ./internal/daemon ./internal/cli` — passed (nativegh 4.081s; daemon 3.427s; cli 10.212s). Synthetic runners and disposable homes cover matching/wrong/malformed numeric identity, explicit absence vs arbitrary CLI failure, timeout before and after identity, incomplete setup, storage isolation by home, response schema and trust-before-status. The existing executor tests exercise bounded output/process timeout.
- `./scripts/ci-local.sh --clean --json` — exit 0, final JSON `{"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}`. Includes Go race tests, generated checks, frontend and package checks. CI emitted nonfatal Vite chunk-size and synthetic TLS-test handshake warnings.
- Independent identity/credential review: claude-fable-5-1 finder and gpt-6-astra verifier; deadline, adapter sharing, cancellation semantics and cross-home assertions were corrected. Review notes in ignored `history/review-native-gh-status.md`. Exact no-hosts diagnostic was checked against `gh 2.46.0` with a disposable HOME/config directory and no real credentials; all other nonzero exits fail closed to `unknown`.

## Limits

No live host, actual multi-UID test account, real GitHub credential, keyring or deployment check was used. A different `gh` diagnostic/version/locale remains `unknown` rather than claiming disconnection. The frontend onboarding and settings UI belongs to the separate worker; no UI/shared docs were changed. Model-performance corpus logging was attempted but SSH to `alder` returned `Permission denied (publickey,password)`; review itself completed.
