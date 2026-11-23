# Result: the agent skill rethought

`internal/cli/agent/SKILL.md` went from 682 lines (44 KB) to 411 lines
(25 KB). It is embedded in the binary and reaches its reader whole, through
`open-habitat skill print agent` or an installed copy, so every byte is paid
each time a Pi agent looks up one host operation. There is no mechanism for
loading a part of it, so it stays one file with headings by situation.

## What the original was trying to do

Three things at once:

- **Be the reference for the whole `agent` surface.** Flags, byte limits,
  error codes and examples for each subcommand, most of which the
  subcommand's `--help` already states.
- **Prevent duplicate and blind writes.** Nearly every section ended with its
  own version of "never retry an uncertain write automatically", "a token is
  not approval", "`--dry-run` is unsupported", "unavailable is not empty".
  The reason (a lost reply does not mean the write did not happen; deletes act
  only on what was observed) was never stated once as a reason.
- **Protect the person's secrets, keys, home network and consent.** Secrets
  only through stdin or files, private keys out of the conversation, the
  Tailscale node untouched, provider passwords never handled, OAuth as the
  person's own act.

## What changed and why

- A section "How every command behaves" states the shared behaviour once,
  each with its reason: `--current` and its two errors, reads as
  observations, the uncertain write and what an idempotency key means,
  observation tokens, `error.result`, where `--dry-run` works, `--output`
  exports, text as data, and what stays with native tools. The per-section
  repetitions are gone.
- Each capability now says when it is the right tool and what the help does
  not say (what a frozen view can load, why `running` is set before the final
  message, that a provider's first API key changes the default model, that
  deleting a code-host connection does not revoke the token). Flag lists,
  size limits and most examples were dropped in favour of `--help`.
- Input shapes that exist nowhere the reader can reach stayed: the
  `integration-account` JSON fields (the original pointed at a schema file in
  the source repository, which a Pi agent on a host does not have), the login
  flows' JSON, the question answer, `--delivery` values.
- The security sections kept their limits but carry the reason instead of
  capitals: what reaches Pi's history and the model provider, why a refused
  key is the person's answer, why the Tailscale node is left alone (other
  accounts on the server could reach the person's network).
- The three `python3 -c` recipes were replaced by one sentence each on the
  export's shape (`entries` per line, `chunk.text` per line). Their test,
  `internal/cli/agent_skill_examples_linux_test.go`, ran them against
  hand-written fixtures, so it proved the Python and not the export format;
  it went with them.
- Added two pointers the original lacked: `work show` and
  `open-habitat skill print browser`.
- The frontmatter description now names the situations, since it is what a
  harness routes on for an installed copy.

Two statements in the first draft were checked against the code because the
original did not settle them: a wake rejects `--dry-run` (so the list of
commands that preview excludes it), and recap settings refuse Fable and Opus
models in the daemon (so it is described as a refusal, not a rule for the
agent).

## Where Jari's knowledge is needed

- **How short it should be.** 25 KB is still a lot for a weak model's
  context. The next real saving is structural, not editorial: let
  `skill print agent` take a topic (or ship references) so that an agent
  needing a wake does not also read about Trash and OAuth. That is a CLI
  change and outside this rethink.
- **Overlap with `host-context.md`.** The always-loaded guide carries the
  notice, rail, wake, view and file-offer passages nearly in full, and this
  skill carries them again. Which of the two owns the detail depends on the
  parallel rethink of that file; if it keeps its full passages, the "Reaching
  the person" section here can shrink to what goes beyond them.
- **Dropped details that might have guarded something.** The dot-directory
  rules for offers (a dot directory alone exports its contents; a dot-named
  file among several sources is `unsupported_file_name`), the title
  precedence in `conversation list` (native name, first message, *Uusi
  keskustelu*), the positional `conversation show pi:UUID` form, the
  statement that an export's count is records and not entries, and that
  `archive`/`workspace` observation tokens are "no reservation or approval"
  per command. Each looked like the trace of one incident; if one of them
  still bites agents in practice, it belongs back as a sentence with its
  reason.
- **Behaviour I added.** "Tell the person when the default changes" after a
  first API key, and "if they have no such place, the matching Settings page
  takes the secret in the browser" as the answer to a person who wants to
  paste a token. Both follow from what the original said, but neither was in
  it.
- **Help as the source.** The rewrite leans on `--help` for limits and
  flags. Some help lines are thin (`--delivery`, `--archived`,
  `--previous-archive` only repeat the flag name), and `agent skill list`
  still describes this skill as "Read your own native agent environment and
  launch context". Those are in Go files this task did not touch.
