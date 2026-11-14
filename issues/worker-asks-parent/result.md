# Research result

[Workmux benchmark and candidate designs](research-workmux.md) compares workmux
0.1.282, Taskfleet's current attention/message surfaces, and Claude Code teams.
Workmux supplies status/capture/terminal-send orchestration, not a correlated
worker-to-parent question protocol. Taskfleet already supports durable live
awaiting-input events; the gap is a cross-harness answer exchange.

Recommendation for discussion: a durable blocking CLI ask/answer in Taskfleet,
with Habitat projecting state and waking the parent through its native observer.
The report offers three proposals; no design is approved and the issue stays open.
Preparation returns to pending for discussion.

## Decisions for later review

- Treat parent-first handling as the requirement, not a request to bypass human
  permissions. Alternative: surface every worker question directly to the person.
  Reason: the recorded product direction reserves human interruption for decisions
  the parent cannot make.
- Recommend a cross-harness shell exchange rather than expanding Pi-only live
  steering first. Alternatives and costs are in proposals B and C. Reason: the
  question/answer identity must survive disconnected adapters and work for all
  requested harnesses.
- Separate startup-silence detection and non-blocking notes from decision asks.
  Alternative: one generic messaging feature. Reason: a worker blocked before
  its agent loop cannot execute an ask; notes need no decision deadline.

## Verification

Focused self-review against pinned source, installed CLI help and vendor docs;
checked reference paths and whitespace. No runtime tests needed for this
issues-only research. No live inter-agent delivery experiment was performed.

Live check: no test-server behavior changed. Read the report and discuss proposal
A against B/C; there is no new worker-question control to try yet.

# Design result (14.11.2026, rewritten the same evening)

[Design for review](design.md), rewritten to Jari's evening decision: the
agent chooses only its conversation's section (*Käynnissä* or *Sinun
vuorosi*) and writes no text on the row. Part 1 is that choice, part 2 the
worker's question to its parent without rail text, and the appendix a proposal
for Taskfleet (not filed, Taskfleet unchanged). Nothing is implemented; both
issues stay open with preparation pending until Jari has read the design and
answered its six questions.

Review: focused self-review against the sources: both issues' `## Decisions`,
the design's history (`git log -p`), and the code the design relies on
(`web/src/app/railNow.ts` after the fix that made reading a reply neutral,
`web/src/text/status.ts`, `internal/daemon/wake_linux.go`, the agent CLI's
command list). The three diagrams parse with Mermaid 12.2.0.
`git diff --check` and `scripts/validate-project-view.py` are clean; no tests,
since only issue documents changed.

Live check: no test-server behaviour changed. To see what part 1 starts from,
let an agent start a worker and reply "I'll report when it finishes": the
conversation shows under Sinun vuorosi although nothing is asked of you.

## Decisions for later review

Made by judgement while rewriting; each is also visible in the design.

- **Command `open-habitat agent section update --section running|yours`.**
  Alternatives: keep the earlier `agent handoff`, or `agent rail-section`.
  Reason: the decision speaks of the section, and "handoff" named a
  three-state declaration that no longer exists.
- **`yours` stays as a value although it is what happens without the
  command.** Alternative: a single `running` value plus a delete. Reason: the
  decision names both sections, and the agent needs a way to take back a
  `running` said earlier in the same turn.
- **No value for Hiljaiset.** Alternative: keep the earlier `done`. Reason:
  the decision names two sections. Asked as question 2.
- **`running` holds only while Habitat sees work going on, and a worker that
  waits for the person does not count as work.** Alternative: trust the agent
  until the next turn. Reason: with no text on the row, a Käynnissä row needs
  an observed reason that today's labels can name, and a forgotten choice must
  not hide a reply.
- **The five-minute safety net uses today's label *Worker odottaa sinua*.**
  Alternative: a new fixed label naming the question. Reason: the rail is to
  look as it does today.
- **The worker's question stays visible in the Workers panel.** Alternative:
  no question text anywhere outside the conversation. Reason: the decision is
  about the rail row. Asked as question 5.
- **The code walkthrough and the byte limits of the first version are not in
  the rewrite.** Reason: the walkthrough repeated code that has since changed,
  and the limits were the writing agent's numbers; whoever files the Taskfleet
  proposal sets them.

## Erottelu

Mistä uudelleenkirjoitetun suunnitelman väitteet ovat peräisin.

**Pidetty päätettynä**

- Agentti päättää vain osion, Sinun vuorosi tai Käynnissä, `open-habitat`-komennolla;
  ei agentin tekstiä riville; raili näyttää samalta kuin nyt. Lähde:
  `agent-sets-rail-state`, Decisions 14.11.2026 klo 18.38Z (sama kirjaus
  tässä issuessa).
