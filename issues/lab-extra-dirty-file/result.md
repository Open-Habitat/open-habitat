# Result

Run: `01m5g1ffx6zhwarq605854nff2`. No push, deployment or full gate.
Issue closed as `fixed`: issuectl rejects the brief's literal `done` for bugs.

## Root causes and fix

The phase-1 fixture change made `cmd/main.go` available without code-server,
but created the lab copy **after** `seedLab` committed its baseline and installed
the four deliberate Git changes. That introduced a fifth untracked path,
`cmd/`. This was test setup pollution, not an editor read/save side effect.
The target is now created inside `seedLab`, before its initial commit. Its
contents are unchanged; the expected dirty count remains four. New linked
worktrees now inherit the target too. The plain non-lab fixture is unchanged.

The fake-Pi turn was not missing. The original gate log fails at the
`README.md` output assertion, after both assistant messages were observed.
A diagnostic rerun with only the fixture fix passed 14/15 cases and reproduced
that assertion failure. Its `error-context.md` shows the completed turn, the
expanded bash tool, and an 11-line listing displayed as:

- first three lines: `.agents`, `.git`, `.pi`;
- one folded middle line;
- last seven: `cmd`, `go.mod`, `internal`, `main.go`, `pyproject.toml`,
  `scripts`, `tests`.

`README.md` is exactly the folded fourth line. Adding `cmd` crossed the output
viewer's ten-line folding threshold. The journey now explicitly expands the
output before asserting the native filename. No product folding behavior or
assertion count was changed.

A focused Go regression checks the exact four dirty paths, the committed editor
target's bytes, and its presence in a newly created native Git worktree.

## Verification

Runnable delta: `test/browser-host/{lab.go,main.go,lab_test.go}` and
`web/tests/lab-conversation.spec.ts`, based on `fba4db12`.

- `cd web && npx playwright test --config playwright.lab.config.ts tests/lab-git-status.spec.ts tests/lab-worktree-agent.spec.ts tests/lab-conversation.spec.ts` — **15 passed** (27.3 s). This includes all four originally failing cases, without changing their expected counts.
- `./scripts/test-web-fast.sh` — **passed**: format, lint, TypeScript and 484 tests in 86 files (Vitest 22.91 s).
- `TMPDIR=/var/tmp go test -race ./test/browser-host -count=1` — passed.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check` — passed (doctor retains existing non-blocking asset notices).
- Focused self-review: checked fixture ordering, unchanged file bytes, propagation
  into worktrees, real output-disclosure behavior, and scope against the parallel
  Monaco work. No production editor/API file changed.

Browser execution uses Fleetrepo's warm ARM Linux runner, real gateway/daemon
handlers and fake Pi with invented homes. It is synthetic host-backed evidence,
not separate-UID, real-provider or live-host evidence. Only the browser-host Go
package changed; no daemon/gateway behavior or contract changed.

## Tool/sub-workflow inventory

The first diagnostic browser run intentionally retained the failing output
assertion: 14 passed, one failed. The remote error artifact was retrieved and
used to establish folding as the cause; the final rerun follows the repair.
A few initial scoped discovery commands named absent optional files/directories;
subsequent source reads recovered them without a fallback or skipped check.
Dependency installation succeeded, with npm's existing peer/deprecation/audit
notices; no dependency or lockfile was changed. Closing with the brief's literal
`done` was refused by issuectl's bug-type rule; closing as `fixed` succeeded.

Logs on Alder: `/var/tmp/lab-extra-browser.log` (diagnostic),
`/var/tmp/lab-extra-error-context.md` (retrieved synthetic failure artifact),
`/var/tmp/lab-extra-browser-final.log`, `/var/tmp/lab-extra-web-fast-final.log`,
and `/var/tmp/lab-extra-go.log`. The explanation above preserves the relevant
artifact evidence without depending on transient warm-runner retention.
