# Result

Agent host context, bundled agent skill and view/file offer help now instruct
agents to always supply a short descriptive title in the person's language.
All offer examples in these surfaces include a title; the view guidance names
the subject and useful iteration rather than just “Prototype”. File guidance
also covers single files and directories. `ViewOffer.tsx` is untouched.

## Decisions for later review

- Keep the existing filename fallback instead of extracting HTML `<title>`.
  Alternatives were bounded HTML extraction or making the flag mandatory.
  The agent knows the person's language and the purpose/iteration of this
  particular offer; a document title may still be generic or stale. Guidance
  addresses the reported omission without adding a host parser or rejecting
  otherwise valid offers. Existing cards are not renamed.
- Keep titles optional in the API/CLI, but instruct agents to supply them on
  every offer. This is guidance, not a new validation requirement.

## Verification

Tested the final production-file diff against base `HEAD` before this issue's
commit (the commit containing this result identifies that exact diff):

- `npm ci --prefix web` and Pi fixture install with `--ignore-scripts`: passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`: passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed
  after installing `requirements-ci.txt` into a disposable uv venv. First run
  failed because the default Python lacked `referencing`; no code fix needed.
- `./scripts/test-focused.sh --area web`: passed, 160 files / 1182 tests.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
- Focused self-review: checked both title validators and existing fallback,
  reviewed all examples and both text/JSON help's shared flag descriptions.
  Help examples use a single-token descriptive title because the existing help
  builder tokenizes examples with `strings.Fields`; prose examples show spaces.
  No daemon logic, contracts, session state or authority paths changed, so no
  independent runtime review or browser specs were needed. No new wording-only
  assertions were added.

Live model adherence is not established by these checks. The manual check is
under “Työn alla” in KOKEILTAVAA.md; use a new conversation after deployment.

One discovery `rg` command used a nonexistent `internal/daemon/files*` glob;
its view matches were usable and the file title validator was read from the
actual CLI files. No work was lost or test result inferred from that command.
