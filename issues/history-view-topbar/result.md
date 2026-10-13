# Result

The native-history view now uses the same `AgentHeader` icon row as a controlled conversation: status, retitle, archive and info. The host's `regenerateTitle` requires an owned controller session; its archive handler explicitly refuses archiving a session without one (`read_only_history`). Both actions therefore remain disabled with the read-only reason. Process state remains unknown rather than inferred from readable history. The existing separate read-only status in the header is retained as a secondary indicator.

Paired synthetic-lab screenshots and offline HTML are `lab-{light,dark}-{1440,390}.{png,html}`. Compared with the draft, the read-only status chip remains present, and retitle/archive are disabled rather than enabled, because the host does not provide those capabilities for native history. The lab is same-UID synthetic host evidence, not a live test-server capture. Browser checks and visual approval follow the release.

Validation: `./scripts/test-focused.sh --area web` passed (111 unit, 97 component); `OH_PORT_BASE=14600 ./scripts/test-focused.sh --area browser --spec native-history.spec.ts` passed 8/8, including desktop/phone disabled reasons and an axe scan of the changed header; `shell-accessibility.spec.ts` passed 3/3. The separate-UID and live test-server appearance were not checked.
