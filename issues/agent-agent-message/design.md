# Agentin viesti toiselle keskustelulle: suunnitelma

## Tiivistelmä (Jarille)

Viestin voi lähettää jo nyt: agentti ajaa `open-habitat agent message create
--conversation pi:UUID`, ja teksti menee toisen keskustelun Pi:lle. Ongelma on se,
miltä viesti näyttää. Vastaanottava Pi saa sen tavallisena käyttäjän viestinä,
ja selain piirtää sen sinun kuplaksesi. Kumpikaan ei tiedä, että viestin kirjoitti
toinen agentti. Lähettävän keskustelun puolella näkyy vain bash-rivi, jossa on
UUID. Vastaus ei palaa mitenkään.

Ehdotan pientä muutosta, joka käyttää olemassa olevia polkuja:

1. **Merkintä tekstissä.** Kun viesti tulee agentin CLI-reitiltä, daemon lisää
   sen alkuun `<agent-message from="pi:…" title="…">`-lohkon. Se on rakennettu
   samalla tavalla kuin vastausviittauksen `<reply-to>`. Lähettäjän daemon
   tarkistaa käynnistystunnisteesta. Historia poistaa lohkon näkymästä ja antaa
   selaimelle tyypitetyn tiedon `agent_message`, joten selain piirtää saapuvan
   viestin omana korttinaan eikä koskaan sinun kuplanasi. Pi lukee lohkon
   suoraan ja tietää, että viesti tuli toisesta keskustelustasi eikä ole sinun
   sanojasi.
2. **Viestit kulkevat kumpaankin suuntaan tasavertaisina** (Jari 24.11.2026,
   kierros 2). Kahden agentin välillä ei ole pyyntö- ja vastausprotokollaa.
   Kaaviot voi lähettää viestin takaisin samalla komennolla, kun sitä
   pyydettiin kertomaan tai kun sillä on kerrottavaa, ja viestejä voi tulla
   useita. Viesti takaisin on viesti, ei "vastaus viestiin X", joten
   kumpikaan puoli ei odota vastausta eikä yhdistä viestiä pyyntöön.
   Viestillä on tunniste (lähettävän komennon `command_id`), jotta lainaus
   ja linkki toiseen keskusteluun osuvat samaan viestiin. Viesti voi
   lainata aiempaa viestiä (`--quote`), ja daemon lisää lainauksen otteen
   lohkoon samalla tavalla kuin vastausviittauksessa.
3. **Ei rajaa agenttien välille** (Jari 25.11.2026). Agentit saavat
   vaihtaa viestejä vapaasti, eikä host laske, pidätä tai hylkää viestejä
   niiden määrän perusteella. Osallistujan viestin aloittama vuoro ei
   kuitenkaan lähetä ollenkaan, koska osallistujan vuoro on `text_only`.
4. **Varattu, pysähtynyt ja arkistoitu kohde käyttäytyvät kuten nyt.** Varattu
   kohde saa viestin jonoon (`follow-up`), ja `steer` keskeyttää vain, jos niin
   pyysit. Pysähtynyt selainkeskustelu käynnistyy viestistä. Arkistoitu ja
   päätteessä aloitettu keskustelu kieltäytyvät, ja agentti kertoo syyn eikä
   palauta keskustelua itse.

Uutta ovat lohko ja sen jäsennys (`internal/agentblock`, sama malli kuin
`internal/replyblock`) lainauksineen, historiamerkinnän ja jonorivin kenttä
`agent_message`, lähetetyn viestin kenttä `sent_agent_message`, CLI-tuloksen
`message_id` ja `conversation_url`, `message create --quote`, saapuvan ja
lähtevän viestin esitys ja kappale agentin ohjeeseen. Uutta palvelua,
rekisteriä tai viestijonoa ei tule.

Kierros 1 suositteli saapuvalle viestille A Kirjettä, ja Jari hyväksyi sen.
Kierroksella 2 Jari valitsi **A Kirjeet**: jokainen viesti on siinä
kohdassa, jossa se lähti tai tuli, ja tuleva näyttää sinun viestiltäsi
toisen agentin nimellä. Kierroksella 3 Jari valitsi lähtevälle viestille
**A Peilin**: lähtevä viesti on aina oma kuplansa, tulevan kirjeen
peilikuva agentin puolella. Kierros 4 karsii viestilohkojen sanat;
suositus on **B Hiljainen**: kuvake, keskustelun nimi linkkinä, aika ja
viesti, ja lainaus yhtenä rivinä vain, kun agentti lainasi (osio 2,
"Message block copy", ja [result.md](result.md)).

