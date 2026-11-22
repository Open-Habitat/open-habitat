# Result

The helpers recipe uses `taskfleet run list --creator-session current --json`.
Its text distinguishes named residents from other runs without an external JSON
filter. The three jq recipes in the shipped agent skill now use Python's standard
`json` module. A tracked-source search found no other standalone jq dependency in
shipped agent instructions or skills; gh's built-in `--jq` options are unchanged.

## Verification

Tested the fixing changes on base `18c67cfada2cf1f2a2e1f69d62369851766410ae`:

- `taskfleet run list --help`: confirms the creator-session filter; the core pin
  is Taskfleet 0.20.0.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: passed.
  New tests extract and execute all three Python recipes from the actual shipped
  skill against synthetic conversation, history and block data.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: final full
  package passed, including helper-context delivery and the updated recipe check.
- `./scripts/test-focused.sh --area contracts`: passed, including generated drift.
- All test commands ran with umask 077, scratch lease and an outer timeout.

The first daemon run caught the old jq-specific test expectation, now updated.
It also had an unrelated interrupted-clone test failure; that test passed both a
focused retry and the final full package run without changes to clone code.

Focused self-review plus independent claude-fable-5-2 review found no instruction
recipe defect. Python 3 is supplied by dependencies of the mandatory core Ubuntu
packages (python3-docx/openpyxl/pypdf/xlrd); local dpkg-query confirmed their
`python3:any` dependencies. No optional Python profile is needed.

No live installation, browser suite, packaging build or clean gate was run.
There is no UI change.

## Decisions for later review

- Prefer Taskfleet's native filter over adding jq to installations. It returns
  all attributed runs, so the instruction explicitly identifies residents.
- Use streaming Python one-liners for skill examples where the CLI has no
  equivalent filter. This avoids a new runtime dependency and keeps JSONL
  exports bounded in memory.
