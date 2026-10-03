# Agent-host benchmark fixture

This directory is the shared, candidate-neutral half of a hands-on protocol
benchmark that the project may or may not run. The architecture synthesis
(`issues/native-agent-host-architecture/synthesis-and-architecture-review.md`,
§7) froze a common specification so that AHP, ACP, AG-UI, the LangChain Agent
Protocol and a minimal custom baseline could be compared against identical
inputs and identical scenario meanings. This fixture turns that specification
into machine-readable descriptors, a fake lifecycle owner, an evidence store and
self-tests. It contains no candidate adapter, runs no candidate, and produces no
score; `sample-evidence.json` is fixture output, not a benchmark result.

The project then decided to build the first HTTP/SSE implementation directly
and return to the benchmark only if a concrete need for another protocol
appears (`issues/native-agent-host-architecture/research-index.md`, "What to check next"). So the normal job here is
to keep the fixture green and honest, not to grow it. Adding a candidate
adapter is a separate issue with its own review.

## What the fixture is protecting

**Comparability.** Every candidate has to meet the same B1–B8 scenarios with
the same actors, policy and expected observables. `scenarios.json` and
`fixture.json` are frozen copies of §7 for that reason. Changing a scenario so
that a particular candidate fares better silently destroys the comparison, and
the result states in `candidate-result-schema.json` exist so that gaps are
reported as `delegated`, `not_exercised` or `not_applicable` instead of being
filled with success. `not_exercised` and `not_applicable` carry no score; a
delegated operation names the component that supplied it and, per §7.6, scores
at most 2.

**Honest failure semantics.** `FakeOrchestrator` is the only thing that
creates, stops or removes a runtime or workspace, and its timeout modes leave
the terminal state unknown on purpose. B3 and B4 measure whether a protocol can
live without lifecycle authority and without blind retries, so an adapter that
acquires either, or code that "helpfully" retries an unknown outcome, removes
the very thing being measured.

**The machine it runs on.** Workspaces are removed with `rmtree`, so everything
the fixture writes goes below an output root that `validate_output_root` has
accepted: an absolute, symlink-free, dedicated child of the OS temporary
directory carrying the marker file whose name and exact content are constants
in `fixture_core.py`. The strictness is what makes deletion safe; weakening any
of the checks makes the fixture able to delete something real. The tests create
their own marked roots, so only `preflight` needs one from you:

```sh
output_root="$(mktemp -d /tmp/agent-host-fixture.XXXXXX)"
printf 'agent-host-disposable-v1\n' > "$output_root/.agent-host-fixture-root"
python3 benchmarks/agent-host/fixture.py --json preflight --output-root "$output_root"
```

Remove the directory afterwards.

**Evidence that can be trusted later.** `EvidenceStore` keeps native events
and normalized observations side by side, hash-chains events per attempt, and
`verify_bundle` rejects tampering. Bundles are sanitized before writing, but
`sanitize` works by key name (keys in which token, secret, password or
credential is followed by `_` or ends the key) and by an absolute-path regex;
it does not inspect values. That is
adequate for synthetic data and would not be adequate for evidence from a real
candidate. Timestamps are caller-supplied so tests never read the clock, and
`version-manifest.json` records the contract versions a later subject manifest
pins against, so a contract change bumps it and updates the schemas, sample and
tests together, or old bundles stop being interpretable.

## Things the code does not say out loud

- The self-tests are not part of `scripts/ci-local.sh`. They run only when
  invoked by hand, with this command from the repository root, and the
  environment variable keeps `__pycache__` out of a tree that does not ignore
  it:

  ```sh
  PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s benchmarks/agent-host -p 'test_*.py' -v
  ```

- `fixture.py` is read-only and follows the AI-first CLI canon; `--help` and
  `--json doctor` describe the surface and check the descriptors against each
  other, so a schema edit that breaks cross-consistency shows up there first.
- The fake "runtime" is a JSON record, not a process. The Git repository is
  real, but with fixed author, timestamp, branch, locale and hooks/signing
  disabled, so the baseline commit hash is deterministic and the fixture never
  reads the user's Git configuration.
- Standard-library Python cannot confine a child process's network or
  resources. The fixture declares network mode `none` and opens no socket, but
  a later candidate runner has to supply and evidence real confinement before
  any candidate process is allowed to start. Its absence here is deliberate.
- Requirements are Python 3.11 and `git` on `PATH`; nothing is installed and
  nothing is contacted.

## If a candidate adapter is ever added

Work from `adapter-contract.json` and the candidate-specific cases in §7.5.
Pin the candidate's specification and SDK revision in a subject-specific
manifest, keep every source event as an unchanged native record next to its
normalized observation, and write only below a separately marked root using
`EvidenceStore`. The stop conditions in `fixture.json` (cross-principal or
cross-tenant disclosure, unexpected network or credential access, a write
outside the root, runaway processes, destructive action, unclear lifecycle
ownership) are not failures to work around: once one has occurred the run has
answered its question and further evidence is worthless, so stop, keep the
sanitized evidence, and report it as it is.