Kierroksen 3 ehdottama karkaamisvahti ja kierroksen 2 hyppyraja jäävät
pois, joten host ei tarvitse niitä varten mitään: ei lohkon laskuria
(`count`, aiemmin `hop`), ei pidätystä daemonin muistiin eikä sen
`agent_message_hold`-tietoa snapshotissa, ei selaimen komentoja `release`
ja `discard` (*Jatka*, *Älä lähetä*), ei CLI-tuloksen tilaa
`held_for_person`, ei virhekoodeja `agent_message_held` ja
`agent_message_chain`, ei lopputuloksen Habitat-riviä eikä
`agent_message.released`-kenttää. Daemonin ei siis tarvitse lukea
lähettäjän vuoron aloittanutta merkintää laskua varten; se tarkistaa
lähettäjän käynnistyksen vain merkintää varten ja estää lähetyksen
osallistujan vuorosta.

---

## 1. Host facts (code as of 24.11.2026)

Read from the code. The lab was not started for this round; tests are named
where they pin the behaviour.

**The path.** `open-habitat agent message create --conversation pi:UUID
--delivery send|steer|follow-up --text-file FILE --idempotency-key UUID`
(`internal/cli/agent_conversations_linux.go`) posts `{message, command_id}` to
the personal agent socket at `/agent/v1/conversations/<id>/send|steer|follow_up`.
The daemon (`internal/daemon/agent_conversations_linux.go`, `sendKind`) calls
the same `admitMessage` as the browser, with one difference: `idleStarts` is
false. A browser steer that finds Pi idle becomes a send, but an agent's
explicit steer or follow-up to an idle Pi is refused with `409
control_uncertain` (`agent_conversations_linux_test.go`). The CLI does not
send any sender identity. The request carries no `OPEN_HABITAT_CONVERSATION_ID`
or launch generation, although the CLI reads both for `--current` elsewhere
(`internal/cli/agent_linux.go`).

**In Pi and its history.** `finishPrompt` writes the text with Pi's own RPC
`prompt`, `steer` or `follow_up`, exactly as the browser does. The native entry
is a plain `user` message. Nothing in it says an agent wrote it.

**In the target's browser.** The entry is drawn as `UserMessage`, the person's
own bubble. In a shared conversation it is the owner's input. A follow-up or
steer waits in Pi's queue, and the composer's queue shows the raw text.

**Receipts.** The reply is `{command_id, state: pending}` (`held` for a held
send). `receipt show --command UUID` later says whether Pi took the message. It
does not say whether the turn is done. A spent command ID is observed and never
replayed.

**Busy, stopped, archived.**
- Busy (`accepted`): `send` is refused (`409 control_uncertain`). `follow-up`
  queues behind the current direction, and `steer` interrupts it.
- Idle: `send` starts a turn. `steer` and `follow-up` are refused.
- Stopped or resting, started in the browser: `send` is held, and the daemon
  starts Pi for it (`holdLocked`). The receipt is `held`, then accepted.
- Waiting behind a participant's message or release: the send queues behind it
  (`holdBehindGuestLocked`).
- Archived: refused (`409 control_uncertain`).
- Started in a terminal, or an unknown ID: `409 read_only_history`.

**Discovery.** `conversation list` returns the rail: `agent_id`,
`workspace_id`, `title` and `lifecycle` (`live`, `resting`, `archived`). Titles
are not unique. `conversation show` gives status, queue and pending question.
The agent guide (`internal/cli/agent/SKILL.md`, "The person's other
conversations") says the agent can read and steer them. It says nothing about
attribution, replies or limits.

**Multiplayer marks origin differently** (ADR 0038, `process-extension.mjs`,
`shared_facts_linux.go`). A participant's message is not a user prompt. The
companion writes it as a custom message `oh-participant-message` whose content
opens with a line Habitat builds (`[Open Habitat] "Name", a participant in the
owner's conversation, writes (message ID).`) and a rule line, followed by the
participant's words. The `details` carry `message_id`, `subject`,
`display_name` and `role`. The daemon projects it to a typed history fact, and
the browser draws `ParticipantMessage` with the person's avatar, name and role.
A participant's turn runs `text_only` (every tool call blocked). Habitat lines
(`oh-conversation-line`) are drawn as `ConversationLine`. These messages are
never steered into a running turn (`busy`).

**Reply-to marks origin inside the text** (`internal/replyblock`). The daemon
prepends `<reply-to entry="…">\nexcerpt\n</reply-to>\n\n` to the person's text.
The block travels in the native text, so a terminal, the Claude bridge, a held
prompt and a compacted context all read the same reference. History and search
parse it back off and give the view a typed quote. `sanitize` removes the
closing tag so that quoted text cannot end the block early.

**The boundary.** The agent socket is the person's own daemon (SO_PEERCRED,
same UID). It cannot reach a conversation owned by another Unix user, which
includes another person's shared conversation the person has joined. This is
the security model working as intended, and nothing here should change it.

