# Result — 2026-11-01

Release recipes now run inside `scripts/release-scratch.py`. It allocates its
own private directory (never accepts an existing deletion target), exports
`OH_RELEASE_INPUTS` and `TMPDIR`, holds Alder's existing shared lease, waits for
the recipe, and removes its inputs on success, failure and handled INT/TERM.
SIGKILL/host loss cannot run cleanup; Alder's scratch retention is the fallback.
Recipes must not detach consumers. The release-worker rule is in
`AGENTS-WORKFLOW.md`; the three prepare/package/verify helpers now preserve the
wrapper's TMPDIR instead of overriding it. Package staging already has its own
exit cleanup. No publication, release cut, installation or Fleetrepo edit occurred.

## Why a wrapper

Pilot.17's closed result and Alder's retained
`/var/tmp/agent-keep/pilot17-01m68gbv/package-and-sign.sh` show a one-off recipe
with a hardcoded base, not a repository-wide cut command. It laid out predecessor
downloads, per-architecture descriptor/package/predecessor/successor directories,
`publish`, and downloaded verification copies. The repository's prepare, stage
(runtime-release) and upload-plan tools each own only one part; deleting from
any of those would remove inputs before the later consumers finish. The wrapper
owns the complete recipe lifetime without changing signing or publishing policy.

## One-time cleanup inventory (dry run)

The first read-only Alder scan used `find /var/tmp -maxdepth 1 -type d` with the
legacy name pattern and `du -s -B1` on each exact match:

| Exact path on Alder | Allocated bytes observed |
|---|---:|
| `/var/tmp/oh-pilot13-inputs-01m5zjhk` | 5,514,850,304 |
| `/var/tmp/oh-pilot14-inputs-01m62ynp` | 5,550,219,264 |
| `/var/tmp/oh-pilot15-inputs-01m64akn` | 7,370,862,592 |
| `/var/tmp/oh-pilot17-inputs-01m68gbv` | 5,078,900,736 |
| **Total observed** | **23,514,832,896 (21.90 GiB)** |

These are candidate sizes, not claimed reclaimed bytes (including possible
cross-directory hardlinks). Pilot.11/12/16 were already absent. Birch had no
matching entries. Each candidate matched the exact direct-child legacy naming
rule. The subsequent layout inspection saw only pilot.13 and pilot.14; both
contained the expected disposable release layout. By the next read-only scan,
all four paths were gone, without this worker issuing any deletion command.
A later independent scan again returned an empty list on both hosts. Alder's
filesystem then reported 49% usage and 239,837,679,616 available bytes.

Therefore this worker deleted **zero legacy paths / zero claimed bytes**.
Another actor removed them during inspection; its identity and checks were not
established here. This worker did not complete process/open-issue/inventory
reference clearance before they disappeared and does not retroactively certify
that other deletion. The existing closed pilot.17 result names its old path as
historical evidence, not a current input. No outside paths were cleaned or
services touched. The requested absence postcondition is verified; the table
preserves the actual dry-run observation rather than inventing a deletion receipt.

## Validation and focused self-review

- `python3 scripts/test-release-scratch.py`: five tests pass, covering success,
  nonzero recipe exit, launch failure, external symlink survival, symlink-parent
  refusal, CLI validation/dry run, SIGINT and SIGTERM cleanup.
- Alder smoke test through SSH: wrapper acquired the real shared lease; its
  child could not acquire an exclusive nonblocking lock. Exit 0, cleaned true
  for `/var/tmp/agent-scratch/oh-release-inputs-if54p3j2`.
- `python3 scripts/test-prepare-test-release.py`: one test passes.
- `python3 scripts/test-release-upload-plan.py`: five tests pass.
- Project-view validator and `git diff --check` pass; shell syntax checks pass.
- `issuectl doctor --json`: no schema/parse/broken-reference errors; existing
  non-AVIF evidence notices are unrelated. Full release gate not run (no product
  runtime changed). Scratch tests are included in the Go/contracts gate phase.

Self-review checked deletion ownership, failure cleanup, signal forwarding,
lease lifetime, child output versus JSON, and retention of evidence outside the
inputs. Cleanup uses Python's private temporary-directory lifecycle, not globs
or caller-provided removal paths. Recipes remain responsible for using the
exported base, waiting for their children and copying durable evidence out.
