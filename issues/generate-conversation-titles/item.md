---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: in-progress
priority: normal
provenance: chat
source_ref: taskfleet:01m45tjw4bcnkre1genks6r7eh/conversation-title-split
originating_run: 01m45tjw4bcnkre1genks6r7eh
originating_run_kind: spinoff
preparation: ready
lane: conversation-titles
collision: [internal/daemon/, web/src/app/App.tsx, web/src/components/Conversation.tsx]
---

# Generate conversation titles and allow regeneration

## Description

Give conversations recognizable titles from their content and let the person
request a new one beside the title. This is the remaining title work from
@complete-conversation-ui: native naming, automatic generation and the browser
action together, not another general conversation-UI task.

## Agreed behavior

A conversation has one name, stored as the Pi session name in native history
and displayed consistently in the browser conversation, navigation and Pi's
terminal session list. The host does not keep a competing title store. An
existing native name is displayed and is not automatically replaced, so a
person's chosen name survives. Explicit regeneration may replace it.

An unnamed new conversation starts as “Uusi keskustelu”, with the beginning of
the first user message as a fallback. The first generation attempt follows the
first accepted user message. For a conversation named by this automatic flow,
one automatic refinement follows completion of the third user message; an
intervening user-chosen name is preserved. After that, generation happens only
on request. This gives a useful name early without making it change continually.

Generation is a separate, lightweight model call through the user's Pi model
access, outside the conversation's agent work and without tools. It receives a
bounded text excerpt and produces a short title in the conversation's language.
Choose and justify the available model and practical input/output limits during
implementation. The earlier fixed model choice and reported USD 0.02 cost limit
are superseded: model availability changes, and a reported price is not an
enforceable spending cap.

Failed or unavailable generation preserves the previous name or fallback and
does not block sending or reading. Concurrent requests do not compete to update
the name, and a delayed result does not overwrite a newer user-chosen name.

## Native basis and implementation scope

Pi already supports session naming: its session-format documentation describes
`session_info.name`, used by the terminal session selector. This is storage and
naming support, not evidence of automatic model-generated titles. The joint
reading found no verified automatic generator to reuse. Inspect the deployed
Pi's current naming and model-call interfaces and reuse any suitable native
generation capability before adding the missing generation logic.

The host's current `internal/daemon/history_linux.go` uses `firstPrompt` in
`sessionFact` to build fallback titles rather than reading the native session
name. Complete native-name reading, generation and persistence through Pi, and
the browser's “Luo uusi otsikko” action. Preserve the existing single-writer
boundary; displaying terminal-origin names does not grant browser control over
those sessions.

This issue is the agreed title behavior in place of the older title-specific
choices in [the general contract](../build-agent-control/general-contract.md#ohjauskyvyt-ja-otsikointi).
[The original result](../complete-conversation-ui/result.md) records the fallback
implementation. Broader agent control remains outside this work.

## Acceptance Criteria

- [ ] Existing Pi session names appear consistently in the conversation and navigation; successful generated names persist natively and appear in Pi's terminal session list, without a separate host title store.
- [ ] Unnamed conversations receive an automatic title after the first accepted user message and at most one automatic refinement after the third user message settles; existing and intervening user-chosen names are preserved.
- [ ] The person can request a new title beside the current one; generation uses bounded text and a lightweight, tool-free Pi model call, producing a short title in the conversation's language.
- [ ] Unavailable capability, generation failures and concurrent or stale requests preserve a usable title and do not block conversation.
- [ ] Verification covers native-name persistence and reading, automatic timing, explicit regeneration, user-name protection and failure behavior, distinguishing real Pi evidence from fixtures.
