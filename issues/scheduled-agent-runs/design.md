# Design: scheduled agent runs

A proposal for Jari to review with prototype round 1
(`design-system/prototypes/rounds/2026-11-28-ajastetut-ajot-1/`). Nothing here
is decided until he agrees. The one part that touches architecture, where a
schedule is stored, is listed under its own heading so it can be decided
separately.

## Lyhyesti

Ajastus on henkilön oma, toistuva tehtävä: työtila, ohje, malli, toistuvuus
ja aikavyöhyke. Jokainen ajo on **uusi keskustelu**, joka alkaa ohjeella ja
nousee valmistuttuaan Sinun vuorosi -osioon kuten mikä tahansa vastaus.
Ajastuksen tekee henkilö selaimessa; agentti voi vain *ehdottaa* ajastusta
kortilla, jonka henkilö hyväksyy, joten Vaarallisiin toimintoihin ei tarvita
kytkintä. Ajastukset ovat sivupalkin paikoissa omana sivunaan
(*Ajastukset*, kuten Tuotokset), ja työtilan sivu näyttää saman listan
rajattuna siihen työtilaan. Tauko, muokkaus, poisto ja ajohistoria ovat
ajastuksen omalla sivulla. Palvelimen ollessa alhaalla väliin jääneistä
ajoista tehdään yksi myöhästynyt ajo, ei kasaa. Säilytyspaikka (systemd-
käyttäjäajastin vai daemonin oma tiedosto) on arkkitehtuuripäätös, jonka
suositus on alla.

## Who creates a schedule

**The person, in the browser.** Creating a schedule is the per-act consent
the risky-features research asks for: the person reads the prompt, the
workspace and the cadence and presses *Luo ajastus*. No Vaaralliset toiminnot
switch is needed for that path.

**The agent, on request, only as a proposal.** "Check the README every Monday"
said in a conversation makes the agent run
`open-habitat agent schedule propose --current …`. That writes nothing
lasting: it puts a card in the conversation with the prompt, workspace,
model and cadence filled in, and *Luo ajastus* / *Muokkaa…* / *Ei*. The
schedule exists only after the person presses. This keeps the research's
principle (nothing but the person's own considered act opens a standing
route) without a switch, and a prompt-injected agent can at most show a card.

Alternative: the agent creates schedules directly, as it creates wakes,
behind a *Vaaralliset toiminnot* member "Agentti saa luoda toistuvia ajoja".
Rejected for now: a recurring run is a standing route that acts with nobody
watching, which is exactly what that section exists to fence, and the card
costs the person one press.

## What a schedule is

| Field | Notes |
| --- | --- |
| Name | Short, shown in the rail and the list; the agent proposes one. |
| Workspace | One of the person's workspaces; the run's `cwd`. |
| Prompt | The first message of each run, up to the message limit. |
| Model | The person's default or a named model; shown, never hidden. |
| Cadence | Daily, weekdays, weekly on chosen days, monthly on a day; one time of day. No free cron in the UI (the native form below can hold more). |
| Time zone | The person's browser zone at creation, shown and editable, so "Monday 6.00" stays 6.00 across daylight saving. |
| Notify | *Aina* (default) or *Vain jos agentti kysyy tai ajo epäonnistuu*. |
| State | Active or paused. |
| Next run | Derived from cadence, zone and state; never stored by hand. |

## What one run is