## 2. Design

### Discovery and naming the target

The agent learns about the capability from one new paragraph in the agent guide
(section 8). The person names the target the way the rail does, by its title or
workspace ("the one about the customer meeting"). The agent resolves the name with `conversation
list`, preferring a `live` or `resting` row in the named workspace. When more
than one row fits, or none does, it asks and names the candidates by title and
workspace. Spatial words ("the one on the right") refer to the person's
windows, which the host cannot see, so the agent asks about those too. It never
guesses.

Round 1 adds no conversation picker to the composer. An `@` mention that picks
a conversation is listed under "Decisions for later review".

### Attribution in the receiving conversation

Every message admitted through the agent route carries a daemon-built block at
the start of its text:

```
<agent-message from="pi:3f6c…" title="Kvartaaliraportti" workspace="ws_…" message="<command_id>">
Habitat: the agent of the person's conversation "Kvartaaliraportti" sends this. It is not the person's own words. </agent-message>

<the agent's text>
```

- **Sender.** The CLI sends `from: {agent_id, workspace_id, generation}` from
  the launch environment when there is one. The daemon accepts it only if it
  matches the live launch, which is the same proof `--current` uses. Without a
  launch context (a terminal agent, a script), the block says `from="outside"`
  and the head line says "an agent outside a Habitat conversation". The agent
  route therefore never produces a plain user message. The marker records
  attribution. It is not a security boundary: any process running as the same
  Unix user could write the native file directly.
- **Why a text block and not a custom message.** It reuses every existing path:
  held sends that start Pi, follow-up and steer through Pi's own queue,
  compaction, terminals and the Claude bridge. A custom message
  (`oh-participant-message`) can only be sent to a live, idle Pi through the
  companion, so busy and stopped targets would need a second hold path. The
  `reply-to` precedent shows that a parsed text block is enough.
- **The view.** History parses the block (`agentblock.Parse`, with the same
  sanitizing as `replyblock`) into a typed fact
  `agent_message: {from_agent_id | null, title, workspace_id, message_id, quote?}` and
  strips it from the text. The browser draws an incoming letter, never
  `UserMessage`: the person's message geometry with the sending
  conversation's name, an agent icon and a link (round 2). The title and link come from the current rail row when the
  sender still exists. The block's title is the fallback when the sender was
  deleted.
- **The queue.** A follow-up waiting in Pi's queue is shown with its sender, so
  queue entries gain the same fact. This is a contract change: queue items
  become objects, or a parallel array.

### Authority

The person's instruction is the only source of authority. An agent message
carries that instruction one step and no further.

- The receiving turn keeps its tools, unlike a participant's `text_only` turn.
  The same Unix user's agent could have done the work itself, so blocking tools
  would protect nothing. The head line and the guide still tell the receiving
  agent that the words are not the person's. If a request goes beyond what the
  person has asked in this conversation and would be hard to undo, or would
  publish something, the agent asks the person here first.
- **No limit between agents** (Jari 25.11.2026). Agents may exchange
  messages freely; the host does not count, hold or refuse agent messages
  by how many have passed. Round 2's hop limit and round 3's proposed
  runaway guard were both dropped, so the block has no count and there is
  no hold, owner release command or outcome line. A turn started by a
  participant's message still cannot send, because it is `text_only`.
- `steer` interrupts the person's own direction in the other conversation, so
  the guide reserves it for when the person asked for an interruption.
  Otherwise the agent uses `send` when the target is idle and `follow-up` when
  it is busy.

### Messages back, several messages and quotes (round 2)

