# Result: Soniox key form padding

## What landed

- `web/src/app/SpeechSettings.tsx`: the Soniox-avain row (person's Sanelu and
  the administrator's Saneluavain) is an `s-row s-marked` row, the same
  icon-led row as the AI-key and subscription rows, so the title and status
  sit beside the mic instead of in the 1fr column's far half. The key form,
  the failure note and the administrator's status lines are `.s-editor`
  children of that row, as in Git-identiteetti and Claude sign-in, so the
  row supplies the card inset and they align with the title. Actions use
  `s-actions` (right-aligned) instead of the dialog's `ah-dialog-actions`;
  the region's Segmented sits in `s-val` like any row value.
- `web/src/components/Settings.css`: a row nested in an editor takes no
  second inset (`.s-editor > .s-row`), and `.s-editor` paragraphs drop
  `main p`'s bottom margin so the editor's own gap spaces them.
- `web/tests/speech-input.spec.ts`: Sanelu layout case at device scale 2,
  1280 and 390 px, light and dark: the key field, note and Tallenna keep
  ≥12 px from the card's left, right and bottom edges, the title follows the
  mic icon, no horizontal overflow, axe on `.s-main` in both themes.

Screenshots (device scale 2, card only): `attachments/before-sanelu-*.png`
reproduce Jari's report; `attachments/after-sanelu-*.png` show the fix.

## Other Settings cards checked

AI-avaimet adds keys in a dialog; Git-identiteetti, Claude sign-in and
Koodipalvelut already put their `.s-editor` inside a row; Integrations,
Gitea, GitLab and Apple use their own `ig-*` cards and dialogs. Sanelu was
the only card with an editor as a direct card child, so no other card had
the same cause. The margin rule also tightens the paragraph `.s-editor`
notices of Git-identiteetti, Claude sign-in and Koodipalvelut (no extra
bottom gap inside the row).

## Checks

- `test-focused.sh --area browser --spec speech-input.spec.ts`: 5 passed
  (new case failed on the old code: input 1 px from the card edge).
- `test-focused.sh --area web`: passed.
- Review: focused self-review (markup and CSS only; no daemon, contract,
  session state or authority path).

## Decisions for later review

- Form position: the key form now indents to the title column (beside the
  mic) rather than spanning the full card width. Alternative: full-width
  editor under the row. Chosen because the AI-key and subscription rows
  indent their content the same way.
- Tallenna/Peruuta right-aligned (`s-actions`) as in Git-identiteetti,
  instead of left as before.
