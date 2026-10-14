---
created: 2026-10-14
updated: 2026-10-14
type: feature
reporter: jari
status: in-progress
priority: normal
lane: web
lane_seq: 28
collision: [web/, internal/daemon, contracts/v1]
---

# Configure the user's git identity from GitHub at onboarding

Jari, pilot.59 (2026-10-14): when an agent committed, it reported "commit vaati väliaikaisen author/committer-identiteetin, koska git user.name/user.email ei ollut konfiguroitu" (the commit needed a temporary author/committer identity because git user.name/user.email was not configured). A newly provisioned user has no git identity, so every agent improvises one.

Conductor's recommendation (2026-10-14; Jari may redirect):
- **Scope: global for the Unix user.** Use `git config --global` in the user's own `~/.gitconfig`, written by the daemon running as that user. This is the native place, and it is what the same person gets over SSH. Per-repository overrides remain ordinary git and are not managed by us.
- **Source: the GitHub identity the user already signed in with.** `user.name` is the GitHub profile name (falling back to the login). `user.email` defaults to the GitHub noreply address `<id>+<login>@users.noreply.github.com`, which always exists and does not publish a private address. The user may pick a verified address instead.
- **When:** in onboarding once GitHub is connected, shown prefilled for confirmation, and editable later in account settings.
- **Never overwrite** an existing value. If `~/.gitconfig` already has an identity, show it read-only with a note on where it comes from.
- No new store: the truth is `~/.gitconfig`, read back with `git config --global --get`.

## Acceptance Criteria

- [ ] After onboarding, `git config --global user.name` and `user.email` are set for a fresh user (Go test with a disposable HOME, and a lab journey).
- [ ] An existing identity is never overwritten (test).
- [ ] Account settings show the current identity and allow changing it.
- [ ] The contract change is in `contracts/v1/`, with generated code regenerated.
