---
created: 2026-11-23
updated: 2026-11-23
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
