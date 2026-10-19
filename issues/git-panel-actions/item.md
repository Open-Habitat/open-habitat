---
created: 2026-10-19
updated: 2026-10-19
type: improvement
reporter: jari
status: open
priority: normal
lane: git-panel
lane_seq: 1
collision: [web/src/components/git-status]
preparation: ready
---

# Git panel: fetch and reread look the same; spacing, colour and wording

Jari on the test server (pilot.231), 2026-10-19, Git details panel opened from the conversation top-bar chip (workspace `issuectl`, `main · 0 muutosta ↓8`):

- **Hae etärepo** and **Sulje** touch each other (Sulje wraps to its own row directly under the action row with no gap), and Sulje looks too large for its role.
- Button text colours disagree: Hae etärepo's label is black while Lue uudelleen and Sulje are green.
- "Hae etärepo" is an odd phrase; he expected the button to do `pull --rebase`. He pressed it in `issuectl` and "ei se tehnyt mitään" — he then realised it is a fetch. To him **Hae etärepo** and **Lue uudelleen** now look like two buttons doing the same thing. His suggestion: if pulling is the agent's job, say so under the actions, e.g. "pyydä agenttia vetämään muutokset (pull --rebase)".
- Fetch itself worked (no error) and the chip/details were otherwise right and updated promptly after commits.

Do: fix the spacing/size/colour against the button system (`implement-button-system` roles), and resolve the two-similar-buttons confusion. Product direction within ADR/prototype `proto-git-status-panel`: the host does not pull or rebase on the person's behalf (the agent does Git work). Choose wording that says what fetch does ("Hae muutokset etärepoista" or similar, with the result stated: "Ei uutta" / "8 uutta committia") and add the short hint about asking the agent to pull. Record the choice under "Decisions for later review".
