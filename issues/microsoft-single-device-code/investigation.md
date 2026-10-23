# Approval detection investigation — incomplete

Jari's correction is authoritative: the same displayed code was entered again after a completed approval. This investigation does **not** establish why that was necessary and does not close the issue.

## What the code establishes

- `microsoft.StartLogin` requests the first code directly from Entra. Neither rclone nor the MCP server issues it. rclone gets the resulting token only through its native configuration at commit.
- `Catalog.driveLogin` publishes that prompt and immediately calls `WaitWithPrompt` in the daemon's background worker. Polling does not wait for a browser GET, link click, paste, or additional code submission.
- The first token poll starts after Entra's `interval` (default five seconds; accepted range 1–30). `authorization_pending` continues; `slow_down` adds five seconds to subsequent intervals. Successful token acquisition then runs Graph identity/discovery.
- Only afterwards does `ms-365-mcp-server --login` start its separate MSAL device flow. Its output replaces the relay's prompt. The daemon passes no first-flow user/device code to that process. The two flows use the same configured public client but separate grants and native stores. There is no deliberate user-code reuse.
- The relay continues to show the first `device_code` state during Graph identity/discovery, even after its token has been acquired. That is a definite misleading intermediate state, but it is **not evidence** that it caused Jari's completed approval to be missed or that submitting the same code again released it.
- The browser polls active login states every 1.5 seconds and schedules another read on failure. Existing browser coverage simulates a replaced second code; it cannot establish what code was displayed live.

## Read-only live evidence

Only the test VM journal was queried, through Fleetrepo's pinned `release_test.ssh` helper. No VM or Fleetrepo state was changed. Values below exclude all tokens, codes, account addresses, tenant IDs and site names.

On 2026-10-23 UTC:

- 03:16:47.073: daemon POST `/api/v1/integrations/login`, HTTP 200, 567 ms.
- 03:22:33.508: `integration_discovery`, Microsoft, skipped, `site_unavailable`, `site_drives`, HTTP 404, `itemNotFound`.
- 03:23:28.569: daemon PUT `/api/v1/integrations/login`, HTTP 200, 1510 ms.

The skip diagnostic is emitted **after `WaitWithPrompt` returns**, including the Outlook login, not at the instant Graph returns the 404. It cannot timestamp the first approval. This journal has no successful device-token/prompt transitions or polling-response diagnostics. It therefore cannot identify which tool issued the displayed code, when the first approval reached Entra, whether a poll returned pending after that approval, or what Microsoft returned on the second entry. No such timeline is claimed.

## Synthetic characterization, not a fix regression

`TestMicrosoftFirstApprovalAfterPendingAndSlowDown` injects HTTP 400 `authorization_pending`, then HTTP 400 `slow_down`, then a successful first grant. It checks the added five-second wait, exactly one first-code issuance, no reuse of the first code for the Outlook prompt, and successful publication/readback of both native stores. It passes on the unchanged production implementation. The MCP process is the existing synthetic stand-in, **not real MSAL polling**.

This narrows the investigation: ordinary pending/slow-down/success handling does not reproduce the reported defect. A passing baseline test is not a repaired approval-detection bug.

## Single-code feasibility

Read the pinned `@softeria/ms-365-mcp-server` 0.170.1 npm source in disposable `/var/tmp/ms-device-source`, without installing it or changing the runtime. Its public CLI supports login, account selection/listing and verification, plus extra scopes, but has no refresh-token import/export command. `MS365_MCP_OAUTH_TOKEN` provides an access-token mode, not persistent refreshable native login. Its implementation uses MSAL and native encrypted storage.

This rules out a trivial supported CLI token handoff. It does **not** prove a single code impossible: a deliberate native-library adapter might be viable. No cache-format imitation, unreviewed internal-module bridge, second credential store, or assertion of impossibility was introduced.

## Remaining work

Obtain first/second-flow timing and allowlisted OAuth outcomes before choosing a detection fix; instrument successful authorization and prompt transitions without logging credentials if a new live attempt is needed. Distinguish provider-side completion from relay/browser presentation. Then implement the detection fix with a regression that fails before it, settle the supported single-code handoff (or justified two-step fallback), and implement the Finnish wording, Storybook/browser coverage and four-theme/width screenshot/HTML pairs. The existing three issues' result files need their current-live-flow wording updated as part of that delivery.

No production source, contract or UI was changed in this investigation. No screenshot, real-provider regression, single-code implementation, full browser/web/contracts validation or fixed disposition is claimed.

## Validation and workflow limits

With `umask 077` and disk-backed `TMPDIR=/var/tmp`:

- Targeted characterization: `go test -count=1 ./internal/daemon/integrations -run '^TestMicrosoftFirstApprovalAfterPendingAndSlowDown$'` passed (5.045 s).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations` passed (23.894 s).
- `issuectl doctor --json` completed; `git diff --check` passed.

An exploratory `rg` used the nonexistent optional glob `web/src/pages/*Integrat*` and exited 2 after its other searches produced output. The actual controller was found and read at `web/src/app/IntegrationsSettings.tsx`; no required input was skipped. No build, native tool install, server or VM mutation was attempted.

## Targeted diagnosis

One `claude-fable-5-1` consultation inspected the polling, relay, browser and pinned MCP paths. Raw output is local scratch at `/var/tmp/microsoft-detection-review.txt`. It confirmed the stale first-prompt window and proposed an authorization-accepted transition, explicit Outlook stage and reset of copied-code state. It found no evidence establishing a missed first grant.

Its suggestion that code alone excludes the same user-code string occurring in both grants is not established: those strings are issued by Microsoft, not by this implementation. Its two-code reading is therefore **not accepted as the explanation of Jari's corrected report**. The requested clarification about reading versus pasting and Microsoft's second completion page remains unavailable in this worker. No claim that Jari misread the code is made.

The consultant also reported a final-account-removal failure in four of five runs of `TestMicrosoftCatalogRelaysBothCodesAndSupervisesChoice`, reportedly on main as well. The consultation did not provide the failed assertions or raw test logs. This worker's own supported full integrations package run passed; that does not refute a possible flake. The consultant's failures are not counted as validation or filed as a new issue without reproducible evidence. No second reviewer was called. Model-corpus logging was not performed because this task prohibits Fleetrepo changes.
