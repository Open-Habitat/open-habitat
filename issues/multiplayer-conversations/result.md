# Research round — 2026-11-17

Step 1–3 of the issue's plan are in [research.md](research.md): a sourced benchmark, the keys-and-quota recommendation (the opener pays) and three architecture options with the recommendation to start from (a) — the opener's Pi with watch → propose → trusted-participant levels — and keep (b), a room Unix account, for durable shared projects. Section 4 lists one prototype round per view. No product code changed. The issue stays open: the architecture decisions and the prototype rounds are next.

## Decisions for Jari (security and authority; not decided here)

Listed in research.md, "Decisions that are Jari's": whether a guest may direct an agent holding the opener's credentials; whether the gateway may route one person to another's daemon and the daemon accept a member identity on a separate guest socket; same-server people only or outsiders too; whether watchers see tool output; whether room accounts may exist; per-guest spend limits from the start.

## Decisions for later review (research judgement)

- **ChatGPT group-chat rows rest on secondary sources.** OpenAI's launch post and Help Center refused automated reads; press coverage quoting them was used and marked. Alternative: omit them. Kept because they are the clearest consumer precedent and its retirement is relevant.
- **Per-speaker spend is proposed from Pi's native per-message `usage`**, not a new ledger. Alternative: a daemon-side counter. Native usage avoids a second store.
- **A gateway-held invite index (metadata only)** is suggested for "shared with me" listings, by analogy with `view-links.json`. Alternative: each guest's daemon stores received invites, which needs a cross-user write. This is a recommendation inside decision 2, not a decision.