**Recommended: a new conversation each time.** Each run starts a fresh Pi
session in the workspace whose first message is the prompt, with Habitat's
line above it ("Open Habitat aloitti ajastetun ajon *README-tarkistus*
ma 30.11. klo 6.00"). Reasons:

- The result is one reviewable unit: it lands in Sinun vuorosi, can be read,
  answered, archived, like any reply.
- Context and cost stay bounded; a weekly job does not drag months of
  earlier runs and compactions into each turn.
- One run failing (quota, Pi crash) does not poison the next.
- Run history is simply the list of those conversations, native Pi sessions
  tagged with the schedule's id, so there is no second history store.

The conversation's title is the schedule's name plus the date
("README-tarkistus · ma 30.11."). A run that needs continuity reads its
previous run itself: the prompt may say "compare with last week's run", and
the agent sees the previous conversation through the same tools it uses for
any conversation.

Alternative: one standing conversation woken on each tick (a recurring wake).
Better for "keep following this thread", but context grows without bound, the
rail row never settles, and one bad turn affects every later one. If wanted,
it is a recurring form of `scheduled-wake`, not of this feature.

## Where schedules are listed and managed

**Recommended: a place of its own in the rail, *Ajastukset*,** beside
Tuotokset, with a page that lists every schedule (name, workspace, cadence,
next run or state, last run's result) and one schedule's page beside it on
desktop, as Tuotokset does. The place shows a count only when something
needs the person (a failed or missed run); otherwise it is quiet. The
workspace page shows the same list filtered to that workspace with
*Uusi ajastus…*, because a schedule is created most naturally from where the
work lives.

Alternatives, in the prototype as direction B: **only on the workspace
page**, no rail place. Fewer places at the top, but there is no single view
of everything that will run on the person's behalf, which is the view they
need to trust the feature. **Settings**: rejected, schedules are work, not
preferences; Settings carries only the administrator's site limits.

### One schedule's page

Head: name, state, *Aja nyt*, *Keskeytä* / *Jatka*, ⋯ (*Muokkaa…*,
*Poista…*). Facts: workspace, model, cadence in words, time zone, next run,
created by and when (and "agentin ehdottama" when it came from a card).
Prompt in full. Run history: newest first, each row the date, a result
state (*Valmis*, *Kysyy sinulta*, *Epäonnistui*, *Ohitettu*, *Käynnissä*) and
a link to its conversation; ohitettu rows have no conversation and say why.

- **Pause** keeps the schedule and its history; next run shows *Keskeytetty*.
- **Edit** applies from the next run; a running run is not touched.
- **Delete** asks once, removes the schedule, leaves past run conversations
  in place (they are ordinary conversations) and says so.

## Runs in the rail and notifications

A run follows the rail's existing sections, nothing new:

- While it works it is in **Käynnissä**, its row marked with the clock icon
  and "Ajastettu ajo".
- When it finishes it rises to **Sinun vuorosi** with notify *Aina*; with
  *Vain jos…* it goes to **Hiljaiset** unless the agent asked a question or
  the run failed.
- A failed run (Pi did not start, quota exhausted, the workspace is gone) is
  a Sinun vuorosi row with the failure state, so the person learns of it the
  way they learn of everything else; the Ajastukset place shows the count.

No extra notice channel: the rail sections, the attention sound and the
phone's existing notifications already are Habitat's way to say "look".

## Failures and missed runs

- **Server or daemon down** at the due time: when it comes back, a schedule
  that missed one or more times makes **one** catch-up run, marked
  *myöhässä* with the time it should have run; the others are recorded as
  *Ohitettu (palvelin ei ollut käynnissä)*. Catching up only within 24 hours;
  older misses are just recorded.
- **A run still going** when the next is due: the next is skipped
  (*Ohitettu: edellinen ajo kesken*), never stacked.
- **Model quota or credentials**: the run's conversation shows Pi's own
  error; the history row is *Epäonnistui* with that reason; no automatic
  retry (retrying spends what has just run out). After three failures in a
  row the schedule pauses itself and says so on its page and in the rail row.
- **Workspace removed or archived**: the run fails with that reason and the
  schedule pauses.

## Cost and limits

- Each run spends the person's own model quota or key, like any turn; the
  schedule page says the model so the person sees what it costs.
- Per person: at most 20 active schedules and no cadence more frequent than
  hourly (the UI offers daily as the finest by default).
- The administrator has a site setting: scheduled runs on/off and the
  per-person maximum; runs that start at the same minute are spread over a
  few minutes so a household's Monday-6.00 jobs do not start at once.

## Relation to wakes and Taskfleet workers

- **Wake** (`scheduled-wake`): one-shot, the agent's own, inside one existing
  conversation. **Schedule**: recurring, the person's, a new conversation
  each time. They share the host's timing machinery (one user timer for the
  next due item, catch-up on daemon start, late marking), not their records
  or UI.
- **Taskfleet workers** are launched by an agent inside a conversation and
  shown in its background strip. A scheduled run is an ordinary conversation
  and may launch workers like any other; the schedule knows nothing about
  them.

## Where the schedule lives (architecture, for decision)

Recommended: **one systemd user timer and service per schedule**, written by
the daemon into the person's own user manager
(`open-habitat-schedule-<id>.timer` with `OnCalendar=`, the zone and
`Persistent=true`; the service runs `open-habitat agent schedule run <id>`,
which only asks the person's own daemon to start the run). The prompt and
the name sit beside it in a file the unit names. The units *are* the record:
the daemon lists schedules by reading them, the person sees them with
`systemctl --user list-timers` over SSH, and pausing is disabling the timer.
This follows "reuse native components, no second registry", and missed-run
detection comes from systemd's own `Persistent=`. No authority moves: the
daemon already writes the person's user units for wakes.

Alternative: a `schedules.json` beside `wakes.json` and the one shared wake
timer. Simpler to validate and edit atomically, but a Habitat-only store that
SSH users cannot see or stop natively.

## What survives an upgrade

Everything the person made: schedules are files in their home and units in
their user manager, untouched by a package upgrade. A run in progress during
an upgrade is an ordinary Pi session and resumes or ends like any other; a
run that fell during the upgrade's downtime is a missed run as above.
