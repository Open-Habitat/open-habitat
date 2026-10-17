# Result: composer focus ring clipped

**Cause.** When the recap card (Tilannekatsaus) sits above the composer, with
or without the background strip between them, a rule removed the composer's
top padding so the card's margin alone set the gap
(`.ah-recap + .ah-composer`, `.ah-recap + .ah-bg-strip + .ah-composer`). The
composer scrolls (`overflow: auto`, for its max height), so it clips anything
outside its padding box, and the editor's ring lies 4 px outside the field
(2 px width, 2 px offset). The ring's top edge was cut off by the composer's
own edge, on desktop and phone alike. Neither the strip nor the queue covers
the ring: the queue sits above the recap, and the strip alone leaves the
composer's 12 px padding in place.

**Fix.** A token `--ah-focus-room` (ring width + offset) in
`design-system/tokens/spacing.css`. The composer keeps exactly that much top
padding after a recap. With no strip between them, the card's bottom margin
gives the same amount back; with the strip, the composer overlaps the strip's
empty bottom inset by that much (negative top margin). Every visible gap and
the strip's own box stay as they were, which `lab-conversation`'s footer
rhythm check measures.

**Evidence** (synthetic lab, production bundle; `web/lab/capture-composer-focus.mjs`):
`before-*` and `after-*` screenshot + static HTML pairs for desktop and phone,
light and dark, with the recap and the strip above the focused editor.
`web/tests/lab-composer-focus.spec.ts` reads the ring's pixels on all four
sides (desktop 1280 and phone 390; new conversation with the model in the
field, recap above, recap and strip above). With the old rule restored it
failed on both widths with `{"top":0,…}`; with the fix both pass.

The control catalogue in `issues/ui-control-audit/` checks every other
control's ring the same way.

Checks: `lab-composer-focus.spec.ts` 2/2; lab suite 43 passed with only the
known `expired combined cursor` and `combined stream gap` failures; normal
browser suite 231 passed, failing only the known `native key add` and once
`@lazy-resume Stop before Pi runs` under eight-worker load (3/3 alone). The
normal suite ran before the final strip-overlap change; the lab suite and the
composer test ran after it.
