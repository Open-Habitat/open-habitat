---
created: 2026-10-14
updated: 2026-10-14
type: feature
reporter: jari
status: done
priority: high
lane: web
lane_seq: 29
collision: [web/, internal/daemon, contracts/v1]
closed: 2026-10-14
closed_by: claude
---

# Home page as workspace sections with full recaps

Jari chose the home page on 2026-10-14: the "Työtilaosiot" direction of the round `design-system/prototypes/rounds/2026-10-14-katsaukset`, frozen as the draft `design-system/drafts/Etusivu.proto.html` and described in `design-system/design.md` (Sovelluskehys). It replaces the current `ReturnView` ("Jatka siitä, mihin jäit").

What the page shows:
- A header "Työtilat" with a one-line summary (N workspaces · N waiting for you · N running) and a primary "Uusi työtila" button.
- Each workspace with open work is a section: a header row with the workspace name (mono, links to the workspace page), git branch and dirty-file count, the done count, "+" (new conversation), and a `…` menu. Under it, its open conversations are two-column cards in attention order (new answer, waiting, working, unknown).
- Each card shows the conversation's **Tilannekatsaus in full and verbatim** (recap text and the Seuraavaksi line, never clamped or rewritten), its age, a "uusia viestejä" marker when stale, the live activity line for a working conversation, and a Lue vastaus / Vastaa / Avaa link.
- A conversation that just finished and has no recap yet shows only its title ("valmistui juuri · katsaus syntyy pian").
- Workspaces without open work are a compact row list at the bottom.
- "Uusi työtila" opens a dialog: clone from GitHub (owner/repo with suggestions from the user's GitHub) or create a new directory (`~/src/<name>`, `git init`).

Host facts this needs (decide by reading the daemon and contracts; record the decisions in result.md):
- The recap per conversation, read from wherever the recap feature (`recap-above-composer`) keeps it. No new store.
- The git branch and dirty count per workspace from native `git` as the user, bounded and cached only per snapshot.
- Workspace creation by cloning through the existing onboarding clone path; new-directory creation as the user, under the user's home only.
- `…` menu: Uusi keskustelu, Avaa työtilasivu, Kopioi polku, Avaa GitHubissa (when there is a GitHub remote). "Poista työtila…" is shown disabled with the reason until `recoverable-workspace-deletion` lands. The prototype's "Piilota etusivulta" is **out of scope**: it would need a new store.

## Acceptance Criteria

- [ ] The home page matches the draft at desktop and phone width in light and dark themes. Lab screenshots are compared with the draft in the same states, and each deviation is justified in result.md.
- [ ] Recaps are shown in full and verbatim. A just-finished conversation without a recap shows only its title.
- [ ] New workspace works for GitHub clone and new directory, as the mapped Unix user only (Go tests with a disposable HOME, plus a browser journey).
- [ ] The `…` menu actions work. Delete is disabled with its reason.
- [ ] Contract changes are in `contracts/v1/`, with generated code regenerated.
