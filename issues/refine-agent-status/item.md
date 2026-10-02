---
created: 2026-09-21
updated: 2026-10-02
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 60
collision: [docs/, design-system/]
related: ['@consistent-control-feedback', '@restore-v2-navigation']
---

# Design a consistent language for agent states

## Purpose

Help a person understand what an agent is doing and whether it needs attention,
wherever that agent appears. Jari's 2 October 2026 sidebar observations exposed a
broader usability question than missing dots: which states matter to the person,
what they mean, and how the same meaning is expressed throughout the interface.

## Design task

Use the current agent behavior, the facts available from the host and observed
use to work out the user-facing states. Distinguish concepts that answer different
questions, such as whether a process exists, whether it is working, whether it
is waiting for the person, and whether the browser can control it. These are
questions for the design, not a prescribed list of states or a demand to show
every internal state.

Recommend a small, coherent visual language that helps the person recognize the
state and decide what to do. Show it in the agent list, sidebar and conversation,
including compact presentations. A state should remain recognizable across those
contexts. Text, symbols, color and motion can work together; the meaning should
also be available without distinguishing color or animation.

The earlier hollow/green/pulsing dots are a starting point. Jari broadly recognized
the proposed ended/idle/working interpretation but asked for this design work
rather than fixing those meanings as a new decision. Existing drafts and
components are reference material. Neither dots nor whole-row highlighting are
the predetermined solution.

## Outcome and related work

Leave a concrete recommendation with the meaning of each user-facing state, its
relationship to facts the system actually knows, and examples across views that
Jari can assess. Identify any missing facts rather than inventing a status from
visual convention. The implementation work follows from the selected design.

@consistent-control-feedback investigates the software foundation that lets
shared interaction and presentation rules hold across the UI; this task owns the
meaning and appearance of agent states. Coordinate the design with
@restore-v2-navigation and the conversation views. Earlier post-MVP visual
refinement was the starting scope; Jari's latest request broadens this into a
focused usability design of agent states.

## Decisions

### 2026-09-30T17:54:12Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue käytiin läpi rethink-instructions-skillillä (gpt-6-astra) ja faktantarkistettiin fact-check-instructions-skillillä (claude-opus-5-5). Teksti on jo selkeä ja riittävän tiivis, joten sitä ei muutettu. Ilman Jaria säilytettiin Jarin kirjaama post-MVP-suunnittelun rajaus, alkuperäinen statuspisteen hyväksyntä ja designin katselmointi ennen toteutusta; navigaatio-shellin synteettisiä kuvia ei tulkittu aidoksi moniagenttikäytön havainnoksi. Faktantarkistus ei löytänyt korjattavia väitteitä. @review-mvp suljettiin vanhentuneena, mutta issue vaatii edelleen havainnot todellisesta käytöstä; estettä, kaistaa ja Jarin päätöksiä ei muutettu. Ei ristiriitaa Jarin aiempien päätösten kanssa.

### 2026-10-02T10:05:17Z · @codex

Jari pyysi 2.10.2026 agenttien tiloista oman pienen käytettävyyssuunnittelun: mitä tiloja agentilla voi olla, miten niitä ilmaistaan ja miten yhtenäinen ilme kaikkialla auttaa käyttäjää ymmärtämään niitä. Hän tunnisti alustavasti aiemman tyhjä/vihreä/sykkivä-pistejaon, mutta ei lukinnut näitä tiloja tai esitystapaa. Tämä tarkentaa aiemman visuaalisen viimeistelyn tehtäväksi suunnitella tilojen merkitys ja johdonmukainen esitys. Käyttöliittymän toistuvien epäjohdonmukaisuuksien ohjelmistotekninen juurisyy kuuluu @consistent-control-feedback-issueen. Käytetään tätä olemassa olevaa issuea uuden päällekkäisen tehtävän sijasta.
