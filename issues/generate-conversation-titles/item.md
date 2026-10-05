---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m45tjw4bcnkre1genks6r7eh/conversation-title-split
originating_run: 01m45tjw4bcnkre1genks6r7eh
originating_run_kind: spinoff
preparation: reviewing
---

# Generate conversation titles and allow regeneration

## Description

## Purpose

Give conversations recognizable titles generated from their content, with an
option beside the title to request a new one. This is the unfinished title work
split out of @complete-conversation-ui, not another general conversation-UI task.

## User decision

During the joint reading of @complete-conversation-ui, Jari confirmed that he
still wants model-generated titles and user-requested regeneration beside the
title. When asked to give that remaining work its own issue, he replied:

> Joo. luo sille oma issue

## Existing basis

[The product description](../../docs/product.md) describes the intended behavior.
[The title contract](../build-agent-control/general-contract.md#ohjauskyvyt-ja-otsikointi)
contains the earlier generation timing, bounded input, concurrency and failure
semantics, and links to the earlier adapter choice. Those details are existing
implementation input, not newly chosen in this reading; verify the native
capability and current model availability when implementing.

The [original implementation result](../complete-conversation-ui/result.md)
records first-prompt fallback labels but leaves full generation and regeneration
unfinished. This issue owns completing the daemon capability and browser action
together, including consistent titles in the conversation and navigation.

A new conversation starts as “Uusi keskustelu”. Generate a title from its content
without blocking conversation; later refinement and explicit regeneration should
not make the title change on every message. Failed or unavailable generation
preserves the previous title or the first-message fallback. Concurrent requests
must not cause competing title updates. Native history remains the source of
conversation content.

## Acceptance Criteria

- [ ] Conversations receive model-generated titles from their content under the agreed title contract.
- [ ] The person can request a new title beside the current title; conversation and navigation show the same successful result.
- [ ] Unavailable capability, concurrent requests and generation failures preserve a usable title and do not block sending or reading.
- [ ] Verification covers automatic generation, explicit regeneration and failure behavior, identifying which evidence uses a real native adapter and which uses fixtures.
