---
created: 2026-11-24
updated: 2026-11-24
type: feature
reporter: Jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-11-24/multiplayer-own-kind
---

# Multiplayer conversations are their own kind, started with a multiplayer button, always on an API-key model

## Description

## What Jari decided (24.11.2026)

A multiplayer conversation is its own kind of conversation, not a mode that an
ordinary conversation slips into. The person starts one deliberately, with a
"multiplayer +" button (exact placement and look to be prototyped), and from
then on it always behaves the same way: someone writes, the agent answers.
There are no exceptions the person has to understand, no per-message
approval, and no talk of subscriptions, API keys or "automatic turns" in the
conversation itself.

Ordinary conversation and multiplayer conversation are the two kinds the
person sees. The boundary sits at one clear point: starting the conversation.

## Why

The experimental multiplayer (ADR 0038, retired as implemented) runs every
participant turn on the owner's Pi with the owner's model and credentials, and
lets the owner invite people into any existing conversation. When that model
is a personal ChatGPT subscription, OpenAI's Sign in with ChatGPT Terms
(effective 4.11.2026, https://openai.com/policies/sign-in-with-chatgpt-terms/)
say "Another user's activity must not trigger requests to the authenticated
user's account" and forbid "Using one user's subscription to fulfill another
user's requests". A Claude subscription through the bridge is in the same
position. Designs that made the agent's behaviour depend on the owner's
credential type (held messages, owner releasing each participant turn,
switching models when inviting) were rejected: they put a boundary the person
cannot see in the middle of the conversation.

## Direction

- A multiplayer conversation runs on an API-key model (the server's shared key
  or the owner's own key), chosen when it is started. Ordinary conversations
  keep using whatever the person has, subscriptions included.
- An ordinary conversation can become a multiplayer one, but only through the
  same "multiplayer +" button, never by a plain invite. Pressing it is the one
  boundary: the conversation moves to an API-key model at that moment (Pi
  switches models mid-session and keeps the history; Habitat already drives
  `set_model`), and from then on it is a multiplayer conversation like any
  other. Jari 24.11.: "if the conversation is moved from the subscription to
  the API key, fine; that is what we do." The first turn after the move costs
  the full uncached history once; some subscription-only models have no
  API-key equivalent and map to the nearest one.
- Multiplayer requires an API key, the owner's own or the server's shared
  one (Jari 24.11.). Without one, multiplayer is not available to that
  person; the prototype decides only how the button says so and where it
  points (the AI settings).
- The rest of ADR 0038 (owner card, participant strip, text-only participant
  turns with owner approval of tool calls, take-back) stays unless the
  prototype shows a reason to change it.

## Next action

A prototype round of how a multiplayer conversation is started and how it is
recognisable in the rail and the conversation, compared with an ordinary one.
Then the daemon change: the model of a multiplayer conversation comes only
from API-key providers, and the invite into an ordinary conversation goes.
