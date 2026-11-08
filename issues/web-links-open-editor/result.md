# Result

Web addresses no longer become workspace file references. Prose, Markdown link destinations and inline code share address recognition; web links use a new tab with noopener/noreferrer. Filename-like paths still open in the editor, and nested code labels never create nested anchors. No daemon, contract, session state or authority changes.

## Decisions for later review

- Scheme-less recognised domains use HTTPS, rather than HTTP or navigating relative to Habitat.
- Bare-domain recognition uses a conservative set of common web suffixes, rather than treating every dotted name as a domain (which would break `notes.txt`, `README.md`, source files). Explicit HTTP(S) addresses work independently of that set. Unlisted bare suffixes remain ambiguous; use an explicit scheme for those. Explicit `./example.com` remains a file reference. No DNS checks or dependency added.
- Inline code consisting of a web address is clickable, including where no editor is available. Fenced code remains literal.

## Evidence

On Birch, working tree based on `13a31034056cc89e25d268a7f5d66ceeda053d7d`, with the implementation and tests in this issue's fixing commit:

- `./scripts/test-focused.sh --area web`: passed, 188 files / 1420 tests, static and catalog checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15200 ./scripts/test-focused.sh --area browser --spec message-web-links.spec.ts`: passed (1 case). Production browser bundle against the synthetic host/fake Pi; agent reply link actually opens a popup intercepted locally, leaves the editor closed, and filename links remain available.
- Focused self-review: checked shared classification order, sanitization unchanged, code fences untouched, nested anchors suppressed, editor-unavailable behavior, explicit relative-path escape and filename regressions.

A self-review regression for reference-style Markdown links initially failed because definitions were not normalized before URL filtering; added definition handling and reran both focused checks successfully. Issue doctor, project-view validation and `git diff --check` also passed.

Initial web check found formatting in the new browser spec; formatted and reran successfully. Initial browser run found duplicate user/reply links in its locator; scoped the case to the agent reply and reran successfully. Discovery commands also encountered the issue's stale `app/fileRefs.ts` path (implementation is now under components), missing guessed test paths, and one non-unique edit match; corrected paths/match before proceeding.

No live-server, separate-UID or full-suite claim; no visual styling changed. No tests removed.
