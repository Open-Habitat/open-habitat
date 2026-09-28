---
created: 2026-09-27
updated: 2026-09-28
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
- During onboarding, require native Pi authentication before entering the normal workspace or repository browsing UI. **First version: OpenAI ChatGPT subscription browser login only**, mirroring Pi's supported `/login` (`openai-codex`) flow and persisting credentials under the mapped Unix UID using Pi's native mechanisms. Other methods, including API keys, are later work. Investigate Pi's real API/CLI and credential storage first; do not put tokens or callback codes in browser logs, URLs beyond the provider's own required redirect, or persistent gateway state. The exact web-to-native handoff and trust/ownership boundary require a recorded design before implementation.
- Normal users should not see the numeric `GitHub user 1272053` identity fallback or the message `Web-uloskirjautuminen ei katkaise natiiveja GitHub-tunnuksia.` on the everyday workspace screen. Replace numeric fallback with a humane display name or neutral fallback; keep precise identity for secure internal binding. Explain the distinction between web logout and native disconnect only at the relevant settings/action confirmation.
- Add a small bottom-left sidebar shelf with an account/context menu including Settings. Include a GitHub integration settings page that shows the verified native connection and provides an explicit GitHub disconnect/logout action. Keep web logout separate from native `gh` logout; account for subsequent web sessions and native Git access after disconnect.

## Design and delivery boundaries

This is a product request, not an approved implementation architecture. Recommend first delivering a bounded decision/design for first-use state, safe `~/src` creation, GitHub list/import and partial clone retry, Pi login handoff and credential authority, settings/disconnect behavior, and returning-user recovery. Then split implementation into small serial UI/security-boundary slices with synthetic per-UID tests and Jari's visual acceptance. Existing @connect-github-workspaces covers search/clone and native authorization but not the first-use list/selection journey; avoid duplicating it. @build-history-view remains in `testing` awaiting Jari's separate visual verdict; these observations do not accept or reject that view.

No live credentials or second-person identity may be used for testing without explicit participation. Keep host-specific deployment receipts in Fleetrepo. The normal workspace UI must not expose numeric IDs or operational caveats as default chrome.

## Acceptance Criteria

- [ ] Record and review a concrete Pi subscription browser-auth handoff and its credential ownership boundary before implementing that boundary; Jari has approved the first-version product behavior, not a specific security implementation.
- [ ] The approved design specifies first-run vs returning-user behavior, a usable-path guarantee or honest recovery on failure, and retry semantics for native auth and partially imported repos.
- [ ] Implementation slices and dependencies are linked to the existing GitHub workspace/lifecycle issues and have dedicated evidence, tests, and UI screenshots.

## Decisions

### 2026-09-27T18:32:55Z · @jari

2026-09-27: Pi sign-in is mandatory before any repository browsing or normal workspace UI; the product has no useful mode without agents. First version supports the native Pi OpenAI ChatGPT subscription browser login; API-key and other methods follow later. Jari asks for autonomous overnight implementation without further routine check-ins. The exact credential handoff and authority boundary must follow Pi-native behavior, with security evidence before live deployment.

### 2026-09-27T19:57:44Z · @agent

2026-09-27 source-grounded refinement pending Jari approval: Pi 0.85.1 openai-codex /login already offers native Device code login (headless) for ChatGPT subscription in a browser. Unlike the default browser PKCE callback, it needs no fixed localhost:1455 listener or pasted failed redirect; daemon can show Pi-notified verification URI/user code and let Pi poll/store/refresh under mapped UID. The user chose subscription browser sign-in, but has NOT explicitly accepted device-code interaction as the first-version UX; this is a proposed architectural simplification, not approval or implementation. A strict manual-only browser patch was prototyped in @prototype-pi-manual-login (28 synthetic tests) as fallback; neither live OpenAI flow nor same-origin host gate is proven. Ask Jari whether native device-code experience satisfies first version before binding host auth APIs to either flow.

### 2026-09-28T05:19:21Z · @jari

2026-09-27 Jari approved using Pi native OpenAI ChatGPT subscription device-code browser sign-in for the first version, for now. The user must not have to open a Pi terminal: mapped user daemon drives Pi native login, web shows verification URL and user code, user confirms in their browser; Pi owns credential storage/refresh. The approval is for this first-version product interaction, not a license for an unreviewed gateway credential broker or a live real-user test without consent. API keys and other methods remain later. The earlier manual-only default-browser patch is prototype/fallback, not required for this approved first version.
