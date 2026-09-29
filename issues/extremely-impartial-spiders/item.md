---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m3qktyewbnsjx22arn0qcgwa/review-finding:ux-audit-round-4
review_source: ai-review
originating_run: 01m3qktyewbnsjx22arn0qcgwa
originating_run_kind: research
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: medium
review_target: browser UI at e2f2be7138e97e1119838a63ddde2eca15b6a7c6
---

# Honor dark system theme and clarify return-to-work cues

Fourth synthetic-browser holistic UX audit at e2f2be7138e97e1119838a63ddde2eca15b6a7c6. Fresh production build, fake OAuth, invented homes and fake Pi. Confirmed defect: with browser prefers-color-scheme: dark, production still renders a light screen (body rgb(246,247,248)); the same tokens render dark when manually given data-theme=dark. No production theme switch or system-theme wiring was found, although both are agreed v1 behavior in design-system/production-v1.md. Other observed UX issues: “Jatka keskustelua” links to native histories that open read-only; Pi sign-in makes the exit button more salient than starting sign-in; route focus draws browser-default black heading outlines. Full ranked findings, screenshots and limits in audit.md. Account display and route convergence are already tracked by decide-account-display, not refiled. Leave this item unlaned for human review.
