---
created: 2026-10-15
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-settings
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-settings-admin]
preparation: ready
closed: 2026-10-16
---

# Prototype: Asetukset, palvelimen ylläpito and API keys

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

Jari: the current settings and server administration views must be redone; look at the current ones and make them again. An unfinished round is in `design-system/prototypes/rounds/2026-10-15-asetukset/` (three structures: Yksi sivu, Osiot, Kaksi näkymää; its `round.mjs` says what is broken). Finish it and verify it. Content: account and sign-out, Git identity, GitHub and Pi connections, Pi default model, agent work default, theme, own storage; server name and version, users and administrator role, per-user storage limits, disk capacity and default limit; and the OpenAI API key (`provider-api-keys`).

## Acceptance Criteria
- [x] Round verified with check.mjs in all three directions, desktop and phone, settings and administration paths.
- [x] `issues/provider-api-keys/architecture.md`: how the key reaches Pi's native credentials as the mapped user, what the browser and contract see, how removal and switching work, risks.
- [x] `result.md` per the prototype worker rules.

## Decisions

### 2026-10-16T04:09:18Z · @jari

Jari 2026-10-16: direction 2, Osiot. The theme icons from the account menu (Jari menu) are also used in the settings view, at least as button prefixes. API key shown as sk-…abcd. The credential switch next to the default model is fine (hypothetical for now); default is the ChatGPT subscription.
