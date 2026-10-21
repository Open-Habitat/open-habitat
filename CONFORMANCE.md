# CLI conformance

AI-first CLI canon v4 (§1–§24); source and behavioral review of the personal
agent surface and shared CLI plumbing. `project-canon review --profile cli
--run <built-open-habitat> --json .` is advisory, not a passing gate.

The runtime probe in project-canon 0.9.3 looks for result fields at the top
level rather than under `data`, so its §2/§8/§10/§14–17 reports require manual
inspection. Its doctor probe also supplies an unsupported positional `.`;
that rejection is not evidence that bare doctor is missing. Its Rust-only
`crates/` check does not describe this Go program's package split.

| § | Status | Evidence and remaining limits |
|---|---|---|
| 1 | pass (agent) | `TestAgentCLIContextValidation`: unknown flags, selectors, malformed IDs and mixed current/explicit targets rejected before connection. |
| 2 | pass | Central `cliError` classification and `emitError`; help advertises 0/1/2 and signal codes. JSON stdout and error stderr remain separate. Service diagnostics are JSONL. |
| 3 | pass (agent) | Reads and file export are non-interactive; no prompts, pager or TTY branch. |
| 4 | pass (agent) | Invalid target/argv and expected syntax are reported; daemon failures use fixed codes without native errors. |
| 5 | pass (agent) | Read results go to stdout; workspace list also exports JSONL to a new file and reports metadata. No command in this slice consumes stdin. |
| 6 | pass | `agent <resource> <verb>`; no declarative wrapper or native git/gh/tmux/Taskfleet replacement. |
| 7 | pass (agent) | Environment/conversation `show`, workspace `list`, no CRUD synonyms. |
| 8 | partial | Bare `config path/show` inspect the effective account's native Pi settings and socket; only known non-secret defaults are returned. Operator component inspection stays explicit. Identity/path are fixed by effective UID, not overridable routing config. The older operator state/config selectors do not yet provide a uniform per-key flag/env/file interface. |
| 9 | pass | Formatting depends only on explicit `--json`; text help is text, JSON help is structured. |
| 10 | pass (shared plumbing) | Version and skills share build version; full build revision or null plus provenance; structured errors and warning arrays. `TestVersionAliasJSONAndText` covers alias identity. |
| 11 | n/a (agent reads) | No daemon mutation in this slice; export refuses overwrite. Existing operator mutations retain their own tests. Skill installation still has inherited partial-plan/no-clobber limitations. |
| 12 | n/a (agent reads); partial (services) | Agent requests have bounded deadlines and do not create jobs. Long-running service entry points still lack the full canon result/cancelled stream and signal exit mapping. |
| 13 | pass (agent) | Workspace list `--output FILE.jsonl`; rows carry schema version, stdout carries path/count. `TestAgentWorkspaceOutput` covers bytes and refusal to overwrite. Replies are bounded by the client. |
| 14 | pass | `helpSpecs` supplies drill-down command paths, flags/defaults/enums, arguments, examples and exits; `TestHelpDrilldownAndAgentSkill` walks every leaf. |
| 15 | partial | Operator and agent skills install as native Claude/pi/Codex trees; default runtime selection is all. Tests cover byte identity, three destinations, force/no-clobber. Omitting the skill name still does not install the whole catalog. |
| 16 | pass | `skill print agent` is embedded, version-matched, side-effect-free and byte-identical to installation. |
| 17 | partial | Printed/installed skills and version metadata share the binary version. The inherited installer does not distinguish newer/older on-disk skill versions beyond explicit force/no-clobber. |
| 18 | partial | Bare doctor now checks personal native configuration and own socket, with nonzero failures. It does not claim that pathname checks prove liveness or a kernel quota read. Failure currently uses the shared error envelope rather than a complete checks/summary document; native dependency and installed-skill audits remain incomplete. |
| 19 | n/a (agent reads) | No persisted timestamps or time-derived IDs. Environment observation receives its observation time as a parameter; a frozen time must not falsify a live quota observation. |
| 20 | n/a | CLI owns no human-editable personal record store. Native tools own their files. |
| 21 | n/a | No personal home/bootstrap registry. Skill installation is explicit. |
| 22 | pass | CLI delegates to daemon/controller, transport, storagequota and core packages; domain operations do not depend on the parser. |
| 23 | partial (repository); pass (new surface) | New skill, templates and fixtures use neutral synthetic identities and paths; no personal defaults. Repository-wide public cleanup and configurable private-marker diagnostics remain unfinished. |
| 24 | pass (reviewed scope) | Old review-run failures are explicitly historical rather than current blockers. The second socket really requires installation/policy changes; neither native test results nor templates claim live deployment acceptance. |

Remaining partial rows are report-only conformance gaps, not claims of a fully
conformant operator CLI. Personal reads do not reach gateway sessions, editor
grants, browser terminal relays, provisioning, user lists or administration.
Kernel UID checks and a separate default-deny route table are not CLI flags.
