---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: composer
lane_seq: 3
collision: [web/src/components/composer]
closed: 2026-10-20
---

# / command list: show only commands that make sense in the browser; fix the chip's left-edge shading

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the / list contains Pi's own built-in commands and their options; are they all meaningful through the web UI? Go through what the list shows (Pi built-ins, skills, prompt templates, extensions) and decide per command whether it works and is useful from the browser composer; hide or mark the rest (some already show 'vain Pi:n päätteessä'). Also the chip after a command name has a dark shade on its left edge that looks like a parenthesis and is not visually pleasing; restyle. Record the per-command decision table in the issue.
## Command relevance review

Reviewed against pinned Pi 1.3.0 (`pi-device-test/package.json`), its `get_commands` implementation and `docs/rpc-commands.md`, bundled MCP/llama handlers, and our RPC UI relay in `pi_events_linux.go`. The report did not include a live command inventory or additional server evidence; no live server/home was inspected. User/project skills, templates and third-party extensions are dynamic, so their decisions are by execution mechanism, not a fabricated fixed inventory.

`scope: builtin` means a Pi-bundled **extension**, not a core TUI slash command. Pi's RPC inventory never includes the core TUI commands. Sending their spelling as a prompt does not invoke the TUI implementation. Do not synthesize them into the list.

| Command | Composer decision | Reason / browser alternative |
| --- | --- | --- |
| `/settings` | Not offered (unchanged) | TUI settings menu; browser account/settings controls instead. |
| `/model <provider/model>` | Not offered (unchanged) | TUI command, not a prompt command; browser model picker uses native RPC. |
| `/tree` | Not offered (unchanged) | TUI session-tree navigation, not RPC prompt execution. |
| `/thinking <level>` | Not offered (unchanged) | TUI command; browser thinking picker uses native RPC. |
| `/scoped-models` | Not offered (unchanged) | Configures TUI model-cycling shortcuts. |
| `/export [path]` | Not offered (unchanged) | TUI export command; no browser slash wrapper. |
| `/import` | Not offered (unchanged) | TUI session import/resume. |
| `/share` | Not offered (unchanged) | TUI publishing workflow; do not imply prompt execution publishes a session. |
| `/bug <description>` | Not offered (unchanged) | Pi's interactive bug-report workflow, not a browser prompt command. |
| `/copy` | Not offered (unchanged) | Uses Pi host's clipboard; browser has its own copy controls. |
| `/name` | Not offered (unchanged) | Browser conversation naming has its own native operation. |
| `/session` | Not offered (unchanged) | TUI session statistics. |
| `/changelog` | Not offered (unchanged) | TUI changelog view. |
| `/hotkeys` | Not offered (unchanged) | TUI keybindings are not browser shortcuts. |
| `/fork` | Not offered (unchanged) | TUI session branching, not a prompt operation. |
| `/clone` | Not offered (unchanged) | TUI session duplication, not a prompt operation. |
| `/trust` | Not offered (unchanged) | TUI trust decision, not a browser prompt operation. |
| `/login <provider>` | Not offered (unchanged) | Use browser provider sign-in/settings, not a TUI auth command. |
| `/logout` | Not offered (unchanged) | TUI provider auth removal; browser settings owns its explicit operation. |
| `/new` | Not offered (unchanged) | Browser's new-conversation control creates the owned conversation. |
| `/compact` | Not offered (unchanged) | Core TUI command; RPC compaction is a separate API, not slash-prompt handling. |
| `/resume` | Not offered (unchanged) | Select conversations through browser navigation. |
| `/reload` | Not offered (unchanged) | TUI resource reload, not a prompt operation. |
| `/quit` | Not offered (unchanged) | TUI lifecycle command; browser stop control is separate. |
| `/mcp` | **Enable** (was incorrectly terminal-only) | In RPC, prints server status through `notify`, which we relay as safe progress text. The rich manager is TUI-only; the status command is not. |
| `/mcp login [server]` | Available through `/mcp` plus typed arguments | RPC handler supports select/input/notify, including displayed authorization URL and pasted redirect fallback. No new auth bridge is introduced. Real-provider sign-in not tested here. |
| `/mcp logout [server]` | Available through `/mcp` plus typed arguments | Native handler removes native credentials, asks for server if ambiguous, reports through notification. |
| `/mcp reconnect [server]` | Available through `/mcp` plus typed arguments | Native handler reconnects and reports status; supported RPC select/notify. |
| `/llama` | **Hide** from caret list, command button and palette/search | Handler explicitly rejects `ctx.mode !== 'tui'`; router manager needs custom TUI. |
| `/skill:<name>` (every admitted skill) | Keep | Pi expands skill text before prompt/queue processing; runs as the person's native agent. A skill's own task may of course require unavailable tools. |
| `/<template>` (every admitted prompt template) | Keep | Native prompt expansion and arguments work over RPC. No browser copy of template contents. |
| Other registered extension commands | Keep | Native command dispatch and supported input/select/confirm/notifications are available. No metadata declares custom-TUI requirements; do not blanket-disable extensions or claim all arbitrary extension UIs work. An extension using custom TUI still needs its own browser suitability assessment. |
| `/oh-conversation-recap` | Hidden (unchanged) | Daemon-private command, already omitted from native inventory exposed to browser. |

