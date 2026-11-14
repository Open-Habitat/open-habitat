---
created: 2026-11-07
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: other
provenance_detail: taskfleet worker finding from Kaisa's journal facts
source_ref: taskfleet:01m6tyjw70920ryv19hn8srmx9/pi-unasked-exit-status-0
originating_run: 01m6tyjw70920ryv19hn8srmx9
originating_run_kind: spinoff
lane: pi-diagnostics
lane_seq: 1
preparation: ready
---

# Pi ends itself (status 0, input open) in an empty browser conversation; the journal cannot say why

## Description

Observed on Birch, 7.11.2026 13:59:50 EET, in Kaisa's daemon journal (read with her consent; facts in the closed issue `rename-fails-kaisa`):

`conversation_pi_ended outcome=unasked` for an empty browser conversation: "Pi exited with status 0; Habitat had not closed its input". Before it the same person had five `continue` (wake-on-typing) 200s, one `continue` 409 at 13:58:30 and a `cancel_held`, i.e. a message held for a Pi that did not become usable and was taken back. Right after the exit the browser closed the empty conversation and the person started a new one.

Why it matters: an exit with status 0 while Habitat still holds Pi's input is Pi ending itself (an extension, Pi's own shutdown handling, or a signal Pi handles gracefully), not a crash and not one of Habitat's stops (those record their cause before closing). The person sees the conversation end for no reason and has to start over.

What is missing to diagnose it: the daemon keeps only storage diagnostics from Pi's stderr (`storageDiagnosticPipe("pi_runtime")`), so the journal says nothing about why Pi ended. A next step is to keep a bounded, redacted reason for an unasked status-0 exit (for example Pi's last stderr line class, or whether a native extension requested shutdown), then reproduce with her Pi settings and extensions in a synthetic home.

Not the cause of the failed rename: that was the title request colliding with the automatic title and the browser choosing the history operation (fixed in `rename-fails-kaisa`).
