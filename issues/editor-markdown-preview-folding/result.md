# Result

Habitat's own CodeMirror editor (`web/src/components/BrowserEditor.tsx`,
`CodeMirrorEditor.tsx`) now previews Markdown files and folds headings.

**Preview.** For `.md`/`.markdown` files the toolbar shows *Esikatselu*
(`aria-pressed`). The keys are VS Code's: Ctrl/Cmd+K then V toggles the
preview beside the text, Ctrl/Cmd+Shift+V toggles it in place of the text.
Where the editor pane is narrower than 720 px (phone, or a desktop split
with the conversation beside it), "beside" becomes "in place of", so the
button is a toggle between text and preview there. The text stays mounted
while hidden, so its history, cursor and folds survive. The preview renders
the live buffer, not the saved file, through the conversation's `Markdown`
component (same sanitiser, code blocks and Mermaid), deferred behind typing.
Focus moves to the remaining pane when the focused one is hidden.

**Folding.** `foldGutter()` and CodeMirror's `foldKeymap` are on for every
file; ranges come from the grammar. lang-markdown folds a heading's section
up to the next heading of the same or higher level (and fenced code), code
grammars fold their blocks, plain text has nothing to fold. Keys:
Ctrl+Shift+[ / ] (Cmd+Alt+[ / ] on macOS, VS Code's own bindings), and
Ctrl+Alt+[ / ] fold/unfold all. Fold marker titles and the screen-reader
announcement are in Finnish via `EditorState.phrases`.

## VS Code (code-server)

Yes, it does both. The pinned code-server 4.141.0 tarball contains
`lib/vscode/extensions/markdown-language-features`, whose `package.json`
binds `markdown.togglePreview` to Ctrl/Cmd+Shift+V and
`markdown.showPreviewToSide` to Ctrl/Cmd+K V (read from the release
tarball 2026-10-27). The same built-in extension provides heading folding
ranges, which VS Code shows in its fold gutter with Ctrl+Shift+[ / ].
Not checked live in a running code-server. VS Code's built-in preview does
not draw Mermaid without an extra extension; Habitat's preview does.

## Evidence

`web/tests/browser-editor.spec.ts` "markdown preview and heading folds"
(1366 and 390, device scale factor 2, host-backed, fixture
`cmd/notes.md` added to `test/browser-host`): no preview button for Go;
gutter fold hides the section but not the next `##`; keyboard unfold,
keyboard fold, gutter unfold; Ctrl+Shift+V replaces the text with the
rendered preview (h1, Mermaid diagram) and back with focus returned;
the button shows it beside the text at desktop width and in its place at
390; typing updates the preview; axe clean; Ctrl+K V closes it.
`OH_VISUAL_CAPTURE=1` refreshes the screenshots in `evidence/`
(`folded-*.png`, `preview-*.png`).

Checks (2026-10-27, Birch, `umask 077`): `./scripts/test-focused.sh --area
web` passed; `browser-editor.spec.ts` 19/19; `go vet ./test/browser-host`.
The whole `npm run test:browser` ran while other worktrees' suites shared
the machine and its fixed ports: 378 passed, 27 failed, none in the editor.
After installing the Pi SDK fixture, rerunning the failed specs left
`start-here`, `site-ai-key` (one case) and `live-long-run`; those pass
alone both on this branch and on main (8/8 each), so they were load or
contention, not this change. An earlier fixture name, `cmd/NOTES.md`,
sorted before `main.go` and broke the tree-keyboard test; it is
`cmd/notes.md` now.

## Decisions for later review

- **Two preview modes, one button.** The button toggles "beside"; only
  Ctrl/Cmd+Shift+V gives "in place" on a wide editor. Alternative: a
  three-way control. Chosen to keep the toolbar to one quiet button.
- **720 px breakpoint on the editor pane, not the viewport.** With the
  conversation beside the editor at 1366 the pane is narrower, so the
  preview replaces the text until the conversation is hidden. Alternative:
  a lower breakpoint giving two ~300 px columns.
- **Preview mode is per session, not per file and not persisted.** It
  survives switching files; non-Markdown files ignore it.
- **No scroll sync** between text and preview. VS Code has it; it is a
  separate piece of work if wanted.
- **Folding for all grammars**, not only Markdown, because it comes free
  with the same gutter and keys.
- **Links in the preview** behave as in the conversation outside a file-link
  context: workspace paths are plain, web links open in a new tab. Relative
  links are not resolved against the Markdown file's directory.
- **Ctrl+K is swallowed in Markdown files** as the chord prefix (Cmd+K on
  Apple keyboards, where Ctrl+K stays CodeMirror's delete-to-line-end).
- **Phone toolbar:** the file name now keeps at least 12ch on narrow
  screens, pushing buttons to a second row instead of breaking the path one
  letter per line (visible once *Muokattu* and *Esikatselu* share the row).
