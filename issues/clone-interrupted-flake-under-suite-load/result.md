# Result: interrupted-clone spec under suite load

Reproduced with the spec alone under heavy load (12–16 `yes` processes,
6–8 workers, `--repeat-each 40–100`). It showed two causes.

## 1. The click landed where the button had been (test)

Failure: `toHaveURL(/\/workspaces$/)` after *Poista keskeneräinen*, page
stays at `/workspaces/new`, and the trace shows no POST at all. The card
first renders from the clone list. When the GitHub catalog arrives a moment
later, it says `fixture/second` is large (640 000 KiB). The card then gains
the *Uusi yritys* clone-mode choice above its buttons, and the button moves
down about 100 px. Playwright had computed the click point before that
render, so it clicked the old spot. The test now waits until the catalog
is shown (`repository-option-fixture/first`) before it acts on a card.

## 2. A concurrent list read made an idle clone look busy (product)

Failure: after *Aloita alusta*, the card stays `interrupted` and shows the
alert *Uusi yritys ei onnistunut*. The POST answered `409 not_interrupted`.
Temporary instrumentation showed that the write's strict process scan had
found the list's own Git (the synthetic git) inside `~/src/first`. The clone
list (`GET …/github/clones`) reads interrupted clones without
`cloneWriter`. Its Git reads in `interruptedCloneWithScan` did not take
`gitInspectionScan`, the lock that the strict scan uses to drain the
daemon's own inspection commands. A person who clicks restart or remove
while the page refreshes its list could get the same spurious refusal.
These four bounded reads now run under `gitInspectionScan.RLock`, as
`inspectGit` reads already do. The scan does not exempt any process; it
only waits for these bounded reads to finish.

## Evidence

- `TestInterruptedCloneReadsHoldTheInspectionLock` fails without the fix
  (3 of 3 reads unguarded) and passes with it; `go test ./internal/daemon`
  passes (`scripts/test-focused.sh --area go --go-package ./internal/daemon`).
- Before the fix, under heavy load: 1 failure in 80 for each cause. After
  both fixes: the interrupted cases 80/80 (12 hogs, 6 workers) and the
  whole spec `--repeat-each 5` under the brief's four-`yes` hog 55/55,
  alone 11/11 (one opt-in visual capture skipped).

## Decisions for later review

- **Fixed the daemon, not only the test.** The alternative was to make the
  test wait for the list read before clicking restart. That would hide a
  refusal a person can hit. The fix reuses the existing drain lock and
  changes no authority or exemption.
- **The card's layout shift is left as it is.** The buttons of a large
  repo's interrupted card move when the catalog arrives. A person could
  misclick during that ~0.1–1 s window. Reserving space for the choice is a
  design change, out of scope for a gate-health fix, so it is noted here
  only.
