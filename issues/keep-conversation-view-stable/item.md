---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: in-progress
priority: high
lane: conversation-live-fix
collision: [web/src/app/App.tsx, web/src/app/BrowserConversation.tsx]
---

# Keep authenticated conversation view stable during revalidation

## Live report (Jari, 2026-09-29)
After he selected and checked out three repos and completed OpenAI device-code login himself, Pi-conversations appeared. The two actions `Aloita uusi Pi-keskustelu` and `Tarkista keskustelulista` visually touch each other; after a refresh-like UI update their spacing changed. Without touching anything, the page periodically switches to a full-screen `Ladataan` / `Varmistetaan istunto ja workspacejen lähde` screen. Two sanitized screenshots are attached. Read-only browser status returned HTTP 200 Pi `usable` during the blank screen; `performance.timeOrigin` was unchanged across the observation, so at least this instance was React-state revalidation, not an actual new Chrome document. Do not assume this proves that no other full browser reload ever occurred. Native conversation send has not yet been verified.

## Source-grounded cause
`web/src/app/App.tsx` has an authenticated 30-second timer and `focus` revalidation; both `dispatch(loading())` before status + snapshot reads. The top-level switch renders only a loading screen and unmounts the workspace/conversation subtree every time, even for an unchanged same-user usable session. `web/src/app/BrowserConversation.tsx` renders two consecutive buttons without an actions container/gap. Each re-mount drops its local `csrf` until the `/auth/session` read finishes; the start button's `availability` conflates `!csrf` (ordinary first-load verification) with `ambiguous` (a genuinely uncertain previous create), so `Istunto tai edellinen luonti on epävarma` flashes below the buttons. That transient text is not evidence that an actual create was uncertain. The existing browser test exercises a 30-second timer but does not assert that the page stays usable while the request is pending.

## Acceptance
- [ ] Active viewing never invokes a periodic full-screen revalidation; verify on focus (including a tab switch) and before native controls instead. Keep identity remapping/logout fail-closed: another UID's snapshot must never be visible, including during delayed/failing focus validation. Backend still gates every native route and write.
- [ ] Keep any unsent draft, editor focus/selection and reading position through a successful revalidation, or explicitly explain why preserving them would leak identity data. If the status is actually unusable, hide prior identity and return to the correct gate.
- [ ] Ordinary CSRF/session loading never claims a previous create is uncertain; reserve the warning for a genuinely ambiguous write, and state ordinary loading accurately. Conversation actions have visible spacing, keyboard focus order and accessible grouping across refresh/viewport changes.
- [ ] Synthetic production-bundle browser tests cover delayed 30s/focus checks, stable page vs actual credential loss, slow/error responses, and CSS action spacing; no real accounts in tests. A clean committed-tree gate before release. Live evidence only establishes Pi `usable`, not successful native conversation exchange.

## Comments

### 2026-09-29T13:52:12Z · @jari

2026-09-29 pilot.11 live retest: after an initially usable authenticated workspace view, clicking any visible control repeatedly leaves the app at full-screen “Ladataan / Varmistetaan istunto ja workspacejen lähde.” This is not merely a brief flash; no usable view returns in the reported attempt. Screenshot was inspected from Jari’s seat but contains real workspace names/host facts and is intentionally NOT committed to this public repository. Diagnose whether click-induced window focus revalidation is aborting/restarting status/snapshot, or a live endpoint hangs. Previous accepted issue already owns stable revalidation; do not create a duplicate.

### 2026-09-29T14:03:55Z · @agent

Synthetic production-bundle browser host: foreground controls and route changes produced no top-level Pi recheck; genuine tab return masks identity DOM, retains editor/selection and reading position on same cookie, and drops facts on 401, new subject, failed snapshot or a 10-second stalled Pi-status timeout. Focus regression coverage also exercises ambiguous write only after pre-write verification and compact action grouping/spacing. 13 focused browser tests passed before independent review found a first-background-reveal gap; adding a regression test for that. Full clean committed-tree gate pending. No guest/live account/provider read or deployment was performed.
