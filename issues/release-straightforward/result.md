# Result

A release is now one command, `scripts/release-cut.py`, run where the gate
ran:

```sh
python3 scripts/release-cut.py --commit <gated sha> --notes <changes.md> \
  --callback <pi:id> [--dry-run]
```

Before anything is built or written it refuses unless the clean-gate
receipt (by default the one `ci-local.sh --clean` recorded for the commit's
tree) covers exactly that tree, the commit is on origin/main and carries this
script, the tag is free (an unpublished draft only with `--replace-draft`),
the predecessor (newest published release unless named) is immutable, and no
runtime input changed since it. The version defaults to the predecessor's
pilot number plus one.

The cut then runs inside the existing `release-scratch.py` wrapper (private
inputs, Alder's shared lease, cleanup on every exit) and, in order:

1. adds a detached worktree of the commit, so the gated commit's own tools
   build the release, and removes it afterwards;
2. builds `runtime-release` from that tree;
3. downloads the predecessor's manifests and packages and the full reused
   runtime closure from their immutable source releases, each checked
   against GitHub's stated digest and the manifest;
4. builds both packages with `prepare-test-release.sh` in gated mode, which
   checks the receipt again before, during and after packaging;
5. writes both manifests with `successor-descriptors.py` and
   `runtime-release manifest`, which verifies the complete closure;
6. writes one `release-gate.json` with the receipt embedded and runs
   `release-upload-plan.py`, requiring exactly the five new assets and every
   archive reused;
7. creates the draft with only those assets, checks that the digest and size
   GitHub states for each draft asset equal the verified local bytes, and
   publishes; after publishing it requires the release to be immutable with
   the same digests;
8. starts `fleetrepo-open-habitat-upgrade` on Alder (over `ssh alder`, or
   directly when run on Alder) with an idempotency key, so a rerun cannot
   start a second installation.

Evidence (plan, gate record, upload plan, notes, draft and published
digests, launch output, stage timings) goes to
`~/.local/state/open-habitat-release/<tag>/<time>/`. Every error names its
stage, what is left behind (nothing, an unpublished draft, or a published
release whose installation still has to be started) and what to run next.

The release prose in `AGENTS-WORKFLOW.md`, `TESTING.md` and
`docs/operations.md` is rewritten around the script. The scratch-wrapper and
`cut.sh` recipe paragraph is gone. The pilot.18 recipe
(`/var/tmp/agent-keep/pilot18-01m6c2yb/cut.sh` on Alder, a copy in the
conductor's `~/.local/state/oh-conductor/pilot18/`) is evidence of how
pilot.18 was made, kept outside the repository. This run was not allowed to
change anything on Alder, so it is left for the conductor to delete or keep.

## Evidence

- `python3 scripts/test-release-cut.py` (19 tests, offline, added to the
  gate's script tests): receipt acceptance and every refusal (other tree, other gate inputs, failed, not a
  clean gate, malformed, missing; same tree from another commit only warns),
  commit unknown, not pushed or predating the script, runtime change, the
  predecessor choice (drafts ignored, mutable, no source commit, missing
  assets), tag taken by a release, draft or remote tag, versions, the
  digest comparison for draft and published releases, the commit already
  being the predecessor's, the stop message after a publish request whose
  outcome is unknown, SIGTERM unwinding with its stage, the upgrade command,
  the gate record and notes, exit codes, and a real cut that refuses before
  any worktree, build or GitHub call. One test runs real `git diff` against
  the runtime pathspecs in a throwaway repository.
- **Rehearsal on real data**, 2.11.2026 on Birch: the real script on the
  gated pilot.18 commit `3c9c6072` with its real receipt, stopped by a
  harness at the first GitHub write (`gh release create`) and with
  `runtime-release` built from this branch, since the old tree still has
  `sign`. It ran every stage up to there in 4 min 7 s, including the 2.4 GB
  closure download from pilot.17. It planned exactly the five uploads
  (44.3 MB) with 24 archives (2.44 GB) reused from `v0.1.0-pilot.17`, and
  left no worktree behind. Nothing was uploaded or published.
- `--dry-run` against live GitHub plans `v0.1.0-pilot.19` from pilot.18 and
  refuses current `origin/main` with `receipt_missing`.
- A real SIGTERM during the rehearsal's archive stage printed
  `{"code":"cancelled","stage":"archives"}` and left no worktree registered.
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) and `/assess-findings`. Two findings were fixed: a
  failed publish request was reported as a leftover draft, so a rerun could
  cut the same commit again as the next version; and SIGTERM skipped
  cleanup. One was dropped by rule 1b: the receipt file being replaced in
  the seconds between check and use, while packaging re-checks it anyway.

Not run: an actual upload, publication or installation (forbidden in this
run). The first real use is the conductor's next release.

## Decisions for later review

- **Python, not shell.** The decisions (receipt, predecessor, tag, runtime
  change, digest comparison) needed tests without network, and the existing
  release helpers are Python.
- **Product-only releases only.** A runtime change stops the cut with
  `runtime_changed` rather than rebuilding archives, because core and
  integrations must be built natively on each architecture. Runtime
  releases are rare, and an agent handles them. The runtime inputs are
  `runtime/`, the `scripts/*runtime*` builders,
  `download-profile-inputs.py` and `go-binary-notices.py`, compared between
  the predecessor's commit and the candidate.
- **The full closure is still downloaded and verified locally** (about 3
  minutes on Birch) instead of trusting reused descriptors from the
  predecessor's authenticated manifest. Skipping it would change what
  `runtime-release manifest` proves. Making that change would be a separate
  decision.
- **The draft is not downloaded again.** GitHub's stated digest is what
  installers trust, and the script compares it with the bytes it verified.
  pilot.18 downloaded the draft and checked a self-published `SHA256SUMS`,
  which checked nothing more.
- **Predecessor and version are derived** (newest published release, its
  pilot number plus one), and `--predecessor` and `--version` override them.
- **The tools come from the gated commit**, not from the caller's checkout.
  So a commit before this change cannot be cut by the script
  (`commit_predates_cut`).
- **The run location is Birch by default.** The receipt is there, and
  Alder is only reached for the upgrade launch. On Alder the script uses the
  shared scratch lease and runs the launcher locally.
- **A leftover draft is replaced only on request** (`--replace-draft`), and
  only after re-checking that it is still an unpublished draft of the same tag.
