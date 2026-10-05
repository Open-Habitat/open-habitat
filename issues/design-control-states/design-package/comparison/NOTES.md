# Returned design against the previous reference

Source: Jari's `Kontrollitilat ja agentin tila.zip`, based on package commit `1efd34d36acb753a207915be8121dc1b2a53fc94`. The previous reference was `design-system/drafts/Navigaatio ja asetukset.dc.html` before this round; the returned navigation file replaces it. These are local synthetic HTML renders in an isolated Chromium context, not host screenshots. The current draft adjusts the returned control-state explanation for the agreed disabled-reason rule; the images below show the response *as received*.

| View, viewport, theme | Before | Returned |
| --- | --- | --- |
| Settings, simulated phone frame 390 × 844, dark | [before](before-settings-phone-dark.avif) | [returned](returned-settings-phone-dark.avif) |
| Home, desktop frame 1440 × 900, light | [before](before-home-light.avif) | [returned](returned-home-light.avif) |

The settings pair has the same example data and state. The frame layout is retained; the theme segment order and selected treatment change (neutral surface and stronger border). The home pair has the same view, viewport and theme **but not the same example content/state**: the proposal adds a question, separate read-only working agent and operation tags, and reorders the waiting rows. It demonstrates the new presentation, not a pixel-matched comparison. The new control-state sheet has no previous equivalent to pair.

The designer's calculated contrast table reports both themes above its selected thresholds for the sampled pairs; the old primary pending opacity fails. This is not an independent accessibility audit: field outlines are expressly below 3:1 in the proposal, and the 200% zoom and focus claims have not been verified against production controls. No same-state draft-versus-production lab comparison has been made; @apply-control-state-design owns it. Conditional agent states cannot be called covered by a lab capture until their host facts and fixtures exist.
