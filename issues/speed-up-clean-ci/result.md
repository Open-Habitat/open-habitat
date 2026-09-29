# Clean gate performance and testing policy

Implementation commit: `b317851` (parent `35dccfc`). The root `TESTING.md` is the single test-selection guide. A runtime/release/test change still runs the complete clean gate once on the final committed tree; documentation-only work uses focused validators. The full gate continues to run the same Go, web, contracts, fixture, license, issue and archive checks. Playwright's E2E and a11y cases now share one host startup and one fresh production build, also used by packaging; standalone browser commands still build their own assets. Go/npm content-addressed caches persist only inside this checkout's ignored `.cache/ci-local/`, while HOME, venv and tool installs remain per-run and disposable.

## Measurements

Linux host, Go 1.27.1 and Node 22, `/var/tmp` disk-backed scratch, one browser run at a time, no live host. The initial old-tree attempt on `35dccfc` stopped after 71.74 s at occupied Playwright ports 4183/4174; it is **not** a gate pass. Comparison runs used a separate detached disposable worktree at `35dccfc` and the feature worktree at `b317851`. Exact phase measurements are printed to stderr by the new gate.

| Tree | Conditions | Result | Wall / CPU user / CPU sys |
| --- | --- | --- | --- |
| old `35dccfc` | fresh detached worktree; browser downloaded on first run | passed; E2E 57, a11y 2 | 243.40 / 241.12 / 42.69 s |
| old `35dccfc` | second run; Chromium cached but Go/npm/pip state rebuilt in disposable homes | passed; E2E 57, a11y 2 | 215.03 / 229.57 / 40.02 s |
| new `b317851` | fresh persistent Go/npm caches; Chromium already present after blocked pre-run | passed; combined browser 59 | 210.35 / 223.23 / 38.07 s |

New gate phases: setup 5 s, dependencies 21 s, web checks and production build 6 s, browser 132 s, Storybook + Go/contracts/docs 37 s, packaging 9 s, final checks <1 s. The 132-second serial browser suite dominates; it shares a process-wide synthetic scenario switch and cannot safely be parallelized by increasing Playwright workers. The old 243 s and new 210 s totals are **not an apples-to-apples speedup measurement** because browser download/cache state differed. With Chromium warm, the old script took 215 s, only 5 s more than the new script's first (otherwise cold-cache) pass; one more new warm-cache run measures the intended repeat-run benefit. These are separate runs under variable machine load, not a controlled benchmark.

## Checks and limits

At `b317851`: `bash -n scripts/ci-local.sh`, web format/lint/typecheck, `npm run test:browser --prefix web -- --list` (59 cases), `git diff --check`, and `./scripts/ci-local.sh --clean --json` passed (59/59 Playwright, two identical archives, original/relocated/tampered verification, issue doctor, clean exit). The early dirty-tree rejection was tested with an untracked sentinel and observed `error: --clean requires a clean tree at entry`, then the sentinel was removed. No QEMU guest, separate UID container, live server or real credential was used; the gate only ran offline VM `self-test`. Negative changed-lockfile and changed-source runs have not been performed. A subsequent result-only revision does not change the tested product tree.
