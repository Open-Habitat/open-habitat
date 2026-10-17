---
created: 2026-10-17
updated: 2026-10-17
type: feature
reporter: jari
status: in-progress
priority: high
lane: web
lane_seq: 2
collision: [web/src/app/, web/src/components/]
related: ['@proto-repo-selection']
blocked_by: ['@implement-button-system', '@repo-catalog-clone-jobs']
preparation: ready
---

# Uusi työtila as a clone page (Kloonaussivulla)

Browser side of the repo-selection flow Jari chose on 2026-10-17 (`proto-repo-selection`, direction **Kloonaussivulla**), on the contract from `repo-catalog-clone-jobs` and the button system from `implement-button-system`. The prototype is `design-system/prototypes/rounds/2026-10-17-repon-valinta/` (build with `node design-system/prototypes/build.mjs <round>`); decisions and Jari's observations are in `issues/proto-repo-selection/result.md`.

- **Uusi työtila is a page.** Its Kloonaukset section at the top holds running, failed, cut and finished clones, each finished one with Avaa työtila; the person can leave the page. A sidebar block above the workspaces shows `repo 14 %` / `keskeytyi` and links back. Leftovers live here, not in the workspace list.
- Repo list as in the prototype: latest pushes (only repos that are not workspaces yet), own repos, organisations, search; 5 per section plus "Näytä kaikki N"; the time filter is the user's choice and says how many it hides. Typing an exact `owner/repo` offers any accessible repo, or says it does not exist or is not accessible.
- Details before cloning (visibility, default branch, last push, size, target, free quota); large repos warn and offer Kevyt klooni as a choice, full history the default.
- Cut clone: "Aloita alusta" and "Poista keskeneräinen", never automatic.
- **Jari's prototype observations:** the details pane must scroll independently of the list within the viewport (in the prototype it only scrolled once the list reached its end, and the Kevyt klooni content made it taller than the window); the search field's focus ring must not be clipped by the row above.

## Acceptance Criteria
- [ ] The page replaces the modal clone dialog; browser tests for success, failure and retry, leaving and returning during a clone, and an interrupted clone.
- [ ] Lab screenshots compared pairwise with the prototype in the same states (desktop and phone, light and dark), each difference explained.
