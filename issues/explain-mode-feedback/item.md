---
created: 2026-11-21
updated: 2026-11-22
type: feature
reporter: jari
status: done
priority: normal
lane: explain-feedback
lane_seq: 1
preparation: ready
closed: 2026-11-22
---

# Prototype: feedback from explain mode

## Goal

Explain mode graduates to an ordinary feature (21.11.2026), and Jari wants feedback from it: a way for the person to tell whether an explanation helped or was wrong, so the explanations can be improved. Prototype how feedback is given and where it goes.

## Decisions

- Jari 21.11.2026: "haluan että tästä tulee palautetta".

### 2026-11-21T15:33:47Z · @jari

Jari 21.11.2026: the card footer is probably right, but test it for real: the card is a mouse-over hover, so riff a round where the view works with the mouse as the real explain mode does. The administrator must never see feedback the person has not sent. A public GitHub issue is fine but sending should be faster and clearer.

### 2026-11-21T18:43:07Z · @jari

Jari 21.11.2026 on round 2: A Kulkureitti. Rethink the feedback content: no positive feedback (we do not want such messages in GitHub); merge 'Väärin' with the note — the person must write something, and it must reach us very easily, directly. Riff again.

### 2026-11-22T04:27:19Z · @jari

Jari 22.11.2026: round 3 direction A — Avaa GitHubissa opens a prefilled public GitHub issue with the text and the card id; nothing stored on the server. Implement.

## Agent Runs

### 2026-11-21T15:54:03Z · @agent

Round 2 (hover that behaves like production with the mouse) is in design-system/prototypes/rounds/2026-11-21-explain-feedback-2/; directions A Path / B Pin / C Settle, recommendation A; result, built page and evidence paths in result-2.md.

### 2026-11-21T18:54:43Z · @agent

Round 3 (one required 'Report a mistake' path on A Path's card; axis: how the written report reaches us) is in design-system/prototypes/rounds/2026-11-21-explain-feedback-3/; directions A GitHub / B Own account / C Feedback inbox, recommendation A; result, built page and evidence paths in result-3.md.
