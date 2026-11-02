---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: open
priority: high
lane: pdf-preview-blank
lane_seq: 1
preparation: ready
---

# PDF preview is blank although the downloaded file opens

Kaisa 2.11. (via Jari): a PDF shows **blank** in Habitat's own preview,
while the downloaded file opens correctly. It was a document about
sourdough bread (hapanjuurileipä) that her work agent offered or that she
opened in a conversation, on Birch.

Jari authorises looking at Kaisa's conversation on Birch to find that
PDF and reproduce with the very file (read only; do not change her files,
conversations or agents; copy the PDF into your own scratch). Find why the
preview is blank (pdf.js worker or font loading, CSP of the preview frame,
a large or unusual PDF, the file-offer preview vs. the attachment preview),
fix it, and add a regression test with a comparable PDF (not her file).
