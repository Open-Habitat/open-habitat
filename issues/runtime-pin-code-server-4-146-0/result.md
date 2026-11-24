# Result

Pure editor pin raise from 4.145.2 to exactly 4.146.0 in
`runtime/profiles/editor/artifact-lock.json`: version, both target URLs,
archive prefixes and SHA-256 digests. Both digests were checked against the
upstream release API; the research independently hashed both downloaded archives.
The native arm64 builder downloaded and digest-verified the pinned bytes again.

No npm/Node, Rust, source patch, licence declaration or verifier constant needs
changing for this standalone archive. The licence comparison in research.md
found no changed corresponding licence/notice content. The existing builder
retains nested notices and generates the artifact lock copy, component/file
records, licence inventory and archive descriptor from the new payload.
Generated archives remain build outputs, not committed binaries.

## Checks

Tested base `e94c4bf068b9d23995a2fd6dcff5a639d53d3de1` with the editor lock
change above. All checks passed:

- `scripts/build-profile-runtime.sh --target linux-arm64 editor NEW_OUTPUT`,
  with fresh leased scratch and a bounded timeout. Generated editor archive
  SHA-256: `5a4e609f659c4d5f73f0f1182c7a1d2838e22092956248aa42bd1421a9e405e3`.
- `python3 scripts/test-profile-runtime-build.py`: 16 tests.
- Separate `scripts/test-focused.sh --area go --go-package PACKAGE` runs for
  `./internal/host`, `./internal/daemon`, and `./internal/gateway`, under
  `umask 077`. An initial invocation repeated `--go-package`; that selects
  only the last package (gateway), so host and daemon were run separately.
- `scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`:
  nine passed; two native-only cases initially skipped.
- The same browser runner with `--tag '@native-editor'` and
  `BROWSER_HOST_CODE_SERVER` pointing at the freshly built, extracted launcher:
  both native cases passed. These exercise Explorer external-file observation
  through the editor relay and workspace-resource freshness/cache isolation.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`.

The requested `fixed` closure was refused because this is a chore and that
status is bug-only. Closed with the schema's equivalent completion status,
`done`, without changing the issue type.

## Limits

The amd64 archive build/native qualification remains with the test server after
publication, as assigned by the brief. No core/integrations inputs changed, so
those archives were not rebuilt. No release manifest was assembled, release cut,
installation changed, or branch pushed. Browser fixtures use synthetic same-UID
accounts; these results do not establish mapped-user isolation, installed-host
acceptance, or complete open/save/reconnect/idle-shutdown qualification.
