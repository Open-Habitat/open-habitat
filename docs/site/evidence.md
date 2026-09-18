# Evidence

**Authority:** Provenance index for landed architecture evidence and design inputs.

**Updates when:** A research report, dossier, benchmark, synthesis, or material revision lands or its known limitation changes.

**Not the source for:** Research findings, architecture acceptance, decision rationale, or implementation/task state.

Each row identifies the canonical artifact and the exact repository revision that introduced its current content. Follow the link for findings, citations, methods, and limitations.

## Landed evidence and design inputs

| Artifact | Exact revision | Scope | Important limitations | Informs |
|---|---|---|---|---|
| [Reference architecture v0](https://github.com/maintainer/native-agent-host/blob/2292047fc1a59efb3a22e9373eba46b8599e74ca/issues/native-agent-host-architecture/reference-architecture-v0.md) | `2292047fc1a59efb3a22e9373eba46b8599e74ca` | Provisional target model, authority boundaries, flows, risks, walking skeleton, adoption hypotheses, and decision gates | Target design derived from repository requirements, not observed implementation; Northwind and Acme repositories were not inspected, and Alder behavior remains unverified | [Architecture](architecture), [decisions](decisions), [implementation](implementation) |
| [AHP analysis](https://github.com/maintainer/native-agent-host/blob/19bd88389129b7fdb0b856b10f274620a1b36524/issues/native-agent-host-architecture/research/agent-host-protocol-analysis.md) | `19bd88389129b7fdb0b856b10f274620a1b36524` | AHP 0.9.0 model, implementations, Pi-AHP evidence, fit-gap, and four integration paths | Pre-1.0 protocol; Pi integration is an in-process existence proof, not validation of the current Alder/tw lifecycle or multi-user policy | Protocol and adapter gates |
| [Agent-host ecosystem map](https://github.com/maintainer/native-agent-host/blob/cee78199de92531b785b54642f8de4042b7e74b7/issues/native-agent-host-architecture/research/agent-host-ecosystem.md) | `cee78199de92531b785b54642f8de4042b7e74b7` | Source/documentation screening across protocols, hosts, control planes, application frameworks, multi-user platforms, and execution substrates | Screening, not hands-on benchmark; edition boundaries, recovery, performance, accessibility, and security need deeper verification | Comparator shortlist and dossier work |
| [Aggountant Project View analysis](https://github.com/maintainer/native-agent-host/blob/4904786f0c81f6445c89a7d805c962157fdbfdd8/issues/native-agent-host-architecture/research/aggountant-project-view-analysis.md) | `4904786f0c81f6445c89a7d805c962157fdbfdd8` | Maintained documentation archaeology and six-page recommendation | Describes aggountant at its pinned local revision; its domain scale and synchronization fan-out are deliberately not copied | This documentation contract |
| [Dossier and benchmark template](https://github.com/maintainer/native-agent-host/blob/caab0986271421741f82e915cf0f2a2f26c3911c/issues/native-agent-host-architecture/dossier-and-benchmark-template.md) | `caab0986271421741f82e915cf0f2a2f26c3911c` | Shared investigation, evidence-tagging, comparison, and scenario structure | A template, not evidence about any subject | Future dossiers and benchmarks |
| [Architecture epic and clarification](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) | `2552704579715cba56a289af364e2da4dc2d220b` | Product goal, adoption cases, phase plan, boundaries, and Taskfleet protocol clarification | Planning authority, not implementation evidence; live status must be read with issuectl | Scope, status interpretation, and proof plan |

## Evidence still required

The canonical [architecture epic](https://github.com/maintainer/native-agent-host/blob/2552704579715cba56a289af364e2da4dc2d220b/issues/native-agent-host-architecture/item.md) calls for source-grounded dossiers of Alder/tw/Pi/current orchestration, the Northwind workflow, and both Acme Creator implementations, followed by fit-gap synthesis. The ecosystem shortlist also requires focused competitor dossiers and Pi-extension/AHP mapping. These are evidence gaps, not negative findings.
