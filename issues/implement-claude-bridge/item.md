---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: pi-runtime
lane_seq: 5
collision: [internal/daemon, contracts/v1, web/src/app/]
preparation: ready
---

# Claude through pi-claude-bridge

Jari accepted ADR 0016 on 2026-10-16: "Näin me mennään, ja jos Anthropic nukettaa sen SDK-bridgen, niin sit katotaan mitä tehdään." (In short: this is how we go, and if Anthropic shuts down the SDK bridge, we will see then what to do.) Claude comes through the Pi extension [pi-claude-bridge](https://github.com/elidickinson/pi-claude-bridge) with the person's own Claude Code subscription login. Pi stays the browser-facing harness and owns the history. Claude credentials stay in Claude Code's native store under the person's Unix account.

Scope:
- Mark ADR 0016 Accepted, with Jari's words above as the revisit condition.
- Install pi-claude-bridge as a declared extension of the test server's Pi through the Fleetrepo guest runtime, pinned and integrity-checked like Pi itself. Include Claude Code (the CLI the SDK drives) if the bridge needs it.
- Claude sign-in for the mapped user from the browser: Asetukset → Agentit / Pi, following the accepted settings (Osiot) and the agent-harness prototype's Claude row (open the sign-in page and paste the returned code, which is Claude Code's remote fallback). The credential goes only into Claude Code's native store, written as the user.
- Claude models appear in the shared model picker (newest per family; `implement-model-choice`), with the conversation showing `PI claude-…`.

## Acceptance Criteria
- [ ] ADR 0016 Accepted.
- [ ] The test server's Pi lists Claude models through the bridge after a Claude sign-in. One native prompt as the mapped user answers on a Claude model; Jari does the browser sign-in and turn himself.
- [ ] The browser sign-in flow and the picker entries are covered by tests with a synthetic Claude login.
- [ ] Live checks for Jari in KOKEILTAVAA.md.
