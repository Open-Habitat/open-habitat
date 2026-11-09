# Result — 2026-11-09

The integrations wrapper now executes the CLI entry taken at build time from
core's locked `bin.pi`, not the library `main`. The container builder receives
the core lock read-only. Release planning now requires integrations when its
wrapper/build script or core npm lock changes; nested profile inputs resolve
to the actual profile name.

## All callers

`Env.Tool("pi")` has six call sites:

- `pi_oauth_linux.go`: Atlassian RPC login; previously exited immediately and
  returned tool_failed. The rebuilt wrapper now reaches the authorization URL.
- `atlassian_linux.go`: fresh-login logout and disconnect logout/remove; these
  previously returned success without clearing native MCP configuration/auth.
- `microsoft_linux.go`: cancelled-login cleanup and account disconnect remove;
  these also silently did nothing.
- `microsoft_tenant_linux.go`: `microsoftRegister` (`mcp add`, including env and
  args); this silently succeeded without registering/updating the Outlook MCP
  server. Both initial login and tenant/application reconciliation use it.

The sealed-profile test checks actual native-file mutations for add (including
an environment value with spaces and arguments), remove and logout. This
confirms the CLI operations used by those callers, not a live Microsoft grant.
The full integrations Go package also passes.

## MCP tools in the agent session

No core or agent-argument change is needed. The login child deliberately loads
only `builtin:mcp` under `--no-extensions`, so it can warn that codemode/tool_search
is unavailable. It never asks a model to call a tool. Normal daemon `piArgs`
does not suppress those built-ins. Pi 1.3.0 loads the user's native
`~/.pi/agent/mcp.json` and activates codemode when a default-exposure server
connects. `TestMCPBuiltRuntimeAgent` proves this using production piArgs and RPC
launch, a local HTTP MCP server named open_habitat_atlassian, and a local model
fixture: codemode is declared, the MCP tool is called, and its result reaches
the next model request. No credentials or real Atlassian service are involved.

## Verification

Built and sealed the arm64 integrations profile locally with the production
Python builder: downloaded/digest-checked locked tool and Node archives; used
the installed integrations npm tree read-only as the locked npm input. Core
1.3.0 from the installed generation was used read-only. All output is below
`~/.local/state/pi-wrapper-fix/`; nothing under `/opt` was changed.

Passed:

- `python3 scripts/test-profile-runtime-build.py` (15 tests).
- `python3 scripts/test-release-cut.py` (23 tests).
- `python3 scripts/test-integrations-runtime.py BUILT CORE_RUNTIME`: full sealed
  closure/digest/mode checks, real wrapper `--version` = 1.3.0, native commands.
- `OH_INTEGRATIONS_PI=... go test ./internal/daemon/integrations -count=1`,
  including `TestPiOAuthBuiltRuntime`. The latter starts `startPiOAuth`, receives
  the `/mcp` response, then relays a synthetic authorization URL. No account or
  external OAuth request is required.
- `OH_CORE_RUNTIME=... go test ./internal/daemon -run TestMCPBuiltRuntimeAgent -count=1`.

Installed test-only npm dependencies with `npm ci --prefix
internal/daemon/pi-device-test --ignore-scripts`. Also attempted the full daemon
suite: it failed on long Unix socket paths under this run's TMPDIR and missing
Python `referencing` in the ambient interpreter, among environment-dependent
checks. This is not a full daemon/gate pass. No web changed.

Focused self-review and independent claude-fable-5-1 finder / gpt-6-astra verifier
completed; release dependency and temporary-directory findings were fixed and
covered by tests. No unresolved finding or product decision.

## Release handoff

**Rebuild integrations for both linux-amd64 and linux-arm64. Core is unchanged.**
This worker tested arm64, did not build amd64, change a live installation, or
cut a release. The final release rebuild checkbox remains for the conductor;
source fix and runtime regression coverage are complete.
