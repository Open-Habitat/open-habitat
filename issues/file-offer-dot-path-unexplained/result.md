# Result

## Cause

There is no blanket refusal of dot-prefixed ancestors. `validViewSource`
accepts them. `openOfferSource` opens through the kernel with no-symlink
resolution; `viewOpenError` maps `ELOOP` (symlink resolution) and `EXDEV`
(forbidden crossing) to `unsafe_view_source`, renamed `unsafe_file_source`
by `fileOfferError`. The CLI previously rendered that code with the generic
personal-operation refusal, hiding the useful reason.

A synthetic ordinary 0600 `.pi/skills/test-guide/SKILL.md` succeeds with
both relative and absolute daemon requests. Replacing its `.pi` ancestor
with a symlink reproduces the exact reported error while the final file
remains regular. This establishes the code cause, not the original
installation's offending component: the report alone cannot distinguish
that filesystem's ancestry or installed version. The current CLI sends
absolute paths; a named single file allows mount crossings but not links.
Directory descendants still cannot cross mounts.

## Changes

The CLI now explains unsafe source lookup, names the candidate absolute
sources, and distinguishes checking path components for symlinks from
checking directory descendants for mounts. It preserves the error code and
exit status. The bundled agent skill explains dot ancestors, hidden exported
names, and skipped hidden directory entries.

## Decisions for later review

- Preserve every existing source-opening rule. Alternatives were a blanket
  dot ban or a secret-name allow/deny list. Neither matches the observed code;
  no new name-based security policy is introduced. `.pi`, `.agents` and
  `.github` ancestors already work and are now regression-tested.
- Do not claim a specific offending component from a fixed daemon code or
  rewalk a possibly changed filesystem to guess one. Name the submitted
  sources and explain what to inspect. Native error text still stays out of
  the wire contract.
- Keep existing hidden export-name restrictions and directory-walk skipping.
  These are not a secret-content scanner; agents must only offer intended
  content. No security or authority boundary changes.

## Tests and review

- `scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed.
- `scripts/test-focused.sh --area go --go-package ./internal/cli`: passed,
  rerun after review fixes.
- Regression tests cover the reported path and permissions, ancestor symlink
  refusal, ELOOP/EXDEV mapping, and frozen offers under ordinary dot ancestors.
- Independent `/llm-review`: claude-fable-5-2 finder and gpt-6-astra verifier;
  `/assess-findings`: three wording/test findings fixed, including the
  verifier's file-only error-code qualification. No remaining finding.
- No UI, contract or daemon production change; browser specs not applicable.

Live check: ask an agent to offer an ordinary
`.pi/skills/test-guide/SKILL.md`, then try a synthetic path whose ancestor is
a symlink. The former succeeds; the latter retains `unsafe_file_source` but
explains the refusal and names the source instead of the generic error.
