# Result

Moved next-waiting above the current conversation's notices and work controls.
The queue was already the first child of Composer in this checkout; it stays
next to the field. No CSS ordering, new controls, copy, flags or state changes.
Existing Explain cards and both catalogs remain applicable.

## Stack, top to bottom

1. Other-conversation next-waiting strip.
2. Current conversation's GitHub/AI/model warnings, recovery/recheck and notices.
3. Recap of this conversation.
4. Background work / helpers / assets controls.
5. Rewind sheet, when opened; server-browser dock, when applicable.
6. Composer: queued steer/follow-up messages, then draft-specific goal,
   dictation and attachment content, then the message field.

Draft attachments and goal belong closer to the field than already queued
messages. In the ordinary text-only case the queue is directly above the field.
The terminal panel remains below the composer, not part of this stack.

## Decisions for later review

- Put next-waiting above **all** current-conversation strips, rather than only
  above the queue or between workers and field. It navigates elsewhere; warnings,
  recap and workers describe the conversation whose draft is being written.
- Keep the existing ordering of current-conversation strips and draft accessories.
  Reordering warnings or separating queue from Composer would add churn without
  making the requested hierarchy clearer. No security or authority decision.

## Evidence and validation

Tested the implementation diff on base fb1c9c0db, then reran web and all four
next-waiting cases successfully after rebasing onto 50ac98101. The only rebase
conflict was KOKEILTAVAA.md; preserved both incoming notes and the new test line.
The capture script needed formatting in that final web run; formatted and reran.
Focused self-review checked
conditional rendering, DOM/keyboard order, existing Explain selectors, and that
NextWaitingDock's send/return/draft logic and props are unchanged.

- `./scripts/test-focused.sh --area web`: passed, 193 files / 1448 tests.
- `OH_PORT_BASE=12400 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec next-waiting-row.spec.ts`: 4 passed. Extended the existing acceptance journey with an actual queued steer and bounding-box order checks at 1440 and 390. Existing scoped axe check passes.
- Same command with `--spec queued-send.spec.ts`: 13 passed, 1 pre-existing failure at line 202 (background-work control present before Pi starts). Reproduced on unmodified main fb1c9c0db in a disposable archive using the named case. Filed unlaned as `queued-send-stop-startup-background-control`; not fixed in this layout change.
- Synthetic lab screenshots at 1440×900 and 390×900, device scale factor 2, visually inspected, paired with static HTML in `evidence/stack-*.{avif,html}`. Captured using `web/lab/capture-queued-steer-above-next-waiting.mjs`; converted with `scripts/screenshots-to-avif.py`. Both show next-waiting, work control, queued steer and field in that order, without clipping the controls.

These are same-UID synthetic host/fake-Pi checks, not live deployment or native
provider evidence. No full browser suite or clean gate was run.

## Resolved tooling attempts

The first web check rejected non-null assertions in the new test; replaced with
an explicit missing-box failure and reran successfully. Repeated `--spec` selected
only the last spec, so queued-send was run separately. First capture used an
ordinary-host workspace name absent from the lab; changed to the lab workspace
and reran successfully. Initial source lookup used the old Composer path; found
the actual `components/composer/Composer.tsx`. A glob for a nonexistent styles
path was replaced with a scoped source search. No required evidence was lost.
