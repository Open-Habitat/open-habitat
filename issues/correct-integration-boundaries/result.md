# Result: corrected MVP integration boundaries

## Changed meanings

- `docs/product.md`, `docs/ui.md` and `docs/architecture.md` now make Git
  integration a blocking gate before a Git repository can be opened. The gate
  covers repository state and the Unix user's credential environment for agents'
  ordinary `git pull` and `git push` commands; detecting `gh` authentication is
  explicitly insufficient. The user sees successful, failed and unknown partial
  steps and can correct/retry without the text choosing a credential mechanism or
  production stack.
- Supported worktrees are now only Taskfleet-created, Taskfleet-managed dedicated
  agent environments. The UI has no general facility to create, edit or manage
  arbitrary manual Git worktrees. Externally discovered worktrees may remain
  read-only facts or operation impacts.
- Terminal control now distinguishes unsupported RPC attachment to a live Pi TUI
  from the valid `pi --mode rpc --session <session>` startup. The documented
  transfer stops the TUI safely, ensures native history has settled and starts a
  new RPC runtime only afterward; failure cannot create a competing writer.
- Structured diff display is required only for Pi's supported `edit` output.
  Unknown/custom tools use their available generic result, and bash-induced file
  changes do not require a synthetic diff engine.
- `docs/assumptions.md` now separates Pi evidence, accepted invariants, genuinely
  architecture-changing uncertainties and routine implementation tests. Earlier
  A1–A4 are resolved or bounded from the probe; A7 and A9–A13 are no longer
  presented as doubtful architecture hypotheses. The still-open workspace and
  GitHub lifecycle claims remain explicitly unverified.

## Evidence used

The Pi conclusions come only from
[`issues/probe-pi-control/result.md`](../probe-pi-control/result.md), delivered in
`4187da0ec40079ec09d98539c03f840102cde616` and closed in
`71f0caafce46ecf46a743a68a4af5ee90b2009c3`, against Pi 0.85.1. That probe
verified stable native session identity and cwd association, RPC resume after a
process exit, queue/steering semantics, unsafe competing resume, absence of a
live-TUI RPC attach surface in the inspected interface, and tool-specific
`edit` diff details. It did not run a real TUI-to-RPC product transfer, a daemon,
a browser, or any workspace/GitHub lifecycle.

The accepted corrections themselves are recorded in this issue's `item.md` and
were checked against the existing MVP result and durable architecture. The
workspace/GitHub lifecycle probe remains open with no `result.md`; this delivery
does not claim it ran.

## Validation and review

The final tree was checked from the repository root with the required commands:

```sh
python3 scripts/validate-project-view.py
issuectl doctor --json
git diff --check
```

All passed: the project-view validator reported the complete page/navigation
set, issuectl reported no doctor violations, and Git reported no whitespace
errors.

Review level: a focused source-grounded self-review was proportionate for this
bounded documentation correction. Each of Jari's five accepted corrections was
traced directly through the product, UI, architecture and assumptions diff, and
all Pi claims were compared line by line with the landed probe result. No
external model panel was used because it would not supersede the accepted wording
or primary probe evidence; deterministic checks remain authoritative.

## Remaining decisions and limits

- The credential mechanism, integration implementation and production stack are
  still undecided. The workspace/GitHub lifecycle probe must establish the
  repository, transport, credential, rights and network boundaries before a
  recommendation.
- UI review still decides the presentation for queue/steering, transfer
  confirmation, synopsis, drafts, read position and attention. It does not
  reopen the no-live-attach or Taskfleet-only worktree boundaries silently.
- Implementation must test a disposable real TUI stop/history-settle/RPC-start
  transfer, one-controller serialization, browser disconnect survival and the
  listed partial-operation failures. Documentation is not product evidence.
- No product code, `TODO.md`, human-review issue, credential setup, remote
  repository or deployment was changed by this issue.
