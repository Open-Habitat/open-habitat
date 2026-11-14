# Result

The CLI settings response omitted `default_language`, although the gateway's control `show` reply includes a browser administrator's saved choice. Strict decoding therefore rejected valid state. Added the matching optional field without relaxing unknown-field checks or changing gateway writes.

## Validation

- Before the fix, the new CLI regression failed with exit 2 / `invalid_control_response` for every explicit supported language; the unset case passed.
- After the fix, `umask 077; scripts/test-focused.sh --area go --go-package ./internal/cli` passed.
- `umask 077; scripts/test-focused.sh --area go --go-package ./internal/gateway` passed (the runner invocation supplied both package flags and selected the latter; CLI was then run separately).
- The CLI test reads synthetic saved settings through the real gateway control handler and CLI decoder, checks language output and unchanged state bytes. The gateway HTTP test checks browser-selected languages reach control reads and survive reload.
- Independent routine review by `claude-fable-5-2`, followed by local assessment: no findings. A single finder was proportionate for this operator read-projection fix; no authority or mutation behavior changed. No model-performance push under the worker's no-push instruction.

Live check: not run against an installed service; no deployment or service change. After release, select a default language in browser administration and run `open-habitat admin settings show --json` as root; expect exit 0 and that saved language.

## Decisions for later review

Preserve the existing stored-settings meaning: an unset administrator choice stays omitted, rather than synthesizing the browser's effective configuration fallback. No new CLI language-write option or contract change is needed.
