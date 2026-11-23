# role-dave

Dave, HR and office. Three glimpses on the page (new packer, December rota,
personnel file) and three more behind the sidebar (Lena's last day, staff
survey, handbook audio).

## What the reader sees now

- **New packer (08:30).** A checklist document for Sami with a progress bar,
  the two steps already done, and the things forgotten at earlier starts
  flagged. The two messages are shown as drafts in the reply, unsent.
- **December rota (09:40).** The whole of December as one grid: ten people,
  four weeks, coloured by duty, with the kept wishes dotted and the two lost
  ones ringed; a toggle opens each week in words. The grid is the solver's
  real output.
- **Personnel file (13:20).** The redacted page as rendered from the real
  PDF, a toggle to the original and to the text a second program reads out
  of the redacted file, and a link to the PDF itself so the reader can try to
  select a name.

## What changed and why

- The rota and the redaction are no longer mocks. Every number the two
  scenes quote (23 rules, 17 of 19 wishes, 42 redactions, 16 lines before and
  0 after, the solver's status line, the per-document log) is read from
  `data.json`, which `assets.mjs` writes from what the programs printed.
  `block.js` draws the grid and the tool outputs from it; nothing is typed
  by hand, so the copy cannot drift from the result.
- The left-hand text follows the true result. The rota's two lost wishes and
  their reasons are real: re-solving with Bob's wish first drops Carol's
  instead, and with Dave's Friday first drops Kirsi's Monday to Wednesday.
- The replies were cut to a few lines so the view is on screen when the
  reader arrives; the detail moved into the work behind "Show work" (the
  rules file, lines of the model, the solver's output, the redaction list,
  the two name counts).
- Durations were port-derived and too long for the work shown (35 minutes for
  a solve that takes under a second). They are now 3 min 48 s, 8 min 52 s and
  7 min 05 s, and the ask times and sidebar `run` segments moved with them.
- The redaction reply ends by saying nothing has gone to the former employee:
  the copies wait for Dave's check.

## Assets and how they are made

`node blocks/role-dave/assets.mjs` (about 10 s; needs `uv`, `pdftotext`,
ImageMagick and Playwright's Chromium via `PROTO_WEB`). It writes
`data.json` here and three files to `$ETUSIVU_ASSETS/role-dave/`:

| File | Size | Made by |
|---|---|---|
| `page-original.webp` | 50 KB, 1090 × 930 | the generated PDF, rendered by MuPDF, cropped and encoded by ImageMagick |
| `page-redacted.webp` | 43 KB, 1090 × 930 | the same page after `tools/redact.py` |
| `shift-record-redacted.pdf` | 50 KB | the redacted PDF itself, linked from the view |

Programs: OR-Tools 9.15.6755 (CP-SAT), PyMuPDF 2.1 (MuPDF 1.28.6), Poppler's
`pdftotext` 24.02.0, Chromium from Playwright for printing the documents,
ImageMagick for WebP. Python runs through
`uv run --no-project --with ortools==9.15.6755 --with pymupdf==2.1`.

- `tools/rota_model.py`: ten invented people, 28 days, 23 hard rules and 19
  wishes as the objective (as many as possible; between two that clash, the
  one handed in first). One search worker and a fixed seed, so the grid is
  the same on every run. `check()` reads the finished grid and tests each of
  the 23 rules again with code that shares nothing with the model.
- `tools/make_file.py`: eleven invented documents for an invented former
  employee as HTML, with other people's details marked in the source; the
  marks become `redactions.csv`. `assets.mjs` prints them to PDF in Chromium.
- `tools/redact.py`: finds each listed text, adds a redaction annotation and
  applies it (MuPDF deletes the characters from the content stream), clears
  the metadata and rewrites the file without incremental save.
- The proof is independent: `pdftotext` (Poppler, not MuPDF) reads all eleven
  files back, and `assets.mjs` fails if any line still holds one of the six
  names.

`tools/` and `data.json` are text and committed; they are beyond the five
files BLOCKS.md lists, because the Python belongs in files a reader can run
and the screens must quote real output without the build depending on the
asset directory for text.

## Sources and licences

No third-party media. Everything shown is generated here from invented
content.

- Instrument Sans (SIL Open Font License 1.1, `design-system/fonts/`) is
  embedded as a subset in the PDF by Chromium; the OFL permits embedding.
- The tools are used, not shipped: OR-Tools (Apache 2.0), PyMuPDF and MuPDF
  (AGPL 3.0), Poppler (GPL), Chromium, ImageMagick. Their licences do not
  reach the output.

No field-standard claim is made about any program.

## Assumptions about the product

- The agent can install Python packages for one run with `uv run --with`,
  write files in the workspace and open a file in the view, as in the other
  blocks.
- The view can show a PDF page with a way to switch what is shown. The three
  buttons are the engine's `data-view` toggle; whether the product's view has
  such a control for a document is not checked.
- The link in the redaction view downloads a real file from the page's
  assets. In the product this would be the offer card; here it is a plain
  link because the offer card's button only pretends to save.

## For Jari

- The fictional frame has grown by a few invented names: Sami and the
  seasonal packers Noor, Tom and Iris on the rota, the former employee Nora
  Hale, and six former colleagues in her file (Mikael Strand, from round 6,
  and five more). The original page shows their invented details, which is
  the point of the before and after.
- The rota's rule 18 says full-timers work four or five days in a full week.
  With exactly five, the model was infeasible: Saturday shop shifts and "two
  days off in a row" cannot both hold. That is the kind of thing the solver
  finds and a person does not; it is not told on the page.
- The handbook as audio was optional and is not made: the glimpse is behind
  the sidebar, not one of the three shown, and the asset check accepts no
  audio format.
- `caps-data` points at this block's `rota` and `survey` conversations; both
  ids are unchanged.

## Engine needs

- **Audio.** `check.mjs` has no audio kind (`.mp3`, `.ogg`, `.m4a`) and the
  kit has no player, so a real spoken handbook chapter cannot ship.
- **A view beside the conversation at role width.** In the sticky screen the
  conversation column is about 577 px, under the 640 px at which the view
  moves beside it, so every role view sits below the reply and long replies
  push the result off the first screen. I kept the replies short instead.
- **A real download in `offer()`.** The offer card's button only shows "Saved
  to Downloads"; an optional `href` would let a block offer its actual file.
- **Toggle states in the check.** `check.mjs` clicks the view toggles but
  screenshots only closed and open work, so the other states of a view are
  not looked at unless the worker shoots them separately.
