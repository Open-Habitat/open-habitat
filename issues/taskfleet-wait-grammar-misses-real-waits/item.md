---
created: 2026-10-25
updated: 2026-10-25
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in conductor session history
source_ref: taskfleet:01m5tae9rjsc7kq2pxfear0e66/observed:taskfleet-wait-grammar
originating_run: 01m5tae9rjsc7kq2pxfear0e66
originating_run_kind: spinoff
lane: unlaned
collision: [internal/daemon/processes_linux.go]
preparation: ready
---

# Real taskfleet run wait commands are not recognised as waits (cd &&, --check-in, --terminal)

## Description

# Real `taskfleet run wait` commands are not recognised as waits

## Description

Observed 2026-10-25 in the first conductor session run inside Habitat on Birch
(native Pi session history of `~/src/open-habitat`). Every background wait the
conductor started had the shape

    cd ~/src/open-habitat && taskfleet run wait <run-id> --check-in 45m --output json
    cd ~/src/open-habitat && taskfleet run wait <run-id> --terminal --check-in 45m --output json

`taskfleetWait` in `internal/daemon/processes_linux.go` rejects all of them:
the `&` in `&&` is a refused character, and `--check-in` and `--terminal`
are not in its option list. So `run_ids` stayed empty and none of the waits
was joined to its run. Effects Jari saw:

- The terminal chip counted the waits as ordinary processes, and the worker
  chip showed no bell or stop-wait for the run being waited on.
- `--check-in` returns exit 4 by design (a live snapshot, "reinvoke to
  continue"). Pi's process extension reports it as kind `crash`, so the
  conversation showed "<name> · kaatui · koodi 4". The exit-2/3 wait labels in
  `ProcessCompletion` never apply either.

Current `taskfleet run wait --help` options: `--all --any --json --output
--timeout --check-in --terminal --fail-on-error --progress --poll-interval`.
Exit codes: 0 met, 1 usage/unknown run, 2 timeout, 3 failed run with
`--fail-on-error`, 4 check-in.

The grammar has to stay narrow (recognition is presentation only and no browser
text is executed), but a leading `cd <path> &&` is the commonest real shape,
since agents run waits from the repository whose runs they wait on.

## Acceptance Criteria

- [ ] The two command shapes above yield their run ids; other shell syntax
  still yields none.
- [ ] Exit 4 of a recognised wait reads as a check-in, not as a crash.

Related design round: `proto-background-waits` (how waits are shown).

## Comments

### 2026-10-25T20:12:53Z · @conductor

Accepted for a fix by the conductor: it is the cause of Jari's 2026-10-25 observation (proto-background-waits), a defect against existing intent, not a design choice. The presentation question stays with proto-background-waits.
