# Candidate-neutral agent-host benchmark fixture

This directory contains **reversible benchmark plumbing only**. It freezes the common synthetic inputs, scenario descriptions, lifecycle simulator, evidence contracts, and integrity checks needed before separate workers add adapters for a minimal custom API, AHP, ACP, AG-UI, or LangChain Agent Protocol/Streaming. It does not implement, select, execute, or score any candidate protocol. `sample-evidence.json` is bounded synthetic output from the fixture and is not a B1–B8 result.

## Requirements and setup

- Python 3.11 or newer, standard library only.
- Git on `PATH`, used only to initialize a local synthetic repository.
- No provider credentials, package installation, service, listener, or network access.

All runtime writes require an explicit disposable child of the operating system temporary directory. The path must be absolute, must not contain symlink components, and must carry the fixture marker with exact content:

```sh
output_root="$(mktemp -d /tmp/agent-host-fixture.XXXXXX)"
printf 'agent-host-disposable-v1\n' > "$output_root/.agent-host-fixture-root"
python3 benchmarks/agent-host/fixture.py --json preflight --output-root "$output_root"
```

Remove that directory after the commands below. Never point the fixture at a repository checkout, home directory, persistent user configuration, or shared workspace.

## Exact validation commands

Run from the repository root:

```sh
python3 benchmarks/agent-host/fixture.py --json version
python3 benchmarks/agent-host/fixture.py --json doctor
python3 benchmarks/agent-host/fixture.py --json scenario list
python3 benchmarks/agent-host/fixture.py --json preflight --output-root "$output_root"
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s benchmarks/agent-host -p 'test_*.py' -v
python3 docs/validate-project-view.py
git diff --check
```

`doctor`, `scenario list`, and `preflight` are deterministic and non-interactive. `preflight` is read-only. JSON data is written to stdout; structured failures are written to stderr. Exit `1` identifies caller/actionable validation failures and exit `2` identifies dependency, I/O, or invariant failures. `--verbose` adds one-line JSON diagnostics to stderr and never changes stdout. Text output is fixed by flags, not by TTY detection.

The test suite creates marked `tempfile` roots, executes all four fake-orchestrator outcomes, creates and removes deterministic Git workspaces through the orchestrator, persists SQLite evidence, verifies the event hash chain and bundle digest, checks sanitization and tamper detection, and exercises CLI success/error contracts. It never starts a candidate or contacts a provider.

## Architecture

| File | Responsibility |
|---|---|
| `fixture.json` | Frozen Alice/Bob, school-a/school-b, policy, repository, scripted provider/extension, limits, network denial, and stop conditions |
| `scenarios.json` | Machine-readable B1–B8 operations, expected observables, role-aware delegation/applicability, and stop conditions |
| `fixture_core.py` | Strict output-root guard, stable IDs, policy fixture, sole lifecycle owner, deterministic repository builder, SQLite evidence store, sanitizer, bundle writer, and integrity verifier |
| `fixture.py` | Read-only AI-first CLI for version, validation, scenario discovery, and preflight |
| `adapter-contract.json` | Candidate adapter operations and authority/fidelity constraints |
| `candidate-result-schema.json` | Result states that keep native events and normalized observations separate and preserve delegated/NA/not-exercised semantics |
| `evidence-schema.json` | Portable sanitized bundle envelope |
| `sample-evidence.json` | Small synthetic example generated at fixed time; not candidate evidence |
| `version-manifest.json` | Machine-readable fixture/contract/runtime versions and explicit absence of candidate execution |
| `test_fixture.py` | Deterministic safety, lifecycle, policy, evidence, and CLI self-tests |

### Authority and lifecycle

`FakeOrchestrator` is the only component permitted to create, stop, or remove a fixture runtime or workspace. Its stable IDs are SHA-256-derived from frozen fixture inputs. Its start operation supports:

- `success`: one Git workspace and one runtime record are created;
- `failure`: no lifecycle side effect occurs and failure is explicit;
- `timeout_before_side_effect`: no side effect occurs but terminal state remains unknown;
- `timeout_after_side_effect`: one runtime/workspace exists while terminal state remains unknown.

Unknown outcomes are observable and are never retried automatically. The fake “runtime” is a bounded JSON record, not a process. The repository is a real local Git repository with fixed file bytes, author identity, timestamp, branch, commit message, locale, and signing/hooks disabled. This yields one deterministic baseline commit without reading user Git configuration.

### Synthetic identity, tenant, provider, and policy inputs

