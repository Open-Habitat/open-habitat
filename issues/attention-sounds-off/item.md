---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
collision: [web/src/app/accountPreferences.ts]
---

# Attention sounds off by default

## Goal

Jari 23.11.2026: attention sounds are off by default. A person turns them on in Settings
(or the account menu's Äänet row) when they want them.

Today `defaultSoundPreferences.enabled` is `true` (`web/src/app/accountPreferences.ts`),
and the daemon stores only what differs from the defaults
(`internal/daemon/account_preferences_linux.go`), so the default's meaning also
decides what existing accounts get.

## Done when

- A new account, and an account that never chose, hears no attention sound until it turns
  sounds on; turning on works on every device as before, and mute/volume stay per device.
- A person who explicitly turned sounds on keeps them on, if the stored state can tell
  that apart; otherwise the worker records what existing accounts get.
- Settings, the account menu status line and any onboarding/help text describe the off
  default truthfully (no "sounds are on" copy when they are off by default).
