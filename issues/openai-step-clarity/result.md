# Result

The browser was rendering `interrupted` immediately after the start click, before the POST returned. That rendered a red “Tilaa ei voitu vahvistaa” notice even though the helper was preparing a code. Starting now displays the waiting state; cancellation has its own neutral in-flight state. An unsuccessful POST, cancellation, or status read still displays the failure notice. This establishes one reproducible browser cause of the flash, not the cause of Jari's uncaptured pilot.22 flash.

The code, copy icon, provider link and automatic continuation are now three numbered instructions in one prominent panel. The provider-page explanation is secondary. The copy icon has an accessible name and hover title. The link remains restricted to Pi's known HTTPS device URL; neither the code nor a prefilled code enters the URL.

## Decisions for review

- Keep a genuine failed start as “Tilaa ei voitu vahvistaa” with “Tarkista tila”, not an automatic retry: a failed response alone does not prove the helper did not start.
- Keep cancellation and session-change uncertainty distinct from code preparation. Do not present the old code after a write starts.
- Use a numbered third step, “Palaa tänne ja odota”, to bring automatic continuation next to the code and verification link. Visual approval follows deployment, not this synthetic check.

## Evidence

Synthetic lab only, fake Pi and fake identities, no guest or live-provider assertion. Each image has a same-name inert offline HTML twin:

| Viewport | Before start | In-flight POST (held response) | Device code | Rejected POST |
| --- | --- | --- | --- | --- |
| 1440 × 900 | [desktop-start.png](desktop-start.png) | [desktop-preparing.png](desktop-preparing.png) | [desktop-code.png](desktop-code.png) | [desktop-failure.png](desktop-failure.png) |
| 390 × 844 | [phone-start.png](phone-start.png) | [phone-preparing.png](phone-preparing.png) | [phone-code.png](phone-code.png) | [phone-failure.png](phone-failure.png) |

The host-backed `@first-use code preparation` Playwright case observes DOM mutations across the held transition (not just its final state), checks for no failure notice during preparation or through the code, then forces a rejected POST and confirms that the failure remains visible. Unit coverage checks the same state boundary and a held cancellation followed by failure. The synthetic lab screenshots show readable content without horizontal clipping on phone.

Checks on candidate `b32ae786d877c30b421c004eea8c9d28082efb4c`: `./scripts/test-web-fast.sh` passed; `OH_PORT_BASE=18000 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npm run test:e2e --prefix web -- --grep '@first-use code preparation'` passed. `TMPDIR=/var/tmp/oh-openai-step-clarity OH_PORT_BASE=18000 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/ci-local.sh --clean --json` passed (`status: passed`, `clean: true`; complete log at `/var/tmp/oh-openai-step-clarity-gate.json` and stderr at `/var/tmp/oh-openai-step-clarity-gate.err`). Focused final-diff review: the POST start and cancellation show neutral waiting states until results arrive; a failed POST, cancellation or status read still shows the red notice and a status-check action. The missing-attempt outcome remains explicitly uncertain. No test guest or deployment touched.
