# ADR 0005: Stream native Git clone progress during onboarding

**Status:** Accepted; the storage policy in Resource ownership is superseded
by [ADR 0012](adr-0012-per-user-storage-quotas.md), and Completion and
interruption by [ADR 0024](adr-0024-clone-jobs.md) (clone jobs that outlive
the request).

**Date:** 2026-09-29; storage authority amended on 2026-10-01.

## Context

During an import of three repositories, the browser stayed at `Haettu 0/3`
while a large checkout ran. A final response and a count of completed
repositories could not show whether Git was making progress. A lost response
also left the user unsure whether the checkout had completed.

The browser needs to show the native work as it happens and establish its
result from Git. The user's daemon already owns that work; adding a separate
job registry would create another source of truth alongside the checkout.

## Decision

Stream Git's progress from the user's daemon through the gateway to the browser
in the clone request's response. The gateway authenticates the browser and
routes the request to that user's daemon. The daemon validates and executes
the native operation as its own Unix user. The gateway relays the stream
without becoming a Git executor or a second parser of the progress protocol.

The daemon converts native output into structured stages and measurements.
The browser shows percentages only when Git supplies a usable measurement;
otherwise it shows the current stage without an estimate. Only verified
checkouts count toward the completed-repository total. Raw Git output is not
forwarded, because it can contain credentials, paths and other native details.
The browser validates the structured messages before using them.

### Completion and interruption

The clone belongs to the active request. Disconnecting the browser cancels
the native write, and the daemon owns stopping its subprocesses. A partial
directory is left in place for inspection. Cancellation does not establish
that no files were written or that the checkout is complete.

A completed transfer or successful process exit alone is insufficient to
confirm the checkout. Native observation must establish the expected repository
and origin, a clean checkout and a HEAD commit. The current check therefore
leaves a repository without a first commit uncertain. A missing final message
also leaves the result uncertain until it can be checked.

After a refresh or interruption, the browser reads the native checkout and
writer state again. It does not reconnect to the old stream or automatically
repeat the write. A new attempt requires an explicit user action, a settled
writer and an absent destination. Existing or ambiguous destinations are
preserved; a confirmed checkout can be used without another clone.

### Resource ownership

The daemon serializes clone writes for its user and bounds their running time.
The storage decision amended on 1 October puts the disk limit in an
operator-provisioned volume for each user, with the daemon checking available
space before admitting a clone. This lets the filesystem enforce the limit
across native writers without adding a privileged quota operation for each
clone. Other tools can still consume the remaining space during the attempt,
so exhaustion may leave a partial checkout.

On 5 October, [ADR 0012](adr-0012-per-user-storage-quotas.md) replaced the
fixed volume with a Linux user quota over the whole home and administrator
controls for usage and limits. The implemented admission and usage behavior is
described in [Workspaces](../architecture/workspaces.md).

## Consequences and alternatives

The user sees progress during a long import without a persistent progress
store. Closing or refreshing the page interrupts the clone, and partial
checkouts may need manual attention. This trade-off keeps recovery grounded
in Git and avoids a background-job lifecycle solely for onboarding.

Keeping only the final JSON response, even with a longer timeout, would leave
the original apparent freeze unresolved. A persistent job with polling or a
reconnectable stream would support progress after navigation, but would require
ownership, retention and recovery state beyond the native checkout. Forwarding
raw stderr would expose native details that the browser does not need.

The [HTTP API](../architecture/http-api.md) and
[progress schema](../../contracts/v1/github-clone-progress.schema.json) define
the wire interface. The
[implementation issue](../../issues/show-large-clone-progress/item.md) holds
the original approvals and implementation evidence.
