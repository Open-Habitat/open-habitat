# Result

The dictation bar is the composer's only row. The *Sanelupalkki* card,
its settings-search row, the `composer-dictation-bar` feature id and the
composer's old row (the recording pill beside the aids and its phone
rules) are gone. Esc while dictating cancels like ✕; a cancel that heard
something leaves a *Sanelu peruttu* notice with *Palauta*. Sanele's
shortcut is in the app's own tooltip (`role="tooltip"`, linked with
`aria-describedby`), shown on hover after 150 ms and at once on keyboard
focus, instead of the browser's `title`.

Evidence (device scale factor 2, light and dark): `evidence/` from
`OH_VISUAL_CAPTURE=1` runs of `web/tests/dictation-bar.spec.ts`, desktop at
rest, at work, dictating, cancelled with *Palauta*, the tooltip, and 390
and 360 px phones at rest and dictating at work.

Phone Stop is now 36 px like the row's other touch controls (it was 34 px
in the bar), which the lab phone spec requires.

## Decisions for later review

- **Undo for a cancelled dictation: a *Palauta* notice under the field.**
  Both ✕ and Esc keep what was heard (the confirmed text and the current
  guess) and show the notice; *Palauta* puts the words where the dictation
  was said. If the field has changed since the cancel, the words go after
  the new text, so neither the edit nor the dictation is lost. A cancel
  that heard nothing shows no notice. Alternatives: ⌘Z in the field (the
  textarea's native undo stack never saw the dictated text, so it would
  need a custom undo history), or a timed toast (vanishes before a person
  notices what was lost). The notice reuses the existing dictation notice,
  stays until dismissed, a new dictation or *Palauta*.
- **✕ also offers *Palauta*.** The brief says Esc cancels "like ✕"; giving
  only one of them the undo would make them differ. Alternative: ✕ stays
  silent as a deliberate click. Chosen for one rule: a cancel is undoable.
- **Esc while *Viimeistellään…* (after Valmis or Enter) does nothing.**
  ✕ is disabled in that phase, so Esc follows it; the person already said
  done.
- **Tooltip delay 150 ms on hover, none on keyboard focus**, matching the
  conversation header's activity tooltip pattern; long enough that sweeping
  the pointer across the row does not flash it.
- **The recording pill (`DictationControl`) stays, for the workspace
  icon's one-line wish field only.** That field gained dictation on main
  while this work was under way (`workspace-icon-polish`); the composer's
  bar needs a row of aids to cover, which a one-line form does not have.
  Esc there now cancels with *Palauta* too, and its tooltip is the quick
  one. Alternative: Valmis in Sanele's slot alone (no recording sign but
  the field's own live text). Revisit if the wish field gets its own
  design.
- **Desktop Stop stays 28 px** as the bar designed it (proto-composer-actions
  round 2); the lab spec that pinned the old row's 32 px now pins 28 px.
