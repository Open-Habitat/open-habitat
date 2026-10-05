---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: operations-docs
preparation: ready
collision: [docs/, AGENTS.md]
---

# Deliver the installation and operations guide

Write `docs/operations.md` for someone installing Native Agent Host on their
own Linux server. The reader should be able to get a working installation
without knowing this repository's history or having access to Jari's Fleetrepo.

Explain prerequisites, installing a release, configuring accounts and sign-in,
starting services and checking that the installation works. Cover everyday
operation: updates, finding the running version, logs and troubleshooting,
backups and recovery. Explain where configuration and user data live and how
service restarts affect running agents.

Use the implemented software and shipped service templates as the source of
truth. The [deployment architecture](../../docs/architecture/deployment.md)
provides background; Fleetrepo's `infra/native-agent-host-test/` has practical
experience from the test installation. Turn that experience into generic
instructions without copying private host details. Describe known limitations
honestly where they affect the reader.

The work is complete when the guide is linked from the documentation index,
its commands and paths have been checked against the implementation, and it
clearly explains the information the installer needs to supply.
