---
created: 2026-10-16
updated: 2026-10-17
type: bug
status: fixed
priority: normal
provenance: ai-review
source_ref: taskfleet:01m52p93xx5dd5fqg6d73ey9tc/review-finding:create-refusal-as-uncertain
review_source: ai-review
originating_run: 01m52p93xx5dd5fqg6d73ey9tc
originating_run_kind: research
labels:
- ai-review-model:claude-opus-5-5
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_target: e9bec7d5
lane: web
blocked_by: ['@browser-mutation-layer']
collision: [web/src/app/, web/src/components/]
closed: 2026-10-17
---

# + shows a definite capacity refusal (429) as an uncertain creation and blocks +

## Description

Observed in the synthetic lab on 2026-10-16 (product `e9bec7d5`) during `ui-responsiveness-review` measurements.

Once a user has four controlled Pi conversations running (the daemon's per-user capacity, `internal/daemon/conversation_linux.go` create: `active >= 4` → `429 capacity_exceeded`), pressing + again gets a clean refusal from the daemon in 1–3 ms. The browser nevertheless shows "Luonnin tulos epävarma. Tarkista tiedot ennen uutta yritystä; pyyntöä ei lähetetä automaattisesti uudelleen." with a "Tarkista luonnin tulos" button and a disabled composer, and + for that workspace stays blocked by the uncertainty marker.

Cause: `createTracked` (`web/src/app/conversations.ts:270`) writes the `nah:<identity>:uncertain:<workspace>` marker before the POST and removes it only on success. Every non-401 failure, including a definite typed refusal (409/429), therefore counts as "maybe created". `continueConversation` already distinguishes `capacity_exceeded` (`conversations.ts:505-515`); create does not.

Expected: a typed 4xx refusal is "not created". Remove the marker, say why ("Liian monta käynnissä olevaa keskustelua — sulje tai pysäytä jokin") and leave + usable. Only transport loss or 5xx is uncertain.

Repro: `scripts/lab.sh start`, sign in as Alice, create four conversations with +, press + a fifth time. Evidence and context: `issues/ui-responsiveness-review/analysis.md` (pattern 7).
