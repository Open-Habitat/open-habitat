# Result

Root-file search rows now show `/` as their containing folder. Nested files
retain their relative folder (for example `scripts/`). Removed the workspace
name argument from search-row construction, including its Storybook caller.

## Decisions for later review

- Keep tree rows and preview headings as native relative paths (`README.md`,
  `scripts/status_rows.py`). They never substituted the workspace name and have
  no separate containing-folder label. Adding `/` to those filenames would
  imply an absolute filesystem path; adding a new folder field would change
  the design unnecessarily. `/` is used in the existing search folder field.
  Show-in-folder continues to reveal the actual workspace-root row.

## Verification

Tested the final source diff based on `git` parent of this fix on Birch:

- `./scripts/test-focused.sh --area web`: passed, 190 files / 1430 tests,
  including root and nested file row assertions in fieldTree and Composer.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18270 ./scripts/test-focused.sh --area browser --spec lab-composer-lists-in-field.spec.ts` under umask 077:
  all four cases passed. Experimental lists enabled through account preferences.
  Extended the existing journey with root/nested folder labels, root reveal,
  tree-row native path and preview heading checks. Existing axe check passes.
- Focused self-review: search formatting is the only behavior change; navigation,
  preview reads and inserted paths still receive the unchanged native path.
  No daemon, contract, authority or session-state changes.
- Light/dark synthetic lab screenshot + static HTML pairs: `evidence/root-search-1440-*`.
  Screenshot inspected for the root label. These are synthetic same-UID host
  evidence, not live deployment or user-isolation evidence.

Initial checks found an obsolete Storybook argument and the old component-test
expectation; both were updated. The first browser attempt used AGENTS.md, which
is absent from the lab fixture; switched to its actual root README.md and all
four passed. The focused script's help request returned usage with exit 2.
No full gate or whole browser suite run; the conductor owns those.
