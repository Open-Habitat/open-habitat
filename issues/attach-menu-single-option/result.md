# Result

The paperclip now invokes the system file picker directly. There is no second attachment choice today. Removed the dialog, its stylesheet and four unused messages in both catalogs. Upload and focus ownership stay in Composer, unchanged.

## Decisions for later review

- Remove the menu outright rather than retain a dormant menu branch: no real second action exists. The component filename remains unchanged to keep this change localized alongside the parallel composer work.

## Verification

Focused self-review: checked synchronous user-gesture delivery to the hidden input, disabled handling, pointer/keyboard focus capture and all references to removed dialog controls. No host, session-state or authority changes.

On base 81873c3d plus this commit's changes:

- `./scripts/test-focused.sh --area web`: 168 files, 1252 tests passed, plus static checks. Existing touch-focus tests remain; the picker focus test now proves the first paperclip click invokes the input exactly once.
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts`: 2 passed.
- Same command with `composer-geometry.spec.ts`: 4 passed (390/1440, light/dark).
- Same command with `lab-composer-area.spec.ts`: 10 passed, including direct keyboard/pointer picker activation, empty selection/draft retention and attachment-control axe audits at both widths/themes.
- Browser runs used `OH_PORT_BASE=11200`, `OH_BROWSER_WORKERS=2`, private disk-backed TMPDIR and umask 077. Host-backed synthetic Chromium evidence, not real iPhone/native-picker UI evidence.

The removed geometry/dismissal assertions caught transparent, overflowing or poorly positioned attachment menus and broken menu close/focus behavior. That surface no longer exists. Direct picker activation and draft retention replace them; upload/focus coverage remains in attachments.spec.ts and Composer.test.tsx.

`attachment-390-light.{png,html}` is the synthetic lab view before opening the OS picker. The OS dialog is not web DOM and cannot be represented in that snapshot. Reviewed the screenshot; the paperclip remains in the composer row.

The supplied `/var/tmp/oh-r54/` screenshots were absent on this worker host; the explicit brief and existing implementation establish the requested change. No personal screenshots were copied or committed. A steering message to the parallel composer worker was unsupported; edits were kept to the two small caller regions and the existing focus test. An initial multi-`--spec` invocation selected only the final spec; the other two were subsequently run separately and passed. An ambiguous edit was rejected without changes and retried with unique contexts.
