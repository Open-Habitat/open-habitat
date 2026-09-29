---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: untriaged
priority: normal
provenance: other
provenance_detail: synthetic lab UI observation
source_ref: taskfleet:01m3q9qdqa4k8q1mfm551j62aj/lab-history-titles
originating_run: 01m3q9qdqa4k8q1mfm551j62aj
originating_run_kind: spinoff
---

# Differentiate older Pi histories in workspace navigation

## Description

In the synthetic lab, Alice's aurinkokello workspace has two distinct seeded Pi histories, both presented in navigation with the title "Uusi keskustelu" (new conversation). The history entries have real user prompts, but the navigation does not distinguish them, making it difficult to reopen the intended session. Reproduce with `scripts/lab.sh start`, sign in as Alice, expand aurinkokello in the workspace navigation. The source is a same-UID invented history; verify with native Pi histories before changing the title generation contract. Expected: a meaningful differentiator, such as the first user prompt or a date, for older sessions without an explicit title.
