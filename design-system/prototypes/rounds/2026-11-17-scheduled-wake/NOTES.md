# Ajastettu herätys – kierros 1

- **Nyt**: agentti voi siirtää keskustelun Hiljaisiin (agent-sets-rail-state), mutta ei herätä sitä. Agentti sanoo rehellisesti, ettei pysty muistuttamaan.
- **1 Aika rivillä**: odottava rivi pysyy Hiljaisissa, ja rivin lopussa on kello ja herätysaika iän paikalla (`to 9.00`, `ke 14.00`, `1.12. 10.00`). Herätetty, lukematon rivi Sinun vuorosi -osiossa näyttää samalla paikalla, milloin se herätettiin. Muutos ja peruminen ovat keskustelussa agentin vastauksen alla.
- **2 Herätykset-osio**: ajastetut keskustelut ovat omana osionaan Käynnissä- ja Hiljaiset-osioiden välissä herätysajan mukaan järjestettynä. Odottava herätys on keskustelun alareunassa kiinnitettynä palkkina.
- **3 Kello merkissä**: rivi on Hiljaisissa kuten muutkin, mutta merkin asukkaan paikalla on kellon viisarit. Aika on vain rivin kuvauksessa ja keskustelun yläpalkissa, jonka valikosta herätystä muutetaan tai se perutaan.

Issue `scheduled-wake`. Suunnat, suositus ja kysymykset Jarille ovat issuen
`result.md`:ssä.

