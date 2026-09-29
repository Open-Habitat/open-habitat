---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: high
related: ['@github-repos-first-onboarding', '@connect-github-workspaces']
lane: github-clone
collision: [internal/gateway/, internal/daemon/]
blocked_by: ['@pre-pi-github-repo-catalog']
---

# Clone selected GitHub repositories before Pi sign-in

## Description

After an authenticated browser chooses an exact repository from the pre-Pi GitHub catalog, let the mapped-UID daemon perform one explicitly requested native gh/Git HTTPS clone into its own ~/src. The browser cannot choose UID, filesystem path, clone URL or credential. Gateway enforces session+CSRF and forwards only a validated exact owner/repo selection. Revalidate the repository identity via native gh before mutation; check own ~/src path and no symlink escape, duplicate name, partial/in-flight result, and recover only by read-only filesystem observation rather than automatic retry. Bound network/subprocess work and verify final checkout before reporting success; fail closed on unknown and retain honest diagnosis. No workspace registry or gateway GitHub secrets; preserve all Pi gates outside this narrow onboarding import. Synthetic separate-UID and browser contract tests cover cross-user, denial, path/URL injection, collision, cancellation and uncertainty. Separate from full create/push/delete in @connect-github-workspaces. Record tests and limitations, clean CI. Must follow @pre-pi-github-repo-catalog catalog contract.
