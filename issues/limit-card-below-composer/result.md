# Result

Creation refusals now use the existing actionable-notice area above the composer, outside the scrolling history. This also keeps the fallback refusal and the room-freed card in the same visible position. Finnish and English card/admin copy explicitly says the limit counts conversations working at the same time, not merely open ones; resting conversations do not hold a place. No daemon, contract or session-state behavior changed.

## Decisions for later review

- Chose the existing above-composer refusal area instead of a modal. It keeps the draft available, matches other actionable refusals and avoids nested dialogs when inspecting working conversations. Very short screens retain the area's existing bounded internal scrolling.
- Applied the same placement to other creation failures rather than giving the capacity fallback a different location. All are feedback on the same creation attempt.

## Validation and review

Birch, umask 077, private disk-backed TMPDIR, OH_PORT_BASE=15400 and OH_BROWSER_WORKERS=2:

- `./scripts/test-focused.sh --area web`: 179 files / 1351 tests passed. Initial lint rejected non-null assertions in the added bounds check; replaced them with an explicit guard. First unit run timed out in the untouched GitLabConnection test under load; the complete rerun passed.
- `./scripts/test-focused.sh --area browser --spec live-conversation-limit.spec.ts`: 2 passed. Extended the existing real-handler/fake-Pi journey to assert the entire desktop refusal and Retry are in the viewport before any scrolling or clicking, and above the composer. Stop-to-free-place and administrator navigation still pass.
- Synthetic lab: seven paired 2× screenshots/static HTML files in `evidence/`, captured with `web/lab/limit-card-below-composer.mjs`. Inspected desktop light and phone dark refusal screenshots: card text and actions are visible above the field. An initial attempt to capture from the ordinary browser fixture was correctly rejected by the lab-only capture guard; switched to the actual lab, without weakening the guard. Lab stopped afterwards.
- Focused self-review: checked render ordering, preserved retry/stop/fallback behavior, catalog parity and existing notice overflow rules. No new colors or edge stripes.

Evidence is synthetic same-UID browser/host behavior, not live pilot or Linux-user isolation evidence. No full browser suite or clean gate run; no push or deployment.
