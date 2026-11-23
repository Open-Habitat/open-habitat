# Personal agent skill fact-check

Checked on November 23, 2026, against source base `3b5766a94` (including the rewrite `c68f5836f`). Only `internal/cli/agent/SKILL.md` changed outside issue records. No runtime behavior or tests were changed; no test pinned a corrected phrase.

## Corrections and evidence

| Claim corrected | Evidence |
| --- | --- |
| Help describes flags and some inputs/limits, rather than being a complete specification or unable to explain workflow context. | Source-built help for all 107 agent leaves: several flags have name-only descriptions; attachment input inherits an inaccurate generic JSON description, while section/wake help already explains when to use them. `internal/cli/help.go` and `agent_workspaces_linux.go` supply the help. |
| An explicit conversation ID is a fallback only where that command accepts it. | `agentWakeCommand` in `internal/cli/wake_linux.go` and `internal/cli/section_linux.go` require current context; the help lists no `--conversation` for those writes. |
| Dry-run supports notice creation and view/file offer/removal, not a notice-removal command or every other verb. | `notices_linux.go`, `views_linux.go`, `fileoffers_linux.go` in `internal/cli`; the other write parsers reject supported dry-run flags, while e.g. section update does not accept that flag. |
| Not every list supports JSONL export. | `agent model list`, `credential list`, `integration list`, and `experimental list` have no `--output`; their parsers reject extra arguments. Help and `agent_models_linux.go`, `agent_integrations_linux.go`, `agent_experimental_linux.go` agree. |
| A user manager is required to wake a stopped daemon, not to create every wake or fire one while the daemon runs. | `createWake`, `scheduleWakes` and the in-process timer in `internal/daemon/scheduled_wake_linux.go`; also the existing host-context reminder paragraph. |
| Sharing uses the card's globe; an existing address cannot be retargeted to a new view. | `web/src/components/OfferCard.tsx`, `web/src/text/offerCard.ts`, `web/src/app/viewLinks.ts`; `internal/gateway/view_links_linux.go` binds each address to one frozen item, and its tests cover refusal to replace removed exports. Neither “Jaa linkillä” nor “Vaihda sisältö” exists in current browser source. |
| Omitting a title is only supported for a single file-offer source. | Source-built `agent file offer --help` and `internal/cli/fileoffers_linux.go`; multiple sources require a title. |
| `conversation show` supports `--current`, contrary to the blanket prohibition in the other-conversations section. | `internal/cli/agent_linux.go`, `agentRequestPath`, source-built show help, and the host-context's current-conversation example. |
| `--held` belongs to queue delete, not queue show. | Per-command allowlist in `parseConversationRequest`, `internal/cli/agent_conversations_linux.go`, and both commands' help. |
| Conversation stop also ends that Pi's managed background tools. | `ConversationController.stop` → `piRPC.close` → bridge `shutdown`; `internal/daemon/process-extension.mjs` kills live managed processes. Separately owned Taskfleet workers are not those processes. The inaccurate CLI help is tracked separately in `agent-stop-help-background-processes`, filed unlaned. |
| Conversation list covers conversations placed in discovered workspaces, not every session in any directory. | `listNativeConversations` in `internal/daemon/agent_conversation_list_linux.go` skips sessions whose working directory has no discovered workspace/place. |
| History discovery is rooted at `~/.pi/agent/sessions`, not every native history anywhere the person owns. | `historyRoot` and `nativeSessionsWith` in `internal/daemon/history_linux.go`; installed `pi --help` exposes `--session-dir` for a different store. |
| History pages allow up to 1000 entries, also bounded by bytes, not 200 entries. | `historyPageEntries = 1000`, `historyPageMessages = 200` in `internal/daemon/history_linux.go`. The CLI requests no message-count parameter; `agent_resources_linux.go` and the daemon adapter forward the default entry-bounded read. |
| One history-block read returns one untruncated chunk, not necessarily the entire block. | Block byte budget in `internal/daemon/history_linux.go`; offset parsing and the chunk loop in `internal/cli/agent_resources_linux.go`. `--output` continues through chunks until complete. |
| Environment/argv secrets can leak, but do not necessarily appear in all of history, process listings and provider input. | The prompt/tool transcript and OS process environment are different channels. `readProtectedInput` in `internal/cli/agent_integrations_linux.go` uses stdin or a protected file; it does not fetch secret environment values. The correction retains the existing protected-input rule. |
| Habitat starts no SSH agent; that is not a guarantee that the person has never started one. | Product launch environment in `internal/daemon/pi_rpc_linux.go`, account-key generation in `account_keys_linux.go`, own-machine identity configuration in `own_machines_linux.go`, and shipped systemd units. No account process inventory was used to make a universal claim. |
| Windows SSH uses its configured default shell, initially cmd.exe, not invariably cmd.exe. | Microsoft Learn, “OpenSSH Server Configuration for Windows”, section “Configuring the default shell for OpenSSH in Windows”: `https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration`. The product's own-machine probe also explicitly allows either cmd.exe or PowerShell. |

