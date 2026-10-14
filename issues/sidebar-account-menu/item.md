---
created: 2026-10-14
updated: 2026-10-14
type: feature
reporter: jari
status: in-progress
priority: normal
related: ['@home-workspace-sections']
lane: web
lane_seq: 31
collision: [web/]
---

# Sidebar account menu and workspace actions

Jari chose the sidebar's account and workspace controls on 2026-10-14: direction "Tilivalikko alhaalla" of `design-system/prototypes/rounds/2026-10-14-palkki`, now in the prototype library as `design-system/prototypes/lib/account.*`, visible in both drafts (`design-system/drafts/Etusivu.proto.html`, `design-system/drafts/Agentin vuoro.proto.html`), and described in `design-system/design.md` (Sovelluskehys).

- The account button is fixed at the bottom of the sidebar, and only the workspace list scrolls. It opens a menu upwards: full name and email, Asetukset, Palvelimen ylläpito (administrators only; this replaces the current inline "Palvelimen ylläpito" link), a theme segmented control (system / light / dark, the existing device-local theme setting), and Kirjaudu ulos.
- The Työtilat section header has a "Uusi työtila" icon that opens the same new-workspace dialog as the home page (`home-workspace-sections`).
- Each workspace row has a hover-revealed `…` menu (always visible on touch): Uusi keskustelu, Avaa työtilasivu, Kopioi polku, Avaa GitHubissa (only when the snapshot has `github_repo`), and Poista työtila… disabled with its reason until `recoverable-workspace-deletion`. Reuse the home page's actions and components rather than duplicating them.
- Menus have keyboard support (arrows, Esc returns focus) and stay open while the conversation scrolls. Phone: the same controls are in the drawer.

## Acceptance Criteria

- [ ] Lab screenshots match the draft at desktop and phone width in light and dark themes, compared in the same states. Each deviation is justified in result.md.
- [ ] The administration entry is only in the account menu, and only for administrators (browser test with an admin and a non-admin fixture).
- [ ] The account button stays visible with a long workspace list (element-rectangle check).
- [ ] The workspace `…` menu and Uusi työtila work, with delete disabled and its reason shown.
- [ ] result.md has a "Decisions for later review" section (AGENTS-WORKFLOW.md).
