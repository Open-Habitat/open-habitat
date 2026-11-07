# Result

The shared repository finder now visibly converts pasted GitHub HTTPS and SSH addresses to owner/repo before filtering or lookup. Both New workspace and the onboarding default-repository picker use it. `.git`, trailing paths, query strings and fragments are removed from copied addresses. Ordinary search typing and other forge names remain unchanged.

## Validation

Tested the working tree based on b5befbe4e (the commit containing this result records the exact patch):

- `./scripts/test-focused.sh --area web`: 179 files, 1368 tests passed; lint/typecheck passed.
- `OH_PORT_BASE=15900 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec site-onboarding.spec.ts`: 4 passed. The existing save journey now pastes an SSH URL and verifies the normalized field and saved default.
- Same command with `--spec clone-page.spec.ts`: 11 passed, 1 opt-in visual capture skipped. Existing lookup/clone/a11y journey now pastes an HTTPS URL with `.git` and a tree path and verifies normalization and selection.
- Browser results are host-backed synthetic same-UID evidence, not live GitHub or Unix-user isolation evidence. No daemon or contract changed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and `git diff --check` passed.
- Focused self-review checked exact GitHub host matching, credential/lookalike-host rejection, partial inputs, suffix/path handling and both shared-finder callers. No remaining finding.

The first browser command supplied two `--spec` flags; the runner used only the last (site-onboarding). Clone-page was then run separately, successfully. Exploratory searches for nonexistent repositories files returned no matches; subsequent scoped reads located repoCatalog.

## Decisions for later review

- Treat query strings/fragments on a GitHub repository address like extra paths: select the repository, not the linked view. Alternative: reject such copied browser URLs. Removing them is consistent with accepting file/branch URLs.
- Leave unsupported/incomplete addresses untouched rather than guessing a repository or rewriting a different forge's address. Existing lookup validation remains in force.
