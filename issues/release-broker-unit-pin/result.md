# Result

The release verifier now accepts the reviewed person-removal broker unit without changing that unit or relaxing its directive inventory. It requires exactly the existing two ordered `ReadWritePaths` entries and exactly one `PrivateTmp=no`.

Re-signed archive regressions reject missing, extra, reset, duplicated, reordered and changed optional cleanup paths, and changed/duplicated `PrivateTmp`. Independent review also found a pre-existing policy-parser byte-normalization discrepancy; a canonical printable-ASCII/LF check and two re-signed regressions now prevent it.

## Verification

Base revision: `3a2bc4feeffcdce5ca8d4d11164b4f9d0920680c`, plus this commit's script changes. No systemd template or product executable source changed.

Passed under `umask 077`, bounded timeouts and the scratch lease:

- `npm ci --prefix web` and `npm run build --prefix web`.
- `bash scripts/package-release.sh --version 0.0.0.broker-pin --target linux-arm64 --web-dir web/dist --output <scratch>/native-package`.
- `bash scripts/verify-release.sh --archive <scratch>/native-package/open-habitat-0.0.0.broker-pin-linux-arm64.tar.gz --json`: verified, no warnings; SHA-256 `885c28a51de127ff2091bb7211c3694e178e83850998181c4f8fc096491114c6`.
- `bash scripts/test-package-socket.sh <same archive>`: full final suite passed, including new cases, existing inventories and executable checks.
- `./scripts/test-focused.sh --area go --go-package ./internal/provision`: passed, including unit-template tests.
- Shell syntax, `git diff --check`, `python3 scripts/validate-project-view.py` and `issuectl doctor --json`.

Used the explicitly permitted narrow package-build/verify route instead of `prepare-release.sh`: preparation requires a pushed tree, and this worker must not push. An initial cross-built amd64 package verified with the expected embedded-identity warning; the final native arm64 run above removes that qualification. An optional attempt to select the root Go package was refused by the focused runner's package allowlist; the relevant provisioning suite passed. An earlier archive regression run overlapped a script edit and stopped on shell syntax; the final unchanged-script run passed from start to finish.

No clean gate, browser suite, service activation, installed-host cleanup or external installation preflight was run. These are package-validation and Go-unit results, not live isolation evidence. No user-visible UI change needs a test-server checklist entry.

Evidence retained outside git at `/var/tmp/agent-keep/broker-unit-pin/`: build/test logs, final archive verification, review/assessment copies. Disposable archives are under the scratch path recorded there.

## Review and assessment

Critical `/llm-review`: finder `claude-fable-5-2`, independent verifier `gpt-6-astra`, two calls, because the release check enforces the root broker's reviewed privilege boundary. No pin defect found. One pre-existing parser finding was confirmed locally, assessed FIX (occasional, neutral readability, no architecture change), repaired and independently verified. No unresolved finding. Performance logging disabled to respect the no-push instruction.

## Alignment and operator handoff

Repository-wide searches covered `PrivateTmp`, `ReadWritePaths` and broker-unit references. `docs/operations.md` already requires host temporary-directory access and writable cron/mail/journal spools. The removal authority in `internal/AGENTS.md`, security policy, unit consumers/tests and the accepted ADR 0037 retrieved from history contain no stale directive pin. ADR 0037 was retired after implementation; it was not resurrected.

An external operator's unit preflight is not visible here. The conductor should check that it accepts this exact delta from the old broker unit:

```ini
ReadWritePaths=/etc /var/lib/open-habitat /home /run/open-habitat /opt/open-habitat
ReadWritePaths=/tmp /var/tmp -/var/spool/cron -/var/mail -/var/log/journal -/run/log/journal
PrivateTmp=no
```

The first path line is unchanged; the second is new and `PrivateTmp` changed from `yes` to `no`. Preserve the optional-path `-` markers and all other directives. This worker has not updated or verified the operator's installation.

## Decisions for later review

- Retain two additive path lines rather than merge them: they separate provisioning from cleanup, preserve the already-reviewed unit and keep its explanatory comment useful. Compare the ordered list exactly rather than accept a set or normalize values.
- Reject noncanonical bytes before parsing policy templates rather than emulate systemd's full parser. All shipped templates already use printable ASCII/LF; this keeps the release pin literal and closes the demonstrated parser disagreement without changing service authority.
