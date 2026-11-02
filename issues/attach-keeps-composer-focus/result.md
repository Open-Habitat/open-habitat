# Result

**Cause.** Nothing moved the focus after an upload. A drop leaves it where
it was (often on the conversation), the *Liitä* picker leaves it on the
paperclip (React Aria restores it there when its menu closes) or on `body`
once the paperclip is disabled during the upload.

**Fix.** `Composer` remembers the reference of the attachment it just put in
the draft, and a layout effect on the draft focuses the field with the caret
at the end of the text in the render where that attachment shows as a chip:
no timer or frame, so a busy machine cannot run it before the chip and field
are there. Drop, paste and picker all go through it. On a touch screen
(`pointer: coarse`) the field is focused only if it had the focus when the
paperclip was pressed (or at the drop), so the picker does not open a closed
keyboard; paste always comes from a focused field.

**Evidence.** `Composer.test.tsx` "focus after an attachment": drop, picker
and touch-screen picker fail without the fix (3/3), pass with it; a fourth
case keeps the focus in another field the person moved to during the
upload. `attachments.spec.ts` "a dropped or picked attachment leaves the
person writing on from the end of the draft" fails without the fix
(`toBeFocused` after the drop) and passes with it, together with the
existing attachments case (2/2, `OH_BROWSER_WORKERS=2`). Web fast checks
1231/1231.

## Decisions for later review

- **A field elsewhere keeps the focus.** If the person moved to another
  text field (an input, textarea or contenteditable) while the upload ran,
  the attachment does not take the focus away. Alternative: always focus the
  composer. An upload of a large file can take seconds; stealing the focus
  from where someone is typing is worse than having to click the field.
- **Touch screen means `pointer: coarse`**, the same query composer.css uses
  for the field's size on a phone. A tablet with a keyboard counts as touch.
  Alternative: a width breakpoint; it would misjudge a narrow desktop window.
- **On a touch screen a drop follows the same rule as the picker** (focus
  only if the field had it); the issue named only the picker.
