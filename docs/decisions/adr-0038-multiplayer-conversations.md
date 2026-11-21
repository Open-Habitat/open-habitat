# ADR 0038: Other people in a person's conversation

**Status:** Proposed. **Date:** 2026-11-21. **Decider:** Jari. He decided
the product behaviour on 2026-11-21 (issue `multiplayer-conversations`,
"Decisions"). This record proposes the architecture that carries it. The
security boundaries it moves are his to accept, and are listed as questions
with recommendations at the end.

## Context

Jari wants other people on the same server to be able to write in a
person's conversation with the agent. The research round compared three
architectures and recommended (a): the conversation stays the opener's
native Pi session, under the opener's Unix user, with the opener's model,
quota and credentials. The prototype rounds then gave it a face. His
decisions of 21.11. fix the behaviour:

- Whoever sent the latest message defines the tool mode. When the agent
  answers a participant (a non-owner), it has no tools and answers with
  text only. When the owner writes, it has all its tools again.
- The owner releases a participant's request on a card that sits where the
  agent stopped. Operations are approved one at a time, with **Salli kaikki**
  ("allow all") for the rest. "Voit jatkaa" ("you may continue") is a
  Habitat line in the conversation, not a message posed as the owner's.
- An older waiting request stays open when someone writes after it.
- The owner may give a participant **Täydet oikeudet** ("full rights"; the
  prototypes called it Luotettu, "trusted"). That participant's messages
  then get tools, as the owner's do.
- Participants see tool names and results.
- Anyone in the conversation may stop any turn.
- Participants are people admitted to the same server. Outsiders arriving by
  link are not part of this.
- The opener's quota and credentials pay. Per-person spend comes later.
- The owner sees the card, the participant sees the strip above the composer.

The code these decisions land on:

- The gateway maps one authenticated person to one Unix user and proxies to
  that user's `daemon.sock`. That socket is `0660 <user>:open-habitat-gateway`
  (`systemd/open-habitat-daemon@.socket`). The daemon accepts a request only
  when the kernel peer UID is the gateway's (`transport.Server.TrustedPeer`)
  and treats every such request as its owner's.
- The daemon already has a second listener with a narrower principal: the
  own-UID `agent.sock`, with its own default-deny route table
  (`transport.ServeAgent`, ADR 0027). The view addresses
  (`internal/gateway/view_links_linux.go`) are the one place where the gateway
  reads a daemon for someone who is not its owner. They allow one fixed route
  and check everything on every read.
- A conversation is a native Pi session run by the daemon over Pi's RPC mode
  (`pi_rpc_linux.go`). The daemon loads its own extensions into every Pi
  (`recap_linux.go`), among them the companion `process-extension.mjs`. The
  companion talks to the daemon over a private bridge socket that is fenced by
  peer PID (`process_bridge_linux.go`). Daemon-originated turns already go
  through it as `pi.sendMessage(..., { triggerTurn: true })` (ops `wake` and
  `scheduled_wake`), and so do daemon-written native entries (op `notice` →
  `pi.appendEntry`).
- Pi 1.5.2's extension API (`dist/core/extensions/types.d.ts`) has
  `tool_call` handlers that can `block` a call. They fire for nested calls too
  (`parentToolCallId`, "for example a codemode script"). It also has
  `before_agent_start`, which says whether a run was started by a user
  message or by a custom message; an `input` event that marks steering and
  follow-ups; `ctx.ui.select`/`confirm`; and `setActiveTools`, which changes
  only what is declared to the model. `codemode` and `deferred` tools stay
  callable whatever the active set is.
- Pi questions reach the browser as `extension_ui_request` frames
  (`pi_events_linux.go`) and are answered through `POST
  /api/v1/conversations/<id>/question` (`answerQuestion`). The daemon keeps
  one open question per conversation.
- The event journal (`events_linux.go`) is one per daemon. It carries every
  conversation's and every workspace's events, and a browser follows it
  through `GET /api/v1/events`. The gateway ties each live relay to the
  browser session that opened it (`gateway/live.go`).