Sivu koostuu tuotannon osista: `AppShell`, `WorkspaceRail`, `NowSections`in
osiomerkintä, `AgentNavItem`, `QuietSection`, `ConversationFrame`,
`AgentHeader` (`activityControl`-paikka), `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `ToolRow`, `Menu` ja `ControlButton`.
Kierroksen omia ovat Open Habitatin rivi keskustelussa (`sw-line`: herätys
tapahtui, myöhästyi, siirrettiin tai peruttiin), odottavan herätyksen rivi
ja palkki, aikaeditori, otsakkeen herätysvalikko, suunnan 2
Herätykset-osio sekä rivin herätysaika ja kello merkissä. Kaksi viimeistä
piirretään tuotannon riville CSS:llä: kierros asettaa `data-wake`-attribuutin
rivin `time.ah-nav-time`-elementtiin ja `data-wake-clock`-attribuutin
riville. Tuotannossa ne olisivat `AgentNavModel`in kenttiä.

Yläpalkin kello on katselmoinnin apu: maailma alkaa tiistaina 17.11. klo
15.20, ja Seuraava herätys -painike siirtää kellon seuraavaan odottavaan
herätykseen. Tilanteet ovat samat kaikissa suunnissa: Varakopion poisto
(henkilön pyyntö, to 19.11. 9.00, auki), Tilauksen seuranta (agentin oma
seuranta, ke 18.11. 14.00), Vuokrasopimuksen irtisanominen (1.12. 10.00),
Laskujen eräpäivät (herätys klo 8.00 myöhästyi, koska palvelin oli poissa
7.40–10.35, herätettiin 10.36), vertailuksi käynnissä oleva, vastattava ja
herätyksetön hiljainen keskustelu. `?theme=light|dark|contrast` ja
`?lang=en` valitsevat alkutilan.

## What the host would need (proposal, not decided)

This is a sketch for discussion. Nothing here is built, and the parts that
move authority are questions for Jari in `result.md`.

**Setting a wake (CLI, AI-first canon).** A new noun under the existing
`open-habitat agent` surface, which already resolves `--current` from a
daemon-launched Pi context:

```
open-habitat agent wake create --current --at 2026-11-19T09:00+02:00 --note "Muistuta poistamaan backup-2024" [--json]
open-habitat agent wake list   [--current | --all] [--output FILE.jsonl]
open-habitat agent wake update <wake-id> --at …
open-habitat agent wake delete <wake-id>
```

`--at` is RFC 3339 with an explicit offset or `Z`; a bare local time is
rejected with a usage error that names the person's time zone and an
example, so the agent never guesses. `--in 2d` is a convenience the CLI
turns into `--at` and echoes back. `create` returns the wake id, the
absolute UTC time and the time in the person's zone; a write that got no
reply carries the same "inspect, do not replay" warning as other
conversation writes, and `list --current` is the inspection. Exit codes:
0, 2 usage (bad time, past time, too far ahead), 1 refused (limit,
archived conversation). `wake create` also places the conversation in
Hiljaiset (agent-sets-rail-state's `quiet`), since waiting for a wake is
exactly a reason for Hiljaiset; the agent does not issue two commands.
The note is for the agent itself at wake time and for the list; per the
14.11. decision it is not written on the rail row.

**Where the daemon keeps it.** In the person's home, owned by them:
`~/.local/state/open-habitat/wakes.json` (0600, written atomically), one
entry per wake `{id, agent_id, workspace, at_utc, zone, note, set_at,
set_by: agent|person, status}`. It is Habitat's own commitment, not Pi
history, so it does not belong on the Pi branch; but each set, change,
cancel and fire is also appended to the conversation as a Habitat entry so
the history tells the story (the lines this round draws). No new service
and no new authority: the daemon already runs as the person and already
writes state under `~/.local/state/open-habitat/`.

**Timers that survive restarts and reboots.** The daemon is
socket-activated, so it may not be running at the wake time. The broker
already enables lingering for admitted accounts, and the daemon already
writes and starts systemd user units in the account (Omat koneet's
Tailscale unit). So the daemon keeps one user timer,
`~/.config/systemd/user/open-habitat-wake.timer`, with `OnCalendar=` set to
the earliest pending wake and `Persistent=true`, firing a oneshot
`open-habitat agent wake due` that only connects to the person's own daemon
socket (activating the daemon) and asks it to process due wakes. After
every change the daemon rewrites the timer to the next wake. On every
daemon start it also processes overdue wakes itself, so a timer lost to a
manual edit is not a lost wake. `Persistent=true` makes a wake whose time
passed while the host was off fire right after boot; the daemon records
`woke_at` and the downtime it can see, which is what the "late" line shows.

**Waking the agent.** A due wake is a turn started by Habitat with a
message, the same idempotent wake operation as a stopped Pi's
(wake-stopped-agent, ADR 0020 as amended): if Pi has stopped, the daemon
starts it, then sends one message such as "Ajastettu herätys (asetettu ti
17.11. 15.12): <note>" marked as Habitat's, not the person's. If a turn is
running at that moment the wake is delivered as a follow-up after it. The
reply then lands as any reply does, so the conversation rises to Sinun
vuorosi by today's rules, with no wake-specific rail logic. If the
person changed or cancelled the wake, the agent learns it in that message
or, for a cancel, with the person's next message.

**Archived, closed and deleted.** Archiving a conversation with a pending
wake asks once ("Herätys to 9.00 perutaan") and cancels it; a wake never
revives an archived conversation silently. A conversation whose Pi session
file is gone has its wake marked `orphaned` and shown in `wake list`, not
fired. A stopped Pi is not a reason to skip: that is the main case.

**Time zones.** The person's zone comes from their account preferences
(the browser's zone as the default on first sign-in), not the server's.
Wakes are stored in UTC with the zone they were set in, so "9.00 on
Thursday" stays 9.00 across a DST change because it is resolved to UTC at
set time in that zone, and a later move of the person to another zone does
not shift existing wakes (shown with the zone if it differs).

**Limits.** At most 20 pending wakes per person and 3 per conversation, no
wake closer than 1 minute or further than 400 days, no recurrence in the
first version (an agent that wants a weekly check sets the next wake when
it wakes). A wake fires at most once; a fire that fails (Pi cannot start,
AI key missing) is shown in the conversation as Habitat's error line and
puts the conversation in Sinun vuorosi so the person sees it.

**Contract.** The snapshot agent gets an optional `wake {id, at, set_by,
status, woke_at?, late?}` (the next pending or the last fired one), and
the browser gets `PATCH`/`DELETE` on it for Muuta and Peru. railNow reads
it into `AgentNavModel` (direction 1: the end time; 2: the section; 3: the
mark).

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-17-scheduled-wake/build.mjs <out>
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 550 \
  node design-system/prototypes/rounds/2026-11-17-scheduled-wake/check.mjs \
  <out>/offline.html <kuvahakemisto>
```

`<out>` defaults to `design-system/prototypes/dist/scheduled-wake`.
`web/node_modules` must match the lockfile (`npm ci --prefix web`). The
build's `undefined-composes-from` warnings come from production's
`Controls.module.css` and are not this round's. Check: 359 checks, clean
console.
