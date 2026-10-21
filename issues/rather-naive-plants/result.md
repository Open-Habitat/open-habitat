# Result

The product list, not the browser assertion, was wrong. Its list-only process-scan adapter returned known `inside` processes to the strict recognizer, which rejected the candidate, but left `interrupted_complete` true. A read-only Git inspector can therefore turn a still-present clone into confirmed absence. The original trace cannot identify the exact PID; no claim of filesystem loss is made.

Listing now retains filesystem/Git-confirmed candidates for all inconclusive process observations (inside, unreadable, incomplete), marking the list incomplete. Restart and removal still use the unchanged strict native scan. No cache, automatic write, sleep or browser assertion change was introduced.

Extended the existing table-driven regression to cover known-inside and inside-plus-unreadable observations retaining the candidate, and to prove that the identical observations still fail strict destructive eligibility. Self-review: only the list adapter changes behavior; managed running destinations remain excluded and filesystem/Git recognition is unchanged.

## Verification

Base revision: `48c80edcf7349ebeab82de97ba0a1a9cc9daadc9`, plus this commit's daemon changes.

- `go test -race -count=1 ./internal/daemon ./internal/transport ./internal/cli`: passed, 107.64 s wall time (daemon 97.092 s).
- `./scripts/check-generated.sh`: passed, 0.41 s.
- `cd web && npx playwright test tests/clone-page.spec.ts`: passed on the routed Cedar runner, 7 passed in 7.6 s (231.26 s command wall time including routing/setup). The interrupted removal/restart journey passed unchanged. One opt-in visual capture case was skipped; it does not assert this behavior.
- `git diff --check`: passed.

The first Go run failed to compile the extended test because its new `unix` import was missing. Added the import and reran all selected packages successfully. Logs: `/var/tmp/plants-go-initial.log`, `/var/tmp/plants-go-final.log`, `/var/tmp/plants-contracts.log`.

No web source changed, so fast web checks are not required. No full gate, live deployment, distinct-UID claim or live provider check was attempted.
