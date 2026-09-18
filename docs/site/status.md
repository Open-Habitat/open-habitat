# Current status

**Authority:** Sole reader-facing narrative of the architecture initiative's current state.

**Updates when:** A meaningful reader-visible milestone, review result, decision need, next proof, or the landed project-state baseline used by this narrative changes; ordinary task churn alone does not require a rewrite.

**Not the source for:** Executable task state, scheduling, accepted architecture, research findings, or durable decision rationale.

**Updated:** 2026-09-18

**Source revision:** `e7012c75e759af3a26dcea2ed2fb9d70ef077376` (latest landed project-state baseline summarized here; not the self-referential documentation commit)

## Summary

The architecture effort has a provisional reference model and a common evidence method, but it is not yet architecture v1. The initial AHP analysis, Pi-extension mapping, protocol competitor/traction benchmark, and seven shortlist candidate dossiers have now landed alongside the earlier ecosystem and documentation studies. This Project View is the maintained front door, while protocol, identity/policy, isolation, data lifecycle, and deployment choices remain open pending synthesis and adoption-case evidence.

## Ready to review

Reviewers can now inspect the integrated [provisional architecture](architecture), the revision-pinned [evidence index](evidence), the bounded [decision gates](decisions), and the architecture-level [proof plan](implementation). The canonical reports remain linked rather than copied into this site.

## Decisions needed

No immediate owner decision is requested by this documentation slice. The choices that must be made before protocol lock or architecture v1 are indexed in [decisions](decisions), with their prerequisite evidence. They should not be resolved from v0 assumptions alone.

## Next proof

The next gate is a high-capability synthesis and architecture review of the completed protocol and candidate evidence. It should freeze shared hands-on benchmark scenarios, resolve what evidence is still needed, and define the four current-state adoption dossiers before they launch. The MVP protocol and broad implementation remain unlocked. Live task status and ordering remain in the [architecture epic](https://github.com/maintainer/native-agent-host/blob/e7012c75e759af3a26dcea2ed2fb9d70ef077376/issues/native-agent-host-architecture/item.md) and issuectl.

## Notable limitations

No Alder/current-orchestration, Northwind, or Acme implementation dossier has landed, and the seven candidate dossiers are source/documentation studies rather than common-scenario behavioral tests. Pi extension tools and blocking input can use standard AHP semantics, while command discovery/invocation and Pi-specific UI need a negotiated private profile if required. ACP has the strongest coding-agent protocol traction, but no reviewed peer matches AHP's complete multi-client synchronized-state model. Multi-user identity, tenancy, durable product history, policy, and credentials remain platform responsibilities.
