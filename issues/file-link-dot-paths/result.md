# Result

Dot-prefixed workspace file references now become editor links, including hidden directories, `.env` / `.env.example`, and line/range suffixes. The matcher still refuses dot traversal segments, absolute/home paths and malformed suffixes.

The existing behavior is unchanged: recognition does not query existence; opening a link asks the daemon, and a missing file reports an error without replacing the open document. Inspection of `validEditorPath`, `editorOpen`, `editorList` and the native-editor path validation confirmed hidden names are supported already; workspace containment and reserved-directory refusals are unchanged. No daemon, session, contract or authorization code changed.

## Verification

Tested the four-file implementation diff based on `05ee1a9cb146e39429e2c7b8d058635d1311f51c`, as committed with this result.

- `./scripts/test-web-fast.sh`: passed, 231 files / 1854 tests; static, unit and component checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18600 OH_REPLY_DELAY_MS=60 npx playwright test tests/browser-editor.spec.ts --repeat-each 3` (from `web/`): 96 passed. Run under umask 077, a 600-second timeout and shared scratch lease with a private TMPDIR.
- New host-backed synthetic case clicks an assistant reply's `.agents/skills/create-presentation/SKILL.md:3`, reads the expected document, finds the hidden path's file in the editor tree and checks that a missing hidden file leaves the document intact. The repeated spec includes existing accessibility and symlink-containment cases.
- Matcher tests cover hidden segments at the root and nested, optional `./`, no suffix / line / range, and traversal, malformed paths and invalid line numbers. Rendering tests exercise inline-code hidden links.
- Initial focused browser attempt was blocked by the missing pinned Pi SDK fixture; installed it with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`. The next attempt exposed an ambiguous test selector matching both user and assistant messages; scoped it to the assistant reply before the successful three-repeat run.
- `git diff --check`, `issuectl doctor --json` and `python3 scripts/validate-project-view.py`: passed. Closing the original issue emitted the non-blocking warning that its original body has no Acceptance Criteria section; the completed checks are recorded here.

Review level: source-grounded self-review of the final diff and the existing daemon/editor opening path. Proportionate to a local candidate-matcher fix with unchanged trust boundaries; no independent model review required or claimed.

Evidence logs are local at `/var/tmp/agent-keep/file-link-dot-paths/` (`web-fast.log`, `browser-3x.log`). No captured screenshots or HTML were committed. This is synthetic browser/host evidence, not deployed-server verification or distinct-UID isolation evidence. No full suite, clean gate or Go suite was run: no host code changed.

## Decisions for later review

- Recognise single-dot hidden filenames such as `.env`, not only multi-dot names such as `.env.example`. Restricting support to the latter would arbitrarily exclude common hidden workspace files. The daemon still decides whether they can open.
- Include hidden directory links with a trailing slash as well as files, using the same dot-segment refusals; leaving them unlinked would preserve the same defect for directory references.

## Live check

After deployment, ask an agent to name an existing workspace `.agents/skills/create-presentation/SKILL.md` and `.env.example` in inline code, with and without `:3` / `:3-4`. Click each and verify the matching document opens. Try a missing hidden file and a `../outside.md` reference: the former reports unavailable without replacing the document, and the latter stays text. Live deployment verification is left to the release conductor.
