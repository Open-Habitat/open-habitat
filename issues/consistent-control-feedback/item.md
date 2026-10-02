---
created: 2026-10-02
updated: 2026-10-02
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: chat:2026-10-02:ui-observations:4-6
---

# Make hover focus and active feedback consistent across UI controls

## Description

Reporter observation (2 Oct 2026): Home agent list and repository-name hover feedback look good; the account-avatar popover and some other buttons/menus lack equally clear hover states. Wants coherent hover and keyboard focus/pressed feedback throughout, not one-off fixes. Sidebar agent selectors should show the status dot (empty/green/pulsing depending on activity), and the large "Päivitä" label near the search should use the curved-arrow icon from the design draft. Verify actual sidebar state and the draft against live screenshots; do not communicate status by color/animation alone. Consider shared button/menu/status variants and their interaction-state stories rather than ancestor-specific CSS overrides.
