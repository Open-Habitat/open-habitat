# Result

The race was in the test helper, not the product. On a native
`?conversation=pi:` route `BrowserConversation` shows `PendingConversation`
("Ladataan keskustelua…") until its cold status read returns. That loading view
also has an enabled editor and its own Tiedot toggle with local state.
`readyConversation` only checked the URL and an enabled editor, so under load
the test clicked the loading view's Tiedot. The opened header then replaced it
with Tiedot closed, and `conversation-recheck` never appeared. Instrumented
failing runs showed the open effect ran once, before the click, and
`aria-expanded` stayed `false`, which rules out a later reset.

`readyConversation` now also waits for the opened header's archive control
(close while the conversation is empty). Only the opened native conversation
renders that control, so every helper caller (`refreshConversation` and the
journeys that call `readyConversation`) gets the fix.

Evidence on Cedar's slots (remote runner):

- Before: `--grep "changed snapshot identity" --repeat-each 40/100 --workers 8`
  failed 1/40 and 3/100 at the recheck expectation.
- After: 149/150 at the same settings while the lab spec ran in parallel (the
  one failure was in `open()`, at the new-conversation button). A rerun with a
  probe for slow `open()` passed 150/150 without a single slow sample, and the
  whole spec passed 280/280 with `--repeat-each 4 --workers 8` alongside the
  whole lab suite.

## Decisions for later review

- Opening Tiedot on the loading view and having it close when the
  conversation opens is a cosmetic quirk, not a defect worth product state.
  The product is unchanged.
