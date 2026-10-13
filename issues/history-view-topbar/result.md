# Result

The native-history view now uses the same `AgentHeader` icon row as a controlled conversation: status, retitle, archive and info. The host's `regenerateTitle` requires an owned controller session; its archive handler explicitly refuses archiving a session without one (`read_only_history`). Both actions therefore remain disabled with the read-only reason. Process state remains unknown rather than inferred from readable history. The existing separate read-only status in the header is retained as a secondary indicator.

Paired synthetic-lab screenshots and offline HTML are `lab-{light,dark}-{1440,390}.{png,html}`. Compared with the draft, the read-only status chip remains present, and retitle/archive are disabled rather than enabled, because the host does not provide those capabilities for native history. The lab is same-UID synthetic host evidence, not a live test-server capture. Browser checks and visual approval follow the release.
