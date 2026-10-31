---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: fixed
priority: high
lane: clone-empty-repo
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Cloning an empty GitHub repository fails during onboarding

## Description

Jari 31.10. evening: Kaisa (the other person on Birch, pilot.17) started using Open Habitat and chose two GitHub repositories in onboarding: her own *omat* repository and the sourdough (hapanjuuri) one. The sourdough repository came through; *omat* did not appear: it could not be fetched. Jari suspects that is because *omat* is completely empty (created as a base to start using, no commits). Her account and home are another person's: do not read them; reproduce with an empty repository of your own instead.

## Acceptance Criteria

- [x] Reproduced with an empty GitHub repository (no commits, no default branch) through the same onboarding/clone path; cause named.
- [x] An empty repository becomes a usable workspace (clone with no commits, ready for a first commit, push sets the default branch), or, if something truly cannot be done, the person is told what happened and what to do, never a silent omission.
- [x] Same for Gitea/GitLab clone paths if they share the code; browser spec or daemon test with an empty remote.

## Comments
