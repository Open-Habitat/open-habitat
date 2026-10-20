# Microsoft integration — critical review

Scope: diff from b3408163, integration credentials/relay/native stores, sync and
agent exposure. Finder: claude-fable-5-1; verifier: gpt-6-astra. Two model calls.
Critical because of credentials, cancellation, and bidirectional file writes.
No performance-corpus write (--no-perf-log): this run may not edit/push Fleetrepo.

The finder examined a moving implementation, so its candidates were checked
against their cited code and the final repairs, not treated as final-tree facts.
The verifier inspected Go runtime 7f16c602 read-only. Later repairs at 4b0e0c2f
address its two surviving findings; the added UI copy/browser assertion received
focused self-review. Fresh acceptance is recorded in the issue result.

## F1 — re-login cannot select newly followed libraries

Confirmed against the original relay condition. Fixed: Microsoft's native
inventory controls whether folder choice is needed; a renewed account sees its
current selection and new roots. Existing healthy pairs are never resynced;
deselection removes listings only. Verifier refuted the original mechanism.

## F2 — file probes consume Outlook's status budget

Confirmed serial ordering and unbounded per-library process count. Fixed:
independent MCP probe plus at most one file probe per displayed service. A
controlled marker/deadline regression distinguishes serial from independent
verification, without making a live timing claim. Verifier refuted the original.

## F3 — missing OneDrive prevents Outlook-only use

Partially refuted premise: Microsoft's drive-get documentation says delegated
GET auto-provisions a licensed user's drive. Confirmed narrower defect for a
real 404/no-OneDrive entitlement. Fixed 404 handling and empty-root completion;
no folder or sync client is invented. Verifier refuted the stated 404 mechanism.
Source: https://learn.microsoft.com/en-us/graph/api/drive-get?view=graph-rest-1.0

## F4 — provider rename moves a live local root

Confirmed ID-keyed workdir versus name-derived destination mismatch. Commit now
preserves prior native descriptions keyed by immutable remote ID. Regression
changes a discovered description and checks the old root/listings are retained.
Verifier refuted the original mechanism.

## F5 — failed first pair starves later pairs

Confirmed shell's early exit. Fixed: attempt every pair once before exiting for
backoff, retaining native safety stops. Regression runs the real generated shell
against synthetic failing/succeeding native commands. Verifier refuted it.

## F6 — Graph outage reported as expired login

Confirmed pinned Softeria testLogin emits success:false for Graph failures.
Fixed before finder completion: only known native token-rejection messages mean
expired; Graph failures stay unreachable. Verifier checked the pinned source.

## V1 — cancellation after renewal leaves retained sync stopped

Confirmed by tracing stop -> Commit -> folder cancellation: previous cleanup
never reconciled existing accounts. Fixed: every retained-account exit after
stopping its native refresher reconciles under the write lease. Shutdown fences
late reconciliation so it cannot start another child. Catalog regressions cover
cancel, expiry, folder failure and daemon shutdown.

## V2 — uncertain rollback leaves a hidden authorized native backup

Confirmed mixed failure: existing native cache without registration, add writes
but fails, cleanup fails, random backup remains outside account discovery/removal.
Fixed: pending and previous native caches are account-named under .pending/ and
.previous/. Previous cache is restored even with uncertain registration cleanup;
a failed restoration remains discoverable and removable. A stale previous copy
is never overwritten. Regression combines the failures, blocks restoration,
checks native key preservation and removes all account stores. Removing an
account also fences an unknown-identity same-provider attempt before it can
publish that account after removal.

## Dropped candidates and limits

Five finder counterchecks were refuted locally and by pinned source/native CLI
behavior: public-client rclone secret override, MSAL encryption AAD/path binding,
Pi replacement semantics, native login output/preset syntax, and private Pi dir
permissions. No issues filed from these. No model consensus used as evidence.
Live provider behavior, personal refresh after an hour, guest/alias identity,
tenant consent and distinct-UID installation proof are outside this synthetic
review and remain explicit conductor checks. No unresolved design decision.
