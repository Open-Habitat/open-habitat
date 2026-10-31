---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: open
priority: normal
lane: proto-rail-recent
lane_seq: 1
preparation: ready
---

# Prototype: recent inactive conversations in the rail

## Description

Jari 31.10.: the rail's upper part lists only conversations whose Pi is
alive (Sinun vuorosi, Käynnissä, Hiljaiset · yli tunnin). A restart, an
upgrade or Pi's own 10-minute idle stop therefore empties it, and a
conversation Jari was working on an hour ago is reachable only through its
workspace's page. Jari agreed that the rail should also reach **recent
inactive conversations**, independent of whether their Pi is alive.

`rail-running-after-done` (on main, not yet on the pilots) already narrowed
Käynnissä to work going on; `rail-interrupted-turn-hidden` makes a turn cut
by a restart visible as interrupted; `rail-icons-no-grouping` removes the
workspace folds when icons are on. This prototype decides how the rail as a
whole reads with a recent section added.

Think of it as a state model like `proto-next-waiting-states`: which
section a conversation is in for each situation (working, your turn,
asks, interrupted, finished recently, finished long ago, archived, Pi
stopped by idle/restart), and what moves it. 2–3 directions on one axis
(for example: how "recent" is defined, by time or count or the person's own
visits; one list sorted by recency versus sections), each with its state
graph and a clickable rail in production context, desktop and phone,
icons on and off.

## Comments
