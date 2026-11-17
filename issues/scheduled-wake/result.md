# Result: scheduled wake (prototype round 1)

## Saatesanat

Tein kierroksen siitä, miten herätystä odottava keskustelu näkyy
sivupalkissa ja miten se nousee herättyään Sinun vuorosi -osioon.
Keskustelua on mukana sen verran, että kulku näkyy: agentin vastaus, jossa
herätys asetetaan, ja hetki, jolloin agentti herää. Kaikissa suunnissa on
samat keskustelut. Yksi on henkilön pyytämä muistutus torstaiksi, yksi
agentin oma seuranta huomiseksi ja yksi joulukuun herätys. Lisäksi on
aamun herätys, joka myöhästyi, koska palvelin oli poissa käytöstä.
Yläpalkin "Seuraava herätys" siirtää kelloa eteenpäin, joten herätyksiä
voi muuttaa, perua ja katsoa niiden laukeavan.

Suosittelen suuntaa **1 Aika rivillä**. Odottava rivi pysyy Hiljaisissa,
ja rivin lopussa on pieni kello ja herätysaika iän paikalla. Herätystä
muutetaan tai se perutaan keskustelussa, agentin vastauksen alla. Aika on
se, mitä ihminen haluaa tietää, ja se näkyy rivistä suoraan myös
puhelimessa. Herättyään keskustelu nousee Sinun vuorosi -osioon tavallisena
uutena vastauksena. Lukemattomana rivin lopussa näkyy, milloin herätys
tapahtui. Keskustelussa Open Habitat kertoo omalla rivillään, että herätys
tapahtui ja asetettiin silloin ja silloin, tai että se myöhästyi ja miksi.

Isäntäpuolen luonnos on kierroksen `NOTES.md`:ssä, ja se on ehdotus. Se
nojaa siihen, mitä host jo tekee. Broker laittaa tileille lingerin, ja
daemon kirjoittaa jo käyttäjän omia systemd-yksiköitä. Siksi yksi käyttäjän
oma ajastin (`Persistent=true`) herättää daemonin ajallaan, myös
uudelleenkäynnistyksen jälkeen. Pysähtynyt Pi herätetään samalla
operaatiolla kuin nyt, kun ihminen kirjoittaa. Kysymykset alla.

Sivu: `node design-system/prototypes/rounds/2026-11-17-scheduled-wake/build.mjs`
→ `design-system/prototypes/dist/scheduled-wake/offline.html` (and
`index.html` without embedded fonts). The page built for this review is kept
at `/var/tmp/agent-keep/scheduled-wake/offline.html` on the build host, with
the check's screenshots in `screens/`; none of it is committed. Check: 359
checks, clean console, at 1440 and 390 px in Päivä, Yö and Kontrasti, plus
forced colours and English.

## Axis and directions

Axis: where a pending wake shows itself, on the rail and in the
conversation, and so where the person sees, changes and cancels it. What
happens at wake time is the same in all directions: Habitat's line says
what woke the agent, the agent's new message follows, and the conversation
rises to Sinun vuorosi by today's rule for a new reply.

- **Nyt.** Today's product with agent-sets-rail-state: the agent can put
  the conversation in Hiljaiset but cannot wake. It tells the person so.
- **1 Aika rivillä.** The waiting row stays in Hiljaiset; its end slot shows
  a clock and the wake time instead of the age (`to 9.00` within the week,
  `1.12. 10.00` beyond). A woken reply not yet read shows the wake time in
  the turn colour in the same place. In the conversation, a line below the
  agent's reply carries the wake with **Muuta** and **Peru herätys**.
- **2 Herätykset-osio.** A section of its own between Käynnissä and
  Hiljaiset, the scheduled conversations in wake order with their times.
  The pending wake is a bar pinned at the conversation's foot.
- **3 Kello merkissä.** The row looks like any quiet row; the mark's
  resident is replaced by clock hands. The time is only in the row's
  description and in a header control beside the state, whose menu has
  Muuta aikaa… and Peru herätys.

