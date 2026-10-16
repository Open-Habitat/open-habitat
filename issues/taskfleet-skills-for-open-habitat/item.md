---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: normal
lane: research-skills
lane_seq: 1
collision: [issues/taskfleet-skills-for-open-habitat]
preparation: ready
closed: 2026-10-16
closed_by: pi
---

# Taskfleet skills for Open Habitat

Jari 2026-10-16: "Taskfleetin skillejä ei ole asennettu. Itse asiassa ne pitäisi käydä läpi ja kenties tehdä niistä jonkinlaiset Open Habitat -ympäristöön sopivat variantit." (In short: the Taskfleet skills are not installed on the test server; they should be reviewed, and perhaps adapted into variants that suit the Open Habitat environment.) The browser's Pi on the test server has Taskfleet 0.15, but no skills that teach the agent to use it (the `/worktree-*` family, `taskfleet-overview`, `worktree-merge` and others used on alder). Research what these skills assume about alder (tmux seats, `tw`, Fleetrepo, `notify-jari`, profiles, headless sessions, issuectl), which of that holds for a mapped user on an Open Habitat host, and propose Open Habitat variants. Cover where they come from (shipped with the product as Pi skills, declared by the operator, or installed per user), how they stay in sync with Taskfleet releases, and what must differ (no tmux seat; the browser shows spinoffs under the parent, so the parent waits with `taskfleet run wait`).

## Acceptance Criteria
- [x] `issues/taskfleet-skills-for-open-habitat/report.md`: an inventory of the skills, their assumptions, and the proposed variants and distribution.
- [x] A recommendation for Jari, as a proposal, not an ADR.

## Decisions

### 2026-10-16T12:49:36Z · @jari

Jari 2026-10-16: fix the skills at the source in Taskfleet (environment-neutral command skills; issuectl conditional per repository in workflow skills; no Fleetrepo, tw, Telegram or desktop references). No Open Habitat forks; install Taskfleet's bundled skills pinned, plus a short host note. issuectl's 'issue' skill and the git basics come later. Issues: taskfleet environment-neutral-skills; here install-taskfleet-skills.
