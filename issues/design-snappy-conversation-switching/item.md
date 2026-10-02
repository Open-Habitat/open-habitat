---
created: 2026-10-02
updated: 2026-10-02
type: task
reporter: jari
status: done
priority: high
related: ['@incremental-history-during-turn']
lane: client-history
lane_seq: 10
closed: 2026-10-02
---

# Design snappy conversation switching from a browser-held event stream

## Jari's request (2026-10-02, verbatim intent)

The target is an extremely tight user experience. Switching between
conversations (tabs) should make no server round trips. As discussed earlier,
the server streams the messages/events of *all* of the person's conversations
to the browser, which sorts them into the ones it needs and ignores the rest.
The browser keeps a history of all those conversations, but lightly.

Snappy means: a conversation that was just looked at appears *snap* when
clicked. Occasionally something takes time, but those are *individual
events*. Legitimate spinners:

- scrolling far back in time in a conversation, while older history is
  fetched from the server;
- opening a conversation not looked at for, say, two days.

Think through properly what happens and where: on page load, on tab switch,
during a running turn, on reconnect/gap, on scroll-back, for a cold
conversation, on identity change, across tabs/devices of the same Unix user.
Decide what is removed from the current model (per-conversation status +
history fetch on every open, per-conversation EventSource, remount keyed on
conversation id).

## Agreed design

[ADR 0008](../../docs/adr-0008-snappy-conversation-switching.md) records the
revised direction agreed with Jari on 2026-10-02: one event connection per tab,
bounded in-memory views of opened conversations, and newest-first native
history reads for cold opens and recovery. Recent switching waits for no
network response; reloads, evicted content and deep scrolling may load.

Start with generous, adjustable retention limits. The performance goal is
significantly faster conversation switching. The daemon keeps
command authority and Pi keeps history. Operator session revocation remains
as implemented; @reliable-session-revocation is closed as unnecessary for the
current scope.

## Evidence and implementation

The [result](result.md) summarizes the decision and links the original panel,
measurements and simulation. Those establish the repeated history requests
and model possible resource use; they do not demonstrate the new behavior.

Implementation belongs to @one-browser-event-stream,
@tail-first-history-paging and @recent-conversation-windows.
@browser-logout-cleanup owns stopping listeners and clearing user-specific
browser state when the session ends.

## Acceptance Criteria

- [x] Alternatives, simulation assumptions and the limits of measured evidence are recorded in the issue attachments.
- [x] Jari has agreed to the revised direction recorded in ADR 0008.
- [x] Follow-up issues describe the implementation outcomes and responsibilities.

## Decisions

### 2026-10-02T03:16:51Z · @jari

Hyväksytty keskustelussa 2026-10-02: rajatut selainmuistinäkymät, yksi tapahtumayhteys välilehteä kohti ja uusimmasta päästä luettava historia. Viisi keskustelua, 50 merkintää, 4 MiB ja 16 ms eivät ole sitovia vaatimuksia. Istuntojen peruuttamista ei laajenneta. Jarin jatkokuittaus: ”ok. Jatketaan näillä”.

### 2026-10-02T05:00:05Z · @jari

Täsmennys 2.10.2026: ”Riittää, että on rajat, joita voidaan tarvittaessa muuttaa. Laitetaan ne ehkä mielelluumin ensin liian isoiksi kuin liian pieniksi.” Nopeustavoitteeksi riittää ”merkittävästi nopeampi”. Uloskirjautuminen pysäyttää streamien kuuntelun ja poistaa käyttäjän selainrakenteet; tälle oma issue @browser-logout-cleanup. Samat muutokset koskevat toteutusissueita.

## Resolution

### 2026-10-02T03:17:43Z · @issuectl

Jari hyväksyi rethink-kierroksella tarkennetun suunnan. ADR ja toteutusissueiden tavoitteet päivitetty; tuotetoteutus jää kolmeen erilliseen issueen.
