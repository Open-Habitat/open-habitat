---
created: 2026-10-13
updated: 2026-10-13
type: bug
reporter: claude
status: fixed
priority: normal
related: ['@conversation-actions-layout', '@recap-above-composer', '@bash-card-fidelity', '@turn-thread-fidelity']
preparation: ready
lane: web
lane_seq: 11
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Conversation view differs from the chosen draft in composer, recap, reply header and top bar

The implementation of @conversation-actions-layout and @recap-above-composer
(landed 2026-10-13) works, but its synthetic lab captures
(`issues/conversation-actions-layout/lab-*.png`,
`issues/recap-above-composer/lab-*.png`) differ visibly from the chosen draft
`design-system/drafts/Agentin vuoro.proto.html` (built from
`design-system/prototypes/lib/app.*`, `composer.*`, `recap.*`). Found by the
conductor comparing the captures:

- Stop is a text link "Keskeytä" at the left under the field; the draft has a
  round dark stop icon button (`.c-stop`, 30px, filled square).
- The "Ohjaa / Työn jälkeen" pill is oversized (large text, tall, heavy
  border); the draft pill is compact (26px buttons, 12px text, surface
  background, pressed state as a raised chip).
- The resting field is about two lines tall; the draft starts at one line
  (44px) and grows with the text.
- The recap card is wider than the composer column and its refresh button looks
  pressed; in the draft the card has the conversation column width and quiet
  icon buttons.
- The reply bubble header shows a stray glyph before "VASTAUS VALMIS" and the
  check after the copy button; the draft header is check + "Vastaus valmis",
  model, copy, time.
- A leftover centred "✓ Vuoro valmis 09.26" line follows the turn; the draft
  has no such line (the strip row carries the finished turn).
- The top bar puts title and workspace on two lines on desktop; the draft has
  them on one line (title, then workspace in muted mono), two lines only on the
  phone.
- The sidebar's workspace row has a white highlight box that stops short of the
  row's width; the draft's current row is the conversation row, and workspace
  rows have only hover.

Keep the deliberate deviations recorded in the two results (native-state
honesty: an unobserved process is not "finished", so it is not folded under
"Valmiit"; the existing queue panel). Fix together with @bash-card-fidelity and
@turn-thread-fidelity in one worktree, and verify with paired lab captures
against the draft at 1440 and 390, light and dark.
