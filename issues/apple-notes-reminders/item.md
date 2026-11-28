---
created: 2026-11-23
updated: 2026-11-28
type: task
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Apple Notes and Reminders for agents (research)

## Question (Jari 23.11.2026)

Can Open Habitat agents use Apple Notes and Reminders?

Starting point from the conversation: iCloud has no public API for either (Reminders left
CalDAV with the iOS 13 upgrade; Notes live in CloudKit); unofficial iCloud libraries need
the whole Apple ID and break without notice. On a Mac both are reachable officially
(AppleScript/`osascript`, Shortcuts, EventKit for Reminders), and Habitat already has *Omat
koneet* (SSH to the person's own computers), so an agent could reach them through the
person's Mac.

## Research asks

- Which existing tools/MCP servers for Notes and Reminders on macOS are reliable and
  maintained; what they can read/write (Notes HTML, attachments, folders; Reminders lists,
  due dates, recurrence), and their licences.
- How it would connect through *Omat koneet*: what runs on the Mac, the macOS privacy
  (TCC) prompts over SSH and how to grant them once, the Mac being asleep/offline.
- Security and authority: what access the agent gets, what the person must consent to.
- Whether the same pattern serves Calendar and Contacts on the Mac too, and how it
  relates to Habitat's existing CalDAV/CardDAV integrations.
- Whether anything (iCloud web, Shortcuts automation, a companion app) works without a Mac
  being on.

Material for a design discussion with Jari, not an implementation plan.

## Decisions

### 2026-11-23T18:53:42Z · @jari

Jari 23.11.2026: approved the recommended bounded trial (approach 1: existing Mac tools over Omat koneet, synthetic data). Questions 1–3 not answered; trial defaults: the Mac awake and logged in is enough, Notes read + new plain notes, existing Omat koneet trust with per-app consent. Next action (approved): the trial on Jari's desktop Mac.

### 2026-11-23T18:54:22Z · @jari

Jari 23.11.2026 answered the research questions: (1) working while the chosen Mac is awake and logged in is enough; (2) Notes: reading selected notes and creating new plain notes is enough to start; (3) the existing Omat koneet account-wide trust with per-app consent is acceptable.

## Research

[research.md](research.md) (28.11.2026) consolidates the desk research with the trial and
attended-session results and recommends agent guidance over the existing SSH path
(AppleScript for Notes and non-repeating Reminders), with an EventKit helper only behind
an ADR if recurrence is needed. Three questions for Jari are at its end.

## Trial

[trial.md](trial.md) (23.11.2026): over SSH, macOS holds the SSH server responsible for
privacy requests. EventKit Reminders cannot be granted on that path; Notes/Reminders
automation raises a dialog that went unanswered (Mac locked), so the functional steps
await one attended session. Proposal and open questions are in trial.md.

## Comments

### 2026-11-24T07:10:26Z · @agent

Attended session 24.11.2026 (conductor, person at the desktop Mac):
- The person allowed the two Automation dialogs for sshd-keygen-wrapper (Notes, Reminders). After that, over SSH:
  - Notes via apple-notes-mcp's AppleScript core: create folder Habitat-koe, three notes (plain with ä/ö/å, HTML, Markdown routed via HTML), list, read back as HTML/plain/Markdown, search by title and by content, get-sync-status: all succeeded (one early "Folder not found" while the folder was being created, then fine).
  - Reminders via AppleScript: create list, an all-day and a timed reminder with a remind-me time, complete one, read dates back: works in ~7 s. The JXA variant (`reminders-jxa.js`) created reminders and then hung; use plain AppleScript.
- remindctl (EventKit) from a Terminal window the agent opened with `open -a Terminal` after `remindctl authorize` (grant goes to Terminal, not SSH): date-only, timed with alarm, weekly and every-3-days recurrence, list as JSON in system TZ, UTC and America/New_York, completing the weekly one created the next occurrence one week later (24.11. -> 1.12.), edit and clearing a due date: all succeeded. All-day reminders are stored at local midnight and keep their day.
- Conclusion: over SSH, AppleScript automation is enough for Notes (read + new notes) and basic Reminders; recurrence needs EventKit, which needs a desktop-session launcher (Terminal or a helper). Synthetic list/folder still on the Mac for the person's phone sync check; then removed with the trial directory.

### 2026-11-28 · @jari (via conductor)

Start the research.
