---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: host-context
lane_seq: 2
collision: [host-context]
closed: 2026-10-20
---

# File links do not appear in agent replies

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: clickable file links (path:line opening in the editor) never appeared in replies, or he did not know how to ask for them. Check both ends: does the agent write paths in a form the UI recognises (relative workspace paths, path:line, backticks), and does detection work for real Pi/Claude/GPT output (code spans, markdown links, absolute ~/src paths)? Make detection robust to the forms models actually produce and tell the agent in the host context to reference files as workspace-relative path:line. Done: real-model sample replies in a lab render links; test cases from those samples.

## Acceptance Criteria

- [x] Backticked, plain-prose and Markdown workspace file references open the requested path and line in the editor.
- [x] Host context recommends workspace-relative `path:line` and distinguishes sibling-workspace references.
- [x] Regression coverage includes ranges, columns, Markdown `#L` anchors, unsafe paths, code fences and nested code labels.

## Result

The old renderer only recognized an entire inline-code span, and its URL filter
removed bare Markdown file destinations. A Markdown-tree transform now recognizes
prose references and normalizes relative file destinations before sanitization;
file anchors use the existing editor action, not app-origin navigation. Code
fences and existing external links are not scanned. Backticked link labels do
not create nested anchors. No sanitizer protocols or filesystem authority were
broadened. Absolute and `~/src/...` paths deliberately remain text: the browser
cannot safely infer which workspace they name. The host guidance now explains
the supported relative form without contradicting cross-workspace tool access.

Focused self-review was proportionate: this changes rendering and agent guidance,
not Unix-user separation, gateway/daemon authority or installation hardening.
The existing daemon remains the authority on whether a relative file can open.

### Validation

Remote Linux ARM64 runner, source based on `b7d84c850cd15d7da504187fab76a44eee18fc9a`
plus this issue's implementation; explicit untracked selections were
`web/src/components/remarkFileRefs.ts` and
`web/src/components/MarkdownRenderer.test.tsx`. All checks used `umask 077` and
`TMPDIR=/var/tmp`.

- `./scripts/test-focused.sh --area web`: **passed**, job
  `98919f1e58c834ed1f5f54fa7f409d9b4184e29ab02b597e445b1e32047b33ed`.
  Includes formatting, lint, TypeScript, unit and component checks.
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`:
  **5 passed**, including a11y and actual editor opens from code, prose and
  Markdown-anchor forms; job
  `6bbffeb5230302c10195f50f7c68e901207ba0555d5abb631779a7b9ce6d17a6`.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  **passed** (52.175 s package execution), job
  `f60156a75959d046a37af16cba4005912ab190e2decfd81ebd83566599ebd3a1`.
  The remote job prepared the pinned native Pi fixture dependencies.
- `./scripts/test-focused.sh --area contracts`: **passed**, job
  `e3f2a1fea30ac255bf2a34a7fdba1d4d3939a0ca5c5ee2cd5c4865e3b4693396`.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: **passed**.

The final web rerun changed only two new unit-test assertions (nullable sanitized
href and adjacent text-node matching), not production code or browser/Go inputs.
An earlier TypeScript union-array error in the transform was fixed before the
passing browser/Go/contracts runs. The regression replies are representative
model syntax, not claimed live Pi/Claude/GPT transcripts. Lab screenshots/HTML
were deferred under this host's no-local-lab policy; browser evidence is
host-backed synthetic, not live-provider or distinct-UID evidence. No clean gate,
push or test-server action was performed.
