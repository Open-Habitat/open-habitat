# Current status

**Authority:** Sole reader-facing narrative of the architecture initiative's current state.

**Updates when:** A meaningful reader-visible milestone, review result, decision need, next proof, or the landed project-state baseline used by this narrative changes; ordinary task churn alone does not require a rewrite.

**Not the source for:** Executable task state, scheduling, accepted architecture, research findings, or durable decision rationale.

**Updated:** 2026-09-18

**Source revision:** `3230e1326e2f2280c6d79ff6dc83fd2d60988137` (latest landed project-state baseline summarized here; not the self-referential documentation commit)

## Summary

The architecture evidence synthesis and adversarial review has landed. It finds that none of the seven candidate designs satisfies the whole Native Agent Host need: each contributes a protocol, UI projection, runtime, control-plane or administration layer rather than a complete fit that also preserves the current orchestrator. The provisional architecture keeps a platform-owned identity, policy, durability and audit core around adapter-isolated host-native execution. It is still v0: no protocol, tenancy topology or architecture v1 has been selected.

## Ready to review

Reviewers can inspect the direct candidate verdict, challenged v0 assumptions, frozen five-subject benchmark, four launch-ready dossier scopes and ordered ADR agenda in the [canonical synthesis](https://github.com/maintainer/native-agent-host/blob/3230e1326e2f2280c6d79ff6dc83fd2d60988137/issues/native-agent-host-architecture/synthesis-and-architecture-review.md). The [provisional architecture](architecture), [decision gates](decisions), [evidence index](evidence) and [proof plan](implementation) integrate that gate without promoting recommendations into ADRs.

## Decisions needed

No architecture choice is ready for acceptance. The [decision gates](decisions) now state the evidence that unlocks the information-model, protocol/profile, identity, capability, durability, isolation, tenancy, application-integration, workspace and deployment ADRs. The MVP protocol and architecture v1 must remain open until those gates close.

## Next proof

The next evidence wave is the four independent current-state dossiers—Alder/tw/Pi/current orchestration, Northwind, and both Acme Creator implementations—plus preparation of the common benchmark fixture. The minimal native baseline should validate the frozen scenarios before AHP, ACP, AG-UI and LangChain spikes use them. Adoption fit-gaps and evidence-ready ADRs follow. Live task status and ordering remain in the [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) and issuectl.

## Notable limitations

No current-state adoption dossier or common-scenario behavioral result has landed. Candidate behavior, edition boundaries and operational claims remain bounded by the source/documentation evidence. The synthesis does not establish that AHP, ACP, AG-UI, LangChain or a custom API will win its evaluated seam; it establishes how to test them fairly. Multi-user identity, logical tenancy, durable product history, capability enforcement, credentials, privacy/deletion and orchestrator reconciliation remain unproven platform responsibilities.
