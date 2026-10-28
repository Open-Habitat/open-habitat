# Result

## What changed

- Settings has an X in its top right corner (`settings-close`, "Sulje
  asetukset"), on the desktop beside the section heading and on the phone
  above the section list or the section's "← Asetukset" row. It stays in
  reach while the page scrolls. It replaces the old "Takaisin" row at the top
  of the section list, which did the same thing.
- Esc closes Settings unless focus is in a text field, or a dialog, menu,
  listbox or the phone's navigation drawer is open (those keep their own Esc).
- Settings opened from inside the app now lies over the view it came from
  instead of replacing it. In `web/src/app/App.tsx` the router location is
  `route`; `location`, which every view derivation reads, is the last
  non-Settings location while Settings is open over it. The view under
  Settings stays mounted, hidden and inert; a `<Routes location>` wrapper
  gives components that call `useLocation` themselves the same location. So
  closing brings back the same conversation with its unsent draft, the
  editor and its buffer, open panels, and main's scroll position (saved and
  restored around the layer). Inner scroll positions are kept without work
  since nothing remounts.
- Redirects inside the view under Settings wait until Settings closes
  (`Redirect held`), and effects that navigate (canonical home, auto start,
  rename, creation) read `route`, so work that finishes meanwhile does not
  take the person out of Settings.
- Any in-app entry to Settings returns to where it was opened from: the
  account menu, the conversation's dictation link, the model selector's links
  and the browser's Back. Before, only the account menu remembered the path,
  and it dropped the query (`?conversation=`), so the X went to the workspace
  page instead of the conversation.
- A link straight to Settings (reload or new tab) has nothing under it and
  closes to the home view.

Evidence: `web/tests/settings-close.spec.ts` (conversation → Settings →
section → X → same conversation, not remounted, draft kept, focus on the
account menu; browser Back; Esc in a field stays, Esc outside closes; deep
link → home; phone X in the corner; workspace page scroll position; axe
wcag2a/aa on desktop and phone). Screenshots at device scale factor 2 in
[evidence](evidence/): desktop and phone, light and dark.

## Decisions for later review

- **The X replaces "Takaisin".** Alternatives: keep both. Both closed
  Settings, so two controls for one action at the top of the page.
- **Settings is a layer over the previous view, not a separate page.**
  Alternatives: remember the full URL only (cheap, but the conversation,
  editor buffer and panel state remount and scroll is lost), or save and
  restore view state piecemeal. The layer keeps exactly what was open with
  no per-view code.
- **The sidebar shows the view under Settings as current** (its
  conversation and workspace stay highlighted). Alternatives: no highlight
  while in Settings, as before. The highlight says where the X returns, and
  clicking it also closes Settings to that view.
- **On the phone, Settings covers the whole content area including the
  top toolbar** (☰, title, home). The X is the way back; the drawer is
  reachable again after closing. Alternatives: keep the toolbar above
  Settings, which would need per-view offsets because the conversation and
  editor place that toolbar differently.
- **The Pi sign-in started from Settings, and the unfinished-profile page,
  still take the whole page as before**; the view under Settings remounts
  after a Pi sign-in. They render from the main view chain, which reads the
  location under Settings; folding them into the layer was not needed for
  this issue.
- **Esc with focus on a checkbox, radio or segmented control closes
  Settings**; only text entry counts as a field.
- **Closing pushes a new history entry** to the previous view, as
  "Takaisin" did, rather than going back in history, because the number of
  Settings entries since opening is not known.
