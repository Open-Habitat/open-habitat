# Result

All three gate failures were product focus/caret defects that a loaded
machine exposed; each is fixed in the product and the specs stay strict.

## 1. speech-input `:134` — typed text after the dictation

**Cause (product).** After `page.goto(conversation)` the conversation's
status is read cold, so the loading view (`PendingConversation`) shows its
own composer. Under load the test's `fill("Alku")` lands there. When the
conversation opens, a new composer textarea mounts with the draft and
`BrowserConversation`'s focus-on-open effect focuses it; a new textarea's
caret is at 0. The mic reads the focused field's caret `[0,0]`, so the
dictation went in front: `sanelun ensimmäinen lause. Alku`. A person typing
while a conversation loads hits the same: their next keystroke lands before
what they wrote.

**Evidence.** A probe holding the status read: after release the field was
focused with `selectionStart = 0` on value `Alku`. The new case
`browser-conversation.spec.ts` "a draft written while the conversation
loads goes on from its end" fails 3/3 before the fix (`" jatkuuAlku"`),
passes after.

**Fix.** The focus-on-open effect puts the caret at the end of the draft.

## 2. account-settings `:199`, `:845` — `menu-settings` not visible

**Cause (product).** Signing in lands on `/`. The signed-in view (rail with
the account trigger) renders at `/` and focuses its heading; a passive
effect then replaces `/` with `/workspaces`, and App's view-focus layout
effect counted that as a navigation and focused the heading *again*. Under
load the gap is long enough for the test to focus the trigger and press
Enter in between; the heading then took the focus (error contexts showed
`heading "Työtilat" [active]`), so the menu never opened or Escape did not
return to the trigger. A person who moves to a control at that moment loses
it the same way.

**Evidence.** Instrumented probe focusing the trigger as soon as it appears:
focus moved to `H1 workspaces-title` ~6–60 ms later in 6/6 runs before the
fix, 0/6 after. New case `workspace-slice.spec.ts` "signing in at / keeps
the focus a person moved once the view showed" fails 6/6 before, passes 6/6
after.

**Fix.** The focus effect compares a view path in which `/` is
`/workspaces`, so replacing the alias is not a navigation.

## 3. Found on the way: speech-input `:269` — field not focused after a dictation ends

Under the same load `:269` failed 8/30 on `HEAD` at
`expect(field).toBeFocused()` after Enter ended a dictation. The composer
focused the field in a `requestAnimationFrame` scheduled from the
dictation's end and skipped it if the field was still `hidden`; under load
the frame ran before the render that showed the field, and focus was left
on `body`. ✕/Esc (`cancel`) had the same frame race. Both now focus in a
layout effect once the field shows again.

## Pass counts under gate-like load

Load: `OH_BROWSER_WORKERS=6`, Playwright at `nice 5`, ten
`timeout 900 sh -c 'while :; do :; done'` busy loops on 8-core Birch.

| Case | Before | After |
| --- | --- | --- |
| account-settings `:199` + `:845` | 26/30 (`--repeat-each 15`) | 60/60 (`--repeat-each 30`) |
| speech-input `:134` | 48/48 (not reproduced by load alone; deterministic probe/test above) | 30/30 |
| speech-input `:269` | 22/30 | 30/30 |
| whole speech-input spec | — | 48/48 (`--repeat-each 4`) |
| whole account-settings + workspace-slice | — | 66/66 (`--repeat-each 3`) |

Unloaded, `OH_BROWSER_WORKERS=2`: browser-conversation 78/78 (before the
composer change, which only touches dictation), account-settings 17/17,
workspace-slice 5/5, round4-polish 2/2; web fast checks 1226/1226.

## Decisions for later review

- **Caret after a load-time draft goes to the end**, not to where the person
  left it in the loading view's field. Alternative: hand the old field's
  selection over to the new one (record it when the loading composer
  unmounts). End is right for the common case (typing on) and needs no
  cross-component state; carrying a mid-text caret across the swap is left
  undone.
- **`/` and `/workspaces` are one view for focus.** Navigating between them
  never moves focus. Alternative: render nothing signed-in at `/` until the
  alias is replaced, which would add a blank frame.
