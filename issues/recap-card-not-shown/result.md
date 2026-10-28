# Result

## Why the card never appeared

Recaps were not being written at all, and nothing said so. From
2026-10-25 04:08 (Birch) and 2026-10-24 16:00 (test server) until 2026-10-27
05:30 UTC, neither server wrote a single `conversation-recap` entry, across
different releases (Birch ran pilot.11 then pilot.12, the test server several
pilot.42x). Both resumed at the same moment on 2026-10-27, so the cause was
the account, not a release.

The extension picks the model with the lowest declared price. pi-claude-bridge
declares every Claude model free, so the pick was the first bridge model,
`claude-fable-5-1`. In those days the account's Fable usage was spent: Claude
Code transcripts on Birch show Fable calls answered with "You're out of usage
credits" from 2026-10-25 to 2026-10-26, and Fable use resumes on 2026-10-27
around 05:00 UTC. Each recap call therefore ended with an error, the extension
returned silently, the daemon recorded nothing, and the card is shown only
when a recap exists, so the person saw no card at all. The Oct 27 gaps without
a recap on the test server are explained by typing (the presence hold) and
daemon restarts.

A probe with the same choice and call on Birch today answers in about 3 s with
Fable and in about 2 s with gpt-6-luna, so the call path itself is sound.

## What changed

- The extension tries the cheapest-priced model and then the conversation's
  own model, within a 20 s budget (the daemon abandons the Pi channel at 25 s).
  `maxTokens` went from 160 to 512: a Finnish recap and next step in JSON can
  approach 200 tokens, and `length` was another silent failure.
- Every attempt reports an outcome. The extension sends it as a Pi `notify`
  with a fixed prefix; the daemon's RPC reader takes it out of the live stream
  before the prompt's response arrives. The daemon logs `conversation_recap`
  (done, or failed with reason, model and the provider's message) to its
  journal, keeps the newest failure on the conversation and serves it in the
  status as `recap_failure`, and the manual request answers
  `{"state":"failed","reason":...}`.
- The card appears when the newest attempt for the latest message failed,
  even when no recap was ever written, with the reason and a retry button; it
  can be dismissed. The manual request shows the reason too. `oh agent recap
  create` names the reason in its error.

## Decisions for later review

- **Fallback to the conversation's model.** Alternatives: try every available
  model in price order; prefer a small model by name. Chosen because the
  conversation's model is the one shown to work right now and the change
  keeps the existing first choice. Which model recaps should use at all is
  filed as `recap-model-spends-fable` (each recap still tries Fable first).
- **One automatic attempt per message stays.** A failure is now visible with a
  retry, so a retry loop that could spend quota repeatedly was not added.
- **The provider's error text goes only to the journal**, not the browser; the
  card shows a fixed Finnish reason.
- **The failure lives in memory with the controlled conversation**, like the
  existing once-per-message marker, not in a store or in Pi's history; a
  daemon restart forgets it and the next attempt reports again.

## Evidence

Birch `~/.pi/agent/sessions` and the test server's `maintainer` sessions
(read only, via the pinned root route after the egress repair timer added
Alder's new address 198.51.100.224/32), both daemon journals, and Claude Code
transcripts under `~/.claude/projects` on Birch.
