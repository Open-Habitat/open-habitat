# ADR 0036: Conversation search is a derived SQLite FTS5 index in the person's daemon

**Status:** Accepted. **Date:** 2026-11-15. **Decider:** Jari, accepting the
⌘K switcher's prototype rounds 2 and 3 and the index size (about 15 MB for two
months of one active person's history) without objection. This record states
what he accepted and the choices made in implementing it.

## Context

The ⌘K switcher searches the words of every conversation a person has had
with their agents. The words live in Pi's native JSONL histories under
`~/.pi/agent/sessions/`. Two months of one active person's history is about
240 MB on disk, but the person's and the agent's own words are about 6 MB of
it; the rest is tool output and JSON. Parsing every file on every keystroke
costs about 0.4 s now and grows with the history; a raw grep matches tool
output and JSON keys and cannot cut a clean snippet. Habitat's rule is that
native tools keep their own histories and that a new store needs a concrete
need behind it, so an index is an architecture decision.

## Decision

1. **A per-person, derived, rebuildable SQLite FTS5 index owned by the
   person's daemon.** It lives in the person's own state directory
   (`~/.local/state/open-habitat/search.sqlite`, mode 0600, in the 0700
   directory the daemon already verifies). It is never a source of truth:
   it can be deleted at any time and is rebuilt from the JSONL, and a schema
   change or an unreadable file is answered by deleting and rebuilding it.
   It is never in the gateway, never shared, never root. A backup of the
   home includes it, and it is removed with the account like the histories
   it derives from.
2. **What is indexed:** the text of the person's messages and of the agent's
   text answers on the conversation's active branch, with the conversation
   id, the native entry id, the role and the time. Tool output, tool call
   arguments, thinking and injected context are not indexed: tool output is
   five times the text and mostly noise, and a hit in text the conversation
   does not show could not be shown.
3. **Names never wait.** Conversation titles and workspace names are matched
   in the browser against the snapshot it already holds, which carries the
   current display names (generated titles, renames, archive state). The
   index holds only message text, so a name is never stale in it and a name
   match appears before the index has finished building.
4. **Incremental by file offset, size, mtime and inode.** Each indexed
   session records the byte offset of its last complete line, its leaf entry
   and its file identity. A search compares them with a stat of the session
   files the daemon already discovers (at most every few seconds) and parses
   only appended lines. A file that shrank, was replaced, or whose new
   entries leave the indexed branch (Pi's tree, Palaa tähän) is reindexed
   whole. The first build runs in the background newest conversation first,
   one conversation per transaction, so searches are answered from the part
   already indexed and say how far the build is.
5. **Finnish matching.** FTS5's `trigram` tokenizer (substring match, which
   also finds compounds: *tilikartta* for *kartta*), and on the query side a
   light ending strip for words of five letters or more (*kartan*,
   *kartalle* → *kart*), as round 2 measured. Every query word must match.
   Words of two letters, below the trigram length, are matched with a scan
   of the text, which is cheap at this size.
6. **One read-only route through the existing per-user socket.**
   `GET /api/v1/search?q=` is answered by the person's daemon after the same
   peer check as history; the gateway forwards it like a history read. The
   reply carries only what the list shows: the conversation id, its hit
   count, and per hit the entry id, role, time, a snippet and the matched
   terms. Nothing changes in who acts as whom: the gateway learns nothing
   new, and one person's index cannot see another's files because their
   daemon cannot.
7. **The SQLite binding is `modernc.org/sqlite`.** It is SQLite translated to
   pure Go (BSD-3-Clause, with SQLite itself in the public domain), so the
   release keeps building with `CGO_ENABLED=0` for both linux/amd64 and
   linux/arm64, and it ships FTS5 with the trigram tokenizer. `mattn/go-sqlite3`
   needs cgo and a C toolchain per target, which the release build does not
   have. `ncruces/go-sqlite3` is also pure Go but runs SQLite as WebAssembly
   in wazero, which compiles the module in every daemon at start and adds a
   runtime to the daemon's memory. The cost of modernc is binary size (about
   6 MB per architecture) and its transitive modules (`modernc.org/libc` and
   small helpers), all BSD/MIT-style licensed.

## Consequences

- The daemon holds an index between requests, which the history scanner
  deliberately does not. The index is a cache of the person's own words in
  their own home, read only by their own daemon; it adds no authority.
- The jump to a hit reuses the existing history pages: the browser reads
  older pages until the hit's entry is in its window, so the history query
  is unchanged.
- An agent route for search is not added: agents already read history
  through their own listener, and a search command for them waits for a
  need.