## Scope checked and release comparison

Built `./cmd/open-habitat` into disposable scratch, without installing it. Ran `--help` on all 89 static agent leaves plus 18 workspace/clone/worktree/Trash leaves, using both the source binary and installed Open Habitat 0.1.6 (`41c214dcba83b80a5d491cea5e649ce2a7aca9da`). All 214 invocations succeeded; the two complete help snapshots are byte-identical. Thus the installed release is behind the checked source revision, but no agent command/help capability gap was observed. The source skill is corrected for the next release; the installed skill was not changed.

Also checked installed Pi 1.5.2, Taskfleet 0.20.0 and issuectl 0.21.0, Taskfleet command help and its matching installed skills. This worker has all three inherited Habitat launch-context environment variables (values not collected in this report), consistent with the child's parent-context warning. The daemon launch and generation checks were read in `pi_rpc_linux.go` and `agent_linux.go`. No Taskfleet worker was spawned for the check.

The remaining sections were cross-checked with CLI parsers and daemon adapters: own-UID routing, current-context validation, read-only observations, notice persistence/idempotency, section/wake ownership, offer source checks and sandbox CSP, conversation controls/receipts/questions, history export fences, process ownership fences, workspace/worktree/Trash safety observations, repository and clone jobs, model/recap settings, native credentials and login attempts, account-key paths, and own-machine/Tailscale configuration. Installed SSH/age tools and the documented SOPS executable path exist. This is source/help evidence, not live-account workflow acceptance.

## Neighbour contradictions and remaining limits

`internal/daemon/host-context.md` was read and left unchanged as requested:

- Its “Jaa linkillä” sharing control is also stale: the current card uses a globe. The skill now describes the actual control. The authority is unchanged: only the person publishes.
- It says the agent skill has offer limits; the rewrite leaves their numeric file-count/size limits in command help. Its earlier introduction already correctly points readers to each subcommand's help for inputs.
- Its stopped-daemon/user-manager distinction and `conversation show --current` example agree with the corrections above.

Help is not uniformly complete or correct. Besides the separately filed stop-help defect, attachment create labels its raw-byte input as generic protected JSON, attachment show's output description says JSONL even though it writes binary bytes, and conversation-create model/provider help calls optional overrides required. No help source was edited because the authorized code surface was the skill alone. The skill no longer promises complete input specifications from help, but these help defects remain.

No live notice, wake, offer, conversation stop/start, credential write, OAuth attempt, provider probe, clone/deletion or remote-machine operation was performed. No secrets, private keys or personal histories were read. Real provider consent, network/Tailscale reachability, per-user systemd/quota enforcement, distinct-UID isolation, browser/editor interaction and actual Windows shell configuration were not exercised. Native Chrome tests remain opt-in and were not enabled. No external-model review was used; findings were checked directly against source.

## What only Jari can decide

No product/authority decision was needed for these factual corrections. Whether to schedule the unlaned stop-help issue or broaden a later task to the other help descriptions and the host-context wording remains a scheduling decision; this run assigned no lane. No safeguard or permission rule was relaxed.

## Validation

The command was run under `umask 077`:

```sh
./scripts/test-focused.sh --area go --go-package ./internal/cli
```

An initial run passed (0.613 s). Two subsequent runs after the first factual edits also passed (0.608 s, 0.604 s). Two more runs passed (0.606 s, 0.604 s) before the final history-discovery scope correction. The history-scope correction passed two further runs (`cli-6.log` and `cli-7.log`). After restoring paragraph wrapping, the final file passed twice more (0.615 s, 0.600 s; `cli-8.log` and `cli-9.log`): nine successful runs in total. Every invocation uses `go test -count=1`; none reused a passing test result. No failure or flake reproduced, so no flake issue was filed. These are focused CLI tests, not the whole Go tree or the full gate.

Evidence retained locally under `/var/tmp/agent-keep/fact-check-agent-01m84f790/`: source/installed help snapshots and numbered CLI test logs. They contain tool help and synthetic test output, not installation records. `git diff --check`, `python3 scripts/validate-project-view.py` (13 pages) and `issuectl doctor --json` also passed. Intake required an intermediate `open` transition before `done`; the tracking issue remained unlaned throughout.
