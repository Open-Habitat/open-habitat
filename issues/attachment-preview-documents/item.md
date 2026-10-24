---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: done
priority: normal
preparation: ready
lane: unlaned
collision: [web/src/components/AttachmentPreview]
closed: 2026-10-24
closed_by: claude-opus-5-5
---

# Attachment preview for PDF, Markdown and Office documents

## Description

Jari, 2026-10-24, after trying attachment chips (`composer-attachment-chip`): "Toimii. Tarvitsemme kuitenkin esikatselun muillekin kuin kuville. Pdf, tyypilliset office-dokumentit, md-tiedostot."

Goal: the in-app attachment preview dialog shows the content of PDF, Markdown and typical Office documents (Word .docx, Excel .xlsx, PowerPoint .pptx; legacy .doc/.xls/.ppt may fall back to name/type/size), in the composer and in sent messages, desktop and phone. Other types keep today's name/type/size view.

- PDF: page rendering in the dialog (browser viewer in a sandboxed frame or pdf.js), never executing document scripts.
- Markdown: rendered with the app's existing Markdown renderer and its sanitising rules; raw/rendered toggle optional.
- Office: decide the approach. Client-side rendering with small mature permissively licensed libraries (e.g. docx and xlsx renderers) is pre-approved; record choice, license and pin. A server-side converter (e.g. LibreOffice headless) is a major dependency and an installation change: do not add it; if client-side quality is unacceptable for a format, ship the others and bring the server-side option to Jari as a recommendation.
- Preview content is fetched with the same attachment authorisation as today; nothing is uploaded elsewhere; large files have a size limit with a clear fallback.

## Acceptance Criteria

- [ ] PDF, .md, .docx, .xlsx, .pptx previews in the dialog (or a recorded, reasoned fallback for a format), unit tests and a browser spec with fixtures, story per type, phone layout.
- [ ] No script execution from previewed documents (test for a PDF with JavaScript and HTML in Markdown).
- [ ] KOKEILTAVAA.md line.

## Resolution

### 2026-10-24T08:11:46Z · @claude-opus-5-5

Implemented: PDF (pdf.js), Markdown (app renderer), .docx (docx-preview in sandboxed frame), .xlsx/.pptx (own fflate readers; pptx as outline). result.md lists decisions for later review.
