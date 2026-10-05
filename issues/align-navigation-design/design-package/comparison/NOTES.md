# Returned draft → reconciled reference

Source: designer's `Navigaatio ja asetukset -vedos.zip` (based on package commit `7364709396830ebf8fdb9a4b5fa9fc29c3c402e9`). Target: [`design-system/drafts/Navigaatio ja asetukset.dc.html`](../../../../design-system/drafts/Navigaatio%20ja%20asetukset.dc.html). All captures were rendered from local synthetic HTML with Chromium; no real account or agent data.

| View | Returned proposal | Reconciled reference |
| --- | --- | --- |
| Home, desktop 1440 × 900, light | [returned](returned-home-desktop-light.avif) | [reconciled](reconciled-home-desktop-light.avif) |
| Settings, simulated phone 390 × 844, dark | [returned](returned-settings-phone-dark.avif) | [reconciled](reconciled-settings-phone-dark.avif) |

Additional coverage: [collapsed desktop rail, dark](reconciled-narrow-desktop-dark.avif), [phone drawer, dark](reconciled-drawer-phone-dark.avif).

The home pair is the **same view/viewport/theme**, not the same content state: its synthetic rows were intentionally corrected to show a closed agent in Recents, an unvisited waiting conversation in Attention, a previously seen error in Recents, an unknown process without a false crash, and a separate read-only example. The settings pair uses the same simulated settings data; its layout did not change. These images demonstrate the design reconciliation, **not** production fidelity or a pixel-matched comparison to the earlier `Selainpolku` roundup. Earlier roundup content differs; its home and settings regions are no longer the current reference.

Interaction smoke checks in Chromium: visiting a waiting conversation removed only its attention placement; the waiting row remained. Visiting the new send error removed it from Attention while retaining the row's error. A simulated connection loss disabled the composer; simulated reconnection with a confirmed receipt changed the send-error example to working without resending. The returned read-only example, collapsed rail, dark phone drawer, and empty filter all rendered without page errors. Prototype controls simulate state; these checks do not prove host connectivity or receipt handling.

Remaining visual evidence gaps: light phone drawer and dark desktop settings can be selected in the reference but were not captured here; no paired synthetic-lab production comparison exists yet. Some Unicode icon placeholders in the standalone prototype render as missing-glyph boxes on this Linux Chromium installation. Production uses the shared icon component.
