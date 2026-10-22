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
