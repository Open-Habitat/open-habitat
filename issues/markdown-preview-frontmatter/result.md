# Result: Markdown previews show frontmatter as metadata

Every preview of a Markdown *file* now recognises a leading YAML frontmatter
block and shows it as a quiet key–value box above the body, in the design
system's sunken style. Keys are in monospace, long values wrap, and nested
or list values appear as their YAML text. A block the reader does not
understand appears as a quiet code block, never as a rule and a paragraph.
The body renders as before.

The parser is `web/src/components/frontmatter.ts`: keys and scalars (plain,
quoted, multi-line, `|`/`>` block scalars) are read, and other values keep
their YAML source. Nothing is evaluated and no YAML library is added. The
renderer is the shared `MarkdownRenderer`, opted in with `document`. These
previews use it:

- the file offer panel and attachment preview (`DocumentPreview`);
- the editor's full Markdown preview (`BrowserEditor`), whose heading-based
  scroll sync now skips the frontmatter lines (`headingLines`), so a YAML
  comment `# …` there no longer counts as a heading;
- the rendered view of a ```` ```markdown ```` fence in a reply.

Screenshots (device scale factor 2, the real `personal-data` skill file in
the file offer panel): [desktop light](frontmatter-1440-light.png),
[desktop dark](frontmatter-1440-dark.png), [phone light](frontmatter-390-light.png),
[phone dark](frontmatter-390-dark.png). The panel title says `tiedote.md`
because the spec serves the skill file's bytes under the fixture offer's
name.

Checks: `scripts/test-focused.sh --area web` (1599 tests including the new
`frontmatter.test.ts`), and the browser specs `agent-file-offers` (new case
included), `attachment-documents`, `markdown-block-preview` and
`browser-editor`, all green with one or two workers.

## Decisions for later review

- **Messages are left alone.** Chat messages and agent replies do not get
  the frontmatter treatment. A reply that starts with `---` is the author's
  own rule. Alternative: parse everywhere. Rejected because it would turn
  ordinary replies into metadata boxes.
- **No closing line means no frontmatter.** A file that starts with `---` but
  has no later `---`/`...` line renders as before, with the opening line as a
  rule. Alternative: treat it as malformed frontmatter. Rejected because a
  document may legitimately open with a thematic break.
- **Label "Metatiedot" / "Metadata"** is the region's accessible name only.
  There is no visible caption, because the keys already make clear what the
  box is. Alternative: a visible "Tiedoston tiedot" heading. Not chosen
  because it would add noise above every skill file.
- **An empty block** (`---` directly followed by `---`) shows nothing.
- **Phone width** (≤600 px) stacks each key above its value instead of using
  two columns.
