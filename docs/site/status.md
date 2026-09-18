# Current status

**Authority:** Sole reader-facing narrative of the architecture initiative's current state.

**Updates when:** A meaningful reader-visible milestone, review result, decision need, next proof, or the landed project-state baseline used by this narrative changes; ordinary task churn alone does not require a rewrite.

**Not the source for:** Executable task state, scheduling, accepted architecture, research findings, or durable decision rationale.

**Updated:** 2026-09-18

**Source revision:** `2552704579715cba56a289af364e2da4dc2d220b` (latest landed project-state baseline summarized here; not the self-referential documentation commit)

## Summary

The architecture effort has a provisional reference model and a common evidence method, but it is not yet architecture v1. The initial AHP analysis, ecosystem screening, and documentation-workflow study have landed, and this Project View now provides one maintained front door. The model deliberately keeps protocol, identity/policy, isolation, data lifecycle, and deployment choices open until source-grounded adoption evidence is available.

## Ready to review

Reviewers can now inspect the integrated [provisional architecture](architecture), the revision-pinned [evidence index](evidence), the bounded [decision gates](decisions), and the architecture-level [proof plan](implementation). The canonical reports remain linked rather than copied into this site.

## Decisions needed

No immediate owner decision is requested by this documentation slice. The choices that must be made before protocol lock or architecture v1 are indexed in [decisions](decisions), with their prerequisite evidence. They should not be resolved from v0 assumptions alone.

## Next proof

The next evidence wave is the Pi-extension/AHP mapping and deep shortlist competitor dossiers. After those protocol follow-ups land, the initiative needs the four current-state adoption dossiers and a high-capability synthesis/review before locking the MVP protocol or starting broad implementation. Live task status and ordering remain in the [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) and issuectl.

## Notable limitations

No Alder/current-orchestration, Northwind, or Acme implementation dossier has landed. The current architecture therefore states hypotheses about those environments rather than verified implementation facts. AHP is a strong candidate for the live browser-session seam, but multi-user identity, tenancy, durable product history, policy, credentials, and orchestration remain platform responsibilities and the protocol choice remains open.
