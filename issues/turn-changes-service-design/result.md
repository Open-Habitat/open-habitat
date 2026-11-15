# Result: design for one shared record of turn changes

No implementation. `design.md` is the deliverable; the issue stays open
(`preparation: pending`) until Jari answers its five questions. Nothing was
filed upstream.

- **Recommendation:** the "service" is a record, not a process. A recorder
  extension snapshots the working tree at the start and settle of each turn
  into the conversation's private Git store and writes the tree id as a
  session custom entry. Vuoron muutokset, Palaa tähän and better-pi-rewind's
  `/rewind` read that record, each with its own UI. The recorder belongs
  upstream as a second extension entry of better-pi-rewind with a small
  read/restore module; Habitat's daemon stays a reader and no authority
  moves.
- **Rejected:** a standalone CLI (still needs the extension, adds a second
  artefact) and the daemon as owner (blind to terminal sessions, would start
  writing into the agent directory, cannot serve upstream).
- **In the document:** what each consumer needs, the entry format and the
  windows between boundaries, store layout and lifecycle, diff commands,
  limits and concurrency, Habitat's migration in five steps, the proposal
  text for upstream (about one page), three Mermaid diagrams.

## Decisions for later review

1. **The interface is the format** (a versioned session entry plus a bare Git
   store), not an RPC or an event-bus protocol. Alternative: extensions talk
   over Pi's `events` bus. Chosen because a reader outside Pi (the daemon)
   needs the on-disk form anyway, and the bus is not confirmed on OMP.
2. **Second extension entry inside better-pi-rewind**, with neutral names so
   it can be split out later. Alternative: a package of its own from the
   start. Left to the maintainer (question 2).
3. **The end entry carries the turn's file and line counts**, computed once
   at capture. Alternative: readers run Git per turn for the collapsed line.
   Chosen because trees are immutable, so the number cannot drift, and a
   history page then needs no Git call per turn.
4. **Snapshot from an explicit path list** (`ls-files` into `update-index`)
   instead of `git add -A`, so per-file limits can apply before anything is
   stored. Costs one extra listing per snapshot.
5. **One ref per kept tree, pointing at the tree**; pruning is deleting refs
   and `git gc`. Alternative: wrapper commits. The direct ref was checked to
   survive `gc --prune=now`.
6. **Store per session**, not per workspace: deletion with the conversation
   is one directory removal and needs no registry of references.
7. **The timeline stays on tool calls**; snapshots decide only the file
   list, counts and diffs. Per-command attribution remains the later phase
   of the earlier design.
8. **The switch takes effect when a conversation's Pi next starts**, because
   the recorder is loaded by argument rather than checking a Habitat
   preference each turn; an upstream extension cannot read Habitat's
   preferences.
9. **A new experimental switch for the record** rather than tying capture to
   the two existing switches (question 3).
10. **Starting limits** (20 MiB per file, 200 MiB per snapshot, 2 s, 90 days)
    are proposals to be set by measurement.

## Review

Focused self-review against the code and the upstream source. Today's
behaviour was checked against `rewind-extension.mjs`, `rewind_linux.go`,
`turnChanges.ts` and `recap_linux.go`; upstream against its README and
source at commit e42fa9c (v0.4.0); the hooks against Pi 1.3.0's extension
types. The store mechanics the design adds (explicit-list snapshot,
tree-to-tree and tree-to-files comparison without a store write, a ref
holding a tree through `gc`) were run on a scratch clone of this repository.
Timings quoted in the proposal come from the earlier design's measurements.
Not verified: OMP's settle hook and event bus, Windows, Git LFS and other
filters, a split index, and whether two extensions always share one
JavaScript realm on both hosts.

Live check: nothing to try on the test server; read `design.md` and answer
its five questions.
