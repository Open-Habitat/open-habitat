# Result

An attached, pasted or dropped file is a chip above the composer field: an image chip has a small thumbnail, a file chip an icon, both the file name and a remove button. The field keeps exactly what the person typed. Clicking a chip, a thumbnail in a sent message, or an attached image in rendered Markdown opens Open Habitat's own dialog: an image at a size that fits the window with its name and *Avaa alkuperäinen*, any other file with its name, type and size and *Lataa*. Esc, an outside click and the close button close it; at phone width the dialog fills the screen with a small margin. A sent message shows the person's text without the reference lines or the host's `Attachment path:` lines, and its attachments as thumbnails and file chips.

## How the agent still gets the same reference

The draft value the composer stores, keeps per tab and sends is unchanged: the person's text followed by one `![name](/api/v1/attachments/<id>)` or `[name](/api/v1/attachments/<id>)` line per attachment. Only the presentation splits it: the field edits the text part, the chips show the reference lines, and every edit or removal writes the joined value back. No contract, daemon or agent-facing format changed.

## Decisions for later review

- **A reference line is an attachment.** A line that consists solely of an attachment reference becomes a chip, also one restored from the queue or typed by hand; a reference inside a sentence stays text. If a restored draft had a reference in the middle, the next edit moves it after the text; the agent receives the same references either way.
- **The host's `Attachment path:` lines are hidden in the sent bubble** only for attachments that message references. The daemon adds them for the agent; the copy button still copies the native message unchanged.
- **Type and size of a non-image file.** The host serves every non-image as `application/octet-stream` with no promised length, so the type shown is the file name's extension and the size is counted by reading the file when its preview opens (at most 20 MiB, once per opening). The read lives in `app/attachments.ts`, next to the upload the composer already calls.
- **Draft chips are compact for images too** (28 px thumbnail and name) so several fit above the field; a sent message keeps larger thumbnails (up to 180×120, 140×96 on a phone).
- **Markdown images** in agent replies that point at an attachment open the same dialog instead of a raw tab, for consistency; attachment links in Markdown still download as before.

## Validation

- `npx tsc --noEmit`, `biome check` on touched files, `vitest run` (whole web unit suite) — passed. New: `AttachmentChips.test.tsx` (typed text survives the draft round trip exactly, an inline reference stays text, only the message's own path lines are hidden) and a Composer case (field shows only text, editing and removing keep the other references, Enter sends the joined value).
- `./scripts/test-focused.sh --area browser --spec attachments.spec.ts` — passed against the host-backed synthetic host: picker, paste and drop add chips with an empty field; the file preview shows the counted size and downloads the original; Esc and outside click close; removing a chip leaves the field; the sent message carries the remaining references (same URL), shows no reference or path text, survives reload, and its thumbnail opens the dialog within 390 px; axe clean with the dialog open.
- `./scripts/test-focused.sh --area browser --lab --spec lab-composer-area.spec.ts` — 10 passed (attachment panel in four width/theme combinations now expects a chip and the untouched field).
- Captures from the synthetic lab (`web/lab/capture-composer-attachment-chip.mjs`), each with its static HTML: composer [1440](review/composer-1440.png) · [HTML](review/composer-1440.html), [390](review/composer-390.png) · [HTML](review/composer-390.html); image preview [1440](review/preview-image-1440.png) · [HTML](review/preview-image-1440.html), [390](review/preview-image-390.png) · [HTML](review/preview-image-390.html); file preview [1440](review/preview-file-1440.png) · [HTML](review/preview-file-1440.html), [390](review/preview-file-390.png) · [HTML](review/preview-file-390.html); sent message [1440](review/sent-1440.png) · [HTML](review/sent-1440.html), [390](review/sent-390.png) · [HTML](review/sent-390.html).
- Stories: `Production/Attachments` (sent message, image and file preview) and `Production/Composer area (Rivillä)/With Attachments`.