This filters suggestions, not manually typed text or an authorization boundary. Arguments are still typed after completing the command name; the composer does not invent option lists. Mid-line slash mentions retain their existing text semantics. Source/scope remain readable text on neutral rounded chips; only the inset source-color stripe (the parenthesis-like dark edge) is removed.

## Acceptance Criteria

- [x] Review core Pi commands, bundled extensions, skills and prompt templates for browser relevance and record decisions.
- [x] Do not offer known TUI-only commands in composer suggestions or palette search; preserve RPC-compatible MCP commands.
- [x] Remove the source chip's parenthesis-like left-edge shading without removing its textual source/scope label.

## Result

Implementation is based on main `18bf062c` (tree `8b51ec5d7af56490ecb01588cddd34bdac18bcde`). The shared `commandGroups` filter covers caret completion, command-button lists and palette search; the native inventory retains its capability marker. MCP is no longer misclassified as TUI-only. The regression cases distinguish unsupported extension commands from a prompt with the same name. The existing completion case now checks absence even under exact-name search rather than disabled-row rendering; normal completion remains covered. No command execution, credential handling, identity or authority route changed.

Review: focused self-review of the final diff is proportionate: a presentation filter, removal of inset CSS stripes and one native capability classification; no Unix-user security boundary, gateway/daemon/broker authority, installation or dependency change. Retained source/scope text, mid-line mention semantics and manually typed text behavior. Reviewed both pinned extension handlers against our existing RPC dialog/notification relay; arbitrary custom TUI and real MCP provider login remain unverified.

Checks (remote Linux ARM runner, synthetic homes; `TMPDIR=/var/tmp`):

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: **pass**, job `b3304793a1d035f70c731979cb5dd0f25262ee50e610b3f7e0eb8dbe2f247082`; runner installed the pinned native Pi fixture with `--ignore-scripts`, ran vet and package tests with race detection.
- `./scripts/test-focused.sh --area contracts`: **pass**, job `41826e9f89d0283e01a4769bf167d544bdfe8b61208c7d8db9901039b4f1d6a6`.
- `./scripts/test-focused.sh --area browser --lab --spec lab-composer-area.spec.ts`: **4 passed, 2 pre-existing failures**, final-code job `cac69a33a588b17b4e4cc5298c831ed4ee055b942f269b41c156c97e8b20b73f`. Slash completion, palette (including Axe) and the other two cases passed. Failures: line 135 expects the mode chip focused after three Tabs; line 313 expects two hidden labels but there are three.
- Ran the **same complete browser command on unchanged main** `18bf062c`, exported to a disposable repository with exactly the same tree `8b51ec5d7af56490ecb01588cddd34bdac18bcde`. Job `c5068db8a35c08a78e74008f003390fa8e8c513a8fd4b08d3d87b0e68899375c` reproduced both failures at the identical assertions, with 4 passed / 2 failed. These do not block landing under this task's baseline exception. The earlier intermediate browser job `baa7f6071d8384ad407301d64e5537393991b4bfb668746a427256cdac5fc23d` also failed these two cases (the queue case failed earlier at its queue-text assertion).
- Initial web checks passed; after extending the fixture, the format check caught a wrapped expression. Corrected it and reran the required web check (final result below). No format failure is being treated as a pass.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: **pass** (doctor retains pre-existing attachment advisories).

Manual before/after captures deferred: Alder disallows local specialist lab/capture commands; used maintained remote browser execution instead, without inventing a manual runner task. No live server was touched; no push or deployment. Full clean gate intentionally not run. Source discovery initially probed nonexistent glob/directory paths; corrected to the installed Pi `dist/extensions/` and repository paths, with no missing evidence required for this delivery.

Final focused results:

- `./scripts/test-focused.sh --area web`: **pass**, job `b23c9d4b77301990942339908edc1aa8229852e6d54818ffeefae417a4695762` (format, lint, typecheck, unit and component tests).
- `./scripts/test-focused.sh --area browser --lab --spec lab-composer-area.spec.ts --tag 'complete at the caret|opens the palette'`: **2 passed**, job `958f47ad6fe11ff2c91496974b44ae27db141087b14adc58293d8d9ddcd5bc8a`, including the existing palette Axe assertion. These are the affected browser interactions. Both full-spec pre-existing failures are accounted for above, not hidden by the focused selection.
