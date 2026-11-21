# Research round — 2026-11-17

Step 1–3 of the issue's plan are in [research.md](research.md): a sourced benchmark, the keys-and-quota recommendation (the opener pays) and three architecture options with the recommendation to start from (a) — the opener's Pi with watch → propose → trusted-participant levels — and keep (b), a room Unix account, for durable shared projects. Section 4 lists one prototype round per view. No product code changed. The issue stays open: the architecture decisions and the prototype rounds are next.

## Decisions for Jari (security and authority; not decided here)

Listed in research.md, "Decisions that are Jari's": whether a guest may direct an agent holding the opener's credentials; whether the gateway may route one person to another's daemon and the daemon accept a member identity on a separate guest socket; same-server people only or outsiders too; whether watchers see tool output; whether room accounts may exist; per-guest spend limits from the start.

## Decisions for later review (research judgement)

- **ChatGPT group-chat rows rest on secondary sources.** OpenAI's launch post and Help Center refused automated reads; press coverage quoting them was used and marked. Alternative: omit them. Kept because they are the clearest consumer precedent and its retirement is relevant.
- **Per-speaker spend is proposed from Pi's native per-message `usage`**, not a new ledger. Alternative: a daemon-side counter. Native usage avoids a second store.
- **A gateway-held invite index (metadata only)** is suggested for "shared with me" listings, by analogy with `view-links.json`. Alternative: each guest's daemon stores received invites, which needs a cross-user write. This is a recommendation inside decision 2, not a decision.

# Architecture decision — 2026-11-21

ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`, Proposed) carries Jari's 21.11. decisions into the architecture: the gateway routes a participant to the owner's own default-deny `guest.sock` naming the person, and the owner's daemon decides from its membership record; participant messages enter Pi as companion-written `oh-participant-message` custom messages; the companion's `tool_call` hook makes a participant's turn text-only; Salli kaikki and per-operation approval go through `oh-conversation-line` continuations and the existing question path. Its eight questions for Jari (security and authority) are at the end of the ADR. Implementation is filed unlaned with `preparation: pending`: `@multiplayer-guest-routing`, `@multiplayer-membership`, `@multiplayer-turn-modes`, `@multiplayer-guest-stream`, `@multiplayer-browser`.

An independent review (one model, every finding checked against the code) found eight gaps, all fixed in the ADR before commit. Among them: provider-side web search and the Claude bridge's built-in WebSearch/WebFetch bypass Pi's `tool_call`; `pi.sendUserMessage()` also starts a `user` run; the mode must be rebuilt after a restart or wake relaunch; open journal streams check authorization only when they open.

## Decisions for later review (architecture judgement)

- **Approval asks about the real call when it would run, not about a list of steps proposed beforehand.** The prototype card listed the steps before the first one. Alternative: a proposal tool in the text-only turn, plus a continuation limited to those steps. The existing question path needs no tool on a tool-less turn and no matching store, and the owner approves the actual arguments.
- **The declared tool set stays unchanged on text-only turns; the hook blocks.** Alternative: `setActiveTools([])`. That does not stop codemode/deferred calls, and it discards the prompt cache twice per participant message.
- **Only the owner answers Pi questions in a shared conversation**, even with Täydet oikeudet. Alternative: full-rights participants answer non-approval questions. The daemon has no trusted way to tell an approval question from another one, and owner-only is simpler.
- **The membership record is a daemon file, not native history.** Alternative: native entries. Rewind and branch switches would bring back removed members, and changes would need Pi running.
- **Participant messages are text-only and are not search-indexed** for now (ADR 0036 stays the person's and the agent's text).
