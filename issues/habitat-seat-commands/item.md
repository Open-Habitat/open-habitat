---
created: 2026-10-25
updated: 2026-10-25
type: feature
reporter: jari
status: open
priority: normal
---

# Seat-style agent commands (clipboard, open, show) for Open Habitat accounts

## Description

Jari, 2026-10-25, when planning to move his main conductor agent into Maalla Habitat (Birch): "tw-tyyppisille komennoille pitää miettiä open habitat -ympäristöön vastineet." (In short: tw-style commands need Open Habitat equivalents.)

On Jari's tmux/SSH setup, `tw` is the agent's way back to the person's own device (the seat):

- `tw clipboard copy -` puts text (a token, a command) on the person's clipboard without echoing it;
- `tw browser-open <file.html>` shows one self-contained HTML view in the person's browser;
- `code <path>` opens a file or folder in the person's editor;
- `tw fetch` pulls a seat-local file (a screenshot or a download) to the server;
- `tw client-exec` runs a command on the seat;
- `notify-jari` pushes a Telegram message (this one already works on Birch).

In Open Habitat the browser is the seat. An agent in a Habitat account has no way to reach the person's browser, clipboard, editor view or local files, except what the person types or uploads. On Birch, `tw` is absent and only `ssh alder tw ...` reaches Jari's real seat.

## Goal

Research and propose, as a recommendation for Jari, which of these the product should offer to an agent running in a person's own account, and through which authority. The daemon runs as the user and must trust no identity claim. Candidates: an agent-initiated "offer to clipboard" or "open this file/HTML/link" request that the person's open browser shows and the person accepts; opening a path in Habitat's own editor; uploads standing in for `fetch`; and probably no `client-exec`. Cover agents in browser Pi conversations as well as Claude Code or Taskfleet workers run in the same account over SSH or tmux. Keep the Unix-user boundary and the "reuse native components" rule. This is an architecture decision, so it ends in an ADR with Jari, and a prototype round follows if accepted.

Research and the shared recommendation are in [agent-to-browser surfaces](../agent-html-artifacts/research.md), including the `tw` mapping and proposed prototype round; Jari's architecture decision is still pending.

## Acceptance Criteria

- [ ] Research with a recommendation, covering what each tw function maps to (or why it is dropped), and the authority and security model.
- [ ] Jari's decision recorded (ADR).
