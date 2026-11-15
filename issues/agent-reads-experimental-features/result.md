# Result

The agent can list this release's experimental features and change the person's
own switches. Settings and the agent read one bilingual release catalog; updates
use the browser's existing preference writer and preserve other settings.

```
open-habitat agent experimental list --json
open-habitat agent experimental update explain-mode --on --json
open-habitat agent experimental update explain-mode --off --json
```

The list is `data.result.features`: id, Finnish/English title and description,
landed, enabled. Unknown ids and identity-bearing inputs are refused. A stale id
in the preference file is preserved but not offered. Host context, agent skill,
help and the generated UI reference introduce the command.

## Decisions for later review

- **Own-person writes are authorized.** An agent changing the person's setting at
  their request follows `agent model`; browser confirmation would add no authority
  inside that same Unix user. No gateway, provisioning or cross-user authority was
  added, and the CLI has no account/socket selector.
- **Use `update`, not `set`.** The alternative was the brief's illustrative `set`.
  `update <id> --on|--off` matches the existing agent family and CLI canon without
  a synonym. Exactly one switch is required; dry-run refuses explicitly.
- **One shared catalog.** Move the existing bilingual card copy and release order
  into `internal/experimental/catalog.json`, embedded by Go and imported by the
  browser. This avoids a second translation/catalog list. Generated UI references
  include that source; the text checker checks its literal messages too.
- **Visible-page reads every five seconds.** Previously preferences refreshed only
  on mount/focus. A single provider-owned timer now reads the existing endpoint,
  pausing while hidden and coalescing reads with existing write/read fencing.
  An event-stream extension was unnecessary for this small file. Failed-write
  feedback pauses background reads until explicit reload or the existing focus
  reconciliation; uncertain writes are never replayed.
- **Do not build a generic settings API here.** The gaps below mix account choices,
  browser-local presentation and gateway-owned sessions. They need separate scope,
  not an expanded agent authority hidden in this command.

## Other settings: proposed next work, not implemented

| Setting shown in Settings | Agent readability now | Proposal |
|---|---|---|
| Model defaults / thinking | `agent model list` reads native Pi settings/catalog | No gap for these defaults. |
| Recap settings | `agent recap-settings show` | Already covered. |
| Interface language and desktop editor | Own daemon preference file is natively readable; no typed agent read command | Add a narrow own-account preference read covering these choices, with defaults and source. |
| GitHub workflow opt-in | Remembered in that same preference file; provider permission and remembered wish differ | Include the remembered opt-in in that proposed read, not as an invented grant. |
| Theme | Browser-local `nah:theme`, with system color preference resolving the effective theme | Do not pretend the daemon knows it. Browser observation would need an explicit device/session-scoped design; keep it separate from account settings. |
| Git author identity | Native `git config --global user.name/user.email` | Keep native Git as the read path. |
| Credentials, integrations, speech key | Existing `agent credential list`, `integration list`, `speech-key show` report permitted status, not raw secrets | Reuse those commands. |
| Public SSH/age keys and own-machine connections | Native files/tools are available in the person's UID; no corresponding general Settings inventory command | Consider a read-only inventory only if native inspection is insufficient. |
| Browser sessions, device sign-in and share addresses | Gateway-owned browser operations, deliberately absent from the agent listener | Not a generic preference gap; do not expose them through a settings command. |

Rail quiet sorting/workspace selection also live in the preference file, though
not in this Settings section; a later narrow preference read could include them.

## Verification

Tested the working change over base `6baee720e6d08008cd771468b1d7e21520890f4f`;
no deployment or real account was modified.

- `./scripts/test-focused.sh --area contracts`: 99 schemas, 159 fixtures,
  negative cases and generated contract fingerprints passed. The validator also
  checks every actual shared catalog entry against the reply schema.
- Focused Go runs for `./internal/daemon`, `./internal/cli` and
  `./internal/experimental`: passed (catalog package has no standalone tests;
  actual catalog validation is in contracts and daemon tests).
- `go test ./test/browser-host`: passed. The focused wrapper permits only
  internal package paths, so this test package was run directly.
- `./scripts/test-focused.sh --area web`: lint/typecheck and 218 files / 1,708
  unit/component tests passed. Poll tests cover visible changes, hidden reads,
  logout cleanup and failed-write feedback preservation.
- `OH_PORT_BASE=18100 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser
  --spec settings-experimental.spec.ts`: all four host-backed tests passed.
  The same named spec with `--repeat-each=3` passed all 12 executions. It changes
  preferences through the real own-UID agent transport and observes both on and
  off in the already open browser, without focus or reload. The existing card
  accessibility, browser writes, failed save and search cases also passed.
- `timeout 600 ./scripts/test-agent-uids.sh`: all three container suites passed,
  including foreign-user, gateway and root denial on the new route. These are
  actual distinct kernel UIDs in a disposable networkless container, not an
  installed systemd lifecycle or live-server acceptance.
- `python3 scripts/test-ui-reference.py`, project-view validation and
  `git diff --check`: passed. Unrelated pre-existing generated-reference drift was
  left out; only this feature's reference and catalog index entry are refreshed.
- Independent `/llm-review` (claude-fable-5-2 finder, gpt-6-astra verifier) and
  `/assess-findings`: four confirmed findings fixed (fixture import, listener
  address, disappearing write errors, refusal classification); one unmeasured
  performance claim dropped. No residual issues filed. Local review/assessment
  artifacts are under `history/`; this result contains the durable conclusions.

Development failures were corrected and rerun: CLI help test initially treated
its parsed object as a string; web import ordering and shared-catalog extraction
needed adjustment; the browser fixture needed its import and canonical socket
address. No final required check is blocked. Dependency audit warnings and
existing non-fatal lint/build notices were not dependency-update scope.

## Live check

After the conductor deploys the integrated release, leave Settings › Kokeelliset
ominaisuudet open. Ask the agent which features exist and which are on, then ask
it to turn Selitystila on and off. Confirm the same card changes within about five
seconds without reload, and the list agrees. The worker verified this journey in
the synthetic host only; it has not performed the live deployment/check.
