---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
related: ['@extend-editor-tools']
lane: prototypes
lane_seq: 2
collision: [design-system/]
preparation: pending
---

# Research and prototype: ! shell commands, / and file completion in the composer

Jari, 2026-10-19: "Kolmas, jossa on erilaiset lisät (lähteenä tämä TUI liittymä): miten meillä voisi olla '!'-alkuinen bash-komentojen tekeminen, sitten skill-/komentojen ja tiedostojen autocomplete. Meillä on tässä tmux/tw-ympäristössä tällainen C-a C-f, joka voi olla kanssa yksi intuitio. Tästä research, että miten tämän voisi toteuttaa, ja kanssa prototyyppaus tietenkin."

Research and prototype composer additions modelled on the terminal agents (Pi's TUI, Claude Code):
- `!command` in the composer runs a shell command in the workspace as the person, its output shown in the conversation (and optionally given to the agent as context, as the TUIs do);
- `/` completion of the harness's commands and skills (names, descriptions, source), distinguishing inserting from running;
- file/path completion (`@path` style), fuzzy, from the workspace;
- the tmux/tw intuition: in Jari's tmux, `prefix C-f` (`~/bin/tmux-file-picker`) opens an fzf popup over the git/zoxide file list and inserts the chosen paths into the pane — a keyboard-summoned picker that inserts paths at the cursor.

Ground in what Pi actually exposes (its RPC/SDK command list, skills, bash execution, `!`/`!!` semantics in Pi's TUI) and what the daemon can serve safely as the person. Supersedes the narrower `extend-editor-tools` scope for these candidates. Output: research section in `result.md` and a prototype round under `design-system/prototypes/rounds/`.
