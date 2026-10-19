---
created: 2026-10-18
updated: 2026-10-19
type: feature
reporter: jari
status: done
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 2
collision: [internal/daemon/integrations]
closed: 2026-10-19
---

# Integrations: catalog core, Integraatiot page, login relay, personal-data skill

The common part: the daemon's catalog framework (entries as product code; status read live from each tool), the Asetukset › Integraatiot page in the Tili direction with each step on its own row and "Lisää toinen … -tili" per provider, the two login relays (pasted redirect, device code) through the browser, continuous sync supervision for file entries under `~/cloud/<service>/<account>/`, quota display, the agent-exposure warning, removal, and generation of the single personal-data skill in `~/.agents/skills/` from the connected accounts. Ship with one simple entry end to end (generic IMAP via himalaya is a good first one, needing no OAuth registration) so the framework is proven.

## Acceptance Criteria
- [x] Framework, page and skill generation with one working entry; host tests in a disposable home; browser flow with lab screenshots against the prototype.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
