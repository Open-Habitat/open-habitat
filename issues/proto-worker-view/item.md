---
created: 2026-10-25
updated: 2026-10-26
type: improvement
reporter: jari
status: done
priority: normal
lane: proto-worker
lane_seq: 1
preparation: pending
closed: 2026-10-26
---

# Prototype a worker's view as a read-only conversation instead of terminal output

## Description

Jari, 2026-10-25, watching the conductor's Taskfleet workers in Habitat on
Birch: "aliagenteissa pitäisi käyttää ainakin jossakin määrin samanlaista
käyttöliittymää kuin pääagentissa. Nyt se on vain holtiton tekstidumppi. Miksi
ei samaa käyttöliittymää ilman kirjoita viesti -laatikkoa ja ehkä jotain muuta
visuaalista vihjettä, että kyseessä on worker." (A worker's view should use
the main conversation UI, without the composer, with a visual cue that this
is a worker. "Worker" is the right word.)

Today a spinoff opens as read-only terminal output of its tmux pane
(`web/src/components/Spinoffs.tsx`, `TerminalPanel.tsx`). Workers are native
Pi or Claude Code sessions in their worktree, so their native history exists
and Habitat already renders both kinds of conversation.

## Goal

A prototype round of the worker view: the worker's native conversation shown
with the conversation components (thoughts, tool calls, replies), no
composer, a clear "worker" identity (whose worker, which task/issue, state,
landed or not, link back to the parent conversation), and what remains of the
terminal (for example a toggle to the raw pane for a stuck prompt). Variants
for how strong the worker cue is and where the view opens (in place of the
conversation, side panel). Note which host facts each needs: mapping a run to
its native session file for Pi and Claude workers, and whether it exists.

## Acceptance Criteria

- [ ] Prototype variants with notes, and Jari's verdict recorded.

## Decisions

### 2026-10-26T09:31:11Z · @jari

Jari 2026-10-26 on round 1: 'Kehys' is OK. Workers do not show nested in the sidebar (the sidebar already has the worker mark). Round 2: prototype the state where a Claude worker shows only its terminal until its history is readable, and the 'no composer' notice ('Workerille ei kirjoiteta'), which should say the main agent can message the worker, so the person can ask it.

### 2026-10-26T12:30:52Z · @jari

Jari 2026-10-26 on round 2: 'Pääte keskustelussa' (the terminal shown inside the conversation view) rather than the recommended Välilehti. Together with round 1's Kehys this is the specification for implementation.
