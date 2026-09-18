# Native Agent Host Project View

**Authority:** Navigation and reading paths for the maintained architecture view.

**Updates when:** The site's pages, authority boundaries, or intended reader journeys change.

**Not the source for:** Current status, architecture decisions, research findings, implementation scheduling, or task state.

This six-page view is the architecture front door for Native Agent Host. It points to canonical research, issues, and decision records rather than reproducing them. Those canonical GitHub links require access to the private `native-agent-host` repository. Start with [current status](status), then follow the path that matches your question.

## Reading paths

- **What is happening now?** Read [current status](status), then follow its links to the relevant evidence or decision gate.
- **What system are we proposing?** Read [architecture](architecture). It clearly marks the model as provisional and links to its full canonical source.
- **What has been decided or remains open?** Read [decisions](decisions). Accepted choices belong to ADRs; unresolved choices stay linked to their owning work.
- **What was inspected?** Read [evidence](evidence) for revision-pinned reports, scope, and limitations.
- **What proof must be delivered?** Read [implementation](implementation). Actionable work, ordering, and ownership remain in issuectl.

## Authority map

| Page | Owns | Does not own |
|---|---|---|
| [Architecture](architecture) | Current integrated architecture model | Alternatives, research observations, delivery state |
| [Decisions](decisions) | Decision register and gate index | ADR rationale or task scheduling |
| [Evidence](evidence) | Evidence provenance index | Findings or architecture acceptance |
| [Implementation](implementation) | Milestones, adoption proofs, completion evidence | Issue queues, lanes, or current narrative |
| [Status](status) | Sole reader-facing current-state narrative | Executable task truth or durable decision rationale |

The canonical work tracker is the [`native-agent-host-architecture` epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md). Use `issuectl` for live task state and scheduling.
