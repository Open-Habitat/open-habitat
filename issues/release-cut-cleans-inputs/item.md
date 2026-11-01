---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: high
lane: release-cut-cleans-inputs
lane_seq: 1
preparation: ready
---

# Release cut leaves its 5 GB input directory behind

Jari 1.11.: every pilot release cut leaves a ~5 GB input directory
`/var/tmp/oh-pilotNN-inputs-*` on Alder (descriptors, downloaded and
verify copies, packages, predecessor archives). Pilots 11–17 hold about
33 GB together. They sit outside the expiring `/var/tmp/agent-scratch`
namespace, so nothing ever removes them. Alder's root is at 92 %.

The release cut should leave nothing large behind: build in a task
directory under `/var/tmp/agent-scratch` with the shared lease (Alder's
AGENTS rule) or remove its inputs once the release is published and
verified, keeping only what a later cut actually reads (with reused
runtime archives, previous archives come from the immutable GitHub
releases, not from local copies). Put the rule where the release cut is
described, so the next release worker follows it, and make it a script
step rather than prose if a script does the cut.

One-time cleanup: remove the existing `/var/tmp/oh-pilotNN-inputs-*`
directories on Alder (and Birch, if any exist there) after checking that
nothing references them (no running process, no open issue or inventory
pointing at a path inside). They are disposable build scratch: the
published releases are the record.
