---
created: 2026-10-25
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: normal
related: ['@habitat-seat-commands']
lane: html-views
lane_seq: 1
collision: [web/src/app/]
preparation: ready
closed: 2026-10-25
---

# Agent HTML artifacts and web views: show, open, share

## Description

Jari, 2026-10-25: "miten me näytetään html-sisältöä ja miten me voidaan avata verkkosivuja (esim. prototyyppaus-skilliä varten) ... voisi olla ihan kiva et on sellaisia html artefakteja joita se habitat agentti voisi näyttää ja joita voisi jakaa samalla serverillä asuville ja/tai julkisesti. ... mikä olisi hyvä tapa ja miten sitä voisi prototyypata." (In short: how does Habitat show HTML content and open web pages, for example for the prototyping skill? Agents should be able to show HTML artifacts and share them with people on the same server and/or publicly. What would a good way be, and how should it be prototyped?)

Today, on Jari's own machines, agents show HTML through `tw browser-open` and glasspad (loopback or hosted links), and prototypes are viewed as local files or dev servers. A Habitat agent has none of these: its browser is the Habitat page itself.

## Goal

1. Decide, with Jari, how an agent in a person's Habitat account:
   - shows a self-contained HTML artifact, or a multi-file prototype, to that person in their Habitat browser view;
   - opens a page the agent's workspace serves, such as a dev server or prototype, without a public port;
   - shares an artifact with named people on the same server, and optionally publicly, with revocation.
2. Authority and security under the Unix-user boundary decide the design. The daemon serves only its own user's files. A share to another person must not let that person's daemon or browser read the owner's home directly. A public link is an unauthenticated route, a new attack surface, and needs its own decision. Scripts in artifacts need origin isolation from the Habitat app (a separate sandboxed origin or `sandbox` iframe), because Habitat's session cookies are an obvious target.
3. Reuse what exists before building: the editor host routes, glasspad, and the workspace preview.

This overlaps with `habitat-seat-commands` ("open/show" on the person's browser) and should be decided together with it.

## Acceptance Criteria

- [x] Research with a recommendation (options, authority model, origin isolation, sharing and public links, reuse) and Jari's decision recorded as an ADR.
- [x] A prototype round of the accepted direction (showing, opening and sharing an artifact in the Habitat UI), with Jari's verdict.

## Decisions

### 2026-10-25T12:20:37Z · @jari

Jari 2026-10-25 on research.md: (1) option C approved: the agent offers, Habitat shows the content in an isolated origin in a side panel; whether the panel works like the editor panel or opens on the right is to be prototyped. (2) Sharing with other people (named or public) is deferred until everything else works. (3) Live dev servers are never shared. Prototypes open on their own page in a separate browser tab/window (owner-only, isolated origin), not inside the panel. (4) Next: a prototype round of the panel placement and the separate-tab prototype opening; ADR when the accepted prototype fixes the shape.

### 2026-10-25T12:35:58Z · @jari

Jari 2026-10-25 on round 1: the right-hand panel (variant 'Oikealla') is the direction. The person chooses with a button whether a view opens in the panel or on its own browser tab; the agent cannot know, so there are no separate card types for reports and prototypes. A riff round follows on that basis (conductor recommendation adopted: a Laajenna/expand option borrowing round 1's viewing mode).

### 2026-10-25T15:10:26Z · @jari

Jari 2026-10-25 on round 2: 'Suora' is chosen: every offer card has two buttons, Avaa (right-hand panel) and Avaa omalle välilehdelle, with no remembered choice or setting. The panel's controls (close etc.) follow the editor panel's header (EditorHeader). Next: ADR, then a thin owner-only first implementation; sharing stays deferred.
