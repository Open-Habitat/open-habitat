# Result

`ModelChip` now renders the header's pill in both locations: the same model
name, thinking icon and formatted thinking level, using the same control
primitive. Header information and composer choice remain native disclosures;
local selection, dismissal and focus handling are unchanged. On phones with
a model picker, the adjacent command/file tools use their existing icon-only
presentation so the full readout fits. Conversation rows were not touched.

The primary button reset fix from `model-picker-declutter` was already present
in this starting tree. No second CSS override was needed: the browser now checks
that the resting button uses the actual accent/on-accent tokens, rather than
merely having a nontransparent background. This passes in both themes.

## Validation

Based on `7ddc790cd028bbf29d667d872238c89d2f1789d8`; the fix commit carries the
final tested source. Builds/scratch use `/var/tmp`; browser suites ran serially
through the installed remote dispatcher against synthetic hosts.

- `npm ci --prefix web`: passed.
- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: passed (536 tests,
  format, lint and typecheck).
- `npm run build-storybook --prefix web`: passed. The composer story displays
  both production chips with the same selected model/thinking props.
- `./scripts/test-focused.sh --area browser --spec lab-picker-declutter.spec.ts`:
  passed. Four viewport/theme combinations check matching readout and computed
  appearance/width, primary tokens before hover, bounded panel geometry, axe,
  outside/Escape dismissal, focus restoration, local commit and settings link.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts --tag @model-controls`:
  3 passed; conversation-local selection, preserved draft and native default
  independence, including 390 px.
- `issuectl doctor --json` and `git diff --check`: passed.

No contracts, Go, daemon or shared application state changed; no independent
review or full gate was required. No live-provider or UID-isolation claim.

## Visual review

Compared the synthetic captures against the compact composer direction in
`design-system/prototypes/rounds/2026-10-19-koko-alakerta/round.js` and
`round.css`, with this issue's explicit instruction to replace the earlier
composer readout with the header design. Kept the pill radius, token surfaces,
inline sizing and bottom-anchored chooser. The phone check additionally compares
chip widths: the first captures exposed clipping of the thinking text, corrected
with the icon-only adjacent tools before final capture. Header layout outside
the chip remains unchanged and is outside this issue.

Each screenshot has an adjacent static HTML snapshot. These are human-review
material, not automated screenshot comparisons.

| View | Light | Dark |
| --- | --- | --- |
| Desktop chips | [image](attachments/chips-1366-light.webp) | [image](attachments/chips-1366-dark.webp) |
| 390 px chips | [image](attachments/chips-390-light.webp) | [image](attachments/chips-390-dark.webp) |
| Desktop picker | [image](attachments/picker-1366-light.webp) | [image](attachments/picker-1366-dark.webp) |
| 390 px picker | [image](attachments/picker-390-light.webp) | [image](attachments/picker-390-dark.webp) |

## Failure inventory

- Initial web lint found an unused `Icon` import left by extraction. Removed it
  and reran the full focused web checks successfully.
- The next web run timed out in the unrelated integration sign-in typing test
  at its 5-second limit (535 passed). Reduced the declared web worker budget to
  two and reran successfully; no integration code or timeout was changed.
- Initial extended browser check expected a model attribute before native Pi
  had reported a model. The test now explicitly chooses a local model first,
  exercising a real named readout instead of unknown state; reruns passed.
- Exploratory reads/searches tried some nonexistent guessed CSS/config/component
  paths and a nonexistent runner module/job directory. Located the actual files
  from imports and the installed runner modules instead. No validation step was
  omitted because of these discovery misses. An out-of-range log read was
  corrected by reading the whole short log.

No failed service, delegated reviewer or required incomplete workflow remains.
Build warnings about PostCSS metadata/chunk size and jsdom's unimplemented canvas
are retained as warnings, not passing evidence for those unrelated surfaces.