- A Pi user message has no author field.

## Decision

### 1. One conversation, one owner, one Pi

The conversation stays the owner's native Pi session in the owner's
workspace. Nothing is copied to a participant's home, and the participant's
daemon is not involved. Everyone's turns run in the owner's Pi, with the
owner's model, quota, credentials and integrations. The owner alone chooses
the model and thinking level, compacts, rewinds, names, archives and deletes.

### 2. The gateway admits a participant to the owner's guest socket

**A new socket.** Each person gets a third socket,
`/run/open-habitat/users/<name>/guest.sock`, mode `0660
<name>:open-habitat-gateway`. It is a new socket unit
`open-habitat-guest@.socket` (`FileDescriptorName=guest`) whose service is
the same daemon. The broker restores and stops it together with the other two
sockets, from the committed binding, exactly as it does for `agent.sock`.

**Its own route table.** The daemon serves the guest socket from a separate,
default-deny route table, as it serves the agent listener. A request is
accepted only when the peer is the gateway's UID. The table holds only the
participant operations of section 6, all under `/guest/v1/conversations/<id>/`.
It has no workspace, file, editor, terminal, view, attachment, integration,
onboarding, search, snapshot, settings or membership routes, apart from accepting one's own invitation. A bug in the
guest path can therefore reach no more than those routes.

**Identity.** The gateway builds every guest request itself. It names the
participant in one header, `Open-Habitat-Participant`: the authenticated
session's provider subject (`github:<numeric id>`) and the display name and
avatar the gateway already shows for that person. It never sends a Unix
username, UID or home path. On the guest socket, and only there, the daemon
takes this header as the statement of which person is speaking. It does not
take it as permission. Whether that subject may read or write this
conversation, and in what role, the daemon decides alone from its own
membership record (section 7). On `daemon.sock` the header carries no
meaning and is refused.

**Routing.** Every participant route goes through the gateway as
`/api/v1/shared/<share_id>/...`, using the app origin's session, cookie and
CSRF rules. `share_id` is an opaque random ID from the gateway's
participation index (section 7). The gateway looks it up, checks that the
index entry's participant is the session's subject and that both people are
admitted, then dials the owner's `guest.sock` and rewrites the request to the
fixed guest path. The URL never chooses a Unix user. An unknown, removed or
foreign `share_id` gets the same answer as a missing one.

### 3. Participant messages enter Pi through the companion, not as user messages

The owner's message stays what it is today: a Pi user message sent over RPC.

A participant's message never goes to Pi as a user message. The daemon gives
it to the companion over the bridge as a new op, `participant_message`. The
op carries the daemon's own message ID, the subject, display name and role
from the membership record, and the text. The companion writes it with
`pi.sendMessage({ customType: "oh-participant-message", display: true,
content, details }, { triggerTurn: true })`. `content` opens with a line that
the companion builds from the record ("Ville (osallistuja) kirjoittaa:"),
followed by the participant's text. `details` holds the subject, name, role
and message ID.

This settles attribution in native history without a second store. The
author lives in the native entry, written by the daemon's own code from the
daemon's own record, so the browser, history reads and the terminal all
read the same fact. The participant's text cannot claim a role, because
roles never come from text. A custom message also does not go through Pi's
input expansion, so a participant cannot run slash commands, prompt
templates or skill invocations.

For now participants send text only. Attachments live in the owner's home
and would need their own decision.

### 4. Text-only turns are enforced by the companion's `tool_call` hook

The companion keeps one mode per Pi process: `tools`, `text_only` or
`approve_each`. It decides the mode at each run's start, in
`before_agent_start`, from the message that started the run:

- The owner's input gives `tools`. That is a user message whose `input` event
  had `source: "rpc"` (the daemon's prompt from the owner's browser) or
  `"interactive"`. The role alone is not enough: an extension's
  `pi.sendUserMessage()` also starts a run with `messageType: "user"`, and its
  `input` event has `source: "extension"`. Such a run keeps the mode it had,
  like the other extension-started runs below.