There is no request/answer correlation. Nothing in the host or the view
needs one: a message back is admitted, marked and shown exactly like the
first message, and neither side waits for it or records that one message
"answers" another. Round 1's "Vastattu" state and its returning reply
excerpt are dropped.

- **Who sends back.** The receiving agent sends a message back with the
  same `message create` when the message asked it to report back, or when
  it has something the sending conversation needs (round 2's story: the
  chart is done, then September is missing from the data). It may send
  several from one turn. Otherwise the result stays in its own
  conversation, as before.
- **Arriving mid-turn.** A message back to a busy conversation is always
  `follow-up`: it waits in Pi's queue with its sender named and starts
  when the current direction ends. It never steers into the person's own
  direction unless the person asked for that in the sending conversation.
- **Message id.** Each message's id is its sending command's
  `command_id`, which the block already carries as `message=` and which
  the sender's tool result returns. Both histories therefore hold it: the
  receiver in its `agent_message` fact, the sender in its
  `sent_agent_message` fact. The id is used for two things only: a quote,
  and a link that opens the other conversation at the same message.
- **The sender's side.** Today the sent message is a bash tool row.
  The CLI's result becomes a typed object (`kind: "agent_message_sent"`,
  `message_id`, `to`, `title`, `conversation_url`, `delivery`, `state`,
  `text`, `quote`); the text is echoed because it arrives on stdin and is
  not in the command line. History recognises a tool call by that result,
  not by parsing the command, and projects it as
  `sent_agent_message`, which the view draws instead of the tool row. The
  state shown is the one the result reported (`pending` behind a busy
  target); the view never follows the other conversation to update it.
  Whether the block shows that state at all is round 4's question
  (below).
- **Where the sent message shows (round 3, Jari 25.11.2026: A Mirror).**
  The sent message is always its own block where it was sent, in place
  of the tool row: the incoming letter mirrored on the agent's side. The
  CLI result also returns `message_url` (`conversation_url` with
  `&message=<id>`), so the agent can link the message when it mentions
  it; the block itself carries the same link.
- **Quote: what the host needs.** `message create --quote <message_id>`.
  The daemon finds that id in the *sender's own* history (an
  `agent_message` it received or a `sent_agent_message` it sent), takes
  the first sentence up to 160 characters, as the reply-to excerpt does,
  and writes it inside the block:
  `<quote message="<id>" from="pi:…">excerpt</quote>`, sanitized like
  `replyblock`. The receiving Pi reads the excerpt in its own text, so a
  terminal, compaction and the Claude bridge see it too. History parses
  it into `agent_message.quote {message_id, from_agent_id, excerpt}`, and
  `sent_agent_message.quote` carries the same. The view looks the id up
  in the same conversation, where both sides hold the original, and
  pressing the quote shows it; when it is no longer loaded or was set
  aside, the excerpt still reads and the jump says so, as reply-to does.
  An id the sender's history does not contain is refused
  (`400 quote_not_found`), so an agent cannot attribute words to a
  message that never passed through its conversation.
- **Opening the other conversation at the message.** The link is
  `conversation_url` with the message id
  (`/workspaces/ws_…?conversation=pi:…&message=<id>`). The target view
  resolves the id to its own entry through its own history (the
  `agent_message` or `sent_agent_message` fact with that id); the sender
  never learns the other side's entry keys.
- **Reading back without a message.** When the person asked to "ask the
  other one and tell me" and the other agent is not expected to message
  back, the sender may still read `conversation show` and `history list`
  as round 1 described. With messages back this is rarely needed.

### Message block copy (round 4, recommended B Quiet; Jari's decision pending)

Each block says only who it is from or to, with the link, and the message.
Every visible word besides the conversation's name, the time and the
message is listed here; anything else in round 3's blocks is dropped.

| Piece | fi | en |
|---|---|---|
| incoming header | agent icon, sender's name as link, time | same |
| outgoing header | send icon (`arrowUp`), recipient's name as link, time | same |
| time | right after the name, as the times prototype decided | same |
| quote, only when the agent used `--quote` | reply icon and the excerpt on one line | same |
| incoming accessible name | Viesti keskustelusta {nimi} | Message from {name} |
| outgoing accessible name | Viesti keskusteluun {nimi} | Message to {name} |
| quote accessible name | Lainaus: {kuka} klo {aika}. Siirry viestiin. | Quote: {who} at {time}. Go to the message. |
| queued follow-up in the composer | {nimi}: {teksti} | {name}: {text} |

