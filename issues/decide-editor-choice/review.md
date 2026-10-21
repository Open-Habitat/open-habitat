# ADR 0028 review and disposition

2026-10-21. Scope: `docs/decisions/adr-0028-selectable-workspace-editor.md`,
current held-workspace admission/fencing, worktree-place discovery and gateway
proxy limits. Critical security/concurrency/data-loss review via `/llm-review`:
finder `claude-fable-5-1`, independent verifier `gpt-6-astra`, two model calls.
Performance-corpus logging disabled (`--no-perf-log`) to honour this run's
no-push instruction. Neither consultation failed or requested missing context.
The verifier saw the revised file during inspection and distinguished original
findings from resolved requirements; no unresolved must-fix remains.

## Confirmed and fixed

### ADR0028-F1 — Strict Unicode validation before lossy decoding

Location: ADR section C, text/JSON validation. Go `encoding/json/decode.go`
explicitly replaces invalid UTF-8 and invalid UTF-16 surrogate pairs with U+FFFD.
Validation of a decoded Go string cannot detect the original invalid document;
a save could mark a different string clean. The ADR now requires raw JSON
UTF-8 validation and escaped-surrogate pairing before normal decoding, and
browser rejection of lone surrogates. Legitimate U+FFFD remains valid. Local
source inspection and verifier confirmed the claim; the implementation issue
requires a distinguishing test. Finder: must-fix/high; host: confirmed.

### ADR0028-F4 — Alias workspace IDs defeat per-workspace save locks

Location: ADR section D, save serialization. `placeOf` permits a repository's
linked worktree nested inside another repository's workspace. One tab can name
the nested file through the enclosing workspace ID and another through the
place ID. Their per-workspace locks differ; both could pass version comparison
before replacing each other's results. Different alias-specific tokens do not
help. `placeOf` and `worktreeContainers` were checked locally and by the verifier.
The ADR now requires one daemon-wide save mutex across comparison and commit,
and phase 1 tests include alias IDs. Finder: should-fix/medium; host: confirmed.

## Dropped candidates and useful clarifications (six)

| Finder ID | Disposition and evidence |
|---|---|
| F2 | Dropped as substantive defect: the original already said committed inode after rename/fsync. Clarified post-rename fstat explicitly because ctime can change; test consecutive saves. Verifier refuted the original defect claim. |
| F3 | Dropped as substantive defect: a new deletion-blocking lease was already required, explicitly not provided by workspaceFD alone. Clarified atomic registration/checking under the fence mutex and overlapping place/workspace roots. Existing code has no file-operation lease; this is implementation work, not a false claim it already exists. Verifier refuted the spec-gap claim. |
| F5 | Dropped: refusal of unsupported xattrs is a deliberate conservative first-slice restriction, not silent metadata loss. Explicitly documented that SELinux-labelled files are initially unsupported for saving. Blindly exempting security.selinux would not prove equivalent policy semantics of the replacement inode. |
| F6 | Dropped: section B already required openat2 no-symlinks/no-xdev on every opened directory/file and explicitly said os.Root alone does not enforce those rules. Clarified that this applies to reads too, with no unchecked Root.OpenFile re-resolution. |
| F7 | Dropped: the ADR specifies future gateway limits, not current implementation. Confirmed the current 66,000-byte proxy ceiling and named the required route-specific PUT allowance explicitly. hostChanged is a store reducer; the ADR does not claim it is defined in mutations.ts. |
| F8 | Dropped as substantive defect: cleanup paths cannot run on SIGKILL/power loss; original specified no crash-recovery guarantee. Clarified recognizable staging names and possible leftovers. Rejected automatic deletion by matching names because those can be the person's files. Verifier refuted the defect claim. |

## Coverage and residual risk

Read the ADR, gateway/editor and daemon/editor wiring, WorkspaceEditor and
FileRef routing, current generated-contract source, workspaceFD/placeFD,
fenceWorkspace, held-root start page, composer listing and gateway proxy limits.
Primary Monaco and CodeMirror sources were fetched and read. Documentation
navigation/link validation and whitespace checks pass. No runnable code changed;
no claim of runtime isolation, save durability or mobile ergonomics is made.
Those need phase-1 daemon/contract/browser/distinct-UID VM evidence and phase-2
Monaco asset/worker evidence. Native uncooperative writer check/rename races
remain an explicit limitation, not a hidden CAS promise.

Consultation raw outputs are local working material at
`/var/tmp/editor-adr-evidence/finder.txt` and
`/var/tmp/editor-adr-evidence/verifier.txt`; this disposition stands alone without
them. Both implementation issues were filed through intake, untriaged and
unlaned, with run provenance. No review-residual issues were filed.
