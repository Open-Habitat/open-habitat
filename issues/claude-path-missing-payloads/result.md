# Result

## Where the release's Claude Code lives

Inspected 31.10. read-only.

- **`host apply/upgrade` generation (Birch).** The daemon runs as
  `/opt/open-habitat/current/open-habitat`; `current` → `generations/<hash>`,
  which contains `payloads/core/runtime`. `/opt/open-habitat/pi-runtime.json`
  names `<generation>/payloads/core/runtime/bin/node`, and Claude Code is at
  `…/runtime/node_modules/@anthropic-ai/claude-agent-sdk-linux-arm64/claude`.
  The old PATH entry existed here.
- **Fleetrepo release watcher (test server, pilot on product `f0583be8`).**
  `current` → `releases/<sha>` holds `bin licenses open-habitat operator site
  systemd …`, no `payloads`, and there is no `/opt/open-habitat/core`.
  `pi-runtime.json` names Fleetrepo's own tree
  `/opt/open-habitat/guest-pi-1.3.0-processes-0.10.9-claude-bridge-0.9.3-node-22.21.1/bin/node`,
  with Claude Code beside it. Fleetrepo's `/usr/local/bin/claude` wrapper reads
  the same selector and execs that binary.

On both routes the Claude sign-in runs Claude Code from beside the
`pi-runtime.json` node. The test server follows the product's runtime
contract. The PATH was wrong because it assumed the release directory carries
the runtime, so no Fleetrepo issue was filed.

## Change

`internal/daemon/agent_path_linux.go`: the agent PATH names one Claude Code
directory, and only if its `claude` binary exists. It prefers
`<launched release>/payloads/core/runtime/…`, which follows upgrades through
`current`. Otherwise it uses the directory beside the selected runtime's node,
which is the sign-in's binary. If neither exists, it adds nothing. The
selector is read each time an environment is built, so a runtime switch
reaches new shells without a daemon restart. On the test server the
`/usr/local/bin/claude` wrapper still comes first on PATH and runs the same
binary.

Tests: `TestAgentPathNamesOnlyExistingClaudeCode` (absent → not named;
selected runtime only → named last and equal to the sign-in binary; payload
present → preferred, no duplicate). The full `./internal/daemon` package and
the web area pass. Review: `/llm-review` (gpt-6-astra, routine) found
nothing.

## Decisions for later review

- **The payload directory takes precedence over the selected runtime when
  both exist.** The alternative was always to use the selected runtime.
  On Birch that is an absolute generation path, so a long-lived tmux shell
  would point at a generation that a later upgrade may remove. The payload
  path goes through `current` and keeps working after an upgrade.
- **Existence is checked when the environment is built.** The alternative was
  to keep naming the directory even before installation, as the user's own
  `~/.local/bin` is. Claude Code arrives only with a runtime switch, and that
  also changes which directory is right, so naming an absent one helps
  nobody.
- **Fleetrepo's `/usr/local/bin/claude` wrapper is left in place.** It now
  duplicates the product's PATH entry, but it is harmless and runs the same
  binary. Retiring it is Fleetrepo's decision.