No delivery state is shown: the agent says in its reply when a message
queued, and the receiver's composer queue names the sender while it
waits. Direction C would add one word when the result was not
"delivered": *Meni jonoon* / *Queued* for `pending` behind a busy target
(title: "{nimi} oli kesken, joten viesti odotti sen vuoron loppuun." /
"{name} was busy, so the message waited for its turn to end.") and
*Käynnisti keskustelun* / *Started the conversation* for `held` behind a
stopped one. In a shared conversation a participant sees the incoming
header as "Omistajan toinen keskustelu" / "The owner's other
conversation", without a link.

### Busy, stopped, archived, terminal targets

These keep today's behaviour. The guide tells the agent what each outcome
means for the person:

| Target | Delivery | What the sender says |
|---|---|---|
| idle | `send` starts a turn | "Lähetin… linkki" |
| busy | `follow-up` queues; `steer` only on request | "Se on kesken; viesti odottaa jonossa" |
| stopped, browser-started | `send` is held, Pi starts | "Keskustelu käynnistyy viestistä" |
| archived | refused | "Keskustelu on arkistoitu; palautetaanko?" It does not restore on its own. |
| terminal-started | refused | "Se on päätteessä aloitettu, en voi kirjoittaa siihen" |
| pending question | refused while the question waits | "Se odottaa sinulta vastausta kysymykseen" |

### Multiplayer

- Conversations owned by someone else stay unreachable. Messaging another
  person's agent is a different feature with a different authority model, and
  nobody has asked for it.
- In the person's own shared conversation, an agent message is owner input
  (tools mode). It queues behind waiting participant requests as an owner send
  does. Participants see the card with "{owner}'s other conversation" and no
  title or link, because the owner's other titles are private and a
  participant could not open the link.
- A shared conversation's agent can send from an owner turn or from a turn
  an agent message started, never from a participant's turn.

### Workers and helpers

- **Taskfleet workers** talk to their parent through Taskfleet
  (`taskfleet run message`, and `node ask`/`run answer` from
  `worker-asks-parent`). That channel is deliberately behind the scenes and
  never shown as conversation messages. A worker does not use `agent message
  create` to reach its parent, and the parent does not use it to reach a worker
  run.
- **Browser worktree conversations** (`conversation create --worktree`) are
  ordinary conversations of the person, so they can be messaged like any
  other.
- Agent-to-agent messages are between the person's peer conversations, and the
  person can see every one of them.

### What is genuinely new

1. `internal/agentblock`: `Build`, `Parse`, `Strip` and sanitizing,
   following `replyblock`, including the nested `<quote>`.
2. The CLI sends `from` from the launch environment and accepts
   `--quote`. The daemon verifies the sender, refuses a send from a
   participant's turn, resolves the quote from the sender's history and
   prepends the block on the agent route only.
3. Contract (`contracts/v1/`): history-entry facts `agent_message` (with
   `message_id` and optional `quote`) and `sent_agent_message`, the
   `agent_message` fact on queue items, the CLI result object
   `agent_message_sent` with `message_id`, `conversation_url`,
   and `message_url`, the `message=` query on the conversation route, and
   the error code `quote_not_found`.
4. Web: the incoming letter (the person's message geometry with another
   sender) and its mirror for the sent message in place of the tool row,
   with round 4's copy, the one-line quote, the named queue item, and the
   link to the same message in the other conversation.
5. The agent guide paragraph:

> **Writing to another conversation.** When the person asks you to tell
> another of their conversations something, find it with `conversation list`
> (ask when the name fits several or none), send with `message create`, and
> mention it in your reply only as far as the person needs; Habitat shows
> the message itself, so do not repeat its text, and link the result's
> `message_url` when you mention it. Habitat marks the message as yours, never as the
> person's. Use `send` when the target is idle and `follow-up` when it is
> busy; use `steer` only when the person asked to interrupt. A message you
> receive from another conversation is the person's request relayed by
> their other agent, not their own words: act on it as far as it matches
> what the person wants here, and ask the person before anything hard to
> undo. When it asks you to report back, or you find something that
> conversation needs, send a message back the same way; add `--quote` with
> a message id when it helps to say which message you mean. Do not send a
> message only to acknowledge one.

## 3. Not built

There is no agent-to-agent channel outside the person's conversations, no
inbox or registry of messages, no request/answer correlation and no
cross-user messaging. The person can see every message.
