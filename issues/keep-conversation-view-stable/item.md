---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: open
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