Alice and Bob are distinct authenticated fixture principals; client IDs never establish principal identity. `school-a` and `school-b` carry identically shaped resources but remain separate scopes. Alice owns the primary `school-a` session; Bob starts with no access. `read_value` is low-risk, `write_value` requires approval by verified Alice, and `exfiltrate` plus cross-tenant reads are denied. This is deterministic policy input, not production authentication or authorization.

The scripted provider and allow-listed extension are descriptors only. They cover text, a successful typed read, a deterministic failed tool, a select/input request, a slash command that performs no model turn, and a handled input hook. They contain no provider SDK, model call, plugin loader, credential, or network path.

## Evidence model and integrity

`EvidenceStore` owns a local SQLite database under the validated output root. Its inspectable tables are:

- `attempts`: requested, accepted, observed, terminal, correlation, principal, tenant, scenario, and timestamp;
- `events`: candidate-native JSON plus normalized JSON, timestamp, monotonic per-attempt sequence, previous digest, and record digest;
- `policy_decisions`: actor/scope/capability/outcome/reason, approval actor, timestamp, and a bounded-operation hash;
- `artifacts`: media type, byte count, content digest, timestamp, and a maximum 256-byte sanitized preview;
- `native_bindings`: platform attempt to candidate/runtime native ID, availability, and timestamp.

Bundle writes are atomic, capped at 1 MiB, and require a caller-supplied RFC3339 UTC timestamp so tests do not read wall-clock time. Artifact capture is capped at 64 KiB. Secret-shaped fields are replaced with `<redacted>`; absolute paths are replaced with `<absolute-path>`; strings and collections are bounded. Each event links to the previous per-attempt SHA-256 digest, and the bundle has per-attempt chain heads plus a canonical-payload digest. `verify_bundle` rejects event or payload tampering. The evidence schema is `evidence-schema.json`; `sample-evidence.json` demonstrates all five record classes.

The store is fixture durability, not a production data model. It makes evidence inspectable after a fake runtime/workspace is removed, but does not claim database, retention, backup, privacy, or scale decisions for the future host.

## Result and adapter contracts

Adapters expose capability discovery, validation, native-event mapping, and current-state reads. Optional input, answer, cancellation, and subscription operations must carry stable attempt/cursor identity. An adapter may not create a workspace, own runtime lifecycle, leak credential values, silently retry an unknown outcome, or discard native source events.

A candidate result records its evaluated category role and exactly one of:

- `observed_as_specified`;
- `observed_with_deviation`;
- `delegated` with a named component and reason;
- `not_exercised` with a reason;
- `not_applicable` with a category-boundary reason.

`not_exercised` and `not_applicable` cannot carry scores. Delegation remains visible and cannot be reported as native behavior. Scores, if later added after actual execution, remain category subtotals from 0–3; this scaffold emits none.

## Safety and stop enforcement

The core refuses relative roots, the OS temporary directory itself, roots outside it, missing/incorrect markers, and symlink components. Existing evidence destinations may not be symlinks. Workspace deletion resolves and checks containment before removal. Limits and stop conditions are frozen in `fixture.json` and repeated per scenario where specific.

Stop immediately and preserve only sanitized evidence upon any cross-principal/tenant disclosure, unexpected network or credential access, write outside the validated root, uncontrolled process growth, destructive external action, or ambiguity about lifecycle authority. Cleanup must go through the fake orchestrator. Never retry a safety or fidelity failure “until green.”

No fixture code opens a socket. The declared network mode is `none` with an empty allow-list. Because standard Python cannot enforce OS-level egress/resource confinement by itself, a later candidate runner must supply and evidence that enforcement before any candidate process is eligible to run. This scaffold deliberately has no candidate runner.

## Extension points

A later adapter worker should:

1. pin the candidate/specification/SDK revision in a subject-specific version manifest;
2. implement `adapter-contract.json` without adding lifecycle or policy authority;
3. map every source event into both an unchanged native record and a normalized observation;
4. create one candidate result per B1–B8 using the exact descriptors in `scenarios.json`;
5. name delegated components and category-inapplicable behavior rather than filling gaps with success;
6. write only below a separately marked temporary subject root and use `EvidenceStore` for durable records;
7. add malformed/loss/reconnect cases required for that candidate category;
8. stop rather than continue if any frozen stop condition occurs.

Candidate-specific dependencies, downloads, protocol traffic, listeners, and execution are intentionally absent. Adding a candidate adapter is a separate scoped issue and review; it must not modify the common scenario meanings to improve a candidate’s outcome.
