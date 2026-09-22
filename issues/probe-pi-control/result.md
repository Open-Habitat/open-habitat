# Pi native control probe

## Outcome

This probe uses Pi's native persisted session and RPC surfaces; it does not add a
history store or touch any existing user session. The runnable fixture creates a
fresh temporary workspace and session directory, uses only synthetic prompts and
files, redacts temporary/home paths, and deletes the raw fixture afterward.

The supported v1 control path is: discover persisted sessions with
`SessionManager`, start or resume a dedicated Pi RPC subprocess, consume its JSONL
events, and send RPC commands. History discovery, process liveness, and control
are separate facts. In particular, native Pi 0.85.1 has no API for attaching an
RPC client to an already-running terminal TUI process.

## Tested software and revision

- Repository starting revision: `e704fbada27653e2ed5a923225b510470a005c37`
  (the separate in-progress metadata commit).
- Pi CLI and `@earendil-works/pi-coding-agent`: `0.85.1`.
- Installed package evidence: package.json SHA-256
  `f1738e4b42203e5f22bcb513f13fb2fb224f1e98d1f129ff042f87048665a94c`;
  RPC implementation SHA-256
  `e7e4724aa55c5aac73cf36793653b26736200e5c59d58373990fc31028f86477`.
  The npm artifact has no embedded `gitHead`, so no upstream commit is claimed.
- Explicit test extension: `probe-extension.ts` in this directory (unversioned
  source, tied to the repository commit that contains this result).
- User package inventory inspected but disabled during the probe:
  `@aliou/pi-processes@0.10.9`, `pi-claude-code-ui@1.0.78`, and
  `taskfleet-pi-telemetry@ab400fef146230dd1da45fef96fb4686feabb334`.
  The probe passed `--no-extensions` and loaded only `probe-extension.ts` with
  `-e`; `--no-builtin-tools` also kept model-callable host tools disabled.
  Package behavior is therefore not attributed to the native interface.
- Live model: `openai-codex/gpt-5.6-sol`, thinking `low`. Model output is used
  only to cause genuine agent/tool turns; deterministic checks test the
  transport and tool contracts directly.

Primary evidence was the installed Pi README, `docs/rpc.md`, `docs/json.md`,
`docs/session-format.md`, `docs/sdk.md`, `docs/extensions.md`, and installed
runtime source under `dist/`. The documentation was read at the same installed
0.85.1 package path as the executable.

## Capability matrix

