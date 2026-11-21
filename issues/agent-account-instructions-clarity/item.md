---
created: 2026-11-14
updated: 2026-11-21
type: improvement
status: open
priority: normal
preparation: pending
lane: agent-instructions
lane_seq: 1
---

# Clearer agent instructions and a smaller tool surface for connected accounts

## Observed (a pilot installation, 14.11.2026, release v0.1.1)

Asked to find an employment contract in a SharePoint folder, the person's
agent found it (search worked, 9 tool calls) but on the way called the
Microsoft MCP server's `delete-mail-folder`. The call was refused only
because a required argument was missing; nothing changed. The agent
reported it itself: listing files needed no such tool.

## Why (conductor's reading)

The agent's text for a Microsoft account is reason-based and short, but the
agent is handed about 110 Outlook tools (mail folders, rules, focused-inbox
overrides, calendar permissions, contact folders, each with create / update /
delete) next to 8 file tools, many with similar names (`list-folder-files`,
`list-mail-folders`, `delete-mail-folder`). Instructions cannot make that
surface clear; the surface itself is the confusing part.

## Direction (Jari 14.11.2026)

Clarify the agent's instructions: short, simple guidance that steers the
agent the right way so it knows what to do — not one more "don't do X" line.
Deliver a proposal for Jari, nothing shipped before he has read it:

1. The agent-facing text (host context `internal/daemon/host-context.md`,
   the personal-data skill `internal/daemon/integrations/skill_linux.go`
   and the per-account sections) rewritten for clarity: what each account
   is for, the normal path for each common task (find a file, read mail,
   prepare a reply, look at the calendar), and what is at stake, in as few
   words as carry it. Exact text in `agent-text.md` for Jari.
2. A proposal for the tool surface the agent is given per account level:
   which tools an agent's ordinary work needs, which are mailbox
   administration nobody asks an agent for, and how the level setting
   (`integration-account-level-microsoft-dropbox`) maps to that, with the
   trade-offs.

## Decisions

### 2026-11-21T08:19:05Z · @jari

Jari 21.11.2026: do not remove the mailbox-administration tools; they are useful. Instead split the Microsoft tools into topic areas the agent drills into (Pi MCP servers / namespaces with descriptions: Posti, Kalenteri, Yhteystiedot, Tiedostot, Postilaatikon ylläpito), so that searching for files never surfaces mail-folder deletion; destructive tools may require the person's confirmation; sign-in/logout tools hidden. Next action: research run with real Pi and the Microsoft server, then rewrite the proposal.

### 2026-11-21T10:04:59Z · @jari

Jari 21.11.2026 on research-topics: confirmation for deletes and calendar sharing is ok; prototype the confirmation question and the iconography of its icon. Asked again why five areas cost about 750 MB (conductor explains; proposes one shared server per person).

## Agent Runs

### 2026-11-21T10:15:13Z · @agent

Permission prototype round 2026-11-21-account-action-permission: three placements of the question (recommended 1 Kortti) and five icon candidates (recommended shield with question); see result-permission.md. Open host piece: the card needs a typed permission question in contracts/v1.
