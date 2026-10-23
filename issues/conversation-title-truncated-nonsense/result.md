# Result

Implementation: `67ebf90a`.

Generated names are never shortened by deleting words. Pi is asked for a complete 2–5-word topic phrase within 32 Unicode characters, then asked once more with a stricter instruction if it does not fit. Only after that rewrite may a separately generated, complete fallback phrase be used. The fallback has the same actual display bound; the prompt encourages something shorter. Native user-chosen names and native-write ownership/retry rules are unchanged.

The helper has a 12-second generation/cancellation budget inside the unchanged 15-second process deadline, so a stalled rewrite cannot discard a complete fallback already received. Structured output has a 256-token allowance; token-limited and invalid responses are no longer misreported as `model_unavailable`. One alternative configured model remains available after provider failure. No timeout increase, new store, layout, contract or authority change.

## Real Pi and the unavailable-model report

The guest journal confirms `history / model_unavailable` at **2026-10-23 05:26:55 UTC**. That code previously also covered exhausted output tokens and invalid model output; it cannot identify the historical provider failure. The reported 4.7 seconds is below the existing 15-second process deadline. Both cheapest configured models answered fresh operational probes; neither wrong model selection nor a cold-start timeout was reproduced. **The exact cause of that historical failure remains unattributed**, not claimed proven fixed.

The final production helper, with only its runtime import pointed at the guest's installed Pi 1.3.0, made five fresh-process provider calls as the mapped user. All succeeded without `model_unavailable`: Finnish/English first messages, both latest-language switches, and a long English first message. `native-pi-titles.jsonl` contains only the synthetic returned titles/model IDs. Examples: “Repositorion sisällön yhteenveto”, “Synthetic Repository Summary”, “Muistutuksen toimitus”. Every result is a complete phrase within the bound. These were synthetic-prompt operational checks using native authorization, not personal-history tests; no session, saved model setting or service was changed. Earlier baseline probes reproduced an overlong Finnish phrase that the old code would cut.

## Validation and review

All final checks passed through the maintained remote dispatchers:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — `/var/tmp/title-final-daemon.log`.
- Additional verbose title/model/deadline regressions — `/var/tmp/title-final-focused-retry.log`. Pinned real Pi SDK with synthetic home/provider covers rewrite, complete Finnish fallback, fenced output, token-limit classification, long excerpts, provider fallback and cancellation of a stalled rewrite.
- Focused web, `title-regeneration.spec.ts` (3 passed, including affected axe checks), contracts, and Storybook build — `/var/tmp/title-{web,browser,contracts,storybook}-final.log` (contracts: `/var/tmp/title-final-contracts.log`).
- Issue doctor, project-view validator and whitespace check passed. No full gate, push or deployment.

One targeted reviewer, `claude-fable-5-1`; local assessment fixed the overly strict fallback bound, fenced-JSON handling and stalled-rewrite fallback loss. Retry-efficacy speculation and a rare control-character relaxation were dropped. Review/assessment are under `history/`; no second reviewer or issue filing.

Four final synthetic-lab AVIF/HTML pairs are adjacent: light/dark at 1366 and 390 px. Capture: `web/lab/conversation-title-truncated-nonsense.mjs`; warm-run log: `/var/tmp/title-remote-capture-final.log`. They show the real fixture retitle journey, **not** live model output. Compared with `design-system/drafts/Agentin vuoro.proto.html`: short topic-first heading retained, existing production phone header rows and additional model/process controls unchanged. No token or styling change was needed. Storybook and the fit regression now use a complete Finnish phrase.

## Recovered failures

- Exploratory reads used stale/nonexistent paths (`internal/daemon/pi`, the old process-skill location, an uninstalled SDK, and the temporary skill layout). Actual source/instructions were located; dependencies installed. A missing `.hb-exec.json` task query was replaced by the installed warm-workspace interface.
- First reviewer invocation omitted the value for `--diff-files`; corrected invocation completed. Its extra deadline test failed in its environment on both main and the worktree; caller's final verbose run and full package passed (`title-targeted-review.txt`, `title-final-focused-retry.log` under `/var/tmp`).
- A local lab launch found no `.cache/browser-host`: dispatched builds live in the warm guest. Switched to the maintained warm runner; final capture passed. No local compiler/browser bypass.
- After relaxing fallback validation, one negative fixture was now a legitimate 31-character fallback. Made that fixture genuinely overlong; final focused and full package checks passed. Initial failure: `/var/tmp/title-final-focused.log`.
- Prototype phone captures retained its navigation overlay, so phone comparison also used the prototype's header/container rules; production phone captures and fit/a11y assertions completed. The desktop prototype header was inspected directly. No production visual assertion is inferred from a capture alone.

No required command or delegated workflow remains failed or incomplete. The historical provider-cause uncertainty above is explicitly retained for the conductor's live follow-up.
