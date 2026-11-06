# Result

Added the three missing experimental settings rows (empty-conversation-start-page,
raise-to-your-turn and composer-lists-in-field), with Finnish and English names,
descriptions and search keywords. Existing experiment cards and gating are unchanged.

## Validation

Tested base fb0c118b43891741b504361b42a4c3cb5c1fa88b plus the two index-file changes in this commit, on Birch with private /var/tmp scratch and umask 077.

- `./scripts/test-focused.sh --area web`: passed static checks, typecheck and 1,319 tests (175 files).
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=13800 ./scripts/test-focused.sh --area browser --spec settings-experimental.spec.ts`: 3 passed.
- Same command with `--spec settings-search.spec.ts`: 5 passed, including complete index/page parity and responsive search navigation.
- Initial invocation repeated `--spec`; the runner used only the last value (experimental). Ran settings-search separately after noticing the output. No coverage is inferred from the first argument.
- Focused self-review: IDs match all three cards, names match their catalogs, English entries and bilingual keywords are present, and no state or authority changes occur. Existing parity coverage already catches this regression, so no duplicate test was added.

Browser evidence is synthetic host-backed evidence, not live-installation verification. No full gate or whole browser suite was run.

## Decisions for later review

None: the brief explicitly requested all three cards be indexed; the implementation follows the existing index structure.
