# Decisions

An architecture decision record says what was decided and why while the
decision still waits for its code or for Jari's later review. Once the code
carries it, the record goes to git history (`scripts/from-history.sh
docs/decisions/adr-NNNN-*`) and the rules the code cannot show move into the
nearest `AGENTS.md`. Numbers keep counting up across removed records, so
`ADR 0019` in a comment always names one record. Open questions and
implementation work belong in issues.

| Record | Decision |
|---|---|
| [ADR 0007](adr-0007-bound-user-deprovision.md) | Removing a bound user is a later need; the implementation is open |
| [ADR 0024](adr-0024-clone-jobs.md) | Accepted 2026-10-17: a clone is a job of the user's daemon that outlives the request; an interrupted clone is recognised from the filesystem and only removed or restarted explicitly; replaces ADR 0005's completion rules |
| [ADR 0025](adr-0025-worktree-as-a-place.md) | Accepted 2026-10-18: a worktree is a plain Git place holding ordinary browser conversations; agents settle it, the browser shows Git's state, and the daemon lists and removes worktrees with the Trash's safety rules; amends ADR 0010, extends ADR 0019 |
| [ADR 0026](adr-0026-integrations-catalog.md) | Accepted 2026-10-18: integrations are a product catalog of native tools run by the person's daemon; Google, Microsoft, IMAP/SMTP with CalDAV/CardDAV, and Dropbox accounts, several per provider; one daemon-maintained personal-data skill in `~/.agents/skills/`, MCP in `~/.pi/agent/mcp.json`; device-code, pasted-redirect or app-password logins; continuous sync as the person under `~/cloud/<service>/<account>/`, with the broker starting syncing users' daemons at boot; the operator registers the OAuth applications |
| [ADR 0027](adr-0027-agent-cli-route.md) | Accepted 2026-10-21: a separate own-UID daemon listener shares personal operations without gateway or broker authority; native quota reads, explicit launch context, and an agent CLI in the same binary |
| [ADR 0029](adr-0029-installation-baseline.md) | Accepted 2026-10-22: Ubuntu 24.04 amd64/systemd, separate ext4 quota-enforced `/home`, fully pinned releases, one `open-habitat host` operator with read-only check/plan and fix-forward upgrades |
| [ADR 0030](adr-0030-site-onboarding-authority.md) | Accepted 2026-10-24: onboarding configuration is gateway administration state reaching daemons only in gateway-built requests; the broker owns two admission sources (`site.json` and runtime `admit`/`withdraw` behind `runtime_admission`); the gateway holds the site AI key and seeds it once at account creation; defaults are imported once by the person's daemon after a gateway access check; the admin sees a sign-in receipt |
| [ADR 0031](adr-0031-native-gitea-connections.md) | Core architecture accepted by Jari 2026-10-24: tea owns per-user Gitea PAT connections; a bounded native-format/API/Git adapter shares that one credential with HTTPS Git; detailed network/CA policy remains proposed and implementation is not yet authorized |
| [ADR 0032](adr-0032-agent-html-views.md) | Accepted 2026-10-25: agents offer HTML views that the person opens in a right-hand panel or an own tab (two buttons on every card); the gateway serves them on an isolated per-view origin through a one-time handoff, from frozen exports the owner's daemon reads; owner only, sharing and public links deferred, live dev servers never shared |
| [ADR 0033](adr-0033-view-capability-links.md) | Accepted 2026-10-29: anyone with the link can open a shared view; the person alone creates, extends, re-points and revokes links in the browser, the administrator can revoke any; the gateway keeps them and serves the frozen export from the owner's daemon on a per-link host of the view namespace, running like the owner's own view; the agent gets no link operation; operator-enabled per site; amends ADR 0032 decision 5 |
| [ADR 0035](adr-0035-view-stable-address.md) | Proposed: one stable entry address per frozen view, shared state across cards, old copies revive on owner publication; entry routing, version behaviour and legacy reset await Jari |
| [ADR 0034](adr-0034-release-digest-verification.md) | Accepted 2026-10-30: a release is verified by the SHA-256 GitHub states for its product package and manifest, with the manifest digest pinned in `site.json`; the product signing key, signatures and release-key pin are removed in four ordered steps; supersedes ADR 0029's signing |
