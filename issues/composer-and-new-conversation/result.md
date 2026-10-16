# Partial result — not ready to close

Run `01m52qdasz0zmd2rx0bmfbd310` implements only points 1 and 2. It does **not** implement queued delivery, enabled typing during creation, fresh-conversation notice cleanup or automatic conversation creation after workspace creation. No daemon, delivery or contract changes were made. This branch must not be treated as completion of the combined assignment.

## Implemented

- Shared field hover/pressed channels retain the field surface. In the composer with an embedded model picker, those channels are transparent so the wrapper remains the sole background. Previously the shared interactive hover rule could replace the transparent background with the grey surface-hover colour; growing the field beneath the pointer made this look like a line-count-dependent change.
- Icon-only `Primitives.Button` contents use the existing shared icon grid; icon presentations also use a unit line-height. The send arrow no longer follows an inline SVG baseline. Ordinary text buttons keep their inline layout.

## Evidence

Synthetic same-UID gateway/daemon browser evidence, not live-host or distinct-UID evidence:

- `TMPDIR=/var/tmp/ohcg OH_PORT_BASE=23600 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts`: 4/4 passed. Checks desktop/phone × light/dark, one/multiple lines with pointer hover, send-arrow geometry and visible SVG-only shared controls.
- `./scripts/test-focused.sh --area web`: passed static checks, unit tests and component tests.
- Paired synthetic-lab screenshots and offline HTML: `shots/geometry-{1440,390}-{light,dark}.{avif,html}`. These show the multiline hovered editor and centred send button, not queued-send states.
- Prototype built with `node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-jonolahetys`.

## Prototype comparison and remaining deviations

The editor retains one surface and the arrow is centred, as in the reference. No comparison claiming queued-send compliance is possible: this patch does not implement the dashed waiting bubbles, joined prompt, Stop restoration, failed-start recovery or enabled creation composer. The captures still show the existing process/spinoff unavailable notices; they are unresolved, not justified design deviations.

Source inspection identifies the blocking creation response: `ConversationController.create` waits for native `get_state` for up to fifteen seconds before returning the agent ID. This is a source-level explanation, **not confirmation of Jari's live timing**. Live server logs were not read and the server was not changed.

## Decisions for later review

No delivery decision or authority change was made. Retain the accepted prototype decisions unchanged. Continue with daemon-owned pre-start messages keyed by client command ID before closing this issue. The old one-outstanding-send browser flow and in-memory daemon receipts cannot simply be relabelled as an exactly-once pre-start queue.

## Proposed live checks after the remaining implementation lands

Not added to the published-work list in `KOKEILTAVAA.md`: nothing in this worker branch was merged or deployed.

1. Grow and shrink the composer with the pointer over it in both themes; its surface must not change.
2. Check send and workspace + at desktop and phone widths.
3. Complete all remaining original acceptance checks, including real daemon restart, joined queued prompt, Stop restoration and reconnect without replay.

## Review of the retained partial patch

Independent finder `claude-fable-5-1` identified three concrete CSS regressions in the initial attempt; all were locally confirmed and fixed. Verifier `gpt-6-astra` checked the revised source and refuted all three on that revision. The base text-button layout is unchanged, icon-only buttons use the existing icon presentation, and disabled model-wrapper textareas remain transparent. See `../workspace-plus-centering/result.md` for the fixes and the failed, non-product model-performance logging attempt. This review covers only the retained visual changes, not the absent delivery work.

## Final checks after review fixes

The final sequential run completed in 125 seconds, with `umask 077`, `TMPDIR=/var/tmp/ohcg`, `OH_PORT_BASE=23700`, `OH_BROWSER_WORKERS=2` and the shared Chromium cache:

- `scripts/test-focused.sh --area web`: static checks, 150 unit tests and 133 component tests passed.
- `scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts`: 4/4 passed, including the disabled-editor surface regression.
- `scripts/test-focused.sh --area browser --spec lab-workspace-page.spec.ts`: 8/8 passed.
- `scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`: 73/73 passed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.

Snapshots were recaptured from the final reviewed code, based on `6850b868`; their headers name that base commit because the patch was not yet committed at capture time. Go/contracts/full gate were not run: no Go/contracts/packaging inputs changed, and this is not a gate or delivery-completion claim. The browser suites exercise existing explicit continuation, **not** the missing lazy-resume acceptance. The earlier parallel browser invocation was invalidated by shared Playwright output and was rerun sequentially; it is not counted as a pass.