| Capability | Status | Evidence and v1 consequence |
|---|---|---|
| Native history discovery | **Verified** | `SessionManager.list(cwd, sessionDir)` found one disposable JSONL session for its cwd; `listAll(sessionDir)` found it globally. A snapshot reader may use the SDK or parse documented v3 JSONL defensively. |
| Workspace association | **Verified** | The native session header stores `cwd`; listing for workspace A returned the fixture while listing for workspace B returned none. Association is native cwd evidence, not a new registry. Moved/renamed directories and intentional cwd overrides remain edge cases. |
| Stable conversation ID | **Verified** | `sessionId` is the UUID in the session header and remained identical after `--session <file>` resume. Use `pi:<sessionId>` as the agent identity, not PID or filename. |
| Resume and prompt | **Verified** | A fresh RPC process opened the exact session file, restored nonzero message history, preserved `sessionId`, accepted a new prompt, and emitted `agent_settled`. |
| Streaming assistant/tool events | **Verified** | RPC emitted lifecycle, delta, `tool_execution_start`, `tool_execution_update`, and `tool_execution_end` events. `message_end` is authoritative; clients must assemble delta-only `message_update` blocks. |
| Interruption | **Verified** | `abort` interrupted the disposable 30-second `probe_wait`, waited for idle, returned success, and the run settled. This aborts current agent work; it is not a general subprocess/process-tree stop API. |
| Stable tool/event correlation | **Verified** | The same `toolCallId` correlated start, update, and end. Streaming `toolcall_start` also exposes provider tool-call `id` and `toolName`. Event records themselves do not all have durable IDs; persisted entry IDs are stable append-tree cursors. |
| Intermediate output | **Verified** | Both direct built-in bash execution and the live custom tool produced content updates before final output. `partialResult` is the tool's latest `onUpdate` payload: built-in bash supplies an accumulated replacement snapshot, while custom tools define their payload semantics. A tool that never calls `onUpdate` yields no intermediate output. |
| Diff availability | **Verified, tool-specific** | Runtime execution of the built-in `edit` tool returned `details.diff`, `details.patch` (unified patch), and `firstChangedLine`. This is not a universal event field; unknown/custom tools and writes may not provide a diff, so the UI must fall back to available result text. |
| User-question responses | **Verified, extension-mediated** | RPC translated `ctx.ui.input()` to `extension_ui_request`; matching `extension_ui_response` resumed the extension command and persisted a synthetic answer marker. Native ordinary chat does not invent a question schema; support depends on an extension using supported dialog methods. `custom()` remains unavailable in RPC. |
| Queue and steering | **Verified** | Mid-run `steer` and `follow_up` were accepted and `queue_update` exposed full pending queues. Steering is delivered after the current assistant turn's tool calls, not instantly during a tool. Follow-up runs only when prior work finishes. |
| Competing resume | **Verified unsafe** | Two RPC processes simultaneously opened the same disposable session ID and both returned state successfully. No session lock was found or observed. This is not collaborative attachment; a daemon must enforce one controlling runtime per native session and refuse/mark read-only competing control. |
| Terminal-started discovery | **Bounded** | Persisted history can be discovered. Native session JSONL does not state that a corresponding process is alive. OS/tmux/optional telemetry can contribute a separate observation, but this probe does not claim a reliable native Pi live-process detector. |
| Terminal-started attachment/control | **Unsupported in inspected interface** | RPC is stdio to the process it starts; no attach/listening endpoint or attach command exists. `--session` starts another runtime and can compete with the TUI. Therefore a detected terminal-started agent is history/read-only unless an external owner established a control channel. Do not auto-resume beside a detected live process. |
| Agent/process survival | **Bounded** | Persisted JSONL history survives process exit and can be resumed. Native RPC shuts down when stdin ends and owns active computation in that process. Browser disconnect survival must be provided by the future daemon retaining the RPC child (or an explicit terminal owner); Pi alone does not detach the running agent. Daemon death, host reboot, and killing the Pi process stop active work, while completed history remains. |

## Supported interfaces actually found

1. **Filesystem/session API:** v3 append-only JSONL; `SessionManager.list`,
   `listAll`, `open`, `create`, `continueRecent`, and tree/entry access.
2. **CLI:** `--session <path|id>`, `--session-dir`, `--continue`, `--fork`,
   `--mode json`, and `--mode rpc`.
3. **RPC (strict LF JSONL over stdio):** snapshot/state/messages/entries/tree,
   prompt, steer, follow-up, queue clearing, abort, session switching/forking,
   model/thinking controls, direct bash, and extension UI request/response.
4. **SDK:** `AgentSession` for a single session and `AgentSessionRuntime` for
   replacement/resume flows. Subscriptions are session-specific and must be
   rebound after replacement.
5. **Extension API:** lifecycle and tool events, streaming tool updates, supported
   dialog UI in RPC, custom entries/messages, and native tool registration.

No HTTP, SSE, browser reconnect cursor, live-process registry, session lock, or
terminal-process attachment API was found in Pi. Those are adapter/daemon duties.
The product's agreed HTTP/SSE boundary can wrap RPC events, but must assign its
own bounded replay cursor; Pi entry IDs are durable history cursors, while live
RPC events do not universally carry durable IDs.

## Reproduction

Files:

- `probe.mjs` — disposable deterministic and live probe plus evidence verifier.
- `probe-extension.ts` — synthetic streaming, abort, and RPC question fixture.
- `events.redacted.jsonl` — selected real event records and direct runtime
  evidence; paths and random IDs are replaced consistently.

Commands run from repository root:

```sh
# Initial deterministic fixture (no model call, output outside the repo)
node issues/probe-pi-control/probe.mjs --output /tmp/probe-selftest.jsonl

# Full live disposable probe
node issues/probe-pi-control/probe.mjs --live \
  --output issues/probe-pi-control/events.redacted.jsonl

# Deterministic validation of the preserved redacted evidence
node issues/probe-pi-control/probe.mjs --verify \
  --output issues/probe-pi-control/events.redacted.jsonl
```

