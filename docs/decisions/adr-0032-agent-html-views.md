# ADR 0032: Agent HTML views are offers the person opens on an isolated origin

**Status:** Accepted. **Date:** 2026-10-25. **Decider:** Jari, in three steps
on the `agent-html-artifacts` research and its two prototype rounds (decisions
of 2026-10-25 in that issue). This record states what he accepted, narrowed to
the owner-only first implementation; sharing waits for its own decision.

## Context

On Jari's own machines an agent shows HTML with `tw browser-open` or glasspad,
and prototypes are opened as local files or dev servers. A Habitat agent has
none of these: its only browser is the person's Habitat page, the agent runs
as the person's Unix user on a shared host, and agent-written HTML carries
scripts. Habitat's app and editor sessions are cookies on sibling hosts, so
agent HTML executed anywhere near them is an obvious way to steal a session.

The research (`issues/agent-html-artifacts/research.md`, option C) recommended
that Habitat itself offer the content and show it on an isolated origin,
instead of reusing code-server's port proxy (option A) or adding a separate
publishing service (option B).

## Decision

1. **The agent offers; the person opens.** An agent in the person's account
   offers a workspace HTML file, or a directory with an explicit entry file,
   through its own-UID agent listener (ADR 0027 route, `open-habitat agent`
   CLI). Nothing opens on the agent's initiative: the offer appears as a card,
   in the conversation when the agent names one (a native conversation entry,
   like a notice) and otherwise in an account-level place. The agent is told
   that the offer was published, never that the person saw it.
2. **Every card has two buttons ("Suora", prototype round 2).** *Avaa* opens
   the view in a right-hand panel beside the conversation, whose header
   follows the editor panel's header; *Avaa omalle välilehdelle* opens it in a
   new browser tab with `noopener`. There is no remembered choice, setting or
   separate card type for reports and prototypes: the agent cannot know where
   the person wants to read.
3. **The content runs on an isolated per-view origin, never the app's or the
   editor's.** The gateway serves each view on its own hostname from an
   operator-configured template (for example `https://oh-view-*.example.org`).
   The browser reaches it through a one-time handoff from the signed-in app,
   which yields a view-only session with its own host-only cookie. App and
   editor cookies never reach a view host, and a view session authorizes
   nothing but reading that one view. Agent HTML is treated as an offline
   artifact: sandboxed scripts without same-origin rights, the sandbox also in
   the response CSP so a direct open is equally confined, no network.
4. **The owner daemon decides what bytes are in a view; the gateway decides
   who may read them.** An offer freezes the selected files into an export in
   the owner's home; the gateway reads them through the owner's daemon socket
   on a fixed export-read route that can return only files of that export. No
   other person's daemon, no root helper, no ACL on the home and no new
   database or registry is involved.
5. **Owner only first.** Only the person who owns the account can open its
   views. Sharing with named people on the same server and public links are
   deferred until everything else works, and each needs its own decision
   (research §4 "Publish to named people" and §6 remain the starting point).
6. **Live dev servers are never shared.** A live preview, if built later, is
   owner-only and runs on its own isolated origin; it is not part of this
   first implementation.

Without a configured view origin the feature is not offered and nothing else
changes, as with the editor origin.

## Consequences

- One more wildcard DNS name and certificate coverage per installation that
  wants views (`docs/operations.md`). It must not overlap the app or editor
  hosts.
- An export is a copy, so a view does not change when the agent keeps
  editing; a new version is a new offer. Exports occupy the person's own disk
  space under their quota.
- Content that needs network access, same-origin storage or ES modules from
  other origins does not work in a frozen view. That is the price of the
  offline-artifact policy, said plainly rather than relaxed quietly.
- The agent listener gains one offer operation, not a way to drive the
  person's browser: it cannot open, focus, or learn whether anything was seen.
