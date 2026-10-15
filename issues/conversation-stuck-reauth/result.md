# Conversation stuck and stale continuation — investigation

## Root cause and evidence

Read-only inspection of the pilot.65 guest on 2026-10-15: Jari's new Pi session (created 05:15 UTC) contains one assistant turn ending in `stopReason: error`. The provider error classifies as **“model is not supported with this ChatGPT account”** for the selected `openai-codex/gpt-5.5` model. This is *not* an expired provider login: Pi's native `auth.json` has a present OpenAI OAuth record with an expiry in the future (about seven days at inspection). Only classifications and session metadata were inspected; no tokens or conversation text were printed or copied. The older resumed session also contains an error turn, but there is insufficient evidence to attribute that turn to the same cause.

The guest daemon was stopped and started at 05:11–05:12, 05:26, 05:27, and 05:28–05:29 UTC, from the systemd journal. Restart loses the daemon's live conversation handles; a browser holding a previous status must revalidate native history and continuation. The screenshot shows a stale status presentation, not proof of an auth failure. Its duplicated warnings and low send-button placement were presentation defects: stale status, event loss, and a separate centred check action could all be visible; the send button was aligned to the whole field including its disabled-reason line instead of the editor rectangle.

The fix classifies the unsupported-model native error as a fixed code and displays a truthful notice without exposing the provider's error text or offering ineffective re-login. Actual 401/403 authentication failures retain the existing Pi device sign-in action, now available in conversation and account settings even when native credentials are present. The daemon clears that fixed failure only after the mapped user's device attempt completes and a native usable state is verified. The browser discards the pre-login cached controller status before reopening the same conversation and retains its session-scoped draft without replaying the message. A failed credential refresh is covered by a disposable native-home fixture, which verifies that status stays unknown without exposing credentials and that native re-login repairs it. A stale conversation shows a single status warning with its check action; the composer send button is anchored to the editor rectangle.

## Decisions for later review

- Pi's selected model is native Pi state. The host does not silently change it or assume which alternate model this ChatGPT account supports. A browser model selector may be useful, but needs a separate product decision; for now the notice directs the person to select a supported model in Pi. Re-login cannot grant unsupported model access.
- The journal confirms daemon restarts but does not prove which particular restart caused the captured stale state. No attempt was made to alter the guest or to replay Jari's prompt.

## Review

The requested `/llm-review` finder (claude-fable-5-1) and independent verifier (gpt-6-astra) found three actionable defects, all fixed here: the unsupported-model notice had implied that changing Pi defaults would repair an already-running conversation, the authentication warning survived successful re-login until the next send, and the stale-status action left a refused continuation in React state. The assessment is in `history/assessment-conversation-stuck-reauth.{json,md}` (local scratch). The remaining candidate, a settings re-login button while native state is unknown, was refuted: onboarding requires a separate explicit start and fails closed.

## Validation

- Disposable native-home Pi fixture: expired credential with failed refresh reports unknown without credential output; native re-login restores usable status. `node --test internal/daemon/pi-device-test/helper.test.mjs` passed (3 tests).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`, `--area contracts`, and `--area web` passed after installing the daemon fixture and `npm ci --prefix web`.
- Focused browser coverage passed: four `browser-conversation.spec.ts` cases (authentication recovery returns to the same draft without a stale login notice, unsupported model gets its own notice, composer geometry and continuation recovery) and the `resilience-states.spec.ts` outage case with editor/send rectangles. A prior browser attempt was blocked by the host's inotify instance limit while another checkout ran eight workers; the subsequent run passed after that run ended.
- Full clean gate result to follow.
