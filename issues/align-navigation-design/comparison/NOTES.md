# Navigation comparison — synthetic views

Source implementation: revision `f10acfd` (rebased; the captured UI code is unchanged). Designer reference: `design-system/drafts/Navigaatio ja asetukset.dc.html`, selecting **Nykyinen host** (not the conditional full-facts example). Production uses a synthetic browser-host lab and is not a live user's view. The designer draft uses other synthetic conversations, so these are composition comparisons at the same viewport/theme, not pixel-matched identical-content pairs.

| View / viewport / theme | Production | Draft | Coverage |
| --- | --- | --- | --- |
| Home + rail, desktop 1440 × 900, light | [capture](production-home-light-desktop.avif) ([static HTML](production-home-light-desktop.html)) | [draft](draft-home-light-desktop.avif) | Distinct fixture conversations; layout review only. |
| Home + rail, desktop 1440 × 900, dark | [capture](production-home-dark-desktop.avif) ([static HTML](production-home-dark-desktop.html)) | [draft](draft-home-dark-desktop.avif) | Distinct fixture conversations. |
| Home + drawer, phone 390 × 844, light | [capture](production-home-light-phone.avif) ([static HTML](production-home-light-phone.html)) | [draft](draft-home-light-phone.avif) | Distinct fixture conversations. |
| Home + drawer, phone 390 × 844, dark | [capture](production-home-dark-phone.avif) ([static HTML](production-home-dark-phone.html)) | [draft](draft-home-dark-phone.avif) | Distinct fixture conversations. |
| Workspace, desktop, light | [capture](production-workspace-light-desktop.avif) ([static HTML](production-workspace-light-desktop.html)) | [draft](draft-workspace-light-desktop.avif) | Different conversations and workspace data; native management stays below the list. |
| Collapsed rail, desktop, light | [capture](production-collapsed-light-desktop.avif) ([static HTML](production-collapsed-light-desktop.html)) | [draft](draft-collapsed-light-desktop.avif) | Composition only; draft has conditional activity counts. |
| Open account menu, desktop, light | [capture](production-account-light-desktop.avif) ([static HTML](production-account-light-desktop.html)) | [draft](draft-account-light-desktop.avif) | Production has no verified profile name/email/avatar. |

## Remaining differences

- Prototype has a full synthetic name, email and avatar; current host gives only a placeholder subject. Account displays a safe fallback until profile data is delivered.
- Prototype's settled/closed status, provider error and last-opened time are conditional; production does not claim them from process presence or snapshot order. Live waiting is only claimed from observed command/question facts. Read-only history is separate from wait. Confirmed missing/corrupt history creates tab-local attention until visiting; unavailable history remains unknown.
- The narrow rail has no global “new conversation” action because starting Pi requires selecting a workspace. The workspace page retains the native start control. The remaining group is labelled `Muut keskustelut` and follows catalog order; the draft's `Viimeksi avatut` would claim an unobserved last-opened time.
- The lab snapshot exposes read-only historical conversations with unknown activity, so production captures do not contain the draft's attention or working cards. The Storybook `Production/Sidebar v2` example uses the same components with new attention, working and read-only rows, but is not a matching host-backed pair. Production rows are taller than the draft's compact rows, and its workspace management controls are visible below the shared conversation list. Neither difference is claimed as pixel parity. Settings composition and logout confirmation are under the settings implementation; actual provider and cross-device notifications are not evidenced by these screenshots.
