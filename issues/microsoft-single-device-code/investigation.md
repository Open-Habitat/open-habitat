# Microsoft approval investigation

Jari's correction is authoritative: the SAME displayed code was entered again after a completed approval. No available live timeline establishes why that was necessary. The stale-prompt repair below is not proof that resubmission released the first grant.

## Findings and repair

- The daemon requests the first code directly from Entra; neither rclone nor the MCP CLI issues it. rclone receives its native token configuration only at commit.
- Polling starts in the daemon's worker, independent of browser polling, clicking the provider link or submitting anything else. `authorization_pending` continues; `slow_down` adds five seconds to later intervals.
- Before this repair the first code remained visible during Graph identity/discovery, AFTER token acquisition. The relay now replaces that prompt with code-free `completing/files_discovery` before its first Graph request. A daemon regression holds Graph discovery and checks the actual browser-facing relay has neither code nor provider link.
- Afterwards the MCP CLI starts a separate MSAL grant. Its replacement prompt is labelled `Vaihe 2/2: Outlook`, with its own code; the old copy-control instance is unmounted. The outer login/folder counter is hidden during Microsoft's grant substeps to avoid contradictory numbering. The final native success receipt retires that prompt before account verification.
- The browser's existing 1.5-second active-login polling remains the delivery mechanism; transient read failure schedules another read. Browser tests exercise a lost poll, code-free discovery, replaced Outlook prompt and completion. These are synthetic observations, not Microsoft's live behavior.

## Secret-free telemetry and its limit

`integration_login` records fixed flow/transition vocabulary and elapsed milliseconds. Files flow: code issuance, polling start, first pending response/backoff observations, pending/slow-down totals on token acquisition or approval timeout, and prompt retirement. Outlook: code issuance, delegated polling start, prompt replacement and final native success/timeout. File counts are actual responses; Outlook rows explicitly say `poll_counts_available=false` and OMIT the counters. They must not be read as zero. No user/device codes, tokens, addresses or native error output are logged; the pending/slow-down regression also checks redaction.

The pinned MCP CLI constructs its own MSAL request and does not expose individual polling responses. Therefore requirement 2 is **incomplete for Outlook polling counters**. The worker leaves the issue open and does not merge. New live evidence can distinguish files approval, Graph work and Outlook waiting, but cannot give a complete MSAL polling timeline yet.

## Preserved live evidence

Only the test VM journal was queried in the preceding investigation, through Fleetrepo's pinned `release_test.ssh` helper. No live VM/configuration was changed by either investigation. Values below exclude tokens, codes, account addresses, tenant IDs and site names.

On 2026-10-23 UTC:

- 03:16:47.073: daemon POST `/api/v1/integrations/login`, HTTP 200, 567 ms.
- 03:22:33.508: `integration_discovery`, skipped, `site_unavailable`, `site_drives`, HTTP 404, `itemNotFound`.
- 03:23:28.569: daemon PUT `/api/v1/integrations/login`, HTTP 200, 1510 ms.

The skipped-site diagnostic was emitted after `WaitWithPrompt` returned, including Outlook login, not when Graph returned 404. This journal cannot timestamp first approval, identify the displayed grant/code, establish reuse of a code string, or establish Microsoft's response after either entry.

## Native single-grant adapter: explicitly deferred, not impossible

Read npm package `@softeria/ms-365-mcp-server` **0.170.1** in `/var/tmp/ms-device-source/package`, and installed that exact pin only in disposable `/var/tmp/oh-ms-native-adapter-probe`. Its native `dist/token-cache-storage.js` exports `DefaultTokenCacheStorage`, `wrapCache` and `unwrapCache`; MSAL supplies documented `getTokenCache().serialize()/deserialize()`. An isolated EMPTY-cache probe round-tripped that serialization through the native encrypted file store and checked file mode 0600. No cache-format imitation or second credential store is needed for that boundary.

This is NOT a grant/account/refresh test. The MCP pin permits `@azure/msal-node ^5.2.2`; the probe resolved **5.6.0**. The product currently configures native executable paths, not an interpreter/module closure. A production adapter cannot safely be qualified by guessing a developer/global npm path or by inventing account/refresh records around the current raw OAuth response. It needs a resolved/locked library closure plus a synthetic union-grant→native-persist→reload→silent-refresh test, including personal/work account identity, mismatch, cancellation and replacement failures. That adapter/qualification is deferred to @very-quizzical-dock (filed unlaned through intake from this run). The two-step repair is not a claim that one code is impossible.

Scratch probe: `/var/tmp/oh-ms-native-adapter-probe/probe.mjs`; output `/var/tmp/microsoft-native-adapter-probe.log`. It uses only a disposable synthetic home and performs no OAuth/network request.

## Regression and review evidence

The adopted characterization `TestMicrosoftFirstApprovalAfterPendingAndSlowDown` originally passed on unchanged production code: ordinary pending/slow-down/success did not reproduce Jari's report. It now also checks emitted counters and redaction. The separate held-Graph regression distinguishes the repaired stale-prompt behavior.

`TestMicrosoftCatalogRelaysBothCodesAndSupervisesChoice` passed **10 separate `-count=1` invocations**, on the final runnable inputs; no verified occurrence of the consultant's alleged 4/5 flake. Log: `/var/tmp/microsoft-ten-runs-final.log`.

One targeted `claude-fable-5-1` reviewer confirmed prompt retirement/redaction and identified conflicting counters plus telemetry/contract tightening. Those changes were adopted: avoid outer counter during grants; retain only first pending/backoff observations; start Outlook approval timing when its prompt appears; do not label pre-prompt startup timeout as approval timeout; bind phase values to provider/state in the contract with negative checks. The review's two package-test failures reportedly reproduced at clean HEAD and are not claimed as verified regressions here; this worker's complete affected-package run passed. Raw review: `/var/tmp/microsoft-targeted-review.txt`.
