# Empty-conversation model controls

## Fix

The composer now uses direction 1's compact rounded pill and an upward popover (a bounded scrolling sheet on phones). Opening the picker no longer expands the composer. The menu escapes the composer's draft-scroll clipping; desktop browser testing caught and verified that additional layout defect. Its chevron uses the bundled SVG icon, not a glyph missing from the font.

An empty conversation's top bar is informational. It uses the same short model identifier as the pill, from the explicit session choice or Pi's native default, without the provider prefix. Native history takes precedence once available. An unknown native default is labelled unknown, not invented.

“Valitse” keeps the choice and unsent draft in this conversation, without a create request, replacement child, close request or navigation. The choice is transient browser intent until the first send. That send passes `first_choice` to the existing controller. The daemon validates Pi's catalog, reserves the child's pending state, checks that no browser command or native conversation content has preceded it, and applies Pi 1.3's correlated non-persisting `set_model` / `set_thinking_level` RPCs before the prompt. A failed or uncertain setter prevents the prompt and leaves control uncertain; nothing is replayed. Used conversations retain the existing explicit-new-conversation fallback.

Pi remains the source of models, settings and history. The authenticated tab preloads one schema-validated catalog into identity-scoped React memory. Pickers reuse its rows while refreshing; focus and a one-minute timer also refresh it. A confirmed default write cannot be overwritten by an older catalog read. Identity changes abort reads and discard the old catalog. There is no browser-storage catalog, host cache, new registry or credential access.

## Reproduction and regression evidence

The synthetic lab at `OH_PORT_BASE=27800` reproduced the rectangular control, inline expansion, “Pi:n oletus” fallback, full provider-prefixed startup label and replacement-session action. I did **not** reproduce the exact live “conversation does not exist” message. Its empty-session create/close/navigation path is no longer invoked by this control, and the regression asserts a stable URL, preserved draft, one controlled session, and the selected native model after sending and reloading.

The two new desktop/phone browser journeys also hold a background model read indefinitely while opening the picker: cached radio rows must be usable within one second, with no loading placeholder. They assert a compact pill, panel viewport bounds, Axe checks of the affected interaction, focus return, “Valitse”, unchanged native default and stable short labels. These fail against the original control/semantics. The old four-replacement capacity test was replaced: this interaction no longer creates replacement children, and the new test directly asserts one child. Existing close-empty/controller tests still cover actual cleanup.

Unit tests cover catalog single-flight, retained rows, delayed old-identity responses, delayed reads racing a confirmed default save, and a refused applied model remaining blocked until the new choice is confirmed. Daemon tests reject first-choice writes for used, working, previously-commanded and question-blocked sessions. Native emptiness verification checks every branch, including user content off the active branch.

The pinned **real Pi 1.3** synthetic-provider test now launches one model, applies a different first-message choice to the same child, sends a prompt, reads the selected model/thinking from Pi's saved history, and verifies byte-identical global settings. It passes without a real account or provider. Synthetic browser fixtures are not live-provider evidence or distinct-UID evidence.

## Checks

- Fast web checks: **134 app tests + 119 component tests**, formatting, lint and TypeScript passed during development.
- Focused host-backed browser selection: **7/7 passed** (desktop/phone model controls, pre-start choice, warm return, unsupported-model recovery, native-default settings and refusal/fallback).
- `TMPDIR=/var/tmp go test -race -count=1 ./internal/daemon ./internal/contracts`: passed, including the installed pinned-native-Pi test dependency.
- Contract regeneration/drift and schema/example validation: passed; the optional first-send intent is documented in `pi-message.schema.json` and HTTP API docs.
- Project-view validator and `git diff --check`: passed.

Final rebased-tree gate evidence is recorded below after completion. Earlier test setup failures (missing dependencies, omitted synthetic write Origin, capturing the route before creation finished) were corrected, not counted as passes. One initial full-unit run exposed a selection-initialization race; initializing preloaded controls before paint fixed it and the full fast checks passed afterwards.

## Visual evidence

`visual/` contains paired AVIF/static offline HTML from the loopback synthetic lab: before/after empty, picker and selected states at **1440×900 and 390×900**, plus the phone action area and light/dark post-reply/reload states. Before captures used the fixture's unset default; final after captures configure the synthetic native default to `gpt-6.1-sol · high`, then choose Nova. This deliberately demonstrates the known-default label rather than pretending the fixture's unset default identifies a real model. The original reporter images remain untouched.

I compared the production pill, upward menu, phone sheet, rows and thinking controls with `design-system/prototypes/rounds/2026-10-16-mallit/round.js` and `round.css`, direction 1. The panel scrolls to its actions rather than claiming all native candidates fit on a phone. Screenshots are review evidence, not automated pixel comparisons. No live data or personal browser profile was captured.

## Live checks

`KOKEILTAVAA.md` has desktop/phone checks for the initial short name, immediate cached opening, same-conversation “Valitse”, preserved draft/URL, first reply/reload and unchanged SSH Pi default. No signed-in live-server or real-account entitlement check is claimed here.
