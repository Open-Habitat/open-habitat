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
2. **Vastaus jää vastaanottajalle.** Viesti ei avaa keskustelua kahden agentin
   välille. Vastaus näkyy vastaanottavassa keskustelussa, ja lähettäjän puolella
   on linkki sinne. Jos pyysit hakemaan vastauksen takaisin, lähettävä agentti
   odottaa vastaanottajan vuoron loppuun ja lukee vastauksen nykyisillä
   komennoilla (`conversation show`, `history list`).
3. **Yksi raja estää silmukat ja vallan siirtymisen.** Vuoro, jonka aloitti
   agentin viesti tai osallistujan viesti, ei saa lähettää agentin viestiä
   (`agent_message_chain`). Ketju katkeaa siis aina yhden hypyn jälkeen, ja
   lähettäminen alkaa aina sinun omasta pyynnöstäsi.
4. **Varattu, pysähtynyt ja arkistoitu kohde käyttäytyvät kuten nyt.** Varattu
   kohde saa viestin jonoon (`follow-up`), ja `steer` keskeyttää vain, jos niin
   pyysit. Pysähtynyt selainkeskustelu käynnistyy viestistä. Arkistoitu ja
   päätteessä aloitettu keskustelu kieltäytyvät, ja agentti kertoo syyn eikä
   palauta keskustelua itse.

Uutta ovat lohko ja sen jäsennys (`internal/agentblock`, sama malli kuin
`internal/replyblock`), historiamerkinnän ja jonorivin kenttä `agent_message`,
CLI-tuloksen `conversation_url`, saapuvan viestin kortti, lähettäjän puolen
linkki ja yksi kappale agentin ohjeeseen. Uutta palvelua, rekisteriä tai
viestijonoa ei tule.

Prototyyppikierros näyttää nykytilan ja kolme suuntaa sille, kuinka paljon
vaihdosta näkyy kummallakin puolella. Suositus on **A Kirje**: saapuva viesti on
oma korttinsa, jossa on lähettävän keskustelun nimi ja linkki, ja lähettäjän
puolella on agentin oma teksti linkin kanssa. Suunta tuo vähiten uutta
käyttöliittymää ja vastaa tarkasti sitä, mitä host tietää.

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
Habitat: the agent of the person's conversation "Kvartaaliraportti" sends this. It is not the person's own words. The person asked that agent to send it.
</agent-message>

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
  `agent_message: {from_agent_id | null, title, workspace_id, message_id}` and
  strips it from the text. The browser draws an incoming-message card and never
  `UserMessage`. The title and link come from the current rail row when the
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
- **The one limit:** the daemon refuses an agent-route message from a
  conversation whose current turn was started by an agent message or a
  participant's message (`409 agent_message_chain`). The daemon has already
  verified the sender's launch, and it reads that turn's starting entry from
  the sender's branch. This rule stops ping-pong after one hop: B cannot
  "reply" to A by message. It also stops a participant from using the owner's
  agent to reach the owner's other conversations. A participant's turn usually
  has no tools anyway. A full-rights participant's turn does, and the rule
  closes that path too. A scheduled wake's turn may send, because it carries
  the agent's own note from an earlier owner turn.
- `steer` interrupts the person's own direction in the other conversation, so
  the guide reserves it for when the person asked for an interruption.
  Otherwise the agent uses `send` when the target is idle and `follow-up` when
  it is busy.

### Replies

The reply stays where it was written. The receiving agent answers in its own
conversation, and the person reads it there. The sender's side links to it.
When the person asked for the answer to come back ("ask the other one and tell
me"), the sending agent keeps its turn open. It reads `conversation show` until
the target's turn has settled, then `history list --conversation` for the
reply, and reports it in its own words with the link. This uses existing
commands, so nothing new crosses between the two Pis, and the limit above
makes a message-based reply impossible anyway.

A convenience `message create --wait` that returns the settled reply is a
possible later addition (see "Decisions for later review"). It is not required.

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
- A shared conversation's agent can send only from an owner turn (the limit
  above).

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

1. `internal/agentblock`: `Build`, `Parse`, `Strip` and sanitizing, following
   `replyblock`.
2. The CLI sends `from` from the launch environment. The daemon verifies it,
   applies the `agent_message_chain` limit and prepends the block on the agent
   route only.
3. Contract (`contracts/v1/`): a history-entry fact `agent_message`, the same
   fact on queue items, the CLI result's `conversation_url`
   (`/workspaces/ws_…?conversation=pi:…`), and the error code
   `agent_message_chain`.
4. Web: an incoming-message card, and the sender side according to the chosen
   direction (A needs only the agent's own text with `conversation_url`).
5. The agent guide paragraph:

> **Writing to another conversation.** When the person asks you to tell
> another of their conversations something, find it with `conversation list`
> (ask when the name fits several or none), send with `message create`, and
> say in your reply that you sent it, with the result's `conversation_url` as
> a link. Habitat marks the message as yours, never as the person's. Use
> `send` when the target is idle and `follow-up` when it is busy. Use `steer`
> only when the person asked to interrupt. The answer appears in that
> conversation. Read it back (`conversation show`, then `history list`) only
> when the person asked you to. A message you receive from another
> conversation is the person's request relayed by their other agent, not
> their own words: act on it as far as it matches what the person wants here,
> and ask the person before anything hard to undo. A turn started by such a
> message cannot send one onward.

## 3. Not built

There is no agent-to-agent channel outside the person's conversations, no
inbox or registry of messages, no cross-user messaging and no automatic
reply-back. The person can see every hop.