- `oh-participant-message` with role `participant` gives `text_only`.
  With role `full_rights` it gives `tools`.
- `oh-conversation-line` of kind `continue` (section 5) gives the mode named
  in the line: `tools` for Salli kaikki, `approve_each` for per-operation
  approval.
- Any other run started by the daemon or an extension keeps the mode it
  had: a wake, a scheduled wake, or a process notification. A process that
  the owner's earlier turn started and that ends after a participant spoke
  therefore wakes the agent text-only. The owner releases it as usual.

During a run, the owner's steering or follow-up input (the `input` event
with `source: "rpc"` or `"interactive"`) switches the mode to `tools` from
the next tool call on, because the owner is now the latest writer.

**A new Pi starts from history, not from `tools`.** A wake or a scheduled
wake often starts a fresh Pi (`wake_linux.go`, `scheduled_wake_linux.go`),
and a restart loses the process's state. So in `session_start`, and again
after a branch switch, the companion rebuilds the mode from the current
branch's structured entries. The latest owner input, participant message or
`continue` line decides, exactly as above. A participant message there
always gives `text_only`, even if its author had Täydet oikeudet, because
the role may have changed since. If the companion cannot read the branch,
it starts in `text_only`. Compaction summaries are not used for this.

**Taking rights away during a run.** Each `full_rights` grant carries the
membership record's generation. When the owner takes away Täydet oikeudet
or removes a participant, the daemon tells the companion over the bridge
before it answers the owner. If the current run was started by that
participant, the companion switches it to `text_only` from the next tool
call on. Held messages are checked against the current record when they
are delivered, not when they were sent. A call that has already started
finishes; nothing undoes it.

The enforcement is the companion's `tool_call` handler. In `text_only` it
returns `{ block: true, terminate: true, reason }` for every call, nested
calls included. Blocking at the hook is what makes the rule hold. Leaving
tools undeclared would not, because `codemode` and `deferred` tools stay
callable.

The hook sees only tools that Pi itself dispatches. Some operations bypass
it. The web-search extension (`runtime/core/web-search.mjs`) adds the
provider's own search tool to the request in `before_provider_request`, and
the provider runs it. The Claude bridge gives Claude Code its built-in
`WebSearch` and `WebFetch` (`scripts/core-runtime-build.py`), which run
inside the bridge's query. In `text_only` and `approve_each` the companion
therefore turns these off for the run: the web-search extension adds no
tool, and the bridge's query gets no built-in tools. An `approve_each` run
gets no unasked fetches either. Every tool the bridge serves from Pi must
reach Pi's `tool_call` before it runs, and a test proves that against the
pinned bridge. Any later extension that executes something outside Pi's
tool dispatch must say how it honours the mode before it ships. The tool set declared to the model stays unchanged. Instead, the
companion's opening line in a participant's message tells the model that it
has no tools on this turn and should say what it would do. Changing the
declared set every time the writer changes would discard the provider's
prompt cache twice for each participant message, on the owner's quota, and
would add no protection.

