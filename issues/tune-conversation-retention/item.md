---
created: 2026-10-02
updated: 2026-10-02
type: improvement
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3xj0rdnnfgsm45yabgh5bpq/follow-up:conversation-retention
originating_run: 01m3xj0rdnnfgsm45yabgh5bpq
originating_run_kind: spinoff
---

# Tune browser conversation retention and eviction after measurements

## Goal

After the first browser conversation-store implementation has measurements, tune retention and eviction for real conversation and tool-output sizes. The agreed initial rule in [conversation data-flow](../../docs/conversation-data-flow.md) keeps about 50 recently viewed whole conversation windows per tab, with no byte accounting or per-page release. A single very large conversation or many large tool results can still retain substantial memory; evicting only whole conversations can also discard useful recent content while keeping rarely used deep pages.

## Scope

Measure heap and click-to-paint on real long histories, large tool outputs and multiple concurrent conversations. Choose adjustable count/byte/deep-page limits from the evidence, preserving contiguous windows, native history as source and immediate warm switching. Do not introduce a second durable history store. Document chosen limits and behavior under pressure; verify scroll-back and reading-anchor restoration after release. This is a later improvement, not a blocker for the simple initial LRU.
