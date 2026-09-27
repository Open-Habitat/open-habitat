---
created: 2026-09-27
updated: 2026-09-27
type: feature
status: open
priority: high
related: ['@connect-github-workspaces', '@build-history-view']
lane: onboarding-design
collision: [docs/]
---

# Design first-use onboarding and account settings

## Goal

Design and deliver a first-use journey between successful browser login and the normal workspace view, based on Jari's observations after the first real pilot login (2026-09-27). Separate native GitHub and Pi credentials; do not implement a new credential broker or fake a native login state.

## User feedback

- After first login, show the user's GitHub repositories as a tidy, selectable list. The user selects repos to import; clone selected repos as their own workspaces under `~/src`. This is a guided first-use screen, not a replacement for the normal workspace view.
- `~/src` must exist as part of provisioning/onboarding. Its absence is a setup failure, not an acceptable first-use empty state. Preserve safe handling for later deletion or read failure.
- Verify usable native GitHub authorization during onboarding; never present a successful setup based only on the browser session. The pilot showed the generic unknown-state warning despite native `gh` being verified independently.
- During onboarding, let the user authenticate native Pi using Pi's supported `/login` flows: OpenAI subscription login or an API key. Investigate Pi's real API/CLI and credential storage first; do not invent OAuth handling in the gateway or put an API key in browser logs, URLs, or persistent gateway state. The exact web-to-native handoff and trust/ownership boundary require Jari's architectural review before implementation.
- Normal users should not see the numeric `GitHub user 1272053` identity fallback or the message `Web-uloskirjautuminen ei katkaise natiiveja GitHub-tunnuksia.` on the everyday workspace screen. Replace numeric fallback with a humane display name or neutral fallback; keep precise identity for secure internal binding. Explain the distinction between web logout and native disconnect only at the relevant settings/action confirmation.
- Add a small bottom-left sidebar shelf with an account/context menu including Settings. Include a GitHub integration settings page that shows the verified native connection and provides an explicit GitHub disconnect/logout action. Keep web logout separate from native `gh` logout; account for subsequent web sessions and native Git access after disconnect.

## Design and delivery boundaries

This is a product request, not an approved implementation architecture. Recommend first delivering a bounded decision/design for first-use state, safe `~/src` creation, GitHub list/import and partial clone retry, Pi login handoff and credential authority, settings/disconnect behavior, and returning-user recovery. Then split implementation into small serial UI/security-boundary slices with synthetic per-UID tests and Jari's visual acceptance. Existing @connect-github-workspaces covers search/clone and native authorization but not the first-use list/selection journey; avoid duplicating it. @build-history-view remains in `testing` awaiting Jari's separate visual verdict; these observations do not accept or reject that view.

No live credentials or second-person identity may be used for testing without explicit participation. Keep host-specific deployment receipts in Fleetrepo. The normal workspace UI must not expose numeric IDs or operational caveats as default chrome.

## Acceptance Criteria

- [ ] Jari reviews the proposed onboarding/Pi-auth trust boundary and the settings interaction before implementation.
- [ ] The approved design specifies first-run vs returning-user behavior, a usable-path guarantee or honest recovery on failure, and retry semantics for native auth and partially imported repos.
- [ ] Implementation slices and dependencies are linked to the existing GitHub workspace/lifecycle issues and have dedicated evidence, tests, and UI screenshots.
