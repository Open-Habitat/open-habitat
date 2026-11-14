# Code hygiene review

Reviewed product source at `53fee283` on Linux. Product code is unchanged.
Four confirmed proposals were filed through intake, renamed descriptively, and
left **untriaged and unlaned** for Jari. Ranked by maintenance value:

1. **[browser-json-response-reader](../browser-json-response-reader/item.md)** — M.
   Extract repeated bounded JSON reading from browser feature modules. Existing
   implementations already differ in byte versus string limits and streaming
   behavior; unrelated forge clients borrow the integration feature's reader.
2. **[obsolete-virtual-history-mode](../obsolete-virtual-history-mode/item.md)** — S.
   Remove the unused virtual-history dependency and the timeline's no-op mode
   interface. Production always selects paged history; stories expose a mode
   switch that changes a label, not rendering.
3. **[shared-json-duplicate-validator](../shared-json-duplicate-validator/item.md)** — S.
   Replace identical daemon/gateway JSON-key token walkers with one pure helper.
   Keep all endpoint validation and authority checks where they are.
4. **[unreachable-runtime-helpers](../unreachable-runtime-helpers/item.md)** — S.
   Delete eight unreachable legacy declarations, including the unused handoff
   entry point and policy-probe wrapper. Preserve live variants and test seams.

## Evidence and review

- `go vet ./...`: passed (Go 1.27.1).
- Installed `golang.org/x/tools/cmd/deadcode@v0.52.0` in disposable scratch,
  not the user's bin. `deadcode ./cmd/...` and `deadcode -test ./...` completed.
  The latter narrowed production warnings to declarations unreachable even
  with test roots; source/caller checks confirmed the filed subset.
- `npm ci --prefix web`: passed.
- `npx knip --no-progress` (6.45.1): completed with exit 1 for findings, not a
  crash. Reported 31 unused files, one unused dependency and 133 unused exports,
  among other leads. Local-use exports, test hooks and standalone lab scripts
  are not automatically dead code. The filed virtual-history cleanup was
  verified against production callers and actual rendering.
- `npx jscpd src ../internal --min-lines 25 --min-tokens 180
  --ignore '**/*test*,**/*.stories.*,**/contracts/**' --reporters json` from
  `web/` (5.4.3): completed. Generated UI-skill references dominated raw output
  and were excluded during triage; direct diff verified the parser clone.
- `issuectl doctor --json`: exit 0, no schema violations; reported an existing
  missing `sweep-instrumentation.diff` attachment in `load-race-sweep`, unrelated
  to this review. No unrelated files were repaired.
- Focused self-review: read implementations and live callers, checked existing
  open issues for overlap, separated fixture roots from production, and kept
  proposals bounded. No external model consultation was needed. No code tests
  or browser tests were run: this delivery changes only issue documents.

Dropped leads: generated-source duplication; fixture constructors and fake
server helpers; unused exports that are used within their own modules; the
small Button re-export shim; provider-specific origin rules; and the Claude
sign-in markup clone (the lifecycle is already shared and its presentation
variants do not justify a separate task here). The already-filed
`command-changed-state-pending-dead-code` is not duplicated.

This is a tool-assisted review, not an exhaustive proof that all dead branches
or architectural problems have been found. No security vulnerability or live
user failure is alleged by these maintenance proposals.

## Decisions for later review

- Prefer four concrete clusters over blanket analyzer cleanup. Alternative:
  file all warnings; rejected because tests, generated material and local
  exports explain many of them.
- Recommend pure parsing utilities, not a new API framework or provider
  abstraction. No authority boundary changes are needed or authorized.
- Remove obsolete history-mode scaffolding rather than implement virtualization
  to justify it: current production callers and rendering provide the evidence.

Live check: no test-server behavior changed. Jari can triage the four proposals;
there is no new runtime feature to try until a refactor is implemented.