The companion refuses `participant_message` while a run is in progress. So
the daemon holds a participant's message until Pi is idle and never steers
it into a running turn, whoever started that turn. Switching a turn the owner
started to text-only halfway would cut off the owner's own work. Held
participant messages are delivered in order, one run per message (one
participant's consecutive held messages are joined). They are never joined
with the owner's held text, because the two have different modes.

**The limit, stated plainly.** This rule decides who can make the agent
*start* tool use. It is not a boundary between Unix users. The participant's
text stays in the context of later owner turns, where it can still steer
what the agent does with tools. Processes and scripts that earlier turns
started keep running. The host context tells the agent that a participant's
words are information and not instructions for the owner's turns, but that is
model behaviour and not enforcement. **Täydet oikeudet** hands over the
owner's Unix user through the agent, and the product says so.

### 5. The owner's release: the card, Salli kaikki and per-operation approval

A participant's text-only turn that ends ends as a **waiting request**. The
daemon derives the state from native history: a participant message whose
text-only reply has no settling line after it. The owner's card has two
actions:

- **Salli kaikki** (the decided "Voit jatkaa") makes the companion write an
  `oh-conversation-line` custom message, `display: true`, kind `continue`,
  mode `tools`, which names the request it releases, and start the run with
  it ("Aino antoi agentin jatkaa Villen pyyntöä."). The agent reads the line in
  its own context, the browser shows it as a Habitat line, and nobody is
  quoted as saying something they did not write.
- **Hyväksy yksitellen** ("approve one at a time") writes the same line
  with mode `approve_each`. In that run the companion's `tool_call` handler
  asks before each call through Habitat's existing question path:
  `ctx.ui.select` with the options Salli, Älä salli and Salli kaikki. The
  question's short text is not what the owner approves, because the daemon
  shortens long prompts to 250 characters (`pi_events_linux.go`). Before
  asking, the companion gives the daemon the call's ID, tool name and
  complete arguments over the bridge. The daemon attaches them to the
  question as an owner-only approval detail, and an answer counts only for
  the call it was shown with. A multi-line command is shown in full. Salli lets that one call run. Älä salli blocks it,
  with a reason the agent sees. Salli kaikki lets this call and the rest of
  the run go through without asking. The companion asks one question at a
  time, even when Pi runs a batch of calls in parallel, because the daemon
  keeps one open question per conversation. The card's rows are these
  questions and their answers as they come. Each answer is also recorded
  as a native entry, so the card can be read back from history.
- **Älä salli** on the whole request writes a `continue` line of kind
  `declined` and starts no run.

Only the owner answers any Pi question in a shared conversation, the
approval questions included. A participant sees them as states on the strip.

The owner's own message settles the newest waiting request: the agent
answers the owner with tools. Older waiting requests stay open on their
cards until the owner releases or declines them. Releasing an older request
writes its `continue` line at the end of the conversation, so the agent is
told which request it now continues.

Giving someone Täydet oikeudet takes effect from their next message. It does
not release what is already waiting.

### 6. What a participant can do and see

The guest route table holds:

- **Read the conversation.** History blocks of this one conversation, as the
  owner's history read gives them, with tool names and results, thinking,
  participant messages and Habitat lines. Owner-only controls and the owner's
  queue texts are left out. The workspace is shown only by its display name,
  never as a link, path or file tree. View cards (ADR 0032) appear with no
  open action, because views are the owner's.
- **Follow the conversation live.** A filtered stream (section 8).
- **Send a message** (`send`). The daemon holds it as section 4 describes.
- **Join** an invitation (section 7). This is the one route an `invited`
  subject may use. Every other route needs `joined`.
- **Cancel their own held message.**
- **Stop the running turn** (`abort`). Anyone may stop any turn. A stop
  also cancels an open approval question. Stopping the Pi process
  (`stop`) and every other control stay with the owner.
- **Presence**: being present, typing, leaving.

Nothing else is there. A participant cannot run the owner's `!` shell
command, use `/compact` or rewind, answer questions, choose a model, rename,
archive, invite, change roles, or reach any other conversation of the owner.

### 7. Invitations, membership and revocation

**The membership record** belongs to the owner's daemon. It is a file in
the owner's state directory (`0600`) holding, per conversation, each
participant's subject, display name, role (`participant` or `full_rights`)
and state (`invited`, `joined`). It is the authority every guest request is
checked against. It is a file and not native history because access control
must not depend on which branch of the conversation is checked out, and must
be writable while Pi is not running. Each change is also recorded as a
Habitat line in the conversation (joined, Täydet oikeudet given or removed,
removed), written through the companion. If Pi is not running, the line
waits in the record until the next launch.

**The participation index** belongs to the gateway, next to
`view-links.json`. It holds metadata only: `share_id`, the owner's subject,
the conversation ID, the participant's subject, and the invite state. It is
what lets the gateway route a participant without asking every daemon, and
list **Jaettu kanssasi** ("shared with you") in the participant's rail. It
holds no message, title beyond what the invite shows, or role. A guest
request passes only when the index *and* the owner's record both admit it.
So a drift between the two closes access and never opens it.

**Inviting.** The owner's own session asks the gateway. The gateway checks
that the invitee is an admitted person with a binding, asks the owner's
daemon over `daemon.sock` to add them to the record, and on success writes
the index entry. The invite picker lists admitted, bound people on the
server by display name and avatar. It is the first time one person can see
who else has an account here (question 5).

**Joining.** The participant sees the invite under Jaettu kanssasi, with the
owner's name, the conversation's title and the sentence about whose agent,
model, quota and connections these are. Nothing of the conversation shows
before joining. Liity ("join") goes through the guest socket and marks the
record `joined`. Ei nyt ("not now") leaves the invite in place.

**Taking away Täydet oikeudet** leaves the person a participant. The daemon
changes the role in the record and revokes the running grant (section 4).
The share, the index entry and the person's open streams stay.

**Removing.** The owner removes a participant in their own session. The
daemon changes the record first, so the next guest request is refused. In
the same step it ends that participant's open guest streams itself,
serialised with stream admission. Today's journal stream checks its
authorization only when it opens (`events_linux.go`), so a stream already
open would otherwise go on delivering. Then the gateway deletes the index
entry and cancels that participant's live relays for this share. Live relays
are already tied to their browser session (`gateway/live.go`); they are now
also tied to the share, and a new relay checks the share under the same lock
as that cancellation. If the gateway's step fails after the daemon's has
succeeded, the daemon's refusal and stream cancellation already hold. Archiving or deleting the conversation ends every membership in
it. What a participant's messages already made the agent do is not undone.

**Withdrawal and removal of a person.** Withdrawing either person deletes
their index entries, as owner and as participant, as it deletes view
addresses. When the owner is withdrawn, their daemon and all three sockets
stop, and participants see "unavailable". A participant who is withdrawn and
later admitted again has no index entry, so an old record in someone's
daemon gives them nothing.

### 8. Live stream to several browsers

The owner's browsers keep `GET /api/v1/events` as today. A participant's
browser opens `GET /guest/v1/conversations/<id>/events` through the gateway.
The daemon serves it from the same journal, through an allowlist: only
events of this conversation's agent (`pi:<id>`), and only the kinds the
participant may see (message stream, tool rows, turn mode, waiting requests
and their answers, participant and presence changes, run state). Any kind
not on the list is dropped, so a new journal kind is private until someone
puts it there. The cursor is the journal's own. The gaps a participant sees
in it say only that something else happened in the owner's daemon.

The daemon reports the facts the views need, and the browser never infers
them: each run's mode and who started it, each message's author and role,
each waiting request with its approval questions and answers, and who is
present. Presence lives only in the owner's daemon's memory and is lost on
restart. The gateway's existing live-relay limits apply per participant
session.

### 9. Quota and credentials

The owner's Pi pays for every turn and holds every credential, as the
research recommended (option A). No credential crosses a Unix user, and no
proxy or pool appears. Pi's per-message `usage` in native history already
lets per-person spend be shown later (deferred by Jari).

### 10. What is not built

Outsiders by link, room accounts (research option b), a relay room (option
c), per-person spend limits, participant attachments, participants answering
questions, and search-index entries for participant messages. The ADR 0036
index stays the person's and the agent's text. Each of these needs its own
decision.

## Consequences

- The daemon gains a third listener and a membership record. The companion
  gains the turn-mode state, the `participant_message` op, the `continue` and
  membership lines, and the approval questions. The gateway gains the
  participation index, `/api/v1/shared/` routing and share-bound relays. The
  broker gains one more socket unit to restore and stop. `contracts/v1/`
  gains the membership, share, participant message, turn mode and
  waiting-request schemas, and generated code follows.
- In native history, a shared conversation contains `oh-participant-message`
  and `oh-conversation-line` entries. A plain Pi terminal shows them as
  custom messages; Habitat renders them with authors.
- Changes to the companion's `tool_call` handler are now security-relevant.
  The handler must block whatever other extensions' handlers return. That
  is tested against the pinned Pi, including nested codemode calls and
  parallel batches. So is anything a new extension or provider runs outside
  Pi's tool dispatch, such as provider-side search.
- The rule holds only for the daemon's Pi, which loads the companion. A Pi
  the owner starts in a terminal loads no Habitat extension (`recap_linux.go`).
  Participants cannot write there, but a terminal turn the owner starts on a
  shared conversation has full tools, as any owner turn does.
- A participant can spend the owner's quota with text-only turns until the
  owner removes them. That is accepted until per-person spend exists.

Rejected alternatives:

- **Participant messages as Pi user messages with a text prefix.** The
  author would be text that anyone can type, the mode would have to be set
  over the bridge in a separate step racing the prompt, and slash-command
  expansion would apply to a participant's text.
- **Declaring no tools (`setActiveTools([])`) as the enforcement.** It does
  not stop `codemode` or `deferred` calls, and it discards the prompt cache
  on every change of writer. The `tool_call` block is required in any case,
  and is sufficient.
- **A proposal tool that records intended operations in the text-only turn,
  then a continuation limited to them** (the prototypes' notes). It needs a
  tool on a turn that is supposed to have none, a store or matching of
  proposals against later calls, and a new approval channel. The existing
  question path asks about the real call with its real arguments at the
  moment it would run. What the card loses is the list of steps before the
  first one is asked about. The text-only answer already says in words what
  the agent intends.
- **Steering a participant's message into a running turn as text-only.** It
  would take tools away from a turn the owner started.
- **The daemon trusting the gateway's statement of role or membership.** The
  gateway would then decide who directs a person's agent, and a gateway bug
  would grant it. The gateway names the person; the owner's daemon decides.
- **Only a gateway index, or only the daemon record.** A gateway-only store
  moves the authority to the gateway. A daemon-only record cannot route or
  list without the gateway querying every daemon.
- **Membership as native history entries only.** Branch switching and
  rewind would bring back removed members, and changes would need Pi
  running.
- **Routing through the participant's own daemon.** The participant's daemon
  cannot reach the owner's, and should not.

## Questions for Jari (security and authority)

1. **Cross-user routing and a stated identity.** May the gateway route an
   authenticated person to another person's daemon for live interaction, and
   may that daemon take the gateway's statement of *which person* speaks, on
   a separate guest socket only, never as permission? *Recommendation: yes,
   as in section 2.* The gateway already reaches every `daemon.sock`, so a
   gateway bug could act as the owner today. The guest socket's own route
   table keeps a guest-path bug from reaching the owner's full API.
2. **A text-only turn is a guard, not a boundary.** Do you accept that a
   participant's text can steer the owner's later turns through the context,
   and that earlier processes keep running? *Recommendation: accept, with
   the host-context framing and the product's own words about it.* Making it
   a boundary needs a room account (research option b).
3. **Täydet oikeudet means the owner's Unix user.** Should the confirmation
   name what is lent concretely (files, GitHub, mail, own machines), with an
   immediate take-back? *Recommendation: yes. Do not add a softer middle
   level, because no such boundary exists inside one Pi.*
4. **A new gateway store.** May the gateway keep the participation index
   (metadata only, like `view-links.json`)? *Recommendation: yes. It is the
   only way to route and list without querying every daemon, and access needs
   both it and the owner's record.*
5. **A directory of people.** The invite picker shows every admitted, bound
   person's display name and avatar to every other one. *Recommendation:
   accept for same-server people. An administrator switch can hide it later if
   a site needs that.*
6. **Thinking.** You decided that participants see tool names and results.
   Should they also see the agent's thinking? *Recommendation: yes. It reveals
   nothing that tool results do not, and hiding it makes the participant's view
   of the turn incomplete.*
7. **Wakes after a participant.** Should daemon-originated turns (wakes,
   process notifications) after a participant's message stay text-only?
   *Recommendation: yes, as in section 4. The alternative lets a participant's
   request start tool use by waiting for a process to end.*
8. **The broker restores a third socket.** *Recommendation: yes. It is the
   same mechanism as the agent socket, chosen by the committed binding and not
   by a request.*