The full probe creates its root with `mkdtemp()` under the system temporary
directory, creates two synthetic workspace directories and a custom session
directory there, and removes that root in `finally`. It never calls default
`SessionManager.listAll()` against the user's real history, never opens a real
session, and does not inspect credentials. Pi reads its normal authentication
configuration only to make the disposable live model calls. Global/project
extensions, skills, prompt templates, and context files are disabled.

### Probe/tool failures encountered and resolved

- The first live attempt timed out because the probe awaited an
  extension-command response before servicing that command's nested UI request.
  The client was corrected to answer `extension_ui_request` first; this ordering
  is itself useful for the adapter.
- Two subsequent `gpt-5.4-mini` attempts did not reach a tool-start event within
  the probe bound; one timed out and one was stopped after diagnostics localized
  the stall. A diagnostic retry was also stopped intentionally. Authentication
  itself reported `ready`. The required live path was rerun successfully with
  the available `gpt-5.6-sol`; no capability claim relies on the incomplete runs.
- An optional `npx --yes tsc` check resolved the unrelated deprecated `tsc`
  package and exited nonzero. It was not used as evidence; Node syntax checking,
  actual Pi/Jiti extension loading, the live run, and the deterministic verifier
  cover the executable fixture. An exploratory global `npm list` lookup also
  exited nonzero because this Pi installation is not in that npm prefix; direct
  package metadata and `pi --version` supplied the recorded version instead.

All failed/stopped attempts used fresh disposable roots and their `finally`
cleanup. No existing session or persistent project file was involved; normal Pi
authentication behavior is qualified below.

## Redaction and safety constraints

- All prompts, answers, command output, filenames, and file contents are synthetic.
- Temporary absolute paths become `<DISPOSABLE_ROOT>`; home paths become `<HOME>`.
- Random session UUIDs (including UUIDs embedded in filenames), entry IDs, and
  tool-call IDs become stable placeholders so correlation remains inspectable
  without retaining operational identifiers. The verifier rejects raw UUIDs.
- Usage/cost objects are omitted from preserved event examples.
- Competing resume was observation-only: both processes requested state, neither
  appended a prompt or mutation while concurrent.
- No terminal TUI, tmux pane, existing JSONL, real history, production daemon,
  remote repository, or live user process was modified. Pi read normal auth
  configuration and may refresh OAuth through its native credential storage;
  the probe did not inspect credential contents.
- Terminal attachment was bounded from primary docs/source and a disposable
  competing-resume test rather than risk an actual user process.

## Remaining limits and v1 adjustments

- Treat `history readable`, `process observed`, and `control channel owned` as
  independent adapter fields. Unknown must remain unknown.
- Serialize control per `pi:<sessionId>`. If a potentially live external process
  is observed, expose history read-only and explain why resume is disabled.
- Keep the daemon-side RPC child alive across browser/SSE disconnects; do not tie
  child lifetime to one HTTP connection. Reconnect should fetch a fresh snapshot
  or replay the daemon's own bounded SSE buffer.
- Use `agent_settled`, not only `agent_end`, as the idle boundary because retries,
  compaction, steering, or follow-ups may continue after a low-level run ends.
- Render diffs and intermediate output only when supplied. Preserve unknown tool
  payloads with a generic renderer.
- Implement extension UI dialog response routing by request `id`, including
  cancellation/timeouts and the possibility that the outer command response is
  blocked on the nested request.
- Pi does not prevent external writers or concurrent resumes. Crash consistency,
  file replacement/rename races, host reboot, and daemon restart recovery need
  focused adapter tests in implementation work.

## Validation

Required repository checks and the deterministic evidence verifier are run after
finalizing this report:

```sh
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
node issues/probe-pi-control/probe.mjs --verify \
  --output issues/probe-pi-control/events.redacted.jsonl
```

The independent review level is **focused routine evidence-gated review**: this
is a disposable probe rather than production process-control code, but its
conclusions affect architecture. One economical finder reviewed unsupported
inferences, session safety, redaction, and reproducibility. Its actionable
candidates from `claude-fable-5-1` were checked locally and corrected; the
workflow's conditional verifier (`gpt-6-astra`) then tried to refute them and
identified two incomplete corrections, which were completed. Primary installed
docs/source/runtime evidence remains
authoritative. No review report or performance log was written outside this
issue directory because this worker's ownership is intentionally restricted.
