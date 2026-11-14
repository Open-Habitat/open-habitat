# Result

Fixed the destructive selection in `scripts/screenshots-to-avif.py`: recursive discovery previously sent every PNG to the encode/verify/delete path without checking Git ownership. Sources and destinations present in HEAD or the index are now refused, including explicitly named files and staged deletions. Git inspection errors fail closed; inherited repository/index environment variables cannot redirect the check. Source tracking is checked again before removal.

## Decisions for later review

Keep directory inputs, but convert only untracked PNGs. Explicit naming does not override protection. A mixed directory converts its eligible files and reports tracked files as errors with a nonzero exit, rather than silently skipping originals. New staged files are protected too. A checkout without readable HEAD/index is refused rather than treated as untracked.

## Validation and review

- `python3 scripts/test-screenshots-to-avif.py -v`: all 11 tests passed, no skips, with conversion scratch under a leased agent-scratch directory.
- Coverage includes mixed committed/untracked directories, explicit paths, modified originals, index-only additions, staged source and destination deletions, dry-run, inherited Git index environment, failed Git inspection, existing AVIFs, and existing path/encoding checks.
- Focused self-review: appropriate for this local evidence helper; no host operator, upgrade, session or wire-contract code changed. Reviewed refusal before writing, NUL-delimited Git filenames, source removal, and fail-closed behavior.
- Live check: exercised the actual script and installed AVIF converter in disposable synthetic Git repositories; committed PNG bytes remained unchanged while a new PNG converted successfully. No real evidence or running installation was modified.
