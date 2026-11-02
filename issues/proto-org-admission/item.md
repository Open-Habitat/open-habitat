---
created: 2026-11-02
updated: 2026-11-02
type: task
reporter: jari
status: open
priority: high
lane: org-admission-proto
lane_seq: 1
preparation: pending
---

# Prototype: administration view for organisation-based admission

## Description

Jari 2.11.: prototype how organisation-based admission looks in Habitat's
administration (the research is `research-org-admission`). One view: the
administrator's access page, where today people are admitted one by one.
Show how an administrator connects a group (an organisation or a team) as
an admission source beside individual people, sees who is admitted through
it and who individually, sees someone who left the group (access withdrawn,
account kept or suspended, what happens to their data), and what a person
sees at sign-in when they are not (or no longer) in the group. Three
directions on the default view, one line each at the top saying what
differs, plus the recommendation.

## Acceptance Criteria

- [ ] A prototype round in `prototypes/` with three visibly different directions and a recommendation, both languages' texts in Finnish first.

## Decision (Jari 2.11.)

Direction 3, **Syy riveillä**: the Salli field also takes `organisaatio/tiimi`,
each row carries its reasons, a leaver is raised as a notice above the list.
The admission model itself is the simple one discussed 2.11. (membership
checked at sign-in with the person's own token, individuals kept as their
own source, a shorter sign-in lifetime, *Poista pääsy* for immediate
removal); the sign-in lifetime awaits Jari's answer.
