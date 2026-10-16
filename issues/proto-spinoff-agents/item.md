---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-worktrees
lane_seq: 2
collision: [design-system/prototypes/rounds/proto-spinoff-agents]
preparation: ready
closed: 2026-10-16
---

# Prototype riff: quiet Git workspace page and subordinate spinoff agents

Riff round after Jari's evaluation on 2026-10-16 of `proto-workspace-page` (round `2026-10-16-tyotilasivu`) and `proto-worktree-agents` (round `2026-10-16-haaratyo`). Read both result.md files and the Decisions sections Jari added.

Jari: "Worktree-agentit ovat aina alisteisia jollekin varsinaiselle agentille joka on käynnistänyt ne. Taskfleet-toiminta on just tätä, että jokin agentti käynnistää itselleen worktreen, jossa se tekee jonkin yksittäisen asian ja mergaa sen sitten kun se on valmis. Kyse on autonomisesta spinoff-agentista, johon ei ole edes tarkoitus, että käyttäjä laittaa viestiä." (In short: worktree agents are always subordinate to the agent that started them; an agent starts a worktree for itself, does one isolated thing there and merges it when done. It is an autonomous spinoff agent that the user is not meant to message.) And: "Git-toiminnallisuutta ei tarvitse olla niin selkeästi näkyvillä. Jos kaikki on ajan tasalla, ei tarvitse näyttää. Joku status voi näkyä, mutta mahdollisimman hillitysti." (In short: Git functionality need not be prominent; show nothing when everything is up to date, and a restrained status otherwise.)

Prototype:
- **The workspace page in direction 1, Keskustelut edellä.** Git is shown only when not up to date, and as quietly as possible (decide how quiet: a muted line, a dot, or a tooltip). The sidebar + creates a conversation directly. The workspace + is a plain "Uusi keskustelu".
- **Spinoff agents under their parent conversation**, in three directions on one named axis (for example, where the spinoffs of a conversation appear: in the thread at the point where they were started, in the conversation's top bar or recap, or as quiet child rows under the conversation in the sidebar and on the workspace page). States: working, merged (with what landed), failed with preserved work, and waiting for the parent. Opening a spinoff is read-only: its transcript and result, with no composer. Show how the parent conversation sees the merge outcome.

Revise `issues/manage-agent-worktrees/architecture.md` to this model: the browser observes spinoffs that the agent started; the user does not start them. Check what the daemon needs from Taskfleet to map a run to the conversation that started it, natively, with no parallel registry, and update the relationship to ADR 0010. This is a proposal, not an ADR.

## Acceptance Criteria
- [ ] Round verified with check.mjs (light, dark, phone, interactions).
- [ ] architecture.md revised.
- [ ] `result.md` per the prototype worker rules.

## Comments

### 2026-10-16T05:38:58Z · @conductor

Clarification from Jari: on the workspace page, keep direction 1's Git pill-button in the page head as prototyped in 2026-10-16-tyotilasivu. Do not hide or redesign it. The riff is about the spinoff agents.

## Decisions

### 2026-10-16T06:15:09Z · @jari

Jari 2026-10-16: direction 1, Langassa. The status message above the composer is what one actually watches, so the spinoff state must be shown there. The 'Odottaa spinoffia' mark: the dot on the right may blink, so it is clear which conversation is the one running; especially clear in the left sidebar.

### 2026-10-16T06:17:45Z · @jari

Jari 2026-10-16: (1) the ADR 0010 amendment is accepted: spinoffs are Taskfleet-owned runs that the browser observes read-only, and browser-controlled worktree agents are deferred ('juuri tämä on se filosofia'). (2) The Taskfleet asks are accepted: created_by_session, session paths in run show, retained terminal runs, and supervision in its own user unit with its own runtime directory, so that daemon restarts do not kill spinoffs. (3) UI term: 'spinoff', or 'spinoff-agentti' where it fits.
