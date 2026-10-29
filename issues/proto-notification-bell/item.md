---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: proto-notification-bell
lane_seq: 1
preparation: pending
---

# Prototype: top bar bell for announcements such as the quota warning

_Source: chat_

## Description

Jari 29.10. (from `research-alder-pi-plugins`): plugin status does not go in the top bar and plugins need no browsing UI. Instead the top bar could have a **bell icon** that appears when there is something to announce, e.g. the quota warning (storage near its limit), and opens what it is about.

Prototype round (design-system/prototypes method: 2–3 directions on one axis, production context, desktop and phone, light and dark, synthetic data, one offline file). Look at what the product announces today (quota observation, restart notices, agent notices, extension notifications, connection warnings) and propose which belong behind the bell, how it shows unread, and how an item is dismissed. Record host facts with file paths in result.md: which announcements exist as native facts, which would need a new read, and that no notification store is added without a concrete need.
