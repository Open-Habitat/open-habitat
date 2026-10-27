# Result

The image block Pi received with the person's own attachment no longer shows in
the bubble: when the message's text carries an image attachment reference, its
native image blocks are skipped, and the thumbnail chip (which opens the preview)
is the attachment's only appearance. An agent's or tool's image keeps
*Lataa lohkon sisältö*; once loaded it is bounded to the bubble's width and
320 px high (the same height as a text block), keeping its aspect ratio.

## Validation

- `./scripts/test-focused.sh --area web`: format, lint, types and unit tests
  passed. A new `HistoryView.test.tsx` case covers the own-message skip; the
  result-image case checks the bounding class.
- `./scripts/test-focused.sh --area browser --spec history-images.spec.ts`
  (new) passed. The synthetic host's new `/fixture/history?mode=images` writes
  a native session with an attached 1600×1000 image (reference, path line and
  image block, as the host sends it) and a tool returning the same image.
  The spec asserts that the own bubble has one chip and no image block, and
  that the loaded tool image fits the feed and is at most 320 px high.
- `attachments.spec.ts` passed (sent-attachment chips unchanged);
  `go vet` and `go test ./test/browser-host/` passed.

## Screenshots (device scale factor 2, synthetic host)

- [before-own-message.png](screenshots/before-own-message.png): the attachment
  twice, as *Kuva · image/png* plus the full-width loaded image above the chip.
- [after-own-message.png](screenshots/after-own-message.png): text and chip
  only.
- [before-tool-image.png](screenshots/before-tool-image.png): the tool image
  rendered at 1600×1000 CSS px and overflowing the view.
- [after-tool-image.png](screenshots/after-tool-image.png): the same image at
  512×320.

## Decisions for later review

- The own-message image blocks are hidden only when the message's text has an
  image attachment reference. An image that arrived without one, such as a
  screenshot pasted into Pi in a terminal, has no chip, so its block still
  shows (now size-bounded) rather than disappearing.
- The bound is 320 px high, matching the text-block preview, and the loaded
  image does not open in a preview. If a larger view is wanted, the next
  step would be to open it in `AttachmentPreview`'s dialog.
