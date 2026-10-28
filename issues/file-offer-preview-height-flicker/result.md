# Result

**Cause.** `AttachmentPreview` read the file in an effect that depended on its
`read` prop. `OfferedFilePreview` passes a new closure on every render, so each
time the conversation behind the dialog rendered (a snapshot, list or process
refresh, a new message), the dialog read the file again. Each re-read first
emptied it (`bytes` back to `undefined`, so the dialog lost its
`ah-attachment-preview-document` class and shrank to the facts view) and then
refilled it at full height. This happened for every kind read from bytes
(CSV, Excel, PDF and others), which matches what Jari saw. PDF's
`aspectRatio`/`IntersectionObserver` was not involved: once a document is
loaded, the dialog's height is fixed by CSS. Measured on a synthetic host
before the fix: 6 reads of the CSV within about 2 s of opening, each after an
app refresh.

**Fix.** The effect now depends on the file's URL (plus `image`/`unread`) and
calls the latest `read` through a ref, so a file is read once per opening
whoever the caller is.

**Evidence.**
- Unit (`AttachmentPreview.test.tsx`): re-rendering with a new `read` closure
  calls it once. Fails on the old effect.
- Browser (`agent-file-offers.spec.ts`): with the CSV preview open, the agent
  offers another file; the dialog still shows the table and the file was
  read once. The old code reads twice (fails), the fix reads once (passed
  three runs).

Same-UID synthetic host and Chromium on Linux; not observed on Jari's Mac
before landing.
