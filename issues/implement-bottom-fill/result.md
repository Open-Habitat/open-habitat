# Result: a new conversation fills from the bottom (Alhaalta)

## Change

- **Production** (`web/src/components/components.css`): the conversation
  stream is a flex column whose first child takes the free space with
  `margin-top: auto`; its children do not shrink. A conversation shorter than
  the view therefore sits on the composer and grows upwards, and a taller one
  still scrolls to its first line (the round's reason for an auto margin over
  `justify-content: flex-end`). The empty-conversation text ("Aloita
  keskustelu.") sits right above the composer: the empty list and the
  paragraph margins below it are gone. The follow-latest rule is untouched:
  it only scrolls once the thread is taller than the view, where nothing
  changes. The rule applies to every `ConversationStream` (browser
  conversation, pending conversation, native history).
- **Library and design**: `design-system/prototypes/lib/chrome.css` has the
  round's rule (`.stream > .vwrap { margin-top: auto; }`), and
  `design-system/design.md` (Keskustelu) records the decision.

## Evidence

- `web/tests/thread-fill.spec.ts` (host-backed synthetic): the empty text
  and, after the first reply, the last row are within 80 px of the stream's
  bottom with free space above; the 25-entry native history page is taller
  than the view and its first child (the older-page button) is reachable at
  `scrollTop = 0`. It fails without the rule (468 px below the thread) and
  with `justify-content: flex-end` (the top becomes unreachable).
- Paired screenshots, round `2026-10-16-tayttosuunta` direction Alhaalta
  (`round-*.png`) against the synthetic lab (`lab-*.png` with `.html`), in
  the empty, first-message, long-reply and recap states, desktop and phone,
  light and dark. Captured by `web/lab/capture-thread-fill.mjs` after
  building the round.

## Deviations from the round

- **Texts are production's.** The round's empty view says "Uusi keskustelu
  työtilassa aurinkokello / Pi käynnistyy, kun lähetät…"; production keeps
  "Aloita keskustelu." in the same place. Only the fill direction was
  decided.
- **The lab's recap state uses a short reply.** The round plays its long
  reply before the recap, so its recap view is already scrolled; the lab
  recap follows a short turn, which shows the card pushing the thread up.

## Decisions for later review

- **The rule covers read-only native history too**, not only new browser
  conversations: a short terminal conversation also sits next to its footer.
  Keeping one stream layout is simpler than a per-view exception, and the
  decision's reason (the eye stays near the field) holds there as well.
