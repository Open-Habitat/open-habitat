# Result (2026-11-11)

Upstream pull request: https://github.com/elidickinson/pi-claude-bridge/pull/261
(from `maintainer/pi-claude-bridge`, branch `provider-builtin-tools`, against
upstream `main` after 0.12.0).

What it does: `provider.builtinTools` (default `[]`) is passed through to
`tools` on the provider path. The isolated summary query keeps `tools: []`.
The skip debug line now says Claude Code runs a configured builtin, where it
used to say Claude Code rejects it. README and CHANGELOG are updated.
Upstream's #218 change (a tool call that Claude Code rejects fails the turn)
looks only at ids pi received, so it leaves builtin calls alone. The PR's
test covers that case.

Checks in the bridge: `npm run typecheck` and `npm run test:unit` pass (467
tests, 4 of them new in `tests/unit-builtin-tools.mjs`). The integration suite
(`npm test`) was not run, because it needs a second live provider and many
subscription calls. Instead there was one live check through the branch's
bridge with pi 1.5.1 and `claude-sonnet-5`, using a disposable HOME that held
a copy of Jari's Claude credentials (7.5 h before expiry, so no refresh; the
copy was deleted afterwards). Without the setting the model answered
`NO-SEARCH`. With `["WebSearch", "WebFetch"]` set, Claude Code ran both tools
and the answer cited sources.

Upstream 0.12.0 still has the exact line `BRIDGE_PATCH` replaces, so a bump
to 0.12.0 keeps applying the patch. `scripts/AGENTS.md` now carries the
carried-patch rule.

The issue stays open (status `testing`) until upstream merges and releases
the setting.

## Decisions for later review

- **How the setting reaches people once upstream ships it.** The bridge reads
  `provider.builtinTools` only from the person's own
  `~/.pi/agent/claude-bridge.json`, and the product writes nothing there
  (web search's zero-setup decision). Replacing `BRIDGE_PATCH` therefore
  needs one of these: keep a smaller build patch that changes only the
  default; have the runtime ship a default config the bridge would also have
  to read; or write the person's file. Not decided now. `scripts/AGENTS.md`
  says the replacement has to settle this.
- **PR scope.** The setting accepts any builtin name, not only
  WebSearch/WebFetch, and the README says such tools run outside pi's view and
  permissioning. The alternative, a fixed web-only flag, would be narrower
  but less useful upstream. The bridge already relies on pi for permissions,
  so a general list fits its model.
