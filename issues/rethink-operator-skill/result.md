# Operator skill rethought

`internal/cli/operator/SKILL.md` was rewritten with `/rethink-instructions`.
Only that file changed. No test or script pins its wording: the Go test
compares `skill print operator` with the embedded bytes, and packaging
copies the printed text. `./scripts/test-focused.sh --area go --go-package
./internal/cli` passes under `umask 077`.

## How the reader meets it

The file is embedded in the binary. `open-habitat skill print operator`
prints it, `skill install operator` writes it into a harness, and the
release package carries it as `operator/SKILL.md` beside the binaries and
`site/schema.json`. `docs/operations.md` is not in the package and follows
the main branch, so the skill is the only text guaranteed to match the
release the agent is running. The frontmatter (`name`, `cli_version`,
`schema_version`) is an interface and is unchanged apart from the
description, which now names the tasks that should load the skill.

## What the original was trying to do

It was almost all knowledge, not procedure: a telegraphic compression of
the operator guide, written as unbroken paragraphs. It protected three
things. People's separation and data: permissions on `/etc/open-habitat`,
the gateway's exclusive identity, never resetting broker state or journals.
The integrity of a half-finished operation: plan approval, continuation
with the same inputs and original approval, no force route. The trust in
what runs as root: GitHub's stated digest as the only pin. Its weakness was
that the reader was never told this. The purpose, who is affected and why
the fences exist were missing, the word "operator" meant the binary in one
sentence and the human in the next, and the same rule ("original approval,
same inputs") was restated in four places.

## What changed

- An opening that says whose host this is, what a mistake costs and when
  the work is done, and where detail lives: `--help` at every level, the
  site schema and example, and the operator guide at the release's tag.
- One section that explains the plan and approval model once, including
  that read-only commands can be run freely and that the approval is the
  administrator's. The permission gates scattered through the original
  ("in a maintenance window", "inspect before mutation") are replaced by
  what each live command interrupts.
- Reasons attached where the original had bare limits: why the parent is
  0711 and not 0700, why foreign unit overrides are refused, why broker
  state is not edited by hand, why the gateway's identity is exclusive.
  These reasons come from `docs/operations.md`.
- The `admin` sections are shorter. Flag syntax and per-command semantics
  that `--help` states (stdin for secrets, numeric ids, `--dry-run`, what
  `seed` and `delete` do) are left to it; what stays is the model (two
  sources of admission, state that site.json does not own) and the traps
  (`outcome_uncertain`, an unconfirmed withdrawal, a copied key cannot be
  recalled). `admin --help` is named as the list of everything, which also
  covers commands the original never mentioned (`remove-person`,
  `cancel-removal`, roles, storage).
- The two recoveries with a corrected binary are one section stating the
  shared rule, with a pointer to the guide for the walk-through. The
  numbered TLS procedure became prose that says rotation is an ordinary
  apply with changed sources.

The result is about a tenth shorter (22.8 kB against 25.4 kB), not the
large reduction the method usually gives. The original had little
procedure to remove, and its facts have no other release-matched home, so
the gain is in order and reasons more than in length.

## Dropped

- The internal mechanics of the corrected-binary continuation: that it
  reconstructs the protected-input binding from the installed executable's
  digest, clears the two unit start limits, reloads systemd and restarts
  units in a given order, and that a later upgrade recognizes the repaired
  gateway policy. The reader acts the same without them.
- "The broker alone observes its high-water mark", the detail that the
  gateway's inherited socket is the private administration listener, and
  the `AmbientCapabilities`/`CapabilityBoundingSet` directive names.
- The repeated capitals and "never" forms where the surrounding text
  already gives the reason.

## Where Jari's knowledge is needed

- **Are the two corrected-binary recoveries still needed in the shipped
  skill?** Both exist for installations whose apply was stopped by a defect
  in an earlier product (`config_io` under a 0700 parent, `listen_failed`
  on 443). If no such installation can still exist, the section can go from
  the skill and stay in the guide, which would save about thirty lines.
- **Pointing at the guide by tag.** The skill now tells the reader to read
  `docs/operations.md` at tag `v<version>`. This assumes every release has
  that tag and that the guide at the tag is right for the release.
- **Things the fact-check should look at**, left as the original had them
  because this was a rethink only: the skill says amd64 while packaging and
  the guide support arm64 too; it describes only the quota storage mode,
  while the guide has a mode without per-user limits
  (`storage.enforce_user_quota`); it does not mention team admission.
  `maintenance enter|leave` appears in `--help` and the guide calls it an
  unrelated older marker; the skill says nothing about it.
- `docs/operations.md` describes the skill as "the same procedure in a
  compact form". That is still roughly true and was not edited here.
