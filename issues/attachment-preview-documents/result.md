# Result: attachment preview for PDF, Markdown and Office documents

The attachment dialog now shows the content of PDF, Markdown, .docx, .xlsx
and .pptx files, from a composer chip and from a sent message, on desktop and
phone. Other types, including legacy .doc/.xls/.ppt, keep the name, type and
size view. The dialog reads the bytes once with the same authenticated
same-origin fetch as before (`readAttachment`, capped at the 20 MiB upload
limit); nothing is sent anywhere else, and the renderers load only when a
document is opened.

| Format | How it is shown | What keeps it inert |
|---|---|---|
| PDF | pdf.js (`pdfjs-dist` 6.4.299, Apache-2.0) draws pages onto canvases as they scroll near; at most 200 pages | Only pdf.js core and worker ship; the scripting sandbox lives in its viewer, which is not used |
| Markdown | The app's existing `Markdown` renderer | Its `skipHtml`, sanitize allowlist and URL filter; only attachment images load |
| .docx | `docx-preview` 0.4.1 (Apache-2.0) lays the document out | Built into an inert document with altChunk rendering off, cleaned by `inertMarkup`, shown in `<iframe sandbox="">` with a CSP that allows only inline styles and `data:` images and fonts |
| .xlsx | Own reader over `fflate` 0.8.3 (MIT): visible sheets as tabs of plain tables, cached values, dates from the number format, at most 1000 × 50 cells | Text rendered by React |
| .pptx | Own reader: each slide's title, text by level, tables and embedded PNG/JPEG/GIF/WebP pictures | Text rendered by React; external picture references are never followed |

An Office zip whose declared contents exceed 100 MiB or 10 000 entries is
refused before anything is inflated, and a document a renderer cannot read
shows a short note above the facts and the download.

Evidence: `web/src/app/documentPreview.test.ts` (kind detection, zip limits,
workbook and deck readers, the sanitiser), `web/src/components/AttachmentPreview.test.tsx`
(the dialog per type, fallbacks, the Word page carries no script, altChunk or
`javascript:`), `web/tests/attachment-documents.spec.ts` (all five types plus
a legacy file through the real host and Chromium: a PDF whose open action
calls `app.alert` and sets a global, Markdown with `<script>` and `onerror`,
a Word file with a `javascript:` link and a scripted altChunk; no dialog, no
global, the Word frame is unreachable from the app, axe clean, phone width
fits). Stories `Production/Attachments` cover each type and the phone layout.
Fixtures are generated in `web/src/app/documentFixtures.ts` rather than
committed as binaries.

## Decisions for later review

- **PowerPoint is an outline, not slides.** No small, maintained, permissively
  licensed library that lays slides out in the browser was found (PPTXjs
  depends on jQuery; the small npm renderers are young single-author
  packages). The preview
  shows each slide's text, tables and pictures, enough to recognise the deck.
  If Jari wants slide layout, the route is a server-side converter
  (LibreOffice headless to PDF, then the PDF preview). That is a major
  dependency and an installation change, so it was not added; recommendation:
  only if real decks prove unrecognisable in the outline.
- **Excel through our own small reader instead of SheetJS.** SheetJS's npm
  release is the stale 0.18.5 with known advisories; maintained releases come
  from its own CDN tarball. A ~150-line reader over `fflate` shows cached
  values; it does not apply number formats beyond dates, merged cells,
  colours or charts.
- **Word through docx-preview rather than mammoth.** docx-preview keeps page
  layout and styles; mammoth produces semantic HTML only. Either output needed
  the inert frame.
- **The Word frame cannot size itself or pass keys out.** With no scripts in
  the frame it scrolls inside the dialog, and once focus is inside it Escape
  stays there; the dialog closes with its close button or a click outside.
- **Limits:** PDF 200 pages, Markdown 1 MiB, Office 100 MiB declared
  uncompressed, sheets 1000 rows × 50 columns. A zip that lies about its sizes
  can still exhaust the person's own tab, which the browser contains.
- **Plain text (.txt, .csv, source files) still shows facts only.** It would
  be cheap to add with the same dialog, but the issue did not ask for it.
- **PDF without wasm/CMap assets.** JPEG 2000 images and some CJK fonts
  without embedded data may render imperfectly; their assets are not bundled.
