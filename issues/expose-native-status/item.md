---
created: 2026-09-20
updated: 2026-10-05
type: task
status: open
priority: normal
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 20
collision: [docs/, design-system/]
preparation: pending
---

# Expose native task profiles and worker information when needed

## Purpose

Design the smallest useful way to show native task profile/model changes and
reliable Taskfleet/tmux bindings when observed use of the working product
reveals a need. This is accepted follow-up design work covering L8 and L13 in
[the TUI follow-up list](../native-agent-host-architecture/ui-design-later.md).

The result is a concrete information and interaction design, reviewed before
implementation begins or an implementation issue is activated. Available native
fields are evidence for the design, not a list of features to expose.

## Design considerations

For task profiles, start with showing the model/thinking change made by a native
command and a brief confirmation. A profile selector depends on the component
providing both profiles and a supported way to invoke them. The Fleetrepo TUI report's profile names are examples, not a new host-owned
configuration schema.

For Taskfleet and tmux, show bindings and worker state only where the native
evidence supports them. Worker lifecycle, conversation availability and browser
controllability are separate facts: finding a worker or its history does not
establish that the browser can control it. Unknown and stale information need
honest representations rather than an inferred ready or stopped state.

Native components retain histories, configuration, agent identity and subprocess
ownership. The browser presents their information through the agreed HTTP/SSE
path. A browser tab does not become an agent identity. Workspace registries,
parallel history stores, credential brokers, internal tenant models and
speculative caches remain outside this task; duplicating native ownership would
create competing sources of truth.

## Expected result

The reviewed design connects a concrete user need to the information shown and
any supported interaction. It records what was verified about native profile
commands, bindings and telemetry, including unknown/stale states and the limits
of browser control. Unverified capabilities remain explicit uncertainties.

Keep the design, supporting evidence and review results in this issue directory.

Sources: architecture (`docs/architecture.md`),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).

## Decisions

### 2026-09-30T17:34:40Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue selkeytettiin rethink-instructions-skillillä (gpt-6-astra) ja tarkistettiin fact-check-instructions-skillillä (claude-opus-5-5). Ilman Jaria säilytettiin suunnittelun katselmointi ennen toteutusta, etusivun metatiedot ja natiivien komponenttien omistajuus; täsmennettiin L8/L13:n rajat valitsematta uutta profiiliskeemaa tai kontrollia. Faktantarkistus korjasi vanhentuneen MVP-valmistumisrajan mukaiseksi Jarin 28.9. päätöksen kanssa (havaittuun käyttöön perustuva jatkosuunnittelu) ja täsmensi Fleetrepo TUI -raportin viitteen. Metatietojen lane ja blocked_by jätettiin ennalleen toimeksiannon mukaisesti; ristiriitaa Jarin aiemman päätöksen kanssa ei jäänyt. Natiivikomentojen ja telemetrian todellinen tuki jää suunnittelutyössä todennettavaksi.