- Workerin kysymys menee vanhempiagentille, joka vastaa ja kysyy ihmiseltä
  vain kun ihmisen on vastattava. Lähde: tämän issuen Decisions 14.11.2026
  klo 12.58Z.
- Vastauksen avaaminen ei siirrä riviä osiosta toiseen. Lähde: koodi
  (korjaus `rail-open-moves-turn-to-running`).

**Muutettu ehdotuksiksi** (agentin kirjoittamia, eivät päätöksiä)

- Komennon nimi, tallennus keskustelun omaan Pi-historiaan, ja sääntö että
  komento kelpaa vain oman vuoron aikana.
- Sääntö, että Käynnissä-valinta pätee vain niin kauan kuin Habitat itse
  näkee työn jatkuvan.
- Koko Taskfleet-ehdotus (`node ask`, `run answer`, `run escalate`),
  määräajat, viiden minuutin turvaverkko, nukkuvan keskustelun herättäminen
  kysymyksestä, vastaaminen Workers-paneelista ja toteutusjärjestys.
  Päätöksesi kattaa sen, kenelle kysymys menee, ei näitä yksityiskohtia.

**Pudotettu**

- Tilat *tarvitsee vastauksesi* tekstillä ja *valmis*, kysymysteksti
  (`--text`), kysymyksen kytkentä ilmoitukseen (`--worker-ask`) ja kaikki
  railin uudet tekstit: *Odottaa workereita*, *Kysyy sinulta: …*, *Worker
  kysyy agentilta*, *Worker odottaa vastausta: …*. Syy: iltapäätös.
- Luku "What the code does today": se toisti koodia ja oli jo osin vanhentunut.
- Luku "Decisions for later review" suunnitelman sisällä: perustelut ovat nyt
  ehdotusten vieressä.
- Tavurajat, kiistot asioista joita kukaan ei ehdottanut, ja toistot.

**Ristiriidat myöhemmän päätöksen kanssa**

1. **Ensimmäinen versio rakensi kolmitilaisen ilmoituksen, jossa agentti
   kirjoittaa riville kysymyksen.** Iltapäätös kumoaa sen. Suunnitelma on
   korjattu. Kopiot muualla:
   - `issues/agent-sets-rail-state/result.md`: alun viittaus on korjattu;
     sen luku "Prototype round 1" kuvaa yhä vanhaa mallia ja kuuluu toiselle
     ajolle.
   - `design-system/prototypes/rounds/2026-11-14-rail-agent-state/`
     (`NOTES.md`, `round.tsx`): prototyyppi noudattaa vanhaa mallia
     (`waiting_workers`, `needs_answer`, `done`, rivitekstit). Ei koskettu.
   - `issues/agent-sets-rail-state/item.md`, luku "Idea": mainitsee
     esimerkkeinä lyhyen kysymyksen ja *valmis*-tilan. Se on ideasi sellaisena
     kuin se kirjattiin, ja päätös on sen alla, joten jätin sen ennalleen.
2. **Ensimmäinen versio kuvasi railin säännön niin kuin se oli ennen illan
   korjausta** (luettu vastaus piti vuoron vain kun mikään ei ollut käynnissä).
   Nyt luettu ja lukematon vastaus käyttäytyvät samoin. Ongelma, jota osa 1
   korjaa, on ennallaan.
3. **Ensimmäinen versio väitti, että Nosta vie rivin aina Sinun vuorosi
   -osioon.** Nykyisessä railissa nostettu keskustelu näkyy Käynnissä niin
   kauan kuin sen työ jatkuu. Uusi teksti sanoo vain, että merkkisi toimivat
   kuten nyt.
4. **Tämän issuen ideoissa lukee, että ihminen voi vastata workerille suoraan
   Workers-paneelista.** Päätöksesi mukaan kysymys menee agentille. Suunnitelma
   ehdottaa, että paneelin vastaus kulkee keskustelun kautta (kysymys 4).

**Kysymykset, joista en ollut varma**

- Tarkoittiko "Sinun vuorosi tai Käynnissä", että Hiljaiset jää kokonaan pois?
  Tulkitsin niin (kysymys 2).
- Koskeeko "ei agentin tekstiä" myös Workers-paneelia? Tulkitsin, ettei koske
  (kysymys 5).
- Turvaverkko nostaa keskustelun Sinun vuorosi -osioon ilman agentin valintaa.
  Se on Habitatin oma havainto eikä agentin teksti, mutta se on uusi syy
  nousta osioon. Sopiiko se siihen, että raili näyttää samalta kuin nyt?
