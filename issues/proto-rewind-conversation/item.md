---
created: 2026-11-03
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
lane: proto-rewind
lane_seq: 1
preparation: ready
---

# Prototype: return a conversation to an earlier message

## Description

Jari 3.11.: in Pi's terminal you can take a conversation back to an earlier
message (`/tree` navigates the session tree; `/fork` creates a new session
from an earlier user message; `/clone` duplicates at the current position;
the RPC has `fork`, `clone`, `get_fork_messages`, see Pi's
`docs/slash-commands.md`, `docs/rpc-commands.md`, `docs/session-format.md`).
Habitat has nothing for it. Riff and test how it works in the browser and how
one gets to it.

First the facts (written in result.md before the directions): what each Pi
mechanism does to the native session (in-place branch within the same file
vs a new session file), what happens to the later messages (kept on another
branch, hidden, gone), to files the agent already changed (Pi does not undo
them), to a running turn, and what the daemon would need (RPC verbs; history
projection of branches). Then the UI: where the action is (a message's own
menu, hover action on own messages, ⋯ › *Palaa aiempaan*, a list of earlier
messages), what the person sees before confirming (what will be left
behind, that file changes stay), whether the result is the same conversation
continued from that point or a new conversation in the rail, how the
abandoned part can be seen again, and the edited-message case (go back and
send a changed message). Three directions on the default view, one line
each at the top; phone and desktop; recommendation.

## Decision (Jari 2026-11-06)

Suunta **Palaa tähän**. Uutta keskustelua ei synny: korvattu jatko
korvaa aiemman saman keskustelun sisällä. Katso, miten tämä menee Pi:n
omassa historiassa (`/tree`, istuntotiedoston haarat), ja peilaa sitä.

Tiedostojen palautus: tutki, miten se tehdään. GitHub-käyttäjällä *raine*
(workmuxin tekijä) saattaa olla tähän Pi-laajennus; jos ei, jokin muu
(Pi:n laajennukset, checkpoint-työkalut, git-pohjaiset ratkaisut).
Kierros 2 riffaa tätä vielä kertaalleen.

## Decision (Jari 2026-11-06, kierros 2)

**C Valitse mitä** näyttää hyvältä. better-pi-rewind (raine, MIT) on pohja
sille, millaisen tästä haluamme. Kierros 3 riffaa vahvistusdialogia: nykyinen
oli ison näköinen; näytä myös, onko tiedostojen palautus oletuksena päällä
vai pois.

## Acceptance Criteria

- [ ] result.md with Pi's mechanisms and what the host would need, and a prototype round with three directions, a recommendation and at most three questions.