Shown in all directions: several scheduled conversations; one set by the
person and one by the agent itself ("agentin oma seuranta"); a wake that was
late because the server was off (Habitat's line says the planned time, the
actual time and the downtime); a move (Habitat's line: from → to) and a
cancel (Habitat's line), both of which stay in the history; phone 390 px,
light, dark and contrast, Finnish and English.

## Recommendation

**1 Aika rivillä.**

- The fact the person needs, *when*, is on the row in words, without hover,
  on a phone too. Direction 3's clock says only *that* a wake waits; the
  time needs a hover or a visit.
- It adds no section. Direction 2 is the clearest overview with many wakes,
  but a fourth section takes rail height for something that by definition
  needs nothing now, and it puts "the agent's own follow-up tomorrow" above
  Hiljaiset's other conversations in attention order. Hiljaiset is the
  place Jari decided the waiting conversation goes.
- Change and cancel sit where the wake was set, under the reply that set it,
  and the moves and cancels stay there as history. Direction 2's pinned bar
  is easier to find when the reply has scrolled far up; if Jari finds the
  line too easy to lose, the bar is a drop-in for 1.
- On wake, nothing new is needed on the rail: the reply rises as any reply
  does. The only addition is the wake time on the unread row, so a reply
  that was not prompted by the person explains itself before it is opened.

## Decisions for later review

- **The wake time replaces the age on the waiting row** (1). Alternative:
  both. Why: the end slot holds one short value on a 280 px rail; for a
  waiting conversation, when it comes back matters more than when it last
  changed.
- **Habitat, not the agent, writes the wake's lines** (fired, late, moved,
  cancelled). Why: as with the stopped agent's report card, these are host
  facts; the agent may describe them wrongly or not at all.
- **The person's message before the wake does not cancel it.** Alternative:
  any message cancels. Why: "remind me on Thursday" stays true when the
  person adds something today; the agent can cancel with `wake delete` if
  the conversation made the wake moot.
- **A cancel or move is told to the agent with the next message** (cancel)
  or the wake message itself (move), not as a turn of its own. Why: a turn
  just to say "cancelled" costs a model call and wakes the conversation.
- **A cancelled conversation stays in Hiljaiset.** Alternative: rise to
  Sinun vuorosi. Why: cancelling is the person saying "not then"; raising it
  is already one button.
- **No "wake now" action.** Why: writing in the conversation is waking it
  now.
- **Late wakes fire, they are not dropped.** Alternative: skip a wake missed
  by more than N hours. Why: a reminder is still useful late; the line says
  how late and why, and the agent's message can take it into account.
- **The wake command also puts the conversation in Hiljaiset.** Why: the
  17.11. decision allows Hiljaiset when there is a reason, and a pending
  wake is that reason; one command means the agent cannot leave a waiting
  conversation in Sinun vuorosi by forgetting the second.

## Jari's decisions and what is proposal

Jari's decisions (issue and agent-sets-rail-state, 14.–17.11.2026):

- The agent can place its conversation in Sinun vuorosi, Käynnissä or
  Hiljaiset; Hiljaiset only for a reason, such as the person's request.
- No agent-written text on the rail row.
- Scheduled wake: the conversation waits in Hiljaiset and at the set time
  the agent is woken and the conversation rises to Sinun vuorosi; typical
  uses are a reminder the person asked for and the agent's own follow-up.

Proposals in this round (not decided): the three directions and the
recommendation; everything under "Decisions for later review"; the host
sketch in the round's `NOTES.md` (CLI shape, `~/.local/state` store, the
user timer, waking a stopped Pi with Habitat's message, archive handling,
time zones, limits, contract fields).

## Questions for Jari

1. **Which direction?** Recommendation: 1 Aika rivillä, with 2's pinned
   bar as the fallback if the line under the reply is too easy to lose.
2. **Should the person be able to set a wake themselves** (Muuta exists,
   but there is no "Herätä myöhemmin" for a conversation without one)?
   Recommendation: not in the first version. The person asks the agent,
   which keeps one way in and gives the agent a note to wake with.
3. **The timer lives in the person's own systemd user manager** (lingering
   is already enabled by the broker; the daemon already writes user units).
   This changes no authority, but it makes a wake depend on lingering. The
   alternative is a system-level timer that would need root to know about
   each person's wakes, which crosses the Unix-user boundary.
   Recommendation: the user timer, and `host check` names an account
   without lingering as unable to wake.
4. **Archiving a conversation with a pending wake**: cancel it with a
   one-line confirmation (recommended), or keep it and let the wake
   un-archive the conversation?
5. **Limits**: 20 pending per person, 3 per conversation, up to 400 days,
   no recurrence. Recommendation: accept these for the first version;
   recurrence can come when a real use asks for it.
