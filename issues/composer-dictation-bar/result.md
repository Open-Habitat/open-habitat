# Result: Sanelupalkki (Palkki) behind an experimental switch

Asetukset › Kokeelliset ominaisuudet › **Sanelupalkki** (`composer-dictation-bar`)
switches the composer row to round 2's *Palkki* with round 1's *Ankkuroitu*
order: aids | space | Ohjaa, Stop, divider | Sanele, Send. Off, the row is
unchanged: the same DOM and the same CSS as before (the old phone dictation
rules are scoped to the row without the bar).

- **Fixed slots.** Sanele/Valmis share one 86 px slot (36 px on a phone),
  Send keeps its own; the work controls are born left of them. While
  dictating, the aids, the space and the first-message model picker stay in
  place under the bar (`visibility: hidden`), so the bar is the only thing
  whose length changes.
- **The bar**: ×, dot, time, state ("kuuntelee · yhdistää…" while the stream
  opens, as the prototype), a waveform of the microphone level sampled every
  90 ms (newest at the right, narrow widths show only the newest), and
  "Enter valmis". Phone: no state label, no time while the agent works, no
  keyboard hint; Valmis is a ✓.
- **Cancel** is a new engine operation `Dictation.cancel()`: it releases the
  microphone and the socket at once, sends no end-of-stream frame and ends
  with `ended: "cancelled"` and an empty `final`, so nothing reaches the field
  and no notice shows. Focus returns to the field.
- **Round 1 phone defects** in the bar's row: aids and chip are 36 px through
  the row's own specificity; Sanele is never drawn under Send; Valmis never
  over the Ohjaa chip (browser spec measures all three at 390 and 360 px).
- Liitä loses the primitive's fill in the bar's row, like the other aids.

Evidence: `evidence/*.png` (composer only; desktop rest, working, dictating,
dictating while working; phone 390/360 rest and dictating while working;
light and dark), captured by `OH_VISUAL_CAPTURE=1` on
`web/tests/dictation-bar.spec.ts`. The headless microphone is silent, so the
screenshots show a flat wave; `Dictation.test.tsx` covers the waveform.

## Decisions for later review

- **Off-state row left exactly as today**, including its 28 px phone aids.
  Alternative: fix the specificity defect for everyone. Chosen because the
  brief says the row stays as today with the switch off; when Palkki
  becomes the default the old rules go.
- **Hints are `title` tooltips**, as the rest of the row (Sanele names the
  shortcut, Valmis names Enter, Esc and the shortcut), plus the visible
  "Enter valmis" in the bar. The prototype drew a styled tooltip only so
  the screenshot would show it.
- **Mouse start leaves focus where it was**; a keyboard or shortcut start
  focuses Valmis (as the old pill did). Enter still ends the dictation from
  the page body or the field.
- **Valmis stays visible during a press-and-hold** (the old pill hid its
  Valmis), so the slot never changes; the bar's label says "päästä irti,
  niin sanelu loppuu".
- **The divider** shows whenever a work control (Ohjaa, the running-command
  chip or Stop) is in the row, desktop only, as in the prototype.
- **Phone "Työn jälkeen" chip reads "Jälkeen"** and drops its swap arrow, so
  the working row fits 360 px (round 1's phone decision).
- **Shell mode** (`!`) still hides Sanele and its slot, as today.
- **design-system/design.md** still describes the old row; it is rewritten
  when Palkki stops being experimental.
