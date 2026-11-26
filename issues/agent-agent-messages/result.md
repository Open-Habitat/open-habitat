# Agent-to-agent messages: implemented behind `agent-agent-messages`

The design Jari decided on 24–26.11.2026 (issue `agent-agent-message`, rounds
1–4, direction B Hiljainen) is in the product. The browser blocks sit behind
the experimental feature `agent-agent-messages` (Agenttien viestit
keskustelujen välillä), off by default. The daemon's sender marking applies
to every message on the agent route whatever the switch says.

- **Daemon.** `internal/agentblock` builds and parses the leading
  `<agent-message from=… title=… workspace=… message=…>` block, its head line
  ("…sends this. It is not the person's own words.") and an optional
  `<quote>`. Every message admitted through
  `/agent/v1/conversations/<id>/send|steer|follow_up` gets it
  (`sendAgentMessage` → `admitMessage(…, agent)`). The sender comes from the
  CLI's launch context, checked with the same `staleLaunch` proof as
  `--current`; without a context it is "an agent outside the person's
  conversations". A stale context is refused (`current_context_stale`), not
  downgraded. `--quote` is resolved on the sender's own current branch (a
  received block or a sent tool result) and refused otherwise
  (`quote_not_found`). Both refusals come after the repeat check, as
  reply-to's do. The browser route refuses `from` and `quote`, and the agent
  route refuses `reply_to` and `first_choice`. An agent message never joins
  another held message. The reply is the typed `agent_message_sent`
  (`contracts/v1/agent-message-sent.schema.json`), which the CLI prints.
- **History.** A received block becomes `agent_message`, with the block
  stripped from the content and the first text block, and from block reads,
  titles, search and the held view. A bash tool result that printed the typed
  result becomes `sent_agent_message`; history recognises it from the
  result, never from the command line. The live `history.entry` event carries
  both. A participant's read of a shared conversation keeps only the message
  id and the quote's excerpt. It drops the title, workspace and ids, the sent
  entry's tool output and that output in live tool frames.
- **Queue and held.** A waiting agent message reads "{name}: {text}" in the
  composer's queue. It is not drawn as the person's waiting message while Pi
  starts for it, and neither cancelling held messages nor clearing the queue
  puts it in the person's field.
- **CLI.** `message create` takes `--quote <message_id>` and sends the launch
  context as `from`.
- **Browser.** `components/AgentMessage.tsx` draws the incoming letter in the
  person's message geometry and its mirror in place of the tool row (a new
  `message` step in `AgentTurn`, which closes a stage like a reply). Each
  shows an icon, the other conversation's name (from the rail, else the
  block's title) as a link to the same message there (`?message=<id>`, read
  by `useMessageLink`), the time after the name (`MessageTime`, with
  `conversation-times`) and the message. The one-line quote appears only when
  the agent quoted, ends in "…" and jumps to the original through the
  reply-to jump (`jumpToMessage`). It is hidden when the quoted message is
  directly above. A participant sees "Omistajan toinen keskustelu" without a
  link. The reply-to sent quote already ends in "…": its excerpt has " …"
  and the two-line clamp adds an ellipsis.
- **Agent guide.** `host-context.md` has a section on messaging the person's
  other conversations: how to find and send, `send`/`follow-up`/`steer`, what
  a received block means, `--quote`, no acknowledgement-only messages, and
  that the block makes "I sent …" unnecessary. `SKILL.md` documents the
  block, `--quote`, the typed result and the refusals.

## Verification

Every run used `umask 077` and a leased, disposable TMPDIR:

- Go: `internal/daemon`, `internal/cli`, `internal/agentblock`,
  `internal/searchindex`, `internal/experimental`, `internal/contracts` and
  `test/browser-host`, in the focused script's environment (pinned Python,
  Pi SDK fixture). The new tests:
  - `agentblock_test.go`: round trip, outside sender, refusal of ordinary
    text, quoted text cannot end the block, title cleaning, excerpt "…".
  - `agent_message_linux_test.go`:
    - field refusals on both routes;
    - a stale launch;
    - an unknown quote and a quote sent from outside;
    - a send from outside;
    - a send from the live launch quoting a received message, and one quoting
      the sender's own sent message, with the exact text Pi received checked
      in both;
    - a repeat after the launch ended;
    - the typed reply validated against the schema;
    - the history projection on both sides, validated against
      history.schema.json;
    - the participant's redaction in history, live entry and tool frames;
    - typed-result recognition and its negatives;
    - the queue text, the held view, the held never-join rule and a cleared
      queue.
  - `agent_conversations_linux_test.go` (CLI): the launch context, `--quote`
    and their validation.
