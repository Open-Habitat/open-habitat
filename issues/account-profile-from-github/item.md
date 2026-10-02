---
created: 2026-10-02
updated: 2026-10-02
type: feature
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:7-8
---

# Show GitHub profile first name email and avatar in account UI

## Description

Reporter observation (2 Oct 2026): The account still reads "Oma tili" and Settings has no email. Can the GitHub name and profile image be shown too? Earlier Jari decision in @decide-account-display: first name in default/compact view, signed-in email when account view opens, source GitHub; onboarding asks if GitHub does not supply name/email. Current WorkspaceRailView hardcodes "Oma tili"; browser snapshot does not carry the required display fields. Determine whether/how to obtain a verified email and optional avatar, with explicit fallback, display-only semantics and no transfer of account authority to the browser. Keep settings work coordinated with @restore-v2-settings and sidebar work with @restore-v2-navigation.
