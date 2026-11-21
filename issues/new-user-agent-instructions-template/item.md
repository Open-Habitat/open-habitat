---
created: 2026-11-17
updated: 2026-11-21
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/new-user-agent-instructions-template
preparation: ready
lane: agent-instructions
lane_seq: 1
---

# New account starts with a template for the person's own agent instructions (Pi AGENTS.md, Claude CLAUDE.md)

## Description

Jari 17.11.2026: when Open Habitat creates a new user, it could create a starting template for the person's own global agent instructions: ~/.pi/agent/AGENTS.md and/or the corresponding Claude files (~/.claude/CLAUDE.md). To be considered: what goes in it (who the person is, language, how they want answers, which of their own context is useful), how it relates to what Habitat already injects into every conversation (the Open Habitat environment block) so nothing is duplicated or contradicts it, one shared file vs per-harness files, existing accounts (offer, never overwrite), and whether the person or their agent fills it in through a guided first conversation.

## Decisions

### 2026-11-21T08:04:19Z · @jari

Jari 21.11.2026: prototype it. The person lands in a first conversation that is part of onboarding, where the chat is held and the agent writes the person's own instructions. He wants to see what it looks like and what is asked; it must be tested. Conductor recommendations taken into the round: one shared file both harnesses read (Claude file points to it), nothing duplicated from Habitat's own environment block, existing accounts offered the same conversation without overwriting.

### 2026-11-21T08:21:05Z · @jari

Jari 21.11.2026 on round 1: wrong direction. It must be part of the onboarding chain itself, in that user interface where the person clicks through GitHub sign-in, model sign-in and so on — as the last step of that chain, not a separate conversation after onboarding (round 1 deliberately avoided a route step; reverse that). Next action: prototype round 2.

### 2026-11-21T10:04:59Z · @jari

Jari 21.11.2026 on round 2: direction A Keskustelu, but riff on what the person is told: today's text is long and technical. After the conversation the file itself is shown. The conversation is archived or similar — note that it has no meaningful repository, so it may not even need archiving (decide). Existing accounts: can continue this in any conversation, and a Settings view (Tili › Ohjeet agentille) is needed — prototype it. Structured choices from the agent (quick replies) accepted (recommendation).

### 2026-11-21T12:45:50Z · @jari

Jari 21.11.2026: onboarding — A2 Muistilappu wording is best; A3 Esittely's field behaviour is best (the person can edit a free-form text themselves). Next round combines them, with a free-form step and a language choice. Settings › Tili › Ohjeet agentille — an ordinary Markdown block that opens in an Esikatselu (preview) tab, i.e. direction B Teksti modified; implies a daemon read plus a compare-and-swap write of the instructions file.

### 2026-11-21T15:33:47Z · @jari

Jari 21.11.2026: onboarding A4.1 (language first, own words last); Settings B1; architecture accepted (daemon read plus compare-and-swap write of the instructions file, also used by onboarding's Save). Languages: guess the default from the time zone, the computer's locale settings etc. Asks: where does the agent take its questions from, and can the administrator add questions?

## Agent Runs

### 2026-11-21T10:16:00Z · @claude-opus-5-5

Round 3 (run 01m7ys440yp9cdt0dga8tsyyq9): direction A reworded in three variants (A1 Lyhyesti, A2 Muistilappu, A3 Esittely), file revealed before Save; recommendation A2; the step's conversation is never shown in the rail (home-directory sessions belong to no workspace). Result: result-3.md.

### 2026-11-21T13:09:35Z · @claude-opus-5-5

Round 4 and Settings round 2 (run 01m7z2abc80610mqsxnsa07t3w): one shared instructions editor (Esikatselu/Muokkaa, Tallenna/Peru, compare-and-swap merge via the workspace editor's threeWay and conflict card) used by both pages. Onboarding A4.1 Keskustelu / A4.2 Ensin itse / A4.3 Vieressä differ in where the own-words step and the answer-language choice sit; recommendation A4.1. Settings B1 keeps Muokkaa agentin kanssa as a secondary action, B2 drops it; recommendation B1. The note is now written by the page through a daemon read + compare-and-swap write, not by the agent's tools. Results: result-4.md, result-settings-2.md.