- `./scripts/test-focused.sh --area contracts`: valid. The fixtures cover
  `agent-message-sent.json` and history-page entries, and the new negative
  checks reject a free-text sender, a bad id, an empty excerpt, a bad
  delivery or state, empty text, missing fields and an external
  `message_url`.
- `./scripts/test-focused.sh --area web`: 266 files, 2250 tests passed.
- Browser: `agent-messages.spec.ts` (new), `reply-to-message`,
  `switcher-search`, `conversation-times`, `settings-experimental`,
  `settings-search`, `turn-work-row` and `browser-conversation`: 112 passed.
  The new spec covers:
  - Two synthetic conversations that exchanged six messages, at 1440 and
    390: both sides as blocks, never as the person's bubble or a tool row,
    with no block text visible. It checks the accessible names, the link
    target, and the quote's single line, its "…" and its accessible name. It
    checks that the quote is hidden under the message it quotes, axe on the
    feed, that a quote jumps to its original, and that the name opens the
    other conversation at the same message with the id dropped from the
    route.
  - The switch off: the sender is still named, with no link, quote or sent
    block.
  - A live queued target at 1440 and 390: a follow-up through the daemon's
    agent route (fixture `/fixture/agent-message`, the production
    `sendAgentMessage`) to a busy fake Pi waits in the queue as
    "{name}: {text}". After the turn it arrives as a letter linking back.
- UI references regenerated; `scripts/test-ui-reference.py` passes.
- Screenshots (synthetic host) outside the repository:
  `/var/tmp/agent-keep/agent-agent-messages/` (`report-*`, `charts-*` and
  `queue-*`, at 1440 and 390).
- Review: `/llm-review` used gpt-6-astra as finder and claude-fable-5-2 as
  verifier. It produced five findings, and `/assess-findings` made all five
  FIX; all are fixed with tests. They were: the participant's live tool
  frames carried the other title and URL; with the switch off, an agent's
  message was the person's bubble; a held agent message was the person's
  waiting message and returned to their field on cancel; an incoming letter
  over 16 KiB was cut silently; and the stale and quote refusals came before
  the repeat check. In the final check, the same field-return problem was
  found in clearing the queue and fixed.

## Live check

Not done on a real installation: the change is unreleased. On a test server
after release, with the feature on:

1. Ask one conversation to tell another something, and check both blocks and
   the link.
2. Have the other reply with `--quote`.
3. Message a busy conversation and check the queue line.
4. Message a stopped one, which starts.
5. Turn the switch off and check that the letter still names its sender.
6. In a shared conversation, check what a participant sees.

The KOKEILTAVAA line has the same steps.

## Decisions for later review

- The incoming letter shows even with the switch off, because another
  agent's words are never drawn as the person's. The switch governs the link,
  the quote and the sent message's block. With the switch off, the sent
  message stays a tool row.
- A held agent message is not shown as the person's waiting message, and
  cancelling held messages or clearing the queue never puts it in the
  person's field. Pi does not get it then, and the sending agent learns this
  from its receipt.
- An agent message to a conversation whose Pi is starting for another held
  message is refused (`control_uncertain`), and so is the person's message
  after a held agent message. Held messages reach Pi joined as one prompt,
  and the block names the sender of everything after it.
- The queue line's name comes from the daemon (the block's title, or
  "open-habitat agent" for an outside sender), because queue items are
  strings in the contract.
- The CLI's typed result echoes the text, so history can draw the sent
  message. A message long enough that Pi's bash tool truncates its output (in
  practice over about 45 KB) stays a tool row. The sent fact keeps at most
  16000 bytes. An incoming letter over 16 KiB ends in "…", and its full text
  is not readable in the letter (no read-more yet).
- A participant still sees the sender's `agent message create` command line
  with the target id in the tool row's arguments; only its result is
  withheld.
- A turn started by a participant's message cannot send, because it is
  `text_only`. No separate check was added.
