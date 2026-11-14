# Result

Title generation now registers the shipped Claude subscription bridge before applying the existing background-model policy. The previous helper constructed only a native model registry, so a bridge-only account had no candidate model. Automatic and explicitly regenerated titles share this helper.

The bridge uses its own in-memory credential registry, matching the existing model-picker integration. No user extensions, agent sessions or tools are loaded. The conversation's provider preference, middle-tier selection, excluded model classes, output validation and time budget remain unchanged.

## Verification

- `umask 077; scripts/test-focused.sh --area go --go-package ./internal/daemon` passed (201 seconds). An initial invocation was interrupted by the command timeout; the complete rerun passed.
- The new pinned-Pi regression drives the actual Go launcher, extension loader, model registry and HTTP completion with a synthetic shipped extension and empty home. It proves title generation with unknown conversation model and with an excluded conversation model (Sonnet is selected instead), native-provider success when the installed bridge cannot answer, and `model_unavailable` when the bridge is absent.
- Existing native-provider title tests cover rewrite, fallback, invalid output and cancellation.
- `node --test internal/daemon/pi-device-test/background-model.test.mjs`: six passed.
- Focused self-review: appropriate for a local model-registration fix, with no session lifecycle, host operator, upgrade or wire-contract changes. Checked argument positions for both nil and known conversation models, credential-registry separation, model policy and fixed-code failure handling. Self-review caught that an installed bridge advertises models without a subscription: native candidates now retain priority for unknown conversations and remain fallbacks for failed bridge calls; the regression covers both.

Live check: not run against a real subscription or installation. Verification uses synthetic credentials and the pinned Pi SDK; deployed subscription latency remains unverified.

## Decisions for later review

Load only the shipped Claude bridge, as the model picker already does, rather than arbitrary user extensions. This fixes the supported subscription-only case without changing which extension code background work trusts. No new product or security authority is introduced.
